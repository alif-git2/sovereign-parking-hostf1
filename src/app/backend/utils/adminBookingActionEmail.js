import nodemailer from "nodemailer";
import Setting from "@/app/backend/models/settings";
import {
  hasUsableEmailTemplate,
  renderEmailTemplate,
} from "@/app/backend/utils/emailTemplateRenderer";

const GLOBAL_SETTING_ID = "global_config";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safe(value, fallback = "-") {
  if (value === undefined || value === null || value === "") {
    return escapeHtml(fallback);
  }

  return escapeHtml(value);
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function money(amount) {
  return `AUD ${Number(amount || 0).toFixed(2)}`;
}

function formatText(value) {
  if (!value) return "-";

  const normalized = String(value).toLowerCase();

  if (normalized === "paypal") return "PayPal";
  if (normalized === "poa") return "Pay on Arrival";
  if (normalized === "stripe") return "Stripe";
  if (normalized === "wallet") return "Wallet";
  if (normalized === "paid") return "Paid";
  if (normalized === "unpaid") return "Unpaid";
  if (normalized === "partially_paid") return "Partially Paid";
  if (normalized === "refunded") return "Refunded";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function normalizeActionType(actionType) {
  const normalized = String(actionType || "update")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (normalized.includes("refund")) return "refund";
  if (normalized.includes("credit")) return "credit";
  if (normalized.includes("cancel")) return "cancel";
  if (normalized.includes("resend")) return "resend";
  if (normalized.includes("confirmation")) return "resend";
  if (normalized.includes("save")) return "update";
  if (normalized.includes("update")) return "update";

  return normalized || "update";
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

  const port = Number(process.env.SMTP_PORT || 465);

  if (Number.isNaN(port)) {
    throw new Error("SMTP_PORT must be a valid number");
  }

  const secure =
    process.env.SMTP_SECURE !== undefined
      ? ["true", "1", "yes"].includes(
          String(process.env.SMTP_SECURE).toLowerCase()
        )
      : port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function tableRow(label, value) {
  return `
    <tr>
      <td style="border:1px solid #ddd; padding:10px; width:40%; background:#f8f9fa;">
        <strong>${escapeHtml(label)}</strong>
      </td>
      <td style="border:1px solid #ddd; padding:10px;">
        ${safe(value)}
      </td>
    </tr>
  `;
}

function tableSectionTitle(title) {
  return `
    <tr>
      <td colspan="2" style="background:#0b5ed7; color:#ffffff; padding:10px; border:1px solid #0b5ed7;">
        <strong>${escapeHtml(title)}</strong>
      </td>
    </tr>
  `;
}

function getActionTitle(actionType) {
  const action = normalizeActionType(actionType);

  if (action === "refund") return "Refunded";
  if (action === "credit") return "Credited to Wallet";
  if (action === "cancel") return "Cancelled";
  if (action === "resend") return "Confirmation Email Resent";
  if (action === "update") return "Updated";

  return formatText(action);
}

function getCustomerIntro(actionType) {
  const action = normalizeActionType(actionType);

  if (action === "refund") {
    return "Your booking has been refunded and cancelled by admin.";
  }

  if (action === "credit") {
    return "Your booking has been cancelled and the returned amount has been credited to your wallet.";
  }

  if (action === "cancel") {
    return "Your booking has been cancelled by admin.";
  }

  if (action === "resend") {
    return "Your booking confirmation email has been resent.";
  }

  return "Your booking has been updated by admin.";
}

function getAdminIntro(actionType) {
  const action = normalizeActionType(actionType);

  if (action === "refund") {
    return "A booking refund action has been completed by admin.";
  }

  if (action === "credit") {
    return "A booking credit-to-wallet action has been completed by admin.";
  }

  if (action === "cancel") {
    return "A booking cancellation action has been completed by admin.";
  }

  if (action === "resend") {
    return "A booking confirmation email has been resent by admin.";
  }

  return "A booking action has been completed by admin.";
}

function shouldShowReturnDetails(actionType) {
  const action = normalizeActionType(actionType);

  return action === "refund" || action === "credit" || action === "cancel";
}

function getBookingId(booking) {
  return firstValue(booking?.booking_id, booking?.bookingId, booking?._id, "-");
}

function getCustomerName(booking) {
  return firstValue(
    booking?.customer?.name,
    booking?.customer_id?.name,
    booking?.user_id?.name,
    booking?.user?.name,
    booking?.parking_user?.name,
    booking?.parkingUser?.name,
    booking?.customer_name,
    booking?.details?.customer?.name,
    "-"
  );
}

function getCustomerEmail(booking) {
  return firstValue(
    booking?.customer?.email,
    booking?.customer_id?.email,
    booking?.user_id?.email,
    booking?.user?.email,
    booking?.parking_user?.email,
    booking?.parkingUser?.email,
    booking?.customer_email,
    booking?.email,
    booking?.details?.customer?.email,
    "-"
  );
}

function getCustomerPhone(booking) {
  return firstValue(
    booking?.customer?.phone,
    booking?.customer_id?.phone,
    booking?.user_id?.phone,
    booking?.user?.phone,
    booking?.parking_user?.phone,
    booking?.parkingUser?.phone,
    booking?.customer_phone,
    booking?.phone,
    booking?.details?.customer?.phone,
    "-"
  );
}

function getLocationName(booking) {
  return firstValue(
    booking?.location_id?.name,
    booking?.location?.name,
    booking?.details?.location_name,
    booking?.location_name,
    "-"
  );
}

function getBookingStatusText(booking, actionType) {
  const action = normalizeActionType(actionType);

  if (action === "refund" || action === "credit" || action === "cancel") {
    return "Cancelled";
  }

  return formatText(booking?.status);
}

function getBookingTypeKey(type) {
  const value = String(type || "").toLowerCase().trim();

  if (["cruise", "airport", "storage"].includes(value)) {
    return value;
  }

  return null;
}

function getCustomerTemplateKeyFromAction(actionType) {
  const action = normalizeActionType(actionType);

  if (action === "cancel") return "cancellation";
  if (action === "refund") return "refund";
  if (action === "credit") return "credit";

  return null;
}

function renderPlainTemplate(template = "", variables = {}) {
  return String(template || "").replace(
    /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g,
    (_, key) => String(variables[key] ?? "")
  );
}

function sanitizeAdminEmailHtml(html = "") {
  return String(html || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\son\w+=\S+/gi, "")
    .replace(/javascript:/gi, "");
}

function getPaymentReference(booking) {
  return (
    firstValue(
      booking?.payment_reference,
      booking?.manual_payment_reference,
      booking?.reference_payment,
      booking?.transaction_reference,
      booking?.transaction_id,
      booking?.payment_id?.payment_reference,
      booking?.payment_id?.transaction_reference,
      booking?.payment_id?.transaction_id,
      booking?.payment_id?.stripe_payment_intent_id,
      booking?.payment_id?.paypal_order_id,
      booking?.payment_id?.paypal_capture_id,
      booking?.stripe_payment_intent_id,
      booking?.paypal_capture_id,
      booking?.paypal_order_id,
      booking?.wallet_transaction_id?.transaction_reference,
      booking?.wallet_transaction_id?.transaction_id,
      booking?.reference
    ) || "-"
  );
}

function getCruiseShipDepartureDate(booking) {
  return firstValue(
    booking?.details?.cruise?.ship_departure,
    booking?.details?.cruise?.departure_date,
    booking?.details?.cruise?.ship_departure_date,
    booking?.schedule_id?.departure_date,
    booking?.schedule_id?.ship_departure,
    booking?.cruise_schedule_id?.departure_date,
    booking?.cruise_schedule_id?.ship_departure,
    booking?.cruise_schedule?.departure_date,
    booking?.cruise_schedule?.ship_departure,
    booking?.start_date
  );
}

function getCruiseShipArrivalDate(booking) {
  return firstValue(
    booking?.details?.cruise?.ship_arrival,
    booking?.details?.cruise?.arrival_date,
    booking?.details?.cruise?.return_date,
    booking?.details?.cruise?.ship_arrival_date,
    booking?.schedule_id?.arrival_date,
    booking?.schedule_id?.return_date,
    booking?.schedule_id?.ship_arrival,
    booking?.cruise_schedule_id?.arrival_date,
    booking?.cruise_schedule_id?.return_date,
    booking?.cruise_schedule_id?.ship_arrival,
    booking?.cruise_schedule?.arrival_date,
    booking?.cruise_schedule?.return_date,
    booking?.cruise_schedule?.ship_arrival,
    booking?.end_date
  );
}

function getStorageTypeName(booking) {
  const storage = booking?.details?.storage || {};

  return firstValue(
    storage.storage_type_name,
    storage.storage_type,
    storage.storage_type_id?.name,
    "-"
  );
}

function getAirportShuttleText(booking) {
  return booking?.details?.airport?.shuttle_time || "No shuttle";
}

function getPassengers(booking) {
  return firstValue(
    booking?.details?.cruise?.pickup_pax,
    booking?.details?.airport?.pickup_pax,
    booking?.pax,
    0
  );
}

function getCouponCode(booking) {
  return firstValue(
    booking?.coupon_code,
    booking?.coupon_id?.code,
    booking?.coupon_id?.coupon_code,
    "No coupon"
  );
}

function getPricingValues(booking) {
  const originalPrice = Number(
    booking?.original_price !== undefined && booking?.original_price !== null
      ? booking.original_price
      : booking?.price || 0
  );

  const discountAmount = Number(booking?.discount_amount || 0);

  const finalPrice = Number(
    booking?.price !== undefined && booking?.price !== null
      ? booking.price
      : originalPrice - discountAmount
  );

  const paidAmount = Number(booking?.paid_amount || 0);

  const dueAmount = Number(
    booking?.due_amount !== undefined && booking?.due_amount !== null
      ? booking.due_amount
      : finalPrice - paidAmount
  );

  return {
    originalPrice,
    discountAmount,
    finalPrice,
    paidAmount,
    dueAmount,
    couponCode: getCouponCode(booking),
  };
}

function getCancellationReason(booking) {
  return firstValue(
    booking?.cancellation_request?.admin_note,
    booking?.cancellation_request?.reason,
    booking?.cancellation_reason,
    booking?.admin_action_label,
    "Cancelled by admin"
  );
}

async function getCustomerAdminActionTemplate({ booking, actionType }) {
  const bookingType = getBookingTypeKey(booking?.type);
  const templateKey = getCustomerTemplateKeyFromAction(actionType);

  if (!bookingType || !templateKey) {
    return null;
  }

  const settings = await Setting.findById(GLOBAL_SETTING_ID).lean();

  return (
    settings?.email_templates?.customer?.[bookingType]?.[templateKey] || null
  );
}

function buildCustomerAdminActionTemplateVariables({
  booking,
  actionType,
  paidAmount,
  feeAmount,
  returnAmount,
  returnMethod,
  adminUser,
}) {
  const action = normalizeActionType(actionType);
  const pricing = getPricingValues(booking);

  const returnedAmount = Number(
    returnAmount ||
      booking?.admin_action_return_amount ||
      booking?.refund_amount ||
      booking?.credit_amount ||
      0
  );

  const adminFee = Number(
    feeAmount || booking?.admin_action_fee_amount || booking?.fee_deducted || 0
  );

  const amountPaid = Number(
    paidAmount || booking?.admin_action_paid_amount || pricing.paidAmount || 0
  );

  const actionTitle = getActionTitle(action);

  return {
    customer_name: getCustomerName(booking),
    customer_email: getCustomerEmail(booking),
    customer_phone: getCustomerPhone(booking),

    booking_id: getBookingId(booking),
    payment_reference: getPaymentReference(booking),
    booking_type: formatText(booking?.type),
    booking_type_key: booking?.type || "",
    status: getBookingStatusText(booking, action),
    booking_status: getBookingStatusText(booking, action),
    payment_status: formatText(booking?.payment_status),
    payment_method: formatText(booking?.payment_method),
    payment_flow: formatText(booking?.payment_flow),

    location_name: getLocationName(booking),
    start_date: formatDate(booking?.start_date),
    end_date: formatDate(booking?.end_date),
    entry_date: formatDate(booking?.start_date),
    exit_date: formatDate(booking?.end_date),

    ship_departure: formatDate(getCruiseShipDepartureDate(booking)),
    ship_arrival: formatDate(getCruiseShipArrivalDate(booking)),
    ship_name: booking?.details?.cruise?.ship_name || "",
    license_plate: booking?.license_plate || "",
    passengers: getPassengers(booking),
    shuttle_time:
      booking?.details?.cruise?.shuttle_time ||
      booking?.details?.airport?.shuttle_time ||
      getAirportShuttleText(booking),
    storage_type: getStorageTypeName(booking),

    original_price: money(pricing.originalPrice),
    subtotal_price: money(pricing.originalPrice),
    coupon_code: pricing.couponCode,
    discount_amount: money(pricing.discountAmount),
    total_price: money(pricing.finalPrice),
    paid_amount: money(amountPaid),
    due_amount: money(pricing.dueAmount),

    cancellation_reason: getCancellationReason(booking),
    refund_amount: action === "refund" ? money(returnedAmount) : "",
    credit_amount: action === "credit" ? money(returnedAmount) : "",

    action_type: action,
    action_title: actionTitle,
    return_amount: money(returnedAmount),
    returned_amount: money(returnedAmount),
    fee_amount: money(adminFee),
    admin_fee: money(adminFee),
    return_method: getReturnMethodText(
      returnMethod || booking?.admin_action_return_method,
      action
    ),
    admin_name: adminUser?.name || "",
    admin_email: adminUser?.email || "",
    processed_by: adminUser?.email || adminUser?.name || "Admin",
    processed_at: formatDate(new Date()),
  };
}

async function buildCustomerAdminActionEmailContent({
  booking,
  actionType,
  paidAmount,
  feeAmount,
  returnAmount,
  returnMethod,
  adminUser,
}) {
  const normalizedActionType = normalizeActionType(actionType);
  const actionTitle = getActionTitle(normalizedActionType);
  const bookingId = getBookingId(booking);

  const fallbackContent = {
    subject: `Booking ${actionTitle} - ${bookingId}`,
    html: buildAdminActionEmailHtml({
      booking,
      actionType: normalizedActionType,
      paidAmount,
      feeAmount,
      returnAmount,
      returnMethod,
      adminUser,
      recipientType: "customer",
    }),
    text: buildAdminActionEmailText({
      booking,
      actionType: normalizedActionType,
      paidAmount,
      feeAmount,
      returnAmount,
      returnMethod,
      adminUser,
      recipientType: "customer",
    }),
  };

  try {
    const template = await getCustomerAdminActionTemplate({
      booking,
      actionType: normalizedActionType,
    });

    if (!hasUsableEmailTemplate(template)) {
      return fallbackContent;
    }

    const variables = buildCustomerAdminActionTemplateVariables({
      booking,
      actionType: normalizedActionType,
      paidAmount,
      feeAmount,
      returnAmount,
      returnMethod,
      adminUser,
    });

    return {
      subject: template.subject?.trim()
        ? renderPlainTemplate(template.subject, variables)
        : fallbackContent.subject,

      html: sanitizeAdminEmailHtml(
        renderEmailTemplate(template.html, variables)
      ),

      text: template.text?.trim()
        ? renderPlainTemplate(template.text, variables)
        : fallbackContent.text,
    };
  } catch (error) {
    console.error("Customer admin action email template render failed:", {
      message: error?.message,
      bookingId,
      actionType: normalizedActionType,
    });

    return fallbackContent;
  }
}

function getReturnMethodText(returnMethod, actionType) {
  const action = normalizeActionType(actionType);

  if (action === "credit") {
    return "Customer Wallet";
  }

  if (returnMethod === "wallet") {
    return "Customer Wallet";
  }

  return formatText(returnMethod);
}

function getEmailError(error) {
  return {
    message: error?.message || "Email sending failed",
    code: error?.code,
    command: error?.command,
    response: error?.response,
  };
}

function buildActionDetailsHtml({
  booking,
  actionType,
  paidAmount,
  feeAmount,
  returnAmount,
  returnMethod,
  adminUser,
  recipientType,
}) {
  const actionTitle = getActionTitle(actionType);

  if (shouldShowReturnDetails(actionType)) {
    return `
      ${tableSectionTitle("Admin Action Details")}
      ${tableRow("Action", actionTitle)}
      ${tableRow("Paid Amount", money(paidAmount))}
      ${tableRow("Admin Fee", money(feeAmount))}
      ${tableRow("Returned Amount", money(returnAmount))}
      ${tableRow("Return Method", getReturnMethodText(returnMethod, actionType))}
      ${
        recipientType === "admin"
          ? tableRow("Processed By", adminUser?.email || adminUser?.name || "-")
          : ""
      }
    `;
  }

  return `
    ${tableSectionTitle("Action Details")}
    ${tableRow("Action", actionTitle)}
    ${tableRow("Booking Status", getBookingStatusText(booking, actionType))}
    ${tableRow("Payment Status", formatText(booking?.payment_status))}
    ${
      recipientType === "admin"
        ? tableRow("Processed By", adminUser?.email || adminUser?.name || "-")
        : ""
    }
  `;
}

function buildActionDetailsText({
  booking,
  actionType,
  paidAmount,
  feeAmount,
  returnAmount,
  returnMethod,
  adminUser,
  recipientType,
}) {
  const actionTitle = getActionTitle(actionType);

  if (shouldShowReturnDetails(actionType)) {
    return `
Admin Action Details
Action: ${actionTitle}
Paid Amount: ${money(paidAmount)}
Admin Fee: ${money(feeAmount)}
Returned Amount: ${money(returnAmount)}
Return Method: ${getReturnMethodText(returnMethod, actionType)}
${
  recipientType === "admin"
    ? `Processed By: ${adminUser?.email || adminUser?.name || "-"}`
    : ""
}
    `.trim();
  }

  return `
Action Details
Action: ${actionTitle}
Booking Status: ${getBookingStatusText(booking, actionType)}
Payment Status: ${formatText(booking?.payment_status)}
${
  recipientType === "admin"
    ? `Processed By: ${adminUser?.email || adminUser?.name || "-"}`
    : ""
}
  `.trim();
}

function buildAdminActionEmailHtml({
  booking,
  actionType,
  paidAmount,
  feeAmount,
  returnAmount,
  returnMethod,
  adminUser,
  recipientType,
}) {
  const actionTitle = getActionTitle(actionType);

  const heading =
    recipientType === "admin"
      ? `Admin Booking ${actionTitle}`
      : `Booking ${actionTitle}`;

  const introText =
    recipientType === "admin"
      ? getAdminIntro(actionType)
      : getCustomerIntro(actionType);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #222;">
      <h2 style="background:#0b5ed7; color:#ffffff; padding:16px; border-radius:8px;">
        ${escapeHtml(heading)}
      </h2>

      <p>${escapeHtml(introText)}</p>

      <table style="width:100%; border-collapse:collapse; margin-top:20px;">
        <tbody>
          ${tableSectionTitle("Booking Details")}
          ${tableRow("Booking ID", getBookingId(booking))}
          ${tableRow("Booking Type", formatText(booking?.type))}
          ${tableRow("Booking Status", getBookingStatusText(booking, actionType))}
          ${tableRow("Payment Status", formatText(booking?.payment_status))}
          ${tableRow("Payment Method", formatText(booking?.payment_method))}
          ${tableRow("Payment Flow", formatText(booking?.payment_flow))}

          ${tableSectionTitle("Customer Details")}
          ${tableRow("Customer Name", getCustomerName(booking))}
          ${tableRow("Customer Email", getCustomerEmail(booking))}
          ${tableRow("Customer Phone", getCustomerPhone(booking))}

          ${tableSectionTitle("Booking Date & Location")}
          ${tableRow("Location", getLocationName(booking))}
          ${tableRow("Start Date", formatDate(booking?.start_date))}
          ${tableRow("End Date", formatDate(booking?.end_date))}

          ${buildActionDetailsHtml({
            booking,
            actionType,
            paidAmount,
            feeAmount,
            returnAmount,
            returnMethod,
            adminUser,
            recipientType,
          })}
        </tbody>
      </table>

      <p style="margin-top:24px; color:#666;">
        This is an automated booking action notification.
      </p>
    </div>
  `;
}

function buildAdminActionEmailText({
  booking,
  actionType,
  paidAmount,
  feeAmount,
  returnAmount,
  returnMethod,
  adminUser,
  recipientType,
}) {
  const actionTitle = getActionTitle(actionType);

  const heading =
    recipientType === "admin"
      ? `Admin Booking ${actionTitle}`
      : `Booking ${actionTitle}`;

  const introText =
    recipientType === "admin"
      ? getAdminIntro(actionType)
      : getCustomerIntro(actionType);

  return `
${heading}

${introText}

Booking Details
Booking ID: ${getBookingId(booking)}
Booking Type: ${formatText(booking?.type)}
Booking Status: ${getBookingStatusText(booking, actionType)}
Payment Status: ${formatText(booking?.payment_status)}
Payment Method: ${formatText(booking?.payment_method)}
Payment Flow: ${formatText(booking?.payment_flow)}

Customer Details
Customer Name: ${getCustomerName(booking)}
Customer Email: ${getCustomerEmail(booking)}
Customer Phone: ${getCustomerPhone(booking)}

Booking Date & Location
Location: ${getLocationName(booking)}
Start Date: ${formatDate(booking?.start_date)}
End Date: ${formatDate(booking?.end_date)}

${buildActionDetailsText({
  booking,
  actionType,
  paidAmount,
  feeAmount,
  returnAmount,
  returnMethod,
  adminUser,
  recipientType,
})}

This is an automated booking action notification.
  `.trim();
}

export async function sendAdminBookingActionEmails({
  booking,
  actionType = "update",
  paidAmount = 0,
  feeAmount = 0,
  returnAmount = 0,
  returnMethod = "-",
  adminUser = null,
  adminEmail = process.env.BOOKING_ADMIN_EMAIL,
  sendCustomerEmail = true,
  sendAdminEmail = true,
} = {}) {
  if (!booking) {
    throw new Error("Booking is missing");
  }

  const customerEmail = getCustomerEmail(booking);
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const normalizedActionType = normalizeActionType(actionType);
  const actionTitle = getActionTitle(normalizedActionType);
  const bookingId = getBookingId(booking);

  const shouldSendCustomerEmail =
    sendCustomerEmail !== false && customerEmail && customerEmail !== "-";

  const shouldSendAdminEmail =
    sendAdminEmail !== false && adminEmail && adminEmail !== "-";

  if (!shouldSendCustomerEmail && !shouldSendAdminEmail) {
    return {
      success: false,
      sentCustomerEmail: false,
      sentAdminEmail: false,
      message: "No customer or admin email address available",
      results: [],
    };
  }

  const transporter = getTransporter();
  const emailJobs = [];

  if (shouldSendCustomerEmail) {
    const customerEmailContent = await buildCustomerAdminActionEmailContent({
      booking,
      actionType: normalizedActionType,
      paidAmount,
      feeAmount,
      returnAmount,
      returnMethod,
      adminUser,
    });

    emailJobs.push({
      type: "customer",
      to: customerEmail,
      promise: transporter.sendMail({
        from,
        to: customerEmail,
        subject: customerEmailContent.subject,
        html: customerEmailContent.html,
        text: customerEmailContent.text,
      }),
    });
  }

  if (shouldSendAdminEmail) {
    emailJobs.push({
      type: "admin",
      to: adminEmail,
      promise: transporter.sendMail({
        from,
        to: adminEmail,
        subject: `Admin Booking ${actionTitle} - ${bookingId}`,
        html: buildAdminActionEmailHtml({
          booking,
          actionType: normalizedActionType,
          paidAmount,
          feeAmount,
          returnAmount,
          returnMethod,
          adminUser,
          recipientType: "admin",
        }),
        text: buildAdminActionEmailText({
          booking,
          actionType: normalizedActionType,
          paidAmount,
          feeAmount,
          returnAmount,
          returnMethod,
          adminUser,
          recipientType: "admin",
        }),
      }),
    });
  }

  const settledResults = await Promise.allSettled(
    emailJobs.map((job) => job.promise)
  );

  const results = settledResults.map((result, index) => {
    const job = emailJobs[index];

    if (result.status === "fulfilled") {
      return {
        type: job.type,
        to: job.to,
        success: true,
        messageId: result.value?.messageId || null,
        error: null,
      };
    }

    return {
      type: job.type,
      to: job.to,
      success: false,
      messageId: null,
      error: getEmailError(result.reason),
    };
  });

  const failedEmails = results.filter((result) => !result.success);

  if (failedEmails.length > 0) {
    console.error("Some admin booking action emails failed:", failedEmails);
  }

  return {
    success: failedEmails.length === 0,
    sentCustomerEmail: results.some(
      (result) => result.type === "customer" && result.success
    ),
    sentAdminEmail: results.some(
      (result) => result.type === "admin" && result.success
    ),
    results,
  };
}

export default sendAdminBookingActionEmails;