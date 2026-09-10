import { connectDB } from "@/app/backend/database/mongodb";
import { deleteWithdrawRequest } from "@/app/backend/controller/adminWallets";

export const runtime = "nodejs";

export async function DELETE(req, { params }) {
  try {
    await connectDB();

    const { transactionId } = await params;

    return await deleteWithdrawRequest(req, transactionId);
  } catch (error) {
    console.error("Admin withdrawal delete route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete withdrawal request",
        error: error.message || "Failed to delete withdrawal request",
      },
      { status: 500 }
    );
  }
}