"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "@/app/frontend/utils/axios";
import AdminCruiseCreateBookingModal from "./AdminCruiseCreateBookingModal";
import AdminStorageCreateBookingModal from "./AdminStorageCreateBookingModal";
import AdminAirportCreateBookingModal from "./AdminAirportCreateBookingModal";

const bookingTypeConfig = {
  cruise: {
    title: "Cruise Bookings",
    subtitle: "Manage all cruise parking bookings.",
  },
  storage: {
    title: "Storage Bookings",
    subtitle: "Manage all storage bookings.",
  },
  airport: {
    title: "Airport Bookings",
    subtitle: "Manage all airport parking bookings.",
  },
};

const statusOptions = [
  { value: "", label: "All" },
  { value: "success", label: "Success" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "poa", label: "Pay on Arrival" },
  {
    value: "cancellation_requested",
    label: "Cancellation Requested by Customer",
  },
  { value: "cancelled", label: "Cancelled" },
  { value: "credit", label: "Credited" },
  { value: "credited", label: "Credited" },
  { value: "refund", label: "Refunded" },
  { value: "refunded", label: "Refunded" },
];

const paymentStatusOptions = [
  { value: "", label: "All Payment Statuses" },
  { value: "unpaid", label: "Unpaid" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partially Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially Refunded" },
];

const paymentMethodOptions = [
  { value: "", label: "All" },
  { value: "stripe", label: "Stripe" },
  { value: "paypal", label: "PayPal" },
  { value: "wallet", label: "Wallet" },
  { value: "poa", label: "Pay on Arrival" },
  { value: "credit_card_manual", label: "Credit Card Manual" },
];

const allowedCalendarFilters = [
  "today_in",
  "today_out",
  "total",
  "success",
  "poa",
];

const adminCruiseShuttleDirections = {
  carParkToTerminal: {
    passengerField: "car_park_to_terminal_passengers",
    slotIdField: "car_park_to_terminal_shuttle_slot_id",
    timeField: "car_park_to_terminal_shuttle_time",
    showField: "show_car_park_to_terminal",
    remainingField: "car_park_to_terminal_remaining",
  },
  terminalToCarPark: {
    passengerField: "terminal_to_car_park_passengers",
    slotIdField: "terminal_to_car_park_shuttle_slot_id",
    timeField: "terminal_to_car_park_shuttle_time",
    showField: "show_terminal_to_car_park",
    remainingField: "terminal_to_car_park_remaining",
  },
};

const adminCruiseAddOnVehicleOptions = [
  { value: "", label: "Select add-on vehicle" },
  { value: "SUV", label: "SUV" },
  { value: "Van", label: "Van" },
  { value: "Truck", label: "Truck" },
  { value: "Ute", label: "Ute" },
  { value: "Trailer", label: "Trailer" },
  { value: "Other", label: "Other" },
];

function money(amount) {
  return `A$${Number(amount || 0).toFixed(2)}`;
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

function formatDateTime(date) {
  if (!date) return "-";

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

function toDateInputValue(date) {
  if (!date) return "";

  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

function formatText(value) {
  if (!value) return "-";

  const labels = {
    cancellation_requested: "Cancellation Requested by Customer",
    poa: "Pay on Arrival",
    paypal: "PayPal",
    credit_card_manual: "Credit Card Manual",
    full_online: "Full Payment",
    poa_deposit: "Pay on Arrival",
    partially_refunded: "Partially Refunded",
    pending_payment: "Pending Payment",
    refunded: "Refunded",
    refund: "Refunded",
    credited: "Credited",
    credit: "Credited",
    cancelled: "Cancelled",
    paid: "Paid",
    partial: "Partial",
    today_in: "In",
    today_out: "Out",
    total: "Total",
    success: "Success",
  };

  if (labels[value]) {
    return labels[value];
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

function clearAdminSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
}

function getBookingIdentifier(booking) {
  return booking?._id || booking?.booking_id;
}

function getProviderReference(booking) {
  if (!booking) return "-";

  const manualReference =
    booking.manual_payment_reference ||
    booking.transaction_reference ||
    booking.transaction_id ||
    booking.reference_payment ||
    booking.reference ||
    "-";

  if (booking.payment_method === "stripe") {
    return booking.stripe_payment_intent_id || manualReference;
  }

  if (booking.payment_method === "paypal") {
    return (
      booking.paypal_capture_id ||
      booking.paypal_order_id ||
      manualReference
    );
  }

  if (booking.payment_method === "credit_card_manual") {
    return manualReference;
  }

  if (booking.payment_method === "wallet") {
    if (typeof booking.wallet_transaction_id === "string") {
      return booking.wallet_transaction_id;
    }

    return (
      booking.wallet_transaction_id?.transaction_reference ||
      booking.wallet_transaction_id?._id ||
      manualReference
    );
  }

  return manualReference;
}

function getCustomerName(booking) {
  return booking?.customer?.name || booking?.user_id?.name || "-";
}

function getCustomerEmail(booking) {
  return booking?.customer?.email || booking?.user_id?.email || "-";
}

function getCustomerPhone(booking) {
  return booking?.customer?.phone || booking?.user_id?.phone || "-";
}

function getLocationName(booking) {
  return booking?.location_id?.name || booking?.details?.location_name || "-";
}

function getLocationId(booking) {
  if (!booking) return "";

  if (typeof booking.location_id === "string") {
    return booking.location_id;
  }

  return (
    booking.location_id?._id ||
    booking.location?._id ||
    booking.details?.location_id ||
    ""
  );
}

function getShipName(booking) {
  return (
    booking?.schedule_id?.ship_name ||
    booking?.schedule_id?.schedule_name ||
    booking?.details?.cruise?.ship_name ||
    booking?.ship_name ||
    "-"
  );
}

function getPickupPaxPro(booking) {
  if (booking?.type === "cruise") {
    return booking?.details?.cruise?.pickup_pax_pro || 0;
  }

  return 0;
}

function getStorageType(booking) {
  return (
    booking?.storage_type?.name ||
    booking?.storage_type ||
    booking?.storage_type_name ||
    booking?.details?.storage?.storage_type ||
    booking?.details?.storage?.storage_type_name ||
    booking?.details?.storage_type ||
    ""
  );
}

function getShuttleTime(booking) {
  if (booking?.type === "cruise") {
    return booking?.details?.cruise?.shuttle_time || booking?.shuttle_time || "-";
  }

  if (booking?.type === "airport") {
    return (
      booking?.details?.airport?.shuttle_time ||
      booking?.shuttle_time ||
      "No shuttle"
    );
  }

  return booking?.shuttle_time || "-";
}

function getPax(booking) {
  if (booking?.type === "cruise") {
    return booking?.details?.cruise?.pickup_pax || booking?.pax || 0;
  }

  if (booking?.type === "airport") {
    return booking?.details?.airport?.pickup_pax || booking?.pax || 0;
  }

  return booking?.pax || 0;
}


function formatPassengerValue(value) {
  const count = Number(value || 0);

  if (!Number.isFinite(count) || count <= 0) {
    return "-";
  }

  return `${count} passenger${count === 1 ? "" : "s"}`;
}

function firstFilledValue(...values) {
  return values.find((value) => {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== "";
  });
}

function normalizeBooleanValue(value) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase().trim());
  }

  return Boolean(value);
}

function getCruiseAddOnVehicle(booking) {
  if (!isCruiseBooking(booking)) {
    return {
      enabled: false,
      type: "",
      licensePlate: "",
      licensePlateLabel: "Selected Vehicle License Plate",
    };
  }

  const addOnVehicle = booking?.details?.cruise?.add_on_vehicle || {};

  const enabled = normalizeBooleanValue(
    booking?.add_on_vehicle_enabled ?? addOnVehicle.enabled
  );

  const type = String(
    firstFilledValue(booking?.add_on_vehicle_type, addOnVehicle.type, "") || ""
  ).trim();

  const licensePlate = String(
    firstFilledValue(
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

function hasCruiseAddOnVehicle(booking) {
  return getCruiseAddOnVehicle(booking).enabled;
}

function getCruiseAddOnVehicleName(booking) {
  return getCruiseAddOnVehicle(booking).type || "-";
}

function getCruiseAddOnVehicleLicensePlate(booking) {
  return getCruiseAddOnVehicle(booking).licensePlate || "-";
}

function getCruiseAddOnVehicleLicensePlateLabel(booking) {
  return getCruiseAddOnVehicle(booking).licensePlateLabel;
}

function getPassengerCountValue(...values) {
  const value = firstFilledValue(...values);
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}

function getCleanEditText(value) {
  const text = String(value || "").trim();
  return text === "-" || text === "No shuttle" ? "" : text;
}

function normalizeShuttleCount(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}

function getShuttleSlotId(slot) {
  return String(slot?._id || slot?.id || slot?.slot_id || slot?.time || "");
}

function getShuttleSlotTime(slot) {
  return String(slot?.time || slot?.shuttle_time || "").trim();
}

function getCruiseDirectionRemaining(slot, directionKey) {
  const direction = adminCruiseShuttleDirections[directionKey];

  if (
    direction &&
    slot?.[direction.remainingField] !== undefined &&
    slot?.[direction.remainingField] !== null
  ) {
    return normalizeShuttleCount(slot[direction.remainingField]);
  }

  if (slot?.remaining !== undefined && slot?.remaining !== null) {
    return normalizeShuttleCount(slot.remaining);
  }

  const capacity = normalizeShuttleCount(slot?.capacity);
  const bookedCount = normalizeShuttleCount(slot?.booked_count);

  return Math.max(capacity - bookedCount, 0);
}

function normalizeAdminCruiseShuttleSlots(slots = []) {
  if (!Array.isArray(slots)) return [];

  return slots
    .map((slot) => {
      const time = getShuttleSlotTime(slot);
      const capacity = normalizeShuttleCount(slot?.capacity);
      const bookedCount = normalizeShuttleCount(slot?.booked_count);
      const remaining =
        slot?.remaining !== undefined && slot?.remaining !== null
          ? normalizeShuttleCount(slot.remaining)
          : Math.max(capacity - bookedCount, 0);

      return {
        ...slot,
        _id: getShuttleSlotId(slot),
        type: slot?.type || "cruise",
        time,
        shuttle_time: time,
        capacity,
        booked_count: bookedCount,
        remaining,
        show_car_park_to_terminal:
          slot?.show_car_park_to_terminal !== false,
        show_terminal_to_car_park:
          slot?.show_terminal_to_car_park !== false,
        car_park_to_terminal_remaining:
          slot?.car_park_to_terminal_remaining !== undefined &&
          slot?.car_park_to_terminal_remaining !== null
            ? normalizeShuttleCount(slot.car_park_to_terminal_remaining)
            : remaining,
        terminal_to_car_park_remaining:
          slot?.terminal_to_car_park_remaining !== undefined &&
          slot?.terminal_to_car_park_remaining !== null
            ? normalizeShuttleCount(slot.terminal_to_car_park_remaining)
            : remaining,
        is_active: slot?.is_active !== false,
      };
    })
    .filter((slot) => slot.time && slot.is_active !== false);
}

function getAirportShuttleRemaining(slot) {
  if (slot?.remaining !== undefined && slot?.remaining !== null) {
    return normalizeShuttleCount(slot.remaining);
  }

  const capacity = normalizeShuttleCount(slot?.capacity);
  const bookedCount = normalizeShuttleCount(slot?.booked_count);

  return Math.max(capacity - bookedCount, 0);
}

function normalizeAdminAirportShuttleSlots(slots = []) {
  if (!Array.isArray(slots)) return [];

  return slots
    .map((slot) => {
      const time = getShuttleSlotTime(slot);
      const capacity = normalizeShuttleCount(slot?.capacity);
      const bookedCount = normalizeShuttleCount(slot?.booked_count);

      return {
        ...slot,
        _id: getShuttleSlotId(slot),
        type: slot?.type || "airport",
        time,
        shuttle_time: time,
        capacity,
        booked_count: bookedCount,
        remaining:
          slot?.remaining !== undefined && slot?.remaining !== null
            ? normalizeShuttleCount(slot.remaining)
            : Math.max(capacity - bookedCount, 0),
        is_active: slot?.is_active !== false,
      };
    })
    .filter((slot) => slot.time && slot.is_active !== false);
}

function getBookingAirportShuttleSlotId(booking) {
  const airport = booking?.details?.airport || {};

  return String(
    airport.shuttle_slot_id ||
      booking?.shuttle_slot_id ||
      ""
  );
}

function getBookingCruiseCarParkToTerminalSlotId(booking) {
  const cruise = booking?.details?.cruise || {};

  return String(
    cruise.car_park_to_terminal_shuttle_slot_id ||
      booking?.car_park_to_terminal_shuttle_slot_id ||
      cruise.shuttle_slot_id ||
      booking?.shuttle_slot_id ||
      ""
  );
}

function getBookingCruiseTerminalToCarParkSlotId(booking) {
  const cruise = booking?.details?.cruise || {};

  return String(
    cruise.terminal_to_car_park_shuttle_slot_id ||
      booking?.terminal_to_car_park_shuttle_slot_id ||
      ""
  );
}

function getBookingCruiseScheduleId(booking, schedules = []) {
  const directScheduleId =
    booking?.schedule_id?._id ||
    booking?.schedule_id ||
    booking?.cruise_schedule_id?._id ||
    booking?.cruise_schedule_id ||
    booking?.cruise_schedule?._id ||
    booking?.details?.cruise?.schedule_id;

  if (directScheduleId) {
    return String(directScheduleId);
  }

  const bookingShipName = String(getShipName(booking) || "")
    .trim()
    .toLowerCase();

  const bookingDepartureDate = toDateInputValue(booking?.start_date);

  const matchedSchedule = schedules.find((schedule) => {
    const scheduleName = String(
      schedule?.schedule_name || schedule?.ship_name || ""
    )
      .trim()
      .toLowerCase();

    const scheduleDepartureDate = toDateInputValue(
      schedule?.departure_date || schedule?.ship_departure
    );

    return (
      scheduleName === bookingShipName &&
      scheduleDepartureDate === bookingDepartureDate
    );
  });

  return String(matchedSchedule?._id || matchedSchedule?.id || "");
}

function getCruiseCarParkToTerminalPassengerCount(booking) {
  const cruise = booking?.details?.cruise || {};

  return getPassengerCountValue(
    cruise.car_park_to_terminal_passengers,
    booking?.car_park_to_terminal_passengers,
    cruise.pickup_pax,
    booking?.pickup_pax,
    booking?.pax
  );
}

function getCruiseCarParkToTerminalPassengers(booking) {
  return formatPassengerValue(getCruiseCarParkToTerminalPassengerCount(booking));
}

function getCruiseCarParkToTerminalShuttleOption(booking) {
  const cruise = booking?.details?.cruise || {};

  return (
    firstFilledValue(
      cruise.car_park_to_terminal_shuttle_time,
      booking?.car_park_to_terminal_shuttle_time,
      cruise.shuttle_time,
      booking?.shuttle_time
    ) || "-"
  );
}

function getCruiseTerminalToCarParkPassengerCount(booking) {
  const cruise = booking?.details?.cruise || {};

  return getPassengerCountValue(
    cruise.terminal_to_car_park_passengers,
    booking?.terminal_to_car_park_passengers,
    cruise.pickup_pax_pro,
    booking?.pickup_pax_pro
  );
}

function getCruiseTerminalToCarParkPassengers(booking) {
  return formatPassengerValue(getCruiseTerminalToCarParkPassengerCount(booking));
}

function getCruiseTerminalToCarParkShuttleOption(booking) {
  const cruise = booking?.details?.cruise || {};

  return (
    firstFilledValue(
      cruise.terminal_to_car_park_shuttle_time,
      booking?.terminal_to_car_park_shuttle_time
    ) || "-"
  );
}

function getPickupPax(booking) {
  if (booking?.type === "cruise") {
    return (
      booking?.details?.cruise?.pickup_pax ||
      booking?.pickup_pax ||
      booking?.pax ||
      0
    );
  }

  if (booking?.type === "airport") {
    return (
      booking?.details?.airport?.pickup_pax ||
      booking?.pickup_pax ||
      booking?.pax ||
      0
    );
  }

  return booking?.pickup_pax || booking?.pax || 0;
}

function getParkingSlotNumber(booking) {
  if (booking?.type === "cruise") {
    return booking?.details?.cruise?.parking_slot || booking?.parking_slot || "";
  }

  if (booking?.type === "airport") {
    return booking?.details?.airport?.parking_slot || booking?.parking_slot || "";
  }

  return booking?.parking_slot || "";
}

function getBookingAdminImages(booking) {
  const images = Array.isArray(booking?.admin_images)
    ? booking.admin_images.filter((image) => image?.url)
    : [];

  const legacyImage = booking?.admin_image?.url ? booking.admin_image : null;

  if (
    legacyImage &&
    !images.some((image) => String(image?.url || "") === String(legacyImage.url))
  ) {
    return [legacyImage, ...images];
  }

  return images;
}

function getBookingAdminImageCount(booking) {
  return getBookingAdminImages(booking).length;
}

function getBookingAdminImageKey(image, index = 0) {
  return String(
    image?.image_id ||
      image?.public_id ||
      image?.url ||
      `${image?.original_name || "booking-image"}-${index}`
  );
}

function getPeriod(booking) {
  return `${formatDate(booking?.start_date)} to ${formatDate(
    booking?.end_date
  )}`;
}

function getLicensePlate(booking) {
  return booking?.license_plate || booking?.reference || "-";
}

function getInterlock(booking) {
  return booking?.interlock ? "Yes" : "No";
}

function getParkingSlot(booking) {
  return (
    booking?.shuttle_slot_id ||
    booking?.details?.cruise?.shuttle_slot_id ||
    booking?.details?.airport?.shuttle_slot_id ||
    "-"
  );
}

function isCruiseBooking(booking) {
  return booking?.type === "cruise";
}

function isStorageBooking(booking) {
  return booking?.type === "storage";
}

function isAirportBooking(booking) {
  return booking?.type === "airport";
}

function hasBookingShuttle(booking) {
  const shuttleTime = getShuttleTime(booking);

  if (isAirportBooking(booking)) {
    return Boolean(
      shuttleTime &&
        shuttleTime !== "-" &&
        shuttleTime !== "No shuttle" &&
        Number(getPax(booking) || 0) > 0
    );
  }

  if (isCruiseBooking(booking)) {
    return Boolean(shuttleTime && shuttleTime !== "-");
  }

  return false;
}

function isPoaDepositBooking(booking) {
  return (
    booking?.payment_flow === "poa_deposit" ||
    booking?.deposit_type === "poa" ||
    booking?.status === "poa"
  );
}

function needsFeeChoice(action, booking) {
  return (
    ["refund", "credit", "cancel"].includes(action) &&
    !isPoaDepositBooking(booking)
  );
}

function getActionTitle(action) {
  if (action === "refund") return "Refunded";
  if (action === "credit") return "Credit";
  if (action === "cancel") return "Cancellation";
  return "Action";
}

function getFullActionLabel(action) {
  if (action === "refund") return "Full Refunded";
  if (action === "credit") return "Full Credit";
  if (action === "cancel") return "Cancel with full refund";
  return "Full Action";
}

function getDeductActionLabel(action) {
  if (action === "refund") return "Refunded with A$10 Fee";
  if (action === "credit") return "Credit with A$10 Fee";
  if (action === "cancel") return "Cancellation with A$10 Fee";
  return "Action with A$10 Fee";
}

function extractAdminLocations(response) {
  const data = response?.data?.data;

  if (Array.isArray(data)) return data;

  return data?.locations || [];
}

function extractStorageTypes(response) {
  const data = response?.data?.data;

  if (Array.isArray(data)) return data;

  return data?.storageTypes || data?.storage_types || data?.types || [];
}

function extractCruiseSchedules(response) {
  const data = response?.data?.data;

  if (Array.isArray(data)) return data;

  return data?.schedules || data?.cruise_schedules || [];
}

function Badge({ value, type = "default" }) {
  const label = formatText(value);

  const classes = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        classes[type] || classes.default
      }`}
    >
      {label}
    </span>
  );
}

function getStatusBadgeType(status) {
  const value = String(status || "").toLowerCase();

  if (["success", "confirmed", "paid"].includes(value)) {
    return "success";
  }

  if (["pending", "pending_payment", "partial", "poa"].includes(value)) {
    return "warning";
  }

  if (value === "cancellation_requested") {
    return "warning";
  }

  if (
    ["failed", "cancelled", "refunded", "refund", "partially_refunded"].includes(
      value
    )
  ) {
    return "danger";
  }

  if (["credit", "credited"].includes(value)) {
    return "info";
  }

  return "default";
}

function getAdminActionLabel(booking) {
  const actionType = booking?.admin_action_type;

  if (actionType === "refund") return "Refunded";
  if (actionType === "credit") return "Credit";
  if (actionType === "cancel") return "Cancellation";

  return null;
}

function getAdminActionBadgeType(actionType) {
  if (actionType === "refund") return "danger";
  if (actionType === "credit") return "info";
  if (actionType === "cancel") return "warning";

  return "default";
}

function getPaymentStatusLabel(booking) {
  if (booking?.payment_status === "partially_refunded") {
    return "Partially Refunded";
  }

  if (booking?.payment_status === "refunded") {
    return "Refunded";
  }

  return formatText(booking?.payment_status);
}

function getNewAdminNote(booking) {
  return String(booking?.new_admin_note || "").trim();
}

function getBookingStatusLabel(booking) {
  const status = String(booking?.status || "").toLowerCase();
  const adminActionType = String(booking?.admin_action_type || "").toLowerCase();

  if (status === "cancellation_requested") {
    return "Cancellation Requested By Customer";
  }

  if (adminActionType === "refund") return "Refunded";
  if (adminActionType === "credit") return "Credited";
  if (adminActionType === "cancel") return "Cancelled";

  if (["refund", "refunded"].includes(status)) return "Refunded";
  if (["credit", "credited"].includes(status)) return "Credited";

  if (["success", "confirmed"].includes(status)) return "Success";

  if (status === "pending_payment") return "Pending Payment";

  if (
    status === "poa" ||
    booking?.payment_flow === "poa_deposit" ||
    booking?.deposit_type === "poa"
  ) {
    return "Pay on Arrival";
  }

  if (status === "cancelled") return "Cancelled";

  return formatText(status);
}

function getBookingStatusBadgeTypeFromBooking(booking) {
  const status = String(booking?.status || "").toLowerCase();
  const adminActionType = String(booking?.admin_action_type || "").toLowerCase();

  if (status === "cancellation_requested") {
    return "warning";
  }

  if (["success", "confirmed"].includes(status)) {
    return "success";
  }

  if (status === "poa" || status === "pending_payment") {
    return "warning";
  }

  if (
    adminActionType === "refund" ||
    adminActionType === "cancel" ||
    ["refund", "refunded", "cancelled"].includes(status)
  ) {
    return "danger";
  }

  if (adminActionType === "credit" || ["credit", "credited"].includes(status)) {
    return "info";
  }

  return "default";
}

function getNumericAmount(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

function buildBookingSummaryFromRows(rows = []) {
  return rows.reduce(
    (acc, booking) => {
      acc.total_bookings += 1;
      acc.total_value += getNumericAmount(booking.price);
      acc.paid_amount += getNumericAmount(booking.paid_amount);
      acc.balance_due_on_arrival += getNumericAmount(
        booking.balance_due_on_arrival || booking.due_amount
      );
      acc.holding_deposit_amount += getNumericAmount(
        booking.holding_deposit_amount
      );

      return acc;
    },
    {
      total_bookings: 0,
      total_value: 0,
      paid_amount: 0,
      balance_due_on_arrival: 0,
      holding_deposit_amount: 0,
    }
  );
}

function buildStatusBreakdownFromRows(rows = []) {
  const map = new Map();

  rows.forEach((booking) => {
    const statusLabel = getBookingStatusLabel(booking);
    const key = statusLabel || "Unknown";

    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries()).map(([label, count]) => ({
    status: label,
    label,
    count,
  }));
}

function getCalendarFilterLabel(filter) {
  const labels = {
    today_in: "In",
    today_out: "Out",
    total: "Total",
    success: "Success",
    poa: "POA",
  };

  return labels[filter] || formatText(filter);
}

function normalizeDateKey(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function isBookingOnCalendarDate(booking, dateKey) {
  const startDate = normalizeDateKey(booking?.start_date);
  const endDate = normalizeDateKey(booking?.end_date);

  if (!dateKey) return true;

  if (startDate === dateKey || endDate === dateKey) {
    return true;
  }

  if (startDate && endDate && dateKey >= startDate && dateKey <= endDate) {
    return true;
  }

  return false;
}

function isBookingTodayIn(booking, dateKey) {
  return normalizeDateKey(booking?.start_date) === dateKey;
}

function isBookingTodayOut(booking, dateKey) {
  return normalizeDateKey(booking?.end_date) === dateKey;
}

function isBookingSuccess(booking) {
  const status = String(booking?.status || "").toLowerCase();
  return ["success", "confirmed"].includes(status);
}

function isBookingPoa(booking) {
  const status = String(booking?.status || "").toLowerCase();

  return (
    status === "poa" ||
    booking?.payment_flow === "poa_deposit" ||
    booking?.deposit_type === "poa"
  );
}

function bookingMatchesCalendarFilter(booking, dateKey, filter) {
  if (!dateKey || !filter) return true;

  if (filter === "today_in") {
    return isBookingTodayIn(booking, dateKey);
  }

  if (filter === "today_out") {
    return isBookingTodayOut(booking, dateKey);
  }

  if (filter === "success") {
    return isBookingSuccess(booking) && isBookingOnCalendarDate(booking, dateKey);
  }

  if (filter === "poa") {
    return isBookingPoa(booking) && isBookingOnCalendarDate(booking, dateKey);
  }

  if (filter === "total") {
    return isBookingOnCalendarDate(booking, dateKey);
  }

  return true;
}

function formatCalendarDateLabel(dateKey) {
  if (!dateKey) return "-";

  const date = new Date(`${dateKey}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid gap-1 border-b py-3 sm:grid-cols-[220px_1fr]">
      <p className="text-sm font-semibold text-gray-600">{label}</p>
      <p className="break-words text-sm text-gray-900">{value || "-"}</p>
    </div>
  );
}

function getExportRows(bookings = []) {
  return bookings.map((booking) => ({
    "Booking ID": booking.booking_id || "",
    Type: formatText(booking.type),
    "Customer Name": getCustomerName(booking),
    Email: getCustomerEmail(booking),
    Phone: getCustomerPhone(booking),
    Status: getBookingStatusLabel(booking),
    "Admin Action": getAdminActionLabel(booking) || "",
    "Payment Status": getPaymentStatusLabel(booking),
    "Payment Method": formatText(booking.payment_method),
    "Payment Flow": formatText(booking.payment_flow),
    Location: getLocationName(booking),
    "Start Date": formatDate(booking.start_date),
    "End Date": formatDate(booking.end_date),
    "Ship Name": isCruiseBooking(booking) ? getShipName(booking) : "",
    "Car park to terminal": isCruiseBooking(booking)
      ? getCruiseCarParkToTerminalPassengers(booking)
      : "",
    "Car park to terminal Shuttle Options": isCruiseBooking(booking)
      ? getCruiseCarParkToTerminalShuttleOption(booking)
      : "",
    "Terminal to car park": isCruiseBooking(booking)
      ? getCruiseTerminalToCarParkPassengers(booking)
      : "",
    "Terminal to car park Shuttle Options": isCruiseBooking(booking)
      ? getCruiseTerminalToCarParkShuttleOption(booking)
      : "",
    "Shuttle Time": isAirportBooking(booking) ? getShuttleTime(booking) : "",
    "Storage Type": isStorageBooking(booking) ? getStorageType(booking) : "",
    "License Plate": getLicensePlate(booking),
    "Add On Vehicle": isCruiseBooking(booking)
      ? getCruiseAddOnVehicleName(booking)
      : "",
    "Add On Vehicle License Plate": isCruiseBooking(booking)
      ? getCruiseAddOnVehicleLicensePlate(booking)
      : "",
    Passengers: isAirportBooking(booking) ? getPax(booking) : "",
    "Pick Up Pax": isCruiseBooking(booking) ? getPickupPaxPro(booking) : "",
    "Parking Slot Number": isCruiseBooking(booking)
      ? getParkingSlotNumber(booking)
      : "",
    Total: Number(booking.price || 0).toFixed(2),
    Paid: Number(booking.paid_amount || 0).toFixed(2),
    Due: Number(booking.due_amount || 0).toFixed(2),
    "Balance Due on Arrival": Number(
      booking.balance_due_on_arrival || 0
    ).toFixed(2),
    "Provider Reference": getProviderReference(booking),
    "Created At": formatDateTime(booking.createdAt),
    Notes: booking.notes || "",
    "New Admin Note": getNewAdminNote(booking),
  }));
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");

  if (
    stringValue.includes(",") ||
    stringValue.includes("\n") ||
    stringValue.includes('"')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function buildCsv(rows = []) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);

  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(",")
    ),
  ].join("\n");
}

function downloadFile({ filename, content, type }) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

async function copyTableRows(bookings = []) {
  const rows = getExportRows(bookings);

  if (!rows.length) {
    alert("No bookings to copy.");
    return;
  }

  const headers = Object.keys(rows[0]);
  const text = [
    headers.join("\t"),
    ...rows.map((row) => headers.map((header) => row[header]).join("\t")),
  ].join("\n");

  await navigator.clipboard.writeText(text);
  alert("Booking table copied to clipboard.");
}

function downloadCsv(bookings = [], bookingType = "bookings") {
  const rows = getExportRows(bookings);

  if (!rows.length) {
    alert("No bookings to export.");
    return;
  }

  downloadFile({
    filename: `${bookingType}-bookings.csv`,
    content: buildCsv(rows),
    type: "text/csv;charset=utf-8;",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadExcel(bookings = [], bookingType = "bookings") {
  const rows = getExportRows(bookings);

  if (!rows.length) {
    alert("No bookings to export.");
    return;
  }

  const headers = Object.keys(rows[0]);

  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        <table border="1">
          <thead>
            <tr>
              ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    ${headers
                      .map((header) => `<td>${escapeHtml(row[header])}</td>`)
                      .join("")}
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  downloadFile({
    filename: `${bookingType}-bookings.xls`,
    content: html,
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
}

function getPrintableRows(booking) {
  const rows = [
    ["Booking ID", booking?.booking_id],
    ["Booking Status", getBookingStatusLabel(booking)],
    ["Admin Action", getAdminActionLabel(booking) || "-"],
    ["Payment Status", getPaymentStatusLabel(booking)],
    ["Created Date", formatDateTime(booking?.createdAt)],
    ["Name", getCustomerName(booking)],
    ["Phone", getCustomerPhone(booking)],
    ["Email", getCustomerEmail(booking)],
  ];

  if (isCruiseBooking(booking)) {
    rows.push(
      ["Ship Name", getShipName(booking)],
      ["Ship Departure Date", formatDate(booking?.start_date)],
      ["Ship Arrival Date", formatDate(booking?.end_date)],
      [
        "Car park to terminal",
        getCruiseCarParkToTerminalPassengers(booking),
      ],
      [
        "Car park to terminal Shuttle Options",
        getCruiseCarParkToTerminalShuttleOption(booking),
      ],
      [
        "Terminal to car park",
        getCruiseTerminalToCarParkPassengers(booking),
      ],
      [
        "Terminal to car park Shuttle Options",
        getCruiseTerminalToCarParkShuttleOption(booking),
      ],
      ["Pick Up Pax", getPickupPaxPro(booking)],
      ["Parking Slot Number", getParkingSlotNumber(booking)],
      ["License Plate", getLicensePlate(booking)],
      ...(hasCruiseAddOnVehicle(booking)
        ? [
            ["Add On Vehicle", getCruiseAddOnVehicleName(booking)],
            [
              getCruiseAddOnVehicleLicensePlateLabel(booking),
              getCruiseAddOnVehicleLicensePlate(booking),
            ],
          ]
        : [])
    );
  }

  if (isStorageBooking(booking)) {
    rows.push(
      ["Entry Date", formatDate(booking?.start_date)],
      ["Exit Date", formatDate(booking?.end_date)],
      ["Storage Type", getStorageType(booking) || "-"],
      ["Storage Location", getLocationName(booking)],
      ["Vehicle Type", getLicensePlate(booking)]
    );
  }

  if (isAirportBooking(booking)) {
    rows.push(
      ["Parking Location", getLocationName(booking)],
      ["Entry Date", formatDate(booking?.start_date)],
      ["Exit Date", formatDate(booking?.end_date)]
    );

    if (hasBookingShuttle(booking)) {
      rows.push(
        ["Passengers", getPax(booking)],
        ["Shuttle Time", getShuttleTime(booking)]
      );
    }

    rows.push(["License Plate", getLicensePlate(booking)]);
  }

  rows.push(
    ["Interlock", getInterlock(booking)],
    ["Total Amount", money(booking?.price)],
    ["Paid Amount", money(booking?.paid_amount)],
    ["Due", money(booking?.due_amount)],
    ["Payment Method", formatText(booking?.payment_method)],
    ["Payment Reference", getProviderReference(booking)],
    ["Notes", booking?.notes || "-"],
    ["New Admin Note", getNewAdminNote(booking) || "-"]
  );

  return rows;
}

function printBooking(booking) {
  const rows = getPrintableRows(booking);

  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Booking ${booking?.booking_id || ""}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { margin-bottom: 4px; }
          p { margin-top: 0; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          td { border: 1px solid #e5e7eb; padding: 10px; font-size: 14px; }
          td:first-child { width: 230px; font-weight: bold; background: #f9fafb; color: #374151; }
          .footer { margin-top: 24px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <h1>Booking ${booking?.booking_id || ""}</h1>
        <p>Printed from Admin Dashboard</p>
        <table>
          <tbody>
            ${rows
              .map(
                ([label, value]) =>
                  `<tr><td>${label}</td><td>${value || "-"}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        <div class="footer">Generated at ${formatDateTime(new Date())}</div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

function ViewBookingModal({ booking, onClose }) {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Booking Details
            </h2>
            <p className="text-sm text-gray-500">{booking.booking_id}</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => printBooking(booking)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Print
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-6">
          <DetailRow
            label="Booking Status"
            value={getBookingStatusLabel(booking)}
          />

          {booking.admin_action_type && (
            <DetailRow label="Admin Action" value={getAdminActionLabel(booking)} />
          )}

          <DetailRow
            label="Payment Status"
            value={getPaymentStatusLabel(booking)}
          />

          {booking.admin_action_type && (
            <>
              <DetailRow
                label="Paid Amount"
                value={money(booking.admin_action_paid_amount)}
              />
              <DetailRow
                label="Admin Fee"
                value={money(booking.admin_action_fee_amount)}
              />
              <DetailRow
                label="Returned Amount"
                value={money(booking.admin_action_return_amount)}
              />
            </>
          )}

          <DetailRow
            label="Created Date"
            value={formatDateTime(booking.createdAt)}
          />
          <DetailRow label="Name" value={getCustomerName(booking)} />
          <DetailRow label="Phone" value={getCustomerPhone(booking)} />
          <DetailRow label="Email" value={getCustomerEmail(booking)} />

          {isCruiseBooking(booking) && (
            <>
              <DetailRow label="Ship Name" value={getShipName(booking)} />
              <DetailRow
                label="Ship Departure Date"
                value={formatDate(booking.start_date)}
              />
              <DetailRow
                label="Ship Arrival Date"
                value={formatDate(booking.end_date)}
              />
              <DetailRow
                label="Car park to terminal"
                value={getCruiseCarParkToTerminalPassengers(booking)}
              />
              <DetailRow
                label="Car park to terminal Shuttle Options"
                value={getCruiseCarParkToTerminalShuttleOption(booking)}
              />
              <DetailRow
                label="Terminal to car park"
                value={getCruiseTerminalToCarParkPassengers(booking)}
              />
              <DetailRow
                label="Terminal to car park Shuttle Options"
                value={getCruiseTerminalToCarParkShuttleOption(booking)}
              />
              <DetailRow label="Pick Up Pax" value={getPickupPaxPro(booking)} />
              <DetailRow
                label="Parking Slot Number"
                value={getParkingSlotNumber(booking)}
              />
              <DetailRow
                label="License Plate"
                value={getLicensePlate(booking)}
              />

              {hasCruiseAddOnVehicle(booking) && (
                <>
                  <DetailRow
                    label="Add On Vehicle"
                    value={getCruiseAddOnVehicleName(booking)}
                  />
                  <DetailRow
                    label={getCruiseAddOnVehicleLicensePlateLabel(booking)}
                    value={getCruiseAddOnVehicleLicensePlate(booking)}
                  />
                </>
              )}
            </>
          )}

          {isStorageBooking(booking) && (
            <>
              <DetailRow
                label="Entry Date"
                value={formatDate(booking.start_date)}
              />
              <DetailRow
                label="Exit Date"
                value={formatDate(booking.end_date)}
              />
              <DetailRow
                label="Storage Type"
                value={getStorageType(booking) || "-"}
              />
              <DetailRow
                label="Storage Location"
                value={getLocationName(booking)}
              />
              <DetailRow
                label="Vehicle Type"
                value={getLicensePlate(booking)}
              />
            </>
          )}

          {isAirportBooking(booking) && (
            <>
              <DetailRow
                label="Parking Location"
                value={getLocationName(booking)}
              />
              <DetailRow
                label="Entry Date"
                value={formatDate(booking.start_date)}
              />
              <DetailRow
                label="Exit Date"
                value={formatDate(booking.end_date)}
              />

              {hasBookingShuttle(booking) && (
                <>
                  <DetailRow label="Passengers" value={getPax(booking)} />
                  <DetailRow
                    label="Shuttle Time"
                    value={getShuttleTime(booking)}
                  />
                </>
              )}

              <DetailRow
                label="License Plate"
                value={getLicensePlate(booking)}
              />
            </>
          )}

          <DetailRow label="Interlock" value={getInterlock(booking)} />
          <DetailRow label="Total Amount" value={money(booking.price)} />
          <DetailRow label="Paid Amount" value={money(booking.paid_amount)} />
          <DetailRow label="Due" value={money(booking.due_amount)} />
          <DetailRow
            label="Payment Method"
            value={formatText(booking.payment_method)}
          />
          <DetailRow
            label="Payment Reference"
            value={getProviderReference(booking)}
          />
          <DetailRow label="Notes" value={booking.notes || "-"} />
          <DetailRow
            label="Admin Note"
            value={getNewAdminNote(booking) || "-"}
          />
        </div>
      </div>
    </div>
  );
}

function BookingImagesModal({ booking, onClose }) {
  if (!booking) return null;

  const images = getBookingAdminImages(booking);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Booking Images</h2>
            <p className="text-sm text-gray-500">
              {booking.booking_id} · {images.length} image{images.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        <div className="p-6">
          {images.length === 0 ? (
            <p className="text-sm text-gray-500">No booking images uploaded.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => (
                <a
                  key={getBookingAdminImageKey(image, index)}
                  href={image.url}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-xl border bg-gray-50"
                  title="Open full image"
                >
                  <img
                    src={image.url}
                    alt={`Booking image ${index + 1}`}
                    className="h-64 w-full object-contain"
                  />
                  <div className="border-t bg-white px-3 py-2 text-xs text-gray-600">
                    Image {index + 1}
                    {image.original_name ? ` · ${image.original_name}` : ""}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditBookingModal({
  booking,
  editForm,
  updateEditField,
  editExistingImages,
  editNewImages,
  editImagesToRemove,
  handleEditImagesChange,
  handleRemoveExistingImage,
  handleRemoveNewImage,
  onClose,
  onSubmit,
  saving,
  storageLocations = [],
  airportLocations = [],
  storageTypes = [],
  editCruiseShuttleSlots = [],
  editCruiseShuttleLoading = false,
  editCruiseShuttleError = "",
  handleEditCruiseShuttleChange,
  editAirportShuttleSlots = [],
  editAirportShuttleLoading = false,
  editAirportShuttleError = "",
  handleEditAirportShuttleChange,
  handleEditAirportLocationChange,
}) {
  if (!booking) return null;

  const isCruise = isCruiseBooking(booking);
  const isStorage = isStorageBooking(booking);
  const isAirport = isAirportBooking(booking);

  function getCruiseDirectionSlots(directionKey) {
    const direction = adminCruiseShuttleDirections[directionKey];

    if (!direction) return [];

    return editCruiseShuttleSlots.filter(
      (slot) =>
        slot &&
        slot.type === "cruise" &&
        slot.is_active !== false &&
        slot[direction.showField] !== false
    );
  }

  function renderCruiseShuttleSelector(directionKey, label) {
    const direction = adminCruiseShuttleDirections[directionKey];

    if (!direction) return null;

    const directionSlots = getCruiseDirectionSlots(directionKey);
    const selectedSlotId = String(editForm[direction.slotIdField] || "");
    const selectedTime = String(editForm[direction.timeField] || "").trim();
    const passengerCount = Number(
      editForm[direction.passengerField] || 0
    );

    return (
      <div>
        <label className="text-sm font-semibold text-gray-700">
          {label}
        </label>

        {editCruiseShuttleLoading ? (
          <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Loading real-time shuttle availability...
          </div>
        ) : directionSlots.length > 0 ? (
          <select
            value={selectedSlotId}
            onChange={(event) =>
              handleEditCruiseShuttleChange(
                directionKey,
                event.target.value
              )
            }
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
              selectedSlotId
                ? "border-blue-500 bg-blue-50 text-gray-900 focus:border-blue-600"
                : "border-gray-300 bg-white focus:border-blue-600"
            }`}
            required
          >
            <option value="">Select shuttle option</option>

            {directionSlots.map((slot) => {
              const slotId = getShuttleSlotId(slot);
              const remaining = getCruiseDirectionRemaining(
                slot,
                directionKey
              );
              const selected =
                String(selectedSlotId) === String(slotId);
              const disabled =
                !selected && remaining < Math.max(passengerCount, 1);

              return (
                <option
                  key={`${directionKey}-${slotId}`}
                  value={slotId}
                  disabled={disabled}
                >
                  {getShuttleSlotTime(slot)} — remaining {remaining}
                  {selected ? " (Selected)" : ""}
                  {disabled ? " (not enough capacity)" : ""}
                </option>
              );
            })}
          </select>
        ) : (
          <div className="mt-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            {editCruiseShuttleError ||
              `No ${label.toLowerCase()} are available for this departure date.`}
          </div>
        )}

    
      </div>
    );
  }

  const airportShuttleSlots = editAirportShuttleSlots;

  const showAirportShuttleFields =
    isAirport &&
    (editAirportShuttleLoading ||
      airportShuttleSlots.length > 0 ||
      Boolean(editForm.shuttle_time) ||
      Boolean(editAirportShuttleError));

  const storageLocationOptions = [...storageLocations];

  if (
    isStorage &&
    editForm.location_id &&
    !storageLocationOptions.some(
      (location) => String(location._id) === String(editForm.location_id)
    )
  ) {
    storageLocationOptions.push({
      _id: editForm.location_id,
      name: getLocationName(booking),
    });
  }

  const airportLocationOptions = [...airportLocations];

  if (
    isAirport &&
    editForm.location_id &&
    !airportLocationOptions.some(
      (location) => String(location._id) === String(editForm.location_id)
    )
  ) {
    airportLocationOptions.push({
      _id: editForm.location_id,
      name: getLocationName(booking),
      shuttle_slots: [],
    });
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Booking</h2>
            <p className="text-sm text-gray-500">
              {booking.booking_id} · {formatText(booking.type)}
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
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={editForm.email}
                onChange={(event) =>
                  updateEditField("email", event.target.value)
                }
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Phone
              </label>
              <input
                value={editForm.phone}
                onChange={(event) =>
                  updateEditField("phone", event.target.value)
                }
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                required
              />
            </div>

            {isCruise && (
              <>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Ship Name
                  </label>
                  <input
                    value={editForm.ship_name}
                    onChange={(event) =>
                      updateEditField("ship_name", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    License Plate
                  </label>
                  <input
                    value={editForm.license_plate}
                    onChange={(event) =>
                      updateEditField("license_plate", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm uppercase"
                  />
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.add_on_vehicle_enabled)}
                      onChange={(event) =>
                        updateEditField(
                          "add_on_vehicle_enabled",
                          event.target.checked
                        )
                      }
                    />
                    Add On Vehicle
                  </label>

                  {editForm.add_on_vehicle_enabled && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-semibold text-gray-700">
                          Select Vehicle
                        </label>
                        <select
                          value={editForm.add_on_vehicle_type}
                          onChange={(event) =>
                            updateEditField(
                              "add_on_vehicle_type",
                              event.target.value
                            )
                          }
                          className="mt-2 w-full rounded-xl border bg-white px-4 py-2 text-sm"
                          required={Boolean(editForm.add_on_vehicle_enabled)}
                        >
                          {adminCruiseAddOnVehicleOptions.map((option) => (
                            <option
                              key={option.value || "select-add-on-vehicle"}
                              value={option.value}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {editForm.add_on_vehicle_type && (
                        <div>
                          <label className="text-sm font-semibold text-gray-700">
                            {editForm.add_on_vehicle_type} License Plate
                          </label>
                          <input
                            value={editForm.add_on_vehicle_license_plate}
                            onChange={(event) =>
                              updateEditField(
                                "add_on_vehicle_license_plate",
                                event.target.value
                              )
                            }
                            className="mt-2 w-full rounded-xl border bg-white px-4 py-2 text-sm uppercase"
                            required={Boolean(editForm.add_on_vehicle_enabled)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Ship Departure Date
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(event) =>
                      updateEditField("start_date", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Ship Arrival Date
                  </label>
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(event) =>
                      updateEditField("end_date", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Car park to terminal
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.car_park_to_terminal_passengers}
                    onChange={(event) =>
                      updateEditField(
                        "car_park_to_terminal_passengers",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>

                {renderCruiseShuttleSelector(
                  "carParkToTerminal",
                  "Car park to terminal Shuttle Options"
                )}

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Terminal to car park
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.terminal_to_car_park_passengers}
                    onChange={(event) =>
                      updateEditField(
                        "terminal_to_car_park_passengers",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>

                {renderCruiseShuttleSelector(
                  "terminalToCarPark",
                  "Terminal to car park Shuttle Options"
                )}

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Parking Slot Number
                  </label>
                  <input
                    value={editForm.parking_slot}
                    onChange={(event) =>
                      updateEditField("parking_slot", event.target.value)
                    }
                    placeholder="Enter parking slot number"
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {isStorage && (
              <>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Entry Date
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(event) =>
                      updateEditField("start_date", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Exit Date
                  </label>
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(event) =>
                      updateEditField("end_date", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Storage Type
                  </label>

                  {storageTypes.length > 0 ? (
                    <select
                      value={editForm.storage_type}
                      onChange={(event) =>
                        updateEditField("storage_type", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                    >
                      <option value="">Select storage type</option>
                      {storageTypes.map((storageType) => (
                        <option
                          key={storageType._id || storageType.name}
                          value={storageType.name}
                        >
                          {storageType.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={editForm.storage_type}
                      onChange={(event) =>
                        updateEditField("storage_type", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Storage Location
                  </label>

                  {storageLocationOptions.length > 0 ? (
                    <select
                      value={editForm.location_id}
                      onChange={(event) =>
                        updateEditField("location_id", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                    >
                      <option value="">Select storage location</option>
                      {storageLocationOptions.map((location) => (
                        <option key={location._id} value={location._id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={editForm.location_id}
                      onChange={(event) =>
                        updateEditField("location_id", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                    />
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Vehicle Type
                  </label>
                  <input
                    value={editForm.license_plate}
                    onChange={(event) =>
                      updateEditField("license_plate", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {isAirport && (
              <>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Parking Location
                  </label>

                  {airportLocationOptions.length > 0 ? (
                    <select
                      value={editForm.location_id}
                      onChange={(event) =>
                        handleEditAirportLocationChange(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                    >
                      <option value="">Select parking location</option>
                      {airportLocationOptions.map((location) => (
                        <option key={location._id} value={location._id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={editForm.location_id}
                      onChange={(event) =>
                        updateEditField("location_id", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    License Plate
                  </label>
                  <input
                    value={editForm.license_plate}
                    onChange={(event) =>
                      updateEditField("license_plate", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Entry Date
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(event) =>
                      updateEditField("start_date", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Exit Date
                  </label>
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(event) =>
                      updateEditField("end_date", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                  />
                </div>

                {showAirportShuttleFields && (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">
                        Passengers
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.pax}
                        onChange={(event) =>
                          updateEditField("pax", event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">
                        Shuttle Time
                      </label>

                      {editAirportShuttleLoading ? (
                        <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                          Loading real-time shuttle availability...
                        </div>
                      ) : airportShuttleSlots.length > 0 ? (
                        <>
                          <select
                            value={editForm.shuttle_slot_id}
                            onChange={(event) =>
                              handleEditAirportShuttleChange(event.target.value)
                            }
                            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
                              editForm.shuttle_slot_id
                                ? "border-blue-500 bg-blue-50 text-gray-900 focus:border-blue-600"
                                : "border-gray-300 bg-white focus:border-blue-600"
                            }`}
                          >
                            <option value="">Select shuttle time</option>

                            {airportShuttleSlots.map((slot) => {
                              const slotId = getShuttleSlotId(slot);
                              const remaining = getAirportShuttleRemaining(slot);
                              const selected =
                                String(editForm.shuttle_slot_id) ===
                                String(slotId);
                              const disabled =
                                !selected &&
                                remaining <
                                  Math.max(Number(editForm.pax || 0), 1);

                              return (
                                <option
                                  key={slotId}
                                  value={slotId}
                                  disabled={disabled}
                                >
                                  {getShuttleSlotTime(slot)} — remaining{" "}
                                  {remaining}
                                  {selected ? " (Selected)" : ""}
                                  {disabled
                                    ? " (not enough capacity)"
                                    : ""}
                                </option>
                              );
                            })}
                          </select>

                      
                        </>
                      ) : (
                        <div className="mt-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                          {editAirportShuttleError ||
                            "No airport shuttle options are available for this entry date."}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-700">
                Upload Images
              </label>

              <div className="mt-2 rounded-xl border p-4">
                {editExistingImages.length === 0 && editNewImages.length === 0 ? (
                  <p className="mb-4 text-sm text-gray-500">
                    No images uploaded.
                  </p>
                ) : (
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {editExistingImages.map((image, index) => {
                      const imageKey = getBookingAdminImageKey(image, index);
                      const markedForRemoval = editImagesToRemove.some(
                        (item) => item.key === imageKey
                      );

                      return (
                        <div
                          key={imageKey}
                          className={`rounded-xl border p-2 ${
                            markedForRemoval ? "opacity-40" : ""
                          }`}
                        >
                          <img
                            src={image.url}
                            alt={`Existing booking image ${index + 1}`}
                            className="h-40 w-full rounded-lg object-contain"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveExistingImage(image, index)
                            }
                            disabled={saving}
                            className="mt-2 w-full rounded-lg border px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-60"
                          >
                            {markedForRemoval ? "Keep Image" : "Remove Image"}
                          </button>
                        </div>
                      );
                    })}

                    {editNewImages.map((item, index) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-blue-200 bg-blue-50 p-2"
                      >
                        <img
                          src={item.preview}
                          alt={`New booking image ${index + 1}`}
                          className="h-40 w-full rounded-lg object-contain"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveNewImage(item.id)}
                          disabled={saving}
                          className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-60"
                        >
                          Remove Image
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700">
                    Add Images
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={saving}
                      onClick={(event) => {
                        event.currentTarget.value = "";
                      }}
                      onChange={handleEditImagesChange}
                    />
                  </label>
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  JPG, PNG, or WebP. Maximum 5MB per image. Up to 10 images per booking.
                </p>

                {editNewImages.length > 0 && (
                  <p className="mt-2 text-xs font-semibold text-blue-700">
                    {editNewImages.length} new image
                    {editNewImages.length === 1 ? "" : "s"} will be uploaded when you save changes.
                  </p>
                )}

                {editImagesToRemove.length > 0 && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    {editImagesToRemove.length} image
                    {editImagesToRemove.length === 1 ? "" : "s"} will be removed when you save changes.
                  </p>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-700">
               Notes
              </label>
              <textarea
                rows={4}
                value={editForm.new_admin_note}
                onChange={(event) =>
                  updateEditField("new_admin_note", event.target.value)
                }
                placeholder="Notes"
                className="mt-2 w-full rounded-xl border px-4 py-2 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={editForm.resend_confirmation}
              onChange={(event) =>
                updateEditField("resend_confirmation", event.target.checked)
              }
            />
            Resend confirmation email after saving
          </label>

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
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FeeChoiceModal({ feeAction, onClose, onChoose }) {
  if (!feeAction?.booking || !feeAction?.action) return null;

  const booking = feeAction.booking;
  const action = feeAction.action;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-gray-900">
          {getActionTitle(action)} Option
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          Choose how much to return for booking{" "}
          <strong>{booking.booking_id}</strong>.
        </p>

        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
          <p>
            <strong>Total:</strong> {money(booking.price)}
          </p>

          <p className="mt-1">
            <strong>Paid:</strong> {money(booking.paid_amount)}
          </p>

          <p className="mt-1">
            <strong>Payment Flow:</strong> {formatText(booking.payment_flow)}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => onChoose("full")}
            className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white"
          >
            {getFullActionLabel(action)}
          </button>

          <button
            type="button"
            onClick={() => onChoose("deduct_10")}
            className="w-full rounded-xl bg-yellow-600 px-4 py-3 text-sm font-semibold text-white"
          >
            {getDeductActionLabel(action)}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border px-4 py-3 text-sm font-semibold text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function getDefaultBookingFilters(search = "") {
  return {
    search,
    status: "",
    payment_status: "",
    payment_method: "",
    payment_flow: "",

    cruise: "",
    shuttle_slot: "",
    ship_departure_from: "",
    ship_arrival: "",

    booked_month: "",
    date_booked_from: "",
    date_booked_to: "",

    limit: 20,
  };
}

function isBookingIdSearch(value) {
  const text = String(value || "").trim();

  return /^(BK|CR|ST|AP)[A-Z0-9-]+$/i.test(text);
}

export default function BookingListPage({ bookingType }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingIdFromUrl = String(
    searchParams.get("booking_id") || searchParams.get("search") || ""
  ).trim();

  const calendarDateFromUrl = String(
    searchParams.get("calendar_date") || ""
  ).trim();

  const rawCalendarFilterFromUrl = String(
    searchParams.get("calendar_filter") || ""
  )
    .trim()
    .toLowerCase();

  const calendarFilterFromUrl = allowedCalendarFilters.includes(
    rawCalendarFilterFromUrl
  )
    ? rawCalendarFilterFromUrl
    : "";

  const hasCalendarFilter = Boolean(
    calendarDateFromUrl && calendarFilterFromUrl
  );

  const config = bookingTypeConfig[bookingType] || bookingTypeConfig.cruise;

  const [mounted, setMounted] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  });

  const [filters, setFilters] = useState(() =>
    getDefaultBookingFilters(bookingIdFromUrl)
  );

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewBooking, setViewBooking] = useState(null);
  const [viewImagesBooking, setViewImagesBooking] = useState(null);
  const [editBooking, setEditBooking] = useState(null);
  const [editForm, setEditForm] = useState({
    email: "",
    phone: "",
    start_date: "",
    end_date: "",
    ship_name: "",
    storage_type: "",
    location_id: "",
    license_plate: "",
    shuttle_slot_id: "",
    shuttle_time: "",
    pax: 0,
    car_park_to_terminal_passengers: 0,
    car_park_to_terminal_shuttle_slot_id: "",
    car_park_to_terminal_shuttle_time: "",
    terminal_to_car_park_passengers: 0,
    terminal_to_car_park_shuttle_slot_id: "",
    terminal_to_car_park_shuttle_time: "",
    add_on_vehicle_enabled: false,
    add_on_vehicle_type: "",
    add_on_vehicle_license_plate: "",
    parking_slot: "",
    pickup_pax: 0,
    pickup_pax_pro: 0,
    new_admin_note: "",
    resend_confirmation: true,
  });

  const [editExistingImages, setEditExistingImages] = useState([]);
  const [editNewImages, setEditNewImages] = useState([]);
  const [editImagesToRemove, setEditImagesToRemove] = useState([]);

  const [storageLocations, setStorageLocations] = useState([]);
  const [airportLocations, setAirportLocations] = useState([]);
  const [storageTypes, setStorageTypes] = useState([]);
  const [cruiseSchedules, setCruiseSchedules] = useState([]);

  const [editCruiseShuttleSlots, setEditCruiseShuttleSlots] = useState([]);
  const [editCruiseShuttleLoading, setEditCruiseShuttleLoading] =
    useState(false);
  const [editCruiseShuttleError, setEditCruiseShuttleError] = useState("");

  const [editAirportShuttleSlots, setEditAirportShuttleSlots] = useState([]);
  const [editAirportShuttleLoading, setEditAirportShuttleLoading] =
    useState(false);
  const [editAirportShuttleError, setEditAirportShuttleError] = useState("");

  const [savingEdit, setSavingEdit] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [feeAction, setFeeAction] = useState(null);
  const [createBookingOpen, setCreateBookingOpen] = useState(false);

  const fetchBookings = useCallback(async () => {
    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const searchText = String(filters.search || "").trim();

      const res = await axios.get("/admin/bookings", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          type: bookingType,
          page,
          limit: hasCalendarFilter ? Math.max(Number(filters.limit || 20), 100) : filters.limit,
          sort_by: sortBy,
          sort_order: sortOrder,

          search: searchText || undefined,
          booking_id: isBookingIdSearch(searchText) ? searchText : undefined,

          status: filters.status || undefined,
          payment_status: filters.payment_status || undefined,
          payment_method: filters.payment_method || undefined,
          payment_flow: filters.payment_flow || undefined,

          cruise:
            bookingType === "cruise" ? filters.cruise || undefined : undefined,

          shuttle_slot:
            bookingType === "cruise"
              ? filters.shuttle_slot || undefined
              : undefined,

          ship_departure_from:
            bookingType === "cruise"
              ? filters.ship_departure_from || undefined
              : undefined,

          ship_arrival:
            bookingType === "cruise"
              ? filters.ship_arrival || undefined
              : undefined,

          booked_month: filters.booked_month || undefined,
          date_booked_from: filters.date_booked_from || undefined,
          date_booked_to: filters.date_booked_to || undefined,

          calendar_date: hasCalendarFilter ? calendarDateFromUrl : undefined,
          calendar_filter: hasCalendarFilter
            ? calendarFilterFromUrl
            : undefined,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to load bookings."
        );
      }

      setBookings(res.data.data?.bookings || []);
//       console.log(
//   "BACKEND BOOKINGS:",
//   res.data.data?.bookings?.length
// );
      setSummary(res.data.data?.summary || null);
      setBreakdown(res.data.data?.breakdown || null);
      setPagination(
        res.data.data?.pagination || {
          page,
          limit: filters.limit,
          total: 0,
          total_pages: 1,
        }
      );
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to load bookings.";

      setError(message);

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        router.replace("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  }, [
    bookingType,
    filters,
    page,
    router,
    sortBy,
    sortOrder,
    hasCalendarFilter,
    calendarDateFromUrl,
    calendarFilterFromUrl,
  ]);

  const fetchReferenceData = useCallback(async () => {
    const token = getAdminToken();

    if (!token) return;

    try {
      if (bookingType === "cruise") {
        const schedulesRes = await axios.get("/admin/cruise-schedules", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            limit: 100,
            is_active: true,
          },
        });

        setCruiseSchedules(extractCruiseSchedules(schedulesRes));
      }

      if (bookingType === "storage") {
        const [locationsRes, storageTypesRes] = await Promise.all([
          axios.get("/admin/locations", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              type: "storage",
              limit: 100,
            },
          }),
          axios.get("/admin/storage-types", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              limit: 100,
            },
          }),
        ]);

        setStorageLocations(extractAdminLocations(locationsRes));
        setStorageTypes(extractStorageTypes(storageTypesRes));
      }

      if (bookingType === "airport") {
        const locationsRes = await axios.get("/admin/locations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            type: "airport",
            limit: 100,
          },
        });

        setAirportLocations(extractAdminLocations(locationsRes));
      }
    } catch (error) {
      console.error("Booking edit reference data load failed:", error);
    }
  }, [bookingType]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!bookingIdFromUrl) return;

    setFilters((prev) => ({
      ...getDefaultBookingFilters(bookingIdFromUrl),
      limit: prev.limit || 20,
    }));

    setSortBy("booking_id");
    setSortOrder("asc");
    setPage(1);
  }, [bookingIdFromUrl, bookingType]);

  useEffect(() => {
    if (!hasCalendarFilter) return;

    setFilters((prev) => ({
      ...getDefaultBookingFilters(""),
      limit: prev.limit || 20,
    }));

    setSortBy("start_date");
    setSortOrder("asc");
    setPage(1);
  }, [hasCalendarFilter, calendarDateFromUrl, calendarFilterFromUrl, bookingType]);

  useEffect(() => {
    setPage(1);
  }, [
    bookingType,
    filters.search,
    filters.status,
    filters.payment_status,
    filters.payment_method,
    filters.payment_flow,
    filters.cruise,
    filters.shuttle_slot,
    filters.ship_departure_from,
    filters.ship_arrival,
    filters.booked_month,
    filters.date_booked_from,
    filters.date_booked_to,
    filters.limit,
    calendarDateFromUrl,
    calendarFilterFromUrl,
  ]);

  useEffect(() => {
    if (!mounted) return;
    fetchBookings();
    fetchReferenceData();
  }, [mounted, fetchBookings, fetchReferenceData]);



const visibleBookings = useMemo(() => {
  let rows = [...bookings];

  if (bookingIdFromUrl) {
    rows = rows.filter((booking) => {
      return (
        String(booking.booking_id || "").toLowerCase() ===
        bookingIdFromUrl.toLowerCase()
      );
    });
  }

  return rows;
}, [
  bookings,
  bookingIdFromUrl,
]);


  const displaySummary = useMemo(() => {
    return buildBookingSummaryFromRows(visibleBookings);
  }, [visibleBookings]);

  const displayStatusBreakdown = useMemo(() => {
    return buildStatusBreakdownFromRows(visibleBookings);
  }, [visibleBookings]);

  const statusBreakdown = useMemo(() => {
    if (hasCalendarFilter || bookingIdFromUrl) {
      return displayStatusBreakdown;
    }

    return breakdown?.by_status || displayStatusBreakdown || [];
  }, [breakdown, displayStatusBreakdown, hasCalendarFilter, bookingIdFromUrl]);

  function updateFilter(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function clearFilters() {
    setFilters(getDefaultBookingFilters(""));

    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);

    router.replace(`/admin/bookings/${bookingType}`);
  }

  function clearCalendarFilter() {
    setFilters(getDefaultBookingFilters(""));

    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);

    router.replace(`/admin/bookings/${bookingType}`);
  }

  function handleSort(field) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(field);
    setSortOrder("desc");
  }

  async function loadEditCruiseShuttleSlots(
    booking,
    formValues = null
  ) {
    if (!isCruiseBooking(booking)) {
      setEditCruiseShuttleSlots([]);
      setEditCruiseShuttleError("");
      return;
    }

    const scheduleId = getBookingCruiseScheduleId(
      booking,
      cruiseSchedules
    );

    const departureDate =
      formValues?.start_date || toDateInputValue(booking?.start_date);

    if (!scheduleId) {
      setEditCruiseShuttleSlots([]);
      setEditCruiseShuttleError(
        "Cruise schedule ID could not be found for this booking."
      );
      return;
    }

    if (!departureDate) {
      setEditCruiseShuttleSlots([]);
      setEditCruiseShuttleError(
        "Ship departure date is required to load shuttle options."
      );
      return;
    }

    try {
      setEditCruiseShuttleLoading(true);
      setEditCruiseShuttleError("");
      setEditCruiseShuttleSlots([]);

      const res = await axios.get("/settings/shuttle-time-slots", {
        params: {
          type: "cruise",
          schedule_id: scheduleId,
          departure_date: departureDate,
          booking_id: getBookingIdentifier(booking),
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load real-time cruise shuttle availability."
        );
      }

      const rawSlots =
        res.data.data?.available_shuttle_slots ||
        res.data.data?.shuttle_time_slots ||
        [];

      const normalizedSlots =
        normalizeAdminCruiseShuttleSlots(rawSlots);

      setEditCruiseShuttleSlots(normalizedSlots);

      if (normalizedSlots.length === 0) {
        setEditCruiseShuttleError(
          "No cruise shuttle options are configured for this departure date."
        );
        return;
      }

      const currentForm = formValues || {};

      const hasCarParkSlotId = Object.prototype.hasOwnProperty.call(
        currentForm,
        "car_park_to_terminal_shuttle_slot_id"
      );

      const hasTerminalSlotId = Object.prototype.hasOwnProperty.call(
        currentForm,
        "terminal_to_car_park_shuttle_slot_id"
      );

      const hasCarParkTime = Object.prototype.hasOwnProperty.call(
        currentForm,
        "car_park_to_terminal_shuttle_time"
      );

      const hasTerminalTime = Object.prototype.hasOwnProperty.call(
        currentForm,
        "terminal_to_car_park_shuttle_time"
      );

      const currentCarParkSlotId = String(
        hasCarParkSlotId
          ? currentForm.car_park_to_terminal_shuttle_slot_id || ""
          : getBookingCruiseCarParkToTerminalSlotId(booking)
      );

      const currentTerminalSlotId = String(
        hasTerminalSlotId
          ? currentForm.terminal_to_car_park_shuttle_slot_id || ""
          : getBookingCruiseTerminalToCarParkSlotId(booking)
      );

      const currentCarParkTime = String(
        hasCarParkTime
          ? currentForm.car_park_to_terminal_shuttle_time || ""
          : getCleanEditText(
              getCruiseCarParkToTerminalShuttleOption(booking)
            )
      ).trim();

      const currentTerminalTime = String(
        hasTerminalTime
          ? currentForm.terminal_to_car_park_shuttle_time || ""
          : getCleanEditText(
              getCruiseTerminalToCarParkShuttleOption(booking)
            )
      ).trim();

      const carParkSlot =
        normalizedSlots.find(
          (slot) =>
            currentCarParkSlotId &&
            String(getShuttleSlotId(slot)) === currentCarParkSlotId
        ) ||
        normalizedSlots.find(
          (slot) =>
            currentCarParkTime &&
            getShuttleSlotTime(slot).toLowerCase() ===
              currentCarParkTime.toLowerCase()
        );

      const terminalSlot =
        normalizedSlots.find(
          (slot) =>
            currentTerminalSlotId &&
            String(getShuttleSlotId(slot)) === currentTerminalSlotId
        ) ||
        normalizedSlots.find(
          (slot) =>
            currentTerminalTime &&
            getShuttleSlotTime(slot).toLowerCase() ===
              currentTerminalTime.toLowerCase()
        );

      setEditForm((prev) => ({
        ...prev,
        car_park_to_terminal_shuttle_slot_id:
          getShuttleSlotId(carParkSlot) ||
          prev.car_park_to_terminal_shuttle_slot_id ||
          "",
        car_park_to_terminal_shuttle_time:
          getShuttleSlotTime(carParkSlot) ||
          prev.car_park_to_terminal_shuttle_time ||
          "",
        terminal_to_car_park_shuttle_slot_id:
          getShuttleSlotId(terminalSlot) ||
          prev.terminal_to_car_park_shuttle_slot_id ||
          "",
        terminal_to_car_park_shuttle_time:
          getShuttleSlotTime(terminalSlot) ||
          prev.terminal_to_car_park_shuttle_time ||
          "",
      }));
    } catch (error) {
      setEditCruiseShuttleSlots([]);
      setEditCruiseShuttleError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load real-time cruise shuttle availability."
      );
    } finally {
      setEditCruiseShuttleLoading(false);
    }
  }

  async function loadEditAirportShuttleSlots(
    booking,
    formValues = null
  ) {
    if (!isAirportBooking(booking)) {
      setEditAirportShuttleSlots([]);
      setEditAirportShuttleError("");
      return;
    }

    const currentForm = formValues || {};

    const locationId = String(
      currentForm.location_id ||
        booking?.location_id?._id ||
        booking?.location_id ||
        ""
    );

    const entryDate =
      currentForm.start_date || toDateInputValue(booking?.start_date);

    if (!locationId) {
      setEditAirportShuttleSlots([]);
      setEditAirportShuttleError(
        "Airport parking location is required to load shuttle options."
      );
      return;
    }

    if (!entryDate) {
      setEditAirportShuttleSlots([]);
      setEditAirportShuttleError(
        "Entry date is required to load shuttle options."
      );
      return;
    }

    try {
      setEditAirportShuttleLoading(true);
      setEditAirportShuttleError("");
      setEditAirportShuttleSlots([]);

      const token = getAdminToken();

      const res = await axios.get("/airport-shuttle-availability", {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
        params: {
          location_id: locationId,
          date: entryDate,
          booking_id: getBookingIdentifier(booking),
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load real-time airport shuttle availability."
        );
      }

      const rawSlots =
        res.data.data?.available_shuttle_slots ||
        res.data.data?.shuttle_time_slots ||
        [];

      const normalizedSlots =
        normalizeAdminAirportShuttleSlots(rawSlots);

      setEditAirportShuttleSlots(normalizedSlots);

      if (normalizedSlots.length === 0) {
        setEditAirportShuttleError(
          "No airport shuttle options are available for this entry date."
        );
        return;
      }

      const hasSlotId = Object.prototype.hasOwnProperty.call(
        currentForm,
        "shuttle_slot_id"
      );

      const hasShuttleTime = Object.prototype.hasOwnProperty.call(
        currentForm,
        "shuttle_time"
      );

      const currentSlotId = String(
        hasSlotId
          ? currentForm.shuttle_slot_id || ""
          : getBookingAirportShuttleSlotId(booking)
      );

      const currentShuttleTime = String(
        hasShuttleTime
          ? currentForm.shuttle_time || ""
          : getCleanEditText(getShuttleTime(booking))
      ).trim();

      const selectedSlot =
        normalizedSlots.find(
          (slot) =>
            currentSlotId &&
            String(getShuttleSlotId(slot)) === currentSlotId
        ) ||
        normalizedSlots.find(
          (slot) =>
            currentShuttleTime &&
            getShuttleSlotTime(slot).toLowerCase() ===
              currentShuttleTime.toLowerCase()
        );

      setEditForm((prev) => ({
        ...prev,
        shuttle_slot_id:
          getShuttleSlotId(selectedSlot) ||
          prev.shuttle_slot_id ||
          "",
        shuttle_time:
          getShuttleSlotTime(selectedSlot) ||
          prev.shuttle_time ||
          "",
      }));
    } catch (error) {
      setEditAirportShuttleSlots([]);
      setEditAirportShuttleError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load real-time airport shuttle availability."
      );
    } finally {
      setEditAirportShuttleLoading(false);
    }
  }

  async function openEditModal(booking) {
    const shuttleTime = getShuttleTime(booking);
    const carParkToTerminalShuttleTime =
      getCruiseCarParkToTerminalShuttleOption(booking);
    const terminalToCarParkShuttleTime =
      getCruiseTerminalToCarParkShuttleOption(booking);
    const cruiseAddOnVehicle = getCruiseAddOnVehicle(booking);

    const nextEditForm = {
      email:
        getCustomerEmail(booking) === "-"
          ? ""
          : getCustomerEmail(booking),
      phone:
        getCustomerPhone(booking) === "-"
          ? ""
          : getCustomerPhone(booking),
      start_date: toDateInputValue(booking?.start_date),
      end_date: toDateInputValue(booking?.end_date),
      ship_name:
        getShipName(booking) === "-" ? "" : getShipName(booking),
      storage_type: getStorageType(booking) || "",
      location_id: getLocationId(booking),
      license_plate:
        getLicensePlate(booking) === "-"
          ? ""
          : getLicensePlate(booking),
      add_on_vehicle_enabled: cruiseAddOnVehicle.enabled,
      add_on_vehicle_type: cruiseAddOnVehicle.type,
      add_on_vehicle_license_plate: cruiseAddOnVehicle.licensePlate,
      shuttle_slot_id: getBookingAirportShuttleSlotId(booking),
      shuttle_time: getCleanEditText(shuttleTime),
      pax: Number(booking?.pax || getPax(booking) || 0),
      car_park_to_terminal_passengers:
        getCruiseCarParkToTerminalPassengerCount(booking),
      car_park_to_terminal_shuttle_slot_id:
        getBookingCruiseCarParkToTerminalSlotId(booking),
      car_park_to_terminal_shuttle_time: getCleanEditText(
        carParkToTerminalShuttleTime
      ),
      terminal_to_car_park_passengers:
        getCruiseTerminalToCarParkPassengerCount(booking),
      terminal_to_car_park_shuttle_slot_id:
        getBookingCruiseTerminalToCarParkSlotId(booking),
      terminal_to_car_park_shuttle_time: getCleanEditText(
        terminalToCarParkShuttleTime
      ),
      parking_slot: getParkingSlotNumber(booking),
      pickup_pax: Number(getPax(booking) || 0),
      pickup_pax_pro: Number(getPickupPaxPro(booking) || 0),
      new_admin_note: booking?.new_admin_note || "",
      resend_confirmation: true,
    };

    editNewImages.forEach((item) => {
      if (item.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(item.preview);
      }
    });

    setEditExistingImages(getBookingAdminImages(booking));
    setEditNewImages([]);
    setEditImagesToRemove([]);
    setEditCruiseShuttleSlots([]);
    setEditCruiseShuttleError("");
    setEditAirportShuttleSlots([]);
    setEditAirportShuttleError("");
    setEditBooking(booking);
    setEditForm(nextEditForm);

    if (isCruiseBooking(booking)) {
      await loadEditCruiseShuttleSlots(booking, nextEditForm);
    }

    if (isAirportBooking(booking)) {
      await loadEditAirportShuttleSlots(booking, nextEditForm);
    }
  }

  function updateEditField(name, value) {
    let nextEditForm = {
      ...editForm,
      [name]: value,
    };

    if (
      isCruiseBooking(editBooking) &&
      name === "add_on_vehicle_enabled" &&
      !value
    ) {
      nextEditForm = {
        ...nextEditForm,
        add_on_vehicle_type: "",
        add_on_vehicle_license_plate: "",
      };
    }

    if (isCruiseBooking(editBooking) && name === "add_on_vehicle_type") {
      nextEditForm = {
        ...nextEditForm,
        add_on_vehicle_license_plate: "",
      };
    }

    if (
      name === "start_date" &&
      isCruiseBooking(editBooking)
    ) {
      const clearedShuttleForm = {
        ...nextEditForm,
        car_park_to_terminal_shuttle_slot_id: "",
        car_park_to_terminal_shuttle_time: "",
        terminal_to_car_park_shuttle_slot_id: "",
        terminal_to_car_park_shuttle_time: "",
      };

      setEditForm(clearedShuttleForm);
      loadEditCruiseShuttleSlots(editBooking, clearedShuttleForm);
      return;
    }

    if (
      name === "start_date" &&
      isAirportBooking(editBooking)
    ) {
      const clearedAirportShuttleForm = {
        ...nextEditForm,
        shuttle_slot_id: "",
        shuttle_time: "",
      };

      setEditForm(clearedAirportShuttleForm);
      loadEditAirportShuttleSlots(
        editBooking,
        clearedAirportShuttleForm
      );
      return;
    }

    setEditForm(nextEditForm);
  }

  function handleEditAirportLocationChange(locationId) {
    if (!editBooking || !isAirportBooking(editBooking)) return;

    const nextEditForm = {
      ...editForm,
      location_id: locationId,
      shuttle_slot_id: "",
      shuttle_time: "",
    };

    setEditForm(nextEditForm);
    loadEditAirportShuttleSlots(editBooking, nextEditForm);
  }

  function handleEditAirportShuttleChange(slotId) {
    const selectedSlot = editAirportShuttleSlots.find(
      (slot) =>
        String(getShuttleSlotId(slot)) === String(slotId)
    );

    setEditForm((prev) => ({
      ...prev,
      shuttle_slot_id: String(slotId || ""),
      shuttle_time: getShuttleSlotTime(selectedSlot),
    }));

    setEditAirportShuttleError("");
  }

  function handleEditCruiseShuttleChange(directionKey, slotId) {
    const direction = adminCruiseShuttleDirections[directionKey];

    if (!direction) return;

    const selectedSlot = editCruiseShuttleSlots.find(
      (slot) =>
        String(getShuttleSlotId(slot)) === String(slotId)
    );

    setEditForm((prev) => ({
      ...prev,
      [direction.slotIdField]: String(slotId || ""),
      [direction.timeField]: getShuttleSlotTime(selectedSlot),
    }));

    setEditCruiseShuttleError("");
  }

  function handleEditImagesChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxImageSize = 5 * 1024 * 1024;

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        alert("Only JPG, PNG, and WebP images are allowed.");
        return;
      }

      if (file.size > maxImageSize) {
        alert(`${file.name} is larger than 5MB.`);
        return;
      }
    }

    const activeExistingCount = editExistingImages.filter((image, index) => {
      const key = getBookingAdminImageKey(image, index);
      return !editImagesToRemove.some((item) => item.key === key);
    }).length;

    if (activeExistingCount + editNewImages.length + files.length > 10) {
      alert("A booking can have a maximum of 10 images.");
      return;
    }

    const newItems = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }));

    setEditNewImages((prev) => [...prev, ...newItems]);
  }

  function handleRemoveExistingImage(image, index) {
    const key = getBookingAdminImageKey(image, index);

    setEditImagesToRemove((prev) => {
      const alreadyMarked = prev.some((item) => item.key === key);

      if (alreadyMarked) {
        return prev.filter((item) => item.key !== key);
      }

      return [
        ...prev,
        {
          key,
          image_id: String(image?.image_id || ""),
          public_id: String(image?.public_id || ""),
          url: String(image?.url || ""),
        },
      ];
    });
  }

  function handleRemoveNewImage(itemId) {
    setEditNewImages((prev) => {
      const item = prev.find((entry) => entry.id === itemId);

      if (item?.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(item.preview);
      }

      return prev.filter((entry) => entry.id !== itemId);
    });
  }

  function closeEditModal() {
    if (savingEdit) return;

    editNewImages.forEach((item) => {
      if (item.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(item.preview);
      }
    });

    setEditExistingImages([]);
    setEditNewImages([]);
    setEditImagesToRemove([]);
    setEditBooking(null);
    setEditCruiseShuttleSlots([]);
    setEditCruiseShuttleError("");
    setEditCruiseShuttleLoading(false);
    setEditAirportShuttleSlots([]);
    setEditAirportShuttleError("");
    setEditAirportShuttleLoading(false);
  }

  function openFeeAction(action, booking) {
    if (!needsFeeChoice(action, booking)) {
      runBookingAction(action, booking, "deduct_10");
      return;
    }

    setFeeAction({
      action,
      booking,
    });
  }

  function buildEditPayload() {
    const payload = {
      email: editForm.email,
      phone: editForm.phone,
      start_date: editForm.start_date,
      end_date: editForm.end_date,
      license_plate: editForm.license_plate,
      new_admin_note: String(editForm.new_admin_note || "").trim(),
      resend_confirmation: Boolean(editForm.resend_confirmation),
      resend_confirmation_email: Boolean(editForm.resend_confirmation),
    };

    if (isCruiseBooking(editBooking)) {
      const carParkToTerminalPassengers = Number(
        editForm.car_park_to_terminal_passengers || 0
      );
      const terminalToCarParkPassengers = Number(
        editForm.terminal_to_car_park_passengers || 0
      );
      const carParkToTerminalShuttleTime = String(
        editForm.car_park_to_terminal_shuttle_time || ""
      ).trim();
      const terminalToCarParkShuttleTime = String(
        editForm.terminal_to_car_park_shuttle_time || ""
      ).trim();

      payload.ship_name = editForm.ship_name;

      payload.car_park_to_terminal_passengers = carParkToTerminalPassengers;
      payload.car_park_to_terminal_shuttle_slot_id =
        editForm.car_park_to_terminal_shuttle_slot_id;
      payload.car_park_to_terminal_shuttle_time =
        carParkToTerminalShuttleTime;

      payload.terminal_to_car_park_passengers =
        terminalToCarParkPassengers;
      payload.terminal_to_car_park_shuttle_slot_id =
        editForm.terminal_to_car_park_shuttle_slot_id;
      payload.terminal_to_car_park_shuttle_time =
        terminalToCarParkShuttleTime;

      // Backward-compatible fields for older backend/controller logic.
      payload.shuttle_slot_id =
        editForm.car_park_to_terminal_shuttle_slot_id;
      payload.shuttle_time = carParkToTerminalShuttleTime;
      payload.pax = carParkToTerminalPassengers;
      payload.pickup_pax = carParkToTerminalPassengers;
      payload.pickup_pax_pro = terminalToCarParkPassengers;

      payload.parking_slot = String(editForm.parking_slot || "").trim();

      const addOnVehicleEnabled = Boolean(editForm.add_on_vehicle_enabled);

      if (addOnVehicleEnabled && !editForm.add_on_vehicle_type) {
        throw new Error("Please select add-on vehicle.");
      }

      if (
        addOnVehicleEnabled &&
        !String(editForm.add_on_vehicle_license_plate || "").trim()
      ) {
        throw new Error(
          `${editForm.add_on_vehicle_type} License Plate is required.`
        );
      }

      payload.add_on_vehicle_enabled = addOnVehicleEnabled;
      payload.add_on_vehicle_type = addOnVehicleEnabled
        ? editForm.add_on_vehicle_type
        : "";
      payload.add_on_vehicle_license_plate = addOnVehicleEnabled
        ? String(editForm.add_on_vehicle_license_plate || "")
            .trim()
            .toUpperCase()
        : "";
      payload.details = {
        cruise: {
          add_on_vehicle: {
            enabled: addOnVehicleEnabled,
            type: payload.add_on_vehicle_type,
            license_plate: payload.add_on_vehicle_license_plate,
          },
        },
      };
    }

    if (isStorageBooking(editBooking)) {
      payload.storage_type = editForm.storage_type;
      payload.location_id = editForm.location_id;
      payload.reference = editForm.license_plate;
    }

    if (isAirportBooking(editBooking)) {
      payload.location_id = editForm.location_id;
      payload.pax = Number(editForm.pax || 0);
      payload.pickup_pax = Number(editForm.pax || 0);
      payload.shuttle_slot_id = editForm.shuttle_slot_id;
      payload.shuttle_time = editForm.shuttle_time;
    }

    return payload;
  }

  async function handleEditSubmit(event) {
    event.preventDefault();

    if (!editBooking) return;

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setSavingEdit(true);

      const bookingId = getBookingIdentifier(editBooking);

      const res = await axios.patch(
        `/admin/bookings/${bookingId}`,
        buildEditPayload(),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to update booking."
        );
      }

      let imageErrorMessage = "";

      try {
        for (const image of editImagesToRemove) {
          const imageRes = await axios.delete(
            `/admin/bookings/${bookingId}/image`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              data: {
                image_id: image.image_id || undefined,
                public_id: image.public_id || undefined,
                image_url: image.url || undefined,
              },
            }
          );

          if (!imageRes.data?.success) {
            throw new Error(
              imageRes.data?.message ||
                imageRes.data?.error ||
                "Failed to remove booking image."
            );
          }
        }

        if (editNewImages.length > 0) {
          const imageFormData = new FormData();

          editNewImages.forEach((item) => {
            imageFormData.append("images", item.file);
          });

          const imageRes = await axios.post(
            `/admin/bookings/${bookingId}/image`,
            imageFormData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!imageRes.data?.success) {
            throw new Error(
              imageRes.data?.message ||
                imageRes.data?.error ||
                "Failed to upload booking images."
            );
          }
        }
      } catch (imageError) {
        imageErrorMessage =
          imageError.response?.data?.message ||
          imageError.response?.data?.error ||
          imageError.message ||
          "Booking image update failed.";
      }

      await fetchBookings();

      if (imageErrorMessage) {
        alert(
          `Booking updated successfully, but the image change failed: ${imageErrorMessage}`
        );
        return;
      }

      editNewImages.forEach((item) => {
        if (item.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(item.preview);
        }
      });

      setEditExistingImages([]);
      setEditNewImages([]);
      setEditImagesToRemove([]);
      setEditBooking(null);
      setEditCruiseShuttleSlots([]);
      setEditCruiseShuttleError("");
      setEditAirportShuttleSlots([]);
      setEditAirportShuttleError("");
      alert(res.data.message || "Booking updated successfully.");
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to update booking."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function runBookingAction(action, booking, feeMode = "deduct_10") {
    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    const bookingId = getBookingIdentifier(booking);

    const actionConfig = {
      refund: {
        method: "post",
        url: `/admin/bookings/${bookingId}/refund`,
        confirm:
          feeMode === "full"
            ? "Process full refund and mark this booking as cancelled?"
            : "Process refund after deducting A$10 fee and mark this booking as cancelled?",
      },
      credit: {
        method: "post",
        url: `/admin/bookings/${bookingId}/credit`,
        confirm:
          feeMode === "full"
            ? "Credit full paid amount to customer wallet and mark this booking as cancelled?"
            : "Credit amount to customer wallet after deducting A$10 fee and mark this booking as cancelled?",
      },
      cancel: {
        method: "post",
        url: `/admin/bookings/${bookingId}/cancel`,
        confirm:
          feeMode === "full"
            ? "Cancel this booking"
            : "Cancel this booking",
      },
      resend_email: {
        method: "post",
        url: `/admin/bookings/${bookingId}/resend-email`,
        confirm: "Resend the booking confirmation email?",
      },
      delete: {
        method: "delete",
        url: `/admin/bookings/${bookingId}`,
        confirm: "Delete this booking permanently from the list?",
      },
    };

    const selectedAction = actionConfig[action];

    if (!selectedAction) return;

    const deletableStatuses = [
      "cancelled",
      "cancellation_requested",
      "refund",
      "refunded",
      "credit",
      "credited",
    ];

    const adminActionType = String(
      booking?.admin_action_type || ""
    ).toLowerCase();

    if (
      action === "delete" &&
      !deletableStatuses.includes(String(booking.status || "").toLowerCase()) &&
      !["refund", "credit", "cancel"].includes(adminActionType)
    ) {
      alert("Only cancelled, refunded, or credited bookings can be deleted.");
      return;
    }

    const confirmed = window.confirm(selectedAction.confirm);

    if (!confirmed) return;

    try {
      setActionLoading(`${action}:${bookingId}`);

      const res = await axios({
        method: selectedAction.method,
        url: selectedAction.url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: ["refund", "credit", "cancel"].includes(action)
          ? {
              fee_mode: feeMode,
            }
          : undefined,
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Action failed."
        );
      }

      alert(res.data.message || "Action completed successfully.");
      await fetchBookings();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Action failed."
      );
    } finally {
      setActionLoading("");
    }
  }

  function handleCreateBookingClick() {
    if (["cruise", "storage", "airport"].includes(bookingType)) {
      setCreateBookingOpen(true);
      return;
    }

    router.push(`/booking/${bookingType}`);
  }

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {config.title}
            </h1>

            <p className="mt-2 text-sm text-gray-500">{config.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={handleCreateBookingClick}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Create Booking
          </button>
        </div>
      </div>

      {hasCalendarFilter && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Calendar Filter Active
              </p>

              <h2 className="mt-1 text-lg font-bold text-blue-950">
                {formatText(bookingType)} ·{" "}
                {formatCalendarDateLabel(calendarDateFromUrl)} ·{" "}
                {getCalendarFilterLabel(calendarFilterFromUrl)}
              </h2>

              <p className="mt-1 text-sm text-blue-700">
                Summary cards, status chips, table, copy, CSV, and Excel now use
                the filtered booking rows.
              </p>
            </div>

            <button
              type="button"
              onClick={clearCalendarFilter}
              className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-700"
            >
              Clear Calendar Filter
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Bookings"
          value={displaySummary.total_bookings || 0}
        />

        <StatCard
          title="Total Value"
          value={money(displaySummary.total_value)}
        />

        <StatCard
          title="Paid Amount"
          value={money(displaySummary.paid_amount)}
        />

        <StatCard
          title="Balance Due on Arrival"
          value={money(displaySummary.balance_due_on_arrival)}
          subtitle={`${money(
            displaySummary.holding_deposit_amount
          )} holding deposits`}
        />
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="text-sm font-semibold text-gray-700">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search booking/customer/reference"
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Status</label>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Payment Status
            </label>
            <select
              value={filters.payment_status}
              onChange={(event) =>
                updateFilter("payment_status", event.target.value)
              }
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            >
              {paymentStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Payment Method
            </label>
            <select
              value={filters.payment_method}
              onChange={(event) =>
                updateFilter("payment_method", event.target.value)
              }
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            >
              {paymentMethodOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {bookingType === "cruise" && (
            <>
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Cruise
                </label>
                <select
                  value={filters.cruise}
                  onChange={(event) => updateFilter("cruise", event.target.value)}
                  className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                >
                  <option value="">All Ships</option>
                  {cruiseSchedules.map((schedule) => (
                    <option key={schedule._id} value={schedule._id}>
                      {schedule.ship_name ||
                        schedule.schedule_name ||
                        "Unnamed Cruise"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Shuttle Slot
                </label>
                <input
                  type="text"
                  value={filters.shuttle_slot}
                  onChange={(event) =>
                    updateFilter("shuttle_slot", event.target.value)
                  }
                  placeholder="e.g. 09:00–09:19"
                  className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Ship Departure from
                </label>
                <input
                  type="date"
                  value={filters.ship_departure_from}
                  onChange={(event) =>
                    updateFilter("ship_departure_from", event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Ship Arrival
                </label>
                <input
                  type="date"
                  value={filters.ship_arrival}
                  onChange={(event) =>
                    updateFilter("ship_arrival", event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Booked Month
            </label>
            <input
              type="month"
              value={filters.booked_month}
              onChange={(event) =>
                updateFilter("booked_month", event.target.value)
              }
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Date Booked — From
            </label>
            <input
              type="date"
              value={filters.date_booked_from}
              onChange={(event) =>
                updateFilter("date_booked_from", event.target.value)
              }
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Date Booked — To
            </label>
            <input
              type="date"
              value={filters.date_booked_to}
              onChange={(event) =>
                updateFilter("date_booked_to", event.target.value)
              }
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusBreakdown.map((item) => (
              <span
                key={item.status}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
              >
                {item.label || formatText(item.status)}: {item.count}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filters.limit}
              onChange={(event) =>
                updateFilter("limit", Number(event.target.value))
              }
              className="rounded-xl border px-3 py-2 text-sm"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Booking Table</h2>
            <p className="mt-1 text-sm text-gray-500">
              Export currently visible records as copy, CSV, or Excel.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyTableRows(visibleBookings)}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Copy
            </button>

            <button
              type="button"
              onClick={() => downloadCsv(visibleBookings, bookingType)}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              CSV
            </button>

            <button
              type="button"
              onClick={() => downloadExcel(visibleBookings, bookingType)}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Excel
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            Loading bookings...
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we load {config.title.toLowerCase()}.
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="font-bold">Bookings could not be loaded</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {visibleBookings.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No {config.title.toLowerCase()} found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                      <th
                        onClick={() => handleSort("booking_id")}
                        className="w-[18%] cursor-pointer px-[1%] py-[1%] text-xs font-semibold uppercase tracking-wide"
                      >
                        Booking ID
                      </th>
                      <th className="w-[22%] px-[1%] py-[1%] text-xs font-semibold uppercase tracking-wide">
                        Client Info
                      </th>
                      <th className="w-[20%] px-[1%] py-[1%] text-xs font-semibold uppercase tracking-wide">
                        Booking Status
                      </th>
                      <th className="w-[20%] px-[1%] py-[1%] text-xs font-semibold uppercase tracking-wide">
                        Payment
                      </th>
                      <th className="w-[20%] px-[1%] py-[1%] text-xs font-semibold uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleBookings.map((booking) => {
                      const bookingId = getBookingIdentifier(booking);

                      return (
                        <tr
                          key={booking._id}
                          className="border-b border-gray-100 align-top transition-colors duration-200 hover:bg-gray-50"
                        >
                          <td className="w-[18%] px-[1%] py-[1.2%]">
                            <div className="w-full overflow-hidden">
                              <p className="truncate text-sm font-bold text-gray-900">
                                {booking.booking_id}
                              </p>
                              <p className="mt-[2%] text-xs text-gray-500">
                                {formatText(booking.type)}
                              </p>
                              <p className="mt-[2%] text-xs text-gray-500">
                                Created: {formatDateTime(booking.createdAt)}
                              </p>
                            </div>
                          </td>

                          <td className="w-[22%] px-[1%] py-[1.2%]">
                            <div className="w-full overflow-hidden">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {getCustomerName(booking)}
                              </p>
                              <p className="mt-[2%] break-words text-xs text-gray-500">
                                {getCustomerEmail(booking)}
                              </p>
                              <p className="mt-[2%] text-xs text-gray-500">
                                {getCustomerPhone(booking)}
                              </p>
                            </div>
                          </td>

                          <td className="w-[20%] px-[1%] py-[1.2%]">
                            <div className="space-y-[6%]">
                              <Badge
                                value={getBookingStatusLabel(booking)}
                                type={getBookingStatusBadgeTypeFromBooking(
                                  booking
                                )}
                              />
                            </div>

                            <p className="mt-[6%] text-xs text-gray-500">
                              Period: {getPeriod(booking)}
                            </p>

                            <p className="mt-[2%] text-xs text-gray-500">
                              Location: {getLocationName(booking)}
                            </p>
                          </td>

                          <td className="w-[20%] px-[1%] py-[1.2%]">
                            <div className="w-full overflow-hidden">
                              <p className="text-sm font-semibold text-gray-900">
                                {formatText(booking.payment_method)}
                              </p>
                              <p className="mt-[2%] text-xs text-gray-500">
                                Flow: {formatText(booking.payment_flow)}
                              </p>
                              {/* {isPoaDepositBooking(booking) && (
                                <p className="mt-[2%] text-xs font-semibold text-yellow-700">
                                  POA Deposit: A$10 fee is automatic
                                </p>
                              )} */}
                              <p className="mt-[6%] text-xs text-gray-700">
                                Total: <strong>{money(booking.price)}</strong>
                              </p>
                              <p className="mt-[2%] text-xs text-green-700">
                                Paid:{" "}
                                <strong>{money(booking.paid_amount)}</strong>
                              </p>
                              <p className="mt-[2%] text-xs text-red-700">
                                Due: <strong>{money(booking.due_amount)}</strong>
                              </p>
                              {booking.balance_due_on_arrival > 0 && (
                                <p className="mt-[2%] text-xs text-yellow-700">
                                  Arrival Due:{" "}
                                  <strong>
                                    {money(booking.balance_due_on_arrival)}
                                  </strong>
                                </p>
                              )}
                              <p className="mt-[6%] break-words text-xs text-gray-500">
                                Ref: {getProviderReference(booking)}
                              </p>
                            </div>
                          </td>

                          <td className="w-[20%] px-[1%] py-[1.2%]">
                            <div className="flex flex-wrap gap-[3%]">
                              <button
                                type="button"
                                onClick={() => setViewBooking(booking)}
                                className="pr-1 border-e text-blue-500 cursor-pointer text-xs"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(booking)}
                                className="pr-1 border-e text-blue-500 cursor-pointer text-xs"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={getBookingAdminImageCount(booking) === 0}
                                onClick={() => setViewImagesBooking(booking)}
                                className={`pr-1 border-e text-xs ${
                                  getBookingAdminImageCount(booking) > 0
                                    ? "text-blue-500 cursor-pointer"
                                    : "text-gray-400 cursor-not-allowed"
                                }`}
                              >
                                View Images ({getBookingAdminImageCount(booking)})
                              </button>
                              <button
                                type="button"
                                disabled={
                                  actionLoading === `refund:${bookingId}`
                                }
                                onClick={() => openFeeAction("refund", booking)}
                                className="pr-1 border-e text-blue-500 cursor-pointer text-xs"
                              >
                                Refunded
                              </button>
                              <button
                                type="button"
                                disabled={
                                  actionLoading === `credit:${bookingId}`
                                }
                                onClick={() => openFeeAction("credit", booking)}
                                className="pr-1 border-e text-blue-500 cursor-pointer text-xs"
                              >
                                Credit
                              </button>
                              <button
                                type="button"
                                disabled={
                                  actionLoading === `cancel:${bookingId}`
                                }
                                onClick={() => openFeeAction("cancel", booking)}
                                className="pr-1 border-e text-blue-500 cursor-pointer text-xs"
                              >
                                Cancellation
                              </button>
                              <button
                                type="button"
                                disabled={
                                  actionLoading === `resend_email:${bookingId}`
                                }
                                onClick={() =>
                                  runBookingAction("resend_email", booking)
                                }
                                className="pr-1 border-e text-blue-500 cursor-pointer text-xs"
                              >
                                Resend Email
                              </button>
                              <button
                                type="button"
                                disabled={
                                  actionLoading === `delete:${bookingId}`
                                }
                                onClick={() => runBookingAction("delete", booking)}
                                className="pr-1 text-blue-500 cursor-pointer text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing page {pagination.page || page} of{" "}
              {pagination.total_pages || 1}. Total records:{" "}
              {hasCalendarFilter ? visibleBookings.length : pagination.total || 0}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!pagination.has_prev_page}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={!pagination.has_next_page}
                onClick={() => setPage((prev) => prev + 1)}
                className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <ViewBookingModal
        booking={viewBooking}
        onClose={() => setViewBooking(null)}
      />

      <BookingImagesModal
        booking={viewImagesBooking}
        onClose={() => setViewImagesBooking(null)}
      />

      <EditBookingModal
        booking={editBooking}
        editForm={editForm}
        updateEditField={updateEditField}
        editExistingImages={editExistingImages}
        editNewImages={editNewImages}
        editImagesToRemove={editImagesToRemove}
        handleEditImagesChange={handleEditImagesChange}
        handleRemoveExistingImage={handleRemoveExistingImage}
        handleRemoveNewImage={handleRemoveNewImage}
        onClose={closeEditModal}
        onSubmit={handleEditSubmit}
        saving={savingEdit}
        storageLocations={storageLocations}
        airportLocations={airportLocations}
        storageTypes={storageTypes}
        editCruiseShuttleSlots={editCruiseShuttleSlots}
        editCruiseShuttleLoading={editCruiseShuttleLoading}
        editCruiseShuttleError={editCruiseShuttleError}
        handleEditCruiseShuttleChange={
          handleEditCruiseShuttleChange
        }
        editAirportShuttleSlots={editAirportShuttleSlots}
        editAirportShuttleLoading={editAirportShuttleLoading}
        editAirportShuttleError={editAirportShuttleError}
        handleEditAirportShuttleChange={
          handleEditAirportShuttleChange
        }
        handleEditAirportLocationChange={
          handleEditAirportLocationChange
        }
      />

      <FeeChoiceModal
        feeAction={feeAction}
        onClose={() => setFeeAction(null)}
        onChoose={(feeMode) => {
          const currentAction = feeAction;

          setFeeAction(null);

          if (!currentAction) return;

          runBookingAction(
            currentAction.action,
            currentAction.booking,
            feeMode
          );
        }}
      />

      {createBookingOpen && bookingType === "cruise" && (
        <AdminCruiseCreateBookingModal
          onClose={() => setCreateBookingOpen(false)}
          onCreated={async () => {
            setCreateBookingOpen(false);
            await fetchBookings();
            await fetchReferenceData();
          }}
        />
      )}

      {createBookingOpen && bookingType === "storage" && (
        <AdminStorageCreateBookingModal
          onClose={() => setCreateBookingOpen(false)}
          onCreated={async () => {
            setCreateBookingOpen(false);
            await fetchBookings();
            await fetchReferenceData();
          }}
        />
      )}

      {createBookingOpen && bookingType === "airport" && (
        <AdminAirportCreateBookingModal
          onClose={() => setCreateBookingOpen(false)}
          onCreated={async () => {
            setCreateBookingOpen(false);
            await fetchBookings();
            await fetchReferenceData();
          }}
        />
      )}
    </div>
  );
}