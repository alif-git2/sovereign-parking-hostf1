"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially Refunded" },
];

const METHOD_OPTIONS = [
  { value: "all", label: "All Methods" },
  { value: "stripe", label: "Stripe" },
  { value: "paypal", label: "PayPal" },
  { value: "wallet", label: "Wallet" },
  { value: "poa", label: "Pay on Arrival" },
  { value: "credit_card_manual", label: "Manual Card" },
];

const BOOKING_TYPE_OPTIONS = [
  { value: "all", label: "All Booking Types" },
  { value: "cruise", label: "Cruise" },
  { value: "storage", label: "Storage" },
  { value: "airport", label: "Airport" },
];

const PAYMENT_FLOW_OPTIONS = [
  { value: "all", label: "All Flows" },
  { value: "full_online", label: "Full Payment" },
  { value: "poa_deposit", label: "POA Deposit" },
  { value: "wallet_topup", label: "Wallet Top Up" },
  { value: "wallet", label: "Wallet" },
  { value: "legacy_poa", label: "Legacy POA" },
];

const DEFAULT_FILTERS = {
  search: "",
  status: "all",
  method: "all",
  booking_type: "all",
  payment_flow: "all",
  date_from: "",
  date_to: "",
};

function getAuthHeaders() {
  if (typeof window === "undefined") return {};

  const token = localStorage.getItem("adminToken");

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function getStoredAdminUser() {
  if (typeof window === "undefined") return null;

  try {
    const rawUser = localStorage.getItem("adminUser");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function clearAdminSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
}

function buildPaymentQueryParams({ page, limit, filters }) {
  const params = {
    page,
    limit,
  };

  const search = String(filters.search || "").trim();

  if (search) {
    params.search = search;
  }

  if (filters.status && filters.status !== "all") {
    params.status = filters.status;
  }

  if (filters.method && filters.method !== "all") {
    params.method = filters.method;
  }

  if (filters.booking_type && filters.booking_type !== "all") {
    params.booking_type = filters.booking_type;
    params.type = filters.booking_type;
  }

  if (filters.payment_flow && filters.payment_flow !== "all") {
    params.payment_flow = filters.payment_flow;
  }

  if (filters.date_from) {
    params.date_from = filters.date_from;
  }

  if (filters.date_to) {
    params.date_to = filters.date_to;
  }

  return params;
}

function money(amount, currency = "A$") {
  const normalizedCurrency = String(currency || "A$").toLowerCase();

  const symbolMap = {
    aud: "A$",
    usd: "$",
    nzd: "NZ$",
    gbp: "£",
    eur: "€",
    "a$": "A$",
  };

  const symbol = symbolMap[normalizedCurrency] || String(currency || "A$");

  return `${symbol}${Number(amount || 0).toFixed(2)}`;
}

function formatDate(value) {
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

function titleCase(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStatus(status) {
  const labels = {
    paid: "Paid",
    pending: "Pending",
    failed: "Failed",
    refunded: "Refunded",
    partially_refunded: "Partially Refunded",
    succeeded: "Paid",
    success: "Paid",
    completed: "Paid",
    cancelled: "Cancelled",
  };

  return labels[status] || titleCase(status);
}

function formatMethod(method) {
  const labels = {
    stripe: "Stripe",
    paypal: "PayPal",
    wallet: "Wallet",
    poa: "Pay on Arrival",
    credit_card_manual: "Manual Card",
    bank: "Bank",
    admin: "Admin",
  };

  return labels[method] || titleCase(method);
}

function formatFlow(flow) {
  const labels = {
    full_online: "Full Payment",
    poa_deposit: "POA Deposit",
    wallet_topup: "Wallet Top Up",
    wallet: "Wallet",
    legacy_poa: "Legacy POA",
    manual: "Manual",
    online: "Online",
  };

  return labels[flow] || titleCase(flow);
}

function formatPurpose(purpose) {
  const labels = {
    booking: "Booking",
    payment: "Payment",
    booking_payment: "Booking Payment",
    parking_booking: "Booking Payment",
    wallet_topup: "Wallet Top Up",
    poa_deposit: "POA Deposit",
    poa_holding_deposit: "POA Holding Deposit",
    full_online_payment: "Full Payment",
    wallet_payment: "Wallet Payment",
    refund: "Refund",
    cancellation_refund: "Cancellation Refund",
  };

  return labels[purpose] || titleCase(purpose || "booking_payment");
}

function getStatusClass(status) {
  if (["paid", "succeeded", "success", "completed"].includes(status)) {
    return "bg-green-50 text-green-700 ring-green-200";
  }

  if (status === "pending") {
    return "bg-yellow-50 text-yellow-700 ring-yellow-200";
  }

  if (["failed", "cancelled"].includes(status)) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (["refunded", "partially_refunded"].includes(status)) {
    return "bg-purple-50 text-purple-700 ring-purple-200";
  }

  return "bg-gray-100 text-gray-700 ring-gray-200";
}

function getBookingType(payment) {
  return (
    payment.booking_type ||
    payment.type ||
    payment.booking?.type ||
    payment.booking_id?.type ||
    "-"
  );
}

function getBookingRef(payment) {
  return (
    payment.booking_ref ||
    payment.booking_reference ||
    payment.booking_number ||
    payment.booking?.booking_id ||
    payment.booking_id?.booking_id ||
    "-"
  );
}

function getProviderReference(payment) {
  return (
    payment.provider_reference ||
    payment.provider_payment_id ||
    payment.provider_order_id ||
    payment.provider_capture_id ||
    payment.provider_refund_id ||
    payment.transaction_id ||
    "-"
  );
}

function getCustomerName(payment) {
  return (
    payment.customer_name ||
    payment.customer?.name ||
    payment.booking?.customer?.name ||
    payment.booking_id?.customer?.name ||
    payment.user_id?.name ||
    "-"
  );
}

function getCustomerEmail(payment) {
  return (
    payment.customer_email ||
    payment.customer?.email ||
    payment.booking?.customer?.email ||
    payment.booking_id?.customer?.email ||
    payment.user_id?.email ||
    "-"
  );
}

function getCustomerPhone(payment) {
  return (
    payment.customer_phone ||
    payment.customer?.phone ||
    payment.booking?.customer?.phone ||
    payment.booking_id?.customer?.phone ||
    payment.user_id?.phone ||
    "-"
  );
}

function getPagination(data, fallbackPage, fallbackLimit) {
  const raw = data?.pagination || {};

  return {
    page: Number(raw.page || fallbackPage || 1),
    limit: Number(raw.limit || fallbackLimit || 20),
    total: Number(raw.total || 0),
    totalPages: Number(raw.totalPages || raw.total_pages || 1),
  };
}

function StatusBadge({ value, className }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${className}`}
    >
      {value}
    </span>
  );
}

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-extrabold text-gray-950">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
        —
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-600">{message}</p>
    </div>
  );
}

export default function AdminPaymentsPage() {
  const router = useRouter();

  const [payments, setPayments] = useState([]);
  const [counts, setCounts] = useState({});
  const [totals, setTotals] = useState({
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    refundedAmount: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentPage = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

  const pageTitle = useMemo(() => {
    const statusLabel =
      STATUS_OPTIONS.find((item) => item.value === filters.status)?.label ||
      "All Status";

    return `${statusLabel} Payments`;
  }, [filters.status]);

  const fetchPayments = useCallback(
    async (page = 1, nextFilters = filters) => {
      try {
        setLoading(true);
        setError("");

        const token = getAuthHeaders();

        const res = await axios.get("/admin/payments", {
          headers: token,
          params: buildPaymentQueryParams({
            page,
            limit: pagination.limit,
            filters: nextFilters,
          }),
        });

        if (!res.data?.success) {
          throw new Error(
            res.data?.message || res.data?.error || "Failed to fetch payments."
          );
        }

        const data = res.data.data || {};

        setPayments(Array.isArray(data.payments) ? data.payments : []);
        setCounts(data.counts || {});
        setTotals(
          data.totals || {
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            refundedAmount: 0,
          }
        );
        setPagination(getPagination(data, page, pagination.limit));
      } catch (error) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to fetch payments.";

        setError(message);

        if (
          error.response?.status === 401 ||
          String(message).toLowerCase().includes("token") ||
          String(message).toLowerCase().includes("unauthorized")
        ) {
          clearAdminSession();
          router.replace("/admin/login");
        }

        if (
          error.response?.status === 403 ||
          String(message).toLowerCase().includes("admin access")
        ) {
          router.replace("/admin/dashboard");
        }
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit, router]
  );

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    const adminUser = getStoredAdminUser();

    if (adminUser && adminUser.role !== "admin") {
      router.replace("/admin/dashboard");
      return;
    }

    fetchPayments(1, filters);
  }, [
    filters.status,
    filters.method,
    filters.booking_type,
    filters.payment_flow,
    fetchPayments,
    router,
  ]);

  function updateFilter(name, value) {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    fetchPayments(1, filters);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    fetchPayments(1, DEFAULT_FILTERS);
  }

  function openBooking(payment) {
    const bookingType = getBookingType(payment);
    const bookingRef = getBookingRef(payment);

    if (!bookingType || !bookingRef || bookingType === "-" || bookingRef === "-") {
      return;
    }

    router.push(
      `/admin/bookings/${bookingType}?search=${encodeURIComponent(bookingRef)}`
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="relative p-6 md:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-blue-50" />

            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
                  Admin Payments
                </p>

                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-950">
                  Payments
                </h1>

                <p className="mt-2 max-w-2xl text-sm text-gray-600">
                  View customer booking payments from Stripe, PayPal, Wallet,
                  and Pay on Arrival deposits.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fetchPayments(currentPage, filters)}
                className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-800 shadow-sm hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            title="Total Amount"
            value={money(totals.totalAmount)}
            subtitle={`${counts.all || 0} payment records`}
          />

          <SummaryCard
            title="Paid Amount"
            value={money(totals.paidAmount)}
            subtitle={`${counts.paid || counts.succeeded || counts.completed || 0} paid`}
          />

          <SummaryCard
            title="Pending Amount"
            value={money(totals.pendingAmount)}
            subtitle={`${counts.pending || 0} pending`}
          />

          <SummaryCard
            title="Refunded Amount"
            value={money(totals.refundedAmount)}
            subtitle={`${counts.refunded || counts.partially_refunded || 0} refunded`}
          />
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Search
                </label>

                <input
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                  placeholder="Booking ID, customer, email, provider reference..."
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Status
                </label>

                <select
                  value={filters.status}
                  onChange={(event) => updateFilter("status", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Method
                </label>

                <select
                  value={filters.method}
                  onChange={(event) => updateFilter("method", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                >
                  {METHOD_OPTIONS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Booking Type
                </label>

                <select
                  value={filters.booking_type}
                  onChange={(event) =>
                    updateFilter("booking_type", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                >
                  {BOOKING_TYPE_OPTIONS.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Flow
                </label>

                <select
                  value={filters.payment_flow}
                  onChange={(event) =>
                    updateFilter("payment_flow", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                >
                  {PAYMENT_FLOW_OPTIONS.map((flow) => (
                    <option key={flow.value} value={flow.value}>
                      {flow.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto_auto]">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Date From
                </label>

                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(event) =>
                    updateFilter("date_from", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Date To
                </label>

                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(event) => updateFilter("date_to", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 md:w-auto"
                >
                  Search
                </button>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="w-full rounded-2xl border border-gray-200 px-6 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 md:w-auto"
                >
                  Reset
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-950">
                {pageTitle}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Showing {payments.length} of {pagination.total || 0} payments.
              </p>
            </div>
          </div>

          {error && (
            <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-sm font-semibold text-gray-600">
              Loading payments...
            </div>
          ) : payments.length === 0 ? (
            <EmptyState message="No payments found." />
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 uppercase tracking-wide text-gray-500">
                    <th className="whitespace-nowrap px-4 py-3">Date</th>
                    <th className="whitespace-nowrap px-4 py-3">Booking</th>
                    <th className="whitespace-nowrap px-4 py-3">Customer</th>
                    <th className="whitespace-nowrap px-4 py-3">Amount</th>
                    <th className="whitespace-nowrap px-4 py-3">Method</th>
                    <th className="whitespace-nowrap px-4 py-3">Flow</th>
                    <th className="whitespace-nowrap px-4 py-3">Purpose</th>
                    <th className="whitespace-nowrap px-4 py-3">Status</th>
                    <th className="whitespace-nowrap px-4 py-3">Reference</th>
                    <th className="whitespace-nowrap px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {payments.map((payment) => {
                    const bookingRef = getBookingRef(payment);
                    const bookingType = getBookingType(payment);
                    const customerName = getCustomerName(payment);
                    const customerEmail = getCustomerEmail(payment);
                    const customerPhone = getCustomerPhone(payment);
                    const providerReference = getProviderReference(payment);

                    return (
                      <tr
                        key={payment._id}
                        className="align-top hover:bg-gray-50"
                      >
                        <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                          {formatDate(payment.createdAt)}
                        </td>

                        <td className="px-4 py-4">
                          <p className="whitespace-nowrap font-extrabold text-gray-950">
                            {bookingRef}
                          </p>

                          <p className="mt-1 capitalize text-gray-500">
                            {bookingType}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-gray-900">
                            {customerName}
                          </p>

                          <p className="mt-1 break-all text-gray-500">
                            {customerEmail}
                          </p>

                          <p className="mt-1 text-gray-500">{customerPhone}</p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 font-extrabold text-gray-950">
                          {money(payment.amount, payment.currency)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          {formatMethod(payment.method || payment.payment_method)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          {formatFlow(payment.payment_flow)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          {formatPurpose(payment.payment_purpose)}
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            value={formatStatus(payment.status)}
                            className={getStatusClass(payment.status)}
                          />
                        </td>

                        <td className="max-w-[220px] break-all px-4 py-4 text-gray-600">
                          {providerReference}
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => openBooking(payment)}
                            disabled={
                              !bookingRef ||
                              !bookingType ||
                              bookingRef === "-" ||
                              bookingType === "-"
                            }
                            className="whitespace-nowrap rounded-xl border border-blue-200 px-3 py-2 font-bold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            View Booking
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => fetchPayments(currentPage - 1, filters)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={currentPage >= totalPages || loading}
                onClick={() => fetchPayments(currentPage + 1, filters)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}