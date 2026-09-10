import mongoose from "mongoose";
import SupportTicket from "@/app/backend/models/supportTicket";
import ParkingUser from "@/app/backend/models/park_user";
import { getUserFromRequest } from "@/app/backend/utils/authToken";
import { sendSupportTicketReplyEmail } from "@/app/backend/utils/supportTicketEmail";

const ALLOWED_STATUSES = ["open", "in_progress", "replied", "closed"];
const ALLOWED_PRIORITIES = ["low", "normal", "high", "urgent"];

function normalizeString(value) {
  return String(value || "").trim();
}

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (value.includes("unauthorized") || value.includes("login")) return 401;
  if (value.includes("not found")) return 404;
  if (value.includes("not allowed") || value.includes("admin")) return 403;
  if (value.includes("invalid") || value.includes("required")) return 400;

  return 400;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getAdminFromRequest(req) {
  const authUser = getUserFromRequest(req);

  if (!authUser?.id) {
    throw new Error("Unauthorized. Please login again.");
  }

  const admin = await ParkingUser.findById(authUser.id).select(
    "name email role is_active"
  );

  if (!admin || !admin.is_active) {
    throw new Error("Unauthorized admin user");
  }

  if (!["admin", "manager"].includes(admin.role)) {
    throw new Error("Admin access required");
  }

  return admin;
}

function buildTicketQuery(searchParams) {
  const query = {};

  const status = normalizeString(searchParams.get("status"));
  const priority = normalizeString(searchParams.get("priority"));
  const search = normalizeString(searchParams.get("search"));

  if (status && status !== "all") {
    query.status = status;
  }

  if (priority && priority !== "all") {
    query.priority = priority;
  }

  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");

    query.$or = [
      { ticket_id: regex },
      { name: regex },
      { email: regex },
      { phone: regex },
      { booking_id: regex },
      { message: regex },
    ];
  }

  return query;
}

function getTicketIdentifierQuery(ticketId) {
  const identifier = normalizeString(ticketId);

  if (!identifier) {
    throw new Error("Ticket ID is required");
  }

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return {
      _id: identifier,
    };
  }

  return {
    ticket_id: identifier,
  };
}

export async function getAdminSupportTickets(req) {
  try {
    await getAdminFromRequest(req);

    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 20), 1),
      100
    );

    const query = buildTicketQuery(searchParams);
    const skip = (page - 1) * limit;

    const [tickets, total, statusCounts] = await Promise.all([
      SupportTicket.find(query)
        .populate("customer_id", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SupportTicket.countDocuments(query),
      SupportTicket.aggregate([
        {
          $group: {
            _id: "$status",
            count: {
              $sum: 1,
            },
          },
        },
      ]),
    ]);

    const counts = {
      all: 0,
      open: 0,
      in_progress: 0,
      replied: 0,
      closed: 0,
    };

    statusCounts.forEach((item) => {
      counts[item._id] = item.count;
      counts.all += item.count;
    });

    return Response.json({
      success: true,
      data: {
        tickets,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        counts,
      },
    });
  } catch (error) {
    console.error("Admin support tickets fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch support tickets",
        error: error.message || "Failed to fetch support tickets",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function getAdminSupportTicket(req, ticketId) {
  try {
    await getAdminFromRequest(req);

    const ticket = await SupportTicket.findOne(
      getTicketIdentifierQuery(ticketId)
    ).populate("customer_id", "name email phone");

    if (!ticket) {
      throw new Error("Support ticket not found");
    }

    return Response.json({
      success: true,
      data: {
        ticket,
      },
    });
  } catch (error) {
    console.error("Admin support ticket fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch support ticket",
        error: error.message || "Failed to fetch support ticket",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function updateAdminSupportTicket(req, ticketId) {
  try {
    const admin = await getAdminFromRequest(req);
    const body = await req.json();

    const ticket = await SupportTicket.findOne(
      getTicketIdentifierQuery(ticketId)
    );

    if (!ticket) {
      throw new Error("Support ticket not found");
    }

    const nextStatus = normalizeString(body.status);
    const nextPriority = normalizeString(body.priority);
    const adminReplyProvided = Object.prototype.hasOwnProperty.call(
      body,
      "admin_reply"
    );
    const adminReply = normalizeString(body.admin_reply);

    if (nextStatus) {
      if (!ALLOWED_STATUSES.includes(nextStatus)) {
        throw new Error("Invalid ticket status");
      }

      ticket.status = nextStatus;

      if (nextStatus === "closed") {
        ticket.closed_at = new Date();
      }

      if (nextStatus !== "closed") {
        ticket.closed_at = null;
      }
    }

    if (nextPriority) {
      if (!ALLOWED_PRIORITIES.includes(nextPriority)) {
        throw new Error("Invalid ticket priority");
      }

      ticket.priority = nextPriority;
    }

    let shouldSendReplyEmail = false;

    if (adminReplyProvided) {
      if (!adminReply) {
        throw new Error("Admin reply is required");
      }

      ticket.admin_reply = adminReply;
      ticket.admin_replied_at = new Date();

      if (ticket.status !== "closed") {
        ticket.status = "replied";
      }

      shouldSendReplyEmail = body.send_email !== false;
    }

    ticket.updated_by = admin._id;

    await ticket.save();

    let emailResult = null;

    if (shouldSendReplyEmail) {
      emailResult = await sendSupportTicketReplyEmail(ticket);
    }

    return Response.json({
      success: true,
      message: adminReplyProvided
        ? "Support ticket replied successfully"
        : "Support ticket updated successfully",
      data: {
        ticket,
        emailResult,
      },
    });
  } catch (error) {
    console.error("Admin support ticket update failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update support ticket",
        error: error.message || "Failed to update support ticket",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function deleteAdminSupportTicket(req, ticketId) {
  try {
    await getAdminFromRequest(req);

    const ticket = await SupportTicket.findOne(
      getTicketIdentifierQuery(ticketId)
    );

    if (!ticket) {
      throw new Error("Support ticket not found");
    }

    await ticket.deleteOne();

    return Response.json({
      success: true,
      message: "Support ticket deleted successfully",
    });
  } catch (error) {
    console.error("Admin support ticket delete failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete support ticket",
        error: error.message || "Failed to delete support ticket",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}