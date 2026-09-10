import { connectDB } from "@/app/backend/database/mongodb";
import {
  deleteStorageType,
  updateStorageType,
} from "@/app/backend/controller/storagetype";

export const runtime = "nodejs";

/**
 * Update an existing storage type.
 *
 * Route:
 * PATCH /backend/router/admin/storage-types/[storageTypeId]
 *
 * Example body:
 * {
 *   "name": "Caravan",
 *   "capacity": 10
 * }
 */
export async function PATCH(req, context) {
  try {
    await connectDB();

    const params = await context.params;

    return await updateStorageType(req, params.storageTypeId);
  } catch (error) {
    console.error("Admin storage type PATCH route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update storage type",
        error: error.message || "Failed to update storage type",
      },
      { status: 500 }
    );
  }
}

/**
 * Permanently delete a storage type.
 *
 * Route:
 * DELETE /backend/router/admin/storage-types/[storageTypeId]
 */
export async function DELETE(req, context) {
  try {
    await connectDB();

    const params = await context.params;

    return await deleteStorageType(req, params.storageTypeId);
  } catch (error) {
    console.error("Admin storage type DELETE route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete storage type",
        error: error.message || "Failed to delete storage type",
      },
      { status: 500 }
    );
  }
}