"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

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

function formatText(value) {
  if (!value) return "-";

  const normalized = String(value).toLowerCase();

  if (normalized === "poa") return "Pay On Arrival";
  if (normalized === "paypal") return "PayPal";
  if (normalized === "full_online") return "Full Payment";
  if (normalized === "poa_deposit") return "Pay On Arrival Deposit";
  if (normalized === "returning_customer") return "Returning Customer";
  if (normalized === "partially_refunded") return "Partially Refunded";

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

function getMaxValue(items = [], key = "count") {
  const values = items.map((item) => Number(item?.[key] || 0));
  return Math.max(...values, 1);
}

function getTopItemByKey(items = [], key = "count") {
  if (!Array.isArray(items) || items.length === 0) return null;

  return [...items].sort(
    (first, second) => Number(second?.[key] || 0) - Number(first?.[key] || 0)
  )[0];
}

function CardShell({ children, className = "" }) {
  return (
    <div
      className={`rounded-3xl border border-gray-100 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  tone = "blue",
  footer,
  compact = false,
}) {
  const toneMap = {
    blue: {
      blob: "from-blue-500 to-indigo-600",
      text: "text-blue-700",
      bg: "bg-blue-50",
    },
    emerald: {
      blob: "from-emerald-500 to-teal-600",
      text: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    amber: {
      blob: "from-amber-500 to-orange-600",
      text: "text-amber-700",
      bg: "bg-amber-50",
    },
    rose: {
      blob: "from-rose-500 to-red-600",
      text: "text-rose-700",
      bg: "bg-rose-50",
    },
    violet: {
      blob: "from-violet-500 to-purple-600",
      text: "text-violet-700",
      bg: "bg-violet-50",
    },
    slate: {
      blob: "from-slate-700 to-slate-950",
      text: "text-slate-700",
      bg: "bg-slate-50",
    },
  };

  const selectedTone = toneMap[tone] || toneMap.blue;

  return (
    <CardShell className="relative overflow-hidden p-5">
      <div
        className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${selectedTone.blob} opacity-10`}
      />

      <div className="relative">
        <p className={`text-sm font-bold ${selectedTone.text}`}>{title}</p>

        <p
          className={`mt-3 font-black tracking-tight text-gray-950 ${compact ? "text-2xl" : "text-3xl"
            }`}
        >
          {value}
        </p>

        {subtitle && (
          <p className="mt-2 text-sm font-medium text-gray-500">{subtitle}</p>
        )}

        {footer && (
          <div className={`mt-4 rounded-2xl ${selectedTone.bg} px-3 py-2`}>
            <p className="text-xs font-semibold text-gray-600">{footer}</p>
          </div>
        )}
      </div>
    </CardShell>
  );
}

function SectionTitle({ title, subtitle, rightContent }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-black tracking-tight text-gray-950">
          {title}
        </h2>

        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>

      {rightContent}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}

function ProgressList({
  items = [],
  labelKey,
  valueKey = "count",
  amountKey,
  emptyText,
  labelFormatter = formatText,
}) {
  const max = getMaxValue(items, valueKey);

  if (!items.length) {
    return <EmptyState text={emptyText || "No data found."} />;
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const rawLabel = item?.[labelKey];
        const label = labelFormatter(rawLabel);
        const value = Number(item?.[valueKey] || 0);
        const amount = amountKey ? Number(item?.[amountKey] || 0) : null;
        const width = Math.max((value / max) * 100, 4);

        return (
          <div key={`${label}-${index}`}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-800">
                  {label}
                </p>

                {item?.type && labelKey !== "type" && (
                  <p className="text-xs text-gray-500">
                    {formatText(item.type)}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-black text-gray-950">{value}</p>

                {amountKey && (
                  <p className="text-xs font-semibold text-gray-500">
                    {money(amount)}
                  </p>
                )}
              </div>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InfoPanel({ title, subtitle, children }) {
  return (
    <CardShell className="p-5">
      <SectionTitle title={title} subtitle={subtitle} />
      {children}
    </CardShell>
  );
}

function TopPaymentMethodCard({ byCount, byAmount }) {
  const countMethod = byCount || {};
  const amountMethod = byAmount || byCount || {};

  return (
    <div className="rounded-3xl bg-gradient-to-br from-gray-950 via-blue-950 to-indigo-950 p-6 text-white shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-200">
        Mostly Received Payment
      </p>

      <p className="mt-4 text-3xl font-black tracking-tight">
        {formatText(countMethod.method)}
      </p>

      <p className="mt-2 text-sm text-blue-100">
        Most used payment method by transaction count.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-xs font-bold text-blue-100">Transactions</p>
          <p className="mt-2 text-xl font-black">{countMethod.count || 0}</p>
        </div>

        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-xs font-bold text-blue-100">Amount</p>
          <p className="mt-2 text-lg font-black">
            {money(countMethod.amount)}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white/10 p-4">
        <p className="text-xs font-bold text-blue-100">Top By Amount</p>
        <p className="mt-2 text-lg font-black">
          {formatText(amountMethod.method)} · {money(amountMethod.amount)}
        </p>
      </div>
    </div>
  );
}

function TodayMovement({ today }) {
  const movementByType = Array.isArray(today?.movement_by_type)
    ? today.movement_by_type
    : [];

  return (
    <CardShell className="p-5">
      <SectionTitle
        title="Today's Movement"
        subtitle={`Come in, go out, new bookings, and payments for ${formatDate(
          today?.date || new Date()
        )}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-emerald-50 p-5">
          <p className="text-sm font-black text-emerald-700">
            Total Come In Today
          </p>
          <p className="mt-3 text-3xl font-black text-emerald-950">
            {today?.total_in_today || 0}
          </p>
        </div>

        <div className="rounded-2xl bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-700">
            Total Out Today
          </p>
          <p className="mt-3 text-3xl font-black text-amber-950">
            {today?.total_out_today || 0}
          </p>
        </div>

        <div className="rounded-2xl bg-blue-50 p-5">
          <p className="text-sm font-black text-blue-700">
            Bookings Created Today
          </p>
          <p className="mt-3 text-3xl font-black text-blue-950">
            {today?.bookings_created_today || 0}
          </p>
        </div>

        <div className="rounded-2xl bg-violet-50 p-5">
          <p className="text-sm font-black text-violet-700">
            Payments Received Today
          </p>
          <p className="mt-3 text-2xl font-black text-violet-950">
            {money(today?.payments_received_today)}
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-5">
        {/* <div className="mb-4">
          <p className="text-sm font-black text-gray-950">
            Today by Booking Type
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500">
            Today&apos;s arrivals, departures, and cars scheduled on-site.
          </p>
        </div> */}

        <div className="grid gap-4 lg:grid-cols-3">
          {movementByType.map((item) => (
            <div
              key={item.type}
              className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-base font-black text-gray-950">
                  {formatText(item.type)}
                </p>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-gray-500 shadow-sm">
                  Booking
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                    In
                  </p>
                  <p className="mt-2 text-2xl font-black text-emerald-950">
                    {item.in_today || 0}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                    Out
                  </p>
                  <p className="mt-2 text-2xl font-black text-amber-950">
                    {item.out_today || 0}
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 p-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                    On-Site Cars
                  </p>
                  <p className="mt-2 text-2xl font-black text-blue-950">
                    {item.onsite_cars || 0}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

function TableShell({ title, subtitle, children }) {
  return (
    <CardShell className="overflow-hidden">
      <div className="p-5">
        <SectionTitle title={title} subtitle={subtitle} />
      </div>

      {children}
    </CardShell>
  );
}

function StatusPill({ value }) {
  const normalized = String(value || "").toLowerCase();

  const color =
    normalized === "success" ||
      normalized === "confirmed" ||
      normalized === "paid" ||
      normalized === "completed"
      ? "bg-emerald-50 text-emerald-700"
      : normalized === "pending" ||
        normalized === "pending_payment" ||
        normalized === "partial" ||
        normalized === "poa"
        ? "bg-amber-50 text-amber-700"
        : normalized === "failed" ||
          normalized === "cancelled" ||
          normalized === "refunded" ||
          normalized === "partially_refunded"
          ? "bg-rose-50 text-rose-700"
          : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${color}`}
    >
      {formatText(value)}
    </span>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const overview = dashboard?.overview || {};
  const recent = dashboard?.recent || {};
  const charts = dashboard?.charts || {};

  useEffect(() => {
    setMounted(true);

    const token = getAdminToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    async function fetchDashboard() {
      try {
        setLoading(true);
        setError("");

        const res = await axios.get("/admin/dashboard", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
            res.data?.error ||
            "Failed to load admin dashboard."
          );
        }

        setDashboard(res.data.data);
      } catch (error) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load admin dashboard.";

        setError(message);

        if (error.response?.status === 401 || error.response?.status === 403) {
          clearAdminSession();
          router.replace("/admin/login");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [router]);

  const paymentMethodSummary = useMemo(() => {
    return charts.payments_by_method || [];
  }, [charts.payments_by_method]);

  const bookingStatusSummary = useMemo(() => {
    return charts.bookings_by_status || [];
  }, [charts.bookings_by_status]);

  const bookingLocationSummary = useMemo(() => {
    return charts.bookings_by_location || [];
  }, [charts.bookings_by_location]);

  const bookingSourceSummary = useMemo(() => {
    return charts.bookings_by_source || [];
  }, [charts.bookings_by_source]);

  const topPaymentMethodByCount = useMemo(() => {
    return (
      charts.top_payment_method_by_count ||
      getTopItemByKey(paymentMethodSummary, "count")
    );
  }, [charts.top_payment_method_by_count, paymentMethodSummary]);

  const topPaymentMethodByAmount = useMemo(() => {
    return (
      charts.top_payment_method_by_amount ||
      getTopItemByKey(paymentMethodSummary, "amount")
    );
  }, [charts.top_payment_method_by_amount, paymentMethodSummary]);

  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
        <h2 className="text-2xl font-black text-gray-950">
          Loading dashboard...
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Please wait while we load system overview.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        <h2 className="font-black">Dashboard could not be loaded</h2>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  if (!dashboard) {
    return <EmptyState text="No dashboard data found." />;
  }

  return (
    <div className="space-y-8">
      {/* <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-gray-950 via-blue-950 to-indigo-950 p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div>

            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-200">
              System Overview
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
              Admin Dashboard
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100">
              Visual summary of bookings, total revenue, locations, payment
              methods, lead sources, and today's customer movement.
            </p>

          </div>

          <div className="rounded-2xl bg-white/10 px-5 py-4">
            <p className="text-xs font-semibold text-blue-100">Logged in as</p>
            <p className="mt-1 text-lg font-black">
              {dashboard.admin?.name || "Admin"}
            </p>
            <p className="text-xs text-blue-100">
              {dashboard.admin?.email || ""}
            </p>
          </div>
        </div>
      </section> */}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Bookings"
          value={overview.bookings?.total || 0}
          subtitle={`${overview.bookings?.confirmed || 0} confirmed bookings`}
          tone="blue"
          compact={true}
        />

        <StatCard
          title="Total Revenue"
          value={money(overview.payments?.total_revenue)}
          subtitle="Paid payment records"
          tone="emerald"
          compact={true}
        />

        <StatCard
          title="Due Amount"
          value={money(overview.bookings?.due_amount)}
          subtitle="Remaining unpaid balance"
          tone="amber"
          compact={true}
        />

        <StatCard
          title="Customers"
          value={overview.customers?.total || 0}
          subtitle={`${overview.customers?.active || 0} active customers`}
          tone="violet"
          compact={true}
        />
      </section>

      <TodayMovement today={overview.today} />

      <section className="grid gap-6 xl:grid-cols-3">
        <TopPaymentMethodCard
          byCount={topPaymentMethodByCount}
          byAmount={topPaymentMethodByAmount}
        />

        <InfoPanel
          title="Payments by Method"
          subtitle="Transaction count and amount grouped by payment method."
        >
          <ProgressList
            items={paymentMethodSummary}
            labelKey="method"
            valueKey="count"
            amountKey="amount"
            emptyText="No payment method data found."
          />
        </InfoPanel>

        <InfoPanel
          title="How Did They Hear About Us?"
          subtitle="Lead sources selected during booking."
        >
          <ProgressList
            items={bookingSourceSummary}
            labelKey="source"
            valueKey="count"
            amountKey="revenue"
            emptyText="No lead source data found. Make sure bookings save the source field."
          />
        </InfoPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <InfoPanel
          title="Bookings by Location"
          subtitle="How many bookings each location has received."
        >
          <ProgressList
            items={bookingLocationSummary}
            labelKey="name"
            valueKey="count"
            amountKey="revenue"
            labelFormatter={(value) => value || "Unknown Location"}
            emptyText="No location booking data found."
          />
        </InfoPanel>

        <InfoPanel
          title="Bookings by Status"
          subtitle="Current booking status distribution."
        >
          <ProgressList
            items={bookingStatusSummary}
            labelKey="status"
            valueKey="count"
            emptyText="No booking status data found."
          />
        </InfoPanel>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Booking Total Value"
          value={money(overview.bookings?.total_value)}
          tone="blue"
          compact={true}
        />

        <StatCard
          title="Paid Amount"
          value={money(overview.bookings?.paid_amount)}
          tone="emerald"
          compact={true}
        />

        <StatCard
          title="Pay On Arrival"
          value={overview.bookings?.pay_on_arrival || 0}
          subtitle={`${money(
            overview.bookings?.poa_balance_due_on_arrival
          )} due on arrival`}
          tone="amber"
          compact={true}
        />

        <StatCard
          title="Wallet Balance"
          value={money(overview.wallet?.total_balance)}
          subtitle={`${overview.wallet?.customer_wallets || 0} customer wallets`}
          tone="slate"
          compact={true}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Stripe Revenue"
          value={money(overview.payments?.stripe_revenue)}
          tone="blue"
          compact={true}
        />

        <StatCard
          title="PayPal Revenue"
          value={money(overview.payments?.paypal_revenue)}
          tone="emerald"
          compact={true}
        />

        <StatCard
          title="Wallet Revenue"
          value={money(overview.payments?.wallet_revenue)}
          tone="violet"
          compact={true}
        />

        <StatCard
          title="Failed Payments"
          value={overview.payments?.failed || 0}
          subtitle={`${overview.payments?.pending || 0} pending payments`}
          tone="rose"
          compact={true}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Locations"
          value={overview.locations?.total || 0}
          subtitle={`${overview.locations?.active || 0} active locations`}
          tone="blue"
          compact={true}
        />

        <StatCard
          title="Cruise Schedules"
          value={overview.cruise_schedules?.total || 0}
          subtitle={`${overview.cruise_schedules?.active || 0} active schedules`}
          tone="emerald"
          compact={true}
        />

        <StatCard
          title="Coupons"
          value={overview.coupons?.total || 0}
          subtitle={`${overview.coupons?.active || 0} active coupons`}
          tone="amber"
          compact={true}
        />

        <StatCard
          title="Storage Types"
          value={overview.storage_types?.total || 0}
          subtitle={`${overview.storage_types?.active || 0} active storage types`}
          tone="violet"
          compact={true}
        />
      </section>

      {/* ── Recent Bookings ── */}
      <TableShell
        title="Recent Bookings"
        subtitle="Latest bookings from customers and guests."
      >
        {!recent.bookings || recent.bookings.length === 0 ? (
          <div className="p-5">
            <EmptyState text="No recent bookings found." />
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-left text-[0.72rem] sm:text-[0.8rem]">
              <thead>
                <tr className="border-y bg-gray-50 text-gray-700">
                  <th className="w-[14%] px-[1%] py-[1.2%] font-semibold">
                    Booking ID
                  </th>

                  <th className="w-[18%] px-[1%] py-[1.2%] font-semibold">
                    Customer
                  </th>

                  <th className="w-[16%] px-[1%] py-[1.2%] font-semibold">
                    Location
                  </th>

                  <th className="w-[10%] px-[1%] py-[1.2%] font-semibold">
                    Type
                  </th>

                  <th className="w-[14%] px-[1%] py-[1.2%] font-semibold">
                    Payment
                  </th>

                  <th className="w-[10%] px-[1%] py-[1.2%] font-semibold">
                    Status
                  </th>

                  <th className="w-[8%] px-[1%] py-[1.2%] font-semibold">
                    Total
                  </th>

                  <th className="w-[10%] px-[1%] py-[1.2%] font-semibold">
                    Created
                  </th>
                </tr>
              </thead>

              <tbody>
                {recent.bookings.map((booking) => (
                  <tr
                    key={booking._id}
                    className="border-b align-top text-[0.7rem] sm:text-[0.78rem]"
                  >
                    {/* BOOKING ID */}
                    <td className="w-[14%] break-words px-[1%] py-[1.2%] font-bold text-gray-900">
                      {booking.booking_id}
                    </td>

                    {/* CUSTOMER */}
                    <td className="w-[18%] break-words px-[1%] py-[1.2%]">
                      <p className="break-words font-semibold text-gray-900 leading-[135%]">
                        {booking.customer?.name || "-"}
                      </p>

                      <p className="mt-[1%] break-words text-[0.65rem] text-gray-500 leading-[130%] sm:text-[0.72rem]">
                        {booking.customer?.email || "-"}
                      </p>
                    </td>

                    {/* LOCATION */}
                    <td className="w-[16%] break-words px-[1%] py-[1.2%] leading-[130%]">
                      {booking.location_id?.name || "-"}
                    </td>

                    {/* TYPE */}
                    <td className="w-[10%] break-words px-[1%] py-[1.2%] leading-[130%]">
                      {formatText(booking.type)}
                    </td>

                    {/* PAYMENT */}
                    <td className="w-[14%] break-words px-[1%] py-[1.2%]">
                      <p className="break-words font-medium leading-[130%]">
                        {formatText(booking.payment_method)}
                      </p>

                      <div className="mt-[3%] scale-[0.9] origin-left">
                        <StatusPill value={booking.payment_status} />
                      </div>
                    </td>

                    {/* STATUS */}
                    <td className="w-[10%] break-words px-[1%] py-[1.2%]">
                      <div className="scale-[0.9] origin-left">
                        <StatusPill value={booking.status} />
                      </div>
                    </td>

                    {/* TOTAL */}
                    <td className="w-[8%] break-words px-[1%] py-[1.2%] font-bold">
                      {money(booking.price)}
                    </td>

                    {/* CREATED */}
                    <td className="w-[10%] break-words px-[1%] py-[1.2%] leading-[130%]">
                      {formatDate(booking.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableShell>

      <TableShell
        title="Recent Payments"
        subtitle="Latest Stripe, PayPal, wallet, and top-up payments."
      >
        {!recent.payments || recent.payments.length === 0 ? (
          <div className="p-5">
            <EmptyState text="No recent payments found." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y bg-gray-50 text-gray-700">
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>

              <tbody>
                {recent.payments.map((payment) => (
                  <tr key={payment._id} className="border-b align-top">
                    <td className="px-4 py-3 font-black">
                      {formatText(payment.method)}
                    </td>

                    <td className="px-4 py-3">
                      {formatText(payment.payment_purpose)}
                    </td>

                    <td className="px-4 py-3 font-black">
                      {money(payment.amount)}
                    </td>

                    <td className="px-4 py-3">
                      <StatusPill value={payment.status} />
                    </td>

                    <td className="max-w-[240px] break-all px-4 py-3 text-xs text-gray-600">
                      {payment.provider_capture_id ||
                        payment.provider_order_id ||
                        payment.provider_payment_intent_id ||
                        payment.transaction_id ||
                        "-"}
                    </td>

                    <td className="min-w-[170px] px-4 py-3">
                      {formatDateTime(payment.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableShell>

      <TableShell
        title="Recent Wallet Transactions"
        subtitle="Top-ups, booking payments, credits, debits, and refunds."
      >
        {!recent.wallet_transactions ||
          recent.wallet_transactions.length === 0 ? (
          <div className="p-5">
            <EmptyState text="No recent wallet transactions found." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y bg-gray-50 text-gray-700">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Balance After</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>

              <tbody>
                {recent.wallet_transactions.map((transaction) => (
                  <tr key={transaction._id} className="border-b align-top">
                    <td className="min-w-[220px] px-4 py-3">
                      <p className="font-bold">
                        {transaction.user_id?.name || "-"}
                      </p>

                      <p className="text-xs text-gray-500">
                        {transaction.user_id?.email || "-"}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      {formatText(transaction.type)}
                    </td>

                    <td className="px-4 py-3 font-black">
                      {money(transaction.amount)}
                    </td>

                    <td className="px-4 py-3">
                      {money(transaction.balance_after)}
                    </td>

                    <td className="px-4 py-3">
                      <StatusPill value={transaction.status} />
                    </td>

                    <td className="max-w-[220px] break-all px-4 py-3 text-xs text-gray-600">
                      {transaction.transaction_reference ||
                        transaction.reference ||
                        transaction._id}
                    </td>

                    <td className="min-w-[170px] px-4 py-3">
                      {formatDateTime(transaction.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableShell>
    </div>
  );
}