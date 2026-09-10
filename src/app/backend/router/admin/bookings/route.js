import { connectDB } from "@/app/backend/database/mongodb";
import { getAdminBookings } from "@/app/backend/controller/admin";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();

    return await getAdminBookings(req);
  } catch (error) {
    console.error("Admin bookings route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load admin bookings",
        error: error.message || "Failed to load admin bookings",
      },
      { status: 500 }
    );
  }
}