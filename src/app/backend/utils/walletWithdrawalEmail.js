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

function money(value) {
  return `A$${Number(value || 0).toFixed(2)}`;
}

function safeText(value) {
  return String(value || "").trim() || "-";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMethod(value) {
  const labels = {
    bank_transfer: "Bank Transfer",
    paypal: "PayPal",
    cash: "Cash",
    // other: "Other",
    bank: "Bank",
    admin: "Admin",
  };

  return labels[value] || safeText(value);
}

function getTransactionRef(transaction) {
  return transaction?.transaction_reference || "-";
}

function getPayoutDetails(transaction, fallback = {}) {
  return (
    transaction?.metadata?.payout_details ||
    transaction?.payout_details ||
    fallback ||
    {}
  );
}

function renderPayoutRows(payoutDetails = {}) {
  const method = payoutDetails.method;

  if (method === "bank_transfer") {
    return `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Payout Method</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">Bank Transfer</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Account Holder</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(payoutDetails.account_holder_name)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Bank Name</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(payoutDetails.bank_name)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">BSB / Routing Number</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(payoutDetails.bsb)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Account Number</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(payoutDetails.account_number)}</td>
      </tr>
    `;
  }

  if (method === "paypal") {
    return `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Payout Method</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">PayPal</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">PayPal Email</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(payoutDetails.paypal_email)}</td>
      </tr>
    `;
  }

  return `
    <tr>
      <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Payout Method</td>
      <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(formatMethod(method))}</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Customer Note</td>
      <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(payoutDetails.customer_note)}</td>
    </tr>
  `;
}

function renderPayoutText(payoutDetails = {}) {
  const method = payoutDetails.method;

  if (method === "bank_transfer") {
    return [
      "Payout Method: Bank Transfer",
      `Account Holder: ${safeText(payoutDetails.account_holder_name)}`,
      `Bank Name: ${safeText(payoutDetails.bank_name)}`,
      `BSB / Routing Number: ${safeText(payoutDetails.bsb)}`,
      `Account Number: ${safeText(payoutDetails.account_number)}`,
    ].join("\n");
  }

  if (method === "paypal") {
    return [
      "Payout Method: PayPal",
      `PayPal Email: ${safeText(payoutDetails.paypal_email)}`,
    ].join("\n");
  }

  return [
    `Payout Method: ${formatMethod(method)}`,
    payoutDetails.customer_note
      ? `Customer Note: ${safeText(payoutDetails.customer_note)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderBaseTable({
  customer,
  transaction,
  amount,
  balanceBefore,
  balanceAfter,
  payoutDetails,
  extraRows = "",
}) {
  return `
    <table style="border-collapse:collapse;width:100%;max-width:680px;margin-top:16px;">
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Customer Name</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(customer?.name)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Customer Email</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(customer?.email)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Customer Phone</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(customer?.phone)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Withdrawal Amount</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${money(amount)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Balance Before</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${money(balanceBefore)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Balance After</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${money(balanceAfter)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Reference</td>
        <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(getTransactionRef(transaction))}</td>
      </tr>
      ${renderPayoutRows(payoutDetails)}
      ${extraRows}
    </table>
  `;
}

async function safeSendMail({ to, subject, text, html }) {
  if (!to) {
    return {
      sent: false,
      error: "Recipient email missing",
    };
  }

  const from = getMailFrom();

  if (!from) {
    return {
      sent: false,
      error: "MAIL_FROM or SMTP_USER is required",
    };
  }

  try {
    const transporter = getTransporter();

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    return {
      sent: true,
      error: null,
    };
  } catch (error) {
    console.error(`Email failed to ${to}:`, error);

    return {
      sent: false,
      error: error.message || "Email failed",
    };
  }
}

export async function sendWithdrawalRequestEmails({
  customer,
  transaction,
  amount,
  balanceBefore,
  balanceAfter,
  payoutDetails,
}) {
  const adminEmail = getAdminEmail();
  const customerEmail = customer?.email;
  const reference = getTransactionRef(transaction);

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">
      <h2>Withdrawal Request Submitted</h2>
      <p>A withdrawal request has been submitted and is pending admin review.</p>
      ${renderBaseTable({
        customer,
        transaction,
        amount,
        balanceBefore,
        balanceAfter,
        payoutDetails,
      })}
    </div>
  `;

  const text = `
Withdrawal Request Submitted

Customer: ${safeText(customer?.name)}
Email: ${safeText(customer?.email)}
Phone: ${safeText(customer?.phone)}
Amount: ${money(amount)}
Balance Before: ${money(balanceBefore)}
Balance After: ${money(balanceAfter)}
Reference: ${reference}

${renderPayoutText(payoutDetails)}
`;

  const customerResult = await safeSendMail({
    to: customerEmail,
    subject: `Withdrawal request received - ${reference}`,
    text,
    html,
  });

  const adminResult = await safeSendMail({
    to: adminEmail,
    subject: `New withdrawal request - ${safeText(customerEmail)} - ${money(amount)}`,
    text,
    html,
  });

  return {
    customer: customerResult,
    admin: adminResult,
  };
}

export async function sendWithdrawalAcceptedEmails({
  customer,
  transaction,
  amount,
  balanceBefore,
  balanceAfter,
  payoutDetails,
  adminPaymentProof,
}) {
  const adminEmail = getAdminEmail();
  const customerEmail = customer?.email;
  const reference = getTransactionRef(transaction);

  const proofRows = `
    <tr>
      <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Paid Method</td>
      <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(formatMethod(adminPaymentProof?.paid_method))}</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Payment Reference / Proof</td>
      <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(adminPaymentProof?.paid_reference)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Paid Note</td>
      <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(adminPaymentProof?.paid_note)}</td>
    </tr>
  `;

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">
      <h2>Withdrawal Request Accepted</h2>
      <p>Your withdrawal request has been accepted and marked as paid manually outside the system.</p>
      ${renderBaseTable({
        customer,
        transaction,
        amount,
        balanceBefore,
        balanceAfter,
        payoutDetails,
        extraRows: proofRows,
      })}
    </div>
  `;

  const text = `
Withdrawal Request Accepted

Customer: ${safeText(customer?.name)}
Email: ${safeText(customer?.email)}
Amount: ${money(amount)}
Reference: ${reference}
Paid Method: ${formatMethod(adminPaymentProof?.paid_method)}
Payment Reference / Proof: ${safeText(adminPaymentProof?.paid_reference)}
Paid Note: ${safeText(adminPaymentProof?.paid_note)}

${renderPayoutText(payoutDetails)}
`;

  const customerResult = await safeSendMail({
    to: customerEmail,
    subject: `Withdrawal paid - ${reference}`,
    text,
    html,
  });

  const adminResult = await safeSendMail({
    to: adminEmail,
    subject: `Withdrawal accepted/paid - ${safeText(customerEmail)} - ${money(amount)}`,
    text,
    html,
  });

  return {
    customer: customerResult,
    admin: adminResult,
  };
}

export async function sendWithdrawalRejectedEmails({
  customer,
  transaction,
  amount,
  balanceBefore,
  balanceAfter,
  payoutDetails,
  rejectionReason,
}) {
  const adminEmail = getAdminEmail();
  const customerEmail = customer?.email;
  const reference = getTransactionRef(transaction);

  const extraRows = `
    <tr>
      <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Rejected Reason</td>
      <td style="border:1px solid #e5e7eb;padding:10px;">${escapeHtml(rejectionReason)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb;padding:10px;font-weight:bold;">Amount Returned</td>
      <td style="border:1px solid #e5e7eb;padding:10px;">${money(amount)}</td>
    </tr>
  `;

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">
      <h2>Withdrawal Request Rejected</h2>
      <p>Your withdrawal request was rejected. The amount has been returned to your wallet.</p>
      ${renderBaseTable({
        customer,
        transaction,
        amount,
        balanceBefore,
        balanceAfter,
        payoutDetails,
        extraRows,
      })}
    </div>
  `;

  const text = `
Withdrawal Request Rejected

Customer: ${safeText(customer?.name)}
Email: ${safeText(customer?.email)}
Amount: ${money(amount)}
Amount Returned: ${money(amount)}
Wallet Balance Before Return: ${money(balanceBefore)}
Wallet Balance After Return: ${money(balanceAfter)}
Reference: ${reference}
Reason: ${safeText(rejectionReason)}

${renderPayoutText(payoutDetails)}
`;

  const customerResult = await safeSendMail({
    to: customerEmail,
    subject: `Withdrawal rejected - ${reference}`,
    text,
    html,
  });

  const adminResult = await safeSendMail({
    to: adminEmail,
    subject: `Withdrawal rejected - ${safeText(customerEmail)} - ${money(amount)}`,
    text,
    html,
  });

  return {
    customer: customerResult,
    admin: adminResult,
  };
}