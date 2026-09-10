import { connectDB } from "@/app/backend/database/mongodb";
import {
  createCruiseSchedule,
  getAdminCruiseSchedules,
} from "@/app/backend/controller/cruise_schedules";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getAdminCruiseSchedules(req);
  } catch (error) {
    console.error("Admin cruise schedules GET route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch cruise schedules",
        error: error.message || "Failed to fetch cruise schedules",
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectDB();
    return await createCruiseSchedule(req);
  } catch (error) {
    console.error("Admin cruise schedules POST route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create cruise schedule",
        error: error.message || "Failed to create cruise schedule",
      },
      { status: 500 }
    );
  }
}