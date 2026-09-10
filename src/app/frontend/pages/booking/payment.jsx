"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CircleAlert, LoaderCircle } from "lucide-react";

import usePaymentStore from "../../store/paymentStore";
import BoxCard from "../../component/global/BoxCard";
import Div from "../../component/global/Div";
import NavigationButton from "../../component/global/NavigationButton";

const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

function money(amount) {
  return `A$ ${Number(amount || 0).toFixed(2)}`;
}

function isPoaDepositBooking(booking) {
  return (
    booking?.payment_flow === "poa_deposit" ||
    booking?.deposit_type === "poa"
  );
}

function getBookingTotal(booking) {
  return Number(
    booking?.price ||
      booking?.total_amount ||
      booking?.booking_total_amount ||
      0
  );
}

function getHoldingDeposit(booking) {
  if (!isPoaDepositBooking(booking)) return 0;

  return Number(
    booking?.holding_deposit_amount ||
      booking?.due_amount ||
      booking?.paid_amount ||
      0
  );
}

function getBalanceDueOnArrival(booking) {
  if (!isPoaDepositBooking(booking)) return 0;

  if (
    booking?.balance_due_on_arrival !== undefined &&
    booking?.balance_due_on_arrival !== null
  ) {
    return Number(booking.balance_due_on_arrival || 0);
  }

  const bookingTotal = getBookingTotal(booking);
  const holdingDeposit = getHoldingDeposit(booking);

  return Math.max(bookingTotal - holdingDeposit, 0);
}

function getAmountPayingNow(booking) {
  if (isPoaDepositBooking(booking)) {
    return Number(booking?.due_amount || getHoldingDeposit(booking) || 0);
  }

  return Number(booking?.due_amount || booking?.price || 0);
}

function getPaymentTitle(booking) {
  if (isPoaDepositBooking(booking)) {
    return "Pay Holding Deposit";
  }

  return "Complete Your Payment";
}

function getSubmitButtonText({ booking, submitting }) {
  if (submitting) {
    return "Processing Payment...";
  }

  if (isPoaDepositBooking(booking)) {
    return `Pay ${money(getAmountPayingNow(booking))} Holding Deposit`;
  }

  return `Pay ${money(getAmountPayingNow(booking))} Now`;
}

function canShowViewBookingButton({ booking, error }) {
  if (!booking?.booking_id) return false;

  const errorText = String(error || "").toLowerCase();

  if (
    errorText.includes("payment must be completed before") ||
    errorText.includes("booking is created") ||
    errorText.includes("online_payment_required_before_booking_create")
  ) {
    return false;
  }

  return true;
}

function StripeCheckoutForm({ bookingId, draftId, booking }) {
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!stripe || !elements || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setPaymentError("");

const publicBookingId = booking?.booking_id || bookingId;

if (!draftId && !publicBookingId) {
  throw new Error("Booking reference is missing.");
}

const successParams = new URLSearchParams();

if (draftId) {
  successParams.set("draftId", draftId);
} else {
  successParams.set("bookingId", publicBookingId);
}

const result = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: `${window.location.origin}/booking/success?${successParams.toString()}`,
  },
});
      if (result.error) {
        setPaymentError(result.error.message || "Payment failed.");
        setSubmitting(false);
      }
    } catch (error) {
      setPaymentError(error.message || "Payment failed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />

      {paymentError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {paymentError}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {getSubmitButtonText({ booking, submitting })}
      </button>
    </form>
  );
}

export default function BookingPaymentPage({ bookingId }) {
  const router = useRouter();
  const searchParams = useSearchParams();

const draftId =
  searchParams.get("draftId") ||
  searchParams.get("draft_id") ||
  searchParams.get("checkoutDraftId") ||
  searchParams.get("checkout_draft_id") ||
  "";

const paymentBookingId =
  bookingId ||
  searchParams.get("bookingId") ||
  searchParams.get("booking_id") ||
  searchParams.get("id") ||
  "";

  const {
    clientSecret,
    customerSessionClientSecret,
    booking,
    loading,
    error,
    createStripePaymentIntent,
  } = usePaymentStore();

  const [initializing, setInitializing] = useState(true);

  /**
   * Prevent duplicate PaymentIntent creation in development.
   * React Strict Mode can run useEffect twice.
   */
  const prepareStartedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function preparePayment() {
      try {
       if (!paymentBookingId && !draftId) {
  throw new Error("Booking ID or checkout draft ID is missing.");
}

        if (prepareStartedRef.current) {
          return;
        }

        prepareStartedRef.current = true;

        usePaymentStore.setState({
          clientSecret: null,
          customerSessionClientSecret: null,
          paymentIntentId: null,
          booking: null,
          savedPaymentMethods: [],
          error: null,
          loading: true,
        });

     const preparedPayment = await createStripePaymentIntent(
  draftId ? { draftId } : paymentBookingId
);

        if (preparedPayment?.alreadyPaid && preparedPayment?.redirectUrl) {
          router.replace(preparedPayment.redirectUrl);
          return;
        }
      } catch (error) {
        console.error("Payment preparation failed:", error);

        if (mounted) {
          usePaymentStore.setState({
            clientSecret: null,
            customerSessionClientSecret: null,
            paymentIntentId: null,
            booking: null,
            savedPaymentMethods: [],
            error: error.message || "Payment could not be prepared.",
            loading: false,
          });
        }
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    }

    preparePayment();

    return () => {
      mounted = false;
    };
}, [paymentBookingId, draftId, createStripePaymentIntent, router]);

  const elementsOptions = useMemo(() => {
    if (!clientSecret) return null;

    const options = {
      clientSecret,
      appearance: {
        theme: "stripe",
      },
    };

    if (customerSessionClientSecret) {
      options.customerSessionClientSecret = customerSessionClientSecret;
    }

    return options;
  }, [clientSecret, customerSessionClientSecret]);

  const poaDeposit = isPoaDepositBooking(booking);
  const bookingTotal = getBookingTotal(booking);
  const holdingDeposit = getHoldingDeposit(booking);
  const balanceDueOnArrival = getBalanceDueOnArrival(booking);
  const amountPayingNow = getAmountPayingNow(booking);

  if (!stripePublishableKey || !stripePromise) {
    return (
      <main className="mx-auto w-full md:max-w-2xl">
        <BoxCard padding="p-2 md:p-4">
          <div className="mb-5 w-full rounded-lg border border-red-200 bg-red-50 p-6">
            <h1 className="text-xl font-semibold text-red-800">
              Stripe publishable key missing
            </h1>

            <p className="mt-2 w-full text-sm text-red-700">
              Please add{" "}
              <span className="text-[11px] sm:text-[14px]">
                NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
              </span>{" "}
              to your environment variables.
            </p>
          </div>

          <NavigationButton
            onClick={() => router.back()}
            text="Go back"
            direction="reverse"
          />
        </BoxCard>
      </main>
    );
  }

  if (initializing || loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-12">
        <BoxCard>
          <div className="w-full rounded-2xl p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                <LoaderCircle className="h-8 w-8 animate-spin text-blue-600" />
              </div>

              <h1 className="mt-5 text-2xl font-bold text-gray-900">
                Preparing Payment...
              </h1>

              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                Please wait while we securely prepare your payment form and
                booking details.
              </p>
            </div>
          </div>
        </BoxCard>
      </main>
    );
  }

  if (error) {
    const showViewBooking = canShowViewBookingButton({
      booking,
      error,
    });

    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-8">
        <BoxCard padding="p-1 md:p-3">
          <div className="w-full overflow-hidden">
            <div className="bg-red-50 px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <CircleAlert className="h-6 w-6 text-red-600" />
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-red-700">
                    Payment could not be prepared
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-red-600">
                    Something went wrong while preparing your secure payment
                    session.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-5">
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-4">
                <p className="text-sm leading-6 text-red-700">{error}</p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-700"
                >
                  Go Back
                </button>

                {showViewBooking && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/booking/success?bookingId=${booking.booking_id}`
                      )
                    }
                    className="flex-1 rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition-all duration-200 hover:bg-red-50"
                  >
                    View Booking
                  </button>
                )}
              </div>
            </div>
          </div>
        </BoxCard>
      </main>
    );
  }

  if (!clientSecret || !elementsOptions) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h1 className="text-xl font-semibold text-yellow-900">
            Payment is not ready
          </h1>

          <p className="mt-2 text-sm text-yellow-800">
            No payment session was created for this booking.
          </p>

          <button
            type="button"
            onClick={() => router.back()}
            className="mt-5 rounded-xl border border-yellow-300 bg-white px-4 py-2 text-sm font-semibold text-yellow-900"
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <Div isPadding={false}>
          <div className="w-full bg-violet-600 p-2 text-white md:p-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {getPaymentTitle(booking)}
            </h1>

            <p className="mt-2 text-sm">Secure checkout powered by Stripe</p>
          </div>
        </Div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[420px_1fr]">
          {booking && (
            <BoxCard padding="p-2 md:p-4">
              <div>
                <div className="mb-2 rounded-lg bg-violet-400 px-5 py-4">
                  <h2 className="text-lg font-semibold text-white">
                    Booking Summary
                  </h2>

                  <p className="mt-1 text-xs text-blue-100">
                    Review your booking payment details
                  </p>
                </div>

                <div className="mt-2 space-y-5">
                  <div className="rounded-xl bg-gray-50 p-4">
                    {/* <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                     <div className="flex items-center justify-between pt-3">
                      <span className="text-sm text-gray-500">
                        Payment Method
                      </span>

                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />

                        <span className="font-medium text-gray-900">
                          Stripe
                        </span>
                      </div>
                    </div>
                    </div> */}

                    <div className="flex items-center justify-between pt-3">
                      <span className="text-sm text-gray-500">
                        Payment Method
                      </span>

                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />

                        <span className="font-medium text-gray-900">
                          Stripe
                        </span>
                      </div>
                    </div>
  <div className="space-y-3">
                    {poaDeposit ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Booking Total</span>

                          <span className="font-medium text-gray-900">
                            {money(bookingTotal)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">
                            Holding Deposit
                          </span>

                          <span className="font-medium text-blue-600">
                            {money(holdingDeposit)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-b border-dashed pb-4 text-sm">
                          <span className="text-gray-500">
                            Balance Due on Arrival
                          </span>

                          <span className="font-medium text-gray-900">
                            {money(balanceDueOnArrival)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-4">
                          <span className="text-sm font-medium text-blue-700">
                            Amount Paying Now
                          </span>

                          <span className="text-lg font-bold text-blue-700">
                            {money(amountPayingNow)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between border-b border-dashed pb-4 text-sm">
                          <span className="text-gray-500">Booking Total</span>

                          <span className="font-medium text-gray-900">
                            {money(bookingTotal)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-4">
                          <span className="text-sm font-medium text-blue-700">
                            Amount Paying Now
                          </span>

                          <span className="text-lg font-bold text-blue-700">
                            {money(amountPayingNow)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  </div>

                

                  {poaDeposit && (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-200 text-xs font-bold text-yellow-800">
                          !
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-yellow-800">
                            Pay on Arrival
                          </h3>

                          <p className="mt-1 text-xs leading-5 text-yellow-700">
                            A small holding deposit will be charged now to
                            secure your booking. The remaining balance will be
                            paid when you arrive.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </BoxCard>
          )}

          <BoxCard padding="p-2 md:p-4">
            <div className="w-full">
              <div className="mb-4 border-b px-1 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Payment Details
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter your card information securely
                </p>
              </div>

              <div className="pb-5">
                <Elements
                  key={clientSecret}
                  stripe={stripePromise}
                  options={elementsOptions}
                >
                 <StripeCheckoutForm
  bookingId={paymentBookingId}
  draftId={draftId}
  booking={booking}
/>
                </Elements>
              </div>
            </div>
          </BoxCard>
        </div>
      </div>
    </main>
  );
}