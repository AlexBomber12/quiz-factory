"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

import { ADMIN_CSRF_FORM_FIELD, ADMIN_CSRF_HEADER } from "@/lib/admin/csrf";
import { Button } from "@/components/ui/button";

type PublicationToggleButtonProps = {
  csrfToken: string;
  testId: string;
  tenantId: string;
  versionId: string;
  isEnabled: boolean;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as {
      error?: unknown;
      detail?: unknown;
    };
    const errorCode = typeof payload.error === "string" ? payload.error : "request_failed";
    const detail = typeof payload.detail === "string" ? payload.detail : null;
    return detail ? `${errorCode}: ${detail}` : errorCode;
  } catch (error) {
    logger.error({ error }, "app/admin/publications/publication-toggle-button.tsx operation failed");
    return `request_failed: ${response.status}`;
  }
};

export default function PublicationToggleButton({
  csrfToken,
  testId,
  tenantId,
  versionId,
  isEnabled
}: PublicationToggleButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextEnabledState = !isEnabled;

  const runToggle = async () => {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/publish", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          [ADMIN_CSRF_HEADER]: csrfToken
        },
        body: JSON.stringify({
          test_id: testId,
          version_id: versionId,
          tenant_ids: [tenantId],
          is_enabled: nextEnabledState,
          [ADMIN_CSRF_FORM_FIELD]: csrfToken
        })
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "request_failed");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button
        disabled={isPending}
        onClick={() => {
          void runToggle();
        }}
        size="sm"
        type="button"
        variant={nextEnabledState ? "secondary" : "destructive"}
      >
        {nextEnabledState ? "Enable" : "Disable"}
      </Button>
      {errorMessage ? (
        <p className="max-w-[280px] text-xs text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
