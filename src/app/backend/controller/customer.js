import Booking from "@/app/backend/models/booking";
import ParkingUser from "@/app/backend/models/park_user";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import Payment from "@/app/backend/models/payment";
import { getUserFromRequest } from "@/app/backend/utils/authToken";

// Important: register populated models for Mongoose
import "@/app/backend/models/location";
import "@/app/backend/models/cruiseschedule";
import "@/app/backend/models/coupon";
import "@/app/backend/models/storagetype";

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("unauthorized") || value.includes("login")) return 401;
  if (value.includes("not found")) return 404;
  if (value.includes("inactive")) return 403;

  return 500;
}

function toPlainObject(value) {
  if (!value) return null;

  if (typeof value.toObject === "function") {
    return value.toObject({
      virtuals: true,
      versionKey: false,
    });
  }

  return value;
}

function normalizePaymentMethod(method) {
  const plainMethod = toPlainObject(method);

  if (!plainMethod) return null;

  const stripePaymentMethodId =
    plainMethod.stripe_payment_method_id ||
    plainMethod.payment_method_id ||
    plainMethod.paymentMethodId ||
    plainMethod.stripePaymentMethodId ||
    plainMethod.id ||
    "";

  const card = plainMethod.card || {};

  const brand =
    plainMethod.brand ||
    plainMethod.card_brand ||
    plainMethod.cardBrand ||
    card.brand ||
    "";

  const last4 =
    plainMethod.last4 ||
    plainMethod.card_last4 ||
    plainMethod.cardLast4 ||
    card.last4 ||
    "";

  const expMonth =
    plainMethod.exp_month ||
    plainMethod.expMonth ||
    plainMethod.card_exp_month ||
    plainMethod.cardExpMonth ||
    card.exp_month ||
    "";

  const expYear =
    plainMethod.exp_year ||
    plainMethod.expYear ||
    plainMethod.card_exp_year ||
    plainMethod.cardExpYear ||
    card.exp_year ||
    "";

  if (!stripePaymentMethodId && !last4) {
    return null;
  }

  return {
    ...plainMethod,

    id: stripePaymentMethodId,
    stripe_payment_method_id: stripePaymentMethodId,
    payment_method_id: stripePaymentMethodId,

    type: plainMethod.type || "card",
    brand,
    card_brand: brand,
    last4,
    card_last4: last4,
    exp_month: expMonth,
    exp_year: expYear,

    is_default:
      plainMethod.is_default ||
      plainMethod.isDefault ||
      plainMethod.default ||
      false,

    is_active: plainMethod.is_active !== false,
    createdAt: plainMethod.createdAt || plainMethod.created_at || null,
    updatedAt: plainMethod.updatedAt || plainMethod.updated_at || null,
  };
}

function getActivePaymentMethods(user) {
  const methods = Array.isArray(user?.payment_methods)
    ? user.payment_methods
    : [];

  return methods
    .map(normalizePaymentMethod)
    .filter((method) => method && method.is_active !== false);
}

function formatUser(user) {
  if (!user) return null;

  const plainUser = toPlainObject(user);
  const activePaymentMethods = getActivePaymentMethods(plainUser);
  const profileImageUrl = plainUser.profile_image_url || "";

  return {
    _id: plainUser._id,
    name: plainUser.name,
    email: plainUser.email,
    phone: plainUser.phone,
    role: plainUser.role,
    is_active: plainUser.is_active,

    profile_image_url: profileImageUrl,
    profile_image: profileImageUrl,
    profile_image_public_id: plainUser.profile_image_public_id || "",

    stripe_customer_id: plainUser.stripe_customer_id || "",

    payment_methods: activePaymentMethods,
    paymentMethods: activePaymentMethods,
    saved_cards: activePaymentMethods,
    savedCards: activePaymentMethods,
    stripe_payment_methods: activePaymentMethods,
    stripePaymentMethods: activePaymentMethods,

    wallet_balance: Number(plainUser.wallet_balance || 0),
    wallet_currency: plainUser.wallet_currency || "aud",
    wallet_status: plainUser.wallet_status || "active",
    wallet_updated_at: plainUser.wallet_updated_at || null,

    createdAt: plainUser.createdAt,
    updatedAt: plainUser.updatedAt,
  };
}

function calculateDashboardStats(bookings = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalBookings = bookings.length;

  const upcomingBookings = bookings.filter((booking) => {
    if (!booking.start_date) return false;

    const startDate = new Date(booking.start_date);

    return (
      startDate >= today &&
      !["cancelled", "refund", "refunded"].includes(booking.status)
    );
  }).length;

  const paidBookings = bookings.filter(
    (booking) => booking.payment_status === "paid"
  ).length;

  const partialDepositBookings = bookings.filter(
    (booking) => booking.payment_status === "partial"
  ).length;

  const pendingPaymentBookings = bookings.filter(
    (booking) =>
      booking.status === "pending_payment" ||
      booking.payment_status === "pending"
  ).length;

  const totalPaidAmount = bookings.reduce((total, booking) => {
    return total + Number(booking.paid_amount || 0);
  }, 0);

  const totalDueAmount = bookings.reduce((total, booking) => {
    return total + Number(booking.due_amount || 0);
  }, 0);

  return {
    totalBookings,
    upcomingBookings,
    paidBookings,
    partialDepositBookings,
    pendingPaymentBookings,
    totalPaidAmount,
    totalDueAmount,
  };
}

function serializeDocument(document) {
  if (!document) return null;

  if (typeof document.toObject === "function") {
    return document.toObject({
      virtuals: true,
      versionKey: false,
    });
  }

  return document;
}

export async function getCustomerDashboard(req) {
  try {
    const authUser = getUserFromRequest(req);

    if (!authUser?.id) {
      throw new Error("Unauthorized. Please login again.");
    }

    const user = await ParkingUser.findById(authUser.id).select(
      [
        "name",
        "email",
        "phone",
        "role",
        "is_active",

        "profile_image_url",
        "profile_image_public_id",

        "stripe_customer_id",
        "payment_methods",

        "wallet_balance",
        "wallet_currency",
        "wallet_status",
        "wallet_updated_at",

        "createdAt",
        "updatedAt",
      ].join(" ")
    );

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.is_active) {
      throw new Error("Your account is inactive");
    }

    if (user.role !== "customer") {
      throw new Error("Unauthorized. Customer access only.");
    }

    const bookings = await Booking.find({ user_id: user._id })
      .populate("location_id")
      .populate("schedule_id")
      .populate("coupon_id")
      .populate("details.storage.storage_type_id")
      .populate("wallet_transaction_id")
      .sort({ createdAt: -1 });

    const bookingIds = bookings.map((booking) => booking._id);

    const walletTransactions = await WalletTransaction.find({
      user_id: user._id,
    })
      .populate("booking_id", "booking_id type status payment_status price")
      .populate("payment_id", "method status amount currency payment_purpose")
      .sort({ createdAt: -1 })
      .limit(10);

    const paymentTransactions = await Payment.find({
      user_id: user._id,
      booking_id: { $in: bookingIds },
      payment_purpose: { $ne: "wallet_topup" },
      payment_flow: { $ne: "wallet_topup" },
    })
      .populate(
        "booking_id",
        "booking_id type status payment_status price paid_amount due_amount payment_method payment_flow"
      )
      .populate(
        "wallet_transaction_id",
        "transaction_reference type direction amount status"
      )
      .sort({ createdAt: -1 });

    const formattedUser = formatUser(user);
    const activePaymentMethods = formattedUser.payment_methods || [];

    return Response.json(
      {
        success: true,
        data: {
          user: formattedUser,

          payment_methods: activePaymentMethods,
          paymentMethods: activePaymentMethods,
          saved_cards: activePaymentMethods,
          savedCards: activePaymentMethods,
          stripe_payment_methods: activePaymentMethods,
          stripePaymentMethods: activePaymentMethods,

          bookings: bookings.map(serializeDocument),

          wallet: {
            balance: formattedUser.wallet_balance,
            currency: formattedUser.wallet_currency,
            status: formattedUser.wallet_status,
            updated_at: formattedUser.wallet_updated_at,
          },

          walletTransactions: walletTransactions.map(serializeDocument),
          paymentTransactions: paymentTransactions.map(serializeDocument),

          stats: calculateDashboardStats(bookings),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Customer dashboard failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Customer dashboard failed",
        error: error.message || "Customer dashboard failed",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}