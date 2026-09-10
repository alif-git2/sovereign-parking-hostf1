import { Suspense } from "react";
import BookingSuccessPage from "@/app/frontend/pages/booking/success";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BookingSuccessPage />
    </Suspense>
  );
}