import nodemailer from "nodemailer";

function getTransporter() {
  const port = Number(process.env.SMTP_PORT || 587);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function money(amount) {
  return `A$${Number(amount || 0).toFixed(2)}`;
}

function getMailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER;
}

function getAdminEmail() {
  return (
    process.env.BOOKING_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.SMTP_USER
  );
}

function safeText(value) {
  return String(value || "").trim() || "-";
}

export async function sendWalletCreditEmails({
  customer,
  adminUser,
  transaction,
  amount,
  balanceBefore,
  balanceAfter,
  note,
}) {
  const transporter = getTransporter();

  const from = getMailFrom();
  const adminEmail = getAdminEmail();

  if (!from) {
    throw new Error("MAIL_FROM or SMTP_USER is required for wallet emails");
  }

  const customerEmail = customer?.email;
  const customerName = customer?.name || "Customer";
  const transactionReference = transaction?.transaction_reference || "-";

  const result = {
    sentCustomerEmail: false,
    sentAdminEmail: false,
    customerError: null,
    adminError: null,
  };

  const customerSubject = `Wallet credited - ${money(amount)}`;

  const customerHtml = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Wallet Credit Confirmation</h2>

      <p>Hi ${safeText(customerName)},</p>

      <p>Your wallet has been credited successfully.</p>

      <table style="border-collapse: collapse; width: 100%; max-width: 560px; margin-top: 16px;">
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Amount Credited</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${money(amount)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Previous Balance</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${money(balanceBefore)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">New Balance</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${money(balanceAfter)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Transaction Reference</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeText(transactionReference)}</td>
        </tr>
      </table>

      ${
        note
          ? `<p style="margin-top: 16px;"><strong>Note:</strong> ${safeText(note)}</p>`
          : ""
      }

      <p style="margin-top: 20px;">Thank you.</p>
    </div>
  `;

  const customerText = `
Wallet Credit Confirmation

Hi ${safeText(customerName)},

Your wallet has been credited successfully.

Amount Credited: ${money(amount)}
Previous Balance: ${money(balanceBefore)}
New Balance: ${money(balanceAfter)}
Transaction Reference: ${safeText(transactionReference)}
${note ? `Note: ${safeText(note)}` : ""}

Thank you.
`;

  const adminSubject = `Wallet credited for ${safeText(customerEmail)} - ${money(
    amount
  )}`;

  const adminHtml = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Admin Wallet Credit Notification</h2>

      <table style="border-collapse: collapse; width: 100%; max-width: 640px; margin-top: 16px;">
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Customer Name</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeText(customerName)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Customer Email</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeText(customerEmail)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Customer Phone</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeText(customer?.phone)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Amount Credited</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${money(amount)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Previous Balance</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${money(balanceBefore)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">New Balance</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${money(balanceAfter)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Transaction Reference</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeText(transactionReference)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">Processed By</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeText(
            adminUser?.email || adminUser?.name
          )}</td>
        </tr>
      </table>

      ${
        note
          ? `<p style="margin-top: 16px;"><strong>Note:</strong> ${safeText(note)}</p>`
          : ""
      }
    </div>
  `;

  const adminText = `
Admin Wallet Credit Notification

Customer Name: ${safeText(customerName)}
Customer Email: ${safeText(customerEmail)}
Customer Phone: ${safeText(customer?.phone)}
Amount Credited: ${money(amount)}
Previous Balance: ${money(balanceBefore)}
New Balance: ${money(balanceAfter)}
Transaction Reference: ${safeText(transactionReference)}
Processed By: ${safeText(adminUser?.email || adminUser?.name)}
${note ? `Note: ${safeText(note)}` : ""}
`;

  if (customerEmail) {
    try {
      await transporter.sendMail({
        from,
        to: customerEmail,
        subject: customerSubject,
        text: customerText,
        html: customerHtml,
      });

      result.sentCustomerEmail = true;
    } catch (error) {
      result.customerError = error.message || "Customer wallet email failed";
      console.error("Customer wallet credit email failed:", error);
    }
  }

  if (adminEmail) {
    try {
      await transporter.sendMail({
        from,
        to: adminEmail,
        subject: adminSubject,
        text: adminText,
        html: adminHtml,
      });

      result.sentAdminEmail = true;
    } catch (error) {
      result.adminError = error.message || "Admin wallet email failed";
      console.error("Admin wallet credit email failed:", error);
    }
  }

  return result;
}