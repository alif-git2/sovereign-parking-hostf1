import { connectDB } from "@/app/backend/database/mongodb";
import {
  updateCustomerPaymentMethod,
  deleteCustomerPaymentMethod,
} from "@/app/backend/controller/customerSettings";

export const runtime = "nodejs";

async function getMethodId(context) {
  const params = await context.params;
  return String(params?.methodId || "").trim();
}

export async function PATCH(req, context) {
  try {
    await connectDB();

    const methodId = await getMethodId(context);

    return await updateCustomerPaymentMethod(req, methodId);
  } catch (error) {
    console.error("Payment method update route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Payment method update failed",
        error: error.message || "Payment method update failed",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    await connectDB();

    const methodId = await getMethodId(context);

    return await deleteCustomerPaymentMethod(req, methodId);
  } catch (error) {
    console.error("Payment method delete route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Payment method delete failed",
        error: error.message || "Payment method delete failed",
      },
      { status: 400 }
    );
  }
}