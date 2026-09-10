import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import Booking from "@/app/backend/models/booking";
import CheckoutDraft from "@/app/backend/models/checkoutDraft";
import Payment from "@/app/backend/models/payment";
import ParkingUser from "@/app/backend/models/park_user";
import { stripe } from "@/app/backend/utils/stripeConfig";
import { getUserFromRequest } from "@/app/backend/utils/authToken";
import {
  getBookingPayableAmount,
  normalizeCurrency,
  toStripeAmount,
} from "@/app/backend/utils/paymentHelpers";

const REUSABLE_PAYMENT_INTENT_STATUSES = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
];

function serializeStripePayload(payload) {
  if (!payload) return null;

  if (typeof payload.toJSON === "function") {
    return payload.toJSON();
  }

  return payload;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeMoney(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Number(number.toFixed(2));
}

function getDecodedUserId(decoded) {
  return (
    decoded?.id ||
    decoded?._id ||
    decoded?.userId ||
    decoded?.user_id ||
    decoded?.sub ||
    ""
  );
}

function safeGetAuthUser(req) {
  try {
    return getUserFromRequest(req);
  } catch {
    return null;
  }
}

function getPaymentPurposeFromFlow(paymentFlow) {
  if (paymentFlow === "poa_deposit") {
    return "poa_holding_deposit";
  }

  return "full_online_payment";
}

function getPaymentPurpose(booking) {
  return getPaymentPurposeFromFlow(booking?.payment_flow);
}

function getPaymentDescription(booking, amount) {
  if (booking.payment_flow === "poa_deposit") {
    return `Sovereign Parking booking ${booking.booking_id} - AUD ${Number(
      amount || 0
    ).toFixed(2)} POA holding deposit`;
  }

  return `Sovereign Parking booking ${booking.booking_id}`;
}

function getDraftPaymentDescription(draft, amount) {
  const reference = draft.draft_reference || String(draft._id);

  if (draft.payment_flow === "poa_deposit") {
    return `Sovereign Parking checkout draft ${reference} - AUD ${Number(
      amount || 0
    ).toFixed(2)} POA holding deposit`;
  }

  return `Sovereign Parking checkout draft ${reference}`;
}

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (
    value.includes("authorization") ||
    value.includes("token") ||
    value.includes("login") ||
    value.includes("unauthorized")
  ) {
    return 401;
  }

  if (value.includes("permission") || value.includes("forbidden")) {
    return 403;
  }

  if (value.includes("not found")) {
    return 404;
  }

  if (value.includes("expired")) {
    return 410;
  }

  if (
    value.includes("required") ||
    value.includes("invalid") ||
    value.includes("must") ||
    value.includes("unsupported")
  ) {
    return 400;
  }

  return 500;
}

function buildDraftFilter(value) {
  const id = normalizeString(value);

  if (!id) {
    throw new Error("Checkout draft ID is required");
  }

  const conditions = [{ draft_reference: id }];

  if (mongoose.Types.ObjectId.isValid(id)) {
    conditions.push({ _id: id });
  }

  return {
    $or: conditions,
  };
}

function stripePaymentMethodToSavedMethod({
  paymentMethod,
  stripeCustomerId,
  isDefault = false,
}) {
  if (!paymentMethod || !stripeCustomerId) return null;

  const card = paymentMethod.card || {};

  return {
    provider: "stripe",

    provider_payment_method_id: paymentMethod.id,
    provider_customer_id: stripeCustomerId,

    stripe_payment_method_id: paymentMethod.id,
    payment_method_id: paymentMethod.id,

    type: paymentMethod.type || "card",

    brand: card.brand || "",
    card_brand: card.brand || "",

    last4: card.last4 || "",
    card_last4: card.last4 || "",

    exp_month: card.exp_month || null,
    exp_year: card.exp_year || null,

    funding: card.funding || "",
    country: card.country || "",

    is_default: Boolean(isDefault),
    is_active: true,

    created_at: paymentMethod.created
      ? new Date(paymentMethod.created * 1000)
      : new Date(),
  };
}

function normalizeUserPaymentMethod(method) {
  if (!method) return null;

  const plain =
    typeof method.toObject === "function"
      ? method.toObject({
          virtuals: true,
          versionKey: false,
        })
      : method;

  const paymentMethodId =
    plain.provider_payment_method_id ||
    plain.stripe_payment_method_id ||
    plain.payment_method_id ||
    plain.paymentMethodId ||
    plain.id ||
    "";

  const providerCustomerId =
    plain.provider_customer_id ||
    plain.stripe_customer_id ||
    plain.customer ||
    "";

  const brand =
    plain.brand ||
    plain.card_brand ||
    plain.cardBrand ||
    plain.card?.brand ||
    "";

  const last4 =
    plain.last4 ||
    plain.card_last4 ||
    plain.cardLast4 ||
    plain.card?.last4 ||
    "";

  const expMonth =
    plain.exp_month ||
    plain.expMonth ||
    plain.card_exp_month ||
    plain.card?.exp_month ||
    null;

  const expYear =
    plain.exp_year ||
    plain.expYear ||
    plain.card_exp_year ||
    plain.card?.exp_year ||
    null;

  if (!paymentMethodId && !last4) {
    return null;
  }

  return {
    ...plain,

    id: paymentMethodId,

    provider: plain.provider || "stripe",
    provider_payment_method_id: paymentMethodId,
    provider_customer_id: providerCustomerId,

    stripe_payment_method_id: paymentMethodId,
    payment_method_id: paymentMethodId,

    type: plain.type || "card",

    brand,
    card_brand: brand,

    last4,
    card_last4: last4,

    exp_month: expMonth,
    exp_year: expYear,

    is_default: Boolean(plain.is_default || plain.isDefault || plain.default),
    is_active: plain.is_active !== false,
  };
}

function getActiveSavedPaymentMethods(user) {
  const methods = Array.isArray(user?.payment_methods)
    ? user.payment_methods
    : [];

  return methods
    .map(normalizeUserPaymentMethod)
    .filter((method) => {
      return (
        method &&
        method.is_active !== false &&
        method.provider_payment_method_id &&
        method.provider_customer_id
      );
    });
}

async function getBookingCustomerUser(booking) {
  if (!booking?.user_id) return null;

  return ParkingUser.findById(booking.user_id).select(
    [
      "+payment_methods",
      "name",
      "email",
      "phone",
      "role",
      "is_active",
      "stripe_customer_id",
      "payment_methods",
    ].join(" ")
  );
}

async function getDraftCustomerUser(draft) {
  if (!draft?.user_id) return null;

  return ParkingUser.findById(draft.user_id).select(
    [
      "+payment_methods",
      "name",
      "email",
      "phone",
      "role",
      "is_active",
      "stripe_customer_id",
      "payment_methods",
    ].join(" ")
  );
}

async function ensureStripeCustomerForUser(user) {
  if (!user) return null;

  if (user.stripe_customer_id) {
    try {
      const existingCustomer = await stripe.customers.retrieve(
        user.stripe_customer_id
      );

      if (!existingCustomer?.deleted) {
        return existingCustomer.id;
      }
    } catch (error) {
      console.error("Existing Stripe customer could not be retrieved:", error);
    }
  }

  const customer = await stripe.customers.create({
    email: normalizeEmail(user.email),
    name: normalizeString(user.name),
    phone: normalizeString(user.phone) || undefined,
    metadata: {
      userId: String(user._id),
      source: "sovereign_parking",
    },
  });

  await ParkingUser.updateOne(
    { _id: user._id },
    {
      $set: {
        stripe_customer_id: customer.id,
      },
    }
  );

  user.stripe_customer_id = customer.id;

  return customer.id;
}

async function syncStripeSavedCardsToUser({ user, stripeCustomerId }) {
  if (!user || !stripeCustomerId) return [];

  let stripePaymentMethods = [];

  try {
    const result = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
      limit: 20,
    });

    stripePaymentMethods = result?.data || [];
  } catch (error) {
    console.error("Stripe saved cards could not be listed:", error);
    return getActiveSavedPaymentMethods(user);
  }

  if (!Array.isArray(user.payment_methods)) {
    user.payment_methods = [];
  }

  const repairedMethods = user.payment_methods
    .map((method) => normalizeUserPaymentMethod(method))
    .filter((method) => {
      return (
        method &&
        method.provider_payment_method_id &&
        method.provider_customer_id
      );
    })
    .map((method) => ({
      ...method,
      provider: method.provider || "stripe",
      provider_customer_id: method.provider_customer_id || stripeCustomerId,
    }));

  user.payment_methods = repairedMethods;

  const existingIds = new Set(
    repairedMethods
      .map((method) => method.provider_payment_method_id)
      .filter(Boolean)
  );

  for (const stripeMethod of stripePaymentMethods) {
    if (!stripeMethod?.id || existingIds.has(stripeMethod.id)) {
      continue;
    }

    const savedMethod = stripePaymentMethodToSavedMethod({
      paymentMethod: stripeMethod,
      stripeCustomerId,
      isDefault: user.payment_methods.length === 0,
    });

    if (savedMethod) {
      user.payment_methods.push(savedMethod);
      existingIds.add(stripeMethod.id);
    }
  }

  await user.save();

  return getActiveSavedPaymentMethods(user);
}

async function createCustomerSessionClientSecret(stripeCustomerId) {
  if (!stripeCustomerId) return null;

  try {
    const customerSession = await stripe.customerSessions.create({
      customer: stripeCustomerId,
      components: {
        payment_element: {
          enabled: true,
          features: {
            payment_method_redisplay: "enabled",
            payment_method_save: "enabled",
            payment_method_save_usage: "off_session",
            payment_method_remove: "enabled",
          },
        },
      },
    });

    return customerSession.client_secret || null;
  } catch (error) {
    console.error("Stripe CustomerSession could not be created:", error);
    return null;
  }
}

async function updateExistingIntentForCustomer({
  paymentIntent,
  stripeCustomerId,
  booking,
  amount,
}) {
  if (!paymentIntent || !stripeCustomerId) {
    return paymentIntent;
  }

  const needsCustomer =
    !paymentIntent.customer ||
    String(paymentIntent.customer) !== String(stripeCustomerId);

  const needsFutureUsage = !paymentIntent.setup_future_usage;

  if (!needsCustomer && !needsFutureUsage) {
    return paymentIntent;
  }

  try {
    return await stripe.paymentIntents.update(paymentIntent.id, {
      customer: stripeCustomerId,
      setup_future_usage: "off_session",
      metadata: {
        ...(paymentIntent.metadata || {}),
        bookingMongoId: booking._id.toString(),
        bookingId: booking.booking_id,
        userId: booking.user_id ? booking.user_id.toString() : "",
        bookingType: booking.type || "",
        paymentFlow: booking.payment_flow || "",
        depositType: booking.deposit_type || "",
        paymentPurpose: getPaymentPurpose(booking),
        holdingDepositAmount: String(booking.holding_deposit_amount || 0),
        balanceDueOnArrival: String(booking.balance_due_on_arrival || 0),
      },
      description: getPaymentDescription(booking, amount),
    });
  } catch (error) {
    console.error("Existing PaymentIntent could not be updated:", error);
    return paymentIntent;
  }
}

async function updateExistingDraftIntentForCustomer({
  paymentIntent,
  stripeCustomerId,
  draft,
  amount,
}) {
  if (!paymentIntent || !stripeCustomerId) {
    return paymentIntent;
  }

  const needsCustomer =
    !paymentIntent.customer ||
    String(paymentIntent.customer) !== String(stripeCustomerId);

  const needsFutureUsage = !paymentIntent.setup_future_usage;

  if (!needsCustomer && !needsFutureUsage) {
    return paymentIntent;
  }

  try {
    return await stripe.paymentIntents.update(paymentIntent.id, {
      customer: stripeCustomerId,
      setup_future_usage: "off_session",
      metadata: buildDraftStripeMetadata(draft),
      description: getDraftPaymentDescription(draft, amount),
    });
  } catch (error) {
    console.error("Existing draft PaymentIntent could not be updated:", error);
    return paymentIntent;
  }
}

function isBookingAlreadyPaid(booking) {
  return (
    booking.payment_status === "paid" ||
    booking.status === "success" ||
    booking.status === "confirmed"
  );
}

function isPoaDepositAlreadyPaid(booking) {
  return (
    booking.payment_flow === "poa_deposit" &&
    booking.payment_status === "partial" &&
    booking.status === "poa"
  );
}

function canPrepareStripeForExistingBooking(booking) {
  if (!booking) return false;

  if (isBookingAlreadyPaid(booking)) return false;
  if (isPoaDepositAlreadyPaid(booking)) return false;

  const dueAmount = Number(booking.due_amount || 0);
  const payableAmount = Number(getBookingPayableAmount(booking) || 0);

  if (dueAmount <= 0 && payableAmount <= 0) {
    return false;
  }

  return ["pending_payment", "pending"].includes(String(booking.status || ""));
}

function getExistingBookingErrorMessage(booking) {
  if (isBookingAlreadyPaid(booking)) {
    return "This booking has already been paid.";
  }

  if (isPoaDepositAlreadyPaid(booking)) {
    return "The holding deposit for this Pay on Arrival booking is already paid.";
  }

  return `This booking is not awaiting Stripe payment. Current status: ${
    booking.status || "-"
  }`;
}

function canStartDraftStripePayment(draft) {
  if (!draft) return false;

  if (typeof draft.isExpired === "function" && draft.isExpired()) {
    return false;
  }

  if (draft.expires_at && new Date(draft.expires_at).getTime() <= Date.now()) {
    return false;
  }

  if (draft.payment_provider !== "stripe" && draft.payment_method !== "stripe") {
    return false;
  }

  return ["draft", "payment_ready", "payment_processing"].includes(
    String(draft.status || "")
  );
}

function getDraftAmountDueNow(draft) {
  return normalizeMoney(
    draft?.pricing_snapshot?.amount_due_now ||
      draft?.booking_payload?.due_amount ||
      draft?.booking_payload?.amount_due_now ||
      0
  );
}

function buildDraftStripeMetadata(draft) {
  const userId = draft.user_id ? String(draft.user_id) : "";

  return {
    checkoutDraftId: draft._id.toString(),
    checkoutDraftReference: draft.draft_reference || "",
    draftId: draft.draft_reference || draft._id.toString(),

    userId,
    bookingType: draft.type || "",
    paymentFlow: draft.payment_flow || "",
    depositType: draft.deposit_type || "",
    paymentPurpose: getPaymentPurposeFromFlow(draft.payment_flow),

    bookingTotalAmount: String(draft.pricing_snapshot?.price || 0),
    amountDueNow: String(draft.pricing_snapshot?.amount_due_now || 0),
    holdingDepositAmount: String(
      draft.pricing_snapshot?.holding_deposit_amount || 0
    ),
    balanceDueOnArrival: String(
      draft.pricing_snapshot?.balance_due_on_arrival || 0
    ),
  };
}

async function storeStripePaymentReferenceOnBooking({ booking, paymentIntent }) {
  const update = {
    stripe_payment_intent_id: paymentIntent.id,
  };

  if (!booking.payment_method) {
    update.payment_method = "stripe";
  }

  /**
   * Important:
   * Do NOT set:
   * - status = pending_payment
   * - payment_status = pending
   *
   * The old code did that and caused unpaid bookings to appear as Pending Payment.
   */
  await Booking.updateOne(
    {
      _id: booking._id,
    },
    {
      $set: update,
    }
  );
}

async function handleDraftStripePaymentIntent({ req, body }) {
  const draftId =
    body.draftId ||
    body.draft_id ||
    body.checkoutDraftId ||
    body.checkout_draft_id ||
    "";

  if (!draftId) {
    throw new Error("Checkout draft ID is required");
  }

  const draft = await CheckoutDraft.findOne(buildDraftFilter(draftId));

  if (!draft) {
    throw new Error("Checkout draft not found");
  }

  if (!canStartDraftStripePayment(draft)) {
    if (typeof draft.isExpired === "function" && draft.isExpired()) {
      draft.status = "expired";
      await draft.save();
      throw new Error("Checkout draft has expired. Please start booking again.");
    }

    throw new Error(
      `Checkout draft cannot start Stripe payment. Current status: ${
        draft.status || "-"
      }`
    );
  }

  const authUser = safeGetAuthUser(req);
  const authUserId = getDecodedUserId(authUser);

  if (draft.user_id && authUserId && String(draft.user_id) !== String(authUserId)) {
    throw new Error("You do not have permission to pay this checkout draft");
  }

  const customerUser = await getDraftCustomerUser(draft);

  let stripeCustomerId = null;
  let customerSessionClientSecret = null;
  let savedPaymentMethods = [];

  if (customerUser) {
    stripeCustomerId = await ensureStripeCustomerForUser(customerUser);
  }

  if (customerUser && stripeCustomerId) {
    savedPaymentMethods = await syncStripeSavedCardsToUser({
      user: customerUser,
      stripeCustomerId,
    });

    customerSessionClientSecret = await createCustomerSessionClientSecret(
      stripeCustomerId
    );
  }

  const amount = getDraftAmountDueNow(draft);
  const currency = normalizeCurrency(draft.currency || "aud");
  const amountInStripeUnits = toStripeAmount(amount);

  if (amountInStripeUnits <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  let paymentIntent = null;

  if (draft.stripe_payment_intent_id) {
    try {
      const existingIntent = await stripe.paymentIntents.retrieve(
        draft.stripe_payment_intent_id
      );

      if (existingIntent.status === "succeeded") {
        return Response.json(
          {
            success: false,
            message: "This checkout draft has already been paid in Stripe.",
            alreadyPaid: true,
            redirectUrl: draft.booking_public_id
              ? `/booking/success?bookingId=${draft.booking_public_id}`
              : `/booking/success?draftId=${encodeURIComponent(
                  draft.draft_reference
                )}`,
          },
          { status: 400 }
        );
      }

      const amountMatches =
        Number(existingIntent.amount) === amountInStripeUnits;

      const currencyMatches =
        String(existingIntent.currency || "").toLowerCase() === currency;

      if (
        REUSABLE_PAYMENT_INTENT_STATUSES.includes(existingIntent.status) &&
        amountMatches &&
        currencyMatches
      ) {
        paymentIntent = existingIntent;

        if (stripeCustomerId) {
          paymentIntent = await updateExistingDraftIntentForCustomer({
            paymentIntent,
            stripeCustomerId,
            draft,
            amount,
          });
        }
      }
    } catch (stripeError) {
      console.error(
        "Existing draft Stripe PaymentIntent could not be retrieved:",
        stripeError
      );

      paymentIntent = null;
    }
  }

  if (!paymentIntent) {
    const createParams = {
      amount: amountInStripeUnits,
      currency,

      automatic_payment_methods: {
        enabled: true,
      },

      metadata: buildDraftStripeMetadata(draft),
      description: getDraftPaymentDescription(draft, amount),
    };

    if (stripeCustomerId) {
      createParams.customer = stripeCustomerId;
      createParams.setup_future_usage = "off_session";
    }

    paymentIntent = await stripe.paymentIntents.create(createParams, {
      idempotencyKey: `checkout-draft-${draft._id.toString()}-stripe-${amountInStripeUnits}-${stripeCustomerId || "guest"}-v1`,
    });
  }

  draft.markPaymentReady({
    providerPayload: serializeStripePayload(paymentIntent),
    stripePaymentIntentId: paymentIntent.id,
  });

  await draft.save();

  await Payment.findOneAndUpdate(
    {
      provider_payment_id: paymentIntent.id,
    },
    {
      user_id: draft.user_id || undefined,

      amount,
      currency,

      method: "stripe",
      status: "pending",

      payment_flow: draft.payment_flow,
      deposit_type: draft.deposit_type,
      payment_purpose: getPaymentPurposeFromFlow(draft.payment_flow),

      transaction_id: paymentIntent.id,
      provider_payment_id: paymentIntent.id,
      provider_payload: serializeStripePayload(paymentIntent),

      booking_total_amount: normalizeMoney(draft.pricing_snapshot?.price),
      holding_deposit_amount: normalizeMoney(
        draft.pricing_snapshot?.holding_deposit_amount
      ),
      balance_due_on_arrival: normalizeMoney(
        draft.pricing_snapshot?.balance_due_on_arrival
      ),

      metadata: {
        checkout_draft_id: draft._id.toString(),
        checkout_draft_reference: draft.draft_reference,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    }
  );

  const bookingPreview = {
    _id: draft._id,
    draft_id: draft.draft_reference,
    checkout_draft_id: draft.draft_reference,
    booking_id: draft.draft_reference,

    type: draft.type,

    status: draft.status,
    payment_status: "pending",
    payment_method: "stripe",
    payment_flow: draft.payment_flow,
    deposit_type: draft.deposit_type,

    price: normalizeMoney(draft.pricing_snapshot?.price),
    total_amount: normalizeMoney(draft.pricing_snapshot?.price),
    paid_amount: 0,
    due_amount: amount,

    holding_deposit_amount: normalizeMoney(
      draft.pricing_snapshot?.holding_deposit_amount
    ),
    balance_due_on_arrival: normalizeMoney(
      draft.pricing_snapshot?.balance_due_on_arrival
    ),

    currency: draft.currency || "aud",
  };

  return Response.json(
    {
      success: true,
      message:
        draft.payment_flow === "poa_deposit"
          ? "Stripe PaymentIntent ready for checkout draft holding deposit."
          : "Stripe PaymentIntent ready for checkout draft.",

      clientSecret: paymentIntent.client_secret,
      client_secret: paymentIntent.client_secret,

      customerSessionClientSecret,
      customer_session_client_secret: customerSessionClientSecret,

      paymentIntentId: paymentIntent.id,
      payment_intent_id: paymentIntent.id,

      paymentPurpose: getPaymentPurposeFromFlow(draft.payment_flow),
      payment_purpose: getPaymentPurposeFromFlow(draft.payment_flow),

      draftId: draft.draft_reference,
      draft_id: draft.draft_reference,
      checkoutDraftId: draft.draft_reference,
      checkout_draft_id: draft.draft_reference,

      savedPaymentMethods,
      saved_payment_methods: savedPaymentMethods,
      paymentMethods: savedPaymentMethods,
      payment_methods: savedPaymentMethods,

      booking: bookingPreview,
      bookingPreview,
      booking_preview: bookingPreview,
    },
    { status: 200 }
  );
}

async function handleExistingBookingStripePaymentIntent({ req, body }) {
  const { bookingId } = body;

  if (!bookingId) {
    return Response.json(
      {
        success: false,
        message:
          "Booking ID or checkout draft ID is required. New Stripe bookings must use a checkout draft flow, not a real booking before payment.",
        code: "PAYMENT_TARGET_REQUIRED",
      },
      { status: 400 }
    );
  }

  const bookingQuery = mongoose.Types.ObjectId.isValid(bookingId)
    ? { _id: bookingId }
    : { booking_id: bookingId };

  const booking = await Booking.findOne(bookingQuery);

  if (!booking) {
    return Response.json(
      {
        success: false,
        message: "Booking not found.",
      },
      { status: 404 }
    );
  }

  if (booking.payment_method && booking.payment_method !== "stripe") {
    return Response.json(
      {
        success: false,
        message: `This booking is not configured for Stripe payment. Current method: ${booking.payment_method}`,
      },
      { status: 400 }
    );
  }

  if (!canPrepareStripeForExistingBooking(booking)) {
    const alreadyPaid =
      isBookingAlreadyPaid(booking) || isPoaDepositAlreadyPaid(booking);

    return Response.json(
      {
        success: false,
        message: getExistingBookingErrorMessage(booking),
        alreadyPaid,
        redirectUrl: alreadyPaid
          ? `/booking/success?bookingId=${booking.booking_id}`
          : undefined,
      },
      { status: alreadyPaid ? 400 : 409 }
    );
  }

  const authUser = safeGetAuthUser(req);
  const authUserId = getDecodedUserId(authUser);
  const customerUser = await getBookingCustomerUser(booking);

  const isAuthenticatedBookingOwner =
    authUserId &&
    customerUser?._id &&
    String(authUserId) === String(customerUser._id);

  let stripeCustomerId = null;
  let customerSessionClientSecret = null;
  let savedPaymentMethods = [];

  if (customerUser) {
    stripeCustomerId = await ensureStripeCustomerForUser(customerUser);
  }

  if (isAuthenticatedBookingOwner && stripeCustomerId) {
    savedPaymentMethods = await syncStripeSavedCardsToUser({
      user: customerUser,
      stripeCustomerId,
    });

    customerSessionClientSecret = await createCustomerSessionClientSecret(
      stripeCustomerId
    );
  }

  const isPoaDepositBooking = booking.payment_flow === "poa_deposit";
  const amount = getBookingPayableAmount(booking);
  const currency = normalizeCurrency(booking.currency || "aud");
  const amountInStripeUnits = toStripeAmount(amount);

  if (amountInStripeUnits <= 0) {
    return Response.json(
      {
        success: false,
        message: "Payment amount must be greater than zero.",
      },
      { status: 400 }
    );
  }

  let paymentIntent = null;

  if (booking.stripe_payment_intent_id) {
    try {
      const existingIntent = await stripe.paymentIntents.retrieve(
        booking.stripe_payment_intent_id
      );

      if (existingIntent.status === "succeeded") {
        return Response.json(
          {
            success: false,
            message: "This booking has already been paid in Stripe.",
            alreadyPaid: true,
            redirectUrl: `/booking/success?bookingId=${booking.booking_id}`,
          },
          { status: 400 }
        );
      }

      const amountMatches =
        Number(existingIntent.amount) === amountInStripeUnits;

      const currencyMatches =
        String(existingIntent.currency || "").toLowerCase() === currency;

      if (
        REUSABLE_PAYMENT_INTENT_STATUSES.includes(existingIntent.status) &&
        amountMatches &&
        currencyMatches
      ) {
        paymentIntent = existingIntent;

        if (stripeCustomerId) {
          paymentIntent = await updateExistingIntentForCustomer({
            paymentIntent,
            stripeCustomerId,
            booking,
            amount,
          });
        }
      }
    } catch (stripeError) {
      console.error(
        "Existing Stripe PaymentIntent could not be retrieved:",
        stripeError
      );

      paymentIntent = null;
    }
  }

  if (!paymentIntent) {
    const createParams = {
      amount: amountInStripeUnits,
      currency,

      automatic_payment_methods: {
        enabled: true,
      },

      metadata: {
        bookingMongoId: booking._id.toString(),
        bookingId: booking.booking_id,
        userId: booking.user_id ? booking.user_id.toString() : "",
        bookingType: booking.type || "",
        paymentFlow: booking.payment_flow || "",
        depositType: booking.deposit_type || "",
        paymentPurpose: getPaymentPurpose(booking),
        holdingDepositAmount: String(booking.holding_deposit_amount || 0),
        balanceDueOnArrival: String(booking.balance_due_on_arrival || 0),
      },

      description: getPaymentDescription(booking, amount),
    };

    if (stripeCustomerId) {
      createParams.customer = stripeCustomerId;
      createParams.setup_future_usage = "off_session";
    }

    paymentIntent = await stripe.paymentIntents.create(createParams, {
      idempotencyKey: `booking-${booking._id.toString()}-stripe-${amountInStripeUnits}-${stripeCustomerId || "guest"}-v3`,
    });
  }

  await storeStripePaymentReferenceOnBooking({
    booking,
    paymentIntent,
  });

  await Payment.findOneAndUpdate(
    {
      provider_payment_id: paymentIntent.id,
    },
    {
      booking_id: booking._id,
      user_id: booking.user_id,

      amount,
      currency,

      method: "stripe",
      status: "pending",

      payment_flow: booking.payment_flow,
      deposit_type: booking.deposit_type,
      payment_purpose: getPaymentPurpose(booking),

      transaction_id: paymentIntent.id,
      provider_payment_id: paymentIntent.id,
      provider_payload: serializeStripePayload(paymentIntent),
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    }
  );

  return Response.json(
    {
      success: true,
      message: isPoaDepositBooking
        ? "Stripe PaymentIntent ready for holding deposit."
        : "Stripe PaymentIntent ready.",

      clientSecret: paymentIntent.client_secret,
      client_secret: paymentIntent.client_secret,

      customerSessionClientSecret,
      customer_session_client_secret: customerSessionClientSecret,

      paymentIntentId: paymentIntent.id,
      payment_intent_id: paymentIntent.id,

      paymentPurpose: getPaymentPurpose(booking),
      payment_purpose: getPaymentPurpose(booking),

      savedPaymentMethods,
      saved_payment_methods: savedPaymentMethods,
      paymentMethods: savedPaymentMethods,
      payment_methods: savedPaymentMethods,

      booking: {
        _id: booking._id,
        booking_id: booking.booking_id,
        type: booking.type,

        status: booking.status,
        payment_status: booking.payment_status,
        payment_method: booking.payment_method || "stripe",
        payment_flow: booking.payment_flow,
        deposit_type: booking.deposit_type,

        price: booking.price,
        total_amount: booking.price,
        paid_amount: booking.paid_amount,
        due_amount: amount,

        holding_deposit_amount: booking.holding_deposit_amount,
        balance_due_on_arrival: booking.balance_due_on_arrival,

        currency: booking.currency || "aud",
      },
    },
    { status: 200 }
  );
}

export async function POST(req) {
  try {
    await connectDB();

    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json(
        {
          success: false,
          message: "Stripe secret key is not configured.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const draftId =
      body.draftId ||
      body.draft_id ||
      body.checkoutDraftId ||
      body.checkout_draft_id ||
      "";

    if (draftId) {
      return await handleDraftStripePaymentIntent({ req, body });
    }

    return await handleExistingBookingStripePaymentIntent({ req, body });
  } catch (error) {
    console.error("Create Stripe PaymentIntent error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create Stripe payment intent.",
        error: error.message || "Failed to create Stripe payment intent.",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}
