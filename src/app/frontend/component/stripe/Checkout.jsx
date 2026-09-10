// "use client";

// import { useState } from "react";
// import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
// import axios from "../../utils/axios";

// export default function Checkout({ booking_id, user_id }) {
//     const stripe = useStripe();
//     const elements = useElements();

//     const [loading, setLoading] = useState(false);

//     const handleSubmit = async (e) => {
//         e.preventDefault();

//         if (!stripe || !elements || loading) return;

//         setLoading(true);

//         try {
//             // 1. Create payment method from card
//             const { error, paymentMethod } = await stripe.createPaymentMethod({
//                 type: "card",
//                 card: elements.getElement(CardElement),
//             });

//             if (error) {
//                 console.error(error.message);
//                 setLoading(false);
//                 return;
//             }

//             // 2. Send to backend (your auto-confirm controller)
//             const res = await axios.post("/payment/makePayment", {
//                 booking_id,
//                 user_id,
//                 paymentMethodId: paymentMethod.id,
//                 method: "stripe",
//             });

//             const data = res.data;

//             // 3. Handle 3D Secure (if bank requires it)
//             if (data.requiresAction) {
//                 const { error: confirmError, paymentIntent } =
//                     await stripe.confirmCardPayment(data.clientSecret);

//                 if (confirmError) {
//                     console.error(confirmError.message);
//                     alert("Payment verification failed");
//                     setLoading(false);
//                     return;
//                 }

//                 if (paymentIntent?.status === "succeeded") {
//                     alert("Payment successful (verified)");
//                 } else {
//                     alert("Payment not completed");
//                 }

//                 setLoading(false);
//                 return;
//             }

//             // 4. Success case (no 3DS needed)
//             if (data.success) {
//                 alert("Payment successful");
//             } else {
//                 alert(data.message || "Payment failed");
//             }

//         } catch (err) {
//             console.error(err);
//             alert("Something went wrong");
//         }

//         setLoading(false);
//     };

//     return (
//         <div className="min-h-screen flex items-center justify-center bg-gray-100">
//             <form onSubmit={handleSubmit} className="w-full max-w-md p-6">

//                 {/* 💳 Card UI */}
//                 <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">

//                     <div className="flex justify-between items-center mb-6">
//                         <span className="text-lg font-semibold">Credit Card</span>
//                         <span className="text-sm opacity-80">Secure Payment</span>
//                     </div>

//                     <div className="bg-white rounded-lg p-3 text-black">
//                         <CardElement
//                             options={{
//                                 style: {
//                                     base: {
//                                         fontSize: "16px",
//                                         color: "#111827",
//                                         "::placeholder": {
//                                             color: "#9ca3af",
//                                         },
//                                     },
//                                     invalid: {
//                                         color: "#ef4444",
//                                     },
//                                 },
//                                 hidePostalCode: true,
//                             }}
//                         />
//                     </div>

//                     <div className="flex justify-between items-center mt-6 text-sm opacity-90">
//                         <span>**** **** **** ****</span>
//                         <span>MM/YY</span>
//                     </div>
//                 </div>

//                 {/* Pay Button */}
//                 <button
//                     type="submit"
//                     disabled={loading || !stripe}
//                     className="w-full mt-6 bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
//                 >
//                     {loading ? "Processing..." : "Pay Now"}
//                 </button>

//             </form>
//         </div>
//     );
// }


"use client";

import { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import axios from "../../utils/axios";

export default function Checkout({ booking_id, user_id }) {
    const stripe = useStripe();
    const elements = useElements();

    const [method, setMethod] = useState("stripe"); // stripe | paypal | wallet
    const [loading, setLoading] = useState(false);

    // =============================
    // 💳 STRIPE PAYMENT
    // =============================

    const handleStripePayment = async () => {
        if (!stripe || !elements) return;

        const { error, paymentMethod } = await stripe.createPaymentMethod({
            type: "card",
            card: elements.getElement(CardElement),
        });
        console.log(paymentMethod.id)
        if (error) {
            alert(error.message);
            return;
        }

        const res = await axios.post("/payment/makePayment", {
            booking_id,
            user_id,
            paymentMethodId: paymentMethod.id,
            method: "stripe",
        });

        const data = res.data;

        // 3DS handling
        if (data.requiresAction) {
            const { error: confirmError, paymentIntent } =
                await stripe.confirmCardPayment(data.clientSecret);

            if (confirmError) {
                alert(confirmError.message);
                return;
            }

            if (paymentIntent.status === "succeeded") {
                alert("Payment successful (3DS verified)");
            }

            return;
        }

        if (data.success) {
            alert("Payment successful");
        } else {
            alert(data.message || "Payment failed");
        }
    };

    // =============================
    // 💰 PAYPAL PAYMENT
    // =============================
    const handlePayPalPayment = async () => {
        // 1. Create order from backend
        const orderRes = await axios.post("/payment/create-paypal-order", {
            booking_id,
            user_id,
        });

        const { orderId } = orderRes.data;

        // 2. Capture payment
        const captureRes = await axios.post("/payment/makePayment", {
            booking_id,
            user_id,
            method: "paypal",
            paypalOrderId: orderId,
        });

        if (captureRes.data.success) {
            alert("PayPal payment successful");
        } else {
            alert("PayPal payment failed");
        }
    };

    // =============================
    // 💼 WALLET PAYMENT
    // =============================
    const handleWalletPayment = async () => {
        const res = await axios.post("/payment/makePayment", {
            booking_id,
            user_id: "69e85523011d17748fa56100",
            method: "wallet",
        });

        if (res.data.success) {
            alert("Paid using wallet");
        } else {
            alert(res.data.message || "Wallet payment failed");
        }
    };

    // =============================
    // 🚀 MAIN SUBMIT
    // =============================
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (loading) return;
        setLoading(true);

        try {
            if (method === "stripe") {
                await handleStripePayment();
            }

            if (method === "paypal") {
                await handlePayPalPayment();
            }

            if (method === "wallet") {
                await handleWalletPayment();
            }

        } catch (err) {
            console.error(err);
            alert("Something went wrong");
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <form onSubmit={handleSubmit} className="w-full max-w-md p-6">

                {/* =============================
                    🔘 PAYMENT METHOD SELECT
                ============================= */}
                <div className="mb-6">
                    <label className="block mb-2 font-semibold">
                        Select Payment Method
                    </label>

                    <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="w-full p-3 rounded-lg border"
                    >
                        <option value="stripe">Card (Stripe)</option>
                        <option value="paypal">PayPal</option>
                        <option value="wallet">Wallet</option>
                    </select>
                </div>

                {/* =============================
                    💳 STRIPE CARD UI
                ============================= */}
                {method === "stripe" && (
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">

                        <div className="flex justify-between mb-6">
                            <span>Credit Card</span>
                            <span>Stripe</span>
                        </div>

                        <div className="bg-white rounded-lg p-3 text-black">
                            <CardElement
                                options={{
                                    style: {
                                        base: {
                                            fontSize: "16px",
                                            color: "#111827",
                                        },
                                    },
                                    hidePostalCode: true,
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* =============================
                    💰 PAYPAL UI
                ============================= */}
                {method === "paypal" && (
                    <div className="p-4 bg-yellow-100 rounded-lg text-center">
                        <p>Pay using PayPal</p>
                    </div>
                )}

                {/* =============================
                    💼 WALLET UI
                ============================= */}
                {method === "wallet" && (
                    <div className="p-4 bg-green-100 rounded-lg text-center">
                        <p>Pay using Wallet Balance</p>
                    </div>
                )}

                {/* =============================
                    🚀 PAY BUTTON
                ============================= */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-6 bg-black text-white py-3 rounded-lg"
                >
                    {loading ? "Processing..." : "Pay Now"}
                </button>

            </form>
        </div>
    );
}