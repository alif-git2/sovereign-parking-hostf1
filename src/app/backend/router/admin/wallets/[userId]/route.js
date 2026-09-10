import { connectDB } from "@/app/backend/database/mongodb";
import {
  deleteCustomerWallet,
  updateCustomerWallet,
} from "@/app/backend/controller/adminWallets";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  try {
    await connectDB();

    const { userId } = await params;

    return await updateCustomerWallet(req, userId);
  } catch (error) {
    console.error("Admin wallet PATCH route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update wallet.",
        error: error.message || "Failed to update wallet.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();

    const { userId } = await params;

    return await deleteCustomerWallet(req, userId);
  } catch (error) {
    console.error("Admin wallet DELETE route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete wallet.",
        error: error.message || "Failed to delete wallet.",
      },
      { status: 500 }
    );
  }
}