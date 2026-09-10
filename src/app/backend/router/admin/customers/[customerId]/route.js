import { connectDB } from "@/app/backend/database/mongodb";
import {
  deleteAdminCustomer,
  updateAdminCustomer,
} from "@/app/backend/controller/adminCustomers";

export const runtime = "nodejs";

export async function PATCH(req, context) {
  try {
    await connectDB();

    const params = await context.params;
    const customerId = params?.customerId;

    return await updateAdminCustomer(req, customerId);
  } catch (error) {
    console.error("Admin customer PATCH route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update customer",
        error: error.message || "Failed to update customer",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    await connectDB();

    const params = await context.params;
    const customerId = params?.customerId;

    return await deleteAdminCustomer(req, customerId);
  } catch (error) {
    console.error("Admin customer DELETE route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete customer",
        error: error.message || "Failed to delete customer",
      },
      { status: 500 }
    );
  }
}