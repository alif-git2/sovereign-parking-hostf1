import BookingPayPalPage from "@/app/frontend/pages/booking/paypal";

export default async function PayPalPaymentRoute({ params }) {
  const { bookingId } = await params;

  return <BookingPayPalPage bookingId={bookingId} />;
}