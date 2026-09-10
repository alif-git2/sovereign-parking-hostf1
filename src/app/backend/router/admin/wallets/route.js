import { connectDB } from "@/app/backend/database/mongodb";
import { getAdminWallets } from "@/app/backend/controller/adminWallets";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getAdminWallets(req);
  } catch (error) {
    console.error("Admin wallets route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load wallets",
        error: error.message || "Failed to load wallets",
      },
      { status: 500 }
    );
  }
}