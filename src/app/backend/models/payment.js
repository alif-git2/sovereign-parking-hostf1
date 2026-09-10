import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    /**
     * Required for booking payments.
     * Optional for wallet top-ups.
     */
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: undefined,
      index: true,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingUser",
      required: true,
      index: true,
    },

    /**
     * For wallet top-up payments, link to WalletTransaction.
     */
    wallet_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: undefined,
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

    method: {
      type: String,
      enum: ["stripe", "paypal", "poa", "wallet"],
      required: true,
      lowercase: true,
      trim: true,
    },

    payment_flow: {
      type: String,
      enum: ["full_online", "poa_deposit", "legacy_poa", "wallet", "wallet_topup"],
      default: undefined,
    },

    deposit_type: {
      type: String,
      enum: ["full", "partial", "poa"],
      default: undefined,
    },

    payment_purpose: {
      type: String,
      enum: [
        "full_online_payment",
        "poa_holding_deposit",
        "pay_on_arrival",
        "wallet_payment",
        "wallet_topup",
        "refund",
      ],
      default: "full_online_payment",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "success",
        "failed",
        "refunded",
        "partially_refunded",
        "cancelled",
      ],
      default: "pending",
    },

    /**
     * General transaction ID.
     *
     * Stripe:
     * - PaymentIntent ID
     *
     * PayPal:
     * - capture ID preferred
     * - order ID fallback
     *
     * Wallet:
     * - wallet transaction reference if needed
     */
    transaction_id: {
      type: String,
      trim: true,
      default: undefined,
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
     * Stripe/PayPal refund ID.
     */
    provider_refund_id: {
      type: String,
      trim: true,
      default: undefined,
    },

    booking_total_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    holding_deposit_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance_due_on_arrival: {
      type: Number,
      default: 0,
      min: 0,
    },

    wallet_balance_before: {
      type: Number,
      default: 0,
      min: 0,
    },

    wallet_balance_after: {
      type: Number,
      default: 0,
      min: 0,
    },

    fee_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refund_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    failure_reason: {
      type: String,
      trim: true,
      default: undefined,
    },

    paid_at: {
      type: Date,
      default: null,
    },

    refunded_at: {
      type: Date,
      default: null,
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

PaymentSchema.pre("validate", function () {
  if (this.currency) {
    this.currency = String(this.currency).toLowerCase().trim();
  }

  if (this.method) {
    this.method = String(this.method).toLowerCase().trim();
  }

  /**
   * Do not store null in unique indexed provider fields.
   */
  unsetIfEmpty(this, "transaction_id");
  unsetIfEmpty(this, "provider_payment_id");
  unsetIfEmpty(this, "provider_order_id");
  unsetIfEmpty(this, "provider_capture_id");
  unsetIfEmpty(this, "provider_refund_id");
  unsetIfEmpty(this, "failure_reason");

  const amount = Number(this.amount || 0);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid payment amount");
  }

  const bookingTotalAmount = Number(this.booking_total_amount || 0);
  const holdingDepositAmount = Number(this.holding_deposit_amount || 0);
  const balanceDueOnArrival = Number(this.balance_due_on_arrival || 0);
  const walletBalanceBefore = Number(this.wallet_balance_before || 0);
  const walletBalanceAfter = Number(this.wallet_balance_after || 0);
  const feeAmount = Number(this.fee_amount || 0);
  const refundAmount = Number(this.refund_amount || 0);

  if (!Number.isFinite(bookingTotalAmount) || bookingTotalAmount < 0) {
    throw new Error("Invalid booking total amount");
  }

  if (!Number.isFinite(holdingDepositAmount) || holdingDepositAmount < 0) {
    throw new Error("Invalid holding deposit amount");
  }

  if (!Number.isFinite(balanceDueOnArrival) || balanceDueOnArrival < 0) {
    throw new Error("Invalid balance due on arrival");
  }

  if (!Number.isFinite(walletBalanceBefore) || walletBalanceBefore < 0) {
    throw new Error("Invalid wallet balance before payment");
  }

  if (!Number.isFinite(walletBalanceAfter) || walletBalanceAfter < 0) {
    throw new Error("Invalid wallet balance after payment");
  }

  if (!Number.isFinite(feeAmount) || feeAmount < 0) {
    throw new Error("Invalid fee amount");
  }

  if (!Number.isFinite(refundAmount) || refundAmount < 0) {
    throw new Error("Invalid refund amount");
  }

  if (this.status === "success") {
    this.status = "paid";
  }

  /**
   * Auto-fill payment purpose.
   */
  if (!this.payment_purpose) {
    if (this.payment_flow === "poa_deposit") {
      this.payment_purpose = "poa_holding_deposit";
    } else if (this.payment_flow === "wallet_topup") {
      this.payment_purpose = "wallet_topup";
    } else if (this.method === "poa") {
      this.payment_purpose = "pay_on_arrival";
    } else if (this.method === "wallet") {
      this.payment_purpose = "wallet_payment";
    } else {
      this.payment_purpose = "full_online_payment";
    }
  }

  /**
   * Booking payments must have booking_id.
   * Wallet top-ups do not need booking_id.
   */
  const bookingPaymentPurposes = [
    "full_online_payment",
    "poa_holding_deposit",
    "pay_on_arrival",
    "wallet_payment",
  ];

  if (bookingPaymentPurposes.includes(this.payment_purpose) && !this.booking_id) {
    throw new Error("Booking ID is required for booking payment records");
  }

  if (this.payment_purpose === "wallet_topup" && !this.wallet_transaction_id) {
    throw new Error("Wallet transaction ID is required for wallet top-up payments");
  }

  /**
   * Keep transaction_id filled for old admin/payment code.
   */
  if (!this.transaction_id) {
    this.transaction_id =
      this.provider_capture_id ||
      this.provider_payment_id ||
      this.provider_order_id ||
      this.provider_refund_id ||
      undefined;
  }

  if (this.status === "paid" && !this.paid_at) {
    this.paid_at = new Date();
  }

  if (
    ["refunded", "partially_refunded"].includes(this.status) &&
    !this.refunded_at
  ) {
    this.refunded_at = new Date();
  }
});

// Normal indexes
PaymentSchema.index({ booking_id: 1, method: 1 });
PaymentSchema.index({ booking_id: 1, status: 1 });
PaymentSchema.index({ booking_id: 1, payment_purpose: 1 });
PaymentSchema.index({ user_id: 1, status: 1 });
PaymentSchema.index({ user_id: 1, payment_purpose: 1 });
PaymentSchema.index({ wallet_transaction_id: 1 });
PaymentSchema.index({ method: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ payment_flow: 1 });
PaymentSchema.index({ payment_purpose: 1 });
PaymentSchema.index({ createdAt: -1 });

/**
 * Unique indexes only apply when the field exists as a string.
 */
PaymentSchema.index(
  { transaction_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transaction_id: { $type: "string" },
    },
  }
);

PaymentSchema.index(
  { provider_payment_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider_payment_id: { $type: "string" },
    },
  }
);

PaymentSchema.index(
  { provider_order_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider_order_id: { $type: "string" },
    },
  }
);

PaymentSchema.index(
  { provider_capture_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider_capture_id: { $type: "string" },
    },
  }
);

PaymentSchema.index(
  { provider_refund_id: 1 },
  {
    partialFilterExpression: {
      provider_refund_id: { $type: "string" },
    },
  }
);

const Payment =
  mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);

export default Payment;