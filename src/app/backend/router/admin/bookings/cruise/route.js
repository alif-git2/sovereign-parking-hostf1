import { connectDB } from "@/app/backend/database/mongodb";
import { createAdminCruiseBooking } from "@/app/backend/controller/admin";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();

    return await createAdminCruiseBooking(req);
  } catch (error) {
    console.error("Admin cruise booking create route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create cruise booking",
        error: error.message || "Failed to create cruise booking",
      },
      { status: 500 }
    );
  }
}