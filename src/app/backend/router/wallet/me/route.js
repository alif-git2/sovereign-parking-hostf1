import { connectDB } from "@/app/backend/database/mongodb";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import { getUserFromRequest } from "@/app/backend/utils/authToken";

import "@/app/backend/models/booking";
import "@/app/backend/models/payment";

export const runtime = "nodejs";

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("unauthorized") || value.includes("login")) return 401;
  if (value.includes("not found")) return 404;
  if (value.includes("inactive")) return 403;

  return 500;
}

function serializeWalletUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    is_active: user.is_active,

    wallet_balance: Number(user.wallet_balance || 0),
    wallet_currency: user.wallet_currency || "aud",
    wallet_status: user.wallet_status || "active",
    wallet_updated_at: user.wallet_updated_at || null,
  };
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
      "name email phone role is_active wallet_balance wallet_currency wallet_status wallet_updated_at"
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
          message: "Wallet is available for customers only.",
          error: "Wallet is available for customers only.",
        },
        { status: 403 }
      );
    }

    const recentTransactions = await WalletTransaction.find({
      user_id: user._id,
    })
      .populate("booking_id", "booking_id type status payment_status price")
      .populate("payment_id", "method status amount currency payment_purpose")
      .sort({ createdAt: -1 })
      .limit(10);

    const serializedUser = serializeWalletUser(user);

    return Response.json(
      {
        success: true,
        message: "Wallet loaded successfully.",
        data: {
          user: serializedUser,
          wallet: {
            balance: serializedUser.wallet_balance,
            currency: serializedUser.wallet_currency,
            status: serializedUser.wallet_status,
            updated_at: serializedUser.wallet_updated_at,
          },
          recentTransactions,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Wallet me route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load wallet.",
        error: error.message || "Failed to load wallet.",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}