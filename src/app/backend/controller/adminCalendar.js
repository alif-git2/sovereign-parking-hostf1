import Booking from "@/app/backend/models/booking";
import { requireAdminUser } from "@/app/backend/utils/authToken";

import "@/app/backend/models/location";
import "@/app/backend/models/cruiseschedule";
import "@/app/backend/models/storagetype";
import "@/app/backend/models/park_user";

const VALID_BOOKING_TYPES = ["cruise", "storage", "airport"];
const CALENDAR_STATUSES = ["success", "confirmed", "poa"];

function moneyNumber(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
}

function parseMonth(value) {
  const raw = String(value || "").trim();

  if (!/^\d{4}-\d{2}$/.test(raw)) {
    throw new Error("Invalid month");
  }

  const [year, month] = raw.split("-").map(Number);

  if (!year || !month || month < 1 || month > 12) {
    throw new Error("Invalid month");
  }

  return {
    value: raw,
    year,
    month,
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  };
}

function parseDateOnly(value) {
  const raw = String(value || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Invalid date");
  }

  const [year, month, day] = raw.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function startOfDay(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(value) {
  const date = startOfDay(value);

  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createMonthDays(monthInfo) {
  const days = [];
  const cursor = new Date(monthInfo.start);

  while (cursor < monthInfo.end) {
    const dateKey = toDateKey(cursor);

    days.push({
      date: dateKey,
      total_bookings: 0,
      today_in: 0,
      today_out: 0,
      success: 0,
      pay_on_arrival: 0,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function getLocationName(booking) {
  if (booking.location_id && typeof booking.location_id === "object") {
    return booking.location_id.name || "-";
  }

  return booking.details?.location_name || "-";
}

function getBookingTitle(booking) {
  if (booking.type === "cruise") {
    return (
      booking.details?.cruise?.ship_name ||
      booking.schedule_id?.ship_name ||
      booking.schedule_id?.schedule_name ||
      "Cruise Booking"
    );
  }

  if (booking.type === "storage") {
    return (
      booking.details?.storage?.storage_type_name ||
      booking.details?.storage?.storage_type ||
      "Storage Booking"
    );
  }

  return getLocationName(booking) || "Airport Booking";
}

function serializeBooking(booking) {
  const customer = booking.customer || {};
  const user = booking.user_id && typeof booking.user_id === "object"
    ? booking.user_id
    : null;

  return {
    _id: String(booking._id),
    booking_id: booking.booking_id,
    type: booking.type,
    title: getBookingTitle(booking),
    location_name: getLocationName(booking),

    client: {
      name: customer.name || user?.name || "-",
      email: customer.email || user?.email || "-",
      phone: customer.phone || user?.phone || "-",
    },

    start_date: booking.start_date,
    end_date: booking.end_date,

    status: booking.status,
    payment_status: booking.payment_status,
    payment_method: booking.payment_method,
    payment_flow: booking.payment_flow,

    price: moneyNumber(booking.price),
    paid_amount: moneyNumber(booking.paid_amount),
    due_amount: moneyNumber(booking.due_amount),
    balance_due_on_arrival: moneyNumber(booking.balance_due_on_arrival),
  };
}

async function getCalendarMonthSummary({ type, month }) {
  const monthInfo = parseMonth(month);
  const days = createMonthDays(monthInfo);
  const dayMap = new Map(days.map((day) => [day.date, day]));

  const bookings = await Booking.find({
    type,
    status: {
      $in: CALENDAR_STATUSES,
    },
    start_date: {
      $lt: monthInfo.end,
    },
    end_date: {
      $gte: monthInfo.start,
    },
  })
    .select(
      "booking_id type start_date end_date status payment_status payment_method paid_amount due_amount balance_due_on_arrival"
    )
    .lean();

  for (const booking of bookings) {
    const startDate = startOfDay(booking.start_date);
    const endDate = startOfDay(booking.end_date || booking.start_date);

    if (!startDate || !endDate) continue;

    const startKey = toDateKey(startDate);
    const endKey = toDateKey(endDate);

    const activeStart = startDate < monthInfo.start ? monthInfo.start : startDate;
    const activeEnd =
      endDate >= monthInfo.end ? addDays(monthInfo.end, -1) : endDate;

    const cursor = new Date(activeStart);

    while (cursor <= activeEnd) {
      const dateKey = toDateKey(cursor);
      const day = dayMap.get(dateKey);

      if (day) {
        day.total_bookings += 1;

        if (dateKey === startKey) {
          day.today_in += 1;
        }

        if (dateKey === endKey) {
          day.today_out += 1;
        }

        if (["success", "confirmed"].includes(booking.status)) {
          day.success += 1;
        }

        if (booking.status === "poa") {
          day.pay_on_arrival += 1;
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return {
    month: monthInfo.value,
    type,
    days,
  };
}

async function getCalendarDayDetails({ type, date }) {
  const dayStart = parseDateOnly(date);
  const dayEnd = addDays(dayStart, 1);

  const bookings = await Booking.find({
    type,
    status: {
      $in: CALENDAR_STATUSES,
    },
    start_date: {
      $lt: dayEnd,
    },
    end_date: {
      $gte: dayStart,
    },
  })
    .populate("user_id", "name email phone")
    .populate("location_id", "name type address")
    .populate("schedule_id", "ship_name schedule_name departure_date return_date")
    .populate("details.storage.storage_type_id", "name")
    .sort({
      status: 1,
      start_date: 1,
      createdAt: -1,
    })
    .lean();

  const serializedBookings = bookings.map(serializeBooking);

  return {
    date: toDateKey(dayStart),
    type,
    summary: {
      total_bookings: serializedBookings.length,
      success: serializedBookings.filter((booking) =>
        ["success", "confirmed"].includes(booking.status)
      ).length,
      pay_on_arrival: serializedBookings.filter(
        (booking) => booking.status === "poa"
      ).length,
      today_in: serializedBookings.filter(
        (booking) => toDateKey(booking.start_date) === toDateKey(dayStart)
      ).length,
      today_out: serializedBookings.filter(
        (booking) => toDateKey(booking.end_date) === toDateKey(dayStart)
      ).length,
    },
    bookings: serializedBookings,
  };
}

export async function getAdminCalendar(req) {
  try {
    await requireAdminUser(req);

    const { searchParams } = new URL(req.url);

    const type = String(searchParams.get("type") || "").trim();
    const month = String(searchParams.get("month") || "").trim();
    const date = String(searchParams.get("date") || "").trim();

    if (!VALID_BOOKING_TYPES.includes(type)) {
      throw new Error("Please select a valid booking type");
    }

    if (date) {
      const dayData = await getCalendarDayDetails({
        type,
        date,
      });

      return Response.json(
        {
          success: true,
          data: dayData,
        },
        { status: 200 }
      );
    }

    if (!month) {
      throw new Error("Month is required");
    }

    const monthData = await getCalendarMonthSummary({
      type,
      month,
    });

    return Response.json(
      {
        success: true,
        data: monthData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin calendar error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load admin calendar",
        error: error.message || "Failed to load admin calendar",
      },
      { status: 400 }
    );
  }
}