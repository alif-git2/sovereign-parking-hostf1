// src/app/booking/payment/page.jsx

import { Suspense } from "react";
import BookingPaymentPage from "@/app/frontend/pages/booking/payment";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm font-semibold text-gray-600">
            Loading payment page...
          </p>
        </main>
      }
    >
      <BookingPaymentPage />
    </Suspense>
  );
}