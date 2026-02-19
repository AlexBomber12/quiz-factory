"use client";

import { useEffect, useMemo, useState } from "react";
import { logger } from "@/lib/logger";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { emitShareClick } from "@/lib/product/client";

type ReportShareProps = {
  testId: string;
  sessionId: string;
  sharePath: string;
  shareUrl: string | null;
  reportLinkUrl: string | null;
  shareTitle: string;
};

const buildResolvedUrl = (sharePath: string, shareUrl: string | null): string => {
  if (shareUrl) {
    return shareUrl;
  }

  if (typeof window === "undefined") {
    return sharePath;
  }

  try {
    return new URL(sharePath, window.location.origin).toString();
  } catch (error) {
    logger.warn({ error }, "app/report/[slug]/report-share.tsx fallback handling failed");
    return sharePath;
  }
};

const postShareClick = async (testId: string, sessionId: string, shareTarget: string) => {
  try {
    await emitShareClick({
      test_id: testId,
      session_id: sessionId,
      share_target: shareTarget
    });
  } catch (error) {
    logger.warn({ error }, "app/report/[slug]/report-share.tsx fallback handling failed");
    // Best-effort analytics; sharing should still work.
  }
};

export default function ReportShare({
  testId,
  sessionId,
  sharePath,
  shareUrl,
  reportLinkUrl,
  shareTitle
}: ReportShareProps) {
  const resolvedUrl = useMemo(() => buildResolvedUrl(sharePath, shareUrl), [sharePath, shareUrl]);
  const resolvedReportUrl = useMemo(() => {
    if (!reportLinkUrl) {
      return null;
    }

    const trimmed = reportLinkUrl.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }

    return buildResolvedUrl(trimmed, null);
  }, [reportLinkUrl]);
  const [isCopied, setIsCopied] = useState(false);
  const [isReportCopied, setIsReportCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const handle = window.setTimeout(() => setIsCopied(false), 1500);
    return () => window.clearTimeout(handle);
  }, [isCopied]);

  useEffect(() => {
    if (!isReportCopied) {
      return;
    }

    const handle = window.setTimeout(() => setIsReportCopied(false), 1500);
    return () => window.clearTimeout(handle);
  }, [isReportCopied]);

  const shareText = `${shareTitle} - Quiz Factory`;

  const handleCopyQuiz = async () => {
    void postShareClick(testId, sessionId, "copy_link");

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(resolvedUrl);
      setIsCopied(true);
    } catch (error) {
      logger.warn({ error }, "app/report/[slug]/report-share.tsx fallback handling failed");
      setIsCopied(false);
    }
  };

  const handleCopyReport = async () => {
    if (!resolvedReportUrl) {
      return;
    }

    void postShareClick(testId, sessionId, "copy_report_link");

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(resolvedReportUrl);
      setIsReportCopied(true);
    } catch (error) {
      logger.warn({ error }, "app/report/[slug]/report-share.tsx fallback handling failed");
      setIsReportCopied(false);
    }
  };

  const handleExternalShare = (url: string, shareTarget: string) => {
    void postShareClick(testId, sessionId, shareTarget);
    if (typeof window === "undefined") {
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText
  )}&url=${encodeURIComponent(resolvedUrl)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${resolvedUrl}`)}`;

  return (
    <Card className="border-border/60 shadow-sm print:hidden">
      <CardHeader className="space-y-3">
        <Badge variant="secondary" className="w-fit">
          Share
        </Badge>
        <CardTitle className="text-2xl">Share this quiz</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {resolvedReportUrl ? (
          <Button type="button" variant="outline" onClick={handleCopyReport}>
            {isReportCopied ? "Copied" : "Copy report link"}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={handleCopyQuiz}>
          {isCopied ? "Copied" : "Copy link"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleExternalShare(xUrl, "x")}
        >
          Share on X
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleExternalShare(whatsappUrl, "whatsapp")}
        >
          Share on WhatsApp
        </Button>
      </CardContent>
    </Card>
  );
}
