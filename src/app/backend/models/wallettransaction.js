import mongoose from "mongoose";

const WalletTransactionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingUser",
      required: true,
      index: true,
    },

    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: undefined,
      index: true,
    },

    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: undefined,
      index: true,
    },

    /**
     * Transaction type:
     *
     * topup_stripe:
     * - Customer adds money to wallet using Stripe
     *
     * topup_paypal:
     * - Customer adds money to wallet using PayPal
     *
     * booking_payment:
     * - Customer pays booking using wallet balance
     *
     * refund_credit:
     * - Admin/system credits refund amount back to wallet
     *
     * withdrawal_request:
     * - Customer requests wallet withdrawal
     *
     * withdrawal_paid:
     * - Admin marks withdrawal as paid
     *
     * admin_adjustment:
     * - Manual wallet adjustment by admin
     */
    type: {
      type: String,
      enum: [
        "topup_stripe",
        "topup_paypal",
        "booking_payment",
        "refund_credit",
        "withdrawal_request",
        "withdrawal_paid",
        "admin_adjustment",
      ],
      required: true,
      index: true,
    },

    /**
     * credit = money added to wallet
     * debit = money removed from wallet
     */
    direction: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "aud",
      lowercase: true,
      trim: true,
    },

    balance_before: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance_after: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "completed",
        "failed",
        "cancelled",
        "refunded",
        "reversed",
      ],
      default: "pending",
      index: true,
    },

    /**
     * Payment provider used for top-up.
     * Wallet booking payment will use method = "wallet".
     */
    method: {
      type: String,
      enum: ["stripe", "paypal", "wallet", "admin", "bank"],
      default: "wallet",
      lowercase: true,
      trim: true,
      index: true,
    },

    /**
     * Stripe PaymentIntent ID.
     */
    provider_payment_id: {
      type: String,
      trim: true,
      default: undefined,
    },

    /**
     * PayPal order ID.
     */
    provider_order_id: {
      type: String,
      trim: true,
      default: undefined,
    },

    /**
     * PayPal capture ID.
     */
    provider_capture_id: {
      type: String,
      trim: true,
      default: undefined,
    },

    /**
     * Optional internal reference.
     * Example: WT17123456789123
     */
    transaction_reference: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
    },

    note: {
      type: String,
      trim: true,
      default: undefined,
    },

    failure_reason: {
      type: String,
      trim: true,
      default: undefined,
    },

    requested_at: {
      type: Date,
      default: Date.now,
    },

    completed_at: {
      type: Date,
      default: null,
    },

    failed_at: {
      type: Date,
      default: null,
    },

    cancelled_at: {
      type: Date,
      default: null,
    },

    /**
     * Wallet top-up email tracking.
     *
     * These prevent duplicate emails when:
     * - Stripe webhook retries
     * - PayPal return/capture page refreshes
     * - user retries after payment already completed
     */
    customer_email_sent_at: {
      type: Date,
      default: null,
    },

    admin_email_sent_at: {
      type: Date,
      default: null,
    },

    email_attempted_at: {
      type: Date,
      default: null,
    },

    email_error: {
      type: String,
      trim: true,
      default: undefined,
    },

    processed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingUser",
      default: undefined,
    },

    provider_payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

function unsetIfEmpty(doc, field) {
  if (doc[field] === null || doc[field] === "") {
    doc[field] = undefined;
  }
}

function generateWalletTransactionReference() {
  return `WT${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

WalletTransactionSchema.pre("validate", function () {
  if (this.currency) {
    this.currency = String(this.currency).toLowerCase().trim();
  }

  if (this.method) {
    this.method = String(this.method).toLowerCase().trim();
  }

  unsetIfEmpty(this, "provider_payment_id");
  unsetIfEmpty(this, "provider_order_id");
  unsetIfEmpty(this, "provider_capture_id");
  unsetIfEmpty(this, "transaction_reference");
  unsetIfEmpty(this, "note");
  unsetIfEmpty(this, "failure_reason");
  unsetIfEmpty(this, "email_error");

  if (!this.transaction_reference) {
    this.transaction_reference = generateWalletTransactionReference();
  }

  const amount = Number(this.amount || 0);
  const balanceBefore = Number(this.balance_before || 0);
  const balanceAfter = Number(this.balance_after || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Wallet transaction amount must be greater than zero");
  }

  if (!Number.isFinite(balanceBefore) || balanceBefore < 0) {
    throw new Error("Invalid wallet balance before transaction");
  }

  if (!Number.isFinite(balanceAfter) || balanceAfter < 0) {
    throw new Error("Invalid wallet balance after transaction");
  }

  this.amount = amount;
  this.balance_before = balanceBefore;
  this.balance_after = balanceAfter;

  /**
   * Auto direction by type if missing.
   */
  if (!this.direction) {
    if (
      ["topup_stripe", "topup_paypal", "refund_credit"].includes(this.type)
    ) {
      this.direction = "credit";
    }

    if (
      ["booking_payment", "withdrawal_request", "withdrawal_paid"].includes(
        this.type
      )
    ) {
      this.direction = "debit";
    }
  }

  /**
   * Validate direction/type combinations.
   */
  const creditTypes = ["topup_stripe", "topup_paypal", "refund_credit"];
  const debitTypes = ["booking_payment", "withdrawal_request", "withdrawal_paid"];

  if (creditTypes.includes(this.type) && this.direction !== "credit") {
    throw new Error(`${this.type} must be a credit transaction`);
  }

  if (debitTypes.includes(this.type) && this.direction !== "debit") {
    throw new Error(`${this.type} must be a debit transaction`);
  }

  /**
   * Auto method by type if needed.
   */
  if (this.type === "topup_stripe") {
    this.method = "stripe";
  }

  if (this.type === "topup_paypal") {
    this.method = "paypal";
  }

  if (this.type === "booking_payment") {
    this.method = "wallet";
  }

  if (this.type === "admin_adjustment" && !this.method) {
    this.method = "admin";
  }

  /**
   * Required relations.
   */
  if (this.type === "booking_payment" && !this.booking_id) {
    throw new Error("Booking ID is required for wallet booking payment");
  }

  if (this.status === "completed" && !this.completed_at) {
    this.completed_at = new Date();
  }

  if (this.status === "failed" && !this.failed_at) {
    this.failed_at = new Date();
  }

  if (this.status === "cancelled" && !this.cancelled_at) {
    this.cancelled_at = new Date();
  }
});

// Normal indexes
WalletTransactionSchema.index({ user_id: 1, createdAt: -1 });
WalletTransactionSchema.index({ user_id: 1, status: 1 });
WalletTransactionSchema.index({ user_id: 1, type: 1 });
WalletTransactionSchema.index({ booking_id: 1 });
WalletTransactionSchema.index({ payment_id: 1 });
WalletTransactionSchema.index({ type: 1, status: 1 });
WalletTransactionSchema.index({ method: 1, status: 1 });
WalletTransactionSchema.index({ createdAt: -1 });

/**
 * Email tracking indexes.
 */
WalletTransactionSchema.index({
  type: 1,
  status: 1,
  customer_email_sent_at: 1,
});

WalletTransactionSchema.index({
  type: 1,
  status: 1,
  admin_email_sent_at: 1,
});

/**
 * Unique indexes only apply when field exists as string.
 * This prevents duplicate key errors from null provider IDs.
 */
WalletTransactionSchema.index(
  { transaction_reference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transaction_reference: { $type: "string" },
    },
  }
);

WalletTransactionSchema.index(
  { provider_payment_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider_payment_id: { $type: "string" },
    },
  }
);

WalletTransactionSchema.index(
  { provider_order_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider_order_id: { $type: "string" },
    },
  }
);

WalletTransactionSchema.index(
  { provider_capture_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider_capture_id: { $type: "string" },
    },
  }
);

const WalletTransaction =
  mongoose.models.WalletTransaction ||
  mongoose.model("WalletTransaction", WalletTransactionSchema);

export default WalletTransaction;