import mongoose from "mongoose";

const ShuttleSlotSchema = new mongoose.Schema(
  {
    time: {
      type: String,
      required: [true, "Shuttle time is required"],
      trim: true,
    },

    capacity: {
      type: Number,
      required: [true, "Shuttle capacity is required"],
      default: 0,
      min: [0, "Shuttle capacity cannot be negative"],
    },

    booked_count: {
      type: Number,
      default: 0,
      min: [0, "Booked count cannot be negative"],
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const BlockedDateSchema = new mongoose.Schema(
  {
    start_date: {
      type: Date,
      required: [true, "Blocked start date is required"],
    },

    end_date: {
      type: Date,
      required: [true, "Blocked end date is required"],
    },

    reason: {
      type: String,
      trim: true,
      default: "",
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const StorageTypeLocationSchema = new mongoose.Schema(
  {
    storage_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StorageType",
      required: true,
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const LocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Location name is required"],
      trim: true,
    },

    // Main booking types only: cruise, storage, airport
    type: {
      type: String,
      enum: ["airport", "storage", "cruise"],
      required: [true, "Location type is required"],
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    // Capacity for this location.
    // Admin pages can show booked_count / capacity.
    capacity: {
      type: Number,
      default: 0,
      min: [0, "Capacity cannot be negative"],
    },

    // Legacy pricing field.
    // New pricing should come from Setting.price_rules.
    // Keep this for old bookings/data compatibility.
    price_per_day: {
      type: Number,
      default: 0,
      min: [0, "Price per day cannot be negative"],
    },

    // Airport-only toggle.
    // If true, airport shuttle slots can be managed from:
    // Settings -> Shuttle Time Slots.
    show_shuttle_options: {
      type: Boolean,
      default: false,
    },

    // Legacy/simple shuttle times.
    // New shuttle slots should come from Setting.shuttle_time_slots.
    shuttle_times: [
      {
        type: String,
        trim: true,
      },
    ],

    // Legacy airport shuttle options.
    // Keep for old data compatibility.
    // New shuttle slots should be managed from Setting.shuttle_time_slots.
    shuttle_slots: [ShuttleSlotSchema],

    // Admin blocked dates.
    // Used mainly for Airport Booking.
    blocked_dates: [BlockedDateSchema],

    // Dynamic storage types for Storage Booking.
    // If this array is empty, storage booking can allow all active Storage Types.
    storage_types: [StorageTypeLocationSchema],

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Validation
LocationSchema.pre("validate", function () {
  // Normalize numeric fields.
  this.capacity = Number(this.capacity || 0);
  this.price_per_day = Number(this.price_per_day || 0);

  if (this.capacity < 0) {
    throw new Error("Capacity cannot be negative");
  }

  if (this.price_per_day < 0) {
    throw new Error("Price per day cannot be negative");
  }

  // If location is not airport, shuttle options should be disabled.
  if (this.type !== "airport") {
    this.show_shuttle_options = false;
  }

  // If location is not storage, remove storage type restrictions.
  if (this.type !== "storage") {
    this.storage_types = undefined;
  }

  // If location is not airport, remove airport-only fields.
  // Cruise uses CruiseSchedule and Settings shuttle slots, not Location shuttle slots.
  if (this.type !== "airport") {
    this.shuttle_slots = undefined;
    this.blocked_dates = undefined;
  }

  // If location is storage, do not auto-fill old hardcoded storage types.
  // Empty storage_types means this location supports all active Storage Types.
  if (this.type === "storage" && !Array.isArray(this.storage_types)) {
    this.storage_types = [];
  }

  // If location is airport, make sure arrays exist.
  if (this.type === "airport") {
    if (!Array.isArray(this.blocked_dates)) {
      this.blocked_dates = [];
    }

    if (!Array.isArray(this.shuttle_slots)) {
      this.shuttle_slots = [];
    }
  }

  // Validate legacy shuttle slot booked_count is not greater than capacity.
  if (this.type === "airport" && Array.isArray(this.shuttle_slots)) {
    this.shuttle_slots.forEach((slot) => {
      const capacity = Number(slot.capacity || 0);
      const bookedCount = Number(slot.booked_count || 0);

      if (bookedCount > capacity) {
        throw new Error(
          `Booked count cannot be greater than capacity for shuttle time ${slot.time}`
        );
      }
    });
  }

  // Validate blocked date ranges.
  if (this.type === "airport" && Array.isArray(this.blocked_dates)) {
    this.blocked_dates.forEach((blockedDate) => {
      if (!blockedDate.start_date || !blockedDate.end_date) {
        return;
      }

      const startDate = new Date(blockedDate.start_date);
      const endDate = new Date(blockedDate.end_date);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new Error("Invalid blocked date format");
      }

      if (endDate < startDate) {
        throw new Error("Blocked end date cannot be before blocked start date");
      }
    });
  }
});

// Indexes for filtering
LocationSchema.index({ type: 1 });
LocationSchema.index({ is_active: 1 });
LocationSchema.index({ type: 1, is_active: 1 });
LocationSchema.index({ type: 1, show_shuttle_options: 1 });

// Storage filtering
LocationSchema.index({ "storage_types.storage_type_id": 1 });

// Legacy airport shuttle filtering
LocationSchema.index({ "shuttle_slots.time": 1 });
LocationSchema.index({ "shuttle_slots.is_active": 1 });

// Airport blocked date filtering
LocationSchema.index({ "blocked_dates.start_date": 1 });
LocationSchema.index({ "blocked_dates.end_date": 1 });
LocationSchema.index({ "blocked_dates.is_active": 1 });

const Location =
  mongoose.models.Location || mongoose.model("Location", LocationSchema);

export default Location;