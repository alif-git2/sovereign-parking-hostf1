import { connectDB } from "@/app/backend/database/mongodb";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import Payment from "@/app/backend/models/payment";
import { stripe } from "@/app/backend/utils/stripeConfig";
import {
  getWalletTopupAmount,
  normalizeCurrency,
  toStripeAmount,
} from "@/app/backend/utils/paymentHelpers";
import { getUserFromRequest } from "@/app/backend/utils/authToken";

export const runtime = "nodejs";

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("unauthorized") || value.includes("login")) return 401;
  if (value.includes("not found")) return 404;
  if (value.includes("inactive")) return 403;
  if (value.includes("wallet is not active")) return 403;
  if (value.includes("customer")) return 403;
  if (value.includes("amount")) return 400;

  return 500;
}

function serializeStripePayload(payload) {
  if (!payload) return null;

  if (typeof payload.toJSON === "function") {
    return payload.toJSON();
  }

  return payload;
}

export async function POST(req) {
  let walletTransaction = null;

  try {
    await connectDB();

    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json(
        {
          success: false,
          message: "Stripe secret key is not configured.",
          error: "Stripe secret key is not configured.",
        },
        { status: 500 }
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

    if (user.wallet_status && user.wallet_status !== "active") {
      return Response.json(
        {
          success: false,
          message: "Your wallet is not active.",
          error: "Your wallet is not active.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const amount = getWalletTopupAmount(body.amount);
    const currency = normalizeCurrency(user.wallet_currency || "aud");

    const balanceBefore = Number(user.wallet_balance || 0);

    walletTransaction = await WalletTransaction.create({
      user_id: user._id,
      type: "topup_stripe",
      direction: "credit",
      amount,
      currency,
      balance_before: balanceBefore,
      balance_after: balanceBefore,
      status: "pending",
      method: "stripe",
      note: `Stripe wallet top-up initiated for AUD ${amount.toFixed(2)}`,
      metadata: {
        purpose: "wallet_topup",
        source: "customer_dashboard",
      },
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: toStripeAmount(amount, currency),
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        purpose: "wallet_topup",
        paymentPurpose: "wallet_topup",
        payment_flow: "wallet_topup",
        userId: user._id.toString(),
        walletTransactionId: walletTransaction._id.toString(),
        walletTransactionReference:
          walletTransaction.transaction_reference || "",
        topupAmount: String(amount),
      },
      description: `Sovereign Parking wallet top-up ${walletTransaction.transaction_reference}`,
    });

    walletTransaction.provider_payment_id = paymentIntent.id;
    walletTransaction.provider_payload = serializeStripePayload(paymentIntent);

    await walletTransaction.save();

    const payment = await Payment.findOneAndUpdate(
      {
        provider_payment_id: paymentIntent.id,
      },
      {
        user_id: user._id,
        wallet_transaction_id: walletTransaction._id,

        amount,
        currency,

        method: "stripe",
        status: "pending",

        payment_flow: "wallet_topup",
        payment_purpose: "wallet_topup",

        transaction_id: paymentIntent.id,
        provider_payment_id: paymentIntent.id,
        provider_payload: serializeStripePayload(paymentIntent),

        wallet_balance_before: balanceBefore,
        wallet_balance_after: balanceBefore,

        metadata: {
          purpose: "wallet_topup",
          wallet_transaction_id: walletTransaction._id.toString(),
          user_id: user._id.toString(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    walletTransaction.payment_id = payment._id;
    await walletTransaction.save();

    return Response.json(
      {
        success: true,
        message: "Stripe wallet top-up PaymentIntent created.",
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        walletTransactionId: walletTransaction._id,
        redirectUrl: `/wallet/topup/stripe/${walletTransaction._id}`,
        data: {
          walletTransaction,
          payment: {
            _id: payment._id,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            provider_payment_id: payment.provider_payment_id,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Create Stripe wallet top-up intent error:", error);

    if (walletTransaction && walletTransaction.status !== "completed") {
      try {
        walletTransaction.status = "failed";
        walletTransaction.failure_reason =
          error.message || "Failed to create Stripe wallet top-up.";
        walletTransaction.failed_at = new Date();
        await walletTransaction.save();
      } catch (updateError) {
        console.error(
          "Failed to mark wallet transaction as failed:",
          updateError
        );
      }
    }

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create Stripe wallet top-up.",
        error: error.message || "Failed to create Stripe wallet top-up.",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}