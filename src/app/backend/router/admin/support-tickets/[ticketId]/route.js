import { connectDB } from "@/app/backend/database/mongodb";
import {
  getAdminSupportTicket,
  updateAdminSupportTicket,
  deleteAdminSupportTicket,
} from "@/app/backend/controller/adminSupportTickets";

export const runtime = "nodejs";

async function getTicketId(context) {
  const params = await context.params;
  return String(params?.ticketId || "").trim();
}

export async function GET(req, context) {
  try {
    await connectDB();

    const ticketId = await getTicketId(context);

    return await getAdminSupportTicket(req, ticketId);
  } catch (error) {
    console.error("Admin support ticket route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Support ticket fetch failed",
        error: error.message || "Support ticket fetch failed",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(req, context) {
  try {
    await connectDB();

    const ticketId = await getTicketId(context);

    return await updateAdminSupportTicket(req, ticketId);
  } catch (error) {
    console.error("Admin support ticket update route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Support ticket update failed",
        error: error.message || "Support ticket update failed",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    await connectDB();

    const ticketId = await getTicketId(context);

    return await deleteAdminSupportTicket(req, ticketId);
  } catch (error) {
    console.error("Admin support ticket delete route failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Support ticket delete failed",
        error: error.message || "Support ticket delete failed",
      },
      { status: 400 }
    );
  }
}