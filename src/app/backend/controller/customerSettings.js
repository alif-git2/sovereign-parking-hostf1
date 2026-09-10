import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Stripe from "stripe";

import ParkingUser from "@/app/backend/models/park_user";

const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024;

const ALLOWED_PROFILE_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (value.includes("authorization") || value.includes("token")) return 401;
  if (value.includes("not found")) return 404;
  if (value.includes("stripe")) return 400;
  if (value.includes("required")) return 400;
  if (value.includes("invalid")) return 400;

  return 400;
}

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getAppUrl(req) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const host = req.headers.get("host") || "localhost:3000";
  const protocol = req.headers.get("x-forwarded-proto") || "http";

  return `${protocol}://${host}`.replace(/\/$/, "");
}

function getBearerToken(req) {
  const header = req.headers.get("authorization") || "";

  if (!header.startsWith("Bearer ")) {
    throw new Error("Authorization token is required");
  }

  return header.replace("Bearer ", "").trim();
}

async function getCustomerFromRequest(req) {
  const token = getBearerToken(req);

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid authorization token");
  }

  const userId = decoded.id || decoded.userId || decoded._id || decoded.sub;

  if (!userId) {
    throw new Error("Invalid authorization token");
  }

  const customer = await ParkingUser.findOne({
    _id: userId,
    role: "customer",
    is_active: true,
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  return customer;
}

function safeUser(user) {
  if (!user) return null;

  if (typeof user.toObject === "function") {
    return user.toObject();
  }

  return user;
}

function getActivePaymentMethods(user) {
  const item = safeUser(user);

  return Array.isArray(item?.payment_methods) ? item.payment_methods : [];
}

function normalizeString(value) {
  return String(value || "").trim();
}

async function saveProfileImage({ file, customerId }) {
  if (!file || typeof file.arrayBuffer !== "function") {
    return null;
  }

  const mimeType = file.type;
  const extension = ALLOWED_PROFILE_IMAGE_TYPES[mimeType];

  if (!extension) {
    throw new Error("Invalid profile image type. Use JPG, PNG, or WEBP.");
  }

  if (Number(file.size || 0) > MAX_PROFILE_IMAGE_SIZE) {
    throw new Error("Profile image must be less than 2MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!buffer.length) {
    throw new Error("Profile image is empty");
  }

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "customer-profiles"
  );

  await fs.mkdir(uploadDir, {
    recursive: true,
  });

  const filename = `${customerId}-${Date.now()}-${crypto
    .randomBytes(8)
    .toString("hex")}.${extension}`;

  const filePath = path.join(uploadDir, filename);

  await fs.writeFile(filePath, buffer);

  return `/uploads/customer-profiles/${filename}`;
}

async function deleteOldLocalProfileImage(imageUrl) {
  try {
    if (!imageUrl || !String(imageUrl).startsWith("/uploads/customer-profiles/")) {
      return;
    }

    const filePath = path.join(process.cwd(), "public", imageUrl);

    await fs.unlink(filePath);
  } catch (error) {
    console.warn("Old profile image delete skipped:", error.message);
  }
}

async function ensureStripeCustomer(customer) {
  const stripe = getStripeClient();

  if (customer.stripe_customer_id) {
    try {
      const stripeCustomer = await stripe.customers.retrieve(
        customer.stripe_customer_id
      );

      if (!stripeCustomer?.deleted) {
        return customer.stripe_customer_id;
      }
    } catch (error) {
      console.warn("Stripe customer lookup failed, creating new:", error.message);
    }
  }

  const stripeCustomer = await stripe.customers.create({
    email: customer.email,
    name: customer.name,
    phone: customer.phone || undefined,
    metadata: {
      parking_user_id: String(customer._id),
      source: "customer_dashboard",
    },
  });

  customer.stripe_customer_id = stripeCustomer.id;

  await customer.save();

  return stripeCustomer.id;
}

function getCardDetailsFromPaymentMethod(paymentMethod) {
  const card = paymentMethod?.card || {};

  return {
    brand: card.brand || "",
    last4: card.last4 || "",
    expMonth: card.exp_month || null,
    expYear: card.exp_year || null,
    funding: card.funding || "",
    country: card.country || "",
  };
}


async function readProfileUpdatePayload(req) {
  const contentType = req.headers.get("content-type") || "";

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await req.formData();

    return {
      name: normalizeString(formData.get("name")),
      phone: normalizeString(formData.get("phone")),
      profileImage: formData.get("profile_image"),
    };
  }

  const body = await req.json().catch(() => ({}));

  return {
    name: normalizeString(body.name),
    phone: normalizeString(body.phone),
    profileImage: null,
  };
}


export async function updateCustomerProfile(req) {
  try {
    const customer = await getCustomerFromRequest(req);

    const { name, phone, profileImage } = await readProfileUpdatePayload(req);

    if (!name) {
      throw new Error("Name is required");
    }

    if (!phone) {
      throw new Error("Phone is required");
    }

    customer.name = name;
    customer.phone = phone;

    if (profileImage && typeof profileImage.arrayBuffer === "function") {
      const oldImageUrl = customer.profile_image_url;

      const imageUrl = await saveProfileImage({
        file: profileImage,
        customerId: customer._id,
      });

      customer.profile_image_url = imageUrl;
      customer.profile_image_public_id = "";

      await deleteOldLocalProfileImage(oldImageUrl);
    }

    await customer.save();

    return Response.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: safeUser(customer),
      },
    });
  } catch (error) {
    console.error("Customer profile update failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update profile",
        error: error.message || "Failed to update profile",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function getCustomerPaymentMethods(req) {
  try {
    const customer = await getCustomerFromRequest(req);

    return Response.json({
      success: true,
      data: {
        payment_methods: getActivePaymentMethods(customer),
      },
    });
  } catch (error) {
    console.error("Customer payment methods fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch payment methods",
        error: error.message || "Failed to fetch payment methods",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function createStripePaymentMethodSetup(req) {
  try {
    const customer = await getCustomerFromRequest(req);
    const stripe = getStripeClient();

    const stripeCustomerId = await ensureStripeCustomer(customer);
    const appUrl = getAppUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      success_url: `${appUrl}/customer/dashboard?stripe_setup_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/customer/dashboard?stripe_setup_cancelled=true`,
      metadata: {
        parking_user_id: String(customer._id),
        purpose: "save_payment_method",
      },
    });

    return Response.json({
      success: true,
      message: "Stripe card setup started",
      data: {
        session_id: session.id,
        redirectUrl: session.url,
      },
      redirectUrl: session.url,
    });
  } catch (error) {
    console.error("Stripe payment method setup failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to start Stripe card setup",
        error: error.message || "Failed to start Stripe card setup",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function confirmStripePaymentMethodSetup(req) {
  try {
    const customer = await getCustomerFromRequest(req);
    const stripe = getStripeClient();
    const body = await req.json();

    const sessionId = normalizeString(
      body.session_id ||
        body.sessionId ||
        body.stripe_setup_session_id ||
        body.checkout_session_id
    );

    if (!sessionId) {
      throw new Error("Stripe setup session ID is required");
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent", "setup_intent.payment_method"],
    });

    if (!session) {
      throw new Error("Stripe setup session not found");
    }

    if (session.mode !== "setup") {
      throw new Error("Invalid Stripe setup session");
    }

    if (String(session.customer) !== String(customer.stripe_customer_id)) {
      throw new Error("Stripe setup session does not belong to this customer");
    }

    const setupIntent = session.setup_intent;

    if (!setupIntent || setupIntent.status !== "succeeded") {
      throw new Error("Stripe setup has not completed");
    }

    let paymentMethod = setupIntent.payment_method;

    if (typeof paymentMethod === "string") {
      paymentMethod = await stripe.paymentMethods.retrieve(paymentMethod);
    }

    if (!paymentMethod || paymentMethod.type !== "card") {
      throw new Error("Stripe card payment method not found");
    }

    if (paymentMethod.customer !== customer.stripe_customer_id) {
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customer.stripe_customer_id,
      });
    }

    const cardDetails = getCardDetailsFromPaymentMethod(paymentMethod);

    const savedMethod = customer.addOrUpdateStripePaymentMethod({
      stripeCustomerId: customer.stripe_customer_id,
      paymentMethodId: paymentMethod.id,
      brand: cardDetails.brand,
      last4: cardDetails.last4,
      expMonth: cardDetails.expMonth,
      expYear: cardDetails.expYear,
      funding: cardDetails.funding,
      country: cardDetails.country,
      makeDefault: true,
    });

    await customer.save();

    return Response.json({
      success: true,
      message: "Payment method saved successfully",
      data: {
        payment_method: savedMethod,
        payment_methods: getActivePaymentMethods(customer),
        user: safeUser(customer),
      },
    });
  } catch (error) {
    console.error("Stripe payment method confirm failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to save payment method",
        error: error.message || "Failed to save payment method",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function updateCustomerPaymentMethod(req, methodId) {
  try {
    const customer = await getCustomerFromRequest(req);
    const body = await req.json();

    if (!methodId) {
      throw new Error("Payment method ID is required");
    }

    if (body.is_default === true) {
      customer.setDefaultPaymentMethod(methodId);
    }

    await customer.save();

    return Response.json({
      success: true,
      message: "Payment method updated successfully",
      data: {
        payment_methods: getActivePaymentMethods(customer),
        user: safeUser(customer),
      },
    });
  } catch (error) {
    console.error("Payment method update failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update payment method",
        error: error.message || "Failed to update payment method",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function deleteCustomerPaymentMethod(req, methodId) {
  try {
    const customer = await getCustomerFromRequest(req);
    const stripe = getStripeClient();

    if (!methodId) {
      throw new Error("Payment method ID is required");
    }

    const method = customer.payment_methods.id(String(methodId));

    if (!method || method.is_active === false) {
      throw new Error("Payment method not found");
    }

    const stripePaymentMethodId = method.provider_payment_method_id;

    customer.removePaymentMethod(methodId);

    await customer.save();

    if (stripePaymentMethodId) {
      try {
        await stripe.paymentMethods.detach(stripePaymentMethodId);
      } catch (stripeError) {
        console.warn(
          "Stripe payment method detach failed:",
          stripeError.message
        );
      }
    }

    return Response.json({
      success: true,
      message: "Payment method removed successfully",
      data: {
        payment_methods: getActivePaymentMethods(customer),
        user: safeUser(customer),
      },
    });
  } catch (error) {
    console.error("Payment method delete failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to remove payment method",
        error: error.message || "Failed to remove payment method",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}