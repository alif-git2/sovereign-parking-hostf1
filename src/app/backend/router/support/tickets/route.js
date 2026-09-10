import { connectDB } from "@/app/backend/database/mongodb";
import { createSupportTicket } from "@/app/backend/controller/chatSupport";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();
    return await createSupportTicket(req);
  } catch (error) {
    console.error("Support ticket route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Support ticket failed",
        error: error.message || "Support ticket failed",
      },
      { status: 400 }
    );
  }
}