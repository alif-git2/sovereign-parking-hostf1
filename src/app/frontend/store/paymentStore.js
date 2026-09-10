import { create } from "zustand";
import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/backend/router";

const apiBaseUrl = API_BASE_URL.replace(/\/$/, "");

function getCustomerToken() {
  if (typeof window === "undefined") return null;

  return localStorage.getItem("token");
}

function buildAuthHeaders() {
  const token = getCustomerToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function getErrorMessage(error, fallback = "Failed to prepare payment.") {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

/**
 * Supports current flow:
 * createStripePaymentIntent("BOOKING_ID")
 *
 * Also supports new safer draft flow later:
 * createStripePaymentIntent({
 *   bookingId,
 *   draftId,
 *   checkoutDraftId,
 *   bookingData,
 *   bookingPayload,
 * })
 */
function normalizeStripeIntentPayload(input) {
  if (!input) {
    throw new Error("Booking ID or payment draft data is required.");
  }

  if (typeof input === "string") {
    return {
      bookingId: input,
    };
  }

  if (typeof input !== "object") {
    throw new Error("Invalid payment request.");
  }

  const payload = {};

  const bookingId =
    input.bookingId ||
    input.booking_id ||
    input.id ||
    input.booking_id_public ||
    "";

  const draftId =
    input.draftId ||
    input.draft_id ||
    input.checkoutDraftId ||
    input.checkout_draft_id ||
    "";

  if (bookingId) {
    payload.bookingId = bookingId;
  }

  if (draftId) {
    payload.draftId = draftId;
    payload.checkoutDraftId = draftId;
  }

  if (input.bookingData || input.booking_data) {
    payload.bookingData = input.bookingData || input.booking_data;
  }

  if (input.bookingPayload || input.booking_payload) {
    payload.bookingPayload = input.bookingPayload || input.booking_payload;
  }

  if (input.successUrl || input.success_url) {
    payload.successUrl = input.successUrl || input.success_url;
  }

  if (input.cancelUrl || input.cancel_url) {
    payload.cancelUrl = input.cancelUrl || input.cancel_url;
  }

  if (!payload.bookingId && !payload.draftId && !payload.bookingData && !payload.bookingPayload) {
    throw new Error("Booking ID or payment draft data is required.");
  }

  return payload;
}

const initialPaymentState = {
  clientSecret: null,
  customerSessionClientSecret: null,
  paymentIntentId: null,
  booking: null,
  savedPaymentMethods: [],
  loading: false,
  error: null,
};

const usePaymentStore = create((set) => ({
  ...initialPaymentState,

  createStripePaymentIntent: async (input) => {
    try {
      const payload = normalizeStripeIntentPayload(input);

      set({
        loading: true,
        error: null,
        clientSecret: null,
        customerSessionClientSecret: null,
        paymentIntentId: null,
        booking: null,
        savedPaymentMethods: [],
      });

      const res = await axios.post(
        `${apiBaseUrl}/payments/stripe/create-intent`,
        payload,
        {
          headers: buildAuthHeaders(),
        }
      );

      const data = res.data || {};

      if (!data.success && !data.clientSecret && !data.client_secret) {
        throw new Error(data.message || data.error || "Stripe payment was not prepared.");
      }

      set({
        clientSecret: data.clientSecret || data.client_secret || null,

        customerSessionClientSecret:
          data.customerSessionClientSecret ||
          data.customer_session_client_secret ||
          null,

        paymentIntentId:
          data.paymentIntentId ||
          data.payment_intent_id ||
          data.paymentIntent?.id ||
          null,

        booking:
          data.booking ||
          data.bookingPreview ||
          data.booking_preview ||
          data.data?.booking ||
          null,

        savedPaymentMethods:
          data.savedPaymentMethods ||
          data.saved_payment_methods ||
          data.paymentMethods ||
          data.payment_methods ||
          [],

        loading: false,
        error: null,
      });

      return data;
    } catch (error) {
      const message = getErrorMessage(error);

      set({
        clientSecret: null,
        customerSessionClientSecret: null,
        paymentIntentId: null,
        booking: null,
        savedPaymentMethods: [],
        error: message,
        loading: false,
      });

      const finalError = new Error(message);
      finalError.response = error?.response;
      finalError.status = error?.response?.status;
      finalError.data = error?.response?.data;

      throw finalError;
    }
  },

  resetPaymentState: () => {
    set({
      ...initialPaymentState,
    });
  },
}));

export default usePaymentStore;