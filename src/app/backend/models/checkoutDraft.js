import mongoose from "mongoose";

const CHECKOUT_DRAFT_STATUSES = [
  "draft",
  "payment_ready",
  "payment_processing",
  "paid",
  "completed",
  "failed",
  "cancelled",
  "expired",
];

const PAYMENT_PROVIDERS = ["stripe", "paypal"];

const PAYMENT_FLOWS = ["full_online", "poa_deposit"];

const DEPOSIT_TYPES = ["full", "poa"];

const ADD_ON_VEHICLE_DISCOUNT_PERCENT = 10;

function makeDraftReference() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `CD${timestamp}${random}`;
}

function normalizeMoney(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Number(number.toFixed(2));
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePercent(value, fallback = 0) {
  const number = Number(value ?? fallback);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(Number(number.toFixed(2)), 100);
}

const CheckoutDraftSchema = new mongoose.Schema(
  {
    draft_reference: {
      type: String,
      unique: true,
      index: true,
      trim: true,
      default: makeDraftReference,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingUser",
      default: null,
      index: true,
    },

    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: true,
    },

    booking_public_id: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["cruise", "storage", "airport"],
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: CHECKOUT_DRAFT_STATUSES,
      default: "draft",
      index: true,
    },

    payment_provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    payment_method: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
      lowercase: true,
      trim: true,
    },

    payment_flow: {
      type: String,
      enum: PAYMENT_FLOWS,
      required: true,
      index: true,
    },

    deposit_type: {
      type: String,
      enum: DEPOSIT_TYPES,
      required: true,
    },

    currency: {
      type: String,
      default: "aud",
      lowercase: true,
      trim: true,
    },

    booking_payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },

    pricing_snapshot: {
      price: {
        type: Number,
        default: 0,
        min: 0,
      },

      amount_due_now: {
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

      coupon_code: {
        type: String,
        default: "",
        trim: true,
      },

      discount_amount: {
        type: Number,
        default: 0,
        min: 0,
      },

      add_on_vehicle: {
        enabled: {
          type: Boolean,
          default: false,
        },

        type: {
          type: String,
          default: "",
          trim: true,
        },

        license_plate: {
          type: String,
          default: "",
          trim: true,
        },

        discount_percent: {
          type: Number,
          default: ADD_ON_VEHICLE_DISCOUNT_PERCENT,
          min: 0,
          max: 100,
        },

        original_price: {
          type: Number,
          default: 0,
          min: 0,
        },

        discount_amount: {
          type: Number,
          default: 0,
          min: 0,
        },

        price: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    },

    customer_snapshot: {
      first_name: {
        type: String,
        default: "",
        trim: true,
      },

      last_name: {
        type: String,
        default: "",
        trim: true,
      },

      email: {
        type: String,
        default: "",
        lowercase: true,
        trim: true,
      },

      phone: {
        type: String,
        default: "",
        trim: true,
      },
    },

    stripe_payment_intent_id: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    paypal_order_id: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    provider_payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    payment_error: {
      type: String,
      default: "",
      trim: true,
    },

    locked_at: {
      type: Date,
      default: null,
    },

    payment_started_at: {
      type: Date,
      default: null,
    },

    paid_at: {
      type: Date,
      default: null,
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

    expires_at: {
      type: Date,
      default: () => new Date(Date.now() + 1000 * 60 * 60 * 24),
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

CheckoutDraftSchema.pre("validate", function () {
  if (!this.draft_reference) {
    this.draft_reference = makeDraftReference();
  }

  if (this.payment_provider) {
    this.payment_provider = String(this.payment_provider).toLowerCase().trim();
  }

  if (this.payment_method) {
    this.payment_method = String(this.payment_method).toLowerCase().trim();
  }

  if (!this.payment_method && this.payment_provider) {
    this.payment_method = this.payment_provider;
  }

  if (this.currency) {
    this.currency = String(this.currency).toLowerCase().trim();
  }

  if (this.customer_snapshot?.email) {
    this.customer_snapshot.email = String(
      this.customer_snapshot.email
    ).toLowerCase().trim();
  }

  if (!this.pricing_snapshot) {
    this.pricing_snapshot = {};
  }

  this.pricing_snapshot.price = normalizeMoney(this.pricing_snapshot.price);

  this.pricing_snapshot.amount_due_now = normalizeMoney(
    this.pricing_snapshot.amount_due_now
  );

  this.pricing_snapshot.holding_deposit_amount = normalizeMoney(
    this.pricing_snapshot.holding_deposit_amount
  );

  this.pricing_snapshot.balance_due_on_arrival = normalizeMoney(
    this.pricing_snapshot.balance_due_on_arrival
  );

  this.pricing_snapshot.discount_amount = normalizeMoney(
    this.pricing_snapshot.discount_amount
  );

  if (!this.pricing_snapshot.add_on_vehicle) {
    this.pricing_snapshot.add_on_vehicle = {};
  }

  const addOnVehicle = this.pricing_snapshot.add_on_vehicle;
  const addOnEnabled = Boolean(addOnVehicle.enabled);

  addOnVehicle.enabled = addOnEnabled;

  if (addOnEnabled) {
    addOnVehicle.type = normalizeText(addOnVehicle.type);
    addOnVehicle.license_plate = normalizeText(addOnVehicle.license_plate);

    if (!addOnVehicle.type) {
      throw new Error("Add-on vehicle type is required");
    }

    if (!addOnVehicle.license_plate) {
      throw new Error("Add-on vehicle license plate is required");
    }

    addOnVehicle.discount_percent = normalizePercent(
      addOnVehicle.discount_percent,
      ADD_ON_VEHICLE_DISCOUNT_PERCENT
    );

    addOnVehicle.original_price = normalizeMoney(addOnVehicle.original_price);
    addOnVehicle.discount_amount = normalizeMoney(addOnVehicle.discount_amount);
    addOnVehicle.price = normalizeMoney(addOnVehicle.price);

    if (addOnVehicle.discount_amount > addOnVehicle.original_price) {
      throw new Error(
        "Add-on vehicle discount cannot be greater than add-on vehicle original price"
      );
    }

    if (addOnVehicle.price > addOnVehicle.original_price) {
      throw new Error(
        "Add-on vehicle price cannot be greater than add-on vehicle original price"
      );
    }
  } else {
    addOnVehicle.type = "";
    addOnVehicle.license_plate = "";
    addOnVehicle.discount_percent = 0;
    addOnVehicle.original_price = 0;
    addOnVehicle.discount_amount = 0;
    addOnVehicle.price = 0;
  }

  if (!this.expires_at) {
    this.expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24);
  }
});

CheckoutDraftSchema.methods.isExpired = function () {
  return this.expires_at && new Date(this.expires_at).getTime() <= Date.now();
};

CheckoutDraftSchema.methods.canStartPayment = function () {
  return (
    !this.isExpired() &&
    ["draft", "payment_ready", "payment_processing"].includes(this.status)
  );
};

CheckoutDraftSchema.methods.markPaymentReady = function ({
  providerPayload = null,
  stripePaymentIntentId = "",
  paypalOrderId = "",
} = {}) {
  this.status = "payment_ready";
  this.payment_started_at = this.payment_started_at || new Date();

  if (providerPayload) {
    this.provider_payload = providerPayload;
  }

  if (stripePaymentIntentId) {
    this.stripe_payment_intent_id = stripePaymentIntentId;
  }

  if (paypalOrderId) {
    this.paypal_order_id = paypalOrderId;
  }

  return this;
};

CheckoutDraftSchema.methods.markPaymentProcessing = function () {
  if (!["completed", "paid"].includes(this.status)) {
    this.status = "payment_processing";
  }

  this.payment_started_at = this.payment_started_at || new Date();

  return this;
};

CheckoutDraftSchema.methods.markPaid = function ({ providerPayload = null } = {}) {
  this.status = "paid";
  this.paid_at = this.paid_at || new Date();
  this.payment_error = "";

  if (providerPayload) {
    this.provider_payload = providerPayload;
  }

  return this;
};

CheckoutDraftSchema.methods.markCompleted = function ({
  bookingId,
  bookingPublicId = "",
} = {}) {
  this.status = "completed";
  this.completed_at = this.completed_at || new Date();

  if (bookingId) {
    this.booking_id = bookingId;
  }

  if (bookingPublicId) {
    this.booking_public_id = bookingPublicId;
  }

  return this;
};

CheckoutDraftSchema.methods.markFailed = function ({
  reason = "",
  providerPayload = null,
} = {}) {
  if (!["completed", "paid"].includes(this.status)) {
    this.status = "failed";
  }

  this.failed_at = this.failed_at || new Date();
  this.payment_error = reason || "Payment failed";

  if (providerPayload) {
    this.provider_payload = providerPayload;
  }

  return this;
};

CheckoutDraftSchema.methods.markCancelled = function ({
  reason = "",
  providerPayload = null,
} = {}) {
  if (!["completed", "paid"].includes(this.status)) {
    this.status = "cancelled";
  }

  this.cancelled_at = this.cancelled_at || new Date();
  this.payment_error = reason || "Payment cancelled";

  if (providerPayload) {
    this.provider_payload = providerPayload;
  }

  return this;
};

CheckoutDraftSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
CheckoutDraftSchema.index({ status: 1, payment_provider: 1 });
CheckoutDraftSchema.index({ type: 1, status: 1 });
CheckoutDraftSchema.index({ user_id: 1, status: 1, createdAt: -1 });
CheckoutDraftSchema.index({ stripe_payment_intent_id: 1, status: 1 });
CheckoutDraftSchema.index({ paypal_order_id: 1, status: 1 });

CheckoutDraftSchema.index({ "pricing_snapshot.add_on_vehicle.enabled": 1 });
CheckoutDraftSchema.index({ "pricing_snapshot.add_on_vehicle.type": 1 });
CheckoutDraftSchema.index({
  "pricing_snapshot.add_on_vehicle.license_plate": 1,
});
CheckoutDraftSchema.index({ "booking_payload.add_on_vehicle_enabled": 1 });
CheckoutDraftSchema.index({ "booking_payload.add_on_vehicle_type": 1 });
CheckoutDraftSchema.index({
  "booking_payload.add_on_vehicle_license_plate": 1,
});

const CheckoutDraft =
  mongoose.models.CheckoutDraft ||
  mongoose.model("CheckoutDraft", CheckoutDraftSchema);

export default CheckoutDraft;
