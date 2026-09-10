import crypto from "crypto";
import mongoose from "mongoose";

import ParkingUser from "@/app/backend/models/park_user";
import Booking from "@/app/backend/models/booking";
import Payment from "@/app/backend/models/payment";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import SupportTicket from "@/app/backend/models/supportTicket";

import {
  requireAdminUser,
  getAuthErrorStatus,
} from "@/app/backend/utils/authToken";

import { hashPasswordSetupToken } from "@/app/backend/utils/passwordSetup";
import { sendAdminCreatedUserPasswordEmail } from "@/app/backend/utils/adminUserEmail";

const ALLOWED_ROLES = ["admin", "manager", "customer"];

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function getErrorStatus(message = "") {
  const authStatus = getAuthErrorStatus(message);

  if (authStatus !== 400) {
    return authStatus;
  }

  const value = String(message || "").toLowerCase();

  if (value.includes("not found")) return 404;
  if (value.includes("duplicate") || value.includes("already exists")) {
    return 409;
  }
  if (value.includes("required") || value.includes("invalid")) return 400;
  if (value.includes("cannot")) return 403;
  if (value.includes("linked data")) return 409;

  return 400;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    is_active: user.is_active,
    profile_image_url: user.profile_image_url || "",
    wallet_balance: Number(user.wallet_balance || 0),
    wallet_currency: user.wallet_currency || "aud",
    wallet_status: user.wallet_status || "active",
    has_password: Boolean(user.password),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function getUserIdentifierQuery(userId) {
  const identifier = normalizeString(userId);

  if (!identifier) {
    throw new Error("User ID is required");
  }

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return {
      _id: identifier,
    };
  }

  return {
    email: normalizeEmail(identifier),
  };
}

function createPasswordSetupToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashPasswordSetupToken(rawToken);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return {
    rawToken,
    hashedToken,
    expires,
  };
}

function getPasswordSetupUrl(rawToken, role = "customer") {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (["admin", "manager"].includes(role)) {
    return `${appUrl}/admin/set-password?token=${encodeURIComponent(rawToken)}`;
  }

  return `${appUrl}/set-password?token=${encodeURIComponent(rawToken)}`;
}

async function applyPasswordSetupToken(user) {
  const tokenData = createPasswordSetupToken();

  user.password_setup_token = tokenData.hashedToken;
  user.password_setup_expires = tokenData.expires;

  await user.save();

  return {
    rawToken: tokenData.rawToken,
    setupUrl: getPasswordSetupUrl(tokenData.rawToken, user.role),
  };
}

async function sendSetupEmailSafely({ user, setupUrl, isReset }) {
  try {
    await sendAdminCreatedUserPasswordEmail({
      user,
      setupUrl,
      isReset,
    });

    return {
      sent: true,
      error: null,
    };
  } catch (error) {
    console.error("Admin user setup email failed:", error);

    return {
      sent: false,
      error: error.message,
    };
  }
}

function buildUserQuery(searchParams) {
  const query = {};

  const role = normalizeString(searchParams.get("role"));
  const status = normalizeString(searchParams.get("status"));
  const search = normalizeString(searchParams.get("search"));

  if (role && role !== "all") {
    query.role = role;
  }

  if (status === "active") {
    query.is_active = true;
  }

  if (status === "inactive") {
    query.is_active = false;
  }

  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");

    query.$or = [
      { name: regex },
      { email: regex },
      { phone: regex },
      { role: regex },
    ];
  }

  return query;
}

async function getUserLinkedDataCounts(user) {
  const userId = user._id;
  const userIdString = String(user._id);
  const email = normalizeEmail(user.email);

  const bookingQuery = {
    $or: [
      { user_id: userId },
      { user_id: userIdString },
      { customer_id: userId },
      { customer_id: userIdString },
      { email },
      { customer_email: email },
      { "customer.email": email },
      { "details.email": email },
    ],
  };

  const [bookings, userBookings] = await Promise.all([
    Booking.countDocuments(bookingQuery),
    Booking.find(bookingQuery).select("_id").lean(),
  ]);

  const bookingIds = userBookings.map((booking) => booking._id);
  const bookingIdStrings = bookingIds.map((id) => String(id));

  const payments = await Payment.countDocuments({
    $or: [
      { user_id: userId },
      { user_id: userIdString },
      { customer_id: userId },
      { customer_id: userIdString },
      { email },
      { customer_email: email },
      { "customer.email": email },
      { booking_id: { $in: bookingIds } },
      { booking_id: { $in: bookingIdStrings } },
    ],
  });

  const walletTransactions = await WalletTransaction.countDocuments({
    $or: [
      { user_id: userId },
      { user_id: userIdString },
      { customer_id: userId },
      { customer_id: userIdString },
      { email },
      { customer_email: email },
      { "customer.email": email },
    ],
  });

  const supportTickets = await SupportTicket.countDocuments({
    $or: [
      { customer_id: userId },
      { customer_id: userIdString },
      { email },
    ],
  });

  return {
    bookings,
    payments,
    walletTransactions,
    supportTickets,
    total: bookings + payments + walletTransactions + supportTickets,
  };
}

export async function getAdminUsers(req) {
  try {
    await requireAdminUser(req, ["admin"]);

    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 20), 1),
      100
    );

    const query = buildUserQuery(searchParams);
    const skip = (page - 1) * limit;

    const [users, total, roleCounts, statusCounts] = await Promise.all([
      ParkingUser.find(query)
        .select("+password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ParkingUser.countDocuments(query),
      ParkingUser.aggregate([
        {
          $group: {
            _id: "$role",
            count: {
              $sum: 1,
            },
          },
        },
      ]),
      ParkingUser.aggregate([
        {
          $group: {
            _id: "$is_active",
            count: {
              $sum: 1,
            },
          },
        },
      ]),
    ]);

    const counts = {
      all: 0,
      admin: 0,
      manager: 0,
      customer: 0,
      active: 0,
      inactive: 0,
    };

    roleCounts.forEach((item) => {
      counts[item._id] = item.count;
      counts.all += item.count;
    });

    statusCounts.forEach((item) => {
      if (item._id === true) counts.active = item.count;
      if (item._id === false) counts.inactive = item.count;
    });

    return Response.json({
      success: true,
      data: {
        users: users.map(serializeUser),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
        counts,
      },
    });
  } catch (error) {
    console.error("Admin users fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch users",
        error: error.message || "Failed to fetch users",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function createAdminUser(req) {
  try {
    await requireAdminUser(req, ["admin"]);

    const body = await req.json();

    const name = normalizeString(body.name);
    const email = normalizeEmail(body.email);
    const phone = normalizeString(body.phone);
    const role = normalizeString(body.role || "customer");
    const isActive =
      body.is_active === undefined ? true : Boolean(body.is_active);

    if (!name) {
      throw new Error("Name is required");
    }

    if (!email || !isValidEmail(email)) {
      throw new Error("Valid email is required");
    }

    if (!phone) {
      throw new Error("Phone is required");
    }

    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error("Invalid user role");
    }

    const existingUser = await ParkingUser.findOne({ email });

    if (existingUser) {
      throw new Error("A user with this email already exists");
    }

    const user = await ParkingUser.create({
      name,
      email,
      phone,
      role,
      is_active: isActive,
      password: null,
      wallet_currency: "aud",
      wallet_status: "active",
    });

    const setup = await applyPasswordSetupToken(user);

    const emailResult = await sendSetupEmailSafely({
      user,
      setupUrl: setup.setupUrl,
      isReset: false,
    });

    return Response.json(
      {
        success: true,
        message: emailResult.sent
          ? "User created and password setup email sent."
          : "User created, but password setup email failed.",
        data: {
          user: serializeUser(user),
          emailResult,
          setup_url:
            process.env.NODE_ENV === "production" ? undefined : setup.setupUrl,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin user create failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create user",
        error: error.message || "Failed to create user",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function getAdminUser(req, userId) {
  try {
    await requireAdminUser(req, ["admin"]);

    const user = await ParkingUser.findOne(
      getUserIdentifierQuery(userId)
    ).select("+password");

    if (!user) {
      throw new Error("User not found");
    }

    return Response.json({
      success: true,
      data: {
        user: serializeUser(user),
      },
    });
  } catch (error) {
    console.error("Admin user fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch user",
        error: error.message || "Failed to fetch user",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function updateAdminUser(req, userId) {
  try {
    const admin = await requireAdminUser(req, ["admin"]);
    const body = await req.json();

    const user = await ParkingUser.findOne(
      getUserIdentifierQuery(userId)
    ).select("+password +password_setup_token +password_setup_expires");

    if (!user) {
      throw new Error("User not found");
    }

    const name = normalizeString(body.name);
    const email = normalizeEmail(body.email);
    const phone = normalizeString(body.phone);
    const role = normalizeString(body.role);

    const isActiveProvided = Object.prototype.hasOwnProperty.call(
      body,
      "is_active"
    );

    if (name) {
      user.name = name;
    }

    if (email) {
      if (!isValidEmail(email)) {
        throw new Error("Valid email is required");
      }

      const duplicateUser = await ParkingUser.findOne({
        email,
        _id: {
          $ne: user._id,
        },
      });

      if (duplicateUser) {
        throw new Error("A user with this email already exists");
      }

      user.email = email;
    }

    if (phone) {
      user.phone = phone;
    }

    if (role) {
      if (!ALLOWED_ROLES.includes(role)) {
        throw new Error("Invalid user role");
      }

      if (String(user._id) === String(admin._id) && role !== "admin") {
        throw new Error("You cannot remove your own admin role");
      }

      user.role = role;
    }

    if (isActiveProvided) {
      const nextActive = Boolean(body.is_active);

      if (String(user._id) === String(admin._id) && nextActive === false) {
        throw new Error("You cannot deactivate your own account");
      }

      if (
        user.role === "admin" &&
        user.is_active === true &&
        nextActive === false
      ) {
        const otherActiveAdmins = await ParkingUser.countDocuments({
          role: "admin",
          is_active: true,
          _id: {
            $ne: user._id,
          },
        });

        if (otherActiveAdmins < 1) {
          throw new Error("Cannot deactivate the last active admin account");
        }
      }

      user.is_active = nextActive;
    }

    await user.save();

    return Response.json({
      success: true,
      message: "User updated successfully",
      data: {
        user: serializeUser(user),
      },
    });
  } catch (error) {
    console.error("Admin user update failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update user",
        error: error.message || "Failed to update user",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function deactivateAdminUser(req, userId) {
  try {
    const admin = await requireAdminUser(req, ["admin"]);

    const user = await ParkingUser.findOne(getUserIdentifierQuery(userId));

    if (!user) {
      throw new Error("User not found");
    }

    if (String(user._id) === String(admin._id)) {
      throw new Error("You cannot deactivate your own account");
    }

    if (user.role === "admin" && user.is_active === true) {
      const otherActiveAdmins = await ParkingUser.countDocuments({
        role: "admin",
        is_active: true,
        _id: {
          $ne: user._id,
        },
      });

      if (otherActiveAdmins < 1) {
        throw new Error("Cannot deactivate the last active admin account");
      }
    }

    user.is_active = false;
    await user.save();

    return Response.json({
      success: true,
      message: "User deactivated successfully",
      data: {
        user: serializeUser(user),
      },
    });
  } catch (error) {
    console.error("Admin user deactivate failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to deactivate user",
        error: error.message || "Failed to deactivate user",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function deleteAdminUser(req, userId) {
  try {
    const admin = await requireAdminUser(req, ["admin"]);

    const user = await ParkingUser.findOne(getUserIdentifierQuery(userId));

    if (!user) {
      throw new Error("User not found");
    }

    if (String(user._id) === String(admin._id)) {
      throw new Error("You cannot delete your own account");
    }

    if (user.role === "admin" && user.is_active === true) {
      const otherActiveAdmins = await ParkingUser.countDocuments({
        role: "admin",
        is_active: true,
        _id: {
          $ne: user._id,
        },
      });

      if (otherActiveAdmins < 1) {
        throw new Error("Cannot delete the last active admin account");
      }
    }

    const linkedData = await getUserLinkedDataCounts(user);

    if (linkedData.total > 0) {
      throw new Error(
        `Cannot delete this user because linked data exists. Bookings: ${linkedData.bookings}, Payments: ${linkedData.payments}, Wallet Transactions: ${linkedData.walletTransactions}, Support Tickets: ${linkedData.supportTickets}. Deactivate this user instead.`
      );
    }

    await user.deleteOne();

    return Response.json({
      success: true,
      message: "User deleted successfully",
      data: {
        deletedUserId: user._id,
      },
    });
  } catch (error) {
    console.error("Admin user delete failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete user",
        error: error.message || "Failed to delete user",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function sendAdminUserPasswordReset(req, userId) {
  try {
    await requireAdminUser(req, ["admin"]);

    const user = await ParkingUser.findOne(
      getUserIdentifierQuery(userId)
    ).select("+password_setup_token +password_setup_expires");

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.is_active) {
      throw new Error("Cannot send password reset to inactive user");
    }

    const setup = await applyPasswordSetupToken(user);

    const emailResult = await sendSetupEmailSafely({
      user,
      setupUrl: setup.setupUrl,
      isReset: true,
    });

    return Response.json({
      success: true,
      message: emailResult.sent
        ? "Password reset email sent successfully."
        : "Password reset token created, but email failed.",
      data: {
        user: serializeUser(user),
        emailResult,
        setup_url:
          process.env.NODE_ENV === "production" ? undefined : setup.setupUrl,
      },
    });
  } catch (error) {
    console.error("Admin user password reset failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to send password reset",
        error: error.message || "Failed to send password reset",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}