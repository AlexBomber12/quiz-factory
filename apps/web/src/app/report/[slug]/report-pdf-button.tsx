"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { emitReportPdfDownload } from "../../../lib/product/client";
import { Button } from "../../../components/ui/button";

type ReportPdfButtonProps = {
  testId: string;
  purchaseId: string;
  slug: string;
};

export default function ReportPdfButton({
  testId,
  purchaseId,
  slug
}: ReportPdfButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await emitReportPdfDownload({
        test_id: testId,
        purchase_id: purchaseId
      });
    } catch {
      // Best-effort analytics, continue to print view.
    } finally {
      router.push(`/report/${slug}/print`);
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
