import { connectDB } from "@/app/backend/database/mongodb";
import { askChatQuestion } from "@/app/backend/controller/chatSupport";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await connectDB();
    return await askChatQuestion(req);
  } catch (error) {
    console.error("Chat ask route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Chat ask failed",
        error: error.message || "Chat ask failed",
      },
      { status: 400 }
    );
  }
}