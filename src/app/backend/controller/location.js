import mongoose from "mongoose";
import Location from "@/app/backend/models/location";
import Booking from "@/app/backend/models/booking";
import { requireAdminUser } from "@/app/backend/utils/authToken";

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("authorization") || value.includes("token")) return 401;
  if (value.includes("admin")) return 403;
  if (value.includes("not found")) return 404;
  if (value.includes("already exists")) return 409;
  if (value.includes("cannot be permanently deleted")) return 409;
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

  if (!Number.isFinite(number) || number < 0) {
    return defaultValue;
  }

  return number;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStringArray(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => normalizeString(value)).filter(Boolean);
}

function normalizeLocationType(value) {
  const type = normalizeString(value).toLowerCase();

  if (!["airport", "storage", "cruise"].includes(type)) {
    throw new Error("Invalid location type");
  }

  return type;
}

function normalizeShuttleSlots(shuttleSlots = []) {
  if (!Array.isArray(shuttleSlots)) {
    return [];
  }

  return shuttleSlots
    .filter((slot) => slot && slot.time)
    .map((slot) => {
      const capacity = normalizeNumber(slot.capacity, 0);
      const bookedCount = normalizeNumber(slot.booked_count, 0);

      if (bookedCount > capacity) {
        throw new Error(
          `Booked count cannot be greater than capacity for shuttle time ${slot.time}`
        );
      }

      return {
        _id:
          slot._id && mongoose.Types.ObjectId.isValid(slot._id)
            ? slot._id
            : undefined,
        time: normalizeString(slot.time),
        capacity,
        booked_count: bookedCount,
        is_active: normalizeBoolean(slot.is_active, true),
      };
    });
}

function normalizeBlockedDates(blockedDates = []) {
  if (!Array.isArray(blockedDates)) {
    return [];
  }

  return blockedDates
    .filter((item) => item && (item.start_date || item.date))
    .map((item) => {
      const startDate = item.start_date || item.date;
      const endDate = item.end_date || item.date || item.start_date;

      if (!startDate || !endDate) {
        throw new Error("Blocked date start and end date are required");
      }

      const parsedStart = new Date(startDate);
      const parsedEnd = new Date(endDate);

      if (
        Number.isNaN(parsedStart.getTime()) ||
        Number.isNaN(parsedEnd.getTime())
      ) {
        throw new Error("Invalid blocked date format");
      }

      if (parsedEnd < parsedStart) {
        throw new Error("Blocked end date cannot be before blocked start date");
      }

      return {
        _id:
          item._id && mongoose.Types.ObjectId.isValid(item._id)
            ? item._id
            : undefined,
        start_date: startDate,
        end_date: endDate,
        reason: normalizeString(item.reason),
        is_active: normalizeBoolean(item.is_active, true),
      };
    });
}

function normalizeStorageTypes(storageTypes = []) {
  if (!Array.isArray(storageTypes)) {
    return [];
  }

  return storageTypes
    .filter(Boolean)
    .map((item) => {
      if (typeof item === "string") {
        return {
          storage_type_id: item,
          is_active: true,
        };
      }

      return {
        storage_type_id: item.storage_type_id || item._id || item.id,
        is_active: normalizeBoolean(item.is_active, true),
      };
    })
    .filter((item) => mongoose.Types.ObjectId.isValid(item.storage_type_id));
}

function getExistingArray(existingLocation, path) {
  const value = existingLocation?.[path];

  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function buildLocationPayload(body = {}, existingLocation = null) {
  const type =
    body.type !== undefined
      ? normalizeLocationType(body.type)
      : existingLocation?.type;

  if (!type || !["airport", "storage", "cruise"].includes(type)) {
    throw new Error("Invalid location type");
  }

  const payload = {
    name:
      body.name !== undefined
        ? normalizeString(body.name)
        : existingLocation?.name,
    type,
    address:
      body.address !== undefined
        ? normalizeString(body.address)
        : existingLocation?.address || "",
    capacity:
      body.capacity !== undefined
        ? normalizeNumber(body.capacity, 0)
        : normalizeNumber(existingLocation?.capacity, 0),

    // Legacy field only. New booking prices should come from Settings price_rules.
    price_per_day:
      body.price_per_day !== undefined
        ? normalizeNumber(body.price_per_day, 0)
        : normalizeNumber(existingLocation?.price_per_day, 0),

    is_active:
      body.is_active !== undefined
        ? normalizeBoolean(body.is_active, true)
        : existingLocation?.is_active ?? true,

    show_shuttle_options: false,
  };

  if (!payload.name) {
    throw new Error("Location name is required");
  }

  if (type === "airport") {
    payload.show_shuttle_options =
      body.show_shuttle_options !== undefined
        ? normalizeBoolean(body.show_shuttle_options, false)
        : existingLocation?.show_shuttle_options ?? false;

    payload.blocked_dates =
      body.blocked_dates !== undefined
        ? normalizeBlockedDates(body.blocked_dates)
        : getExistingArray(existingLocation, "blocked_dates");

    // Legacy/fallback only. New shuttle slots should come from Settings.
    payload.shuttle_slots =
      body.shuttle_slots !== undefined
        ? normalizeShuttleSlots(body.shuttle_slots)
        : getExistingArray(existingLocation, "shuttle_slots");

    payload.shuttle_times =
      body.shuttle_times !== undefined
        ? normalizeStringArray(body.shuttle_times)
        : normalizeStringArray(existingLocation?.shuttle_times || []);

    payload.storage_types = [];
  }

  if (type === "storage") {
    payload.show_shuttle_options = false;

    payload.storage_types =
      body.storage_types !== undefined
        ? normalizeStorageTypes(body.storage_types)
        : getExistingArray(existingLocation, "storage_types");

    payload.shuttle_slots = [];
    payload.blocked_dates = [];
    payload.shuttle_times =
      body.shuttle_times !== undefined
        ? normalizeStringArray(body.shuttle_times)
        : normalizeStringArray(existingLocation?.shuttle_times || []);
  }

  if (type === "cruise") {
    payload.show_shuttle_options = false;
    payload.shuttle_times =
      body.shuttle_times !== undefined
        ? normalizeStringArray(body.shuttle_times)
        : normalizeStringArray(existingLocation?.shuttle_times || []);

    payload.shuttle_slots = [];
    payload.blocked_dates = [];
    payload.storage_types = [];
  }

  return payload;
}

function buildLocationFilter(searchParams) {
  const filter = {};

  const type = searchParams.get("type");
  const isActive = searchParams.get("is_active");
  const showShuttleOptions = searchParams.get("show_shuttle_options");
  const search = searchParams.get("search");

  if (type && ["airport", "storage", "cruise"].includes(type)) {
    filter.type = type;
  }

  if (isActive !== null && isActive !== "") {
    filter.is_active = isActive === "true";
  }

  if (showShuttleOptions !== null && showShuttleOptions !== "") {
    filter.show_shuttle_options = showShuttleOptions === "true";
  }

  if (search) {
    filter.$or = [
      {
        name: {
          $regex: search,
          $options: "i",
        },
      },
      {
        address: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  return filter;
}

function buildLocationIdentifierFilter(locationId) {
  const id = decodeURIComponent(String(locationId || "").trim());

  if (!id) {
    throw new Error("Location ID is required");
  }

  if (mongoose.Types.ObjectId.isValid(id)) {
    return { _id: id };
  }

  return { name: id };
}

async function attachBookedCountToLocations(locations = []) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return [];
  }

  const locationIds = locations.map((location) => location._id);

  const bookingCounts = await Booking.aggregate([
    {
      $match: {
        location_id: {
          $in: locationIds,
        },
        status: {
          $nin: ["cancelled", "canceled", "deleted"],
        },
      },
    },
    {
      $group: {
        _id: "$location_id",
        booked_count: {
          $sum: 1,
        },
      },
    },
  ]);

  const bookingCountMap = bookingCounts.reduce((map, item) => {
    map[String(item._id)] = Number(item.booked_count || 0);
    return map;
  }, {});

  return locations.map((location) => {
    const item =
      typeof location.toObject === "function" ? location.toObject() : location;

    item.booked_count = bookingCountMap[String(location._id)] || 0;

    return item;
  });
}

/**
 * Public/customer location listing.
 * Used by booking pages.
 */
export async function getLocations(req) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = buildLocationFilter(searchParams);

    if (searchParams.get("include_inactive") !== "true") {
      filter.is_active = true;
    }

    const locations = await Location.find(filter).sort({
      type: 1,
      name: 1,
    });

    return Response.json({
      success: true,
      data: locations,
    });
  } catch (error) {
    console.error("Fetch locations failed:", error);

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
 * Admin location listing.
 */
export async function getAdminLocations(req) {
  try {
    await requireAdminUser(req);

    const { searchParams } = new URL(req.url);

    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 20), 1),
      100
    );

    const filter = buildLocationFilter(searchParams);

    const [locations, total, breakdown] = await Promise.all([
      Location.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Location.countDocuments(filter),

      Location.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            active: {
              $sum: {
                $cond: [{ $eq: ["$is_active", true] }, 1, 0],
              },
            },
            inactive: {
              $sum: {
                $cond: [{ $eq: ["$is_active", false] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            type: "$_id",
            count: 1,
            active: 1,
            inactive: 1,
          },
        },
      ]),
    ]);

    const locationsWithBookedCount = await attachBookedCountToLocations(
      locations
    );

    return Response.json({
      success: true,
      data: {
        locations: locationsWithBookedCount,
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
    console.error("Admin fetch locations failed:", error);

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
 * Admin create location.
 */
export async function createLocation(req) {
  try {
    await requireAdminUser(req);

    const body = await req.json();
    const payload = buildLocationPayload(body);

    const existing = await Location.findOne({
      name: payload.name,
      type: payload.type,
    }).collation({
      locale: "en",
      strength: 2,
    });

    if (existing) {
      throw new Error("Location already exists");
    }

    const location = await Location.create(payload);

    return Response.json(
      {
        success: true,
        message: "Location created successfully",
        data: location,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Location creation failed:", error);

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
 * Admin update location.
 */
export async function updateLocation(req, locationId) {
  try {
    await requireAdminUser(req);

    const body = await req.json();

    const location = await Location.findOne(
      buildLocationIdentifierFilter(locationId)
    );

    if (!location) {
      throw new Error("Location not found");
    }

    const payload = buildLocationPayload(body, location);

    const duplicate = await Location.findOne({
      _id: { $ne: location._id },
      name: payload.name,
      type: payload.type,
    }).collation({
      locale: "en",
      strength: 2,
    });

    if (duplicate) {
      throw new Error("Location already exists");
    }

    Object.assign(location, payload);

    await location.save();

    const updatedLocation = await Location.findById(location._id);

    return Response.json({
      success: true,
      message: "Location updated successfully",
      data: updatedLocation,
    });
  } catch (error) {
    console.error("Location update failed:", error);

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
 * Admin permanent delete location.
 *
 * Important:
 * - This permanently removes unused locations from MongoDB.
 * - If any booking uses this location, deletion is blocked to protect booking history.
 */
export async function deleteLocation(req, locationId) {
  try {
    await requireAdminUser(req);

    const location = await Location.findOne(
      buildLocationIdentifierFilter(locationId)
    );

    if (!location) {
      throw new Error("Location not found");
    }

    const usedBookingCount = await Booking.countDocuments({
      location_id: location._id,
    });

    if (usedBookingCount > 0) {
      throw new Error(
        `This location cannot be permanently deleted because ${usedBookingCount} booking(s) are using it. Delete those bookings first or keep this location.`
      );
    }

    await Location.deleteOne({
      _id: location._id,
    });

    return Response.json({
      success: true,
      message: "Location permanently deleted successfully",
      data: {
        deleted_location_id: location._id,
        deleted_location_name: location.name,
        deleted_location_type: location.type,
      },
    });
  } catch (error) {
    console.error("Location permanent delete failed:", error);

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