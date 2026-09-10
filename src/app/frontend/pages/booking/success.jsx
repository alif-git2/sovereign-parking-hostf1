"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "@/app/frontend/utils/axios";
import Div from "../../component/global/Div";
import BoxCard from "../../component/global/BoxCard";
import Navbar from "../../component/global/NavBar";
import Footer from "../../component/global/Footer";

function money(amount) {
  return `A$${Number(amount || 0).toFixed(2)}`;
}

function formatDate(date) {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(status) {
  if (!status) return "-";

  const labels = {
    pending: "Pending",
    pending_payment: "Pending Payment",
    success: "Confirmed",
    confirmed: "Confirmed",
    poa: "Pay on Arrival",
    cancelled: "Cancelled",
    refund: "Refunded",
    refunded: "Refunded",
    credit: "Credited",
    credited: "Credited",
  };

  return (
    labels[status] ||
    String(status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function formatPaymentMethod(method) {
  if (!method) return "-";

  const labels = {
    poa: "Pay on Arrival",
    stripe: "Stripe",
    paypal: "PayPal",
    wallet: "Wallet",
  };

  return (
    labels[method] ||
    String(method)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function formatSource(source) {
  if (!source) return "-";

  return String(source)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isPoaDepositBooking(booking) {
  return booking?.payment_flow === "poa_deposit";
}

function isWalletPayment(booking) {
  return (
    booking?.payment_method === "wallet" &&
    ["paid", "partial"].includes(booking?.payment_status)
  );
}

function isCheckoutDraftId(value) {
  return /^CD/i.test(String(value || "").trim());
}

function getFirstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function getStorageTypeName(booking) {
  const storage = booking?.details?.storage || {};

  return (
    storage.storage_type_name ||
    storage.storage_type ||
    storage.storage_type_id?.name ||
    "-"
  );
}

function getLicensePlateText(booking) {
  if (!booking) return "-";

  if (booking.type === "storage") {
    return booking.reference || booking.license_plate || "-";
  }

  return booking.license_plate || "-";
}

function getVehicleDetailLabel(booking) {
  if (!booking) return "Vehicle";

  if (booking.type === "cruise") {
    return "License Plate";
  }

  if (booking.type === "airport") {
    return "License Plate";
  }

  if (booking.type === "storage") {
    return "Vehicle Type";
  }

  return "Vehicle";
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCruiseAddOnVehicle(booking) {
  if (!booking || booking.type !== "cruise") {
    return {
      enabled: false,
      type: "",
      licensePlate: "",
    };
  }

  const addOnVehicle = booking?.details?.cruise?.add_on_vehicle || {};

  const enabled = Boolean(
    booking?.add_on_vehicle_enabled || addOnVehicle?.enabled
  );

  const vehicleType = normalizeText(
    booking?.add_on_vehicle_type || addOnVehicle?.type
  );

  const licensePlate = normalizeText(
    booking?.add_on_vehicle_license_plate || addOnVehicle?.license_plate
  );

  return {
    enabled: enabled && Boolean(vehicleType || licensePlate),
    type: vehicleType,
    licensePlate,
  };
}

function hasCruiseAddOnVehicle(booking) {
  const addOnVehicle = getCruiseAddOnVehicle(booking);

  return Boolean(addOnVehicle.enabled);
}

function getCruiseAddOnVehicleName(booking) {
  return getCruiseAddOnVehicle(booking).type || "-";
}

function getCruiseAddOnVehicleLicensePlate(booking) {
  return getCruiseAddOnVehicle(booking).licensePlate || "-";
}

function getCruiseAddOnVehicleLicensePlateLabel(booking) {
  const addOnVehicle = getCruiseAddOnVehicle(booking);
  const vehicleName = addOnVehicle.type || "Selected Vehicle";

  return `${vehicleName} License Plate`;
}

function getCruiseCarParkToTerminalPassengers(booking) {
  return getFirstValue(
    booking?.details?.cruise?.car_park_to_terminal_passengers,
    booking?.car_park_to_terminal_passengers,
    booking?.details?.cruise?.pickup_pax,
    booking?.pax,
    0
  );
}

function getCruiseCarParkToTerminalShuttleTime(booking) {
  return (
    getFirstValue(
      booking?.details?.cruise?.car_park_to_terminal_shuttle_time,
      booking?.car_park_to_terminal_shuttle_time,
      booking?.details?.cruise?.shuttle_time,
      booking?.shuttle_time
    ) || "-"
  );
}

function getCruiseTerminalToCarParkPassengers(booking) {
  return getFirstValue(
    booking?.details?.cruise?.terminal_to_car_park_passengers,
    booking?.terminal_to_car_park_passengers,
    0
  );
}

function getCruiseTerminalToCarParkShuttleTime(booking) {
  return (
    getFirstValue(
      booking?.details?.cruise?.terminal_to_car_park_shuttle_time,
      booking?.terminal_to_car_park_shuttle_time
    ) || "-"
  );
}

function getWalletTransactionReference(booking) {
  const walletTransaction =
    booking?.wallet_transaction_id ||
    booking?.wallet_transaction ||
    booking?.walletTransaction;

  if (walletTransaction) {
    if (typeof walletTransaction === "string") {
      return walletTransaction;
    }

    return (
      walletTransaction.transaction_reference ||
      walletTransaction.transaction_id ||
      walletTransaction.reference ||
      walletTransaction._id ||
      "-"
    );
  }

  return (
    booking?.wallet_transaction_reference ||
    booking?.wallet_reference ||
    booking?.transaction_reference ||
    booking?.transaction_id ||
    booking?.reference ||
    "-"
  );
}

function getPaymentReferenceLabel(booking) {
  const method = booking?.payment_method;

  if (method === "stripe") return "Stripe Reference";
  if (method === "paypal") return "PayPal Reference";
  if (method === "wallet") return "Wallet Reference";

  return "Payment Reference";
}

function getPaymentReferenceValue(booking, stripePaymentIntent) {
  const method = booking?.payment_method;

  if (method === "stripe") {
    return (
      booking?.stripe_payment_intent_id ||
      stripePaymentIntent ||
      booking?.payment_intent_id ||
      booking?.payment_reference ||
      booking?.transaction_id ||
      "-"
    );
  }

  if (method === "paypal") {
    return (
      booking?.paypal_capture_id ||
      booking?.paypal_order_id ||
      booking?.payment_capture_id ||
      booking?.payment_order_id ||
      booking?.payment_reference ||
      booking?.transaction_id ||
      "-"
    );
  }

  if (method === "wallet") {
    return getWalletTransactionReference(booking);
  }

  return (
    booking?.payment_reference ||
    booking?.manual_payment_reference ||
    booking?.transaction_reference ||
    booking?.transaction_id ||
    booking?.reference ||
    "-"
  );
}

function getDraftFromResponse(response) {
  return response?.data?.data?.draft || response?.data?.draft || null;
}

function getBookingIdFromDraft(draft) {
  if (!draft) return "";

  if (draft.booking_public_id) {
    return String(draft.booking_public_id);
  }

  if (draft.booking_id && typeof draft.booking_id === "object") {
    return String(draft.booking_id.booking_id || draft.booking_id._id || "");
  }

  return String(draft.booking_id || "");
}

function getSuccessState(booking, stripeRedirectStatus, draft) {
  if (!booking && draft?.status === "payment_ready") {
    return {
      icon: "…",
      iconClass: "bg-yellow-100 text-yellow-700",
      title: "Finalizing Booking",
      titleClass: "text-yellow-700",
      message:
        "Your payment was submitted. We are waiting for confirmation before showing the final booking details.",
    };
  }

  if (!booking) {
    return {
      icon: "✓",
      iconClass: "bg-green-100 text-green-600",
      title: "Booking Created",
      titleClass: "text-green-600",
      message: "Thank you. Your booking request has been received.",
    };
  }

  const poaDeposit = isPoaDepositBooking(booking);
  const walletPayment = isWalletPayment(booking);

  const isPaid = booking.payment_status === "paid";
  const isPartialPoaPaid =
    poaDeposit &&
    booking.payment_status === "partial" &&
    booking.status === "poa";

  const isLegacyPoa =
    booking.payment_method === "poa" ||
    (booking.status === "poa" && booking.payment_status === "pending");

  const isFailed =
    booking.payment_status === "failed" || stripeRedirectStatus === "failed";

  const isStripeProcessing =
    booking.payment_method === "stripe" &&
    stripeRedirectStatus === "succeeded" &&
    booking.payment_status === "pending";

  if (isFailed) {
    return {
      icon: "!",
      iconClass: "bg-red-100 text-red-600",
      title: "Payment Failed",
      titleClass: "text-red-600",
      message:
        "Your booking was created, but the payment was not completed successfully. Please contact support or try again.",
    };
  }

  if (walletPayment && isPartialPoaPaid) {
    return {
      icon: "✓",
      iconClass: "bg-green-100 text-green-600",
      title: "Wallet Holding Deposit Paid",
      titleClass: "text-green-600",
      message:
        "Thank you. Your holding deposit has been paid from your wallet. Your booking is secured as Pay on Arrival.",
    };
  }

  if (walletPayment) {
    return {
      icon: "✓",
      iconClass: "bg-green-100 text-green-600",
      title: "Wallet Payment Successful",
      titleClass: "text-green-600",
      message:
        "Thank you. Your booking has been confirmed and paid from your wallet balance.",
    };
  }

  if (isPartialPoaPaid) {
    return {
      icon: "✓",
      iconClass: "bg-green-100 text-green-600",
      title: "Holding Deposit Paid",
      titleClass: "text-green-600",
      message:
        "Thank you. Your holding deposit has been received. Your booking is secured as Pay on Arrival.",
    };
  }

  if (isPaid) {
    return {
      icon: "✓",
      iconClass: "bg-green-100 text-green-600",
      title: "Payment Successful",
      titleClass: "text-green-600",
      message:
        "Thank you. Your booking has been confirmed and your payment was received.",
    };
  }

  if (isLegacyPoa) {
    return {
      icon: "✓",
      iconClass: "bg-green-100 text-green-600",
      title: "Booking Created Successfully",
      titleClass: "text-green-600",
      message:
        "Thank you. Your booking has been created. Payment is due on arrival.",
    };
  }

  if (isStripeProcessing) {
    return {
      icon: "…",
      iconClass: "bg-yellow-100 text-yellow-700",
      title: "Payment Processing",
      titleClass: "text-yellow-700",
      message:
        "Your payment was submitted. We are waiting for payment confirmation from Stripe.",
    };
  }

  return {
    icon: "✓",
    iconClass: "bg-yellow-100 text-yellow-700",
    title: "Booking Created",
    titleClass: "text-yellow-700",
    message:
      "Your booking was created and is waiting for payment confirmation.",
  };
}

function DetailRow({ label, value, highlight = false }) {
  return (
    <tr className={`${highlight ? "bg-blue-50" : ""} h-5`}>
      <td className="text-[15px]">{label}</td>
      <td className="break-all text-[15px]">{value || "-"}</td>
    </tr>
  );
}

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();

  const rawBookingId =
    searchParams.get("bookingId") || searchParams.get("booking_id") || "";

  const explicitDraftId =
    searchParams.get("draftId") ||
    searchParams.get("draft_id") ||
    searchParams.get("checkoutDraftId") ||
    searchParams.get("checkout_draft_id") ||
    "";

  const draftId = explicitDraftId || (isCheckoutDraftId(rawBookingId) ? rawBookingId : "");
  const bookingId = rawBookingId && !isCheckoutDraftId(rawBookingId) ? rawBookingId : "";

  const stripeRedirectStatus = searchParams.get("redirect_status");
  const stripePaymentIntent = searchParams.get("payment_intent");

  const [booking, setBooking] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(Boolean(bookingId || draftId));
  const [error, setError] = useState("");
  const [pollCount, setPollCount] = useState(0);

  const successState = useMemo(() => {
    return getSuccessState(booking, stripeRedirectStatus, draft);
  }, [booking, stripeRedirectStatus, draft]);

  useEffect(() => {
    let timeoutId;
    let cancelled = false;

    async function loadBookingById(id) {
      const res = await axios.get(`/bookings/${encodeURIComponent(id)}`);

      if (!res.data.success) {
        throw new Error(
          res.data.message ||
            res.data.error ||
            "Failed to fetch booking details"
        );
      }

      return res.data.data;
    }

    async function fetchBookingDetails() {
      try {
        if (!bookingId && !draftId) return;

        setLoading(true);
        setError("");

        let bookingLookupId = bookingId;

        if (draftId) {
          const draftRes = await axios.get("/bookings/checkout-drafts", {
            params: {
              draftId,
            },
          });

          if (!draftRes.data.success) {
            throw new Error(
              draftRes.data.message ||
                draftRes.data.error ||
                "Failed to fetch checkout draft"
            );
          }

          const fetchedDraft = getDraftFromResponse(draftRes);

          if (!cancelled) {
            setDraft(fetchedDraft);
          }

          bookingLookupId = getBookingIdFromDraft(fetchedDraft);

          if (!bookingLookupId) {
            const shouldPollDraftAgain =
              ["payment_ready", "payment_processing", "paid", "draft"].includes(
                fetchedDraft?.status
              ) && pollCount < 12;

            if (shouldPollDraftAgain) {
              timeoutId = setTimeout(() => {
                setPollCount((prev) => prev + 1);
              }, 1500);

              return;
            }

            if (["failed", "cancelled", "expired"].includes(fetchedDraft?.status)) {
              throw new Error(
                fetchedDraft?.payment_error ||
                  "Payment was not completed successfully."
              );
            }

            throw new Error(
              "Payment was received, but the final booking is still being prepared. Please refresh this page in a few seconds."
            );
          }
        }

        const fetchedBooking = await loadBookingById(bookingLookupId);

        if (!cancelled) {
          setBooking(fetchedBooking);
        }

        const isPaymentStillPending =
          fetchedBooking?.payment_method === "stripe" &&
          fetchedBooking?.payment_status === "pending" &&
          ["pending_payment", "pending"].includes(fetchedBooking?.status);

        const shouldPollAgain =
          stripeRedirectStatus === "succeeded" &&
          isPaymentStillPending &&
          pollCount < 12;

        if (shouldPollAgain) {
          timeoutId = setTimeout(() => {
            setPollCount((prev) => prev + 1);
          }, 1500);
        }
      } catch (error) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Booking details could not be loaded.";

        const shouldPollAfterError =
          draftId &&
          stripeRedirectStatus === "succeeded" &&
          pollCount < 12 &&
          !String(message).toLowerCase().includes("failed") &&
          !String(message).toLowerCase().includes("cancelled") &&
          !String(message).toLowerCase().includes("expired");

        if (shouldPollAfterError) {
          timeoutId = setTimeout(() => {
            setPollCount((prev) => prev + 1);
          }, 1500);
          return;
        }

        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchBookingDetails();

    return () => {
      cancelled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [bookingId, draftId, stripeRedirectStatus, pollCount]);

  const poaDeposit = isPoaDepositBooking(booking);
  const walletPayment = isWalletPayment(booking);

  const poaDepositPaid =
    poaDeposit &&
    booking?.payment_status === "partial" &&
    booking?.status === "poa";

  const stripePending =
    booking?.payment_method === "stripe" &&
    booking?.payment_status === "pending" &&
    ["pending_payment", "pending"].includes(booking?.status);

  const waitingForDraftBooking = draftId && !booking && !error;

  const paymentReferenceLabel = getPaymentReferenceLabel(booking);
  const paymentReferenceValue = getPaymentReferenceValue(
    booking,
    stripePaymentIntent
  );

  return (
    <div className="">
      <Navbar />

      <div className="flex flex-col-reverse gap-4 px-3 pb-4 pt-3 sm:px-4 sm:pt-4 md:flex-row md:gap-10 md:p-10">
        <div className="w-full">
          <BoxCard>
            <div className="flex flex-col">
              <h1 className={`my-2 text-lg font-bold sm:text-xl ${successState.titleClass}`}>
                {successState.title}
              </h1>

              <h1>
                Thanks for your booking{" "}
                <span className="font-semibold">
                  {booking?.customer?.name || ""}
                </span>
              </h1>

              <div className="my-2 ml-[16%] h-[2px] w-9/12 bg-gradient-to-r from-pink-400 via-pink-200 to-transparent md:ml-0 md:w-full"></div>

              <p>
                {successState.message}
              </p>

              <p className="mt-2">
                We&apos;ve emailed a confirmation to{" "}
                <span className="font-semibold">
                  {booking?.customer?.email || ""}
                </span>
                . Please check your inbox and{" "}
                <span className="font-semibold">spam/junk</span> folder just in
                case.
              </p>
            </div>
          </BoxCard>

          <div>
            {loading && (
              <Div isPadding={false}>
                <div className="mt-3 bg-gray-100 p-5 text-gray-600">
                  {draftId
                    ? "Finalizing booking details..."
                    : "Loading booking details..."}
                </div>
              </Div>
            )}

            {waitingForDraftBooking && !loading && (
              <Div isPadding={false}>
                <div className="mt-3 bg-yellow-50 p-5 text-yellow-800">
                  Payment was submitted. We are waiting for Stripe confirmation
                  and preparing your final booking ID.
                  <br />
                  Draft Reference: {draftId}
                </div>
              </Div>
            )}

            {error && (
              <Div isPadding={false}>
                <div className="mt-3 bg-yellow-50 p-5 text-yellow-800">
                  Booking was created, but details could not be loaded here.
                  <br />
                  {error}
                  {draftId && (
                    <>
                      <br />
                      Draft Reference: {draftId}
                    </>
                  )}
                </div>
              </Div>
            )}

            {!bookingId && !draftId && (
              <Div isPadding={false}>
                <div className="mt-3 bg-yellow-50 p-5 text-yellow-800">
                  Booking ID or checkout draft ID was not found in the URL.
                </div>
              </Div>
            )}

            {booking && (
              <div className="mt-3">
                <Div isPadding={false}>
                  <div className="bg-gray-100 p-5">
                    <h2 className="mb-2 text-blue-400">
                      Account Setup Email
                    </h2>

                    <p className="text-gray-600">
                      If this is your first booking, please check your email for
                      your password setup link.
                    </p>
                  </div>
                </Div>
              </div>
            )}

            {walletPayment && (
              <Div isPadding={false}>
                <div className="w-full bg-gray-100 p-5">
                  <h2 className="mb-2 text-emerald-400">
                    {poaDeposit ? "Wallet Holding Deposit Paid" : "Paid by Wallet"}
                  </h2>

                  <p className="text-gray-600">
                    {poaDeposit
                      ? "Your holding deposit was deducted from your wallet balance."
                      : "Your booking has been confirmed and paid from your wallet balance."}{" "}
                    <strong>{money(booking?.wallet_used || booking?.paid_amount)}</strong>
                  </p>

                  {paymentReferenceValue && paymentReferenceValue !== "-" && (
                    <p className="mt-2 break-all text-sm text-gray-600">
                      <strong>{paymentReferenceLabel}:</strong>{" "}
                      {paymentReferenceValue}
                    </p>
                  )}
                </div>
              </Div>
            )}

            {stripePending && (
              <Div isPadding={false}>
                <div className="bg-gray-100 p-5">
                  <h2 className="mb-2 text-rose-500">
                    Payment Confirmation Pending
                  </h2>

                  <p className="text-gray-600">
                    Your payment may still be processing. Refresh this page in a
                    few seconds. If this continues, please contact support with
                    your booking ID.
                  </p>
                </div>
              </Div>
            )}

            {poaDepositPaid && (
              <Div isPadding={false}>
                <div className="bg-gray-100 p-5">
                  <h2 className="mb-2 text-pink-400">Pay on Arrival</h2>

                  <p className="text-gray-600">
                    Your holding deposit has been paid. Please pay the remaining
                    balance of{" "}
                    <strong>{money(booking?.balance_due_on_arrival)}</strong>{" "}
                    when you arrive.
                  </p>
                </div>
              </Div>
            )}

            {booking && booking.payment_method === "poa" && (
              <Div isPadding={false}>
                <div className="bg-gray-100 p-5">
                  <h2 className="mb-2 text-violet-500">Pay on Arrival</h2>

                  <p className="text-gray-600">
                    Your booking has been created. Please pay the due amount
                    when you arrive.
                  </p>
                </div>
              </Div>
            )}
          </div>
        </div>

        <div className="w-full">
          {booking && (
            <BoxCard>
              <h1 className="mb-2 text-xl text-indigo-500">Booking Details</h1>

              <table className="w-full">
                <tbody>
                  <DetailRow
                    label="Booking ID"
                    value={booking.booking_id}
                    highlight
                  />

                  <DetailRow
                    label={paymentReferenceLabel || "Payment Reference"}
                    value={paymentReferenceValue}
                    highlight
                  />

                  <DetailRow
                    label="Booking Status"
                    value={
                      formatStatus(booking.status) === "Pay on Arrival"
                        ? "POA"
                        : formatStatus(booking.status)
                    }
                  />

                  <DetailRow
                    label="Payment Method"
                    value={formatPaymentMethod(booking.payment_method)}
                  />

                  <DetailRow
                    label={booking.type === "cruise" ? "Car Park" : "Location"}
                    value={booking.location_id?.name}
                  />

                  <DetailRow
                    label={
                      booking.type === "cruise"
                        ? "Ship Departure"
                        : "Entry / Start Date"
                    }
                    value={formatDate(booking.start_date)}
                  />

                  <DetailRow
                    label={
                      booking.type === "cruise"
                        ? "Ship Arrival"
                        : "Exit / End Date"
                    }
                    value={formatDate(booking.end_date)}
                  />

                  <DetailRow
                    label={getVehicleDetailLabel(booking)}
                    value={getLicensePlateText(booking)}
                  />

                  {booking.type === "cruise" && hasCruiseAddOnVehicle(booking) && (
                    <>
                      <DetailRow
                        label="Add On Vehicle"
                        value={getCruiseAddOnVehicleName(booking)}
                      />

                      <DetailRow
                        label={getCruiseAddOnVehicleLicensePlateLabel(booking)}
                        value={getCruiseAddOnVehicleLicensePlate(booking)}
                      />
                    </>
                  )}

                  {booking.type === "cruise" && (
                    <>
                      {/* <DetailRow
                        label="Car park to terminal Passengers"
                        value={getCruiseCarParkToTerminalPassengers(booking)}
                      /> */}

                      <DetailRow
                        label="Car park to terminal Shuttle Time"
                        value={`${getCruiseCarParkToTerminalShuttleTime(booking)} (${getCruiseCarParkToTerminalPassengers(booking)} passengers)`}
                      />

                      {/* <DetailRow
                        label="Terminal to car park Passengers"
                        value={getCruiseTerminalToCarParkPassengers(booking)}
                      /> */}

                      <DetailRow
                        label="Terminal to car park Shuttle Time"
                        value={`${getCruiseTerminalToCarParkShuttleTime(booking)} (${getCruiseTerminalToCarParkPassengers(booking)} passengers)`}
                      />
                    </>
                  )}

                  {booking.type === "storage" && (
                    <DetailRow
                      label="Storage Type"
                      value={getStorageTypeName(booking)}
                    />
                  )}

                  {booking.type === "airport" && (
                    <>
                      <DetailRow
                        label="Shuttle"
                        value={booking.details?.airport?.shuttle_time || "No shuttle"}
                      />

                      <DetailRow
                        label="Passengers"
                        value={
                          booking.details?.airport?.pickup_pax || booking.pax || 0
                        }
                      />
                    </>
                  )}

                  <DetailRow
                    label="Subtotal"
                    value={money(booking.price ?? booking.original_price)}
                  />

                  {formatStatus(booking.status) === "Pay on Arrival" && (
                    <DetailRow
                      label={poaDeposit ? "Current Due Amount" : "Due Amount"}
                      value={money(booking.due_amount)}
                    />
                  )}
                </tbody>
              </table>

              <div className="my-2 ml-[16%] h-[2px] w-9/12 bg-gradient-to-r from-pink-400 via-pink-200 to-transparent md:ml-0 md:w-full"></div>

              <p className="pt-2 text-[15px]">
                If you&apos;d like to update your booking, you can do this
                anytime by logging into your account. For anything else, just
                email us at{" "}
                <span className="font-semibold">
                  hello@sovereignparking.com
                </span>
                , and we will be happy to help.
              </p>
            </BoxCard>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
