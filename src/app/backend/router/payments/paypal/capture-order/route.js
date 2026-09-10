import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import Booking from "@/app/backend/models/booking";
import Payment from "@/app/backend/models/payment";
import Coupon from "@/app/backend/models/coupon";
import ParkingUser from "@/app/backend/models/park_user";
import CruiseSchedule from "@/app/backend/models/cruiseschedule";
import Location from "@/app/backend/models/location";
import StorageType from "@/app/backend/models/storagetype";
import CheckoutDraft from "@/app/backend/models/checkoutDraft";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import {
  capturePayPalOrder,
  getPayPalCaptureDetails,
  isPayPalOrderCompleted,
} from "@/app/backend/utils/paypal";
import { sendBookingEmails } from "@/app/backend/utils/sendBookingEmails";
import { createPasswordSetupToken } from "@/app/backend/utils/passwordSetup";

export const runtime = "nodejs";

const FINAL_BOOKING_STATUSES = ["success", "confirmed", "poa"];
const PAID_PAYMENT_STATUSES = ["paid", "partial"];
const ACTIVE_STORAGE_BOOKING_STATUSES = [
  "pending",
  "pending_payment",
  "success",
  "confirmed",
  "poa",
];

function getBookingQuery(bookingId) {
  const value = normalizeString(bookingId);

  if (!value) {
    throw new Error("Booking ID is required.");
  }

  if (mongoose.Types.ObjectId.isValid(value)) {
    return { _id: value };
  }

  return { booking_id: value };
}

function getDraftFilter(draftId) {
  const value = normalizeString(draftId);

  if (!value) {
    throw new Error("Checkout draft ID is required.");
  }

  const conditions = [{ draft_reference: value }];

  if (mongoose.Types.ObjectId.isValid(value)) {
    conditions.push({ _id: value });
  }

  return {
    $or: conditions,
  };
}

function serializePayPalPayload(payload) {
  if (!payload) return null;
  return payload;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase().trim());
  }

  return Boolean(value);
}

function normalizeEmail(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeAmount(amount) {
  const number = Number(amount || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
}

function amountsMatch(expectedAmount, paidAmount) {
  return normalizeAmount(expectedAmount) === normalizeAmount(paidAmount);
}

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (value.includes("booking id")) return 400;
  if (value.includes("checkout draft id")) return 400;
  if (value.includes("order id")) return 400;
  if (value.includes("draft has expired")) return 410;
  if (value.includes("draft is not ready")) return 409;

  if (
    value.includes("fully booked") ||
    value.includes("no storage slots") ||
    value.includes("no capacity")
  ) {
    return 409;
  }

  if (value.includes("not found")) return 404;
  if (value.includes("not configured")) return 400;
  if (value.includes("not awaiting")) return 400;
  if (value.includes("payment flow")) return 400;
  if (value.includes("does not match")) return 400;
  if (value.includes("amount")) return 400;
  if (value.includes("already")) return 200;

  return 500;
}

function getPaymentPurposeFromFlow(paymentFlow) {
  if (paymentFlow === "poa_deposit") {
    return "poa_holding_deposit";
  }

  return "full_online_payment";
}

function getDepositTypeFromFlow(paymentFlow) {
  if (paymentFlow === "poa_deposit") {
    return "poa";
  }

  return "full";
}

function getPaymentPurpose(booking) {
  return getPaymentPurposeFromFlow(booking.payment_flow);
}

function getDepositType(booking) {
  return getDepositTypeFromFlow(booking.payment_flow);
}

function isPoaDepositBooking(booking) {
  return booking?.payment_flow === "poa_deposit";
}

function isPoaDepositPaid(booking) {
  return (
    isPoaDepositBooking(booking) &&
    booking.payment_status === "partial" &&
    booking.status === "poa"
  );
}

function isFullPaymentPaid(booking) {
  return (
    booking.payment_status === "paid" ||
    booking.status === "success" ||
    booking.status === "confirmed"
  );
}

function isBookingFinalOrPaid(booking) {
  if (!booking) return false;

  return (
    PAID_PAYMENT_STATUSES.includes(String(booking.payment_status || "")) ||
    FINAL_BOOKING_STATUSES.includes(String(booking.status || ""))
  );
}

function getAlreadyPaidResponse(booking) {
  const redirectUrl = `/booking/success?bookingId=${booking.booking_id}`;

  if (isPoaDepositPaid(booking)) {
    return {
      success: true,
      message: "This Pay on Arrival holding deposit has already been paid.",
      alreadyPaid: true,
      redirectUrl,
      booking: serializeBookingForResponse(booking),
    };
  }

  return {
    success: true,
    message: "This booking has already been paid.",
    alreadyPaid: true,
    redirectUrl,
    booking: serializeBookingForResponse(booking),
  };
}

function getDraftAlreadyCompletedResponse(draft) {
  return {
    success: true,
    message: "This checkout draft has already been completed.",
    alreadyPaid: true,
    redirectUrl: draft.booking_public_id
      ? `/booking/success?bookingId=${draft.booking_public_id}`
      : `/booking/success?draftId=${draft.draft_reference}`,
    draft: serializeDraftForResponse(draft),
  };
}

async function createPasswordSetupUrlIfNeeded(userId) {
  if (!userId) return null;

  const user = await ParkingUser.findById(userId).select(
    "+password +password_setup_token +password_setup_expires"
  );

  if (!user || user.password) {
    return null;
  }

  const { rawToken, hashedToken, expires } = createPasswordSetupToken();

  user.password_setup_token = hashedToken;
  user.password_setup_expires = expires;

  await user.save();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return `${appUrl}/set-password?token=${rawToken}`;
}

async function getPopulatedBooking(bookingId) {
  return Booking.findById(bookingId)
    .populate("location_id")
    .populate("schedule_id")
    .populate("user_id", "name email phone role")
    .populate("coupon_id")
    .populate("details.storage.storage_type_id")
    .populate({
      path: "wallet_transaction_id",
      model: WalletTransaction,
      select:
        "transaction_reference transaction_id amount method status",
    });
}

async function sendPaidBookingEmails(booking) {
  try {
    const passwordSetupUrl = await createPasswordSetupUrlIfNeeded(
      booking.user_id
    );

    const populatedBooking = await getPopulatedBooking(booking._id);

    if (!populatedBooking) return;

    await sendBookingEmails({
      booking: populatedBooking,
      adminEmail: process.env.BOOKING_ADMIN_EMAIL,
      passwordSetupUrl,
    });

    await Booking.findByIdAndUpdate(booking._id, {
      last_email_sent_at: new Date(),
      $inc: {
        email_sent_count: 1,
      },
    });
  } catch (emailError) {
    console.error("PayPal capture: booking paid but email failed", emailError);
  }
}

async function incrementCouponUsageIfNeeded(booking) {
  if (!booking?.coupon_id) return;

  await Coupon.findByIdAndUpdate(booking.coupon_id, {
    $inc: {
      used_count: 1,
    },
  });
}

async function generateBookingId(prefix = "BK") {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    const bookingId = `${prefix}${timestamp}${random}`;

    const exists = await Booking.exists({ booking_id: bookingId });

    if (!exists) {
      return bookingId;
    }
  }

  return `${prefix}${Date.now()}${Math.floor(100000 + Math.random() * 900000)}`;
}

async function findOrCreateDraftCustomer(draft, session) {
  if (draft.user_id) {
    const existingUser = await ParkingUser.findById(draft.user_id).session(
      session
    );

    if (existingUser) {
      return existingUser;
    }
  }

  const bookingPayload = draft.booking_payload || {};
  const customerSnapshot = draft.customer_snapshot || {};

  const firstName = normalizeString(
    bookingPayload.first_name || customerSnapshot.first_name
  );
  const lastName = normalizeString(
    bookingPayload.last_name || customerSnapshot.last_name
  );
  const name = normalizeString(
    bookingPayload.name || `${firstName} ${lastName}`.trim()
  );
  const email = normalizeEmail(bookingPayload.email || customerSnapshot.email);
  const phone = normalizeString(bookingPayload.phone || customerSnapshot.phone);

  if (!name) {
    throw new Error("Customer name is required for checkout draft booking");
  }

  if (!email) {
    throw new Error("Customer email is required for checkout draft booking");
  }

  if (!phone) {
    throw new Error("Customer phone is required for checkout draft booking");
  }

  const existingUser = await ParkingUser.findOne({ email }).session(session);

  if (existingUser) {
    let changed = false;

    if (!existingUser.name && name) {
      existingUser.name = name;
      changed = true;
    }

    if (!existingUser.phone && phone) {
      existingUser.phone = phone;
      changed = true;
    }

    if (changed) {
      await existingUser.save({ session });
    }

    return existingUser;
  }

  const users = await ParkingUser.create(
    [
      {
        name,
        email,
        phone,
        role: "customer",
        is_active: true,
      },
    ],
    { session }
  );

  return users[0];
}

function getObjectIdOrNull(value) {
  const id = normalizeString(value);

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return new mongoose.Types.ObjectId(id);
}

async function findCouponForDraft(draft, session) {
  const code = normalizeString(
    draft.pricing_snapshot?.coupon_code || draft.booking_payload?.coupon_code
  ).toUpperCase();

  if (!code) return null;

  return Coupon.findOne({
    $or: [{ code }, { coupon_code: code }],
  }).session(session);
}

function getExpectedDraftAmount(draft) {
  return normalizeAmount(
    draft?.pricing_snapshot?.amount_due_now ||
      draft?.booking_payload?.due_amount ||
      draft?.booking_payload?.amount_due_now ||
      0
  );
}

function getDraftBookingTotal(draft, fallbackAmount) {
  return normalizeAmount(
    draft?.pricing_snapshot?.price ||
      draft?.booking_payload?.price ||
      draft?.booking_payload?.total_amount ||
      fallbackAmount
  );
}

function getDraftHoldingDeposit(draft, fallbackAmount) {
  if (draft.payment_flow !== "poa_deposit") return 0;

  return normalizeAmount(
    draft?.pricing_snapshot?.holding_deposit_amount ||
      draft?.booking_payload?.holding_deposit_amount ||
      fallbackAmount
  );
}

function getDraftAddOnVehicleSnapshot(draft) {
  const payload = draft?.booking_payload || {};
  const pricingAddOn = draft?.pricing_snapshot?.add_on_vehicle || {};
  const payloadAddOn = payload?.details?.cruise?.add_on_vehicle || {};

  const enabled = normalizeBoolean(
    payload.add_on_vehicle_enabled ??
      payloadAddOn.enabled ??
      pricingAddOn.enabled
  );

  const type = normalizeString(
    payload.add_on_vehicle_type || payloadAddOn.type || pricingAddOn.type
  );

  const licensePlate = normalizeString(
    payload.add_on_vehicle_license_plate ||
      payloadAddOn.license_plate ||
      pricingAddOn.license_plate
  ).toUpperCase();

  const discountPercent = normalizeAmount(
    payload.add_on_vehicle_discount_percent ||
      payloadAddOn.discount_percent ||
      pricingAddOn.discount_percent ||
      10
  );

  const originalPrice = normalizeAmount(
    payload.add_on_vehicle_original_price ||
      payloadAddOn.original_price ||
      pricingAddOn.original_price ||
      0
  );

  const discountAmount = normalizeAmount(
    payload.add_on_vehicle_discount_amount ||
      payloadAddOn.discount_amount ||
      pricingAddOn.discount_amount ||
      0
  );

  const price = normalizeAmount(
    payload.add_on_vehicle_price || payloadAddOn.price || pricingAddOn.price || 0
  );

  if (!enabled) {
    return {
      enabled: false,
      type: "",
      license_plate: "",
      discount_percent: 0,
      original_price: 0,
      discount_amount: 0,
      price: 0,
    };
  }

  if (!type) {
    throw new Error("Add-on vehicle type is required for checkout draft booking");
  }

  if (!licensePlate) {
    throw new Error(`${type} License Plate is required`);
  }

  return {
    enabled: true,
    type,
    license_plate: licensePlate,
    discount_percent: discountPercent || 10,
    original_price: originalPrice,
    discount_amount: discountAmount,
    price,
  };
}

async function buildCruiseBookingFromDraft({
  draft,
  captureDetails,
  captureResult,
  session,
}) {
  const payload = draft.booking_payload || {};
  const pricing = draft.pricing_snapshot || {};
  const addOnVehicle = getDraftAddOnVehicleSnapshot(draft);

  const scheduleId = normalizeString(payload.schedule_id);

  if (!scheduleId || !mongoose.Types.ObjectId.isValid(scheduleId)) {
    throw new Error("Valid cruise schedule ID is required for checkout draft");
  }

  const schedule = await CruiseSchedule.findById(scheduleId).session(session);

  if (!schedule) {
    throw new Error("Cruise schedule not found for checkout draft");
  }

  const customerUser = await findOrCreateDraftCustomer(draft, session);
  const coupon = await findCouponForDraft(draft, session);
  const bookingId = await generateBookingId("BK");

  const paidAmount = normalizeAmount(captureDetails.amount || 0);
  const price = normalizeAmount(pricing.price || payload.price || paidAmount);
  const originalPrice = normalizeAmount(
    payload.total_before_discount ||
      payload.original_price ||
      payload.parking_price ||
      price + normalizeAmount(pricing.discount_amount || payload.discount_amount)
  );
  const discountAmount = normalizeAmount(
    pricing.discount_amount ||
      payload.discount_amount ||
      Math.max(originalPrice - price, 0)
  );

  const isPoaDeposit = draft.payment_flow === "poa_deposit";
  const dueAmount = isPoaDeposit
    ? normalizeAmount(Math.max(price - paidAmount, 0))
    : 0;

  const bookingStatus = isPoaDeposit ? "poa" : "success";
  const paymentStatus = isPoaDeposit ? "partial" : "paid";

  const carParkToTerminalPassengers = Number(
    payload.car_park_to_terminal_passengers ||
      payload.details?.cruise?.car_park_to_terminal_passengers ||
      0
  );

  const terminalToCarParkPassengers = Number(
    payload.terminal_to_car_park_passengers ||
      payload.details?.cruise?.terminal_to_car_park_passengers ||
      0
  );

  const maxPassengers = Math.max(
    Number(payload.pax || 0),
    carParkToTerminalPassengers,
    terminalToCarParkPassengers,
    1
  );

  const carParkToTerminalTime = normalizeString(
    payload.car_park_to_terminal_shuttle_time ||
      payload.details?.cruise?.car_park_to_terminal_shuttle_time ||
      payload.shuttle_time
  );

  const terminalToCarParkTime = normalizeString(
    payload.terminal_to_car_park_shuttle_time ||
      payload.details?.cruise?.terminal_to_car_park_shuttle_time ||
      ""
  );

  if (!carParkToTerminalTime) {
    throw new Error("Car park to terminal shuttle time is required");
  }

  const createdBookings = await Booking.create(
    [
      {
        booking_id: bookingId,
        user_id: customerUser._id,
        location_id: schedule.location_id,
        schedule_id: schedule._id,
        type: "cruise",
        start_date: schedule.departure_date,
        end_date: schedule.return_date,
        pax: maxPassengers,
        license_plate: normalizeString(payload.license_plate).toUpperCase(),

        add_on_vehicle_enabled: addOnVehicle.enabled,
        add_on_vehicle_type: addOnVehicle.type,
        add_on_vehicle_license_plate: addOnVehicle.license_plate,
        add_on_vehicle_discount_percent: addOnVehicle.discount_percent,
        add_on_vehicle_original_price: addOnVehicle.original_price,
        add_on_vehicle_discount_amount: addOnVehicle.discount_amount,
        add_on_vehicle_price: addOnVehicle.price,

        interlock: Boolean(payload.interlock),
        reference: normalizeString(payload.reference),
        notes: normalizeString(payload.notes),
        parking_slot: normalizeString(payload.parking_slot),
        details: {
          pricing: {
            price_rule_id: getObjectIdOrNull(
              payload.price_rule_id ||
                payload.details?.pricing?.price_rule_id ||
                pricing.price_rule_id
            ),
            calculated_days: Number(
              payload.calculated_days ||
                payload.details?.pricing?.calculated_days ||
                0
            ),
            parking_price: normalizeAmount(
              payload.parking_price ||
                payload.details?.pricing?.parking_price ||
                0
            ),
            included_shuttle_passengers: Number(
              payload.details?.pricing?.included_shuttle_passengers || 4
            ),
            extra_passenger_unit_fee: Number(
              payload.details?.pricing?.extra_passenger_unit_fee || 5
            ),
            extra_passenger_count: Number(payload.extra_passenger_count || 0),
            extra_passenger_fee: normalizeAmount(payload.extra_passenger_fee || 0),
            add_on_vehicle_original_price: addOnVehicle.original_price,
            add_on_vehicle_discount_percent: addOnVehicle.discount_percent,
            add_on_vehicle_discount_amount: addOnVehicle.discount_amount,
            add_on_vehicle_price: addOnVehicle.price,
            total_before_discount: normalizeAmount(
              payload.total_before_discount ||
                payload.details?.pricing?.total_before_discount ||
                price
            ),
          },
          cruise: {
            ship_name:
              schedule.schedule_name || schedule.ship_name || payload.ship_name || "Cruise",
            shuttle_time: carParkToTerminalTime,
            shuttle_slot_id: getObjectIdOrNull(
              payload.car_park_to_terminal_shuttle_slot_id ||
                payload.shuttle_slot_id
            ),
            parking_slot: normalizeString(payload.parking_slot),
            pickup_pax: maxPassengers,
            pickup_pax_pro: 0,

            car_park_to_terminal_passengers: carParkToTerminalPassengers,
            car_park_to_terminal_shuttle_slot_id: getObjectIdOrNull(
              payload.car_park_to_terminal_shuttle_slot_id
            ),
            car_park_to_terminal_shuttle_time: carParkToTerminalTime,
            terminal_to_car_park_passengers: terminalToCarParkPassengers,
            terminal_to_car_park_shuttle_slot_id: getObjectIdOrNull(
              payload.terminal_to_car_park_shuttle_slot_id
            ),
            terminal_to_car_park_shuttle_time: terminalToCarParkTime,
            extra_passenger_count: Number(payload.extra_passenger_count || 0),
            extra_passenger_fee: normalizeAmount(payload.extra_passenger_fee || 0),
            add_on_vehicle: addOnVehicle,
          },
        },
        customer: {
          name: customerUser.name,
          email: customerUser.email,
          phone: customerUser.phone,
        },
        pricing_type: "fixed",
        currency: String(draft.currency || captureDetails.currency || "aud").toLowerCase(),
        original_price: originalPrice || price,
        price,
        discount_amount: discountAmount,
        coupon_code: coupon
          ? normalizeString(coupon.code || coupon.coupon_code).toUpperCase()
          : null,
        coupon_id: coupon?._id || null,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        wallet_used: 0,
        payment_flow: draft.payment_flow,
        deposit_type: draft.deposit_type,
        payment_method: "paypal",
        holding_deposit_amount: isPoaDeposit
          ? normalizeAmount(pricing.holding_deposit_amount || paidAmount)
          : 0,
        balance_due_on_arrival: dueAmount,
        payment_status: paymentStatus,
        paypal_order_id: captureDetails.orderId || draft.paypal_order_id,
        paypal_capture_id: captureDetails.captureId,
        payment_completed_at: new Date(),
        status: bookingStatus,
        source: payload.source || "web",
        status_history: [
          {
            status: bookingStatus,
            note: isPoaDeposit
              ? `PayPal holding deposit confirmed from checkout draft ${draft.draft_reference}`
              : `PayPal full payment confirmed from checkout draft ${draft.draft_reference}`,
            changed_by: null,
            date: new Date(),
          },
        ],
      },
    ],
    { session }
  );

  await CruiseSchedule.updateOne(
    { _id: schedule._id },
    {
      $inc: {
        booked_count: 1,
      },
    },
    { session }
  );

  return createdBookings[0];
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
 * Validate final Storage availability.
 *
 * Capacity rules:
 * - StorageType.capacity === 0 => Unlimited
 * - Location.capacity === 0 => Unlimited
 *
 * Storage Type capacity is global across Storage locations.
 * Location capacity is a separate overall limit.
 *
 * Storage dates are inclusive:
 * - 09 Sep -> 09 Sep = 1 occupied day
 * - 04 Sep -> 05 Sep = 2 occupied days
 */
async function validateStorageCapacity({
  storageType,
  location,
  startDate,
  endDate,
  session = null,
}) {
  if (!storageType) {
    throw new Error("Storage type not found for checkout draft");
  }

  if (!location) {
    throw new Error("Storage location not found for checkout draft");
  }

  if (location.type !== "storage") {
    throw new Error("Selected location is not a storage location");
  }

  if (location.is_active === false) {
    throw new Error("Selected storage location is not active");
  }

  if (storageType.is_active === false) {
    throw new Error("Selected storage type is inactive");
  }

  if (!locationSupportsStorageType(location, storageType)) {
    throw new Error(
      `This location does not support ${storageType.name} storage`
    );
  }

  const storageTypeCapacity = normalizeCapacity(storageType.capacity);

  if (storageTypeCapacity > 0) {
    const storageTypeCountQuery = Booking.countDocuments({
      type: "storage",
      "details.storage.storage_type_id": storageType._id,
      status: {
        $in: ACTIVE_STORAGE_BOOKING_STATUSES,
      },
      start_date: {
        $lte: endDate,
      },
      end_date: {
        $gte: startDate,
      },
    });

    if (session) {
      storageTypeCountQuery.session(session);
    }

    const storageTypeBookedCount = await storageTypeCountQuery;

    if (storageTypeBookedCount >= storageTypeCapacity) {
      throw new Error(
        `${storageType.name} storage is fully booked for the selected dates`
      );
    }
  }

  const locationCapacity = normalizeCapacity(location.capacity);

  if (locationCapacity > 0) {
    const locationCountQuery = Booking.countDocuments({
      type: "storage",
      location_id: location._id,
      status: {
        $in: ACTIVE_STORAGE_BOOKING_STATUSES,
      },
      start_date: {
        $lte: endDate,
      },
      end_date: {
        $gte: startDate,
      },
    });

    if (session) {
      locationCountQuery.session(session);
    }

    const locationBookedCount = await locationCountQuery;

    if (locationBookedCount >= locationCapacity) {
      throw new Error(
        `${location.name} has no storage slots available for the selected dates`
      );
    }
  }
}

/**
 * Re-check Storage availability immediately before PayPal capture.
 *
 * This avoids charging the customer when capacity is already full before the
 * PayPal capture request is sent.
 */
async function validateStorageDraftBeforePayPalCapture(draft) {
  if (draft?.type !== "storage") {
    return;
  }

  const payload = draft.booking_payload || {};

  const storageTypeId = getObjectIdOrNull(payload.storage_type_id);
  const locationId = getObjectIdOrNull(payload.location_id);

  if (!storageTypeId) {
    throw new Error("Valid storage type ID is required for checkout draft");
  }

  if (!locationId) {
    throw new Error("Valid storage location ID is required for checkout draft");
  }

  const startDate = payload.start_date ? new Date(payload.start_date) : null;
  const endDate = payload.end_date ? new Date(payload.end_date) : null;

  if (!startDate || Number.isNaN(startDate.getTime())) {
    throw new Error("Valid start date is required for checkout draft");
  }

  if (!endDate || Number.isNaN(endDate.getTime())) {
    throw new Error("Valid end date is required for checkout draft");
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

  await validateStorageCapacity({
    storageType,
    location,
    startDate,
    endDate,
  });
}

async function buildNonCruiseBookingFromDraft({
  draft,
  captureDetails,
  captureResult,
  session,
}) {
  const payload = draft.booking_payload || {};
  const pricing = draft.pricing_snapshot || {};

  if (!['storage', 'airport'].includes(draft.type)) {
    throw new Error(`Unsupported checkout draft booking type: ${draft.type}`);
  }

  const locationId = getObjectIdOrNull(payload.location_id);

  if (!locationId) {
    throw new Error('Valid location ID is required for checkout draft');
  }

  const location = await Location.findById(locationId).session(session);

  if (!location) {
    throw new Error('Location not found for checkout draft');
  }

  const startDate = payload.start_date ? new Date(payload.start_date) : null;
  const endDate = payload.end_date ? new Date(payload.end_date) : null;

  if (!startDate || Number.isNaN(startDate.getTime())) {
    throw new Error('Valid start date is required for checkout draft');
  }

  if (!endDate || Number.isNaN(endDate.getTime())) {
    throw new Error('Valid end date is required for checkout draft');
  }

  // Storage and Airport use inclusive calendar-day booking.
  // Same-day entry/exit is valid; only reject an exit before entry.
  if (endDate < startDate) {
    throw new Error('Exit date cannot be before entry date');
  }

  const customerUser = await findOrCreateDraftCustomer(draft, session);
  const coupon = await findCouponForDraft(draft, session);
  const bookingId = await generateBookingId('BK');

  const paidAmount = normalizeAmount(captureDetails.amount || 0);
  const price = normalizeAmount(pricing.price || payload.price || paidAmount);
  const discountAmount = normalizeAmount(
    pricing.discount_amount || payload.discount_amount || 0
  );
  const originalPrice = normalizeAmount(
    payload.total_before_discount ||
      payload.original_price ||
      (price + discountAmount)
  );

  const isPoaDeposit = draft.payment_flow === 'poa_deposit';
  const dueAmount = isPoaDeposit
    ? normalizeAmount(Math.max(price - paidAmount, 0))
    : 0;

  const bookingStatus = isPoaDeposit ? 'poa' : 'success';
  const paymentStatus = isPoaDeposit ? 'partial' : 'paid';

  let storageType = null;
  const storageTypeId = getObjectIdOrNull(payload.storage_type_id);

  if (draft.type === 'storage') {
    if (!storageTypeId) {
      throw new Error('Valid storage type ID is required for checkout draft');
    }

    storageType = await StorageType.findById(storageTypeId).session(session);

    if (!storageType) {
      throw new Error('Storage type not found for checkout draft');
    }

    await validateStorageCapacity({
      storageType,
      location,
      startDate,
      endDate,
      session,
    });
  }

  const calculatedDays = Number(
    payload.calculated_days ||
      payload.details?.pricing?.calculated_days ||
      0
  );

  const details = {
    pricing: {
      price_rule_id: getObjectIdOrNull(
        payload.price_rule_id ||
          payload.details?.pricing?.price_rule_id ||
          pricing.price_rule_id
      ),
      calculated_days:
        Number.isFinite(calculatedDays) && calculatedDays > 0
          ? calculatedDays
          : 0,
    },
  };

  if (draft.type === 'storage') {
    details.storage = {
      storage_type_id: storageTypeId,
      storage_type_name:
        storageType?.name || payload.storage_type_name || payload.storage_type || '',
      storage_type:
        storageType?.name || payload.storage_type_name || payload.storage_type || '',
    };
  }

  if (draft.type === 'airport') {
    details.airport = {
      shuttle_time: normalizeString(payload.shuttle_time),
      shuttle_slot_id: getObjectIdOrNull(payload.shuttle_slot_id),
      parking_slot: normalizeString(payload.parking_slot),
      pickup_pax: Number(payload.pax || payload.pickup_pax || 0),
      flight_number: normalizeString(payload.flight_number),
      terminal: normalizeString(payload.terminal),
    };
  }

  const createdBookings = await Booking.create(
    [
      {
        booking_id: bookingId,
        user_id: customerUser._id,
        location_id: location._id,
        schedule_id: null,
        type: draft.type,
        start_date: startDate,
        end_date: endDate,
        pax:
          draft.type === 'airport'
            ? Number(payload.pax || payload.pickup_pax || 0)
            : 0,
        license_plate: normalizeString(payload.license_plate).toUpperCase(),
        interlock: Boolean(payload.interlock),
        reference: normalizeString(payload.reference || payload.license_plate),
        notes: normalizeString(payload.notes),
        parking_slot: normalizeString(payload.parking_slot),
        details,
        customer: {
          name: customerUser.name,
          email: customerUser.email,
          phone: customerUser.phone,
        },
        pricing_type: 'fixed',
        currency: String(draft.currency || captureDetails.currency || 'aud').toLowerCase(),
        original_price: originalPrice || price,
        price,
        discount_amount: discountAmount,
        coupon_code: coupon
          ? normalizeString(coupon.code || coupon.coupon_code).toUpperCase()
          : null,
        coupon_id: coupon?._id || null,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        wallet_used: 0,
        payment_flow: draft.payment_flow,
        deposit_type: draft.deposit_type,
        payment_method: 'paypal',
        holding_deposit_amount: isPoaDeposit
          ? normalizeAmount(pricing.holding_deposit_amount || paidAmount)
          : 0,
        balance_due_on_arrival: dueAmount,
        payment_status: paymentStatus,
        paypal_order_id: captureDetails.orderId || draft.paypal_order_id,
        paypal_capture_id: captureDetails.captureId,
        payment_completed_at: new Date(),
        status: bookingStatus,
        source: payload.source || 'web',
        status_history: [
          {
            status: bookingStatus,
            note: isPoaDeposit
              ? `PayPal holding deposit confirmed from checkout draft ${draft.draft_reference}`
              : `PayPal full payment confirmed from checkout draft ${draft.draft_reference}`,
            changed_by: null,
            date: new Date(),
          },
        ],
      },
    ],
    { session }
  );

  return createdBookings[0];
}

async function upsertPayPalPayment({
  orderId,
  captureDetails,
  captureResult,
  booking = null,
  draft = null,
  status,
  amount,
  currency,
  failureReason = "",
  session = null,
}) {
  const paymentFlow = booking?.payment_flow || draft?.payment_flow || "";
  const depositType = booking?.deposit_type || draft?.deposit_type || "";
  const paymentPurpose = getPaymentPurposeFromFlow(paymentFlow);

  const payload = {
    amount: normalizeAmount(amount),
    currency: String(currency || captureDetails?.currency || "aud").toLowerCase(),

    method: "paypal",
    status,

    payment_flow: paymentFlow,
    deposit_type: depositType,
    payment_purpose: paymentPurpose,

    transaction_id: captureDetails?.captureId || orderId,
    provider_order_id: orderId,
    provider_capture_id: captureDetails?.captureId || undefined,
    provider_payload: serializePayPalPayload(captureResult),

    booking_total_amount: normalizeAmount(
      booking?.price || draft?.pricing_snapshot?.price || amount || 0
    ),
    holding_deposit_amount: normalizeAmount(
      booking?.holding_deposit_amount ||
        draft?.pricing_snapshot?.holding_deposit_amount ||
        0
    ),
    balance_due_on_arrival: normalizeAmount(
      booking?.balance_due_on_arrival ||
        draft?.pricing_snapshot?.balance_due_on_arrival ||
        0
    ),
  };

  if (booking) {
    payload.booking_id = booking._id;
    payload.user_id = booking.user_id;
  }

  if (draft) {
    const addOnVehicle =
      draft.type === "cruise" ? getDraftAddOnVehicleSnapshot(draft) : null;

    payload.metadata = {
      ...(payload.metadata || {}),
      checkout_draft_id: String(draft._id),
      checkout_draft_reference: draft.draft_reference,
      add_on_vehicle_enabled: addOnVehicle?.enabled || false,
      add_on_vehicle_type: addOnVehicle?.type || "",
      add_on_vehicle_license_plate: addOnVehicle?.license_plate || "",
      add_on_vehicle_price: addOnVehicle?.price || 0,
    };
  }

  if (failureReason) {
    payload.failure_reason = failureReason;
  }

  if (status === "paid") {
    payload.paid_at = new Date();
  }

  const options = {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  };

  if (session) {
    options.session = session;
  }

  return Payment.findOneAndUpdate(
    {
      provider_order_id: orderId,
    },
    payload,
    options
  );
}

async function createBookingFromCheckoutDraft({
  draft,
  orderId,
  captureDetails,
  captureResult,
}) {
  if (!draft) {
    throw new Error("Checkout draft not found");
  }

  if (draft.booking_id) {
    const existingBooking = await Booking.findById(draft.booking_id);

    if (existingBooking) {
      return existingBooking;
    }
  }

  const session = await mongoose.startSession();
  let booking = null;

  try {
    await session.withTransaction(async () => {
      const lockedDraft = await CheckoutDraft.findOneAndUpdate(
        {
          _id: draft._id,
          status: {
            $nin: ["completed", "cancelled", "expired"],
          },
        },
        {
          $set: {
            status: "payment_processing",
            locked_at: new Date(),
            paypal_order_id: orderId,
            provider_payload: serializePayPalPayload(captureResult),
            payment_error: "",
          },
        },
        {
          new: true,
          session,
        }
      );

      if (!lockedDraft) {
        const completedDraft = await CheckoutDraft.findById(draft._id).session(
          session
        );

        if (completedDraft?.booking_id) {
          booking = await Booking.findById(completedDraft.booking_id).session(
            session
          );
          return;
        }

        throw new Error("Checkout draft could not be locked for completion");
      }

      booking =
        lockedDraft.type === "cruise"
          ? await buildCruiseBookingFromDraft({
              draft: lockedDraft,
              captureDetails,
              captureResult,
              session,
            })
          : await buildNonCruiseBookingFromDraft({
              draft: lockedDraft,
              captureDetails,
              captureResult,
              session,
            });

      lockedDraft.status = "completed";
      lockedDraft.paid_at = lockedDraft.paid_at || new Date();
      lockedDraft.completed_at = new Date();
      lockedDraft.booking_id = booking._id;
      lockedDraft.booking_public_id = booking.booking_id;
      lockedDraft.paypal_order_id = orderId;
      lockedDraft.provider_payload = serializePayPalPayload(captureResult);
      lockedDraft.payment_error = "";

      await lockedDraft.save({ session });

      await upsertPayPalPayment({
        orderId,
        captureDetails,
        captureResult,
        booking,
        draft: lockedDraft,
        status: "paid",
        amount: captureDetails.amount,
        currency: captureDetails.currency || lockedDraft.currency || "aud",
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  return booking;
}

function serializeBookingForResponse(booking) {
  if (!booking) return null;

  return {
    _id: booking._id,
    booking_id: booking.booking_id,
    type: booking.type,

    status: booking.status,
    payment_status: booking.payment_status,
    payment_method: booking.payment_method,
    payment_flow: booking.payment_flow,
    deposit_type: booking.deposit_type,

    price: booking.price,
    total_amount: booking.price,
    paid_amount: booking.paid_amount,
    due_amount: booking.due_amount,

    holding_deposit_amount: booking.holding_deposit_amount,
    balance_due_on_arrival: booking.balance_due_on_arrival,

    currency: booking.currency || "aud",
    paypal_order_id: booking.paypal_order_id,
    paypal_capture_id: booking.paypal_capture_id,
  };
}

function serializeDraftForResponse(draft) {
  if (!draft) return null;

  return {
    _id: draft._id,
    draft_reference: draft.draft_reference,
    status: draft.status,
    payment_method: draft.payment_method,
    payment_flow: draft.payment_flow,
    deposit_type: draft.deposit_type,
    paypal_order_id: draft.paypal_order_id,
    booking_id: draft.booking_id,
    booking_public_id: draft.booking_public_id,
  };
}

async function captureCheckoutDraftOrder({ draft, orderId }) {
  if (!draft) {
    throw new Error("Checkout draft not found.");
  }

  if (typeof draft.isExpired === "function" && draft.isExpired()) {
    draft.status = "expired";
    await draft.save();
    throw new Error("Checkout draft has expired. Please start booking again.");
  }

  if (draft.status === "completed" || draft.booking_public_id) {
    return Response.json(getDraftAlreadyCompletedResponse(draft), {
      status: 200,
    });
  }

  if (draft.payment_method !== "paypal" && draft.payment_provider !== "paypal") {
    throw new Error(
      `This checkout draft is not configured for PayPal payment. Current method: ${
        draft.payment_method || draft.payment_provider || "-"
      }`
    );
  }

  if (!["full_online", "poa_deposit"].includes(draft.payment_flow)) {
    throw new Error(
      "Invalid PayPal payment flow. PayPal supports full online payment and Pay on Arrival holding deposit."
    );
  }

  if (
    draft.paypal_order_id &&
    String(draft.paypal_order_id) !== String(orderId)
  ) {
    throw new Error("PayPal order ID does not match this checkout draft.");
  }

  if (draft.type === "storage") {
    await validateStorageDraftBeforePayPalCapture(draft);
  }

  let captureResult = null;

  try {
    captureResult = await capturePayPalOrder(orderId);
  } catch (captureError) {
    const freshDraft = await CheckoutDraft.findById(draft._id);

    if (freshDraft?.booking_public_id || freshDraft?.status === "completed") {
      return Response.json(getDraftAlreadyCompletedResponse(freshDraft), {
        status: 200,
      });
    }

    throw captureError;
  }

  const captureDetails = getPayPalCaptureDetails(captureResult);

  const expectedAmount = getExpectedDraftAmount(draft);
  const paidAmount = normalizeAmount(captureDetails.amount || expectedAmount);
  const currency = String(
    captureDetails.currency || draft.currency || "aud"
  ).toLowerCase();

  if (!isPayPalOrderCompleted(captureResult)) {
    const failureReason = `PayPal payment was not completed. Status: ${
      captureDetails.status || captureDetails.captureStatus || "unknown"
    }`;

    draft.status = "failed";
    draft.failed_at = new Date();
    draft.payment_error = failureReason;
    draft.provider_payload = serializePayPalPayload(captureResult);
    await draft.save();

    await upsertPayPalPayment({
      orderId,
      captureDetails,
      captureResult,
      draft,
      status: "failed",
      amount: expectedAmount,
      currency,
      failureReason,
    });

    return Response.json(
      {
        success: false,
        message: failureReason,
        error: failureReason,
        order: captureResult,
      },
      { status: 400 }
    );
  }

  if (!amountsMatch(expectedAmount, paidAmount)) {
    const failureReason = `PayPal paid amount does not match checkout payable amount. Expected AUD ${expectedAmount.toFixed(
      2
    )}, received AUD ${paidAmount.toFixed(2)}.`;

    draft.status = "failed";
    draft.failed_at = new Date();
    draft.payment_error = failureReason;
    draft.provider_payload = serializePayPalPayload(captureResult);
    await draft.save();

    await upsertPayPalPayment({
      orderId,
      captureDetails,
      captureResult,
      draft,
      status: "failed",
      amount: paidAmount,
      currency,
      failureReason,
    });

    return Response.json(
      {
        success: false,
        message: failureReason,
        error: failureReason,
      },
      { status: 400 }
    );
  }

  let booking = null;

  try {
    booking = await createBookingFromCheckoutDraft({
      draft,
      orderId,
      captureDetails: {
        ...captureDetails,
        amount: paidAmount,
        currency,
      },
      captureResult,
    });
  } catch (error) {
    const paymentError =
      error?.message || "PayPal payment captured but booking creation failed";

    console.error(
      "PayPal payment captured but checkout draft booking creation failed:",
      {
        draftId: draft._id,
        draftReference: draft.draft_reference,
        orderId,
        captureId: captureDetails.captureId,
        error: paymentError,
      }
    );

    const freshDraft = await CheckoutDraft.findById(draft._id);

    if (
      freshDraft?.booking_public_id ||
      freshDraft?.status === "completed"
    ) {
      return Response.json(getDraftAlreadyCompletedResponse(freshDraft), {
        status: 200,
      });
    }

    const draftForUpdate = freshDraft || draft;

    draftForUpdate.status = "failed";
    draftForUpdate.failed_at = new Date();
    draftForUpdate.paid_at = draftForUpdate.paid_at || new Date();
    draftForUpdate.payment_error = paymentError;
    draftForUpdate.paypal_order_id = orderId;
    draftForUpdate.provider_payload = serializePayPalPayload(captureResult);

    await draftForUpdate.save();

    await upsertPayPalPayment({
      orderId,
      captureDetails,
      captureResult,
      draft: draftForUpdate,
      status: "paid",
      amount: paidAmount,
      currency,
      failureReason: paymentError,
    });

    return Response.json(
      {
        success: false,
        paymentCaptured: true,
        payment_captured: true,
        bookingCreated: false,
        booking_created: false,
        message: paymentError,
        error: paymentError,
        orderId,
        order_id: orderId,
        captureId: captureDetails.captureId,
        capture_id: captureDetails.captureId,
        draft: serializeDraftForResponse(draftForUpdate),
      },
      {
        status: getErrorStatus(paymentError),
      }
    );
  }

  await incrementCouponUsageIfNeeded(booking);
  await sendPaidBookingEmails(booking);

  return Response.json(
    {
      success: true,
      checkout_draft: true,
      message:
        draft.payment_flow === "poa_deposit"
          ? "PayPal holding deposit captured successfully."
          : "PayPal payment captured successfully.",
      redirectUrl: `/booking/success?bookingId=${booking.booking_id}`,
      redirect_url: `/booking/success?bookingId=${booking.booking_id}`,
      orderId,
      order_id: orderId,
      captureId: captureDetails.captureId,
      capture_id: captureDetails.captureId,
      order: captureResult,
      draft: serializeDraftForResponse({
        ...draft.toObject?.() || draft,
        booking_id: booking._id,
        booking_public_id: booking.booking_id,
        status: "completed",
      }),
      booking: serializeBookingForResponse(booking),
    },
    { status: 200 }
  );
}

async function captureExistingBookingOrder({ booking, orderId }) {
  if (!booking) {
    throw new Error("Booking not found.");
  }

  if (isFullPaymentPaid(booking) || isPoaDepositPaid(booking)) {
    return Response.json(getAlreadyPaidResponse(booking), { status: 200 });
  }

  if (booking.payment_method !== "paypal") {
    throw new Error(
      `This booking is not configured for PayPal payment. Current method: ${booking.payment_method}`
    );
  }

  if (!["full_online", "poa_deposit"].includes(booking.payment_flow)) {
    throw new Error(
      "Invalid PayPal payment flow. PayPal supports full online payment and Pay on Arrival holding deposit."
    );
  }

  if (booking.status !== "pending_payment" && !isBookingFinalOrPaid(booking)) {
    throw new Error(
      `This booking is not awaiting PayPal payment. Current status: ${booking.status}`
    );
  }

  if (
    booking.paypal_order_id &&
    String(booking.paypal_order_id) !== String(orderId)
  ) {
    throw new Error("PayPal order ID does not match this booking.");
  }

  let captureResult = null;

  try {
    captureResult = await capturePayPalOrder(orderId);
  } catch (captureError) {
    const freshBooking = await Booking.findById(booking._id);

    if (freshBooking && (isFullPaymentPaid(freshBooking) || isPoaDepositPaid(freshBooking))) {
      return Response.json(getAlreadyPaidResponse(freshBooking), {
        status: 200,
      });
    }

    throw captureError;
  }

  const captureDetails = getPayPalCaptureDetails(captureResult);

  const paymentPurpose = getPaymentPurpose(booking);
  const depositType = getDepositType(booking);

  const bookingTotalAmount = Number(booking.price || 0);
  const expectedAmount = normalizeAmount(
    booking.due_amount ||
      booking.holding_deposit_amount ||
      booking.price ||
      captureDetails.amount
  );

  const paidAmount = normalizeAmount(
    captureDetails.amount || expectedAmount || 0
  );

  const currency = String(
    captureDetails.currency || booking.currency || "aud"
  ).toLowerCase();

  const holdingDepositAmount = isPoaDepositBooking(booking)
    ? normalizeAmount(booking.holding_deposit_amount || paidAmount)
    : 0;

  const balanceDueOnArrival = isPoaDepositBooking(booking)
    ? normalizeAmount(Math.max(bookingTotalAmount - paidAmount, 0))
    : 0;

  if (!isPayPalOrderCompleted(captureResult)) {
    const failureReason = `PayPal payment was not completed. Status: ${
      captureDetails.status || captureDetails.captureStatus || "unknown"
    }`;

    await upsertPayPalPayment({
      orderId,
      captureDetails,
      captureResult,
      booking,
      status: "failed",
      amount: expectedAmount,
      currency,
      failureReason,
    });

    return Response.json(
      {
        success: false,
        message: failureReason,
        error: failureReason,
        order: captureResult,
      },
      { status: 400 }
    );
  }

  if (!amountsMatch(expectedAmount, paidAmount)) {
    const failureReason = `PayPal paid amount does not match booking payable amount. Expected AUD ${expectedAmount.toFixed(
      2
    )}, received AUD ${paidAmount.toFixed(2)}.`;

    await upsertPayPalPayment({
      orderId,
      captureDetails,
      captureResult,
      booking,
      status: "failed",
      amount: paidAmount,
      currency,
      failureReason,
    });

    return Response.json(
      {
        success: false,
        message: failureReason,
        error: failureReason,
      },
      { status: 400 }
    );
  }

  booking.payment_method = "paypal";
  booking.deposit_type = depositType;

  booking.paypal_order_id = captureDetails.orderId || orderId;
  booking.paypal_capture_id = captureDetails.captureId;

  booking.payment_completed_at = new Date();
  booking.payment_failed_at = null;
  booking.payment_failure_reason = null;

  if (isPoaDepositBooking(booking)) {
    booking.status = "poa";
    booking.payment_status = "partial";

    booking.paid_amount = paidAmount;
    booking.due_amount = balanceDueOnArrival;
    booking.holding_deposit_amount = holdingDepositAmount;
    booking.balance_due_on_arrival = balanceDueOnArrival;

    booking.status_history.push({
      status: "poa",
      note: `PayPal holding deposit captured successfully. Paid AUD ${paidAmount.toFixed(
        2
      )}. Balance due on arrival: AUD ${balanceDueOnArrival.toFixed(2)}.`,
      changed_by: null,
      date: new Date(),
    });
  } else {
    booking.status = "success";
    booking.payment_status = "paid";

    booking.paid_amount = paidAmount;
    booking.due_amount = 0;
    booking.holding_deposit_amount = 0;
    booking.balance_due_on_arrival = 0;

    booking.status_history.push({
      status: "success",
      note: "PayPal full payment captured successfully",
      changed_by: null,
      date: new Date(),
    });
  }

  await booking.save();

  await upsertPayPalPayment({
    orderId,
    captureDetails,
    captureResult,
    booking,
    status: "paid",
    amount: paidAmount,
    currency,
  });

  await incrementCouponUsageIfNeeded(booking);
  await sendPaidBookingEmails(booking);

  return Response.json(
    {
      success: true,
      checkout_draft: false,
      message: isPoaDepositBooking(booking)
        ? "PayPal holding deposit captured successfully."
        : "PayPal payment captured successfully.",
      redirectUrl: `/booking/success?bookingId=${booking.booking_id}`,
      redirect_url: `/booking/success?bookingId=${booking.booking_id}`,
      orderId,
      order_id: orderId,
      captureId: captureDetails.captureId,
      capture_id: captureDetails.captureId,
      order: captureResult,
      booking: serializeBookingForResponse(booking),
    },
    { status: 200 }
  );
}

export async function POST(req) {
  try {
    await connectDB();

    if (!process.env.PAYPAL_CLIENT_ID) {
      return Response.json(
        {
          success: false,
          message: "PAYPAL_CLIENT_ID is not configured.",
          error: "PAYPAL_CLIENT_ID is not configured.",
        },
        { status: 500 }
      );
    }

    if (!process.env.PAYPAL_SECRET_KEY) {
      return Response.json(
        {
          success: false,
          message: "PAYPAL_SECRET_KEY is not configured.",
          error: "PAYPAL_SECRET_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const draftId =
      body.draftId ||
      body.draft_id ||
      body.checkoutDraftId ||
      body.checkout_draft_id ||
      "";

    const bookingId = body.bookingId || body.booking_id || "";
    const orderId = body.orderId || body.order_id || body.paypalOrderId || "";

    if (!orderId) {
      return Response.json(
        {
          success: false,
          message: "PayPal order ID is required.",
          error: "PayPal order ID is required.",
        },
        { status: 400 }
      );
    }

    if (draftId) {
      const draft = await CheckoutDraft.findOne(getDraftFilter(draftId));

      if (!draft) {
        return Response.json(
          {
            success: false,
            message: "Checkout draft not found.",
            error: "Checkout draft not found.",
          },
          { status: 404 }
        );
      }

      return await captureCheckoutDraftOrder({ draft, orderId });
    }

    if (!bookingId) {
      return Response.json(
        {
          success: false,
          message: "Booking ID or checkout draft ID is required.",
          error: "Booking ID or checkout draft ID is required.",
        },
        { status: 400 }
      );
    }

    const booking = await Booking.findOne(getBookingQuery(bookingId));

    if (!booking) {
      return Response.json(
        {
          success: false,
          message: "Booking not found.",
          error: "Booking not found.",
        },
        { status: 404 }
      );
    }

    return await captureExistingBookingOrder({ booking, orderId });
  } catch (error) {
    console.error("Capture PayPal order error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to capture PayPal order.",
        error: error.message || "Failed to capture PayPal order.",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}
