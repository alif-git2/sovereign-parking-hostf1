import jwt from "jsonwebtoken";
import ParkingUser from "@/app/backend/models/park_user";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

function getBearerToken(req) {
  const authHeader = req?.headers?.get("authorization") || "";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Authorization token is required");
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    throw new Error("Authorization token is required");
  }

  return token;
}

function getUserIdFromDecodedToken(decoded) {
  return (
    decoded?.id ||
    decoded?._id ||
    decoded?.userId ||
    decoded?.user_id ||
    decoded?.sub ||
    ""
  );
}

export const getUserFromRequest = (req) => {
  const token = getBearerToken(req);

  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    throw new Error("Invalid or expired token");
  }
};

export const getOptionalUserFromRequest = (req) => {
  try {
    return getUserFromRequest(req);
  } catch {
    return null;
  }
};

export const requireAuthUser = async (req) => {
  const decoded = getUserFromRequest(req);
  const userId = getUserIdFromDecodedToken(decoded);

  if (!userId) {
    throw new Error("Invalid token payload");
  }

  const user = await ParkingUser.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.is_active) {
    throw new Error("Your account is inactive");
  }

  return user;
};

export const requireAdminUser = async (
  req,
  allowedRoles = ["admin", "manager"]
) => {
  const user = await requireAuthUser(req);

  if (!allowedRoles.includes(user.role)) {
    throw new Error("Admin access required");
  }

  return user;
};

export const requireCustomerUser = async (req) => {
  const user = await requireAuthUser(req);

  if (user.role !== "customer") {
    throw new Error("Customer access required");
  }

  return user;
};

export const getAuthErrorStatus = (message = "") => {
  const value = String(message || "").toLowerCase();

  if (
    value.includes("authorization") ||
    value.includes("token") ||
    value.includes("expired") ||
    value.includes("login")
  ) {
    return 401;
  }

  if (
    value.includes("admin access") ||
    value.includes("customer access") ||
    value.includes("permission")
  ) {
    return 403;
  }

  if (value.includes("inactive")) {
    return 403;
  }

  if (value.includes("not found")) {
    return 404;
  }

  return 400;
};