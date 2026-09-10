import { connectDB } from "@/app/backend/database/mongodb";
import { sendAdminUserPasswordReset } from "@/app/backend/controller/adminUsers";

export const runtime = "nodejs";

async function getUserId(context) {
  const params = await context.params;
  return String(params?.userId || "").trim();
}

export async function POST(req, context) {
  try {
    await connectDB();

    const userId = await getUserId(context);

    return await sendAdminUserPasswordReset(req, userId);
  } catch (error) {
    console.error("Admin user password reset route failed:", error);

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