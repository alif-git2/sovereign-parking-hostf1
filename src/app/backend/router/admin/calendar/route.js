import { connectDB } from "@/app/backend/database/mongodb";
import { getAdminCalendar } from "@/app/backend/controller/adminCalendar";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();

    return await getAdminCalendar(req);
  } catch (error) {
    console.error("Admin calendar route error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load admin calendar",
        error: error.message || "Failed to load admin calendar",
      },
      { status: 500 }
    );
  }
}