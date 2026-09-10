const DEFAULT_PAYPAL_API_URL = "https://api-m.sandbox.paypal.com";

function getPayPalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secretKey = process.env.PAYPAL_SECRET_KEY;
  const apiUrl = process.env.PAYPAL_API_URL || DEFAULT_PAYPAL_API_URL;

  if (!clientId) {
    throw new Error("PAYPAL_CLIENT_ID is not configured.");
  }

  if (!secretKey) {
    throw new Error("PAYPAL_SECRET_KEY is not configured.");
  }

  return {
    clientId: clientId.trim(),
    secretKey: secretKey.trim(),
    apiUrl: apiUrl.replace(/\/$/, ""),
  };
}

function encodeBasicAuth(clientId, secretKey) {
  return Buffer.from(`${clientId}:${secretKey}`).toString("base64");
}

function safeDescription(value, fallback = "Sovereign Parking payment") {
  const text = String(value || fallback).trim();

  /**
   * PayPal descriptions have length limits.
   * Keep it safe and short.
   */
  return text.slice(0, 120);
}

export function normalizePayPalCurrency(currency = "AUD") {
  return String(currency || "AUD").toUpperCase().trim();
}

export function formatPayPalAmount(amount) {
  const value = Number(amount || 0);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("PayPal amount must be greater than zero.");
  }

  return value.toFixed(2);
}

export function getPayPalApiUrl() {
  return getPayPalConfig().apiUrl;
}

export async function getPayPalAccessToken() {
  const { clientId, secretKey, apiUrl } = getPayPalConfig();

  const response = await fetch(`${apiUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBasicAuth(clientId, secretKey)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      result?.error_description ||
      result?.error ||
      "Failed to get PayPal access token.";

    throw new Error(message);
  }

  if (!result?.access_token) {
    throw new Error("PayPal access token was not returned.");
  }

  return result.access_token;
}

export async function paypalRequest(path, options = {}) {
  const { apiUrl } = getPayPalConfig();
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      result?.message ||
      result?.details?.[0]?.description ||
      result?.details?.[0]?.issue ||
      result?.name ||
      "PayPal API request failed.";

    throw new Error(errorMessage);
  }

  return result;
}

/**
 * Generic PayPal order creator.
 *
 * Used for:
 * - booking payments
 * - wallet top-ups
 */
export async function createPayPalOrder({
  amount,
  currency = "AUD",

  /**
   * Booking payment fields.
   */
  bookingId,
  bookingMongoId,

  /**
   * Wallet top-up fields.
   */
  walletTransactionId,
  userId,

  /**
   * Common fields.
   */
  purpose = "booking_payment",
  description,
  returnUrl,
  cancelUrl,
}) {
  const formattedAmount = formatPayPalAmount(amount);
  const normalizedCurrency = normalizePayPalCurrency(currency);

  const isWalletTopup = purpose === "wallet_topup";

  if (isWalletTopup) {
    if (!walletTransactionId) {
      throw new Error(
        "Wallet transaction ID is required to create PayPal wallet top-up order."
      );
    }

    if (!userId) {
      throw new Error("User ID is required to create PayPal wallet top-up order.");
    }
  } else {
    if (!bookingId) {
      throw new Error("Booking ID is required to create PayPal order.");
    }

    if (!bookingMongoId) {
      throw new Error("Booking Mongo ID is required to create PayPal order.");
    }
  }

  const referenceId = isWalletTopup
    ? String(walletTransactionId)
    : String(bookingMongoId);

  const customId = isWalletTopup ? String(userId) : String(bookingId);

  const finalDescription = isWalletTopup
    ? safeDescription(
        description ||
          `Sovereign Parking wallet top-up ${String(walletTransactionId)}`
      )
    : safeDescription(
        description || `Sovereign Parking booking ${String(bookingId)}`
      );

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: referenceId,
        custom_id: customId,
        description: finalDescription,
        amount: {
          currency_code: normalizedCurrency,
          value: formattedAmount,
        },
      },
    ],
  };

  if (returnUrl || cancelUrl) {
    payload.application_context = {
      brand_name: "Sovereign Parking",
      landing_page: "LOGIN",
      user_action: "PAY_NOW",
      return_url: returnUrl,
      cancel_url: cancelUrl,
    };
  }

  return paypalRequest("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createPayPalBookingOrder({
  amount,
  currency = "AUD",
  bookingId,
  bookingMongoId,
  description,
  returnUrl,
  cancelUrl,
}) {
  return createPayPalOrder({
    amount,
    currency,
    bookingId,
    bookingMongoId,
    purpose: "booking_payment",
    description:
      description || `Sovereign Parking booking ${String(bookingId)}`,
    returnUrl,
    cancelUrl,
  });
}

export async function createPayPalWalletTopupOrder({
  amount,
  currency = "AUD",
  walletTransactionId,
  userId,
  description,
  returnUrl,
  cancelUrl,
}) {
  return createPayPalOrder({
    amount,
    currency,
    walletTransactionId,
    userId,
    purpose: "wallet_topup",
    description:
      description ||
      `Sovereign Parking wallet top-up ${String(walletTransactionId)}`,
    returnUrl,
    cancelUrl,
  });
}

export async function capturePayPalOrder(orderId) {
  if (!orderId) {
    throw new Error("PayPal order ID is required.");
  }

  return paypalRequest(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getPayPalApproveLink(order) {
  const approveLink = order?.links?.find((link) => link.rel === "approve");
  return approveLink?.href || null;
}

export function getPayPalCaptureDetails(captureResult) {
  const purchaseUnit = captureResult?.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  return {
    orderId: captureResult?.id || null,
    status: captureResult?.status || null,

    referenceId: purchaseUnit?.reference_id || null,
    customId: purchaseUnit?.custom_id || null,

    captureId: capture?.id || null,
    captureStatus: capture?.status || null,

    amount: Number(capture?.amount?.value || 0),
    currency: normalizePayPalCurrency(capture?.amount?.currency_code || "AUD"),

    sellerReceivableBreakdown: capture?.seller_receivable_breakdown || null,
    rawCapture: capture || null,
  };
}

export function isPayPalOrderApproved(order) {
  return order?.status === "APPROVED";
}

export function isPayPalOrderCompleted(order) {
  return order?.status === "COMPLETED";
}

export function isPayPalCaptureCompleted(captureResult) {
  const details = getPayPalCaptureDetails(captureResult);

  return (
    captureResult?.status === "COMPLETED" &&
    details.captureStatus === "COMPLETED"
  );
}