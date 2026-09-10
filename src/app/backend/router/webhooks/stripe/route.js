import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import Booking from "@/app/backend/models/booking";
import Payment from "@/app/backend/models/payment";
import Coupon from "@/app/backend/models/coupon";
import ParkingUser from "@/app/backend/models/park_user";
import CruiseSchedule from "@/app/backend/models/cruiseschedule";
import Location from "@/app/backend/models/location";
import StorageType from "@/app/backend/models/storagetype";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import CheckoutDraft from "@/app/backend/models/checkoutDraft";
import { stripe } from "@/app/backend/utils/stripeConfig";
import { fromStripeAmount } from "@/app/backend/utils/paymentHelpers";
import { sendBookingEmails } from "@/app/backend/utils/sendBookingEmails";
import { createPasswordSetupToken } from "@/app/backend/utils/passwordSetup";
import { sendWalletTopupEmails } from "@/app/backend/utils/walletEmail";

export const runtime = "nodejs";

const FINAL_BOOKING_STATUSES = ["success", "confirmed", "poa"];
const PAID_PAYMENT_STATUSES = ["paid", "partial"];
const ACTIVE_BOOKING_EXCLUDED_STATUSES = [
  "cancelled",
  "refund",
  "refunded",
  "credit",
  "credited",
];

const ACTIVE_STORAGE_BOOKING_STATUSES = [
  "pending",
  "pending_payment",
  "success",
  "confirmed",
  "poa",
];

function serializeStripePayload(payload) {
  if (!payload) return null;

  if (typeof payload.toJSON === "function") {
    return payload.toJSON();
  }

  return payload;
}

function normalizeMoney(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
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

function getPaymentIntentAmount(paymentIntent) {
  const amount =
    paymentIntent.amount_received && paymentIntent.amount_received > 0
      ? paymentIntent.amount_received
      : paymentIntent.amount || 0;

  return fromStripeAmount(amount);
}

function isWalletTopupPaymentIntent(paymentIntent) {
  return (
    paymentIntent.metadata?.purpose === "wallet_topup" ||
    paymentIntent.metadata?.paymentPurpose === "wallet_topup" ||
    paymentIntent.metadata?.payment_flow === "wallet_topup"
  );
}

function getDraftReferenceFromPaymentIntent(paymentIntent) {
  return normalizeString(
    paymentIntent.metadata?.draftId ||
      paymentIntent.metadata?.draft_id ||
      paymentIntent.metadata?.draftReference ||
      paymentIntent.metadata?.draft_reference ||
      paymentIntent.metadata?.checkoutDraftId ||
      paymentIntent.metadata?.checkout_draft_id ||
      paymentIntent.metadata?.checkoutDraftReference ||
      paymentIntent.metadata?.checkout_draft_reference
  );
}

function isCheckoutDraftPaymentIntent(paymentIntent) {
  return Boolean(getDraftReferenceFromPaymentIntent(paymentIntent));
}

function isBookingFinalOrPaid(booking) {
  if (!booking) return false;

  return (
    PAID_PAYMENT_STATUSES.includes(String(booking.payment_status || "")) ||
    FINAL_BOOKING_STATUSES.includes(String(booking.status || ""))
  );
}

function isUnpaidStripeBookingSafeToDelete(booking) {
  if (!booking) return false;

  const paymentMethod = String(booking.payment_method || "stripe").toLowerCase();

  if (paymentMethod && paymentMethod !== "stripe") {
    return false;
  }

  if (isBookingFinalOrPaid(booking)) {
    return false;
  }

  if (Number(booking.paid_amount || 0) > 0) {
    return false;
  }

  return ["pending_payment", "pending", "payment_started", ""].includes(
    String(booking.status || "")
  );
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
    .populate(
      "wallet_transaction_id",
      "transaction_reference transaction_id amount method status"
    );
}

async function sendPaidBookingEmails({ booking }) {
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
    console.error("Stripe webhook: booking paid but email failed", emailError);
  }
}

async function sendWalletTopupSuccessEmailsSafe({ walletTransactionId }) {
  try {
    if (!walletTransactionId) return;

    const walletTransaction = await WalletTransaction.findById(
      walletTransactionId
    );

    if (!walletTransaction) {
      console.warn("Stripe wallet top-up email skipped: transaction not found", {
        walletTransactionId,
      });
      return;
    }

    if (walletTransaction.status !== "completed") {
      return;
    }

    const user = await ParkingUser.findById(walletTransaction.user_id).select(
      "name email phone role"
    );

    if (!user) {
      console.warn("Stripe wallet top-up email skipped: user not found", {
        walletTransactionId,
        userId: walletTransaction.user_id,
      });
      return;
    }

    const payment = await Payment.findOne({
      wallet_transaction_id: walletTransaction._id,
    }).sort({ createdAt: -1 });

    await sendWalletTopupEmails({
      user,
      walletTransaction,
      payment,
    });
  } catch (emailError) {
    console.error("Stripe wallet top-up email failed:", emailError);
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

async function releaseBookingCapacityIfNeeded(booking) {
  if (!booking) return;

  if (booking.type === "cruise" && booking.schedule_id) {
    await CruiseSchedule.updateOne(
      {
        _id: booking.schedule_id,
        booked_count: {
          $gt: 0,
        },
      },
      {
        $inc: {
          booked_count: -1,
        },
      }
    );
  }
}

async function deleteUnpaidStripeBookingIfSafe(booking) {
  if (!isUnpaidStripeBookingSafeToDelete(booking)) {
    return false;
  }

  await releaseBookingCapacityIfNeeded(booking);

  await Booking.deleteOne({
    _id: booking._id,
    payment_status: {
      $nin: ["paid", "partial"],
    },
    status: {
      $nin: ["success", "confirmed", "poa"],
    },
  });

  return true;
}

async function findBookingFromPaymentIntent(paymentIntent) {
  const bookingMongoId = paymentIntent.metadata?.bookingMongoId;
  const bookingPublicId = paymentIntent.metadata?.bookingId;

  let booking = null;

  if (bookingMongoId && mongoose.Types.ObjectId.isValid(bookingMongoId)) {
    booking = await Booking.findById(bookingMongoId);
  }

  if (!booking && bookingPublicId) {
    booking = await Booking.findOne({
      booking_id: bookingPublicId,
    });
  }

  if (!booking) {
    console.warn("Stripe webhook: booking not found", {
      bookingMongoId,
      bookingPublicId,
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata,
    });
  }

  return booking;
}

async function findWalletTransactionFromPaymentIntent(paymentIntent) {
  const walletTransactionId =
    paymentIntent.metadata?.walletTransactionId ||
    paymentIntent.metadata?.wallet_transaction_id;

  if (walletTransactionId && mongoose.Types.ObjectId.isValid(walletTransactionId)) {
    return WalletTransaction.findById(walletTransactionId);
  }

  return WalletTransaction.findOne({
    provider_payment_id: paymentIntent.id,
  });
}

async function findCheckoutDraftFromPaymentIntent(paymentIntent) {
  const draftReference = getDraftReferenceFromPaymentIntent(paymentIntent);

  if (!draftReference) return null;

  const conditions = [
    { draft_reference: draftReference },
    { stripe_payment_intent_id: paymentIntent.id },
  ];

  if (mongoose.Types.ObjectId.isValid(draftReference)) {
    conditions.push({ _id: draftReference });
  }

  const draft = await CheckoutDraft.findOne({
    $or: conditions,
  });

  if (!draft) {
    console.warn("Stripe webhook: checkout draft not found", {
      draftReference,
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata,
    });
  }

  return draft;
}

async function upsertStripePayment({
  paymentIntent,
  booking = null,
  walletTransaction = null,
  status,
  amount,
  failureReason = "",
  paymentFlow,
  depositType,
  paymentPurpose,
  extra = {},
}) {
  const payload = {
    amount,
    currency: paymentIntent.currency || "aud",

    method: "stripe",
    status,

    payment_flow: paymentFlow,
    deposit_type: depositType,
    payment_purpose: paymentPurpose,

    transaction_id: paymentIntent.id,
    provider_payment_id: paymentIntent.id,
    provider_payload: serializeStripePayload(paymentIntent),

    ...extra,
  };

  if (booking) {
    payload.booking_id = booking._id;
    payload.user_id = booking.user_id;
    payload.booking_total_amount = Number(booking.price || amount || 0);
    payload.holding_deposit_amount = Number(
      booking.holding_deposit_amount || 0
    );
    payload.balance_due_on_arrival = Number(
      booking.balance_due_on_arrival || 0
    );
  }

  if (walletTransaction) {
    payload.user_id = walletTransaction.user_id;
    payload.wallet_transaction_id = walletTransaction._id;
  }

  if (failureReason) {
    payload.failure_reason = failureReason;
  }

  if (status === "paid") {
    payload.paid_at = new Date();
  }

  return Payment.findOneAndUpdate(
    {
      provider_payment_id: paymentIntent.id,
    },
    payload,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
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

async function findOrCreateDraftCustomer(draft) {
  if (draft.user_id) {
    const existingUser = await ParkingUser.findById(draft.user_id);

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

  const existingUser = await ParkingUser.findOne({ email });

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
      await existingUser.save();
    }

    return existingUser;
  }

  return ParkingUser.create({
    name,
    email,
    phone,
    role: "customer",
    is_active: true,
  });
}

function getObjectIdOrNull(value) {
  const id = normalizeString(value);

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return new mongoose.Types.ObjectId(id);
}

async function findCouponForDraft(draft) {
  const code = normalizeString(
    draft.pricing_snapshot?.coupon_code || draft.booking_payload?.coupon_code
  ).toUpperCase();

  if (!code) return null;

  return Coupon.findOne({
    $or: [{ code }, { coupon_code: code }],
  });
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

  const discountPercent = normalizeMoney(
    payload.add_on_vehicle_discount_percent ||
      payloadAddOn.discount_percent ||
      pricingAddOn.discount_percent ||
      10
  );

  const originalPrice = normalizeMoney(
    payload.add_on_vehicle_original_price ||
      payloadAddOn.original_price ||
      pricingAddOn.original_price ||
      0
  );

  const discountAmount = normalizeMoney(
    payload.add_on_vehicle_discount_amount ||
      payloadAddOn.discount_amount ||
      pricingAddOn.discount_amount ||
      0
  );

  const price = normalizeMoney(
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

async function buildCruiseBookingFromDraft({ draft, paymentIntent, session }) {
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

  const customerUser = await findOrCreateDraftCustomer(draft);
  const coupon = await findCouponForDraft(draft);
  const bookingId = await generateBookingId("BK");

  const paidAmount = normalizeMoney(getPaymentIntentAmount(paymentIntent));
  const price = normalizeMoney(pricing.price || payload.price || 0);
  const originalPrice = normalizeMoney(
    payload.total_before_discount ||
      payload.original_price ||
      payload.parking_price ||
      price + normalizeMoney(pricing.discount_amount || payload.discount_amount)
  );
  const discountAmount = normalizeMoney(
    pricing.discount_amount || payload.discount_amount || Math.max(originalPrice - price, 0)
  );

  const isPoaDepositBooking = draft.payment_flow === "poa_deposit";
  const dueAmount = isPoaDepositBooking
    ? normalizeMoney(Math.max(price - paidAmount, 0))
    : 0;

  const bookingStatus = isPoaDepositBooking ? "poa" : "success";
  const paymentStatus = isPoaDepositBooking ? "partial" : "paid";

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

  const booking = await Booking.create(
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
            parking_price: normalizeMoney(
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
            extra_passenger_fee: normalizeMoney(payload.extra_passenger_fee || 0),
            add_on_vehicle_original_price: addOnVehicle.original_price,
            add_on_vehicle_discount_percent: addOnVehicle.discount_percent,
            add_on_vehicle_discount_amount: addOnVehicle.discount_amount,
            add_on_vehicle_price: addOnVehicle.price,
            total_before_discount: normalizeMoney(
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

            // Kept in case your current local Booking schema already includes
            // the newer direction fields. Older schemas will ignore these safely.
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
            extra_passenger_fee: normalizeMoney(payload.extra_passenger_fee || 0),
            add_on_vehicle: addOnVehicle,
          },
        },
        customer: {
          name: customerUser.name,
          email: customerUser.email,
          phone: customerUser.phone,
        },
        pricing_type: "fixed",
        currency: draft.currency || paymentIntent.currency || "aud",
        original_price: originalPrice || price,
        price,
        discount_amount: discountAmount,
        coupon_code: coupon ? normalizeString(coupon.code || coupon.coupon_code).toUpperCase() : null,
        coupon_id: coupon?._id || null,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        wallet_used: 0,
        payment_flow: draft.payment_flow,
        deposit_type: draft.deposit_type,
        payment_method: "stripe",
        holding_deposit_amount: isPoaDepositBooking
          ? normalizeMoney(pricing.holding_deposit_amount || paidAmount)
          : 0,
        balance_due_on_arrival: dueAmount,
        payment_status: paymentStatus,
        stripe_payment_intent_id: paymentIntent.id,
        payment_completed_at: new Date(),
        status: bookingStatus,
        source: payload.source || "web",
        status_history: [
          {
            status: bookingStatus,
            note: isPoaDepositBooking
              ? `Stripe holding deposit confirmed from checkout draft ${draft.draft_reference}`
              : `Stripe full payment confirmed from checkout draft ${draft.draft_reference}`,
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

  return booking[0];
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
 * Final Storage availability validation for successful Stripe payments.
 *
 * This runs inside the same MongoDB transaction that creates the final booking.
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
async function validateStorageCapacityBeforeFinalBooking({
  storageType,
  location,
  startDate,
  endDate,
  session,
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

async function buildNonCruiseBookingFromDraft({ draft, paymentIntent, session }) {
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

  const customerUser = await findOrCreateDraftCustomer(draft);
  const coupon = await findCouponForDraft(draft);
  const bookingId = await generateBookingId('BK');

  const paidAmount = normalizeMoney(getPaymentIntentAmount(paymentIntent));
  const price = normalizeMoney(pricing.price || payload.price || paidAmount);
  const discountAmount = normalizeMoney(
    pricing.discount_amount || payload.discount_amount || 0
  );
  const originalPrice = normalizeMoney(
    payload.total_before_discount ||
      payload.original_price ||
      (price + discountAmount)
  );

  const isPoaDepositBooking = draft.payment_flow === 'poa_deposit';
  const dueAmount = isPoaDepositBooking
    ? normalizeMoney(Math.max(price - paidAmount, 0))
    : 0;

  const bookingStatus = isPoaDepositBooking ? 'poa' : 'success';
  const paymentStatus = isPoaDepositBooking ? 'partial' : 'paid';

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

    await validateStorageCapacityBeforeFinalBooking({
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
        currency: String(draft.currency || paymentIntent.currency || 'aud').toLowerCase(),
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
        payment_method: 'stripe',
        holding_deposit_amount: isPoaDepositBooking
          ? normalizeMoney(pricing.holding_deposit_amount || paidAmount)
          : 0,
        balance_due_on_arrival: dueAmount,
        payment_status: paymentStatus,
        stripe_payment_intent_id: paymentIntent.id,
        payment_completed_at: new Date(),
        status: bookingStatus,
        source: payload.source || 'web',
        status_history: [
          {
            status: bookingStatus,
            note: isPoaDepositBooking
              ? `Stripe holding deposit confirmed from checkout draft ${draft.draft_reference}`
              : `Stripe full payment confirmed from checkout draft ${draft.draft_reference}`,
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

async function createBookingFromCheckoutDraft({ draft, paymentIntent }) {
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
            stripe_payment_intent_id: paymentIntent.id,
            provider_payload: serializeStripePayload(paymentIntent),
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
              paymentIntent,
              session,
            })
          : await buildNonCruiseBookingFromDraft({
              draft: lockedDraft,
              paymentIntent,
              session,
            });

      lockedDraft.status = "completed";
      lockedDraft.paid_at = lockedDraft.paid_at || new Date();
      lockedDraft.completed_at = new Date();
      lockedDraft.booking_id = booking._id;
      lockedDraft.booking_public_id = booking.booking_id;
      lockedDraft.provider_payload = serializeStripePayload(paymentIntent);
      lockedDraft.payment_error = "";

      await lockedDraft.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return booking;
}

async function handleCheckoutDraftPaymentIntentSucceeded(paymentIntent) {
  const draft = await findCheckoutDraftFromPaymentIntent(paymentIntent);

  if (!draft) return;

  let booking = null;

  try {
    booking = await createBookingFromCheckoutDraft({
      draft,
      paymentIntent,
    });
  } catch (error) {
    const paymentError =
      error?.message || "Paid checkout could not create booking";

    console.error(
      "Stripe checkout draft payment succeeded but booking creation failed:",
      {
        draftId: draft._id,
        draftReference: draft.draft_reference,
        paymentIntentId: paymentIntent.id,
        error: paymentError,
      }
    );

    await CheckoutDraft.findByIdAndUpdate(draft._id, {
      status: "failed",
      failed_at: new Date(),
      payment_error: paymentError,
      stripe_payment_intent_id: paymentIntent.id,
      paid_at: draft.paid_at || new Date(),
      provider_payload: serializeStripePayload(paymentIntent),
    });

    await upsertStripePayment({
      paymentIntent,
      status: "paid",
      amount: getPaymentIntentAmount(paymentIntent),
      paymentFlow: draft.payment_flow,
      depositType: draft.deposit_type,
      paymentPurpose:
        draft.payment_flow === "poa_deposit"
          ? "poa_holding_deposit"
          : "full_online_payment",
      extra: {
        metadata: {
          checkout_draft_id: String(draft._id),
          checkout_draft_reference: draft.draft_reference,
          booking_creation_failed: true,
          booking_creation_error: paymentError,
        },
      },
    });

    /*
     * Payment has already succeeded, so do not create an over-capacity booking.
     * The failed draft and paid Payment record preserve the case for admin
     * follow-up/refund instead of silently losing the payment.
     */
    return;
  }

  if (!booking) return;

  const addOnVehicle =
    draft.type === "cruise" ? getDraftAddOnVehicleSnapshot(draft) : null;

  await upsertStripePayment({
    paymentIntent,
    booking,
    status: "paid",
    amount: getPaymentIntentAmount(paymentIntent),
    paymentFlow: booking.payment_flow,
    depositType: booking.deposit_type,
    paymentPurpose:
      booking.payment_flow === "poa_deposit"
        ? "poa_holding_deposit"
        : "full_online_payment",
    extra: {
      metadata: {
        checkout_draft_id: String(draft._id),
        checkout_draft_reference: draft.draft_reference,
        add_on_vehicle_enabled: addOnVehicle?.enabled || false,
        add_on_vehicle_type: addOnVehicle?.type || "",
        add_on_vehicle_license_plate: addOnVehicle?.license_plate || "",
        add_on_vehicle_price: addOnVehicle?.price || 0,
      },
    },
  });

  await incrementCouponUsageIfNeeded(booking);
  await sendPaidBookingEmails({ booking });
}

async function handleCheckoutDraftPaymentIntentFailed(paymentIntent) {
  const draft = await findCheckoutDraftFromPaymentIntent(paymentIntent);

  const failureMessage =
    paymentIntent.last_payment_error?.message ||
    paymentIntent.cancellation_reason ||
    "Stripe payment failed";

  if (draft && !["completed", "paid"].includes(draft.status)) {
    draft.status = "failed";
    draft.failed_at = new Date();
    draft.payment_error = failureMessage;
    draft.provider_payload = serializeStripePayload(paymentIntent);
    await draft.save();
  }

  await upsertStripePayment({
    paymentIntent,
    status: "failed",
    amount: fromStripeAmount(paymentIntent.amount || 0),
    failureReason: failureMessage,
    paymentFlow:
      draft?.payment_flow || paymentIntent.metadata?.paymentFlow || "",
    depositType:
      draft?.deposit_type || paymentIntent.metadata?.depositType || "",
    paymentPurpose:
      paymentIntent.metadata?.paymentPurpose ||
      (draft?.payment_flow === "poa_deposit"
        ? "poa_holding_deposit"
        : "full_online_payment"),
    extra: {
      metadata: {
        checkout_draft_id: draft?._id ? String(draft._id) : "",
        checkout_draft_reference: draft?.draft_reference || "",
      },
    },
  });
}

async function handleCheckoutDraftPaymentIntentProcessing(paymentIntent) {
  const draft = await findCheckoutDraftFromPaymentIntent(paymentIntent);

  if (draft && !["completed", "paid"].includes(draft.status)) {
    draft.status = "payment_processing";
    draft.payment_started_at = draft.payment_started_at || new Date();
    draft.stripe_payment_intent_id = paymentIntent.id;
    draft.provider_payload = serializeStripePayload(paymentIntent);
    await draft.save();
  }

  await upsertStripePayment({
    paymentIntent,
    status: "pending",
    amount: fromStripeAmount(paymentIntent.amount || 0),
    paymentFlow:
      draft?.payment_flow || paymentIntent.metadata?.paymentFlow || "",
    depositType:
      draft?.deposit_type || paymentIntent.metadata?.depositType || "",
    paymentPurpose:
      paymentIntent.metadata?.paymentPurpose ||
      (draft?.payment_flow === "poa_deposit"
        ? "poa_holding_deposit"
        : "full_online_payment"),
    extra: {
      metadata: {
        checkout_draft_id: draft?._id ? String(draft._id) : "",
        checkout_draft_reference: draft?.draft_reference || "",
      },
    },
  });
}

async function handleWalletTopupSucceeded(paymentIntent) {
  const walletTransaction = await findWalletTransactionFromPaymentIntent(
    paymentIntent
  );

  if (!walletTransaction) {
    console.warn("Stripe wallet top-up webhook: wallet transaction not found", {
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata,
    });

    return;
  }

  if (walletTransaction.status === "completed") {
    await sendWalletTopupSuccessEmailsSafe({
      walletTransactionId: walletTransaction._id,
    });
    return;
  }

  const paidAmount = getPaymentIntentAmount(paymentIntent);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const user = await ParkingUser.findById(walletTransaction.user_id).session(
        session
      );

      if (!user) {
        throw new Error("Wallet top-up user not found.");
      }

      if (!user.is_active) {
        throw new Error("Wallet top-up user account is inactive.");
      }

      if (user.wallet_status && user.wallet_status !== "active") {
        throw new Error("Wallet is not active.");
      }

      const balanceBefore = normalizeMoney(user.wallet_balance || 0);
      const balanceAfter = normalizeMoney(balanceBefore + paidAmount);

      user.wallet_balance = balanceAfter;
      user.wallet_updated_at = new Date();

      await user.save({ session });

      walletTransaction.status = "completed";
      walletTransaction.amount = paidAmount;
      walletTransaction.balance_before = balanceBefore;
      walletTransaction.balance_after = balanceAfter;
      walletTransaction.provider_payment_id = paymentIntent.id;
      walletTransaction.provider_payload = serializeStripePayload(paymentIntent);
      walletTransaction.completed_at = new Date();
      walletTransaction.failure_reason = undefined;

      await walletTransaction.save({ session });

      const payment = await Payment.findOneAndUpdate(
        {
          provider_payment_id: paymentIntent.id,
        },
        {
          user_id: user._id,
          wallet_transaction_id: walletTransaction._id,

          amount: paidAmount,
          currency: paymentIntent.currency || "aud",

          method: "stripe",
          status: "paid",

          payment_flow: "wallet_topup",
          payment_purpose: "wallet_topup",

          transaction_id: paymentIntent.id,
          provider_payment_id: paymentIntent.id,
          provider_payload: serializeStripePayload(paymentIntent),
          paid_at: new Date(),

          wallet_balance_before: balanceBefore,
          wallet_balance_after: balanceAfter,

          metadata: {
            purpose: "wallet_topup",
            wallet_transaction_id: walletTransaction._id.toString(),
            user_id: user._id.toString(),
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          session,
        }
      );

      walletTransaction.payment_id = payment._id;
      await walletTransaction.save({ session });
    });
  } finally {
    await session.endSession();
  }

  await sendWalletTopupSuccessEmailsSafe({
    walletTransactionId: walletTransaction._id,
  });
}

async function handleWalletTopupFailed(paymentIntent) {
  const walletTransaction = await findWalletTransactionFromPaymentIntent(
    paymentIntent
  );

  if (!walletTransaction) {
    console.warn("Stripe wallet top-up failed: wallet transaction not found", {
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata,
    });

    return;
  }

  if (walletTransaction.status === "completed") {
    return;
  }

  const failureMessage =
    paymentIntent.last_payment_error?.message ||
    paymentIntent.cancellation_reason ||
    "Stripe wallet top-up failed";

  walletTransaction.status = "failed";
  walletTransaction.provider_payment_id = paymentIntent.id;
  walletTransaction.failure_reason = failureMessage;
  walletTransaction.provider_payload = serializeStripePayload(paymentIntent);
  walletTransaction.failed_at = new Date();

  await walletTransaction.save();

  await upsertStripePayment({
    paymentIntent,
    walletTransaction,
    status: "failed",
    amount: fromStripeAmount(paymentIntent.amount || 0),
    failureReason: failureMessage,
    paymentFlow: "wallet_topup",
    paymentPurpose: "wallet_topup",
    extra: {
      metadata: {
        purpose: "wallet_topup",
        wallet_transaction_id: walletTransaction._id.toString(),
        user_id: String(walletTransaction.user_id),
      },
    },
  });
}

async function handleWalletTopupProcessing(paymentIntent) {
  const walletTransaction = await findWalletTransactionFromPaymentIntent(
    paymentIntent
  );

  if (!walletTransaction) {
    console.warn(
      "Stripe wallet top-up processing: wallet transaction not found",
      {
        paymentIntentId: paymentIntent.id,
        metadata: paymentIntent.metadata,
      }
    );

    return;
  }

  if (walletTransaction.status === "completed") {
    return;
  }

  walletTransaction.status = "pending";
  walletTransaction.provider_payment_id = paymentIntent.id;
  walletTransaction.provider_payload = serializeStripePayload(paymentIntent);

  await walletTransaction.save();

  await upsertStripePayment({
    paymentIntent,
    walletTransaction,
    status: "pending",
    amount: fromStripeAmount(paymentIntent.amount || 0),
    paymentFlow: "wallet_topup",
    paymentPurpose: "wallet_topup",
    extra: {
      metadata: {
        purpose: "wallet_topup",
        wallet_transaction_id: walletTransaction._id.toString(),
        user_id: String(walletTransaction.user_id),
      },
    },
  });
}

async function handleBookingPaymentIntentSucceeded(paymentIntent) {
  const booking = await findBookingFromPaymentIntent(paymentIntent);

  if (!booking) return;

  const isPoaDepositBooking =
    booking.payment_flow === "poa_deposit" || booking.deposit_type === "poa";

  const alreadyFullyPaid =
    booking.payment_status === "paid" ||
    booking.status === "success" ||
    booking.status === "confirmed";

  const alreadyPoaDepositPaid =
    isPoaDepositBooking &&
    booking.payment_status === "partial" &&
    booking.status === "poa";

  if (alreadyFullyPaid || alreadyPoaDepositPaid) {
    return;
  }

  const paidAmount = getPaymentIntentAmount(paymentIntent);

  booking.payment_method = "stripe";
  booking.stripe_payment_intent_id = paymentIntent.id;
  booking.paid_amount = paidAmount;
  booking.payment_completed_at = new Date();
  booking.payment_failed_at = null;
  booking.payment_failure_reason = null;

  if (isPoaDepositBooking) {
    const remainingBalance = normalizeMoney(
      Math.max(Number(booking.price || 0) - paidAmount, 0)
    );

    booking.status = "poa";
    booking.payment_status = "partial";
    booking.due_amount = remainingBalance;
    booking.balance_due_on_arrival = remainingBalance;

    booking.status_history.push({
      status: "poa",
      note: `AUD ${paidAmount.toFixed(
        2
      )} holding deposit paid by Stripe. Balance due on arrival: AUD ${remainingBalance.toFixed(
        2
      )}.`,
      changed_by: null,
      date: new Date(),
    });
  } else {
    booking.status = "success";
    booking.payment_status = "paid";
    booking.due_amount = 0;
    booking.balance_due_on_arrival = 0;

    booking.status_history.push({
      status: "success",
      note: "Stripe full payment confirmed by webhook",
      changed_by: null,
      date: new Date(),
    });
  }

  await booking.save();

  await upsertStripePayment({
    paymentIntent,
    booking,
    status: "paid",
    amount: paidAmount,
    paymentFlow: booking.payment_flow,
    depositType: booking.deposit_type,
    paymentPurpose: isPoaDepositBooking
      ? "poa_holding_deposit"
      : "full_online_payment",
  });

  await incrementCouponUsageIfNeeded(booking);

  await sendPaidBookingEmails({ booking });
}

async function handleBookingPaymentIntentFailed(paymentIntent) {
  const booking = await findBookingFromPaymentIntent(paymentIntent);

  const failureMessage =
    paymentIntent.last_payment_error?.message ||
    paymentIntent.cancellation_reason ||
    "Stripe payment failed";

  if (!booking) {
    await upsertStripePayment({
      paymentIntent,
      status: "failed",
      amount: fromStripeAmount(paymentIntent.amount || 0),
      failureReason: failureMessage,
      paymentFlow: paymentIntent.metadata?.paymentFlow || "",
      depositType: paymentIntent.metadata?.depositType || "",
      paymentPurpose:
        paymentIntent.metadata?.paymentPurpose || "full_online_payment",
    });

    return;
  }

  if (isBookingFinalOrPaid(booking)) {
    return;
  }

  await upsertStripePayment({
    paymentIntent,
    booking,
    status: "failed",
    amount: fromStripeAmount(paymentIntent.amount || 0),
    failureReason: failureMessage,
    paymentFlow: booking.payment_flow,
    depositType: booking.deposit_type,
    paymentPurpose:
      booking.payment_flow === "poa_deposit"
        ? "poa_holding_deposit"
        : "full_online_payment",
  });

  const deleted = await deleteUnpaidStripeBookingIfSafe(booking);

  if (!deleted) {
    booking.payment_status = "failed";
    booking.payment_method = "stripe";
    booking.stripe_payment_intent_id = paymentIntent.id;
    booking.payment_failed_at = new Date();
    booking.payment_failure_reason = failureMessage;

    /**
     * Important:
     * Do NOT set booking.status = "pending_payment" here.
     */
    booking.status_history.push({
      status: booking.status,
      note: failureMessage,
      changed_by: null,
      date: new Date(),
    });

    await booking.save();
  }
}

async function handleBookingPaymentIntentProcessing(paymentIntent) {
  const booking = await findBookingFromPaymentIntent(paymentIntent);

  if (!booking) {
    await upsertStripePayment({
      paymentIntent,
      status: "pending",
      amount: fromStripeAmount(paymentIntent.amount || 0),
      paymentFlow: paymentIntent.metadata?.paymentFlow || "",
      depositType: paymentIntent.metadata?.depositType || "",
      paymentPurpose:
        paymentIntent.metadata?.paymentPurpose || "full_online_payment",
    });

    return;
  }

  if (isBookingFinalOrPaid(booking)) {
    return;
  }

  /**
   * Important:
   * Do not change booking status to pending_payment on processing.
   * Processing is only recorded in Payment table.
   */
  await Booking.updateOne(
    {
      _id: booking._id,
    },
    {
      $set: {
        payment_method: "stripe",
        stripe_payment_intent_id: paymentIntent.id,
      },
    }
  );

  await upsertStripePayment({
    paymentIntent,
    booking,
    status: "pending",
    amount: fromStripeAmount(paymentIntent.amount || 0),
    paymentFlow: booking.payment_flow,
    depositType: booking.deposit_type,
    paymentPurpose:
      booking.payment_flow === "poa_deposit"
        ? "poa_holding_deposit"
        : "full_online_payment",
  });
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  if (isWalletTopupPaymentIntent(paymentIntent)) {
    await handleWalletTopupSucceeded(paymentIntent);
    return;
  }

  if (isCheckoutDraftPaymentIntent(paymentIntent)) {
    await handleCheckoutDraftPaymentIntentSucceeded(paymentIntent);
    return;
  }

  await handleBookingPaymentIntentSucceeded(paymentIntent);
}

async function handlePaymentIntentFailed(paymentIntent) {
  if (isWalletTopupPaymentIntent(paymentIntent)) {
    await handleWalletTopupFailed(paymentIntent);
    return;
  }

  if (isCheckoutDraftPaymentIntent(paymentIntent)) {
    await handleCheckoutDraftPaymentIntentFailed(paymentIntent);
    return;
  }

  await handleBookingPaymentIntentFailed(paymentIntent);
}

async function handlePaymentIntentProcessing(paymentIntent) {
  if (isWalletTopupPaymentIntent(paymentIntent)) {
    await handleWalletTopupProcessing(paymentIntent);
    return;
  }

  if (isCheckoutDraftPaymentIntent(paymentIntent)) {
    await handleCheckoutDraftPaymentIntentProcessing(paymentIntent);
    return;
  }

  await handleBookingPaymentIntentProcessing(paymentIntent);
}

export async function POST(req) {
  try {
    await connectDB();

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return Response.json(
        {
          success: false,
          message: "Stripe webhook secret is not configured.",
        },
        { status: 500 }
      );
    }

    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return Response.json(
        {
          success: false,
          message: "Missing Stripe signature.",
        },
        { status: 400 }
      );
    }

    /**
     * Stripe webhook verification requires raw body.
     * Do not use req.json() here.
     */
    const rawBody = await req.text();

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );

      console.log("Stripe webhook received:", event.type);
    } catch (error) {
      console.error("Stripe webhook signature verification failed:", error);

      return Response.json(
        {
          success: false,
          message: `Webhook signature verification failed: ${error.message}`,
        },
        { status: 400 }
      );
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await handlePaymentIntentFailed(event.data.object);
        break;

      case "payment_intent.processing":
        await handlePaymentIntentProcessing(event.data.object);
        break;

      default:
        console.log(`Unhandled Stripe webhook event: ${event.type}`);
        break;
    }

    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Stripe webhook handler failed.",
      },
      { status: 500 }
    );
  }
}
