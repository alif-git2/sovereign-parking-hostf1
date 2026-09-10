import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import CheckoutDraft from "@/app/backend/models/checkoutDraft";
import Booking from "@/app/backend/models/booking";
import StorageType from "@/app/backend/models/storagetype";
import Location from "@/app/backend/models/location";
import { getOptionalUserFromRequest } from "@/app/backend/utils/authToken";

export const runtime = "nodejs";

const ONLINE_PAYMENT_METHODS = ["stripe", "paypal"];
const PAYMENT_FLOWS = ["full_online", "poa_deposit"];
const DEPOSIT_TYPES = ["full", "poa"];
const BOOKING_TYPES = ["cruise", "storage", "airport"];
const ADD_ON_VEHICLE_DISCOUNT_PERCENT = 10;
const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "pending_payment",
  "success",
  "confirmed",
  "poa",
];

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeLowerString(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase().trim());
  }

  return Boolean(value);
}

function normalizeMoney(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Number(number.toFixed(2));
}

function getDecodedUserId(decoded) {
  const id =
    decoded?.id ||
    decoded?._id ||
    decoded?.userId ||
    decoded?.user_id ||
    decoded?.sub ||
    "";

  return mongoose.Types.ObjectId.isValid(String(id)) ? String(id) : null;
}

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (
    value.includes("authorization") ||
    value.includes("token") ||
    value.includes("login")
  ) {
    return 401;
  }

  if (value.includes("not found")) return 404;
  if (value.includes("expired")) return 410;

  if (
    value.includes("fully booked") ||
    value.includes("no storage slots") ||
    value.includes("no capacity")
  ) {
    return 409;
  }

  if (
    value.includes("required") ||
    value.includes("invalid") ||
    value.includes("unsupported") ||
    value.includes("must")
  ) {
    return 400;
  }

  return 500;
}

function safeJsonSize(value) {
  try {
    return JSON.stringify(value || {}).length;
  } catch {
    return 0;
  }
}

function getFirstMoney(...values) {
  for (const value of values) {
    const amount = normalizeMoney(value);

    if (amount > 0) {
      return amount;
    }
  }

  return 0;
}

function getAddOnVehicleSnapshot(bookingPayload = {}) {
  const addOnVehicle =
    bookingPayload?.details?.cruise?.add_on_vehicle &&
    typeof bookingPayload.details.cruise.add_on_vehicle === "object"
      ? bookingPayload.details.cruise.add_on_vehicle
      : {};

  const enabled = normalizeBoolean(
    bookingPayload.add_on_vehicle_enabled ?? addOnVehicle.enabled
  );

  const type = normalizeString(
    bookingPayload.add_on_vehicle_type || addOnVehicle.type
  );

  const licensePlate = normalizeString(
    bookingPayload.add_on_vehicle_license_plate || addOnVehicle.license_plate
  );

  const originalPrice = normalizeMoney(
    bookingPayload.add_on_vehicle_original_price || addOnVehicle.original_price
  );

  const discountPercent = enabled ? ADD_ON_VEHICLE_DISCOUNT_PERCENT : 0;

  const discountAmount = normalizeMoney(
    bookingPayload.add_on_vehicle_discount_amount || addOnVehicle.discount_amount
  );

  const price = normalizeMoney(
    bookingPayload.add_on_vehicle_price || addOnVehicle.price
  );

  return {
    enabled,
    type: enabled ? type : "",
    license_plate: enabled ? licensePlate : "",
    discount_percent: discountPercent,
    original_price: enabled ? originalPrice : 0,
    discount_amount: enabled ? discountAmount : 0,
    price: enabled ? price : 0,
  };
}

function extractBookingPayload(body = {}) {
  const payload =
    body.booking_payload ||
    body.bookingPayload ||
    body.booking_data ||
    body.bookingData ||
    body.payload ||
    body;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Valid booking payload is required");
  }

  return payload;
}

function getCheckoutPricingSnapshot({ body, bookingPayload }) {
  const paymentFlow = normalizeLowerString(
    body.payment_flow || bookingPayload.payment_flow
  );

  const addOnVehicleSnapshot = getAddOnVehicleSnapshot(bookingPayload);

  const discountAmount = normalizeMoney(
    body.discount_amount ||
      bookingPayload.discount_amount ||
      bookingPayload.coupon_discount_amount ||
      0
  );

  const holdingDepositAmount = normalizeMoney(
    body.holding_deposit_amount ||
      bookingPayload.holding_deposit_amount ||
      0
  );

  const price = getFirstMoney(
    body.price,
    body.final_price,
    body.total_amount,
    body.booking_total_amount,
    body.amount,
    bookingPayload.price,
    bookingPayload.final_price,
    bookingPayload.total_amount,
    bookingPayload.booking_total_amount,
    bookingPayload.total_after_discount,
    bookingPayload.total_before_discount
  );

  const amountDueNow =
    paymentFlow === "poa_deposit"
      ? getFirstMoney(
          body.amount_due_now,
          body.due_amount,
          holdingDepositAmount,
          bookingPayload.amount_due_now,
          bookingPayload.due_amount,
          bookingPayload.holding_deposit_amount
        )
      : getFirstMoney(
          body.amount_due_now,
          body.due_amount,
          price,
          bookingPayload.amount_due_now,
          bookingPayload.due_amount,
          bookingPayload.price,
          bookingPayload.final_price,
          bookingPayload.total_amount
        );

  const balanceDueOnArrival =
    paymentFlow === "poa_deposit"
      ? normalizeMoney(
          body.balance_due_on_arrival ||
            bookingPayload.balance_due_on_arrival ||
            Math.max(price - amountDueNow, 0)
        )
      : 0;

  return {
    price,
    amount_due_now: amountDueNow,
    holding_deposit_amount: holdingDepositAmount,
    balance_due_on_arrival: balanceDueOnArrival,
    coupon_code: normalizeString(
      body.coupon_code || bookingPayload.coupon_code || ""
    ).toUpperCase(),
    discount_amount: discountAmount,
    add_on_vehicle: addOnVehicleSnapshot,
  };
}

function getCustomerSnapshot(bookingPayload = {}) {
  return {
    first_name: normalizeString(bookingPayload.first_name),
    last_name: normalizeString(bookingPayload.last_name),
    email: normalizeLowerString(bookingPayload.email),
    phone: normalizeString(bookingPayload.phone),
  };
}

function validateCheckoutDraftInput({ body, bookingPayload, pricingSnapshot }) {
  const type = normalizeLowerString(body.type || bookingPayload.type);
  const paymentMethod = normalizeLowerString(
    body.payment_method || bookingPayload.payment_method
  );
  const paymentFlow = normalizeLowerString(
    body.payment_flow || bookingPayload.payment_flow
  );
  const depositType = normalizeLowerString(
    body.deposit_type || bookingPayload.deposit_type
  );

  if (!BOOKING_TYPES.includes(type)) {
    throw new Error("Invalid booking type");
  }

  const addOnVehicleSnapshot = getAddOnVehicleSnapshot(bookingPayload);

  if (type !== "cruise" && addOnVehicleSnapshot.enabled) {
    throw new Error("Add-on vehicle is available for cruise bookings only");
  }

  if (type === "cruise" && addOnVehicleSnapshot.enabled) {
    if (!addOnVehicleSnapshot.type) {
      throw new Error("Please select add-on vehicle");
    }

    if (!addOnVehicleSnapshot.license_plate) {
      throw new Error(
        `${addOnVehicleSnapshot.type} License Plate is required`
      );
    }
  }

  if (!ONLINE_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new Error(
      "Unsupported payment method. Checkout drafts are only for Stripe or PayPal."
    );
  }

  if (!PAYMENT_FLOWS.includes(paymentFlow)) {
    throw new Error("Invalid payment flow");
  }

  if (!DEPOSIT_TYPES.includes(depositType)) {
    throw new Error("Invalid deposit type");
  }

  if (paymentFlow === "full_online" && depositType !== "full") {
    throw new Error("Full online payment must use full deposit type");
  }

  if (paymentFlow === "poa_deposit" && depositType !== "poa") {
    throw new Error("Pay on Arrival deposit must use poa deposit type");
  }

  if (pricingSnapshot.price <= 0) {
    throw new Error("Booking price must be greater than zero");
  }

  if (pricingSnapshot.amount_due_now <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  if (paymentFlow === "poa_deposit") {
    if (pricingSnapshot.holding_deposit_amount <= 0) {
      throw new Error("Holding deposit amount must be greater than zero");
    }

    if (pricingSnapshot.amount_due_now > pricingSnapshot.price) {
      throw new Error("Holding deposit cannot be greater than booking total");
    }
  }

  if (safeJsonSize(bookingPayload) > 300000) {
    throw new Error("Booking payload is too large");
  }

  return {
    type,
    paymentMethod,
    paymentFlow,
    depositType,
  };
}


function parseStorageBookingDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);

    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  );
}

function normalizeCapacity(value) {
  const number = Number(value || 0);

  if (
    !Number.isFinite(number) ||
    !Number.isInteger(number) ||
    number < 0
  ) {
    return 0;
  }

  return number;
}

function locationSupportsStorageType(location, storageType) {
  const storageTypes = location?.storage_types;

  if (!Array.isArray(storageTypes) || storageTypes.length === 0) {
    return true;
  }

  return storageTypes.some((item) => {
    if (!item) return false;

    if (item.storage_type_id) {
      return (
        String(item.storage_type_id) === String(storageType._id) &&
        item.is_active !== false
      );
    }

    const value = String(
      item.storage_type || item.name || item
    ).toLowerCase();

    return (
      value === String(storageType._id).toLowerCase() ||
      value === String(storageType.name).toLowerCase()
    );
  });
}

/**
 * Re-check Storage availability immediately before creating a Stripe/PayPal
 * checkout draft.
 *
 * Capacity rules:
 * - StorageType.capacity === 0 => Unlimited
 * - Location.capacity === 0 => Unlimited
 *
 * Storage Type capacity is currently global because StorageType is standalone.
 * Location capacity remains a separate overall limit.
 *
 * Storage dates are inclusive:
 * - 09 Sep -> 09 Sep = 1 occupied day
 * - 04 Sep -> 05 Sep = 2 occupied days
 */
async function validateStorageAvailabilityForCheckout(bookingPayload = {}) {
  const storageTypeId = normalizeString(bookingPayload.storage_type_id);
  const locationId = normalizeString(bookingPayload.location_id);
  const startDateValue = normalizeString(bookingPayload.start_date);
  const endDateValue = normalizeString(bookingPayload.end_date);

  if (!storageTypeId) {
    throw new Error("Storage type is required");
  }

  if (!locationId) {
    throw new Error("Storage location is required");
  }

  if (!mongoose.Types.ObjectId.isValid(storageTypeId)) {
    throw new Error("Invalid storage type");
  }

  if (!mongoose.Types.ObjectId.isValid(locationId)) {
    throw new Error("Invalid storage location");
  }

  if (!startDateValue || !endDateValue) {
    throw new Error("Entry date and exit date are required");
  }

  const startDate = parseStorageBookingDate(startDateValue);
  const endDate = parseStorageBookingDate(endDateValue);

  if (
    !startDate ||
    !endDate ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    throw new Error("Invalid storage booking date");
  }

  // Storage uses inclusive calendar-day booking.
  // Same-day entry/exit is valid; only reject an exit before entry.
  if (endDate < startDate) {
    throw new Error("Exit date cannot be before entry date");
  }

  const [storageType, location] = await Promise.all([
    StorageType.findById(storageTypeId),
    Location.findById(locationId),
  ]);

  if (!storageType) {
    throw new Error("Storage type not found");
  }

  if (!location) {
    throw new Error("Storage location not found");
  }

  if (location.type !== "storage") {
    throw new Error("Selected location is not a storage location");
  }

  if (location.is_active === false) {
    throw new Error("Selected storage location is not active");
  }

  if (!locationSupportsStorageType(location, storageType)) {
    throw new Error(
      `This location does not support ${storageType.name} storage`
    );
  }

  const storageTypeCapacity = normalizeCapacity(storageType.capacity);

  if (storageTypeCapacity > 0) {
    const storageTypeBookedCount = await Booking.countDocuments({
      type: "storage",
      "details.storage.storage_type_id":
        new mongoose.Types.ObjectId(storageTypeId),
      status: {
        $in: ACTIVE_BOOKING_STATUSES,
      },
      start_date: {
        $lte: endDate,
      },
      end_date: {
        $gte: startDate,
      },
    });

    if (storageTypeBookedCount >= storageTypeCapacity) {
      throw new Error(
        `${storageType.name} storage is fully booked for the selected dates`
      );
    }
  }

  const locationCapacity = normalizeCapacity(location.capacity);

  if (locationCapacity > 0) {
    const locationBookedCount = await Booking.countDocuments({
      type: "storage",
      location_id: new mongoose.Types.ObjectId(locationId),
      status: {
        $in: ACTIVE_BOOKING_STATUSES,
      },
      start_date: {
        $lte: endDate,
      },
      end_date: {
        $gte: startDate,
      },
    });

    if (locationBookedCount >= locationCapacity) {
      throw new Error(
        `${location.name} has no storage slots available for the selected dates`
      );
    }
  }

  return {
    storageType,
    location,
  };
}

function buildDraftFilter(value) {
  const id = normalizeString(value);

  if (!id) {
    throw new Error("Checkout draft ID is required");
  }

  const conditions = [{ draft_reference: id }];

  if (mongoose.Types.ObjectId.isValid(id)) {
    conditions.push({ _id: id });
  }

  return {
    $or: conditions,
  };
}

function serializeDraft(draft) {
  if (!draft) return null;

  const item =
    typeof draft.toObject === "function"
      ? draft.toObject({
          virtuals: true,
          versionKey: false,
        })
      : draft;

  return {
    _id: item._id,
    draft_id: item._id,
    checkout_draft_id: item._id,

    draft_reference: item.draft_reference,
    checkout_draft_reference: item.draft_reference,

    type: item.type,
    status: item.status,

    payment_provider: item.payment_provider,
    payment_method: item.payment_method,
    payment_flow: item.payment_flow,
    deposit_type: item.deposit_type,

    currency: item.currency || "aud",

    pricing_snapshot: item.pricing_snapshot,
    customer_snapshot: item.customer_snapshot,

    stripe_payment_intent_id: item.stripe_payment_intent_id || "",
    paypal_order_id: item.paypal_order_id || "",

    booking_id: item.booking_id || null,
    booking_public_id: item.booking_public_id || "",

    expires_at: item.expires_at,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function POST(req) {
  try {
    await connectDB();

    const body = await req.json();
    const bookingPayload = extractBookingPayload(body);

    const pricingSnapshot = getCheckoutPricingSnapshot({
      body,
      bookingPayload,
    });

    const { type, paymentMethod, paymentFlow, depositType } =
      validateCheckoutDraftInput({
        body,
        bookingPayload,
        pricingSnapshot,
      });

    if (type === "storage") {
      await validateStorageAvailabilityForCheckout(bookingPayload);
    }

    const decodedUser = getOptionalUserFromRequest(req);
    const userId = getDecodedUserId(decodedUser);

    const addOnVehicleSnapshot = getAddOnVehicleSnapshot(bookingPayload);

    const cleanBookingPayload = {
      ...bookingPayload,
      type,
      payment_method: paymentMethod,
      payment_flow: paymentFlow,
      deposit_type: depositType,
      holding_deposit_amount:
        paymentFlow === "poa_deposit"
          ? pricingSnapshot.holding_deposit_amount
          : 0,
      price: pricingSnapshot.price,
      due_amount: pricingSnapshot.amount_due_now,
      currency: normalizeLowerString(
        body.currency || bookingPayload.currency || "aud"
      ),

      add_on_vehicle_enabled:
        type === "cruise" ? addOnVehicleSnapshot.enabled : false,
      add_on_vehicle_type:
        type === "cruise" ? addOnVehicleSnapshot.type : "",
      add_on_vehicle_license_plate:
        type === "cruise" ? addOnVehicleSnapshot.license_plate : "",
      add_on_vehicle_discount_percent:
        type === "cruise" ? addOnVehicleSnapshot.discount_percent : 0,
      add_on_vehicle_original_price:
        type === "cruise" ? addOnVehicleSnapshot.original_price : 0,
      add_on_vehicle_discount_amount:
        type === "cruise" ? addOnVehicleSnapshot.discount_amount : 0,
      add_on_vehicle_price:
        type === "cruise" ? addOnVehicleSnapshot.price : 0,

      details: {
        ...(bookingPayload.details || {}),
        cruise:
          type === "cruise"
            ? {
                ...(bookingPayload.details?.cruise || {}),
                add_on_vehicle: addOnVehicleSnapshot,
              }
            : bookingPayload.details?.cruise,
      },
    };

    const draft = await CheckoutDraft.create({
      user_id: userId,
      type,

      status: "draft",

      payment_provider: paymentMethod,
      payment_method: paymentMethod,
      payment_flow: paymentFlow,
      deposit_type: depositType,

      currency: normalizeLowerString(
        body.currency || bookingPayload.currency || "aud"
      ),

      booking_payload: cleanBookingPayload,
      pricing_snapshot: pricingSnapshot,
      customer_snapshot: getCustomerSnapshot(cleanBookingPayload),

      metadata: {
        source: "frontend_booking_form",
        user_id: userId || "",
        add_on_vehicle_enabled:
          type === "cruise" ? addOnVehicleSnapshot.enabled : false,
        add_on_vehicle_type:
          type === "cruise" ? addOnVehicleSnapshot.type : "",
        add_on_vehicle_license_plate:
          type === "cruise" ? addOnVehicleSnapshot.license_plate : "",
        add_on_vehicle_price:
          type === "cruise" ? addOnVehicleSnapshot.price : 0,
      },
    });

    return Response.json(
      {
        success: true,
        message: "Checkout draft created successfully.",
        data: {
          draft: serializeDraft(draft),
        },

        draft: serializeDraft(draft),

        draftId: draft.draft_reference,
        draft_id: draft.draft_reference,

        checkoutDraftId: draft.draft_reference,
        checkout_draft_id: draft.draft_reference,

        redirectUrl: `/booking/payment?draftId=${encodeURIComponent(
          draft.draft_reference
        )}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Checkout draft creation failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Checkout draft creation failed",
        error: error.message || "Checkout draft creation failed",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    const draftId =
      searchParams.get("draftId") ||
      searchParams.get("draft_id") ||
      searchParams.get("checkoutDraftId") ||
      searchParams.get("checkout_draft_id") ||
      searchParams.get("id") ||
      "";

    const draft = await CheckoutDraft.findOne(buildDraftFilter(draftId));

    if (!draft) {
      throw new Error("Checkout draft not found");
    }

    if (draft.isExpired()) {
      draft.status = "expired";
      await draft.save();

      return Response.json(
        {
          success: false,
          message: "Checkout draft has expired. Please start booking again.",
          error: "Checkout draft has expired. Please start booking again.",
          expired: true,
        },
        { status: 410 }
      );
    }

    return Response.json(
      {
        success: true,
        data: {
          draft: serializeDraft(draft),
        },
        draft: serializeDraft(draft),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Checkout draft fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Checkout draft fetch failed",
        error: error.message || "Checkout draft fetch failed",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}