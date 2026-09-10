"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";
import axios from "@/app/frontend/utils/axios";
import Div from "../../component/global/Div";
import BoxCard from "../../component/global/BoxCard";
import { LoaderCircle } from "lucide-react";

const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

function money(amount) {
  return `A$ ${Number(amount || 0).toFixed(2)}`;
}

function formatStatus(value) {
  if (!value) return "-";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getFirstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function isPoaDepositBooking(booking) {
  return booking?.payment_flow === "poa_deposit";
}

function isPoaDepositAlreadyPaid(booking) {
  return (
    isPoaDepositBooking(booking) &&
    booking?.payment_status === "partial" &&
    booking?.status === "poa"
  );
}

function getBookingTotal(booking) {
  return Number(
    getFirstValue(
      booking?.price,
      booking?.total_amount,
      booking?.booking_total_amount,
      booking?.pricing_snapshot?.price,
      0
    )
  );
}

function getHoldingDeposit(booking) {
  if (!isPoaDepositBooking(booking)) return 0;

  return Number(
    getFirstValue(
      booking?.holding_deposit_amount,
      booking?.pricing_snapshot?.holding_deposit_amount,
      booking?.due_amount,
      booking?.paid_amount,
      0
    )
  );
}

function getBalanceDueOnArrival(booking) {
  if (!isPoaDepositBooking(booking)) return 0;

  const explicitBalance = getFirstValue(
    booking?.balance_due_on_arrival,
    booking?.pricing_snapshot?.balance_due_on_arrival
  );

  if (explicitBalance !== null) {
    return Number(explicitBalance || 0);
  }

  const bookingTotal = getBookingTotal(booking);
  const holdingDeposit = getHoldingDeposit(booking);

  return Math.max(bookingTotal - holdingDeposit, 0);
}

function getAmountPayingNow(booking) {
  return Number(
    getFirstValue(
      booking?.amount_due_now,
      booking?.due_amount,
      booking?.pricing_snapshot?.amount_due_now,
      isPoaDepositBooking(booking) ? getHoldingDeposit(booking) : null,
      booking?.price,
      0
    )
  );
}

function getPaymentTitle(booking) {
  if (isPoaDepositBooking(booking)) {
    return "Pay Holding Deposit";
  }

  return "Complete PayPal Payment";
}

function getPaymentDescription(booking) {
  if (isPoaDepositBooking(booking)) {
    return "A small holding deposit will be charged now to secure your Pay on Arrival booking. The remaining balance is due when you arrive.";
  }

  return "Your booking has been prepared. Please complete payment with PayPal to confirm it.";
}

function getDraftIdFromSearchParams(searchParams) {
  return (
    searchParams.get("draftId") ||
    searchParams.get("draft_id") ||
    searchParams.get("checkoutDraftId") ||
    searchParams.get("checkout_draft_id") ||
    ""
  );
}

function getBookingIdFromSearchParams(searchParams) {
  return (
    searchParams.get("bookingId") ||
    searchParams.get("booking_id") ||
    searchParams.get("id") ||
    ""
  );
}

function normalizeDraftFromResponse(responseData) {
  return (
    responseData?.data?.draft ||
    responseData?.draft ||
    responseData?.checkoutDraft ||
    responseData?.checkout_draft ||
    null
  );
}

function buildBookingPreviewFromDraft(draft) {
  if (!draft) return null;

  const bookingPayload = draft.booking_payload || {};
  const pricing = draft.pricing_snapshot || {};
  const customer = draft.customer_snapshot || {};

  return {
    ...bookingPayload,

    _id: draft._id,
    draft_id: draft.draft_id || draft._id,
    draft_reference: draft.draft_reference,

    booking_id: draft.booking_public_id || draft.draft_reference,
    type: draft.type || bookingPayload.type,

    status: draft.status,
    payment_status:
      draft.status === "completed" || draft.status === "paid"
        ? "paid"
        : "pending",

    payment_method: "paypal",
    payment_flow: draft.payment_flow || bookingPayload.payment_flow,
    deposit_type: draft.deposit_type || bookingPayload.deposit_type,

    price: Number(
      getFirstValue(bookingPayload.price, pricing.price, pricing.total_amount, 0)
    ),
    total_amount: Number(getFirstValue(pricing.price, bookingPayload.price, 0)),
    booking_total_amount: Number(
      getFirstValue(pricing.price, bookingPayload.price, 0)
    ),
    due_amount: Number(
      getFirstValue(
        pricing.amount_due_now,
        bookingPayload.due_amount,
        bookingPayload.amount_due_now,
        0
      )
    ),
    amount_due_now: Number(
      getFirstValue(
        pricing.amount_due_now,
        bookingPayload.due_amount,
        bookingPayload.amount_due_now,
        0
      )
    ),

    holding_deposit_amount: Number(
      getFirstValue(
        pricing.holding_deposit_amount,
        bookingPayload.holding_deposit_amount,
        0
      )
    ),
    balance_due_on_arrival: Number(
      getFirstValue(
        pricing.balance_due_on_arrival,
        bookingPayload.balance_due_on_arrival,
        0
      )
    ),

    currency: draft.currency || bookingPayload.currency || "aud",

    customer: {
      name:
        `${customer.first_name || bookingPayload.first_name || ""} ${
          customer.last_name || bookingPayload.last_name || ""
        }`.trim() || "-",
      email: customer.email || bookingPayload.email || "",
      phone: customer.phone || bookingPayload.phone || "",
    },
  };
}

export default function BookingPayPalPage({ bookingId }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const draftId = getDraftIdFromSearchParams(searchParams);
  const paymentBookingId = bookingId || getBookingIdFromSearchParams(searchParams);
  const cancelled = searchParams.get("cancelled") === "true";

  const [draft, setDraft] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [capturingOrder, setCapturingOrder] = useState(false);
  const [error, setError] = useState("");
  const [paypalOrderId, setPaypalOrderId] = useState("");

  useEffect(() => {
    async function fetchPaymentSource() {
      try {
        if (!paymentBookingId && !draftId) {
          throw new Error("Booking ID or checkout draft ID is missing.");
        }

        setLoadingBooking(true);
        setError("");

        if (draftId) {
          const res = await axios.get("/bookings/checkout-drafts", {
            params: {
              draftId,
            },
          });

          if (!res.data.success) {
            throw new Error(
              res.data.message ||
                res.data.error ||
                "Failed to load checkout draft."
            );
          }

          const fetchedDraft = normalizeDraftFromResponse(res.data);

          if (!fetchedDraft) {
            throw new Error("Checkout draft was not returned.");
          }

          setDraft(fetchedDraft);
          setBooking(buildBookingPreviewFromDraft(fetchedDraft));

          if (
            fetchedDraft.status === "completed" &&
            fetchedDraft.booking_public_id
          ) {
            router.replace(
              `/booking/success?bookingId=${encodeURIComponent(
                fetchedDraft.booking_public_id
              )}`
            );
          }

          return;
        }

        const res = await axios.get(`/bookings/${paymentBookingId}`);

        if (!res.data.success) {
          throw new Error(
            res.data.message || res.data.error || "Failed to load booking."
          );
        }

        setDraft(null);
        setBooking(res.data.data);
      } catch (error) {
        setError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Failed to load payment details."
        );
      } finally {
        setLoadingBooking(false);
      }
    }

    fetchPaymentSource();
  }, [paymentBookingId, draftId, router]);

  const paypalOptions = useMemo(() => {
    return {
      clientId: paypalClientId,
      currency: "AUD",
      intent: "capture",
      components: "buttons",
    };
  }, []);

  const isPoaDeposit = isPoaDepositBooking(booking);
  const bookingTotal = getBookingTotal(booking);
  const holdingDeposit = getHoldingDeposit(booking);
  const balanceDueOnArrival = getBalanceDueOnArrival(booking);
  const amountPayingNow = getAmountPayingNow(booking);

  async function createOrder() {
    try {
      setCreatingOrder(true);
      setError("");

      const payload = draftId
        ? {
            draftId,
            checkoutDraftId: draftId,
          }
        : {
            bookingId: paymentBookingId,
          };

      const res = await axios.post("/payments/paypal/create-order", payload);

      if (!res.data.success) {
        throw new Error(
          res.data.message || res.data.error || "Failed to create PayPal order."
        );
      }

      if (!res.data.orderId && !res.data.order_id) {
        throw new Error("PayPal order ID was not returned.");
      }

      const orderId = res.data.orderId || res.data.order_id;

      setPaypalOrderId(orderId);

      if (res.data.draft) {
        setDraft(res.data.draft);
        setBooking(buildBookingPreviewFromDraft(res.data.draft));
      }

      if (res.data.booking) {
        setBooking(res.data.booking);
      }

      return orderId;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create PayPal order.";

      const redirectUrl = error.response?.data?.redirectUrl;

      if (redirectUrl) {
        router.push(redirectUrl);
        return;
      }

      setError(message);
      throw new Error(message);
    } finally {
      setCreatingOrder(false);
    }
  }

  async function captureOrder(data) {
    try {
      setCapturingOrder(true);
      setError("");

      const orderId = data?.orderID || paypalOrderId;

      if (!orderId) {
        throw new Error("PayPal order ID is missing.");
      }

      const payload = draftId
        ? {
            draftId,
            checkoutDraftId: draftId,
            orderId,
          }
        : {
            bookingId: paymentBookingId,
            orderId,
          };

      const res = await axios.post("/payments/paypal/capture-order", payload);

      if (!res.data.success) {
        throw new Error(
          res.data.message ||
            res.data.error ||
            "Failed to capture PayPal payment."
        );
      }

      const redirectUrl =
        res.data.redirectUrl ||
        res.data.redirect_url ||
        (res.data.booking?.booking_id
          ? `/booking/success?bookingId=${encodeURIComponent(
              res.data.booking.booking_id
            )}`
          : draftId
          ? `/booking/success?draftId=${encodeURIComponent(draftId)}`
          : `/booking/success?bookingId=${encodeURIComponent(
              paymentBookingId
            )}`);

      router.push(redirectUrl);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to capture PayPal payment.";

      setError(message);
    } finally {
      setCapturingOrder(false);
    }
  }

  function handleCancel() {
    setError("PayPal payment was cancelled.");
  }

  function handleError(error) {
    console.error("PayPal error:", error);

    setError(
      error?.message ||
        "PayPal payment could not be completed. Please try again."
    );
  }

  if (!paypalClientId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-800">
            PayPal client ID missing
          </h1>

          <p className="mt-2 text-sm text-red-700">
            Please add NEXT_PUBLIC_PAYPAL_CLIENT_ID to your environment
            variables.
          </p>
        </div>
      </main>
    );
  }

  if (loadingBooking) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center">
        <BoxCard padding={"p-1 md:p-3"}>
          <div className="w-full overflow-hidden">
            <div className="bg-blue-50 px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <LoaderCircle className="h-6 w-6 animate-spin text-blue-600" />
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-blue-700">
                    Loading PayPal Payment...
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-blue-600">
                    Please wait while we securely load your booking and payment
                    session.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </BoxCard>
      </main>
    );
  }

  if (booking?.payment_status === "paid" || isPoaDepositAlreadyPaid(booking)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h1 className="text-xl font-semibold text-green-800">
            {isPoaDepositAlreadyPaid(booking)
              ? "Holding Deposit Already Paid"
              : "Booking Already Paid"}
          </h1>

          <p className="mt-2 text-sm text-green-700">
            {isPoaDepositAlreadyPaid(booking)
              ? "The Pay on Arrival holding deposit has already been paid."
              : "This booking has already been paid."}
          </p>

          <button
            type="button"
            onClick={() => {
              if (draft?.booking_public_id) {
                router.push(`/booking/success?bookingId=${draft.booking_public_id}`);
                return;
              }

              if (draftId) {
                router.push(`/booking/success?draftId=${draftId}`);
                return;
              }

              router.push(`/booking/success?bookingId=${booking.booking_id}`);
            }}
            className="mt-5 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white"
          >
            View Booking
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <Div isPadding={false}>
          <div className="w-full bg-blue-600 p-2 text-white md:p-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {getPaymentTitle(booking)}
            </h1>

            <p className="mt-2 text-sm">Secure payment powered by PayPal</p>
          </div>
        </Div>

        {cancelled && (
          <div className="mb-5 rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-200 text-xs font-bold text-yellow-800">
                !
              </div>

              <div>
                <h3 className="text-sm font-semibold text-yellow-800">
                  Payment Cancelled
                </h3>

                <p className="mt-1 text-sm text-yellow-700">
                  Your PayPal payment was cancelled. You can try again below.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-200 text-xs font-bold text-red-700">
                !
              </div>

              <div>
                <h3 className="text-sm font-semibold text-red-700">
                  Payment Error
                </h3>

                <p className="mt-1 text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[420px_1fr]">
          {booking && (
            <BoxCard padding={"p-2 md:p-4"}>
              <div>
                <div className="mb-2 rounded-lg bg-blue-400 px-5 py-4">
                  <h2 className="text-lg font-semibold text-white">
                    Booking Summary
                  </h2>

                  <p className="mt-1 text-xs text-blue-100">
                    Review your payment details before checkout
                  </p>
                </div>

                <div className="mt-2 space-y-5">
                  <div className="rounded-xl bg-gray-50 p-4">
                    {/* <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                      <span className="text-sm text-gray-500">
                        {draftId ? "Checkout Draft" : "Booking ID"}
                      </span>

                      <span className="text-sm font-semibold text-gray-900">
                        #{draftId ? draft?.draft_reference || draftId : booking.booking_id}
                      </span>
                    </div> */}

                    <div className="flex items-center justify-between pt-3">
                      <span className="text-sm text-gray-500">
                        Payment Method
                      </span>

                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500"></div>

                        <span className="font-medium text-gray-900">
                          PayPal
                        </span>
                      </div>
                    </div>
                         <div className="space-y-3">
                    {isPoaDeposit ? (
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
                        <div className="flex items-center justify-between border-b border-dashed px-4 pb-4 text-sm">
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

             

                  <p className="text-xs leading-5 text-gray-500">
                    {getPaymentDescription(booking)}
                  </p>

                  {isPoaDeposit && (
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
                            A small holding deposit will be charged now to secure
                            your booking. The remaining balance will be paid when
                            you arrive.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </BoxCard>
          )}

          <BoxCard>
            <div>
              <div className="border-b py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Complete Payment
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Continue securely with your PayPal account
                </p>
              </div>

              <div className="py-5">
                {(creatingOrder || capturingOrder) && (
                  <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>

                      <p className="text-sm font-medium text-blue-700">
                        {capturingOrder
                          ? "Capturing PayPal payment..."
                          : "Creating PayPal order..."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-gray-200 bg-gray-50 md:p-4">
                  <PayPalScriptProvider options={paypalOptions}>
                    <PayPalButtons
                      style={{
                        layout: "vertical",
                        shape: "rect",
                        label: "paypal",
                      }}
                      disabled={creatingOrder || capturingOrder}
                      createOrder={createOrder}
                      onApprove={captureOrder}
                      onCancel={handleCancel}
                      onError={handleError}
                    />
                  </PayPalScriptProvider>
                </div>

                {draftId && (
                  <p className="mt-4 text-xs leading-5 text-gray-500">
                    Your real booking number will be generated after PayPal
                    confirms payment.
                  </p>
                )}
              </div>
            </div>
          </BoxCard>
        </div>
      </div>
    </main>
  );
}
