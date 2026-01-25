"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { emitReportPdfDownload } from "../../../lib/product/client";
import type { ReportPdfMode } from "../../../lib/report/pdf_mode";
import { Button } from "../../../components/ui/button";

type ReportPdfButtonProps = {
  testId: string;
  purchaseId: string;
  slug: string;
  pdfMode: ReportPdfMode;
};

export default function ReportPdfButton({
  testId,
  purchaseId,
  slug,
  pdfMode
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
    } catch {
      // Best-effort analytics, continue to print view.
      shouldNavigateToPrint = true;
    } finally {
      setIsSubmitting(false);
      if (shouldNavigateToPrint) {
        router.push(`/report/${slug}/print`);
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
