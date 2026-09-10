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

export async function sendAdminCreatedUserPasswordEmail({
  user,
  setupUrl,
  isReset = false,
}) {
  const transporter = getTransporter();
  const from = getMailFrom();

  if (!from) {
    throw new Error("MAIL_FROM or SMTP_USER is missing");
  }

  const safeName = escapeHtml(user.name);
  const safeEmail = escapeHtml(user.email);
  const safeRole = escapeHtml(user.role);
  const safeUrl = escapeHtml(setupUrl);

  await transporter.sendMail({
    from,
    to: user.email,
    subject: isReset
      ? "Reset your Sovereign Parking password"
      : "Set up your Sovereign Parking account",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
        <h2>${isReset ? "Password Reset" : "Account Created"}</h2>

        <p>Hello ${safeName},</p>

        <p>
          ${
            isReset
              ? "An administrator requested a password reset for your account."
              : "An administrator created an account for you."
          }
        </p>

        <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px;">
          <tr>
            <td><strong>Email</strong></td>
            <td>${safeEmail}</td>
          </tr>
          <tr>
            <td><strong>Role</strong></td>
            <td>${safeRole}</td>
          </tr>
        </table>

        <p style="margin-top:20px;">
          <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
            ${isReset ? "Reset Password" : "Set Password"}
          </a>
        </p>

        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p style="word-break:break-all;">${safeUrl}</p>

        <p>This link will expire in 24 hours.</p>

        <p>Thank you,<br />Sovereign Parking</p>
      </div>
    `,
  });
}