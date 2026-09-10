import { create } from "zustand";
import axios from "@/app/frontend/utils/axios";

function getAuthHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function getErrorMessage(error, fallback = "Booking failed") {
  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    fallback
  );
}

export const useBookingStore = create((set) => ({
  booking: null,
  bookingResponse: null,
  loading: false,
  error: null,

  createBooking: async (bookingData) => {
    try {
      set({
        loading: true,
        error: null,
      });

      const res = await axios.post("/bookings", bookingData, {
        headers: getAuthHeaders(),
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Booking failed"
        );
      }

      const response = res.data;
      const booking = response.data || response.booking || null;

      set({
        booking,
        bookingResponse: response,
        loading: false,
        error: null,
      });

      /**
       * Return full backend response.
       *
       * Booking pages need:
       * - response.redirectUrl
       * - response.paymentRequired
       * - response.provider
       * - response.data
       * - response.booking
       *
       * This supports:
       * - Stripe redirect
       * - PayPal redirect
       * - Wallet instant success
       * - POA deposit redirect
       */
      return response;
    } catch (error) {
      const message = getErrorMessage(error);

      set({
        booking: null,
        bookingResponse: null,
        loading: false,
        error: message,
      });

      throw new Error(message);
    }
  },

  clearBookingError: () => {
    set({
      error: null,
    });
  },

  clearBooking: () => {
    set({
      booking: null,
      bookingResponse: null,
      loading: false,
      error: null,
    });
  },
}));