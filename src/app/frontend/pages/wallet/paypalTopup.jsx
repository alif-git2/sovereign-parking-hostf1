"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

function money(amount) {
  return `A$ ${Number(amount || 0).toFixed(2)}`;
}

function formatStatus(status) {
  if (!status) return "-";

  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusClass(status) {
  if (status === "completed") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (status === "pending") {
    return "border-yellow-200 bg-yellow-50 text-yellow-800";
  }

  if (["failed", "cancelled", "reversed"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
}

function getAuthHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function getCaptureKey({ topupId, paypalOrderId }) {
  return `paypal-wallet-topup:${topupId}:${paypalOrderId}`;
}

function getCaptureStore() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!window.__paypalWalletTopupCaptures) {
    window.__paypalWalletTopupCaptures = {};
  }

  return window.__paypalWalletTopupCaptures;
}

async function capturePayPalWalletTopupRequest({ topupId, paypalOrderId, payerId }) {
  const res = await axios.post(
    "/wallet/topup/paypal/capture-order",
    {
      topupId,
      orderId: paypalOrderId,
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

  return res.data;
}

async function capturePayPalWalletTopupOnce({
  topupId,
  paypalOrderId,
  payerId,
}) {
  const captureKey = getCaptureKey({ topupId, paypalOrderId });
  const captureStore = getCaptureStore();

  if (!captureStore) {
    return await capturePayPalWalletTopupRequest({
      topupId,
      paypalOrderId,
      payerId,
    });
  }

  if (captureStore[captureKey]?.status === "success") {
    return captureStore[captureKey].response;
  }

  if (captureStore[captureKey]?.status === "pending") {
    return await captureStore[captureKey].promise;
  }

  const promise = capturePayPalWalletTopupRequest({
    topupId,
    paypalOrderId,
    payerId,
  })
    .then((response) => {
      captureStore[captureKey] = {
        status: "success",
        response,
      };

      return response;
    })
    .catch((error) => {
      delete captureStore[captureKey];
      throw error;
    });

  captureStore[captureKey] = {
    status: "pending",
    promise,
  };

  return await promise;
}

export default function WalletPayPalTopupPage({ topupId }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paypalOrderId = searchParams.get("token");
  const payerId = searchParams.get("PayerID");

  const [walletTransaction, setWalletTransaction] = useState(null);
  const [payment, setPayment] = useState(null);
  const [wallet, setWallet] = useState(null);

  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function capturePayPalTopup() {
      try {
        if (!topupId) {
          throw new Error("Wallet top-up ID is missing.");
        }

        if (!paypalOrderId) {
          throw new Error("PayPal order ID is missing.");
        }

        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        if (!token) {
          router.push("/login");
          return;
        }

        setLoading(true);
        setCapturing(true);
        setError("");

        const response = await capturePayPalWalletTopupOnce({
          topupId,
          paypalOrderId,
          payerId,
        });

        if (cancelled) return;

        const data = response.data || {};

        setWalletTransaction(data.walletTransaction || null);
        setPayment(data.payment || null);
        setWallet(data.wallet || null);
      } catch (error) {
        if (cancelled) return;

        setError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Failed to capture PayPal wallet top-up."
        );
      } finally {
        if (!cancelled) {
          setCapturing(false);
          setLoading(false);
        }
      }
    }

    capturePayPalTopup();

    return () => {
      cancelled = true;
    };
  }, [topupId, paypalOrderId, payerId, router]);

  if (loading || capturing) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Completing PayPal Top Up...</h1>

          <p className="mt-2 text-sm text-gray-600">
            Please wait while we confirm your PayPal payment and update your
            wallet balance.
          </p>

          {paypalOrderId && (
            <p className="mt-3 text-xs text-gray-400">
              PayPal Order: {paypalOrderId}
            </p>
          )}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-2xl font-bold text-red-800">
            PayPal Wallet Top Up Failed
          </h1>

          <p className="mt-2 text-sm text-red-700">{error}</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/customer/dashboard")}
              className="rounded-lg bg-red-700 px-5 py-3 font-semibold text-white"
            >
              Back to Dashboard
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-red-700 px-5 py-3 font-semibold text-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-xl border border-green-200 bg-green-50 p-6">
        <h1 className="text-2xl font-bold text-green-800">
          Wallet Top Up Successful
        </h1>

        <p className="mt-2 text-sm text-green-700">
          Your PayPal payment has been confirmed and your wallet balance has
          been updated.
        </p>

        <div className="mt-6 rounded-lg border border-green-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-green-900">
            Top Up Summary
          </h2>

          <div className="mt-4 space-y-3 text-sm text-green-900">
            <div className="flex justify-between gap-4">
              <span>Reference</span>
              <strong>{walletTransaction?.transaction_reference || "-"}</strong>
            </div>

            <div className="flex justify-between gap-4">
              <span>Amount</span>
              <strong>{money(walletTransaction?.amount)}</strong>
            </div>

            <div className="flex justify-between gap-4">
              <span>Status</span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                  walletTransaction?.status
                )}`}
              >
                {formatStatus(walletTransaction?.status)}
              </span>
            </div>

            <div className="flex justify-between gap-4 border-t pt-3">
              <span>Wallet Balance</span>
              <strong>{money(wallet?.balance)}</strong>
            </div>

            {payment?.provider_order_id && (
              <div className="flex justify-between gap-4">
                <span>PayPal Order</span>
                <strong className="break-all text-right text-xs">
                  {payment.provider_order_id}
                </strong>
              </div>
            )}

            {payment?.provider_capture_id && (
              <div className="flex justify-between gap-4">
                <span>PayPal Capture</span>
                <strong className="break-all text-right text-xs">
                  {payment.provider_capture_id}
                </strong>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/customer/dashboard")}
          className="mt-6 w-full rounded-lg bg-green-700 px-5 py-3 font-semibold text-white"
        >
          Back to Dashboard
        </button>
      </div>
    </main>
  );
}