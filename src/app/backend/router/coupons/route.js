import { connectDB } from "@/app/backend/database/mongodb";
import {
  createCoupon,
  getCoupons,
} from "@/app/backend/controller/coupon";

// GET → fetch all coupons
// Example:
// /backend/router/coupons
// /backend/router/coupons?is_active=true
// /backend/router/coupons?booking_type=cruise
// /backend/router/coupons?code=WELCOME10
export async function GET(req) {
  try {
    await connectDB();
    return await getCoupons(req);
  } catch (error) {
    console.error("Fetch coupons route failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}

// POST → create coupon
export async function POST(req) {
  try {
    await connectDB();
    return await createCoupon(req);
  } catch (error) {
    console.error("Create coupon route failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}