import { connectDB } from "@/app/backend/database/mongodb";
import { getPasswordSetupInfo } from "@/app/backend/controller/auth";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getPasswordSetupInfo(req);
  } catch (error) {
    console.error("Password setup info route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Password setup info failed",
        error: error.message || "Password setup info failed",
      },
      { status: 400 }
    );
  }
}