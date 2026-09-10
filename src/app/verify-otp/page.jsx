import { Suspense } from "react";
import VerifyOtpPage from "../frontend/pages/verify-otp/Verify";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 px-4 py-20">
          <div className="mx-auto max-w-md rounded-2xl border bg-white p-8 shadow-sm">
            <p className="text-center text-sm text-gray-600">
              Loading verification page...
            </p>
          </div>
        </main>
      }
    >
      <VerifyOtpPage />
    </Suspense>
  );
}