"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

import { emitReportPdfDownload } from "@/lib/product/client";
import type { ReportPdfMode } from "@/lib/report/pdf_mode";
import { Button } from "@/components/ui/button";

type ReportPdfButtonProps = {
  testId: string;
  purchaseId: string;
  slug: string;
  pdfMode: ReportPdfMode;
  reportLinkToken: string | null;
};

export default function ReportPdfButton({
  testId,
  purchaseId,
  slug,
  pdfMode,
  reportLinkToken
}: ReportPdfButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const downloadPdf = async (response: Response): Promise<boolean> => {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/pdf")) {
      return false;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${slug}-report.pdf`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    return true;
  };

  const handleClick = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    let shouldNavigateToPrint = pdfMode !== "server";
    try {
      const response = await emitReportPdfDownload({
        test_id: testId,
        purchase_id: purchaseId
      });
      if (pdfMode === "server") {
        const downloaded = await downloadPdf(response);
        shouldNavigateToPrint = !downloaded;
      }
    } catch (error) {
      logger.warn({ error }, "app/report/[slug]/report-pdf-button.tsx fallback handling failed");
      // Best-effort analytics, continue to print view.
      shouldNavigateToPrint = true;
    } finally {
      setIsSubmitting(false);
      if (shouldNavigateToPrint) {
        const printPath = reportLinkToken
          ? `/report/${slug}/print?t=${encodeURIComponent(reportLinkToken)}`
          : `/report/${slug}/print`;
        router.push(printPath);
      }
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={isSubmitting}
      className="print:hidden"
    >
      Save as PDF
    </Button>
  );
}
