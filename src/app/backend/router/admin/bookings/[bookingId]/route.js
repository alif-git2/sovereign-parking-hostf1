import { connectDB } from "@/app/backend/database/mongodb";
import {
  getAdminBookingById,
  updateAdminBooking,
  deleteAdminBooking,
} from "@/app/backend/controller/admin";

export const runtime = "nodejs";

export async function GET(req, context) {
  try {
    await connectDB();

    const { bookingId } = await context.params;

    return await getAdminBookingById(req, bookingId);
  } catch (error) {
    console.error("Admin booking detail route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load booking",
        error: error.message || "Failed to load booking",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req, context) {
  try {
    await connectDB();

    const { bookingId } = await context.params;

    return await updateAdminBooking(req, bookingId);
  } catch (error) {
    console.error("Admin booking update route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update booking",
        error: error.message || "Failed to update booking",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    await connectDB();

    const { bookingId } = await context.params;

    return await deleteAdminBooking(req, bookingId);
  } catch (error) {
    console.error("Admin booking delete route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete booking",
        error: error.message || "Failed to delete booking",
      },
      { status: 500 }
    );
  }
}