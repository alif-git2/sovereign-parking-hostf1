import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY is missing. Please add it to your .env.local file."
  );
}

export const stripe = new Stripe(stripeSecretKey, {
  /**
   * This is a pinned Stripe API version.
   * Do not call it "latest" because Stripe API versions change over time.
   * You can update this later after checking your Stripe dashboard/API upgrade notes.
   */
  apiVersion: "2023-10-16",

  /**
   * Retry temporary network failures.
   */
  maxNetworkRetries: 2,

  /**
   * Optional timeout in milliseconds.
   */
  timeout: 10000,
});

/**
 * Keep default export for backward compatibility.
 * Some old files in your project imported:
 *
 * import Stripe from "../../../utils/stripeConfig";
 *
 * New code should prefer:
 *
 * import { stripe } from "@/app/backend/utils/stripeConfig";
 */
export default stripe;