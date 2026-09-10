import { connectDB } from "@/app/backend/database/mongodb";
import { creditCustomerWallet } from "@/app/backend/controller/adminWallets";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();
    return await creditCustomerWallet(req);
  } catch (error) {
    console.error("Admin wallet credit route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to credit wallet",
        error: error.message || "Failed to credit wallet",
      },
      { status: 500 }
    );
  }
}