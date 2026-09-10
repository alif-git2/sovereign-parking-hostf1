import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import Setting from "@/app/backend/models/settings";
import Booking from "@/app/backend/models/booking";
import Location from "@/app/backend/models/location";

export const runtime = "nodejs";

const GLOBAL_SETTING_ID = "global_config";

const EXCLUDED_BOOKING_STATUSES = [
  "cancelled",
  "canceled",
  "cancelled_by_admin",
  "cancelled_by_customer",
  "cancellation_approved",
  "refunded",
  "refund",
  "rejected",
  "deleted",
  "failed",
  "expired",
];

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

function formatDateKey(date) {
  const parsed = parseDateOnly(date);

  if (!parsed) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeCount(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}

function getSlotTime(slot) {
  return String(slot?.time || slot?.shuttle_time || slot?.label || "")
    .trim();
}

function getBookingShuttleTime(booking) {
  return String(
    booking?.details?.airport?.shuttle_time ||
      booking?.details?.airport?.time ||
      booking?.details?.shuttle_time ||
      booking?.airport?.shuttle_time ||
      booking?.shuttle_time ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getBookingPax(booking) {
  return normalizeCount(
    booking?.details?.airport?.pickup_pax ||
      booking?.details?.airport?.pax ||
      booking?.pickup_pax ||
      booking?.pax ||
      1
  );
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

export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    const locationId = String(searchParams.get("location_id") || "").trim();
    const dateValue =
      searchParams.get("date") ||
      searchParams.get("start_date") ||
      searchParams.get("entry_date");

    if (!locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
      throw new Error("Valid airport location_id is required");
    }

    if (!dateValue) {
      throw new Error("Entry date is required");
    }

    const entryDate = parseDateOnly(dateValue);

    if (!entryDate) {
      throw new Error("Invalid entry date");
    }

    const nextDate = new Date(entryDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const dateKey = formatDateKey(entryDate);
    const locationObjectId = new mongoose.Types.ObjectId(locationId);

    const location = await Location.findOne({
      _id: locationObjectId,
      type: "airport",
      is_active: true,
    }).lean();

    if (!location) {
      throw new Error("Airport location not found");
    }

    const shuttleEnabled = Boolean(
      location.show_shuttle_options ||
        location.see_shuttle_options ||
        location.has_shuttle_options
    );

    if (!shuttleEnabled) {
      return Response.json({
        success: true,
        data: {
          shuttle_time_slots: [],
          available_shuttle_slots: [],
          meta: {
            location_id: locationId,
            date: dateKey,
            shuttle_enabled: false,
            bookings_counted: 0,
          },
        },
      });
    }

    const settings = await getSettingsDocument();

    const templateSlots = Array.isArray(settings.shuttle_time_slots)
      ? settings.shuttle_time_slots
          .filter((slot) => {
            return slot?.type === "airport" && slot?.is_active !== false;
          })
          .map((slot) => {
            const time = getSlotTime(slot);
            const capacity = normalizeCount(
              slot.capacity || settings.default_shuttle_slot_capacity || 11
            );

            return {
              _id: slot._id,
              type: "airport",
              time,
              shuttle_time: time,
              capacity,
              is_active: true,
            };
          })
          .filter((slot) => slot.time && slot.capacity > 0)
      : [];

    if (templateSlots.length === 0) {
      return Response.json({
        success: true,
        data: {
          shuttle_time_slots: [],
          available_shuttle_slots: [],
          meta: {
            location_id: locationId,
            date: dateKey,
            shuttle_enabled: true,
            bookings_counted: 0,
          },
        },
      });
    }

    const bookings = await Booking.find({
      type: "airport",
      status: {
        $nin: EXCLUDED_BOOKING_STATUSES,
      },
      $and: [
        {
          $or: [
            { location_id: locationObjectId },
            { location_id: locationId },
          ],
        },
        {
          $or: [
            {
              start_date: {
                $gte: entryDate,
                $lt: nextDate,
              },
            },
            { start_date: dateKey },
            { entry_date: dateKey },
            { "details.airport.start_date": dateKey },
            { "details.airport.entry_date": dateKey },
            { "details.airport.date": dateKey },
          ],
        },
      ],
    })
      .select(
        "booking_id type status location_id start_date entry_date pax pickup_pax shuttle_time details"
      )
      .lean();

    const bookedByTime = new Map();

    bookings.forEach((booking) => {
      const timeKey = getBookingShuttleTime(booking);

      if (!timeKey) return;

      const pax = getBookingPax(booking);

      bookedByTime.set(timeKey, (bookedByTime.get(timeKey) || 0) + pax);
    });

    const availableSlots = templateSlots.map((slot) => {
      const timeKey = getSlotTime(slot).toLowerCase();
      const bookedCount = normalizeCount(bookedByTime.get(timeKey) || 0);
      const capacity = normalizeCount(slot.capacity);
      const remaining = Math.max(capacity - bookedCount, 0);

      return {
        _id: slot._id,
        type: "airport",
        time: slot.time,
        shuttle_time: slot.shuttle_time,
        capacity,
        booked_count: bookedCount,
        remaining,
        is_active: true,
      };
    });

    return Response.json({
      success: true,
      data: {
        shuttle_time_slots: availableSlots,
        available_shuttle_slots: availableSlots,
        meta: {
          location_id: locationId,
          date: dateKey,
          shuttle_enabled: true,
          bookings_counted: bookings.length,
        },
      },
    });
  } catch (error) {
    console.error("Airport shuttle availability failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load airport shuttle availability",
        error: error.message || "Failed to load airport shuttle availability",
      },
      { status: 400 }
    );
  }
}