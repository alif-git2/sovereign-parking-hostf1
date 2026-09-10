import crypto from "crypto";
import ParkingUser from "@/app/backend/models/park_user";
import { hashPasswordSetupToken } from "@/app/backend/utils/passwordSetup";
import { sendAdminCreatedUserPasswordEmail } from "@/app/backend/utils/adminUserEmail";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (value.includes("required") || value.includes("valid email")) return 400;
  if (value.includes("inactive")) return 403;

  return 400;
}

function createPasswordResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashPasswordSetupToken(rawToken);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return {
    rawToken,
    hashedToken,
    expires,
  };
}

function getAdminPasswordResetUrl(rawToken) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return `${appUrl}/admin/set-password?token=${encodeURIComponent(rawToken)}`;
}

export async function requestAdminPasswordReset(req) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);

    if (!email || !isValidEmail(email)) {
      throw new Error("Valid email is required");
    }

    const user = await ParkingUser.findOne({
      email,
      role: {
        $in: ["admin", "manager"],
      },
    }).select("+password_setup_token +password_setup_expires");

    /*
      Security:
      Do not reveal if the email exists or not.
      Always return success message.
    */
    if (!user) {
      return Response.json({
        success: true,
        message:
          "If an admin or manager account exists with this email, a password reset link has been sent.",
      });
    }

    if (!user.is_active) {
      throw new Error("This admin account is inactive. Please contact another admin.");
    }

    const tokenData = createPasswordResetToken();

    user.password_setup_token = tokenData.hashedToken;
    user.password_setup_expires = tokenData.expires;

    await user.save();

    const resetUrl = getAdminPasswordResetUrl(tokenData.rawToken);

    let emailResult = {
      sent: false,
      error: null,
    };

    try {
      await sendAdminCreatedUserPasswordEmail({
        user,
        setupUrl: resetUrl,
        isReset: true,
      });

      emailResult = {
        sent: true,
        error: null,
      };
    } catch (error) {
      console.error("Admin password reset email failed:", error);

      emailResult = {
        sent: false,
        error: error.message,
      };
    }

    return Response.json({
      success: true,
      message: emailResult.sent
        ? "Password reset email sent successfully."
        : "Password reset token created, but email failed.",
      data: {
        emailResult,
        reset_url:
          process.env.NODE_ENV === "production" ? undefined : resetUrl,
      },
    });
  } catch (error) {
    console.error("Admin password reset request failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Password reset request failed",
        error: error.message || "Password reset request failed",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}