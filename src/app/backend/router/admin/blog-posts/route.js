import { NextResponse } from "next/server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import BlogPost from "@/app/backend/models/blogPost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRING_FIELDS = [
  "title",
  "slug",
  "excerpt",
  "content",
  "featured_image",
  "featured_image_alt",
  "category",
  "author_name",
  "status",
  "meta_title",
  "meta_description",
  "meta_keywords",
  "canonical_url",
  "og_title",
  "og_description",
  "og_image",
  "twitter_title",
  "twitter_description",
  "twitter_image",
  "sitemap_changefreq",
];

const BOOLEAN_FIELDS = ["is_featured", "noindex", "nofollow", "sitemap_enabled"];

const ALLOWED_STATUS = new Set(["draft", "published", "archived"]);

const ALLOWED_CHANGE_FREQUENCIES = new Set([
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
]);

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    const error = new Error("MONGO_URI is missing.");
    error.statusCode = 500;
    throw error;
  }

  await mongoose.connect(mongoUri);
}

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

function getDecodedValue(decoded, keys) {
  for (const key of keys) {
    const value =
      decoded?.[key] ||
      decoded?.user?.[key] ||
      decoded?.data?.[key] ||
      decoded?.admin?.[key];

    if (value) return value;
  }

  return "";
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

  const role = getDecodedValue(decoded, ["role"]);

  if (role !== "admin") {
    const error = new Error("Only admin can manage blog posts.");
    error.statusCode = 403;
    throw error;
  }

  return decoded;
}

function getAdminObjectId(decoded) {
  const possibleId = getDecodedValue(decoded, ["id", "_id", "userId", "adminId"]);

  if (possibleId && mongoose.Types.ObjectId.isValid(possibleId)) {
    return new mongoose.Types.ObjectId(possibleId);
  }

  return null;
}

function getAdminName(decoded) {
  return (
    getDecodedValue(decoded, ["name", "full_name", "username"]) ||
    getDecodedValue(decoded, ["email"]) ||
    "Admin"
  );
}

function cleanString(value = "") {
  return String(value || "").trim();
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((tag) => cleanString(tag))
          .filter(Boolean)
          .map((tag) => tag.slice(0, 60))
      ),
    ];
  }

  return [
    ...new Set(
      cleanString(value)
        .split(",")
        .map((tag) => cleanString(tag))
        .filter(Boolean)
        .map((tag) => tag.slice(0, 60))
    ),
  ];
}

function parseSchemaJson(value) {
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

function sanitizeBlogPayload(body = {}, { partial = false } = {}) {
  const payload = {};

  for (const field of STRING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = cleanString(body[field]);
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = Boolean(body[field]);
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "title")) {
    if (!payload.title) {
      const error = new Error("Blog title is required.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (payload.status && !ALLOWED_STATUS.has(payload.status)) {
    const error = new Error("Invalid blog status.");
    error.statusCode = 400;
    throw error;
  }

  if (
    payload.sitemap_changefreq &&
    !ALLOWED_CHANGE_FREQUENCIES.has(payload.sitemap_changefreq)
  ) {
    payload.sitemap_changefreq = "monthly";
  }

  if (Object.prototype.hasOwnProperty.call(body, "tags")) {
    payload.tags = parseTags(body.tags);
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

  if (Object.prototype.hasOwnProperty.call(body, "schema_json")) {
    try {
      payload.schema_json = parseSchemaJson(body.schema_json);
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

  if (payload.noindex) {
    payload.sitemap_enabled = false;
  }

  return payload;
}

function getPagination(searchParams) {
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const rawLimit = Number(searchParams.get("limit") || 10);
  const limit = Math.min(100, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function buildBlogQuery(searchParams) {
  const query = {};
  const search = cleanString(searchParams.get("search") || searchParams.get("q"));
  const status = cleanString(searchParams.get("status"));
  const category = cleanString(searchParams.get("category"));

  if (status && ALLOWED_STATUS.has(status)) {
    query.status = status;
  }

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { excerpt: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  return query;
}

function handleError(error, fallbackMessage = "Blog request failed.") {
  if (error?.code === 11000) {
    return jsonResponse(
      {
        success: false,
        message: "A blog post with this slug already exists.",
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

export async function GET(request) {
  try {
    requireAdmin(request);
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPagination(searchParams);
    const query = buildBlogQuery(searchParams);

    const [items, total] = await Promise.all([
      BlogPost.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments(query),
    ]);

    return jsonResponse({
      success: true,
      data: {
        posts: items,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return handleError(error, "Failed to load blog posts.");
  }
}

export async function POST(request) {
  try {
    const decodedAdmin = requireAdmin(request);
    await connectToDatabase();

    const body = await request.json();
    const payload = sanitizeBlogPayload(body);

    const adminObjectId = getAdminObjectId(decodedAdmin);

    payload.created_by = adminObjectId;
    payload.updated_by = adminObjectId;

    if (!payload.author_name) {
      payload.author_name = getAdminName(decodedAdmin);
    }

    const blogPost = await BlogPost.create(payload);

    return jsonResponse(
      {
        success: true,
        message: "Blog post created successfully.",
        data: {
          post: blogPost.toObject(),
        },
      },
      201
    );
  } catch (error) {
    return handleError(error, "Failed to create blog post.");
  }
}
