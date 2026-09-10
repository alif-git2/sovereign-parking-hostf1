import nodemailer from "nodemailer";
import Setting from "@/app/backend/models/settings";
import {
  hasUsableEmailTemplate,
  renderEmailTemplate,
} from "@/app/backend/utils/emailTemplateRenderer";

const GLOBAL_SETTING_ID = "global_config";

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const safe = (value, fallback = "-") => {
  if (value === undefined || value === null || value === "") {
    return escapeHtml(fallback);
  }

  return escapeHtml(value);
};

const getFirstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
};

const formatDate = (date) => {
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
};

const money = (amount) => {
  return `A$${Number(amount || 0).toFixed(2)}`;
};

const getBookingTypeTitle = (type) => {
  if (type === "cruise") return "Cruise Booking";
  if (type === "storage") return "Storage Booking";
  if (type === "airport") return "Airport Parking";

  return "Booking";
};

const getBookingTypeKey = (type) => {
  const value = String(type || "").toLowerCase().trim();

  if (["cruise", "airport", "storage"].includes(value)) {
    return value;
  }

  return null;
};

const formatSource = (source) => {
  if (!source) return "-";

  return String(source)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatPaymentMethod = (method) => {
  if (!method) return "-";

  if (method === "poa") return "Pay on Arrival";
  if (method === "paypal") return "PayPal";

  return String(method)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatBookingStatus = (status) => {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  const labels = {
    poa: "POA (Pay on Arrival)",
    pending: "Pending",
    pending_payment: "Pending Payment",
    success: "Confirmed",
    confirmed: "Confirmed",
    cancellation_requested: "Cancellation Requested",
    cancelled: "Cancelled",
    refund: "Refunded",
    refunded: "Refunded",
    credit: "Credited",
    credited: "Credited",
    completed: "Completed",
    failed: "Failed",
  };

  if (!normalizedStatus) {
    return "-";
  }

  return (
    labels[normalizedStatus] ||
    normalizedStatus
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
};

const formatDepositType = (depositType) => {
  if (!depositType) return "-";

  if (depositType === "poa") return "Pay on Arrival";
  if (depositType === "full") return "Full Payment";
  if (depositType === "partial") return "Partial Payment";

  return String(depositType)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const tableRow = (label, value) => {
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
};

const tableSectionTitle = (title) => {
  return `
    <tr>
      <td colspan="2" style="background:#0b5ed7; color:#ffffff; padding:10px; border:1px solid #0b5ed7;">
        <strong>${escapeHtml(title)}</strong>
      </td>
    </tr>
  `;
};

const getStorageTypeName = (booking) => {
  const storage = booking.details?.storage || {};

  if (storage.storage_type_name) return storage.storage_type_name;
  if (storage.storage_type) return storage.storage_type;
  if (storage.storage_type_id?.name) return storage.storage_type_id.name;

  return "-";
};

const getAirportShuttleText = (booking) => {
  const shuttleTime = booking.details?.airport?.shuttle_time;

  return shuttleTime || "No shuttle";
};

const getAirportPassengerText = (booking) => {
  const shuttleTime = booking.details?.airport?.shuttle_time;

  if (!shuttleTime) {
    return "No shuttle";
  }

  return booking.details?.airport?.pickup_pax || booking.pax || 0;
};

const getCruisePickupPaxPro = (booking) => {
  const value = booking.details?.cruise?.pickup_pax_pro;

  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return value;
};

const getCruiseParkingSlotNumber = (booking) => {
  return booking.details?.cruise?.parking_slot || booking.parking_slot || "-";
};

const getCruiseCarParkToTerminalPassengers = (booking) => {
  return getFirstValue(
    booking.details?.cruise?.car_park_to_terminal_passengers,
    booking.car_park_to_terminal_passengers,
    booking.details?.cruise?.pickup_pax,
    booking.pax,
    0
  );
};

const getCruiseCarParkToTerminalShuttleTime = (booking) => {
  return (
    getFirstValue(
      booking.details?.cruise?.car_park_to_terminal_shuttle_time,
      booking.car_park_to_terminal_shuttle_time,
      booking.details?.cruise?.shuttle_time,
      booking.shuttle_time
    ) || "-"
  );
};

const getCruiseTerminalToCarParkPassengers = (booking) => {
  return getFirstValue(
    booking.details?.cruise?.terminal_to_car_park_passengers,
    booking.terminal_to_car_park_passengers,
    0
  );
};

const getCruiseTerminalToCarParkShuttleTime = (booking) => {
  return (
    getFirstValue(
      booking.details?.cruise?.terminal_to_car_park_shuttle_time,
      booking.terminal_to_car_park_shuttle_time
    ) || "-"
  );
};

const normalizeText = (value) => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
};

const getCruiseAddOnVehicle = (booking) => {
  if (!booking || booking.type !== "cruise") {
    return {
      enabled: false,
      name: "",
      licensePlate: "",
      licensePlateLabel: "Selected Vehicle License Plate",
      originalPrice: 0,
      discountPercent: 0,
      discountAmount: 0,
      price: 0,
    };
  }

  const addOnVehicle = booking.details?.cruise?.add_on_vehicle || {};
  const pricing = booking.details?.pricing || {};

  const enabled = Boolean(
    booking.add_on_vehicle_enabled || addOnVehicle.enabled
  );

  const name = normalizeText(
    booking.add_on_vehicle_type || addOnVehicle.type
  );

  const licensePlate = normalizeText(
    booking.add_on_vehicle_license_plate || addOnVehicle.license_plate
  );

  const originalPrice = Number(
    getFirstValue(
      booking.add_on_vehicle_original_price,
      addOnVehicle.original_price,
      pricing.add_on_vehicle_original_price,
      0
    ) || 0
  );

  const discountPercent = Number(
    getFirstValue(
      booking.add_on_vehicle_discount_percent,
      addOnVehicle.discount_percent,
      pricing.add_on_vehicle_discount_percent,
      0
    ) || 0
  );

  const discountAmount = Number(
    getFirstValue(
      booking.add_on_vehicle_discount_amount,
      addOnVehicle.discount_amount,
      pricing.add_on_vehicle_discount_amount,
      0
    ) || 0
  );

  const price = Number(
    getFirstValue(
      booking.add_on_vehicle_price,
      addOnVehicle.price,
      pricing.add_on_vehicle_price,
      0
    ) || 0
  );

  const hasAddOnVehicle = enabled && Boolean(name || licensePlate);

  return {
    enabled: hasAddOnVehicle,
    name,
    licensePlate,
    licensePlateLabel: `${name || "Selected Vehicle"} License Plate`,
    originalPrice,
    discountPercent,
    discountAmount,
    price,
  };
};

const hasCruiseAddOnVehicle = (booking) => {
  return getCruiseAddOnVehicle(booking).enabled;
};

const templateEmailRow = (label, value) => {
  return `
    <tr>
      <td style="padding:12px 16px;font-weight:bold;border-bottom:1px solid #e5e7eb;background:#f9fafb;width:42%;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
        ${safe(value)}
      </td>
    </tr>
  `;
};

const getCruiseAddOnVehicleHtml = (booking) => {
  const addOnVehicle = getCruiseAddOnVehicle(booking);

  if (!addOnVehicle.enabled) {
    return "";
  }

  return `
      ${tableRow("Add On Vehicle", addOnVehicle.name || "-")}
      ${tableRow(addOnVehicle.licensePlateLabel, addOnVehicle.licensePlate || "-")}
    `;
};

const getCruiseAddOnVehicleTemplateHtml = (booking) => {
  const addOnVehicle = getCruiseAddOnVehicle(booking);

  if (!addOnVehicle.enabled) {
    return "";
  }

  return `
      ${templateEmailRow("Add On Vehicle", addOnVehicle.name || "-")}
      ${templateEmailRow(
        addOnVehicle.licensePlateLabel,
        addOnVehicle.licensePlate || "-"
      )}
    `;
};

const getCruiseAddOnVehicleText = (booking) => {
  const addOnVehicle = getCruiseAddOnVehicle(booking);

  if (!addOnVehicle.enabled) {
    return "";
  }

  return `
Add On Vehicle: ${addOnVehicle.name || "-"}
${addOnVehicle.licensePlateLabel}: ${addOnVehicle.licensePlate || "-"}
  `.trim();
};

const ADD_ON_VEHICLE_TEMPLATE_FIELDS = [
  "add_on_vehicle",
  "add_on_vehicle_name",
  "add_on_vehicle_license_plate",
  "add_on_vehicle_license_plate_label",
  "add_on_vehicle_price",
  "add_on_vehicle_details_html",
  "add_on_vehicle_details_text",
];

const ADD_ON_VEHICLE_HTML_SENTINEL =
  "__SOVEREIGN_ADD_ON_VEHICLE_DETAILS_HTML__";

const replaceAddOnVehicleHtmlPlaceholderWithSentinel = (templateHtml = "") => {
  return String(templateHtml || "")
    .replace(
      /<!--\s*{{\s*add_on_vehicle_details_html\s*}}\s*-->/gi,
      ADD_ON_VEHICLE_HTML_SENTINEL
    )
    .replace(
      /{{\s*add_on_vehicle_details_html\s*}}/gi,
      ADD_ON_VEHICLE_HTML_SENTINEL
    );
};

const injectAddOnVehicleHtml = ({ html, booking }) => {
  const addOnVehicleHtml = hasCruiseAddOnVehicle(booking)
    ? getCruiseAddOnVehicleTemplateHtml(booking)
    : "";

  return String(html || "").replace(
    new RegExp(ADD_ON_VEHICLE_HTML_SENTINEL, "g"),
    addOnVehicleHtml
  );
};

const hasTemplatePlaceholder = (templatePart = "", fieldNames = []) => {
  const value = String(templatePart || "");

  return fieldNames.some((fieldName) => {
    const pattern = new RegExp(`{{\\s*${fieldName}\\s*}}`, "i");

    return pattern.test(value);
  });
};

const appendCruiseAddOnVehicleHtmlIfMissing = ({
  html,
  booking,
  templateHtml,
}) => {
  if (!hasCruiseAddOnVehicle(booking)) {
    return html;
  }

  if (hasTemplatePlaceholder(templateHtml, ADD_ON_VEHICLE_TEMPLATE_FIELDS)) {
    return html;
  }

  return `${html}
    <table style="width:100%; border-collapse:collapse; margin-top:20px;">
      <tbody>
        ${tableSectionTitle("Add On Vehicle Details")}
        ${getCruiseAddOnVehicleHtml(booking)}
      </tbody>
    </table>
  `;
};

const appendCruiseAddOnVehicleTextIfMissing = ({
  text,
  booking,
  templateText,
}) => {
  if (!hasCruiseAddOnVehicle(booking)) {
    return text;
  }

  if (hasTemplatePlaceholder(templateText, ADD_ON_VEHICLE_TEMPLATE_FIELDS)) {
    return text;
  }

  return `${text}

Add On Vehicle Details
${getCruiseAddOnVehicleText(booking)}`;
};

const getPaymentReference = (booking) => {
  return (
    getFirstValue(
      booking.payment_reference,
      booking.manual_payment_reference,
      booking.reference_payment,
      booking.transaction_reference,
      booking.transaction_id,
      booking.payment_id?.payment_reference,
      booking.payment_id?.transaction_reference,
      booking.payment_id?.transaction_id,
      booking.payment_id?.stripe_payment_intent_id,
      booking.payment_id?.paypal_order_id,
      booking.payment_id?.paypal_capture_id,
      booking.stripe_payment_intent_id,
      booking.paypal_capture_id,
      booking.paypal_order_id,
      booking.wallet_transaction_id?.transaction_reference,
      booking.wallet_transaction_id?.transaction_id,
      booking.reference
    ) || "-"
  );
};

const getCruiseShipDepartureDate = (booking) => {
  return getFirstValue(
    booking.details?.cruise?.ship_departure,
    booking.details?.cruise?.departure_date,
    booking.details?.cruise?.ship_departure_date,
    booking.schedule_id?.departure_date,
    booking.schedule_id?.ship_departure,
    booking.cruise_schedule_id?.departure_date,
    booking.cruise_schedule_id?.ship_departure,
    booking.cruise_schedule?.departure_date,
    booking.cruise_schedule?.ship_departure,
    booking.start_date
  );
};

const getCruiseShipArrivalDate = (booking) => {
  return getFirstValue(
    booking.details?.cruise?.ship_arrival,
    booking.details?.cruise?.arrival_date,
    booking.details?.cruise?.return_date,
    booking.details?.cruise?.ship_arrival_date,
    booking.schedule_id?.arrival_date,
    booking.schedule_id?.return_date,
    booking.schedule_id?.ship_arrival,
    booking.cruise_schedule_id?.arrival_date,
    booking.cruise_schedule_id?.return_date,
    booking.cruise_schedule_id?.ship_arrival,
    booking.cruise_schedule?.arrival_date,
    booking.cruise_schedule?.return_date,
    booking.cruise_schedule?.ship_arrival,
    booking.end_date
  );
};

const getNewAdminNote = (booking) => {
  if (booking.new_admin_note) {
    return booking.new_admin_note;
  }

  const notes = String(booking.notes || "").trim();

  if (!notes) {
    return "-";
  }

  const noteLines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const adminNoteLine = [...noteLines]
    .reverse()
    .find((line) => line.toLowerCase().includes("admin edit note:"));

  if (!adminNoteLine) {
    return "-";
  }

  const cleanedNote = adminNoteLine
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/^admin edit note:\s*/i, "")
    .trim();

  return cleanedNote || "-";
};

const getTypeSpecificDetailsHtml = (booking) => {
  if (booking.type === "cruise") {
    return `
      ${tableSectionTitle("Cruise Details")}
      ${tableRow("Ship Name", booking.details?.cruise?.ship_name)}
      ${tableRow("Shuttle Time", booking.details?.cruise?.shuttle_time)}
      ${tableRow(
        "Passengers",
        booking.details?.cruise?.pickup_pax || booking.pax || 0
      )}
      ${tableRow(
        "Car park to terminal Passengers",
        getCruiseCarParkToTerminalPassengers(booking)
      )}
      ${tableRow(
        "Car park to terminal Shuttle Time",
        getCruiseCarParkToTerminalShuttleTime(booking)
      )}
      ${tableRow(
        "Terminal to car park Passengers",
        getCruiseTerminalToCarParkPassengers(booking)
      )}
      ${tableRow(
        "Terminal to car park Shuttle Time",
        getCruiseTerminalToCarParkShuttleTime(booking)
      )}
      ${getCruiseAddOnVehicleHtml(booking)}
      ${tableRow("Pick Up Pax", getCruisePickupPaxPro(booking))}
      ${tableRow("Parking Slot Number", getCruiseParkingSlotNumber(booking))}
      ${tableRow("Note", getNewAdminNote(booking))}
    `;
  }

  if (booking.type === "storage") {
    return `
      ${tableSectionTitle("Storage Details")}
      ${tableRow("Storage Type", getStorageTypeName(booking))}
      ${tableRow("Note", getNewAdminNote(booking))}
    `;
  }

  if (booking.type === "airport") {
    return `
      ${tableSectionTitle("Airport Details")}
      ${tableRow("Shuttle", getAirportShuttleText(booking))}
      ${tableRow("Shuttle Passengers", getAirportPassengerText(booking))}
      ${tableRow("Note", getNewAdminNote(booking))}
    `;
  }

  return "";
};

const getTypeSpecificDetailsText = (booking) => {
  if (booking.type === "cruise") {
    return `
Cruise Details
Ship Name: ${booking.details?.cruise?.ship_name || "-"}
Shuttle Time: ${booking.details?.cruise?.shuttle_time || "-"}
Passengers: ${booking.details?.cruise?.pickup_pax || booking.pax || 0}
Car park to terminal Passengers: ${getCruiseCarParkToTerminalPassengers(
      booking
    )}
Car park to terminal Shuttle Time: ${getCruiseCarParkToTerminalShuttleTime(
      booking
    )}
Terminal to car park Passengers: ${getCruiseTerminalToCarParkPassengers(
      booking
    )}
Terminal to car park Shuttle Time: ${getCruiseTerminalToCarParkShuttleTime(
      booking
    )}
${getCruiseAddOnVehicleText(booking)}
Pick Up Pax: ${getCruisePickupPaxPro(booking)}
Parking Slot Number: ${getCruiseParkingSlotNumber(booking)}
Note: ${getNewAdminNote(booking)}
    `.trim();
  }

  if (booking.type === "storage") {
    return `
Storage Details
Storage Type: ${getStorageTypeName(booking)}
Note: ${getNewAdminNote(booking)}
    `.trim();
  }

  if (booking.type === "airport") {
    return `
Airport Details
Shuttle: ${getAirportShuttleText(booking)}
Shuttle Passengers: ${getAirportPassengerText(booking)}
Note: ${getNewAdminNote(booking)}
    `.trim();
  }

  return "";
};

const getPricingValues = (booking) => {
  const originalPrice = Number(
    booking.original_price !== undefined && booking.original_price !== null
      ? booking.original_price
      : booking.price || 0
  );

  const discountAmount = Number(booking.discount_amount || 0);

  const finalPrice = Number(
    booking.price !== undefined && booking.price !== null
      ? booking.price
      : originalPrice - discountAmount
  );

  const paidAmount = Number(booking.paid_amount || 0);

  const dueAmount = Number(
    booking.due_amount !== undefined && booking.due_amount !== null
      ? booking.due_amount
      : finalPrice - paidAmount
  );

  return {
    originalPrice,
    discountAmount,
    finalPrice,
    paidAmount,
    dueAmount,
    couponCode: booking.coupon_code || "No coupon",
  };
};

const getPricingHtml = (booking) => {
  const {
    originalPrice,
    discountAmount,
    finalPrice,
    paidAmount,
    dueAmount,
    couponCode,
  } = getPricingValues(booking);

  return `
    ${tableSectionTitle("Pricing Details")}
    ${tableRow("Subtotal / Original Price", money(originalPrice))}
    ${tableRow("Coupon Code", couponCode)}
    ${tableRow(
      "Discount Amount",
      discountAmount > 0 ? `- ${money(discountAmount)}` : money(0)
    )}
    ${tableRow("Total Price", money(finalPrice))}
    ${tableRow("Paid Amount", money(paidAmount))}
    ${tableRow("Due Amount", money(dueAmount))}
  `;
};

const getPricingText = (booking) => {
  const {
    originalPrice,
    discountAmount,
    finalPrice,
    paidAmount,
    dueAmount,
    couponCode,
  } = getPricingValues(booking);

  return `
Pricing Details
Subtotal / Original Price: ${money(originalPrice)}
Coupon Code: ${couponCode}
Discount Amount: ${discountAmount > 0 ? `- ${money(discountAmount)}` : money(0)}
Total Price: ${money(finalPrice)}
Paid Amount: ${money(paidAmount)}
Due Amount: ${money(dueAmount)}
  `.trim();
};

const sanitizeAdminEmailHtml = (html = "") => {
  return String(html || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\son\w+=\S+/gi, "")
    .replace(/javascript:/gi, "");
};

const renderPlainTemplate = (template = "", variables = {}) => {
  return String(template || "").replace(
    /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g,
    (_, key) => String(variables[key] ?? "")
  );
};

const buildBookingTemplateVariables = (booking) => {
  const pricing = getPricingValues(booking);
  const bookingTypeTitle = getBookingTypeTitle(booking.type);
  const cruiseAddOnVehicle = getCruiseAddOnVehicle(booking);

  return {
    customer_name: booking.customer?.name || "Customer",
    customer_email: booking.customer?.email || "",
    customer_phone: booking.customer?.phone || "",

    booking_id: booking.booking_id || "",
    payment_reference: getPaymentReference(booking),

    booking_type: bookingTypeTitle,
    booking_type_key: booking.type || "",
    status: formatBookingStatus(booking.status),
    booking_status: formatBookingStatus(booking.status),
    payment_status: booking.payment_status || "",
    deposit_type: formatDepositType(booking.deposit_type),
    payment_method: formatPaymentMethod(booking.payment_method),

    location_name: booking.location_id?.name || "",

    start_date: formatDate(booking.start_date),
    end_date: formatDate(booking.end_date),

    ship_departure: formatDate(getCruiseShipDepartureDate(booking)),
    ship_arrival: formatDate(getCruiseShipArrivalDate(booking)),

    entry_date: formatDate(booking.start_date),
    exit_date: formatDate(booking.end_date),

    license_plate: booking.license_plate || "",
    interlock: booking.interlock ? "Yes" : "No",
    source: formatSource(booking.source),
    notes: booking.notes || "",
    admin_note: getNewAdminNote(booking),

    ship_name: booking.details?.cruise?.ship_name || "",
    shuttle_time:
      booking.details?.cruise?.shuttle_time ||
      booking.details?.airport?.shuttle_time ||
      getAirportShuttleText(booking),

    passengers:
      booking.details?.cruise?.pickup_pax ||
      booking.details?.airport?.pickup_pax ||
      booking.pax ||
      0,

    car_park_to_terminal_passengers:
      getCruiseCarParkToTerminalPassengers(booking),

    car_park_to_terminal_shuttle_time:
      getCruiseCarParkToTerminalShuttleTime(booking),

    terminal_to_car_park_passengers:
      getCruiseTerminalToCarParkPassengers(booking),

    terminal_to_car_park_shuttle_time:
      getCruiseTerminalToCarParkShuttleTime(booking),

    has_add_on_vehicle: cruiseAddOnVehicle.enabled ? "Yes" : "No",
    add_on_vehicle: cruiseAddOnVehicle.enabled
      ? cruiseAddOnVehicle.name
      : "",
    add_on_vehicle_name: cruiseAddOnVehicle.enabled
      ? cruiseAddOnVehicle.name
      : "",
    add_on_vehicle_license_plate: cruiseAddOnVehicle.enabled
      ? cruiseAddOnVehicle.licensePlate
      : "",
    add_on_vehicle_license_plate_label: cruiseAddOnVehicle.enabled
      ? cruiseAddOnVehicle.licensePlateLabel
      : "",
    add_on_vehicle_original_price: cruiseAddOnVehicle.enabled
      ? money(cruiseAddOnVehicle.originalPrice)
      : "",
    add_on_vehicle_discount_percent: cruiseAddOnVehicle.enabled
      ? `${cruiseAddOnVehicle.discountPercent}%`
      : "",
    add_on_vehicle_discount_amount: cruiseAddOnVehicle.enabled
      ? money(cruiseAddOnVehicle.discountAmount)
      : "",
    add_on_vehicle_price: cruiseAddOnVehicle.enabled
      ? money(cruiseAddOnVehicle.price)
      : "",
    add_on_vehicle_details_html: getCruiseAddOnVehicleHtml(booking),
    add_on_vehicle_details_text: getCruiseAddOnVehicleText(booking),

    pickup_pax: booking.details?.cruise?.pickup_pax || booking.pax || 0,
    pickup_pax_pro: getCruisePickupPaxPro(booking),
    parking_slot: getCruiseParkingSlotNumber(booking),

    storage_type: getStorageTypeName(booking),
    airport_shuttle: getAirportShuttleText(booking),
    airport_shuttle_passengers: getAirportPassengerText(booking),

    original_price: money(pricing.originalPrice),
    subtotal_price: money(pricing.originalPrice),
    discount_amount: money(pricing.discountAmount),
    total_price: money(pricing.finalPrice),
    paid_amount: money(pricing.paidAmount),
    due_amount: money(pricing.dueAmount),
    coupon_code: pricing.couponCode,

    cancellation_reason: booking.cancellation_reason || "",
    refund_amount: booking.refund_amount ? money(booking.refund_amount) : "",
    credit_amount: booking.credit_amount ? money(booking.credit_amount) : "",
  };
};

const getCustomerBookingTemplate = async (booking) => {
  const bookingType = getBookingTypeKey(booking.type);

  if (!bookingType) {
    return null;
  }

  const settings = await Setting.findById(GLOBAL_SETTING_ID).lean();

  return (
    settings?.email_templates?.customer?.[bookingType]
      ?.booking_confirmation || null
  );
};

const buildCustomerBookingEmailContent = async ({
  booking,
  fallbackSubject,
}) => {
  const fallbackContent = {
    subject: fallbackSubject,
    html: buildBookingEmailHtml(booking, "customer"),
    text: buildPlainTextEmail(booking, "customer"),
  };

  try {
    const template = await getCustomerBookingTemplate(booking);

    if (!hasUsableEmailTemplate(template)) {
      return fallbackContent;
    }

    const variables = buildBookingTemplateVariables(booking);

    const subject = template.subject?.trim()
      ? renderPlainTemplate(template.subject, variables)
      : fallbackSubject;

    const templateHtmlWithAddOnSentinel =
      replaceAddOnVehicleHtmlPlaceholderWithSentinel(template.html);

    const renderedHtml = renderEmailTemplate(
      templateHtmlWithAddOnSentinel,
      variables
    );

    const htmlWithAddOnVehicle = injectAddOnVehicleHtml({
      html: renderedHtml,
      booking,
    });

    const html = appendCruiseAddOnVehicleHtmlIfMissing({
      html: sanitizeAdminEmailHtml(htmlWithAddOnVehicle),
      booking,
      templateHtml: template.html,
    });

    const renderedText = template.text?.trim()
      ? renderPlainTemplate(template.text, variables)
      : fallbackContent.text;

    const text = appendCruiseAddOnVehicleTextIfMissing({
      text: renderedText,
      booking,
      templateText: template.text,
    });

    return {
      subject,
      html,
      text,
    };
  } catch (error) {
    console.error("Customer booking email template render failed:", {
      message: error?.message,
      bookingId: booking?.booking_id,
      bookingType: booking?.type,
    });

    return fallbackContent;
  }
};

const buildPasswordSetupEmailHtml = (booking, passwordSetupUrl) => {
  const safeUrl = escapeHtml(passwordSetupUrl);
  const customerName = safe(booking.customer?.name, "Customer");
  const loginEmail = safe(booking.customer?.email);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #222;">
      <h2 style="background:#0b5ed7; color:#fff; padding:16px; border-radius:8px;">
        Your Login Details
      </h2>

      <p>Hello ${customerName},</p>

      <p>Your account has been created successfully. This is your login email:</p>

      <div style="margin:16px 0; padding:14px; background:#f8f9fa; border:1px solid #ddd; border-radius:8px;">
        <strong>Login Email:</strong> ${loginEmail}
      </div>

      <p>For your password, please click the button below and set your password.</p>

      <div style="margin:20px 0; padding:16px; background:#f0f7ff; border:1px solid #b6dcff; border-radius:8px;">
        <a href="${safeUrl}"
          style="display:inline-block; background:#0b5ed7; color:#ffffff; padding:12px 18px; border-radius:6px; text-decoration:none; font-weight:bold;">
          Set Your Password
        </a>
      </div>

      <div style="margin-top:20px; padding-top:14px; border-top:1px solid #ddd;">
        <p style="margin:0 0 8px 0; font-size:13px; color:#666;">
          This link expires in 24 hours.
        </p>

        <p style="margin:0 0 8px 0; font-size:13px; color:#666;">
          If the button does not work, copy and paste this link into your browser:
        </p>

        <p style="word-break:break-all; font-size:13px; color:#0b5ed7; margin:0;">
          ${safeUrl}
        </p>
      </div>

      <p style="margin-top:24px; color:#666;">
        This is an automated account email.
      </p>
    </div>
  `;
};

const buildPasswordSetupEmailText = (booking, passwordSetupUrl) => {
  return `
Your Login Details

Hello ${booking.customer?.name || "Customer"},

Your account has been created successfully.

This is your login email:
${booking.customer?.email || "-"}

For your password, please click the link below and set your password.

Set Your Password:
${passwordSetupUrl}

This link expires in 24 hours.

If the button does not work, copy and paste this link into your browser:
${passwordSetupUrl}

This is an automated account email.
  `.trim();
};

const buildBookingEmailHtml = (booking, recipientType = "customer") => {
  const title = getBookingTypeTitle(booking.type);

  const introText =
    recipientType === "admin"
      ? "A new booking has been created. Details are below."
      : "Thank you. Your booking has been created successfully. Details are below.";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #222;">
      <h2 style="background:#0b5ed7; color:#fff; padding:16px; border-radius:8px;">
        ${
          recipientType === "admin"
            ? "New Booking Received"
            : "Booking Confirmation"
        }
      </h2>

      <p>${escapeHtml(introText)}</p>

      <table style="width:100%; border-collapse:collapse; margin-top:20px;">
        <tbody>
          ${tableSectionTitle("Booking Details")}
          ${tableRow("Booking ID", booking.booking_id)}
          ${tableRow("Booking Type", title)}
          ${tableRow("Status", formatBookingStatus(booking.status))}
          ${tableRow("Payment Status", booking.payment_status)}
          ${tableRow("Deposit Type", formatDepositType(booking.deposit_type))}
          ${tableRow(
            "Payment Method",
            formatPaymentMethod(booking.payment_method)
          )}

          ${tableSectionTitle("Customer Details")}
          ${tableRow("Customer Name", booking.customer?.name)}
          ${tableRow("Email", booking.customer?.email)}
          ${tableRow("Phone", booking.customer?.phone)}

          ${tableSectionTitle("Booking Dates & Location")}
          ${tableRow("Location", booking.location_id?.name)}
          ${tableRow("Start Date", formatDate(booking.start_date))}
          ${tableRow("End Date", formatDate(booking.end_date))}

          ${getTypeSpecificDetailsHtml(booking)}

          ${tableSectionTitle("Vehicle / Extra Details")}
          ${tableRow("License Plate", booking.license_plate)}
          ${tableRow("Interlock Vehicle", booking.interlock ? "Yes" : "No")}
          ${tableRow(
            "How did you hear about us?",
            formatSource(booking.source)
          )}
          ${tableRow("All Notes", booking.notes)}

          ${getPricingHtml(booking)}
        </tbody>
      </table>

      <p style="margin-top:24px; color:#666;">
        This is an automated booking email.
      </p>
    </div>
  `;
};

const buildPlainTextEmail = (booking, recipientType = "customer") => {
  const title = getBookingTypeTitle(booking.type);
  const typeSpecificDetails = getTypeSpecificDetailsText(booking);
  const pricingText = getPricingText(booking);

  return `
${recipientType === "admin" ? "New Booking Received" : "Booking Confirmation"}

Booking Details
Booking ID: ${booking.booking_id || "-"}
Booking Type: ${title}
Status: ${formatBookingStatus(booking.status)}
Payment Status: ${booking.payment_status || "-"}
Deposit Type: ${formatDepositType(booking.deposit_type)}
Payment Method: ${formatPaymentMethod(booking.payment_method)}

Customer Details
Customer Name: ${booking.customer?.name || "-"}
Email: ${booking.customer?.email || "-"}
Phone: ${booking.customer?.phone || "-"}

Booking Dates & Location
Location: ${booking.location_id?.name || "-"}
Start Date: ${formatDate(booking.start_date)}
End Date: ${formatDate(booking.end_date)}

${typeSpecificDetails}

Vehicle / Extra Details
License Plate: ${booking.license_plate || "-"}
Interlock Vehicle: ${booking.interlock ? "Yes" : "No"}
How did you hear about us?: ${formatSource(booking.source)}
All Notes: ${booking.notes || "-"}


${pricingText}

This is an automated booking email.
  `.trim();
};

const getEmailError = (error) => {
  return {
    message: error?.message || "Email sending failed",
    code: error?.code,
    command: error?.command,
    response: error?.response,
  };
};

export const getTransporter = () => {
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
      ? process.env.SMTP_SECURE === "true"
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
};

export async function sendBookingEmails({
  booking,
  adminEmail = process.env.BOOKING_ADMIN_EMAIL,
  passwordSetupUrl = null,
  setupPasswordUrl = null,
  resend = false,
  sendCustomerEmail = true,
  sendAdminEmail = true,
} = {}) {
  if (!booking) {
    throw new Error("Booking is missing");
  }

  if (sendCustomerEmail !== false && !booking?.customer?.email) {
    throw new Error("Customer email is missing");
  }

  if (sendAdminEmail !== false && !adminEmail) {
    throw new Error("Admin email is missing");
  }

  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const effectivePasswordSetupUrl = passwordSetupUrl || setupPasswordUrl;

  const passwordSubject = `Your Login Details - ${
    booking.booking_id || "Booking"
  }`;

  const fallbackCustomerSubject = resend
    ? `Booking Confirmation Resent - ${booking.booking_id || "Booking"}`
    : `Booking Confirmation - ${booking.booking_id || "Booking"}`;

  const adminSubject = `New Booking Created - ${
    booking.booking_id || "Booking"
  }`;

  const emailJobs = [];

  if (sendCustomerEmail !== false && effectivePasswordSetupUrl) {
    emailJobs.push({
      type: "password_setup",
      to: booking.customer.email,
      promise: transporter.sendMail({
        from,
        to: booking.customer.email,
        subject: passwordSubject,
        html: buildPasswordSetupEmailHtml(booking, effectivePasswordSetupUrl),
        text: buildPasswordSetupEmailText(booking, effectivePasswordSetupUrl),
      }),
    });
  }

  if (sendCustomerEmail !== false) {
    const customerBookingEmailContent = await buildCustomerBookingEmailContent({
      booking,
      fallbackSubject: fallbackCustomerSubject,
    });

    emailJobs.push({
      type: "customer_booking",
      to: booking.customer.email,
      promise: transporter.sendMail({
        from,
        to: booking.customer.email,
        subject: customerBookingEmailContent.subject,
        html: customerBookingEmailContent.html,
        text: customerBookingEmailContent.text,
      }),
    });
  }

  if (sendAdminEmail !== false) {
    emailJobs.push({
      type: "admin_booking",
      to: adminEmail,
      promise: transporter.sendMail({
        from,
        to: adminEmail,
        subject: adminSubject,
        html: buildBookingEmailHtml(booking, "admin"),
        text: buildPlainTextEmail(booking, "admin"),
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
    console.error("Some booking emails failed:", failedEmails);
  }

  return {
    success: failedEmails.length === 0,

    sentCustomerEmail:
      sendCustomerEmail !== false &&
      results.some(
        (result) =>
          result.type === "customer_booking" && result.success === true
      ),

    sentPasswordSetupEmail:
      sendCustomerEmail !== false &&
      results.some(
        (result) => result.type === "password_setup" && result.success === true
      ),

    sentAdminEmail:
      sendAdminEmail !== false &&
      results.some(
        (result) => result.type === "admin_booking" && result.success === true
      ),

    results,
  };
}