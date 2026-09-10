import BookingPaymentPage from "@/app/frontend/pages/booking/payment";

export default async function Page({ params }) {
  const resolvedParams = await params;
  const bookingId = resolvedParams?.bookingId;

  return <BookingPaymentPage bookingId={bookingId} />;
}