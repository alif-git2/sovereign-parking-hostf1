import { connectDB } from "@/app/backend/database/mongodb";
import { cancelAdminBooking } from "@/app/backend/controller/admin";

export const runtime = "nodejs";

export async function POST(req, context) {
  try {
    await connectDB();

    const { bookingId } = await context.params;

    return await cancelAdminBooking(req, bookingId);
  } catch (error) {
    console.error("Admin booking cancel route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to cancel booking",
        error: error.message || "Failed to cancel booking",
      },
      { status: 500 }
    );
  }
}