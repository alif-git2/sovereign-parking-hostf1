import { connectDB } from "@/app/backend/database/mongodb";
import { getCustomerPaymentMethods } from "@/app/backend/controller/customerSettings";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getCustomerPaymentMethods(req);
  } catch (error) {
    console.error("Payment methods route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Payment methods fetch failed",
        error: error.message || "Payment methods fetch failed",
      },
      { status: 400 }
    );
  }
}