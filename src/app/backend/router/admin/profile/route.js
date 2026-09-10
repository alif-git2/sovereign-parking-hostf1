import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import ParkingUser from "@/app/backend/models/park_user";
import {
  requireAdminUser,
  getAuthErrorStatus,
} from "@/app/backend/utils/authToken";

export const runtime = "nodejs";

function getErrorStatus(message = "") {
  const authStatus = getAuthErrorStatus(message);

  if (authStatus !== 400) {
    return authStatus;
  }

  const value = String(message || "").toLowerCase();

  if (value.includes("not found")) return 404;
  if (value.includes("already") || value.includes("duplicate")) return 409;
  if (value.includes("required") || value.includes("invalid")) return 400;

  return 400;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function serializeAdminProfile(user) {
  if (!user) return null;

  const plainUser =
    typeof user.toObject === "function"
      ? user.toObject({
          virtuals: true,
          versionKey: false,
        })
      : user;

  return {
    _id: plainUser._id,
    id: plainUser._id,

    name: plainUser.name || "",
    email: plainUser.email || "",
    phone: plainUser.phone || "",

    role: plainUser.role,
    is_active: plainUser.is_active,

    profile_image_url: plainUser.profile_image_url || "",
    profile_image: plainUser.profile_image_url || "",
    profile_image_public_id: plainUser.profile_image_public_id || "",

    createdAt: plainUser.createdAt,
    updatedAt: plainUser.updatedAt,
  };
}

async function getCurrentAdminOrManager(req) {
  const user = await requireAdminUser(req, ["admin", "manager"]);

  if (!user?._id || !mongoose.Types.ObjectId.isValid(String(user._id))) {
    throw new Error("Invalid admin profile");
  }

  return user;
}

export async function GET(req) {
  try {
    await connectDB();

    const authUser = await getCurrentAdminOrManager(req);

    const user = await ParkingUser.findOne({
      _id: authUser._id,
      role: {
        $in: ["admin", "manager"],
      },
      is_active: true,
    }).select(
      [
        "name",
        "email",
        "phone",
        "role",
        "is_active",
        "profile_image_url",
        "profile_image_public_id",
        "createdAt",
        "updatedAt",
      ].join(" ")
    );

    if (!user) {
      throw new Error("Admin profile not found");
    }

    return Response.json(
      {
        success: true,
        data: {
          user: serializeAdminProfile(user),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin profile fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Admin profile fetch failed",
        error: error.message || "Admin profile fetch failed",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function PATCH(req) {
  try {
    await connectDB();

    const authUser = await getCurrentAdminOrManager(req);
    const body = await req.json();

    const name = normalizeString(body.name);
    const email = normalizeEmail(body.email);
    const phone = normalizeString(body.phone);

    if (!name) {
      throw new Error("Name is required");
    }

    if (!email) {
      throw new Error("Email is required");
    }

    if (!isValidEmail(email)) {
      throw new Error("Invalid email address");
    }

    const emailOwner = await ParkingUser.findOne({
      email,
      _id: {
        $ne: authUser._id,
      },
    }).select("_id email role");

    if (emailOwner) {
      throw new Error("This email is already used by another account");
    }

    /**
     * Do not allow profile popup to update:
     * - role
     * - wallet fields
     * - payment methods
     * - is_active
     * - password
     *
     * Password should be handled by forgot/reset password flow only.
     */
    const updatedUser = await ParkingUser.findOneAndUpdate(
      {
        _id: authUser._id,
        role: {
          $in: ["admin", "manager"],
        },
        is_active: true,
      },
      {
        $set: {
          name,
          email,
          phone,
        },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
        select: [
          "name",
          "email",
          "phone",
          "role",
          "is_active",
          "profile_image_url",
          "profile_image_public_id",
          "createdAt",
          "updatedAt",
        ].join(" "),
      }
    );

    if (!updatedUser) {
      throw new Error("Admin profile not found");
    }

    return Response.json(
      {
        success: true,
        message: "Profile updated successfully.",
        data: {
          user: serializeAdminProfile(updatedUser),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin profile update failed:", error);

    const duplicateEmail =
      error?.code === 11000 && error?.keyPattern?.email
        ? "This email is already used by another account"
        : null;

    return Response.json(
      {
        success: false,
        message:
          duplicateEmail ||
          error.message ||
          "Admin profile update failed",
        error:
          duplicateEmail ||
          error.message ||
          "Admin profile update failed",
      },
      { status: duplicateEmail ? 409 : getErrorStatus(error.message) }
    );
  }
}