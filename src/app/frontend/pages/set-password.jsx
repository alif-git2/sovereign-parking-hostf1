"use client";

import { useMemo, useState } from "react";
import axios from "@/app/frontend/utils/axios";
import { useRouter, useSearchParams } from "next/navigation";

function EyeIcon() {
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
        d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5z"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.58 10.58A2 2 0 0 0 13.42 13.42"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.88 5.33A9.77 9.77 0 0 1 12 5.1c6 0 9.75 6.9 9.75 6.9a18.1 18.1 0 0 1-3.16 3.83"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.11 6.86C3.63 8.58 2.25 12 2.25 12s3.75 6.9 9.75 6.9a9.62 9.62 0 0 0 4.16-.95"
      />
    </svg>
  );
}

function getPasswordStrength(password) {
  const checks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    noSpaces: !/\s/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  let label = "Very weak";
  let barClass = "bg-red-500";
  let textClass = "text-red-600";
  let width = "15%";

  if (score >= 3) {
    label = "Weak";
    barClass = "bg-orange-500";
    textClass = "text-orange-600";
    width = "40%";
  }

  if (score >= 5) {
    label = "Good";
    barClass = "bg-yellow-500";
    textClass = "text-yellow-600";
    width = "70%";
  }

  if (score === 6) {
    label = "Strong";
    barClass = "bg-green-600";
    textClass = "text-green-600";
    width = "100%";
  }

  return {
    checks,
    score,
    label,
    barClass,
    textClass,
    width,
    isStrong: score === 6,
  };
}

export default function SetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const passwordStrength = useMemo(() => {
    return getPasswordStrength(password);
  }, [password]);

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const canSubmit = Boolean(
    token && passwordStrength.isStrong && passwordsMatch && !loading
  );

  function getPasswordHelpText() {
    const { checks } = passwordStrength;

    if (!password) {
      return "Use 8+ characters with uppercase, lowercase, number, and symbol.";
    }

    if (!checks.minLength) {
      return "Password must be at least 8 characters.";
    }

    if (!checks.uppercase) {
      return "Add at least one uppercase letter.";
    }

    if (!checks.lowercase) {
      return "Add at least one lowercase letter.";
    }

    if (!checks.number) {
      return "Add at least one number.";
    }

    if (!checks.special) {
      return "Add at least one special character.";
    }

    if (!checks.noSpaces) {
      return "Password cannot contain spaces.";
    }

    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      if (!token) {
        throw new Error("Invalid password setup link");
      }

      if (!passwordStrength.isStrong) {
        throw new Error(
          "Password must be at least 8 characters and include uppercase, lowercase, number, special character, and no spaces."
        );
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      setLoading(true);

      const res = await axios.post("/auth/set-password", {
        token,
        password,
      });

      if (!res.data.success) {
        throw new Error(res.data.error || "Failed to set password");
      }

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.data));

      alert("Password set successfully. Please login.");
      router.push("/login");
    } catch (error) {
      alert(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-20">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-md rounded-2xl border bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-gray-900">Set Password</h1>

        <p className="mt-2 text-sm text-gray-600">
          Create a secure password so you can login and manage your bookings.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              New Password
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border p-3 pr-12"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full transition-all ${passwordStrength.barClass}`}
                  style={{ width: password ? passwordStrength.width : "0%" }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-sm">
                <span className={passwordStrength.textClass}>
                  {password ? passwordStrength.label : "Password strength"}
                </span>

                <span className="text-gray-500">
                  {password.length}/8 minimum
                </span>
              </div>

              <p className={`mt-1 text-sm ${passwordStrength.textClass}`}>
                {getPasswordHelpText()}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Confirm Password
            </label>

            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border p-3 pr-12"
                required
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            {confirmPassword && (
              <p
                className={`mt-1 text-sm ${
                  passwordsMatch ? "text-green-600" : "text-red-600"
                }`}
              >
                {passwordsMatch ? "Passwords match." : "Passwords do not match."}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving..." : "Set Password"}
          </button>
        </div>
      </form>
    </main>
  );
}