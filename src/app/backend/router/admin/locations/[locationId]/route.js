import { connectDB } from "@/app/backend/database/mongodb";
import {
  deleteLocation,
  updateLocation,
} from "@/app/backend/controller/location";

export const runtime = "nodejs";

export async function PATCH(req, context) {
  try {
    await connectDB();

    const params = await context.params;
    return await updateLocation(req, params.locationId);
  } catch (error) {
    console.error("Admin location PATCH route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update location",
        error: error.message || "Failed to update location",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    await connectDB();

    const params = await context.params;
    return await deleteLocation(req, params.locationId);
  } catch (error) {
    console.error("Admin location DELETE route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete location",
        error: error.message || "Failed to delete location",
      },
      { status: 500 }
    );
  }
}