import mongoose from "mongoose";
import Booking from "@/app/backend/models/booking";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import {
  requireAdminUser,
  getAuthErrorStatus,
} from "@/app/backend/utils/authToken";

import "@/app/backend/models/park_user";
import "@/app/backend/models/booking";
import "@/app/backend/models/wallettransaction";

function moneyNumber(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
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
    value.includes("missing") ||
    value.includes("already exists") ||
    value.includes("cannot be deleted") ||
    value.includes("cannot be permanently deleted")
  ) {
    return 400;
  }

  if (value.includes("not found")) {
    return 404;
  }

  return 500;
}

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

function getMinBookings(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 2) {
    return 2;
  }

  return Math.min(Math.floor(number), 100);
}

function isTruthyParam(value) {
  return ["true", "1", "yes", "repeated"].includes(
    String(value || "").toLowerCase().trim()
  );
}

async function getOptionalJsonBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function buildCustomerIdentifierFilter(customerId) {
  if (!customerId) {
    throw new Error("Customer ID is required");
  }

  const value = String(customerId).trim();
  const conditions = [];

  if (mongoose.Types.ObjectId.isValid(value)) {
    conditions.push({ _id: value });
  }

  conditions.push({ code: value });
  conditions.push({ email: value.toLowerCase() });

  return {
    $or: conditions,
    role: "customer",
  };
}

function serializeCustomer(customer, bookingStats = {}) {
  if (!customer) return null;

  const plainCustomer =
    typeof customer.toObject === "function"
      ? customer.toObject({
          virtuals: true,
          versionKey: false,
        })
      : customer;

  const customerId = String(plainCustomer._id);
  const stats = bookingStats[customerId] || {};

  const totalBookings = Number(stats.total_bookings || 0);
  const totalSpent = moneyNumber(stats.total_spent);

  return {
    _id: plainCustomer._id,
    customer_id: plainCustomer.code || customerId,
    code: plainCustomer.code || null,

    name: plainCustomer.name,
    email: plainCustomer.email,
    phone: plainCustomer.phone,

    role: plainCustomer.role,
    is_active: plainCustomer.is_active,

    wallet_balance: moneyNumber(plainCustomer.wallet_balance),
    wallet_currency: plainCustomer.wallet_currency || "aud",
    wallet_status: plainCustomer.wallet_status || "active",
    wallet_updated_at: plainCustomer.wallet_updated_at || null,

    booking_count: totalBookings,
    bookings_count: totalBookings,
    total_bookings: totalBookings,
    total_spent: totalSpent,
    last_booking_at: stats.last_booking_at || null,
    last_booking_date: stats.last_booking_at || null,

    registered_at: plainCustomer.createdAt,
    createdAt: plainCustomer.createdAt,
    updatedAt: plainCustomer.updatedAt,
  };
}

async function getCustomerBookingStats(customerIds = []) {
  if (!customerIds.length) return {};

  const objectIds = customerIds
    .map((id) => String(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (!objectIds.length) return {};

  const result = await Booking.aggregate([
    {
      $match: {
        user_id: {
          $in: objectIds,
        },
      },
    },
    {
      $group: {
        _id: "$user_id",
        total_bookings: {
          $sum: 1,
        },
        total_spent: {
          $sum: {
            $ifNull: ["$paid_amount", 0],
          },
        },
        last_booking_at: {
          $max: "$createdAt",
        },
      },
    },
  ]);

  return result.reduce((map, item) => {
    map[String(item._id)] = {
      total_bookings: Number(item.total_bookings || 0),
      total_spent: moneyNumber(item.total_spent),
      last_booking_at: item.last_booking_at || null,
    };

    return map;
  }, {});
}

async function getRepeatedCustomerBookingStats(minBookings = 2) {
  const result = await Booking.aggregate([
    {
      $match: {
        user_id: {
          $exists: true,
          $ne: null,
        },
      },
    },
    {
      $group: {
        _id: "$user_id",
        total_bookings: {
          $sum: 1,
        },
        total_spent: {
          $sum: {
            $ifNull: ["$paid_amount", 0],
          },
        },
        last_booking_at: {
          $max: "$createdAt",
        },
      },
    },
    {
      $match: {
        total_bookings: {
          $gte: minBookings,
        },
      },
    },
  ]);

  const stats = {};
  const customerIds = [];

  result.forEach((item) => {
    const id = String(item._id || "");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return;
    }

    customerIds.push(new mongoose.Types.ObjectId(id));

    stats[id] = {
      total_bookings: Number(item.total_bookings || 0),
      total_spent: moneyNumber(item.total_spent),
      last_booking_at: item.last_booking_at || null,
    };
  });

  return {
    customerIds,
    stats,
  };
}

async function getCustomerSummary(match, repeatedCustomerCount = 0) {
  const [total, active, inactive, frozenWallets, disabledWallets] =
    await Promise.all([
      ParkingUser.countDocuments(match),
      ParkingUser.countDocuments({
        ...match,
        is_active: true,
      }),
      ParkingUser.countDocuments({
        ...match,
        is_active: false,
      }),
      ParkingUser.countDocuments({
        ...match,
        wallet_status: "frozen",
      }),
      ParkingUser.countDocuments({
        ...match,
        wallet_status: "disabled",
      }),
    ]);

  return {
    total,
    active,
    inactive,
    repeated_customers: Number(repeatedCustomerCount || 0),
    frozen_wallets: frozenWallets,
    disabled_wallets: disabledWallets,
  };
}

async function getCustomerDeleteSafetyInfo(customer) {
  const [bookingCount, walletTransactionCount] = await Promise.all([
    Booking.countDocuments({
      user_id: customer._id,
    }),

    WalletTransaction.countDocuments({
      user_id: customer._id,
    }),
  ]);

  const walletBalance = moneyNumber(customer.wallet_balance || 0);

  const hasBookingHistory = bookingCount > 0;
  const hasWalletBalance = walletBalance !== 0;
  const hasWalletHistory = walletTransactionCount > 0;

  return {
    booking_count: bookingCount,
    wallet_balance: walletBalance,
    wallet_transaction_count: walletTransactionCount,
    has_booking_history: hasBookingHistory,
    has_wallet_balance: hasWalletBalance,
    has_wallet_history: hasWalletHistory,
    cannot_permanent_delete:
      hasBookingHistory || hasWalletBalance || hasWalletHistory,
  };
}

function buildBaseCustomerMatch({ search, isActive }) {
  const match = {
    role: "customer",
  };

  if (isActive === "true") {
    match.is_active = true;
  }

  if (isActive === "false") {
    match.is_active = false;
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");

    match.$or = [
      { name: regex },
      { email: regex },
      { phone: regex },
      { code: regex },
    ];
  }

  return match;
}

export async function getAdminCustomers(req) {
  try {
    await requireAdminUser(req);

    const { searchParams } = new URL(req.url);

    const page = getPositiveInteger(searchParams.get("page"), 1, 100000);
    const limit = getPositiveInteger(searchParams.get("limit"), 20, 100);
    const search = String(searchParams.get("search") || "").trim();
    const isActive = searchParams.get("is_active");

    const customerType = String(
      searchParams.get("customer_type") || "all"
    ).toLowerCase();

    const repeatedRequested =
      customerType === "repeated" ||
      isTruthyParam(searchParams.get("repeated_customer"));

    const minBookings = getMinBookings(searchParams.get("min_bookings"));

    const skip = (page - 1) * limit;

    const baseMatch = buildBaseCustomerMatch({
      search,
      isActive,
    });

    const repeatedData = await getRepeatedCustomerBookingStats(minBookings);
    const repeatedCustomerIds = repeatedData.customerIds;

    const repeatedCustomerCount =
      repeatedCustomerIds.length > 0
        ? await ParkingUser.countDocuments({
            ...baseMatch,
            _id: {
              $in: repeatedCustomerIds,
            },
          })
        : 0;

    const match = {
      ...baseMatch,
    };

    if (repeatedRequested) {
      match._id = {
        $in: repeatedCustomerIds,
      };
    }

    const [customers, total, summary] = await Promise.all([
      ParkingUser.find(match)
        .select(
          "name email phone role code is_active wallet_balance wallet_currency wallet_status wallet_updated_at createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      ParkingUser.countDocuments(match),

      getCustomerSummary(match, repeatedCustomerCount),
    ]);

    const pageCustomerIds = customers.map((customer) => customer._id);
    const pageBookingStats = await getCustomerBookingStats(pageCustomerIds);

    const bookingStats = {
      ...repeatedData.stats,
      ...pageBookingStats,
    };

    return Response.json(
      {
        success: true,
        message: "Customers loaded successfully",
        data: {
          customers: customers.map((customer) =>
            serializeCustomer(customer, bookingStats)
          ),
          summary,
          pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit) || 1,
            has_next_page: page * limit < total,
            has_prev_page: page > 1,
          },
          filters: {
            search: search || null,
            is_active: isActive || null,
            customer_type: repeatedRequested ? "repeated" : "all",
            repeated_customer: repeatedRequested,
            min_bookings: repeatedRequested ? minBookings : null,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin customers error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to load customers",
        error: error.message || "Failed to load customers",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function updateAdminCustomer(req, customerId) {
  try {
    await requireAdminUser(req);

    const body = await req.json();

    const customer = await ParkingUser.findOne(
      buildCustomerIdentifierFilter(customerId)
    );

    if (!customer) {
      throw new Error("Customer not found");
    }

    const name =
      body.name !== undefined ? String(body.name || "").trim() : undefined;

    const email =
      body.email !== undefined
        ? String(body.email || "").toLowerCase().trim()
        : undefined;

    const phone =
      body.phone !== undefined ? String(body.phone || "").trim() : undefined;

    const isActive =
      body.is_active !== undefined ? Boolean(body.is_active) : undefined;

    if (name !== undefined) {
      if (!name) {
        throw new Error("Full name is required");
      }

      customer.name = name;
    }

    if (email !== undefined) {
      if (!email) {
        throw new Error("Email is required");
      }

      const existingEmailCustomer = await ParkingUser.findOne({
        _id: {
          $ne: customer._id,
        },
        email,
      });

      if (existingEmailCustomer) {
        throw new Error("Another user with this email already exists");
      }

      customer.email = email;
    }

    if (phone !== undefined) {
      if (!phone) {
        throw new Error("Phone is required");
      }

      customer.phone = phone;
    }

    if (isActive !== undefined) {
      customer.is_active = isActive;
    }

    await customer.save();

    const bookingStats = await getCustomerBookingStats([customer._id]);

    return Response.json(
      {
        success: true,
        message: "Customer updated successfully",
        data: serializeCustomer(customer, bookingStats),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin customer update error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update customer",
        error: error.message || "Failed to update customer",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function deleteAdminCustomer(req, customerId) {
  try {
    await requireAdminUser(req);

    const body = await getOptionalJsonBody(req);
    const action = String(body.action || "").trim();

    const customer = await ParkingUser.findOne(
      buildCustomerIdentifierFilter(customerId)
    );

    if (!customer) {
      throw new Error("Customer not found");
    }

    const safetyInfo = await getCustomerDeleteSafetyInfo(customer);

    if (safetyInfo.cannot_permanent_delete && action !== "deactivate") {
      return Response.json(
        {
          success: false,
          requires_deactivation: true,
          code: "CUSTOMER_CANNOT_BE_DELETED",
          message:
            "This customer has booking history, wallet balance, or wallet activity. The customer cannot be permanently deleted. You can deactivate the account instead.",
          data: {
            customer: serializeCustomer(customer),
            ...safetyInfo,
          },
        },
        { status: 409 }
      );
    }

    if (safetyInfo.cannot_permanent_delete && action === "deactivate") {
      customer.is_active = false;
      await customer.save();

      const bookingStats = await getCustomerBookingStats([customer._id]);

      return Response.json(
        {
          success: true,
          action: "deactivated",
          message:
            "Customer has booking history, wallet balance, or wallet activity, so the account was deactivated instead of deleted.",
          data: serializeCustomer(customer, bookingStats),
        },
        { status: 200 }
      );
    }

    if (action && action !== "delete") {
      throw new Error("Invalid customer delete action");
    }

    await ParkingUser.deleteOne({
      _id: customer._id,
    });

    return Response.json(
      {
        success: true,
        action: "deleted",
        message: "Customer deleted successfully.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin customer delete error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete customer",
        error: error.message || "Failed to delete customer",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}