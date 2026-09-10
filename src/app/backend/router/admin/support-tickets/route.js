import { connectDB } from "@/app/backend/database/mongodb";
import { getAdminSupportTickets } from "@/app/backend/controller/adminSupportTickets";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getAdminSupportTickets(req);
  } catch (error) {
    console.error("Admin support tickets route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Support tickets fetch failed",
        error: error.message || "Support tickets fetch failed",
      },
      { status: 400 }
    );
  }
}