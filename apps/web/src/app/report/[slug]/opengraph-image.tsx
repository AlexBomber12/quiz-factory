import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../lib/content/load";
import { buildTenantLabel } from "../../../lib/seo/metadata";
import { resolveTenantContext } from "../../../lib/tenants/request";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

type PageProps = {
  params: {
    slug: string;
  };
};

const containerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: "64px",
  backgroundColor: "#111827",
  color: "#f9fafb",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system"
};

const eyebrowStyle: CSSProperties = {
  fontSize: 26,
  letterSpacing: 2,
  textTransform: "uppercase",
  opacity: 0.8
};

const titleStyle: CSSProperties = {
  fontSize: 74,
  fontWeight: 700,
  lineHeight: 1.05,
  marginTop: 20,
  marginBottom: 12
};

const descriptionStyle: CSSProperties = {
  fontSize: 30,
  opacity: 0.9,
  maxWidth: 980
};

const resolveReportTestId = (slug: string, tenantId: string): string | null => {
  const testId = resolveTestIdBySlug(slug);
  if (!testId) {
    return null;
  }

  const allowedTests = getTenantTestIds(tenantId);
  return allowedTests.includes(testId) ? testId : null;
};

export default async function OpenGraphImage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const tenantLabel = buildTenantLabel(context);
  const testId = resolveReportTestId(params.slug, context.tenantId);
  const test = testId ? loadLocalizedTest(testId, context.locale) : null;

  const title = test?.report_title ?? "Quiz Factory report";
  const description = test?.description ?? "Your paid report is ready.";

  return new ImageResponse(
    (
      <div style={containerStyle}>
        <div style={eyebrowStyle}>{tenantLabel}</div>
        <div>
          <div style={titleStyle}>{title}</div>
          <div style={descriptionStyle}>{description}</div>
        </div>
      </div>
    ),
    size
  );
}

