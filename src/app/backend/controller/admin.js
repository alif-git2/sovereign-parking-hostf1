import mongoose from "mongoose";
import Stripe from "stripe";
import Booking from "@/app/backend/models/booking";
import Payment from "@/app/backend/models/payment";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import Location from "@/app/backend/models/location";
import CruiseSchedule from "@/app/backend/models/cruiseschedule";
import Coupon from "@/app/backend/models/coupon";
import StorageType from "@/app/backend/models/storagetype";
import Setting from "@/app/backend/models/settings";
import { sendBookingEmails } from "@/app/backend/utils/sendBookingEmails";
import { sendAdminBookingActionEmails } from "@/app/backend/utils/adminBookingActionEmail";
import { incrementSettingShuttleSlotBookedCount } from "@/app/backend/controller/setting";
import {
  requireAdminUser,
  getAuthErrorStatus,
} from "@/app/backend/utils/authToken";

/**
 * Register models for Mongoose populate.
 * Keep these imports even if they look unused.
 */
import "@/app/backend/models/location";
import "@/app/backend/models/cruiseschedule";
import "@/app/backend/models/coupon";
import "@/app/backend/models/storagetype";
import "@/app/backend/models/payment";
import "@/app/backend/models/wallettransaction";
import "@/app/backend/models/park_user";

const GLOBAL_SETTING_ID = "global_config";
const DEFAULT_HOLDING_DEPOSIT_AMOUNT = 20;
const DEFAULT_ADMIN_ACTION_FEE = 10;
const ADD_ON_VEHICLE_DISCOUNT_PERCENT = 10;
const DASHBOARD_BOOKING_TYPES = ["cruise", "airport", "storage"];
const DASHBOARD_ACTIVE_BOOKING_STATUSES = [
  "pending",
  "pending_payment",
  "success",
  "confirmed",
  "poa",
];

async function getGlobalSettingsDocument() {
  const settings = await Setting.findByIdAndUpdate(
    GLOBAL_SETTING_ID,
    {
      $setOnInsert: {
        _id: GLOBAL_SETTING_ID,
        holding_deposit_amount: DEFAULT_HOLDING_DEPOSIT_AMOUNT,
        cancellation_fee: DEFAULT_ADMIN_ACTION_FEE,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  let shouldSave = false;

  if (
    settings.holding_deposit_amount === undefined ||
    settings.holding_deposit_amount === null
  ) {
    settings.holding_deposit_amount = DEFAULT_HOLDING_DEPOSIT_AMOUNT;
    shouldSave = true;
  }

  if (settings.cancellation_fee === undefined || settings.cancellation_fee === null) {
    settings.cancellation_fee = DEFAULT_ADMIN_ACTION_FEE;
    shouldSave = true;
  }

  if (shouldSave) {
    await settings.save();
  }

  return settings;
}

function getConfiguredHoldingDepositAmount(settings) {
  const amount = Number(settings?.holding_deposit_amount);

  if (!Number.isFinite(amount) || amount < 0) {
    return DEFAULT_HOLDING_DEPOSIT_AMOUNT;
  }

  return moneyNumber(amount);
}

function getConfiguredAdminActionFee(settings) {
  const amount = Number(settings?.cancellation_fee);

  if (!Number.isFinite(amount) || amount < 0) {
    return DEFAULT_ADMIN_ACTION_FEE;
  }

  return moneyNumber(amount);
}

function moneyNumber(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase().trim());
  }

  return Boolean(value);
}

function normalizePercent(value, fallback = 0) {
  const number = Number(value ?? fallback);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(Number(number.toFixed(2)), 100);
}

function getErrorStatus(message = "") {
  const authStatus = getAuthErrorStatus(message);

  if ([401, 403].includes(authStatus)) {
    return authStatus;
  }

  const value = String(message).toLowerCase();

  if (
    value.includes("required") ||
    value.includes("invalid") ||
    value.includes("missing")
  ) {
    return 400;
  }

  if (
    value.includes("only cancelled bookings can be deleted") ||
    value.includes("only cancelled, refunded, or credited bookings can be deleted")
  ) {
    return 400;
  }

  if (value.includes("already cancelled")) {
    return 400;
  }

  if (value.includes("already been processed")) {
    return 400;
  }

  if (value.includes("not found")) {
    return 404;
  }

  if (
    value.includes("fully booked") ||
    value.includes("capacity") ||
    value.includes("no storage slots available")
  ) {
    return 409;
  }

  return 500;
}

async function sumBookingField(match, field) {
  const result = await Booking.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: `$${field}`,
        },
      },
    },
  ]);

  return moneyNumber(result?.[0]?.total || 0);
}

async function sumPaymentField(match, field = "amount") {
  const result = await Payment.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: `$${field}`,
        },
      },
    },
  ]);

  return moneyNumber(result?.[0]?.total || 0);
}

async function countPaymentsByMethod() {
  const result = await Payment.aggregate([
    {
      $group: {
        _id: "$method",
        count: {
          $sum: 1,
        },
        amount: {
          $sum: "$amount",
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  return result.map((item) => ({
    method: item._id || "unknown",
    count: item.count || 0,
    amount: moneyNumber(item.amount),
  }));
}

async function countBookingsByStatus() {
  const result = await Booking.aggregate([
    {
      $group: {
        _id: "$status",
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  return result.map((item) => ({
    status: item._id || "unknown",
    count: item.count || 0,
  }));
}

async function countBookingsByPaymentStatus() {
  const result = await Booking.aggregate([
    {
      $group: {
        _id: "$payment_status",
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  return result.map((item) => ({
    payment_status: item._id || "unknown",
    count: item.count || 0,
  }));
}

async function countBookingsByType() {
  const result = await Booking.aggregate([
    {
      $group: {
        _id: "$type",
        count: {
          $sum: 1,
        },
        revenue: {
          $sum: "$paid_amount",
        },
        total_value: {
          $sum: "$price",
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  return result.map((item) => ({
    type: item._id || "unknown",
    count: item.count || 0,
    revenue: moneyNumber(item.revenue),
    total_value: moneyNumber(item.total_value),
  }));
}


function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start,
    end,
  };
}

async function countBookingsByLocation() {
  const result = await Booking.aggregate([
    {
      $group: {
        _id: "$location_id",
        count: {
          $sum: 1,
        },
        revenue: {
          $sum: "$paid_amount",
        },
        total_value: {
          $sum: "$price",
        },
      },
    },
    {
      $lookup: {
        from: Location.collection.name,
        localField: "_id",
        foreignField: "_id",
        as: "location",
      },
    },
    {
      $unwind: {
        path: "$location",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        location_id: "$_id",
        name: {
          $ifNull: ["$location.name", "Unknown Location"],
        },
        type: {
          $ifNull: ["$location.type", "unknown"],
        },
        count: 1,
        revenue: 1,
        total_value: 1,
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  return result.map((item) => ({
    location_id: item.location_id,
    name: item.name,
    type: item.type,
    count: item.count || 0,
    revenue: moneyNumber(item.revenue),
    total_value: moneyNumber(item.total_value),
  }));
}

async function countBookingsBySource() {
  const result = await Booking.aggregate([
    {
      $group: {
        _id: "$source",
        count: {
          $sum: 1,
        },
        revenue: {
          $sum: "$paid_amount",
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  return result.map((item) => ({
    source: item._id || "unknown",
    count: item.count || 0,
    revenue: moneyNumber(item.revenue),
  }));
}

async function getTodayMovementSummary() {
  const { start, end } = getTodayRange();

  const [bookingsCreatedToday, paymentsReceivedToday, movementByTypeResult] =
    await Promise.all([
    Booking.countDocuments({
      createdAt: {
        $gte: start,
        $lt: end,
      },
    }),

    sumPaymentField({
      status: "paid",
      createdAt: {
        $gte: start,
        $lt: end,
      },
    }),

    Booking.aggregate([
      {
        $match: {
          type: { $in: DASHBOARD_BOOKING_TYPES },
          status: { $in: DASHBOARD_ACTIVE_BOOKING_STATUSES },
          start_date: { $lt: end },
          end_date: { $gte: start },
        },
      },
      {
        $group: {
          _id: "$type",
          in_today: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$start_date", start] },
                    { $lt: ["$start_date", end] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          out_today: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$end_date", start] },
                    { $lt: ["$end_date", end] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          onsite_cars: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$start_date", end] },
                    { $gte: ["$end_date", start] },
                  ],
                },
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$type", "cruise"] },
                        { $eq: ["$add_on_vehicle_enabled", true] },
                      ],
                    },
                    2,
                    1,
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const movementByTypeMap = new Map(
    movementByTypeResult.map((item) => [String(item._id || ""), item])
  );

  const movementByType = DASHBOARD_BOOKING_TYPES.map((type) => {
    const item = movementByTypeMap.get(type) || {};

    return {
      type,
      in_today: Number(item.in_today || 0),
      out_today: Number(item.out_today || 0),
      onsite_cars: Number(item.onsite_cars || 0),
    };
  });

  const totalInToday = movementByType.reduce(
    (total, item) => total + item.in_today,
    0
  );
  const totalOutToday = movementByType.reduce(
    (total, item) => total + item.out_today,
    0
  );

  return {
    date: start,
    total_in_today: totalInToday,
    total_out_today: totalOutToday,
    bookings_created_today: bookingsCreatedToday,
    payments_received_today: moneyNumber(paymentsReceivedToday),
    in_by_type: movementByType.map((item) => ({
      type: item.type,
      count: item.in_today,
    })),
    out_by_type: movementByType.map((item) => ({
      type: item.type,
      count: item.out_today,
    })),
    movement_by_type: movementByType,
  };
}

function getTopPaymentMethodByAmount(paymentMethodSummary = []) {
  return [...paymentMethodSummary].sort(
    (a, b) => Number(b.amount || 0) - Number(a.amount || 0)
  )[0] || null;
}


async function getWalletSummary() {
  const balanceResult = await ParkingUser.aggregate([
    {
      $match: {
        role: "customer",
      },
    },
    {
      $group: {
        _id: null,
        total_balance: {
          $sum: "$wallet_balance",
        },
        customers: {
          $sum: 1,
        },
      },
    },
  ]);

  const statusResult = await ParkingUser.aggregate([
    {
      $match: {
        role: "customer",
      },
    },
    {
      $group: {
        _id: "$wallet_status",
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  const topupTotal = await sumPaymentField({
    method: {
      $in: ["stripe", "paypal"],
    },
    payment_purpose: "wallet_topup",
    status: "paid",
  });

  const walletBookingPayments = await sumPaymentField({
    method: "wallet",
    status: "paid",
  });

  return {
    total_balance: moneyNumber(balanceResult?.[0]?.total_balance || 0),
    customer_wallets: balanceResult?.[0]?.customers || 0,
    total_topups: topupTotal,
    total_booking_payments_by_wallet: walletBookingPayments,
    status_counts: statusResult.map((item) => ({
      status: item._id || "unknown",
      count: item.count || 0,
    })),
  };
}

async function getRecentBookings() {
  return Booking.find({})
    .populate("user_id", "name email phone role wallet_balance wallet_status")
    .populate("location_id", "name type")
    .populate("schedule_id", "schedule_name departure_date return_date")
    .populate("coupon_id", "code coupon_code discount_type discount_value")
    .populate("details.storage.storage_type_id", "name")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
}

async function getRecentPayments() {
  return Payment.find({})
    .populate(
      "booking_id",
      "booking_id type customer price status payment_status payment_method payment_flow"
    )
    .populate("user_id", "name email phone role")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
}

async function getRecentWalletTransactions() {
  return WalletTransaction.find({})
    .populate("user_id", "name email phone wallet_balance wallet_status")
    .populate("booking_id", "booking_id type status payment_status")
    .populate(
      "payment_id",
      "method status amount provider_order_id provider_capture_id"
    )
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
}

export async function getAdminDashboard(req) {
  try {
    const adminUser = await requireAdminUser(req);

    const [
      totalBookings,
      pendingPaymentBookings,
      confirmedBookings,
      poaBookings,
      cancelledBookings,

      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      adminUsers,
      managerUsers,

      totalLocations,
      activeLocations,
      airportLocations,
      storageLocations,

      totalCruiseSchedules,
      activeCruiseSchedules,

      totalCoupons,
      activeCoupons,

      totalStorageTypes,
      activeStorageTypes,

      bookingTotalValue,
      paidAmountTotal,
      dueAmountTotal,
      poaBalanceDueTotal,

      totalPayments,
      paidPayments,
      pendingPayments,
      failedPayments,

      totalPaymentRevenue,
      stripeRevenue,
      paypalRevenue,
      walletRevenue,

      walletSummary,
      paymentMethodSummary,
      bookingStatusSummary,
      bookingPaymentStatusSummary,
    bookingTypeSummary,
      locationBookingSummary,
      sourceSummary,
      todayMovementSummary,

      recentBookings,
      recentPayments,
      recentWalletTransactions,
    ] = await Promise.all([
      Booking.countDocuments({}),
      Booking.countDocuments({ status: "pending_payment" }),
      Booking.countDocuments({ status: { $in: ["success", "confirmed"] } }),
      Booking.countDocuments({ status: "poa" }),
      Booking.countDocuments({ status: "cancelled" }),

      ParkingUser.countDocuments({ role: "customer" }),
      ParkingUser.countDocuments({ role: "customer", is_active: true }),
      ParkingUser.countDocuments({ role: "customer", is_active: false }),
      ParkingUser.countDocuments({ role: "admin" }),
      ParkingUser.countDocuments({ role: "manager" }),

      Location.countDocuments({}),
      Location.countDocuments({ is_active: true }),
      Location.countDocuments({ type: "airport" }),
      Location.countDocuments({ type: "storage" }),

      CruiseSchedule.countDocuments({}),
      CruiseSchedule.countDocuments({ is_active: true }),

      Coupon.countDocuments({}),
      Coupon.countDocuments({ is_active: true }),

      StorageType.countDocuments({}),
      StorageType.countDocuments({ is_active: true }),

      sumBookingField({}, "price"),
      sumBookingField({}, "paid_amount"),
      sumBookingField({}, "due_amount"),
      sumBookingField({ status: "poa" }, "balance_due_on_arrival"),

      Payment.countDocuments({}),
      Payment.countDocuments({ status: "paid" }),
      Payment.countDocuments({ status: "pending" }),
      Payment.countDocuments({ status: "failed" }),

      sumPaymentField({ status: "paid" }),
      sumPaymentField({ method: "stripe", status: "paid" }),
      sumPaymentField({ method: "paypal", status: "paid" }),
      sumPaymentField({ method: "wallet", status: "paid" }),

      getWalletSummary(),
      countPaymentsByMethod(),
      countBookingsByStatus(),
      countBookingsByPaymentStatus(),
  countBookingsByType(),
countBookingsByLocation(),
countBookingsBySource(),
getTodayMovementSummary(),

      getRecentBookings(),
      getRecentPayments(),
      getRecentWalletTransactions(),
    ]);

    return Response.json(
      {
        success: true,
        message: "Admin dashboard loaded successfully",
        data: {
          admin: {
            _id: adminUser._id,
            name: adminUser.name,
            email: adminUser.email,
            phone: adminUser.phone,
            role: adminUser.role,
          },

          overview: {
            bookings: {
              total: totalBookings,
              pending_payment: pendingPaymentBookings,
              confirmed: confirmedBookings,
              pay_on_arrival: poaBookings,
              cancelled: cancelledBookings,
              total_value: bookingTotalValue,
              paid_amount: paidAmountTotal,
              due_amount: dueAmountTotal,
              poa_balance_due_on_arrival: poaBalanceDueTotal,
            },

            payments: {
              total: totalPayments,
              paid: paidPayments,
              pending: pendingPayments,
              failed: failedPayments,
              total_revenue: totalPaymentRevenue,
              stripe_revenue: stripeRevenue,
              paypal_revenue: paypalRevenue,
              wallet_revenue: walletRevenue,
            },

            customers: {
              total: totalCustomers,
              active: activeCustomers,
              inactive: inactiveCustomers,
            },

            users: {
              admins: adminUsers,
              managers: managerUsers,
              customers: totalCustomers,
            },

            locations: {
              total: totalLocations,
              active: activeLocations,
              airport: airportLocations,
              storage: storageLocations,
            },

            cruise_schedules: {
              total: totalCruiseSchedules,
              active: activeCruiseSchedules,
            },

            coupons: {
              total: totalCoupons,
              active: activeCoupons,
            },

            storage_types: {
              total: totalStorageTypes,
              active: activeStorageTypes,
            },

            wallet: walletSummary,
            today: todayMovementSummary
          },

charts: {
  payments_by_method: paymentMethodSummary,
  top_payment_method_by_count: paymentMethodSummary?.[0] || null,
  top_payment_method_by_amount:
    getTopPaymentMethodByAmount(paymentMethodSummary),
  bookings_by_status: bookingStatusSummary,
  bookings_by_payment_status: bookingPaymentStatusSummary,
  bookings_by_type: bookingTypeSummary,
  bookings_by_location: locationBookingSummary,
  bookings_by_source: sourceSummary,
},

          recent: {
            bookings: recentBookings,
            payments: recentPayments,
            wallet_transactions: recentWalletTransactions,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin dashboard error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load admin dashboard",
        error: error.message || "Failed to load admin dashboard",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Admin bookings list
 * Supports:
 * GET /backend/router/admin/bookings?type=cruise
 * GET /backend/router/admin/bookings?type=storage
 * GET /backend/router/admin/bookings?type=airport
 */
function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPositiveInteger(value, fallback, max = 100) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 1) {
    return fallback;
  }

  return Math.min(Math.floor(number), max);
}

function getBookingSort(sortBy, sortOrder) {
  const allowedSortFields = {
    createdAt: "createdAt",
    start_date: "start_date",
    end_date: "end_date",
    price: "price",
    paid_amount: "paid_amount",
    due_amount: "due_amount",
    booking_id: "booking_id",
  };

  const field = allowedSortFields[sortBy] || "createdAt";
  const direction = sortOrder === "asc" ? 1 : -1;

  return {
    [field]: direction,
  };
}

function addAndCondition(match, condition) {
  if (!condition) return;

  if (!match.$and) {
    match.$and = [];
  }

  match.$and.push(condition);
}

function getDateStart(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);

  return date;
}

function getDateEnd(value) {
  const start = getDateStart(value);

  if (!start) return null;

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return end;
}


function getLocalDayRange(dateString) {
  if (!dateString) {
    return null;
  }

  const parts = String(dateString).split("-");

  if (parts.length !== 3) {
    return null;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!year || !month || !day) {
    return null;
  }

  return {
    start: new Date(year, month - 1, day, 0, 0, 0, 0),

    end: new Date(year, month - 1, day + 1, 0, 0, 0, 0),
  };
}






function getMonthRange(value) {
  if (!value) return null;

  const [year, month] = String(value).split("-").map(Number);

  if (!year || !month) return null;

  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  };
}

function addDateRange(match, field, range) {
  if (!range) return;

  match[field] = {
    ...(match[field] || {}),
    ...range,
  };
}

function buildAdminBookingBaseMatch(searchParams) {
  const type = searchParams.get("type");
  const match = {};

  if (type) {
    if (!["cruise", "storage", "airport"].includes(type)) {
      throw new Error("Invalid booking type");
    }

    match.type = type;
  }

  return match;
}

function buildAdminBookingMatch(searchParams) {
  const match = buildAdminBookingBaseMatch(searchParams);

  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("payment_status");
  const paymentMethod = searchParams.get("payment_method");
  const paymentFlow = searchParams.get("payment_flow");
  const search = String(searchParams.get("search") || "").trim();

  const cruise = String(searchParams.get("cruise") || "").trim();
  const shuttleSlot = String(searchParams.get("shuttle_slot") || "").trim();
  const shipDepartureFrom = searchParams.get("ship_departure_from");
  const shipArrival = searchParams.get("ship_arrival");

  const bookedMonth = searchParams.get("booked_month");
  const dateBookedFrom = searchParams.get("date_booked_from");
  const dateBookedTo = searchParams.get("date_booked_to");


  const calendarDate = searchParams.get("calendar_date");
const calendarFilter = searchParams.get("calendar_filter");





  if (status) {
    if (status === "success") {
      match.status = {
        $in: ["success", "confirmed"],
      };
    } else if (status === "refund" || status === "refunded") {
      addAndCondition(match, {
        $or: [
          { admin_action_type: "refund" },
          { status: { $in: ["refund", "refunded"] } },
        ],
      });
    } else if (status === "credit" || status === "credited") {
      addAndCondition(match, {
        $or: [
          { admin_action_type: "credit" },
          { status: { $in: ["credit", "credited"] } },
        ],
      });
    } else if (status === "cancelled") {
      match.status = "cancelled";
      addAndCondition(match, {
        $or: [
          { admin_action_type: { $exists: false } },
          { admin_action_type: null },
          { admin_action_type: "cancel" },
        ],
      });
    } else {
      match.status = status;
    }
  }

  if (paymentStatus) {
    match.payment_status = paymentStatus;
  }

  if (paymentMethod) {
    match.payment_method = paymentMethod;
  }

  if (paymentFlow) {
    match.payment_flow = paymentFlow;
  }

  if (cruise) {
    if (mongoose.Types.ObjectId.isValid(cruise)) {
      match.schedule_id = cruise;
    } else {
      const regex = new RegExp(escapeRegex(cruise), "i");

      addAndCondition(match, {
        $or: [{ "details.cruise.ship_name": regex }, { ship_name: regex }],
      });
    }
  }

  if (shuttleSlot) {
    const regex = new RegExp(escapeRegex(shuttleSlot), "i");

    addAndCondition(match, {
      $or: [
        { shuttle_time: regex },
        { "details.cruise.shuttle_time": regex },
        { "details.cruise.parking_slot": regex },
        { "details.airport.shuttle_time": regex },
        { "details.airport.parking_slot": regex },
      ],
    });
  }

  if (shipDepartureFrom) {
    const start = getDateStart(shipDepartureFrom);

    if (start) {
      addDateRange(match, "start_date", {
        $gte: start,
      });
    }
  }

  if (shipArrival) {
    const start = getDateStart(shipArrival);
    const end = getDateEnd(shipArrival);

    if (start && end) {
      addDateRange(match, "end_date", {
        $gte: start,
        $lt: end,
      });
    }
  }

  if (bookedMonth) {
    const range = getMonthRange(bookedMonth);

    if (range) {
      addDateRange(match, "createdAt", {
        $gte: range.start,
        $lt: range.end,
      });
    }
  }

  if (dateBookedFrom) {
    const start = getDateStart(dateBookedFrom);

    if (start) {
      addDateRange(match, "createdAt", {
        $gte: start,
      });
    }
  }

  if (dateBookedTo) {
    const end = getDateEnd(dateBookedTo);

    if (end) {
      addDateRange(match, "createdAt", {
        $lt: end,
      });
    }
  }



if (calendarDate && calendarFilter) {

  const range = getLocalDayRange(calendarDate);

  if (range) {

    const {start,end} = range;


    switch(calendarFilter){


      case "today_in":

        addAndCondition(match,{
          start_date:{
            $gte:start,
            $lt:end
          }
        });

        break;



      case "today_out":

        addAndCondition(match,{
          end_date:{
            $gte:start,
            $lt:end
          }
        });

        break;



      case "total":

        addAndCondition(match,{
          start_date:{
            $lte:end
          },
          end_date:{
            $gte:start
          }
        });

        break;



case "success":

  addAndCondition(match, {
    status: {
      $in: [
        "success",
        "confirmed"
      ]
    },
    start_date: {
      $lte: end
    },
    end_date: {
      $gte: start
    }
  });

  break;


case "poa":

  addAndCondition(match, {
    status: "poa",
    start_date: {
      $lte: end
    },
    end_date: {
      $gte: start
    }
  });

  break;

    }

  }
}




  if (search) {
    const safeSearch = escapeRegex(search);
    const regex = new RegExp(safeSearch, "i");

    addAndCondition(match, {
      $or: [
        { booking_id: regex },
        { "customer.name": regex },
        { "customer.email": regex },
        { "customer.phone": regex },
        { license_plate: regex },
        { reference: regex },
        { coupon_code: regex },
        { stripe_payment_intent_id: regex },
        { paypal_order_id: regex },
        { paypal_capture_id: regex },
        { "details.cruise.ship_name": regex },
        { "details.cruise.shuttle_time": regex },
        { "details.storage.storage_type_name": regex },
        { "details.storage.storage_type": regex },
        { "details.airport.shuttle_time": regex },
      ],
    });
  }

  return match;
}

async function getBookingListSummary(match) {
  const result = await Booking.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: null,
        total_bookings: {
          $sum: 1,
        },
        total_value: {
          $sum: "$price",
        },
        paid_amount: {
          $sum: "$paid_amount",
        },
        due_amount: {
          $sum: "$due_amount",
        },
        wallet_used: {
          $sum: "$wallet_used",
        },
        holding_deposit_amount: {
          $sum: "$holding_deposit_amount",
        },
        balance_due_on_arrival: {
          $sum: "$balance_due_on_arrival",
        },
      },
    },
  ]);

  const summary = result?.[0] || {};

  return {
    total_bookings: summary.total_bookings || 0,
    total_value: moneyNumber(summary.total_value),
    paid_amount: moneyNumber(summary.paid_amount),
    due_amount: moneyNumber(summary.due_amount),
    wallet_used: moneyNumber(summary.wallet_used),
    holding_deposit_amount: moneyNumber(summary.holding_deposit_amount),
    balance_due_on_arrival: moneyNumber(summary.balance_due_on_arrival),
  };
}

async function getBookingStatusBreakdown(match) {
  const [success, pendingPayment, payOnArrival, cancelled, credit, refund] =
    await Promise.all([
      Booking.countDocuments({
        ...match,
        status: {
          $in: ["success", "confirmed"],
        },
      }),

      Booking.countDocuments({
        ...match,
        status: "pending_payment",
      }),

      Booking.countDocuments({
        ...match,
        status: "poa",
      }),

      Booking.countDocuments({
        ...match,
        status: "cancelled",
        $or: [
          { admin_action_type: { $exists: false } },
          { admin_action_type: null },
          { admin_action_type: "cancel" },
        ],
      }),

      Booking.countDocuments({
        ...match,
        $or: [
          { admin_action_type: "credit" },
          { status: { $in: ["credit", "credited"] } },
        ],
      }),

      Booking.countDocuments({
        ...match,
        $or: [
          { admin_action_type: "refund" },
          { status: { $in: ["refund", "refunded"] } },
        ],
      }),
    ]);

  return [
    { status: "success", label: "Success", count: success },
    {
      status: "pending_payment",
      label: "Pending Payment",
      count: pendingPayment,
    },
    { status: "poa", label: "Pay on Arrival", count: payOnArrival },
    { status: "cancelled", label: "Cancelled", count: cancelled },
    { status: "credit", label: "Credited", count: credit },
    { status: "refund", label: "Refund", count: refund },
  ].filter((item) => item.count > 0);
}

async function getBookingPaymentStatusBreakdown(match) {
  const result = await Booking.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: "$payment_status",
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  return result.map((item) => ({
    payment_status: item._id || "unknown",
    count: item.count || 0,
  }));
}

export async function getAdminBookings(req) {
  try {
    await requireAdminUser(req);

    const { searchParams } = new URL(req.url);


//     console.log(
//   "CALENDAR PARAMS:",
//   {
//     calendarDate: searchParams.get("calendar_date"),
//     calendarFilter: searchParams.get("calendar_filter"),
//     status: searchParams.get("status"),
//     type: searchParams.get("type"),
//   }
// );

    const page = getPositiveInteger(searchParams.get("page"), 1, 100000);
    const limit = getPositiveInteger(searchParams.get("limit"), 20, 100);
    const sortBy = searchParams.get("sort_by") || "createdAt";
    const sortOrder = searchParams.get("sort_order") || "desc";

    const skip = (page - 1) * limit;

    // Base match is only the booking type, so top summary cards and status chips
    // stay independent from the table filters.
    const baseMatch = buildAdminBookingBaseMatch(searchParams);

    // Filtered match controls only table records and pagination.
   const match = buildAdminBookingMatch(searchParams);

const debugBookings = await Booking.find(match)
  .select("booking_id status start_date end_date")
  .lean();

// console.log("DEBUG FILTER COUNT:", debugBookings.length);

// console.log(
//   "DEBUG STATUSES:",
//   debugBookings.map((b) => b.status)
// );


// console.log(
//   "FINAL MATCH AFTER BUILD:",
//   JSON.stringify(match, null, 2)
// );

const sort = getBookingSort(sortBy, sortOrder);


// // DEBUG START
// console.log(
//   "FINAL MATCH:",
//   JSON.stringify(match, null, 2)
// );

// const testCount = await Booking.countDocuments(match);

// console.log("MATCH COUNT:", testCount);
// // DEBUG END


const [
  bookings,
  total,
  overallSummary,
  filteredSummary,
  statusBreakdown,
  paymentStatusBreakdown,
] = await Promise.all([
  Booking.find(match)
    .populate("user_id", "name email phone role wallet_balance wallet_status")
    .populate("location_id", "name type address price_per_day")
    .populate(
      "schedule_id",
      "ship_name schedule_name departure_date return_date price_per_slot shuttle_slots"
    )
    .populate("coupon_id", "code coupon_code discount_type discount_value")
    .populate("details.storage.storage_type_id", "name description")
    .populate("wallet_transaction_id")
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean(),

  Booking.countDocuments(match),

  getBookingListSummary(baseMatch),

  getBookingListSummary(match),

  getBookingStatusBreakdown(baseMatch),

  getBookingPaymentStatusBreakdown(match),
]);


    return Response.json(
      {
        success: true,
        message: "Admin bookings loaded successfully",
        data: {
          bookings,
          pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit) || 1,
            has_next_page: page * limit < total,
            has_prev_page: page > 1,
          },
          filters: {
            type: searchParams.get("type") || null,
            status: searchParams.get("status") || null,
            payment_status: searchParams.get("payment_status") || null,
            payment_method: searchParams.get("payment_method") || null,
            payment_flow: searchParams.get("payment_flow") || null,
            search: searchParams.get("search") || null,
            cruise: searchParams.get("cruise") || null,
            shuttle_slot: searchParams.get("shuttle_slot") || null,
            ship_departure_from:
              searchParams.get("ship_departure_from") || null,
            ship_arrival: searchParams.get("ship_arrival") || null,
            booked_month: searchParams.get("booked_month") || null,
            date_booked_from: searchParams.get("date_booked_from") || null,
            date_booked_to: searchParams.get("date_booked_to") || null,


            calendar_date:
  searchParams.get("calendar_date") || null,

calendar_filter:
  searchParams.get("calendar_filter") || null,
          },

          // Used by top cards. This is intentionally not affected by filters.
          summary: overallSummary,

          // Optional: available if you later want to show filtered totals.
          filtered_summary: filteredSummary,

          breakdown: {
            by_status: statusBreakdown,
            by_payment_status: paymentStatusBreakdown,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin bookings error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load admin bookings",
        error: error.message || "Failed to load admin bookings",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Admin booking detail / edit / delete
 * Supports:
 * GET    /backend/router/admin/bookings/[bookingId]
 * PATCH  /backend/router/admin/bookings/[bookingId]
 * DELETE /backend/router/admin/bookings/[bookingId]
 */
function buildBookingIdentifierFilter(bookingId) {
  if (!bookingId) {
    throw new Error("Booking ID is required");
  }

  const value = String(bookingId).trim();

  const conditions = [{ booking_id: value }];

  if (mongoose.Types.ObjectId.isValid(value)) {
    conditions.push({ _id: value });
  }

  return {
    $or: conditions,
  };
}

function getAdminBookingPopulateQuery(query) {
  return query
    .populate("user_id", "name email phone role wallet_balance wallet_status")
    .populate("location_id", "name type address price_per_day shuttle_slots")
    .populate(
      "schedule_id",
      "ship_name schedule_name departure_date return_date price_per_slot shuttle_slots"
    )
    .populate("coupon_id", "code coupon_code discount_type discount_value")
    .populate("details.storage.storage_type_id", "name description")
    .populate("wallet_transaction_id");
}

async function findAdminBookingByIdentifier(bookingId) {
  const booking = await getAdminBookingPopulateQuery(
    Booking.findOne(buildBookingIdentifierFilter(bookingId))
  );

  if (!booking) {
    throw new Error("Booking not found");
  }

  return booking;
}

function normalizeBookingForEmail(booking) {
  if (!booking) return booking;

  const plainBooking =
    typeof booking.toObject === "function" ? booking.toObject() : booking;

  const populatedUser =
    plainBooking.user_id && typeof plainBooking.user_id === "object"
      ? plainBooking.user_id
      : null;

  return {
    ...plainBooking,
    customer: {
      ...(plainBooking.customer || {}),
      name:
        plainBooking.customer?.name ||
        populatedUser?.name ||
        plainBooking.customer_name ||
        "-",
      email:
        plainBooking.customer?.email ||
        populatedUser?.email ||
        plainBooking.customer_email ||
        plainBooking.email ||
        "",
      phone:
        plainBooking.customer?.phone ||
        populatedUser?.phone ||
        plainBooking.customer_phone ||
        plainBooking.phone ||
        "-",
    },
  };
}

function getEmailErrorPayload(error) {
  return {
    message: error?.message || "Email sending failed",
    code: error?.code,
    command: error?.command,
    response: error?.response,
  };
}

async function sendBookingConfirmationEmailSafely({
  booking,
  resend = true,
  sendCustomerEmail = true,
  sendAdminEmail = true,
}) {
  try {
    const bookingForEmail = normalizeBookingForEmail(booking);

    if (sendCustomerEmail !== false && !bookingForEmail?.customer?.email) {
      throw new Error("Customer email not found for this booking");
    }

    const emailResult = await sendBookingEmails({
      booking: bookingForEmail,
      resend,
      sendCustomerEmail,
      sendAdminEmail,
    });

    console.log("Booking confirmation email result:", emailResult);

    return emailResult;
  } catch (error) {
    const emailError = getEmailErrorPayload(error);

    console.error("Booking confirmation email failed:", emailError);

    return {
      success: false,
      sentCustomerEmail: false,
      sentAdminEmail: false,
      error: emailError,
    };
  }
}

async function sendAdminActionEmailSafely({
  booking,
  actionType,
  paidAmount = 0,
  feeAmount = 0,
  returnAmount = 0,
  returnMethod = "-",
  adminUser = null,
}) {
  try {
    const bookingForEmail = normalizeBookingForEmail(booking);

    const emailResult = await sendAdminBookingActionEmails({
      booking: bookingForEmail,
      actionType,
      paidAmount,
      feeAmount,
      returnAmount,
      returnMethod,
      adminUser,
      sendCustomerEmail: true,
      sendAdminEmail: true,
    });

    console.log("Admin booking action email result:", {
      booking_id: bookingForEmail?.booking_id,
      actionType,
      emailResult,
    });

    return emailResult;
  } catch (error) {
    const emailError = getEmailErrorPayload(error);

    console.error("Admin booking action email failed:", {
      booking_id: booking?.booking_id,
      actionType,
      error: emailError,
    });

    return {
      success: false,
      sentCustomerEmail: false,
      sentAdminEmail: false,
      error: emailError,
    };
  }
}



function setNestedIfPossible(document, path, value) {
  if (value === undefined) return;

  try {
    document.set(path, value);
  } catch {
    // Ignore if the schema does not support the nested field.
  }
}

function parseAdminBookingDate(value, label) {
  if (value === undefined) return undefined;

  if (!value) {
    throw new Error(`${label} is required`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}`);
  }

  return date;
}

function validateBookingDateRange(startDate, endDate, type) {
  if (!startDate || !endDate) return;

  if (type === "cruise") {
    if (endDate <= startDate) {
      throw new Error("Ship arrival date must be after ship departure date");
    }

    return;
  }

  // Storage and Airport use inclusive calendar-day booking.
  // Same-day entry/exit is valid; only reject an exit before entry.
  if (endDate < startDate) {
    throw new Error("Exit date cannot be before entry date");
  }
}

function getLocationObjectId(value) {
  if (value === undefined) return undefined;

  const locationId =
    typeof value === "object" && value?._id ? String(value._id) : String(value);

  if (!locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
    throw new Error("Invalid location");
  }

  return locationId;
}

async function validateAndGetLocation(locationId, expectedType) {
  if (locationId === undefined) return null;

  const location = await Location.findById(locationId);

  if (!location) {
    throw new Error("Selected location was not found");
  }

  if (expectedType && location.type !== expectedType) {
    throw new Error(`Selected location is not a ${expectedType} location`);
  }

  return location;
}

async function findStorageTypeForAdminEdit({ storageTypeName, storageTypeId }) {
  if (storageTypeId && mongoose.Types.ObjectId.isValid(storageTypeId)) {
    const storageType = await StorageType.findById(storageTypeId);

    if (!storageType) {
      throw new Error("Selected storage type was not found");
    }

    return storageType;
  }

  if (!storageTypeName) {
    return null;
  }

  return StorageType.findOne({
    name: storageTypeName,
  }).collation({
    locale: "en",
    strength: 2,
  });
}

async function updateLinkedCustomerUser(booking, { email, phone }) {
  if (!booking?.user_id) return;

  const userId =
    typeof booking.user_id === "object" ? booking.user_id._id : booking.user_id;

  if (!userId) return;

  const user = await ParkingUser.findById(userId);

  if (!user) return;

  let changed = false;

  if (email && user.email !== email) {
    user.email = email;
    changed = true;
  }

  if (phone && user.phone !== phone) {
    user.phone = phone;
    changed = true;
  }

  if (changed) {
    await user.save();
  }
}

async function applyAdminBookingEdits(booking, body) {
  const email =
    body.email !== undefined
      ? String(body.email || "").toLowerCase().trim()
      : undefined;

  const phone =
    body.phone !== undefined ? String(body.phone || "").trim() : undefined;

  const licensePlate =
    body.license_plate !== undefined
      ? String(body.license_plate || "").trim()
      : undefined;

  const reference =
    body.reference !== undefined
      ? String(body.reference || "").trim()
      : undefined;

  const shuttleTime =
    body.shuttle_time !== undefined
      ? String(body.shuttle_time || "").trim()
      : undefined;

  const parkingSlot =
    body.parking_slot !== undefined
      ? String(body.parking_slot || "").trim()
      : undefined;

  const notes =
    body.notes !== undefined ? String(body.notes || "").trim() : undefined;

  const newAdminNote =
    body.new_admin_note !== undefined
      ? String(body.new_admin_note || "").trim()
      : undefined;

  const shipName =
    body.ship_name !== undefined
      ? String(body.ship_name || "").trim()
      : undefined;

  const bodyCruise = body.details?.cruise || {};
  const bodyPricing = body.details?.pricing || {};
  const bodyAddOnVehicle = bodyCruise.add_on_vehicle || {};

  const shouldUpdateCruiseAddOnVehicle = Boolean(
    body.add_on_vehicle_enabled !== undefined ||
      body.add_on_vehicle_type !== undefined ||
      body.add_on_vehicle_license_plate !== undefined ||
      bodyAddOnVehicle.enabled !== undefined ||
      bodyAddOnVehicle.type !== undefined ||
      bodyAddOnVehicle.license_plate !== undefined
  );

  const storageTypeName =
    body.storage_type !== undefined
      ? String(body.storage_type || "").trim()
      : undefined;

  const storageTypeId =
    body.storage_type_id !== undefined
      ? String(body.storage_type_id || "").trim()
      : undefined;

  const locationId = getLocationObjectId(body.location_id);

  const startDate = parseAdminBookingDate(
    body.start_date,
    booking.type === "cruise" ? "Ship departure date" : "Entry date"
  );

  const endDate = parseAdminBookingDate(
    body.end_date,
    booking.type === "cruise" ? "Ship arrival date" : "Exit date"
  );

  const pax =
    body.pax !== undefined && body.pax !== "" ? Number(body.pax) : undefined;

  const pickupPax =
    body.pickup_pax !== undefined && body.pickup_pax !== ""
      ? Number(body.pickup_pax)
      : undefined;

  const pickupPaxPro =
    body.pickup_pax_pro !== undefined && body.pickup_pax_pro !== ""
      ? Number(body.pickup_pax_pro)
      : undefined;

  if (email !== undefined) {
    if (!email) {
      throw new Error("Email is required");
    }

    booking.set("customer.email", email);
  }

  if (phone !== undefined) {
    if (!phone) {
      throw new Error("Phone is required");
    }

    booking.set("customer.phone", phone);
  }

  if (startDate !== undefined) {
    booking.start_date = startDate;
  }

  if (endDate !== undefined) {
    booking.end_date = endDate;
  }

  validateBookingDateRange(booking.start_date, booking.end_date, booking.type);

  if (locationId !== undefined) {
    const location = await validateAndGetLocation(locationId, booking.type);

    booking.location_id = location._id;
    setNestedIfPossible(booking, "details.location_name", location.name);
  }

  if (licensePlate !== undefined) {
    booking.license_plate = licensePlate;

    if (booking.type === "storage") {
      booking.reference = licensePlate;
    }
  }

  if (reference !== undefined && booking.type === "storage") {
    booking.reference = reference;
    booking.license_plate = reference;
  }

  // Keep old/general notes separate.
  // Frontend should not send this for the new admin note field.
  if (notes !== undefined) {
    booking.notes = notes;
  }

  // New admin note is saved as its own schema field.
  // Do not append this into booking.notes.
  if (newAdminNote !== undefined) {
    booking.new_admin_note = newAdminNote;
  }

  if (pax !== undefined) {
    if (!Number.isFinite(pax) || pax < 0) {
      throw new Error("Invalid passengers value");
    }

    booking.pax = pax;
  }

  if (pickupPax !== undefined) {
    if (!Number.isFinite(pickupPax) || pickupPax < 0) {
      throw new Error("Invalid pickup passengers value");
    }
  }

  if (pickupPaxPro !== undefined) {
    if (!Number.isFinite(pickupPaxPro) || pickupPaxPro < 0) {
      throw new Error("Invalid Pick Up Pax value");
    }
  }

  if (booking.type === "cruise") {
    if (shipName !== undefined) {
      setNestedIfPossible(booking, "details.cruise.ship_name", shipName);
    }

    if (shuttleTime !== undefined) {
      setNestedIfPossible(booking, "details.cruise.shuttle_time", shuttleTime);
      booking.shuttle_time = shuttleTime;
    }

    const finalCruisePax = pickupPax !== undefined ? pickupPax : pax;

    if (finalCruisePax !== undefined) {
      setNestedIfPossible(
        booking,
        "details.cruise.pickup_pax",
        finalCruisePax
      );

      booking.pax = finalCruisePax;
    }

    if (pickupPaxPro !== undefined) {
      setNestedIfPossible(
        booking,
        "details.cruise.pickup_pax_pro",
        pickupPaxPro
      );
    }

    if (parkingSlot !== undefined) {
      setNestedIfPossible(booking, "details.cruise.parking_slot", parkingSlot);
      booking.parking_slot = parkingSlot;

      if (mongoose.Types.ObjectId.isValid(parkingSlot)) {
        setNestedIfPossible(
          booking,
          "details.cruise.shuttle_slot_id",
          parkingSlot
        );

        booking.shuttle_slot_id = parkingSlot;
      }
    }

    if (shouldUpdateCruiseAddOnVehicle) {
      const currentAddOnVehicle =
        booking.details?.cruise?.add_on_vehicle || {};

      const addOnVehicleEnabled = normalizeBoolean(
        body.add_on_vehicle_enabled ??
          bodyAddOnVehicle.enabled ??
          currentAddOnVehicle.enabled
      );

      const addOnVehicleType = String(
        body.add_on_vehicle_type ??
          bodyAddOnVehicle.type ??
          currentAddOnVehicle.type ??
          ""
      ).trim();

      const addOnVehicleLicensePlate = String(
        body.add_on_vehicle_license_plate ??
          bodyAddOnVehicle.license_plate ??
          currentAddOnVehicle.license_plate ??
          ""
      )
        .trim()
        .toUpperCase();

      if (addOnVehicleEnabled && !addOnVehicleType) {
        throw new Error("Please select add-on vehicle");
      }

      if (addOnVehicleEnabled && !addOnVehicleLicensePlate) {
        throw new Error(`${addOnVehicleType} License Plate is required`);
      }

      const addOnVehicleDiscountPercent = addOnVehicleEnabled
        ? normalizePercent(
            body.add_on_vehicle_discount_percent ??
              bodyAddOnVehicle.discount_percent ??
              bodyPricing.add_on_vehicle_discount_percent ??
              currentAddOnVehicle.discount_percent ??
              booking.add_on_vehicle_discount_percent,
            ADD_ON_VEHICLE_DISCOUNT_PERCENT
          )
        : 0;

      const addOnVehicleOriginalPrice = addOnVehicleEnabled
        ? moneyNumber(
            body.add_on_vehicle_original_price ??
              bodyAddOnVehicle.original_price ??
              bodyPricing.add_on_vehicle_original_price ??
              currentAddOnVehicle.original_price ??
              booking.add_on_vehicle_original_price
          )
        : 0;

      const addOnVehicleDiscountAmount = addOnVehicleEnabled
        ? moneyNumber(
            body.add_on_vehicle_discount_amount ??
              bodyAddOnVehicle.discount_amount ??
              bodyPricing.add_on_vehicle_discount_amount ??
              currentAddOnVehicle.discount_amount ??
              booking.add_on_vehicle_discount_amount
          )
        : 0;

      const addOnVehiclePrice = addOnVehicleEnabled
        ? moneyNumber(
            body.add_on_vehicle_price ??
              bodyAddOnVehicle.price ??
              bodyPricing.add_on_vehicle_price ??
              currentAddOnVehicle.price ??
              booking.add_on_vehicle_price
          )
        : 0;

      const addOnVehicle = {
        enabled: addOnVehicleEnabled,
        type: addOnVehicleEnabled ? addOnVehicleType : "",
        license_plate: addOnVehicleEnabled ? addOnVehicleLicensePlate : "",
        discount_percent: addOnVehicleDiscountPercent,
        original_price: addOnVehicleOriginalPrice,
        discount_amount: addOnVehicleDiscountAmount,
        price: addOnVehiclePrice,
      };

      booking.add_on_vehicle_enabled = addOnVehicle.enabled;
      booking.add_on_vehicle_type = addOnVehicle.type;
      booking.add_on_vehicle_license_plate = addOnVehicle.license_plate;
      booking.add_on_vehicle_discount_percent =
        addOnVehicle.discount_percent;
      booking.add_on_vehicle_original_price = addOnVehicle.original_price;
      booking.add_on_vehicle_discount_amount = addOnVehicle.discount_amount;
      booking.add_on_vehicle_price = addOnVehicle.price;

      setNestedIfPossible(
        booking,
        "details.cruise.add_on_vehicle",
        addOnVehicle
      );
      setNestedIfPossible(
        booking,
        "details.pricing.add_on_vehicle_original_price",
        addOnVehicle.original_price
      );
      setNestedIfPossible(
        booking,
        "details.pricing.add_on_vehicle_discount_percent",
        addOnVehicle.discount_percent
      );
      setNestedIfPossible(
        booking,
        "details.pricing.add_on_vehicle_discount_amount",
        addOnVehicle.discount_amount
      );
      setNestedIfPossible(
        booking,
        "details.pricing.add_on_vehicle_price",
        addOnVehicle.price
      );
    }
  }

  if (booking.type === "storage") {
    if (storageTypeName !== undefined || storageTypeId !== undefined) {
      if (!storageTypeName && !storageTypeId) {
        throw new Error("Storage type is required");
      }

      const storageType = await findStorageTypeForAdminEdit({
        storageTypeName,
        storageTypeId,
      });

      if (!storageType) {
        throw new Error("Selected storage type was not found");
      }

      if (storageType.is_active === false) {
        throw new Error("Selected storage type is inactive");
      }

      const finalStorageTypeName =
        storageType.name || storageTypeName || String(storageTypeId || "");

      if (storageType?._id) {
        setNestedIfPossible(
          booking,
          "details.storage.storage_type_id",
          storageType._id
        );
      }

      setNestedIfPossible(
        booking,
        "details.storage.storage_type_name",
        finalStorageTypeName
      );

      setNestedIfPossible(
        booking,
        "details.storage.storage_type",
        finalStorageTypeName
      );
    }

    const storageCapacityRelevantFieldChanged =
      body.location_id !== undefined ||
      body.start_date !== undefined ||
      body.end_date !== undefined ||
      body.storage_type !== undefined ||
      body.storage_type_id !== undefined;

    const bookingUsesStorageCapacity =
      DASHBOARD_ACTIVE_BOOKING_STATUSES.includes(String(booking.status || ""));

    if (storageCapacityRelevantFieldChanged && bookingUsesStorageCapacity) {
      const finalStorageTypeId =
        booking.details?.storage?.storage_type_id || null;

      const finalStorageTypeName =
        booking.details?.storage?.storage_type_name ||
        booking.details?.storage?.storage_type ||
        "";

      const storageTypeForCapacity = await findStorageTypeForAdminEdit({
        storageTypeId: finalStorageTypeId
          ? String(finalStorageTypeId)
          : "",
        storageTypeName: finalStorageTypeName,
      });

      if (!storageTypeForCapacity) {
        throw new Error("Selected storage type was not found");
      }

      if (storageTypeForCapacity.is_active === false) {
        throw new Error("Selected storage type is inactive");
      }

      const locationForCapacity = await validateAndGetLocation(
        String(booking.location_id),
        "storage"
      );

      await validateAdminStorageAvailability({
        storageType: storageTypeForCapacity,
        location: locationForCapacity,
        startDate: booking.start_date,
        endDate: booking.end_date,
        excludeBookingId: booking._id,
      });
    }
  }

  if (booking.type === "airport") {
    if (shuttleTime !== undefined) {
      setNestedIfPossible(booking, "details.airport.shuttle_time", shuttleTime);
      booking.shuttle_time = shuttleTime;
    }

    const finalAirportPax = pickupPax !== undefined ? pickupPax : pax;

    if (finalAirportPax !== undefined) {
      setNestedIfPossible(
        booking,
        "details.airport.pickup_pax",
        finalAirportPax
      );

      booking.pax = finalAirportPax;
    }

    if (parkingSlot !== undefined) {
      setNestedIfPossible(booking, "details.airport.parking_slot", parkingSlot);
      booking.parking_slot = parkingSlot;

      if (mongoose.Types.ObjectId.isValid(parkingSlot)) {
        setNestedIfPossible(
          booking,
          "details.airport.shuttle_slot_id",
          parkingSlot
        );

        booking.shuttle_slot_id = parkingSlot;
      }
    }
  }

  booking.markModified("details");
}


async function generateAdminBookingId(prefix = "BK") {
  const now = new Date();

  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const datePart = `${year}${month}${day}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const randomPart = Math.floor(1000 + Math.random() * 9000);

    const bookingId = `${prefix}-${datePart}-${randomPart}`;

    const exists = await Booking.exists({ booking_id: bookingId });

    if (!exists) {
      return bookingId;
    }
  }

  return `${prefix}-${datePart}-${new mongoose.Types.ObjectId()
    .toString()
    .slice(-4)
    .toUpperCase()}`;
}

function getManualPaymentReference(body) {
  return String(
    body.transaction_id ||
      body.transaction_reference ||
      body.manual_payment_reference ||
      body.reference ||
      ""
  ).trim();
}

async function findOrCreateAdminBookingCustomer({
  firstName,
  lastName,
  email,
  phone,
}) {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const name = `${String(firstName || "").trim()} ${String(
    lastName || ""
  ).trim()}`.trim();

  if (!name) {
    throw new Error("Customer name is required");
  }

  if (!normalizedEmail) {
    throw new Error("Customer email is required");
  }

  if (!phone) {
    throw new Error("Customer phone is required");
  }

  let user = await ParkingUser.findOne({
    email: normalizedEmail,
  });

  if (user) {
    if (user.role && user.role !== "customer") {
      throw new Error("This email already belongs to a non-customer account");
    }

    let changed = false;

    if (user.name !== name) {
      user.name = name;
      changed = true;
    }

    if (user.phone !== phone) {
      user.phone = phone;
      changed = true;
    }

    if (user.is_active === false) {
      user.is_active = true;
      changed = true;
    }

    if (!user.role) {
      user.role = "customer";
      changed = true;
    }

    if (changed) {
      await user.save();
    }

    return user;
  }

  user = await ParkingUser.create({
    name,
    email: normalizedEmail,
    phone,
    role: "customer",
    is_active: true,
    wallet_balance: 0,
    wallet_currency: "aud",
    wallet_status: "active",
  });

  return user;
}

function pickFirstAllowedEnumValue(model, path, preferredValues = []) {
  const enumValues = model.schema.path(path)?.enumValues || [];

  const cleanPreferredValues = preferredValues
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => String(value));

  if (enumValues.length === 0) {
    return cleanPreferredValues[0];
  }

  const matchedValue = cleanPreferredValues.find((value) =>
    enumValues.includes(value)
  );

  if (matchedValue) {
    return matchedValue;
  }

  return undefined;
}



function getAdminManualPaymentReference(body) {
  return String(
    body.transaction_id ||
      body.transaction_reference ||
      body.manual_payment_reference ||
      body.reference_payment ||
      body.payment_reference ||
      ""
  ).trim();
}

async function createAdminManualPaymentRecord({
  booking,
  customerUser,
  adminUser,
  paidAmount,
  finalPrice,
  holdingDepositAmount,
  dueAmount,
  paymentMethod,
  paymentType,
  paymentFlow,
  depositType,
  transactionReference,
}) {
  let payment = null;
  let paymentCreateError = null;

  if (moneyNumber(paidAmount) <= 0) {
    return {
      payment,
      paymentCreateError,
    };
  }

  try {
    const safePaymentPurpose = pickFirstAllowedEnumValue(
      Payment,
      "payment_purpose",
      ["booking", "payment", "parking_booking", "booking_payment", "wallet_topup"]
    );

    const safePaymentFlow = pickFirstAllowedEnumValue(Payment, "payment_flow", [
      paymentFlow,
      "full_online",
      "poa_deposit",
      "online",
      "manual",
    ]);

    const safePaymentStatus = pickFirstAllowedEnumValue(Payment, "status", [
      "paid",
      "success",
      "completed",
      "succeeded",
    ]);

    const paymentPayload = {
      booking_id: booking._id,
      user_id: customerUser._id,

      amount: moneyNumber(paidAmount),
      currency: booking.currency || "aud",

      method: paymentMethod,
      payment_method: paymentMethod,

      deposit_type: depositType,

      status: safePaymentStatus || "paid",

      transaction_id: transactionReference || undefined,

      provider_payment_id:
        paymentMethod === "stripe" ? transactionReference || undefined : undefined,

      provider_order_id:
        paymentMethod === "paypal" ? transactionReference || undefined : undefined,

      provider_capture_id:
        paymentMethod === "paypal" ? transactionReference || undefined : undefined,

      booking_total_amount: moneyNumber(finalPrice),
      holding_deposit_amount: moneyNumber(holdingDepositAmount),
      balance_due_on_arrival: moneyNumber(dueAmount),

      paid_at: new Date(),

      metadata: {
        admin_created: true,
        admin_user_id: String(adminUser._id),
        booking_id: booking.booking_id,
        payment_type: paymentType,
        payment_method: paymentMethod,
        manual_reference: transactionReference || null,
      },
    };

    if (safePaymentPurpose) {
      paymentPayload.payment_purpose = safePaymentPurpose;
    }

    if (safePaymentFlow) {
      paymentPayload.payment_flow = safePaymentFlow;
    }

    payment = await Payment.create(paymentPayload);
  } catch (error) {
    paymentCreateError = error.message || "Payment transaction record failed";

    console.error("Admin manual payment record create failed:", {
      booking_id: booking.booking_id,
      error: paymentCreateError,
    });
  }

  return {
    payment,
    paymentCreateError,
  };
}

async function incrementAdminLocationBookedCount({ locationId, count = 1 }) {
  if (!locationId) return null;

  const location = await Location.findById(locationId);

  if (!location) {
    throw new Error("Selected location was not found while updating capacity");
  }

  const incrementBy = Number(count || 1);
  const capacity = Number(location.capacity || 0);
  const currentBookedCount = Number(location.booked_count || 0);
  const nextBookedCount = currentBookedCount + incrementBy;

  if (capacity > 0 && nextBookedCount > capacity) {
    throw new Error("Selected location does not have enough capacity");
  }

  location.booked_count = nextBookedCount;

  await location.save();

  return location;
}

async function decrementAdminLocationBookedCount({ locationId, count = 1 }) {
  if (!locationId) return null;

  const location = await Location.findById(locationId);

  if (!location) return null;

  const decrementBy = Number(count || 1);
  const currentBookedCount = Number(location.booked_count || 0);

  location.booked_count = Math.max(currentBookedCount - decrementBy, 0);

  await location.save();

  return location;
}

function parseAdminLocalDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const dateOnly = String(value).slice(0, 10);
  const [year, month, day] = dateOnly.split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatAdminDateKey(value) {
  const date = parseAdminLocalDate(value);

  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getAdminBlockedRanges(location) {
  const blocked =
    location?.blocked_dates ||
    location?.block_dates ||
    location?.blockedDates ||
    [];

  if (!Array.isArray(blocked)) return [];

  return blocked
    .filter((item) => item && item.is_active !== false)
    .map((item) => {
      if (typeof item === "string" || item instanceof Date) {
        const date = formatAdminDateKey(item);

        return {
          start: date,
          end: date,
          reason: "This date is blocked by admin.",
        };
      }

      const start = formatAdminDateKey(
        item.start_date || item.startDate || item.from || item.date
      );

      const end = formatAdminDateKey(
        item.end_date ||
          item.endDate ||
          item.to ||
          item.date ||
          item.start_date ||
          item.startDate ||
          item.from
      );

      return {
        start,
        end,
        reason: item.reason || "This date is blocked by admin.",
      };
    })
    .filter((item) => item.start && item.end);
}

function getAdminBlockedDateConflict(location, dateValue) {
  if (!location || !dateValue) return null;

  const selectedDate = formatAdminDateKey(dateValue);
  const blockedRanges = getAdminBlockedRanges(location);

  const conflict = blockedRanges.find((blocked) => {
    return selectedDate >= blocked.start && selectedDate <= blocked.end;
  });

  if (!conflict) return null;

  return conflict.reason || "This date is blocked by admin.";
}

function countAdminInclusiveDays(startDateValue, endDateValue) {
  const startDate = parseAdminLocalDate(startDateValue);
  const endDate = parseAdminLocalDate(endDateValue);

  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return days > 0 ? days : 0;
}

function countAdminAirportBookableDays(location, startDateValue, endDateValue) {
  const startDate = parseAdminLocalDate(startDateValue);
  const endDate = parseAdminLocalDate(endDateValue);

  // Inclusive Airport day counting:
  // 09 Sep -> 09 Sep = 1 day
  // 04 Sep -> 05 Sep = 2 days
  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const dateKey = formatAdminDateKey(cursor);
    const isBlocked = getAdminBlockedDateConflict(location, dateKey);

    if (!isBlocked) {
      count += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function normalizeAdminStorageCapacity(value) {
  const number = Number(value ?? 0);

  if (
    !Number.isFinite(number) ||
    !Number.isInteger(number) ||
    number < 0
  ) {
    return 0;
  }

  return number;
}

async function countAdminStorageTypeOverlappingBookings({
  storageType,
  startDate,
  endDate,
  excludeBookingId = null,
}) {
  if (!storageType?._id || !startDate || !endDate) {
    return 0;
  }

  const storageTypeName = String(storageType.name || "").trim();
  const storageTypeNameRegex = storageTypeName
    ? new RegExp(`^${escapeRegex(storageTypeName)}$`, "i")
    : null;

  const match = {
    type: "storage",
    status: {
      $in: DASHBOARD_ACTIVE_BOOKING_STATUSES,
    },
    start_date: {
      $lte: endDate,
    },
    end_date: {
      $gte: startDate,
    },
    $or: [
      {
        "details.storage.storage_type_id": storageType._id,
      },
    ],
  };

  if (storageTypeNameRegex) {
    match.$or.push(
      {
        "details.storage.storage_type_name": storageTypeNameRegex,
      },
      {
        "details.storage.storage_type": storageTypeNameRegex,
      }
    );
  }

  if (excludeBookingId) {
    match._id = {
      $ne: excludeBookingId,
    };
  }

  return Booking.countDocuments(match);
}

async function countAdminStorageLocationOverlappingBookings({
  location,
  startDate,
  endDate,
  excludeBookingId = null,
}) {
  if (!location?._id || !startDate || !endDate) {
    return 0;
  }

  const match = {
    type: "storage",
    location_id: location._id,
    status: {
      $in: DASHBOARD_ACTIVE_BOOKING_STATUSES,
    },
    start_date: {
      $lte: endDate,
    },
    end_date: {
      $gte: startDate,
    },
  };

  if (excludeBookingId) {
    match._id = {
      $ne: excludeBookingId,
    };
  }

  return Booking.countDocuments(match);
}

/**
 * Admin Storage availability validation.
 *
 * Storage Type capacity:
 * - 0 = Unlimited
 * - > 0 = Maximum overlapping active bookings for that Storage Type
 *
 * Storage Location capacity remains a separate overall overlapping-booking
 * limit for the selected location.
 */
async function validateAdminStorageAvailability({
  storageType,
  location,
  startDate,
  endDate,
  excludeBookingId = null,
}) {
  if (!storageType) {
    throw new Error("Selected storage type was not found");
  }

  if (!location) {
    throw new Error("Selected storage location was not found");
  }

  const storageTypeCapacity = normalizeAdminStorageCapacity(
    storageType.capacity
  );

  let storageTypeBookedCount = 0;

  if (storageTypeCapacity > 0) {
    storageTypeBookedCount =
      await countAdminStorageTypeOverlappingBookings({
        storageType,
        startDate,
        endDate,
        excludeBookingId,
      });

    if (storageTypeBookedCount >= storageTypeCapacity) {
      throw new Error(
        `${storageType.name} storage is fully booked for the selected dates`
      );
    }
  }

  const locationCapacity = normalizeAdminStorageCapacity(location.capacity);

  let locationBookedCount = 0;

  if (locationCapacity > 0) {
    locationBookedCount =
      await countAdminStorageLocationOverlappingBookings({
        location,
        startDate,
        endDate,
        excludeBookingId,
      });

    if (locationBookedCount >= locationCapacity) {
      throw new Error(
        `${location.name} has no storage slots available for the selected dates`
      );
    }
  }

  return {
    storage_type: {
      capacity: storageTypeCapacity,
      booked_count: storageTypeBookedCount,
      unlimited: storageTypeCapacity === 0,
    },
    location: {
      capacity: locationCapacity,
      booked_count: locationBookedCount,
      unlimited: locationCapacity === 0,
    },
  };
}


export async function createAdminCruiseBooking(req) {
  try {
    const adminUser = await requireAdminUser(req);
    const body = await req.json();

    const scheduleId = String(body.schedule_id || "").trim();

    if (!scheduleId || !mongoose.Types.ObjectId.isValid(scheduleId)) {
      throw new Error("Cruise schedule is required");
    }

    const schedule = await CruiseSchedule.findById(scheduleId).populate(
      "location_id",
      "name type address"
    );

    if (!schedule) {
      throw new Error("Cruise schedule not found");
    }

    if (schedule.is_active === false) {
      throw new Error("Selected cruise schedule is inactive");
    }

    const locationId =
      typeof schedule.location_id === "object"
        ? schedule.location_id?._id
        : schedule.location_id;

    if (!locationId) {
      throw new Error("Selected cruise schedule does not have a location");
    }

    const startDate = parseAdminBookingDate(
      body.start_date,
      "Ship departure date"
    );

    const endDate = parseAdminBookingDate(body.end_date, "Ship arrival date");

    if (!startDate) {
      throw new Error("Ship departure date is required");
    }

    if (!endDate) {
      throw new Error("Ship arrival date is required");
    }

    validateBookingDateRange(startDate, endDate, "cruise");

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const email = String(body.email || "").toLowerCase().trim();
    const phone = String(body.phone || "").trim();

    const customerUser = await findOrCreateAdminBookingCustomer({
      firstName,
      lastName,
      email,
      phone,
    });

    const customerName = `${firstName} ${lastName}`.trim();

    const licensePlate = String(body.license_plate || "").trim();

    if (!licensePlate) {
      throw new Error("License plate is required");
    }

    const bodyCruise = body.details?.cruise || {};

    const carParkToTerminalPassengers = Number(
      body.car_park_to_terminal_passengers ??
        bodyCruise.car_park_to_terminal_passengers ??
        body.pickup_pax ??
        body.pax ??
        0
    );

    const terminalToCarParkPassengers = Number(
      body.terminal_to_car_park_passengers ??
        bodyCruise.terminal_to_car_park_passengers ??
        body.pax ??
        0
    );

    if (
      !Number.isFinite(carParkToTerminalPassengers) ||
      carParkToTerminalPassengers < 1
    ) {
      throw new Error("Car park to terminal passengers must be at least 1");
    }

    if (
      !Number.isFinite(terminalToCarParkPassengers) ||
      terminalToCarParkPassengers < 1
    ) {
      throw new Error("Terminal to car park passengers must be at least 1");
    }

    const passengerCount = Math.max(
      Number(body.pax || 0),
      carParkToTerminalPassengers,
      terminalToCarParkPassengers,
      1
    );

    const pickupPaxPro =
      body.pickup_pax_pro !== undefined && body.pickup_pax_pro !== ""
        ? Number(body.pickup_pax_pro)
        : body.pickup_pax !== undefined && body.pickup_pax !== ""
        ? Number(body.pickup_pax)
        : passengerCount;

    if (!Number.isFinite(pickupPaxPro) || pickupPaxPro < 0) {
      throw new Error("Invalid Pick Up Pax value");
    }

    const carParkToTerminalShuttleTime = String(
      body.car_park_to_terminal_shuttle_time ||
        bodyCruise.car_park_to_terminal_shuttle_time ||
        body.shuttle_time ||
        ""
    ).trim();

    const terminalToCarParkShuttleTime = String(
      body.terminal_to_car_park_shuttle_time ||
        bodyCruise.terminal_to_car_park_shuttle_time ||
        ""
    ).trim();

    if (!carParkToTerminalShuttleTime) {
      throw new Error("Car park to terminal shuttle time is required");
    }

    if (!terminalToCarParkShuttleTime) {
      throw new Error("Terminal to car park shuttle time is required");
    }

    const carParkToTerminalShuttleSlotId = String(
      body.car_park_to_terminal_shuttle_slot_id ||
        bodyCruise.car_park_to_terminal_shuttle_slot_id ||
        body.shuttle_slot_id ||
        ""
    ).trim();

    const terminalToCarParkShuttleSlotId = String(
      body.terminal_to_car_park_shuttle_slot_id ||
        bodyCruise.terminal_to_car_park_shuttle_slot_id ||
        ""
    ).trim();

    const shuttleTime = carParkToTerminalShuttleTime;
    const shuttleSlotId = carParkToTerminalShuttleSlotId;
    const parkingSlot = String(body.parking_slot || "").trim();

    const shipName =
      String(body.ship_name || "").trim() ||
      schedule.ship_name ||
      schedule.schedule_name;

    if (!shipName) {
      throw new Error("Ship name is required");
    }

    const addOnVehiclePayload = bodyCruise.add_on_vehicle || {};
    const addOnVehicleEnabled = normalizeBoolean(
      body.add_on_vehicle_enabled ?? addOnVehiclePayload.enabled
    );

    const addOnVehicleType = String(
      body.add_on_vehicle_type || addOnVehiclePayload.type || ""
    ).trim();

    const addOnVehicleLicensePlate = String(
      body.add_on_vehicle_license_plate ||
        addOnVehiclePayload.license_plate ||
        ""
    )
      .trim()
      .toUpperCase();

    if (addOnVehicleEnabled && !addOnVehicleType) {
      throw new Error("Please select add-on vehicle");
    }

    if (addOnVehicleEnabled && !addOnVehicleLicensePlate) {
      throw new Error(`${addOnVehicleType} License Plate is required`);
    }

    const addOnVehicleDiscountPercent = addOnVehicleEnabled
      ? normalizePercent(
          body.add_on_vehicle_discount_percent ??
            addOnVehiclePayload.discount_percent,
          ADD_ON_VEHICLE_DISCOUNT_PERCENT
        )
      : 0;

    const addOnVehicleOriginalPrice = addOnVehicleEnabled
      ? moneyNumber(
          body.add_on_vehicle_original_price ??
            addOnVehiclePayload.original_price ??
            body.details?.pricing?.add_on_vehicle_original_price ??
            0
        )
      : 0;

    const addOnVehicleDiscountAmount = addOnVehicleEnabled
      ? moneyNumber(
          body.add_on_vehicle_discount_amount ??
            addOnVehiclePayload.discount_amount ??
            body.details?.pricing?.add_on_vehicle_discount_amount ??
            0
        )
      : 0;

    const addOnVehiclePrice = addOnVehicleEnabled
      ? moneyNumber(
          body.add_on_vehicle_price ??
            addOnVehiclePayload.price ??
            body.details?.pricing?.add_on_vehicle_price ??
            Math.max(
              addOnVehicleOriginalPrice -
                (addOnVehicleOriginalPrice * addOnVehicleDiscountPercent) /
                  100,
              0
            )
        )
      : 0;

    const addOnVehicle = {
      enabled: addOnVehicleEnabled,
      type: addOnVehicleEnabled ? addOnVehicleType : "",
      license_plate: addOnVehicleEnabled ? addOnVehicleLicensePlate : "",
      discount_percent: addOnVehicleDiscountPercent,
      original_price: addOnVehicleOriginalPrice,
      discount_amount: addOnVehicleDiscountAmount,
      price: addOnVehiclePrice,
    };

    const finalPrice = moneyNumber(body.price || body.original_price || 0);

    if (finalPrice <= 0) {
      throw new Error("Booking price must be greater than 0");
    }

    const originalPrice = moneyNumber(body.original_price || finalPrice);
    const extraPassengerCount = Number(
      body.extra_passenger_count ||
        body.details?.pricing?.extra_passenger_count ||
        bodyCruise.extra_passenger_count ||
        0
    );
    const extraPassengerFee = moneyNumber(
      body.extra_passenger_fee ||
        body.details?.pricing?.extra_passenger_fee ||
        bodyCruise.extra_passenger_fee ||
        0
    );
    const parkingPrice = moneyNumber(
      body.parking_price ||
        body.details?.pricing?.parking_price ||
        Math.max(originalPrice - extraPassengerFee - addOnVehiclePrice, 0)
    );

    const paymentType = String(body.payment_type || "").trim();
    const paymentMethod = String(body.payment_method || "").trim();

    if (!["online", "poa"].includes(paymentType)) {
      throw new Error("Please select payment type");
    }

    if (!["stripe", "paypal", "credit_card_manual"].includes(paymentMethod)) {
      throw new Error("Please select a valid payment method");
    }

    const transactionReference = getManualPaymentReference(body);

    const isOnlinePayment = paymentType === "online";
    const isPayOnArrival = paymentType === "poa";

    const settings = await getGlobalSettingsDocument();
    const configuredHoldingDepositAmount =
      getConfiguredHoldingDepositAmount(settings);

    const holdingDepositAmount = isPayOnArrival
      ? Math.min(configuredHoldingDepositAmount, finalPrice)
      : 0;

    const bookingStatus = isOnlinePayment ? "success" : "poa";
    const bookingPaymentStatus = isOnlinePayment ? "paid" : "partial";
    const paymentFlow = isOnlinePayment ? "full_online" : "poa_deposit";
    const depositType = isOnlinePayment ? "full" : "poa";
    const paidAmount = isOnlinePayment ? finalPrice : holdingDepositAmount;
    const dueAmount = Math.max(finalPrice - paidAmount, 0);

    const bookingId = await generateAdminBookingId("BK");

    const booking = await Booking.create({
      booking_id: bookingId,
      user_id: customerUser._id,
      location_id: locationId,
      schedule_id: schedule._id,

      type: "cruise",
      start_date: startDate,
      end_date: endDate,

      pax: passengerCount,
      license_plate: licensePlate,

      car_park_to_terminal_passengers: carParkToTerminalPassengers,
      car_park_to_terminal_shuttle_slot_id:
        mongoose.Types.ObjectId.isValid(carParkToTerminalShuttleSlotId)
          ? carParkToTerminalShuttleSlotId
          : null,
      car_park_to_terminal_shuttle_time: carParkToTerminalShuttleTime,

      terminal_to_car_park_passengers: terminalToCarParkPassengers,
      terminal_to_car_park_shuttle_slot_id:
        mongoose.Types.ObjectId.isValid(terminalToCarParkShuttleSlotId)
          ? terminalToCarParkShuttleSlotId
          : null,
      terminal_to_car_park_shuttle_time: terminalToCarParkShuttleTime,

      add_on_vehicle_enabled: addOnVehicle.enabled,
      add_on_vehicle_type: addOnVehicle.type,
      add_on_vehicle_license_plate: addOnVehicle.license_plate,
      add_on_vehicle_discount_percent: addOnVehicle.discount_percent,
      add_on_vehicle_original_price: addOnVehicle.original_price,
      add_on_vehicle_discount_amount: addOnVehicle.discount_amount,
      add_on_vehicle_price: addOnVehicle.price,

      shuttle_time: carParkToTerminalShuttleTime,
      shuttle_slot_id:
        mongoose.Types.ObjectId.isValid(carParkToTerminalShuttleSlotId)
          ? carParkToTerminalShuttleSlotId
          : null,

      interlock: Boolean(body.interlock),
      reference: transactionReference || String(body.reference || "").trim(),

      notes: String(body.notes || "").trim(),
      source: body.source || "admin",

      customer: {
        name: customerName,
        email,
        phone,
      },

      pricing_type: "fixed",
      currency: "aud",
      original_price: originalPrice,
      price: finalPrice,
      discount_amount: 0,

      paid_amount: paidAmount,
      due_amount: dueAmount,
      holding_deposit_amount: holdingDepositAmount,
      balance_due_on_arrival: dueAmount,

      payment_flow: paymentFlow,
      deposit_type: depositType,
      payment_method: paymentMethod,
      payment_status: bookingPaymentStatus,
      status: bookingStatus,
      payment_completed_at: paidAmount > 0 ? new Date() : null,

      stripe_payment_intent_id:
        paymentMethod === "stripe" ? transactionReference || null : null,

      paypal_order_id:
        paymentMethod === "paypal" ? transactionReference || null : null,

      paypal_capture_id:
        paymentMethod === "paypal" ? transactionReference || null : null,

      details: {
        pricing: {
          price_rule_id:
            body.price_rule_id && mongoose.Types.ObjectId.isValid(body.price_rule_id)
              ? body.price_rule_id
              : null,
          calculated_days: Number(
            body.calculated_days || body.details?.pricing?.calculated_days || 0
          ),
          parking_price: parkingPrice,
          included_shuttle_passengers: Number(
            body.details?.pricing?.included_shuttle_passengers || 4
          ),
          extra_passenger_unit_fee: Number(
            body.details?.pricing?.extra_passenger_unit_fee || 5
          ),
          extra_passenger_count: Number(extraPassengerCount || 0),
          extra_passenger_fee: extraPassengerFee,
          add_on_vehicle_original_price: addOnVehicle.original_price,
          add_on_vehicle_discount_percent: addOnVehicle.discount_percent,
          add_on_vehicle_discount_amount: addOnVehicle.discount_amount,
          add_on_vehicle_price: addOnVehicle.price,
          total_before_discount: moneyNumber(
            body.total_before_discount ||
              body.details?.pricing?.total_before_discount ||
              finalPrice
          ),
        },
        cruise: {
          ship_name: shipName,
          shuttle_time: carParkToTerminalShuttleTime,
          shuttle_slot_id: mongoose.Types.ObjectId.isValid(
            carParkToTerminalShuttleSlotId
          )
            ? carParkToTerminalShuttleSlotId
            : null,
          parking_slot: parkingSlot,

          // Normal passenger count.
          pickup_pax: passengerCount,

          // Separate optional admin field.
          pickup_pax_pro: pickupPaxPro,

          car_park_to_terminal_passengers: carParkToTerminalPassengers,
          car_park_to_terminal_shuttle_slot_id: mongoose.Types.ObjectId.isValid(
            carParkToTerminalShuttleSlotId
          )
            ? carParkToTerminalShuttleSlotId
            : null,
          car_park_to_terminal_shuttle_time: carParkToTerminalShuttleTime,

          terminal_to_car_park_passengers: terminalToCarParkPassengers,
          terminal_to_car_park_shuttle_slot_id: mongoose.Types.ObjectId.isValid(
            terminalToCarParkShuttleSlotId
          )
            ? terminalToCarParkShuttleSlotId
            : null,
          terminal_to_car_park_shuttle_time: terminalToCarParkShuttleTime,

          extra_passenger_count: Number(extraPassengerCount || 0),
          extra_passenger_fee: extraPassengerFee,
          add_on_vehicle: addOnVehicle,
        },
      },

      updated_by: adminUser._id,
    });

    let updatedShuttleSlot = null;
    let updatedTerminalToCarParkShuttleSlot = null;

    try {
      updatedShuttleSlot = await incrementSettingShuttleSlotBookedCount({
        type: "cruise",
        slotId: carParkToTerminalShuttleSlotId,
        slotTime: carParkToTerminalShuttleTime,
        passengerCount: carParkToTerminalPassengers,
        direction: "car_park_to_terminal",
      });

      updatedTerminalToCarParkShuttleSlot =
        await incrementSettingShuttleSlotBookedCount({
          type: "cruise",
          slotId: terminalToCarParkShuttleSlotId,
          slotTime: terminalToCarParkShuttleTime,
          passengerCount: terminalToCarParkPassengers,
          direction: "terminal_to_car_park",
        });
    } catch (slotError) {
      await Booking.deleteOne({ _id: booking._id });
      throw slotError;
    }

    let payment = null;
    let paymentCreateError = null;

    /**
     * Admin booking payment is manual record only.
     * Stripe/PayPal/Credit Card Manual do not redirect or charge here.
     *
     * Pay Online:
     * - Payment amount = full total
     *
     * Pay on Arrival:
     * - Payment amount = A$10 holding deposit
     */
    if (paidAmount > 0) {
      try {
        const safePaymentPurpose = pickFirstAllowedEnumValue(
          Payment,
          "payment_purpose",
          [
            "booking",
            "payment",
            "parking_booking",
            "booking_payment",
            "wallet_topup",
          ]
        );

        const safePaymentFlow = pickFirstAllowedEnumValue(
          Payment,
          "payment_flow",
          [paymentFlow, "full_online", "poa_deposit", "online", "manual"]
        );

        // A Payment record represents money received, so status should be paid.
        const safePaymentStatus = pickFirstAllowedEnumValue(Payment, "status", [
          "paid",
          "success",
          "completed",
          "succeeded",
          bookingPaymentStatus,
        ]);

        const paymentPayload = {
          booking_id: booking._id,
          user_id: customerUser._id,

          amount: paidAmount,
          currency: "aud",

          method: paymentMethod,
          payment_method: paymentMethod,

          deposit_type: depositType,

          status: safePaymentStatus || "paid",

          transaction_id: transactionReference || undefined,

          provider_payment_id:
            paymentMethod === "stripe"
              ? transactionReference || undefined
              : undefined,

          provider_order_id:
            paymentMethod === "paypal"
              ? transactionReference || undefined
              : undefined,

          provider_capture_id:
            paymentMethod === "paypal"
              ? transactionReference || undefined
              : undefined,

          booking_total_amount: finalPrice,
          holding_deposit_amount: holdingDepositAmount,
          balance_due_on_arrival: dueAmount,

          paid_at: new Date(),

          metadata: {
            admin_created: true,
            admin_user_id: String(adminUser._id),
            booking_id: booking.booking_id,
            payment_type: paymentType,
            payment_method: paymentMethod,
            manual_reference: transactionReference || null,
          },
        };

        if (safePaymentPurpose) {
          paymentPayload.payment_purpose = safePaymentPurpose;
        }

        if (safePaymentFlow) {
          paymentPayload.payment_flow = safePaymentFlow;
        }

        payment = await Payment.create(paymentPayload);
      } catch (error) {
        paymentCreateError =
          error.message || "Payment transaction record failed";

        console.error("Admin manual payment record create failed:", {
          booking_id: booking.booking_id,
          error: paymentCreateError,
        });
      }
    }

    const populatedBooking = await findAdminBookingByIdentifier(
      booking.booking_id
    );

    const shouldSendConfirmation =
      body.send_confirmation_email === true ||
      body.send_confirmation_email === "true" ||
      body.resend_confirmation_email === true ||
      body.resend_confirmation_email === "true";

    let emailResult = null;

    if (shouldSendConfirmation) {
      emailResult = await sendBookingConfirmationEmailSafely({
        booking: populatedBooking,
        resend: false,
        sendCustomerEmail: true,
        sendAdminEmail: true,
      });
    }

    let message = "Cruise booking created successfully.";

    if (shouldSendConfirmation && emailResult?.sentCustomerEmail) {
      message = "Cruise booking created successfully. Confirmation email sent.";
    }

    if (shouldSendConfirmation && !emailResult?.sentCustomerEmail) {
      message =
        "Cruise booking created successfully, but confirmation email failed to send.";
    }

 if (paymentCreateError) {
  console.error("Payment transaction record was not created:", {
    booking_id: booking.booking_id,
    paymentCreateError,
  });

  message = "Cruise booking created successfully.";
}

    return Response.json(
      {
        success: true,
        message,
        data: {
          booking: populatedBooking,
          payment,
          shuttle_slot: updatedShuttleSlot,
          terminal_to_car_park_shuttle_slot: updatedTerminalToCarParkShuttleSlot,
          payment_record_error: paymentCreateError,
          email_result: emailResult,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin cruise booking create error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create cruise booking",
        error: error.message || "Failed to create cruise booking",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function createAdminStorageBooking(req) {
  try {
    const adminUser = await requireAdminUser(req);
    const body = await req.json();

    const locationId = String(body.location_id || "").trim();

    if (!locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
      throw new Error("Storage location is required");
    }

    const location = await validateAndGetLocation(locationId, "storage");

    const storageTypeId = String(body.storage_type_id || "").trim();

    if (!storageTypeId || !mongoose.Types.ObjectId.isValid(storageTypeId)) {
      throw new Error("Storage type is required");
    }

    const storageType = await StorageType.findById(storageTypeId);

    if (!storageType) {
      throw new Error("Selected storage type was not found");
    }

    if (storageType.is_active === false) {
      throw new Error("Selected storage type is inactive");
    }

    const startDate = parseAdminBookingDate(body.start_date, "Entry date");
    const endDate = parseAdminBookingDate(body.end_date, "Exit date");

    validateBookingDateRange(startDate, endDate, "storage");

    const calculatedStorageDays = countAdminInclusiveDays(
      body.start_date,
      body.end_date
    );

    if (calculatedStorageDays < 1) {
      throw new Error("Selected date range must include at least 1 booking day");
    }

    await validateAdminStorageAvailability({
      storageType,
      location,
      startDate,
      endDate,
    });

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const email = String(body.email || "").toLowerCase().trim();
    const phone = String(body.phone || "").trim();

    const customerUser = await findOrCreateAdminBookingCustomer({
      firstName,
      lastName,
      email,
      phone,
    });

    const customerName = `${firstName} ${lastName}`.trim();

    const storageReference = String(
      body.license_plate || body.reference || ""
    ).trim();

    if (!storageReference) {
      throw new Error("Reference / License Plate is required");
    }

    const finalPrice = moneyNumber(body.price || body.original_price || 0);

    if (finalPrice <= 0) {
      throw new Error("Booking price must be greater than 0");
    }

    const originalPrice = moneyNumber(body.original_price || finalPrice);

    const paymentType = String(body.payment_type || "").trim();
    const paymentMethod = String(body.payment_method || "").trim();

    if (!["online", "poa"].includes(paymentType)) {
      throw new Error("Please select payment type");
    }

    if (!["stripe", "paypal", "credit_card_manual"].includes(paymentMethod)) {
      throw new Error("Please select a valid payment method");
    }

    const transactionReference = getAdminManualPaymentReference(body);

    const isOnlinePayment = paymentType === "online";
    const isPayOnArrival = paymentType === "poa";

    const settings = await getGlobalSettingsDocument();
    const configuredHoldingDepositAmount =
      getConfiguredHoldingDepositAmount(settings);

    const holdingDepositAmount = isPayOnArrival
      ? Math.min(configuredHoldingDepositAmount, finalPrice)
      : 0;

    const bookingStatus = isOnlinePayment ? "success" : "poa";
    const bookingPaymentStatus = isOnlinePayment ? "paid" : "partial";
    const paymentFlow = isOnlinePayment ? "full_online" : "poa_deposit";
    const depositType = isOnlinePayment ? "full" : "poa";
    const paidAmount = isOnlinePayment ? finalPrice : holdingDepositAmount;
    const dueAmount = Math.max(finalPrice - paidAmount, 0);

    const bookingId = await generateAdminBookingId("BK");

    const booking = await Booking.create({
      booking_id: bookingId,
      user_id: customerUser._id,
      location_id: location._id,

      type: "storage",
      start_date: startDate,
      end_date: endDate,

      pax: 0,
      license_plate: storageReference,
      reference: storageReference,

      notes: String(body.notes || "").trim(),
      source: body.source || "admin",

      customer: {
        name: customerName,
        email,
        phone,
      },

      pricing_type: "fixed",
      currency: "aud",
      original_price: originalPrice,
      price: finalPrice,
      discount_amount: 0,

      paid_amount: paidAmount,
      due_amount: dueAmount,
      holding_deposit_amount: holdingDepositAmount,
      balance_due_on_arrival: dueAmount,

      payment_flow: paymentFlow,
      deposit_type: depositType,
      payment_method: paymentMethod,
      payment_status: bookingPaymentStatus,
      status: bookingStatus,
      payment_completed_at: paidAmount > 0 ? new Date() : null,

      stripe_payment_intent_id:
        paymentMethod === "stripe" ? transactionReference || null : null,

      paypal_order_id:
        paymentMethod === "paypal" ? transactionReference || null : null,

      paypal_capture_id:
        paymentMethod === "paypal" ? transactionReference || null : null,

      manual_payment_reference: transactionReference || null,

      details: {
        location_name: location.name,
        pricing: {
          price_rule_id:
            body.price_rule_id && mongoose.Types.ObjectId.isValid(body.price_rule_id)
              ? body.price_rule_id
              : null,
          calculated_days: calculatedStorageDays,
        },
        storage: {
          storage_type_id: storageType._id,
          storage_type_name: storageType.name,
          storage_type: storageType.name,
        },
      },

      updated_by: adminUser._id,
    });

    // Storage capacity is date-based and was validated before creation.
    // Do not increment the legacy Location.booked_count value here because
    // non-overlapping future bookings must not consume a permanent slot.
    const updatedLocation = location;

    const { payment, paymentCreateError } = await createAdminManualPaymentRecord({
      booking,
      customerUser,
      adminUser,
      paidAmount,
      finalPrice,
      holdingDepositAmount,
      dueAmount,
      paymentMethod,
      paymentType,
      paymentFlow,
      depositType,
      transactionReference,
    });

    const populatedBooking = await findAdminBookingByIdentifier(
      booking.booking_id
    );

    const shouldSendConfirmation =
      body.send_confirmation_email === true ||
      body.send_confirmation_email === "true" ||
      body.resend_confirmation_email === true ||
      body.resend_confirmation_email === "true";

    let emailResult = null;

    if (shouldSendConfirmation) {
      emailResult = await sendBookingConfirmationEmailSafely({
        booking: populatedBooking,
        resend: false,
        sendCustomerEmail: true,
        sendAdminEmail: true,
      });
    }

    let message = "Storage booking created successfully.";

    if (shouldSendConfirmation && emailResult?.sentCustomerEmail) {
      message = "Storage booking created successfully. Confirmation email sent.";
    }

    if (shouldSendConfirmation && !emailResult?.sentCustomerEmail) {
      message =
        "Storage booking created successfully, but confirmation email failed to send.";
    }

    if (paymentCreateError) {
      console.error("Payment transaction record was not created:", {
        booking_id: booking.booking_id,
        paymentCreateError,
      });

      message = "Storage booking created successfully.";
    }

    return Response.json(
      {
        success: true,
        message,
        data: {
          booking: populatedBooking,
          payment,
          location: updatedLocation,
          payment_record_error: paymentCreateError,
          email_result: emailResult,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin storage booking create error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create storage booking",
        error: error.message || "Failed to create storage booking",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}


export async function createAdminAirportBooking(req) {
  try {
    const adminUser = await requireAdminUser(req);
    const body = await req.json();

    const locationId = String(body.location_id || "").trim();

    if (!locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
      throw new Error("Airport parking location is required");
    }

    const location = await validateAndGetLocation(locationId, "airport");

    const startDate = parseAdminBookingDate(body.start_date, "Entry date");
    const endDate = parseAdminBookingDate(body.end_date, "Exit date");

    validateBookingDateRange(startDate, endDate, "airport");

    const entryBlocked = getAdminBlockedDateConflict(location, body.start_date);

    if (entryBlocked) {
      throw new Error(`Entry date is blocked by admin. ${entryBlocked}`);
    }

    const exitBlocked = getAdminBlockedDateConflict(location, body.end_date);

    if (exitBlocked) {
      throw new Error(`Exit date is blocked by admin. ${exitBlocked}`);
    }

    const calculatedBookableDays = countAdminAirportBookableDays(
      location,
      body.start_date,
      body.end_date
    );

    if (calculatedBookableDays < 1) {
      throw new Error(
        "Selected date range does not include any available booking days"
      );
    }

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const email = String(body.email || "").toLowerCase().trim();
    const phone = String(body.phone || "").trim();

    const customerUser = await findOrCreateAdminBookingCustomer({
      firstName,
      lastName,
      email,
      phone,
    });

    const customerName = `${firstName} ${lastName}`.trim();

    const licensePlate = String(body.license_plate || "").trim();

    if (!licensePlate) {
      throw new Error("License plate is required");
    }

    const hasShuttle = Boolean(
      location.show_shuttle_options &&
        String(body.shuttle_time || "").trim() &&
        String(body.shuttle_slot_id || "").trim()
    );

    const passengerCount = hasShuttle ? Number(body.pax || 0) : 0;

    if (location.show_shuttle_options) {
      if (!hasShuttle) {
        throw new Error("Please load and select an available shuttle slot");
      }

      if (!Number.isFinite(passengerCount) || passengerCount < 1) {
        throw new Error("Passengers must be at least 1 for shuttle");
      }
    }

    const shuttleSlotId = String(body.shuttle_slot_id || "").trim();
    const shuttleTime = String(body.shuttle_time || "").trim();

    const finalPrice = moneyNumber(body.price || body.original_price || 0);

    if (finalPrice <= 0) {
      throw new Error("Booking price must be greater than 0");
    }

    const originalPrice = moneyNumber(body.original_price || finalPrice);

    const paymentType = String(body.payment_type || "").trim();
    const paymentMethod = String(body.payment_method || "").trim();

    if (!["online", "poa"].includes(paymentType)) {
      throw new Error("Please select payment type");
    }

    if (!["stripe", "paypal", "credit_card_manual"].includes(paymentMethod)) {
      throw new Error("Please select a valid payment method");
    }

    const transactionReference = getAdminManualPaymentReference(body);

    const isOnlinePayment = paymentType === "online";
    const isPayOnArrival = paymentType === "poa";

    const settings = await getGlobalSettingsDocument();
    const configuredHoldingDepositAmount =
      getConfiguredHoldingDepositAmount(settings);

    const holdingDepositAmount = isPayOnArrival
      ? Math.min(configuredHoldingDepositAmount, finalPrice)
      : 0;

    const bookingStatus = isOnlinePayment ? "success" : "poa";
    const bookingPaymentStatus = isOnlinePayment ? "paid" : "partial";
    const paymentFlow = isOnlinePayment ? "full_online" : "poa_deposit";
    const depositType = isOnlinePayment ? "full" : "poa";
    const paidAmount = isOnlinePayment ? finalPrice : holdingDepositAmount;
    const dueAmount = Math.max(finalPrice - paidAmount, 0);

    const bookingId = await generateAdminBookingId("AP");

    const booking = await Booking.create({
      booking_id: bookingId,
      user_id: customerUser._id,
      location_id: location._id,

      type: "airport",
      start_date: startDate,
      end_date: endDate,

      pax: passengerCount,
      license_plate: licensePlate,
      reference: transactionReference || "",
      interlock: Boolean(body.interlock),

      notes: String(body.notes || "").trim(),
      source: body.source || "admin",

      customer: {
        name: customerName,
        email,
        phone,
      },

      pricing_type: "fixed",
      currency: "aud",
      original_price: originalPrice,
      price: finalPrice,
      discount_amount: 0,

      paid_amount: paidAmount,
      due_amount: dueAmount,
      holding_deposit_amount: holdingDepositAmount,
      balance_due_on_arrival: dueAmount,

      payment_flow: paymentFlow,
      deposit_type: depositType,
      payment_method: paymentMethod,
      payment_status: bookingPaymentStatus,
      status: bookingStatus,
      payment_completed_at: paidAmount > 0 ? new Date() : null,

      shuttle_time: hasShuttle ? shuttleTime : "",
      shuttle_slot_id:
        hasShuttle && mongoose.Types.ObjectId.isValid(shuttleSlotId)
          ? shuttleSlotId
          : null,

      stripe_payment_intent_id:
        paymentMethod === "stripe" ? transactionReference || null : null,

      paypal_order_id:
        paymentMethod === "paypal" ? transactionReference || null : null,

      paypal_capture_id:
        paymentMethod === "paypal" ? transactionReference || null : null,

      manual_payment_reference: transactionReference || null,

      details: {
        location_name: location.name,
        pricing: {
          price_rule_id:
            body.price_rule_id && mongoose.Types.ObjectId.isValid(body.price_rule_id)
              ? body.price_rule_id
              : null,
          calculated_days: calculatedBookableDays,
        },
        airport: {
          shuttle_time: hasShuttle ? shuttleTime : "",
          shuttle_slot_id:
            hasShuttle && mongoose.Types.ObjectId.isValid(shuttleSlotId)
              ? shuttleSlotId
              : null,
          pickup_pax: hasShuttle ? passengerCount : 0,
        },
      },

      updated_by: adminUser._id,
    });

    let updatedLocation = null;
    let updatedShuttleSlot = null;

    try {
      updatedLocation = await incrementAdminLocationBookedCount({
        locationId: location._id,
        count: 1,
      });

      if (hasShuttle) {
        updatedShuttleSlot = await incrementSettingShuttleSlotBookedCount({
          type: "airport",
          slotId: shuttleSlotId,
          slotTime: shuttleTime,
          passengerCount,
        });
      }
    } catch (capacityError) {
      await decrementAdminLocationBookedCount({
        locationId: location._id,
        count: 1,
      });

      await Booking.deleteOne({ _id: booking._id });

      throw capacityError;
    }

    const { payment, paymentCreateError } = await createAdminManualPaymentRecord({
      booking,
      customerUser,
      adminUser,
      paidAmount,
      finalPrice,
      holdingDepositAmount,
      dueAmount,
      paymentMethod,
      paymentType,
      paymentFlow,
      depositType,
      transactionReference,
    });

    const populatedBooking = await findAdminBookingByIdentifier(
      booking.booking_id
    );

    const shouldSendConfirmation =
      body.send_confirmation_email === true ||
      body.send_confirmation_email === "true" ||
      body.resend_confirmation_email === true ||
      body.resend_confirmation_email === "true";

    let emailResult = null;

    if (shouldSendConfirmation) {
      emailResult = await sendBookingConfirmationEmailSafely({
        booking: populatedBooking,
        resend: false,
        sendCustomerEmail: true,
        sendAdminEmail: true,
      });
    }

    let message = "Airport booking created successfully.";

    if (shouldSendConfirmation && emailResult?.sentCustomerEmail) {
      message = "Airport booking created successfully. Confirmation email sent.";
    }

    if (shouldSendConfirmation && !emailResult?.sentCustomerEmail) {
      message =
        "Airport booking created successfully, but confirmation email failed to send.";
    }

    if (paymentCreateError) {
      console.error("Payment transaction record was not created:", {
        booking_id: booking.booking_id,
        paymentCreateError,
      });

      message = "Airport booking created successfully.";
    }

    return Response.json(
      {
        success: true,
        message,
        data: {
          booking: populatedBooking,
          payment,
          location: updatedLocation,
          shuttle_slot: updatedShuttleSlot,
          payment_record_error: paymentCreateError,
          email_result: emailResult,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin airport booking create error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create airport booking",
        error: error.message || "Failed to create airport booking",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function getAdminBookingById(req, bookingId) {
  try {
    await requireAdminUser(req);

    const booking = await findAdminBookingByIdentifier(bookingId);

    return Response.json(
      {
        success: true,
        message: "Booking loaded successfully",
        data: booking,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin booking detail error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load booking",
        error: error.message || "Failed to load booking",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function updateAdminBooking(req, bookingId) {
  try {
    await requireAdminUser(req);

    const body = await req.json();

    const newAdminNoteForEmail = String(body.new_admin_note || "").trim();

    const booking = await Booking.findOne(
      buildBookingIdentifierFilter(bookingId)
    );

    if (!booking) {
      throw new Error("Booking not found");
    }

    await applyAdminBookingEdits(booking, body);

    await booking.save();

    await updateLinkedCustomerUser(booking, {
      email:
        body.email !== undefined
          ? String(body.email || "").toLowerCase().trim()
          : undefined,
      phone:
        body.phone !== undefined ? String(body.phone || "").trim() : undefined,
    });

    const shouldResendConfirmation =
      body.resend_confirmation === true ||
      body.resend_confirmation === "true" ||
      body.resend_confirmation_email === true ||
      body.resend_confirmation_email === "true";

    let emailResult = null;

    if (shouldResendConfirmation) {
      const emailBookingDoc = await findAdminBookingByIdentifier(
        booking.booking_id || booking._id
      );

      const emailBooking =
        typeof emailBookingDoc.toObject === "function"
          ? emailBookingDoc.toObject({ virtuals: true })
          : emailBookingDoc;

      emailResult = await sendBookingConfirmationEmailSafely({
        booking: {
          ...emailBooking,
          new_admin_note:
            newAdminNoteForEmail || emailBooking.new_admin_note || "",
        },
        resend: true,
        sendCustomerEmail: true,
        sendAdminEmail: true,
      });
    }

    const updatedBooking = await findAdminBookingByIdentifier(
      booking.booking_id || booking._id
    );

    return Response.json(
      {
        success: true,
        message: shouldResendConfirmation
          ? emailResult?.sentCustomerEmail
            ? "Booking updated successfully. Confirmation email resent."
            : "Booking updated successfully, but confirmation email failed to send."
          : "Booking updated successfully",
        data: updatedBooking,
        email_result: emailResult,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin booking update error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update booking",
        error: error.message || "Failed to update booking",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function deleteAdminBooking(req, bookingId) {
  try {
    await requireAdminUser(req);

    const booking = await Booking.findOne(
      buildBookingIdentifierFilter(bookingId)
    );

    if (!booking) {
      throw new Error("Booking not found");
    }

    const deletableStatuses = [
      "cancelled",
      "refund",
      "refunded",
      "credit",
      "credited",
    ];

    if (!deletableStatuses.includes(booking.status)) {
      throw new Error(
        "Only cancelled, refunded, or credited bookings can be deleted."
      );
    }

    await Booking.deleteOne({ _id: booking._id });

    return Response.json(
      {
        success: true,
        message: "Booking deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin booking delete error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete booking",
        error: error.message || "Failed to delete booking",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function resendAdminBookingEmail(req, bookingId) {
  try {
    await requireAdminUser(req);

    const booking = await findAdminBookingByIdentifier(bookingId);
    const bookingForEmail = normalizeBookingForEmail(booking);
    const customerEmail = bookingForEmail?.customer?.email;

    if (!customerEmail) {
      throw new Error("Customer email not found for this booking");
    }

    const emailResult = await sendBookingConfirmationEmailSafely({
      booking: bookingForEmail,
      resend: true,
      sendCustomerEmail: true,
      sendAdminEmail: true,
    });

    if (!emailResult?.sentCustomerEmail) {
      throw new Error(
        emailResult?.error?.message ||
          "Booking confirmation email could not be sent"
      );
    }

    return Response.json(
      {
        success: true,
        message: `Booking confirmation email resent to ${customerEmail}`,
        email_result: emailResult,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin resend booking email error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to resend booking email",
        error: error.message || "Failed to resend booking email",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}


function pickEnumValue(model, path, preferredValue, fallbackValue) {
  const enumValues = model.schema.path(path)?.enumValues || [];

  if (enumValues.length === 0) {
    return preferredValue;
  }

  if (enumValues.includes(preferredValue)) {
    return preferredValue;
  }

  if (fallbackValue && enumValues.includes(fallbackValue)) {
    return fallbackValue;
  }

  return preferredValue;
}

function appendAdminNote(existingNote, newNote) {
  const current = existingNote ? String(existingNote).trim() : "";
  const timestamp = new Date().toISOString();
  const adminNote = `[${timestamp}] ${newNote}`;

  if (!current) {
    return adminNote;
  }

  return `${current}\n${adminNote}`;
}

function isPoaDepositBooking(booking) {
  return (
    booking?.payment_flow === "poa_deposit" ||
    booking?.deposit_type === "poa" ||
    booking?.status === "poa"
  );
}

async function getOptionalJsonBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function getAdminActionFeeAmount({
  booking,
  paidAmount,
  feeMode,
  adminActionFee = DEFAULT_ADMIN_ACTION_FEE,
}) {
  const amount = moneyNumber(paidAmount);
  const configuredFee = moneyNumber(adminActionFee);

  if (amount <= 0 || configuredFee <= 0) {
    return 0;
  }

  if (isPoaDepositBooking(booking)) {
    return Math.min(configuredFee, amount);
  }

  if (feeMode === "full") {
    return 0;
  }

  return Math.min(configuredFee, amount);
}

function getAdminActionReturnAmount({ paidAmount, feeAmount }) {
  return moneyNumber(
    Math.max(Number(paidAmount || 0) - Number(feeAmount || 0), 0)
  );
}

async function getCustomerUserForBookingAction(booking) {
  const bookingUserId =
    typeof booking.user_id === "object" ? booking.user_id._id : booking.user_id;

  let user = null;

  if (bookingUserId) {
    user = await ParkingUser.findById(bookingUserId);
  }

  if (!user && booking.customer?.email) {
    user = await ParkingUser.findOne({
      email: String(booking.customer.email).toLowerCase().trim(),
    });
  }

  if (!user) {
    throw new Error("Customer account was not found for this booking");
  }

  return user;
}

async function getCustomerUserForBookingCredit(booking) {
  const user = await getCustomerUserForBookingAction(booking);

  if (user.role !== "customer") {
    throw new Error("Wallet credit can only be applied to customer accounts");
  }

  if (!user.is_active) {
    throw new Error("Customer account is inactive");
  }

  if (user.wallet_status === "disabled") {
    throw new Error("Customer wallet is disabled");
  }

  return user;
}

async function findLatestPaidPaymentForBooking(booking) {
  return Payment.findOne({
    booking_id: booking._id,
    method: {
      $in: ["stripe", "paypal", "wallet", "credit_card_manual"],
    },
    status: {
      $in: [
        "paid",
        "success",
        "completed",
        "succeeded",
        "partial",
        "partially_refunded",
        "refunded",
      ],
    },
  }).sort({
    paid_at: -1,
    createdAt: -1,
  });
}

function getPaidAmountForAdminAction({ booking, originalPayment }) {
  const bookingPaidAmount = Number(booking?.paid_amount || 0);

  if (Number.isFinite(bookingPaidAmount) && bookingPaidAmount > 0) {
    return moneyNumber(bookingPaidAmount);
  }

  const paymentAmount = Number(originalPayment?.amount || 0);

  if (Number.isFinite(paymentAmount) && paymentAmount > 0) {
    return moneyNumber(paymentAmount);
  }

  const bookingTotal = Number(booking?.price || 0);

  const looksPaid =
    ["paid", "partial", "partially_refunded"].includes(
      String(booking?.payment_status || "")
    ) ||
    ["success", "confirmed"].includes(String(booking?.status || ""));

  if (
    Number.isFinite(bookingTotal) &&
    bookingTotal > 0 &&
    looksPaid &&
    booking?.payment_method === "wallet"
  ) {
    return moneyNumber(bookingTotal);
  }

  return 0;
}

function getReturnMethodForAdminAction({ booking, originalPayment }) {
  if (booking?.payment_method === "wallet") {
    return "wallet";
  }

  if (originalPayment?.method === "wallet") {
    return "wallet";
  }

  return originalPayment?.method || booking?.payment_method || "wallet";
}

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function refundStripePayment({ booking, payment, refundAmount, feeAmount = 0 }) {
  if (refundAmount <= 0) return null;

  const paymentIntentId =
    payment?.provider_payment_id ||
    payment?.transaction_id ||
    booking?.stripe_payment_intent_id;

  if (!paymentIntentId) {
    throw new Error("Stripe payment reference was not found for refund");
  }

  const stripe = getStripeClient();

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: Math.round(refundAmount * 100),
    metadata: {
      booking_id: booking.booking_id,
      booking_object_id: String(booking._id),
      admin_action: "admin_booking_return",
      cancellation_fee: String(moneyNumber(feeAmount)),
    },
  });

  return {
    provider_refund_id: refund.id,
    provider_payload: refund,
  };
}

function getPayPalApiBaseUrl() {
  return (
    process.env.PAYPAL_API_URL ||
    process.env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com"
  ).replace(/\/$/, "");
}

async function getPayPalAccessTokenForAdminRefund() {
  const clientId =
    process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY;

  if (!clientId) {
    throw new Error(
      "PAYPAL_CLIENT_ID or NEXT_PUBLIC_PAYPAL_CLIENT_ID is not configured"
    );
  }

  if (!secret) {
    throw new Error("PAYPAL_SECRET_KEY is not configured");
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const response = await fetch(`${getPayPalApiBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error_description ||
        data?.message ||
        data?.name ||
        "Failed to get PayPal access token"
    );
  }

  if (!data?.access_token) {
    throw new Error("PayPal access token was not returned");
  }

  return data.access_token;
}

async function createPayPalCaptureRefund({
  captureId,
  refundAmount,
  booking,
  feeAmount = 0,
}) {
  const accessToken = await getPayPalAccessTokenForAdminRefund();

  const payload = {
    amount: {
      value: Number(refundAmount).toFixed(2),
      currency_code: String(booking.currency || "aud").toUpperCase(),
    },
    note_to_payer: `Booking ${
      booking.booking_id
    } processed by admin. AUD ${moneyNumber(feeAmount).toFixed(
      2
    )} fee may apply.`,
  };

  const response = await fetch(
    `${getPayPalApiBaseUrl()}/v2/payments/captures/${captureId}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("PayPal refund failed:", data);

    const message =
      data?.details?.[0]?.description ||
      data?.details?.[0]?.issue ||
      data?.message ||
      data?.name ||
      "PayPal refund failed";

    throw new Error(message);
  }

  return data;
}

async function refundPayPalPayment({ booking, payment, refundAmount, feeAmount = 0 }) {
  if (refundAmount <= 0) return null;

  const captureId =
    payment?.provider_capture_id ||
    booking?.paypal_capture_id ||
    payment?.transaction_id;

  if (!captureId) {
    throw new Error("PayPal capture reference was not found for refund");
  }

  const refund = await createPayPalCaptureRefund({
    captureId,
    refundAmount,
    booking,
    feeAmount,
  });

  return {
    provider_refund_id: refund?.id,
    provider_payload: refund,
  };
}

async function creditWalletForAdminReturn({
  booking,
  customerUser,
  returnAmount,
  refundPayment,
  adminUser,
  note,
  adminAction,
}) {
  if (returnAmount <= 0) return null;

  if (customerUser.wallet_status === "disabled") {
    throw new Error("Customer wallet is disabled");
  }

  const balanceBefore = moneyNumber(customerUser.wallet_balance || 0);
  const balanceAfter = moneyNumber(balanceBefore + returnAmount);

  customerUser.wallet_balance = balanceAfter;
  customerUser.wallet_currency = customerUser.wallet_currency || "aud";
  customerUser.wallet_updated_at = new Date();

  await customerUser.save();

  const walletTransaction = await WalletTransaction.create({
    user_id: customerUser._id,
    booking_id: booking._id,
    payment_id: refundPayment._id,
    type: "refund_credit",
    direction: "credit",
    amount: returnAmount,
    currency: booking.currency || "aud",
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    status: "completed",
    method: "admin",
    note,
    processed_by: adminUser._id,
    metadata: {
      admin_action: adminAction,
      booking_id: booking.booking_id,
      return_amount: returnAmount,
      fee_amount: Number(refundPayment.fee_amount || 0),
    },
  });

  refundPayment.wallet_transaction_id = walletTransaction._id;
  refundPayment.transaction_id = walletTransaction.transaction_reference;
  await refundPayment.save();

  return walletTransaction;
}

function getBookingPaymentStatusAfterReturn({ paidAmount, returnAmount }) {
  const paid = moneyNumber(paidAmount);
  const returned = moneyNumber(returnAmount);

  if (paid <= 0) {
    return pickEnumValue(Booking, "payment_status", "unpaid", "pending");
  }

  if (returned >= paid) {
    return pickEnumValue(Booking, "payment_status", "refunded", "refunded");
  }

  return pickEnumValue(
    Booking,
    "payment_status",
    "partially_refunded",
    "refunded"
  );
}

async function processOriginalPaymentReturn({
  booking,
  customerUser,
  originalPayment,
  returnAmount,
  feeAmount,
  adminUser,
  adminAction,
}) {
  let returnMethod = getReturnMethodForAdminAction({
    booking,
    originalPayment,
  });

  if (
    returnAmount > 0 &&
    !["stripe", "paypal", "wallet"].includes(returnMethod)
  ) {
    returnMethod = "wallet";
  }

  const refundPaymentMethod = ["stripe", "paypal", "wallet", "poa"].includes(
    returnMethod
  )
    ? returnMethod
    : "wallet";

  const refundPaymentFlow =
    returnMethod === "wallet"
      ? "wallet"
      : booking.payment_flow ||
        originalPayment?.payment_flow ||
        (returnMethod === "poa" ? "legacy_poa" : "full_online");

  let providerRefund = null;
  let walletTransaction = null;

  if (returnAmount > 0 && returnMethod === "stripe") {
    providerRefund = await refundStripePayment({
      booking,
      payment: originalPayment,
      refundAmount: returnAmount,
      feeAmount,
    });
  }

  if (returnAmount > 0 && returnMethod === "paypal") {
    providerRefund = await refundPayPalPayment({
      booking,
      payment: originalPayment,
      refundAmount: returnAmount,
      feeAmount,
    });
  }

  const refundPayment = await Payment.create({
    booking_id: booking._id,
    user_id: customerUser._id,
    amount: returnAmount,
    currency: booking.currency || "aud",
    method: refundPaymentMethod,
    payment_flow: refundPaymentFlow,
    deposit_type:
      booking.deposit_type || originalPayment?.deposit_type || undefined,
    payment_purpose: "refund",
    status: returnAmount > 0 ? "refunded" : "cancelled",
    transaction_id: providerRefund?.provider_refund_id || undefined,
    provider_refund_id: providerRefund?.provider_refund_id || undefined,
    provider_payload: providerRefund?.provider_payload || null,
    booking_total_amount: moneyNumber(booking.price || 0),
    holding_deposit_amount: moneyNumber(booking.holding_deposit_amount || 0),
    balance_due_on_arrival: moneyNumber(booking.balance_due_on_arrival || 0),
    fee_amount: feeAmount,
    refund_amount: returnAmount,
    metadata: {
      admin_action: adminAction,
      original_payment_method: booking.payment_method,
      original_payment_status: booking.payment_status,
      original_booking_status: booking.status,
      original_payment_id: originalPayment?._id
        ? String(originalPayment._id)
        : null,
      admin_user_id: String(adminUser._id),
      return_method: returnMethod,
    },
  });

  if (returnAmount > 0 && returnMethod === "wallet") {
    walletTransaction = await creditWalletForAdminReturn({
      booking,
      customerUser,
      returnAmount,
      refundPayment,
      adminUser,
      adminAction,
      note: `Booking ${booking.booking_id} returned to wallet by admin. AUD ${feeAmount.toFixed(
        2
      )} fee deducted.`,
    });
  }

  if (originalPayment) {
    const originalPaidAmount = moneyNumber(originalPayment.amount || 0);

    originalPayment.status =
      returnAmount > 0
        ? getBookingPaymentStatusAfterReturn({
            paidAmount: originalPaidAmount,
            returnAmount,
          })
        : pickEnumValue(Payment, "status", "cancelled", "cancelled");

    originalPayment.fee_amount = feeAmount;
    originalPayment.refund_amount = returnAmount;
    originalPayment.refunded_at = new Date();

    if (providerRefund?.provider_refund_id) {
      originalPayment.provider_refund_id = providerRefund.provider_refund_id;
    }

    originalPayment.metadata = {
      ...(originalPayment.metadata || {}),
      [adminAction]: {
        processed_at: new Date(),
        processed_by: String(adminUser._id),
        refund_payment_id: String(refundPayment._id),
        return_amount: returnAmount,
        fee_amount: feeAmount,
        return_method: returnMethod,
      },
    };

    await originalPayment.save();
  }

  return {
    refundPayment,
    providerRefund,
    walletTransaction,
    returnMethod,
  };
}

async function finalizeBookingAsCancelled({
  booking,
  paidAmount,
  returnAmount,
  feeAmount,
  returnMethod,
  adminActionLabel,
  adminActionType = "cancel",
  adminUser = null,
}) {
  const finalBookingStatus = pickEnumValue(
    Booking,
    "status",
    "cancelled",
    "cancelled"
  );

  const finalPaymentStatus = getBookingPaymentStatusAfterReturn({
    paidAmount,
    returnAmount,
  });

  const actionNote = `Admin ${adminActionLabel}. Paid amount: ${paidAmount.toFixed(
    2
  )} AUD. Fee: ${feeAmount.toFixed(2)} AUD. Returned amount: ${returnAmount.toFixed(
    2
  )} AUD. Return method: ${returnMethod}.`;

  const updateData = {
    status: finalBookingStatus,
    payment_status: finalPaymentStatus,

    due_amount: 0,
    balance_due_on_arrival: 0,
    fee_deducted: feeAmount,

    admin_action_type: adminActionType,
    admin_action_label: adminActionLabel,
    admin_action_return_method: returnMethod,
    admin_action_paid_amount: paidAmount,
    admin_action_fee_amount: feeAmount,
    admin_action_return_amount: returnAmount,
    admin_action_at: new Date(),
    admin_action_by: adminUser?._id || null,

    cancelled_at: new Date(),
    updated_by: adminUser?._id || booking.updated_by || null,

    notes: appendAdminNote(booking.notes, actionNote),

    "cancellation_request.admin_reviewed": true,
    "cancellation_request.admin_reviewed_at": new Date(),
    "cancellation_request.admin_reviewed_by": adminUser?._id || null,
    "cancellation_request.admin_note": actionNote,
  };

  if (adminActionType === "refund") {
    updateData.refund_amount = returnAmount;
    updateData.credit_amount = 0;
  }

  if (adminActionType === "credit") {
    updateData.credit_amount = returnAmount;
    updateData.refund_amount = 0;
  }

  if (adminActionType === "cancel") {
    updateData.refund_amount = returnAmount;
    updateData.credit_amount = 0;
  }

  const updatedBooking = await Booking.findOneAndUpdate(
    { _id: booking._id },
    {
      $set: updateData,
      $push: {
        status_history: {
          status: finalBookingStatus,
          note: actionNote,
          changed_by: adminUser?._id || null,
          date: new Date(),
        },
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedBooking) {
    throw new Error("Booking status update failed after admin action");
  }

  const populatedBooking = await findAdminBookingByIdentifier(
    updatedBooking.booking_id || updatedBooking._id
  );

  if (populatedBooking.status !== finalBookingStatus) {
    throw new Error(
      `Booking status update failed. Expected ${finalBookingStatus}, got ${populatedBooking.status}`
    );
  }

  return populatedBooking;
}

export async function creditAdminBooking(req, bookingId) {
  try {
    const adminUser = await requireAdminUser(req);
    const body = await getOptionalJsonBody(req);

    const booking = await Booking.findOne(
      buildBookingIdentifierFilter(bookingId)
    );

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "cancelled") {
      throw new Error("This booking is already cancelled");
    }

    if (["credit", "credited", "refund", "refunded"].includes(booking.status)) {
      throw new Error("This booking has already been processed");
    }

    const originalPayment = await findLatestPaidPaymentForBooking(booking);

    const paidAmount = getPaidAmountForAdminAction({
      booking,
      originalPayment,
    });

    if (paidAmount <= 0) {
      throw new Error("This booking has no paid amount to credit");
    }

    const settings = await getGlobalSettingsDocument();
    const configuredAdminActionFee = getConfiguredAdminActionFee(settings);

    const feeAmount = getAdminActionFeeAmount({
      booking,
      paidAmount,
      feeMode: body.fee_mode,
      adminActionFee: configuredAdminActionFee,
    });

    const creditAmount = getAdminActionReturnAmount({
      paidAmount,
      feeAmount,
    });

    const customerUser = await getCustomerUserForBookingCredit(booking);

    const existingCredit = await WalletTransaction.findOne({
      booking_id: booking._id,
      type: "refund_credit",
      status: "completed",
    });

    if (existingCredit) {
      throw new Error("A wallet credit already exists for this booking");
    }

    const refundPayment = await Payment.create({
      booking_id: booking._id,
      user_id: customerUser._id,
      amount: creditAmount,
      currency: booking.currency || "aud",
      method: "wallet",
      payment_flow: "wallet",
      deposit_type: booking.deposit_type || undefined,
      payment_purpose: "refund",
      status: creditAmount > 0 ? "refunded" : "cancelled",
      booking_total_amount: moneyNumber(booking.price || 0),
      holding_deposit_amount: moneyNumber(booking.holding_deposit_amount || 0),
      balance_due_on_arrival: moneyNumber(booking.balance_due_on_arrival || 0),
      fee_amount: feeAmount,
      refund_amount: creditAmount,
      metadata: {
        admin_action: "credit_to_wallet",
        original_payment_method: booking.payment_method,
        original_payment_status: booking.payment_status,
        original_booking_status: booking.status,
        original_payment_id: originalPayment?._id
          ? String(originalPayment._id)
          : null,
        admin_user_id: String(adminUser._id),
        fee_mode: body.fee_mode || `deduct_${configuredAdminActionFee}`,
        poa_forced_fee: isPoaDepositBooking(booking),
      },
    });

    const walletTransaction = await creditWalletForAdminReturn({
      booking,
      customerUser,
      returnAmount: creditAmount,
      refundPayment,
      adminUser,
      adminAction: "credit_to_wallet",
      note: `Booking ${booking.booking_id} credited to wallet. AUD ${feeAmount.toFixed(
        2
      )} fee deducted.`,
    });

    const updatedBooking = await finalizeBookingAsCancelled({
      booking,
      paidAmount,
      returnAmount: creditAmount,
      feeAmount,
      returnMethod: "wallet",
      adminActionLabel: "credited booking to wallet",
      adminActionType: "credit",
      adminUser,
    });

    const emailResult = await sendAdminActionEmailSafely({
      booking: updatedBooking,
      actionType: "credit",
      paidAmount,
      feeAmount,
      returnAmount: creditAmount,
      returnMethod: "wallet",
      adminUser,
    });

    return Response.json(
      {
        success: true,
        message: emailResult?.sentCustomerEmail
          ? `Booking credited and cancelled successfully. AUD ${creditAmount.toFixed(
              2
            )} added to customer wallet. Fee: AUD ${feeAmount.toFixed(2)}.`
          : `Booking credited and cancelled successfully. AUD ${creditAmount.toFixed(
              2
            )} added to customer wallet. Fee: AUD ${feeAmount.toFixed(
              2
            )}. Email failed to send.`,
        data: {
          booking: updatedBooking,
          payment: refundPayment,
          wallet_transaction: walletTransaction,
          paid_amount: paidAmount,
          return_amount: creditAmount,
          credit_amount: creditAmount,
          fee_amount: feeAmount,
          booking_status: updatedBooking.status,
          payment_status: updatedBooking.payment_status,
          admin_action_type: updatedBooking.admin_action_type,
          email_result: emailResult,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin booking credit error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to credit booking",
        error: error.message || "Failed to credit booking",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function cancelAdminBooking(req, bookingId) {
  try {
    const adminUser = await requireAdminUser(req);
    const body = await getOptionalJsonBody(req);

    const booking = await Booking.findOne(
      buildBookingIdentifierFilter(bookingId)
    );

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "cancelled") {
      throw new Error("This booking is already cancelled");
    }

    if (["credit", "credited", "refund", "refunded"].includes(booking.status)) {
      throw new Error("This booking has already been processed");
    }

    const customerUser = await getCustomerUserForBookingAction(booking);
    const originalPayment = await findLatestPaidPaymentForBooking(booking);

    const paidAmount = getPaidAmountForAdminAction({
      booking,
      originalPayment,
    });

    const settings = await getGlobalSettingsDocument();
    const configuredAdminActionFee = getConfiguredAdminActionFee(settings);

    const feeAmount = getAdminActionFeeAmount({
      booking,
      paidAmount,
      feeMode: body.fee_mode,
      adminActionFee: configuredAdminActionFee,
    });

    const returnAmount = getAdminActionReturnAmount({
      paidAmount,
      feeAmount,
    });

    const {
      refundPayment,
      providerRefund,
      walletTransaction,
      returnMethod,
    } = await processOriginalPaymentReturn({
      booking,
      customerUser,
      originalPayment,
      returnAmount,
      feeAmount,
      adminUser,
      adminAction: "booking_cancellation",
    });

    const updatedBooking = await finalizeBookingAsCancelled({
      booking,
      paidAmount,
      returnAmount,
      feeAmount,
      returnMethod,
      adminActionLabel: "cancelled booking",
      adminActionType: "cancel",
      adminUser,
    });

    const emailResult = await sendAdminActionEmailSafely({
      booking: updatedBooking,
      actionType: "cancel",
      paidAmount,
      feeAmount,
      returnAmount,
      returnMethod,
      adminUser,
    });

    return Response.json(
      {
        success: true,
        message: emailResult?.sentCustomerEmail
          ? `Booking cancelled successfully. Returned amount: AUD ${returnAmount.toFixed(
              2
            )}. Fee: AUD ${feeAmount.toFixed(2)}.`
          : `Booking cancelled successfully. Returned amount: AUD ${returnAmount.toFixed(
              2
            )}. Fee: AUD ${feeAmount.toFixed(2)}. Email failed to send.`,
        data: {
          booking: updatedBooking,
          refund_payment: refundPayment,
          wallet_transaction: walletTransaction,
          provider_refund: providerRefund,
          paid_amount: paidAmount,
          return_amount: returnAmount,
          fee_amount: feeAmount,
          booking_status: updatedBooking.status,
          payment_status: updatedBooking.payment_status,
          admin_action_type: updatedBooking.admin_action_type,
          email_result: emailResult,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin booking cancel error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to cancel booking",
        error: error.message || "Failed to cancel booking",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function refundAdminBooking(req, bookingId) {
  try {
    const adminUser = await requireAdminUser(req);
    const body = await getOptionalJsonBody(req);

    const booking = await Booking.findOne(
      buildBookingIdentifierFilter(bookingId)
    );

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "cancelled") {
      throw new Error("This booking is already cancelled");
    }

    if (["credit", "credited", "refund", "refunded"].includes(booking.status)) {
      throw new Error("This booking has already been processed");
    }

    const customerUser = await getCustomerUserForBookingAction(booking);
    const originalPayment = await findLatestPaidPaymentForBooking(booking);

    const paidAmount = getPaidAmountForAdminAction({
      booking,
      originalPayment,
    });

    if (paidAmount <= 0) {
      throw new Error("This booking has no paid amount to refund");
    }

    const settings = await getGlobalSettingsDocument();
    const configuredAdminActionFee = getConfiguredAdminActionFee(settings);

    const feeAmount = getAdminActionFeeAmount({
      booking,
      paidAmount,
      feeMode: body.fee_mode,
      adminActionFee: configuredAdminActionFee,
    });

    const returnAmount = getAdminActionReturnAmount({
      paidAmount,
      feeAmount,
    });

    const {
      refundPayment,
      providerRefund,
      walletTransaction,
      returnMethod,
    } = await processOriginalPaymentReturn({
      booking,
      customerUser,
      originalPayment,
      returnAmount,
      feeAmount,
      adminUser,
      adminAction: "booking_refund",
    });

    const updatedBooking = await finalizeBookingAsCancelled({
      booking,
      paidAmount,
      returnAmount,
      feeAmount,
      returnMethod,
      adminActionLabel: "refunded booking",
      adminActionType: "refund",
      adminUser,
    });

    const emailResult = await sendAdminActionEmailSafely({
      booking: updatedBooking,
      actionType: "refund",
      paidAmount,
      feeAmount,
      returnAmount,
      returnMethod,
      adminUser,
    });

    return Response.json(
      {
        success: true,
        message: emailResult?.sentCustomerEmail
          ? `Booking refunded and cancelled successfully. Returned amount: AUD ${returnAmount.toFixed(
              2
            )}. Fee: AUD ${feeAmount.toFixed(2)}.`
          : `Booking refunded and cancelled successfully. Returned amount: AUD ${returnAmount.toFixed(
              2
            )}. Fee: AUD ${feeAmount.toFixed(2)}. Email failed to send.`,
        data: {
          booking: updatedBooking,
          refund_payment: refundPayment,
          wallet_transaction: walletTransaction,
          provider_refund: providerRefund,
          paid_amount: paidAmount,
          return_amount: returnAmount,
          fee_amount: feeAmount,
          booking_status: updatedBooking.status,
          payment_status: updatedBooking.payment_status,
          admin_action_type: updatedBooking.admin_action_type,
          email_result: emailResult,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin booking refund error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to refund booking",
        error: error.message || "Failed to refund booking",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}