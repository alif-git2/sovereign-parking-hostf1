import { connectDB } from "@/app/backend/database/mongodb";
import { getAdminDashboard } from "@/app/backend/controller/admin";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();

    return await getAdminDashboard(req);
  } catch (error) {
    console.error("Admin dashboard route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load admin dashboard",
        error: error.message || "Failed to load admin dashboard",
      },
      { status: 500 }
    );
  }
}