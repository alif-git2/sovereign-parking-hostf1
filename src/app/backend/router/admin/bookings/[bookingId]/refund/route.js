import { connectDB } from "@/app/backend/database/mongodb";
import { refundAdminBooking } from "@/app/backend/controller/admin";

export const runtime = "nodejs";

export async function POST(req, context) {
  try {
    await connectDB();

    const { bookingId } = await context.params;

    return await refundAdminBooking(req, bookingId);
  } catch (error) {
    console.error("Admin booking refund route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to refund booking",
        error: error.message || "Failed to refund booking",
      },
      { status: 500 }
    );
  }
}