import { connectDB } from "../../database/mongodb";
import {
  createCruiseSchedule,
  getCruiseSchedules,
} from "@/app/backend/controller/cruise_schedules";

// GET → fetch schedules
export async function GET(req) {
  try {
    await connectDB();
    return await getCruiseSchedules(req);
  } catch (error) {
    console.error("Fetch schedules failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}

// POST → create schedule
export async function POST(req) {
  try {
    await connectDB();
    return await createCruiseSchedule(req);
  } catch (error) {
    console.error("Schedule creation failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}