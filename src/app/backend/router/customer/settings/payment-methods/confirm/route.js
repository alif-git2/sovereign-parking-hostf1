import { connectDB } from "@/app/backend/database/mongodb";
import { confirmStripePaymentMethodSetup } from "@/app/backend/controller/customerSettings";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();
    return await confirmStripePaymentMethodSetup(req);
  } catch (error) {
    console.error("Stripe setup confirm route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Stripe setup confirmation failed",
        error: error.message || "Stripe setup confirmation failed",
      },
      { status: 400 }
    );
  }
}