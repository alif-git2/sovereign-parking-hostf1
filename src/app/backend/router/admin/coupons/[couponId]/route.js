import { connectDB } from "@/app/backend/database/mongodb";
import Coupon from "@/app/backend/models/coupon";
import { updateCoupon } from "@/app/backend/controller/coupon";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  try {
    await connectDB();

    const { couponId } = await params;

    return await updateCoupon(req, couponId);
  } catch (error) {
    console.error("Admin coupon PATCH route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update coupon",
        error: error.message || "Failed to update coupon",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();

    const { couponId } = await params;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return Response.json(
        {
          success: false,
          message: "Coupon not found",
          error: "Coupon not found",
        },
        { status: 404 }
      );
    }

    if (Number(coupon.used_count || 0) > 0) {
      coupon.is_active = false;
      await coupon.save();

      return Response.json(
        {
          success: true,
          message:
            "Coupon has usage history, so it was deactivated instead of deleted.",
          data: coupon,
        },
        { status: 200 }
      );
    }

    await Coupon.deleteOne({ _id: coupon._id });

    return Response.json(
      {
        success: true,
        message: "Coupon deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin coupon DELETE route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete coupon",
        error: error.message || "Failed to delete coupon",
      },
      { status: 500 }
    );
  }
}