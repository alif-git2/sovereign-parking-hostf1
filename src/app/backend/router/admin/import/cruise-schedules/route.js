import { NextResponse } from "next/server";
import mongoose from "mongoose";
import * as XLSX from "xlsx";

import { connectDB } from "@/app/backend/database/mongodb";
import CruiseSchedule from "@/app/backend/models/cruiseschedule";
import Location from "@/app/backend/models/location";
import Setting from "@/app/backend/models/settings";
import {
  requireAdminUser,
  getAuthErrorStatus,
} from "@/app/backend/utils/authToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
const GLOBAL_SETTING_ID = "global_config";

const REQUIRED_COLUMN_GROUPS = [
  {
    label: "location",
    keys: ["location", "location_id", "cruise_location"],
  },
  {
    label: "ship_name",
    keys: ["ship_name", "schedule_name", "ship"],
  },
  {
    label: "departure_date",
    keys: ["departure_date", "ship_departure_date"],
  },
  {
    label: "arrival_date",
    keys: ["arrival_date", "return_date", "ship_arrival_date"],
  },
  {
    label: "capacity",
    keys: ["capacity"],
  },
];

function emptyResult(overrides = {}) {
  return {
    totalRows: 0,
    insertedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    errors: [],
    ...overrides,
  };
}

function jsonResponse(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

function cleanValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeHeader(header) {
  return cleanValue(header)
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getValueByKeys(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }

  return "";
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBoolean(value, defaultValue = true) {
  const clean = cleanValue(value).toLowerCase();

  if (!clean) return defaultValue;

  if (["true", "1", "yes", "active", "enabled"].includes(clean)) {
    return true;
  }

  if (["false", "0", "no", "inactive", "disabled"].includes(clean)) {
    return false;
  }

  return defaultValue;
}

function parseNumber(value) {
  const clean = cleanValue(value).replace(/,/g, "");

  if (!clean) return null;

  const number = Number(clean);

  return Number.isFinite(number) ? number : null;
}

function createUtcDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));

  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isValid ? date : null;
}

function parseDate(value) {
  if (!value) return null;

  // Excel may return a real Date object.
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return createUtcDate(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  }

  // Support Excel serial date values.
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed?.y && parsed?.m && parsed?.d) {
      return createUtcDate(parsed.y, parsed.m, parsed.d);
    }

    return null;
  }

  const clean = cleanValue(value);

  if (!clean) return null;

  // Preferred import format: DD/MM/YYYY
  const australianDate = clean.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (australianDate) {
    const [, dayText, monthText, yearText] = australianDate;

    return createUtcDate(
      Number(yearText),
      Number(monthText),
      Number(dayText)
    );
  }

  // Keep backward compatibility with older YYYY-MM-DD templates.
  const isoDate = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoDate) {
    const [, yearText, monthText, dayText] = isoDate;

    return createUtcDate(
      Number(yearText),
      Number(monthText),
      Number(dayText)
    );
  }

  return null;
}

function getSlotTime(slot) {
  return cleanValue(slot?.time || slot?.shuttle_time);
}

function normalizeRow(row) {
  const normalized = {};

  Object.entries(row).forEach(([key, value]) => {
    normalized[normalizeHeader(key)] = value;
  });

  return {
    location: cleanValue(
      getValueByKeys(normalized, ["location", "location_id", "cruise_location"])
    ),
    ship_name: cleanValue(
      getValueByKeys(normalized, ["ship_name", "schedule_name", "ship"])
    ),
    departure_date: parseDate(
      getValueByKeys(normalized, ["departure_date", "ship_departure_date"])
    ),
    arrival_date: parseDate(
      getValueByKeys(normalized, [
        "arrival_date",
        "return_date",
        "ship_arrival_date",
      ])
    ),
    capacity: parseNumber(getValueByKeys(normalized, ["capacity"])),
    is_active: parseBoolean(
      getValueByKeys(normalized, ["is_active", "active", "status"]),
      true
    ),
  };
}

function validateRow(row, rowNumber) {
  const errors = [];

  if (!row.location) {
    errors.push("location is required");
  }

  if (!row.ship_name) {
    errors.push("ship_name is required");
  }

  if (!row.departure_date) {
    errors.push("departure_date is required or invalid. Use DD/MM/YYYY");
  }

  if (!row.arrival_date) {
    errors.push("arrival_date is required or invalid. Use DD/MM/YYYY");
  }

  if (
    row.departure_date &&
    row.arrival_date &&
    row.arrival_date <= row.departure_date
  ) {
    errors.push("arrival_date must be after departure_date");
  }

  if (!Number.isFinite(row.capacity) || row.capacity <= 0) {
    errors.push("capacity must be greater than 0");
  }

  if (!errors.length) return null;

  return {
    row: rowNumber,
    ship_name: row.ship_name || "-",
    location: row.location || "-",
    error: errors.join(", "),
  };
}

function validateHeaders(rows) {
  if (!rows.length) return ["Uploaded file is empty"];

  const headers = Object.keys(rows[0]).map(normalizeHeader);

  return REQUIRED_COLUMN_GROUPS.filter(
    (group) => !group.keys.some((key) => headers.includes(key))
  ).map((group) => `Missing required column: ${group.label}`);
}

function isAllowedFile(fileName) {
  const lowerName = cleanValue(fileName).toLowerCase();

  return ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

async function readRowsFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: false,
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("No sheet found in uploaded file");
  }

  const worksheet = workbook.Sheets[sheetName];

  return XLSX.utils
    .sheet_to_json(worksheet, {
      defval: "",
      raw: false,
    })
    .filter((row) =>
      Object.values(row).some((value) => cleanValue(value).length > 0)
    );
}

async function getSettingsDocument() {
  return Setting.findByIdAndUpdate(
    GLOBAL_SETTING_ID,
    {
      $setOnInsert: {
        _id: GLOBAL_SETTING_ID,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

function getCruiseSettingShuttleSlots(settings) {
  const settingSlots = Array.isArray(settings?.shuttle_time_slots)
    ? settings.shuttle_time_slots
    : [];

  const defaultCapacity =
    parseNumber(settings?.default_shuttle_slot_capacity) || 11;

  return settingSlots
    .filter((slot) => slot?.type === "cruise" && slot?.is_active !== false)
    .map((slot) => {
      const time = getSlotTime(slot);
      const capacity = parseNumber(slot?.capacity) || defaultCapacity;

      return {
        time,
        capacity: capacity > 0 ? capacity : defaultCapacity,
        booked_count: 0,
        is_active: true,
      };
    })
    .filter((slot) => slot.time && slot.capacity > 0);
}

async function findCruiseLocation(locationValue, locationCache) {
  const rawLocation = cleanValue(locationValue);
  const cacheKey = rawLocation.toLowerCase();

  if (locationCache.has(cacheKey)) {
    return locationCache.get(cacheKey);
  }

  const orFilters = [
    {
      name: {
        $regex: `^${escapeRegExp(rawLocation)}$`,
        $options: "i",
      },
    },
  ];

  if (mongoose.Types.ObjectId.isValid(rawLocation)) {
    orFilters.unshift({
      _id: rawLocation,
    });
  }

  const location = await Location.findOne({
    type: "cruise",
    is_active: true,
    $or: orFilters,
  }).select("_id name type is_active");

  locationCache.set(cacheKey, location);

  return location;
}

function buildSchedulePayload(row, location, settings) {
  const shuttleSlots = getCruiseSettingShuttleSlots(settings);

  return {
    location_id: location._id,
    schedule_name: row.ship_name,
    schedule_type: "cruise",
    departure_date: row.departure_date,
    return_date: row.arrival_date,
    capacity: row.capacity,
    booked_count: 0,
    price_per_slot: 0,
    is_active: row.is_active,
    shuttle_slots: shuttleSlots,
    shuttle_times: shuttleSlots.map((slot) => slot.time),
  };
}

function getFatalErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (
    value.includes("authorization") ||
    value.includes("token") ||
    value.includes("expired") ||
    value.includes("admin access") ||
    value.includes("inactive") ||
    value.includes("not found")
  ) {
    return getAuthErrorStatus(message);
  }

  if (
    value.includes("file") ||
    value.includes("sheet") ||
    value.includes("format")
  ) {
    return 400;
  }

  return 500;
}

export async function POST(request) {
  try {
    await connectDB();

    await requireAdminUser(request, ["admin"]);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return jsonResponse(
        {
          success: false,
          message: "File is required",
          data: emptyResult(),
        },
        400
      );
    }

    if (!isAllowedFile(file.name)) {
      return jsonResponse(
        {
          success: false,
          message: "Only CSV, XLSX, or XLS files are allowed",
          data: emptyResult(),
        },
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse(
        {
          success: false,
          message: "File size must be less than 5MB",
          data: emptyResult(),
        },
        400
      );
    }

    const rows = await readRowsFromFile(file);

    if (!rows.length) {
      return jsonResponse(
        {
          success: false,
          message: "Uploaded file is empty",
          data: emptyResult(),
        },
        400
      );
    }

    const headerErrors = validateHeaders(rows);

    if (headerErrors.length) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid file format",
          data: emptyResult({
            totalRows: rows.length,
            failedCount: rows.length,
            errors: headerErrors.map((error) => ({
              row: 1,
              ship_name: "-",
              location: "-",
              error,
            })),
          }),
        },
        422
      );
    }

    const settings = await getSettingsDocument();

    const validRows = [];
    const errors = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const normalizedRow = normalizeRow(row);
      const validationError = validateRow(normalizedRow, rowNumber);

      if (validationError) {
        errors.push(validationError);
        return;
      }

      validRows.push({
        rowNumber,
        data: normalizedRow,
      });
    });

    let insertedCount = 0;
    let skippedCount = 0;
    let failedCount = errors.length;

    const locationCache = new Map();

    for (const item of validRows) {
      const schedule = item.data;

      try {
        const location = await findCruiseLocation(
          schedule.location,
          locationCache
        );

        if (!location) {
          failedCount += 1;

          errors.push({
            row: item.rowNumber,
            ship_name: schedule.ship_name,
            location: schedule.location,
            error:
              "Active cruise location not found. Please create/activate this location first.",
          });

          continue;
        }

        const payload = buildSchedulePayload(schedule, location, settings);

        const existingSchedule = await CruiseSchedule.findOne({
          location_id: payload.location_id,
          schedule_name: payload.schedule_name,
          departure_date: payload.departure_date,
        }).collation({
          locale: "en",
          strength: 2,
        });

        if (existingSchedule) {
          skippedCount += 1;

          errors.push({
            row: item.rowNumber,
            ship_name: schedule.ship_name,
            location: schedule.location,
            error: "Duplicate schedule already exists",
          });

          continue;
        }

        await CruiseSchedule.create(payload);

        insertedCount += 1;
      } catch (rowError) {
        failedCount += 1;

        errors.push({
          row: item.rowNumber,
          ship_name: schedule.ship_name || "-",
          location: schedule.location || "-",
          error: rowError.message || "Failed to import this row",
        });
      }
    }

    const hasInsertedRows = insertedCount > 0;
    const hasOnlySkippedRows =
      insertedCount === 0 && skippedCount > 0 && failedCount === 0;

    const success = hasInsertedRows || hasOnlySkippedRows;
    const status = hasInsertedRows ? 201 : hasOnlySkippedRows ? 200 : 422;

    return jsonResponse(
      {
        success,
        message: hasInsertedRows
          ? "Cruise schedules imported successfully"
          : hasOnlySkippedRows
          ? "No new schedules imported. Duplicate rows were skipped."
          : "No valid cruise schedules were imported",
        data: {
          totalRows: rows.length,
          insertedCount,
          skippedCount,
          failedCount,
          errors,
        },
      },
      status
    );
  } catch (error) {
    console.error("Cruise schedule import error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to import cruise schedules",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
        data: emptyResult(),
      },
      getFatalErrorStatus(error.message)
    );
  }
}