import { create } from "zustand";
import axios from "@/app/frontend/utils/axios";

export const useCouponStore = create((set) => ({
  coupon: null,
  loading: false,
  error: null,

  validateCoupon: async ({ code, booking_type, amount }) => {
    try {
      set({
        loading: true,
        error: null,
        coupon: null,
      });

      if (!code) {
        throw new Error("Please enter coupon code");
      }

      if (!booking_type) {
        throw new Error("Booking type is required");
      }

      if (!amount || Number(amount) <= 0) {
        throw new Error("Booking amount is required");
      }

      const res = await axios.post("/coupons/validate", {
        code,
        booking_type,
        amount: Number(amount),
      });

      if (!res.data.success) {
        throw new Error(res.data.error || "Invalid coupon");
      }

      set({
        coupon: res.data.data,
        loading: false,
        error: null,
      });

      return res.data.data;
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Coupon validation failed";

      set({
        coupon: null,
        loading: false,
        error: message,
      });

      throw new Error(message);
    }
  },

  clearCoupon: () => {
    set({
      coupon: null,
      error: null,
      loading: false,
    });
  },
}));