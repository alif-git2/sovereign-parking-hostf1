import mongoose from "mongoose";
import StorageType from "@/app/backend/models/storagetype";
import Booking from "@/app/backend/models/booking";
import { requireAdminUser } from "@/app/backend/utils/authToken";

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("authorization") || value.includes("token")) return 401;
  if (value.includes("admin")) return 403;
  if (value.includes("not found")) return 404;
  if (value.includes("already exists") || value.includes("duplicate")) return 409;
  if (value.includes("booking")) return 409;

  return 400;
}

function buildStorageTypeFilter(searchParams) {
  const filter = {};
  const search = searchParams.get("search");

  if (search) {
    filter.name = {
      $regex: search,
      $options: "i",
    };
  }

  return filter;
}

function buildStorageTypeIdentifierFilter(storageTypeId) {
  const id = decodeURIComponent(String(storageTypeId || "").trim());

  if (!id) {
    throw new Error("Storage type ID is required");
  }

  if (mongoose.Types.ObjectId.isValid(id)) {
    return { _id: id };
  }

  return { name: id };
}

/**
 * Validate and normalize storage type capacity.
 *
 * Rules:
 * - 0 = Unlimited bookings
 * - Greater than 0 = Maximum number of overlapping bookings
 * - Must be a whole number
 * - Cannot be negative
 *
 * If capacity is missing or empty, it defaults to 0 (Unlimited).
 */
function normalizeStorageTypeCapacity(value) {
  const isEmpty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "");

  if (isEmpty) {
    return 0;
  }

  const capacity = Number(value);

  if (!Number.isFinite(capacity)) {
    throw new Error("Storage type capacity must be a valid number");
  }

  if (!Number.isInteger(capacity)) {
    throw new Error("Storage type capacity must be a whole number");
  }

  if (capacity < 0) {
    throw new Error("Storage type capacity cannot be negative");
  }

  return capacity;
}

/**
 * Public/customer storage type listing.
 * Used by /booking/storage page.
 *
 * Route:
 * GET /backend/router/storagetypes
 */
export async function getStorageTypes(req) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = buildStorageTypeFilter(searchParams);

    const storageTypes = await StorageType.find(filter).sort({
      name: 1,
    });

    return Response.json({
      success: true,
      data: storageTypes,
    });
  } catch (error) {
    console.error("Fetch storage types failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch storage types",
        error: error.message || "Failed to fetch storage types",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Admin storage type listing.
 *
 * Route:
 * GET /backend/router/admin/storage-types
 */
export async function getAdminStorageTypes(req) {
  try {
    await requireAdminUser(req);

    const { searchParams } = new URL(req.url);

    const page = Math.max(Number(searchParams.get("page") || 1), 1);

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 50), 1),
      100
    );

    const filter = buildStorageTypeFilter(searchParams);

    const [storageTypes, total] = await Promise.all([
      StorageType.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      StorageType.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        storageTypes,
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
    console.error("Admin storage types fetch failed:", error);

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
 * Admin create storage type.
 *
 * Capacity rules:
 * - 0 = Unlimited
 * - > 0 = Maximum overlapping bookings
 *
 * Route:
 * POST /backend/router/admin/storage-types
 */
export async function createStorageType(req) {
  try {
    await requireAdminUser(req);

    const body = await req.json();

    const name = String(body.name || "").trim();

    // If capacity is not provided, default to 0 = Unlimited.
    const capacity = normalizeStorageTypeCapacity(body.capacity);

    if (!name) {
      throw new Error("Storage type name is required");
    }

    if (name.length < 2) {
      throw new Error("Storage type name must be at least 2 characters");
    }

    const existing = await StorageType.findOne({
      name,
    }).collation({
      locale: "en",
      strength: 2,
    });

    if (existing) {
      throw new Error("Storage type already exists");
    }

    const storageType = await StorageType.create({
      name,
      capacity,
    });

    return Response.json(
      {
        success: true,
        message: "Storage type created successfully",
        data: storageType,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin storage type creation failed:", error);

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
 * Admin update storage type.
 *
 * Allows updating:
 * - Storage type name
 * - Storage type capacity
 *
 * Capacity rules:
 * - 0 = Unlimited
 * - > 0 = Maximum overlapping bookings
 *
 * Route:
 * PATCH /backend/router/admin/storage-types/[storageTypeId]
 */
export async function updateStorageType(req, storageTypeId) {
  try {
    await requireAdminUser(req);

    const storageType = await StorageType.findOne(
      buildStorageTypeIdentifierFilter(storageTypeId)
    );

    if (!storageType) {
      throw new Error("Storage type not found");
    }

    const body = await req.json();

    const hasName = Object.prototype.hasOwnProperty.call(body, "name");

    const hasCapacity = Object.prototype.hasOwnProperty.call(
      body,
      "capacity"
    );

    if (!hasName && !hasCapacity) {
      throw new Error(
        "At least one field is required to update the storage type"
      );
    }

    /**
     * Update name.
     */
    if (hasName) {
      const name = String(body.name || "").trim();

      if (!name) {
        throw new Error("Storage type name is required");
      }

      if (name.length < 2) {
        throw new Error(
          "Storage type name must be at least 2 characters"
        );
      }

      const existing = await StorageType.findOne({
        _id: {
          $ne: storageType._id,
        },
        name,
      }).collation({
        locale: "en",
        strength: 2,
      });

      if (existing) {
        throw new Error("Storage type already exists");
      }

      storageType.name = name;
    }

    /**
     * Update capacity.
     *
     * 0 = Unlimited
     */
    if (hasCapacity) {
      storageType.capacity = normalizeStorageTypeCapacity(
        body.capacity
      );
    }

    await storageType.save();

    return Response.json({
      success: true,
      message: "Storage type updated successfully",
      data: storageType,
    });
  } catch (error) {
    console.error("Admin storage type update failed:", error);

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
 * Admin permanently delete storage type.
 *
 * Route:
 * DELETE /backend/router/admin/storage-types/[storageTypeId]
 */
export async function deleteStorageType(req, storageTypeId) {
  try {
    await requireAdminUser(req);

    const storageType = await StorageType.findOne(
      buildStorageTypeIdentifierFilter(storageTypeId)
    );

    if (!storageType) {
      throw new Error("Storage type not found");
    }

    const usedBookingCount = await Booking.countDocuments({
      "details.storage.storage_type_id": storageType._id,
    });

    if (usedBookingCount > 0) {
      throw new Error(
        `This storage type cannot be deleted because ${usedBookingCount} booking(s) are using it.`
      );
    }

    await StorageType.deleteOne({
      _id: storageType._id,
    });

    return Response.json({
      success: true,
      message: "Storage type permanently deleted successfully",
      data: {
        deleted_storage_type_id: storageType._id,
        deleted_storage_type_name: storageType.name,
      },
    });
  } catch (error) {
    console.error("Admin storage type delete failed:", error);

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