const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

export function normalizeCurrency(currency = "aud") {
  return String(currency || "aud").toLowerCase().trim();
}

export function normalizePayPalCurrency(currency = "aud") {
  return normalizeCurrency(currency).toUpperCase();
}

export function normalizeAmount(amount, fieldName = "amount") {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return Number(numericAmount.toFixed(2));
}

export function validatePositiveAmount(amount, fieldName = "payment amount") {
  const numericAmount = normalizeAmount(amount, fieldName);

  if (numericAmount <= 0) {
    throw new Error(`${fieldName} must be greater than zero`);
  }

  return numericAmount;
}

export function toStripeAmount(amount, currency = "aud") {
  const numericAmount = validatePositiveAmount(amount, "Stripe payment amount");
  const normalizedCurrency = normalizeCurrency(currency);

  if (STRIPE_ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return Math.round(numericAmount);
  }

  return Math.round(numericAmount * 100);
}

export function fromStripeAmount(amount, currency = "aud") {
  const numericAmount = Number(amount);
  const normalizedCurrency = normalizeCurrency(currency);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return 0;
  }

  if (STRIPE_ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return Number(numericAmount.toFixed(2));
  }

  return Number((numericAmount / 100).toFixed(2));
}

export function formatMoney(amount, currency = "AUD") {
  return `${String(currency || "AUD").toUpperCase()} ${Number(
    amount || 0
  ).toFixed(2)}`;
}

export function calculateCancellationRefund(paidAmount) {
  const cancellationFee = 10;
  const numericPaidAmount = normalizeAmount(paidAmount, "paid amount");

  return {
    cancellationFee,
    refundAmount: Math.max(numericPaidAmount - cancellationFee, 0),
  };
}

export function getBookingTotalAmount(booking) {
  if (!booking) {
    throw new Error("Booking is required");
  }

  const amount = Number(
    booking.price ?? booking.total_amount ?? booking.original_price ?? 0
  );

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Booking total amount is invalid");
  }

  return Number(amount.toFixed(2));
}

export function getBookingPayableAmount(booking) {
  if (!booking) {
    throw new Error("Booking is required");
  }

  const dueAmount = Number(booking.due_amount || 0);
  const price = Number(booking.price || 0);
  const totalAmount = Number(booking.total_amount || 0);

  const amount = dueAmount > 0 ? dueAmount : price > 0 ? price : totalAmount;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Booking amount is invalid");
  }

  return Number(amount.toFixed(2));
}

export function getWalletTopupAmount(amount) {
  const numericAmount = validatePositiveAmount(amount, "wallet top-up amount");

  if (numericAmount < 1) {
    throw new Error("Wallet top-up amount must be at least AUD 1.00");
  }

  if (numericAmount > 5000) {
    throw new Error("Wallet top-up amount cannot exceed AUD 5000.00");
  }

  return numericAmount;
}

export function getWalletPaymentAmount(booking) {
  const amount = getBookingTotalAmount(booking);

  if (amount <= 0) {
    throw new Error("Wallet payment amount must be greater than zero");
  }

  return amount;
}

export function hasEnoughWalletBalance(user, amount) {
  const walletBalance = Number(user?.wallet_balance || 0);
  const requiredAmount = Number(amount || 0);

  if (!Number.isFinite(walletBalance) || walletBalance < 0) {
    return false;
  }

  if (!Number.isFinite(requiredAmount) || requiredAmount <= 0) {
    return false;
  }

  return walletBalance >= requiredAmount;
}