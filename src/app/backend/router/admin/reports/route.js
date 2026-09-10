import { NextResponse } from "next/server";

import { connectDB } from "@/app/backend/database/mongodb";
import AdminReport from "@/app/backend/models/report";
import {
  requireAdminUser,
  getAuthErrorStatus,
} from "@/app/backend/utils/authToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REPORT_ROWS = 5000;
const MAX_REPORT_COLUMNS = 60;
const MAX_REPORT_NAME_LENGTH = 120;

function getErrorStatus(message = "") {
  const authStatus = getAuthErrorStatus(message);

  if ([401, 403, 404].includes(authStatus)) {
    return authStatus;
  }

  const value = String(message || "").toLowerCase();

  if (
    value.includes("required") ||
    value.includes("invalid") ||
    value.includes("cannot exceed") ||
    value.includes("too many")
  ) {
    return 400;
  }

  return 500;
}

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function normalizeColumns(columns = []) {
  if (!Array.isArray(columns)) return [];

  return columns
    .slice(0, MAX_REPORT_COLUMNS)
    .map((column) => ({
      key: cleanText(column?.key, 80),
      label: cleanText(column?.label, 120),
    }))
    .filter((column) => column.key && column.label);
}

function normalizeRows(rows = []) {
  if (!Array.isArray(rows)) return [];

  return rows.slice(0, MAX_REPORT_ROWS).map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return {};
    }

    return Object.entries(row).reduce((acc, [key, value]) => {
      acc[cleanText(key, 120)] =
        value === null || value === undefined ? "" : String(value).slice(0, 2000);
      return acc;
    }, {});
  });
}

function normalizeSelectedColumns(selectedColumns = []) {
  if (!Array.isArray(selectedColumns)) return [];

  return selectedColumns
    .slice(0, MAX_REPORT_COLUMNS)
    .map((value) => cleanText(value, 80))
    .filter(Boolean);
}

export async function GET(request) {
  try {
    await connectDB();
    await requireAdminUser(request, ["admin"]);

    const { searchParams } = new URL(request.url);
    const type = cleanText(searchParams.get("type"), 30);
    const limit = Math.min(Number(searchParams.get("limit") || 100), 200);

    const filter = {};

    if (["cruise", "storage", "airport"].includes(type)) {
      filter.report_type = type;
    }

    const reports = await AdminReport.find(filter)
      .select("-rows")
      .sort({ createdAt: -1 })
      .limit(Number.isFinite(limit) && limit > 0 ? limit : 100)
      .lean();

    return NextResponse.json(
      {
        success: true,
        message: "Reports loaded successfully",
        data: {
          reports,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin reports list error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to load reports",
        error: error.message || "Failed to load reports",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const adminUser = await requireAdminUser(request, ["admin"]);

    const body = await request.json();

    const name = cleanText(body?.name, MAX_REPORT_NAME_LENGTH);
    const reportType = cleanText(body?.report_type || body?.booking_type, 30);
    const columns = normalizeColumns(body?.columns);
    const selectedColumns = normalizeSelectedColumns(body?.selected_columns);
    const rows = normalizeRows(body?.rows);
    const totalValue = Number(body?.total_value || 0);

    if (!name) {
      throw new Error("Report name is required");
    }

    if (!["cruise", "storage", "airport"].includes(reportType)) {
      throw new Error("Invalid report type");
    }

    if (!columns.length) {
      throw new Error("At least one report column is required");
    }

    if (!rows.length) {
      throw new Error("Report has no rows to save");
    }

    if (Array.isArray(body?.rows) && body.rows.length > MAX_REPORT_ROWS) {
      throw new Error(`Too many rows. Maximum ${MAX_REPORT_ROWS} rows can be saved.`);
    }

    const report = await AdminReport.create({
      name,
      report_type: reportType,
      title: cleanText(body?.title, 300),
      date_label: cleanText(body?.date_label || "All dates", 120),
      filters: body?.filters && typeof body.filters === "object" ? body.filters : {},
      selected_columns: selectedColumns,
      columns,
      rows,
      total_rows: rows.length,
      total_value: Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : 0,
      created_by: adminUser?._id || null,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Report saved successfully",
        data: {
          report,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin report save error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to save report",
        error: error.message || "Failed to save report",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}
