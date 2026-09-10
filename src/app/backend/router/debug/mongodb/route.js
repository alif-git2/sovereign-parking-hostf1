import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import Booking from "@/app/backend/models/booking";
import ParkingUser from "@/app/backend/models/park_user";
import Location from "@/app/backend/models/location";
import CruiseSchedule from "@/app/backend/models/cruiseschedule";
import SeoGlobalSetting from "@/app/backend/models/seoGlobalSetting";
import SeoPageSetting from "@/app/backend/models/seoPageSetting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAllowed(request) {
  if (process.env.NODE_ENV !== "production") return true;

  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || "";

  return Boolean(process.env.ADMIN_SEED_SECRET && secret === process.env.ADMIN_SEED_SECRET);
}

export async function GET(request) {
  try {
    if (!isAllowed(request)) {
      return Response.json(
        { success: false, message: "Debug route is locked in production." },
        { status: 403 }
      );
    }

    await connectDB();

    const [bookings, users, locations, cruiseSchedules, globalSeo, pageSeo] = await Promise.all([
      Booking.countDocuments({}),
      ParkingUser.countDocuments({}),
      Location.countDocuments({}),
      CruiseSchedule.countDocuments({}),
      SeoGlobalSetting.countDocuments({}),
      SeoPageSetting.countDocuments({}),
    ]);

    return Response.json({
      success: true,
      readyState: mongoose.connection.readyState,
      readyStateText: ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] || "unknown",
      database: mongoose.connection.name,
      host: mongoose.connection.host,
      counts: {
        bookings,
        users,
        locations,
        cruiseSchedules,
        seoGlobalSettings: globalSeo,
        seoPageSettings: pageSeo,
      },
    });
  } catch (error) {
    console.error("MongoDB debug route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "MongoDB check failed",
        errorName: error.name,
        errorCode: error.code,
      },
      { status: 500 }
    );
  }
}
