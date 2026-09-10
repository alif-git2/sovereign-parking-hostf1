import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { connectDB } from "@/app/backend/database/mongodb";
import AdminReport from "@/app/backend/models/report";
import {
  requireAdminUser,
  getAuthErrorStatus,
} from "@/app/backend/utils/authToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorStatus(message = "") {
  const authStatus = getAuthErrorStatus(message);

  if ([401, 403, 404].includes(authStatus)) {
    return authStatus;
  }

  const value = String(message || "").toLowerCase();

  if (value.includes("required") || value.includes("invalid")) {
    return 400;
  }

  return 500;
}

function buildReportFilter(reportId) {
  const value = String(reportId || "").trim();

  if (!value) {
    throw new Error("Report ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error("Invalid report ID");
  }

  return { _id: value };
}

export async function GET(request, context) {
  try {
    await connectDB();
    await requireAdminUser(request, ["admin"]);

    const { reportId } = await context.params;
    const report = await AdminReport.findOne(buildReportFilter(reportId)).lean();

    if (!report) {
      throw new Error("Report not found");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Report loaded successfully",
        data: {
          report,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin report detail error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to load report",
        error: error.message || "Failed to load report",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function DELETE(request, context) {
  try {
    await connectDB();
    await requireAdminUser(request, ["admin"]);

    const { reportId } = await context.params;
    const report = await AdminReport.findOneAndDelete(buildReportFilter(reportId));

    if (!report) {
      throw new Error("Report not found");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Report deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin report delete error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to delete report",
        error: error.message || "Failed to delete report",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}
