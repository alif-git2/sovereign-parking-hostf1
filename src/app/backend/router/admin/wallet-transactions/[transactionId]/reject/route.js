import { connectDB } from "@/app/backend/database/mongodb";
import { rejectWithdrawalRequest } from "@/app/backend/controller/adminWallets";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  try {
    await connectDB();

    const { transactionId } = await params;

    return await rejectWithdrawalRequest(req, transactionId);
  } catch (error) {
    console.error("Admin withdrawal reject route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to reject withdrawal request",
        error: error.message || "Failed to reject withdrawal request",
      },
      { status: 500 }
    );
  }
}