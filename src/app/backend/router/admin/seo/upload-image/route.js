import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { randomUUID, createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
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
    const error = new Error("Only admin can upload SEO images.");
    error.statusCode = 403;
    throw error;
  }

  return decoded;
}

function getSiteUrl() {
  return String(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function validateImageFile(file) {
  if (!file) {
    const error = new Error("Image file is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    const error = new Error("Only JPG, PNG, and WebP images are allowed.");
    error.statusCode = 400;
    throw error;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    const error = new Error("Image size must be less than 5MB.");
    error.statusCode = 400;
    throw error;
  }
}

function buildCloudinarySignature(params, apiSecret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(`${sortedParams}${apiSecret}`).digest("hex");
}

async function uploadToCloudinary(file) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || "seo";
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `seo-${Date.now()}-${randomUUID()}`;

  const signature = buildCloudinarySignature(
    {
      folder,
      public_id: publicId,
      timestamp,
    },
    apiSecret
  );

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("public_id", publicId);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const uploadResult = await uploadResponse.json();

  if (!uploadResponse.ok) {
    const error = new Error(
      uploadResult?.error?.message || "Cloudinary image upload failed."
    );
    error.statusCode = 500;
    throw error;
  }

  return {
    url: uploadResult.secure_url,
    secure_url: uploadResult.secure_url,
    provider: "cloudinary",
    public_id: uploadResult.public_id,
  };
}

async function uploadToLocalPublic(file) {
  const extension = ALLOWED_IMAGE_TYPES.get(file.type);
  const fileName = `seo-${Date.now()}-${randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "seo");
  const filePath = path.join(uploadDir, fileName);

  await mkdir(uploadDir, {
    recursive: true,
  });

  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(filePath, buffer);

  const publicUrl = `/uploads/seo/${fileName}`;

  return {
    url: publicUrl,
    secure_url: `${getSiteUrl()}${publicUrl}`,
    provider: "local",
  };
}

function handleError(error, fallbackMessage = "SEO image upload failed.") {
  const status = error.statusCode || 500;

  return jsonResponse(
    {
      success: false,
      message: error.message || fallbackMessage,
    },
    status
  );
}

export async function POST(request) {
  try {
    requireAdmin(request);

    const formData = await request.formData();
    const file = formData.get("image");

    validateImageFile(file);

    const cloudinaryUpload = await uploadToCloudinary(file);
    const uploadResult = cloudinaryUpload || (await uploadToLocalPublic(file));

    return jsonResponse({
      success: true,
      message: "SEO image uploaded successfully.",
      data: uploadResult,
    });
  } catch (error) {
    return handleError(error);
  }
}
