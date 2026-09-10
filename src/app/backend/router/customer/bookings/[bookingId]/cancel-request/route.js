import mongoose from "mongoose";
import nodemailer from "nodemailer";
import { connectDB } from "@/app/backend/database/mongodb";
import Booking from "@/app/backend/models/booking";
import { getUserFromRequest } from "@/app/backend/utils/authToken";

export const runtime = "nodejs";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date) {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function money(amount) {
  return `AUD ${Number(amount || 0).toFixed(2)}`;
}

function formatText(value) {
  if (!value) return "-";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getBookingIdentifierFilter(bookingId) {
  const decodedBookingId = decodeURIComponent(String(bookingId || "").trim());

  if (!decodedBookingId) {
    throw new Error("Booking ID is required");
  }

  if (mongoose.Types.ObjectId.isValid(decodedBookingId)) {
    return {
      $or: [{ _id: decodedBookingId }, { booking_id: decodedBookingId }],
    };
  }

  return {
    booking_id: decodedBookingId,
  };
}

function getTransporter() {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP_HOST is missing");
  }

  if (!process.env.SMTP_USER) {
    throw new Error("SMTP_USER is missing");
  }

  if (!process.env.SMTP_PASS) {
    throw new Error("SMTP_PASS is missing");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendCancellationRequestAdminEmail({ booking, customerUser, reason }) {
  const adminEmail = process.env.BOOKING_ADMIN_EMAIL;

  if (!adminEmail) {
    console.warn("BOOKING_ADMIN_EMAIL is missing. Admin email not sent.");
    return;
  }

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  if (!from) {
    console.warn("MAIL_FROM or SMTP_USER is missing. Admin email not sent.");
    return;
  }

  const transporter = getTransporter();

  const subject = `Cancellation Request - ${booking.booking_id}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #222;">
      <h2 style="background:#dc2626; color:#ffffff; padding:16px; border-radius:8px;">
        Customer Cancellation Request
      </h2>

      <p>A customer has requested to cancel a booking. Please review it from the admin dashboard.</p>

      <table style="width:100%; border-collapse:collapse; margin-top:20px;">
        <tbody>
          <tr>
            <td style="border:1px solid #ddd; padding:10px; width:40%; background:#f8f9fa;"><strong>Booking ID</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${escapeHtml(booking.booking_id)}</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>Booking Type</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${escapeHtml(formatText(booking.type))}</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>Booking Status</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">Cancellation Requested by Customer</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>Customer Name</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${escapeHtml(booking.customer?.name || customerUser?.name || "-")}</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>Customer Email</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${escapeHtml(booking.customer?.email || customerUser?.email || "-")}</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>Customer Phone</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${escapeHtml(booking.customer?.phone || customerUser?.phone || "-")}</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>Start Date</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${escapeHtml(formatDate(booking.start_date))}</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>End Date</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${escapeHtml(formatDate(booking.end_date))}</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>Total Amount</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${money(booking.price)}</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>Paid Amount</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${money(booking.paid_amount)}</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>Payment Method</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${escapeHtml(formatText(booking.payment_method))}</td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd; padding:10px; background:#f8f9fa;"><strong>Cancellation Reason</strong></td>
            <td style="border:1px solid #ddd; padding:10px;">${escapeHtml(reason)}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin-top:24px; color:#666;">
        This is an automated notification from the parking booking system.
      </p>
    </div>
  `;

  const text = `
Customer Cancellation Request

Booking ID: ${booking.booking_id}
Booking Type: ${formatText(booking.type)}
Booking Status: Cancellation Requested by Customer

Customer Name: ${booking.customer?.name || customerUser?.name || "-"}
Customer Email: ${booking.customer?.email || customerUser?.email || "-"}
Customer Phone: ${booking.customer?.phone || customerUser?.phone || "-"}

Start Date: ${formatDate(booking.start_date)}
End Date: ${formatDate(booking.end_date)}

Total Amount: ${money(booking.price)}
Paid Amount: ${money(booking.paid_amount)}
Payment Method: ${formatText(booking.payment_method)}

Cancellation Reason:
${reason}
  `.trim();

  await transporter.sendMail({
    from,
    to: adminEmail,
    subject,
    html,
    text,
  });
}

export async function POST(req, context) {
  try {
    await connectDB();

    const user = getUserFromRequest(req);

    if (!user?.id) {
      throw new Error("Authorization token is required");
    }

    const params = await context.params;
    const bookingId = params?.bookingId;

    const body = await req.json();
    const reason = String(body?.reason || "").trim();

    if (!reason || reason.length < 5) {
      return Response.json(
        {
          success: false,
          message: "Cancellation reason must be at least 5 characters",
          error: "Cancellation reason must be at least 5 characters",
        },
        { status: 400 }
      );
    }

    if (reason.length > 100) {
      return Response.json(
        {
          success: false,
          message: "Cancellation reason must be less than 100 characters",
          error: "Cancellation reason must be less than 100 characters",
        },
        { status: 400 }
      );
    }

    const booking = await Booking.findOne({
      ...getBookingIdentifierFilter(bookingId),
      user_id: user.id,
    }).populate("user_id", "name email phone role");

    if (!booking) {
      return Response.json(
        {
          success: false,
          message: "Booking not found",
          error: "Booking not found",
        },
        { status: 404 }
      );
    }

    const blockedStatuses = [
      "cancelled",
      "cancellation_requested",
      "refund",
      "refunded",
      "credit",
      "credited",
    ];

    if (blockedStatuses.includes(String(booking.status || "").toLowerCase())) {
      return Response.json(
        {
          success: false,
          message: "Cancellation request is not allowed for this booking",
          error: "Cancellation request is not allowed for this booking",
        },
        { status: 400 }
      );
    }

    const customerUser = booking.user_id;

    booking.status = "cancellation_requested";
    booking.cancellation_request = {
      ...(booking.cancellation_request || {}),
      requested: true,
      reason,
      requested_at: new Date(),
      requested_by: user.id,
      customer_name: booking.customer?.name || customerUser?.name || null,
      customer_email: booking.customer?.email || customerUser?.email || null,
      admin_reviewed: false,
      admin_reviewed_at: null,
      admin_reviewed_by: null,
      admin_note: null,
    };

    booking.status_history.push({
      status: "cancellation_requested",
      note: `Customer requested cancellation. Reason: ${reason}`,
      changed_by: user.id,
      date: new Date(),
    });

    await booking.save();

    try {
      await sendCancellationRequestAdminEmail({
        booking,
        customerUser,
        reason,
      });
    } catch (emailError) {
      console.error("Customer cancellation request email error:", emailError);
    }

    return Response.json(
      {
        success: true,
        message: "Cancellation request submitted successfully",
        data: {
          booking,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Customer cancellation request error:", error);

    const status =
      error.message === "Authorization token is required" ||
      error.message === "Invalid or expired token"
        ? 401
        : 500;

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to submit cancellation request",
        error: error.message || "Failed to submit cancellation request",
      },
      { status }
    );
  }
}