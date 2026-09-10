import { connectDB } from "@/app/backend/database/mongodb";
import ParkingUser from "@/app/backend/models/park_user";

export const runtime = "nodejs";

const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function normalizeString(value) {
  return String(value || "").trim();
}

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (value.includes("secret")) return 403;
  if (value.includes("required")) return 400;
  if (value.includes("password")) return 400;
  if (value.includes("configured")) return 500;

  return 400;
}

export async function POST(req) {
  try {
    await connectDB();

    const body = await req.json();

    const name = normalizeString(body.name || "Admin");
    const email = normalizeEmail(body.email);
    const phone = normalizeString(body.phone || "0000000000");
    const password = String(body.password || "");
    const secret = String(body.secret || "");
    const forcePasswordUpdate = Boolean(body.forcePasswordUpdate);

    if (!process.env.ADMIN_SEED_SECRET) {
      throw new Error("ADMIN_SEED_SECRET is not configured");
    }

    if (secret !== process.env.ADMIN_SEED_SECRET) {
      throw new Error("Invalid seed secret");
    }

    if (!email) {
      throw new Error("Email is required");
    }

    if (!password) {
      throw new Error("Password is required");
    }

    if (!strongPasswordRegex.test(password)) {
      throw new Error(
        "Password must be at least 8 characters and include uppercase, lowercase, number, special character, and no spaces."
      );
    }

    let user = await ParkingUser.findOne({ email }).select(
      "+password +password_setup_token +password_setup_expires"
    );

    let action = "created";

    if (user) {
      action = "updated";

      user.name = name || user.name;
      user.phone = phone || user.phone;
      user.role = "admin";
      user.is_active = true;
      user.wallet_status = user.wallet_status || "active";
      user.wallet_currency = user.wallet_currency || "aud";
      user.password_setup_token = null;
      user.password_setup_expires = null;

      if (!user.password || forcePasswordUpdate) {
        user.password = password;
      }

      await user.save();
    } else {
      user = await ParkingUser.create({
        name,
        email,
        phone,
        password,
        role: "admin",
        is_active: true,
        wallet_status: "active",
        wallet_currency: "aud",
      });
    }

    return Response.json({
      success: true,
      message: `Admin user ${action} successfully`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    console.error("Admin seed error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Admin seed failed",
        error: error.message || "Admin seed failed",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}