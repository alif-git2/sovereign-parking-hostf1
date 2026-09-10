import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import Payment from "@/app/backend/models/payment";
import {
  capturePayPalOrder,
  getPayPalCaptureDetails,
  isPayPalCaptureCompleted,
} from "@/app/backend/utils/paypal";
import { getUserFromRequest } from "@/app/backend/utils/authToken";
import { sendWalletTopupEmails } from "@/app/backend/utils/walletEmail";

export const runtime = "nodejs";

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("unauthorized") || value.includes("login")) return 401;
  if (value.includes("not found")) return 404;
  if (value.includes("inactive")) return 403;
  if (value.includes("wallet is not active")) return 403;
  if (value.includes("customer")) return 403;
  if (value.includes("does not match")) return 400;
  if (value.includes("order id")) return 400;
  if (value.includes("already completed")) return 200;
  if (value.includes("amount")) return 400;

  return 500;
}

function serializePayPalPayload(payload) {
  if (!payload) return null;
  return payload;
}

function normalizeAmount(amount) {
  return Number(Number(amount || 0).toFixed(2));
}

function amountsMatch(expectedAmount, paidAmount) {
  return normalizeAmount(expectedAmount) === normalizeAmount(paidAmount);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPayPalAlreadyCapturedOrRaceError(message = "") {
  const value = String(message || "").toLowerCase();

  return (
    value.includes("semantically incorrect") ||
    value.includes("failed business validation") ||
    value.includes("already captured") ||
    value.includes("already been captured") ||
    value.includes("order already") ||
    value.includes("order has already") ||
    value.includes("instrument declined")
  );
}

async function sendWalletTopupSuccessEmailsSafe({
  user,
  walletTransaction,
  payment,
}) {
  try {
    if (!user || !walletTransaction) return;

    if (walletTransaction.status !== "completed") {
      return;
    }

    await sendWalletTopupEmails({
      user,
      walletTransaction,
      payment,
    });
  } catch (emailError) {
    console.error("PayPal wallet top-up email failed:", emailError);
  }
}

async function getCompletedTopupSnapshot({ topupId, userId, orderId }) {
  const walletTransaction = await WalletTransaction.findOne({
    _id: topupId,
    user_id: userId,
    type: "topup_paypal",
  });

  if (!walletTransaction) {
    return null;
  }

  const payment = await Payment.findOne({
    $or: [
      { wallet_transaction_id: walletTransaction._id },
      { provider_order_id: orderId },
    ],
    status: { $in: ["paid", "completed", "success"] },
  }).sort({ createdAt: -1 });

  const user = await ParkingUser.findById(userId).select(
    "name email phone role is_active wallet_balance wallet_currency wallet_status"
  );

  if (walletTransaction.status !== "completed") {
    return null;
  }

  return {
    walletTransaction,
    payment,
    user,
  };
}

function completedTopupResponse({
  walletTransaction,
  payment,
  user,
  message = "Wallet top-up already completed.",
  alreadyCompleted = true,
}) {
  return Response.json(
    {
      success: true,
      message,
      alreadyCompleted,
      redirectUrl: "/customer/dashboard",
      data: {
        walletTransaction,
        payment,
        wallet: {
          balance: Number(user?.wallet_balance || 0),
          currency: user?.wallet_currency || "aud",
          status: user?.wallet_status || "active",
        },
      },
    },
    { status: 200 }
  );
}

async function resolveCompletedTopupAfterPayPalRace({
  topupId,
  userId,
  orderId,
}) {
  /**
   * In local dev, React StrictMode can call the capture endpoint twice.
   * First request may capture + credit the wallet while the second request
   * receives PayPal's business validation error. Wait briefly and re-check DB.
   */
  const retryDelays = [0, 300, 800, 1500];

  for (const delay of retryDelays) {
    if (delay > 0) {
      await sleep(delay);
    }

    const snapshot = await getCompletedTopupSnapshot({
      topupId,
      userId,
      orderId,
    });

    if (snapshot) {
      await sendWalletTopupSuccessEmailsSafe({
        user: snapshot.user,
        walletTransaction: snapshot.walletTransaction,
        payment: snapshot.payment,
      });

      return completedTopupResponse({
        walletTransaction: snapshot.walletTransaction,
        payment: snapshot.payment,
        user: snapshot.user,
        message: "Wallet top-up already completed.",
        alreadyCompleted: true,
      });
    }
  }

  return null;
}

export async function POST(req) {
  let authUser = null;
  let topupId = null;
  let orderId = null;

  try {
    await connectDB();

    if (!process.env.PAYPAL_CLIENT_ID) {
      return Response.json(
        {
          success: false,
          message: "PAYPAL_CLIENT_ID is not configured.",
          error: "PAYPAL_CLIENT_ID is not configured.",
        },
        { status: 500 }
      );
    }

    if (!process.env.PAYPAL_SECRET_KEY) {
      return Response.json(
        {
          success: false,
          message: "PAYPAL_SECRET_KEY is not configured.",
          error: "PAYPAL_SECRET_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    authUser = getUserFromRequest(req);

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

    const body = await req.json();

    topupId =
      body.topupId || body.walletTransactionId || body.wallet_transaction_id;

    orderId = body.orderId || body.token;

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

    if (!orderId) {
      return Response.json(
        {
          success: false,
          message: "PayPal order ID is required.",
          error: "PayPal order ID is required.",
        },
        { status: 400 }
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

    const walletTransaction = await WalletTransaction.findOne({
      _id: topupId,
      user_id: user._id,
      type: "topup_paypal",
    });

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

    if (walletTransaction.provider_order_id !== orderId) {
      return Response.json(
        {
          success: false,
          message: "PayPal order ID does not match this wallet top-up.",
          error: "PayPal order ID does not match this wallet top-up.",
        },
        { status: 400 }
      );
    }

    /**
     * Idempotency guard:
     * If the user refreshes after a successful capture, do not credit again.
     */
    if (walletTransaction.status === "completed") {
      const existingPayment = await Payment.findOne({
        wallet_transaction_id: walletTransaction._id,
      }).sort({ createdAt: -1 });

      await sendWalletTopupSuccessEmailsSafe({
        user,
        walletTransaction,
        payment: existingPayment,
      });

      return completedTopupResponse({
        walletTransaction,
        payment: existingPayment,
        user,
        message: "Wallet top-up already completed.",
        alreadyCompleted: true,
      });
    }

    /**
     * Extra guard:
     * If Payment was already recorded as paid and the transaction became
     * completed between page reloads, return success.
     */
    const completedSnapshot = await getCompletedTopupSnapshot({
      topupId,
      userId: user._id,
      orderId,
    });

    if (completedSnapshot) {
      await sendWalletTopupSuccessEmailsSafe({
        user: completedSnapshot.user,
        walletTransaction: completedSnapshot.walletTransaction,
        payment: completedSnapshot.payment,
      });

      return completedTopupResponse({
        walletTransaction: completedSnapshot.walletTransaction,
        payment: completedSnapshot.payment,
        user: completedSnapshot.user,
        message: "Wallet top-up already completed.",
        alreadyCompleted: true,
      });
    }

    if (walletTransaction.status !== "pending") {
      return Response.json(
        {
          success: false,
          message: `Wallet top-up cannot be captured because it is ${walletTransaction.status}.`,
          error: `Wallet top-up cannot be captured because it is ${walletTransaction.status}.`,
        },
        { status: 400 }
      );
    }

    let captureResult = null;

    try {
      captureResult = await capturePayPalOrder(orderId);
    } catch (captureError) {
      if (isPayPalAlreadyCapturedOrRaceError(captureError.message)) {
        const resolvedResponse = await resolveCompletedTopupAfterPayPalRace({
          topupId,
          userId: user._id,
          orderId,
        });

        if (resolvedResponse) {
          return resolvedResponse;
        }
      }

      throw captureError;
    }

    const captureDetails = getPayPalCaptureDetails(captureResult);

    if (!isPayPalCaptureCompleted(captureResult)) {
      const failureReason = `PayPal wallet top-up was not completed. Status: ${
        captureDetails.status || captureDetails.captureStatus || "unknown"
      }`;

      walletTransaction.status = "failed";
      walletTransaction.failure_reason = failureReason;
      walletTransaction.provider_capture_id =
        captureDetails.captureId || undefined;
      walletTransaction.provider_payload = serializePayPalPayload(captureResult);
      walletTransaction.failed_at = new Date();

      await walletTransaction.save();

      await Payment.findOneAndUpdate(
        {
          provider_order_id: orderId,
        },
        {
          user_id: user._id,
          wallet_transaction_id: walletTransaction._id,

          amount: Number(walletTransaction.amount || 0),
          currency: walletTransaction.currency || "aud",

          method: "paypal",
          status: "failed",

          payment_flow: "wallet_topup",
          payment_purpose: "wallet_topup",

          transaction_id: captureDetails.captureId || orderId,
          provider_order_id: orderId,
          provider_capture_id: captureDetails.captureId || undefined,
          failure_reason: failureReason,
          provider_payload: serializePayPalPayload(captureResult),

          wallet_balance_before: Number(walletTransaction.balance_before || 0),
          wallet_balance_after: Number(walletTransaction.balance_after || 0),

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

      return Response.json(
        {
          success: false,
          message: failureReason,
          error: failureReason,
          order: captureResult,
        },
        { status: 400 }
      );
    }

    const paidAmount = normalizeAmount(captureDetails.amount);
    const expectedAmount = normalizeAmount(walletTransaction.amount);

    if (!amountsMatch(expectedAmount, paidAmount)) {
      const failureReason = `PayPal paid amount does not match wallet top-up amount. Expected AUD ${expectedAmount.toFixed(
        2
      )}, received AUD ${paidAmount.toFixed(2)}.`;

      walletTransaction.status = "failed";
      walletTransaction.failure_reason = failureReason;
      walletTransaction.provider_capture_id =
        captureDetails.captureId || undefined;
      walletTransaction.provider_payload = serializePayPalPayload(captureResult);
      walletTransaction.failed_at = new Date();

      await walletTransaction.save();

      await Payment.findOneAndUpdate(
        {
          provider_order_id: orderId,
        },
        {
          user_id: user._id,
          wallet_transaction_id: walletTransaction._id,

          amount: paidAmount,
          currency: String(captureDetails.currency || "AUD").toLowerCase(),

          method: "paypal",
          status: "failed",

          payment_flow: "wallet_topup",
          payment_purpose: "wallet_topup",

          transaction_id: captureDetails.captureId || orderId,
          provider_order_id: orderId,
          provider_capture_id: captureDetails.captureId || undefined,
          failure_reason: failureReason,
          provider_payload: serializePayPalPayload(captureResult),

          wallet_balance_before: Number(walletTransaction.balance_before || 0),
          wallet_balance_after: Number(walletTransaction.balance_after || 0),

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

      return Response.json(
        {
          success: false,
          message: failureReason,
          error: failureReason,
        },
        { status: 400 }
      );
    }

    const session = await mongoose.startSession();

    let updatedWalletTransaction = null;
    let updatedPayment = null;
    let updatedUser = null;

    try {
      await session.withTransaction(async () => {
        const freshTransaction = await WalletTransaction.findOne({
          _id: walletTransaction._id,
          user_id: user._id,
          status: "pending",
        }).session(session);

        if (!freshTransaction) {
          updatedWalletTransaction = await WalletTransaction.findById(
            walletTransaction._id
          ).session(session);
          return;
        }

        const freshUser = await ParkingUser.findOne({
          _id: user._id,
          is_active: true,
          wallet_status: "active",
        }).session(session);

        if (!freshUser) {
          throw new Error("Wallet user not found or wallet is not active.");
        }

        const balanceBefore = Number(freshUser.wallet_balance || 0);
        const balanceAfter = normalizeAmount(balanceBefore + paidAmount);

        freshUser.wallet_balance = balanceAfter;
        freshUser.wallet_updated_at = new Date();

        await freshUser.save({ session });

        freshTransaction.status = "completed";
        freshTransaction.amount = paidAmount;
        freshTransaction.balance_before = balanceBefore;
        freshTransaction.balance_after = balanceAfter;
        freshTransaction.provider_order_id = orderId;
        freshTransaction.provider_capture_id =
          captureDetails.captureId || undefined;
        freshTransaction.provider_payload =
          serializePayPalPayload(captureResult);
        freshTransaction.completed_at = new Date();
        freshTransaction.failure_reason = undefined;

        await freshTransaction.save({ session });

        const payment = await Payment.findOneAndUpdate(
          {
            provider_order_id: orderId,
          },
          {
            user_id: freshUser._id,
            wallet_transaction_id: freshTransaction._id,

            amount: paidAmount,
            currency: String(captureDetails.currency || "AUD").toLowerCase(),

            method: "paypal",
            status: "paid",

            payment_flow: "wallet_topup",
            payment_purpose: "wallet_topup",

            transaction_id: captureDetails.captureId || orderId,
            provider_order_id: orderId,
            provider_capture_id: captureDetails.captureId || undefined,
            provider_payload: serializePayPalPayload(captureResult),
            paid_at: new Date(),

            wallet_balance_before: balanceBefore,
            wallet_balance_after: balanceAfter,

            metadata: {
              purpose: "wallet_topup",
              wallet_transaction_id: freshTransaction._id.toString(),
              user_id: freshUser._id.toString(),
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            session,
          }
        );

        freshTransaction.payment_id = payment._id;
        await freshTransaction.save({ session });

        updatedWalletTransaction = freshTransaction;
        updatedPayment = payment;
        updatedUser = freshUser;
      });
    } finally {
      await session.endSession();
    }

    if (!updatedWalletTransaction) {
      updatedWalletTransaction = await WalletTransaction.findById(
        walletTransaction._id
      );

      updatedPayment = await Payment.findOne({
        wallet_transaction_id: walletTransaction._id,
      }).sort({ createdAt: -1 });

      updatedUser = await ParkingUser.findById(user._id).select(
        "name email phone role wallet_balance wallet_currency wallet_status"
      );
    }

    /**
     * If another request completed the transaction during the session,
     * treat this request as successful instead of showing a false failure.
     */
    if (updatedWalletTransaction?.status === "completed") {
      await sendWalletTopupSuccessEmailsSafe({
        user: updatedUser?.email ? updatedUser : user,
        walletTransaction: updatedWalletTransaction,
        payment: updatedPayment,
      });

      return Response.json(
        {
          success: true,
          message: "PayPal wallet top-up captured successfully.",
          redirectUrl: "/customer/dashboard",
          orderId,
          captureId:
            updatedWalletTransaction.provider_capture_id ||
            updatedPayment?.provider_capture_id ||
            captureDetails.captureId,
          order: captureResult,
          data: {
            walletTransaction: updatedWalletTransaction,
            payment: updatedPayment,
            wallet: {
              balance: Number(updatedUser?.wallet_balance || 0),
              currency: updatedUser?.wallet_currency || "aud",
              status: updatedUser?.wallet_status || "active",
            },
          },
        },
        { status: 200 }
      );
    }

    throw new Error("Wallet top-up could not be completed.");
  } catch (error) {
    console.error("Capture PayPal wallet top-up error:", error);

    /**
     * Final safety net:
     * If PayPal rejected a duplicate capture, but DB shows the wallet top-up
     * completed, return success to the frontend.
     */
    if (
      authUser?.id &&
      topupId &&
      orderId &&
      isPayPalAlreadyCapturedOrRaceError(error.message)
    ) {
      const resolvedResponse = await resolveCompletedTopupAfterPayPalRace({
        topupId,
        userId: authUser.id,
        orderId,
      });

      if (resolvedResponse) {
        return resolvedResponse;
      }
    }

    return Response.json(
      {
        success: false,
        message:
          error.message || "Failed to capture PayPal wallet top-up payment.",
        error:
          error.message || "Failed to capture PayPal wallet top-up payment.",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}