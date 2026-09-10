import { connectDB } from "@/app/backend/database/mongodb";
import { createStripePaymentMethodSetup } from "@/app/backend/controller/customerSettings";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();
    return await createStripePaymentMethodSetup(req);
  } catch (error) {
    console.error("Stripe setup route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Stripe setup failed",
        error: error.message || "Stripe setup failed",
      },
      { status: 400 }
    );
  }
}