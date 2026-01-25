import { NextResponse } from "next/server";

import { capturePosthogEvent } from "../../../../lib/analytics/posthog";
import { assertAllowedMethod } from "../../../../lib/security/request_guards";
import { createStripeBigQueryStore } from "../../../../lib/stripe/bigquery";
import { createStripeClient } from "../../../../lib/stripe/client";
import { assertStripeEnvConfigured } from "../../../../lib/stripe/env";
import {
  handleStripeWebhookEvent,
  verifyStripeSignature
} from "../../../../lib/stripe/webhook";

assertStripeEnvConfigured({
  context: "/api/stripe/webhook",
  required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]
});

const isJsonLikeContentType = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
};

export const POST = async (request: Request): Promise<Response> => {
  const methodResponse = assertAllowedMethod(request, ["POST"]);
  if (methodResponse) {
    return methodResponse;
  }

  const contentType = request.headers.get("content-type");
  if (!isJsonLikeContentType(contentType)) {
    return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook secret is not configured." },
      { status: 500 }
    );
  }

  const payload = await request.text();
  const validSignature = verifyStripeSignature({
    payload,
    signatureHeader: signature,
    secret: webhookSecret
  });
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const stripeClient = createStripeClient();
  if (!stripeClient) {
    return NextResponse.json(
      { error: "Stripe secret key is not configured." },
      { status: 500 }
    );
  }

  const store = createStripeBigQueryStore();
  const result = await handleStripeWebhookEvent(event as Parameters<
    typeof handleStripeWebhookEvent
  >[0], {
    store,
    stripeClient,
    captureEvent: capturePosthogEvent
  });

  return NextResponse.json({ received: true, status: result.status });
};
