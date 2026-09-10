import { connectDB } from "@/app/backend/database/mongodb";
import { getCustomerSupportTickets } from "@/app/backend/controller/chatSupport";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    await connectDB();
    return await getCustomerSupportTickets(req);
  } catch (error) {
    console.error("Customer support tickets route failed:", error);

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