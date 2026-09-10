import { NextResponse } from "next/server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { connectDB } from "@/app/backend/database/mongodb";
import SeoPageSetting from "@/app/backend/models/seoPageSetting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRING_FIELDS = [
  "page_name",
  "path",
  "meta_title",
  "meta_description",
  "keywords",
  "canonical_url",
  "og_title",
  "og_description",
  "og_image",
  "twitter_title",
  "twitter_description",
  "twitter_image",
  "sitemap_changefreq",
];

const BOOLEAN_FIELDS = ["noindex", "nofollow", "sitemap_enabled"];

const allowedChangeFrequencies = new Set([
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
]);


function jsonResponse(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function requireAdmin(request) {
  const token = getBearerToken(request);

  if (!token) {
    const error = new Error("Admin token is required.");
    error.statusCode = 401;
    throw error;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    const error = new Error("JWT_SECRET is missing.");
    error.statusCode = 500;
    throw error;
  }

  let decoded;

  try {
    decoded = jwt.verify(token, secret);
  } catch {
    const error = new Error("Invalid or expired admin token.");
    error.statusCode = 401;
    throw error;
  }

  const role =
    decoded?.role ||
    decoded?.user?.role ||
    decoded?.data?.role ||
    decoded?.admin?.role;

  if (role !== "admin") {
    const error = new Error("Only admin can manage SEO settings.");
    error.statusCode = 403;
    throw error;
  }

  return decoded;
}

function normalizePath(value) {
  let cleanPath = String(value || "").trim();

  if (!cleanPath) {
    const error = new Error("Page path is required.");
    error.statusCode = 400;
    throw error;
  }

  cleanPath = cleanPath.split("?")[0].split("#")[0].trim();

  if (!cleanPath.startsWith("/")) {
    cleanPath = `/${cleanPath}`;
  }

  cleanPath = cleanPath.replace(/\/{2,}/g, "/");

  if (cleanPath.length > 1) {
    cleanPath = cleanPath.replace(/\/+$/, "");
  }

  return cleanPath;
}

function isPrivatePath(path) {
  return (
    path.startsWith("/admin") ||
    path.startsWith("/backend") ||
    path.startsWith("/api") ||
    path.startsWith("/customer/dashboard") ||
    path.startsWith("/booking/payment") ||
    path.startsWith("/booking/paypal") ||
    path.startsWith("/booking/success")
  );
}

function normalizeSchemaJson(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    return JSON.parse(value);
  }

  if (typeof value === "object") {
    return value;
  }

  return null;
}

function sanitizePagePayload(body = {}) {
  const payload = {};

  for (const field of STRING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = String(body[field] || "").trim();
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = Boolean(body[field]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "page_name")) {
    if (!payload.page_name) {
      const error = new Error("Page name is required.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "path")) {
    payload.path = normalizePath(payload.path);
  }

  if (Object.prototype.hasOwnProperty.call(body, "sitemap_priority")) {
    const priority = Number(body.sitemap_priority);

    if (!Number.isFinite(priority) || priority < 0 || priority > 1) {
      const error = new Error("Sitemap priority must be between 0 and 1.");
      error.statusCode = 400;
      throw error;
    }

    payload.sitemap_priority = priority;
  }

  if (
    payload.sitemap_changefreq &&
    !allowedChangeFrequencies.has(payload.sitemap_changefreq)
  ) {
    payload.sitemap_changefreq = "weekly";
  }

  if (Object.prototype.hasOwnProperty.call(body, "schema_json")) {
    try {
      payload.schema_json = normalizeSchemaJson(body.schema_json);
    } catch {
      const error = new Error("Schema JSON is invalid.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (payload.canonical_url && !/^https?:\/\//i.test(payload.canonical_url)) {
    const error = new Error("Canonical URL must start with http:// or https://.");
    error.statusCode = 400;
    throw error;
  }

  if (payload.path && isPrivatePath(payload.path)) {
    payload.noindex = true;
    payload.sitemap_enabled = false;
  }

  if (payload.noindex) {
    payload.sitemap_enabled = false;
  }

  return payload;
}

function getPageId(params) {
  const id = params?.id;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid SEO page ID.");
    error.statusCode = 400;
    throw error;
  }

  return id;
}

function handleError(error, fallbackMessage = "SEO request failed.") {
  if (error?.code === 11000) {
    return jsonResponse(
      {
        success: false,
        message: "SEO settings already exist for this page path.",
      },
      409
    );
  }

  const status = error.statusCode || 500;

  return jsonResponse(
    {
      success: false,
      message: error.message || fallbackMessage,
    },
    status
  );
}

export async function PATCH(request, context) {
  try {
    requireAdmin(request);
    await connectDB();

    const params = await context.params;
    const id = getPageId(params);
    const body = await request.json();
    const payload = sanitizePagePayload(body);

    const page = await SeoPageSetting.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    }).lean();

    if (!page) {
      return jsonResponse(
        {
          success: false,
          message: "SEO page was not found.",
        },
        404
      );
    }

    return jsonResponse({
      success: true,
      message: "Page SEO updated successfully.",
      data: {
        page,
      },
    });
  } catch (error) {
    return handleError(error, "Failed to update page SEO.");
  }
}

export async function DELETE(request, context) {
  try {
    requireAdmin(request);
    await connectDB();

    const params = await context.params;
    const id = getPageId(params);

    const page = await SeoPageSetting.findByIdAndDelete(id).lean();

    if (!page) {
      return jsonResponse(
        {
          success: false,
          message: "SEO page was not found.",
        },
        404
      );
    }

    return jsonResponse({
      success: true,
      message: "Page SEO deleted successfully.",
      data: {
        page,
      },
    });
  } catch (error) {
    return handleError(error, "Failed to delete page SEO.");
  }
}
