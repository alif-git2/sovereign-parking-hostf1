import mongoose from "mongoose";
import Payment from "@/app/backend/models/payment";
import Booking from "@/app/backend/models/booking";
import ParkingUser from "@/app/backend/models/park_user";
import {
  requireAdminUser,
  getAuthErrorStatus,
} from "@/app/backend/utils/authToken";

function normalizeString(value) {
  return String(value || "").trim();
}

function getErrorStatus(message = "") {
  const authStatus = getAuthErrorStatus(message);

  if (authStatus !== 400) {
    return authStatus;
  }

  const value = String(message || "").toLowerCase();

  if (value.includes("not found")) return 404;
  if (value.includes("required") || value.includes("invalid")) return 400;

  return 400;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isObjectIdLike(value) {
  if (!value) return false;

  if (typeof value === "object" && value._id) {
    return mongoose.Types.ObjectId.isValid(String(value._id));
  }

  return mongoose.Types.ObjectId.isValid(String(value));
}

function toObjectId(value) {
  const id = getObjectIdString(value);

  if (!id) return null;

  return new mongoose.Types.ObjectId(id);
}

function getObjectIdString(value) {
  if (!value) return "";

  if (typeof value === "object" && value._id) {
    const id = String(value._id);
    return mongoose.Types.ObjectId.isValid(id) ? id : "";
  }

  const stringValue = String(value);

  if (mongoose.Types.ObjectId.isValid(stringValue)) {
    return stringValue;
  }

  return "";
}

function getPlainString(value) {
  if (!value) return "";

  if (typeof value === "object") {
    return "";
  }

  return String(value).trim();
}

function compactArray(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function getProviderReference(payment) {
  return (
    payment.provider_payment_id ||
    payment.provider_order_id ||
    payment.provider_capture_id ||
    payment.provider_refund_id ||
    payment.transaction_id ||
    payment.provider_reference ||
    payment.reference ||
    payment.manual_payment_reference ||
    "-"
  );
}

function getPaymentBookingReference(payment, booking) {
  return (
    booking?.booking_id ||
    payment.booking_reference ||
    payment.booking_ref ||
    payment.booking_code ||
    payment.booking_number ||
    ""
  );
}

function getPaymentBookingType(payment, booking) {
  return booking?.type || payment.booking_type || payment.type || "-";
}

function getNestedCustomer(source) {
  if (!source) return {};

  return {
    name:
      source.customer_name ||
      source.name ||
      source.customer?.name ||
      source.customer_details?.name ||
      source.billing_details?.name ||
      source.details?.customer?.name ||
      source.details?.name ||
      "",
    email:
      source.customer_email ||
      source.email ||
      source.customer?.email ||
      source.customer_details?.email ||
      source.billing_details?.email ||
      source.details?.customer?.email ||
      source.details?.email ||
      "",
    phone:
      source.customer_phone ||
      source.phone ||
      source.customer?.phone ||
      source.customer_details?.phone ||
      source.billing_details?.phone ||
      source.details?.customer?.phone ||
      source.details?.phone ||
      "",
  };
}

function getUserFromLookups(payment, booking, userMap) {
  const possibleUserIds = [
    payment.user_id,
    payment.customer_id,
    payment.parking_user_id,
    booking?.user_id,
    booking?.customer_id,
    booking?.parking_user_id,
  ]
    .map(getObjectIdString)
    .filter(Boolean);

  for (const userId of possibleUserIds) {
    if (userMap.has(userId)) {
      return userMap.get(userId);
    }
  }

  return null;
}

function serializePayment(payment, lookups) {
  const bookingIdString = getObjectIdString(payment.booking_id);

  const booking =
    lookups.bookingById.get(bookingIdString) ||
    lookups.bookingByRef.get(payment.booking_reference || "") ||
    lookups.bookingByRef.get(payment.booking_ref || "") ||
    lookups.bookingByRef.get(payment.booking_code || "") ||
    lookups.bookingByRef.get(payment.booking_number || "") ||
    null;

  const user = getUserFromLookups(payment, booking, lookups.userMap);

  const paymentCustomer = getNestedCustomer(payment);
  const bookingCustomer = getNestedCustomer(booking);
  const userCustomer = getNestedCustomer(user);

  const customerName =
    paymentCustomer.name || bookingCustomer.name || userCustomer.name || "-";

  const customerEmail =
    paymentCustomer.email || bookingCustomer.email || userCustomer.email || "-";

  const customerPhone =
    paymentCustomer.phone || bookingCustomer.phone || userCustomer.phone || "-";

  return {
    _id: payment._id,

    booking_id: booking?._id || payment.booking_id || null,
    booking_ref: getPaymentBookingReference(payment, booking) || "-",
    booking_type: getPaymentBookingType(payment, booking),

    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,

    amount: Number(payment.amount || 0),
    currency: payment.currency || "aud",

    method: payment.method || payment.payment_method || "-",
    status: payment.status || "-",
    payment_flow: payment.payment_flow || "-",
    payment_purpose: payment.payment_purpose || "booking_payment",

    provider_reference: getProviderReference(payment),

    provider_payment_id: payment.provider_payment_id || "",
    provider_order_id: payment.provider_order_id || "",
    provider_capture_id: payment.provider_capture_id || "",
    provider_refund_id: payment.provider_refund_id || "",
    transaction_id: payment.transaction_id || "",

    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

async function findBookingMatchesForPaymentFilters({ bookingType, search }) {
  const bookingMatch = {};
  const andConditions = [];

  const normalizedBookingType = normalizeString(bookingType).toLowerCase();
  const normalizedSearch = normalizeString(search);

  if (normalizedBookingType && normalizedBookingType !== "all") {
    if (!["cruise", "storage", "airport"].includes(normalizedBookingType)) {
      throw new Error("Invalid booking type");
    }

    bookingMatch.type = normalizedBookingType;
  }

  if (normalizedSearch) {
    const regex = new RegExp(escapeRegExp(normalizedSearch), "i");

    andConditions.push({
      $or: [
        { booking_id: regex },
        { name: regex },
        { email: regex },
        { phone: regex },
        { customer_name: regex },
        { customer_email: regex },
        { customer_phone: regex },
        { "customer.name": regex },
        { "customer.email": regex },
        { "customer.phone": regex },
        { license_plate: regex },
        { reference: regex },
        { stripe_payment_intent_id: regex },
        { paypal_order_id: regex },
        { paypal_capture_id: regex },
        { manual_payment_reference: regex },
      ],
    });
  }

  if (andConditions.length > 0) {
    bookingMatch.$and = andConditions;
  }

  if (
    !bookingMatch.type &&
    !bookingMatch.$and &&
    !normalizedSearch
  ) {
    return {
      bookingObjectIds: [],
      bookingRefs: [],
      shouldRestrictPayments: false,
    };
  }

  const bookings = await Booking.find(bookingMatch)
    .select("_id booking_id")
    .lean();

  return {
    bookingObjectIds: bookings.map((booking) => booking._id),
    bookingRefs: bookings
      .map((booking) => booking.booking_id)
      .filter(Boolean),
    shouldRestrictPayments: Boolean(
      normalizedBookingType && normalizedBookingType !== "all"
    ),
  };
}

function addDateRangeToQuery(query, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return;

  query.createdAt = {};

  if (dateFrom) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);

    if (!Number.isNaN(from.getTime())) {
      query.createdAt.$gte = from;
    }
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    if (!Number.isNaN(to.getTime())) {
      query.createdAt.$lte = to;
    }
  }

  if (Object.keys(query.createdAt).length === 0) {
    delete query.createdAt;
  }
}

async function buildPaymentQuery(searchParams) {
  const query = {};

  const status = normalizeString(searchParams.get("status"));
  const method = normalizeString(searchParams.get("method"));
  const bookingType = normalizeString(
    searchParams.get("booking_type") || searchParams.get("type")
  );
  const paymentFlow = normalizeString(searchParams.get("payment_flow"));
  const search = normalizeString(searchParams.get("search"));
  const dateFrom = normalizeString(searchParams.get("date_from"));
  const dateTo = normalizeString(searchParams.get("date_to"));

  if (status && status !== "all") {
    query.status = status;
  }

  if (method && method !== "all") {
    query.method = method;
  }

  if (paymentFlow && paymentFlow !== "all") {
    query.payment_flow = paymentFlow;
  }

  addDateRangeToQuery(query, dateFrom, dateTo);

  const {
    bookingObjectIds,
    bookingRefs,
    shouldRestrictPayments,
  } = await findBookingMatchesForPaymentFilters({
    bookingType,
    search,
  });

  /**
   * IMPORTANT:
   * Payment.booking_id is an ObjectId in your schema.
   * Never put custom booking IDs like "BK1776835651394" into booking_id query.
   */
  if (shouldRestrictPayments) {
    query.booking_id = {
      $in: bookingObjectIds,
    };
  }

  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");

    const searchOr = [
      { provider_payment_id: regex },
      { provider_order_id: regex },
      { provider_capture_id: regex },
      { provider_refund_id: regex },
      { transaction_id: regex },
      { provider_reference: regex },
      { reference: regex },
      { manual_payment_reference: regex },
      { method: regex },
      { payment_method: regex },
      { status: regex },
      { currency: regex },
      { customer_name: regex },
      { customer_email: regex },
      { customer_phone: regex },
      { booking_reference: regex },
      { booking_ref: regex },
      { booking_code: regex },
      { booking_number: regex },
    ];

    if (mongoose.Types.ObjectId.isValid(search)) {
      const objectId = new mongoose.Types.ObjectId(search);

      searchOr.push({
        _id: objectId,
      });

      searchOr.push({
        booking_id: objectId,
      });

      searchOr.push({
        user_id: objectId,
      });
    }

    if (bookingObjectIds.length > 0) {
      searchOr.push({
        booking_id: {
          $in: bookingObjectIds,
        },
      });
    }

    if (bookingRefs.length > 0) {
      searchOr.push({
        booking_reference: {
          $in: bookingRefs,
        },
      });

      searchOr.push({
        booking_ref: {
          $in: bookingRefs,
        },
      });

      searchOr.push({
        booking_code: {
          $in: bookingRefs,
        },
      });

      searchOr.push({
        booking_number: {
          $in: bookingRefs,
        },
      });
    }

    query.$and = query.$and || [];
    query.$and.push({
      $or: searchOr,
    });
  }

  return query;
}

async function buildPaymentLookups(payments) {
  const bookingObjectIds = [];
  const bookingRefs = [];
  const userObjectIds = [];

  payments.forEach((payment) => {
    const bookingObjectId = getObjectIdString(payment.booking_id);

    if (bookingObjectId) {
      bookingObjectIds.push(bookingObjectId);
    }

    ["booking_reference", "booking_ref", "booking_code", "booking_number"].forEach(
      (key) => {
        if (payment[key]) {
          bookingRefs.push(String(payment[key]));
        }
      }
    );

    ["user_id", "customer_id", "parking_user_id"].forEach((key) => {
      const userObjectId = getObjectIdString(payment[key]);

      if (userObjectId) {
        userObjectIds.push(userObjectId);
      }
    });
  });

  const uniqueBookingObjectIds = compactArray(bookingObjectIds);
  const uniqueBookingRefs = compactArray(bookingRefs);

  const bookingQueryParts = [];

  if (uniqueBookingObjectIds.length > 0) {
    bookingQueryParts.push({
      _id: {
        $in: uniqueBookingObjectIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    });
  }

  if (uniqueBookingRefs.length > 0) {
    bookingQueryParts.push({
      booking_id: {
        $in: uniqueBookingRefs,
      },
    });
  }

  const bookings =
    bookingQueryParts.length > 0
      ? await Booking.find({
          $or: bookingQueryParts,
        })
          .select(
            "_id booking_id type name email phone customer_name customer_email customer_phone customer user_id customer_id parking_user_id status payment_status price paid_amount due_amount"
          )
          .lean()
      : [];

  bookings.forEach((booking) => {
    ["user_id", "customer_id", "parking_user_id"].forEach((key) => {
      const userObjectId = getObjectIdString(booking[key]);

      if (userObjectId) {
        userObjectIds.push(userObjectId);
      }
    });
  });

  const uniqueUserObjectIds = compactArray(userObjectIds);

  const users =
    uniqueUserObjectIds.length > 0
      ? await ParkingUser.find({
          _id: {
            $in: uniqueUserObjectIds.map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          },
        })
          .select("name email phone")
          .lean()
      : [];

  const bookingById = new Map();
  const bookingByRef = new Map();
  const userMap = new Map();

  bookings.forEach((booking) => {
    bookingById.set(String(booking._id), booking);

    if (booking.booking_id) {
      bookingByRef.set(String(booking.booking_id), booking);
    }
  });

  users.forEach((user) => {
    userMap.set(String(user._id), user);
  });

  return {
    bookingById,
    bookingByRef,
    userMap,
  };
}

function getDefaultCounts(total = 0) {
  return {
    all: total,
    paid: 0,
    pending: 0,
    failed: 0,
    refunded: 0,
    partially_refunded: 0,
    partial: 0,
    succeeded: 0,
    success: 0,
    completed: 0,
    cancelled: 0,
  };
}

function getDefaultTotals() {
  return {
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    refundedAmount: 0,
  };
}

export async function getAdminPayments(req) {
  try {
    await requireAdminUser(req, ["admin"]);

    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const page = Math.max(Number(searchParams.get("page") || 1), 1);

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 20), 1),
      100
    );

    const query = await buildPaymentQuery(searchParams);
    const skip = (page - 1) * limit;

    const [payments, total, statusCounts, methodCounts, totals] =
      await Promise.all([
        Payment.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        Payment.countDocuments(query),

        Payment.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: "$status",
              count: {
                $sum: 1,
              },
              amount: {
                $sum: {
                  $ifNull: ["$amount", 0],
                },
              },
            },
          },
        ]),

        Payment.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: "$method",
              count: {
                $sum: 1,
              },
              amount: {
                $sum: {
                  $ifNull: ["$amount", 0],
                },
              },
            },
          },
        ]),

        Payment.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: null,
              totalAmount: {
                $sum: {
                  $ifNull: ["$amount", 0],
                },
              },
              paidAmount: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["paid", "succeeded", "success", "completed"],
                      ],
                    },
                    {
                      $ifNull: ["$amount", 0],
                    },
                    0,
                  ],
                },
              },
              pendingAmount: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["pending", "requires_payment_method"],
                      ],
                    },
                    {
                      $ifNull: ["$amount", 0],
                    },
                    0,
                  ],
                },
              },
              refundedAmount: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["refunded", "partially_refunded"],
                      ],
                    },
                    {
                      $ifNull: ["$amount", 0],
                    },
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

    const lookups = await buildPaymentLookups(payments);

    const counts = getDefaultCounts(total);

    statusCounts.forEach((item) => {
      if (item._id) {
        counts[item._id] = item.count;
      }
    });

    return Response.json({
      success: true,
      data: {
        payments: payments.map((payment) => serializePayment(payment, lookups)),

        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },

        counts,
        statusCounts,
        methodCounts,

        totals: totals[0] || getDefaultTotals(),
      },
    });
  } catch (error) {
    console.error("Admin payments fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch payments",
        error: error.message || "Failed to fetch payments",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}