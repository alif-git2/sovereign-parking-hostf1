"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";
import Navbar from "../../component/global/NavBar";
import Footer from "../../component/global/Footer";

const dashboardTabs = [
  { id: "dashboard", label: "Dashboard", description: "Overview" },
  { id: "bookings", label: "My Bookings", description: "Booking history" },
  { id: "wallet", label: "Wallet Transactions", description: "Wallet activity" },
  { id: "withdraw", label: "Withdraw Request", description: "Request wallet payout" },
  { id: "payments", label: "Payment Transactions", description: "Payment records" },
  { id: "support_tickets", label: "Support Tickets", description: "Support requests" },
  {
    id: "settings",
    label: "Settings",
    description: "Profile and payment methods",
    children: [
      { id: "profile", label: "Profile", description: "Edit profile details" },
      { id: "payment_methods", label: "Payment Method", description: "Manage saved cards" },
    ],
  },
];

const INCLUDED_CRUISE_SHUTTLE_PASSENGERS = 4;
const EXTRA_CRUISE_PASSENGER_FEE = 5;

const cruiseEditShuttleDirections = {
  carParkToTerminal: {
    label: "Car park to terminal",
    passengerField: "car_park_to_terminal_passengers",
    slotIdField: "car_park_to_terminal_shuttle_slot_id",
    timeField: "car_park_to_terminal_shuttle_time",
    showField: "show_car_park_to_terminal",
  },
  terminalToCarPark: {
    label: "Terminal to car park",
    passengerField: "terminal_to_car_park_passengers",
    slotIdField: "terminal_to_car_park_shuttle_slot_id",
    timeField: "terminal_to_car_park_shuttle_time",
    showField: "show_terminal_to_car_park",
  },
};

function formatDate(date) {
  if (!date) return "-";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "-";
  return parsedDate.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(amount) {
  return `A$${Number(amount || 0).toFixed(2)}`;
}

function titleCase(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStatus(status) {
  if (!status) return "-";
  const labels = {
    pending: "Pending",
    pending_payment: "Pending Payment",
    success: "Confirmed",
    confirmed: "Confirmed",
    poa: "Pay on Arrival",
    cancelled: "Cancelled",
    cancellation_requested: "Cancellation Requested by Customer",
    refund: "Refunded",
    refunded: "Refunded",
    credit: "Credited",
    credited: "Credited",
    completed: "Completed",
    failed: "Failed",
    reversed: "Reversed",
    open: "Open",
    in_progress: "In Progress",
    replied: "Replied",
    closed: "Closed",
  };
  return labels[status] || titleCase(status);
}

function formatWithdrawalStatus(status) {
  const labels = {
    pending: "Pending",
    completed: "Completed / Paid",
    cancelled: "Rejected",
    failed: "Failed",
    reversed: "Reversed",
  };
  return labels[status] || formatStatus(status);
}

function formatPaymentStatus(status) {
  const labels = {
    unpaid: "Unpaid",
    pending: "Pending",
    paid: "Paid",
    partial: "Partially Paid",
    failed: "Failed",
    refunded: "Refunded",
    partially_refunded: "Partially Refunded",
    cancelled: "Cancelled",
  };
  return labels[status] || titleCase(status);
}

function formatPaymentMethod(method) {
  const labels = {
    stripe: "Stripe",
    paypal: "PayPal",
    poa: "Pay on Arrival",
    wallet: "Wallet",
    credit_card_manual: "Credit Card Manual",
    bank: "Bank",
    admin: "Admin",
  };
  return labels[method] || titleCase(method);
}

function formatPaymentFlow(flow) {
  const labels = {
    full_online: "Full Payment",
    poa_deposit: "POA Deposit",
    wallet_topup: "Wallet Top Up",
  };
  return labels[flow] || titleCase(flow);
}

function formatPaymentPurpose(purpose) {
  const labels = {
    booking_payment: "Booking Payment",
    wallet_topup: "Wallet Top Up",
    poa_deposit: "POA Deposit",
    refund: "Refund",
    cancellation_refund: "Cancellation Refund",
  };
  return labels[purpose] || titleCase(purpose || "booking_payment");
}

function formatPayoutMethod(method) {
  const labels = {
    bank_transfer: "Bank Transfer",
    paypal: "PayPal",
    cash: "Cash",
    // other: "Other",
    bank: "Bank",
    admin: "Admin",
  };
  return labels[method] || titleCase(method);
}

function formatWalletTransactionType(type) {
  const labels = {
    topup_stripe: "Stripe Top Up",
    topup_paypal: "PayPal Top Up",
    booking_payment: "Booking Payment",
    refund_credit: "Refund Credit",
    withdrawal_request: "Withdrawal Request",
    withdrawal_paid: "Withdrawal Paid",
    admin_adjustment: "Admin Adjustment",
  };
  return labels[type] || titleCase(type);
}

function formatWalletStatus(status) {
  const labels = { active: "Active", frozen: "Frozen", disabled: "Disabled" };
  return labels[status] || formatStatus(status);
}

function formatPriority(priority) {
  const labels = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
  return labels[priority] || "Normal";
}

function getPaymentProviderReference(payment) {
  return (
    payment.provider_payment_id ||
    payment.provider_order_id ||
    payment.provider_capture_id ||
    payment.transaction_id ||
    "-"
  );
}

function getStatusClass(status) {
  if (["success", "confirmed"].includes(status)) return "bg-green-50 text-green-700 ring-green-200";
  if (status === "poa") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (status === "cancellation_requested") return "bg-orange-50 text-orange-700 ring-orange-200";
  if (["pending", "pending_payment"].includes(status)) return "bg-yellow-50 text-yellow-700 ring-yellow-200";
  if (["cancelled", "refund", "refunded"].includes(status)) return "bg-red-50 text-red-700 ring-red-200";
  if (["credit", "credited"].includes(status)) return "bg-purple-50 text-purple-700 ring-purple-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

function getPaymentStatusClass(status) {
  if (status === "paid") return "bg-green-50 text-green-700 ring-green-200";
  if (status === "pending") return "bg-yellow-50 text-yellow-700 ring-yellow-200";
  if (status === "partial") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (["failed", "refunded", "partially_refunded", "cancelled"].includes(status)) return "bg-red-50 text-red-700 ring-red-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

function getWalletTransactionStatusClass(status) {
  if (status === "completed") return "bg-green-50 text-green-700 ring-green-200";
  if (status === "pending") return "bg-yellow-50 text-yellow-700 ring-yellow-200";
  if (["failed", "cancelled", "reversed"].includes(status)) return "bg-red-50 text-red-700 ring-red-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

function getSupportStatusClass(status) {
  if (status === "open") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (status === "in_progress") return "bg-yellow-50 text-yellow-700 ring-yellow-200";
  if (status === "replied") return "bg-green-50 text-green-700 ring-green-200";
  if (status === "closed") return "bg-gray-100 text-gray-700 ring-gray-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

function getPriorityClass(priority) {
  if (priority === "urgent") return "bg-red-50 text-red-700 ring-red-200";
  if (priority === "high") return "bg-orange-50 text-orange-700 ring-orange-200";
  if (priority === "normal") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

function getPayoutDetails(transaction) {
  return transaction?.payout_details || transaction?.metadata?.payout_details || null;
}

function getAdminPaymentProof(transaction) {
  return transaction?.admin_payment_proof || transaction?.metadata?.admin_payment_proof || null;
}

function getPayoutDetailsText(transaction) {
  const details = getPayoutDetails(transaction);
  if (!details) return "-";

  if (details.method === "bank_transfer") {
    return [
      "Method: Bank Transfer",
      `Holder: ${details.account_holder_name || "-"}`,
      `Bank: ${details.bank_name || "-"}`,
      `BSB: ${details.bsb || "-"}`,
      `Account: ${details.account_number || "-"}`,
    ].join("\n");
  }

  if (details.method === "paypal") {
    return ["Method: PayPal", `Email: ${details.paypal_email || "-"}`].join("\n");
  }

  return [
    `Method: ${formatPayoutMethod(details.method)}`,
    details.customer_note ? `Note: ${details.customer_note}` : "",
  ].filter(Boolean).join("\n");
}

function getAdminProofText(transaction) {
  const proof = getAdminPaymentProof(transaction);
  if (!proof) return "";
  return [
    `Paid Method: ${formatPayoutMethod(proof.paid_method)}`,
    `Reference: ${proof.paid_reference || "-"}`,
    proof.paid_note ? `Note: ${proof.paid_note}` : "",
    proof.paid_at ? `Paid At: ${formatDateTime(proof.paid_at)}` : "",
  ].filter(Boolean).join("\n");
}

function getBookingTitle(booking) {
  if (booking.type === "cruise") return booking.details?.cruise?.ship_name || "Cruise Booking";
  if (booking.type === "storage") {
    const storageName = booking.details?.storage?.storage_type_name || booking.details?.storage?.storage_type_id?.name || "Storage";
    return `${storageName} Booking`;
  }
  if (booking.type === "airport") return "Airport Parking";
  return "Booking";
}

function getBookingSubDetails(booking) {
  if (booking.type === "cruise") {
    const carParkToTerminalPassengers =
      getBookingCruiseCarParkToTerminalPassengers(booking);

    const terminalToCarParkPassengers =
      getBookingCruiseTerminalToCarParkPassengers(booking);

    const carParkToTerminalTime =
      getBookingCruiseCarParkToTerminalShuttleTime(booking);

    const terminalToCarParkTime =
      getBookingCruiseTerminalToCarParkShuttleTime(booking);

    return [
      booking.location_id?.name ? `Location: ${booking.location_id.name}` : null,
      carParkToTerminalTime
        ? `Car park to terminal: ${carParkToTerminalTime} (${carParkToTerminalPassengers} passenger${carParkToTerminalPassengers === 1 ? "" : "s"})`
        : null,
      terminalToCarParkTime
        ? `Terminal to car park: ${terminalToCarParkTime} (${terminalToCarParkPassengers} passenger${terminalToCarParkPassengers === 1 ? "" : "s"})`
        : null,
      booking.license_plate ? `License: ${booking.license_plate}` : null,
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (booking.type === "storage") {
    return [
      booking.location_id?.name ? `Location: ${booking.location_id.name}` : null,
      booking.details?.storage?.storage_type_name
        ? `Type: ${booking.details.storage.storage_type_name}`
        : null,
      booking.reference ? `Reference: ${booking.reference}` : null,
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (booking.type === "airport") {
    const shuttleTime = booking.details?.airport?.shuttle_time;

    return [
      booking.location_id?.name ? `Location: ${booking.location_id.name}` : null,
      shuttleTime ? `Shuttle: ${shuttleTime}` : "No shuttle",
      shuttleTime
        ? `Passengers: ${booking.details?.airport?.pickup_pax || booking.pax || 0}`
        : null,
      booking.license_plate ? `License: ${booking.license_plate}` : null,
    ]
      .filter(Boolean)
      .join(" • ");
  }

  return "-";
}

function isPoaDepositBooking(booking) {
  return booking?.payment_flow === "poa_deposit";
}

function isPoaDepositPaid(booking) {
  return isPoaDepositBooking(booking) && booking.payment_status === "partial" && booking.status === "poa";
}

function canCustomerRequestCancel(booking) {
  const status = String(booking?.status || "").toLowerCase();
  return !["cancelled", "cancellation_requested", "refund", "refunded", "credit", "credited"].includes(status);
}

function isCancellationSubmitted(booking) {
  return String(booking?.status || "").toLowerCase() === "cancellation_requested";
}

function isPayNowAvailable(booking) {
  const dueAmount = Number(booking.due_amount || 0);
  if (dueAmount <= 0) return false;
  if (booking.status === "cancellation_requested") return false;
  if (booking.payment_status === "paid" || booking.status === "success" || booking.status === "confirmed") return false;
  if (isPoaDepositPaid(booking)) return false;
  return ["stripe", "paypal"].includes(booking.payment_method) && booking.status === "pending_payment" && ["pending", "failed"].includes(booking.payment_status);
}

function getPaymentNote(booking) {
  if (booking.status === "cancellation_requested") return "Cancellation request submitted. Admin will review this booking.";
  if (booking.payment_method === "wallet" && booking.payment_status === "paid") return `Paid by wallet: ${money(booking.wallet_used || booking.paid_amount)}`;
  if (isPoaDepositPaid(booking)) return `Deposit paid. Balance due on arrival: ${money(booking.balance_due_on_arrival || booking.due_amount)}`;
  if (isPoaDepositBooking(booking) && booking.status === "pending_payment" && booking.payment_status === "pending") return `Holding deposit required: ${money(booking.holding_deposit_amount || booking.due_amount)}`;
  if (booking.payment_flow === "full_online" && booking.payment_status === "paid") return "Full payment completed.";
  if (booking.payment_flow === "full_online" && ["pending", "failed"].includes(booking.payment_status)) return `Full payment due: ${money(booking.due_amount)}`;
  if (booking.payment_method === "poa") return `Payment due on arrival: ${money(booking.due_amount)}`;
  return "-";
}

function getProfileImageUrl(user) {
  const url = user?.profile_image_url || user?.profile_image || user?.avatar_url || user?.image || "";
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

function getPaymentMethodId(method) {
  return method?._id || method?.id || method?.provider_payment_method_id || "";
}

function getPaymentMethodTitle(method) {
  if (!method) return "Payment Method";
  if (method.provider === "stripe") {
    const brand = String(method.brand || "Card").toUpperCase();
    const last4 = method.last4 || "••••";
    return `${brand} •••• ${last4}`;
  }
  return formatPaymentMethod(method.provider || method.method || "Payment Method");
}

function getPaymentMethodSubtitle(method) {
  if (!method) return "-";
  if (method.provider === "stripe") {
    const parts = [];
    if (method.exp_month && method.exp_year) parts.push(`Expires ${String(method.exp_month).padStart(2, "0")}/${method.exp_year}`);
    if (method.is_default) parts.push("Default");
    return parts.join(" • ") || "Saved Stripe card";
  }
  return method.is_default ? "Default payment method" : "Saved payment method";
}

function getBookingEditLicenseValue(booking) {
  if (booking?.type === "storage") return booking.reference || "";
  return booking.license_plate || "";
}

function normalizeCount(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}

function getPassengerExtraCount(passengers) {
  return Math.max(
    normalizeCount(passengers) - INCLUDED_CRUISE_SHUTTLE_PASSENGERS,
    0
  );
}

function getCruiseExtraPassengerFeeFromForm(form = {}) {
  const carParkToTerminalExtra = getPassengerExtraCount(
    form.car_park_to_terminal_passengers
  );

  const terminalToCarParkExtra = getPassengerExtraCount(
    form.terminal_to_car_park_passengers
  );

  const extraPassengerCount = carParkToTerminalExtra + terminalToCarParkExtra;

  return {
    extraPassengerCount,
    extraPassengerFee: extraPassengerCount * EXTRA_CRUISE_PASSENGER_FEE,
  };
}

function getSlotId(slot) {
  return String(slot?._id || slot?.id || slot?.slot_id || slot?.time || "");
}

function getSlotTime(slot) {
  return String(slot?.time || slot?.shuttle_time || "").trim();
}

function getSlotRemaining(slot) {
  if (slot?.remaining !== undefined && slot?.remaining !== null) {
    return Math.max(Number(slot.remaining || 0), 0);
  }

  const capacity = Number(slot?.capacity || 0);
  const bookedCount = Number(slot?.booked_count || 0);

  return Math.max(capacity - bookedCount, 0);
}

function getEditDirectionRemaining(slot, directionKey) {
  if (directionKey === "carParkToTerminal") {
    if (
      slot?.car_park_to_terminal_remaining !== undefined &&
      slot.car_park_to_terminal_remaining !== null
    ) {
      return Math.max(Number(slot.car_park_to_terminal_remaining || 0), 0);
    }
  }

  if (directionKey === "terminalToCarPark") {
    if (
      slot?.terminal_to_car_park_remaining !== undefined &&
      slot.terminal_to_car_park_remaining !== null
    ) {
      return Math.max(Number(slot.terminal_to_car_park_remaining || 0), 0);
    }
  }

  return getSlotRemaining(slot);
}

function getEditDirectionBookedCount(slot, directionKey) {
  if (directionKey === "carParkToTerminal") {
    return normalizeCount(slot?.car_park_to_terminal_booked_count);
  }

  if (directionKey === "terminalToCarPark") {
    return normalizeCount(slot?.terminal_to_car_park_booked_count);
  }

  return normalizeCount(slot?.booked_count);
}

function getBookingCruiseDetails(booking) {
  return booking?.details?.cruise || {};
}

function getBookingCruiseCarParkToTerminalPassengers(booking) {
  const cruise = getBookingCruiseDetails(booking);

  return normalizeCount(
    cruise.car_park_to_terminal_passengers ||
      cruise.pickup_pax ||
      booking?.pax ||
      0
  );
}

function getBookingCruiseTerminalToCarParkPassengers(booking) {
  const cruise = getBookingCruiseDetails(booking);

  return normalizeCount(
    cruise.terminal_to_car_park_passengers ||
      cruise.pickup_pax ||
      booking?.pax ||
      0
  );
}

function getBookingCruiseCarParkToTerminalShuttleTime(booking) {
  const cruise = getBookingCruiseDetails(booking);

  return String(
    cruise.car_park_to_terminal_shuttle_time || cruise.shuttle_time || ""
  ).trim();
}

function getBookingCruiseTerminalToCarParkShuttleTime(booking) {
  const cruise = getBookingCruiseDetails(booking);

  return String(
    cruise.terminal_to_car_park_shuttle_time || cruise.shuttle_time || ""
  ).trim();
}

function getBookingCruiseCarParkToTerminalShuttleSlotId(booking) {
  const cruise = getBookingCruiseDetails(booking);

  return String(
    cruise.car_park_to_terminal_shuttle_slot_id || cruise.shuttle_slot_id || ""
  );
}

function getBookingCruiseTerminalToCarParkShuttleSlotId(booking) {
  const cruise = getBookingCruiseDetails(booking);

  return String(
    cruise.terminal_to_car_park_shuttle_slot_id || cruise.shuttle_slot_id || ""
  );
}

function getBookingEditShuttleTime(booking) {
  if (booking?.type === "cruise") {
    return getBookingCruiseCarParkToTerminalShuttleTime(booking);
  }

  if (booking?.type === "airport") {
    return booking.details?.airport?.shuttle_time || "";
  }

  return "";
}

function getBookingEditShuttleSlotId(booking) {
  if (booking?.type === "cruise") {
    return getBookingCruiseCarParkToTerminalShuttleSlotId(booking);
  }

  if (booking?.type === "airport") {
    return String(booking.details?.airport?.shuttle_slot_id || "");
  }

  return "";
}

function getInitialEditBookingForm(booking = null) {
  return {
    license_plate: booking ? getBookingEditLicenseValue(booking) : "",
    reference: booking ? getBookingEditLicenseValue(booking) : "",

    shuttle_slot_id: booking ? getBookingEditShuttleSlotId(booking) : "",
    shuttle_time: booking ? getBookingEditShuttleTime(booking) : "",

    car_park_to_terminal_passengers: booking
      ? getBookingCruiseCarParkToTerminalPassengers(booking)
      : 1,
    car_park_to_terminal_shuttle_slot_id: booking
      ? getBookingCruiseCarParkToTerminalShuttleSlotId(booking)
      : "",
    car_park_to_terminal_shuttle_time: booking
      ? getBookingCruiseCarParkToTerminalShuttleTime(booking)
      : "",

    terminal_to_car_park_passengers: booking
      ? getBookingCruiseTerminalToCarParkPassengers(booking)
      : 1,
    terminal_to_car_park_shuttle_slot_id: booking
      ? getBookingCruiseTerminalToCarParkShuttleSlotId(booking)
      : "",
    terminal_to_car_park_shuttle_time: booking
      ? getBookingCruiseTerminalToCarParkShuttleTime(booking)
      : "",
  };
}

function normalizeEditShuttleSlots(slots = [], type = "cruise") {
  if (!Array.isArray(slots)) return [];

  return slots
    .map((slot) => {
      const time = getSlotTime(slot);
      const capacity = Number(slot?.capacity || 0);
      const bookedCount = normalizeCount(slot?.booked_count);

      return {
        ...slot,
        _id: getSlotId(slot),
        type: slot?.type || type,
        time,
        shuttle_time: time,
        capacity,
        booked_count: bookedCount,
        remaining:
          slot?.remaining !== undefined && slot.remaining !== null
            ? normalizeCount(slot.remaining)
            : Math.max(capacity - bookedCount, 0),

        show_car_park_to_terminal:
          type === "cruise" ? slot?.show_car_park_to_terminal !== false : false,

        show_terminal_to_car_park:
          type === "cruise" ? slot?.show_terminal_to_car_park !== false : false,

        car_park_to_terminal_booked_count: normalizeCount(
          slot?.car_park_to_terminal_booked_count
        ),

        car_park_to_terminal_remaining:
          slot?.car_park_to_terminal_remaining !== undefined &&
          slot.car_park_to_terminal_remaining !== null
            ? normalizeCount(slot.car_park_to_terminal_remaining)
            : capacity,

        terminal_to_car_park_booked_count: normalizeCount(
          slot?.terminal_to_car_park_booked_count
        ),

        terminal_to_car_park_remaining:
          slot?.terminal_to_car_park_remaining !== undefined &&
          slot.terminal_to_car_park_remaining !== null
            ? normalizeCount(slot.terminal_to_car_park_remaining)
            : capacity,

        is_active: slot?.is_active !== false,
      };
    })
    .filter((slot) => slot.time && slot.is_active !== false);
}

function canCustomerEditBooking(booking) {
  const status = String(booking?.status || "").toLowerCase();
  return !["cancelled", "cancellation_requested", "refund", "refunded", "credit", "credited"].includes(status);
}

function getSupportTicketMessagePreview(ticket) {
  const message = String(ticket?.message || "").trim();
  if (!message) return "-";
  return message.length > 140 ? `${message.slice(0, 140)}...` : message;
}

function StatusBadge({ value, className }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${className}`}>
      {value}
    </span>
  );
}

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-gray-950">{value}</p>
      {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-xl font-bold text-gray-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">—</div>
      <p className="mt-4 text-sm font-medium text-gray-600">{message}</p>
    </div>
  );
}

export default function CustomerDashboardPage() {
  const router = useRouter();
  const profileImageInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("dashboard");

  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [paymentTransactions, setPaymentTransactions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [viewBooking, setViewBooking] = useState(null);
  const [serverStats, setServerStats] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [supportTickets, setSupportTickets] = useState([]);
  const [supportTicketsLoading, setSupportTicketsLoading] = useState(false);
  const [supportTicketsError, setSupportTicketsError] = useState("");
  const [supportTicketModalOpen, setSupportTicketModalOpen] = useState(false);
  const [supportTicketSubmitting, setSupportTicketSubmitting] = useState(false);
  const [supportTicketError, setSupportTicketError] = useState("");
  const [supportTicketSuccess, setSupportTicketSuccess] = useState("");
  const [supportTicketView, setSupportTicketView] = useState(null);
  const [supportTicketForm, setSupportTicketForm] = useState({ booking_id: "", message: "" });

  const [loading, setLoading] = useState(true);

  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [paymentMethodActionLoading, setPaymentMethodActionLoading] = useState("");
  const [paymentMethodError, setPaymentMethodError] = useState("");

  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState("");
  const [topUpError, setTopUpError] = useState("");

  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [withdrawPayoutMethod, setWithdrawPayoutMethod] = useState("");
  const [withdrawAccountHolderName, setWithdrawAccountHolderName] = useState("");
  const [withdrawBankName, setWithdrawBankName] = useState("");
  const [withdrawBsb, setWithdrawBsb] = useState("");
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [withdrawPaypalEmail, setWithdrawPaypalEmail] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const [editBooking, setEditBooking] = useState(null);
  const [editBookingForm, setEditBookingForm] = useState(() =>
    getInitialEditBookingForm()
  );
  const [editShuttleSlots, setEditShuttleSlots] = useState([]);
  const [editBookingSaving, setEditBookingSaving] = useState(false);
  const [editBookingError, setEditBookingError] = useState("");
  const [editShuttleLoading, setEditShuttleLoading] = useState(false);

  function getAuthHeaders() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function confirmStripeSetupIfNeeded() {
    try {
      if (typeof window === "undefined") return false;

      const url = new URL(window.location.href);
      const sessionId = url.searchParams.get("stripe_setup_session_id");
      const cancelled = url.searchParams.get("stripe_setup_cancelled");

      if (cancelled) {
        url.searchParams.delete("stripe_setup_cancelled");
        window.history.replaceState({}, "", url.pathname + url.search);
        return false;
      }

      if (!sessionId) return false;

      const res = await axios.post("/customer/settings/payment-methods/confirm", { session_id: sessionId }, { headers: getAuthHeaders() });

      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to confirm payment method.");
      }

      url.searchParams.delete("stripe_setup_session_id");
      window.history.replaceState({}, "", url.pathname + url.search);

      const updatedUser = res.data.data?.user || null;
      const methods = res.data.data?.payment_methods || [];

      if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      setPaymentMethods(methods);
      setActiveTab("payment_methods");
      return true;
    } catch (error) {
      setPaymentMethodError(error.response?.data?.message || error.response?.data?.error || error.message || "Failed to save Stripe payment method.");
      return false;
    }
  }

  async function loadSupportTickets(options = {}) {
    try {
      setSupportTicketsLoading(!options.silent);
      setSupportTicketsError("");

      const res = await axios.get("/customer/support-tickets", { headers: getAuthHeaders() });

      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to load support tickets.");
      }

      setSupportTickets(res.data.data?.tickets || []);
    } catch (error) {
      setSupportTicketsError(error.response?.data?.message || error.response?.data?.error || error.message || "Failed to load support tickets.");
    } finally {
      setSupportTicketsLoading(false);
    }
  }

  async function loadDashboard() {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await axios.get("/customer/dashboard", { headers: { Authorization: `Bearer ${token}` } });

      if (!res.data.success) {
        throw new Error(res.data.message || res.data.error || "Failed to load dashboard");
      }

      const dashboardData = res.data.data || {};
      const nextUser = dashboardData.user || null;

      setUser(nextUser);
      setWallet(dashboardData.wallet || null);
      setBookings(dashboardData.bookings || []);
      setWalletTransactions(dashboardData.walletTransactions || []);
      setPaymentTransactions(dashboardData.paymentTransactions || []);
      setServerStats(dashboardData.stats || null);
      setPaymentMethods(dashboardData.paymentMethods || dashboardData.payment_methods || nextUser?.payment_methods || []);
      setSupportTickets(dashboardData.supportTickets || dashboardData.support_tickets || []);

      if (nextUser && typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(nextUser));
      }

      await loadSupportTickets({ silent: true });
    } catch (error) {
      alert(error.response?.data?.message || error.response?.data?.error || error.message);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function bootDashboard() {
      const confirmedStripeSetup = await confirmStripeSetupIfNeeded();
      await loadDashboard();
      if (confirmedStripeSetup) setActiveTab("payment_methods");
    }
    bootDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    setProfileForm({ name: user?.name || "", phone: user?.phone || "" });
    setProfileImagePreview(getProfileImageUrl(user));
    setProfileImageFile(null);
    setProfileError("");
    setProfileSuccess("");
  }, [user]);

  const stats = useMemo(() => {
    if (serverStats) {
      return {
        totalBookings: serverStats.totalBookings || 0,
        upcomingBookings: serverStats.upcomingBookings || 0,
        paidBookings: serverStats.paidBookings || 0,
        partialDepositBookings: serverStats.partialDepositBookings || 0,
        dueAmount: serverStats.totalDueAmount || 0,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingBookings = bookings.filter((booking) => {
      if (!booking.start_date) return false;
      const startDate = new Date(booking.start_date);
      return startDate >= today && !["cancelled", "cancellation_requested"].includes(booking.status);
    }).length;

    return {
      totalBookings: bookings.length,
      upcomingBookings,
      paidBookings: bookings.filter((booking) => booking.payment_status === "paid").length,
      partialDepositBookings: bookings.filter((booking) => booking.payment_status === "partial").length,
      dueAmount: bookings.reduce((total, booking) => total + Number(booking.due_amount || 0), 0),
    };
  }, [bookings, serverStats]);

  const supportStats = useMemo(() => {
    return {
      total: supportTickets.length,
      open: supportTickets.filter((ticket) => ticket.status === "open").length,
      inProgress: supportTickets.filter((ticket) => ticket.status === "in_progress").length,
      replied: supportTickets.filter((ticket) => ticket.status === "replied").length,
      closed: supportTickets.filter((ticket) => ticket.status === "closed").length,
    };
  }, [supportTickets]);

  const walletBalance = Number(wallet?.balance ?? user?.wallet_balance ?? 0);
  const walletStatus = wallet?.status || user?.wallet_status || "active";
  const walletIsActive = walletStatus === "active";
  const profileImageUrl = getProfileImageUrl(user);

  const withdrawalRequests = useMemo(() => {
    return walletTransactions.filter((transaction) => ["withdrawal_request", "withdrawal_paid"].includes(transaction.type));
  }, [walletTransactions]);

  const pendingWithdrawalTotal = useMemo(() => {
    return withdrawalRequests
      .filter((transaction) => transaction.status === "pending")
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
  }, [withdrawalRequests]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  function handlePayNow(booking) {
    if (booking.payment_method === "paypal") {
      router.push(`/booking/paypal/${booking._id}`);
      return;
    }
    router.push(`/booking/payment/${booking._id}`);
  }

  function handleViewBooking(booking) {
    setViewBooking(booking);
  }

  function openCancelRequestModal(booking) {
    setCancelModalBooking(booking);
    setCancellationReason("");
  }

  function closeCancelRequestModal() {
    if (cancelSubmitting) return;
    setCancelModalBooking(null);
    setCancellationReason("");
  }

  async function submitCancellationRequest(event) {
    event.preventDefault();
    if (!cancelModalBooking) return;

    const reason = String(cancellationReason || "").trim();
    if (reason.length < 5) {
      alert("Please enter a cancellation reason.");
      return;
    }

    try {
      setCancelSubmitting(true);
      const bookingId = cancelModalBooking.booking_id || cancelModalBooking._id;
      const res = await axios.post(`/customer/bookings/${bookingId}/cancel-request`, { reason }, { headers: getAuthHeaders() });

      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to submit cancellation request.");
      }

      alert(res.data.message || "Cancellation request submitted.");
      setCancelModalBooking(null);
      setCancellationReason("");
      await loadDashboard();
    } catch (error) {
      alert(error.response?.data?.message || error.response?.data?.error || error.message || "Failed to submit cancellation request.");
    } finally {
      setCancelSubmitting(false);
    }
  }

  function handleProfileFieldChange(name, value) {
    setProfileForm((prev) => ({ ...prev, [name]: value }));
    setProfileError("");
    setProfileSuccess("");
  }

  function handleProfileImageChange(event) {
    const file = event.target.files?.[0];
    setProfileError("");
    setProfileSuccess("");

    if (!file) {
      setProfileImageFile(null);
      setProfileImagePreview(getProfileImageUrl(user));
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setProfileError("Please upload a JPG, PNG, or WEBP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Profile image must be less than 2MB.");
      event.target.value = "";
      return;
    }

    setProfileImageFile(file);
    setProfileImagePreview(URL.createObjectURL(file));
  }

  async function submitProfileUpdate(event) {
    event.preventDefault();

    try {
      const name = String(profileForm.name || "").trim();
      const phone = String(profileForm.phone || "").trim();
      if (!name) throw new Error("Name is required.");
      if (!phone) throw new Error("Phone is required.");

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        router.push("/login");
        return;
      }

      setProfileSaving(true);
      setProfileError("");
      setProfileSuccess("");

      const formData = new FormData();
      formData.append("name", name);
      formData.append("phone", phone);
      if (profileImageFile) formData.append("profile_image", profileImageFile);

      const response = await fetch("/backend/router/customer/settings/profile", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || "Failed to update profile.");
      }

      const updatedUser = data.data?.user || data.user || data.data || null;
      if (updatedUser) {
        const imageUrl = getProfileImageUrl(updatedUser);
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setProfileImagePreview(imageUrl ? `${imageUrl}?v=${Date.now()}` : "");
      } else {
        await loadDashboard();
      }

      setProfileImageFile(null);
      if (profileImageInputRef.current) profileImageInputRef.current.value = "";
      setProfileSuccess(data.message || "Profile updated successfully.");
    } catch (error) {
      setProfileError(error.message || "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleAddStripePaymentMethod() {
    try {
      setPaymentMethodActionLoading("add_stripe");
      setPaymentMethodError("");

      const res = await axios.post("/customer/settings/payment-methods/setup-intent", {}, { headers: getAuthHeaders() });
      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to start Stripe card setup.");
      }

      const redirectUrl = res.data.redirectUrl || res.data.data?.redirectUrl || res.data.data?.url || "";
      if (redirectUrl) {
        router.push(redirectUrl);
        return;
      }

      const clientSecret = res.data.client_secret || res.data.clientSecret || res.data.data?.client_secret || res.data.data?.clientSecret || "";
      if (clientSecret) {
        router.push(`/customer/payment-methods/stripe?client_secret=${encodeURIComponent(clientSecret)}`);
        return;
      }

      await loadDashboard();
    } catch (error) {
      setPaymentMethodError(error.response?.data?.message || error.response?.data?.error || error.message || "Failed to add payment method.");
    } finally {
      setPaymentMethodActionLoading("");
    }
  }

  async function handleSetDefaultPaymentMethod(method) {
    try {
      const methodId = getPaymentMethodId(method);
      if (!methodId) throw new Error("Payment method ID is missing.");

      setPaymentMethodActionLoading(`default:${methodId}`);
      setPaymentMethodError("");

      const res = await axios.patch(`/customer/settings/payment-methods/${methodId}`, { is_default: true }, { headers: getAuthHeaders() });
      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to set default payment method.");
      }

      await loadDashboard();
    } catch (error) {
      setPaymentMethodError(error.response?.data?.message || error.response?.data?.error || error.message || "Failed to set default payment method.");
    } finally {
      setPaymentMethodActionLoading("");
    }
  }

  async function handleRemovePaymentMethod(method) {
    const methodId = getPaymentMethodId(method);
    if (!methodId) {
      alert("Payment method ID is missing.");
      return;
    }

    const confirmed = window.confirm("Remove this saved payment method? This will not affect previous payments.");
    if (!confirmed) return;

    try {
      setPaymentMethodActionLoading(`delete:${methodId}`);
      setPaymentMethodError("");

      const res = await axios.delete(`/customer/settings/payment-methods/${methodId}`, { headers: getAuthHeaders() });
      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to remove payment method.");
      }

      await loadDashboard();
    } catch (error) {
      setPaymentMethodError(error.response?.data?.message || error.response?.data?.error || error.message || "Failed to remove payment method.");
    } finally {
      setPaymentMethodActionLoading("");
    }
  }

  async function openEditBookingModal(booking) {
    setEditBooking(booking);
    setEditBookingError("");
    setEditShuttleSlots([]);
    setEditBookingForm(getInitialEditBookingForm(booking));

    if (booking.type === "cruise" || booking.type === "airport") {
      await loadBookingEditShuttleSlots(booking);
    }
  }

  async function loadBookingEditShuttleSlots(booking) {
    try {
      setEditShuttleLoading(true);
      setEditShuttleSlots([]);

      if (booking.type === "cruise") {
        const scheduleId = booking.schedule_id?._id || booking.schedule_id;

        if (!scheduleId) {
          throw new Error("Cruise schedule ID is missing.");
        }

        const res = await axios.get("/settings/shuttle-time-slots", {
          headers: getAuthHeaders(),
          params: {
            type: "cruise",
            schedule_id: scheduleId,
            departure_date: booking.start_date,
          },
        });

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
              res.data?.error ||
              "Failed to load cruise shuttle options."
          );
        }

        const rawSlots =
          res.data.data?.available_shuttle_slots ||
          res.data.data?.shuttle_time_slots ||
          [];

        setEditShuttleSlots(normalizeEditShuttleSlots(rawSlots, "cruise"));
        return;
      }

      if (booking.type === "airport") {
        const locationId = booking.location_id?._id || booking.location_id;

        if (locationId && booking.start_date) {
          const res = await axios.get("/settings/shuttle-time-slots", {
            headers: getAuthHeaders(),
            params: {
              type: "airport",
              location_id: locationId,
              date: booking.start_date,
            },
          });

          if (!res.data?.success) {
            throw new Error(
              res.data?.message ||
                res.data?.error ||
                "Failed to load airport shuttle options."
            );
          }

          const rawSlots =
            res.data.data?.available_shuttle_slots ||
            res.data.data?.shuttle_time_slots ||
            [];

          setEditShuttleSlots(normalizeEditShuttleSlots(rawSlots, "airport"));
          return;
        }
      }

      const bookingId = booking.booking_id || booking._id;

      if (!bookingId) {
        throw new Error("Booking ID is missing.");
      }

      const res = await axios.get(`/customer/bookings/${bookingId}`, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load shuttle options."
        );
      }

      const rawSlots =
        res.data.data?.shuttle_slots ||
        res.data.data?.available_shuttle_slots ||
        res.data.data?.shuttle_time_slots ||
        [];

      setEditShuttleSlots(normalizeEditShuttleSlots(rawSlots, booking.type));
    } catch (error) {
      setEditBookingError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load shuttle options."
      );
    } finally {
      setEditShuttleLoading(false);
    }
  }

  function updateEditBookingField(name, value) {
    setEditBookingForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setEditBookingError("");
  }

  function getEditDirectionShuttleSlots(directionKey) {
    const direction = cruiseEditShuttleDirections[directionKey];

    if (!direction) return [];

    return editShuttleSlots.filter(
      (slot) =>
        slot &&
        slot.type === "cruise" &&
        slot.is_active !== false &&
        slot[direction.showField] !== false
    );
  }

  function handleEditShuttleChange(slotId) {
    const selectedSlot = editShuttleSlots.find(
      (slot) => String(slot._id) === String(slotId)
    );

    setEditBookingForm((prev) => ({
      ...prev,
      shuttle_slot_id: slotId,
      shuttle_time: selectedSlot?.time || "",
    }));

    setEditBookingError("");
  }

  function handleEditCruiseDirectionPassengerChange(directionKey, value) {
    const direction = cruiseEditShuttleDirections[directionKey];
    const passengerCount = Number(value || 0);
    const directionSlots = getEditDirectionShuttleSlots(directionKey);

    if (!direction) return;

    setEditBookingForm((prev) => {
      let shouldClearShuttle = passengerCount < 1;

      if (
        passengerCount >= 1 &&
        prev[direction.slotIdField] &&
        directionSlots.length > 0
      ) {
        const selectedSlot = directionSlots.find(
          (slot) => String(getSlotId(slot)) === String(prev[direction.slotIdField])
        );

        if (selectedSlot) {
          const remaining = getEditDirectionRemaining(selectedSlot, directionKey);
          const isCurrentSelected =
            String(getSlotId(selectedSlot)) ===
            String(prev[direction.slotIdField]);

          if (!isCurrentSelected && remaining < passengerCount) {
            shouldClearShuttle = true;
          }
        } else {
          shouldClearShuttle = true;
        }
      }

      return {
        ...prev,
        [direction.passengerField]: value,
        [direction.slotIdField]: shouldClearShuttle
          ? ""
          : prev[direction.slotIdField],
        [direction.timeField]: shouldClearShuttle ? "" : prev[direction.timeField],
      };
    });

    setEditBookingError("");
  }

  function handleEditCruiseShuttleChange(directionKey, slotId) {
    const direction = cruiseEditShuttleDirections[directionKey];

    if (!direction) return;

    const directionSlots = getEditDirectionShuttleSlots(directionKey);

    const selectedSlot = directionSlots.find(
      (slot) => String(getSlotId(slot)) === String(slotId)
    );

    setEditBookingForm((prev) => ({
      ...prev,
      [direction.slotIdField]: slotId,
      [direction.timeField]: getSlotTime(selectedSlot),
    }));

    setEditBookingError("");
  }

  function closeEditBookingModal() {
    if (editBookingSaving) return;

    setEditBooking(null);
    setEditBookingError("");
    setEditShuttleSlots([]);
    setEditBookingForm(getInitialEditBookingForm());
  }

  async function submitEditBooking(event) {
    event.preventDefault();

    if (!editBooking) return;

    try {
      setEditBookingSaving(true);
      setEditBookingError("");

      const bookingId = editBooking.booking_id || editBooking._id;
      const payload = {};

      if (editBooking.type === "storage") {
        const reference = String(editBookingForm.reference || "").trim();

        if (!reference) {
          throw new Error("Reference / License Plate is required.");
        }

        payload.reference = reference;
        payload.license_plate = reference;
      } else {
        const licensePlate = String(editBookingForm.license_plate || "").trim();

        if (!licensePlate) {
          throw new Error("License plate is required.");
        }

        payload.license_plate = licensePlate;

        if (editBooking.type === "airport") {
          payload.shuttle_slot_id = editBookingForm.shuttle_slot_id;
          payload.shuttle_time = editBookingForm.shuttle_time;
        }

        if (editBooking.type === "cruise") {
          if (
            !editBookingForm.car_park_to_terminal_shuttle_slot_id ||
            !editBookingForm.car_park_to_terminal_shuttle_time
          ) {
            throw new Error("Please select Car park to terminal shuttle option.");
          }

          if (
            !editBookingForm.terminal_to_car_park_shuttle_slot_id ||
            !editBookingForm.terminal_to_car_park_shuttle_time
          ) {
            throw new Error("Please select Terminal to car park shuttle option.");
          }

          payload.shuttle_slot_id =
            editBookingForm.car_park_to_terminal_shuttle_slot_id;
          payload.shuttle_time =
            editBookingForm.car_park_to_terminal_shuttle_time;

          payload.car_park_to_terminal_shuttle_slot_id =
            editBookingForm.car_park_to_terminal_shuttle_slot_id;
          payload.car_park_to_terminal_shuttle_time =
            editBookingForm.car_park_to_terminal_shuttle_time;

          payload.terminal_to_car_park_shuttle_slot_id =
            editBookingForm.terminal_to_car_park_shuttle_slot_id;
          payload.terminal_to_car_park_shuttle_time =
            editBookingForm.terminal_to_car_park_shuttle_time;
        }
      }

      const res = await axios.patch(`/customer/bookings/${bookingId}`, payload, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to update booking."
        );
      }

      alert(res.data.message || "Booking updated successfully.");
      closeEditBookingModal();
      await loadDashboard();
    } catch (error) {
      setEditBookingError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to update booking."
      );
    } finally {
      setEditBookingSaving(false);
    }
  }

  function openTopUpModal() {
    setTopUpAmount("");
    setTopUpError("");
    setTopUpLoading("");
    setTopUpModalOpen(true);
  }

  function validateTopUpAmount() {
    const amount = Number(topUpAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Please enter a valid top-up amount.");
    if (amount < 1) throw new Error("Minimum wallet top-up amount is A$1.00.");
    if (amount > 5000) throw new Error("Maximum wallet top-up amount is A$5000.00.");
    return Number(amount.toFixed(2));
  }

  async function handleStripeTopUp() {
    try {
      const amount = validateTopUpAmount();
      setTopUpError("");
      setTopUpLoading("stripe");

      const res = await axios.post("/wallet/topup/stripe/create-intent", { amount }, { headers: getAuthHeaders() });
      if (!res.data.success) {
        throw new Error(res.data.message || res.data.error || "Failed to create Stripe wallet top-up.");
      }

      if (res.data.redirectUrl) {
        router.push(res.data.redirectUrl);
        return;
      }

      const topupId = res.data.walletTransactionId || res.data.wallet_transaction_id || res.data.data?._id;
      if (!topupId) throw new Error("Wallet top-up ID was not returned.");
      router.push(`/wallet/topup/stripe/${topupId}`);
    } catch (error) {
      setTopUpError(error.response?.data?.message || error.response?.data?.error || error.message);
    } finally {
      setTopUpLoading("");
    }
  }

  async function handlePayPalTopUp() {
    try {
      const amount = validateTopUpAmount();
      setTopUpError("");
      setTopUpLoading("paypal");

      const res = await axios.post("/wallet/topup/paypal/create-order", { amount }, { headers: getAuthHeaders() });
      if (!res.data.success) {
        throw new Error(res.data.message || res.data.error || "Failed to create PayPal wallet top-up.");
      }

      const approveUrl = res.data.approveUrl || res.data.redirectUrl;
      if (!approveUrl) throw new Error("PayPal approval URL was not returned.");
      window.location.href = approveUrl;
    } catch (error) {
      setTopUpError(error.response?.data?.message || error.response?.data?.error || error.message || "Failed to create PayPal wallet top-up.");
    } finally {
      setTopUpLoading("");
    }
  }

  function resetWithdrawForm() {
    setWithdrawAmount("");
    setWithdrawNote("");
    setWithdrawPayoutMethod("");
    setWithdrawAccountHolderName("");
    setWithdrawBankName("");
    setWithdrawBsb("");
    setWithdrawAccountNumber("");
    setWithdrawPaypalEmail("");
    setWithdrawError("");
  }

  function openWithdrawModal() {
    resetWithdrawForm();
    setWithdrawModalOpen(true);
  }

  function closeWithdrawModal() {
    if (withdrawSubmitting) return;
    setWithdrawModalOpen(false);
    resetWithdrawForm();
  }

  function validateWithdrawAmount() {
    const amount = Number(withdrawAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Please enter a valid withdrawal amount.");
    if (amount < 1) throw new Error("Minimum withdrawal amount is A$1.00.");
    if (amount > walletBalance) throw new Error("Withdrawal amount cannot be greater than wallet balance.");
    return Number(amount.toFixed(2));
  }

  async function submitWithdrawRequest(event) {
    event.preventDefault();

    try {
      const amount = validateWithdrawAmount();
      if (!withdrawPayoutMethod) throw new Error("Please select payout method.");

      if (withdrawPayoutMethod === "bank_transfer") {
        if (!withdrawAccountHolderName.trim()) throw new Error("Account holder name is required.");
        if (!withdrawBankName.trim()) throw new Error("Bank name is required.");
        if (!withdrawBsb.trim()) throw new Error("BSB / routing number is required.");
        if (!withdrawAccountNumber.trim()) throw new Error("Account number is required.");
      }

      if (withdrawPayoutMethod === "paypal" && !withdrawPaypalEmail.trim()) throw new Error("PayPal email is required.");
      if (["cash", "other"].includes(withdrawPayoutMethod) && !withdrawNote.trim()) throw new Error("Please add a note for this payout method.");

      setWithdrawSubmitting(true);
      setWithdrawError("");

      const res = await axios.post(
        "/customer/wallet/withdraw-request",
        {
          amount,
          note: withdrawNote,
          payout_method: withdrawPayoutMethod,
          account_holder_name: withdrawAccountHolderName,
          bank_name: withdrawBankName,
          bsb: withdrawBsb,
          account_number: withdrawAccountNumber,
          paypal_email: withdrawPaypalEmail,
        },
        { headers: getAuthHeaders() }
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to submit withdrawal request.");
      }

      alert(res.data.message || "Withdrawal request submitted successfully.");
      setWithdrawModalOpen(false);
      resetWithdrawForm();
      await loadDashboard();
      setActiveTab("withdraw");
    } catch (error) {
      setWithdrawError(error.response?.data?.message || error.response?.data?.error || error.message || "Failed to submit withdrawal request.");
    } finally {
      setWithdrawSubmitting(false);
    }
  }

  function resetSupportTicketForm() {
    setSupportTicketForm({ booking_id: "", message: "" });
    setSupportTicketError("");
    setSupportTicketSuccess("");
  }

  function openSupportTicketModal(defaultBookingId = "") {
    resetSupportTicketForm();
    setSupportTicketForm((prev) => ({ ...prev, booking_id: defaultBookingId || "" }));
    setSupportTicketModalOpen(true);
  }

  function closeSupportTicketModal() {
    if (supportTicketSubmitting) return;
    setSupportTicketModalOpen(false);
    resetSupportTicketForm();
  }

  function updateSupportTicketField(name, value) {
    setSupportTicketForm((prev) => ({ ...prev, [name]: value }));
    setSupportTicketError("");
    setSupportTicketSuccess("");
  }

  async function submitSupportTicket(event) {
    event.preventDefault();

    try {
      const message = String(supportTicketForm.message || "").trim();
      if (message.length < 5) throw new Error("Please write your support message.");
      if (!user?.name || !user?.email || !user?.phone) {
        throw new Error("Your profile name, email, and phone are required before submitting a ticket.");
      }

      setSupportTicketSubmitting(true);
      setSupportTicketError("");
      setSupportTicketSuccess("");

      const res = await axios.post(
        "/support/tickets",
        {
          name: user.name,
          email: user.email,
          phone: user.phone,
          booking_id: supportTicketForm.booking_id,
          message,
        },
        { headers: getAuthHeaders() }
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || res.data?.error || "Failed to submit support ticket.");
      }

      const ticketId = res.data.data?.ticket?.ticket_id || "";
      setSupportTicketSuccess(ticketId ? `Support ticket submitted. Ticket ID: ${ticketId}` : "Support ticket submitted successfully.");

      await loadSupportTickets();
      setSupportTicketForm({ booking_id: "", message: "" });

      setTimeout(() => {
        setSupportTicketModalOpen(false);
        setSupportTicketSuccess("");
      }, 1000);
    } catch (error) {
      setSupportTicketError(error.response?.data?.message || error.response?.data?.error || error.message || "Failed to submit support ticket.");
    } finally {
      setSupportTicketSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-6xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-lg font-semibold text-gray-900">Loading dashboard...</p>
          <p className="mt-2 text-sm text-gray-500">Please wait while we load your bookings and other details.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 p-5">
                  {profileImageUrl ? (
                    <img src={profileImageUrl} alt={user?.name || "Customer"} className="h-14 w-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white">
                      {(user?.name || "C").slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <h2 className="mt-4 text-lg font-bold text-gray-950">{user?.name || "Customer"}</h2>
                  <p className="mt-1 break-all text-sm text-gray-500">{user?.email || "-"}</p>
                  {user?.phone && <p className="mt-1 text-sm text-gray-500">{user.phone}</p>}
                </div>

                <nav className="space-y-2 p-3">
                  {dashboardTabs.map((tab) => {
                    if (tab.children?.length) {
                      const groupActive = tab.children.some((child) => child.id === activeTab);
                      return (
                        <div key={tab.id} className="rounded-2xl bg-gray-50 p-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab(tab.children[0].id)}
                            className={`w-full rounded-xl px-3 py-3 text-left transition ${
                              groupActive ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            <span className="block text-sm font-bold">{tab.label}</span>
                            <span className={`mt-0.5 block text-xs ${groupActive ? "text-blue-100" : "text-gray-500"}`}>
                              {tab.description}
                            </span>
                          </button>

                          <div className="mt-2 space-y-1">
                            {tab.children.map((child) => {
                              const childActive = activeTab === child.id;
                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => setActiveTab(child.id)}
                                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                                    childActive ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:bg-white"
                                  }`}
                                >
                                  {child.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                          isActive ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <span className="block text-sm font-bold">{tab.label}</span>
                        <span className={`mt-0.5 block text-xs ${isActive ? "text-blue-100" : "text-gray-500"}`}>{tab.description}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="border-t border-gray-100 p-3">
                  {/* <button type="button" onClick={() => router.push("/booking")} className="w-full rounded-2xl bg-gray-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800">
                    New Booking
                  </button> */}
                  <button type="button" onClick={handleLogout} className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-800 transition hover:bg-gray-50">
                    Logout
                  </button>
                </div>
              </div>
            </aside>

            <section className="min-w-0">
              {activeTab === "dashboard" && (
                <div className="space-y-6">
                  <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                    <div className="relative p-6 md:p-8">
                      <div className="absolute right-0 top-0 h-36 w-36 rounded-bl-full bg-blue-50" />
                      <div className="absolute bottom-0 right-20 h-24 w-24 rounded-t-full bg-green-50" />

                      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Customer Dashboard</p>
                          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-950 md:text-4xl">Welcome, {user?.name || "Customer"}</h1>
                          <p className="mt-3 max-w-2xl text-base text-gray-600">Here are your booking, wallet, payment, and support details.</p>
                          <p className="mt-3 text-sm text-gray-500">{user?.email} {user?.phone ? `• ${user.phone}` : ""}</p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {/* <button type="button" onClick={() => router.push("/booking")} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
                            New Booking
                          </button> */}
                          <button type="button" onClick={() => setActiveTab("support_tickets")} className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100">
                            Support Tickets
                          </button>
                          <button type="button" onClick={() => setActiveTab("profile")} className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-800 transition hover:bg-gray-50">
                            Edit Profile
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md xl:col-span-2">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Wallet Balance</p>
                          <p className="mt-3 text-4xl font-extrabold tracking-tight text-gray-950">{money(walletBalance)}</p>
                          <p className="mt-2 text-sm text-gray-500">Status: {formatWalletStatus(walletStatus)}</p>
                        </div>
                        <div className="flex flex-col gap-3">
                          <button type="button" onClick={openTopUpModal} disabled={!walletIsActive} className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">
                            Top Up Wallet
                          </button>
                          <button type="button" onClick={openWithdrawModal} disabled={!walletIsActive || walletBalance <= 0} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                            Withdraw Request
                          </button>
                        </div>
                      </div>
                      {!walletIsActive && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Your wallet is not active. Please contact support.</div>}
                    </div>

                    <SummaryCard title="Total Bookings" value={stats.totalBookings} />
                    <SummaryCard title="Upcoming" value={stats.upcomingBookings} />
                    <SummaryCard title="Paid Bookings" value={stats.paidBookings} subtitle={`${stats.partialDepositBookings} partial deposits`} />
                    <SummaryCard title="Support Tickets" value={supportStats.total} subtitle={`${supportStats.open} open, ${supportStats.replied} replied`} />
                    <SummaryCard title="Total Due" value={money(stats.dueAmount)} />
                  </div>
                </div>
              )}

              {activeTab === "support_tickets" && (
                <SupportTicketsPanel
                  supportStats={supportStats}
                  supportTickets={supportTickets}
                  supportTicketsError={supportTicketsError}
                  supportTicketsLoading={supportTicketsLoading}
                  loadSupportTickets={loadSupportTickets}
                  openSupportTicketModal={openSupportTicketModal}
                  setSupportTicketView={setSupportTicketView}
                />
              )}

              {activeTab === "profile" && (
                <ProfilePanel
                  profileForm={profileForm}
                  profileImagePreview={profileImagePreview}
                  profileImageInputRef={profileImageInputRef}
                  profileSaving={profileSaving}
                  profileError={profileError}
                  profileSuccess={profileSuccess}
                  user={user}
                  handleProfileFieldChange={handleProfileFieldChange}
                  handleProfileImageChange={handleProfileImageChange}
                  submitProfileUpdate={submitProfileUpdate}
                  loadDashboard={loadDashboard}
                />
              )}

              {activeTab === "payment_methods" && (
                <PaymentMethodsPanel
                  paymentMethods={paymentMethods}
                  paymentMethodError={paymentMethodError}
                  paymentMethodActionLoading={paymentMethodActionLoading}
                  handleAddStripePaymentMethod={handleAddStripePaymentMethod}
                  handleSetDefaultPaymentMethod={handleSetDefaultPaymentMethod}
                  handleRemovePaymentMethod={handleRemovePaymentMethod}
                />
              )}

              {activeTab === "bookings" && (
                <BookingsPanel
                  bookings={bookings}
                  loadDashboard={loadDashboard}
                  handleViewBooking={handleViewBooking}
                  openEditBookingModal={openEditBookingModal}
                  handlePayNow={handlePayNow}
                  openCancelRequestModal={openCancelRequestModal}
                />
              )}

              {activeTab === "wallet" && (
                <WalletTransactionsPanel walletTransactions={walletTransactions} loadDashboard={loadDashboard} />
              )}

              {activeTab === "withdraw" && (
                <WithdrawPanel
                  withdrawalRequests={withdrawalRequests}
                  walletBalance={walletBalance}
                  pendingWithdrawalTotal={pendingWithdrawalTotal}
                  walletStatus={walletStatus}
                  walletIsActive={walletIsActive}
                  loadDashboard={loadDashboard}
                  openWithdrawModal={openWithdrawModal}
                />
              )}

              {activeTab === "payments" && (
                <PaymentsPanel paymentTransactions={paymentTransactions} loadDashboard={loadDashboard} />
              )}
            </section>
          </div>
        </div>

        {viewBooking && (
          <BookingDetailsModal
            booking={viewBooking}
            onClose={() => setViewBooking(null)}
          />
        )}

        {supportTicketView && (
          <SupportTicketViewModal ticket={supportTicketView} onClose={() => setSupportTicketView(null)} />
        )}

        {supportTicketModalOpen && (
          <SupportTicketCreateModal
            supportTicketForm={supportTicketForm}
            supportTicketSubmitting={supportTicketSubmitting}
            supportTicketError={supportTicketError}
            supportTicketSuccess={supportTicketSuccess}
            updateSupportTicketField={updateSupportTicketField}
            submitSupportTicket={submitSupportTicket}
            closeSupportTicketModal={closeSupportTicketModal}
          />
        )}

        {editBooking && (
          <EditBookingModal
            editBooking={editBooking}
            editBookingForm={editBookingForm}
            editBookingSaving={editBookingSaving}
            editBookingError={editBookingError}
            editShuttleLoading={editShuttleLoading}
            editShuttleSlots={editShuttleSlots}
            updateEditBookingField={updateEditBookingField}
            handleEditShuttleChange={handleEditShuttleChange}
            handleEditCruiseDirectionPassengerChange={
              handleEditCruiseDirectionPassengerChange
            }
            handleEditCruiseShuttleChange={handleEditCruiseShuttleChange}
            closeEditBookingModal={closeEditBookingModal}
            submitEditBooking={submitEditBooking}
          />
        )}

        {topUpModalOpen && (
          <TopUpModal
            topUpAmount={topUpAmount}
            topUpLoading={topUpLoading}
            topUpError={topUpError}
            setTopUpAmount={setTopUpAmount}
            setTopUpError={setTopUpError}
            setTopUpModalOpen={setTopUpModalOpen}
            handleStripeTopUp={handleStripeTopUp}
            handlePayPalTopUp={handlePayPalTopUp}
          />
        )}

        {withdrawModalOpen && (
          <WithdrawModal
            walletBalance={walletBalance}
            withdrawAmount={withdrawAmount}
            withdrawNote={withdrawNote}
            withdrawPayoutMethod={withdrawPayoutMethod}
            withdrawAccountHolderName={withdrawAccountHolderName}
            withdrawBankName={withdrawBankName}
            withdrawBsb={withdrawBsb}
            withdrawAccountNumber={withdrawAccountNumber}
            withdrawPaypalEmail={withdrawPaypalEmail}
            withdrawSubmitting={withdrawSubmitting}
            withdrawError={withdrawError}
            setWithdrawAmount={setWithdrawAmount}
            setWithdrawNote={setWithdrawNote}
            setWithdrawPayoutMethod={setWithdrawPayoutMethod}
            setWithdrawAccountHolderName={setWithdrawAccountHolderName}
            setWithdrawBankName={setWithdrawBankName}
            setWithdrawBsb={setWithdrawBsb}
            setWithdrawAccountNumber={setWithdrawAccountNumber}
            setWithdrawPaypalEmail={setWithdrawPaypalEmail}
            setWithdrawError={setWithdrawError}
            closeWithdrawModal={closeWithdrawModal}
            submitWithdrawRequest={submitWithdrawRequest}
          />
        )}

        {cancelModalBooking && (
          <CancelRequestModal
            cancelModalBooking={cancelModalBooking}
            cancellationReason={cancellationReason}
            cancelSubmitting={cancelSubmitting}
            setCancellationReason={setCancellationReason}
            closeCancelRequestModal={closeCancelRequestModal}
            submitCancellationRequest={submitCancellationRequest}
          />
        )}
      </main>

      <Footer />
    </>
  );
}

function SupportTicketsPanel({ supportStats, supportTickets, supportTicketsError, supportTicketsLoading, loadSupportTickets, openSupportTicketModal, setSupportTicketView }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <SectionHeader
        title="Support Tickets"
        subtitle="View your submitted support requests and admin replies."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => loadSupportTickets()} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
              Refresh
            </button>
            <button type="button" onClick={() => openSupportTicketModal()} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
              New Support Ticket
            </button>
          </div>
        }
      />

      <div className="grid gap-4 border-b border-gray-100 p-6 md:grid-cols-4">
        <SummaryCard title="All Tickets" value={supportStats.total} />
        <SummaryCard title="Open" value={supportStats.open} />
        <SummaryCard title="In Progress" value={supportStats.inProgress} />
        <SummaryCard title="Replied" value={supportStats.replied} />
      </div>

      {supportTicketsError && <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{supportTicketsError}</div>}

      {supportTicketsLoading ? (
        <div className="p-8 text-sm font-semibold text-gray-600">Loading support tickets...</div>
      ) : supportTickets.length === 0 ? (
        <EmptyState message="No support tickets yet. Submit a ticket if you need help from admin." />
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3 whitespace-nowrap">Ticket</th>
                <th className="px-3 py-3 whitespace-nowrap">Booking ID</th>
                <th className="px-3 py-3 whitespace-nowrap">Message</th>
                <th className="px-3 py-3 whitespace-nowrap">Status</th>
                <th className="px-3 py-3 whitespace-nowrap">Priority</th>
                <th className="px-3 py-3 whitespace-nowrap">Admin Reply</th>
                <th className="px-3 py-3 whitespace-nowrap">Created</th>
                <th className="px-3 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {supportTickets.map((ticket) => (
                <tr key={ticket._id || ticket.ticket_id} className="align-top">
                  <td className="px-3 py-3 font-bold text-gray-950 whitespace-nowrap">{ticket.ticket_id}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{ticket.booking_id || "-"}</td>
                  <td className="px-3 py-3"><p className="max-w-[220px] text-gray-700">{getSupportTicketMessagePreview(ticket)}</p></td>
                  <td className="px-3 py-3"><StatusBadge value={formatStatus(ticket.status)} className={getSupportStatusClass(ticket.status)} /></td>
                  <td className="px-3 py-3"><StatusBadge value={formatPriority(ticket.priority)} className={getPriorityClass(ticket.priority)} /></td>
                  <td className="px-3 py-3"><p className="max-w-[220px] whitespace-pre-wrap text-gray-600">{ticket.admin_reply || "-"}</p></td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-600">{formatDateTime(ticket.createdAt)}</td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => setSupportTicketView(ticket)} className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProfilePanel({ profileForm, profileImagePreview, profileImageInputRef, profileSaving, profileError, profileSuccess, user, handleProfileFieldChange, handleProfileImageChange, submitProfileUpdate, loadDashboard }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <SectionHeader
        title="Profile Settings"
        subtitle="Update your customer profile details and profile image."
        action={<button type="button" onClick={loadDashboard} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Refresh</button>}
      />
      <form onSubmit={submitProfileUpdate} className="p-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div>
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5 text-center">
              {profileImagePreview ? (
                <img src={profileImagePreview} alt={profileForm.name || "Profile"} className="mx-auto h-32 w-32 rounded-3xl object-cover" />
              ) : (
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-3xl bg-blue-600 text-4xl font-bold text-white">
                  {(profileForm.name || "C").slice(0, 1).toUpperCase()}
                </div>
              )}
              <label className="mt-4 block">
                <span className="inline-block cursor-pointer rounded-2xl bg-gray-950 px-4 py-3 text-sm font-bold text-white">Upload Image</span>
                <input ref={profileImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onClick={(event) => { event.currentTarget.value = ""; }} onChange={handleProfileImageChange} className="hidden" />
              </label>
              <p className="mt-3 text-xs text-gray-500">JPG, PNG, or WEBP. Maximum 2MB.</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-700">Name</label>
              <input type="text" value={profileForm.name} onChange={(event) => handleProfileFieldChange("name", event.target.value)} className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" required />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Email</label>
              <input type="email" value={user?.email || ""} readOnly className="mt-2 w-full cursor-not-allowed rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500" />
              <p className="mt-2 text-xs text-gray-500">Email is used for login. Changing email should be handled with verification.</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Phone</label>
              <input type="text" value={profileForm.phone} onChange={(event) => handleProfileFieldChange("phone", event.target.value)} className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" required />
            </div>
            {profileError && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{profileError}</div>}
            {profileSuccess && <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{profileSuccess}</div>}
            <div className="flex justify-end border-t border-gray-100 pt-5">
              <button type="submit" disabled={profileSaving} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
                {profileSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function PaymentMethodsPanel({ paymentMethods, paymentMethodError, paymentMethodActionLoading, handleAddStripePaymentMethod, handleSetDefaultPaymentMethod, handleRemovePaymentMethod }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <SectionHeader
        title="Payment Method"
        subtitle="Save cards securely with Stripe."
        action={
          <button type="button" onClick={handleAddStripePaymentMethod} disabled={Boolean(paymentMethodActionLoading)} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {paymentMethodActionLoading === "add_stripe" ? "Preparing..." : "Add Stripe Card"}
          </button>
        }
      />
      {paymentMethodError && <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{paymentMethodError}</div>}
      {paymentMethods.length === 0 ? (
        <EmptyState message="No saved payment methods yet. Add a Stripe card to use it for future bookings." />
      ) : (
        <div className="grid gap-4 p-6 md:grid-cols-2">
          {paymentMethods.map((method) => {
            const methodId = getPaymentMethodId(method);
            const isDefault = Boolean(method.is_default);
            const isActive = method.is_active !== false;
            return (
              <div key={methodId} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-gray-950">{getPaymentMethodTitle(method)}</p>
                    <p className="mt-1 text-sm text-gray-500">{getPaymentMethodSubtitle(method)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge value={isActive ? "Active" : "Inactive"} className={isActive ? "bg-green-50 text-green-700 ring-green-200" : "bg-gray-100 text-gray-600 ring-gray-200"} />
                      {isDefault && <StatusBadge value="Default" className="bg-blue-50 text-blue-700 ring-blue-200" />}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gray-950 px-3 py-2 text-xs font-bold uppercase text-white">{method.provider || "card"}</div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  {!isDefault && (
                    <button type="button" onClick={() => handleSetDefaultPaymentMethod(method)} disabled={Boolean(paymentMethodActionLoading)} className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60">
                      {paymentMethodActionLoading === `default:${methodId}` ? "Saving..." : "Set Default"}
                    </button>
                  )}
                  <button type="button" onClick={() => handleRemovePaymentMethod(method)} disabled={Boolean(paymentMethodActionLoading)} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
                    {paymentMethodActionLoading === `delete:${methodId}` ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookingsPanel({ bookings, loadDashboard, handleViewBooking, openEditBookingModal, handlePayNow, openCancelRequestModal }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <SectionHeader title="My Bookings" subtitle="View booking status, payments, due amount, and cancellation actions." action={<button type="button" onClick={loadDashboard} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Refresh</button>} />
      {bookings.length === 0 ? (
        <EmptyState message="You do not have any bookings yet." />
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3 whitespace-nowrap">Booking</th>
                <th className="px-3 py-3 whitespace-nowrap">Details</th>
                <th className="px-3 py-3 whitespace-nowrap">Dates</th>
                <th className="px-3 py-3 whitespace-nowrap">Status</th>
                <th className="px-3 py-3 whitespace-nowrap">Payment</th>
                <th className="px-3 py-3 whitespace-nowrap">Amount</th>
                <th className="px-3 py-3 whitespace-nowrap">Note</th>
                <th className="px-3 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((booking) => (
                <tr key={booking._id} className="align-top">
                  <td className="px-3 py-3"><p className="font-bold text-gray-950 whitespace-nowrap">{booking.booking_id}</p><p className="mt-1 capitalize text-gray-500">{booking.type}</p></td>
                  <td className="px-3 py-3"><p className="font-semibold text-gray-900">{getBookingTitle(booking)}</p><p className="mt-1 max-w-[220px] text-gray-500">{getBookingSubDetails(booking)}</p></td>
                  <td className="px-3 py-3 whitespace-nowrap"><p className="text-gray-700">{formatDate(booking.start_date)}</p><p className="mt-1 text-gray-500">to {formatDate(booking.end_date)}</p></td>
                  <td className="px-3 py-3"><StatusBadge value={formatStatus(booking.status)} className={getStatusClass(booking.status)} /></td>
                  <td className="px-3 py-3"><p className="font-semibold text-gray-900 whitespace-nowrap">{formatPaymentMethod(booking.payment_method)}</p><p className="mt-1 text-gray-500 whitespace-nowrap">{formatPaymentFlow(booking.payment_flow)}</p><div className="mt-2"><StatusBadge value={formatPaymentStatus(booking.payment_status)} className={getPaymentStatusClass(booking.payment_status)} /></div></td>
                  <td className="px-3 py-3 whitespace-nowrap"><p className="font-bold text-gray-950">{money(booking.price)}</p><p className="mt-1 text-green-700">Paid: {money(booking.paid_amount)}</p><p className="mt-1 text-red-700">Due: {money(booking.due_amount)}</p></td>
                  <td className="px-3 py-3"><p className="max-w-[180px] text-gray-600">{getPaymentNote(booking)}</p></td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => handleViewBooking(booking)} className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap">View</button>
                      {canCustomerEditBooking(booking) && <button type="button" onClick={() => openEditBookingModal(booking)} className="rounded-xl border border-blue-200 px-3 py-2 font-bold text-blue-700 hover:bg-blue-50 whitespace-nowrap">Edit</button>}
                      {isPayNowAvailable(booking) && <button type="button" onClick={() => handlePayNow(booking)} className="rounded-xl bg-blue-600 px-3 py-2 font-bold text-white hover:bg-blue-700 whitespace-nowrap">{booking.payment_method === "paypal" ? "Pay PayPal" : isPoaDepositBooking(booking) ? "Pay Deposit" : "Pay Now"}</button>}
                      {canCustomerRequestCancel(booking) && <button type="button" onClick={() => openCancelRequestModal(booking)} className="rounded-xl bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-700 whitespace-nowrap">Cancel</button>}
                      {isCancellationSubmitted(booking) && <button type="button" disabled className="cursor-not-allowed rounded-xl bg-orange-100 px-3 py-2 font-bold text-orange-700 whitespace-nowrap">Submitted</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WalletTransactionsPanel({ walletTransactions, loadDashboard }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <SectionHeader title="Wallet Transactions" subtitle="Recent top-ups, wallet payments, refunds, and wallet activity." action={<button type="button" onClick={loadDashboard} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Refresh</button>} />
      {walletTransactions.length === 0 ? (
        <EmptyState message="No wallet transactions yet." />
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3 whitespace-nowrap">Date</th><th className="px-3 py-3 whitespace-nowrap">Type</th><th className="px-3 py-3 whitespace-nowrap">Method</th><th className="px-3 py-3 whitespace-nowrap">Direction</th><th className="px-3 py-3 whitespace-nowrap">Amount</th><th className="px-3 py-3 whitespace-nowrap">Balance After</th><th className="px-3 py-3 whitespace-nowrap">Status</th><th className="px-3 py-3 whitespace-nowrap">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {walletTransactions.map((transaction) => (
                <tr key={transaction._id} className="align-top">
                  <td className="px-3 py-3 whitespace-nowrap">{formatDate(transaction.createdAt)}</td>
                  <td className="px-3 py-3 font-semibold text-gray-900 whitespace-nowrap">{formatWalletTransactionType(transaction.type)}</td>
                  <td className="px-3 py-3 capitalize whitespace-nowrap">{formatPaymentMethod(transaction.method)}</td>
                  <td className="px-3 py-3 capitalize whitespace-nowrap">{transaction.direction || "-"}</td>
                  <td className={`px-3 py-3 font-bold whitespace-nowrap ${transaction.direction === "credit" ? "text-green-700" : "text-red-700"}`}>{transaction.direction === "credit" ? "+" : "-"}{money(transaction.amount)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{money(transaction.balance_after)}</td>
                  <td className="px-3 py-3"><StatusBadge value={formatStatus(transaction.status)} className={getWalletTransactionStatusClass(transaction.status)} /></td>
                  <td className="px-3 py-3 text-gray-600 max-w-[140px]">{transaction.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WithdrawPanel({ withdrawalRequests, walletBalance, pendingWithdrawalTotal, walletStatus, walletIsActive, loadDashboard, openWithdrawModal }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <SectionHeader
        title="Withdraw Request"
        subtitle="Request a wallet payout and track pending, accepted, or rejected requests."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadDashboard} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Refresh</button>
            <button type="button" onClick={openWithdrawModal} disabled={!walletIsActive || walletBalance <= 0} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">New Withdraw Request</button>
          </div>
        }
      />
      <div className="grid gap-4 border-b border-gray-100 p-6 md:grid-cols-3">
        <SummaryCard title="Wallet Balance" value={money(walletBalance)} />
        <SummaryCard title="Pending Withdrawal" value={money(pendingWithdrawalTotal)} />
        <SummaryCard title="Wallet Status" value={formatWalletStatus(walletStatus)} />
      </div>
      {withdrawalRequests.length === 0 ? (
        <EmptyState message="You do not have any withdrawal requests yet." />
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3 whitespace-nowrap">Reference</th><th className="px-3 py-3 whitespace-nowrap">Date</th><th className="px-3 py-3 whitespace-nowrap">Amount</th><th className="px-3 py-3 whitespace-nowrap">Payout Details</th><th className="px-3 py-3 whitespace-nowrap">Balance</th><th className="px-3 py-3 whitespace-nowrap">Status</th><th className="px-3 py-3 whitespace-nowrap">Proof / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {withdrawalRequests.map((transaction) => {
                const adminProofText = getAdminProofText(transaction);
                return (
                  <tr key={transaction._id} className="align-top">
                    <td className="px-3 py-3 font-bold text-gray-950 whitespace-nowrap">{transaction.transaction_reference || "-"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(transaction.createdAt)}</td>
                    <td className="px-3 py-3 font-bold text-red-700 whitespace-nowrap">-{money(transaction.amount)}</td>
                    <td className="px-3 py-3"><pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-2 leading-5 text-gray-700 max-w-[160px]">{getPayoutDetailsText(transaction)}</pre></td>
                    <td className="px-3 py-3 whitespace-nowrap"><p className="text-gray-500">Before: {money(transaction.balance_before)}</p><p className="mt-1 text-gray-700">After: {money(transaction.balance_after)}</p></td>
                    <td className="px-3 py-3"><StatusBadge value={formatWithdrawalStatus(transaction.status)} className={getWalletTransactionStatusClass(transaction.status)} />{transaction.type === "withdrawal_paid" && <p className="mt-2 font-semibold text-green-700 whitespace-nowrap">Paid manually</p>}</td>
                    <td className="px-3 py-3 text-gray-600">{adminProofText ? <pre className="whitespace-pre-wrap rounded-xl bg-green-50 p-2 leading-5 text-green-700 max-w-[160px]">{adminProofText}</pre> : transaction.note || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentsPanel({ paymentTransactions, loadDashboard }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <SectionHeader title="Payment Transactions" subtitle="Booking payments made by Stripe, PayPal, Wallet, and POA deposits." action={<button type="button" onClick={loadDashboard} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Refresh</button>} />
      {paymentTransactions.length === 0 ? (
        <EmptyState message="No payment transactions yet." />
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3 whitespace-nowrap">Date</th><th className="px-3 py-3 whitespace-nowrap">Booking ID</th><th className="px-3 py-3 whitespace-nowrap">Type</th><th className="px-3 py-3 whitespace-nowrap">Purpose</th><th className="px-3 py-3 whitespace-nowrap">Flow</th><th className="px-3 py-3 whitespace-nowrap">Method</th><th className="px-3 py-3 whitespace-nowrap">Amount</th><th className="px-3 py-3 whitespace-nowrap">Status</th><th className="px-3 py-3 whitespace-nowrap">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paymentTransactions.map((payment) => (
                <tr key={payment._id} className="align-top">
                  <td className="px-3 py-3 whitespace-nowrap">{formatDate(payment.createdAt)}</td>
                  <td className="px-3 py-3 font-semibold text-gray-900 whitespace-nowrap">{payment.booking_id?.booking_id || "-"}</td>
                  <td className="px-3 py-3 capitalize whitespace-nowrap">{payment.booking_id?.type || "-"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatPaymentPurpose(payment.payment_purpose)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatPaymentFlow(payment.payment_flow)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatPaymentMethod(payment.method)}</td>
                  <td className="px-3 py-3 font-bold text-gray-950 whitespace-nowrap">{money(payment.amount)}<span className="ml-1 uppercase text-gray-400">{payment.currency || "aud"}</span></td>
                  <td className="px-3 py-3"><StatusBadge value={formatPaymentStatus(payment.status)} className={getPaymentStatusClass(payment.status)} /></td>
                  <td className="max-w-[160px] break-all px-3 py-3 text-gray-600">{getPaymentProviderReference(payment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function getSuccessViewFirstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function getSuccessViewStorageTypeName(booking) {
  const storage = booking?.details?.storage || {};

  return (
    storage.storage_type_name ||
    storage.storage_type ||
    storage.storage_type_id?.name ||
    "-"
  );
}

function getSuccessViewLicensePlateText(booking) {
  if (!booking) return "-";

  if (booking.type === "storage") {
    return booking.reference || booking.license_plate || "-";
  }

  return booking.license_plate || "-";
}

function getSuccessViewVehicleLabel(booking) {
  if (!booking) return "Vehicle";

  if (booking.type === "storage") {
    return "Vehicle Type";
  }

  if (["cruise", "airport"].includes(booking.type)) {
    return "License Plate";
  }

  return "Vehicle";
}

function getSuccessViewCruiseAddOnVehicle(booking) {
  if (!booking || booking.type !== "cruise") {
    return {
      enabled: false,
      type: "",
      licensePlate: "",
      licensePlateLabel: "Selected Vehicle License Plate",
    };
  }

  const addOnVehicle = booking?.details?.cruise?.add_on_vehicle || {};

  const enabled = Boolean(
    booking?.add_on_vehicle_enabled ?? addOnVehicle.enabled
  );

  const type = String(
    getSuccessViewFirstValue(
      booking?.add_on_vehicle_type,
      addOnVehicle.type,
      ""
    ) || ""
  ).trim();

  const licensePlate = String(
    getSuccessViewFirstValue(
      booking?.add_on_vehicle_license_plate,
      addOnVehicle.license_plate,
      ""
    ) || ""
  ).trim();

  const hasAddOnVehicle = enabled && Boolean(type || licensePlate);

  return {
    enabled: hasAddOnVehicle,
    type,
    licensePlate,
    licensePlateLabel: `${type || "Selected Vehicle"} License Plate`,
  };
}

function hasSuccessViewCruiseAddOnVehicle(booking) {
  return getSuccessViewCruiseAddOnVehicle(booking).enabled;
}

function getSuccessViewCruiseAddOnVehicleName(booking) {
  return getSuccessViewCruiseAddOnVehicle(booking).type || "-";
}

function getSuccessViewCruiseAddOnVehicleLicensePlate(booking) {
  return getSuccessViewCruiseAddOnVehicle(booking).licensePlate || "-";
}

function getSuccessViewCruiseAddOnVehicleLicensePlateLabel(booking) {
  return getSuccessViewCruiseAddOnVehicle(booking).licensePlateLabel;
}

function getSuccessViewCruiseCarParkPassengers(booking) {
  return getSuccessViewFirstValue(
    booking?.details?.cruise?.car_park_to_terminal_passengers,
    booking?.car_park_to_terminal_passengers,
    booking?.details?.cruise?.pickup_pax,
    booking?.pax,
    0
  );
}

function getSuccessViewCruiseCarParkTime(booking) {
  return (
    getSuccessViewFirstValue(
      booking?.details?.cruise?.car_park_to_terminal_shuttle_time,
      booking?.car_park_to_terminal_shuttle_time,
      booking?.details?.cruise?.shuttle_time,
      booking?.shuttle_time
    ) || "-"
  );
}

function getSuccessViewCruiseTerminalPassengers(booking) {
  return getSuccessViewFirstValue(
    booking?.details?.cruise?.terminal_to_car_park_passengers,
    booking?.terminal_to_car_park_passengers,
    0
  );
}

function getSuccessViewCruiseTerminalTime(booking) {
  return (
    getSuccessViewFirstValue(
      booking?.details?.cruise?.terminal_to_car_park_shuttle_time,
      booking?.terminal_to_car_park_shuttle_time
    ) || "-"
  );
}

function getSuccessViewWalletReference(booking) {
  const walletTransaction =
    booking?.wallet_transaction_id ||
    booking?.wallet_transaction ||
    booking?.walletTransaction;

  if (walletTransaction) {
    if (typeof walletTransaction === "string") {
      return walletTransaction;
    }

    return (
      walletTransaction.transaction_reference ||
      walletTransaction.transaction_id ||
      walletTransaction.reference ||
      walletTransaction._id ||
      "-"
    );
  }

  return (
    booking?.wallet_transaction_reference ||
    booking?.wallet_reference ||
    booking?.transaction_reference ||
    booking?.transaction_id ||
    booking?.reference ||
    "-"
  );
}

function getSuccessViewPaymentReferenceLabel(booking) {
  const method = booking?.payment_method;

  if (method === "stripe") return "Stripe Reference";
  if (method === "paypal") return "PayPal Reference";
  if (method === "wallet") return "Wallet Reference";

  return "Payment Reference";
}

function getSuccessViewPaymentReferenceValue(booking) {
  const method = booking?.payment_method;

  if (method === "stripe") {
    return (
      booking?.stripe_payment_intent_id ||
      booking?.payment_intent_id ||
      booking?.payment_reference ||
      booking?.transaction_id ||
      "-"
    );
  }

  if (method === "paypal") {
    return (
      booking?.paypal_capture_id ||
      booking?.paypal_order_id ||
      booking?.payment_capture_id ||
      booking?.payment_order_id ||
      booking?.payment_reference ||
      booking?.transaction_id ||
      "-"
    );
  }

  if (method === "wallet") {
    return getSuccessViewWalletReference(booking);
  }

  return (
    booking?.payment_reference ||
    booking?.manual_payment_reference ||
    booking?.transaction_reference ||
    booking?.transaction_id ||
    booking?.reference ||
    "-"
  );
}

function SuccessViewDetailRow({ label, value, highlight = false }) {
  return (
    <tr className={highlight ? "bg-blue-50" : ""}>
      <td className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-600">
        {label}
      </td>

      <td className="break-all border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-950">
        {value === undefined || value === null || value === "" ? "-" : value}
      </td>
    </tr>
  );
}

function BookingDetailsModal({ booking, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const poaDeposit = isPoaDepositBooking(booking);
  const formattedBookingStatus = formatStatus(booking?.status);
  const paymentReferenceLabel =
    getSuccessViewPaymentReferenceLabel(booking);
  const paymentReferenceValue =
    getSuccessViewPaymentReferenceValue(booking);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-indigo-500">
              Booking Details
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Booking ID: <strong>{booking?.booking_id || "-"}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="p-6">
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <table className="w-full border-collapse">
              <tbody>
                <SuccessViewDetailRow
                  label="Booking ID"
                  value={booking?.booking_id}
                  highlight
                />

                <SuccessViewDetailRow
                  label={paymentReferenceLabel || "Payment Reference"}
                  value={paymentReferenceValue}
                  highlight
                />

                <SuccessViewDetailRow
                  label="Booking Status"
                  value={
                    formattedBookingStatus === "Pay on Arrival"
                      ? "POA"
                      : formattedBookingStatus
                  }
                />

                <SuccessViewDetailRow
                  label="Payment Method"
                  value={formatPaymentMethod(booking?.payment_method)}
                />

                <SuccessViewDetailRow
                  label={booking?.type === "cruise" ? "Car Park" : "Location"}
                  value={booking?.location_id?.name}
                />

                <SuccessViewDetailRow
                  label={
                    booking?.type === "cruise"
                      ? "Ship Departure"
                      : "Entry / Start Date"
                  }
                  value={formatDate(booking?.start_date)}
                />

                <SuccessViewDetailRow
                  label={
                    booking?.type === "cruise"
                      ? "Ship Arrival"
                      : "Exit / End Date"
                  }
                  value={formatDate(booking?.end_date)}
                />

                <SuccessViewDetailRow
                  label={getSuccessViewVehicleLabel(booking)}
                  value={getSuccessViewLicensePlateText(booking)}
                />

                {booking?.type === "cruise" &&
                  hasSuccessViewCruiseAddOnVehicle(booking) && (
                    <>
                      <SuccessViewDetailRow
                        label="Add On Vehicle"
                        value={getSuccessViewCruiseAddOnVehicleName(booking)}
                      />

                      <SuccessViewDetailRow
                        label={getSuccessViewCruiseAddOnVehicleLicensePlateLabel(
                          booking
                        )}
                        value={getSuccessViewCruiseAddOnVehicleLicensePlate(
                          booking
                        )}
                      />
                    </>
                  )}

                {booking?.type === "cruise" && (
                  <>
                    <SuccessViewDetailRow
                      label="Car park to terminal Shuttle Time"
                      value={`${getSuccessViewCruiseCarParkTime(
                        booking
                      )} (${getSuccessViewCruiseCarParkPassengers(
                        booking
                      )} passengers)`}
                    />

                    <SuccessViewDetailRow
                      label="Terminal to car park Shuttle Time"
                      value={`${getSuccessViewCruiseTerminalTime(
                        booking
                      )} (${getSuccessViewCruiseTerminalPassengers(
                        booking
                      )} passengers)`}
                    />
                  </>
                )}

                {booking?.type === "storage" && (
                  <SuccessViewDetailRow
                    label="Storage Type"
                    value={getSuccessViewStorageTypeName(booking)}
                  />
                )}

                {booking?.type === "airport" && (
                  <>
                    <SuccessViewDetailRow
                      label="Shuttle"
                      value={
                        booking?.details?.airport?.shuttle_time || "No shuttle"
                      }
                    />

                    <SuccessViewDetailRow
                      label="Passengers"
                      value={
                        booking?.details?.airport?.pickup_pax ||
                        booking?.pax ||
                        0
                      }
                    />
                  </>
                )}

                <SuccessViewDetailRow
                  label="Subtotal"
                  value={money(booking?.price ?? booking?.original_price)}
                />

                {formattedBookingStatus === "Pay on Arrival" && (
                  <SuccessViewDetailRow
                    label={poaDeposit ? "Current Due Amount" : "Due Amount"}
                    value={money(booking?.due_amount)}
                  />
                )}
              </tbody>
            </table>
          </div>

          <div className="my-4 h-[2px] w-full bg-gradient-to-r from-pink-400 via-pink-200 to-transparent" />

          <p className="text-sm leading-6 text-gray-700">
            If you&apos;d like to update your booking, you can do this anytime
            by logging into your account. For anything else, just email us at{" "}
            <span className="font-semibold">
              hello@sovereignparking.com
            </span>
            , and we will be happy to help.
          </p>
        </div>
      </div>
    </div>
  );
}

function SupportTicketViewModal({ ticket, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><h3 className="text-xl font-bold text-gray-950">Support Ticket</h3><p className="mt-1 text-sm text-gray-500">{ticket.ticket_id}</p></div>
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">Close</button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-bold uppercase text-gray-400">Status</p><div className="mt-2 flex flex-wrap gap-2"><StatusBadge value={formatStatus(ticket.status)} className={getSupportStatusClass(ticket.status)} /><StatusBadge value={formatPriority(ticket.priority)} className={getPriorityClass(ticket.priority)} /></div></div>
          <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-bold uppercase text-gray-400">Details</p><p className="mt-2 text-sm text-gray-700">Booking ID: <strong>{ticket.booking_id || "-"}</strong></p><p className="mt-1 text-sm text-gray-700">Created: {formatDateTime(ticket.createdAt)}</p></div>
        </div>
        <div className="mt-5 rounded-2xl border border-gray-100 p-4"><p className="text-xs font-bold uppercase text-gray-400">Your Message</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">{ticket.message}</p></div>
        <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-4"><p className="text-xs font-bold uppercase text-green-700">Admin Reply</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-green-800">{ticket.admin_reply || "Admin has not replied yet."}</p>{ticket.admin_replied_at && <p className="mt-3 text-xs text-green-700">Replied: {formatDateTime(ticket.admin_replied_at)}</p>}</div>
      </div>
    </div>
  );
}

function SupportTicketCreateModal({ supportTicketForm, supportTicketSubmitting, supportTicketError, supportTicketSuccess, updateSupportTicketField, submitSupportTicket, closeSupportTicketModal }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-bold text-gray-950">New Support Ticket</h3><p className="mt-1 text-sm text-gray-500">Admin will reply by email and you can track it here.</p></div><button type="button" onClick={closeSupportTicketModal} disabled={supportTicketSubmitting} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60">Close</button></div>
        <form onSubmit={submitSupportTicket} className="mt-5 space-y-4">
          <div><label className="text-sm font-semibold text-gray-700">Booking ID Optional</label><input value={supportTicketForm.booking_id} onChange={(event) => updateSupportTicketField("booking_id", event.target.value)} placeholder="BK..." className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" /></div>
          <div><label className="text-sm font-semibold text-gray-700">Message</label><textarea rows={5} value={supportTicketForm.message} onChange={(event) => updateSupportTicketField("message", event.target.value)} placeholder="Write your support request..." className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" required /></div>
          {supportTicketError && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{supportTicketError}</div>}
          {supportTicketSuccess && <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{supportTicketSuccess}</div>}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4"><button type="button" onClick={closeSupportTicketModal} disabled={supportTicketSubmitting} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-60">Cancel</button><button type="submit" disabled={supportTicketSubmitting} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{supportTicketSubmitting ? "Submitting..." : "Submit Ticket"}</button></div>
        </form>
      </div>
    </div>
  );
}

function EditBookingModal({
  editBooking,
  editBookingForm,
  editBookingSaving,
  editBookingError,
  editShuttleLoading,
  editShuttleSlots,
  updateEditBookingField,
  handleEditShuttleChange,
  handleEditCruiseDirectionPassengerChange,
  handleEditCruiseShuttleChange,
  closeEditBookingModal,
  submitEditBooking,
}) {
  const isCruise = editBooking.type === "cruise";
  const isAirport = editBooking.type === "airport";
  const isStorage = editBooking.type === "storage";

  function getCruiseDirectionSlots(directionKey) {
    const direction = cruiseEditShuttleDirections[directionKey];

    if (!direction) return [];

    return editShuttleSlots.filter(
      (slot) =>
        slot &&
        slot.type === "cruise" &&
        slot.is_active !== false &&
        slot[direction.showField] !== false
    );
  }

  function renderCruiseDirectionSection(directionKey) {
    const direction = cruiseEditShuttleDirections[directionKey];
    const directionSlots = getCruiseDirectionSlots(directionKey);

    const passengerCount = Number(editBookingForm[direction.passengerField] || 0);
    const selectedSlotId = editBookingForm[direction.slotIdField];
    const selectedTime = editBookingForm[direction.timeField];

    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <h4 className="text-sm font-bold text-gray-950">{direction.label}</h4>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
          <span className="font-semibold">Passengers:</span>{" "}
          <strong>{passengerCount}</strong>
          <p className="mt-1 text-xs text-gray-500">
            Passenger number cannot be changed from customer edit.
          </p>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold text-gray-700">
            Shuttle Option
          </label>

          {editShuttleLoading ? (
            <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
              Loading shuttle options...
            </div>
          ) : directionSlots.length > 0 ? (
            <select
              value={selectedSlotId}
              onChange={(event) =>
                handleEditCruiseShuttleChange(directionKey, event.target.value)
              }
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
              required
            >
              <option value="">Select shuttle option</option>

              {directionSlots.map((slot) => {
                const slotId = getSlotId(slot);
                const remaining = getEditDirectionRemaining(slot, directionKey);
                const bookedCount = getEditDirectionBookedCount(
                  slot,
                  directionKey
                );

                const selected = String(selectedSlotId) === String(slotId);
                const disabled =
                  !selected && remaining < Number(passengerCount || 1);

                return (
                  <option
                    key={`${directionKey}-${slotId}`}
                    value={slotId}
                    disabled={disabled}
                  >
                    {getSlotTime(slot)} — remaining {remaining}
                    {selected ? " (Selected)" : ""}
                    {disabled ? " (not enough capacity)" : ""}
                  </option>
                );
              })}
            </select>
          ) : selectedTime ? (
            <input
              value={selectedTime}
              onChange={(event) =>
                updateEditBookingField(direction.timeField, event.target.value)
              }
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
              placeholder="Enter shuttle time"
            />
          ) : (
            <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
              No {direction.label} shuttle options are available.
            </div>
          )}
        </div>

        {selectedTime && (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Selected shuttle: <strong>{selectedTime}</strong>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-950">Edit Booking</h3>
            <p className="mt-1 text-sm text-gray-500">
              Booking ID: <strong>{editBooking.booking_id}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={closeEditBookingModal}
            disabled={editBookingSaving}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form onSubmit={submitEditBooking} className="mt-5 space-y-4">
          {isStorage ? (
            <div>
              <label className="text-sm font-semibold text-gray-700">
           Vehicle Type
              </label>

              <input
                value={editBookingForm.reference}
                onChange={(event) =>
                  updateEditBookingField("reference", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none focus:border-blue-600"
                required
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  License Plate
                </label>

                <input
                  value={editBookingForm.license_plate}
                  onChange={(event) =>
                    updateEditBookingField("license_plate", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none focus:border-blue-600"
                  required
                />
              </div>

              {isCruise && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                    <p className="font-bold">Cruise shuttle details</p>
                    <p className="mt-1">
                      First {INCLUDED_CRUISE_SHUTTLE_PASSENGERS} passengers are
                      included per direction. Extra passengers are{" "}
                      {money(EXTRA_CRUISE_PASSENGER_FEE)} each.
                    </p>
                  </div>

                  {renderCruiseDirectionSection("carParkToTerminal")}
                  {renderCruiseDirectionSection("terminalToCarPark")}

                  <p className="text-xs text-gray-500">
                    Booking dates, payment method, passengers, price, and
                    location cannot be changed here. Customers can only change
                    the selected shuttle options.
                  </p>
                </div>
              )}

              {isAirport && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Shuttle Option
                  </label>

                  {editShuttleLoading ? (
                    <div className="mt-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      Loading shuttle options...
                    </div>
                  ) : editShuttleSlots.length > 0 ? (
                    <select
                      value={editBookingForm.shuttle_slot_id}
                      onChange={(event) =>
                        handleEditShuttleChange(event.target.value)
                      }
                      className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                    >
                      <option value="">Select shuttle option</option>

                      {editShuttleSlots.map((slot) => {
                        const isCurrent =
                          String(slot.time) ===
                          String(getBookingEditShuttleTime(editBooking));

                        return (
                          <option key={slot._id} value={slot._id}>
                            {slot.time} — remaining {slot.remaining}
                            {slot.is_current || isCurrent ? " (Selected)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  ) : getBookingEditShuttleTime(editBooking) ? (
                    <input
                      value={editBookingForm.shuttle_time}
                      onChange={(event) =>
                        updateEditBookingField(
                          "shuttle_time",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                      placeholder="Enter shuttle time"
                    />
                  ) : (
                    <div className="mt-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      No shuttle option was selected for this booking.
                    </div>
                  )}

                  <p className="mt-2 text-xs text-gray-500">
                    Payment information, booking dates, passengers, price, and
                    location cannot be changed here.
                  </p>
                </div>
              )}
            </>
          )}

          {editBookingError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {editBookingError}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={closeEditBookingModal}
              disabled={editBookingSaving}
              className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={editBookingSaving}
              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {editBookingSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TopUpModal({ topUpAmount, topUpLoading, topUpError, setTopUpAmount, setTopUpError, setTopUpModalOpen, handleStripeTopUp, handlePayPalTopUp }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between"><h3 className="text-xl font-bold text-gray-950">Top Up Wallet</h3><button type="button" onClick={() => setTopUpModalOpen(false)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">Close</button></div>
        <div className="mt-5"><label className="text-sm font-semibold text-gray-700">Top-up amount</label><input type="number" min="1" max="5000" step="0.01" value={topUpAmount} onChange={(event) => { setTopUpAmount(event.target.value); setTopUpError(""); }} placeholder="Enter amount" className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-600" /><p className="mt-2 text-xs text-gray-500">Minimum A$1.00. Maximum A$5000.00.</p></div>
        {topUpError && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{topUpError}</div>}
        <div className="mt-6 grid gap-3"><button type="button" onClick={handleStripeTopUp} disabled={Boolean(topUpLoading)} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left transition hover:border-blue-600 disabled:cursor-not-allowed disabled:opacity-60"><p className="text-lg font-bold text-blue-700">{topUpLoading === "stripe" ? "Preparing Stripe..." : "Top Up with Stripe"}</p><p className="mt-1 text-sm text-blue-700">Add money to your wallet using card payment.</p></button><button type="button" onClick={handlePayPalTopUp} disabled={Boolean(topUpLoading)} className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-left transition hover:border-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"><p className="text-lg font-bold text-yellow-800">{topUpLoading === "paypal" ? "Preparing PayPal..." : "Top Up with PayPal"}</p><p className="mt-1 text-sm text-yellow-800">Add money to your wallet using PayPal.</p></button></div>
      </div>
    </div>
  );
}

function WithdrawModal({ walletBalance, withdrawAmount, withdrawNote, withdrawPayoutMethod, withdrawAccountHolderName, withdrawBankName, withdrawBsb, withdrawAccountNumber, withdrawPaypalEmail, withdrawSubmitting, withdrawError, setWithdrawAmount, setWithdrawNote, setWithdrawPayoutMethod, setWithdrawAccountHolderName, setWithdrawBankName, setWithdrawBsb, setWithdrawAccountNumber, setWithdrawPaypalEmail, setWithdrawError, closeWithdrawModal, submitWithdrawRequest }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between"><h3 className="text-xl font-bold text-gray-950">Withdraw Request</h3><button type="button" onClick={closeWithdrawModal} disabled={withdrawSubmitting} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60">Close</button></div>
        <p className="mt-3 text-sm text-gray-500">Available balance: <strong>{money(walletBalance)}</strong></p>
        <form onSubmit={submitWithdrawRequest} className="mt-5 space-y-4">
          <div><label className="text-sm font-semibold text-gray-700">Withdrawal Amount</label><input type="number" min="1" max={walletBalance} step="0.01" value={withdrawAmount} onChange={(event) => { setWithdrawAmount(event.target.value); setWithdrawError(""); }} placeholder="Enter amount" className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-600" required /><p className="mt-2 text-xs text-gray-500">Your wallet balance will be reserved immediately after request.</p></div>
          <div><label className="text-sm font-semibold text-gray-700">Payout Method</label><select value={withdrawPayoutMethod} onChange={(event) => { setWithdrawPayoutMethod(event.target.value); setWithdrawError(""); }} className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" required><option value="">Select payout method</option><option value="bank_transfer">Bank Transfer</option><option value="paypal">PayPal</option>
          <option value="cash">Cash</option>
          {/* <option value="other">Other</option> */}
          </select>
          </div>
          {withdrawPayoutMethod === "bank_transfer" && <div className="grid gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4"><input value={withdrawAccountHolderName} onChange={(event) => setWithdrawAccountHolderName(event.target.value)} placeholder="Account holder name" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" required /><input value={withdrawBankName} onChange={(event) => setWithdrawBankName(event.target.value)} placeholder="Bank name" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" required /><input value={withdrawBsb} onChange={(event) => setWithdrawBsb(event.target.value)} placeholder="BSB / routing number" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" required /><input value={withdrawAccountNumber} onChange={(event) => setWithdrawAccountNumber(event.target.value)} placeholder="Account number" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" required /></div>}
          {withdrawPayoutMethod === "paypal" && <input type="email" value={withdrawPaypalEmail} onChange={(event) => setWithdrawPaypalEmail(event.target.value)} placeholder="paypal@email.com" className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" required />}
          <div><label className="text-sm font-semibold text-gray-700">Customer Note{["cash", "other"].includes(withdrawPayoutMethod) ? " *" : " Optional"}</label><textarea rows={3} value={withdrawNote} onChange={(event) => setWithdrawNote(event.target.value)} placeholder={["cash", "other"].includes(withdrawPayoutMethod) ? "Please explain how admin should pay you..." : "Optional note for admin..."} className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600" required={["cash", "other"].includes(withdrawPayoutMethod)} /></div>
          {withdrawError && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{withdrawError}</div>}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4"><button type="button" onClick={closeWithdrawModal} disabled={withdrawSubmitting} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-60">Cancel</button><button type="submit" disabled={withdrawSubmitting} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{withdrawSubmitting ? "Submitting..." : "Request"}</button></div>
        </form>
      </div>
    </div>
  );
}

function CancelRequestModal({ cancelModalBooking, cancellationReason, cancelSubmitting, setCancellationReason, closeCancelRequestModal, submitCancellationRequest }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-gray-950">Request Booking Cancellation</h3>
        <p className="mt-2 text-sm text-gray-600">Booking ID: <strong>{cancelModalBooking.booking_id}</strong></p>
        <form onSubmit={submitCancellationRequest} className="mt-5 space-y-4">
          <div><label className="text-sm font-semibold text-gray-700">Cancellation Reason</label><textarea rows={5} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Please write why you want to cancel this booking..." className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-red-600" required /></div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4"><button type="button" onClick={closeCancelRequestModal} disabled={cancelSubmitting} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-60">Close</button><button type="submit" disabled={cancelSubmitting} className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{cancelSubmitting ? "Submitting..." : "Submit Request"}</button></div>
        </form>
      </div>
    </div>
  );
}
