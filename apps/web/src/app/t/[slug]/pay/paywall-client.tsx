"use client";

import { useEffect, useMemo, useState } from "react";

import type { OfferKey } from "../../../../lib/pricing";

type PaywallOption = {
  offerKey: OfferKey;
  label: string;
  priceLabel: string;
  badge?: string;
  description?: string;
};

type PaywallClientProps = {
  testId: string;
  sessionId?: string | null;
  slug: string;
  options: ReadonlyArray<PaywallOption>;
  creditsRemaining: number;
  hasReportAccess: boolean;
  preferredOfferKey?: OfferKey | null;
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

export default function PaywallClient({
  testId,
  sessionId,
  slug,
  options,
  creditsRemaining,
  hasReportAccess,
  preferredOfferKey = null
}: PaywallClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOfferKey, setActiveOfferKey] = useState<OfferKey | null>(null);
  const [activeCredit, setActiveCredit] = useState(false);
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
    setActiveCredit(false);
    setActiveOfferKey(option.offerKey);
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
          offer_key: option.offerKey,
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
          offer_key: option.offerKey,
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
      setActiveOfferKey(null);
    }
  };

  const handleCreditAccess = async () => {
    if (isSubmitting || !hasReportAccess) {
      return;
    }

    setIsSubmitting(true);
    setActiveOfferKey(null);
    setActiveCredit(true);
    setError(null);

    try {
      const response = await fetch("/api/report/issue", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          slug,
          test_id: testId,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error("Unable to unlock report.");
      }

      const payload = (await response.json()) as { ok?: boolean; test_id?: string };
      if (!payload.ok || payload.test_id !== testId) {
        throw new Error("Unable to unlock report.");
      }

      window.location.assign(`/report/${slug}`);
    } catch {
      setError("Unable to unlock your report. Please try again.");
    } finally {
      setIsSubmitting(false);
      setActiveCredit(false);
    }
  };

  let creditButtonLabel = "Open your report";
  if (activeCredit) {
    creditButtonLabel = "Unlocking report...";
  } else if (creditsRemaining > 0) {
    creditButtonLabel = "Use 1 credit";
  }

  const orderedOptions = useMemo(() => {
    if (!preferredOfferKey) {
      return [...options];
    }

    const preferredOption = options.find((option) => option.offerKey === preferredOfferKey);
    if (!preferredOption) {
      return [...options];
    }

    const remaining = options.filter((option) => option.offerKey !== preferredOfferKey);
    return [preferredOption, ...remaining];
  }, [options, preferredOfferKey]);

  return (
    <div className="runner-card">
      <h2 className="runner-question">Choose your report</h2>
      {creditsRemaining > 0 ? (
        <p className="status-message">
          {creditsRemaining === 1
            ? "You have 1 credit remaining."
            : `You have ${creditsRemaining} credits remaining.`}
        </p>
      ) : null}
      {hasReportAccess ? (
        <button
          className="primary-button"
          type="button"
          disabled={isSubmitting}
          onClick={handleCreditAccess}
        >
          {creditButtonLabel}
        </button>
      ) : null}
      <ul className="option-list" aria-label="Paywall options">
        {orderedOptions.map((option) => {
          const isActive = activeOfferKey === option.offerKey;
          const isPreferred = preferredOfferKey === option.offerKey;
          const badgePrefix = option.badge ? `${option.badge} · ` : "";
          const preferredPrefix = isPreferred ? "Recommended · " : "";
          const label = isActive
            ? "Starting checkout..."
            : `${preferredPrefix}${badgePrefix}${option.label} - ${option.priceLabel}`;
          const buttonClassName = isPreferred
            ? "option-button border-foreground/40 bg-accent/40"
            : "option-button";
          return (
            <li key={option.offerKey}>
              <button
                className={buttonClassName}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleCheckout(option)}
              >
                {label}
              </button>
              {option.description ? <p>{option.description}</p> : null}
            </li>
          );
        })}
      </ul>
      <p>Secure checkout powered by Stripe.</p>
      {error ? <p className="status-message">{error}</p> : null}
    </div>
  );
}
