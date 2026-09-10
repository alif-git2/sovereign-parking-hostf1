import mongoose from "mongoose";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import { requireAdminUser } from "@/app/backend/utils/authToken";
import { sendWalletCreditEmails } from "@/app/backend/utils/adminWalletEmail";
import {
  sendWithdrawalAcceptedEmails,
  sendWithdrawalRejectedEmails,
} from "@/app/backend/utils/walletWithdrawalEmail";

function moneyNumber(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
}

function getErrorStatus(message = "") {
  const text = String(message).toLowerCase();

  if (
    text.includes("required") ||
    text.includes("invalid") ||
    text.includes("greater than") ||
    text.includes("not enough") ||
    text.includes("balance") ||
    text.includes("inactive") ||
    text.includes("disabled")
  ) {
    return 400;
  }

  if (text.includes("not found")) {
    return 404;
  }

  if (text.includes("unauthorized") || text.includes("token")) {
    return 401;
  }

  if (text.includes("forbidden") || text.includes("admin")) {
    return 403;
  }

  return 500;
}

function getPlainMetadata(transaction) {
  if (transaction?.metadata && typeof transaction.metadata === "object") {
    return { ...transaction.metadata };
  }

  return {};
}

function serializeWalletUser(user, transactionCount = 0) {
  return {
    _id: String(user._id),
    name: user.name || "-",
    email: user.email || "-",
    phone: user.phone || "-",
    role: user.role,
    is_active: user.is_active,
    wallet_balance: moneyNumber(user.wallet_balance),
    wallet_currency: user.wallet_currency || "aud",
    wallet_status: user.wallet_status || "active",
    wallet_updated_at: user.wallet_updated_at,
    transaction_count: transactionCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function serializeWalletTransaction(transaction) {
  const user =
    transaction.user_id && typeof transaction.user_id === "object"
      ? transaction.user_id
      : null;

  const metadata =
    transaction.metadata && typeof transaction.metadata === "object"
      ? transaction.metadata
      : {};

  return {
    _id: String(transaction._id),
    user_id: user?._id ? String(user._id) : String(transaction.user_id || ""),
    user_name: user?.name || "-",
    user_email: user?.email || "-",
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
    processed_by: transaction.processed_by,
    metadata,
    payout_details: metadata.payout_details || null,
    admin_payment_proof: metadata.admin_payment_proof || null,
    admin_rejection: metadata.admin_rejection || null,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

export async function getAdminWallets(req) {
  try {
    await requireAdminUser(req);

    const { searchParams } = new URL(req.url);

    const search = String(searchParams.get("search") || "").trim();
    const status = String(searchParams.get("status") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 200), 500);

    const filter = {
      role: "customer",
    };

    if (status) {
      filter.wallet_status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const users = await ParkingUser.find(filter)
      .select(
        "name email phone role is_active wallet_balance wallet_currency wallet_status wallet_updated_at createdAt updatedAt"
      )
      .sort({
        wallet_balance: -1,
        createdAt: -1,
      })
      .limit(limit)
      .lean();

    const userIds = users.map((user) => user._id);

    const transactionCounts = await WalletTransaction.aggregate([
      {
        $match: {
          user_id: {
            $in: userIds,
          },
        },
      },
      {
        $group: {
          _id: "$user_id",
          count: {
            $sum: 1,
          },
        },
      },
    ]);

    const countMap = new Map(
      transactionCounts.map((item) => [String(item._id), item.count])
    );

    return Response.json({
      success: true,
      data: users.map((user) =>
        serializeWalletUser(user, countMap.get(String(user._id)) || 0)
      ),
    });
  } catch (error) {
    console.error("Admin wallets fetch error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load wallets",
        error: error.message || "Failed to load wallets",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function creditCustomerWallet(req) {
  try {
    const adminUser = await requireAdminUser(req);
    const body = await req.json();

    const email = String(body.email || "").toLowerCase().trim();
    const amount = moneyNumber(body.amount);
    const note = String(body.note || "").trim();

    if (!email) {
      throw new Error("Customer email is required");
    }

    if (amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const customer = await ParkingUser.findOne({
      email,
      role: "customer",
    });

    if (!customer) {
      throw new Error("Customer not found with this email");
    }

    if (customer.is_active === false) {
      throw new Error("Customer account is inactive");
    }

    if (customer.wallet_status === "disabled") {
      throw new Error("Customer wallet is disabled");
    }

    const balanceBefore = moneyNumber(customer.wallet_balance);
    const balanceAfter = moneyNumber(balanceBefore + amount);

    customer.wallet_balance = balanceAfter;
    customer.wallet_currency = customer.wallet_currency || "aud";
    customer.wallet_updated_at = new Date();

    if (!customer.wallet_status) {
      customer.wallet_status = "active";
    }

    await customer.save();

    const transaction = await WalletTransaction.create({
      user_id: customer._id,
      type: "admin_adjustment",
      direction: "credit",
      amount,
      currency: customer.wallet_currency || "aud",
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      status: "completed",
      method: "admin",
      note: note || `Admin credited wallet AUD ${amount.toFixed(2)}`,
      processed_by: adminUser._id,
      metadata: {
        admin_action: "manual_wallet_credit",
        admin_user_id: String(adminUser._id),
        customer_email: customer.email,
      },
    });

    let emailResult = null;

    try {
      emailResult = await sendWalletCreditEmails({
        customer,
        adminUser,
        transaction,
        amount,
        balanceBefore,
        balanceAfter,
        note,
      });

      const metadata = getPlainMetadata(transaction);

      metadata.email_result = {
        action: "wallet_credit",
        attempted_at: new Date(),
        sent_customer_email: Boolean(emailResult.sentCustomerEmail),
        sent_admin_email: Boolean(emailResult.sentAdminEmail),
        customer_error: emailResult.customerError || null,
        admin_error: emailResult.adminError || null,
      };

      transaction.metadata = metadata;
      transaction.markModified("metadata");
      await transaction.save();
    } catch (emailError) {
      console.error("Wallet credit email process failed:", emailError);

      const metadata = getPlainMetadata(transaction);

      metadata.email_result = {
        action: "wallet_credit",
        attempted_at: new Date(),
        sent_customer_email: false,
        sent_admin_email: false,
        error: emailError.message || "Wallet credit email process failed",
      };

      transaction.metadata = metadata;
      transaction.markModified("metadata");
      await transaction.save();
    }

    let message = `A$${amount.toFixed(2)} added to ${customer.email} wallet.`;

    if (emailResult?.sentCustomerEmail && emailResult?.sentAdminEmail) {
      message += " Customer and admin emails sent.";
    } else if (emailResult) {
      message += " Wallet credited, but one or more emails failed.";
    }

    return Response.json(
      {
        success: true,
        message,
        data: {
          wallet: serializeWalletUser(customer.toObject(), 0),
          transaction: serializeWalletTransaction(transaction.toObject()),
          email_result: emailResult,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin wallet credit error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to credit wallet",
        error: error.message || "Failed to credit wallet",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}


export async function updateCustomerWallet(req, userId) {
  try {
    const adminUser = await requireAdminUser(req);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid customer ID");
    }

    const body = await req.json().catch(() => ({}));

    const nextBalance = moneyNumber(body.wallet_balance);
    const nextStatus = String(body.wallet_status || "").trim();
    const note = String(body.note || "").trim();

    if (!["active", "frozen", "disabled"].includes(nextStatus)) {
      throw new Error("Invalid wallet status");
    }

    if (nextBalance < 0) {
      throw new Error("Wallet balance cannot be negative");
    }

    const customer = await ParkingUser.findOne({
      _id: userId,
      role: "customer",
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const balanceBefore = moneyNumber(customer.wallet_balance);
    const balanceAfter = nextBalance;
    const balanceDifference = moneyNumber(balanceAfter - balanceBefore);

    const oldStatus = customer.wallet_status || "active";

    customer.wallet_balance = balanceAfter;
    customer.wallet_currency = customer.wallet_currency || "aud";
    customer.wallet_status = nextStatus;
    customer.wallet_updated_at = new Date();

    await customer.save();

    let transaction = null;

    /**
     * Important:
     * Only create wallet transaction when balance actually changes.
     * Status-only update like active -> disabled should NOT create a
     * zero amount transaction.
     */
    if (balanceDifference !== 0) {
      transaction = await WalletTransaction.create({
        user_id: customer._id,
        type: "admin_adjustment",
        direction: balanceDifference > 0 ? "credit" : "debit",
        amount: Math.abs(balanceDifference),
        currency: customer.wallet_currency || "aud",
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "completed",
        method: "admin",
        note:
          note ||
          `Admin wallet balance adjustment from A$${balanceBefore.toFixed(
            2
          )} to A$${balanceAfter.toFixed(2)}`,
        processed_by: adminUser._id,
        metadata: {
          admin_action: "manual_wallet_edit",
          admin_user_id: String(adminUser._id),
          admin_email: adminUser.email || "",
          customer_email: customer.email,
          old_wallet_status: oldStatus,
          new_wallet_status: nextStatus,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          balance_difference: balanceDifference,
        },
      });
    }

    return Response.json(
      {
        success: true,
        message:
          balanceDifference === 0
            ? "Wallet status updated successfully."
            : "Wallet balance and status updated successfully.",
        data: {
          wallet: serializeWalletUser(customer.toObject(), 0),
          transaction: transaction
            ? serializeWalletTransaction(transaction.toObject())
            : null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin wallet update error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update wallet",
        error: error.message || "Failed to update wallet",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function deleteCustomerWallet(req, userId) {
  try {
    await requireAdminUser(req);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid customer ID");
    }

    const customer = await ParkingUser.findOne({
      _id: userId,
      role: "customer",
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const balance = moneyNumber(customer.wallet_balance);

    if (balance > 0) {
      throw new Error(
        "Wallet has balance. Please withdraw or debit the balance before deleting."
      );
    }

    const transactionCount = await WalletTransaction.countDocuments({
      user_id: customer._id,
    });

    customer.wallet_balance = 0;
    customer.wallet_status = "disabled";
    customer.wallet_updated_at = new Date();

    await customer.save();

    return Response.json({
      success: true,
      message:
        transactionCount > 0
          ? "Wallet has transaction history, so it was disabled instead of deleted."
          : "Wallet deleted/disabled successfully.",
      data: serializeWalletUser(customer.toObject(), transactionCount),
    });
  } catch (error) {
    console.error("Admin wallet delete error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete wallet",
        error: error.message || "Failed to delete wallet",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function getAdminWalletTransactions(req) {
  try {
    await requireAdminUser(req);

    const { searchParams } = new URL(req.url);

    const type = String(searchParams.get("type") || "").trim();
    const status = String(searchParams.get("status") || "").trim();
    const search = String(searchParams.get("search") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 200), 500);

    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      const users = await ParkingUser.find({
        role: "customer",
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      })
        .select("_id")
        .lean();

      const userIds = users.map((user) => user._id);

      filter.$or = [
        { transaction_reference: { $regex: search, $options: "i" } },
        { note: { $regex: search, $options: "i" } },
        {
          user_id: {
            $in: userIds,
          },
        },
      ];
    }

    const transactions = await WalletTransaction.find(filter)
      .populate("user_id", "name email phone wallet_balance wallet_status")
      .populate("processed_by", "name email")
      .sort({
        createdAt: -1,
      })
      .limit(limit)
      .lean();

    return Response.json({
      success: true,
      data: transactions.map(serializeWalletTransaction),
    });
  } catch (error) {
    console.error("Admin wallet transactions fetch error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load wallet transactions",
        error: error.message || "Failed to load wallet transactions",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function markWithdrawalPaid(req, transactionId) {
  try {
    const adminUser = await requireAdminUser(req);

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      throw new Error("Invalid transaction ID");
    }

    const body = await req.json().catch(() => ({}));

    const paidMethod = String(body.paid_method || "").trim();
    const paidReference = String(body.paid_reference || "").trim();
    const paidNote = String(body.paid_note || "").trim();

    if (!["bank_transfer", "paypal", "cash"].includes(paidMethod)) {
      throw new Error("Please select a valid paid method");
    }

    if (!paidReference) {
      throw new Error("Payment reference / proof is required");
    }

    const transaction = await WalletTransaction.findById(transactionId);

    if (!transaction) {
      throw new Error("Withdrawal request not found");
    }

    if (transaction.type !== "withdrawal_request") {
      throw new Error("This transaction is not a withdrawal request");
    }

    if (transaction.status !== "pending") {
      throw new Error("Only pending withdrawal requests can be accepted");
    }

    const metadata = getPlainMetadata(transaction);

    metadata.admin_payment_proof = {
      paid_method: paidMethod,
      paid_reference: paidReference,
      paid_note: paidNote,
      paid_at: new Date(),
      paid_by_admin_id: String(adminUser._id),
      paid_by_admin_email: adminUser.email || "",
      paid_by_admin_name: adminUser.name || "",
    };

    transaction.type = "withdrawal_paid";
    transaction.status = "completed";
    transaction.method =
      paidMethod === "paypal"
        ? "paypal"
        : paidMethod === "bank_transfer"
        ? "bank"
        : "admin";
    transaction.completed_at = new Date();
    transaction.processed_by = adminUser._id;
    transaction.metadata = metadata;
    transaction.note = transaction.note
      ? `${transaction.note}\nAccepted by admin. Paid manually outside the system. Reference: ${paidReference}`
      : `Accepted by admin. Paid manually outside the system. Reference: ${paidReference}`;

    transaction.markModified("metadata");
    await transaction.save();

    let emailResult = null;

    const customer = await ParkingUser.findById(transaction.user_id);

    if (customer) {
      try {
        emailResult = await sendWithdrawalAcceptedEmails({
          customer,
          transaction,
          amount: moneyNumber(transaction.amount),
          balanceBefore: moneyNumber(transaction.balance_before),
          balanceAfter: moneyNumber(transaction.balance_after),
          payoutDetails: metadata.payout_details || {},
          adminPaymentProof: metadata.admin_payment_proof || {},
        });

        metadata.email_result = {
          ...(metadata.email_result || {}),
          withdrawal_accepted: {
            attempted_at: new Date(),
            customer: emailResult.customer || null,
            admin: emailResult.admin || null,
          },
        };

        transaction.metadata = metadata;
        transaction.markModified("metadata");
        await transaction.save();
      } catch (emailError) {
        console.error("Withdrawal accepted email failed:", emailError);

        metadata.email_result = {
          ...(metadata.email_result || {}),
          withdrawal_accepted: {
            attempted_at: new Date(),
            error:
              emailError.message || "Withdrawal accepted email process failed",
          },
        };

        transaction.metadata = metadata;
        transaction.markModified("metadata");
        await transaction.save();
      }
    }

    return Response.json({
      success: true,
      message:
        emailResult?.customer?.sent && emailResult?.admin?.sent
          ? "Withdrawal request accepted and emails sent."
          : "Withdrawal request accepted and marked as paid.",
      data: {
        transaction: serializeWalletTransaction(transaction.toObject()),
        email_result: emailResult,
      },
    });
  } catch (error) {
    console.error("Admin withdrawal accept error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to accept withdrawal request",
        error: error.message || "Failed to accept withdrawal request",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function rejectWithdrawalRequest(req, transactionId) {
  try {
    const adminUser = await requireAdminUser(req);

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      throw new Error("Invalid transaction ID");
    }

    const body = await req.json().catch(() => ({}));
    const rejectNote = String(body.note || "").trim();

    const transaction = await WalletTransaction.findById(transactionId);

    if (!transaction) {
      throw new Error("Withdrawal request not found");
    }

    if (transaction.type !== "withdrawal_request") {
      throw new Error("This transaction is not a withdrawal request");
    }

    if (transaction.status !== "pending") {
      throw new Error("Only pending withdrawal requests can be rejected");
    }

    const customer = await ParkingUser.findById(transaction.user_id);

    if (!customer) {
      throw new Error("Customer not found for this withdrawal request");
    }

    const amount = moneyNumber(transaction.amount);

    if (amount <= 0) {
      throw new Error("Invalid withdrawal amount");
    }

    const balanceBefore = moneyNumber(customer.wallet_balance);
    const balanceAfter = moneyNumber(balanceBefore + amount);

    customer.wallet_balance = balanceAfter;
    customer.wallet_currency =
      customer.wallet_currency || transaction.currency || "aud";
    customer.wallet_updated_at = new Date();

    if (!customer.wallet_status) {
      customer.wallet_status = "active";
    }

    await customer.save();

    const metadata = getPlainMetadata(transaction);

    metadata.admin_rejection = {
      rejected_at: new Date(),
      rejected_by_admin_id: String(adminUser._id),
      rejected_by_admin_email: adminUser.email || "",
      rejected_by_admin_name: adminUser.name || "",
      reason: rejectNote || "",
      amount_returned: amount,
    };

    transaction.status = "cancelled";
    transaction.cancelled_at = new Date();
    transaction.processed_by = adminUser._id;
    transaction.metadata = metadata;
    transaction.note = transaction.note
      ? `${transaction.note}\nRejected by admin. Amount returned to customer wallet.${
          rejectNote ? ` Reason: ${rejectNote}` : ""
        }`
      : `Rejected by admin. Amount returned to customer wallet.${
          rejectNote ? ` Reason: ${rejectNote}` : ""
        }`;

    transaction.markModified("metadata");
    await transaction.save();

    const returnTransaction = await WalletTransaction.create({
      user_id: customer._id,
      type: "admin_adjustment",
      direction: "credit",
      amount,
      currency: customer.wallet_currency || "aud",
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      status: "completed",
      method: "admin",
      note:
        rejectNote ||
        `Withdrawal request ${transaction.transaction_reference} rejected. Amount returned to wallet.`,
      processed_by: adminUser._id,
      metadata: {
        admin_action: "withdrawal_rejected_returned_to_wallet",
        withdrawal_request_id: String(transaction._id),
        withdrawal_reference: transaction.transaction_reference,
        admin_user_id: String(adminUser._id),
      },
    });

    let emailResult = null;

    try {
      emailResult = await sendWithdrawalRejectedEmails({
        customer,
        transaction,
        amount,
        balanceBefore,
        balanceAfter,
        payoutDetails: metadata.payout_details || {},
        rejectionReason: rejectNote || "Withdrawal request rejected by admin.",
      });

      metadata.email_result = {
        ...(metadata.email_result || {}),
        withdrawal_rejected: {
          attempted_at: new Date(),
          customer: emailResult.customer || null,
          admin: emailResult.admin || null,
        },
      };

      transaction.metadata = metadata;
      transaction.markModified("metadata");
      await transaction.save();
    } catch (emailError) {
      console.error("Withdrawal rejected email failed:", emailError);

      metadata.email_result = {
        ...(metadata.email_result || {}),
        withdrawal_rejected: {
          attempted_at: new Date(),
          error:
            emailError.message || "Withdrawal rejected email process failed",
        },
      };

      transaction.metadata = metadata;
      transaction.markModified("metadata");
      await transaction.save();
    }

    return Response.json({
      success: true,
      message:
        emailResult?.customer?.sent && emailResult?.admin?.sent
          ? "Withdrawal request rejected, amount returned, and emails sent."
          : "Withdrawal request rejected and amount returned to wallet.",
      data: {
        withdrawal: serializeWalletTransaction(transaction.toObject()),
        return_transaction: serializeWalletTransaction(
          returnTransaction.toObject()
        ),
        wallet: serializeWalletUser(customer.toObject(), 0),
        email_result: emailResult,
      },
    });
  } catch (error) {
    console.error("Admin withdrawal reject error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to reject withdrawal request",
        error: error.message || "Failed to reject withdrawal request",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}


export async function deleteWithdrawRequest(req, transactionId) {
  try {
    const adminUser = await requireAdminUser(req);

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      throw new Error("Invalid transaction ID");
    }

    const transaction = await WalletTransaction.findById(transactionId);

    if (!transaction) {
      throw new Error("Withdrawal request not found");
    }

    const isWithdrawalTransaction = [
      "withdrawal_request",
      "withdrawal_paid",
    ].includes(transaction.type);

    if (!isWithdrawalTransaction) {
      throw new Error("This transaction is not a withdrawal request");
    }

    if (transaction.status === "pending") {
      throw new Error(
        "Pending withdrawal requests cannot be deleted. Please accept or reject first."
      );
    }

    const metadata =
      transaction.metadata && typeof transaction.metadata === "object"
        ? { ...transaction.metadata }
        : {};

    metadata.admin_withdraw_deleted = true;
    metadata.admin_withdraw_deleted_at = new Date();
    metadata.admin_withdraw_deleted_by = String(adminUser._id);
    metadata.admin_withdraw_deleted_by_email = adminUser.email || "";

    transaction.metadata = metadata;
    transaction.note = transaction.note
      ? `${transaction.note}\nHidden from admin withdrawal list.`
      : "Hidden from admin withdrawal list.";

    transaction.markModified("metadata");

    await transaction.save();

    return Response.json({
      success: true,
      message: "Withdrawal request deleted from admin list.",
      data: serializeWalletTransaction(transaction.toObject()),
    });
  } catch (error) {
    console.error("Admin withdrawal delete error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete withdrawal request",
        error: error.message || "Failed to delete withdrawal request",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}
