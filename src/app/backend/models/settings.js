import mongoose from "mongoose";

const PriceRuleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["cruise", "storage", "airport"],
      required: true,
      index: true,
    },

    label: {
      type: String,
      required: true,
      trim: true,
    },

    min_days: {
      type: Number,
      required: true,
      min: 1,
    },

    max_days: {
      type: Number,
      required: true,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

const ShuttleTimeSlotSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["cruise", "airport"],
      required: true,
      index: true,
    },

    time: {
      type: String,
      required: true,
      trim: true,
    },

    capacity: {
      type: Number,
      required: true,
      min: 0,
      default: 11,
    },

    /**
     * Old/general booked count.
     *
     * Keep this for backward compatibility.
     * For cruise, real remaining should be calculated per direction
     * from Booking collection:
     *
     * - car_park_to_terminal passengers
     * - terminal_to_car_park passengers
     */
    booked_count: {
      type: Number,
      min: 0,
      default: 0,
    },

    /**
     * Cruise only.
     *
     * If true, this shuttle slot appears under:
     * "Car park to terminal Shuttle Options"
     */
    show_car_park_to_terminal: {
      type: Boolean,
      default: true,
    },

    /**
     * Cruise only.
     *
     * If true, this shuttle slot appears under:
     * "Terminal to car park Shuttle Options"
     */
    show_terminal_to_car_park: {
      type: Boolean,
      default: true,
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

/**
 * One editable customer email template.
 *
 * subject = email subject
 * html = admin editable HTML design/code
 * text = plain text fallback
 * is_active = whether this template should be used
 */
const EmailTemplateSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    html: {
      type: String,
      default: "",
      maxlength: 200000,
    },

    text: {
      type: String,
      default: "",
      maxlength: 50000,
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  }
);

/**
 * Customer templates for one booking type.
 *
 * Example:
 * cruise.booking_confirmation
 * cruise.cancellation
 * cruise.refund
 * cruise.credit
 * cruise.reminder
 * cruise.feedback
 */
const CustomerEmailTemplateGroupSchema = new mongoose.Schema(
  {
    booking_confirmation: {
      type: EmailTemplateSchema,
      default: () => ({}),
    },

    cancellation: {
      type: EmailTemplateSchema,
      default: () => ({}),
    },

    refund: {
      type: EmailTemplateSchema,
      default: () => ({}),
    },

    credit: {
      type: EmailTemplateSchema,
      default: () => ({}),
    },

    reminder: {
      type: EmailTemplateSchema,
      default: () => ({}),
    },

    feedback: {
      type: EmailTemplateSchema,
      default: () => ({}),
    },
  },
  {
    _id: false,
  }
);

/**
 * Customer email templates by booking type.
 *
 * Total templates:
 * cruise  -> booking_confirmation, cancellation, refund, credit, reminder, feedback
 * airport -> booking_confirmation, cancellation, refund, credit, reminder, feedback
 * storage -> booking_confirmation, cancellation, refund, credit, reminder, feedback
 */
const CustomerEmailTemplatesSchema = new mongoose.Schema(
  {
    cruise: {
      type: CustomerEmailTemplateGroupSchema,
      default: () => ({}),
    },

    airport: {
      type: CustomerEmailTemplateGroupSchema,
      default: () => ({}),
    },

    storage: {
      type: CustomerEmailTemplateGroupSchema,
      default: () => ({}),
    },
  },
  {
    _id: false,
  }
);

PriceRuleSchema.pre("validate", function () {
  if (this.max_days < this.min_days) {
    throw new Error("Max days cannot be less than min days");
  }
});

ShuttleTimeSlotSchema.pre("validate", function () {
  if (this.booked_count > this.capacity) {
    throw new Error("Booked count cannot be greater than capacity");
  }

  if (this.type === "cruise") {
    const showCarParkToTerminal = this.show_car_park_to_terminal !== false;
    const showTerminalToCarPark = this.show_terminal_to_car_park !== false;

    if (!showCarParkToTerminal && !showTerminalToCarPark) {
      throw new Error("Cruise shuttle slot must show on at least one direction");
    }
  }
});

const SettingSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: "global_config",
    },

    /**
     * General Settings
     *
     * Pay on Arrival holding deposit amount.
     * Admin can manage this from Admin Settings -> General.
     *
     * Used by:
     * - POA Stripe deposit
     * - POA PayPal deposit
     * - POA Wallet deposit
     */
    holding_deposit_amount: {
      type: Number,
      default: 20,
      min: 0,
    },

    /**
     * General Settings
     *
     * Admin action fee amount.
     * Admin can manage this from Admin Settings -> General.
     *
     * Used by:
     * - Cancellation with fee
     * - Refund with fee
     * - Credit with fee
     */
    cancellation_fee: {
      type: Number,
      default: 20,
      min: 0,
    },

    currency: {
      type: String,
      default: "AUD",
      uppercase: true,
      trim: true,
    },

    payment_methods: {
      type: [String],
      default: ["stripe", "paypal", "poa", "wallet"],
    },

    email_notifications: {
      type: Boolean,
      default: true,
    },

    sms_notifications: {
      type: Boolean,
      default: false,
    },

    default_shuttle_slot_capacity: {
      type: Number,
      default: 11,
      min: 0,
    },

    email_templates: {
      customer: {
        type: CustomerEmailTemplatesSchema,
        default: () => ({}),
      },
    },

    price_rules: {
      type: [PriceRuleSchema],
      default: [],
    },

    shuttle_time_slots: {
      type: [ShuttleTimeSlotSchema],
      default: [],
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: true,
    },
  }
);

SettingSchema.pre("validate", function () {
  if (this.holding_deposit_amount === undefined || this.holding_deposit_amount === null) {
    this.holding_deposit_amount = 20;
  }

  if (this.cancellation_fee === undefined || this.cancellation_fee === null) {
    this.cancellation_fee = 20;
  }

  if (Number(this.holding_deposit_amount) < 0) {
    throw new Error("Holding deposit amount cannot be negative");
  }

  if (Number(this.cancellation_fee) < 0) {
    throw new Error("Cancellation fee cannot be negative");
  }
});

SettingSchema.index({
  "price_rules.type": 1,
  "price_rules.min_days": 1,
  "price_rules.max_days": 1,
  "price_rules.is_active": 1,
});

SettingSchema.index({
  "shuttle_time_slots.type": 1,
  "shuttle_time_slots.time": 1,
  "shuttle_time_slots.is_active": 1,
});

SettingSchema.index({
  "shuttle_time_slots.type": 1,
  "shuttle_time_slots.show_car_park_to_terminal": 1,
  "shuttle_time_slots.show_terminal_to_car_park": 1,
  "shuttle_time_slots.is_active": 1,
});

SettingSchema.index({
  holding_deposit_amount: 1,
  cancellation_fee: 1,
});

const Setting =
  mongoose.models.Setting || mongoose.model("Setting", SettingSchema);

export default Setting;