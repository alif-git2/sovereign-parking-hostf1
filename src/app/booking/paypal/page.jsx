// src/app/booking/paypal/page.jsx

import { Suspense } from "react";
import PaypalPaymentPage from "@/app/frontend/pages/booking/paypal";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm font-semibold text-gray-600">
            Loading PayPal payment page...
          </p>
        </main>
      }
    >
      <PaypalPaymentPage />
    </Suspense>
  );
}