"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

export default function AdminForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setDevResetUrl("");

      const cleanEmail = String(email || "").trim().toLowerCase();

      if (!cleanEmail) {
        throw new Error("Email is required.");
      }

      const res = await axios.post("/admin/forgot-password", {
        email: cleanEmail,
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Password reset request failed."
        );
      }

      setSuccess(
        res.data.message ||
          "If an admin or manager account exists with this email, a password reset link has been sent."
      );

      if (res.data.data?.reset_url) {
        setDevResetUrl(res.data.data.reset_url);
      }
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Password reset request failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Reset Admin Password
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Enter your admin or manager email. We will send a password reset
            link if the account exists.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {devResetUrl && (
          <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            <p className="font-bold">Development reset URL:</p>
            <p className="mt-1 break-all">{devResetUrl}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Admin / Manager Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
                setSuccess("");
                setDevResetUrl("");
              }}
              placeholder="admin@example.com"
              className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-600"
              autoComplete="email"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push("/admin/login")}
          className="mt-4 w-full rounded-lg border px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Back to Admin Login
        </button>
      </section>
    </main>
  );
}