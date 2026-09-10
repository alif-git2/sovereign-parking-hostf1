import jwt from "jsonwebtoken";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import { sendWithdrawalRequestEmails } from "@/app/backend/utils/walletWithdrawalEmail";

function moneyNumber(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
}

function getBearerToken(req) {
  const authHeader = req.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.replace("Bearer ", "").trim();
}

async function requireCustomerUser(req) {
  const token = getBearerToken(req);

  if (!token) {
    throw new Error("Authorization token is required");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const userId =
    decoded.userId ||
    decoded.id ||
    decoded._id ||
    decoded.sub ||
    decoded.user_id;

  if (!userId) {
    throw new Error("Invalid authorization token");
  }

  const user = await ParkingUser.findById(userId);

  if (!user) {
    throw new Error("Customer account not found");
  }

  if (user.role !== "customer") {
    throw new Error("Only customer accounts can request withdrawal");
  }

  if (user.is_active === false) {
    throw new Error("Customer account is inactive");
  }

  return user;
}

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("authorization") || value.includes("token")) return 401;
  if (value.includes("only customer")) return 403;
  if (value.includes("not found")) return 404;

  return 400;
}

function serializeTransaction(transaction) {
  return {
    _id: String(transaction._id),
    type: transaction.type,
    direction: transaction.direction,
    amount: moneyNumber(transaction.amount),
    currency: transaction.currency || "aud",
    balance_before: moneyNumber(transaction.balance_before),
    balance_after: moneyNumber(transaction.balance_after),
    status: transaction.status,
    method: transaction.method,
    transaction_reference: transaction.transaction_reference,
    note: transaction.note || "",
    requested_at: transaction.requested_at,
    completed_at: transaction.completed_at,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

export async function createCustomerWithdrawRequest(req) {
  try {
    const customer = await requireCustomerUser(req);
    const body = await req.json();

    const amount = moneyNumber(body.amount);
    const note = String(body.note || "").trim();

    const payoutMethod = String(body.payout_method || "").trim();

    const payoutDetails = {
      method: payoutMethod,
      account_holder_name: String(body.account_holder_name || "").trim(),
      bank_name: String(body.bank_name || "").trim(),
      bsb: String(body.bsb || "").trim(),
      account_number: String(body.account_number || "").trim(),
      paypal_email: String(body.paypal_email || "").toLowerCase().trim(),
      customer_note: note,
    };

    if (amount <= 0) {
      throw new Error("Withdrawal amount must be greater than 0");
    }

    if (amount < 1) {
      throw new Error("Minimum withdrawal amount is A$1.00");
    }

    if (customer.wallet_status !== "active") {
      throw new Error("Your wallet is not active");
    }

    if (!["bank_transfer", "paypal", "cash", "other"].includes(payoutMethod)) {
      throw new Error("Please select a valid payout method");
    }

    if (payoutMethod === "bank_transfer") {
      if (!payoutDetails.account_holder_name) {
        throw new Error("Account holder name is required");
      }

      if (!payoutDetails.bank_name) {
        throw new Error("Bank name is required");
      }

      if (!payoutDetails.bsb) {
        throw new Error("BSB / routing number is required");
      }

      if (!payoutDetails.account_number) {
        throw new Error("Account number is required");
      }
    }

    if (payoutMethod === "paypal" && !payoutDetails.paypal_email) {
      throw new Error("PayPal email is required");
    }

    if (["cash", "other"].includes(payoutMethod) && !note) {
      throw new Error("Please add a note for this payout method");
    }

    const balanceBefore = moneyNumber(customer.wallet_balance);

    if (balanceBefore <= 0) {
      throw new Error("Your wallet has no available balance");
    }

    if (amount > balanceBefore) {
      throw new Error("Withdrawal amount cannot be greater than wallet balance");
    }

    const balanceAfter = moneyNumber(balanceBefore - amount);

    customer.wallet_balance = balanceAfter;
    customer.wallet_currency = customer.wallet_currency || "aud";
    customer.wallet_updated_at = new Date();

    await customer.save();

    const transaction = await WalletTransaction.create({
      user_id: customer._id,
      type: "withdrawal_request",
      direction: "debit",
      amount,
      currency: customer.wallet_currency || "aud",
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      status: "pending",
      method: payoutMethod === "paypal" ? "paypal" : "bank",
      note: note || "Customer requested wallet withdrawal",
      requested_at: new Date(),
      metadata: {
        customer_requested: true,
        customer_email: customer.email,
        payout_details: payoutDetails,
      },
    });


let emailResult = null;

try {
  emailResult = await sendWithdrawalRequestEmails({
    customer,
    transaction,
    amount,
    balanceBefore,
    balanceAfter,
    payoutDetails,
  });
} catch (emailError) {
  console.error("Withdrawal request email failed:", emailError);
}


const emailMessage =
  emailResult?.customer?.sent && emailResult?.admin?.sent
    ? " Confirmation emails sent."
    : " Request saved, but one or more emails may not have been sent.";

return Response.json(
  {
    success: true,
    message:
      "Withdrawal request submitted successfully. Admin will review it." +
      emailMessage,
    data: {
      wallet: {
        balance: balanceAfter,
        status: customer.wallet_status,
        currency: customer.wallet_currency || "aud",
      },
      transaction: serializeTransaction(transaction),
      email_result: emailResult,
    },
  },
  { status: 201 }
);

  } catch (error) {
    console.error("Customer withdrawal request error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to submit withdrawal request",
        error: error.message || "Failed to submit withdrawal request",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}