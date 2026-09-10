import mongoose from "mongoose";

const BOOKING_STATUS_VALUES = [
  "pending",
  "pending_payment",
  "success",
  "confirmed",
  "cancelled",
  "cancellation_requested",

  // Legacy/admin-action status values.
  // Keep these for old records/backward compatibility.
  "refund",
  "refunded",
  "credit",
  "credited",

  "poa",
];

const FINAL_ADMIN_BOOKING_STATUSES = [
  "cancelled",
  "refund",
  "refunded",
  "credit",
  "credited",
];

const PROTECTED_BOOKING_STATUSES = [
  "cancelled",
  "cancellation_requested",
  "refund",
  "refunded",
  "credit",
  "credited",
  "poa",
];

const PROTECTED_PAYMENT_STATUSES = [
  "failed",
  "refunded",
  "partially_refunded",
];

const ADMIN_ACTION_TYPES = ["refund", "credit", "cancel"];

const BookingSchema = new mongoose.Schema(
  {
    booking_id: {
      type: String,
      required: true,
      trim: true,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingUser",
      required: true,
    },

    location_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },

    schedule_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CruiseSchedule",
      default: null,
    },

    type: {
      type: String,
      enum: ["cruise", "storage", "airport"],
      required: true,
    },

    start_date: {
      type: Date,
      required: true,
    },

    end_date: {
      type: Date,
      required: true,
    },

    pax: {
      type: Number,
      default: 1,
      min: 0,
    },

    license_plate: {
      type: String,
      trim: true,
    },

    /**
     * Optional add-on vehicle for cruise bookings.
     * The customer can add a second vehicle with a discounted parking price.
     */
    add_on_vehicle_enabled: {
      type: Boolean,
      default: false,
    },

    add_on_vehicle_type: {
      type: String,
      trim: true,
      default: "",
    },

    add_on_vehicle_license_plate: {
      type: String,
      trim: true,
      default: "",
    },

    add_on_vehicle_discount_percent: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },

    add_on_vehicle_original_price: {
      type: Number,
      default: 0,
      min: 0,
    },

    add_on_vehicle_discount_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    add_on_vehicle_price: {
      type: Number,
      default: 0,
      min: 0,
    },

    interlock: {
      type: Boolean,
      default: false,
    },

    reference: {
      type: String,
      trim: true,
    },

    /**
     * Original/general notes.
     * Keep this separate from admin edit notes.
     */
    notes: {
      type: String,
      trim: true,
      default: "",
    },

    /**
     * Separate admin note field used from admin booking edit popup.
     * This should not overwrite customer/general notes.
     */
    new_admin_note: {
      type: String,
      trim: true,
      default: "",
    },

    admin_image: {
      url: {
        type: String,
        trim: true,
        default: "",
      },

      provider: {
        type: String,
        trim: true,
        default: "",
      },

      public_id: {
        type: String,
        trim: true,
        default: "",
      },

      original_name: {
        type: String,
        trim: true,
        default: "",
      },

      uploaded_at: {
        type: Date,
        default: null,
      },
    },

    /**
     * Multiple admin-uploaded booking images.
     * admin_image above is kept only for backward compatibility with any
     * booking that received a single image before multiple-image support.
     */
    admin_images: [
      {
        image_id: {
          type: String,
          trim: true,
          default: "",
        },

        url: {
          type: String,
          trim: true,
          required: true,
        },

        provider: {
          type: String,
          trim: true,
          default: "",
        },

        public_id: {
          type: String,
          trim: true,
          default: "",
        },

        original_name: {
          type: String,
          trim: true,
          default: "",
        },

        uploaded_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    cancellation_request: {
      requested: {
        type: Boolean,
        default: false,
      },

      reason: {
        type: String,
        default: null,
        trim: true,
        maxlength: 2000,
      },

      requested_at: {
        type: Date,
        default: null,
      },

      requested_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ParkingUser",
        default: null,
      },

      customer_name: {
        type: String,
        default: null,
        trim: true,
      },

      customer_email: {
        type: String,
        default: null,
        lowercase: true,
        trim: true,
      },

      admin_reviewed: {
        type: Boolean,
        default: false,
      },

      admin_reviewed_at: {
        type: Date,
        default: null,
      },

      admin_reviewed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ParkingUser",
        default: null,
      },

      admin_note: {
        type: String,
        default: null,
        trim: true,
        maxlength: 2000,
      },
    },

    details: {
      pricing: {
        price_rule_id: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },

        type: {
          type: String,
          trim: true,
        },

        label: {
          type: String,
          trim: true,
        },

        min_days: {
          type: Number,
          default: 0,
          min: 0,
        },

        max_days: {
          type: Number,
          default: 0,
          min: 0,
        },

        price: {
          type: Number,
          default: 0,
          min: 0,
        },

        calculated_days: {
          type: Number,
          default: 0,
          min: 0,
        },

        parking_price: {
          type: Number,
          default: 0,
          min: 0,
        },

        included_shuttle_passengers: {
          type: Number,
          default: 4,
          min: 0,
        },

        extra_passenger_unit_fee: {
          type: Number,
          default: 5,
          min: 0,
        },

        extra_passenger_count: {
          type: Number,
          default: 0,
          min: 0,
        },

        extra_passenger_fee: {
          type: Number,
          default: 0,
          min: 0,
        },

        add_on_vehicle_original_price: {
          type: Number,
          default: 0,
          min: 0,
        },

        add_on_vehicle_discount_percent: {
          type: Number,
          default: 10,
          min: 0,
          max: 100,
        },

        add_on_vehicle_discount_amount: {
          type: Number,
          default: 0,
          min: 0,
        },

        add_on_vehicle_price: {
          type: Number,
          default: 0,
          min: 0,
        },

        total_before_discount: {
          type: Number,
          default: 0,
          min: 0,
        },
      },

      cruise: {
        ship_name: {
          type: String,
          trim: true,
        },

        /**
         * Legacy/general shuttle fields.
         * Kept for old records and old email/admin logic.
         * For new cruise bookings, this represents car park to terminal shuttle.
         */
        shuttle_time: {
          type: String,
          trim: true,
        },

        shuttle_slot_id: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },

        parking_slot: {
          type: String,
          trim: true,
        },

        /**
         * Legacy/general passenger count.
         * For new cruise bookings this stores the maximum passenger count
         * between both shuttle directions.
         */
        pickup_pax: {
          type: Number,
          default: 1,
          min: 0,
        },

        /**
         * Separate admin-only/admin-edit field.
         * Do not use this as the normal passenger count.
         */
        pickup_pax_pro: {
          type: Number,
          default: 0,
          min: 0,
        },

        /**
         * New cruise shuttle direction:
         * Car park to terminal.
         */
        car_park_to_terminal_passengers: {
          type: Number,
          default: 0,
          min: 0,
        },

        car_park_to_terminal_shuttle_time: {
          type: String,
          trim: true,
        },

        car_park_to_terminal_shuttle_slot_id: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },

        /**
         * New cruise shuttle direction:
         * Terminal to car park.
         */
        terminal_to_car_park_passengers: {
          type: Number,
          default: 0,
          min: 0,
        },

        terminal_to_car_park_shuttle_time: {
          type: String,
          trim: true,
        },

        terminal_to_car_park_shuttle_slot_id: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },

        /**
         * Extra passenger charge:
         * First 4 passengers are included per direction.
         * Each extra passenger is charged by backend booking service.
         */
        extra_passenger_count: {
          type: Number,
          default: 0,
          min: 0,
        },

        extra_passenger_fee: {
          type: Number,
          default: 0,
          min: 0,
        },

        /**
         * Add-on vehicle selected by the customer.
         * Example: SUV License Plate* with 10% discounted add-on parking price.
         */
        add_on_vehicle: {
          enabled: {
            type: Boolean,
            default: false,
          },

          type: {
            type: String,
            trim: true,
            default: "",
          },

          license_plate: {
            type: String,
            trim: true,
            default: "",
          },

          discount_percent: {
            type: Number,
            default: 10,
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

      storage: {
        storage_type_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "StorageType",
          default: null,
        },

        storage_type_name: {
          type: String,
          trim: true,
        },

        // Backward-compatible alias used by some admin/email logic.
        storage_type: {
          type: String,
          trim: true,
        },
      },

      airport: {
        shuttle_time: {
          type: String,
          trim: true,
        },

        shuttle_slot_id: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },

        parking_slot: {
          type: String,
          trim: true,
        },

        pickup_pax: {
          type: Number,
          default: 1,
          min: 0,
        },

        flight_number: {
          type: String,
          trim: true,
        },

        terminal: {
          type: String,
          trim: true,
        },
      },
    },

    customer: {
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
    },

    pricing_type: {
      type: String,
      enum: ["daily", "hourly", "fixed"],
      default: "daily",
    },

    currency: {
      type: String,
      default: "aud",
      lowercase: true,
      trim: true,
    },

    original_price: {
      type: Number,
      default: 0,
      min: 0,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discount_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    coupon_code: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    coupon_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },

    paid_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    due_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Amount paid from customer wallet.
     * Informational only. paid_amount is the source of truth for total paid.
     */
    wallet_used: {
      type: Number,
      default: 0,
      min: 0,
    },

    refund_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    credit_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    fee_deducted: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Admin action tracking.
     *
     * Display can use:
     * - admin_action_type = refund => show Refunded
     * - admin_action_type = credit => show Credited
     * - admin_action_type = cancel => show Cancelled
     */
    admin_action_type: {
      type: String,
      enum: [...ADMIN_ACTION_TYPES, null],
      default: null,
    },

    admin_action_label: {
      type: String,
      default: null,
      trim: true,
    },

    admin_action_return_method: {
      type: String,
      default: null,
      trim: true,
    },

    admin_action_paid_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    admin_action_fee_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    admin_action_return_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    admin_action_at: {
      type: Date,
      default: null,
    },

    admin_action_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingUser",
      default: null,
    },

    cancelled_at: {
      type: Date,
      default: null,
    },

    /**
     * Payment flow:
     *
     * full_online:
     * - Stripe full payment
     * - PayPal full payment
     * - Wallet full payment
     *
     * poa_deposit:
     * - Stripe holding deposit
     * - PayPal holding deposit
     * - Wallet holding deposit for logged-in customers
     * - Remaining balance paid on arrival
     */
    payment_flow: {
      type: String,
      enum: ["full_online", "poa_deposit"],
      default: undefined,
    },

    deposit_type: {
      type: String,
      enum: ["full", "partial", "poa"],
      default: undefined,
    },

    payment_method: {
      type: String,
      enum: ["stripe", "paypal", "poa", "wallet", "credit_card_manual"],
      default: undefined,
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

    payment_status: {
      type: String,
      enum: [
        "unpaid",
        "paid",
        "pending",
        "partial",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      default: "pending",
    },

    stripe_payment_intent_id: {
      type: String,
      trim: true,
      default: null,
    },

    paypal_order_id: {
      type: String,
      trim: true,
      default: null,
    },

    paypal_capture_id: {
      type: String,
      trim: true,
      default: null,
    },

    payment_completed_at: {
      type: Date,
      default: null,
    },

    payment_failed_at: {
      type: Date,
      default: null,
    },

    payment_failure_reason: {
      type: String,
      trim: true,
      default: null,
    },

    status: {
      type: String,
      enum: BOOKING_STATUS_VALUES,
      default: "pending",
      index: true,
    },

    parking_slot: {
      type: String,
      trim: true,
    },

    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingUser",
      default: null,
    },

    last_email_sent_at: {
      type: Date,
      default: null,
    },

    email_sent_count: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Automatic scheduled customer emails.
     * Used by reminder and feedback cron jobs.
     *
     * The *_processing_at fields act as short-lived processing locks.
     * The scheduled email worker claims a booking before sending so two
     * overlapping cron executions cannot normally send the same email twice.
     * If a worker crashes, the email utility can treat an old processing
     * timestamp as stale and safely retry later.
     */
    reminder_email_sent_at: {
      type: Date,
      default: null,
    },

    reminder_email_processing_at: {
      type: Date,
      default: null,
    },

    feedback_email_sent_at: {
      type: Date,
      default: null,
    },

    feedback_email_processing_at: {
      type: Date,
      default: null,
    },

    wallet_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
    },

    status_history: [
      {
        status: {
          type: String,
          enum: BOOKING_STATUS_VALUES,
          trim: true,
        },

        note: {
          type: String,
          trim: true,
        },

        changed_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ParkingUser",
          default: null,
        },

        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    source: {
      type: String,
      enum: [
        "web",
        "admin",
        "google",
        "facebook",
        "instagram",
        "friend",
        "returning_customer",
        "other",
      ],
      default: "web",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

BookingSchema.virtual("booking_type")
  .get(function () {
    return this.type;
  })
  .set(function (value) {
    this.type = value;
  });

BookingSchema.virtual("total_amount")
  .get(function () {
    return this.price;
  })
  .set(function (value) {
    this.price = value;
  });

function toMoneyNumber(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
}

function toCountNumber(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}

function isFinalAdminBookingStatus(status) {
  return FINAL_ADMIN_BOOKING_STATUSES.includes(status);
}

function normalizeEmail(value) {
  if (!value) return value;

  return String(value).toLowerCase().trim();
}

function normalizeOptionalText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

BookingSchema.pre("validate", function () {
  if (!this.details) {
    this.details = {};
  }

  if (this.currency) {
    this.currency = String(this.currency).toLowerCase().trim();
  }

  if (this.customer?.email) {
    this.customer.email = normalizeEmail(this.customer.email);
  }

  if (this.cancellation_request?.customer_email) {
    this.cancellation_request.customer_email = normalizeEmail(
      this.cancellation_request.customer_email
    );
  }

  if (this.start_date && this.end_date) {
    const startDate = new Date(this.start_date);
    const endDate = new Date(this.end_date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid booking date format");
    }

    if (this.type === "storage" || this.type === "airport") {
      /**
       * Storage and Airport use inclusive calendar-day booking.
       *
       * Examples:
       * - 09 Sep -> 09 Sep = 1 day
       * - 04 Sep -> 05 Sep = 2 days
       *
       * Same-day booking is valid, so only reject an exit date
       * that is before the entry date.
       */
      if (endDate < startDate) {
        throw new Error("Exit date cannot be before entry date");
      }
    } else if (endDate < startDate) {
      throw new Error("End date cannot be before start date");
    }
  }

  const finalPrice = toMoneyNumber(this.price);
  const originalPrice = toMoneyNumber(this.original_price);
  const discountAmount = toMoneyNumber(this.discount_amount);
  const paidAmount = toMoneyNumber(this.paid_amount);
  const walletUsed = toMoneyNumber(this.wallet_used);
  const dueAmount = toMoneyNumber(this.due_amount);
  const holdingDepositAmount = toMoneyNumber(this.holding_deposit_amount);
  const balanceDueOnArrival = toMoneyNumber(this.balance_due_on_arrival);
  const addOnVehicleOriginalPrice = toMoneyNumber(
    this.add_on_vehicle_original_price
  );
  const addOnVehicleDiscountAmount = toMoneyNumber(
    this.add_on_vehicle_discount_amount
  );
  const addOnVehiclePrice = toMoneyNumber(this.add_on_vehicle_price);
  const addOnVehicleDiscountPercent = toCountNumber(
    this.add_on_vehicle_discount_percent
  );

  if (finalPrice < 0) {
    throw new Error("Invalid final booking price");
  }

  if (originalPrice < 0) {
    throw new Error("Invalid original booking price");
  }

  if (discountAmount < 0) {
    throw new Error("Invalid discount amount");
  }

  if (paidAmount < 0) {
    throw new Error("Invalid paid amount");
  }

  if (walletUsed < 0) {
    throw new Error("Invalid wallet used amount");
  }

  if (dueAmount < 0) {
    throw new Error("Invalid due amount");
  }

  if (holdingDepositAmount < 0) {
    throw new Error("Invalid holding deposit amount");
  }

  if (balanceDueOnArrival < 0) {
    throw new Error("Invalid balance due on arrival");
  }

  if (addOnVehicleOriginalPrice < 0) {
    throw new Error("Invalid add-on vehicle original price");
  }

  if (addOnVehicleDiscountAmount < 0) {
    throw new Error("Invalid add-on vehicle discount amount");
  }

  if (addOnVehiclePrice < 0) {
    throw new Error("Invalid add-on vehicle price");
  }

  if (addOnVehicleDiscountAmount > addOnVehicleOriginalPrice) {
    throw new Error(
      "Add-on vehicle discount amount cannot be greater than add-on vehicle original price"
    );
  }

  this.add_on_vehicle_discount_percent = Math.min(
    Math.max(addOnVehicleDiscountPercent || 0, 0),
    100
  );

  if (!this.original_price || Number(this.original_price) <= 0) {
    this.original_price = finalPrice + discountAmount;
  }

  if (discountAmount > Number(this.original_price || 0)) {
    throw new Error("Discount amount cannot be greater than original price");
  }

  if (finalPrice > Number(this.original_price || 0) && discountAmount > 0) {
    throw new Error(
      "Final price cannot be greater than original price when discount is applied"
    );
  }

  if (!this.coupon_code) {
    this.coupon_code = null;
    this.coupon_id = null;
  }

  const hasOnlinePaymentMethod = ["stripe", "paypal", "wallet"].includes(
    this.payment_method
  );

  const isProtectedBookingStatus = PROTECTED_BOOKING_STATUSES.includes(
    this.status
  );

  const isCancellationRequested =
    this.status === "cancellation_requested" ||
    this.cancellation_request?.requested === true;

  const shouldPreserveBookingStatus =
    isProtectedBookingStatus || isCancellationRequested;

  if (this.payment_flow === "full_online") {
    this.deposit_type = "full";

    if (!hasOnlinePaymentMethod) {
      throw new Error("Full payment requires Stripe, PayPal, or Wallet");
    }

    this.holding_deposit_amount = 0;
    this.balance_due_on_arrival = 0;

    if (this.payment_method === "wallet" && !shouldPreserveBookingStatus) {
      this.payment_status = "paid";

      if (Number(this.wallet_used || 0) <= 0) {
        this.wallet_used = finalPrice;
      }

      if (Number(this.paid_amount || 0) <= 0) {
        this.paid_amount = finalPrice;
      }

      this.due_amount = 0;
      this.status = "success";

      if (!this.payment_completed_at) {
        this.payment_completed_at = new Date();
      }
    }
  }

  if (this.payment_flow === "poa_deposit") {
    this.deposit_type = "poa";

    if (!["stripe", "paypal", "wallet"].includes(this.payment_method)) {
      throw new Error(
        "Pay on Arrival holding deposit requires Stripe, PayPal, or Wallet"
      );
    }

    const depositAmount = Number(this.holding_deposit_amount || 0);

    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      throw new Error("Holding deposit amount is required for Pay on Arrival");
    }

    this.holding_deposit_amount = Math.min(depositAmount, finalPrice);
    this.balance_due_on_arrival = Math.max(
      finalPrice - this.holding_deposit_amount,
      0
    );

    if (this.payment_method === "wallet" && !shouldPreserveBookingStatus) {
      this.paid_amount = this.holding_deposit_amount;
      this.wallet_used = this.holding_deposit_amount;
      this.due_amount = this.balance_due_on_arrival;
      this.payment_status = "partial";
      this.status = "poa";

      if (!this.payment_completed_at) {
        this.payment_completed_at = new Date();
      }
    }
  }

  if (
    this.payment_method === "poa" &&
    this.payment_flow !== "poa_deposit" &&
    !shouldPreserveBookingStatus
  ) {
    this.deposit_type = "poa";
    this.payment_status = "pending";
    this.status = "poa";
    this.paid_amount = 0;
    this.wallet_used = 0;
    this.holding_deposit_amount = 0;
    this.balance_due_on_arrival = finalPrice;
    this.payment_completed_at = null;
  }

  if (this.type === "cruise") {
    if (!this.schedule_id) {
      throw new Error("Schedule ID is required for cruise booking");
    }

    if (!this.details?.cruise?.ship_name) {
      throw new Error("Ship name is required for cruise booking");
    }

    if (!this.details?.cruise?.shuttle_time) {
      const carParkToTerminalTime =
        this.details?.cruise?.car_park_to_terminal_shuttle_time;

      if (carParkToTerminalTime) {
        this.details.cruise.shuttle_time = carParkToTerminalTime;
      }
    }

    if (!this.details?.cruise?.shuttle_slot_id) {
      const carParkToTerminalSlotId =
        this.details?.cruise?.car_park_to_terminal_shuttle_slot_id;

      if (carParkToTerminalSlotId) {
        this.details.cruise.shuttle_slot_id = carParkToTerminalSlotId;
      }
    }

    if (!this.details?.cruise?.pickup_pax) {
      const carParkToTerminalPassengers = toCountNumber(
        this.details?.cruise?.car_park_to_terminal_passengers
      );
      const terminalToCarParkPassengers = toCountNumber(
        this.details?.cruise?.terminal_to_car_park_passengers
      );

      if (carParkToTerminalPassengers || terminalToCarParkPassengers) {
        this.details.cruise.pickup_pax = Math.max(
          carParkToTerminalPassengers,
          terminalToCarParkPassengers
        );
      }
    }

    if (!this.details?.cruise?.car_park_to_terminal_shuttle_time) {
      this.details.cruise.car_park_to_terminal_shuttle_time =
        this.details.cruise.shuttle_time;
    }

    if (!this.details?.cruise?.car_park_to_terminal_shuttle_slot_id) {
      this.details.cruise.car_park_to_terminal_shuttle_slot_id =
        this.details.cruise.shuttle_slot_id || null;
    }

    if (!this.details?.cruise?.car_park_to_terminal_passengers) {
      this.details.cruise.car_park_to_terminal_passengers = toCountNumber(
        this.details.cruise.pickup_pax
      );
    }

    if (!this.details?.cruise?.shuttle_time) {
      throw new Error("Shuttle time is required for cruise booking");
    }

    this.details.cruise.extra_passenger_count = toCountNumber(
      this.details.cruise.extra_passenger_count
    );

    this.details.cruise.extra_passenger_fee = toMoneyNumber(
      this.details.cruise.extra_passenger_fee
    );

    if (!this.details.cruise.add_on_vehicle) {
      this.details.cruise.add_on_vehicle = {};
    }

    const addOnVehicle = this.details.cruise.add_on_vehicle;
    const addOnVehicleEnabled = Boolean(
      this.add_on_vehicle_enabled || addOnVehicle.enabled
    );

    this.add_on_vehicle_enabled = addOnVehicleEnabled;
    addOnVehicle.enabled = addOnVehicleEnabled;

    if (addOnVehicleEnabled) {
      const vehicleType = normalizeOptionalText(
        this.add_on_vehicle_type || addOnVehicle.type
      );
      const vehicleLicensePlate = normalizeOptionalText(
        this.add_on_vehicle_license_plate || addOnVehicle.license_plate
      );

      if (!vehicleType) {
        throw new Error("Add-on vehicle type is required");
      }

      if (!vehicleLicensePlate) {
        throw new Error("Add-on vehicle license plate is required");
      }

      this.add_on_vehicle_type = vehicleType;
      this.add_on_vehicle_license_plate = vehicleLicensePlate;
      addOnVehicle.type = vehicleType;
      addOnVehicle.license_plate = vehicleLicensePlate;

      const normalizedDiscountPercent = Math.min(
        Math.max(
          toCountNumber(
            this.add_on_vehicle_discount_percent ||
              addOnVehicle.discount_percent ||
              10
          ),
          0
        ),
        100
      );

      this.add_on_vehicle_discount_percent = normalizedDiscountPercent;
      addOnVehicle.discount_percent = normalizedDiscountPercent;

      const normalizedOriginalPrice = toMoneyNumber(
        this.add_on_vehicle_original_price || addOnVehicle.original_price
      );

      const normalizedDiscountAmount = toMoneyNumber(
        this.add_on_vehicle_discount_amount || addOnVehicle.discount_amount
      );

      const normalizedPrice = toMoneyNumber(
        this.add_on_vehicle_price || addOnVehicle.price
      );

      this.add_on_vehicle_original_price = normalizedOriginalPrice;
      this.add_on_vehicle_discount_amount = normalizedDiscountAmount;
      this.add_on_vehicle_price = normalizedPrice;

      addOnVehicle.original_price = normalizedOriginalPrice;
      addOnVehicle.discount_amount = normalizedDiscountAmount;
      addOnVehicle.price = normalizedPrice;
    } else {
      this.add_on_vehicle_type = "";
      this.add_on_vehicle_license_plate = "";
      this.add_on_vehicle_original_price = 0;
      this.add_on_vehicle_discount_amount = 0;
      this.add_on_vehicle_price = 0;

      addOnVehicle.type = "";
      addOnVehicle.license_plate = "";
      addOnVehicle.original_price = 0;
      addOnVehicle.discount_amount = 0;
      addOnVehicle.price = 0;
    }

    if (this.details?.pricing) {
      this.details.pricing.extra_passenger_count = toCountNumber(
        this.details.pricing.extra_passenger_count
      );

      this.details.pricing.extra_passenger_fee = toMoneyNumber(
        this.details.pricing.extra_passenger_fee
      );

      this.details.pricing.add_on_vehicle_original_price = toMoneyNumber(
        this.details.pricing.add_on_vehicle_original_price ||
          this.add_on_vehicle_original_price
      );

      this.details.pricing.add_on_vehicle_discount_percent = Math.min(
        Math.max(
          toCountNumber(
            this.details.pricing.add_on_vehicle_discount_percent ||
              this.add_on_vehicle_discount_percent
          ),
          0
        ),
        100
      );

      this.details.pricing.add_on_vehicle_discount_amount = toMoneyNumber(
        this.details.pricing.add_on_vehicle_discount_amount ||
          this.add_on_vehicle_discount_amount
      );

      this.details.pricing.add_on_vehicle_price = toMoneyNumber(
        this.details.pricing.add_on_vehicle_price || this.add_on_vehicle_price
      );

      this.details.pricing.parking_price = toMoneyNumber(
        this.details.pricing.parking_price
      );

      this.details.pricing.total_before_discount = toMoneyNumber(
        this.details.pricing.total_before_discount
      );
    }

    this.details.storage = undefined;
    this.details.airport = undefined;
  }

  if (this.type === "storage") {
    if (!this.details?.storage?.storage_type_id) {
      throw new Error("Storage type is required for storage booking");
    }

    if (!this.details?.storage?.storage_type_name) {
      throw new Error("Storage type name is required for storage booking");
    }

    this.schedule_id = null;
    this.pax = 0;
    this.license_plate = undefined;
    this.interlock = false;

    if (!this.details.storage.storage_type) {
      this.details.storage.storage_type = this.details.storage.storage_type_name;
    }

    this.details.cruise = undefined;
    this.details.airport = undefined;
  }

  if (this.type === "airport") {
    const hasShuttle = Boolean(this.details?.airport?.shuttle_time);

    if (hasShuttle && (!this.pax || Number(this.pax) < 1)) {
      throw new Error("Passengers are required when shuttle is selected");
    }

    if (!hasShuttle) {
      this.pax = 0;

      if (this.details?.airport) {
        this.details.airport.shuttle_time = undefined;
        this.details.airport.shuttle_slot_id = null;
        this.details.airport.pickup_pax = 0;
      }
    }

    this.schedule_id = null;

    this.details.cruise = undefined;
    this.details.storage = undefined;
  }
});

BookingSchema.pre("save", function () {
  const price = toMoneyNumber(this.price);
  const paidAmount = toMoneyNumber(this.paid_amount);

  /**
   * paid_amount is the source of truth for total paid.
   * wallet_used is only a breakdown/informational field.
   * Do not add paid_amount + wallet_used, or wallet payments can be double-counted.
   */
  const totalPaid = paidAmount;

  const isWalletFullPayment =
    this.payment_flow === "full_online" && this.payment_method === "wallet";

  const isPoaDepositBooking = this.payment_flow === "poa_deposit";

  const isWalletPoaDeposit =
    this.payment_flow === "poa_deposit" && this.payment_method === "wallet";

  const isLegacyPoaBooking =
    this.payment_method === "poa" && this.payment_flow !== "poa_deposit";

  const isProtectedBookingStatus = PROTECTED_BOOKING_STATUSES.includes(
    this.status
  );

  const isCancellationRequested =
    this.status === "cancellation_requested" ||
    this.cancellation_request?.requested === true;

  const shouldPreserveBookingStatus =
    isProtectedBookingStatus || isCancellationRequested;

  /**
   * Final admin statuses must not be recalculated back to success/poa.
   * This fixes wallet refund/credit/cancel flows where wallet balance updates
   * but booking status gets overwritten by save hooks.
   */
  if (isFinalAdminBookingStatus(this.status)) {
    this.due_amount = 0;

    if (this.balance_due_on_arrival !== undefined) {
      this.balance_due_on_arrival = 0;
    }

    if (this.status === "cancelled" && !this.cancelled_at) {
      this.cancelled_at = new Date();
    }

    if (this.payment_status === "failed" && !this.payment_failed_at) {
      this.payment_failed_at = new Date();
    }

    if (this.isNew && (!this.status_history || this.status_history.length === 0)) {
      this.status_history = [
        {
          status: this.status,
          note: "Booking created",
          changed_by: this.updated_by || null,
          date: new Date(),
        },
      ];
    }

    return;
  }

  if (isWalletFullPayment && !shouldPreserveBookingStatus) {
    this.paid_amount = price;
    this.wallet_used = price;
    this.due_amount = 0;
    this.balance_due_on_arrival = 0;
    this.payment_status = "paid";
    this.status = "success";

    if (!this.payment_completed_at) {
      this.payment_completed_at = new Date();
    }
  } else if (isWalletPoaDeposit && !shouldPreserveBookingStatus) {
    const depositAmount = Math.min(
      Number(this.holding_deposit_amount || 0),
      price
    );

    this.paid_amount = depositAmount;
    this.wallet_used = depositAmount;
    this.due_amount = Math.max(price - depositAmount, 0);
    this.balance_due_on_arrival = this.due_amount;
    this.payment_status = "partial";
    this.status = "poa";

    if (!this.payment_completed_at) {
      this.payment_completed_at = new Date();
    }
  } else if (
    isPoaDepositBooking &&
    this.payment_status === "pending" &&
    totalPaid === 0 &&
    this.status !== "poa" &&
    !shouldPreserveBookingStatus
  ) {
    const depositAmount = Math.min(
      Number(this.holding_deposit_amount || 0),
      price
    );

    this.due_amount = depositAmount;
    this.balance_due_on_arrival = Math.max(price - depositAmount, 0);
  } else if (isLegacyPoaBooking && !shouldPreserveBookingStatus) {
    this.due_amount = price;
    this.balance_due_on_arrival = price;
  } else {
    this.due_amount = Math.max(price - totalPaid, 0);

    if (isPoaDepositBooking) {
      this.balance_due_on_arrival = this.due_amount;
    }
  }

  if (
    !isWalletFullPayment &&
    !isWalletPoaDeposit &&
    !PROTECTED_BOOKING_STATUSES.includes(this.status) &&
    !PROTECTED_PAYMENT_STATUSES.includes(this.payment_status)
  ) {
    if (price > 0 && this.due_amount === 0 && !isPoaDepositBooking) {
      this.payment_status = "paid";
      this.status = "success";

      if (!this.payment_completed_at) {
        this.payment_completed_at = new Date();
      }
    } else if (totalPaid > 0 && this.due_amount > 0) {
      this.payment_status = "partial";
      this.status = isPoaDepositBooking ? "poa" : "pending";

      if (!this.payment_completed_at) {
        this.payment_completed_at = new Date();
      }
    } else {
      this.payment_status = this.payment_status || "pending";

      if (this.payment_method === "stripe" || this.payment_method === "paypal") {
        this.status = "pending_payment";
      } else if (isLegacyPoaBooking) {
        this.status = "poa";
      } else {
        this.status = "pending";
      }

      this.payment_completed_at = null;
    }
  }

  if (this.payment_status === "failed" && !this.payment_failed_at) {
    this.payment_failed_at = new Date();
  }

  if (this.isNew && (!this.status_history || this.status_history.length === 0)) {
    this.status_history = [
      {
        status: this.status,
        note: "Booking created",
        changed_by: this.updated_by || null,
        date: new Date(),
      },
    ];
  }
});

BookingSchema.methods.canBeDeleted = function () {
  return ["cancelled", "refund", "refunded", "credit", "credited"].includes(
    this.status
  );
};

BookingSchema.index({ booking_id: 1 }, { unique: true });
BookingSchema.index({ user_id: 1 });
BookingSchema.index({ location_id: 1 });
BookingSchema.index({ type: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ payment_status: 1 });
BookingSchema.index({ payment_method: 1 });
BookingSchema.index({ payment_flow: 1 });
BookingSchema.index({ schedule_id: 1 });
BookingSchema.index({ start_date: 1, end_date: 1 });
BookingSchema.index({ type: 1, location_id: 1, status: 1 });
BookingSchema.index({ type: 1, schedule_id: 1, status: 1 });
BookingSchema.index({ "customer.email": 1 });
BookingSchema.index({ source: 1 });

BookingSchema.index({ stripe_payment_intent_id: 1 });
BookingSchema.index({ paypal_order_id: 1 });
BookingSchema.index({ paypal_capture_id: 1 });
BookingSchema.index({ payment_completed_at: 1 });
BookingSchema.index({ balance_due_on_arrival: 1 });
BookingSchema.index({ wallet_transaction_id: 1 });
BookingSchema.index({ wallet_used: 1 });

BookingSchema.index({ admin_action_type: 1 });
BookingSchema.index({ admin_action_at: -1 });
BookingSchema.index({ admin_action_by: 1 });

BookingSchema.index({ "cancellation_request.requested": 1 });
BookingSchema.index({ "cancellation_request.requested_at": -1 });
BookingSchema.index({ "cancellation_request.customer_email": 1 });

BookingSchema.index({ reminder_email_sent_at: 1 });
BookingSchema.index({ reminder_email_processing_at: 1 });
BookingSchema.index({ feedback_email_sent_at: 1 });
BookingSchema.index({ feedback_email_processing_at: 1 });
BookingSchema.index({
  type: 1,
  status: 1,
  start_date: 1,
  reminder_email_sent_at: 1,
  reminder_email_processing_at: 1,
});
BookingSchema.index({
  type: 1,
  status: 1,
  end_date: 1,
  feedback_email_sent_at: 1,
  feedback_email_processing_at: 1,
});

BookingSchema.index({ "details.pricing.price_rule_id": 1 });
BookingSchema.index({ "details.pricing.extra_passenger_count": 1 });
BookingSchema.index({ "details.pricing.extra_passenger_fee": 1 });

BookingSchema.index({ "details.cruise.shuttle_slot_id": 1 });
BookingSchema.index({
  type: 1,
  "details.cruise.shuttle_slot_id": 1,
  status: 1,
});

BookingSchema.index({
  type: 1,
  schedule_id: 1,
  "details.cruise.shuttle_slot_id": 1,
  status: 1,
});

BookingSchema.index({
  type: 1,
  schedule_id: 1,
  "details.cruise.shuttle_time": 1,
  status: 1,
});

BookingSchema.index({ "details.cruise.pickup_pax_pro": 1 });

BookingSchema.index({
  type: 1,
  schedule_id: 1,
  "details.cruise.car_park_to_terminal_shuttle_slot_id": 1,
  status: 1,
});

BookingSchema.index({
  type: 1,
  schedule_id: 1,
  "details.cruise.car_park_to_terminal_shuttle_time": 1,
  status: 1,
});

BookingSchema.index({
  type: 1,
  schedule_id: 1,
  "details.cruise.terminal_to_car_park_shuttle_slot_id": 1,
  status: 1,
});

BookingSchema.index({
  type: 1,
  schedule_id: 1,
  "details.cruise.terminal_to_car_park_shuttle_time": 1,
  status: 1,
});

BookingSchema.index({
  "details.cruise.car_park_to_terminal_passengers": 1,
});

BookingSchema.index({
  "details.cruise.terminal_to_car_park_passengers": 1,
});

BookingSchema.index({ "details.cruise.extra_passenger_count": 1 });
BookingSchema.index({ "details.cruise.extra_passenger_fee": 1 });
BookingSchema.index({ "details.cruise.add_on_vehicle.enabled": 1 });
BookingSchema.index({ "details.cruise.add_on_vehicle.type": 1 });
BookingSchema.index({ "details.cruise.add_on_vehicle.license_plate": 1 });

BookingSchema.index({ add_on_vehicle_enabled: 1 });
BookingSchema.index({ add_on_vehicle_type: 1 });
BookingSchema.index({ add_on_vehicle_license_plate: 1 });

BookingSchema.index({ "details.airport.shuttle_slot_id": 1 });
BookingSchema.index({
  type: 1,
  "details.airport.shuttle_slot_id": 1,
  status: 1,
});

BookingSchema.index({ "details.storage.storage_type_id": 1 });
BookingSchema.index({
  type: 1,
  "details.storage.storage_type_id": 1,
  createdAt: -1,
});

BookingSchema.index({ coupon_code: 1 });
BookingSchema.index({ coupon_id: 1 });

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

export default Booking;