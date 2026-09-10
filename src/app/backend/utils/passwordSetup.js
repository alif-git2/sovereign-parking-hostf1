import crypto from "crypto";

export const createPasswordSetupToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

  return {
    rawToken,
    hashedToken,
    expires,
  };
};

export const hashPasswordSetupToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};