import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import Booking from "@/app/backend/models/booking";
import StorageType from "@/app/backend/models/storagetype";
import Location from "@/app/backend/models/location";

export const runtime = "nodejs";

const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "pending_payment",
  "success",
  "confirmed",
  "poa",
];

function parseBookingDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    );
  }

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    const [year, month, day] = value
      .slice(0, 10)
      .split("-")
      .map(Number);

    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  );
}

function normalizeCapacity(value) {
  const number = Number(value || 0);

  if (
    !Number.isFinite(number) ||
    !Number.isInteger(number) ||
    number < 0
  ) {
    return 0;
  }

  return number;
}

/**
 * Check Storage availability before customer/admin continues.
 *
 * Route:
 * GET /backend/router/storage-availability
 *
 * Query:
 * ?storage_type_id=...
 * &location_id=...
 * &start_date=YYYY-MM-DD
 * &end_date=YYYY-MM-DD
 *
 * Storage Type capacity:
 * 0 = Unlimited
 * > 0 = Maximum overlapping bookings
 *
 * Storage dates are inclusive:
 * - 09 Sep -> 09 Sep = 1 day
 * - 04 Sep -> 05 Sep = 2 days
 */
export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    const storageTypeId = String(
      searchParams.get("storage_type_id") || ""
    ).trim();

    const locationId = String(
      searchParams.get("location_id") || ""
    ).trim();

    const startDateValue = String(
      searchParams.get("start_date") || ""
    ).trim();

    const endDateValue = String(
      searchParams.get("end_date") || ""
    ).trim();

    if (!storageTypeId) {
      return Response.json(
        {
          success: false,
          message: "Storage type is required",
        },
        { status: 400 }
      );
    }

    if (!locationId) {
      return Response.json(
        {
          success: false,
          message: "Storage location is required",
        },
        { status: 400 }
      );
    }

    if (!startDateValue || !endDateValue) {
      return Response.json(
        {
          success: false,
          message: "Entry date and exit date are required",
        },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(storageTypeId)) {
      return Response.json(
        {
          success: false,
          message: "Invalid storage type",
        },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(locationId)) {
      return Response.json(
        {
          success: false,
          message: "Invalid storage location",
        },
        { status: 400 }
      );
    }

    const startDate = parseBookingDate(startDateValue);
    const endDate = parseBookingDate(endDateValue);

    if (
      !startDate ||
      !endDate ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      return Response.json(
        {
          success: false,
          message: "Invalid date format",
        },
        { status: 400 }
      );
    }

    /**
     * Same-day Storage booking is valid.
     * Only reject an exit date that is before the entry date.
     */
    if (endDate < startDate) {
      return Response.json(
        {
          success: false,
          message: "Exit date cannot be before entry date",
        },
        { status: 400 }
      );
    }

    const [storageType, location] = await Promise.all([
      StorageType.findById(storageTypeId),
      Location.findById(locationId),
    ]);

    if (!storageType) {
      return Response.json(
        {
          success: false,
          message: "Storage type not found",
        },
        { status: 404 }
      );
    }

    if (!location) {
      return Response.json(
        {
          success: false,
          message: "Storage location not found",
        },
        { status: 404 }
      );
    }

    if (location.type !== "storage") {
      return Response.json(
        {
          success: false,
          message: "Selected location is not a storage location",
        },
        { status: 400 }
      );
    }

    if (location.is_active === false) {
      return Response.json(
        {
          success: false,
          message: "Selected storage location is not active",
        },
        { status: 400 }
      );
    }

    const storageTypeCapacity = normalizeCapacity(
      storageType.capacity
    );

    /*
     * Storage Type capacity is global.
     *
     * Example:
     * Caravan capacity = 5
     *
     * This counts overlapping Caravan bookings across
     * all Storage locations.
     *
     * Inclusive overlap:
     * Existing 09 -> 09 and requested 09 -> 09 overlap.
     * Existing 04 -> 05 and requested 05 -> 06 overlap on the 5th.
     */
    let storageTypeBookedCount = 0;
    let storageTypeRemaining = null;
    let storageTypeAvailable = true;
    let storageTypeUnlimited = false;

    if (storageTypeCapacity === 0) {
      storageTypeUnlimited = true;
    } else {
      storageTypeBookedCount =
        await Booking.countDocuments({
          type: "storage",

          "details.storage.storage_type_id":
            new mongoose.Types.ObjectId(storageTypeId),

          status: {
            $in: ACTIVE_BOOKING_STATUSES,
          },

          start_date: {
            $lte: endDate,
          },

          end_date: {
            $gte: startDate,
          },
        });

      storageTypeRemaining = Math.max(
        storageTypeCapacity - storageTypeBookedCount,
        0
      );

      storageTypeAvailable =
        storageTypeBookedCount < storageTypeCapacity;
    }

    /*
     * Existing Storage Location capacity.
     *
     * This remains a separate overall limit.
     * Inclusive overlap uses the same date semantics.
     */
    const locationCapacity = normalizeCapacity(
      location.capacity
    );

    let locationBookedCount = 0;
    let locationRemaining = null;
    let locationAvailable = true;
    let locationUnlimited = false;

    if (locationCapacity === 0) {
      locationUnlimited = true;
    } else {
      locationBookedCount =
        await Booking.countDocuments({
          type: "storage",

          location_id: new mongoose.Types.ObjectId(
            locationId
          ),

          status: {
            $in: ACTIVE_BOOKING_STATUSES,
          },

          start_date: {
            $lte: endDate,
          },

          end_date: {
            $gte: startDate,
          },
        });

      locationRemaining = Math.max(
        locationCapacity - locationBookedCount,
        0
      );

      locationAvailable =
        locationBookedCount < locationCapacity;
    }

    const available =
      storageTypeAvailable && locationAvailable;

    let message = "Storage is available";

    if (!storageTypeAvailable) {
      message = `${storageType.name} storage is fully booked for the selected dates`;
    } else if (!locationAvailable) {
      message = `${location.name} has no storage slots available for the selected dates`;
    }

    return Response.json({
      success: true,

      available,

      message,

      data: {
        available,

        storage_type: {
          _id: storageType._id,
          name: storageType.name,

          capacity: storageTypeCapacity,

          booked_count: storageTypeBookedCount,

          remaining: storageTypeRemaining,

          unlimited: storageTypeUnlimited,

          available: storageTypeAvailable,
        },

        location: {
          _id: location._id,
          name: location.name,

          capacity: locationCapacity,

          booked_count: locationBookedCount,

          remaining: locationRemaining,

          unlimited: locationUnlimited,

          available: locationAvailable,
        },

        dates: {
          start_date: startDateValue,
          end_date: endDateValue,
        },
      },
    });
  } catch (error) {
    console.error(
      "Storage availability check failed:",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          error.message ||
          "Failed to check storage availability",
        error:
          error.message ||
          "Failed to check storage availability",
      },
      { status: 500 }
    );
  }
}
