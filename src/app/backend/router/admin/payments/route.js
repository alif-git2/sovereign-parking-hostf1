import { connectDB } from "@/app/backend/database/mongodb";
import { getAdminPayments } from "@/app/backend/controller/adminPayments";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getAdminPayments(req);
  } catch (error) {
    console.error("Admin payments route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Payments fetch failed",
        error: error.message || "Payments fetch failed",
      },
      { status: 400 }
    );
  }
}