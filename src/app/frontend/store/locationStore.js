import { create } from "zustand";
import axios from "@/app/frontend/utils/axios";

export const useLocationStore = create((set) => ({
  locations: [],
  loading: false,
  error: null,

  fetchLocations: async (type) => {
    try {
      set({ loading: true, error: null });

      const res = await axios.get(`/locations?type=${type}`);

      if (!res.data.success) {
        throw new Error(res.data.error || "Failed to fetch locations");
      }

      set({
        locations: res.data.data,
        loading: false,
        error: null,
      });

      return res.data.data;
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch locations";

      set({
        loading: false,
        error: message,
      });

      throw new Error(message);
    }
  },
}));