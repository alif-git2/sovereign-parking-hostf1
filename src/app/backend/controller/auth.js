import jwt from "jsonwebtoken";
import ParkingUser from "@/app/backend/models/park_user";
import { hashPasswordSetupToken } from "@/app/backend/utils/passwordSetup";
import { generateToken, verifyToken } from "@/app/backend/utils/tokenHandeler";
import VerifyCodeSender from "@/app/backend/utils/sendPasswordRestEmail";

const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (value.includes("required")) return 400;
  if (value.includes("invalid")) return 400;
  if (value.includes("expired")) return 400;
  if (value.includes("inactive")) return 403;
  if (value.includes("set your password")) return 403;
  if (value.includes("admin access")) return 403;
  if (value.includes("not allowed")) return 403;

  return 400;
}

export function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
    }
  );
}

function serializeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    is_active: user.is_active,

    wallet_balance: Number(user.wallet_balance || 0),
    wallet_currency: user.wallet_currency || "aud",
    wallet_status: user.wallet_status || "active",
    wallet_updated_at: user.wallet_updated_at || null,

    wallet: {
      balance: Number(user.wallet_balance || 0),
      currency: user.wallet_currency || "aud",
      status: user.wallet_status || "active",
      updated_at: user.wallet_updated_at || null,
    },
  };
}

async function findUserForLogin(email) {
  return ParkingUser.findOne({
    email: String(email || "").toLowerCase().trim(),
  }).select("+password");
}

async function validateLoginCredentials({ email, password }) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const user = await findUserForLogin(email);

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (!user.password) {
    throw new Error("Please set your password first.");
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  if (!user.is_active) {
    throw new Error("Your account is inactive");
  }

  return user;
}

/**
 * Customer login.
 * This can also technically login admin/manager if they use the customer login URL,
 * but admin pages should use loginAdmin() below.
 */
export async function loginUser(req) {
  try {
    const body = await req.json();

    const user = await validateLoginCredentials({
      email: body.email,
      password: body.password,
    });

    const token = createToken(user);

    return Response.json(
      {
        success: true,
        message: "Login successful",
        token,
        data: serializeUser(user),
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error.message || "Login failed",
        error: error.message || "Login failed",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

/**
 * Admin dashboard login.
 * Only admin and manager roles are allowed.
 */
export async function loginAdmin(req) {
  try {
    const body = await req.json();

    const user = await validateLoginCredentials({
      email: body.email,
      password: body.password,
    });

    if (!["admin", "manager"].includes(user.role)) {
      throw new Error("Admin access required");
    }

    const token = createToken(user);

    return Response.json(
      {
        success: true,
        message: "Admin login successful",
        token,
        data: serializeUser(user),
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error.message || "Admin login failed",
        error: error.message || "Admin login failed",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}


export async function getPasswordSetupInfo(req) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      throw new Error("Password setup token is required");
    }

    const hashedToken = hashPasswordSetupToken(token);

    const user = await ParkingUser.findOne({
      password_setup_token: hashedToken,
      password_setup_expires: { $gt: new Date() },
    }).select("name email role is_active password_setup_expires");

    if (!user) {
      throw new Error("Invalid or expired password setup link");
    }

    return Response.json(
      {
        success: true,
        data: {
          name: user.name,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
          expires_at: user.password_setup_expires,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error.message || "Password setup link check failed",
        error: error.message || "Password setup link check failed",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}


export async function setPassword(req) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token) {
      throw new Error("Password setup token is required");
    }

    if (!password) {
      throw new Error("Password is required");
    }

    if (!strongPasswordRegex.test(password)) {
      throw new Error(
        "Password must be at least 8 characters and include uppercase, lowercase, number, special character, and no spaces."
      );
    }

    const hashedToken = hashPasswordSetupToken(token);

    /**
     * password_setup_token and password_setup_expires have select:false,
     * so password setup must explicitly select them.
     */
    const user = await ParkingUser.findOne({
      password_setup_token: hashedToken,
      password_setup_expires: { $gt: new Date() },
    }).select("+password +password_setup_token +password_setup_expires");

    if (!user) {
      throw new Error("Invalid or expired password setup link");
    }

    user.password = password;
    user.password_setup_token = null;
    user.password_setup_expires = null;
    user.is_active = true;

    if (!user.wallet_currency) {
      user.wallet_currency = "aud";
    }

    if (!user.wallet_status) {
      user.wallet_status = "active";
    }

    await user.save();

    const loginToken = createToken(user);

    return Response.json(
      {
        success: true,
        message: "Password set successfully",
        token: loginToken,
        data: serializeUser(user),
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error.message || "Password setup failed",
        error: error.message || "Password setup failed",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function verifyUserBeforeRestPassword(body) {
  try {
    const { email } = body;

    if (!email) {
      return Response.json({
        statusCode: 400,
        message: "Email is required",
        isNext: false,
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await ParkingUser.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return Response.json({
        statusCode: 404,
        message: "User not found",
        isNext: false,
      });
    }

    const token = generateToken(user._id);

    function generateSixDigitCode() {
      return String(Math.floor(100000 + Math.random() * 900000));
    }

    const code = generateSixDigitCode();

    user.code = code;

    await user.save();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const link = `${appUrl}/verify-otp?token=${token}`;

    await VerifyCodeSender({
      link,
      email: normalizedEmail,
      code,
    });

    return Response.json({
      statusCode: 200,
      message: `Code has been sent to ${normalizedEmail}`,
      isNext: true,
      token,
    });
  } catch (error) {
    console.error("Verify user before reset password error:", error);

    return Response.json({
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
      isNext: false,
    });
  }
}

export async function VerifyOTPCode(body) {
  try {
    const { code } = body;

    if (!code) {
      return Response.json({
        statusCode: 400,
        message: "Code is required",
        isNext: false,
      });
    }

    const normalizedCode = String(code).trim();

    const user = await ParkingUser.findOne({
      code: normalizedCode,
    });

    if (!user) {
      return Response.json({
        statusCode: 404,
        message: "Invalid verification code",
        isNext: false,
      });
    }

    user.code = null;
    await user.save();

    return Response.json({
      statusCode: 200,
      message: "The code is valid",
      isNext: true,
    });
  } catch (error) {
    console.error("Verify OTP code error:", error);

    return Response.json({
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
      isNext: false,
    });
  }
}

export async function resetPassword(body) {
  try {
    const { password, token } = body;

    if (!token) {
      return Response.json({
        statusCode: 400,
        message: "Reset token is required",
        isNext: false,
      });
    }

    if (!password) {
      return Response.json({
        statusCode: 400,
        message: "Password is required",
        isNext: false,
      });
    }

    if (!strongPasswordRegex.test(password)) {
      return Response.json({
        statusCode: 400,
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, special character, and no spaces.",
        isNext: false,
      });
    }

    const decode = verifyToken(token);

    const user = await ParkingUser.findById(decode.user).select("+password");

    if (!user) {
      return Response.json({
        statusCode: 404,
        message: "User not found",
        isNext: false,
      });
    }

    user.password = password;
    await user.save();

    return Response.json({
      statusCode: 200,
      message: "Your password has been changed successfully",
      isNext: true,
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return Response.json({
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
      isNext: false,
    });
  }
}