import { connectDB } from "@/app/backend/database/mongodb";
import { createBooking } from "@/app/backend/controller/bookingservice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorStatus(message = "") {
  const value = String(message).toLowerCase();

  if (
    value.includes("invalid or expired login") ||
    value.includes("please login") ||
    value.includes("logged-in customers only")
  ) {
    return 401;
  }

  if (
    value.includes("inactive") ||
    value.includes("wallet payment is available for customers only")
  ) {
    return 403;
  }

  if (
    value.includes("not found") ||
    value.includes("was not found") ||
    value.includes("settings were not found")
  ) {
    return 404;
  }

  if (
    value.includes("already exists") ||
    value.includes("fully booked") ||
    value.includes("no storage slots") ||
    value.includes("no airport parking slots") ||
    value.includes("does not have enough seats") ||
    value.includes("could not be reserved") ||
    value.includes("insufficient wallet balance") ||
    value.includes("coupon usage limit")
  ) {
    return 409;
  }

  if (
    value.includes("not active") ||
    value.includes("invalid") ||
    value.includes("required") ||
    value.includes("blocked by admin") ||
    value.includes("price rule") ||
    value.includes("payment option") ||
    value.includes("payment method") ||
    value.includes("shuttle option") ||
    value.includes("shuttle options are not enabled") ||
    value.includes("date range")
  ) {
    return 400;
  }

  return 400;
}

function serializeBooking(booking) {
  if (!booking) return null;

  if (typeof booking.toObject === "function") {
    return booking.toObject({
      virtuals: true,
      versionKey: false,
    });
  }

  return booking;
}

function getBookingRedirect(booking) {
  const mongoBookingId = String(booking?._id || "");
  const publicBookingId = booking?.booking_id || mongoBookingId;

  const paymentMethod = String(booking?.payment_method || "").toLowerCase();
  const paymentStatus = String(booking?.payment_status || "").toLowerCase();
  const bookingStatus = String(booking?.status || "").toLowerCase();
  const paymentFlow = booking?.payment_flow || null;
  const depositType = booking?.deposit_type || null;

  const dueAmount = Number(booking?.due_amount || 0);
  const holdingDepositAmount = Number(booking?.holding_deposit_amount || 0);

  const isAlreadyFinal =
    paymentStatus === "paid" ||
    bookingStatus === "success" ||
    bookingStatus === "confirmed" ||
    bookingStatus === "poa";

  const needsStripePayment =
    paymentMethod === "stripe" &&
    bookingStatus === "pending_payment" &&
    paymentStatus === "pending" &&
    dueAmount > 0;

  const needsPaypalPayment =
    paymentMethod === "paypal" &&
    bookingStatus === "pending_payment" &&
    paymentStatus === "pending" &&
    dueAmount > 0;

  if (needsStripePayment) {
    return {
      paymentRequired: true,
      provider: "stripe",
      paymentFlow,
      depositType,
      amountDueNow: dueAmount,
      holdingDepositAmount,
      redirectUrl: `/booking/payment/${mongoBookingId}`,
    };
  }

  if (needsPaypalPayment) {
    return {
      paymentRequired: true,
      provider: "paypal",
      paymentFlow,
      depositType,
      amountDueNow: dueAmount,
      holdingDepositAmount,
      redirectUrl: `/booking/paypal/${mongoBookingId}`,
    };
  }

  return {
    paymentRequired: false,
    provider: paymentMethod || null,
    paymentFlow,
    depositType,
    amountDueNow: isAlreadyFinal ? 0 : dueAmount,
    holdingDepositAmount,
    redirectUrl: `/booking/success?bookingId=${publicBookingId}`,
  };
}

function getSuccessMessage(paymentRedirect) {
  if (
    paymentRedirect.paymentRequired &&
    paymentRedirect.paymentFlow === "poa_deposit"
  ) {
    return "Booking created. Holding deposit is required to secure this Pay on Arrival booking.";
  }

  if (
    paymentRedirect.paymentRequired &&
    paymentRedirect.provider === "paypal"
  ) {
    return "Booking created. Continue to PayPal to complete your payment.";
  }

  if (
    paymentRedirect.paymentRequired &&
    paymentRedirect.provider === "stripe"
  ) {
    return "Booking created. Continue to Stripe to complete your payment.";
  }

  return "Booking created successfully.";
}

export async function POST(req) {
  try {
    await connectDB();

    const body = await req.json();

    const booking = await createBooking(body, req);
    const serializedBooking = serializeBooking(booking);
    const paymentRedirect = getBookingRedirect(serializedBooking);

    return Response.json(
      {
        success: true,
        message: getSuccessMessage(paymentRedirect),

        data: serializedBooking,
        booking: serializedBooking,

        paymentRequired: paymentRedirect.paymentRequired,
        provider: paymentRedirect.provider,
        paymentFlow: paymentRedirect.paymentFlow,
        depositType: paymentRedirect.depositType,
        amountDueNow: paymentRedirect.amountDueNow,
        holdingDepositAmount: paymentRedirect.holdingDepositAmount,
        redirectUrl: paymentRedirect.redirectUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Booking creation failed:", error);

    const message = error.message || "Booking creation failed";
    const status = getErrorStatus(message);

    return Response.json(
      {
        success: false,
        message,
        error: message,
      },
      { status }
    );
  }
}