import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    discount_type: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },

    discount_value: {
      type: Number,
      required: true,
      min: 0,
    },

    // Optional maximum discount for percentage coupons
    // Example: 20% off but maximum discount AUD 50
    max_discount_amount: {
      type: Number,
      default: null,
      min: 0,
    },

    // Minimum booking price required to use this coupon
    min_booking_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Which booking types this coupon works for
    // Empty array means it works for all booking types
    applies_to: [
      {
        type: String,
        enum: ["cruise", "storage", "airport"],
      },
    ],

    // Date range for when the coupon can be used
    valid_from: {
      type: Date,
      required: true,
    },

    valid_to: {
      type: Date,
      required: true,
    },

    // 0 means unlimited usage
    usage_limit: {
      type: Number,
      default: 0,
      min: 0,
    },

    used_count: {
      type: Number,
      default: 0,
      min: 0,
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: true,
    },
  }
);

// Indexes
CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ is_active: 1 });
CouponSchema.index({ valid_from: 1, valid_to: 1 });
CouponSchema.index({ applies_to: 1 });

// Validation
CouponSchema.pre("validate", function () {
  if (this.valid_from && this.valid_to) {
    const validFrom = new Date(this.valid_from);
    const validTo = new Date(this.valid_to);

    if (validTo <= validFrom) {
      throw new Error("Coupon valid_to date must be after valid_from date");
    }
  }

  if (this.discount_type === "percentage") {
    if (this.discount_value <= 0 || this.discount_value > 100) {
      throw new Error("Percentage discount must be between 1 and 100");
    }
  }

  if (this.discount_type === "fixed") {
    if (this.discount_value <= 0) {
      throw new Error("Fixed discount must be greater than 0");
    }
  }

  if (
    this.usage_limit > 0 &&
    this.used_count > this.usage_limit
  ) {
    throw new Error("Used count cannot be greater than usage limit");
  }
});

const Coupon =
  mongoose.models.Coupon || mongoose.model("Coupon", CouponSchema);

export default Coupon;