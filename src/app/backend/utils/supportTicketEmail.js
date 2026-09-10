import nodemailer from "nodemailer";

function getTransporter() {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP_HOST is missing");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getMailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER;
}

function getAdminEmail() {
  return (
    process.env.SUPPORT_ADMIN_EMAIL ||
    process.env.BOOKING_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    ""
  );
}

export async function sendSupportTicketCreatedEmails(ticket) {
  const transporter = getTransporter();
  const from = getMailFrom();
  const adminEmail = getAdminEmail();

  const results = {
    adminSent: false,
    customerSent: false,
    errors: [],
  };

  if (!from) {
    results.errors.push("MAIL_FROM or SMTP_USER is missing");
    return results;
  }

  const ticketId = escapeHtml(ticket.ticket_id);
  const name = escapeHtml(ticket.name);
  const email = escapeHtml(ticket.email);
  const phone = escapeHtml(ticket.phone);
  const bookingId = escapeHtml(ticket.booking_id || "-");
  const message = escapeHtml(ticket.message).replace(/\n/g, "<br />");

  if (adminEmail) {
    try {
      await transporter.sendMail({
        from,
        to: adminEmail,
        subject: `New Support Ticket ${ticket.ticket_id}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
            <h2>New Support Ticket</h2>
            <p>A customer submitted a support ticket from the chat widget.</p>

            <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:700px;">
              <tr><td><strong>Ticket ID</strong></td><td>${ticketId}</td></tr>
              <tr><td><strong>Name</strong></td><td>${name}</td></tr>
              <tr><td><strong>Email</strong></td><td>${email}</td></tr>
              <tr><td><strong>Phone</strong></td><td>${phone}</td></tr>
              <tr><td><strong>Booking ID</strong></td><td>${bookingId}</td></tr>
              <tr><td><strong>Status</strong></td><td>${escapeHtml(ticket.status)}</td></tr>
              <tr><td><strong>Priority</strong></td><td>${escapeHtml(ticket.priority)}</td></tr>
            </table>

            <h3>Message</h3>
            <p>${message}</p>
          </div>
        `,
      });

      results.adminSent = true;
    } catch (error) {
      results.errors.push(`Admin email failed: ${error.message}`);
    }
  } else {
    results.errors.push("Admin support email is missing");
  }

  try {
    await transporter.sendMail({
      from,
      to: ticket.email,
      subject: `We received your support ticket ${ticket.ticket_id}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
          <h2>Support Ticket Received</h2>
          <p>Hello ${name},</p>
          <p>We received your support request. Our admin team will review it and contact you soon.</p>

          <p><strong>Ticket ID:</strong> ${ticketId}</p>
          <p><strong>Booking ID:</strong> ${bookingId}</p>

          <h3>Your Message</h3>
          <p>${message}</p>

          <p>Thank you,<br />Sovereign Parking</p>
        </div>
      `,
    });

    results.customerSent = true;
  } catch (error) {
    results.errors.push(`Customer email failed: ${error.message}`);
  }

  return results;
}

export async function sendSupportTicketReplyEmail(ticket) {
  const transporter = getTransporter();
  const from = getMailFrom();

  if (!from) {
    return {
      customerSent: false,
      error: "MAIL_FROM or SMTP_USER is missing",
    };
  }

  const ticketId = escapeHtml(ticket.ticket_id);
  const name = escapeHtml(ticket.name);
  const reply = escapeHtml(ticket.admin_reply).replace(/\n/g, "<br />");

  try {
    await transporter.sendMail({
      from,
      to: ticket.email,
      subject: `Reply to your support ticket ${ticket.ticket_id}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
          <h2>Support Ticket Reply</h2>
          <p>Hello ${name},</p>
          <p>Admin replied to your support ticket.</p>

          <p><strong>Ticket ID:</strong> ${ticketId}</p>

          <h3>Admin Reply</h3>
          <p>${reply}</p>

          <p>Thank you,<br />Sovereign Parking</p>
        </div>
      `,
    });

    return {
      customerSent: true,
      error: null,
    };
  } catch (error) {
    return {
      customerSent: false,
      error: error.message,
    };
  }
}