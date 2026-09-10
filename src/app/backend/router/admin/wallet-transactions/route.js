import { connectDB } from "@/app/backend/database/mongodb";
import { getAdminWalletTransactions } from "@/app/backend/controller/adminWallets";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getAdminWalletTransactions(req);
  } catch (error) {
    console.error("Admin wallet transactions route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load wallet transactions",
        error: error.message || "Failed to load wallet transactions",
      },
      { status: 500 }
    );
  }
}