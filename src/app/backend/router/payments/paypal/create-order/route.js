import mongoose from "mongoose";
import { connectDB } from "@/app/backend/database/mongodb";
import Booking from "@/app/backend/models/booking";
import Payment from "@/app/backend/models/payment";
import CheckoutDraft from "@/app/backend/models/checkoutDraft";
import {
  createPayPalOrder,
  formatPayPalAmount,
  normalizePayPalCurrency,
} from "@/app/backend/utils/paypal";
import {
  getBookingPayableAmount,
  normalizeCurrency,
} from "@/app/backend/utils/paymentHelpers";

export const runtime = "nodejs";

const PAYPAL_PAYMENT_FLOWS = ["full_online", "poa_deposit"];
const REUSABLE_DRAFT_STATUSES = [
  "draft",
  "payment_ready",
  "payment_processing",
  "failed",
];

function serializePayPalPayload(payload) {
  if (!payload) return null;
  return payload;
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeMoney(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Number(number.toFixed(2));
}

function getBookingQuery(bookingId) {
  const value = normalizeString(bookingId);

  if (!value) {
    throw new Error("Booking ID is required.");
  }

  if (mongoose.Types.ObjectId.isValid(value)) {
    return { _id: value };
  }

  return { booking_id: value };
}

function getDraftFilter(draftId) {
  const value = normalizeString(draftId);

  if (!value) {
    throw new Error("Checkout draft ID is required.");
  }

  const conditions = [{ draft_reference: value }];

  if (mongoose.Types.ObjectId.isValid(value)) {
    conditions.push({ _id: value });
  }

  return {
    $or: conditions,
  };
}

function getApproveLink(order) {
  const approveLink = order?.links?.find((link) => link.rel === "approve");
  return approveLink?.href || null;
}

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (value.includes("booking id")) return 400;
  if (value.includes("checkout draft id")) return 400;
  if (value.includes("draft has expired")) return 410;
  if (value.includes("draft is not ready")) return 409;
  if (value.includes("not found")) return 404;
  if (value.includes("already")) return 400;
  if (value.includes("not configured")) return 400;
  if (value.includes("not awaiting")) return 400;
  if (value.includes("payment flow")) return 400;
  if (value.includes("payment method")) return 400;
  if (value.includes("amount")) return 400;

  return 500;
}

function getPaymentPurposeFromFlow(paymentFlow) {
  if (paymentFlow === "poa_deposit") {
    return "poa_holding_deposit";
  }

  return "full_online_payment";
}

function getDepositTypeFromFlow(paymentFlow) {
  if (paymentFlow === "poa_deposit") {
    return "poa";
  }

  return "full";
}

function getPaymentPurpose(booking) {
  return getPaymentPurposeFromFlow(booking.payment_flow);
}

function getDepositType(booking) {
  return getDepositTypeFromFlow(booking.payment_flow);
}

function getPayPalDescriptionForBooking(booking, amount) {
  if (booking.payment_flow === "poa_deposit") {
    return `Sovereign Parking booking ${booking.booking_id} holding deposit ${formatPayPalAmount(
      amount
    )}`;
  }

  return `Sovereign Parking booking ${booking.booking_id}`;
}

function getPayPalDescriptionForDraft(draft, amount) {
  if (draft.payment_flow === "poa_deposit") {
    return `Sovereign Parking checkout ${draft.draft_reference} holding deposit ${formatPayPalAmount(
      amount
    )}`;
  }

  return `Sovereign Parking checkout ${draft.draft_reference}`;
}

function getAlreadyPaidResponse(booking) {
  const isPoaDepositPaid =
    booking.payment_flow === "poa_deposit" &&
    booking.payment_status === "partial" &&
    booking.status === "poa";

  if (isPoaDepositPaid) {
    return {
      success: false,
      message: "This Pay on Arrival holding deposit has already been paid.",
      alreadyPaid: true,
      redirectUrl: `/booking/success?bookingId=${booking.booking_id}`,
    };
  }

  return {
    success: false,
    message: "This booking has already been paid.",
    alreadyPaid: true,
    redirectUrl: `/booking/success?bookingId=${booking.booking_id}`,
  };
}

function getDraftAlreadyCompletedResponse(draft) {
  return {
    success: false,
    message: "This checkout draft has already been completed.",
    alreadyPaid: true,
    redirectUrl: draft.booking_public_id
      ? `/booking/success?bookingId=${draft.booking_public_id}`
      : `/booking/success?draftId=${draft.draft_reference}`,
  };
}

function getDraftAmount(draft) {
  return normalizeMoney(
    draft?.pricing_snapshot?.amount_due_now ||
      draft?.booking_payload?.due_amount ||
      draft?.booking_payload?.amount_due_now ||
      0
  );
}

function getDraftBookingTotal(draft, amount) {
  return normalizeMoney(
    draft?.pricing_snapshot?.price ||
      draft?.booking_payload?.price ||
      draft?.booking_payload?.total_amount ||
      amount
  );
}

function getDraftHoldingDeposit(draft, amount) {
  if (draft.payment_flow !== "poa_deposit") return 0;

  return normalizeMoney(
    draft?.pricing_snapshot?.holding_deposit_amount ||
      draft?.booking_payload?.holding_deposit_amount ||
      amount
  );
}

function getDraftBalanceDueOnArrival(draft, bookingTotalAmount, amount) {
  if (draft.payment_flow !== "poa_deposit") return 0;

  return normalizeMoney(
    draft?.pricing_snapshot?.balance_due_on_arrival ||
      draft?.booking_payload?.balance_due_on_arrival ||
      Math.max(bookingTotalAmount - amount, 0)
  );
}

function buildDraftBookingPreview({ draft, amount, bookingTotalAmount }) {
  const holdingDepositAmount = getDraftHoldingDeposit(draft, amount);
  const balanceDueOnArrival = getDraftBalanceDueOnArrival(
    draft,
    bookingTotalAmount,
    amount
  );

  return {
    _id: draft._id,
    checkout_draft_id: draft._id,
    draft_id: draft.draft_reference,
    booking_id: draft.draft_reference,
    type: draft.type,

    status: draft.status,
    payment_status: "pending",
    payment_method: "paypal",
    payment_flow: draft.payment_flow,
    deposit_type: draft.deposit_type,

    price: bookingTotalAmount,
    total_amount: bookingTotalAmount,
    paid_amount: 0,
    due_amount: amount,

    holding_deposit_amount: holdingDepositAmount,
    balance_due_on_arrival: balanceDueOnArrival,

    currency: draft.currency || "aud",
    paypal_order_id: draft.paypal_order_id || "",

    formatted_amount: formatPayPalAmount(amount),
  };
}

async function createOrderForCheckoutDraft({ draft }) {
  if (!draft) {
    throw new Error("Checkout draft not found.");
  }

  if (typeof draft.isExpired === "function" && draft.isExpired()) {
    draft.status = "expired";
    await draft.save();
    throw new Error("Checkout draft has expired. Please start booking again.");
  }

  if (draft.status === "completed" || draft.booking_public_id) {
    return Response.json(getDraftAlreadyCompletedResponse(draft), {
      status: 400,
    });
  }

  if (draft.payment_method !== "paypal" && draft.payment_provider !== "paypal") {
    throw new Error(
      `This checkout draft is not configured for PayPal payment. Current method: ${
        draft.payment_method || draft.payment_provider || "-"
      }`
    );
  }

  if (!PAYPAL_PAYMENT_FLOWS.includes(draft.payment_flow)) {
    throw new Error(
      "Invalid PayPal payment flow. PayPal supports full online payment and Pay on Arrival holding deposit."
    );
  }

  if (!REUSABLE_DRAFT_STATUSES.includes(draft.status)) {
    throw new Error(
      `Checkout draft is not ready for PayPal payment. Current status: ${draft.status}`
    );
  }

  const amount = getDraftAmount(draft);
  const currency = normalizePayPalCurrency(
    normalizeCurrency(draft.currency || "aud")
  );

  if (amount <= 0) {
    throw new Error("PayPal payment amount must be greater than zero.");
  }

  const paymentPurpose = getPaymentPurposeFromFlow(draft.payment_flow);
  const depositType = getDepositTypeFromFlow(draft.payment_flow);

  const bookingTotalAmount = getDraftBookingTotal(draft, amount);
  const holdingDepositAmount = getDraftHoldingDeposit(draft, amount);
  const balanceDueOnArrival = getDraftBalanceDueOnArrival(
    draft,
    bookingTotalAmount,
    amount
  );

  const appUrl = getAppUrl();
  const encodedDraftId = encodeURIComponent(draft.draft_reference);

  const order = await createPayPalOrder({
    amount,
    currency,
    bookingId: draft.draft_reference,
    bookingMongoId: draft._id.toString(),
    description: getPayPalDescriptionForDraft(draft, amount),
    returnUrl: `${appUrl}/booking/paypal?draftId=${encodedDraftId}`,
    cancelUrl: `${appUrl}/booking/paypal?draftId=${encodedDraftId}&cancelled=true`,
    customId: draft.draft_reference,
    invoiceId: draft.draft_reference,
    metadata: {
      checkoutDraftId: draft.draft_reference,
      checkoutDraftMongoId: draft._id.toString(),
      paymentPurpose,
      paymentFlow: draft.payment_flow,
      depositType,
    },
  });

  if (!order?.id) {
    throw new Error("PayPal order ID was not returned.");
  }

  draft.payment_provider = "paypal";
  draft.payment_method = "paypal";
  draft.payment_flow = draft.payment_flow;
  draft.deposit_type = depositType;
  draft.currency = String(currency).toLowerCase();
  draft.paypal_order_id = order.id;
  draft.provider_payload = serializePayPalPayload(order);
  draft.payment_started_at = draft.payment_started_at || new Date();
  draft.status = "payment_ready";
  draft.payment_error = "";

  await draft.save();

  const bookingPreview = buildDraftBookingPreview({
    draft,
    amount,
    bookingTotalAmount,
  });

  return Response.json(
    {
      success: true,
      checkout_draft: true,
      message:
        draft.payment_flow === "poa_deposit"
          ? "PayPal holding deposit order created."
          : "PayPal order created.",

      orderId: order.id,
      order_id: order.id,
      approveUrl: getApproveLink(order),
      redirectUrl: getApproveLink(order),
      order,

      draft: {
        _id: draft._id,
        draft_reference: draft.draft_reference,
        status: draft.status,
        payment_method: draft.payment_method,
        payment_flow: draft.payment_flow,
        deposit_type: draft.deposit_type,
        paypal_order_id: draft.paypal_order_id,
      },

      payment: null,
      payment_purpose: paymentPurpose,
      paymentPurpose,

      booking: bookingPreview,
    },
    { status: 200 }
  );
}

async function createOrderForExistingBooking({ booking }) {
  if (!booking) {
    throw new Error("Booking not found.");
  }

  if (booking.payment_method !== "paypal") {
    throw new Error(
      `This booking is not configured for PayPal payment. Current method: ${booking.payment_method}`
    );
  }

  if (!PAYPAL_PAYMENT_FLOWS.includes(booking.payment_flow)) {
    throw new Error(
      "Invalid PayPal payment flow. PayPal supports full online payment and Pay on Arrival holding deposit."
    );
  }

  if (
    booking.payment_status === "paid" ||
    booking.status === "success" ||
    booking.status === "confirmed" ||
    (booking.payment_flow === "poa_deposit" &&
      booking.payment_status === "partial" &&
      booking.status === "poa")
  ) {
    return Response.json(getAlreadyPaidResponse(booking), { status: 400 });
  }

  if (booking.status !== "pending_payment") {
    throw new Error(
      `This booking is not awaiting PayPal payment. Current status: ${booking.status}`
    );
  }

  const amount = getBookingPayableAmount(booking);
  const currency = normalizePayPalCurrency(
    normalizeCurrency(booking.currency || "aud")
  );

  if (Number(amount || 0) <= 0) {
    throw new Error("PayPal payment amount must be greater than zero.");
  }

  const paymentPurpose = getPaymentPurpose(booking);
  const depositType = getDepositType(booking);

  const bookingTotalAmount = Number(booking.price || amount);
  const holdingDepositAmount =
    booking.payment_flow === "poa_deposit"
      ? Number(booking.holding_deposit_amount || amount)
      : 0;

  const balanceDueOnArrival =
    booking.payment_flow === "poa_deposit"
      ? Number(
          booking.balance_due_on_arrival ||
            Math.max(bookingTotalAmount - amount, 0)
        )
      : 0;

  const appUrl = getAppUrl();

  const order = await createPayPalOrder({
    amount,
    currency,
    bookingId: booking.booking_id,
    bookingMongoId: booking._id.toString(),
    description: getPayPalDescriptionForBooking(booking, amount),
    returnUrl: `${appUrl}/booking/paypal/${booking._id}`,
    cancelUrl: `${appUrl}/booking/paypal/${booking._id}?cancelled=true`,
  });

  if (!order?.id) {
    throw new Error("PayPal order ID was not returned.");
  }

  /**
   * Existing-booking retry flow only.
   * Do not create new bookings here and do not overwrite business status.
   */
  booking.payment_method = "paypal";
  booking.deposit_type = depositType;
  booking.payment_status = booking.payment_status || "pending";
  booking.paypal_order_id = order.id;

  if (booking.payment_flow === "poa_deposit") {
    booking.paid_amount = 0;
    booking.due_amount = amount;
    booking.holding_deposit_amount = holdingDepositAmount;
    booking.balance_due_on_arrival = balanceDueOnArrival;
  } else {
    booking.paid_amount = 0;
    booking.due_amount = amount;
    booking.holding_deposit_amount = 0;
    booking.balance_due_on_arrival = 0;
  }

  await booking.save();

  const payment = await Payment.findOneAndUpdate(
    {
      provider_order_id: order.id,
    },
    {
      booking_id: booking._id,
      user_id: booking.user_id,

      amount,
      currency: String(currency).toLowerCase(),

      method: "paypal",
      status: "pending",

      payment_flow: booking.payment_flow,
      deposit_type: depositType,
      payment_purpose: paymentPurpose,

      transaction_id: order.id,
      provider_order_id: order.id,
      provider_payload: serializePayPalPayload(order),

      booking_total_amount: bookingTotalAmount,
      holding_deposit_amount: holdingDepositAmount,
      balance_due_on_arrival: balanceDueOnArrival,
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    }
  );

  return Response.json(
    {
      success: true,
      checkout_draft: false,
      message:
        booking.payment_flow === "poa_deposit"
          ? "PayPal holding deposit order created."
          : "PayPal order created.",
      orderId: order.id,
      order_id: order.id,
      approveUrl: getApproveLink(order),
      redirectUrl: getApproveLink(order),
      order,
      payment: {
        _id: payment?._id,
        status: payment?.status,
        amount: payment?.amount,
        currency: payment?.currency,
        payment_flow: payment?.payment_flow,
        payment_purpose: payment?.payment_purpose,
        provider_order_id: payment?.provider_order_id,
      },
      booking: {
        _id: booking._id,
        booking_id: booking.booking_id,
        type: booking.type,

        status: booking.status,
        payment_status: booking.payment_status,
        payment_method: booking.payment_method,
        payment_flow: booking.payment_flow,
        deposit_type: booking.deposit_type,

        price: booking.price,
        total_amount: booking.price,
        paid_amount: booking.paid_amount,
        due_amount: booking.due_amount,

        holding_deposit_amount: booking.holding_deposit_amount,
        balance_due_on_arrival: booking.balance_due_on_arrival,

        currency: booking.currency || "aud",
        paypal_order_id: booking.paypal_order_id,

        formatted_amount: formatPayPalAmount(amount),
      },
    },
    { status: 200 }
  );
}

export async function POST(req) {
  try {
    await connectDB();

    if (!process.env.PAYPAL_CLIENT_ID) {
      return Response.json(
        {
          success: false,
          message: "PAYPAL_CLIENT_ID is not configured.",
          error: "PAYPAL_CLIENT_ID is not configured.",
        },
        { status: 500 }
      );
    }

    if (!process.env.PAYPAL_SECRET_KEY) {
      return Response.json(
        {
          success: false,
          message: "PAYPAL_SECRET_KEY is not configured.",
          error: "PAYPAL_SECRET_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const draftId =
      body.draftId ||
      body.draft_id ||
      body.checkoutDraftId ||
      body.checkout_draft_id ||
      "";

    const bookingId = body.bookingId || body.booking_id || "";

    if (draftId) {
      const draft = await CheckoutDraft.findOne(getDraftFilter(draftId));

      if (!draft) {
        return Response.json(
          {
            success: false,
            message: "Checkout draft not found.",
            error: "Checkout draft not found.",
          },
          { status: 404 }
        );
      }

      return await createOrderForCheckoutDraft({ draft });
    }

    if (!bookingId) {
      return Response.json(
        {
          success: false,
          message: "Booking ID or checkout draft ID is required.",
          error: "Booking ID or checkout draft ID is required.",
        },
        { status: 400 }
      );
    }

    const booking = await Booking.findOne(getBookingQuery(bookingId));

    if (!booking) {
      return Response.json(
        {
          success: false,
          message: "Booking not found.",
          error: "Booking not found.",
        },
        { status: 404 }
      );
    }

    return await createOrderForExistingBooking({ booking });
  } catch (error) {
    console.error("Create PayPal order error:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to create PayPal order.",
        error: error.message || "Failed to create PayPal order.",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}
