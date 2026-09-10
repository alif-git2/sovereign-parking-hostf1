import mongoose from "mongoose";
import Booking from "@/app/backend/models/booking";
import CruiseSchedule from "@/app/backend/models/cruiseschedule";
import Setting from "@/app/backend/models/settings";
import Location from "@/app/backend/models/location";
import { getUserFromRequest } from "@/app/backend/utils/authToken";

const GLOBAL_SETTING_ID = "global_config";

const NON_EDITABLE_STATUSES = [
  "cancelled",
  "cancellation_requested",
  "refund",
  "refunded",
  "credit",
  "credited",
];

const ACTIVE_BOOKING_EXCLUDED_STATUSES = [
  "cancelled",
  "cancellation_requested",
  "refund",
  "refunded",
  "credit",
  "credited",
  "failed",
  "expired",
  "deleted",
];

const CRUISE_DIRECTION_KEYS = {
  CAR_PARK_TO_TERMINAL: "carParkToTerminal",
  TERMINAL_TO_CAR_PARK: "terminalToCarPark",
};

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (value.includes("unauthorized") || value.includes("login")) return 401;
  if (value.includes("not found")) return 404;
  if (value.includes("not allowed") || value.includes("cannot")) return 403;
  if (value.includes("capacity") || value.includes("remaining")) return 409;

  return 400;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeCount(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}

function normalizeObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
    return null;
  }

  return new mongoose.Types.ObjectId(String(value));
}

function getSlotId(slot) {
  return String(slot?._id || slot?.id || slot?.slot_id || "").trim();
}

function getSlotTime(slot) {
  return normalizeString(slot?.time || slot?.shuttle_time || slot?.label);
}

function parseDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function canEditBooking(booking) {
  const status = String(booking?.status || "").toLowerCase();

  if (NON_EDITABLE_STATUSES.includes(status)) {
    return false;
  }

  return true;
}

async function getSettingsDocument() {
  return Setting.findByIdAndUpdate(
    GLOBAL_SETTING_ID,
    {
      $setOnInsert: {
        _id: GLOBAL_SETTING_ID,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

function findMatchingSlot(slots = [], { slotId, shuttleTime }) {
  const normalizedSlotId = normalizeString(slotId);
  const normalizedTime = normalizeString(shuttleTime).toLowerCase();

  return slots.find((slot) => {
    const currentSlotId = getSlotId(slot);
    const currentTime = getSlotTime(slot).toLowerCase();

    if (normalizedSlotId && currentSlotId === normalizedSlotId) {
      return true;
    }

    if (normalizedTime && currentTime === normalizedTime) {
      return true;
    }

    return false;
  });
}

function directionLabel(directionKey) {
  if (directionKey === CRUISE_DIRECTION_KEYS.CAR_PARK_TO_TERMINAL) {
    return "Car park to terminal";
  }

  if (directionKey === CRUISE_DIRECTION_KEYS.TERMINAL_TO_CAR_PARK) {
    return "Terminal to car park";
  }

  return "Cruise";
}

function getCruiseDetails(booking) {
  return booking?.details?.cruise || {};
}

function getCruiseDirectionValues(booking, directionKey) {
  const cruise = getCruiseDetails(booking);

  if (directionKey === CRUISE_DIRECTION_KEYS.CAR_PARK_TO_TERMINAL) {
    return {
      passengerCount: normalizeCount(
        cruise.car_park_to_terminal_passengers ||
          cruise.pickup_pax ||
          booking?.pax ||
          1
      ),
      shuttleSlotId: normalizeString(
        cruise.car_park_to_terminal_shuttle_slot_id ||
          cruise.shuttle_slot_id ||
          ""
      ),
      shuttleTime: normalizeString(
        cruise.car_park_to_terminal_shuttle_time || cruise.shuttle_time || ""
      ),
    };
  }

  if (directionKey === CRUISE_DIRECTION_KEYS.TERMINAL_TO_CAR_PARK) {
    return {
      passengerCount: normalizeCount(
        cruise.terminal_to_car_park_passengers ||
          cruise.pickup_pax ||
          booking?.pax ||
          1
      ),
      shuttleSlotId: normalizeString(
        cruise.terminal_to_car_park_shuttle_slot_id ||
          cruise.shuttle_slot_id ||
          ""
      ),
      shuttleTime: normalizeString(
        cruise.terminal_to_car_park_shuttle_time || cruise.shuttle_time || ""
      ),
    };
  }

  return {
    passengerCount: normalizeCount(booking?.pax || 0),
    shuttleSlotId: "",
    shuttleTime: "",
  };
}

function cruiseSlotIsEnabledForDirection(slot, directionKey) {
  if (directionKey === CRUISE_DIRECTION_KEYS.CAR_PARK_TO_TERMINAL) {
    return slot?.show_car_park_to_terminal !== false;
  }

  if (directionKey === CRUISE_DIRECTION_KEYS.TERMINAL_TO_CAR_PARK) {
    return slot?.show_terminal_to_car_park !== false;
  }

  return false;
}

function normalizeCruiseSlot(slot, defaultCapacity = 11) {
  const time = getSlotTime(slot);
  const capacity = Number(slot?.capacity || defaultCapacity || 11);

  return {
    ...slot,
    _id: getSlotId(slot) || time,
    type: "cruise",
    time,
    shuttle_time: time,
    capacity,
    is_active: slot?.is_active !== false,
    show_car_park_to_terminal: slot?.show_car_park_to_terminal !== false,
    show_terminal_to_car_park: slot?.show_terminal_to_car_park !== false,
  };
}

function getCruiseSlotsFromSettings(settings, schedule = null) {
  const settingsSlots = Array.isArray(settings?.shuttle_time_slots)
    ? settings.shuttle_time_slots
        .filter((slot) => slot?.type === "cruise" && slot?.is_active !== false)
        .map((slot) =>
          normalizeCruiseSlot(slot, settings?.default_shuttle_slot_capacity)
        )
        .filter((slot) => slot.time)
    : [];

  if (settingsSlots.length > 0) {
    return settingsSlots;
  }

  const scheduleSlots = Array.isArray(schedule?.shuttle_slots)
    ? schedule.shuttle_slots
        .filter((slot) => slot?.is_active !== false)
        .map((slot) =>
          normalizeCruiseSlot(slot, settings?.default_shuttle_slot_capacity)
        )
        .filter((slot) => slot.time)
    : [];

  return scheduleSlots;
}

function getCruiseDirectionBookedPaxFromBookings({
  bookings = [],
  slotId,
  shuttleTime,
  directionKey,
}) {
  const targetSlotId = normalizeString(slotId);
  const targetTime = normalizeString(shuttleTime).toLowerCase();

  if (!targetSlotId && !targetTime) {
    return 0;
  }

  return bookings.reduce((total, item) => {
    const directionValues = getCruiseDirectionValues(item, directionKey);

    const itemSlotId = normalizeString(directionValues.shuttleSlotId);
    const itemTime = normalizeString(directionValues.shuttleTime).toLowerCase();

    const matchesSlot = targetSlotId && itemSlotId === targetSlotId;
    const matchesTime = targetTime && itemTime === targetTime;

    if (!matchesSlot && !matchesTime) {
      return total;
    }

    return total + normalizeCount(directionValues.passengerCount);
  }, 0);
}

async function getCruiseOtherBookingsForSchedule(booking) {
  return Booking.find({
    _id: {
      $ne: booking._id,
    },
    type: "cruise",
    schedule_id: booking.schedule_id,
    status: {
      $nin: ACTIVE_BOOKING_EXCLUDED_STATUSES,
    },
  })
    .select(
      [
        "pax",
        "details.cruise.shuttle_time",
        "details.cruise.shuttle_slot_id",
        "details.cruise.pickup_pax",
        "details.cruise.car_park_to_terminal_passengers",
        "details.cruise.car_park_to_terminal_shuttle_time",
        "details.cruise.car_park_to_terminal_shuttle_slot_id",
        "details.cruise.terminal_to_car_park_passengers",
        "details.cruise.terminal_to_car_park_shuttle_time",
        "details.cruise.terminal_to_car_park_shuttle_slot_id",
      ].join(" ")
    )
    .lean();
}

async function validateCruiseDirectionShuttleChange({
  booking,
  settings,
  directionKey,
  shuttleTime,
  slotId,
}) {
  const schedule = await CruiseSchedule.findById(booking.schedule_id).lean();

  if (!schedule) {
    throw new Error("Cruise schedule not found");
  }

  const slots = getCruiseSlotsFromSettings(settings, schedule);

  const selectedSlot = findMatchingSlot(slots, {
    slotId,
    shuttleTime,
  });

  if (!selectedSlot) {
    throw new Error(
      `Selected ${directionLabel(directionKey)} shuttle option was not found`
    );
  }

  if (selectedSlot.is_active === false) {
    throw new Error(
      `Selected ${directionLabel(directionKey)} shuttle option is not active`
    );
  }

  if (!cruiseSlotIsEnabledForDirection(selectedSlot, directionKey)) {
    throw new Error(
      `Selected shuttle option is not enabled for ${directionLabel(
        directionKey
      )}`
    );
  }

  const selectedTime = getSlotTime(selectedSlot);

  if (!selectedTime) {
    throw new Error(
      `Selected ${directionLabel(directionKey)} shuttle time is invalid`
    );
  }

  const capacity = Number(
    selectedSlot.capacity || settings?.default_shuttle_slot_capacity || 11
  );

  if (!Number.isFinite(capacity) || capacity < 1) {
    throw new Error(
      `Selected ${directionLabel(directionKey)} shuttle option has no capacity`
    );
  }

  const currentDirection = getCruiseDirectionValues(booking, directionKey);
  const currentPassengerCount = normalizeCount(currentDirection.passengerCount);

  if (currentPassengerCount < 1) {
    throw new Error(
      `${directionLabel(directionKey)} passengers are missing on this booking`
    );
  }

  const otherBookings = await getCruiseOtherBookingsForSchedule(booking);

  const otherBookedPax = getCruiseDirectionBookedPaxFromBookings({
    bookings: otherBookings,
    slotId: getSlotId(selectedSlot),
    shuttleTime: selectedTime,
    directionKey,
  });

  const remaining = Math.max(capacity - otherBookedPax, 0);

  if (currentPassengerCount > remaining) {
    throw new Error(
      `Selected ${directionLabel(directionKey)} shuttle option has only ${remaining} remaining seat(s)`
    );
  }

  return {
    slotId: getSlotId(selectedSlot),
    shuttleTime: selectedTime,
    capacity,
    remaining,
  };
}

function getBookingPax(booking) {
  if (booking?.type === "cruise") {
    return Number(booking?.details?.cruise?.pickup_pax || booking?.pax || 1);
  }

  if (booking?.type === "airport") {
    return Number(booking?.details?.airport?.pickup_pax || booking?.pax || 1);
  }

  return Number(booking?.pax || 0);
}

async function getAirportOtherBookedPax({ booking, shuttleTime }) {
  const start = parseDateOnly(booking.start_date);

  if (!start) {
    throw new Error("Invalid airport booking entry date");
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const otherBookings = await Booking.find({
    _id: {
      $ne: booking._id,
    },
    type: "airport",
    location_id: booking.location_id,
    status: {
      $nin: ACTIVE_BOOKING_EXCLUDED_STATUSES,
    },
    start_date: {
      $gte: start,
      $lt: end,
    },
  })
    .select("pax details.airport.shuttle_time details.airport.pickup_pax")
    .lean();

  const targetTime = normalizeString(shuttleTime).toLowerCase();

  return otherBookings.reduce((total, item) => {
    const itemTime = normalizeString(
      item?.details?.airport?.shuttle_time
    ).toLowerCase();

    if (itemTime !== targetTime) {
      return total;
    }

    return total + Number(item?.details?.airport?.pickup_pax || item?.pax || 1);
  }, 0);
}

async function validateAirportShuttleChange({ booking, shuttleTime, slotId }) {
  const location = await Location.findById(booking.location_id).lean();

  if (!location) {
    throw new Error("Airport location not found");
  }

  const shuttleEnabled = Boolean(
    location.show_shuttle_options ||
      location.see_shuttle_options ||
      location.has_shuttle_options
  );

  if (!shuttleEnabled) {
    throw new Error("Airport shuttle option is not enabled for this location");
  }

  const settings = await getSettingsDocument();

  const slots = Array.isArray(settings.shuttle_time_slots)
    ? settings.shuttle_time_slots.filter((slot) => {
        return slot?.type === "airport" && slot?.is_active !== false;
      })
    : [];

  const selectedSlot = findMatchingSlot(slots, {
    slotId,
    shuttleTime,
  });

  if (!selectedSlot) {
    throw new Error("Selected airport shuttle option was not found");
  }

  const selectedTime = getSlotTime(selectedSlot);

  if (!selectedTime) {
    throw new Error("Selected airport shuttle time is invalid");
  }

  const capacity = Number(
    selectedSlot.capacity || settings.default_shuttle_slot_capacity || 11
  );

  if (!Number.isFinite(capacity) || capacity < 1) {
    throw new Error("Selected airport shuttle option has no capacity");
  }

  const currentBookingPax = getBookingPax(booking);

  if (!currentBookingPax || currentBookingPax < 1) {
    throw new Error("This airport booking does not have shuttle passengers");
  }

  const otherBookedPax = await getAirportOtherBookedPax({
    booking,
    shuttleTime: selectedTime,
  });

  const remaining = Math.max(capacity - otherBookedPax, 0);

  if (currentBookingPax > remaining) {
    throw new Error(
      `Selected airport shuttle option has only ${remaining} remaining seat(s)`
    );
  }

  return {
    slotId: selectedSlot._id,
    shuttleTime: selectedTime,
  };
}

async function populateBooking(booking) {
  await booking.populate("location_id");
  await booking.populate("schedule_id");
  await booking.populate("details.storage.storage_type_id");

  return booking;
}

function buildCruiseSlotResponse({
  slot,
  booking,
  otherBookings,
  directionKey,
}) {
  const time = getSlotTime(slot);
  const capacity = Number(slot.capacity || 0);
  const slotId = getSlotId(slot);

  const bookedPax = getCruiseDirectionBookedPaxFromBookings({
    bookings: otherBookings,
    slotId,
    shuttleTime: time,
    directionKey,
  });

  const currentDirection = getCruiseDirectionValues(booking, directionKey);
  const isCurrent =
    normalizeString(currentDirection.shuttleSlotId) === slotId ||
    normalizeString(currentDirection.shuttleTime).toLowerCase() ===
      time.toLowerCase();

  return {
    bookedPax,
    remaining: Math.max(capacity - bookedPax, 0),
    isCurrent,
  };
}

async function getCruiseEditShuttleSlots(booking) {
  const settings = await getSettingsDocument();
  const schedule = await CruiseSchedule.findById(booking.schedule_id).lean();

  if (!schedule) {
    throw new Error("Cruise schedule not found");
  }

  const slots = getCruiseSlotsFromSettings(settings, schedule);

  const otherBookings = await getCruiseOtherBookingsForSchedule(booking);

  return slots
    .map((slot) => {
      const time = getSlotTime(slot);
      const capacity = Number(
        slot.capacity || settings.default_shuttle_slot_capacity || 11
      );

      if (!time || !Number.isFinite(capacity) || capacity < 1) {
        return null;
      }

      const carParkToTerminal = buildCruiseSlotResponse({
        slot,
        booking,
        otherBookings,
        directionKey: CRUISE_DIRECTION_KEYS.CAR_PARK_TO_TERMINAL,
      });

      const terminalToCarPark = buildCruiseSlotResponse({
        slot,
        booking,
        otherBookings,
        directionKey: CRUISE_DIRECTION_KEYS.TERMINAL_TO_CAR_PARK,
      });

      return {
        _id: getSlotId(slot) || time,
        type: "cruise",
        time,
        shuttle_time: time,
        capacity,

        show_car_park_to_terminal: slot.show_car_park_to_terminal !== false,
        show_terminal_to_car_park: slot.show_terminal_to_car_park !== false,

        car_park_to_terminal_booked_count: carParkToTerminal.bookedPax,
        car_park_to_terminal_remaining: carParkToTerminal.remaining,
        car_park_to_terminal_is_current: carParkToTerminal.isCurrent,

        terminal_to_car_park_booked_count: terminalToCarPark.bookedPax,
        terminal_to_car_park_remaining: terminalToCarPark.remaining,
        terminal_to_car_park_is_current: terminalToCarPark.isCurrent,

        booked_count: Math.max(
          carParkToTerminal.bookedPax,
          terminalToCarPark.bookedPax
        ),
        remaining: Math.max(
          capacity -
            Math.max(carParkToTerminal.bookedPax, terminalToCarPark.bookedPax),
          0
        ),

        is_current:
          carParkToTerminal.isCurrent || terminalToCarPark.isCurrent,
        is_active: slot.is_active !== false,
      };
    })
    .filter(Boolean);
}

async function getAirportEditShuttleSlots(booking) {
  const location = await Location.findById(booking.location_id).lean();

  if (!location) {
    throw new Error("Airport location not found");
  }

  const shuttleEnabled = Boolean(
    location.show_shuttle_options ||
      location.see_shuttle_options ||
      location.has_shuttle_options
  );

  if (!shuttleEnabled) {
    return [];
  }

  const settings = await getSettingsDocument();

  const slots = Array.isArray(settings.shuttle_time_slots)
    ? settings.shuttle_time_slots.filter((slot) => {
        return slot?.type === "airport" && slot?.is_active !== false;
      })
    : [];

  const start = parseDateOnly(booking.start_date);

  if (!start) {
    throw new Error("Invalid airport booking entry date");
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const activeBookings = await Booking.find({
    _id: {
      $ne: booking._id,
    },
    type: "airport",
    location_id: booking.location_id,
    status: {
      $nin: ACTIVE_BOOKING_EXCLUDED_STATUSES,
    },
    start_date: {
      $gte: start,
      $lt: end,
    },
  })
    .select("pax details.airport.shuttle_time details.airport.pickup_pax")
    .lean();

  return slots
    .map((slot) => {
      const time = getSlotTime(slot);
      const capacity = Number(
        slot.capacity || settings.default_shuttle_slot_capacity || 11
      );

      if (!time || !Number.isFinite(capacity) || capacity < 1) {
        return null;
      }

      const bookedPax = activeBookings.reduce((total, item) => {
        const itemTime = normalizeString(
          item?.details?.airport?.shuttle_time
        ).toLowerCase();

        if (itemTime !== time.toLowerCase()) {
          return total;
        }

        return (
          total + Number(item?.details?.airport?.pickup_pax || item?.pax || 1)
        );
      }, 0);

      return {
        _id: String(slot._id || slot.id || time),
        type: "airport",
        time,
        shuttle_time: time,
        capacity,
        booked_count: bookedPax,
        remaining: Math.max(capacity - bookedPax, 0),
        is_current:
          normalizeString(booking?.details?.airport?.shuttle_time).toLowerCase() ===
          time.toLowerCase(),
        is_active: slot.is_active !== false,
      };
    })
    .filter(Boolean);
}

export async function getCustomerBookingEditOptions(req, bookingId) {
  try {
    const authUser = getUserFromRequest(req);

    if (!authUser?.id) {
      throw new Error("Unauthorized. Please login again.");
    }

    const identifier = normalizeString(bookingId);

    if (!identifier) {
      throw new Error("Booking ID is required");
    }

    const query = mongoose.Types.ObjectId.isValid(identifier)
      ? {
          _id: identifier,
          user_id: authUser.id,
        }
      : {
          booking_id: identifier,
          user_id: authUser.id,
        };

    const booking = await Booking.findOne(query).lean();

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (!["cruise", "airport"].includes(booking.type)) {
      return Response.json({
        success: true,
        data: {
          booking_id: booking.booking_id,
          type: booking.type,
          shuttle_slots: [],
          available_shuttle_slots: [],
        },
      });
    }

    if (booking.type === "cruise") {
      const shuttleSlots = await getCruiseEditShuttleSlots(booking);

      return Response.json({
        success: true,
        data: {
          booking_id: booking.booking_id,
          type: booking.type,
          shuttle_slots: shuttleSlots,
          available_shuttle_slots: shuttleSlots,
        },
      });
    }

    if (booking.type === "airport") {
      const shuttleSlots = await getAirportEditShuttleSlots(booking);

      return Response.json({
        success: true,
        data: {
          booking_id: booking.booking_id,
          type: booking.type,
          shuttle_slots: shuttleSlots,
          available_shuttle_slots: shuttleSlots,
        },
      });
    }

    return Response.json({
      success: true,
      data: {
        booking_id: booking.booking_id,
        type: booking.type,
        shuttle_slots: [],
        available_shuttle_slots: [],
      },
    });
  } catch (error) {
    console.error("Customer booking edit options failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load booking edit options",
        error: error.message || "Failed to load booking edit options",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function updateCustomerBooking(req, bookingId) {
  try {
    const authUser = getUserFromRequest(req);

    if (!authUser?.id) {
      throw new Error("Unauthorized. Please login again.");
    }

    const identifier = normalizeString(bookingId);

    if (!identifier) {
      throw new Error("Booking ID is required");
    }

    const body = await req.json();

    const query = mongoose.Types.ObjectId.isValid(identifier)
      ? {
          _id: identifier,
          user_id: authUser.id,
        }
      : {
          booking_id: identifier,
          user_id: authUser.id,
        };

    const booking = await Booking.findOne(query);

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (!canEditBooking(booking)) {
      throw new Error("This booking cannot be edited");
    }

    if (booking.type === "cruise") {
      const licensePlate = normalizeString(body.license_plate).toUpperCase();

      if (!licensePlate) {
        throw new Error("License plate is required");
      }

      booking.license_plate = licensePlate;

      if (!booking.details) {
        booking.details = {};
      }

      if (!booking.details.cruise) {
        booking.details.cruise = {};
      }

      const settings = await getSettingsDocument();

      const currentCarParkToTerminal = getCruiseDirectionValues(
        booking,
        CRUISE_DIRECTION_KEYS.CAR_PARK_TO_TERMINAL
      );

      const currentTerminalToCarPark = getCruiseDirectionValues(
        booking,
        CRUISE_DIRECTION_KEYS.TERMINAL_TO_CAR_PARK
      );

      const requestedCarParkToTerminalSlotId = normalizeString(
        body.car_park_to_terminal_shuttle_slot_id ||
          currentCarParkToTerminal.shuttleSlotId
      );

      const requestedCarParkToTerminalTime = normalizeString(
        body.car_park_to_terminal_shuttle_time ||
          currentCarParkToTerminal.shuttleTime
      );

      const requestedTerminalToCarParkSlotId = normalizeString(
        body.terminal_to_car_park_shuttle_slot_id ||
          currentTerminalToCarPark.shuttleSlotId
      );

      const requestedTerminalToCarParkTime = normalizeString(
        body.terminal_to_car_park_shuttle_time ||
          currentTerminalToCarPark.shuttleTime
      );

      if (
        !requestedCarParkToTerminalSlotId &&
        !requestedCarParkToTerminalTime
      ) {
        throw new Error("Please select Car park to terminal shuttle option");
      }

      if (!requestedTerminalToCarParkSlotId && !requestedTerminalToCarParkTime) {
        throw new Error("Please select Terminal to car park shuttle option");
      }

      const selectedCarParkToTerminal =
        await validateCruiseDirectionShuttleChange({
          booking,
          settings,
          directionKey: CRUISE_DIRECTION_KEYS.CAR_PARK_TO_TERMINAL,
          slotId: requestedCarParkToTerminalSlotId,
          shuttleTime: requestedCarParkToTerminalTime,
        });

      const selectedTerminalToCarPark =
        await validateCruiseDirectionShuttleChange({
          booking,
          settings,
          directionKey: CRUISE_DIRECTION_KEYS.TERMINAL_TO_CAR_PARK,
          slotId: requestedTerminalToCarParkSlotId,
          shuttleTime: requestedTerminalToCarParkTime,
        });

      /**
       * Customers can only change shuttle options.
       * Do not update passenger counts, extra passenger fee, price,
       * paid amount, due amount, or any payment fields from this endpoint.
       */
      booking.details.cruise.car_park_to_terminal_shuttle_time =
        selectedCarParkToTerminal.shuttleTime;
      booking.details.cruise.car_park_to_terminal_shuttle_slot_id =
        normalizeObjectId(selectedCarParkToTerminal.slotId);

      booking.details.cruise.terminal_to_car_park_shuttle_time =
        selectedTerminalToCarPark.shuttleTime;
      booking.details.cruise.terminal_to_car_park_shuttle_slot_id =
        normalizeObjectId(selectedTerminalToCarPark.slotId);

      /**
       * Backward compatibility:
       * legacy/general shuttle fields represent Car park to terminal.
       */
      booking.details.cruise.shuttle_time =
        selectedCarParkToTerminal.shuttleTime;
      booking.details.cruise.shuttle_slot_id = normalizeObjectId(
        selectedCarParkToTerminal.slotId
      );

      if (!booking.details.cruise.car_park_to_terminal_passengers) {
        booking.details.cruise.car_park_to_terminal_passengers =
          currentCarParkToTerminal.passengerCount;
      }

      if (!booking.details.cruise.terminal_to_car_park_passengers) {
        booking.details.cruise.terminal_to_car_park_passengers =
          currentTerminalToCarPark.passengerCount;
      }

      if (!booking.details.cruise.pickup_pax) {
        booking.details.cruise.pickup_pax = Math.max(
          currentCarParkToTerminal.passengerCount,
          currentTerminalToCarPark.passengerCount
        );
      }

      booking.markModified("details.cruise");
    }

    if (booking.type === "airport") {
      const licensePlate = normalizeString(body.license_plate).toUpperCase();

      if (!licensePlate) {
        throw new Error("License plate is required");
      }

      booking.license_plate = licensePlate;

      const currentAirportShuttleTime = normalizeString(
        booking.details?.airport?.shuttle_time
      );

      const requestedShuttleTime = normalizeString(body.shuttle_time);
      const requestedSlotId = normalizeString(body.shuttle_slot_id);

      if (currentAirportShuttleTime || requestedShuttleTime || requestedSlotId) {
        const selected = await validateAirportShuttleChange({
          booking,
          shuttleTime: requestedShuttleTime || currentAirportShuttleTime,
          slotId: requestedSlotId,
        });

        booking.details.airport.shuttle_time = selected.shuttleTime;
        booking.details.airport.shuttle_slot_id = normalizeObjectId(
          selected.slotId
        );

        booking.markModified("details.airport");
      }
    }

    if (booking.type === "storage") {
      const reference = normalizeString(
        body.reference || body.license_plate
      ).toUpperCase();

      if (!reference) {
        throw new Error("Reference / License Plate is required");
      }

      booking.reference = reference;
    }

    booking.updated_by = authUser.id;

    await booking.save();
    await populateBooking(booking);

    return Response.json({
      success: true,
      message: "Booking updated successfully",
      data: {
        booking,
      },
    });
  } catch (error) {
    console.error("Customer booking update failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update booking",
        error: error.message || "Failed to update booking",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}