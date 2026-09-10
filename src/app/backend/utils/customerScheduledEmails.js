import nodemailer from "nodemailer";
import Booking from "@/app/backend/models/booking";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import Location from "@/app/backend/models/location";
import CruiseSchedule from "@/app/backend/models/cruiseschedule";
import Coupon from "@/app/backend/models/coupon";
import StorageType from "@/app/backend/models/storagetype";
import Setting from "@/app/backend/models/settings";
import {
  hasUsableEmailTemplate,
  renderEmailTemplate,
} from "@/app/backend/utils/emailTemplateRenderer";

const GLOBAL_SETTING_ID = "global_config";

const ACTIVE_BOOKING_TYPES = ["cruise", "airport", "storage"];

const ACTIVE_BOOKING_STATUSES = [
  "success",
  "confirmed",
  "poa",
];

const DEFAULT_SCHEDULED_EMAIL_LIMIT = 100;
const MAX_SCHEDULED_EMAIL_LIMIT = 500;
const DEFAULT_EMAIL_LOCK_MINUTES = 60;
const MIN_EMAIL_LOCK_MINUTES = 5;
const MAX_EMAIL_LOCK_MINUTES = 240;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
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
  if (normalized === "partial") return "Partial";
  if (normalized === "partially_paid") return "Partially Paid";
  if (normalized === "success") return "Success";
  if (normalized === "confirmed") return "Confirmed";
  if (normalized === "pending") return "Pending";
  if (normalized === "pending_payment") return "Pending Payment";
  if (normalized === "refunded") return "Refunded";
  if (normalized === "cancelled" || normalized === "canceled") {
    return "Cancelled";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getBookingTimeZone() {
  const timeZone = String(process.env.BOOKING_TIMEZONE || "").trim();

  if (!timeZone) {
    throw new Error(
      "BOOKING_TIMEZONE is missing. Set it to your business IANA timezone, for example Australia/Brisbane or Australia/Sydney."
    );
  }

  try {
    new Intl.DateTimeFormat("en-AU", {
      timeZone,
    }).format(new Date());
  } catch {
    throw new Error(
      `BOOKING_TIMEZONE is invalid: ${timeZone}. Use a valid IANA timezone.`
    );
  }

  return timeZone;
}

function formatDate(date) {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleDateString("en-AU", {
    timeZone: getBookingTimeZone(),
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function renderPlainTemplate(template = "", variables = {}) {
  return String(template || "").replace(
    /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g,
    (_, key) => String(variables[key] ?? "")
  );
}

function sanitizeEmailHtml(html = "") {
  return String(html || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\son\w+=\S+/gi, "")
    .replace(/javascript:/gi, "");
}

function getBookingTypeKey(type) {
  const value = String(type || "").toLowerCase().trim();

  if (ACTIVE_BOOKING_TYPES.includes(value)) {
    return value;
  }

  return null;
}

function getBookingTypeTitle(type) {
  const value = getBookingTypeKey(type);

  if (value === "cruise") return "Cruise";
  if (value === "airport") return "Airport Parking";
  if (value === "storage") return "Storage";

  return "Booking";
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
    "Customer"
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
    null
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

function getPassengers(booking) {
  return firstValue(
    booking?.details?.cruise?.pickup_pax,
    booking?.details?.airport?.pickup_pax,
    booking?.pax,
    0
  );
}

function getShuttleTime(booking) {
  return firstValue(
    booking?.details?.cruise?.shuttle_time,
    booking?.details?.airport?.shuttle_time,
    "No shuttle"
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

function getSiteUrl() {
  return String(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.SITE_URL ||
      process.env.APP_URL ||
      ""
  ).replace(/\/+$/, "");
}

function getFeedbackUrl(booking) {
  const customFeedbackUrl = String(process.env.FEEDBACK_URL || "").trim();

  if (customFeedbackUrl) {
    return customFeedbackUrl
      .replace(
        /{{\s*booking_id\s*}}/g,
        encodeURIComponent(String(getBookingId(booking) || ""))
      )
      .replace(
        /{{\s*booking_mongo_id\s*}}/g,
        encodeURIComponent(String(booking?._id || ""))
      );
  }

  const siteUrl = getSiteUrl();

  if (!siteUrl) {
    return "";
  }

  return `${siteUrl}/feedback?bookingId=${encodeURIComponent(
    String(getBookingId(booking) || "")
  )}`;
}

function buildTemplateVariables(booking, templateKey) {
  const pricing = getPricingValues(booking);
  const bookingTypeKey = getBookingTypeKey(booking?.type) || "";
  const siteUrl = getSiteUrl();

  return {
    customer_name: getCustomerName(booking),
    customer_email: getCustomerEmail(booking) || "",
    customer_phone: getCustomerPhone(booking),

    booking_id: getBookingId(booking),
    payment_reference: getPaymentReference(booking),
    booking_type: getBookingTypeTitle(booking?.type),
    booking_type_key: bookingTypeKey,

    status: formatText(booking?.status),
    booking_status: formatText(booking?.status),
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
    shuttle_time: getShuttleTime(booking),
    storage_type: getStorageTypeName(booking),

    original_price: money(pricing.originalPrice),
    subtotal_price: money(pricing.originalPrice),
    coupon_code: pricing.couponCode,
    discount_amount: money(pricing.discountAmount),
    total_price: money(pricing.finalPrice),
    paid_amount: money(pricing.paidAmount),
    due_amount: money(pricing.dueAmount),

    reminder_date: formatDate(booking?.start_date),
    days_until_booking: templateKey === "reminder" ? "1" : "",
    feedback_url: getFeedbackUrl(booking),
    site_url: siteUrl,
  };
}

function buildFallbackHtml(templateKey, variables) {
  const isReminder = templateKey === "reminder";

  const title = isReminder
    ? "Sovereign Parking — Booking Reminder"
    : "Sovereign Parking — We Value Your Feedback";

  const headerColor = isReminder ? "#7c3aed" : "#0f766e";

  const intro = isReminder
    ? `This is a friendly reminder that your ${variables.booking_type} booking ${variables.booking_id} is scheduled for tomorrow.`
    : `Your ${variables.booking_type} booking ${variables.booking_id} has finished. We hope everything went smoothly.`;

  const feedbackButton =
    !isReminder && variables.feedback_url
      ? `<p style="margin-top:24px;">
          <a href="${escapeHtml(
            variables.feedback_url
          )}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Leave Feedback
          </a>
        </p>`
      : "";

  return `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#222;">
      <h2 style="background:${headerColor};color:#fff;padding:16px;border-radius:8px;">
        ${escapeHtml(title)}
      </h2>

      <p>Dear <strong>${escapeHtml(variables.customer_name)}</strong>,</p>

      <p>${escapeHtml(intro)}</p>

      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <tbody>
          <tr>
            <td style="border:1px solid #ddd;padding:10px;background:#f8f9fa;">
              <strong>Booking ID</strong>
            </td>
            <td style="border:1px solid #ddd;padding:10px;">
              ${escapeHtml(variables.booking_id)}
            </td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd;padding:10px;background:#f8f9fa;">
              <strong>Booking Type</strong>
            </td>
            <td style="border:1px solid #ddd;padding:10px;">
              ${escapeHtml(variables.booking_type)}
            </td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd;padding:10px;background:#f8f9fa;">
              <strong>Location</strong>
            </td>
            <td style="border:1px solid #ddd;padding:10px;">
              ${escapeHtml(variables.location_name)}
            </td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd;padding:10px;background:#f8f9fa;">
              <strong>Start Date</strong>
            </td>
            <td style="border:1px solid #ddd;padding:10px;">
              ${escapeHtml(variables.start_date)}
            </td>
          </tr>

          <tr>
            <td style="border:1px solid #ddd;padding:10px;background:#f8f9fa;">
              <strong>End Date</strong>
            </td>
            <td style="border:1px solid #ddd;padding:10px;">
              ${escapeHtml(variables.end_date)}
            </td>
          </tr>
        </tbody>
      </table>

      ${feedbackButton}

      <p style="margin-top:24px;color:#666;">
        This is an automated email from Sovereign Parking.
      </p>
    </div>
  `;
}

function buildFallbackText(templateKey, variables) {
  if (templateKey === "reminder") {
    return `
Dear ${variables.customer_name},

This is a reminder that your ${variables.booking_type} booking ${variables.booking_id} is tomorrow.

Location: ${variables.location_name}
Start Date: ${variables.start_date}
End Date: ${variables.end_date}

Thank you for choosing Sovereign Parking.
    `.trim();
  }

  return `
Dear ${variables.customer_name},

Your ${variables.booking_type} booking ${variables.booking_id} has finished.

Location: ${variables.location_name}
Start Date: ${variables.start_date}
End Date: ${variables.end_date}

Please share your feedback:
${variables.feedback_url}

Thank you for choosing Sovereign Parking.
  `.trim();
}

async function getCustomerTemplate(booking, templateKey) {
  const bookingType = getBookingTypeKey(booking?.type);

  if (!bookingType) {
    return null;
  }

  const settings = await Setting.findById(GLOBAL_SETTING_ID).lean();

  return (
    settings?.email_templates?.customer?.[bookingType]?.[templateKey] || null
  );
}

async function buildEmailContent({ booking, templateKey }) {
  const variables = buildTemplateVariables(booking, templateKey);

  const fallbackSubject =
    templateKey === "reminder"
      ? `Reminder: Your ${variables.booking_type} Booking is Tomorrow - ${variables.booking_id}`
      : `How was your Sovereign Parking experience? - ${variables.booking_id}`;

  const fallbackContent = {
    subject: fallbackSubject,
    html: buildFallbackHtml(templateKey, variables),
    text: buildFallbackText(templateKey, variables),
  };

  const template = await getCustomerTemplate(booking, templateKey);

  if (template?.is_active === false) {
    return null;
  }

  if (!hasUsableEmailTemplate(template)) {
    return fallbackContent;
  }

  return {
    subject: template.subject?.trim()
      ? renderPlainTemplate(template.subject, variables)
      : fallbackSubject,

    html: sanitizeEmailHtml(renderEmailTemplate(template.html, variables)),

    text: template.text?.trim()
      ? renderPlainTemplate(template.text, variables)
      : fallbackContent.text,
  };
}

function getTimeZoneDateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function addCalendarDays(parts, days) {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + Number(days || 0))
  );

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - date.getTime();
}

function zonedMidnightToUtc(parts, timeZone) {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);

  let result = new Date(utcGuess);

  // Recalculate twice so DST/offset transitions around the target day settle
  // correctly for standard IANA timezones.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const offset = getTimeZoneOffsetMs(result, timeZone);
    result = new Date(utcGuess - offset);
  }

  return result;
}

function getDateRangeForDayOffset(offset) {
  const timeZone = getBookingTimeZone();
  const todayParts = getTimeZoneDateParts(new Date(), timeZone);
  const targetParts = addCalendarDays(todayParts, offset);
  const nextParts = addCalendarDays(targetParts, 1);

  return {
    start: zonedMidnightToUtc(targetParts, timeZone),
    end: zonedMidnightToUtc(nextParts, timeZone),
    timeZone,
  };
}

function getScheduledEmailLimit(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 1) {
    return DEFAULT_SCHEDULED_EMAIL_LIMIT;
  }

  return Math.min(
    Math.floor(number),
    MAX_SCHEDULED_EMAIL_LIMIT
  );
}

function getEmailLockMinutes() {
  const number = Number(
    process.env.SCHEDULED_EMAIL_LOCK_MINUTES ||
      DEFAULT_EMAIL_LOCK_MINUTES
  );

  if (!Number.isFinite(number)) {
    return DEFAULT_EMAIL_LOCK_MINUTES;
  }

  return Math.min(
    Math.max(Math.floor(number), MIN_EMAIL_LOCK_MINUTES),
    MAX_EMAIL_LOCK_MINUTES
  );
}

function getStaleLockBefore() {
  return new Date(Date.now() - getEmailLockMinutes() * 60 * 1000);
}

function populateBookingQuery(query) {
  return query
    .populate({
      path: "location_id",
      model: Location,
    })
    .populate({
      path: "schedule_id",
      model: CruiseSchedule,
    })
    .populate({
      path: "user_id",
      model: ParkingUser,
      select: "name email phone role",
    })
    .populate({
      path: "coupon_id",
      model: Coupon,
    })
    .populate({
      path: "details.storage.storage_type_id",
      model: StorageType,
    })
    .populate({
      path: "wallet_transaction_id",
      model: WalletTransaction,
      select: "transaction_reference transaction_id amount method status",
    });
}

function baseBookingQuery(filter = {}) {
  return populateBookingQuery(Booking.find(filter));
}

async function getReminderBookings(limit) {
  const { start, end } = getDateRangeForDayOffset(1);
  const staleLockBefore = getStaleLockBefore();

  return baseBookingQuery({
    type: {
      $in: ACTIVE_BOOKING_TYPES,
    },

    status: {
      $in: ACTIVE_BOOKING_STATUSES,
    },

    start_date: {
      $gte: start,
      $lt: end,
    },

    reminder_email_sent_at: null,

    $or: [
      {
        reminder_email_processing_at: null,
      },
      {
        reminder_email_processing_at: {
          $exists: false,
        },
      },
      {
        reminder_email_processing_at: {
          $lt: staleLockBefore,
        },
      },
    ],
  })
    .limit(limit)
    .sort({
      start_date: 1,
    });
}

async function getFeedbackBookings(limit) {
  const { start, end } = getDateRangeForDayOffset(-1);
  const staleLockBefore = getStaleLockBefore();

  return baseBookingQuery({
    type: {
      $in: ACTIVE_BOOKING_TYPES,
    },

    status: {
      $in: ACTIVE_BOOKING_STATUSES,
    },

    // Exactly one calendar day after exit:
    // today processes bookings whose exit date was yesterday.
    end_date: {
      $gte: start,
      $lt: end,
    },

    feedback_email_sent_at: null,

    $or: [
      {
        feedback_email_processing_at: null,
      },
      {
        feedback_email_processing_at: {
          $exists: false,
        },
      },
      {
        feedback_email_processing_at: {
          $lt: staleLockBefore,
        },
      },
    ],
  })
    .limit(limit)
    .sort({
      end_date: 1,
    });
}

async function claimScheduledEmailBooking({
  bookingId,
  sentField,
  processingField,
}) {
  const claimedAt = new Date();
  const staleLockBefore = getStaleLockBefore();

  const claimedBooking = await populateBookingQuery(
    Booking.findOneAndUpdate(
      {
        _id: bookingId,

        type: {
          $in: ACTIVE_BOOKING_TYPES,
        },

        status: {
          $in: ACTIVE_BOOKING_STATUSES,
        },

        [sentField]: null,

        $or: [
          {
            [processingField]: null,
          },
          {
            [processingField]: {
              $exists: false,
            },
          },
          {
            [processingField]: {
              $lt: staleLockBefore,
            },
          },
        ],
      },
      {
        $set: {
          [processingField]: claimedAt,
        },
      },
      {
        returnDocument: "after",
      }
    )
  );

  return {
    booking: claimedBooking,
    claimedAt,
  };
}

async function releaseScheduledEmailClaim({
  bookingId,
  processingField,
  claimedAt,
}) {
  if (!bookingId || !claimedAt) return;

  await Booking.updateOne(
    {
      _id: bookingId,
      [processingField]: claimedAt,
    },
    {
      $set: {
        [processingField]: null,
      },
    }
  );
}

async function sendOneScheduledEmail({
  booking,
  templateKey,
  sentField,
  processingField,
}) {
  const initialBookingId = getBookingId(booking);

  const claim = await claimScheduledEmailBooking({
    bookingId: booking._id,
    sentField,
    processingField,
  });

  if (!claim.booking) {
    return {
      bookingId: initialBookingId,
      success: false,
      skipped: true,
      reason: "Already sent or currently being processed",
    };
  }

  const claimedBooking = claim.booking;
  const bookingId = getBookingId(claimedBooking);

  try {
    const customerEmail = getCustomerEmail(claimedBooking);

    if (!customerEmail) {
      await releaseScheduledEmailClaim({
        bookingId: claimedBooking._id,
        processingField,
        claimedAt: claim.claimedAt,
      });

      return {
        bookingId,
        success: false,
        skipped: true,
        reason: "Customer email missing",
      };
    }

    const content = await buildEmailContent({
      booking: claimedBooking,
      templateKey,
    });

    if (!content) {
      await releaseScheduledEmailClaim({
        bookingId: claimedBooking._id,
        processingField,
        claimedAt: claim.claimedAt,
      });

      return {
        bookingId,
        success: false,
        skipped: true,
        reason: `${templateKey} template is inactive`,
      };
    }

    const transporter = getTransporter();
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    const sent = await transporter.sendMail({
      from,
      to: customerEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    await Booking.updateOne(
      {
        _id: claimedBooking._id,
        [processingField]: claim.claimedAt,
        [sentField]: null,
      },
      {
        $set: {
          [sentField]: new Date(),
          [processingField]: null,
        },
      }
    );

    return {
      bookingId,
      to: customerEmail,
      success: true,
      skipped: false,
      messageId: sent?.messageId || null,
    };
  } catch (error) {
    await releaseScheduledEmailClaim({
      bookingId: claimedBooking._id,
      processingField,
      claimedAt: claim.claimedAt,
    });

    throw error;
  }
}

async function sendReminderEmails(limit) {
  const bookings = await getReminderBookings(limit);
  const results = [];

  for (const booking of bookings) {
    try {
      const result = await sendOneScheduledEmail({
        booking,
        templateKey: "reminder",
        sentField: "reminder_email_sent_at",
        processingField: "reminder_email_processing_at",
      });

      results.push(result);
    } catch (error) {
      results.push({
        bookingId: getBookingId(booking),
        success: false,
        skipped: false,
        error: error?.message || "Reminder email failed",
      });
    }
  }

  return results;
}

async function sendFeedbackEmails(limit) {
  const bookings = await getFeedbackBookings(limit);
  const results = [];

  for (const booking of bookings) {
    try {
      const result = await sendOneScheduledEmail({
        booking,
        templateKey: "feedback",
        sentField: "feedback_email_sent_at",
        processingField: "feedback_email_processing_at",
      });

      results.push(result);
    } catch (error) {
      results.push({
        bookingId: getBookingId(booking),
        success: false,
        skipped: false,
        error: error?.message || "Feedback email failed",
      });
    }
  }

  return results;
}

export async function sendScheduledCustomerEmails({
  mode = "all",
  limit = DEFAULT_SCHEDULED_EMAIL_LIMIT,
} = {}) {
  const safeLimit = getScheduledEmailLimit(limit);
  const timeZone = getBookingTimeZone();

  const settings = await Setting.findById(GLOBAL_SETTING_ID).lean();

  if (settings?.email_notifications === false) {
    return {
      success: true,
      message: "Email notifications are disabled in settings.",
      timezone: timeZone,
      reminder: [],
      feedback: [],
      totals: {
        reminder: 0,
        feedback: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
      },
    };
  }

  const shouldSendReminder = mode === "all" || mode === "reminder";
  const shouldSendFeedback = mode === "all" || mode === "feedback";

  const reminder = shouldSendReminder ? await sendReminderEmails(safeLimit) : [];
  const feedback = shouldSendFeedback ? await sendFeedbackEmails(safeLimit) : [];

  const allResults = [...reminder, ...feedback];
  const failed = allResults.filter((item) => !item.success && !item.skipped);

  return {
    success: failed.length === 0,
    mode,
    timezone: timeZone,
    reminder,
    feedback,
    totals: {
      reminder: reminder.length,
      feedback: feedback.length,
      sent: allResults.filter((item) => item.success).length,
      skipped: allResults.filter((item) => item.skipped).length,
      failed: failed.length,
    },
  };
}

export default sendScheduledCustomerEmails;