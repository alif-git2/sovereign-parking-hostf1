import mongoose from "mongoose";
import CruiseSchedule from "@/app/backend/models/cruiseschedule";
import Location from "@/app/backend/models/location";
import Booking from "@/app/backend/models/booking";
import Setting from "@/app/backend/models/settings";
import { requireAdminUser } from "@/app/backend/utils/authToken";

const GLOBAL_SETTING_ID = "global_config";

const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "pending_payment",
  "success",
  "confirmed",
  "poa",
];

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("authorization") || value.includes("token")) return 401;
  if (value.includes("admin")) return 403;
  if (value.includes("not found")) return 404;
  if (value.includes("already exists")) return 409;
  if (value.includes("cannot be deleted")) return 409;
  if (value.includes("booking")) return 409;

  return 400;
}

function normalizeBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
}

function normalizeNumber(value, defaultValue = 0) {
  const number = Number(value ?? defaultValue);

  if (!Number.isFinite(number)) {
    return defaultValue;
  }

  return number;
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSlotTime(slot) {
  return normalizeString(slot?.time || slot?.shuttle_time);
}

function parseScheduleDate(value, label) {
  if (!value) {
    throw new Error(`${label} is required`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label.toLowerCase()}`);
  }

  return date;
}

function getDayStart(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getDayEnd(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getScheduleDurationDays(schedule) {
  const departureDate = new Date(schedule?.departure_date);
  const returnDate = new Date(schedule?.return_date);

  if (
    Number.isNaN(departureDate.getTime()) ||
    Number.isNaN(returnDate.getTime()) ||
    returnDate <= departureDate
  ) {
    return 0;
  }

  return Math.ceil((returnDate - departureDate) / (1000 * 60 * 60 * 24));
}

function normalizeDaysRange(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const days = Number(value);

  if (!Number.isInteger(days) || days < 1 || days > 30) {
    throw new Error("Days range must be between 1 and 30 days");
  }

  return days;
}

function buildScheduleIdentifierFilter(scheduleId) {
  const id = decodeURIComponent(String(scheduleId || "").trim());

  if (!id) {
    throw new Error("Cruise schedule ID is required");
  }

  if (mongoose.Types.ObjectId.isValid(id)) {
    return { _id: id };
  }

  return { schedule_name: id };
}

function buildScheduleFilter(searchParams) {
  const filter = {};

  const search = normalizeString(searchParams.get("search"));
  const locationId = normalizeString(searchParams.get("location_id"));
  const isActive = searchParams.get("is_active");

  const departureFrom = normalizeString(searchParams.get("departure_from"));
  const departureTo = normalizeString(searchParams.get("departure_to"));

  const arrivalDate = normalizeString(
    searchParams.get("arrival_date") ||
      searchParams.get("return_date") ||
      searchParams.get("ship_arrival_date")
  );

  const arrivalFrom = normalizeString(
    searchParams.get("arrival_from") ||
      searchParams.get("return_from") ||
      searchParams.get("ship_arrival_from")
  );

  const arrivalTo = normalizeString(
    searchParams.get("arrival_to") ||
      searchParams.get("return_to") ||
      searchParams.get("ship_arrival_to")
  );

  const daysRange = normalizeDaysRange(
    searchParams.get("days_range") || searchParams.get("days")
  );

  if (locationId) {
    if (!mongoose.Types.ObjectId.isValid(locationId)) {
      throw new Error("Invalid cruise location");
    }

    filter.location_id = new mongoose.Types.ObjectId(locationId);
  }

  if (isActive !== null && isActive !== "") {
    filter.is_active = isActive === "true";
  }

  if (search) {
    filter.schedule_name = {
      $regex: escapeRegExp(search),
      $options: "i",
    };
  }

  if (departureFrom || departureTo) {
    filter.departure_date = {};

    if (departureFrom) {
      const fromDate = getDayStart(departureFrom);

      if (fromDate) {
        filter.departure_date.$gte = fromDate;
      }
    }

    if (departureTo) {
      const toDate = getDayEnd(departureTo);

      if (toDate) {
        filter.departure_date.$lte = toDate;
      }
    }

    if (Object.keys(filter.departure_date).length === 0) {
      delete filter.departure_date;
    }
  }

  /**
   * Ship Arrival Date filter.
   *
   * Frontend sends:
   * - arrival_date
   * - return_date
   * - ship_arrival_date
   *
   * This filters exact selected arrival day.
   */
  if (arrivalDate) {
    const start = getDayStart(arrivalDate);
    const end = getDayEnd(arrivalDate);

    if (start && end) {
      filter.return_date = {
        $gte: start,
        $lte: end,
      };
    }
  } else if (arrivalFrom || arrivalTo) {
    filter.return_date = {};

    if (arrivalFrom) {
      const fromDate = getDayStart(arrivalFrom);

      if (fromDate) {
        filter.return_date.$gte = fromDate;
      }
    }

    if (arrivalTo) {
      const toDate = getDayEnd(arrivalTo);

      if (toDate) {
        filter.return_date.$lte = toDate;
      }
    }

    if (Object.keys(filter.return_date).length === 0) {
      delete filter.return_date;
    }
  }

  if (daysRange !== null) {
    filter.$expr = {
      $eq: [
        {
          $dateDiff: {
            startDate: "$departure_date",
            endDate: "$return_date",
            unit: "day",
          },
        },
        daysRange,
      ],
    };
  }

  return filter;
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

async function validateCruiseLocation(locationId) {
  const id =
    typeof locationId === "object" && locationId?._id
      ? String(locationId._id)
      : String(locationId || "");

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Valid cruise location is required");
  }

  const location = await Location.findOne({
    _id: id,
    type: "cruise",
    is_active: true,
  });

  if (!location) {
    throw new Error("Active cruise location not found");
  }

  return location;
}

function getCruiseSettingShuttleSlots(settings) {
  const settingSlots = Array.isArray(settings?.shuttle_time_slots)
    ? settings.shuttle_time_slots
    : [];

  const defaultCapacity = normalizeNumber(
    settings?.default_shuttle_slot_capacity,
    11
  );

  return settingSlots
    .filter((slot) => slot?.type === "cruise" && slot?.is_active !== false)
    .map((slot) => {
      const time = getSlotTime(slot);
      const capacity = normalizeNumber(slot.capacity, defaultCapacity);

      return {
        type: "cruise",
        time,
        shuttle_time: time,
        capacity: capacity > 0 ? capacity : defaultCapacity,
        booked_count: 0,
        is_active: true,

        show_car_park_to_terminal:
          slot.show_car_park_to_terminal !== false,
        show_terminal_to_car_park:
          slot.show_terminal_to_car_park !== false,
      };
    })
    .filter((slot) => slot.time && slot.capacity > 0);
}

async function getBookedPaxByScheduleAndShuttleTime(scheduleId) {
  if (!scheduleId) {
    return new Map();
  }

  const result = await Booking.aggregate([
    {
      $match: {
        type: "cruise",
        schedule_id: new mongoose.Types.ObjectId(scheduleId),
        status: {
          $in: ACTIVE_BOOKING_STATUSES,
        },
      },
    },
    {
      $group: {
        _id: "$details.cruise.shuttle_time",
        booked_pax: {
          $sum: {
            $ifNull: ["$details.cruise.pickup_pax", "$pax"],
          },
        },
      },
    },
  ]);

  return new Map(
    result
      .filter((item) => item?._id)
      .map((item) => [
        String(item._id).trim().toLowerCase(),
        normalizeCount(item.booked_pax),
      ])
  );
}

function serializeShuttleSlot(slot) {
  const time = getSlotTime(slot);
  const capacity = normalizeCount(slot?.capacity);
  const bookedCount = normalizeCount(slot?.booked_count);

  return {
    _id: slot?._id,
    type: slot?.type || "cruise",
    time,
    shuttle_time: time,
    capacity,
    booked_count: bookedCount,
    remaining: Math.max(capacity - bookedCount, 0),

    show_car_park_to_terminal:
      slot?.show_car_park_to_terminal !== false,
    show_terminal_to_car_park:
      slot?.show_terminal_to_car_park !== false,

    is_active: slot?.is_active !== false,
  };
}

/**
 * Builds live cruise shuttle availability for API responses.
 *
 * Important:
 * Do NOT save inside GET/list requests.
 * Saving here can cause Mongoose VersionError when multiple pages load schedules
 * at the same time.
 */
async function syncCruiseScheduleShuttleSlots(schedule, settings) {
  if (!schedule) return schedule;

  const templates = getCruiseSettingShuttleSlots(settings);

  if (templates.length === 0) {
    schedule.shuttle_slots = [];
    schedule.shuttle_times = [];
    schedule.booked_count = 0;
    return schedule;
  }

  const bookedCountMap = await getBookedPaxByScheduleAndShuttleTime(
    schedule._id
  );

  const existingSlots = Array.isArray(schedule.shuttle_slots)
    ? schedule.shuttle_slots
    : [];

  const existingByTime = new Map(
    existingSlots
      .filter((slot) => getSlotTime(slot))
      .map((slot) => [getSlotTime(slot).toLowerCase(), slot])
  );

  const syncedSlots = templates.map((template) => {
    const timeKey = getSlotTime(template).toLowerCase();
    const existingSlot = existingByTime.get(timeKey);
    const bookedCount = bookedCountMap.get(timeKey) || 0;

    return {
      _id: existingSlot?._id || new mongoose.Types.ObjectId(),
      type: "cruise",
      time: template.time,
      shuttle_time: template.shuttle_time,
      capacity: template.capacity,
      booked_count: bookedCount,
      is_active: true,

      show_car_park_to_terminal:
        template.show_car_park_to_terminal !== false,
      show_terminal_to_car_park:
        template.show_terminal_to_car_park !== false,
    };
  });

  const totalBookedBookings = await Booking.countDocuments({
    type: "cruise",
    schedule_id: schedule._id,
    status: {
      $in: ACTIVE_BOOKING_STATUSES,
    },
  });

  schedule.shuttle_slots = syncedSlots;
  schedule.shuttle_times = syncedSlots.map((slot) => slot.shuttle_time);
  schedule.booked_count = totalBookedBookings;

  return schedule;
}

async function buildCruiseSchedulePayload(
  body = {},
  settings,
  existingSchedule = null
) {
  const rawLocationId =
    body.location_id !== undefined
      ? body.location_id
      : existingSchedule?.location_id;

  const location = await validateCruiseLocation(rawLocationId);

  const scheduleName =
    body.ship_name !== undefined
      ? body.ship_name
      : body.schedule_name !== undefined
      ? body.schedule_name
      : existingSchedule?.schedule_name;

  const departureDateValue =
    body.departure_date !== undefined
      ? body.departure_date
      : body.ship_departure_date !== undefined
      ? body.ship_departure_date
      : existingSchedule?.departure_date;

  const returnDateValue =
    body.return_date !== undefined
      ? body.return_date
      : body.arrival_date !== undefined
      ? body.arrival_date
      : body.ship_arrival_date !== undefined
      ? body.ship_arrival_date
      : existingSchedule?.return_date;

  const capacity =
    body.capacity !== undefined
      ? normalizeNumber(body.capacity, 1)
      : Number(existingSchedule?.capacity || 1);

  const bookedCount =
    body.booked_count !== undefined
      ? normalizeNumber(body.booked_count, 0)
      : Number(existingSchedule?.booked_count || 0);

  const departureDate = parseScheduleDate(
    departureDateValue,
    "Ship departure date"
  );

  const returnDate = parseScheduleDate(returnDateValue, "Ship arrival date");

  const payload = {
    location_id: location._id,
    schedule_name: normalizeString(scheduleName),
    schedule_type: "cruise",
    departure_date: departureDate,
    return_date: returnDate,
    capacity,
    booked_count: bookedCount,

    // Compatibility only. Price now comes from Settings -> Prices Per Day.
    price_per_slot: 0,

    is_active:
      body.is_active !== undefined
        ? normalizeBoolean(body.is_active, true)
        : existingSchedule?.is_active ?? true,
  };

  if (!existingSchedule) {
    const shuttleSlots = getCruiseSettingShuttleSlots(settings);

    payload.shuttle_slots = shuttleSlots;
    payload.shuttle_times = shuttleSlots.map((slot) => slot.shuttle_time);
  }

  if (!payload.schedule_name) {
    throw new Error("Ship name is required");
  }

  if (payload.return_date <= payload.departure_date) {
    throw new Error("Ship arrival date must be after ship departure date");
  }

  if (!Number.isFinite(payload.capacity) || payload.capacity < 1) {
    throw new Error("Capacity must be at least 1");
  }

  if (!Number.isFinite(payload.booked_count) || payload.booked_count < 0) {
    throw new Error("Booked count cannot be negative");
  }

  if (payload.booked_count > payload.capacity) {
    throw new Error("Booked count cannot be greater than capacity");
  }

  return payload;
}

function serializeCruiseSchedule(schedule) {
  if (!schedule) return null;

  const item =
    typeof schedule.toObject === "function"
      ? schedule.toObject({ virtuals: true, versionKey: false })
      : { ...schedule };

  const shuttleSlots = Array.isArray(item.shuttle_slots)
    ? item.shuttle_slots
    : [];

  const durationDays = getScheduleDurationDays(item);

  item.ship_name = item.schedule_name;
  item.duration_days = durationDays;
  item.days = durationDays;

  item.shuttle_slots = shuttleSlots.map(serializeShuttleSlot);
  item.shuttle_times = item.shuttle_slots.map((slot) => slot.shuttle_time);

  return item;
}

/**
 * Public/customer cruise schedule listing.
 * Used by customer cruise booking pages.
 */
export async function getCruiseSchedules(req) {
  try {
    const { searchParams } = new URL(req.url);

    const filter = buildScheduleFilter(searchParams);

    if (searchParams.get("include_inactive") !== "true") {
      filter.is_active = true;
    }

    const summaryOnly = searchParams.get("summary") === "true";

    if (summaryOnly) {
      const schedules = await CruiseSchedule.find(filter)
        .select(
          "_id schedule_name departure_date return_date location_id is_active"
        )
        .populate("location_id", "name type is_active")
        .sort({ departure_date: 1 })
        .lean();

      return Response.json({
        success: true,
        data: schedules.map((schedule) => ({
          ...schedule,
          ship_name: schedule.schedule_name,
        })),
      });
    }

    const settings = await getSettingsDocument();

    const schedules = await CruiseSchedule.find(filter)
      .populate("location_id", "name type is_active")
      .sort({ departure_date: 1 });

    const syncedSchedules = await Promise.all(
      schedules.map((schedule) =>
        syncCruiseScheduleShuttleSlots(schedule, settings)
      )
    );

    return Response.json({
      success: true,
      data: syncedSchedules.map(serializeCruiseSchedule),
    });
  } catch (error) {
    console.error("Fetch cruise schedules failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message,
        error: error.message,
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Admin cruise schedule listing.
 */
export async function getAdminCruiseSchedules(req) {
  try {
    await requireAdminUser(req);

    const { searchParams } = new URL(req.url);

    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 20), 1),
      100
    );

    const filter = buildScheduleFilter(searchParams);
    const settings = await getSettingsDocument();

    const [schedules, total, breakdown] = await Promise.all([
      CruiseSchedule.find(filter)
        .populate("location_id", "name type is_active")
        .sort({ departure_date: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      CruiseSchedule.countDocuments(filter),

      CruiseSchedule.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$is_active",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            is_active: "$_id",
            count: 1,
          },
        },
      ]),
    ]);

    const syncedSchedules = await Promise.all(
      schedules.map((schedule) =>
        syncCruiseScheduleShuttleSlots(schedule, settings)
      )
    );

    return Response.json({
      success: true,
      data: {
        schedules: syncedSchedules.map(serializeCruiseSchedule),
        breakdown,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.max(Math.ceil(total / limit), 1),
          has_prev_page: page > 1,
          has_next_page: page < Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Admin cruise schedules fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message,
        error: error.message,
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Admin create cruise schedule.
 */
export async function createCruiseSchedule(req) {
  try {
    await requireAdminUser(req);

    const body = await req.json();
    const settings = await getSettingsDocument();

    const payload = await buildCruiseSchedulePayload(body, settings);

    const existing = await CruiseSchedule.findOne({
      location_id: payload.location_id,
      schedule_name: payload.schedule_name,
      departure_date: payload.departure_date,
    }).collation({
      locale: "en",
      strength: 2,
    });

    if (existing) {
      throw new Error("Cruise schedule already exists");
    }

    const schedule = await CruiseSchedule.create(payload);

    const populatedSchedule = await CruiseSchedule.findById(
      schedule._id
    ).populate("location_id", "name type is_active");

    const syncedSchedule = await syncCruiseScheduleShuttleSlots(
      populatedSchedule,
      settings
    );

    return Response.json(
      {
        success: true,
        message: "Cruise schedule created successfully",
        data: serializeCruiseSchedule(syncedSchedule),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin cruise schedule creation failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message,
        error: error.message,
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Admin update cruise schedule.
 */
export async function updateCruiseSchedule(req, scheduleId) {
  try {
    await requireAdminUser(req);

    const body = await req.json();
    const settings = await getSettingsDocument();

    const schedule = await CruiseSchedule.findOne(
      buildScheduleIdentifierFilter(scheduleId)
    );

    if (!schedule) {
      throw new Error("Cruise schedule not found");
    }

    const payload = await buildCruiseSchedulePayload(body, settings, schedule);

    const duplicate = await CruiseSchedule.findOne({
      _id: { $ne: schedule._id },
      location_id: payload.location_id,
      schedule_name: payload.schedule_name,
      departure_date: payload.departure_date,
    }).collation({
      locale: "en",
      strength: 2,
    });

    if (duplicate) {
      throw new Error("Cruise schedule already exists");
    }

    Object.assign(schedule, payload);

    await schedule.save();

    const updatedSchedule = await CruiseSchedule.findById(
      schedule._id
    ).populate("location_id", "name type is_active");

    const syncedSchedule = await syncCruiseScheduleShuttleSlots(
      updatedSchedule,
      settings
    );

    return Response.json({
      success: true,
      message: "Cruise schedule updated successfully",
      data: serializeCruiseSchedule(syncedSchedule),
    });
  } catch (error) {
    console.error("Admin cruise schedule update failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message,
        error: error.message,
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Admin permanent delete cruise schedule.
 * Deletion is blocked if bookings already use the schedule.
 */
export async function deleteCruiseSchedule(req, scheduleId) {
  try {
    await requireAdminUser(req);

    const schedule = await CruiseSchedule.findOne(
      buildScheduleIdentifierFilter(scheduleId)
    );

    if (!schedule) {
      throw new Error("Cruise schedule not found");
    }

    const usedBookingCount = await Booking.countDocuments({
      schedule_id: schedule._id,
    });

    if (usedBookingCount > 0 || Number(schedule.booked_count || 0) > 0) {
      throw new Error(
        `This cruise schedule cannot be deleted because ${
          usedBookingCount || schedule.booked_count
        } booking(s) are using it.`
      );
    }

    await CruiseSchedule.deleteOne({
      _id: schedule._id,
    });

    return Response.json({
      success: true,
      message: "Cruise schedule permanently deleted successfully",
      data: {
        deleted_schedule_id: schedule._id,
        deleted_schedule_name: schedule.schedule_name,
      },
    });
  } catch (error) {
    console.error("Admin cruise schedule delete failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message,
        error: error.message,
      },
      { status: getErrorStatus(error.message) }
    );
  }
}