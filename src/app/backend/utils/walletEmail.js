import nodemailer from "nodemailer";
import WalletTransaction from "@/app/backend/models/wallettransaction";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "true") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    throw new Error("SMTP_HOST is not configured.");
  }

  if (!user) {
    throw new Error("SMTP_USER is not configured.");
  }

  if (!pass) {
    throw new Error("SMTP_PASS is not configured.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

function getMailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER;
}

function getAdminEmail() {
  return process.env.BOOKING_ADMIN_EMAIL || process.env.SMTP_USER;
}

function money(amount, currency = "AUD") {
  return `${String(currency || "AUD").toUpperCase()} ${Number(
    amount || 0
  ).toFixed(2)}`;
}

function formatDateTime(date = new Date()) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMethod(method) {
  const labels = {
    stripe: "Stripe",
    paypal: "PayPal",
    wallet: "Wallet",
    admin: "Admin",
    bank: "Bank",
  };

  return labels[method] || String(method || "-").toUpperCase();
}

function getProviderReference(walletTransaction, payment) {
  return (
    walletTransaction?.provider_payment_id ||
    walletTransaction?.provider_order_id ||
    walletTransaction?.provider_capture_id ||
    payment?.provider_payment_id ||
    payment?.provider_order_id ||
    payment?.provider_capture_id ||
    payment?.transaction_id ||
    "-"
  );
}

function getCustomerName(user) {
  return user?.name || "Customer";
}

function getCustomerEmail(user) {
  return user?.email || "";
}

function getCustomerPhone(user) {
  return user?.phone || "-";
}

function buildCustomerEmailHtml({ user, walletTransaction, payment }) {
  const currency = "A$";
  const amount = walletTransaction?.amount || payment?.amount || 0;
  const balanceAfter = walletTransaction?.balance_after || 0;

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">Wallet Top-Up Successful</h2>

      <p>Hello ${getCustomerName(user)},</p>

      <p>
        Your wallet top-up has been completed successfully.
      </p>

      <table style="border-collapse: collapse; width: 100%; max-width: 620px; margin-top: 16px;">
        <tbody>
          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Amount</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${money(amount, currency)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Payment Method</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${formatMethod(walletTransaction?.method || payment?.method)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Wallet Balance Now</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${money(balanceAfter, currency)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Wallet Reference</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${walletTransaction?.transaction_reference || "-"}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Provider Reference</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${getProviderReference(walletTransaction, payment)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Date</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${formatDateTime(walletTransaction?.completed_at || walletTransaction?.updatedAt || new Date())}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin-top: 18px;">
        Thank you for using Sovereign Parking.
      </p>
    </div>
  `;
}

function buildCustomerEmailText({ user, walletTransaction, payment }) {
  const currency = "A$";
  const amount = walletTransaction?.amount || payment?.amount || 0;
  const balanceAfter = walletTransaction?.balance_after || 0;

  return `
Wallet Top-Up Successful

Hello ${getCustomerName(user)},

Your wallet top-up has been completed successfully.

Amount: ${money(amount, currency)}
Payment Method: ${formatMethod(walletTransaction?.method || payment?.method)}
Wallet Balance Now: ${money(balanceAfter, currency)}
Wallet Reference: ${walletTransaction?.transaction_reference || "-"}
Provider Reference: ${getProviderReference(walletTransaction, payment)}
Date: ${formatDateTime(walletTransaction?.completed_at || walletTransaction?.updatedAt || new Date())}

Thank you for using Sovereign Parking.
  `.trim();
}

function buildAdminEmailHtml({ user, walletTransaction, payment }) {
  const currency = "A$";
  const amount = walletTransaction?.amount || payment?.amount || 0;
  const balanceAfter = walletTransaction?.balance_after || 0;

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">Customer Wallet Top-Up Received</h2>

      <p>A customer wallet top-up has been completed.</p>

      <table style="border-collapse: collapse; width: 100%; max-width: 720px; margin-top: 16px;">
        <tbody>
          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Customer</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${getCustomerName(user)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Email</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${getCustomerEmail(user)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Phone</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${getCustomerPhone(user)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Amount</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${money(amount, currency)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Payment Method</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${formatMethod(walletTransaction?.method || payment?.method)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Wallet Balance Now</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${money(balanceAfter, currency)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Wallet Reference</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${walletTransaction?.transaction_reference || "-"}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Provider Reference</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${getProviderReference(walletTransaction, payment)}</td>
          </tr>

          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Date</td>
            <td style="border: 1px solid #e5e7eb; padding: 10px;">${formatDateTime(walletTransaction?.completed_at || walletTransaction?.updatedAt || new Date())}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function buildAdminEmailText({ user, walletTransaction, payment }) {
  const currency = "A$";
  const amount = walletTransaction?.amount || payment?.amount || 0;
  const balanceAfter = walletTransaction?.balance_after || 0;

  return `
Customer Wallet Top-Up Received

Customer: ${getCustomerName(user)}
Email: ${getCustomerEmail(user)}
Phone: ${getCustomerPhone(user)}
Amount: ${money(amount, currency)}
Payment Method: ${formatMethod(walletTransaction?.method || payment?.method)}
Wallet Balance Now: ${money(balanceAfter, currency)}
Wallet Reference: ${walletTransaction?.transaction_reference || "-"}
Provider Reference: ${getProviderReference(walletTransaction, payment)}
Date: ${formatDateTime(walletTransaction?.completed_at || walletTransaction?.updatedAt || new Date())}
  `.trim();
}

async function markEmailResult(walletTransactionId, update) {
  if (!walletTransactionId) return;

  await WalletTransaction.findByIdAndUpdate(walletTransactionId, {
    $set: {
      email_attempted_at: new Date(),
      ...update,
    },
  });
}

export async function sendWalletTopupCustomerEmail({
  user,
  walletTransaction,
  payment,
}) {
  const customerEmail = getCustomerEmail(user);

  if (!customerEmail) {
    throw new Error("Customer email is missing.");
  }

  const transporter = getTransporter();
  const currency = "A$";
  const amount = walletTransaction?.amount || payment?.amount || 0;

  await transporter.sendMail({
    from: getMailFrom(),
    to: customerEmail,
    subject: `Wallet top-up successful - ${money(amount, currency)}`,
    text: buildCustomerEmailText({ user, walletTransaction, payment }),
    html: buildCustomerEmailHtml({ user, walletTransaction, payment }),
  });
}

export async function sendWalletTopupAdminEmail({
  user,
  walletTransaction,
  payment,
}) {
  const adminEmail = getAdminEmail();

  if (!adminEmail) {
    throw new Error("Admin email is missing.");
  }

  const transporter = getTransporter();
  const currency = "A$";
  const amount = walletTransaction?.amount || payment?.amount || 0;

  await transporter.sendMail({
    from: getMailFrom(),
    to: adminEmail,
    subject: `Wallet top-up received - ${getCustomerName(user)} - ${money(
      amount,
      currency
    )}`,
    text: buildAdminEmailText({ user, walletTransaction, payment }),
    html: buildAdminEmailHtml({ user, walletTransaction, payment }),
  });
}

export async function sendWalletTopupEmails({
  user,
  walletTransaction,
  payment,
}) {
  if (!walletTransaction?._id) {
    throw new Error("Wallet transaction is required for top-up emails.");
  }

  if (!["topup_stripe", "topup_paypal"].includes(walletTransaction.type)) {
    return {
      customerEmailSent: false,
      adminEmailSent: false,
      skipped: true,
      reason: "Wallet transaction is not a top-up.",
    };
  }

  if (walletTransaction.status !== "completed") {
    return {
      customerEmailSent: false,
      adminEmailSent: false,
      skipped: true,
      reason: "Wallet transaction is not completed.",
    };
  }

  const freshTransaction = await WalletTransaction.findById(
    walletTransaction._id
  );

  if (!freshTransaction) {
    throw new Error("Wallet transaction not found for email sending.");
  }

  let customerEmailSent = Boolean(freshTransaction.customer_email_sent_at);
  let adminEmailSent = Boolean(freshTransaction.admin_email_sent_at);
  let emailError = "";

  if (!customerEmailSent) {
    try {
      await sendWalletTopupCustomerEmail({
        user,
        walletTransaction: freshTransaction,
        payment,
      });

      await markEmailResult(freshTransaction._id, {
        customer_email_sent_at: new Date(),
        email_error: undefined,
      });

      customerEmailSent = true;
    } catch (error) {
      emailError = error.message || "Customer wallet top-up email failed.";

      await markEmailResult(freshTransaction._id, {
        email_error: emailError,
      });

      console.error("Customer wallet top-up email failed:", error);
    }
  }

  if (!adminEmailSent) {
    try {
      await sendWalletTopupAdminEmail({
        user,
        walletTransaction: freshTransaction,
        payment,
      });

      await markEmailResult(freshTransaction._id, {
        admin_email_sent_at: new Date(),
        email_error: undefined,
      });

      adminEmailSent = true;
    } catch (error) {
      emailError = error.message || "Admin wallet top-up email failed.";

      await markEmailResult(freshTransaction._id, {
        email_error: emailError,
      });

      console.error("Admin wallet top-up email failed:", error);
    }
  }

  return {
    customerEmailSent,
    adminEmailSent,
    skipped: false,
    error: emailError || null,
  };
}