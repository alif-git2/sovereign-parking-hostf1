"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const bookingTypeOptions = [
  { value: "cruise", label: "Cruise" },
  { value: "storage", label: "Storage" },
  { value: "airport", label: "Airport" },
];

const paymentStatusOptions = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partially Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially Refunded" },
];

const columnConfigs = {
  cruise: [
    { key: "booking_id", label: "Booking ID" },
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "ship_name", label: "Ship Name" },
    { key: "ship_departure_date", label: "Ship Departure Date" },
    { key: "ship_arrival_date", label: "Ship Arrival Date" },
    { key: "car_park_to_terminal", label: "Pic up pax" },
    {
      key: "car_park_to_terminal_shuttle_options",
      label: "Pic up pax Shuttle Options",
    },
    { key: "terminal_to_car_park", label: "Terminal to car park" },
    {
      key: "terminal_to_car_park_shuttle_options",
      label: "Terminal to car park Shuttle Options",
    },
    { key: "pickup_pax_pro", label: "Pick Up Pax" },
    { key: "parking_slot_number", label: "Parking Slot Number" },
    { key: "interlock", label: "Inter Lock" },
    { key: "payment_status", label: "Payment Status" },
    { key: "license_plate", label: "License Plate" },
    { key: "new_admin_note", label: "Notes" },
  ],
  storage: [
    { key: "booking_id", label: "Booking ID" },
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "entry_date", label: "Entry Date" },
    { key: "exit_date", label: "Exit Date" },
    { key: "storage_type", label: "Storage Type" },
    { key: "location", label: "Storage Location" },
    { key: "interlock", label: "Inter Lock" },
    { key: "payment_status", label: "Payment Status" },
    { key: "license_plate", label: "Reference / License Plate" },
    { key: "new_admin_note", label: "Admin Note" },
  ],
  airport: [
    { key: "booking_id", label: "Booking ID" },
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "entry_date", label: "Entry Date" },
    { key: "exit_date", label: "Exit Date" },
    { key: "location", label: "Parking Location" },
    { key: "passengers", label: "Passengers" },
    { key: "shuttle_options", label: "Shuttle Options" },
    { key: "parking_slot_number", label: "Parking Slot Number" },
    { key: "interlock", label: "Inter Lock" },
    { key: "payment_status", label: "Payment Status" },
    { key: "license_plate", label: "License Plate" },
    { key: "new_admin_note", label: "Admin Note" },
  ],
};

const defaultFilters = {
  booking_type: "cruise",
  cruise: "",
  ship_departure_date: "",
  ship_arrival_date: "",
  payment_status: "",
};

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

function getAuthHeaders() {
  const token = getAdminToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function clearAdminSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
}

function money(amount) {
  return `A$${Number(amount || 0).toFixed(2)}`;
}

function formatDate(date) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
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

function formatText(value) {
  if (!value) return "—";

  const labels = {
    paid: "Paid",
    unpaid: "Unpaid",
    pending: "Pending",
    partial: "Partially Paid",
    failed: "Failed",
    refunded: "Refunded",
    partially_refunded: "Partially Refunded",
    success: "Success",
    confirmed: "Confirmed",
    pending_payment: "Pending Payment",
    poa: "Pay on Arrival",
    stripe: "Stripe",
    paypal: "PayPal",
    wallet: "Wallet",
    credit_card_manual: "Credit Card Manual",
    cruise: "Cruise",
    storage: "Storage",
    airport: "Airport",
  };

  if (labels[value]) return labels[value];

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCustomerName(booking) {
  return booking?.customer?.name || booking?.user_id?.name || "—";
}

function getCustomerEmail(booking) {
  return booking?.customer?.email || booking?.user_id?.email || "—";
}

function getCustomerPhone(booking) {
  return booking?.customer?.phone || booking?.user_id?.phone || "—";
}

function getLocationName(booking) {
  return booking?.location_id?.name || booking?.details?.location_name || "—";
}

function getShipName(booking) {
  return (
    booking?.schedule_id?.ship_name ||
    booking?.schedule_id?.schedule_name ||
    booking?.details?.cruise?.ship_name ||
    booking?.ship_name ||
    "—"
  );
}

function getLicensePlate(booking) {
  return booking?.license_plate || booking?.reference || "—";
}

function getStorageType(booking) {
  return (
    booking?.storage_type?.name ||
    booking?.storage_type ||
    booking?.storage_type_name ||
    booking?.details?.storage?.storage_type ||
    booking?.details?.storage?.storage_type_name ||
    booking?.details?.storage_type ||
    "—"
  );
}

function numberOrDash(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number <= 0) {
    return "—";
  }

  return String(number);
}

function getCruiseCarParkToTerminalPassengers(booking) {
  const cruise = booking?.details?.cruise || {};

  return numberOrDash(
    cruise.car_park_to_terminal_passengers ||
      cruise.pickup_pax ||
      booking?.pickup_pax ||
      booking?.pax
  );
}

function getCruiseCarParkToTerminalShuttleOption(booking) {
  const cruise = booking?.details?.cruise || {};

  return (
    cruise.car_park_to_terminal_shuttle_time ||
    cruise.shuttle_time ||
    booking?.car_park_to_terminal_shuttle_time ||
    booking?.shuttle_time ||
    "—"
  );
}

function getCruiseTerminalToCarParkPassengers(booking) {
  const cruise = booking?.details?.cruise || {};

  return numberOrDash(
    cruise.terminal_to_car_park_passengers ||
      booking?.terminal_to_car_park_passengers
  );
}

function getCruiseTerminalToCarParkShuttleOption(booking) {
  const cruise = booking?.details?.cruise || {};

  return (
    cruise.terminal_to_car_park_shuttle_time ||
    booking?.terminal_to_car_park_shuttle_time ||
    "—"
  );
}

function getPickupPaxPro(booking) {
  return numberOrDash(booking?.details?.cruise?.pickup_pax_pro);
}

function getParkingSlotNumber(booking) {
  return (
    booking?.details?.cruise?.parking_slot ||
    booking?.details?.airport?.parking_slot ||
    booking?.parking_slot ||
    "—"
  );
}

function getAirportPassengers(booking) {
  return numberOrDash(
    booking?.details?.airport?.pickup_pax || booking?.pickup_pax || booking?.pax
  );
}

function getAirportShuttleOption(booking) {
  return booking?.details?.airport?.shuttle_time || booking?.shuttle_time || "—";
}

function getInterlock(booking) {
  return booking?.interlock ? "Yes" : "No";
}

function getPaymentStatus(booking) {
  return formatText(booking?.payment_status || booking?.status);
}

function getColumnValue(booking, key) {
  const valueMap = {
    booking_id: booking?.booking_id || "—",
    name: getCustomerName(booking),
    phone: getCustomerPhone(booking),
    email: getCustomerEmail(booking),
    ship_name: getShipName(booking),
    ship_departure_date: formatDate(booking?.start_date),
    ship_arrival_date: formatDate(booking?.end_date),
    car_park_to_terminal: getCruiseCarParkToTerminalPassengers(booking),
    car_park_to_terminal_shuttle_options:
      getCruiseCarParkToTerminalShuttleOption(booking),
    terminal_to_car_park: getCruiseTerminalToCarParkPassengers(booking),
    terminal_to_car_park_shuttle_options:
      getCruiseTerminalToCarParkShuttleOption(booking),
    pickup_pax_pro: getPickupPaxPro(booking),
    parking_slot_number: getParkingSlotNumber(booking),
    interlock: getInterlock(booking),
    payment_status: getPaymentStatus(booking),
    license_plate: getLicensePlate(booking),
    new_admin_note: booking?.new_admin_note || "—",
    entry_date: formatDate(booking?.start_date),
    exit_date: formatDate(booking?.end_date),
    storage_type: getStorageType(booking),
    location: getLocationName(booking),
    passengers: getAirportPassengers(booking),
    shuttle_options: getAirportShuttleOption(booking),
  };

  return valueMap[key] ?? "—";
}

function extractCruiseSchedules(response) {
  const data = response?.data?.data;

  if (Array.isArray(data)) return data;

  return data?.schedules || data?.cruise_schedules || [];
}

function extractSavedReports(response) {
  const data = response?.data?.data;

  if (Array.isArray(data)) return data;

  return data?.reports || [];
}

function getErrorMessage(error, fallback = "Something went wrong.") {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function buildExportRows(rows, selectedColumns, availableColumns) {
  const selectedColumnObjects = availableColumns.filter((column) =>
    selectedColumns.includes(column.key)
  );

  return rows.map((booking) => {
    return selectedColumnObjects.reduce((row, column) => {
      row[column.label] = getColumnValue(booking, column.key);
      return row;
    }, {});
  });
}

function getReportExportRows(report, selectedColumns, availableColumns) {
  if (!report) return [];

  if (report.isSavedSnapshot) {
    return Array.isArray(report.rows) ? report.rows : [];
  }

  return buildExportRows(report.rows || [], selectedColumns, availableColumns);
}

function getReportColumnsForSave(report, selectedColumns, availableColumns) {
  if (report?.isSavedSnapshot) {
    return Array.isArray(report.columns) ? report.columns : [];
  }

  return availableColumns.filter((column) => selectedColumns.includes(column.key));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function downloadExcelFile({ rows, filename }) {
  if (!rows.length) {
    alert("No report rows to download.");
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
    filename,
    content: html,
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
}

const savedReportHeaderAliases = {
  "Pick Up Pax Pro": "Pick Up Pax",
};

function normalizeSavedReportColumns(columns) {
  if (!Array.isArray(columns)) return [];

  return columns.map((column) => ({
    ...column,
    label: savedReportHeaderAliases[column?.label] || column?.label,
  }));
}

function normalizeSavedReportRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) =>
    Object.entries(row || {}).reduce((normalizedRow, [header, value]) => {
      const normalizedHeader = savedReportHeaderAliases[header] || header;
      normalizedRow[normalizedHeader] = value;
      return normalizedRow;
    }, {})
  );
}

function savedReportToModalReport(savedReport) {
  if (!savedReport) return null;

  return {
    id: savedReport._id,
    name: savedReport.name,
    title: savedReport.title || savedReport.name || "Saved Report",
    dateLabel: savedReport.date_label || "All dates",
    bookingType: savedReport.report_type || "cruise",
    filters: savedReport.filters || {},
    selectedColumns: savedReport.selected_columns || [],
    columns: normalizeSavedReportColumns(savedReport.columns),
    rows: normalizeSavedReportRows(savedReport.rows),
    totalValue: Number(savedReport.total_value || 0),
    isSavedSnapshot: true,
  };
}


const DATE_SORT_KEYS = new Set([
  "ship_departure_date",
  "ship_arrival_date",
  "entry_date",
  "exit_date",
]);

const TIME_SORT_KEYS = new Set([
  "car_park_to_terminal_shuttle_options",
  "terminal_to_car_park_shuttle_options",
  "shuttle_options",
]);

const NUMBER_SORT_KEYS = new Set([
  "car_park_to_terminal",
  "terminal_to_car_park",
  "pickup_pax_pro",
  "parking_slot_number",
  "passengers",
]);

function isEmptySortValue(value) {
  if (value === null || value === undefined) return true;

  const normalized = String(value).trim();
  return normalized === "" || normalized === "—";
}

function parseNumberForSort(value) {
  const match = String(value ?? "")
    .replace(/,/g, "")
    .match(/-?\d+(?:\.\d+)?/);

  if (!match) return Number.NaN;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseDateForSort(value) {
  const timestamp = Date.parse(String(value ?? "").trim());
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
}

function parseTimeForSort(value) {
  const normalized = String(value ?? "").trim();

  const twelveHourMatch = normalized.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i
  );

  if (twelveHourMatch) {
    let hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const meridiem = twelveHourMatch[3].toUpperCase();

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return Number.NaN;
    }

    hours %= 12;
    if (meridiem === "PM") hours += 12;

    return hours * 60 + minutes;
  }

  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return Number.NaN;
    }

    return hours * 60 + minutes;
  }

  return Number.NaN;
}

function getColumnKeyFromHeader(header, columns) {
  return columns.find((column) => column.label === header)?.key || "";
}

function getReportSortType(header, columns) {
  const columnKey = getColumnKeyFromHeader(header, columns);
  const normalizedHeader = String(header || "").toLowerCase();

  if (DATE_SORT_KEYS.has(columnKey) || normalizedHeader.includes("date")) {
    return "date";
  }

  if (
    TIME_SORT_KEYS.has(columnKey) ||
    normalizedHeader.includes("time") ||
    normalizedHeader.includes("shuttle option")
  ) {
    return "time";
  }

  if (
    NUMBER_SORT_KEYS.has(columnKey) ||
    /\b(passengers?|pax|slot|price|amount|total)\b/.test(normalizedHeader)
  ) {
    return "number";
  }

  if (columnKey === "booking_id" || normalizedHeader === "booking id") {
    return "natural";
  }

  return "text";
}

function compareReportValues(firstValue, secondValue, sortType) {
  if (sortType === "date") {
    const firstDate = parseDateForSort(firstValue);
    const secondDate = parseDateForSort(secondValue);

    if (Number.isFinite(firstDate) && Number.isFinite(secondDate)) {
      return firstDate - secondDate;
    }
  }

  if (sortType === "time") {
    const firstTime = parseTimeForSort(firstValue);
    const secondTime = parseTimeForSort(secondValue);

    if (Number.isFinite(firstTime) && Number.isFinite(secondTime)) {
      return firstTime - secondTime;
    }
  }

  if (sortType === "number") {
    const firstNumber = parseNumberForSort(firstValue);
    const secondNumber = parseNumberForSort(secondValue);

    if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
      return firstNumber - secondNumber;
    }
  }

  return String(firstValue ?? "").localeCompare(String(secondValue ?? ""), "en", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortReportRows(rows, header, direction, columns) {
  if (!header || !direction) return rows;

  const sortType = getReportSortType(header, columns);

  return rows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .sort((firstItem, secondItem) => {
      const firstValue = firstItem.row?.[header];
      const secondValue = secondItem.row?.[header];
      const firstIsEmpty = isEmptySortValue(firstValue);
      const secondIsEmpty = isEmptySortValue(secondValue);

      // Empty values always remain at the bottom for both directions.
      if (firstIsEmpty && secondIsEmpty) {
        return firstItem.originalIndex - secondItem.originalIndex;
      }

      if (firstIsEmpty) return 1;
      if (secondIsEmpty) return -1;

      const comparison = compareReportValues(firstValue, secondValue, sortType);

      if (comparison === 0) {
        return firstItem.originalIndex - secondItem.originalIndex;
      }

      return direction === "asc" ? comparison : -comparison;
    })
    .map(({ row }) => row);
}

function getSortDirectionLabel(sortType, direction) {
  if (!direction) return "";

  const labels = {
    text: {
      asc: "A–Z",
      desc: "Z–A",
    },
    natural: {
      asc: "A–Z / 1–100",
      desc: "Z–A / 100–1",
    },
    number: {
      asc: "Earliest–Latest",
      desc: "Newest–Oldest",
    },
    date: {
      asc: "Oldest–Newest",
      desc: "Newest–Oldest",
    },
    time: {
      asc: "Earliest–Latest",
      desc: "Latest–Earliest",
    },
  };

  return labels[sortType]?.[direction] || "";
}

function ReportModal({
  report,
  selectedColumns,
  availableColumns,
  onClose,
  onSaveReport,
  savingReport,
}) {
  const [sortConfig, setSortConfig] = useState({
    header: null,
    direction: null,
  });

  useEffect(() => {
    setSortConfig({
      header: null,
      direction: null,
    });
  }, [report]);

  const exportRows = useMemo(() => {
    return getReportExportRows(report, selectedColumns, availableColumns);
  }, [report, selectedColumns, availableColumns]);

  const columnsForSave = useMemo(() => {
    return getReportColumnsForSave(
      report,
      selectedColumns,
      availableColumns
    );
  }, [report, selectedColumns, availableColumns]);

  const headers = useMemo(() => {
    return exportRows.length ? Object.keys(exportRows[0]) : [];
  }, [exportRows]);

  const displayedRows = useMemo(() => {
    if (!sortConfig.header || !sortConfig.direction) {
      return exportRows;
    }

    return sortReportRows(
      exportRows,
      sortConfig.header,
      sortConfig.direction,
      columnsForSave
    );
  }, [
    exportRows,
    sortConfig.header,
    sortConfig.direction,
    columnsForSave,
  ]);

  const activeSortType = useMemo(() => {
    if (!sortConfig.header) return null;

    return getReportSortType(sortConfig.header, columnsForSave);
  }, [sortConfig.header, columnsForSave]);

  if (!report) return null;

  function handleSort(header) {
    setSortConfig((current) => {
      if (current.header !== header) {
        return {
          header,
          direction: "asc",
        };
      }

      if (current.direction === "asc") {
        return {
          header,
          direction: "desc",
        };
      }

      return {
        header: null,
        direction: null,
      };
    });
  }

  function resetSorting() {
    setSortConfig({
      header: null,
      direction: null,
    });
  }

  function handleDownloadExcel() {
    downloadExcelFile({
      rows: displayedRows,
      filename: `${report.bookingType || "booking"}-report-${Date.now()}.xls`,
    });
  }

  function handleSaveReport() {
    if (report.isSavedSnapshot) {
      alert("This report is already saved in database.");
      return;
    }

    const reportName = window.prompt("Report name?");
    const cleanReportName = String(reportName || "").trim();

    if (!cleanReportName) return;

    onSaveReport({
      report,
      reportName: cleanReportName,
      exportRows: displayedRows,
      columns: columnsForSave,
    });
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-3 py-6">
      <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b bg-white px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
              {report.isSavedSnapshot ? "Saved Report" : "Generated Report"}
            </p>

            <h2 className="mt-1 text-lg font-bold text-gray-950 md:text-xl">
              {report.title} - {money(report.totalValue)}
            </h2>

            <p className="mt-1 text-xs font-semibold text-gray-600">
              Dates: {report.dateLabel}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-gray-500">
                Total rows: {displayedRows.length}
              </p>

              <span className="text-[11px] text-gray-300">•</span>
              <p className="text-[11px] font-medium text-slate-500">
                Click any column heading to sort.
              </p>

{sortConfig.header && (
  <>
    <span className="text-[11px] text-gray-300">•</span>

    <p className="text-[11px] font-semibold text-blue-700">
      Sorted by: {sortConfig.header}
    </p>

    <button
      type="button"
      onClick={resetSorting}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
    >
      Reset Sorting
    </button>
  </>
)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!report.isSavedSnapshot && (
              <button
                type="button"
                onClick={handleSaveReport}
                disabled={savingReport || exportRows.length === 0}
                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingReport ? "Saving..." : "Save Report"}
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadExcel}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              Download Excel
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[72vh] overflow-auto p-5">
          {displayedRows.length === 0 ? (
            <div className="rounded-2xl border bg-gray-50 p-8 text-center text-xs text-gray-500">
              No bookings found for this report.
            </div>
          ) : (
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
              <thead>
                <tr className="border bg-slate-100 text-gray-700">
                  {headers.map((header) => {
                    const isActive = sortConfig.header === header;
                    const sortType = getReportSortType(
                      header,
                      columnsForSave
                    );
                    const nextDirection = !isActive
                      ? "ascending"
                      : sortConfig.direction === "asc"
                        ? "descending"
                        : "original";

                    return (
                      <th
                        key={header}
                        className={`border px-3 py-2 font-bold ${
                          isActive ? "bg-blue-50 text-blue-700" : ""
                        }`}
                        aria-sort={
                          isActive
                            ? sortConfig.direction === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(header)}
                          className="flex w-full min-w-max items-center justify-between gap-2 text-left hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          title={`Sort ${header} ${nextDirection}. ${getSortDirectionLabel(
                            sortType,
                            isActive ? sortConfig.direction : "asc"
                          )}`}
                        >
                          <span>{header}</span>
                          <span
                            aria-hidden="true"
                            className={`text-sm ${
                              isActive ? "text-blue-700" : "text-slate-400"
                            }`}
                          >
                            {isActive
                              ? sortConfig.direction === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {displayedRows.map((row, rowIndex) => (
                  <tr
                    key={`${row["Booking ID"] || "row"}-${rowIndex}`}
                    className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}
                  >
                    {headers.map((header) => (
                      <td
                        key={header}
                        className="border px-3 py-2 align-top text-gray-700"
                      >
                        {row[header] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function SavedReportsTable({ reports, loading, onView, onDownload, onDelete }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-950">Saved Reports</h2>
          <p className="mt-1 text-xs text-gray-500">
            Reports are saved permanently in MongoDB, not browser localStorage.
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
          {reports.length} saved
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Report Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Rows</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Saved At</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Loading saved reports...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No saved reports yet.
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report._id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <p className="font-bold text-gray-900">{report.name}</p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {report.title || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-gray-700">
                    {formatText(report.report_type)}
                  </td>
                  <td className="px-3 py-3 text-gray-700">
                    {report.total_rows || 0}
                  </td>
                  <td className="px-3 py-3 font-semibold text-gray-800">
                    {money(report.total_value)}
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {formatDateTime(report.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onView(report)}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownload(report)}
                        className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-[11px] font-bold text-green-700 hover:bg-green-100"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(report)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedColumns, setSelectedColumns] = useState(
    columnConfigs.cruise.map((column) => column.key)
  );
  const [cruiseSchedules, setCruiseSchedules] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [loadingSavedReports, setLoadingSavedReports] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  const availableColumns = useMemo(() => {
    return columnConfigs[filters.booking_type] || columnConfigs.cruise;
  }, [filters.booking_type]);

  const selectedCruiseSchedule = useMemo(() => {
    return cruiseSchedules.find(
      (schedule) => String(schedule._id) === String(filters.cruise)
    );
  }, [cruiseSchedules, filters.cruise]);

  const hasAnyCruiseDate = Boolean(
    filters.ship_departure_date || filters.ship_arrival_date
  );

  const hasBothCruiseDates = Boolean(
    filters.ship_departure_date && filters.ship_arrival_date
  );

  const hasIncompleteCruiseDateRange =
    hasAnyCruiseDate && !hasBothCruiseDates;

  const canGenerateReport = useMemo(() => {
    if (filters.booking_type !== "cruise") {
      return true;
    }

    if (filters.cruise) {
      return true;
    }

    if (hasIncompleteCruiseDateRange) {
      return false;
    }

    return hasBothCruiseDates;
  }, [
    filters.booking_type,
    filters.cruise,
    hasBothCruiseDates,
    hasIncompleteCruiseDateRange,
  ]);

  const fetchSavedReports = useCallback(async () => {
    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      setLoadingSavedReports(true);

      const res = await axios.get("/admin/reports", {
        headers: getAuthHeaders(),
        params: {
          limit: 100,
        },
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to load saved reports.");
      }

      setSavedReports(extractSavedReports(res));
    } catch (error) {
      setError(getErrorMessage(error, "Failed to load saved reports."));

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        router.replace("/admin/login");
      }
    } finally {
      setLoadingSavedReports(false);
    }
  }, [router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    fetchSavedReports();
  }, [mounted, router, fetchSavedReports]);

  useEffect(() => {
    setSelectedColumns(availableColumns.map((column) => column.key));
  }, [availableColumns]);

  useEffect(() => {
    if (!mounted || filters.booking_type !== "cruise") return;

    async function fetchCruiseSchedules() {
      try {
        setLoadingReferences(true);

        const res = await axios.get("/admin/cruise-schedules", {
          headers: getAuthHeaders(),
          params: {
            limit: 100,
            is_active: true,
          },
        });

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
              res.data?.error ||
              "Failed to load cruise schedules."
          );
        }

        setCruiseSchedules(extractCruiseSchedules(res));
      } catch (error) {
        setError(getErrorMessage(error, "Failed to load cruise schedules."));

        if (error.response?.status === 401 || error.response?.status === 403) {
          clearAdminSession();
          router.replace("/admin/login");
        }
      } finally {
        setLoadingReferences(false);
      }
    }

    fetchCruiseSchedules();
  }, [mounted, filters.booking_type, router]);

  function updateFilter(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
    setReport(null);
  }

  function handleBookingTypeChange(value) {
    setFilters({
      ...defaultFilters,
      booking_type: value,
    });

    setError("");
    setReport(null);
  }

  function handleCruiseChange(scheduleId) {
    const schedule = cruiseSchedules.find(
      (item) => String(item._id) === String(scheduleId)
    );

    setFilters((prev) => ({
      ...prev,
      cruise: scheduleId,
      ship_departure_date: schedule
        ? toDateInputValue(schedule.departure_date)
        : prev.ship_departure_date,
      ship_arrival_date: schedule
        ? toDateInputValue(schedule.return_date || schedule.arrival_date)
        : prev.ship_arrival_date,
    }));

    setError("");
    setReport(null);
  }

  function handleCruiseDateChange(name, value) {
    setFilters((prev) => ({
      ...prev,
      cruise: "",
      [name]: value,
    }));

    setError("");
    setReport(null);
  }

  function toggleColumn(columnKey) {
    setSelectedColumns((prev) => {
      if (prev.includes(columnKey)) {
        return prev.filter((key) => key !== columnKey);
      }

      return [...prev, columnKey];
    });
  }

  function selectAllColumns() {
    setSelectedColumns(availableColumns.map((column) => column.key));
  }

  function clearColumns() {
    setSelectedColumns([]);
  }

  function getReportParams(page) {
    const isCruise = filters.booking_type === "cruise";

    return {
      type: filters.booking_type,
      page,
      limit: 100,
      sort_by: "start_date",
      sort_order: "asc",
      payment_status: filters.payment_status || undefined,
      cruise: isCruise && filters.cruise ? filters.cruise : undefined,
      ship_departure_from:
        isCruise && filters.ship_departure_date
          ? filters.ship_departure_date
          : undefined,
      ship_arrival:
        isCruise && filters.ship_arrival_date
          ? filters.ship_arrival_date
          : undefined,
    };
  }

  function filterRowsAfterFetch(rows) {
    if (filters.booking_type !== "cruise") {
      return rows;
    }

    return rows.filter((booking) => {
      if (
        filters.ship_departure_date &&
        normalizeDateKey(booking?.start_date) !== filters.ship_departure_date
      ) {
        return false;
      }

      if (
        filters.ship_arrival_date &&
        normalizeDateKey(booking?.end_date) !== filters.ship_arrival_date
      ) {
        return false;
      }

      return true;
    });
  }

  async function fetchAllBookingsForReport() {
    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return [];
    }

    const allRows = [];
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage && currentPage <= 1000) {
      const res = await axios.get("/admin/bookings", {
        headers: getAuthHeaders(),
        params: getReportParams(currentPage),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to load report rows."
        );
      }

      const bookings = res.data?.data?.bookings || [];
      const pagination = res.data?.data?.pagination || {};

      allRows.push(...bookings);
      hasNextPage = Boolean(pagination.has_next_page);
      currentPage += 1;
    }

    return filterRowsAfterFetch(allRows);
  }

  function getReportTitle(rows) {
    if (filters.booking_type === "cruise") {
      if (filters.cruise) {
        return (
          selectedCruiseSchedule?.ship_name ||
          selectedCruiseSchedule?.schedule_name ||
          rows[0]?.schedule_id?.ship_name ||
          rows[0]?.schedule_id?.schedule_name ||
          rows[0]?.details?.cruise?.ship_name ||
          "Cruise Report"
        );
      }

      if (hasBothCruiseDates) {
        return "All Cruise Ships Report";
      }

      return "Cruise Report";
    }

    const selectedType = bookingTypeOptions.find(
      (option) => option.value === filters.booking_type
    );

    return `${selectedType?.label || "Booking"} Report`;
  }

  function getReportDateLabel(rows) {
    if (filters.ship_departure_date || filters.ship_arrival_date) {
      return `${filters.ship_departure_date || "Any"} → ${
        filters.ship_arrival_date || "Any"
      }`;
    }

    if (rows[0]?.start_date || rows[0]?.end_date) {
      return `${normalizeDateKey(rows[0]?.start_date) || "Any"} → ${
        normalizeDateKey(rows[0]?.end_date) || "Any"
      }`;
    }

    return "All dates";
  }

  async function handleGenerateReport(event) {
    event.preventDefault();

    if (!selectedColumns.length) {
      setError("Please select at least one column for the report.");
      return;
    }

    if (
      filters.booking_type === "cruise" &&
      !filters.cruise &&
      hasIncompleteCruiseDateRange
    ) {
      setError(
        "Please select both Ship Departure Date and Ship Arrival Date, or select a Cruise / Ship."
      );
      return;
    }

    if (
      filters.booking_type === "cruise" &&
      !canGenerateReport
    ) {
      setError(
        "Please select a Cruise / Ship, or select both Ship Departure Date and Ship Arrival Date."
      );
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setReport(null);

      const rows = await fetchAllBookingsForReport();
      const totalValue = rows.reduce((sum, booking) => {
        const amount = Number(booking?.price || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);

      setReport({
        title: getReportTitle(rows),
        dateLabel: getReportDateLabel(rows),
        bookingType: filters.booking_type,
        filters: { ...filters },
        selectedColumns: [...selectedColumns],
        rows,
        totalValue,
        isSavedSnapshot: false,
      });
    } catch (error) {
      setError(getErrorMessage(error, "Failed to generate report."));

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        router.replace("/admin/login");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveReport({ report, reportName, exportRows, columns }) {
    try {
      setSavingReport(true);
      setError("");

      const res = await axios.post(
        "/admin/reports",
        {
          name: reportName,
          report_type: report.bookingType,
          title: report.title,
          date_label: report.dateLabel,
          filters: report.filters,
          selected_columns: report.selectedColumns,
          columns,
          rows: exportRows,
          total_value: report.totalValue,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to save report.");
      }

      alert("Report saved successfully.");
      await fetchSavedReports();
    } catch (error) {
      setError(getErrorMessage(error, "Failed to save report."));

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAdminSession();
        router.replace("/admin/login");
      }
    } finally {
      setSavingReport(false);
    }
  }

  async function fetchSavedReportById(reportId) {
    const res = await axios.get(`/admin/reports/${reportId}`, {
      headers: getAuthHeaders(),
    });

    if (!res.data?.success) {
      throw new Error(res.data?.message || "Failed to load saved report.");
    }

    return res.data?.data?.report;
  }

  async function handleViewSavedReport(savedReport) {
    try {
      setError("");
      const fullReport = await fetchSavedReportById(savedReport._id);
      setReport(savedReportToModalReport(fullReport));
    } catch (error) {
      setError(getErrorMessage(error, "Failed to view saved report."));
    }
  }

  async function handleDownloadSavedReport(savedReport) {
    try {
      setError("");
      const fullReport = await fetchSavedReportById(savedReport._id);
      const rows = Array.isArray(fullReport?.rows) ? fullReport.rows : [];

      downloadExcelFile({
        rows,
        filename: `${fullReport?.name || "saved-report"}-${Date.now()}.xls`,
      });
    } catch (error) {
      setError(getErrorMessage(error, "Failed to download saved report."));
    }
  }

  async function handleDeleteSavedReport(savedReport) {
    const confirmed = window.confirm(
      `Delete saved report "${savedReport.name}" permanently?`
    );

    if (!confirmed) return;

    try {
      setError("");

      const res = await axios.delete(`/admin/reports/${savedReport._id}`, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to delete report.");
      }

      await fetchSavedReports();
    } catch (error) {
      setError(getErrorMessage(error, "Failed to delete report."));
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-5 text-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
          Admin
        </p>

        <h1 className="mt-1 text-xl font-bold text-gray-950 md:text-2xl">
          Reports Generator
        </h1>

        <p className="mt-2 text-xs text-gray-500">
          Select booking type, choose report columns, filter records, and save
          generated reports permanently.
        </p>
      </div>

      <form onSubmit={handleGenerateReport} className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-950">Report Filters</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="text-xs font-bold text-gray-700">
                Booking Type
              </label>

              <select
                value={filters.booking_type}
                onChange={(event) => handleBookingTypeChange(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
              >
                {bookingTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {filters.booking_type === "cruise" && (
              <>
                <div>
                  <label className="text-xs font-bold text-gray-700">
                    Cruise / Ship
                  </label>

                  <select
                    value={filters.cruise}
                    onChange={(event) => handleCruiseChange(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
                    disabled={loadingReferences}
                  >
                    <option value="">
                      {loadingReferences
                        ? "Loading ships..."
                        : "Select Cruise / Ship"}
                    </option>

                    {cruiseSchedules.map((schedule) => (
                      <option key={schedule._id} value={schedule._id}>
                        {schedule.ship_name ||
                          schedule.schedule_name ||
                          "Unnamed Cruise"}
                        {schedule.departure_date
                          ? ` (${toDateInputValue(schedule.departure_date)})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700">
                    Ship Departure Date
                  </label>

                  <input
                    type="date"
                    value={filters.ship_departure_date}
                    onChange={(event) =>
                      handleCruiseDateChange(
                        "ship_departure_date",
                        event.target.value
                      )
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700">
                    Ship Arrival Date
                  </label>

                  <input
                    type="date"
                    value={filters.ship_arrival_date}
                    onChange={(event) =>
                      handleCruiseDateChange(
                        "ship_arrival_date",
                        event.target.value
                      )
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-bold text-gray-700">
                Payment Status
              </label>

              <select
                value={filters.payment_status}
                onChange={(event) =>
                  updateFilter("payment_status", event.target.value)
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-600"
              >
                {paymentStatusOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filters.booking_type === "cruise" && (
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <p>
                Select a Cruise / Ship to automatically show that ship&apos;s
                departure and arrival dates and generate its report.
              </p>
              <p className="mt-1">
                Or select both dates manually. Manual date selection clears the
                ship filter and generates a report for all ships matching those
                dates.
              </p>

              {!filters.cruise && hasIncompleteCruiseDateRange && (
                <p className="mt-1 font-bold text-red-600">
                  Both departure and arrival dates are required.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-950">
                Report Columns
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Select which columns should appear in the report popup, Excel
                file, and saved database report.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllColumns}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-slate-50"
              >
                Select All
              </button>

              <button
                type="button"
                onClick={clearColumns}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {availableColumns.map((column) => (
              <label
                key={column.key}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-slate-100"
              >
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(column.key)}
                  onChange={() => toggleColumn(column.key)}
                  className="h-3.5 w-3.5"
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={generating || !canGenerateReport}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </form>

      <SavedReportsTable
        reports={savedReports}
        loading={loadingSavedReports}
        onView={handleViewSavedReport}
        onDownload={handleDownloadSavedReport}
        onDelete={handleDeleteSavedReport}
      />

      <ReportModal
        key={
          report
            ? `${report.id || "generated"}-${report.title || "report"}-${
                report.dateLabel || "all-dates"
              }-${report.isSavedSnapshot ? "saved" : "generated"}`
            : "closed-report-modal"
        }
        report={report}
        selectedColumns={selectedColumns}
        availableColumns={
          report?.isSavedSnapshot && report.columns?.length
            ? report.columns
            : availableColumns
        }
        onClose={() => setReport(null)}
        onSaveReport={handleSaveReport}
        savingReport={savingReport}
      />
    </div>
  );
}
