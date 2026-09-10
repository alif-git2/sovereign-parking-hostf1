import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import Payment from "@/app/backend/models/payment";
import { stripe } from "@/app/backend/utils/stripeConfig";
import { getUserFromRequest } from "@/app/backend/utils/authToken";

export const runtime = "nodejs";

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("unauthorized") || value.includes("login")) return 401;
  if (value.includes("not found")) return 404;
  if (value.includes("inactive")) return 403;
  if (value.includes("customer")) return 403;
  if (value.includes("invalid")) return 400;

  return 500;
}

function serializeDocument(doc) {
  if (!doc) return null;

  if (typeof doc.toObject === "function") {
    return doc.toObject({
      virtuals: true,
      versionKey: false,
    });
  }

  return doc;
}

async function getPaymentIntentClientSecret(walletTransaction) {
  const paymentIntentId = walletTransaction?.provider_payment_id;

  if (!paymentIntentId) {
    return "";
  }

  /**
   * Completed/failed top-ups do not need Stripe Elements anymore.
   */
  if (walletTransaction.status !== "pending") {
    return "";
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  return paymentIntent?.client_secret || "";
}

export async function GET(req, { params }) {
  try {
    await connectDB();

    const { topupId } = await params;

    if (!topupId || !mongoose.Types.ObjectId.isValid(topupId)) {
      return Response.json(
        {
          success: false,
          message: "Invalid wallet top-up ID.",
          error: "Invalid wallet top-up ID.",
        },
        { status: 400 }
      );
    }

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
      "name email phone role is_active wallet_balance wallet_currency wallet_status"
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
          message: "Wallet top-up is available for customers only.",
          error: "Wallet top-up is available for customers only.",
        },
        { status: 403 }
      );
    }

    const walletTransaction = await WalletTransaction.findOne({
      _id: topupId,
      user_id: user._id,
      type: "topup_stripe",
    })
      .populate("payment_id", "method status amount currency payment_purpose")
      .populate("booking_id", "booking_id type status payment_status price");

    if (!walletTransaction) {
      return Response.json(
        {
          success: false,
          message: "Wallet top-up not found.",
          error: "Wallet top-up not found.",
        },
        { status: 404 }
      );
    }

    const payment = await Payment.findOne({
      wallet_transaction_id: walletTransaction._id,
    }).sort({ createdAt: -1 });

    const clientSecret = await getPaymentIntentClientSecret(walletTransaction);

    return Response.json(
      {
        success: true,
        message: "Stripe wallet top-up loaded successfully.",
        data: {
          walletTransaction: serializeDocument(walletTransaction),
          payment: serializeDocument(payment),
          clientSecret,
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
    console.error("Get Stripe wallet top-up error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load Stripe wallet top-up.",
        error: error.message || "Failed to load Stripe wallet top-up.",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}