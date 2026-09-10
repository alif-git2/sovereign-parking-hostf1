import { connectDB } from "@/app/backend/database/mongodb";
import {
  getCoupons,
  createCoupon,
} from "@/app/backend/controller/coupon";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getCoupons(req);
  } catch (error) {
    console.error("Admin coupons GET route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load coupons",
        error: error.message || "Failed to load coupons",
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectDB();
    return await createCoupon(req);
  } catch (error) {
    console.error("Admin coupons POST route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create coupon",
        error: error.message || "Failed to create coupon",
      },
      { status: 500 }
    );
  }
}