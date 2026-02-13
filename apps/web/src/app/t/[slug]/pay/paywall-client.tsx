"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../../../components/ui/card";
import type { OfferKey } from "../../../../lib/pricing";
import { cn } from "../../../../lib/ui/cn";

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
  isUpsell?: boolean;
};

const FLOW_CARD_CLASS_NAME =
  "border-border/70 bg-card/95 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.55)]";

const ERROR_BANNER_CLASS_NAME =
  "rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive";

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
  preferredOfferKey = null,
  isUpsell = false
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
          is_upsell: isUpsell,
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
    <Card className={FLOW_CARD_CLASS_NAME}>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.18em]">
            Checkout
          </Badge>
          {preferredOfferKey ? (
            <Badge className="w-fit border-transparent bg-[hsl(var(--brand-terracotta)/0.2)] text-[hsl(var(--brand-navy))]">
              Recommended preselected
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-2xl sm:text-3xl">Choose your report</CardTitle>
        <CardDescription className="text-base text-muted-foreground">
          Select the option that matches the depth you want right now.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {creditsRemaining > 0 ? (
          <div className="rounded-xl border border-[hsl(var(--brand-teal)/0.35)] bg-[hsl(var(--brand-teal)/0.08)] p-4">
            <p className="text-sm font-medium text-foreground/90">
              {creditsRemaining === 1
                ? "You have 1 credit remaining."
                : `You have ${creditsRemaining} credits remaining.`}
            </p>
          </div>
        ) : null}

        {hasReportAccess ? (
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isSubmitting}
            onClick={handleCreditAccess}
          >
            {creditButtonLabel}
          </Button>
        ) : null}

        {orderedOptions.length > 0 ? (
          <ul className="space-y-3" aria-label="Paywall options">
            {orderedOptions.map((option) => {
              const isActive = activeOfferKey === option.offerKey;
              const isPreferred = preferredOfferKey === option.offerKey;
              const actionLabel = isActive
                ? "Starting checkout..."
                : isPreferred
                  ? "Recommended · Continue to checkout"
                  : "Continue to checkout";

              return (
                <li
                  key={option.offerKey}
                  className={cn(
                    "rounded-xl border p-4",
                    isPreferred
                      ? "border-[hsl(var(--brand-terracotta)/0.55)] bg-[hsl(var(--brand-terracotta)/0.1)]"
                      : "border-border/70 bg-card/80"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">{option.label}</p>
                      {option.description ? (
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className="border-[hsl(var(--brand-teal)/0.4)] bg-[hsl(var(--brand-teal)/0.08)] text-[hsl(var(--brand-teal))]"
                      >
                        {option.priceLabel}
                      </Badge>
                      {option.badge ? (
                        <Badge className="border-transparent bg-muted text-foreground">
                          {option.badge}
                        </Badge>
                      ) : null}
                      {isPreferred ? (
                        <Badge className="border-transparent bg-[hsl(var(--brand-terracotta)/0.2)] text-[hsl(var(--brand-navy))]">
                          Recommended
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    variant={isPreferred ? "default" : "outline"}
                    disabled={isSubmitting}
                    onClick={() => handleCheckout(option)}
                  >
                    {actionLabel}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Checkout options are temporarily unavailable. Please try again in a moment.
          </p>
        )}

        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Secure checkout powered by Stripe.
        </p>

        {error ? <p className={ERROR_BANNER_CLASS_NAME}>{error}</p> : null}
      </CardContent>
    </Card>
  );
}
