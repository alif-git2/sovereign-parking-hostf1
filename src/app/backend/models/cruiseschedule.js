import mongoose from "mongoose";

/**
 * Legacy cruise shuttle slots.
 *
 * New shuttle slots are managed globally from:
 * Settings -> Shuttle Time Slots
 *
 * Keep this schema only so old data does not break.
 */
const CruiseShuttleSlotSchema = new mongoose.Schema(
  {
    time: {
      type: String,
      trim: true,
      default: "",
    },

    capacity: {
      type: Number,
      min: [0, "Shuttle capacity cannot be negative"],
      default: 0,
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

const CruiseScheduleSchema = new mongoose.Schema(
  {
    departure_date: {
      type: Date,
      required: [true, "Ship departure date is required"],
    },

    return_date: {
      type: Date,
      required: [true, "Ship arrival date is required"],
    },

    /**
     * This is the ship name shown in admin UI.
     * Existing project uses schedule_name, so we keep it.
     */
    schedule_name: {
      type: String,
      required: [true, "Ship name is required"],
      trim: true,
    },

    schedule_type: {
      type: String,
      enum: ["cruise"],
      default: "cruise",
      required: true,
    },

    /**
     * Legacy/simple shuttle times.
     *
     * New shuttle times come from:
     * Settings -> Shuttle Time Slots
     */
    shuttle_times: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },

    /**
     * Legacy cruise shuttle options.
     *
     * New admin UI should NOT save shuttle slots here.
     * New booking flow should use Setting.shuttle_time_slots where type = "cruise".
     */
    shuttle_slots: {
      type: [CruiseShuttleSlotSchema],
      default: [],
    },

    location_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: [true, "Cruise location is required"],
    },

    /**
     * Total parking booking capacity for this cruise schedule.
     */
    capacity: {
      type: Number,
      required: [true, "Cruise capacity is required"],
      default: 1,
      min: [1, "Cruise capacity must be at least 1"],
    },

    /**
     * Total parking bookings made for this cruise schedule.
     *
     * This is still used to control cruise parking capacity.
     */
    booked_count: {
      type: Number,
      default: 0,
      min: [0, "Booked count cannot be negative"],
    },

    /**
     * Legacy fixed parking price.
     *
     * New price comes from:
     * Settings -> Prices Per Day
     *
     * Keep default 0 so old code/data does not break.
     */
    price_per_slot: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

CruiseScheduleSchema.virtual("ship_name")
  .get(function () {
    return this.schedule_name;
  })
  .set(function (value) {
    this.schedule_name = value;
  });

CruiseScheduleSchema.virtual("price")
  .get(function () {
    return this.price_per_slot;
  })
  .set(function (value) {
    this.price_per_slot = value;
  });

CruiseScheduleSchema.pre("validate", function () {
  this.schedule_type = "cruise";

  if (this.schedule_name) {
    this.schedule_name = String(this.schedule_name).trim();
  }

  if (!Array.isArray(this.shuttle_slots)) {
    this.shuttle_slots = [];
  }

  if (!Array.isArray(this.shuttle_times)) {
    this.shuttle_times = [];
  }

  /**
   * Keep only valid legacy shuttle slots.
   * Empty shuttle slots are allowed now because global settings manage them.
   */
  this.shuttle_slots = this.shuttle_slots
    .filter((slot) => slot && String(slot.time || "").trim())
    .map((slot) => ({
      _id: slot._id,
      time: String(slot.time || "").trim(),
      capacity: Number(slot.capacity || 0),
      booked_count: Number(slot.booked_count || 0),
      is_active: slot.is_active !== false,
    }));

  this.shuttle_times = this.shuttle_times
    .map((time) => String(time || "").trim())
    .filter(Boolean);

  if (this.departure_date && this.return_date) {
    const departureDate = new Date(this.departure_date);
    const returnDate = new Date(this.return_date);

    if (
      Number.isNaN(departureDate.getTime()) ||
      Number.isNaN(returnDate.getTime())
    ) {
      throw new Error("Invalid cruise schedule date format");
    }

    if (returnDate <= departureDate) {
      throw new Error("Ship arrival date must be after departure date");
    }
  }

  const capacity = Number(this.capacity || 0);
  const bookedCount = Number(this.booked_count || 0);
  const pricePerSlot = Number(this.price_per_slot || 0);

  if (!Number.isFinite(capacity) || capacity < 1) {
    throw new Error("Cruise capacity must be at least 1");
  }

  if (!Number.isFinite(bookedCount) || bookedCount < 0) {
    throw new Error("Booked count cannot be negative");
  }

  if (bookedCount > capacity) {
    throw new Error("Booked count cannot be greater than cruise capacity");
  }

  if (!Number.isFinite(pricePerSlot) || pricePerSlot < 0) {
    throw new Error("Price cannot be negative");
  }

  const seenTimes = new Set();

  this.shuttle_slots.forEach((slot) => {
    const time = String(slot.time || "").trim();
    const slotCapacity = Number(slot.capacity || 0);
    const slotBookedCount = Number(slot.booked_count || 0);

    if (!time) {
      throw new Error("Shuttle slot time is required");
    }

    const normalizedTime = time.toLowerCase();

    if (seenTimes.has(normalizedTime)) {
      throw new Error(`Duplicate shuttle slot time: ${time}`);
    }

    seenTimes.add(normalizedTime);

    if (!Number.isFinite(slotCapacity) || slotCapacity < 0) {
      throw new Error(`Shuttle capacity cannot be negative for ${time}`);
    }

    if (!Number.isFinite(slotBookedCount) || slotBookedCount < 0) {
      throw new Error(`Booked count cannot be negative for shuttle time ${time}`);
    }

    if (slotBookedCount > slotCapacity) {
      throw new Error(
        `Booked count cannot be greater than capacity for shuttle time ${time}`
      );
    }
  });
});

CruiseScheduleSchema.methods.canBeDeleted = function () {
  return Number(this.booked_count || 0) === 0;
};

CruiseScheduleSchema.index({ schedule_name: 1, departure_date: 1 });
CruiseScheduleSchema.index({ departure_date: 1 });
CruiseScheduleSchema.index({ return_date: 1 });
CruiseScheduleSchema.index({ location_id: 1 });
CruiseScheduleSchema.index({ is_active: 1 });
CruiseScheduleSchema.index({ departure_date: 1, is_active: 1 });
CruiseScheduleSchema.index({ location_id: 1, departure_date: 1 });

// Legacy indexes only.
CruiseScheduleSchema.index({ "shuttle_slots.time": 1 });
CruiseScheduleSchema.index({ "shuttle_slots.is_active": 1 });

const CruiseSchedule =
  mongoose.models.CruiseSchedule ||
  mongoose.model("CruiseSchedule", CruiseScheduleSchema);

export default CruiseSchedule;