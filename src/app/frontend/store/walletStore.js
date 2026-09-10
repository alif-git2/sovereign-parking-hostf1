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

const useWalletStore = create((set, get) => ({
  wallet: null,
  walletTransactions: [],
  recentTransactions: [],
  user: null,

  loading: false,
  transactionLoading: false,
  topupLoading: false,

  error: null,
  topupError: null,

  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },

  fetchWallet: async () => {
    try {
      set({
        loading: true,
        error: null,
      });

      const res = await axios.get("/wallet/me", {
        headers: getAuthHeaders(),
      });

      if (!res.data.success) {
        throw new Error(
          res.data.message || res.data.error || "Failed to load wallet."
        );
      }

      const data = res.data.data || {};

      set({
        wallet: data.wallet || null,
        user: data.user || null,
        recentTransactions: data.recentTransactions || [],
        loading: false,
        error: null,
      });

      return data;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to load wallet.";

      set({
        loading: false,
        error: message,
      });

      throw new Error(message);
    }
  },

  fetchTransactions: async ({
    page = 1,
    limit = 20,
    type = "",
    status = "",
  } = {}) => {
    try {
      set({
        transactionLoading: true,
        error: null,
      });

      const params = new URLSearchParams();

      params.set("page", String(page));
      params.set("limit", String(limit));

      if (type) {
        params.set("type", type);
      }

      if (status) {
        params.set("status", status);
      }

      const res = await axios.get(`/wallet/transactions?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (!res.data.success) {
        throw new Error(
          res.data.message ||
            res.data.error ||
            "Failed to load wallet transactions."
        );
      }

      const data = res.data.data || {};

      set({
        walletTransactions: data.transactions || [],
        wallet: data.wallet || get().wallet,
        pagination: data.pagination || get().pagination,
        transactionLoading: false,
        error: null,
      });

      return data;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to load wallet transactions.";

      set({
        transactionLoading: false,
        error: message,
      });

      throw new Error(message);
    }
  },

  createStripeTopup: async (amount) => {
    try {
      set({
        topupLoading: true,
        topupError: null,
      });

      const res = await axios.post(
        "/wallet/topup/stripe/create-intent",
        { amount },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data.success) {
        throw new Error(
          res.data.message ||
            res.data.error ||
            "Failed to create Stripe wallet top-up."
        );
      }

      set({
        topupLoading: false,
        topupError: null,
      });

      return res.data;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create Stripe wallet top-up.";

      set({
        topupLoading: false,
        topupError: message,
      });

      throw new Error(message);
    }
  },

  createPaypalTopup: async (amount) => {
    try {
      set({
        topupLoading: true,
        topupError: null,
      });

      const res = await axios.post(
        "/wallet/topup/paypal/create-order",
        { amount },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data.success) {
        throw new Error(
          res.data.message ||
            res.data.error ||
            "Failed to create PayPal wallet top-up."
        );
      }

      set({
        topupLoading: false,
        topupError: null,
      });

      return res.data;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create PayPal wallet top-up.";

      set({
        topupLoading: false,
        topupError: message,
      });

      throw new Error(message);
    }
  },

  capturePaypalTopup: async ({ topupId, orderId, payerId }) => {
    try {
      set({
        topupLoading: true,
        topupError: null,
      });

      const res = await axios.post(
        "/wallet/topup/paypal/capture-order",
        {
          topupId,
          orderId,
          payerId,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data.success) {
        throw new Error(
          res.data.message ||
            res.data.error ||
            "Failed to capture PayPal wallet top-up."
        );
      }

      const data = res.data.data || {};

      set({
        wallet: data.wallet || get().wallet,
        topupLoading: false,
        topupError: null,
      });

      return res.data;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to capture PayPal wallet top-up.";

      set({
        topupLoading: false,
        topupError: message,
      });

      throw new Error(message);
    }
  },

  clearWalletError: () => {
    set({
      error: null,
      topupError: null,
    });
  },

  clearWalletState: () => {
    set({
      wallet: null,
      walletTransactions: [],
      recentTransactions: [],
      user: null,
      loading: false,
      transactionLoading: false,
      topupLoading: false,
      error: null,
      topupError: null,
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  },
}));

export default useWalletStore;