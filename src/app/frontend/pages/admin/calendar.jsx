"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const bookingTypeOptions = [
  { value: "cruise", label: "Cruise" },
  { value: "storage", label: "Storage" },
  { value: "airport", label: "Airport" },
];

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatText(value) {
  const labels = {
    cruise: "Cruise",
    storage: "Storage",
    airport: "Airport",
    today_in: "In",
    today_out: "Out",
    total: "Total",
    success: "Success",
    poa: "POA",
    pay_on_arrival: "POA",
  };

  return (
    labels[value] ||
    String(value || "-")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function getMonthLabel(monthValue) {
  if (!monthValue) return "";

  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(monthValue, direction) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");

  return `${nextYear}-${nextMonth}`;
}

function buildCalendarCells(days = [], monthValue) {
  if (!monthValue || days.length === 0) return [];

  const [year, month] = monthValue.split("-").map(Number);
  const firstDate = new Date(year, month - 1, 1);
  const blanks = firstDate.getDay();

  return [
    ...Array.from({ length: blanks }).map((_, index) => ({
      key: `blank-${index}`,
      blank: true,
    })),
    ...days.map((day) => ({
      ...day,
      key: day.date,
      blank: false,
    })),
  ];
}

function getBookingListUrl({ bookingType, date, filter }) {
  const params = new URLSearchParams();

  params.set("calendar_date", date);
  params.set("calendar_filter", filter);

  return `/admin/bookings/${bookingType}?${params.toString()}`;
}

function MetricButton({
  label,
  value,
  className,
  onClick,
  shortLabel = null,
}) {
  const number = Number(value || 0);

  if (number <= 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] font-bold transition hover:scale-[1.01] ${className}`}
      title={`${label}: ${number}`}
    >
      <span>{shortLabel || label}</span>
      <strong>{number}</strong>
    </button>
  );
}

export default function AdminCalendarPage() {
  const router = useRouter();

  const [bookingType, setBookingType] = useState("cruise");
  const [month, setMonth] = useState(getCurrentMonth());

  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(false);

  const calendarCells = useMemo(() => {
    return buildCalendarCells(calendarData?.days || [], month);
  }, [calendarData, month]);

  useEffect(() => {
    fetchCalendarMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingType, month]);

  async function fetchCalendarMonth() {
    try {
      setLoading(true);

      const res = await axios.get("/admin/calendar", {
        headers: getAuthHeaders(),
        params: {
          type: bookingType,
          month,
        },
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to load calendar."
        );
      }

      setCalendarData(res.data.data);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to load calendar."
      );
      setCalendarData(null);
    } finally {
      setLoading(false);
    }
  }

  function goToBookings(day, filter) {
    if (!day?.date || !bookingType) return;

    router.push(
      getBookingListUrl({
        bookingType,
        date: day.date,
        filter,
      })
    );
  }

  return (
    <div className="min-h-screen ">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Admin
          </p>

          <h1 className="mt-1 text-3xl font-bold text-gray-950">
            Booking Calendar
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            View In, Out, Total, Success, and POA bookings by date.
            Click any value to open the filtered booking list.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_220px_220px_auto] md:items-end">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Booking Type
              </label>

              <select
                value={bookingType}
                onChange={(event) => setBookingType(event.target.value)}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              >
                {bookingTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Month
              </label>

              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMonth((prev) => shiftMonth(prev, -1))}
                className="mt-7 flex-1 rounded-2xl border px-4 py-3 text-sm font-bold text-gray-700"
              >
                Prev
              </button>

              <button
                type="button"
                onClick={() => setMonth((prev) => shiftMonth(prev, 1))}
                className="mt-7 flex-1 rounded-2xl border px-4 py-3 text-sm font-bold text-gray-700"
              >
                Next
              </button>
            </div>

            <button
              type="button"
              onClick={fetchCalendarMonth}
              disabled={loading}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950">
                {formatText(bookingType)} Calendar
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {getMonthLabel(month)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">
                In
              </span>

              <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
                Out
              </span>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                Total
              </span>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                S
              </span>

              <span className="rounded-full bg-yellow-50 px-3 py-1 text-yellow-800">
                POA
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b bg-gray-50 text-center text-xs font-bold uppercase tracking-wide text-gray-500">
            {weekDays.map((day) => (
              <div key={day} className="px-2 py-3">
                {day}
              </div>
            ))}
          </div>

          {loading && (
            <div className="p-10 text-center text-gray-500">
              Loading calendar...
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-7">
              {calendarCells.map((day) => {
                if (day.blank) {
                  return (
                    <div
                      key={day.key}
                      className="min-h-[130px] border-b border-r bg-gray-50"
                    />
                  );
                }

                const dateNumber = Number(day.date.slice(-2));

                const todayIn = Number(day.today_in || 0);
                const todayOut = Number(day.today_out || 0);
                const total = Number(day.total_bookings || 0);
                const success = Number(day.success || 0);
                const poa = Number(day.pay_on_arrival || day.poa || 0);

                const hasAnyValue =
                  todayIn > 0 ||
                  todayOut > 0 ||
                  total > 0 ||
                  success > 0 ||
                  poa > 0;

                return (
                  <div
                    key={day.key}
                    className={`min-h-[130px] border-b border-r p-3 text-left ${
                      hasAnyValue ? "bg-white" : "bg-gray-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-900">
                        {dateNumber}
                      </span>
                    </div>

                    {hasAnyValue && (
                      <div className="mt-3 space-y-1">
                        <MetricButton
                          label="In"
                          value={todayIn}
                          className="bg-green-50 text-green-700 hover:bg-green-100"
                          onClick={() => goToBookings(day, "today_in")}
                        />

                        <MetricButton
                          label="Out"
                          value={todayOut}
                          className="bg-red-50 text-red-700 hover:bg-red-100"
                          onClick={() => goToBookings(day, "today_out")}
                        />

                        <MetricButton
                          label="Total"
                          value={total}
                          className="bg-blue-50 text-blue-700 hover:bg-blue-100"
                          onClick={() => goToBookings(day, "total")}
                        />

                        <div className="grid grid-cols-2 gap-1">
                          <MetricButton
                            label="Success"
                            shortLabel="S"
                            value={success}
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            onClick={() => goToBookings(day, "success")}
                          />

                          <MetricButton
                            label="POA"
                            shortLabel="POA"
                            value={poa}
                            className="bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                            onClick={() => goToBookings(day, "poa")}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}