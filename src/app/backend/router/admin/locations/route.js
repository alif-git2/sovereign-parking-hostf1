import { connectDB } from "@/app/backend/database/mongodb";
import {
  createLocation,
  getAdminLocations,
} from "@/app/backend/controller/location";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getAdminLocations(req);
  } catch (error) {
    console.error("Admin locations GET route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch locations",
        error: error.message || "Failed to fetch locations",
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectDB();
    return await createLocation(req);
  } catch (error) {
    console.error("Admin locations POST route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create location",
        error: error.message || "Failed to create location",
      },
      { status: 500 }
    );
  }
}