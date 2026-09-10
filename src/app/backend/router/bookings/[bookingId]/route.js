import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import Booking from "@/app/backend/models/booking";
import WalletTransaction from "@/app/backend/models/wallettransaction";

// Important for populate
import "@/app/backend/models/location";
import "@/app/backend/models/cruiseschedule";
import "@/app/backend/models/coupon";
import "@/app/backend/models/storagetype";
import "@/app/backend/models/park_user";

export async function GET(req, { params }) {
  try {
    await connectDB();

    const { bookingId } = await params;

    if (!bookingId) {
      return Response.json(
        {
          success: false,
          message: "Booking ID is required",
          error: "Booking ID is required",
        },
        { status: 400 }
      );
    }

    const bookingQuery = mongoose.Types.ObjectId.isValid(bookingId)
      ? {
          $or: [{ _id: bookingId }, { booking_id: bookingId }],
        }
      : {
          booking_id: bookingId,
        };

    const booking = await Booking.findOne(bookingQuery)
      .populate("location_id")
      .populate("schedule_id")
      .populate("user_id", "name email phone role")
      .populate("coupon_id")
      .populate("details.storage.storage_type_id")
      .populate({
        path: "wallet_transaction_id",
        model: WalletTransaction,
        select:
          "transaction_reference transaction_id amount method status",
      });

    if (!booking) {
      return Response.json(
        {
          success: false,
          message: "Booking not found",
          error: "Booking not found",
        },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        data: booking,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Fetch booking failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch booking",
        error: error.message || "Failed to fetch booking",
      },
      { status: 500 }
    );
  }
}
