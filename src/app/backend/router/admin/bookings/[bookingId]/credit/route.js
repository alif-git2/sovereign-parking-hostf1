import { connectDB } from "@/app/backend/database/mongodb";
import { creditAdminBooking } from "@/app/backend/controller/admin";

export const runtime = "nodejs";

export async function POST(req, context) {
  try {
    await connectDB();

    const { bookingId } = await context.params;

    return await creditAdminBooking(req, bookingId);
  } catch (error) {
    console.error("Admin booking credit route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to credit booking",
        error: error.message || "Failed to credit booking",
      },
      { status: 500 }
    );
  }
}