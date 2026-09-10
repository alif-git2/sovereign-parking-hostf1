import { connectDB } from "@/app/backend/database/mongodb";
import {
  updateCustomerBooking,
  getCustomerBookingEditOptions,
} from "@/app/backend/controller/customerBookingEdit";

export const runtime = "nodejs";

async function getBookingId(context) {
  const params = await context.params;
  return String(params?.bookingId || "").trim();
}

export async function GET(req, context) {
  try {
    await connectDB();

    const bookingId = await getBookingId(context);

    return await getCustomerBookingEditOptions(req, bookingId);
  } catch (error) {
    console.error("Customer booking edit options route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Booking edit options failed",
        error: error.message || "Booking edit options failed",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(req, context) {
  try {
    await connectDB();

    const bookingId = await getBookingId(context);

    return await updateCustomerBooking(req, bookingId);
  } catch (error) {
    console.error("Customer booking update route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Booking update failed",
        error: error.message || "Booking update failed",
      },
      { status: 400 }
    );
  }
}