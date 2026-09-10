import { NextResponse } from "next/server";
import { connectDB } from "@/app/backend/database/mongodb";
import jwt from "jsonwebtoken";
import SeoGlobalSetting from "@/app/backend/models/seoGlobalSetting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRING_FIELDS = [
  "site_name",
  "site_url",
  "default_meta_title",
  "default_meta_description",
  "default_keywords",
  "default_og_image",
  "google_site_verification",
  "google_analytics_id",
  "facebook_pixel_id",
  "robots_txt",
];

const BOOLEAN_FIELDS = [
  "default_noindex",
  "default_nofollow",
  "sitemap_enabled",
];


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

function sanitizeGlobalPayload(body = {}) {
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

  if (payload.site_url) {
    payload.site_url = payload.site_url.replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(payload.site_url)) {
      const error = new Error("Website URL must start with http:// or https://.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (
    payload.facebook_pixel_id &&
    !/^\d{5,25}$/.test(payload.facebook_pixel_id)
  ) {
    const error = new Error("Meta Pixel ID must contain digits only.");
    error.statusCode = 400;
    throw error;
  }

  return payload;
}

async function getOrCreateGlobalSetting() {
  let globalSeo = await SeoGlobalSetting.findOne().lean();

  if (!globalSeo) {
    globalSeo = await SeoGlobalSetting.create({
      site_name: "",
      site_url: process.env.NEXT_PUBLIC_APP_URL || "",
      default_meta_title: "",
      default_meta_description: "",
      default_keywords: "",
      default_og_image: "",
      google_site_verification: "",
      google_analytics_id: "",
      facebook_pixel_id: "",
      default_noindex: false,
      default_nofollow: false,
      sitemap_enabled: true,
      robots_txt: "",
    });

    globalSeo = globalSeo.toObject();
  }

  return globalSeo;
}

function handleError(error, fallbackMessage = "SEO request failed.") {
  const status = error.statusCode || 500;

  return jsonResponse(
    {
      success: false,
      message: error.message || fallbackMessage,
    },
    status
  );
}

export async function GET(request) {
  try {
    requireAdmin(request);
    await connectDB();

    const globalSeo = await getOrCreateGlobalSetting();

    return jsonResponse({
      success: true,
      data: {
        global: globalSeo,
      },
    });
  } catch (error) {
    return handleError(error, "Failed to load global SEO settings.");
  }
}

export async function PATCH(request) {
  try {
    requireAdmin(request);
    await connectDB();

    const body = await request.json();
    const payload = sanitizeGlobalPayload(body);

    let existing = await SeoGlobalSetting.findOne();

    if (!existing) {
      existing = new SeoGlobalSetting(payload);
    } else {
      existing.set(payload);
    }

    await existing.save();

    return jsonResponse({
      success: true,
      message: "Global SEO settings saved successfully.",
      data: {
        global: existing.toObject(),
      },
    });
  } catch (error) {
    return handleError(error, "Failed to save global SEO settings.");
  }
}
