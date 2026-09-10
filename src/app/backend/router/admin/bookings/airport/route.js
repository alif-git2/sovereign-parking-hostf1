import { connectDB } from "@/app/backend/database/mongodb";
import { createAdminAirportBooking } from "@/app/backend/controller/admin";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();

    return await createAdminAirportBooking(req);
  } catch (error) {
    console.error("Admin airport booking create route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create airport booking",
        error: error.message || "Failed to create airport booking",
      },
      { status: 500 }
    );
  }
}