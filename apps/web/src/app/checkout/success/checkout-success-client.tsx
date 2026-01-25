"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const resolveSlugFromTestId = (testId: string): string | null => {
  const normalized = testId.trim();
  if (!normalized.startsWith("test-")) {
    return null;
  }

  const slug = normalized.slice("test-".length);
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return null;
  }

  return slug;
};

type ConfirmResponse = {
  ok: boolean;
  purchase_id?: string;
  test_id?: string;
};

const CheckoutSuccessContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!sessionId) {
      setError("Missing Stripe session id.");
      setIsLoading(false);
      return () => undefined;
    }

    const confirmSession = async () => {
      setIsLoading(true);
      setError(null);

      let response: Response | null = null;
      try {
        response = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ stripe_session_id: sessionId })
        });
      } catch {
        response = null;
      }

      if (cancelled) {
        return;
      }

      if (!response || !response.ok) {
        setError("We could not confirm your checkout.");
        setIsLoading(false);
        return;
      }

      let payload: ConfirmResponse | null = null;
      try {
        payload = (await response.json()) as ConfirmResponse;
      } catch {
        payload = null;
      }

      if (!payload?.ok || !payload.test_id) {
        setError("We could not confirm your checkout.");
        setIsLoading(false);
        return;
      }

      const slug = resolveSlugFromTestId(payload.test_id);
      if (!slug) {
        setError("We could not resolve your report.");
        setIsLoading(false);
        return;
      }

      router.replace(`/report/${slug}`);
    };

    void confirmSession();

    return () => {
      cancelled = true;
    };
  }, [router, sessionId]);

  return (
    <section className="page">
      <header className="hero">
        <p className="eyebrow">Quiz Factory</p>
        <h1>Preparing your report</h1>
        <p>We are confirming your checkout now.</p>
      </header>

      {error ? (
        <p className="status-message">{error}</p>
      ) : (
        <p>{isLoading ? "This should only take a moment." : "Redirecting now."}</p>
      )}

      <Link className="text-link" href="/">
        Back to tests
      </Link>
    </section>
  );
};

export default function CheckoutSuccessClient() {
  return (
    <Suspense
      fallback={
        <section className="page">
          <header className="hero">
            <p className="eyebrow">Quiz Factory</p>
            <h1>Preparing your report</h1>
            <p>We are confirming your checkout now.</p>
          </header>
          <p>This should only take a moment.</p>
        </section>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}

