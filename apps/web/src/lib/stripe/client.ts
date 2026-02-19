import { env } from "@/lib/env";
import Stripe from "stripe";

const STRIPE_API_VERSION = "2023-10-16";

export const createStripeClient = (): Stripe | null => {
  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
};
