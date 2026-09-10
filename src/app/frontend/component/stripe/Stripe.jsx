"use client";

import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import Checkout from "./Checkout";

const stripePromise = loadStripe("pk_test_51RuYLAEjJK6lYSvf6DQBxxdXlTSMnHfO032DsdexDTPRJSPhNU6Of2hU3nyjpFxWzrywWtAToQt9rZl5AgzWJRsb00wNX3lcXa");

export default function Page() {
  return (
    <Elements stripe={stripePromise}>
      <Checkout booking_id="69e889c1c7d2a59471a7a218" user_id="69f0646b0b31c6057b5e12e9" />
    </Elements>
  );
}