"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";
import EmailTemplateEditor from "@/app/frontend/pages/admin/EmailTemplateEditor";

const DEFAULT_HOLDING_DEPOSIT_AMOUNT = 20;
const DEFAULT_ADMIN_ACTION_FEE = 10;

const priceTypeOptions = [
  { value: "cruise", label: "Cruise" },
  { value: "storage", label: "Storage" },
  { value: "airport", label: "Airport" },
];

const shuttleTypeOptions = [
  { value: "cruise", label: "Cruise" },
  { value: "airport", label: "Airport" },
];

const customerEmailBookingTypeOptions = [
  { value: "cruise", label: "Cruise" },
  { value: "airport", label: "Airport" },
  { value: "storage", label: "Storage" },
];

function defaultEmailRow(label, placeholder) {
  return `
    <tr>
      <td style="padding:12px 16px;font-weight:bold;border-bottom:1px solid #e5e7eb;background:#f9fafb;width:42%;">
        ${label}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
        ${placeholder}
      </td>
    </tr>
  `;
}

function buildBookingConfirmationDefaultHtml({ title, intro, rows }) {
  return `
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  Your Sovereign Parking booking is confirmed.
</div>

<table style="background:#f5f7fb;padding:24px 0;" role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center">
      <table style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#111;" role="presentation" border="0" width="600" cellspacing="0" cellpadding="0">
        <tr>
          <td style="background:#0d1b2a;color:#ffffff;padding:22px 28px;font-size:20px;font-weight:bold;">
            ${title}
          </td>
        </tr>

        <tr>
          <td style="padding:24px 28px 8px;font-size:16px;line-height:1.6;">
            Dear <strong>{{customer_name}}</strong>,
          </td>
        </tr>

        <tr>
          <td style="padding:0 28px 24px;font-size:14px;line-height:1.7;">
            ${intro}
          </td>
        </tr>

        <tr>
          <td style="padding:0 28px 28px;">
            <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              ${rows.join("")}
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f9fafb;padding:18px 28px;font-size:12px;color:#6b7280;">
            Thank you for choosing Sovereign Parking.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `.trim();
}

function buildAdminActionDefaultHtml({
  title,
  intro,
  rows,
  headerColor = "#0d1b2a",
  footer = "If you have any questions, please contact support.",
}) {
  return `
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  ${title}
</div>

<table style="background:#f5f7fb;padding:24px 0;" role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center">
      <table style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#111;" role="presentation" border="0" width="600" cellspacing="0" cellpadding="0">
        <tr>
          <td style="background:${headerColor};color:#ffffff;padding:22px 28px;font-size:20px;font-weight:bold;">
            ${title}
          </td>
        </tr>

        <tr>
          <td style="padding:24px 28px 8px;font-size:16px;line-height:1.6;">
            Dear <strong>{{customer_name}}</strong>,
          </td>
        </tr>

        <tr>
          <td style="padding:0 28px 24px;font-size:14px;line-height:1.7;">
            ${intro}
          </td>
        </tr>

        <tr>
          <td style="padding:0 28px 28px;">
            <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              ${rows.join("")}
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f9fafb;padding:18px 28px;font-size:12px;color:#6b7280;">
            ${footer}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `.trim();
}

const bookingConfirmationDefaultsByType = {
  cruise: {
    subject: "Your Cruise Booking is Confirmed - {{booking_id}}",
    html: buildBookingConfirmationDefaultHtml({
      title: "Sovereign Parking — Cruise Booking Confirmed",
      intro:
        "Your <strong>cruise booking</strong> <strong>{{booking_id}}</strong> is confirmed.",
      rows: [
        defaultEmailRow("Booking ID", "{{booking_id}}"),
        defaultEmailRow("Payment Reference", "{{payment_reference}}"),
        defaultEmailRow("Booking Status", "{{status}}"),
        defaultEmailRow("Payment Method", "{{payment_method}}"),
        defaultEmailRow("Location", "{{location_name}}"),
        defaultEmailRow("Ship Departure", "{{ship_departure}}"),
        defaultEmailRow("Ship Arrival", "{{ship_arrival}}"),
        defaultEmailRow("License Plate", "{{license_plate}}"),
        "<!-- {{add_on_vehicle_details_html}} -->",

        defaultEmailRow(
          "Car park to terminal Passengers",
          "{{car_park_to_terminal_passengers}}"
        ),
        defaultEmailRow(
          "Car park to terminal Shuttle Time",
          "{{car_park_to_terminal_shuttle_time}}"
        ),
        defaultEmailRow(
          "Terminal to car park Passengers",
          "{{terminal_to_car_park_passengers}}"
        ),
        defaultEmailRow(
          "Terminal to car park Shuttle Time",
          "{{terminal_to_car_park_shuttle_time}}"
        ),

        defaultEmailRow("Passengers", "{{passengers}}"),
        defaultEmailRow("Original Price", "{{original_price}}"),
        defaultEmailRow("Coupon Code", "{{coupon_code}}"),
        defaultEmailRow("Discount Amount", "{{discount_amount}}"),
        defaultEmailRow("Total Price", "{{total_price}}"),
        defaultEmailRow("Paid Amount", "{{paid_amount}}"),
        defaultEmailRow("Due Amount", "{{due_amount}}"),
      ],
    }),
    text:
      "Dear {{customer_name}}, your cruise booking {{booking_id}} is confirmed. Car park to terminal: {{car_park_to_terminal_passengers}} passenger(s), {{car_park_to_terminal_shuttle_time}}. Terminal to car park: {{terminal_to_car_park_passengers}} passenger(s), {{terminal_to_car_park_shuttle_time}}. {{add_on_vehicle_details_text}} Total: {{total_price}}.",
  },

  airport: {
    subject: "Your Airport Parking Booking is Confirmed - {{booking_id}}",
    html: buildBookingConfirmationDefaultHtml({
      title: "Sovereign Parking — Airport Booking Confirmed",
      intro:
        "Your <strong>airport parking booking</strong> <strong>{{booking_id}}</strong> is confirmed.",
      rows: [
        defaultEmailRow("Booking ID", "{{booking_id}}"),
        defaultEmailRow("Payment Reference", "{{payment_reference}}"),
        defaultEmailRow("Booking Status", "{{status}}"),
        defaultEmailRow("Payment Method", "{{payment_method}}"),
        defaultEmailRow("Location", "{{location_name}}"),
        defaultEmailRow("Start Date", "{{start_date}}"),
        defaultEmailRow("End Date", "{{end_date}}"),
        defaultEmailRow("Shuttle", "{{shuttle_time}}"),
        defaultEmailRow("Passengers", "{{passengers}}"),
        defaultEmailRow("Original Price", "{{original_price}}"),
        defaultEmailRow("Coupon Code", "{{coupon_code}}"),
        defaultEmailRow("Discount Amount", "{{discount_amount}}"),
        defaultEmailRow("Total Price", "{{total_price}}"),
        defaultEmailRow("Paid Amount", "{{paid_amount}}"),
        defaultEmailRow("Due Amount", "{{due_amount}}"),
      ],
    }),
    text:
      "Dear {{customer_name}}, your airport parking booking {{booking_id}} is confirmed. Total: {{total_price}}.",
  },

  storage: {
    subject: "Your Storage Booking is Confirmed - {{booking_id}}",
    html: buildBookingConfirmationDefaultHtml({
      title: "Sovereign Parking — Storage Booking Confirmed",
      intro:
        "Your <strong>storage booking</strong> <strong>{{booking_id}}</strong> is confirmed.",
      rows: [
        defaultEmailRow("Booking ID", "{{booking_id}}"),
        defaultEmailRow("Payment Reference", "{{payment_reference}}"),
        defaultEmailRow("Booking Status", "{{status}}"),
        defaultEmailRow("Payment Method", "{{payment_method}}"),
        defaultEmailRow("Entry Date", "{{entry_date}}"),
        defaultEmailRow("Exit Date", "{{exit_date}}"),
        defaultEmailRow("Storage Type", "{{storage_type}}"),
        defaultEmailRow("Location", "{{location_name}}"),
        defaultEmailRow("Original Price", "{{original_price}}"),
        defaultEmailRow("Coupon Code", "{{coupon_code}}"),
        defaultEmailRow("Discount Amount", "{{discount_amount}}"),
        defaultEmailRow("Total Price", "{{total_price}}"),
        defaultEmailRow("Paid Amount", "{{paid_amount}}"),
        defaultEmailRow("Due Amount", "{{due_amount}}"),
      ],
    }),
    text:
      "Dear {{customer_name}}, your storage booking {{booking_id}} is confirmed. Total: {{total_price}}.",
  },
};

const customerEmailTemplateOptions = [
  {
    key: "booking_confirmation",
    label: "Booking Confirmation",
    description: "Sent to the customer when their booking is confirmed.",
    defaultSubject: "{{booking_type}} confirmed - {{booking_id}}",
    defaultHtml: bookingConfirmationDefaultsByType.cruise.html,
    defaultText: bookingConfirmationDefaultsByType.cruise.text,
    defaultByType: bookingConfirmationDefaultsByType,
  },
  {
    key: "cancellation",
    label: "Cancellation",
    description: "Sent to the customer when a booking is cancelled.",
    defaultSubject: "Your {{booking_type}} Booking is Cancelled - {{booking_id}}",
    defaultHtml: buildAdminActionDefaultHtml({
      title: "Sovereign Parking — Booking Cancelled",
      headerColor: "#991b1b",
      intro:
        "Your <strong>{{booking_type}}</strong> booking <strong>{{booking_id}}</strong> has been cancelled.",
      rows: [
        defaultEmailRow("Booking ID", "{{booking_id}}"),
        defaultEmailRow("Payment Reference", "{{payment_reference}}"),
        defaultEmailRow("Booking Type", "{{booking_type}}"),
        defaultEmailRow("Booking Status", "{{booking_status}}"),
        defaultEmailRow("Payment Status", "{{payment_status}}"),
        defaultEmailRow("Payment Method", "{{payment_method}}"),
        defaultEmailRow("Location", "{{location_name}}"),
        defaultEmailRow("Start Date", "{{start_date}}"),
        defaultEmailRow("End Date", "{{end_date}}"),
        defaultEmailRow("Paid Amount", "{{paid_amount}}"),
        defaultEmailRow("Admin Fee", "{{admin_fee}}"),
        defaultEmailRow("Returned Amount", "{{returned_amount}}"),
        defaultEmailRow("Return Method", "{{return_method}}"),
        defaultEmailRow("Cancellation Reason", "{{cancellation_reason}}"),
        defaultEmailRow("Processed By", "{{processed_by}}"),
        defaultEmailRow("Processed At", "{{processed_at}}"),
      ],
    }),
    defaultText:
      "Dear {{customer_name}}, your {{booking_type}} booking {{booking_id}} has been cancelled. Reason: {{cancellation_reason}}. Paid amount: {{paid_amount}}. Admin fee: {{admin_fee}}. Returned amount: {{returned_amount}}. Return method: {{return_method}}.",
  },
  {
    key: "refund",
    label: "Refund",
    description: "Sent to the customer when a refund is processed.",
    defaultSubject: "Refund Processed for {{booking_type}} Booking - {{booking_id}}",
    defaultHtml: buildAdminActionDefaultHtml({
      title: "Sovereign Parking — Refund Processed",
      headerColor: "#065f46",
      intro:
        "Your refund for <strong>{{booking_type}}</strong> booking <strong>{{booking_id}}</strong> has been processed.",
      rows: [
        defaultEmailRow("Booking ID", "{{booking_id}}"),
        defaultEmailRow("Payment Reference", "{{payment_reference}}"),
        defaultEmailRow("Booking Type", "{{booking_type}}"),
        defaultEmailRow("Booking Status", "{{booking_status}}"),
        defaultEmailRow("Payment Status", "{{payment_status}}"),
        defaultEmailRow("Payment Method", "{{payment_method}}"),
        defaultEmailRow("Location", "{{location_name}}"),
        defaultEmailRow("Start Date", "{{start_date}}"),
        defaultEmailRow("End Date", "{{end_date}}"),
        defaultEmailRow("Paid Amount", "{{paid_amount}}"),
        defaultEmailRow("Admin Fee", "{{admin_fee}}"),
        defaultEmailRow("Refund Amount", "{{refund_amount}}"),
        defaultEmailRow("Returned Amount", "{{returned_amount}}"),
        defaultEmailRow("Return Method", "{{return_method}}"),
        defaultEmailRow("Cancellation Reason", "{{cancellation_reason}}"),
        defaultEmailRow("Processed By", "{{processed_by}}"),
        defaultEmailRow("Processed At", "{{processed_at}}"),
      ],
      footer:
        "Refunds may take a few business days to appear depending on your payment provider.",
    }),
    defaultText:
      "Dear {{customer_name}}, your refund for {{booking_type}} booking {{booking_id}} has been processed. Paid amount: {{paid_amount}}. Admin fee: {{admin_fee}}. Refund amount: {{refund_amount}}. Return method: {{return_method}}.",
  },
  {
    key: "credit",
    label: "Credit",
    description: "Sent to the customer when credit is added to their account.",
    defaultSubject: "Credit Added for {{booking_type}} Booking - {{booking_id}}",
    defaultHtml: buildAdminActionDefaultHtml({
      title: "Sovereign Parking — Credit Added",
      headerColor: "#1d4ed8",
      intro:
        "Credit has been added to your account for <strong>{{booking_type}}</strong> booking <strong>{{booking_id}}</strong>.",
      rows: [
        defaultEmailRow("Booking ID", "{{booking_id}}"),
        defaultEmailRow("Payment Reference", "{{payment_reference}}"),
        defaultEmailRow("Booking Type", "{{booking_type}}"),
        defaultEmailRow("Booking Status", "{{booking_status}}"),
        defaultEmailRow("Payment Status", "{{payment_status}}"),
        defaultEmailRow("Payment Method", "{{payment_method}}"),
        defaultEmailRow("Location", "{{location_name}}"),
        defaultEmailRow("Start Date", "{{start_date}}"),
        defaultEmailRow("End Date", "{{end_date}}"),
        defaultEmailRow("Paid Amount", "{{paid_amount}}"),
        defaultEmailRow("Admin Fee", "{{admin_fee}}"),
        defaultEmailRow("Credit Amount", "{{credit_amount}}"),
        defaultEmailRow("Returned Amount", "{{returned_amount}}"),
        defaultEmailRow("Return Method", "{{return_method}}"),
        defaultEmailRow("Cancellation Reason", "{{cancellation_reason}}"),
        defaultEmailRow("Processed By", "{{processed_by}}"),
        defaultEmailRow("Processed At", "{{processed_at}}"),
      ],
      footer: "You can use this credit for a future booking.",
    }),
    defaultText:
      "Dear {{customer_name}}, credit has been added to your account for {{booking_type}} booking {{booking_id}}. Paid amount: {{paid_amount}}. Admin fee: {{admin_fee}}. Credit amount: {{credit_amount}}. Return method: {{return_method}}.",
  },
  {
    key: "reminder",
    label: "Reminder",
    description:
      "Sent automatically to the customer 1 day before the booking start date.",
    defaultSubject:
      "Reminder: Your {{booking_type}} Booking is Tomorrow - {{booking_id}}",
    defaultHtml: buildAdminActionDefaultHtml({
      title: "Sovereign Parking — Booking Reminder",
      headerColor: "#7c3aed",
      intro:
        "This is a friendly reminder that your <strong>{{booking_type}}</strong> booking <strong>{{booking_id}}</strong> is scheduled for tomorrow.",
      rows: [
        defaultEmailRow("Booking ID", "{{booking_id}}"),
        defaultEmailRow("Payment Reference", "{{payment_reference}}"),
        defaultEmailRow("Booking Type", "{{booking_type}}"),
        defaultEmailRow("Booking Status", "{{booking_status}}"),
        defaultEmailRow("Payment Status", "{{payment_status}}"),
        defaultEmailRow("Payment Method", "{{payment_method}}"),
        defaultEmailRow("Location", "{{location_name}}"),
        defaultEmailRow("Start Date", "{{start_date}}"),
        defaultEmailRow("End Date", "{{end_date}}"),
        defaultEmailRow("Ship Departure", "{{ship_departure}}"),
        defaultEmailRow("Ship Arrival", "{{ship_arrival}}"),
        defaultEmailRow("Shuttle Time", "{{shuttle_time}}"),
        defaultEmailRow("Passengers", "{{passengers}}"),
        defaultEmailRow("Storage Type", "{{storage_type}}"),
        defaultEmailRow("License Plate", "{{license_plate}}"),
        defaultEmailRow("Total Price", "{{total_price}}"),
        defaultEmailRow("Paid Amount", "{{paid_amount}}"),
        defaultEmailRow("Due Amount", "{{due_amount}}"),
        defaultEmailRow("Days Until Booking", "{{days_until_booking}}"),
      ],
      footer:
        "Please arrive on time and bring any required booking/payment information.",
    }),
    defaultText:
      "Dear {{customer_name}}, this is a reminder that your {{booking_type}} booking {{booking_id}} is tomorrow. Start date: {{start_date}}. Location: {{location_name}}.",
  },
  {
    key: "feedback",
    label: "Feedback",
    description:
      "Sent automatically to the customer after the booking end date has passed.",
    defaultSubject:
      "How was your Sovereign Parking experience? - {{booking_id}}",
    defaultHtml: buildAdminActionDefaultHtml({
      title: "Sovereign Parking — We Value Your Feedback",
      headerColor: "#0f766e",
      intro:
        "Your <strong>{{booking_type}}</strong> booking <strong>{{booking_id}}</strong> has finished. We hope everything went smoothly.",
      rows: [
        defaultEmailRow("Booking ID", "{{booking_id}}"),
        defaultEmailRow("Booking Type", "{{booking_type}}"),
        defaultEmailRow("Booking Status", "{{booking_status}}"),
        defaultEmailRow("Location", "{{location_name}}"),
        defaultEmailRow("Start Date", "{{start_date}}"),
        defaultEmailRow("End Date", "{{end_date}}"),
        defaultEmailRow("Customer Name", "{{customer_name}}"),
      ],
      footer:
        '<a href="{{feedback_url}}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Leave Feedback</a>',
    }),
    defaultText:
      "Dear {{customer_name}}, your {{booking_type}} booking {{booking_id}} has finished. Please share your feedback here: {{feedback_url}}",
  },
];

const customerEmailPlaceholders = [
  "{{customer_name}}",
  "{{customer_email}}",
  "{{customer_phone}}",

  "{{booking_id}}",
  "{{payment_reference}}",
  "{{booking_type}}",
  "{{booking_type_key}}",
  "{{status}}",
  "{{booking_status}}",
  "{{payment_status}}",
  "{{payment_method}}",
  "{{payment_flow}}",

  "{{location_name}}",
  "{{ship_departure}}",
  "{{ship_arrival}}",
  "{{ship_name}}",
  "{{start_date}}",
  "{{end_date}}",
  "{{entry_date}}",
  "{{exit_date}}",

  "{{license_plate}}",
  "{{passengers}}",
  "{{shuttle_time}}",
  "{{car_park_to_terminal_passengers}}",
  "{{car_park_to_terminal_shuttle_time}}",
  "{{terminal_to_car_park_passengers}}",
  "{{terminal_to_car_park_shuttle_time}}",

  "{{has_add_on_vehicle}}",
  "{{add_on_vehicle}}",
  "{{add_on_vehicle_name}}",
  "{{add_on_vehicle_license_plate_label}}",
  "{{add_on_vehicle_license_plate}}",
  "{{add_on_vehicle_original_price}}",
  "{{add_on_vehicle_discount_percent}}",
  "{{add_on_vehicle_discount_amount}}",
  "{{add_on_vehicle_price}}",
  "{{add_on_vehicle_details_html}}",
  "{{add_on_vehicle_details_text}}",

  "{{storage_type}}",

  "{{original_price}}",
  "{{subtotal_price}}",
  "{{coupon_code}}",
  "{{discount_amount}}",
  "{{total_price}}",
  "{{paid_amount}}",
  "{{due_amount}}",

  "{{cancellation_reason}}",
  "{{refund_amount}}",
  "{{credit_amount}}",

  "{{action_type}}",
  "{{action_title}}",
  "{{return_amount}}",
  "{{returned_amount}}",
  "{{fee_amount}}",
  "{{admin_fee}}",
  "{{return_method}}",
  "{{admin_name}}",
  "{{admin_email}}",
  "{{processed_by}}",
  "{{processed_at}}",

  "{{reminder_date}}",
  "{{days_until_booking}}",
  "{{feedback_url}}",
  "{{site_url}}",
];

const emptyGeneralForm = {
  holding_deposit_amount: String(DEFAULT_HOLDING_DEPOSIT_AMOUNT),
  cancellation_fee: String(DEFAULT_ADMIN_ACTION_FEE),
};

const emptyPriceForm = {
  _id: "",
  type: "cruise",
  label: "",
  min_days: "",
  max_days: "",
  price: "",
};

const emptyShuttleForm = {
  _id: "",
  type: "cruise",
  time: "",
  capacity: "11",
  show_car_park_to_terminal: true,
  show_terminal_to_car_park: true,
};

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

function getStoredAdminUser() {
  if (typeof window === "undefined") return null;

  try {
    const value = localStorage.getItem("adminUser");
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function clearAdminSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
}

function money(amount) {
  return `A$${Number(amount || 0).toFixed(2)}`;
}

function formatType(value) {
  return (
    priceTypeOptions.find((item) => item.value === value)?.label ||
    shuttleTypeOptions.find((item) => item.value === value)?.label ||
    customerEmailBookingTypeOptions.find((item) => item.value === value)
      ?.label ||
    "-"
  );
}

function getSlotTime(slot) {
  return slot?.time || slot?.shuttle_time || "";
}

function getShuttleDirectionLabels(slot) {
  if (slot?.type !== "cruise") {
    return ["Airport shuttle"];
  }

  const labels = [];

  if (slot.show_car_park_to_terminal !== false) {
    labels.push("Car park to terminal");
  }

  if (slot.show_terminal_to_car_park !== false) {
    labels.push("Terminal to car park");
  }

  return labels.length > 0 ? labels : ["Hidden"];
}

function extractPriceRules(response) {
  const data = response?.data?.data;

  if (Array.isArray(data)) return data;

  return data?.price_rules || data?.priceRules || [];
}

function extractShuttleSlots(response) {
  const data = response?.data?.data;

  if (Array.isArray(data)) return data;

  const slots = data?.shuttle_time_slots || data?.shuttleTimeSlots || [];

  return slots.map((slot) => ({
    ...slot,
    time: slot.time || slot.shuttle_time || "",
    show_car_park_to_terminal:
      slot.type === "cruise" ? slot.show_car_park_to_terminal !== false : false,
    show_terminal_to_car_park:
      slot.type === "cruise" ? slot.show_terminal_to_car_park !== false : false,
  }));
}

function extractSettings(response) {
  return response?.data?.data || {};
}

function getDefaultCustomerEmailTemplate(templateOption, bookingType) {
  const typeDefault = templateOption.defaultByType?.[bookingType];

  return {
    subject: typeDefault?.subject || templateOption.defaultSubject || "",
    html: typeDefault?.html || templateOption.defaultHtml || "",
    text: typeDefault?.text || templateOption.defaultText || "",
    is_active: true,
  };
}

function createDefaultCustomerEmailTemplates() {
  return customerEmailBookingTypeOptions.reduce((typeMap, typeOption) => {
    typeMap[typeOption.value] = customerEmailTemplateOptions.reduce(
      (templateMap, templateOption) => {
        templateMap[templateOption.key] = getDefaultCustomerEmailTemplate(
          templateOption,
          typeOption.value
        );

        return templateMap;
      },
      {}
    );

    return typeMap;
  }, {});
}

function normalizeCustomerEmailTemplates(emailTemplates = {}) {
  const defaults = createDefaultCustomerEmailTemplates();
  const customerTemplates = emailTemplates?.customer || {};

  for (const typeOption of customerEmailBookingTypeOptions) {
    for (const templateOption of customerEmailTemplateOptions) {
      const type = typeOption.value;
      const key = templateOption.key;
      const storedTemplate = customerTemplates?.[type]?.[key];

      defaults[type][key] = {
        ...defaults[type][key],
        ...(storedTemplate || {}),
        subject: storedTemplate?.subject ?? defaults[type][key].subject,
        html: storedTemplate?.html ?? defaults[type][key].html,
        text: storedTemplate?.text ?? defaults[type][key].text,
        is_active:
          storedTemplate?.is_active ?? defaults[type][key].is_active,
      };
    }
  }

  return defaults;
}

function Badge({ children, variant = "default" }) {
  const classes = {
    default: "bg-gray-100 text-gray-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    yellow: "bg-yellow-50 text-yellow-800",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        classes[variant] || classes.default
      }`}
    >
      {children}
    </span>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-5 py-3 text-sm font-semibold ${
        active
          ? "bg-blue-600 text-white"
          : "border bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function PriceRuleModal({
  open,
  mode,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === "edit" ? "Edit Price" : "Add Price"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Set booking price by type and day range.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-6">
          <div>
            <label className="text-sm font-semibold text-gray-700">Type</label>

            <select
              value={form.type}
              onChange={(event) => updateField("type", event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              required
            >
              {priceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Label</label>

            <input
              value={form.label}
              onChange={(event) => updateField("label", event.target.value)}
              placeholder="Example: 5 Days"
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Min Days
              </label>

              <input
                type="number"
                min="1"
                value={form.min_days}
                onChange={(event) =>
                  updateField("min_days", event.target.value)
                }
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Max Days
              </label>

              <input
                type="number"
                min="1"
                value={form.max_days}
                onChange={(event) =>
                  updateField("max_days", event.target.value)
                }
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Price ($)
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => updateField("price", event.target.value)}
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : mode === "edit"
                ? "Save Changes"
                : "Add Price"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ShuttleSlotModal({
  open,
  mode,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function updateType(value) {
    setForm((prev) => ({
      ...prev,
      type: value,
      show_car_park_to_terminal:
        value === "cruise" ? prev.show_car_park_to_terminal !== false : false,
      show_terminal_to_car_park:
        value === "cruise" ? prev.show_terminal_to_car_park !== false : false,
    }));
  }

  const isCruise = form.type === "cruise";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-3 py-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {mode === "edit" ? "Edit Shuttle Slot" : "Add Shuttle Slot"}
            </h2>

            <p className="mt-0.5 text-xs text-gray-500">
              Type: <strong>{formatType(form.type)}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 p-4">
          <div>
            <label className="text-xs font-semibold text-gray-700">Type</label>

            <select
              value={form.type}
              onChange={(event) => updateType(event.target.value)}
              className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-600"
              required
            >
              {shuttleTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">
              Shuttle Time
            </label>

            <input
              value={form.time}
              onChange={(event) => updateField("time", event.target.value)}
              placeholder="Example: 09:30 AM"
              className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-600"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">
              Capacity
            </label>

            <input
              type="number"
              min="1"
              value={form.capacity}
              onChange={(event) => updateField("capacity", event.target.value)}
              className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-600"
              required
            />
          </div>

          {isCruise && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-900">
                Show this shuttle slot on:
              </p>

              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-2 rounded-md bg-white p-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.show_car_park_to_terminal !== false}
                    onChange={(event) =>
                      updateField(
                        "show_car_park_to_terminal",
                        event.target.checked
                      )
                    }
                    className="mt-0.5"
                  />

                  <span>
                    <strong>Car park to terminal</strong>
                  </span>
                </label>

                <label className="flex items-start gap-2 rounded-md bg-white p-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.show_terminal_to_car_park !== false}
                    onChange={(event) =>
                      updateField(
                        "show_terminal_to_car_park",
                        event.target.checked
                      )
                    }
                    className="mt-0.5"
                  />

                  <span>
                    <strong>Terminal to car park</strong>
                  </span>
                </label>
              </div>

              <p className="mt-2 text-[11px] text-blue-800">
                At least one direction must be checked.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : mode === "edit"
                ? "Save Changes"
                : "Add Slot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const [adminUser, setAdminUser] = useState(null);
  const [settings, setSettings] = useState(null);

  const [generalForm, setGeneralForm] = useState(emptyGeneralForm);
  const [defaultSlotCapacity, setDefaultSlotCapacity] = useState("11");

  const [priceRules, setPriceRules] = useState([]);
  const [shuttleSlots, setShuttleSlots] = useState([]);

  const [priceTypeFilter, setPriceTypeFilter] = useState("cruise");
  const [shuttleTypeFilter, setShuttleTypeFilter] = useState("cruise");

  const [customerEmailBookingType, setCustomerEmailBookingType] =
    useState("cruise");

  const [selectedCustomerEmailTemplateKey, setSelectedCustomerEmailTemplateKey] =
    useState("booking_confirmation");

  const [customerEmailTemplates, setCustomerEmailTemplates] = useState(() =>
    createDefaultCustomerEmailTemplates()
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [priceModalMode, setPriceModalMode] = useState("create");
  const [priceForm, setPriceForm] = useState(emptyPriceForm);

  const [shuttleModalOpen, setShuttleModalOpen] = useState(false);
  const [shuttleModalMode, setShuttleModalMode] = useState("create");
  const [shuttleForm, setShuttleForm] = useState(emptyShuttleForm);

  const canManageCustomerEmailTemplates = adminUser?.role === "admin";

  const selectedCustomerEmailTemplateOption =
    customerEmailTemplateOptions.find(
      (templateOption) =>
        templateOption.key === selectedCustomerEmailTemplateKey
    ) || customerEmailTemplateOptions[0];

  const selectedCustomerEmailTemplate =
    customerEmailTemplates?.[customerEmailBookingType]?.[
      selectedCustomerEmailTemplateOption.key
    ] || {};

  const filteredPriceRules = useMemo(() => {
    return priceRules.filter((rule) => rule.type === priceTypeFilter);
  }, [priceRules, priceTypeFilter]);

  const filteredShuttleSlots = useMemo(() => {
    return shuttleSlots.filter((slot) => slot.type === shuttleTypeFilter);
  }, [shuttleSlots, shuttleTypeFilter]);

  const fetchSettingsData = useCallback(async () => {
    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [settingsRes, priceRulesRes, shuttleSlotsRes] = await Promise.all([
        axios.get("/admin/settings", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        axios.get("/admin/settings/price-rules", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        axios.get("/admin/settings/shuttle-time-slots", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const loadedSettings = extractSettings(settingsRes);

      setSettings(loadedSettings);

      setGeneralForm({
        holding_deposit_amount: String(
          loadedSettings.holding_deposit_amount ??
            DEFAULT_HOLDING_DEPOSIT_AMOUNT
        ),
        cancellation_fee: String(
          loadedSettings.cancellation_fee ?? DEFAULT_ADMIN_ACTION_FEE
        ),
      });

      setDefaultSlotCapacity(
        String(loadedSettings.default_shuttle_slot_capacity ?? 11)
      );

      setPriceRules(extractPriceRules(priceRulesRes));
      setShuttleSlots(extractShuttleSlots(shuttleSlotsRes));

      setCustomerEmailTemplates(
        normalizeCustomerEmailTemplates(loadedSettings.email_templates || {})
      );
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to load settings.";

      setError(message);

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        router.replace("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    setMounted(true);
    setAdminUser(getStoredAdminUser());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchSettingsData();
  }, [mounted, fetchSettingsData]);

  function updateGeneralField(name, value) {
    setGeneralForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSaveGeneralSettings(event) {
    event.preventDefault();

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSaving(true);

      const holdingDepositAmount = Number(generalForm.holding_deposit_amount);
      const cancellationFee = Number(generalForm.cancellation_fee);

      if (!Number.isFinite(holdingDepositAmount) || holdingDepositAmount < 0) {
        throw new Error("Pay on Arrival holding deposit must be 0 or greater.");
      }

      if (!Number.isFinite(cancellationFee) || cancellationFee < 0) {
        throw new Error("Admin action fee must be 0 or greater.");
      }

      const res = await axios.patch(
        "/admin/settings",
        {
          holding_deposit_amount: holdingDepositAmount,
          cancellation_fee: cancellationFee,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to save general settings."
        );
      }

      alert(res.data.message || "General settings saved successfully.");
      await fetchSettingsData();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save general settings."
      );
    } finally {
      setSaving(false);
    }
  }

  function updateCustomerEmailTemplateField(templateKey, field, value) {
    setCustomerEmailTemplates((prev) => ({
      ...prev,
      [customerEmailBookingType]: {
        ...(prev?.[customerEmailBookingType] || {}),
        [templateKey]: {
          ...(prev?.[customerEmailBookingType]?.[templateKey] || {}),
          [field]: value,
        },
      },
    }));
  }

  function resetCustomerEmailTemplate(templateOption) {
    setCustomerEmailTemplates((prev) => ({
      ...prev,
      [customerEmailBookingType]: {
        ...(prev?.[customerEmailBookingType] || {}),
        [templateOption.key]: getDefaultCustomerEmailTemplate(
          templateOption,
          customerEmailBookingType
        ),
      },
    }));
  }

  async function handleSaveCustomerEmailTemplates(event) {
    event.preventDefault();

    if (!canManageCustomerEmailTemplates) {
      alert("Only admin users can update customer email templates.");
      return;
    }

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSaving(true);

      const templatesForType =
        customerEmailTemplates?.[customerEmailBookingType] || {};

      const res = await axios.patch(
        "/admin/settings",
        {
          email_templates: {
            customer: {
              [customerEmailBookingType]: templatesForType,
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to save customer email templates."
        );
      }

      alert("Customer email templates saved.");
      await fetchSettingsData();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save customer email templates."
      );
    } finally {
      setSaving(false);
    }
  }

  function openAddPriceModal() {
    setPriceModalMode("create");
    setPriceForm({
      ...emptyPriceForm,
      type: priceTypeFilter || "cruise",
    });
    setPriceModalOpen(true);
  }

  function openEditPriceModal(rule) {
    setPriceModalMode("edit");
    setPriceForm({
      _id: rule._id,
      type: rule.type,
      label: rule.label || "",
      min_days: String(rule.min_days ?? ""),
      max_days: String(rule.max_days ?? ""),
      price: String(rule.price ?? ""),
    });
    setPriceModalOpen(true);
  }

  function closePriceModal() {
    if (saving) return;

    setPriceModalOpen(false);
    setPriceForm(emptyPriceForm);
  }

  function validatePricePayload(payload) {
    if (!payload.type) throw new Error("Type is required.");
    if (!payload.label) throw new Error("Label is required.");

    if (!Number.isInteger(payload.min_days) || payload.min_days < 1) {
      throw new Error("Min days must be at least 1.");
    }

    if (!Number.isInteger(payload.max_days) || payload.max_days < 1) {
      throw new Error("Max days must be at least 1.");
    }

    if (payload.max_days < payload.min_days) {
      throw new Error("Max days cannot be less than min days.");
    }

    if (!Number.isFinite(payload.price) || payload.price < 0) {
      throw new Error("Price cannot be negative.");
    }
  }

  async function handlePriceSubmit(event) {
    event.preventDefault();

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        type: priceForm.type,
        label: String(priceForm.label || "").trim(),
        min_days: Number(priceForm.min_days),
        max_days: Number(priceForm.max_days),
        price: Number(priceForm.price),
        is_active: true,
      };

      validatePricePayload(payload);

      const url =
        priceModalMode === "edit"
          ? `/admin/settings/price-rules/${priceForm._id}`
          : "/admin/settings/price-rules";

      const method = priceModalMode === "edit" ? "patch" : "post";

      const res = await axios({
        method,
        url,
        data: payload,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to save price rule."
        );
      }

      alert(res.data.message || "Price saved successfully.");
      closePriceModal();
      await fetchSettingsData();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save price rule."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePrice(rule) {
    const confirmed = window.confirm(
      `Delete price rule "${rule.label}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      const res = await axios.delete(
        `/admin/settings/price-rules/${rule._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to delete price rule."
        );
      }

      alert(res.data.message || "Price rule deleted successfully.");
      await fetchSettingsData();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to delete price rule."
      );
    }
  }

  async function handleSaveDefaultCapacity() {
    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSaving(true);

      const capacity = Number(defaultSlotCapacity);

      if (!Number.isFinite(capacity) || capacity < 1) {
        throw new Error("Default slot capacity must be greater than 0.");
      }

      const res = await axios.patch(
        "/admin/settings",
        {
          default_shuttle_slot_capacity: capacity,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to save default capacity."
        );
      }

      alert(res.data.message || "Default capacity saved successfully.");
      await fetchSettingsData();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save default capacity."
      );
    } finally {
      setSaving(false);
    }
  }

  function openAddShuttleModal() {
    const type = shuttleTypeFilter || "cruise";

    setShuttleModalMode("create");
    setShuttleForm({
      ...emptyShuttleForm,
      type,
      capacity: String(defaultSlotCapacity || 11),
      show_car_park_to_terminal: type === "cruise",
      show_terminal_to_car_park: type === "cruise",
    });
    setShuttleModalOpen(true);
  }

  function openEditShuttleModal(slot) {
    const isCruise = slot.type === "cruise";

    setShuttleModalMode("edit");
    setShuttleForm({
      _id: slot._id,
      type: slot.type,
      time: getSlotTime(slot),
      capacity: String(slot.capacity ?? ""),
      show_car_park_to_terminal: isCruise
        ? slot.show_car_park_to_terminal !== false
        : false,
      show_terminal_to_car_park: isCruise
        ? slot.show_terminal_to_car_park !== false
        : false,
    });
    setShuttleModalOpen(true);
  }

  function closeShuttleModal() {
    if (saving) return;

    setShuttleModalOpen(false);
    setShuttleForm(emptyShuttleForm);
  }

  function validateShuttlePayload(payload) {
    if (!payload.type) throw new Error("Type is required.");
    if (!payload.time) throw new Error("Shuttle time is required.");

    if (!Number.isFinite(payload.capacity) || payload.capacity < 1) {
      throw new Error("Capacity must be greater than 0.");
    }

    if (
      payload.type === "cruise" &&
      !payload.show_car_park_to_terminal &&
      !payload.show_terminal_to_car_park
    ) {
      throw new Error(
        "Please select at least one cruise direction for this shuttle slot."
      );
    }
  }

  async function handleShuttleSubmit(event) {
    event.preventDefault();

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSaving(true);

      const isCruise = shuttleForm.type === "cruise";

      const payload = {
        type: shuttleForm.type,
        time: String(shuttleForm.time || "").trim(),
        shuttle_time: String(shuttleForm.time || "").trim(),
        capacity: Number(shuttleForm.capacity),
        is_active: true,
        show_car_park_to_terminal: isCruise
          ? Boolean(shuttleForm.show_car_park_to_terminal)
          : false,
        show_terminal_to_car_park: isCruise
          ? Boolean(shuttleForm.show_terminal_to_car_park)
          : false,
      };

      validateShuttlePayload(payload);

      const url =
        shuttleModalMode === "edit"
          ? `/admin/settings/shuttle-time-slots/${shuttleForm._id}`
          : "/admin/settings/shuttle-time-slots";

      const method = shuttleModalMode === "edit" ? "patch" : "post";

      const res = await axios({
        method,
        url,
        data: payload,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to save shuttle time slot."
        );
      }

      alert(res.data.message || "Shuttle time slot saved successfully.");
      closeShuttleModal();
      await fetchSettingsData();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to save shuttle time slot."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteShuttle(slot) {
    const confirmed = window.confirm(
      `Delete shuttle time "${getSlotTime(slot)}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      const res = await axios.delete(
        `/admin/settings/shuttle-time-slots/${slot._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to delete shuttle time slot."
        );
      }

      alert(res.data.message || "Shuttle time slot deleted successfully.");
      await fetchSettingsData();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to delete shuttle time slot."
      );
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        <p className="mt-2 text-sm text-gray-500">
          Manage general fees, booking prices, shuttle time slots, and customer
          email templates.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <TabButton
          active={activeTab === "general"}
          onClick={() => setActiveTab("general")}
        >
          General
        </TabButton>

        <TabButton
          active={activeTab === "prices"}
          onClick={() => setActiveTab("prices")}
        >
          Prices Per Day
        </TabButton>

        <TabButton
          active={activeTab === "shuttle"}
          onClick={() => setActiveTab("shuttle")}
        >
          Shuttle Time Slots
        </TabButton>

        <TabButton
          active={activeTab === "customerEmails"}
          onClick={() => setActiveTab("customerEmails")}
        >
          Customer Email Templates
        </TabButton>
      </div>

      {loading && (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            Loading settings...
          </h2>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="font-bold">Settings could not be loaded</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && activeTab === "general" && (
        <form onSubmit={handleSaveGeneralSettings} className="space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                General Settings
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Manage the global amounts used by Pay on Arrival deposits and
                admin cancellation/refund/credit actions.
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <label className="text-sm font-bold text-blue-950">
                  Pay on Arrival Holding Deposit
                </label>

                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-xl border bg-white px-4 py-3 text-sm font-bold text-gray-700">
                    A$
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={generalForm.holding_deposit_amount}
                    onChange={(event) =>
                      updateGeneralField(
                        "holding_deposit_amount",
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <p className="mt-3 text-xs leading-5 text-blue-800">
                  Used when a customer selects Pay on Arrival. This amount is
                  charged now as the holding deposit.
                </p>
              </div>

              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
                <label className="text-sm font-bold text-orange-950">
                  Admin Action Fee
                </label>

                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-xl border bg-white px-4 py-3 text-sm font-bold text-gray-700">
                    A$
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={generalForm.cancellation_fee}
                    onChange={(event) =>
                      updateGeneralField("cancellation_fee", event.target.value)
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <p className="mt-3 text-xs leading-5 text-orange-800">
                  Used for Cancellation with Fee, Refunded with Fee, and Credit
                  with Fee.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t pt-5">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save General Settings"}
              </button>
            </div>
          </div>
        </form>
      )}

      {!loading && !error && activeTab === "prices" && (
        <section className="space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Select Type
                </label>

                <select
                  value={priceTypeFilter}
                  onChange={(event) => setPriceTypeFilter(event.target.value)}
                  className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600 lg:w-72"
                >
                  {priceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={openAddPriceModal}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Add Price
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            {filteredPriceRules.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No price rules found for {formatType(priceTypeFilter)}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-700">
                      <th className="px-4 py-3">Label</th>
                      <th className="px-4 py-3">Min Days</th>
                      <th className="px-4 py-3">Max Days</th>
                      <th className="px-4 py-3">Price ($)</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPriceRules.map((rule) => (
                      <tr key={rule._id} className="border-b">
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-900">
                            {rule.label}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {formatType(rule.type)}
                          </p>
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          {Number(rule.min_days || 0)}
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          {Number(rule.max_days || 0)}
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          {money(rule.price)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditPriceModal(rule)}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeletePrice(rule)}
                              className="rounded-lg border border-red-600 px-3 py-2 text-xs font-semibold text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {!loading && !error && activeTab === "shuttle" && (
        <section className="space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Select Type
                </label>

                <select
                  value={shuttleTypeFilter}
                  onChange={(event) => setShuttleTypeFilter(event.target.value)}
                  className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                >
                  {shuttleTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Default Slot Capacity
                </label>

                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={defaultSlotCapacity}
                    onChange={(event) =>
                      setDefaultSlotCapacity(event.target.value)
                    }
                    className="w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                  />

                  <button
                    type="button"
                    onClick={handleSaveDefaultCapacity}
                    disabled={saving}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={openAddShuttleModal}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Add Shuttle Slot
              </button>
            </div>

            <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
              For cruise shuttle slots, choose whether each time appears on{" "}
              <strong>Car park to terminal</strong>,{" "}
              <strong>Terminal to car park</strong>, or both. Remaining seats
              are calculated from bookings and are not managed here.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            {filteredShuttleSlots.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No shuttle time slots found for {formatType(shuttleTypeFilter)}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-700">
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Shuttle Time</th>
                      <th className="px-4 py-3">Capacity</th>
                      <th className="px-4 py-3">Shows On</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredShuttleSlots.map((slot) => (
                      <tr key={slot._id} className="border-b">
                        <td className="px-4 py-3">
                          <Badge variant="blue">{formatType(slot.type)}</Badge>
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          {getSlotTime(slot)}
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          {Number(slot.capacity || 0)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {getShuttleDirectionLabels(slot).map((label) => (
                              <Badge
                                key={`${slot._id}-${label}`}
                                variant={label === "Hidden" ? "red" : "green"}
                              >
                                {label}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditShuttleModal(slot)}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteShuttle(slot)}
                              className="rounded-lg border border-red-600 px-3 py-2 text-xs font-semibold text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {!loading && !error && activeTab === "customerEmails" && (
        <form onSubmit={handleSaveCustomerEmailTemplates} className="space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Select Booking Type
                </label>

                <select
                  value={customerEmailBookingType}
                  onChange={(event) =>
                    setCustomerEmailBookingType(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600 lg:w-72"
                >
                  {customerEmailBookingTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={saving || !canManageCustomerEmailTemplates}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Customer Email Templates"}
              </button>
            </div>

            {!canManageCustomerEmailTemplates && (
              <p className="mt-4 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
                You can view these templates, but only admin users can change
                them.
              </p>
            )}

            <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-semibold">Available placeholders</p>
              <p className="mt-2 break-words text-xs leading-6">
                {customerEmailPlaceholders.join("  ")}
              </p>
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-gray-700">
                Select Email Template
              </label>

              <select
                value={selectedCustomerEmailTemplateKey}
                onChange={(event) =>
                  setSelectedCustomerEmailTemplateKey(event.target.value)
                }
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600 lg:w-96"
              >
                {customerEmailTemplateOptions.map((templateOption) => (
                  <option key={templateOption.key} value={templateOption.key}>
                    {templateOption.label}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-gray-500">
                Select one template to edit for the selected booking type.
              </p>
            </div>
          </div>

          <EmailTemplateEditor
            key={`${customerEmailBookingType}-${selectedCustomerEmailTemplateOption.key}`}
            title={`${formatType(customerEmailBookingType)} - ${
              selectedCustomerEmailTemplateOption.label
            }`}
            description={selectedCustomerEmailTemplateOption.description}
            subject={selectedCustomerEmailTemplate.subject}
            html={selectedCustomerEmailTemplate.html}
            text={selectedCustomerEmailTemplate.text}
            isActive={selectedCustomerEmailTemplate.is_active}
            disabled={!canManageCustomerEmailTemplates || saving}
            onChange={(field, value) =>
              updateCustomerEmailTemplateField(
                selectedCustomerEmailTemplateOption.key,
                field,
                value
              )
            }
            onReset={() =>
              resetCustomerEmailTemplate(selectedCustomerEmailTemplateOption)
            }
          />

          <div className="flex justify-end rounded-2xl border bg-white p-5 shadow-sm">
            <button
              type="submit"
              disabled={saving || !canManageCustomerEmailTemplates}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Customer Email Templates"}
            </button>
          </div>
        </form>
      )}

      <PriceRuleModal
        open={priceModalOpen}
        mode={priceModalMode}
        form={priceForm}
        setForm={setPriceForm}
        saving={saving}
        onClose={closePriceModal}
        onSubmit={handlePriceSubmit}
      />

      <ShuttleSlotModal
        open={shuttleModalOpen}
        mode={shuttleModalMode}
        form={shuttleForm}
        setForm={setShuttleForm}
        saving={saving}
        onClose={closeShuttleModal}
        onSubmit={handleShuttleSubmit}
      />
    </div>
  );
}