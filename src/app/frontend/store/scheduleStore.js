import { create } from "zustand";
import axios from "@/app/frontend/utils/axios";

const SCHEDULE_CACHE_TTL_MS = 60 * 1000;

export const useScheduleStore = create((set, get) => ({
  schedules: [],
  loading: false,
  loaded: false,
  error: null,
  lastFetchedAt: 0,

  fetchSchedules: async ({ force = false } = {}) => {
    const state = get();
    const cacheIsFresh =
      state.loaded &&
      state.lastFetchedAt > 0 &&
      Date.now() - state.lastFetchedAt < SCHEDULE_CACHE_TTL_MS;

    if (!force && cacheIsFresh) {
      return state.schedules;
    }

    if (state.loading) {
      return state.schedules;
    }

    try {
      // Keep any cached schedules visible while refreshing in the background.
      set({ loading: true, error: null });

      const res = await axios.get("/cruise-schedules", {
        params: {
          summary: true,
        },
      });

      if (!res.data.success) {
        throw new Error(res.data.error || "Failed to fetch cruise schedules");
      }

      const schedules = Array.isArray(res.data.data) ? res.data.data : [];

      set({
        schedules,
        loading: false,
        loaded: true,
        error: null,
        lastFetchedAt: Date.now(),
      });

      return schedules;
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch cruise schedules";

      set({
        loading: false,
        loaded: true,
        error: message,
      });

      throw new Error(message);
    }
  },
}));
