import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const PaymentMethodSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["stripe"],
      required: function () {
        return this.is_active !== false;
      },
      default: "stripe",
      lowercase: true,
      trim: true,
    },

    provider_customer_id: {
      type: String,
      required: function () {
        return this.is_active !== false;
      },
      default: "",
      trim: true,
    },

    provider_payment_method_id: {
      type: String,
      required: function () {
        return this.is_active !== false;
      },
      default: "",
      trim: true,
    },

    brand: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },

    last4: {
      type: String,
      default: "",
      trim: true,
    },

    exp_month: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },

    exp_year: {
      type: Number,
      default: null,
    },

    funding: {
      type: String,
      default: "",
      trim: true,
    },

    country: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
    },

    is_default: {
      type: Boolean,
      default: false,
    },

    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },

    removed_at: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

const ParkingUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    password: {
      type: String,
      default: null,
      select: false,
    },

    password_setup_token: {
      type: String,
      default: null,
      select: false,
    },

    password_setup_expires: {
      type: Date,
      default: null,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "manager", "customer"],
      default: "customer",
      index: true,
    },

    code: {
      type: String,
      default: null,
      trim: true,
    },

    profile_image_url: {
      type: String,
      default: "",
      trim: true,
    },

    profile_image_public_id: {
      type: String,
      default: "",
      trim: true,
    },

    payment_methods: {
      type: [PaymentMethodSchema],
      default: [],
    },

    stripe_customer_id: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    wallet_balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    wallet_currency: {
      type: String,
      default: "aud",
      lowercase: true,
      trim: true,
    },

    wallet_status: {
      type: String,
      enum: ["active", "frozen", "disabled"],
      default: "active",
      index: true,
    },

    wallet_updated_at: {
      type: Date,
      default: null,
    },

    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(doc, ret) {
        sanitizeUserObject(ret);
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      versionKey: false,
      transform(doc, ret) {
        sanitizeUserObject(ret);
        return ret;
      },
    },
  }
);

function sanitizeUserObject(ret) {
  delete ret.password;
  delete ret.password_setup_token;
  delete ret.password_setup_expires;
  delete ret.__v;

  if (Array.isArray(ret.payment_methods)) {
    ret.payment_methods = ret.payment_methods
      .filter((method) => method && method.is_active !== false)
      .map((method) => {
        delete method.__v;
        return method;
      });
  }
}

function isEmptyPaymentMethod(method) {
  if (!method) return true;

  return (
    !method.provider_customer_id &&
    !method.provider_payment_method_id &&
    !method.last4 &&
    !method.brand
  );
}

ParkingUserSchema.pre("validate", function () {
  if (this.name) {
    this.name = String(this.name).trim();
  }

  if (this.email) {
    this.email = String(this.email).toLowerCase().trim();
  }

  if (this.phone) {
    this.phone = String(this.phone).trim();
  }

  if (this.wallet_currency) {
    this.wallet_currency = String(this.wallet_currency).toLowerCase().trim();
  }

  if (this.stripe_customer_id) {
    this.stripe_customer_id = String(this.stripe_customer_id).trim();
  }

  if (this.profile_image_url) {
    this.profile_image_url = String(this.profile_image_url).trim();
  }

  if (this.profile_image_public_id) {
    this.profile_image_public_id = String(this.profile_image_public_id).trim();
  }

  if (!this.wallet_status) {
    this.wallet_status = "active";
  }

  const walletBalance = Number(this.wallet_balance || 0);

  if (!Number.isFinite(walletBalance) || walletBalance < 0) {
    throw new Error("Invalid wallet balance");
  }

  this.wallet_balance = Number(walletBalance.toFixed(2));

  if (Array.isArray(this.payment_methods)) {
    this.payment_methods.forEach((method) => {
      if (!method) return;

      if (isEmptyPaymentMethod(method)) {
        method.is_active = false;
        method.is_default = false;
        method.removed_at = method.removed_at || new Date();
        return;
      }

      if (method.provider) {
        method.provider = String(method.provider).toLowerCase().trim();
      }

      if (method.provider_customer_id) {
        method.provider_customer_id = String(
          method.provider_customer_id
        ).trim();
      }

      if (method.provider_payment_method_id) {
        method.provider_payment_method_id = String(
          method.provider_payment_method_id
        ).trim();
      }

      if (method.brand) {
        method.brand = String(method.brand).toLowerCase().trim();
      }

      if (method.last4) {
        method.last4 = String(method.last4).trim();
      }

      if (method.country) {
        method.country = String(method.country).toUpperCase().trim();
      }

      if (method.funding) {
        method.funding = String(method.funding).trim();
      }
    });

    const activeMethods = this.payment_methods.filter((method) => {
      return (
        method &&
        method.is_active !== false &&
        method.provider_customer_id &&
        method.provider_payment_method_id
      );
    });

    const defaultMethods = activeMethods.filter(
      (method) => method.is_default === true
    );

    if (defaultMethods.length > 1) {
      let firstDefaultFound = false;

      this.payment_methods.forEach((method) => {
        if (!method || method.is_active === false) return;

        if (method.is_default && !firstDefaultFound) {
          firstDefaultFound = true;
          return;
        }

        method.is_default = false;
      });
    }

    if (activeMethods.length > 0 && defaultMethods.length === 0) {
      activeMethods[0].is_default = true;
    }

    const seenPaymentMethodIds = new Set();

    this.payment_methods.forEach((method) => {
      if (!method || method.is_active === false) return;

      if (!method.provider_customer_id || !method.provider_payment_method_id) {
        method.is_active = false;
        method.is_default = false;
        method.removed_at = method.removed_at || new Date();
        return;
      }

      const duplicateKey = `${method.provider}:${method.provider_payment_method_id}`;

      if (seenPaymentMethodIds.has(duplicateKey)) {
        throw new Error("Duplicate payment method");
      }

      seenPaymentMethodIds.add(duplicateKey);
    });
  }
});

ParkingUserSchema.pre("save", async function () {
  if (this.isModified("password") && this.password) {
    const saltRounds = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, saltRounds);
  }

  if (this.isModified("wallet_balance") || this.isModified("wallet_status")) {
    this.wallet_updated_at = new Date();
  }
});

ParkingUserSchema.methods.comparePassword = async function (plainPassword) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(plainPassword, this.password);
};

ParkingUserSchema.methods.canUseWallet = function () {
  return (
    this.role === "customer" &&
    this.is_active === true &&
    this.wallet_status === "active"
  );
};

ParkingUserSchema.methods.isAdminUser = function () {
  return this.role === "admin";
};

ParkingUserSchema.methods.isManagerUser = function () {
  return this.role === "manager";
};

ParkingUserSchema.methods.canAccessAdmin = function () {
  return ["admin", "manager"].includes(this.role) && this.is_active === true;
};

ParkingUserSchema.methods.getDefaultPaymentMethod = function () {
  if (!Array.isArray(this.payment_methods)) {
    return null;
  }

  return (
    this.payment_methods.find(
      (method) => method.is_active !== false && method.is_default === true
    ) ||
    this.payment_methods.find((method) => method.is_active !== false) ||
    null
  );
};

ParkingUserSchema.methods.addOrUpdateStripePaymentMethod = function ({
  stripeCustomerId,
  paymentMethodId,
  brand,
  last4,
  expMonth,
  expYear,
  funding,
  country,
  makeDefault = false,
}) {
  if (!paymentMethodId) {
    throw new Error("Stripe payment method ID is required");
  }

  if (!stripeCustomerId) {
    throw new Error("Stripe customer ID is required");
  }

  this.stripe_customer_id = stripeCustomerId;

  const existingMethod = this.payment_methods.find((method) => {
    return (
      method.provider === "stripe" &&
      method.provider_payment_method_id === paymentMethodId
    );
  });

  if (makeDefault) {
    this.payment_methods.forEach((method) => {
      method.is_default = false;
    });
  }

  if (existingMethod) {
    existingMethod.provider_customer_id = stripeCustomerId;
    existingMethod.brand = brand || existingMethod.brand;
    existingMethod.last4 = last4 || existingMethod.last4;
    existingMethod.exp_month = expMonth || existingMethod.exp_month;
    existingMethod.exp_year = expYear || existingMethod.exp_year;
    existingMethod.funding = funding || existingMethod.funding;
    existingMethod.country = country || existingMethod.country;
    existingMethod.is_active = true;
    existingMethod.removed_at = null;

    if (makeDefault) {
      existingMethod.is_default = true;
    }

    return existingMethod;
  }

  const hasActiveMethod = this.payment_methods.some(
    (method) => method.is_active !== false
  );

  const newMethod = {
    provider: "stripe",
    provider_customer_id: stripeCustomerId,
    provider_payment_method_id: paymentMethodId,
    brand: brand || "",
    last4: last4 || "",
    exp_month: expMonth || null,
    exp_year: expYear || null,
    funding: funding || "",
    country: country || "",
    is_default: makeDefault || !hasActiveMethod,
    is_active: true,
  };

  this.payment_methods.push(newMethod);

  return this.payment_methods[this.payment_methods.length - 1];
};

ParkingUserSchema.methods.setDefaultPaymentMethod = function (methodId) {
  const method = this.payment_methods.id(String(methodId));

  if (!method || method.is_active === false) {
    throw new Error("Payment method not found");
  }

  this.payment_methods.forEach((item) => {
    item.is_default = false;
  });

  method.is_default = true;

  return method;
};

ParkingUserSchema.methods.removePaymentMethod = function (methodId) {
  const method = this.payment_methods.id(String(methodId));

  if (!method || method.is_active === false) {
    throw new Error("Payment method not found");
  }

  const wasDefault = method.is_default === true;

  method.is_active = false;
  method.is_default = false;
  method.removed_at = new Date();

  if (wasDefault) {
    const nextDefault = this.payment_methods.find(
      (item) => item.is_active !== false && String(item._id) !== String(methodId)
    );

    if (nextDefault) {
      nextDefault.is_default = true;
    }
  }

  return method;
};

ParkingUserSchema.index({ email: 1 }, { unique: true });
ParkingUserSchema.index({ wallet_balance: 1 });
ParkingUserSchema.index({ password_setup_token: 1 });
ParkingUserSchema.index({ "payment_methods.provider_payment_method_id": 1 });

const ParkingUser =
  mongoose.models.ParkingUser ||
  mongoose.model("ParkingUser", ParkingUserSchema);

export default ParkingUser;