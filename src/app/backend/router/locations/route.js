import { connectDB } from "@/app/backend/database/mongodb";
import { getLocations } from "@/app/backend/controller/location";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getLocations(req);
  } catch (error) {
    console.error("Locations GET route error:", error);

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