import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Booking from "@/app/backend/models/booking";
import Payment from "@/app/backend/models/payment";
import ParkingUser from "@/app/backend/models/park_user";
import CruiseSchedule from "@/app/backend/models/cruiseschedule";
import Location from "@/app/backend/models/location";
import Coupon from "@/app/backend/models/coupon";
import StorageType from "@/app/backend/models/storagetype";
import WalletTransaction from "@/app/backend/models/wallettransaction";
import Setting from "@/app/backend/models/settings";
import { sendBookingEmails } from "@/app/backend/utils/sendBookingEmails";
import { createPasswordSetupToken } from "@/app/backend/utils/passwordSetup";
import { getCouponDiscountResult } from "@/app/backend/controller/coupon";

const DEFAULT_HOLDING_DEPOSIT_AMOUNT = 20;
const DEFAULT_ADMIN_ACTION_FEE = 10;
const GLOBAL_SETTING_ID = "global_config";

const INCLUDED_CRUISE_SHUTTLE_PASSENGERS = 4;
const EXTRA_CRUISE_PASSENGER_FEE = 5;
const ADD_ON_VEHICLE_DISCOUNT_PERCENT = 10;

const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "pending_payment",
  "success",
  "confirmed",
  "poa",
];

const ONLINE_PAYMENT_METHODS = ["stripe", "paypal"];

const generateBookingId = () => {
  return `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;
};

const normalizeMoney = (amount) => {
  const number = Number(amount || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
};

const normalizeCount = (value) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.floor(number);
};

const normalizeEmail = (email) => {
  return String(email || "").toLowerCase().trim();
};

const normalizeOptionalText = (value) => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeSource = (source) => {
  const value = String(source || "web")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  const allowedSources = [
    "web",
    "admin",
    "google",
    "facebook",
    "instagram",
    "friend",
    "returning_customer",
    "other",
  ];

  return allowedSources.includes(value) ? value : "other";
};

const getConfiguredHoldingDepositAmount = (settings) => {
  const amount = Number(settings?.holding_deposit_amount);

  if (!Number.isFinite(amount) || amount < 0) {
    return DEFAULT_HOLDING_DEPOSIT_AMOUNT;
  }

  return normalizeMoney(amount);
};

const parseBookingDate = (value) => {
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

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const calculateDays = (startDate, endDate) => {
  const start = parseBookingDate(startDate);
  const end = parseBookingDate(endDate);

  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return 0;
  }

  const diff = end.getTime() - start.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return days > 0 ? days : 1;
};


/**
 * Inclusive calendar-day counting for Storage/Airport style bookings.
 *
 * Examples:
 * - 09 Sep -> 09 Sep = 1 day
 * - 04 Sep -> 05 Sep = 2 days
 * - 04 Sep -> 06 Sep = 3 days
 */
const calculateInclusiveDays = (startDate, endDate) => {
  const start = parseBookingDate(startDate);
  const end = parseBookingDate(endDate);

  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 0;
  }

  const diff = end.getTime() - start.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;

  return days > 0 ? days : 0;
};

const formatDateInput = (date) => {
  const value = parseBookingDate(date);

  if (!value || Number.isNaN(value.getTime())) {
    return "";
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeDateKey = (value) => {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  return formatDateInput(value);
};

const getSlotTime = (slot) => {
  return String(slot?.time || slot?.shuttle_time || "").trim();
};

const getCruiseExtraPassengerCount = (passengerCount) => {
  return Math.max(
    normalizeCount(passengerCount) - INCLUDED_CRUISE_SHUTTLE_PASSENGERS,
    0
  );
};

const getCruiseExtraPassengerFee = ({
  carParkToTerminalPassengers,
  terminalToCarParkPassengers,
}) => {
  const extraPassengerCount =
    getCruiseExtraPassengerCount(carParkToTerminalPassengers) +
    getCruiseExtraPassengerCount(terminalToCarParkPassengers);

  return {
    extraPassengerCount,
    extraPassengerFee: normalizeMoney(
      extraPassengerCount * EXTRA_CRUISE_PASSENGER_FEE
    ),
  };
};

const getBlockedRanges = (location) => {
  const blockedDates =
    location?.blocked_dates ||
    location?.block_dates ||
    location?.blockedDates ||
    [];

  if (!Array.isArray(blockedDates)) {
    return [];
  }

  return blockedDates
    .filter((item) => item && item.is_active !== false)
    .map((item) => {
      if (typeof item === "string" || item instanceof Date) {
        const date = normalizeDateKey(item);

        return {
          start: date,
          end: date,
          reason: "This date is blocked by admin.",
        };
      }

      const start = normalizeDateKey(
        item.start_date || item.startDate || item.from || item.date
      );

      const end = normalizeDateKey(
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
};

const getBlockedDateConflict = (location, dateValue) => {
  if (!location || !dateValue) return null;

  const selectedDate = normalizeDateKey(dateValue);
  const blockedRanges = getBlockedRanges(location);

  const conflict = blockedRanges.find((blocked) => {
    return selectedDate >= blocked.start && selectedDate <= blocked.end;
  });

  if (!conflict) return null;

  return {
    date: selectedDate,
    reason: conflict.reason || "This date is blocked by admin.",
  };
};

const calculateBookableDays = (startDate, endDate, location) => {
  const start = parseBookingDate(startDate);
  const end = parseBookingDate(endDate);

  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 0;
  }

  let days = 0;
  const cursor = new Date(start);

  // Inclusive Airport day counting:
  // 09 Sep -> 09 Sep = 1 day
  // 04 Sep -> 05 Sep = 2 days
  while (cursor <= end) {
    const dateKey = formatDateInput(cursor);
    const blocked = getBlockedDateConflict(location, dateKey);

    if (!blocked) {
      days += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

const getLoggedInUserFromRequest = async (req) => {
  const authHeader = req?.headers?.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId =
      decoded.userId ||
      decoded.id ||
      decoded._id ||
      decoded.sub ||
      decoded.user_id;

    if (!userId) {
      return null;
    }

    const user = await ParkingUser.findById(userId);

    if (!user) {
      throw new Error("Logged-in user not found");
    }

    if (!user.is_active) {
      throw new Error("Your account is inactive");
    }

    return user;
  } catch {
    throw new Error("Invalid or expired login. Please login again.");
  }
};

const createCustomerUserOrFail = async ({ name, email, phone }) => {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await ParkingUser.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw new Error("User already exists. Please login.");
  }

  try {
    return await ParkingUser.create({
      name,
      email: normalizedEmail,
      phone,
      role: "customer",
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new Error("User already exists. Please login.");
    }

    throw error;
  }
};

const locationSupportsStorageType = (location, storageType) => {
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

    const value = String(item.storage_type || item.name || item).toLowerCase();

    return (
      value === String(storageType._id).toLowerCase() ||
      value === String(storageType.name).toLowerCase()
    );
  });
};

/**
 * Count active Storage bookings for a specific Storage Type that overlap
 * the requested date range.
 *
 * Storage Type capacity is global because StorageType is currently standalone
 * and is not configured per location.
 */
const getExistingStorageTypeBookingCount = async ({
  storageTypeId,
  startDate,
  endDate,
  session = null,
}) => {
  if (
    !storageTypeId ||
    !mongoose.Types.ObjectId.isValid(storageTypeId) ||
    !startDate ||
    !endDate
  ) {
    return 0;
  }

  const query = Booking.countDocuments({
    type: "storage",
    "details.storage.storage_type_id": new mongoose.Types.ObjectId(
      storageTypeId
    ),
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

  if (session) {
    query.session(session);
  }

  const bookedCount = await query;

  return normalizeCount(bookedCount);
};

/**
 * Validate Storage Type booking capacity.
 *
 * Capacity rules:
 * - 0 = Unlimited
 * - > 0 = Maximum number of overlapping active bookings
 */
const validateStorageTypeCapacity = async ({
  storageType,
  startDate,
  endDate,
  session = null,
}) => {
  if (!storageType) {
    throw new Error("Invalid storage type");
  }

  const capacity = normalizeCount(storageType.capacity);

  // 0 means unlimited.
  if (capacity === 0) {
    return {
      capacity: 0,
      booked_count: 0,
      remaining: null,
      unlimited: true,
    };
  }

  const bookedCount = await getExistingStorageTypeBookingCount({
    storageTypeId: storageType._id,
    startDate,
    endDate,
    session,
  });

  const remaining = Math.max(capacity - bookedCount, 0);

  if (bookedCount >= capacity) {
    throw new Error(
      `${storageType.name} storage is fully booked for the selected dates`
    );
  }

  return {
    capacity,
    booked_count: bookedCount,
    remaining,
    unlimited: false,
  };
};

const getSettingsDocument = async () => {
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

  let shouldSaveDefaults = false;

  if (
    settings.holding_deposit_amount === undefined ||
    settings.holding_deposit_amount === null
  ) {
    settings.holding_deposit_amount = DEFAULT_HOLDING_DEPOSIT_AMOUNT;
    shouldSaveDefaults = true;
  }

  if (
    settings.cancellation_fee === undefined ||
    settings.cancellation_fee === null
  ) {
    settings.cancellation_fee = DEFAULT_ADMIN_ACTION_FEE;
    shouldSaveDefaults = true;
  }

  if (shouldSaveDefaults) {
    await settings.save();
  }

  return settings;
};

const getMatchedPriceRule = ({ settings, type, days, priceRuleId }) => {
  const normalizedType = String(type || "").toLowerCase().trim();
  const numericDays = Number(days || 0);

  if (!settings) {
    throw new Error("Settings were not found");
  }

  if (!["cruise", "storage", "airport"].includes(normalizedType)) {
    throw new Error("Invalid booking type for price rule");
  }

  if (!Number.isFinite(numericDays) || numericDays < 1) {
    throw new Error("Invalid booking days for price rule");
  }

  const rules = Array.isArray(settings.price_rules) ? settings.price_rules : [];
  let matchedRule = null;

  if (priceRuleId && mongoose.Types.ObjectId.isValid(priceRuleId)) {
    const requestedRule = rules.id(priceRuleId);

    if (
      requestedRule &&
      requestedRule.is_active !== false &&
      requestedRule.type === normalizedType &&
      Number(requestedRule.min_days || 0) <= numericDays &&
      Number(requestedRule.max_days || 0) >= numericDays
    ) {
      matchedRule = requestedRule;
    }
  }

  if (!matchedRule) {
    matchedRule = rules.find((rule) => {
      return (
        rule &&
        rule.is_active !== false &&
        rule.type === normalizedType &&
        Number(rule.min_days || 0) <= numericDays &&
        Number(rule.max_days || 0) >= numericDays
      );
    });
  }

  if (!matchedRule) {
    throw new Error(
      `No ${normalizedType} price rule found for ${numericDays} day(s). Please add it from Settings.`
    );
  }

  return matchedRule;
};

const serializePriceRuleForBooking = (rule) => {
  if (!rule) return null;

  return {
    price_rule_id: rule._id,
    type: rule.type,
    label: rule.label,
    min_days: rule.min_days,
    max_days: rule.max_days,
    price: rule.price,
  };
};

const getSettingsShuttleSlotTemplate = ({
  settings,
  type,
  shuttleSlotId,
  shuttleTime,
  directionKey = null,
}) => {
  const normalizedType = String(type || "").toLowerCase().trim();

  if (!["cruise", "airport"].includes(normalizedType)) {
    throw new Error("Invalid shuttle slot type");
  }

  const slots = Array.isArray(settings?.shuttle_time_slots)
    ? settings.shuttle_time_slots
    : [];

  let selectedSlot = null;

  if (shuttleSlotId && mongoose.Types.ObjectId.isValid(shuttleSlotId)) {
    selectedSlot = slots.id(shuttleSlotId);
  }

  if (!selectedSlot && shuttleTime) {
    const normalizedTime = String(shuttleTime).trim().toLowerCase();

    selectedSlot = slots.find((slot) => {
      return (
        slot &&
        slot.type === normalizedType &&
        getSlotTime(slot).toLowerCase() === normalizedTime
      );
    });
  }

  if (!selectedSlot || selectedSlot.type !== normalizedType) {
    throw new Error("Please select a valid shuttle option");
  }

  if (selectedSlot.is_active === false) {
    throw new Error("Selected shuttle option is not active");
  }

  if (normalizedType === "cruise") {
    if (
      directionKey === "carParkToTerminal" &&
      selectedSlot.show_car_park_to_terminal === false
    ) {
      throw new Error(
        "Selected shuttle option is not enabled for Car park to terminal"
      );
    }

    if (
      directionKey === "terminalToCarPark" &&
      selectedSlot.show_terminal_to_car_park === false
    ) {
      throw new Error(
        "Selected shuttle option is not enabled for Terminal to car park"
      );
    }
  }

  return selectedSlot;
};

const coalesceMongoExpressions = (expressions = [], fallback = null) => {
  return expressions.reduceRight((current, expression) => {
    return {
      $ifNull: [expression, current],
    };
  }, fallback);
};

const getExistingCruiseDirectionBookedPax = async ({
  scheduleId,
  shuttleSlotId,
  shuttleTime,
  directionKey,
  session = null,
}) => {
  if (!scheduleId || !mongoose.Types.ObjectId.isValid(scheduleId)) {
    return 0;
  }

  const isCarParkToTerminal = directionKey === "carParkToTerminal";
  const selectedSlotId = String(shuttleSlotId || "").trim();
  const selectedTime = String(shuttleTime || "").trim().toLowerCase();

  if (!selectedSlotId && !selectedTime) {
    return 0;
  }

  const slotIdExpression = isCarParkToTerminal
    ? coalesceMongoExpressions(
        [
          "$details.cruise.car_park_to_terminal_shuttle_slot_id",
          "$car_park_to_terminal_shuttle_slot_id",
          "$shuttle_slot_id",
        ],
        ""
      )
    : coalesceMongoExpressions(
        [
          "$details.cruise.terminal_to_car_park_shuttle_slot_id",
          "$terminal_to_car_park_shuttle_slot_id",
        ],
        ""
      );

  const timeExpression = isCarParkToTerminal
    ? coalesceMongoExpressions(
        [
          "$details.cruise.car_park_to_terminal_shuttle_time",
          "$car_park_to_terminal_shuttle_time",
          "$shuttle_time",
        ],
        ""
      )
    : coalesceMongoExpressions(
        [
          "$details.cruise.terminal_to_car_park_shuttle_time",
          "$terminal_to_car_park_shuttle_time",
        ],
        ""
      );

  const passengerExpression = isCarParkToTerminal
    ? coalesceMongoExpressions(
        [
          "$details.cruise.car_park_to_terminal_passengers",
          "$car_park_to_terminal_passengers",
          "$details.cruise.pickup_pax",
          "$pax",
        ],
        0
      )
    : coalesceMongoExpressions(
        [
          "$details.cruise.terminal_to_car_park_passengers",
          "$terminal_to_car_park_passengers",
        ],
        0
      );

  const matchConditions = [];

  if (selectedSlotId) {
    matchConditions.push({
      slot_id: selectedSlotId,
    });
  }

  if (selectedTime) {
    matchConditions.push({
      shuttle_time: selectedTime,
    });
  }

  if (matchConditions.length === 0) {
    return 0;
  }

  const aggregate = Booking.aggregate([
    {
      $match: {
        type: "cruise",
        schedule_id: new mongoose.Types.ObjectId(scheduleId),
        status: {
          $in: ACTIVE_BOOKING_STATUSES,
        },
      },
    },
    {
      $project: {
        slot_id: {
          $convert: {
            input: slotIdExpression,
            to: "string",
            onError: "",
            onNull: "",
          },
        },
        shuttle_time: {
          $toLower: {
            $trim: {
              input: {
                $ifNull: [timeExpression, ""],
              },
            },
          },
        },
        passenger_count: {
          $convert: {
            input: passengerExpression,
            to: "int",
            onError: 0,
            onNull: 0,
          },
        },
      },
    },
    {
      $match: {
        passenger_count: {
          $gt: 0,
        },
        $or: matchConditions,
      },
    },
    {
      $group: {
        _id: null,
        booked_pax: {
          $sum: "$passenger_count",
        },
      },
    },
  ]);

  if (session) {
    aggregate.session(session);
  }

  const result = await aggregate;

  return normalizeCount(result?.[0]?.booked_pax);
};

const validateCruiseDirectionShuttleCapacity = async ({
  settings,
  scheduleId,
  directionKey,
  passengerCount,
  shuttleSlotId,
  shuttleTime,
  session = null,
}) => {
  const passengerNumber = normalizeCount(passengerCount);

  if (passengerNumber < 1) {
    throw new Error("Please enter passengers at least 1");
  }

  const selectedSlot = getSettingsShuttleSlotTemplate({
    settings,
    type: "cruise",
    shuttleSlotId,
    shuttleTime,
    directionKey,
  });

  const capacity = normalizeCount(
    selectedSlot.capacity || settings?.default_shuttle_slot_capacity || 11
  );

  if (capacity <= 0) {
    throw new Error("Selected shuttle option has no capacity");
  }

  const bookedPax = await getExistingCruiseDirectionBookedPax({
    scheduleId,
    shuttleSlotId: selectedSlot._id,
    shuttleTime: getSlotTime(selectedSlot),
    directionKey,
    session,
  });

  const remaining = Math.max(capacity - bookedPax, 0);

  if (remaining < passengerNumber) {
    const label =
      directionKey === "carParkToTerminal"
        ? "Car park to terminal"
        : "Terminal to car park";

    throw new Error(
      `${label} shuttle option has only ${remaining} remaining seat(s)`
    );
  }

  return {
    slot: selectedSlot,
    slot_id: selectedSlot._id,
    time: getSlotTime(selectedSlot),
    capacity,
    booked_count: bookedPax,
    remaining,
  };
};

const incrementCruiseScheduleBookedCount = async ({
  scheduleId,
  session = null,
}) => {
  const query = CruiseSchedule.findById(scheduleId);

  if (session) {
    query.session(session);
  }

  const schedule = await query;

  if (!schedule) {
    throw new Error("Cruise schedule not found while reserving booking");
  }

  const capacity = normalizeCount(schedule.capacity);
  const bookedCount = normalizeCount(schedule.booked_count);

  if (capacity > 0 && bookedCount >= capacity) {
    throw new Error("Cruise is fully booked");
  }

  schedule.booked_count = bookedCount + 1;

  if (session) {
    await schedule.save({ session });
  } else {
    await schedule.save();
  }
};

const getAirportShuttleBookedPax = async ({
  locationId,
  startDate,
  shuttleTime,
  session = null,
}) => {
  if (!locationId || !shuttleTime || !startDate) {
    return 0;
  }

  const start = parseBookingDate(startDate);

  if (!start || Number.isNaN(start.getTime())) {
    return 0;
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const aggregate = Booking.aggregate([
    {
      $match: {
        type: "airport",
        location_id: new mongoose.Types.ObjectId(locationId),
        status: {
          $in: ACTIVE_BOOKING_STATUSES,
        },
        start_date: {
          $gte: start,
          $lt: end,
        },
        "details.airport.shuttle_time": String(shuttleTime).trim(),
      },
    },
    {
      $group: {
        _id: null,
        booked_pax: {
          $sum: {
            $ifNull: ["$details.airport.pickup_pax", "$pax"],
          },
        },
      },
    },
  ]);

  if (session) {
    aggregate.session(session);
  }

  const result = await aggregate;

  return normalizeCount(result?.[0]?.booked_pax);
};

const validateAirportShuttleCapacity = async ({
  locationId,
  startDate,
  slot,
  paxNumber,
  session = null,
}) => {
  const capacity = normalizeCount(slot?.capacity);
  const shuttleTime = getSlotTime(slot);

  if (capacity <= 0) {
    throw new Error("Selected shuttle option has no capacity");
  }

  const bookedPax = await getAirportShuttleBookedPax({
    locationId,
    startDate,
    shuttleTime,
    session,
  });

  const remaining = Math.max(capacity - bookedPax, 0);

  if (remaining < paxNumber) {
    throw new Error(
      `Selected airport shuttle option has only ${remaining} remaining seat(s)`
    );
  }
};

const reserveBookingCapacity = async ({
  type,
  scheduleForUpdate,
  session = null,
}) => {
  if (type === "cruise" && scheduleForUpdate) {
    await incrementCruiseScheduleBookedCount({
      scheduleId: scheduleForUpdate._id,
      session,
    });
  }
};

const createPasswordSetupUrlIfNeeded = async (userId) => {
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
};

const sendBookingEmailsSafely = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId)
      .populate("location_id")
      .populate("schedule_id")
      .populate("user_id", "name email phone role")
      .populate("coupon_id")
      .populate("details.storage.storage_type_id")
      .populate(
        "wallet_transaction_id",
        "transaction_reference transaction_id amount method status"
      );

    if (!booking) return;

    const passwordSetupUrl = await createPasswordSetupUrlIfNeeded(
      booking.user_id
    );

    await sendBookingEmails({
      booking,
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
    console.error("Booking created but email failed:", emailError);
  }
};

const getPaymentSetup = ({
  finalPrice,
  paymentFlow,
  paymentMethod,
  holdingDepositAmount,
  depositType,
}) => {
  const numericFinalPrice = normalizeMoney(finalPrice);

  if (numericFinalPrice <= 0) {
    return {
      isFreeBooking: true,
      isPaymentRequiredNow: false,
      isLegacyPoaBooking: false,
      isPoaDepositBooking: false,
      isOnlineFullPayment: false,
      isWalletPayment: false,
      isWalletFullPayment: false,
      isWalletPoaDeposit: false,

      finalPaymentFlow: undefined,
      finalPaymentMethod: undefined,
      finalDepositType: "full",

      bookingStatus: "success",
      paymentStatus: "paid",
      paidAmount: 0,
      dueAmount: 0,
      finalHoldingDepositAmount: 0,
      balanceDueOnArrival: 0,
      walletUsed: 0,
      walletDebitAmount: 0,
      paymentPurpose: "free_booking",
    };
  }

  const normalizedPaymentFlow = String(paymentFlow || "").trim();

  const normalizedPaymentMethod = String(paymentMethod || "")
    .toLowerCase()
    .trim();

  const isLegacyPoaBooking =
    !normalizedPaymentFlow &&
    (depositType === "poa" || normalizedPaymentMethod === "poa");

  if (isLegacyPoaBooking) {
    return {
      isFreeBooking: false,
      isPaymentRequiredNow: false,
      isLegacyPoaBooking: true,
      isPoaDepositBooking: false,
      isOnlineFullPayment: false,
      isWalletPayment: false,
      isWalletFullPayment: false,
      isWalletPoaDeposit: false,

      finalPaymentFlow: undefined,
      finalPaymentMethod: "poa",
      finalDepositType: "poa",

      bookingStatus: "poa",
      paymentStatus: "pending",
      paidAmount: 0,
      dueAmount: numericFinalPrice,
      finalHoldingDepositAmount: 0,
      balanceDueOnArrival: numericFinalPrice,
      walletUsed: 0,
      walletDebitAmount: 0,
      paymentPurpose: "pay_on_arrival",
    };
  }

  if (!normalizedPaymentFlow) {
    throw new Error("Payment option is required");
  }

  if (!["full_online", "poa_deposit"].includes(normalizedPaymentFlow)) {
    throw new Error("Invalid payment option");
  }

  if (normalizedPaymentFlow === "full_online") {
    if (!["stripe", "paypal", "wallet"].includes(normalizedPaymentMethod)) {
      throw new Error("Please select Stripe, PayPal, or Wallet");
    }

    if (normalizedPaymentMethod === "wallet") {
      return {
        isFreeBooking: false,
        isPaymentRequiredNow: false,
        isLegacyPoaBooking: false,
        isPoaDepositBooking: false,
        isOnlineFullPayment: false,
        isWalletPayment: true,
        isWalletFullPayment: true,
        isWalletPoaDeposit: false,

        finalPaymentFlow: "full_online",
        finalPaymentMethod: "wallet",
        finalDepositType: "full",

        bookingStatus: "success",
        paymentStatus: "paid",
        paidAmount: numericFinalPrice,
        dueAmount: 0,
        finalHoldingDepositAmount: 0,
        balanceDueOnArrival: 0,
        walletUsed: numericFinalPrice,
        walletDebitAmount: numericFinalPrice,
        paymentPurpose: "wallet_payment",
      };
    }

    return {
      isFreeBooking: false,
      isPaymentRequiredNow: true,
      isLegacyPoaBooking: false,
      isPoaDepositBooking: false,
      isOnlineFullPayment: true,
      isWalletPayment: false,
      isWalletFullPayment: false,
      isWalletPoaDeposit: false,

      finalPaymentFlow: "full_online",
      finalPaymentMethod: normalizedPaymentMethod,
      finalDepositType: "full",

      bookingStatus: "pending_payment",
      paymentStatus: "pending",
      paidAmount: 0,
      dueAmount: numericFinalPrice,
      finalHoldingDepositAmount: 0,
      balanceDueOnArrival: 0,
      walletUsed: 0,
      walletDebitAmount: 0,
      paymentPurpose: "full_online_payment",
    };
  }

  if (normalizedPaymentFlow === "poa_deposit") {
    if (!["stripe", "paypal", "wallet"].includes(normalizedPaymentMethod)) {
      throw new Error("Please select Stripe, PayPal, or Wallet for deposit");
    }

    const configuredDeposit = Number(holdingDepositAmount);

    const finalHoldingDepositAmount = normalizeMoney(
      Math.min(
        Number.isFinite(configuredDeposit) && configuredDeposit >= 0
          ? configuredDeposit
          : DEFAULT_HOLDING_DEPOSIT_AMOUNT,
        numericFinalPrice
      )
    );

    const balanceDueOnArrival = normalizeMoney(
      Math.max(numericFinalPrice - finalHoldingDepositAmount, 0)
    );

    if (normalizedPaymentMethod === "wallet") {
      return {
        isFreeBooking: false,
        isPaymentRequiredNow: false,
        isLegacyPoaBooking: false,
        isPoaDepositBooking: true,
        isOnlineFullPayment: false,
        isWalletPayment: true,
        isWalletFullPayment: false,
        isWalletPoaDeposit: true,

        finalPaymentFlow: "poa_deposit",
        finalPaymentMethod: "wallet",
        finalDepositType: "poa",

        bookingStatus: "poa",
        paymentStatus: "partial",
        paidAmount: finalHoldingDepositAmount,
        dueAmount: balanceDueOnArrival,
        finalHoldingDepositAmount,
        balanceDueOnArrival,
        walletUsed: finalHoldingDepositAmount,
        walletDebitAmount: finalHoldingDepositAmount,
        paymentPurpose: "poa_holding_deposit",
      };
    }

    return {
      isFreeBooking: false,
      isPaymentRequiredNow: true,
      isLegacyPoaBooking: false,
      isPoaDepositBooking: true,
      isOnlineFullPayment: false,
      isWalletPayment: false,
      isWalletFullPayment: false,
      isWalletPoaDeposit: false,

      finalPaymentFlow: "poa_deposit",
      finalPaymentMethod: normalizedPaymentMethod,
      finalDepositType: "poa",

      bookingStatus: "pending_payment",
      paymentStatus: "pending",
      paidAmount: 0,
      dueAmount: finalHoldingDepositAmount,
      finalHoldingDepositAmount,
      balanceDueOnArrival,
      walletUsed: 0,
      walletDebitAmount: 0,
      paymentPurpose: "poa_holding_deposit",
    };
  }

  throw new Error("Invalid payment setup");
};

function makeOnlinePaymentRequiredError({
  finalPaymentMethod,
  finalPaymentFlow,
  paymentPurpose,
  dueAmount,
  type,
}) {
  const methodLabel =
    finalPaymentMethod === "paypal"
      ? "PayPal"
      : finalPaymentMethod === "stripe"
      ? "Stripe"
      : "online";

  const error = new Error(
    `${methodLabel} payment must be completed before a booking is created.`
  );

  error.code = "ONLINE_PAYMENT_REQUIRED_BEFORE_BOOKING_CREATE";
  error.payment_required = true;
  error.payment_method = finalPaymentMethod;
  error.payment_flow = finalPaymentFlow;
  error.payment_purpose = paymentPurpose;
  error.amount_due_now = normalizeMoney(dueAmount);
  error.currency = "aud";
  error.booking_type = type;

  return error;
}

export const createBooking = async (data, req = null) => {
  const {
    type,

    first_name,
    last_name,
    name,
    email,
    phone,

    schedule_id,
    shuttle_slot_id,

    start_date,
    end_date,

    pax = 1,
    shuttle_time,
    location_id,

    storage_type_id,

    flight_number,
    terminal,

    license_plate,
    interlock = false,
    reference,

    notes,

    parking_slot,

    coupon_code,

    payment_flow,
    deposit_type,
    payment_method,
    source = "web",

    price_rule_id,
  } = data;

  if (!type) {
    throw new Error("Booking type is required");
  }

  if (!["cruise", "storage", "airport"].includes(type)) {
    throw new Error("Invalid booking type");
  }

  const settings = await getSettingsDocument();
  const configuredHoldingDepositAmount =
    getConfiguredHoldingDepositAmount(settings);

  const loggedInUser = await getLoggedInUserFromRequest(req);

  const requestedPaymentMethod = String(payment_method || "")
    .toLowerCase()
    .trim();

  if (!loggedInUser && requestedPaymentMethod === "wallet") {
    throw new Error("Wallet payment is available for logged-in customers only.");
  }

  const inputEmail = normalizeEmail(email);
  const inputName = name || `${first_name || ""} ${last_name || ""}`.trim();

  let user;
  let finalName = inputName;
  let normalizedEmail = inputEmail;
  let finalPhone = phone;

  if (loggedInUser) {
    if (inputEmail && inputEmail !== loggedInUser.email) {
      throw new Error("Please use your logged-in email for this booking.");
    }

    user = loggedInUser;
    normalizedEmail = loggedInUser.email;
    finalName = inputName || loggedInUser.name;
    finalPhone = phone || loggedInUser.phone;
  } else {
    if (!inputEmail || !phone) {
      throw new Error("Customer email and phone are required");
    }

    if (!inputName) {
      throw new Error("Customer first name and last name are required");
    }

    user = await createCustomerUserOrFail({
      name: inputName,
      email: inputEmail,
      phone,
    });
  }

  if (!finalName) {
    throw new Error("Customer name is required");
  }

  if (!normalizedEmail || !finalPhone) {
    throw new Error("Customer email and phone are required");
  }

  const normalizedSource = normalizeSource(source);

  const paxNumber =
    pax === undefined || pax === null || pax === "" ? 1 : Number(pax);

  if (Number.isNaN(paxNumber) || paxNumber < 0) {
    throw new Error("Invalid passenger count");
  }

  let locationId = location_id || null;
  let finalStartDate;
  let finalEndDate;
  let price = 0;
  let calculatedDays = 0;
  let matchedPriceRule = null;
  let details = {};
  let scheduleForUpdate = null;
  let selectedStorageType = null;

  let selectedCruiseShuttleSlotId = null;
  let selectedCruiseShuttleTime = null;
  let cruiseCarParkToTerminalPassengers = 0;
  let cruiseTerminalToCarParkPassengers = 0;
  let cruiseExtraPassengerCount = 0;
  let cruiseExtraPassengerFee = 0;
  let cruiseAddOnVehicleEnabled = false;
  let cruiseAddOnVehicleType = "";
  let cruiseAddOnVehicleLicensePlate = "";
  let cruiseAddOnVehicleDiscountPercent = ADD_ON_VEHICLE_DISCOUNT_PERCENT;
  let cruiseAddOnVehicleOriginalPrice = 0;
  let cruiseAddOnVehicleDiscountAmount = 0;
  let cruiseAddOnVehiclePrice = 0;

  if (type === "cruise") {
    if (!schedule_id) {
      throw new Error("Schedule is required for cruise booking");
    }

    const schedule = await CruiseSchedule.findById(schedule_id);

    if (!schedule) {
      throw new Error("Invalid cruise schedule");
    }

    if (schedule.is_active === false) {
      throw new Error("Selected cruise schedule is not active");
    }

    finalStartDate = schedule.departure_date;
    finalEndDate = schedule.return_date;
    locationId = schedule.location_id;
    scheduleForUpdate = schedule;

    const booked = await Booking.countDocuments({
      type: "cruise",
      schedule_id,
      status: { $in: ACTIVE_BOOKING_STATUSES },
    });

    if (schedule.capacity > 0 && booked >= schedule.capacity) {
      throw new Error("Cruise is fully booked");
    }

    cruiseCarParkToTerminalPassengers = normalizeCount(
      data.car_park_to_terminal_passengers ??
        data?.details?.cruise?.car_park_to_terminal_passengers
    );

    cruiseTerminalToCarParkPassengers = normalizeCount(
      data.terminal_to_car_park_passengers ??
        data?.details?.cruise?.terminal_to_car_park_passengers
    );

    if (cruiseCarParkToTerminalPassengers < 1) {
      throw new Error("Please enter Car park to terminal passengers at least 1");
    }

    if (cruiseTerminalToCarParkPassengers < 1) {
      throw new Error("Please enter Terminal to car park passengers at least 1");
    }

    const carParkToTerminalSlotId =
      data.car_park_to_terminal_shuttle_slot_id ||
      data?.details?.cruise?.car_park_to_terminal_shuttle_slot_id ||
      shuttle_slot_id;

    const carParkToTerminalTime =
      data.car_park_to_terminal_shuttle_time ||
      data?.details?.cruise?.car_park_to_terminal_shuttle_time ||
      shuttle_time;

    const terminalToCarParkSlotId =
      data.terminal_to_car_park_shuttle_slot_id ||
      data?.details?.cruise?.terminal_to_car_park_shuttle_slot_id;

    const terminalToCarParkTime =
      data.terminal_to_car_park_shuttle_time ||
      data?.details?.cruise?.terminal_to_car_park_shuttle_time;

    if (!carParkToTerminalSlotId && !carParkToTerminalTime) {
      throw new Error("Please select Car park to terminal shuttle option");
    }

    if (!terminalToCarParkSlotId && !terminalToCarParkTime) {
      throw new Error("Please select Terminal to car park shuttle option");
    }

    const carParkToTerminalSlot =
      await validateCruiseDirectionShuttleCapacity({
        settings,
        scheduleId: schedule._id,
        directionKey: "carParkToTerminal",
        passengerCount: cruiseCarParkToTerminalPassengers,
        shuttleSlotId: carParkToTerminalSlotId,
        shuttleTime: carParkToTerminalTime,
      });

    const terminalToCarParkSlot =
      await validateCruiseDirectionShuttleCapacity({
        settings,
        scheduleId: schedule._id,
        directionKey: "terminalToCarPark",
        passengerCount: cruiseTerminalToCarParkPassengers,
        shuttleSlotId: terminalToCarParkSlotId,
        shuttleTime: terminalToCarParkTime,
      });

    selectedCruiseShuttleSlotId = carParkToTerminalSlot.slot_id;
    selectedCruiseShuttleTime = carParkToTerminalSlot.time;

    calculatedDays = calculateDays(finalStartDate, finalEndDate);

    matchedPriceRule = getMatchedPriceRule({
      settings,
      type: "cruise",
      days: calculatedDays,
      priceRuleId: price_rule_id,
    });

    const parkingPrice = normalizeMoney(matchedPriceRule.price || 0);

    const extraPassengerResult = getCruiseExtraPassengerFee({
      carParkToTerminalPassengers: cruiseCarParkToTerminalPassengers,
      terminalToCarParkPassengers: cruiseTerminalToCarParkPassengers,
    });

    cruiseExtraPassengerCount = extraPassengerResult.extraPassengerCount;
    cruiseExtraPassengerFee = extraPassengerResult.extraPassengerFee;

    const addOnVehicleInput = data?.details?.cruise?.add_on_vehicle || {};

    cruiseAddOnVehicleEnabled = Boolean(
      data.add_on_vehicle_enabled ?? addOnVehicleInput.enabled
    );

    if (cruiseAddOnVehicleEnabled) {
      cruiseAddOnVehicleType = normalizeOptionalText(
        data.add_on_vehicle_type || addOnVehicleInput.type
      );

      cruiseAddOnVehicleLicensePlate = normalizeOptionalText(
        data.add_on_vehicle_license_plate || addOnVehicleInput.license_plate
      );

      if (!cruiseAddOnVehicleType) {
        throw new Error("Please select add-on vehicle");
      }

      if (!cruiseAddOnVehicleLicensePlate) {
        throw new Error(`${cruiseAddOnVehicleType} License Plate is required`);
      }

      /**
       * Server is the source of truth for add-on vehicle price.
       * Do not trust the frontend price values.
       */
      cruiseAddOnVehicleDiscountPercent = ADD_ON_VEHICLE_DISCOUNT_PERCENT;
      cruiseAddOnVehicleOriginalPrice = parkingPrice;
      cruiseAddOnVehicleDiscountAmount = normalizeMoney(
        (parkingPrice * cruiseAddOnVehicleDiscountPercent) / 100
      );
      cruiseAddOnVehiclePrice = normalizeMoney(
        Math.max(parkingPrice - cruiseAddOnVehicleDiscountAmount, 0)
      );
    }

    price = normalizeMoney(
      parkingPrice + cruiseExtraPassengerFee + cruiseAddOnVehiclePrice
    );

    const maxDirectionPassengers = Math.max(
      cruiseCarParkToTerminalPassengers,
      cruiseTerminalToCarParkPassengers
    );

    details = {
      pricing: {
        ...serializePriceRuleForBooking(matchedPriceRule),
        calculated_days: calculatedDays,
        parking_price: parkingPrice,
        included_shuttle_passengers: INCLUDED_CRUISE_SHUTTLE_PASSENGERS,
        extra_passenger_unit_fee: EXTRA_CRUISE_PASSENGER_FEE,
        extra_passenger_count: cruiseExtraPassengerCount,
        extra_passenger_fee: cruiseExtraPassengerFee,
        add_on_vehicle_original_price: cruiseAddOnVehicleOriginalPrice,
        add_on_vehicle_discount_percent: cruiseAddOnVehicleDiscountPercent,
        add_on_vehicle_discount_amount: cruiseAddOnVehicleDiscountAmount,
        add_on_vehicle_price: cruiseAddOnVehiclePrice,
        total_before_discount: price,
      },
      cruise: {
        ship_name: schedule.schedule_name,

        shuttle_time: selectedCruiseShuttleTime,
        shuttle_slot_id: selectedCruiseShuttleSlotId,
        pickup_pax: maxDirectionPassengers,

        car_park_to_terminal_passengers: cruiseCarParkToTerminalPassengers,
        car_park_to_terminal_shuttle_slot_id:
          carParkToTerminalSlot.slot_id,
        car_park_to_terminal_shuttle_time: carParkToTerminalSlot.time,

        terminal_to_car_park_passengers: cruiseTerminalToCarParkPassengers,
        terminal_to_car_park_shuttle_slot_id:
          terminalToCarParkSlot.slot_id,
        terminal_to_car_park_shuttle_time: terminalToCarParkSlot.time,

        extra_passenger_count: cruiseExtraPassengerCount,
        extra_passenger_fee: cruiseExtraPassengerFee,

        add_on_vehicle: {
          enabled: cruiseAddOnVehicleEnabled,
          type: cruiseAddOnVehicleType,
          license_plate: cruiseAddOnVehicleLicensePlate,
          discount_percent: cruiseAddOnVehicleDiscountPercent,
          original_price: cruiseAddOnVehicleOriginalPrice,
          discount_amount: cruiseAddOnVehicleDiscountAmount,
          price: cruiseAddOnVehiclePrice,
        },
      },
    };
  }

  if (type === "storage") {
    if (!locationId) {
      throw new Error("Location is required for storage booking");
    }

    if (!storage_type_id) {
      throw new Error("Storage type is required");
    }

    if (!start_date || !end_date) {
      throw new Error("Start date and end date are required for storage booking");
    }

    const storageType = await StorageType.findById(storage_type_id);

    if (!storageType) {
      throw new Error("Invalid storage type");
    }

    selectedStorageType = storageType;

    const location = await Location.findById(locationId);

    if (!location) {
      throw new Error("Invalid storage location");
    }

    if (location.type !== "storage") {
      throw new Error("Selected location is not a storage location");
    }

    if (!location.is_active) {
      throw new Error("Selected storage location is not active");
    }

    if (!locationSupportsStorageType(location, storageType)) {
      throw new Error(
        `This location does not support ${storageType.name} storage`
      );
    }

    finalStartDate = parseBookingDate(start_date);
    finalEndDate = parseBookingDate(end_date);

    if (
      !finalStartDate ||
      !finalEndDate ||
      Number.isNaN(finalStartDate.getTime()) ||
      Number.isNaN(finalEndDate.getTime())
    ) {
      throw new Error("Invalid date format");
    }

    if (finalEndDate < finalStartDate) {
      throw new Error("Exit date cannot be before entry date");
    }

    /**
     * Storage Type capacity:
     * - 0 = Unlimited
     * - > 0 = Maximum overlapping bookings for this Storage Type
     */
    await validateStorageTypeCapacity({
      storageType,
      startDate: finalStartDate,
      endDate: finalEndDate,
    });

    /**
     * Keep the existing Storage Location capacity as a separate overall limit.
     */
    const booked = await Booking.countDocuments({
      type: "storage",
      location_id: locationId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
      start_date: { $lte: finalEndDate },
      end_date: { $gte: finalStartDate },
    });

    if (location.capacity > 0 && booked >= location.capacity) {
      throw new Error("No storage slots available");
    }

    calculatedDays = calculateInclusiveDays(
      finalStartDate,
      finalEndDate
    );

    matchedPriceRule = getMatchedPriceRule({
      settings,
      type: "storage",
      days: calculatedDays,
      priceRuleId: price_rule_id,
    });

    price = normalizeMoney(matchedPriceRule.price || 0);

    details = {
      pricing: {
        ...serializePriceRuleForBooking(matchedPriceRule),
        calculated_days: calculatedDays,
      },
      storage: {
        storage_type_id: storageType._id,
        storage_type_name: storageType.name,
      },
    };
  }

  if (type === "airport") {
    if (!locationId) {
      throw new Error("Location is required for airport booking");
    }

    if (!start_date || !end_date) {
      throw new Error("Start date and end date are required for airport booking");
    }

    const location = await Location.findById(locationId);

    if (!location) {
      throw new Error("Invalid airport location");
    }

    if (location.type !== "airport") {
      throw new Error("Selected location is not an airport location");
    }

    if (!location.is_active) {
      throw new Error("Selected airport location is not active");
    }

    finalStartDate = parseBookingDate(start_date);
    finalEndDate = parseBookingDate(end_date);

    if (
      !finalStartDate ||
      !finalEndDate ||
      Number.isNaN(finalStartDate.getTime()) ||
      Number.isNaN(finalEndDate.getTime())
    ) {
      throw new Error("Invalid date format");
    }

    if (finalEndDate < finalStartDate) {
      throw new Error("Exit date cannot be before entry date");
    }

    const entryBlocked = getBlockedDateConflict(location, start_date);
    const exitBlocked = getBlockedDateConflict(location, end_date);

    if (entryBlocked) {
      throw new Error(`Entry date is blocked by admin. ${entryBlocked.reason}`);
    }

    if (exitBlocked) {
      throw new Error(`Exit date is blocked by admin. ${exitBlocked.reason}`);
    }

    const booked = await Booking.countDocuments({
      type: "airport",
      location_id: locationId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
      start_date: { $lte: finalEndDate },
      end_date: { $gte: finalStartDate },
    });

    if (location.capacity > 0 && booked >= location.capacity) {
      throw new Error("No airport parking slots available");
    }

    calculatedDays = calculateBookableDays(
      finalStartDate,
      finalEndDate,
      location
    );

    if (calculatedDays < 1) {
      throw new Error(
        "Selected date range does not include any available booking days"
      );
    }

    matchedPriceRule = getMatchedPriceRule({
      settings,
      type: "airport",
      days: calculatedDays,
      priceRuleId: price_rule_id,
    });

    price = normalizeMoney(matchedPriceRule.price || 0);

    let selectedAirportShuttleTime = null;
    let selectedAirportShuttleSlotId = null;
    const airportShuttleEnabled = Boolean(location.show_shuttle_options);

    if (airportShuttleEnabled) {
      if (paxNumber < 1) {
        throw new Error("Please enter passengers at least 1 for shuttle");
      }

      const selectedSlot = getSettingsShuttleSlotTemplate({
        settings,
        type: "airport",
        shuttleSlotId: shuttle_slot_id,
        shuttleTime: shuttle_time,
      });

      await validateAirportShuttleCapacity({
        locationId,
        startDate: finalStartDate,
        slot: selectedSlot,
        paxNumber,
      });

      selectedAirportShuttleTime = getSlotTime(selectedSlot);
      selectedAirportShuttleSlotId = selectedSlot._id;
    } else if (shuttle_slot_id || shuttle_time) {
      throw new Error("Shuttle options are not enabled for this airport");
    }

    details = {
      pricing: {
        ...serializePriceRuleForBooking(matchedPriceRule),
        calculated_days: calculatedDays,
      },
      airport: {
        shuttle_time: selectedAirportShuttleTime,
        shuttle_slot_id: selectedAirportShuttleSlotId,
        pickup_pax: airportShuttleEnabled ? paxNumber : 0,
        flight_number,
        terminal,
      },
    };
  }

  let originalPrice = normalizeMoney(price);
  let finalPrice = originalPrice;
  let discountAmount = 0;
  let finalCouponCode = null;
  let finalCouponId = null;

  if (coupon_code) {
    const couponResult = await getCouponDiscountResult({
      code: coupon_code,
      bookingType: type,
      amount: originalPrice,
    });

    originalPrice = normalizeMoney(couponResult.original_price);
    discountAmount = normalizeMoney(couponResult.discount_amount);
    finalPrice = normalizeMoney(couponResult.final_price);
    finalCouponCode = couponResult.coupon_code;
    finalCouponId = couponResult.coupon_id;
  }

  const paymentSetup = getPaymentSetup({
    finalPrice,
    paymentFlow: payment_flow,
    paymentMethod: payment_method,
    holdingDepositAmount: configuredHoldingDepositAmount,
    depositType: deposit_type,
  });

  const {
    isFreeBooking,
    isPaymentRequiredNow,
    isLegacyPoaBooking,
    isPoaDepositBooking,
    isOnlineFullPayment,
    isWalletPayment,
    isWalletPoaDeposit,

    finalPaymentFlow,
    finalPaymentMethod,
    finalDepositType,

    bookingStatus,
    paymentStatus,
    paidAmount,
    dueAmount,
    finalHoldingDepositAmount,
    balanceDueOnArrival,
    walletUsed,
    walletDebitAmount,
    paymentPurpose,
  } = paymentSetup;

  if (isWalletPayment) {
    if (!loggedInUser) {
      throw new Error("Wallet payment is available for logged-in customers only.");
    }

    if (user.role !== "customer") {
      throw new Error("Wallet payment is available for customers only.");
    }

    if (user.wallet_status && user.wallet_status !== "active") {
      throw new Error("Your wallet is not active.");
    }
  }

  const bookingPax =
    type === "storage"
      ? 0
      : type === "airport" && !details?.airport?.shuttle_time
      ? 0
      : type === "cruise"
      ? Math.max(
          cruiseCarParkToTerminalPassengers,
          cruiseTerminalToCarParkPassengers
        )
      : paxNumber;

  const statusNote = isPoaDepositBooking
    ? isWalletPoaDeposit
      ? `AUD ${finalHoldingDepositAmount.toFixed(
          2
        )} holding deposit paid by wallet. Balance due on arrival: AUD ${balanceDueOnArrival.toFixed(
          2
        )}.`
      : `Booking created and awaiting AUD ${finalHoldingDepositAmount.toFixed(
          2
        )} holding deposit by ${finalPaymentMethod}`
    : isOnlineFullPayment
    ? "Booking created and awaiting online payment"
    : isWalletPayment
    ? "Booking paid using wallet"
    : isLegacyPoaBooking
    ? "POA booking created"
    : "Booking created";

  const bookingPayload = {
    booking_id: generateBookingId(),

    user_id: user._id,
    location_id: locationId,
    schedule_id: type === "cruise" ? schedule_id : null,

    type,
    start_date: finalStartDate,
    end_date: finalEndDate,

    pax: bookingPax,

    license_plate:
      type === "storage" ? undefined : normalizeOptionalText(license_plate),
    interlock: type === "storage" ? false : interlock,

    add_on_vehicle_enabled:
      type === "cruise" ? cruiseAddOnVehicleEnabled : false,
    add_on_vehicle_type:
      type === "cruise" ? cruiseAddOnVehicleType : "",
    add_on_vehicle_license_plate:
      type === "cruise" ? cruiseAddOnVehicleLicensePlate : "",
    add_on_vehicle_discount_percent:
      type === "cruise" ? cruiseAddOnVehicleDiscountPercent : 0,
    add_on_vehicle_original_price:
      type === "cruise" ? cruiseAddOnVehicleOriginalPrice : 0,
    add_on_vehicle_discount_amount:
      type === "cruise" ? cruiseAddOnVehicleDiscountAmount : 0,
    add_on_vehicle_price:
      type === "cruise" ? cruiseAddOnVehiclePrice : 0,

    reference,
    notes,
    parking_slot,
    details,

    customer: {
      name: finalName,
      email: normalizedEmail,
      phone: finalPhone,
    },

    pricing_type: type === "cruise" ? "fixed" : "daily",
    currency: "aud",

    original_price: originalPrice,
    discount_amount: discountAmount,
    coupon_code: finalCouponCode,
    coupon_id: finalCouponId,

    price: finalPrice,
    paid_amount: paidAmount,
    due_amount: dueAmount,
    wallet_used: walletUsed,

    payment_flow: finalPaymentFlow,
    holding_deposit_amount: finalHoldingDepositAmount,
    balance_due_on_arrival: balanceDueOnArrival,

    deposit_type: finalDepositType,
    payment_method: finalPaymentMethod,

    payment_status: paymentStatus,
    status: bookingStatus,

    source: normalizedSource,

    status_history: [
      {
        status: bookingStatus,
        note: statusNote,
        changed_by: null,
        date: new Date(),
      },
    ],
  };

  if (isWalletPayment) {
    const session = await mongoose.startSession();
    let booking = null;

    try {
      await session.withTransaction(async () => {
        if (type === "storage" && selectedStorageType) {
          const storageTypeForTransaction = await StorageType.findById(
            selectedStorageType._id
          ).session(session);

          if (!storageTypeForTransaction) {
            throw new Error("Invalid storage type");
          }

          await validateStorageTypeCapacity({
            storageType: storageTypeForTransaction,
            startDate: finalStartDate,
            endDate: finalEndDate,
            session,
          });
        }

        const updatedUser = await ParkingUser.findOneAndUpdate(
          {
            _id: user._id,
            is_active: true,
            wallet_status: "active",
            wallet_balance: { $gte: walletDebitAmount },
          },
          {
            $inc: {
              wallet_balance: -walletDebitAmount,
            },
            $set: {
              wallet_updated_at: new Date(),
            },
          },
          {
            session,
            returnDocument: "after",
          }
        );

        if (!updatedUser) {
          throw new Error(
            `Insufficient wallet balance. Required: AUD ${walletDebitAmount.toFixed(
              2
            )}`
          );
        }

        if (type === "cruise") {
          await validateCruiseDirectionShuttleCapacity({
            settings,
            scheduleId: scheduleForUpdate._id,
            directionKey: "carParkToTerminal",
            passengerCount: cruiseCarParkToTerminalPassengers,
            shuttleSlotId:
              details.cruise.car_park_to_terminal_shuttle_slot_id,
            shuttleTime: details.cruise.car_park_to_terminal_shuttle_time,
            session,
          });

          await validateCruiseDirectionShuttleCapacity({
            settings,
            scheduleId: scheduleForUpdate._id,
            directionKey: "terminalToCarPark",
            passengerCount: cruiseTerminalToCarParkPassengers,
            shuttleSlotId:
              details.cruise.terminal_to_car_park_shuttle_slot_id,
            shuttleTime: details.cruise.terminal_to_car_park_shuttle_time,
            session,
          });
        }

        const balanceAfter = normalizeMoney(updatedUser.wallet_balance);
        const balanceBefore = normalizeMoney(balanceAfter + walletDebitAmount);

        const createdBookings = await Booking.create([bookingPayload], {
          session,
        });

        booking = createdBookings[0];

        const walletTransactions = await WalletTransaction.create(
          [
            {
              user_id: user._id,
              booking_id: booking._id,
              type: "booking_payment",
              direction: "debit",
              amount: walletDebitAmount,
              currency: "aud",
              balance_before: balanceBefore,
              balance_after: balanceAfter,
              status: "completed",
              method: "wallet",
              note: isWalletPoaDeposit
                ? `Wallet holding deposit for booking ${booking.booking_id}`
                : `Wallet payment for booking ${booking.booking_id}`,
              completed_at: new Date(),
              metadata: {
                booking_id: booking.booking_id,
                booking_type: type,
                payment_flow: finalPaymentFlow,
                deposit_type: finalDepositType,
                payment_purpose: paymentPurpose,
                price_rule_id: matchedPriceRule?._id
                  ? String(matchedPriceRule._id)
                  : null,
                calculated_days: calculatedDays,
                cruise_extra_passenger_count:
                  type === "cruise" ? cruiseExtraPassengerCount : 0,
                cruise_extra_passenger_fee:
                  type === "cruise" ? cruiseExtraPassengerFee : 0,
                add_on_vehicle_enabled:
                  type === "cruise" ? cruiseAddOnVehicleEnabled : false,
                add_on_vehicle_type:
                  type === "cruise" ? cruiseAddOnVehicleType : "",
                add_on_vehicle_license_plate:
                  type === "cruise" ? cruiseAddOnVehicleLicensePlate : "",
                add_on_vehicle_original_price:
                  type === "cruise" ? cruiseAddOnVehicleOriginalPrice : 0,
                add_on_vehicle_discount_percent:
                  type === "cruise" ? cruiseAddOnVehicleDiscountPercent : 0,
                add_on_vehicle_discount_amount:
                  type === "cruise" ? cruiseAddOnVehicleDiscountAmount : 0,
                add_on_vehicle_price:
                  type === "cruise" ? cruiseAddOnVehiclePrice : 0,
              },
            },
          ],
          { session }
        );

        const walletTransaction = walletTransactions[0];

        const payments = await Payment.create(
          [
            {
              booking_id: booking._id,
              user_id: user._id,
              wallet_transaction_id: walletTransaction._id,

              amount: walletDebitAmount,
              currency: "aud",

              method: "wallet",
              status: "paid",

              payment_flow: finalPaymentFlow,
              deposit_type: finalDepositType,
              payment_purpose: paymentPurpose,

              transaction_id: walletTransaction.transaction_reference,

              booking_total_amount: finalPrice,
              holding_deposit_amount: finalHoldingDepositAmount,
              balance_due_on_arrival: balanceDueOnArrival,

              wallet_balance_before: balanceBefore,
              wallet_balance_after: balanceAfter,
              paid_at: new Date(),

              provider_payload: {
                note: isWalletPoaDeposit
                  ? "POA holding deposit paid from wallet balance"
                  : "Booking paid from wallet balance",
              },
            },
          ],
          { session }
        );

        await WalletTransaction.findByIdAndUpdate(
          walletTransaction._id,
          {
            payment_id: payments[0]._id,
          },
          { session }
        );

        await Booking.findByIdAndUpdate(
          booking._id,
          {
            wallet_transaction_id: walletTransaction._id,
          },
          { session }
        );

        booking.wallet_transaction_id = walletTransaction._id;

        await reserveBookingCapacity({
          type,
          scheduleForUpdate,
          session,
        });

        if (finalCouponId) {
          await Coupon.findByIdAndUpdate(
            finalCouponId,
            {
              $inc: {
                used_count: 1,
              },
            },
            { session }
          );
        }
      });

      await sendBookingEmailsSafely(booking._id);

      return booking;
    } finally {
      await session.endSession();
    }
  }

  /**
   * IMPORTANT FIX:
   * Do not create a real Booking document for Stripe/PayPal here.
   *
   * Before this fix, Stripe/PayPal requests reached Booking.create() below and
   * saved unpaid bookings as:
   * - status: pending_payment
   * - payment_status: pending
   *
   * That is why unpaid bookings appeared in admin/customer booking lists.
   * Real online-payment bookings should be created only after successful
   * Stripe webhook or PayPal capture in a proper payment-draft/checkout flow.
   */
  if (isPaymentRequiredNow || ONLINE_PAYMENT_METHODS.includes(finalPaymentMethod)) {
    throw makeOnlinePaymentRequiredError({
      finalPaymentMethod,
      finalPaymentFlow,
      paymentPurpose,
      dueAmount,
      type,
    });
  }

  if (type === "storage" && selectedStorageType) {
    const latestStorageType = await StorageType.findById(
      selectedStorageType._id
    );

    if (!latestStorageType) {
      throw new Error("Invalid storage type");
    }

    await validateStorageTypeCapacity({
      storageType: latestStorageType,
      startDate: finalStartDate,
      endDate: finalEndDate,
    });
  }

  const booking = await Booking.create(bookingPayload);

  try {
    await reserveBookingCapacity({
      type,
      scheduleForUpdate,
    });

    if (finalCouponId) {
      await Coupon.findByIdAndUpdate(finalCouponId, {
        $inc: {
          used_count: 1,
        },
      });
    }

    if (isLegacyPoaBooking) {
      await Payment.create({
        booking_id: booking._id,
        user_id: user._id,
        amount: finalPrice,
        currency: "aud",
        method: "poa",
        status: "pending",
        payment_flow: "legacy_poa",
        deposit_type: "poa",
        payment_purpose: "pay_on_arrival",
        booking_total_amount: finalPrice,
        provider_payload: {
          note: "Legacy pay on arrival booking created",
        },
      });
    }

    const shouldSendBookingEmailNow = isFreeBooking || isLegacyPoaBooking;

    if (shouldSendBookingEmailNow) {
      await sendBookingEmailsSafely(booking._id);
    }

    return booking;
  } catch (error) {
    await Booking.deleteOne({ _id: booking._id });
    throw error;
  }
};
