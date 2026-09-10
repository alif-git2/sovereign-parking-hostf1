import mongoose from "mongoose";
import Setting from "@/app/backend/models/settings";
import Booking from "@/app/backend/models/booking";
import Location from "@/app/backend/models/location";
import { requireAdminUser } from "@/app/backend/utils/authToken";

const GLOBAL_SETTING_ID = "global_config";

const DEFAULT_HOLDING_DEPOSIT_AMOUNT = 20;
const DEFAULT_ADMIN_ACTION_FEE = 10;

const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "pending_payment",
  "success",
  "confirmed",
  "poa",
];

const CUSTOMER_EMAIL_BOOKING_TYPES = ["cruise", "airport", "storage"];

const CUSTOMER_EMAIL_TEMPLATE_KEYS = [
  "booking_confirmation",
  "cancellation",
  "refund",
  "credit",
  "reminder",
  "feedback",
];

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (value.includes("authorization") || value.includes("token")) return 401;
  if (value.includes("admin")) return 403;
  if (value.includes("not found")) return 404;
  if (value.includes("already exists") || value.includes("overlap")) return 409;

  return 400;
}

function normalizeBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
}

function normalizeNumber(value, defaultValue = 0) {
  const number = Number(value ?? defaultValue);

  if (!Number.isFinite(number)) {
    return defaultValue;
  }

  return number;
}

function normalizeCount(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeType(value, allowedTypes = ["cruise", "storage", "airport"]) {
  const type = normalizeString(value).toLowerCase();

  if (!allowedTypes.includes(type)) {
    throw new Error("Invalid type");
  }

  return type;
}

function toPlainObject(value) {
  if (!value) return {};

  if (typeof value.toObject === "function") {
    return value.toObject({
      depopulate: true,
      versionKey: false,
    });
  }

  return value;
}

function normalizeEmailTemplate(template = {}) {
  if (!template || typeof template !== "object") {
    return null;
  }

  return {
    subject: String(template.subject || "").trim().slice(0, 300),
    html: String(template.html || "").slice(0, 200000),
    text: String(template.text || "").slice(0, 50000),
    is_active: normalizeBoolean(template.is_active, true),
  };
}

function normalizeCustomerEmailTemplates(currentTemplates = {}, incoming = {}) {
  const current = toPlainObject(currentTemplates);
  const currentCustomer = toPlainObject(current.customer);
  const incomingCustomer = toPlainObject(incoming.customer || incoming);

  const nextCustomer = {
    cruise: {
      ...(toPlainObject(currentCustomer.cruise) || {}),
    },
    airport: {
      ...(toPlainObject(currentCustomer.airport) || {}),
    },
    storage: {
      ...(toPlainObject(currentCustomer.storage) || {}),
    },
  };

  for (const bookingType of CUSTOMER_EMAIL_BOOKING_TYPES) {
    const templatesForType = incomingCustomer?.[bookingType];

    if (!templatesForType || typeof templatesForType !== "object") {
      continue;
    }

    for (const templateKey of CUSTOMER_EMAIL_TEMPLATE_KEYS) {
      const normalizedTemplate = normalizeEmailTemplate(
        templatesForType[templateKey]
      );

      if (!normalizedTemplate) {
        continue;
      }

      nextCustomer[bookingType][templateKey] = {
        ...(toPlainObject(nextCustomer[bookingType][templateKey]) || {}),
        ...normalizedTemplate,
      };
    }
  }

  return {
    ...(current || {}),
    customer: nextCustomer,
  };
}

function parseDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate()
  );
}

async function getSettingsDocument() {
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

  if (settings.cancellation_fee === undefined || settings.cancellation_fee === null) {
    settings.cancellation_fee = DEFAULT_ADMIN_ACTION_FEE;
    shouldSaveDefaults = true;
  }

  if (shouldSaveDefaults) {
    await settings.save();
  }

  return settings;
}

function getSubDocumentById(items = [], itemId, label = "Item") {
  const id = String(itemId || "").trim();

  if (!id) {
    throw new Error(`${label} ID is required`);
  }

  const item = items.id(id);

  if (!item) {
    throw new Error(`${label} not found`);
  }

  return item;
}

function getSlotTime(slot) {
  return normalizeString(slot?.time || slot?.shuttle_time);
}

function getCruiseDirectionFlags(slot = {}) {
  return {
    show_car_park_to_terminal: slot.show_car_park_to_terminal !== false,
    show_terminal_to_car_park: slot.show_terminal_to_car_park !== false,
  };
}

function serializePriceRule(rule) {
  return {
    _id: rule._id,
    type: rule.type,
    label: rule.label,
    min_days: rule.min_days,
    max_days: rule.max_days,
    price: rule.price,
    is_active: rule.is_active,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

/**
 * Settings shuttle slots are templates only.
 * Do not use stored booked_count from Settings.
 */
function serializeShuttleSlot(slot) {
  const capacity = normalizeCount(slot.capacity);
  const time = getSlotTime(slot);
  const cruiseFlags = getCruiseDirectionFlags(slot);

  return {
    _id: slot._id,
    type: slot.type,
    time,
    shuttle_time: time,
    capacity,
    booked_count: 0,
    remaining: capacity,

    show_car_park_to_terminal: cruiseFlags.show_car_park_to_terminal,
    show_terminal_to_car_park: cruiseFlags.show_terminal_to_car_park,

    car_park_to_terminal_booked_count: 0,
    car_park_to_terminal_remaining: capacity,
    terminal_to_car_park_booked_count: 0,
    terminal_to_car_park_remaining: capacity,

    is_active: slot.is_active !== false,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  };
}

function serializeAirportShuttleSlotWithBookedCount(slot, bookedCount = 0) {
  const capacity = normalizeCount(slot.capacity);
  const booked = normalizeCount(bookedCount);
  const remaining = Math.max(capacity - booked, 0);
  const time = getSlotTime(slot);
  const cruiseFlags = getCruiseDirectionFlags(slot);

  return {
    _id: slot._id,
    type: "airport",
    time,
    shuttle_time: time,
    capacity,
    booked_count: booked,
    remaining,

    show_car_park_to_terminal: cruiseFlags.show_car_park_to_terminal,
    show_terminal_to_car_park: cruiseFlags.show_terminal_to_car_park,

    is_active: slot.is_active !== false,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  };
}

function serializeCruiseShuttleSlotWithBookedCounts(slot, bookedCounts = {}) {
  const capacity = normalizeCount(slot.capacity);
  const time = getSlotTime(slot);
  const timeKey = time.toLowerCase();
  const slotIdKey = String(slot._id || "");
  const cruiseFlags = getCruiseDirectionFlags(slot);

  const carParkToTerminalBooked = normalizeCount(
    bookedCounts.carParkToTerminalBySlotId?.get(slotIdKey) ??
      bookedCounts.carParkToTerminalByTime?.get(timeKey) ??
      0
  );

  const terminalToCarParkBooked = normalizeCount(
    bookedCounts.terminalToCarParkBySlotId?.get(slotIdKey) ??
      bookedCounts.terminalToCarParkByTime?.get(timeKey) ??
      0
  );

  const carParkToTerminalRemaining = Math.max(
    capacity - carParkToTerminalBooked,
    0
  );

  const terminalToCarParkRemaining = Math.max(
    capacity - terminalToCarParkBooked,
    0
  );

  return {
    _id: slot._id,
    type: "cruise",
    time,
    shuttle_time: time,
    capacity,

    booked_count: Math.max(carParkToTerminalBooked, terminalToCarParkBooked),
    remaining: Math.max(
      capacity - Math.max(carParkToTerminalBooked, terminalToCarParkBooked),
      0
    ),

    show_car_park_to_terminal: cruiseFlags.show_car_park_to_terminal,
    show_terminal_to_car_park: cruiseFlags.show_terminal_to_car_park,

    car_park_to_terminal_booked_count: carParkToTerminalBooked,
    car_park_to_terminal_remaining: carParkToTerminalRemaining,

    terminal_to_car_park_booked_count: terminalToCarParkBooked,
    terminal_to_car_park_remaining: terminalToCarParkRemaining,

    is_active: slot.is_active !== false,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  };
}

async function getAirportShuttleBookedCountByTime({ locationId, date }) {
  if (!locationId || !mongoose.Types.ObjectId.isValid(locationId) || !date) {
    return new Map();
  }

  const start = parseDateOnly(date);

  if (!start) {
    return new Map();
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const result = await Booking.aggregate([
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
        "details.airport.shuttle_time": {
          $nin: [null, ""],
        },
      },
    },
    {
      $group: {
        _id: "$details.airport.shuttle_time",
        booked_count: {
          $sum: {
            $ifNull: ["$details.airport.pickup_pax", "$pax"],
          },
        },
      },
    },
  ]);

  return new Map(
    result
      .filter((item) => item?._id)
      .map((item) => [
        String(item._id).trim().toLowerCase(),
        normalizeCount(item.booked_count),
      ])
  );
}

function coalesceMongoExpressions(expressions = [], fallback = null) {
  return expressions.reduceRight((current, expression) => {
    return {
      $ifNull: [expression, current],
    };
  }, fallback);
}

async function aggregateCruiseDirectionBookedCounts(match, direction) {
  const isCarParkToTerminal = direction === "car_park_to_terminal";

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

  const result = await Booking.aggregate([
    {
      $match: match,
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
        $or: [
          {
            slot_id: {
              $ne: "",
            },
          },
          {
            shuttle_time: {
              $ne: "",
            },
          },
        ],
      },
    },
    {
      $group: {
        _id: {
          slot_id: "$slot_id",
          shuttle_time: "$shuttle_time",
        },
        booked_count: {
          $sum: "$passenger_count",
        },
      },
    },
  ]);

  const bySlotId = new Map();
  const byTime = new Map();

  for (const item of result) {
    const slotId = String(item?._id?.slot_id || "").trim();
    const shuttleTime = String(item?._id?.shuttle_time || "")
      .trim()
      .toLowerCase();
    const bookedCount = normalizeCount(item.booked_count);

    if (slotId) {
      bySlotId.set(slotId, (bySlotId.get(slotId) || 0) + bookedCount);
    }

    if (shuttleTime) {
      byTime.set(shuttleTime, (byTime.get(shuttleTime) || 0) + bookedCount);
    }
  }

  return {
    bySlotId,
    byTime,
  };
}

async function getCruiseShuttleBookedCounts({ scheduleId, date }) {
  const emptyResult = {
    carParkToTerminalBySlotId: new Map(),
    carParkToTerminalByTime: new Map(),
    terminalToCarParkBySlotId: new Map(),
    terminalToCarParkByTime: new Map(),
  };

  const match = {
    type: "cruise",
    status: {
      $in: ACTIVE_BOOKING_STATUSES,
    },
  };

  if (scheduleId && mongoose.Types.ObjectId.isValid(scheduleId)) {
    match.schedule_id = new mongoose.Types.ObjectId(scheduleId);
  } else if (date) {
    const start = parseDateOnly(date);

    if (!start) {
      return emptyResult;
    }

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    match.start_date = {
      $gte: start,
      $lt: end,
    };
  } else {
    return emptyResult;
  }

  const [carParkToTerminal, terminalToCarPark] = await Promise.all([
    aggregateCruiseDirectionBookedCounts(match, "car_park_to_terminal"),
    aggregateCruiseDirectionBookedCounts(match, "terminal_to_car_park"),
  ]);

  return {
    carParkToTerminalBySlotId: carParkToTerminal.bySlotId,
    carParkToTerminalByTime: carParkToTerminal.byTime,
    terminalToCarParkBySlotId: terminalToCarPark.bySlotId,
    terminalToCarParkByTime: terminalToCarPark.byTime,
  };
}

function validatePriceRulePayload(body = {}) {
  const type = normalizeType(body.type);
  const label = normalizeString(body.label);
  const minDays = normalizeNumber(body.min_days, 0);
  const maxDays = normalizeNumber(body.max_days, 0);
  const price = normalizeNumber(body.price, 0);

  if (!label) {
    throw new Error("Label is required");
  }

  if (!Number.isInteger(minDays) || minDays < 1) {
    throw new Error("Min days must be at least 1");
  }

  if (!Number.isInteger(maxDays) || maxDays < 1) {
    throw new Error("Max days must be at least 1");
  }

  if (maxDays < minDays) {
    throw new Error("Max days cannot be less than min days");
  }

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price cannot be negative");
  }

  return {
    type,
    label,
    min_days: minDays,
    max_days: maxDays,
    price,
    is_active: normalizeBoolean(body.is_active, true),
  };
}

function validateNoOverlappingPriceRule(settings, payload, ignoreRuleId = null) {
  const priceRules = Array.isArray(settings.price_rules)
    ? settings.price_rules
    : [];

  const overlappingRule = priceRules.find((rule) => {
    if (ignoreRuleId && String(rule._id) === String(ignoreRuleId)) {
      return false;
    }

    if (rule.type !== payload.type) {
      return false;
    }

    if (rule.is_active === false || payload.is_active === false) {
      return false;
    }

    return (
      payload.min_days <= Number(rule.max_days || 0) &&
      payload.max_days >= Number(rule.min_days || 0)
    );
  });

  if (overlappingRule) {
    throw new Error(
      `Price rule overlaps with existing rule "${overlappingRule.label}" for ${payload.type}.`
    );
  }
}

function validateShuttleSlotPayload(body = {}, defaultCapacity = 11) {
  const type = normalizeType(body.type, ["cruise", "airport"]);
  const time = normalizeString(body.time || body.shuttle_time);
  const capacity = normalizeNumber(body.capacity, defaultCapacity);

  if (!time) {
    throw new Error("Shuttle time is required");
  }

  if (!Number.isFinite(capacity) || capacity < 1) {
    throw new Error("Capacity must be greater than 0");
  }

  const payload = {
    type,
    time,
    shuttle_time: time,
    capacity,
    booked_count: 0,
    is_active: normalizeBoolean(body.is_active, true),
  };

  if (type === "cruise") {
    payload.show_car_park_to_terminal = normalizeBoolean(
      body.show_car_park_to_terminal,
      true
    );

    payload.show_terminal_to_car_park = normalizeBoolean(
      body.show_terminal_to_car_park,
      true
    );

    if (
      !payload.show_car_park_to_terminal &&
      !payload.show_terminal_to_car_park
    ) {
      throw new Error(
        "Please select at least one cruise direction for this shuttle slot."
      );
    }
  } else {
    payload.show_car_park_to_terminal = false;
    payload.show_terminal_to_car_park = false;
  }

  return payload;
}

function validateNoDuplicateShuttleSlot(settings, payload, ignoreSlotId = null) {
  const slots = Array.isArray(settings.shuttle_time_slots)
    ? settings.shuttle_time_slots
    : [];

  const duplicateSlot = slots.find((slot) => {
    if (ignoreSlotId && String(slot._id) === String(ignoreSlotId)) {
      return false;
    }

    return (
      slot.type === payload.type &&
      getSlotTime(slot).toLowerCase() ===
        String(payload.time || "").toLowerCase()
    );
  });

  if (duplicateSlot) {
    throw new Error("A shuttle slot with this time already exists for this type.");
  }
}

function filterPriceRules(settings, searchParams, publicOnly = false) {
  const type = searchParams.get("type");
  const days = searchParams.get("days");
  const isActive = searchParams.get("is_active");

  let rules = Array.isArray(settings.price_rules) ? settings.price_rules : [];

  if (type) {
    rules = rules.filter((rule) => rule.type === type);
  }

  if (days) {
    const dayCount = Number(days);

    if (Number.isFinite(dayCount) && dayCount > 0) {
      rules = rules.filter(
        (rule) =>
          Number(rule.min_days || 0) <= dayCount &&
          Number(rule.max_days || 0) >= dayCount
      );
    }
  }

  if (publicOnly) {
    rules = rules.filter((rule) => rule.is_active !== false);
  } else if (isActive !== null && isActive !== "") {
    const activeValue = isActive === "true";
    rules = rules.filter((rule) => rule.is_active === activeValue);
  }

  return rules
    .map(serializePriceRule)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return Number(a.min_days || 0) - Number(b.min_days || 0);
    });
}

function getMatchedPriceRule(priceRules = [], type, days) {
  const normalizedType = normalizeString(type).toLowerCase();
  const dayCount = Number(days);

  if (!normalizedType || !Number.isFinite(dayCount) || dayCount < 1) {
    return null;
  }

  const matchedRule = priceRules.find((rule) => {
    return (
      rule.type === normalizedType &&
      rule.is_active !== false &&
      Number(rule.min_days || 0) <= dayCount &&
      Number(rule.max_days || 0) >= dayCount
    );
  });

  return matchedRule ? serializePriceRule(matchedRule) : null;
}

function filterShuttleSlots(settings, searchParams, publicOnly = false) {
  const type = searchParams.get("type");
  const isActive = searchParams.get("is_active");

  let slots = Array.isArray(settings.shuttle_time_slots)
    ? settings.shuttle_time_slots
    : [];

  if (type) {
    slots = slots.filter((slot) => slot.type === type);
  }

  if (publicOnly) {
    slots = slots.filter((slot) => slot.is_active !== false);
  } else if (isActive !== null && isActive !== "") {
    const activeValue = isActive === "true";
    slots = slots.filter((slot) => slot.is_active === activeValue);
  }

  return slots
    .map(serializeShuttleSlot)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return String(a.time || "").localeCompare(String(b.time || ""));
    });
}

/**
 * Admin: General settings.
 */
export async function getAdminSettings(req) {
  try {
    await requireAdminUser(req);

    const settings = await getSettingsDocument();

    return Response.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Admin settings fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch settings",
        error: error.message || "Failed to fetch settings",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function updateAdminSettings(req) {
  try {
    const adminUser = await requireAdminUser(req);

    const body = await req.json();
    const settings = await getSettingsDocument();

    const generalSettings =
      body.general_settings && typeof body.general_settings === "object"
        ? body.general_settings
        : body.general && typeof body.general === "object"
        ? body.general
        : {};

    const incomingHoldingDeposit =
      body.holding_deposit_amount !== undefined
        ? body.holding_deposit_amount
        : generalSettings.holding_deposit_amount;

    const incomingCancellationFee =
      body.cancellation_fee !== undefined
        ? body.cancellation_fee
        : body.admin_action_fee !== undefined
        ? body.admin_action_fee
        : generalSettings.cancellation_fee !== undefined
        ? generalSettings.cancellation_fee
        : generalSettings.admin_action_fee;

    if (incomingHoldingDeposit !== undefined) {
      const holdingDepositAmount = normalizeNumber(
        incomingHoldingDeposit,
        DEFAULT_HOLDING_DEPOSIT_AMOUNT
      );

      if (!Number.isFinite(holdingDepositAmount) || holdingDepositAmount < 0) {
        throw new Error("Holding deposit amount cannot be negative");
      }

      settings.holding_deposit_amount = holdingDepositAmount;
    }

    if (incomingCancellationFee !== undefined) {
      const cancellationFee = normalizeNumber(
        incomingCancellationFee,
        DEFAULT_ADMIN_ACTION_FEE
      );

      if (!Number.isFinite(cancellationFee) || cancellationFee < 0) {
        throw new Error("Admin action fee cannot be negative");
      }

      settings.cancellation_fee = cancellationFee;
    }

    if (body.currency !== undefined) {
      settings.currency = normalizeString(body.currency || "AUD").toUpperCase();
    }

    if (Array.isArray(body.payment_methods)) {
      settings.payment_methods = body.payment_methods
        .map(normalizeString)
        .filter(Boolean);
    }

    if (body.email_notifications !== undefined) {
      settings.email_notifications = normalizeBoolean(
        body.email_notifications,
        true
      );
    }

    if (body.sms_notifications !== undefined) {
      settings.sms_notifications = normalizeBoolean(
        body.sms_notifications,
        false
      );
    }

    if (body.default_shuttle_slot_capacity !== undefined) {
      const defaultCapacity = normalizeNumber(
        body.default_shuttle_slot_capacity,
        11
      );

      if (!Number.isFinite(defaultCapacity) || defaultCapacity < 1) {
        throw new Error("Default shuttle slot capacity must be greater than 0");
      }

      settings.default_shuttle_slot_capacity = defaultCapacity;
    }

    if (body.email_templates && typeof body.email_templates === "object") {
      if (adminUser.role !== "admin") {
        throw new Error("Only admin can update customer email templates");
      }

      settings.email_templates = normalizeCustomerEmailTemplates(
        settings.email_templates,
        body.email_templates
      );

      settings.markModified("email_templates");
    }

    await settings.save();

    return Response.json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Admin settings update failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update settings",
        error: error.message || "Failed to update settings",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Admin: Price rules.
 */
export async function getAdminPriceRules(req) {
  try {
    await requireAdminUser(req);

    const { searchParams } = new URL(req.url);
    const settings = await getSettingsDocument();

    return Response.json({
      success: true,
      data: {
        price_rules: filterPriceRules(settings, searchParams, false),
      },
    });
  } catch (error) {
    console.error("Admin price rules fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch price rules",
        error: error.message || "Failed to fetch price rules",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function createAdminPriceRule(req) {
  try {
    await requireAdminUser(req);

    const body = await req.json();
    const settings = await getSettingsDocument();
    const payload = validatePriceRulePayload(body);

    validateNoOverlappingPriceRule(settings, payload);

    settings.price_rules.push(payload);

    await settings.save();

    const createdRule = settings.price_rules[settings.price_rules.length - 1];

    return Response.json(
      {
        success: true,
        message: "Price created successfully",
        data: serializePriceRule(createdRule),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin price rule create failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create price rule",
        error: error.message || "Failed to create price rule",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function updateAdminPriceRule(req, ruleId) {
  try {
    await requireAdminUser(req);

    const body = await req.json();
    const settings = await getSettingsDocument();
    const rule = getSubDocumentById(settings.price_rules, ruleId, "Price rule");

    const payload = {
      type: body.type !== undefined ? normalizeType(body.type) : rule.type,
      label:
        body.label !== undefined ? normalizeString(body.label) : rule.label,
      min_days:
        body.min_days !== undefined
          ? normalizeNumber(body.min_days, rule.min_days)
          : rule.min_days,
      max_days:
        body.max_days !== undefined
          ? normalizeNumber(body.max_days, rule.max_days)
          : rule.max_days,
      price:
        body.price !== undefined
          ? normalizeNumber(body.price, rule.price)
          : rule.price,
      is_active:
        body.is_active !== undefined
          ? normalizeBoolean(body.is_active, true)
          : rule.is_active,
    };

    const validatedPayload = validatePriceRulePayload(payload);

    validateNoOverlappingPriceRule(settings, validatedPayload, ruleId);

    rule.set(validatedPayload);

    await settings.save();

    return Response.json({
      success: true,
      message: "Price updated successfully",
      data: serializePriceRule(rule),
    });
  } catch (error) {
    console.error("Admin price rule update failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update price rule",
        error: error.message || "Failed to update price rule",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function deleteAdminPriceRule(req, ruleId) {
  try {
    await requireAdminUser(req);

    const settings = await getSettingsDocument();
    const rule = getSubDocumentById(settings.price_rules, ruleId, "Price rule");

    rule.deleteOne();

    await settings.save();

    return Response.json({
      success: true,
      message: "Price rule deleted successfully",
    });
  } catch (error) {
    console.error("Admin price rule delete failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete price rule",
        error: error.message || "Failed to delete price rule",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Admin: Shuttle time slots.
 */
export async function getAdminShuttleTimeSlots(req) {
  try {
    await requireAdminUser(req);

    const { searchParams } = new URL(req.url);
    const settings = await getSettingsDocument();

    return Response.json({
      success: true,
      data: {
        shuttle_time_slots: filterShuttleSlots(settings, searchParams, false),
      },
    });
  } catch (error) {
    console.error("Admin shuttle slots fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch shuttle time slots",
        error: error.message || "Failed to fetch shuttle time slots",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function createAdminShuttleTimeSlot(req) {
  try {
    await requireAdminUser(req);

    const body = await req.json();
    const settings = await getSettingsDocument();

    const payload = validateShuttleSlotPayload(
      body,
      settings.default_shuttle_slot_capacity || 11
    );

    validateNoDuplicateShuttleSlot(settings, payload);

    settings.shuttle_time_slots.push(payload);

    await settings.save();

    const createdSlot =
      settings.shuttle_time_slots[settings.shuttle_time_slots.length - 1];

    return Response.json(
      {
        success: true,
        message: "Shuttle time slot created successfully",
        data: serializeShuttleSlot(createdSlot),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin shuttle slot create failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create shuttle time slot",
        error: error.message || "Failed to create shuttle time slot",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function updateAdminShuttleTimeSlot(req, slotId) {
  try {
    await requireAdminUser(req);

    const body = await req.json();
    const settings = await getSettingsDocument();
    const slot = getSubDocumentById(
      settings.shuttle_time_slots,
      slotId,
      "Shuttle time slot"
    );

    const payload = {
      type:
        body.type !== undefined
          ? normalizeType(body.type, ["cruise", "airport"])
          : slot.type,
      time:
        body.time !== undefined || body.shuttle_time !== undefined
          ? normalizeString(body.time || body.shuttle_time)
          : getSlotTime(slot),
      capacity:
        body.capacity !== undefined
          ? normalizeNumber(body.capacity, slot.capacity)
          : slot.capacity,
      is_active:
        body.is_active !== undefined
          ? normalizeBoolean(body.is_active, true)
          : slot.is_active,

      show_car_park_to_terminal:
        body.show_car_park_to_terminal !== undefined
          ? normalizeBoolean(body.show_car_park_to_terminal, true)
          : slot.show_car_park_to_terminal !== false,

      show_terminal_to_car_park:
        body.show_terminal_to_car_park !== undefined
          ? normalizeBoolean(body.show_terminal_to_car_park, true)
          : slot.show_terminal_to_car_park !== false,
    };

    const validatedPayload = validateShuttleSlotPayload(
      payload,
      settings.default_shuttle_slot_capacity || 11
    );

    validateNoDuplicateShuttleSlot(settings, validatedPayload, slotId);

    slot.set(validatedPayload);
    slot.booked_count = 0;

    await settings.save();

    return Response.json({
      success: true,
      message: "Shuttle time slot updated successfully",
      data: serializeShuttleSlot(slot),
    });
  } catch (error) {
    console.error("Admin shuttle slot update failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to update shuttle time slot",
        error: error.message || "Failed to update shuttle time slot",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function deleteAdminShuttleTimeSlot(req, slotId) {
  try {
    await requireAdminUser(req);

    const settings = await getSettingsDocument();
    const slot = getSubDocumentById(
      settings.shuttle_time_slots,
      slotId,
      "Shuttle time slot"
    );

    slot.deleteOne();

    await settings.save();

    return Response.json({
      success: true,
      message: "Shuttle time slot deleted successfully",
    });
  } catch (error) {
    console.error("Admin shuttle slot delete failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to delete shuttle time slot",
        error: error.message || "Failed to delete shuttle time slot",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Public/customer: price rules.
 */
export async function getPublicPriceRules(req) {
  try {
    const { searchParams } = new URL(req.url);
    const settings = await getSettingsDocument();

    const priceRules = filterPriceRules(settings, searchParams, true);

    return Response.json({
      success: true,
      data: {
        price_rules: priceRules,
        matched_price_rule: getMatchedPriceRule(
          settings.price_rules || [],
          searchParams.get("type"),
          searchParams.get("days")
        ),
      },
    });
  } catch (error) {
    console.error("Public price rules fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch price rules",
        error: error.message || "Failed to fetch price rules",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Public/customer: shuttle time slots.
 *
 * Airport:
 * - Settings is only the template.
 * - booked_count and remaining are calculated from Booking collection.
 *
 * Cruise:
 * - Settings is only the template.
 * - Car park to terminal and terminal to car park visibility are controlled
 *   by show_car_park_to_terminal and show_terminal_to_car_park.
 * - Remaining is calculated per direction when schedule_id or date is supplied.
 */
export async function getPublicShuttleTimeSlots(req) {
  try {
    const { searchParams } = new URL(req.url);

    const type = String(searchParams.get("type") || "").toLowerCase().trim();
    const locationId = String(searchParams.get("location_id") || "").trim();

    const scheduleId =
      searchParams.get("schedule_id") || searchParams.get("scheduleId");

    const date =
      searchParams.get("date") ||
      searchParams.get("start_date") ||
      searchParams.get("entry_date") ||
      searchParams.get("departure_date");

    const settings = await getSettingsDocument();

    let slots = Array.isArray(settings.shuttle_time_slots)
      ? settings.shuttle_time_slots
      : [];

    if (type) {
      slots = slots.filter((slot) => slot.type === type);
    }

    slots = slots.filter((slot) => slot.is_active !== false);

    if (type === "cruise") {
      const bookedCounts = await getCruiseShuttleBookedCounts({
        scheduleId,
        date,
      });

      const cruiseSlots = slots.map((slot) =>
        serializeCruiseShuttleSlotWithBookedCounts(slot, bookedCounts)
      );

      return Response.json({
        success: true,
        data: {
          shuttle_time_slots: cruiseSlots,
          available_shuttle_slots: cruiseSlots,
        },
      });
    }

    if (type === "airport" && locationId && date) {
      const location = await Location.findOne({
        _id: locationId,
        type: "airport",
        is_active: true,
      }).lean();

      if (!location) {
        throw new Error("Airport location not found");
      }

      if (!location.show_shuttle_options) {
        return Response.json({
          success: true,
          data: {
            shuttle_time_slots: [],
            available_shuttle_slots: [],
          },
        });
      }

      const bookedCountMap = await getAirportShuttleBookedCountByTime({
        locationId,
        date,
      });

      const availableSlots = slots.map((slot) => {
        const timeKey = getSlotTime(slot).toLowerCase();
        const bookedCount = bookedCountMap.get(timeKey) || 0;

        return serializeAirportShuttleSlotWithBookedCount(slot, bookedCount);
      });

      return Response.json({
        success: true,
        data: {
          shuttle_time_slots: availableSlots,
          available_shuttle_slots: availableSlots,
        },
      });
    }

    const templateSlots = slots.map(serializeShuttleSlot);

    return Response.json({
      success: true,
      data: {
        shuttle_time_slots: templateSlots,
      },
    });
  } catch (error) {
    console.error("Public shuttle slots fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch shuttle time slots",
        error: error.message || "Failed to fetch shuttle time slots",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Backward compatibility.
 * Do not increment Settings booked_count anymore.
 */
export async function incrementSettingShuttleSlotBookedCount({
  type = "cruise",
  slotId,
  slotTime,
  passengerCount = 1,
}) {
  const normalizedType = normalizeType(type, ["cruise", "airport"]);
  const count = normalizeNumber(passengerCount, 0);

  if (!Number.isFinite(count) || count < 1) {
    throw new Error("Passenger count must be at least 1");
  }

  const settings = await getSettingsDocument();

  let slot = null;

  if (slotId) {
    slot = settings.shuttle_time_slots.id(String(slotId));
  }

  if (!slot && slotTime) {
    slot = settings.shuttle_time_slots.find((item) => {
      return (
        item.type === normalizedType &&
        getSlotTime(item).toLowerCase() ===
          String(slotTime || "").trim().toLowerCase()
      );
    });
  }

  if (!slot) {
    throw new Error("Selected shuttle slot was not found");
  }

  if (slot.type !== normalizedType) {
    throw new Error("Selected shuttle slot type is invalid");
  }

  if (slot.is_active === false) {
    throw new Error("Selected shuttle slot is inactive");
  }

  const capacity = Number(slot.capacity || 0);

  if (capacity <= 0) {
    throw new Error("Selected shuttle slot has no capacity");
  }

  if (count > capacity) {
    throw new Error("Selected shuttle slot does not have enough capacity");
  }

  return serializeShuttleSlot(slot);
}

/**
 * Alias exports for older route imports.
 */
export const updateShuttleTimeSlot = updateAdminShuttleTimeSlot;
export const deleteShuttleTimeSlot = deleteAdminShuttleTimeSlot;