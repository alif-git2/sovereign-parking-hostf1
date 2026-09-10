import { connectDB } from "@/app/backend/database/mongodb";
import {
  deleteCruiseSchedule,
  updateCruiseSchedule,
} from "@/app/backend/controller/cruise_schedules";

export const runtime = "nodejs";

export async function PATCH(req, context) {
  try {
    await connectDB();

    const params = await context.params;
    return await updateCruiseSchedule(req, params.scheduleId);
  } catch (error) {
    console.error("Admin cruise schedule PATCH route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update cruise schedule",
        error: error.message || "Failed to update cruise schedule",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    await connectDB();

    const params = await context.params;
    return await deleteCruiseSchedule(req, params.scheduleId);
  } catch (error) {
    console.error("Admin cruise schedule DELETE route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete cruise schedule",
        error: error.message || "Failed to delete cruise schedule",
      },
      { status: 500 }
    );
  }
}