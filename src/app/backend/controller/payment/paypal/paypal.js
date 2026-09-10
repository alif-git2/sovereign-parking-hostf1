import { handlePaymentStatus } from "../paymentStatus";
import { getPayPalAccessToken } from "../../../utils/paypalConfig";

import { NextResponse } from "next/server";
import Payment from "../../../models/payment";

// 1. CREATE / CAPTURE PAYPAL PAYMENT
export async function capturePayPalOrder(body) {
    try {
        const { orderID, booking_id, user_id, method, amount } = body;
        const accessToken = await getPayPalAccessToken();

        // PayPal requires "capturing" the order that was created on the frontend
        const response = await fetch(`${process.env.PAYPAL_API_URL}/v2/checkout/orders/${orderID}/capture`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        const captureData = await response.json();

        if (captureData.status === "COMPLETED") {
            // PayPal's equivalent to paymentIntent.id is the Capture ID
            const captureId = captureData.purchase_units[0].payments.captures[0].id;

            const newPayment = {
                booking_id,
                user_id,
                amount,
                method, // "paypal"
                status: "success",
                transaction_id: captureId,
                provider_payload: captureData,
            };

            await handlePaymentStatus("paypal", newPayment);

            return NextResponse.json({ success: true, data: newPayment });
        } else {
            return NextResponse.json({ success: false, message: "PayPal payment not completed" });
        }
    } catch (error) {
        console.error("PayPal capture failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// 2. PAYPAL REFUND (Full or Partial with $10 fee)
export async function paypalRefund(body) {
    try {
        const { paymentId, reason, refundFull } = body;
        const payment = await Payment.findById(paymentId);

        if (!payment || payment.method !== "paypal") {
            return NextResponse.json({ error: "Valid PayPal record not found" }, { status: 404 });
        }

        const accessToken = await getPayPalAccessToken();
        let refundBody = {};

        if (!refundFull) {
            const feeAmount = 10;
            const refundAmount = (payment.amount - feeAmount).toFixed(2); // PayPal likes strings like "90.00"

            if (refundAmount <= 0) {
                return NextResponse.json({ error: "Amount too low for fee" }, { status: 400 });
            }

            refundBody.amount = {
                value: refundAmount,
                currency_code: "AUD",
            };
        }

        // PayPal refunds are sent to the Capture ID (stored in transaction_id)
        const response = await fetch(
            `${process.env.PAYPAL_API_URL}/v2/payments/captures/${payment.transaction_id}/refund`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(refundBody),
            }
        );

        const refundData = await response.json();

        if (response.ok) {
            payment.status = "refunded";
            payment.provider_payload = {
                ...payment.provider_payload,
                refund_details: refundData,
                was_full_refund: refundFull,
            };

            await payment.save();

            return NextResponse.json({
                success: true,
                message: refundFull ? "Full PayPal refund processed" : "Partial PayPal refund processed",
                refundId: refundData.id,
            });
        } else {
            return NextResponse.json({ success: false, error: refundData }, { status: 400 });
        }
    } catch (error) {
        console.error("PayPal refund failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}