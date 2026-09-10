import { connectDB } from "@/app/backend/database/mongodb";
import { validateCoupon } from "@/app/backend/controller/coupon";

// POST → validate coupon before booking submit
// Endpoint:
// POST /backend/router/coupons/validate
export async function POST(req) {
  try {
    await connectDB();
    return await validateCoupon(req);
  } catch (error) {
    console.error("Validate coupon route failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}