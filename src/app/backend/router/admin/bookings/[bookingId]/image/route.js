import { NextResponse } from "next/server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { randomUUID, createHash } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { connectDB } from "@/app/backend/database/mongodb";
import Booking from "@/app/backend/models/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES_PER_BOOKING = 10;

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
    const error = new Error("Only admin can manage booking images.");
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
  if (!file || typeof file.arrayBuffer !== "function") {
    const error = new Error("Image file is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    const error = new Error("Only JPG, PNG, and WebP images are allowed.");
    error.statusCode = 400;
    throw error;
  }

  if (!file.size) {
    const error = new Error("Image file is empty.");
    error.statusCode = 400;
    throw error;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    const error = new Error(`${file.name || "Image"} must be less than 5MB.`);
    error.statusCode = 400;
    throw error;
  }
}

function buildCloudinarySignature(params, apiSecret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1")
    .update(sortedParams + apiSecret)
    .digest("hex");
}

function getBookingCloudinaryFolder() {
  return String(process.env.CLOUDINARY_BOOKING_UPLOAD_FOLDER || "bookings")
    .replace(/^\/+|\/+$/g, "")
    .trim();
}

async function uploadToCloudinary(file) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  const folder = getBookingCloudinaryFolder();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `booking-${Date.now()}-${randomUUID()}`;

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
      uploadResult?.error?.message || "Cloudinary booking image upload failed."
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
  const fileName = `booking-${Date.now()}-${randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "bookings");
  const filePath = path.join(uploadDir, fileName);

  await mkdir(uploadDir, {
    recursive: true,
  });

  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(filePath, buffer);

  const publicUrl = `/uploads/bookings/${fileName}`;

  return {
    url: publicUrl,
    secure_url: `${getSiteUrl()}${publicUrl}`,
    provider: "local",
    public_id: "",
  };
}

function buildBookingIdentifierFilter(bookingId) {
  const normalizedBookingId = String(bookingId || "").trim();

  if (!normalizedBookingId) {
    const error = new Error("Booking ID is required.");
    error.statusCode = 400;
    throw error;
  }

  if (mongoose.Types.ObjectId.isValid(normalizedBookingId)) {
    return {
      $or: [
        { _id: normalizedBookingId },
        { booking_id: normalizedBookingId },
      ],
    };
  }

  return {
    booking_id: normalizedBookingId,
  };
}

async function findBookingForImage(bookingId) {
  const booking = await Booking.findOne(
    buildBookingIdentifierFilter(bookingId)
  )
    .select("_id booking_id admin_image admin_images")
    .lean();

  if (!booking) {
    const error = new Error("Booking not found.");
    error.statusCode = 404;
    throw error;
  }

  return booking;
}

function normalizeStoredImages(booking) {
  const images = Array.isArray(booking?.admin_images)
    ? booking.admin_images
        .filter((image) => image?.url)
        .map((image) => ({
          image_id: String(image.image_id || ""),
          url: String(image.url || ""),
          provider: String(image.provider || ""),
          public_id: String(image.public_id || ""),
          original_name: String(image.original_name || ""),
          uploaded_at: image.uploaded_at || null,
        }))
    : [];

  const legacyImage = booking?.admin_image?.url
    ? {
        image_id: "",
        url: String(booking.admin_image.url || ""),
        provider: String(booking.admin_image.provider || ""),
        public_id: String(booking.admin_image.public_id || ""),
        original_name: String(booking.admin_image.original_name || ""),
        uploaded_at: booking.admin_image.uploaded_at || null,
      }
    : null;

  if (
    legacyImage &&
    !images.some(
      (image) =>
        image.url === legacyImage.url ||
        (image.public_id && image.public_id === legacyImage.public_id)
    )
  ) {
    images.unshift(legacyImage);
  }

  return images;
}

async function deleteCloudinaryImage(publicId) {
  const cleanPublicId = String(publicId || "").trim();

  if (!cleanPublicId) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);

  const signature = buildCloudinarySignature(
    {
      public_id: cleanPublicId,
      timestamp,
    },
    apiSecret
  );

  const formData = new FormData();
  formData.append("public_id", cleanPublicId);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(
      result?.error?.message || "Failed to delete Cloudinary booking image."
    );
  }
}

async function deleteLocalImage(imageUrl) {
  const url = String(imageUrl || "").trim();
  const prefix = "/uploads/bookings/";

  if (!url.startsWith(prefix)) {
    return;
  }

  const fileName = path.basename(url);

  if (!fileName) return;

  const filePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "bookings",
    fileName
  );

  try {
    await unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

async function cleanupStoredImage(image) {
  if (!image?.url) return;

  try {
    if (image.provider === "cloudinary" && image.public_id) {
      await deleteCloudinaryImage(image.public_id);
      return;
    }

    if (image.provider === "local" || image.url.startsWith("/uploads/bookings/")) {
      await deleteLocalImage(image.url);
    }
  } catch (error) {
    console.error("Booking image cleanup failed:", error);
  }
}

function getImageFiles(formData) {
  const files = [
    ...formData.getAll("images"),
    ...formData.getAll("image"),
  ].filter((file) => file && typeof file.arrayBuffer === "function");

  return files;
}

function getDeleteIdentifier(request, body = {}) {
  const url = new URL(request.url);

  return {
    image_id: String(body.image_id || url.searchParams.get("image_id") || "").trim(),
    public_id: String(body.public_id || url.searchParams.get("public_id") || "").trim(),
    image_url: String(body.image_url || url.searchParams.get("image_url") || "").trim(),
  };
}

function imageMatchesIdentifier(image, identifier) {
  if (identifier.image_id && String(image.image_id || "") === identifier.image_id) {
    return true;
  }

  if (identifier.public_id && String(image.public_id || "") === identifier.public_id) {
    return true;
  }

  if (identifier.image_url && String(image.url || "") === identifier.image_url) {
    return true;
  }

  return false;
}

function handleError(error, fallbackMessage = "Booking image operation failed.") {
  const status = error.statusCode || 500;

  return jsonResponse(
    {
      success: false,
      message: error.message || fallbackMessage,
    },
    status
  );
}

export async function POST(request, context) {
  const newlyUploadedImages = [];

  try {
    requireAdmin(request);
    await connectDB();

    const { bookingId } = await context.params;
    const booking = await findBookingForImage(bookingId);
    const existingImages = normalizeStoredImages(booking);

    const formData = await request.formData();
    const files = getImageFiles(formData);

    if (files.length === 0) {
      const error = new Error("At least one image file is required.");
      error.statusCode = 400;
      throw error;
    }

    files.forEach(validateImageFile);

    if (existingImages.length + files.length > MAX_IMAGES_PER_BOOKING) {
      const error = new Error(
        `A booking can have a maximum of ${MAX_IMAGES_PER_BOOKING} images.`
      );
      error.statusCode = 400;
      throw error;
    }

    for (const file of files) {
      const cloudinaryUpload = await uploadToCloudinary(file);
      const uploadResult = cloudinaryUpload || (await uploadToLocalPublic(file));

      newlyUploadedImages.push({
        image_id: randomUUID(),
        url: uploadResult.url,
        provider: uploadResult.provider,
        public_id: uploadResult.public_id || "",
        original_name: String(file.name || "").trim().slice(0, 255),
        uploaded_at: new Date(),
      });
    }

    const adminImages = [...existingImages, ...newlyUploadedImages];

    const updateResult = await Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          admin_images: adminImages,
        },
        $unset: {
          admin_image: 1,
        },
      }
    );

    if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
      const error = new Error("Booking images could not be saved.");
      error.statusCode = 500;
      throw error;
    }

    return jsonResponse({
      success: true,
      message:
        newlyUploadedImages.length === 1
          ? "Booking image uploaded successfully."
          : `${newlyUploadedImages.length} booking images uploaded successfully.`,
      data: {
        admin_images: adminImages,
      },
    });
  } catch (error) {
    for (const image of newlyUploadedImages) {
      await cleanupStoredImage(image);
    }

    return handleError(error);
  }
}

export async function DELETE(request, context) {
  try {
    requireAdmin(request);
    await connectDB();

    const { bookingId } = await context.params;
    const booking = await findBookingForImage(bookingId);
    const existingImages = normalizeStoredImages(booking);

    const body = await request.json().catch(() => ({}));
    const identifier = getDeleteIdentifier(request, body);

    if (!identifier.image_id && !identifier.public_id && !identifier.image_url) {
      const error = new Error("Image identifier is required.");
      error.statusCode = 400;
      throw error;
    }

    const imageToRemove = existingImages.find((image) =>
      imageMatchesIdentifier(image, identifier)
    );

    if (!imageToRemove) {
      return jsonResponse({
        success: true,
        message: "Booking image is already removed.",
        data: {
          admin_images: existingImages,
        },
      });
    }

    const remainingImages = existingImages.filter(
      (image) => !imageMatchesIdentifier(image, identifier)
    );

    const updateResult = await Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          admin_images: remainingImages,
        },
        $unset: {
          admin_image: 1,
        },
      }
    );

    if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
      const error = new Error("Booking image could not be removed.");
      error.statusCode = 500;
      throw error;
    }

    await cleanupStoredImage(imageToRemove);

    return jsonResponse({
      success: true,
      message: "Booking image removed successfully.",
      data: {
        admin_images: remainingImages,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
