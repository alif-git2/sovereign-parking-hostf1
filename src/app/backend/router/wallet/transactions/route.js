import { connectDB } from "@/app/backend/database/mongodb";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import { getUserFromRequest } from "@/app/backend/utils/authToken";

import "@/app/backend/models/booking";
import "@/app/backend/models/payment";

export const runtime = "nodejs";

const allowedTypes = [
  "topup_stripe",
  "topup_paypal",
  "booking_payment",
  "refund_credit",
  "withdrawal_request",
  "withdrawal_paid",
  "admin_adjustment",
];

const allowedStatuses = [
  "pending",
  "completed",
  "failed",
  "cancelled",
  "refunded",
  "reversed",
];

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("unauthorized") || value.includes("login")) return 401;
  if (value.includes("not found")) return 404;
  if (value.includes("inactive")) return 403;

  return 500;
}

function parsePositiveInteger(value, fallback, max) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return Math.min(number, max);
}

function serializeTransaction(transaction) {
  if (!transaction) return null;

  if (typeof transaction.toObject === "function") {
    return transaction.toObject({
      virtuals: true,
      versionKey: false,
    });
  }

  return transaction;
}

export async function GET(req) {
  try {
    await connectDB();

    const authUser = getUserFromRequest(req);

    if (!authUser?.id) {
      return Response.json(
        {
          success: false,
          message: "Unauthorized. Please login again.",
          error: "Unauthorized. Please login again.",
        },
        { status: 401 }
      );
    }

    const user = await ParkingUser.findById(authUser.id).select(
      "name email role is_active wallet_balance wallet_currency wallet_status"
    );

    if (!user) {
      return Response.json(
        {
          success: false,
          message: "User not found.",
          error: "User not found.",
        },
        { status: 404 }
      );
    }

    if (!user.is_active) {
      return Response.json(
        {
          success: false,
          message: "Your account is inactive.",
          error: "Your account is inactive.",
        },
        { status: 403 }
      );
    }

    if (user.role !== "customer") {
      return Response.json(
        {
          success: false,
          message: "Wallet transactions are available for customers only.",
          error: "Wallet transactions are available for customers only.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);

    const page = parsePositiveInteger(searchParams.get("page"), 1, 100000);
    const limit = parsePositiveInteger(searchParams.get("limit"), 20, 100);

    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const query = {
      user_id: user._id,
    };

    if (type && allowedTypes.includes(type)) {
      query.type = type;
    }

    if (status && allowedStatuses.includes(status)) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(query)
        .populate("booking_id", "booking_id type status payment_status price")
        .populate("payment_id", "method status amount currency payment_purpose")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      WalletTransaction.countDocuments(query),
    ]);

    return Response.json(
      {
        success: true,
        message: "Wallet transactions loaded successfully.",
        data: {
          transactions: transactions.map(serializeTransaction),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1,
          },
          wallet: {
            balance: Number(user.wallet_balance || 0),
            currency: user.wallet_currency || "aud",
            status: user.wallet_status || "active",
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Wallet transactions route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load wallet transactions.",
        error: error.message || "Failed to load wallet transactions.",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}