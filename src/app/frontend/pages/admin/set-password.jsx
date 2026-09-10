"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const passwordRules =
  "Password must be at least 8 characters and include uppercase, lowercase, number, special character, and no spaces.";

function getRoleLabel(role) {
  if (role === "manager") return "Manager";
  if (role === "admin") return "Admin";
  return "Admin";
}

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

function AdminSetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(() => {
    return searchParams.get("token") || "";
  }, [searchParams]);

  const [mounted, setMounted] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [setupUser, setSetupUser] = useState(null);

  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const roleLabel = getRoleLabel(setupUser?.role);
  const pageTitle = `Set ${roleLabel} Password`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function checkSetupToken() {
      try {
        setCheckingToken(true);
        setError("");

        if (!token) {
          throw new Error("Password setup token is missing.");
        }

        const res = await axios.get("/auth/password-setup-info", {
          params: {
            token,
          },
        });

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
              res.data?.error ||
              "Password setup link check failed."
          );
        }

        const user = res.data.data || null;

        if (!["admin", "manager"].includes(user?.role)) {
          throw new Error("This password setup link is not for admin login.");
        }

        setSetupUser(user);
      } catch (error) {
        setSetupUser(null);
        setError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Password setup link check failed."
        );
      } finally {
        setCheckingToken(false);
      }
    }

    if (mounted) {
      checkSetupToken();
    }
  }, [mounted, token]);

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      if (!token) {
        throw new Error("Password setup token is missing.");
      }

      if (!form.password) {
        throw new Error("Password is required.");
      }

      if (form.password !== form.confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const res = await axios.post("/auth/set-password", {
        token,
        password: form.password,
      });

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Password setup failed."
        );
      }

      const userRole = res.data.data?.role;

      if (!["admin", "manager"].includes(userRole)) {
        throw new Error("This password setup link is not for admin login.");
      }

      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      setSuccess("Password set successfully. Redirecting to admin login...");

      setTimeout(() => {
        router.replace("/admin/login");
      }, 900);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Password setup failed."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl">
        <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-8 py-8 text-white">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute bottom-0 right-16 h-20 w-20 rounded-full bg-white/10" />

          <div className="relative text-center">
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight">
              {checkingToken ? "Checking Link..." : pageTitle}
            </h1>

            <p className="mt-2 text-sm text-blue-100">
              Create your password to access the admin panel.
            </p>
          </div>
        </div>

        <div className="p-8">
          {checkingToken && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
              Checking your password setup link...
            </div>
          )}

          {!checkingToken && setupUser && (
            <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                Account
              </p>

              <p className="mt-2 font-bold text-gray-950">
                {setupUser.name || roleLabel}
              </p>

              <p className="mt-1 break-all text-sm text-gray-600">
                {setupUser.email}
              </p>

              <p className="mt-2 text-sm font-semibold text-blue-700">
                Role: {roleLabel}
              </p>
            </div>
          )}

          {!token && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              Password setup token is missing. Please open the link from your
              email.
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-bold text-gray-700">
                New Password
              </label>

              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                  placeholder="Enter new password"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  autoComplete="new-password"
                  disabled={checkingToken || !setupUser || loading}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={checkingToken || !setupUser || loading}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>

              <p className="mt-2 text-xs leading-5 text-gray-500">
                {passwordRules}
              </p>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700">
                Confirm Password
              </label>

              <div className="relative mt-2">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(event) =>
                    updateField("confirmPassword", event.target.value)
                  }
                  placeholder="Confirm new password"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  autoComplete="new-password"
                  disabled={checkingToken || !setupUser || loading}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  disabled={checkingToken || !setupUser || loading}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || checkingToken || !setupUser || !token}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving Password..." : "Set Password"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push("/admin/login")}
            className="mt-4 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            Back to Admin Login
          </button>
        </div>
      </section>
    </main>
  );
}

export default function AdminSetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminSetPasswordContent />
    </Suspense>
  );
}