"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

function EyeIcon({ open = false }) {
  if (open) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3l18 18M10.584 10.587A2 2 0 0012 14a2 2 0 001.414-.586M9.88 4.24A10.94 10.94 0 0112 4c5.523 0 10 5 10 8a8.67 8.67 0 01-2.022 3.592M6.228 6.228C3.682 7.92 2 10.344 2 12c0 3 4.477 8 10 8a10.97 10.97 0 004.772-1.09"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("adminToken")
        : null;

    if (token) {
      router.replace("/admin/dashboard");
    }
  }, [router]);

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const email = String(form.email || "").trim().toLowerCase();
      const password = String(form.password || "");

      if (!email || !password) {
        throw new Error("Email and password are required.");
      }

      const res = await axios.post("/admin/login", {
        email,
        password,
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Admin login failed."
        );
      }

      if (!["admin", "manager"].includes(res.data?.data?.role)) {
        throw new Error("Admin access required.");
      }

      localStorage.setItem("adminToken", res.data.token);
      localStorage.setItem("adminUser", JSON.stringify(res.data.data));

      router.replace("/admin/dashboard");
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Admin login failed.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Admin Login</h1>

          <p className="mt-2 text-sm text-gray-600">
            Sign in to manage bookings, payments, wallets, and settings.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Email
            </label>

            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="admin@example.com"
              className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-600"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              Password
            </label>

            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
                placeholder="Enter password"
                className="w-full rounded-lg border px-4 py-3 pr-12 outline-none focus:border-blue-600"
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => router.push("/admin/forgot-password")}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login to Admin Dashboard"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          Admin and manager accounts only.
        </p>
      </section>
    </main>
  );
}