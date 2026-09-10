import { connectDB } from "@/app/backend/database/mongodb";
import { requestAdminPasswordReset } from "@/app/backend/controller/adminPasswordReset";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();

    return await requestAdminPasswordReset(req);
  } catch (error) {
    console.error("Admin forgot password route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Password reset failed",
        error: error.message || "Password reset failed",
      },
      { status: 400 }
    );
  }
}