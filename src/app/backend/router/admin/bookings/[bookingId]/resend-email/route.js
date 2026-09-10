import { connectDB } from "@/app/backend/database/mongodb";
import { resendAdminBookingEmail } from "@/app/backend/controller/admin";

export const runtime = "nodejs";

export async function POST(req, context) {
  try {
    await connectDB();

    const { bookingId } = await context.params;

    return await resendAdminBookingEmail(req, bookingId);
  } catch (error) {
    console.error("Admin resend booking email route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to resend booking email",
        error: error.message || "Failed to resend booking email",
      },
      { status: 500 }
    );
  }
}