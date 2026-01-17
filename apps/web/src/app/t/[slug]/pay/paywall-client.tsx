"use client";

import { useEffect, useState } from "react";

type PaywallOption = {
  id: string;
  label: string;
  priceLabel: string;
  productType: "single" | "pack_5" | "pack_10";
  pricingVariant: "intro" | "base";
};

type PaywallClientProps = {
  testId: string;
  sessionId?: string | null;
  options: ReadonlyArray<PaywallOption>;
};

const createPurchaseId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand % 4) + 8;
    return value.toString(16);
  });
};

export default function PaywallClient({ testId, sessionId, options }: PaywallClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const payload: Record<string, string> = { test_id: testId };
    if (sessionId) {
      payload.session_id = sessionId;
    }

    void fetch("/api/paywall/view", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }).catch(() => null);
  }, [testId, sessionId]);

  const handleCheckout = async (option: PaywallOption) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setActiveOptionId(option.id);
    setError(null);

    const purchaseId = createPurchaseId();

    try {
      const startResponse = await fetch("/api/checkout/start", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          test_id: testId,
          session_id: sessionId,
          product_type: option.productType,
          pricing_variant: option.pricingVariant,
          is_upsell: false,
          purchase_id: purchaseId
        })
      });

      if (!startResponse.ok) {
        throw new Error("Checkout start failed.");
      }

      const startPayload = (await startResponse.json()) as {
        stripe_metadata?: Record<string, string>;
      };

      const stripeMetadata = startPayload.stripe_metadata;
      if (!stripeMetadata || typeof stripeMetadata !== "object") {
        throw new Error("Missing stripe metadata.");
      }

      const createResponse = await fetch("/api/checkout/create", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          purchase_id: purchaseId,
          product_type: option.productType,
          pricing_variant: option.pricingVariant,
          stripe_metadata: stripeMetadata
        })
      });

      if (!createResponse.ok) {
        throw new Error("Checkout create failed.");
      }

      const createPayload = (await createResponse.json()) as {
        checkout_url?: string;
      };
      const checkoutUrl = createPayload.checkout_url;
      if (!checkoutUrl) {
        throw new Error("Missing checkout URL.");
      }

      window.location.assign(checkoutUrl);
    } catch {
      setError("Unable to start checkout. Please try again.");
    } finally {
      setIsSubmitting(false);
      setActiveOptionId(null);
    }
  };

  return (
    <div className="runner-card">
      <h2 className="runner-question">Choose your report</h2>
      <ul className="option-list" aria-label="Paywall options">
        {options.map((option) => {
          const isActive = activeOptionId === option.id;
          const label = isActive
            ? "Starting checkout..."
            : `${option.label} - ${option.priceLabel}`;
          return (
            <li key={option.id}>
              <button
                className="option-button"
                type="button"
                disabled={isSubmitting}
                onClick={() => handleCheckout(option)}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
      <p>Secure checkout powered by Stripe.</p>
      {error ? <p className="status-message">{error}</p> : null}
    </div>
  );
}
