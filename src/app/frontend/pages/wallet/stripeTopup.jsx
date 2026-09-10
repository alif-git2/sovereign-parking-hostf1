"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import axios from "@/app/frontend/utils/axios";

const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

function money(amount) {
  return `A$${Number(amount || 0).toFixed(2)}`;
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

function StripeTopupForm({ topupId, walletTransaction }) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!stripe || !elements || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setPaymentError("");

      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/customer/dashboard?walletTopup=stripe&topupId=${topupId}`,
        },
      });

      if (result.error) {
        setPaymentError(result.error.message || "Wallet top-up failed.");
        setSubmitting(false);
      }
    } catch (error) {
      setPaymentError(error.message || "Wallet top-up failed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />

      {paymentError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {paymentError}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? "Processing Top Up..."
          : `Top Up ${money(walletTransaction?.amount)} with Stripe`}
      </button>

      <button
        type="button"
        onClick={() => router.push("/customer/dashboard")}
        disabled={submitting}
        className="w-full rounded-lg border px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        Back to Dashboard
      </button>
    </form>
  );
}

export default function WalletStripeTopupPage({ topupId }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectStatus = searchParams.get("redirect_status");
  const stripePaymentIntent = searchParams.get("payment_intent");

  const [walletTransaction, setWalletTransaction] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pollCount, setPollCount] = useState(0);

  const loadStartedRef = useRef(false);

  function getAuthHeaders() {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    return token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};
  }

  useEffect(() => {
    let timeoutId;

    async function loadTopup() {
      try {
        if (!topupId) {
          throw new Error("Wallet top-up ID is missing.");
        }

        if (loadStartedRef.current && pollCount === 0) {
          return;
        }

        loadStartedRef.current = true;

        setLoading(true);
        setError("");

        const res = await axios.get(`/wallet/topup/stripe/${topupId}`, {
          headers: getAuthHeaders(),
        });

        if (!res.data.success) {
          throw new Error(
            res.data.message ||
              res.data.error ||
              "Failed to load wallet top-up."
          );
        }

        const data = res.data.data || {};

        setWalletTransaction(data.walletTransaction || null);
        setClientSecret(data.clientSecret || "");

        const transactionStatus = data.walletTransaction?.status;

        const shouldPollAgain =
          redirectStatus === "succeeded" &&
          transactionStatus === "pending" &&
          pollCount < 8;

        if (shouldPollAgain) {
          timeoutId = setTimeout(() => {
            setPollCount((prev) => prev + 1);
          }, 1500);
        }
      } catch (error) {
        setError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Failed to load wallet top-up."
        );
      } finally {
        setLoading(false);
      }
    }

    loadTopup();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [topupId, redirectStatus, pollCount]);

  const elementsOptions = useMemo(() => {
    if (!clientSecret) return null;

    return {
      clientSecret,
      appearance: {
        theme: "stripe",
      },
    };
  }, [clientSecret]);

  if (!stripePublishableKey || !stripePromise) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-bold text-red-800">
            Stripe publishable key missing
          </h1>

          <p className="mt-2 text-sm text-red-700">
            Please add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your environment
            variables.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">Loading Wallet Top Up...</h1>

          <p className="mt-2 text-sm text-gray-600">
            Please wait while we prepare your secure Stripe payment form.
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-bold text-red-800">
            Wallet top-up could not be loaded
          </h1>

          <p className="mt-2 text-sm text-red-700">{error}</p>

          <button
            type="button"
            onClick={() => router.push("/customer/dashboard")}
            className="mt-5 rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (walletTransaction?.status === "completed") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h1 className="text-2xl font-bold text-green-800">
            Wallet Top Up Successful
          </h1>

          <p className="mt-2 text-sm text-green-700">
            Your wallet has been topped up successfully.
          </p>

          <div className="mt-5 rounded-lg border border-green-200 bg-white p-4 text-sm text-green-800">
            <div className="flex justify-between">
              <span>Amount</span>
              <strong>{money(walletTransaction.amount)}</strong>
            </div>

            <div className="mt-2 flex justify-between">
              <span>Wallet Balance After</span>
              <strong>{money(walletTransaction.balance_after)}</strong>
            </div>
          </div>

          {stripePaymentIntent && (
            <p className="mt-3 text-xs text-green-700">
              Stripe Reference: {stripePaymentIntent}
            </p>
          )}

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

  if (walletTransaction?.status === "failed") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-2xl font-bold text-red-800">
            Wallet Top Up Failed
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {walletTransaction.failure_reason ||
              "Your Stripe wallet top-up could not be completed."}
          </p>

          <button
            type="button"
            onClick={() => router.push("/customer/dashboard")}
            className="mt-6 w-full rounded-lg bg-red-700 px-5 py-3 font-semibold text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

if (!clientSecret || !elementsOptions) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">
          Preparing Secure Stripe Payment...
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Please wait while we load your wallet top-up payment form.
        </p>

        {walletTransaction && (
          <div className="mt-5 rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Reference</span>
              <strong>{walletTransaction.transaction_reference || "-"}</strong>
            </div>

            <div className="mt-2 flex justify-between">
              <span>Amount</span>
              <strong>{money(walletTransaction.amount)}</strong>
            </div>

            <div className="mt-2 flex justify-between">
              <span>Status</span>
              <strong>{formatStatus(walletTransaction.status)}</strong>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push("/customer/dashboard")}
          className="mt-5 rounded-lg border px-5 py-3 text-sm font-semibold"
        >
          Back to Dashboard
        </button>
      </div>
    </main>
  );
}

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Top Up Wallet</h1>

        <p className="mt-2 text-sm text-gray-600">
          Add money to your wallet securely using Stripe.
        </p>
      </div>

      {walletTransaction && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Top Up Summary</h2>

          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between gap-4">
              <span>Reference</span>
              <strong>{walletTransaction.transaction_reference || "-"}</strong>
            </div>

            <div className="flex justify-between gap-4">
              <span>Amount</span>
              <strong>{money(walletTransaction.amount)}</strong>
            </div>

        
          </div>
        </div>
      )}

      {redirectStatus === "succeeded" &&
        walletTransaction?.status === "pending" && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            Stripe payment was submitted. Waiting for webhook confirmation to
            update your wallet balance.
          </div>
        )}

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <Elements stripe={stripePromise} options={elementsOptions}>
          <StripeTopupForm
            topupId={topupId}
            walletTransaction={walletTransaction}
          />
        </Elements>
      </div>
    </main>
  );
}