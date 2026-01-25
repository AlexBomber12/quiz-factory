import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";

import { resolveTenantTestBySlug } from "../../../lib/catalog/catalog";
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
  backgroundColor: "#0f172a",
  color: "#f8fafc",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system"
};

const eyebrowStyle: CSSProperties = {
  fontSize: 28,
  letterSpacing: 2,
  textTransform: "uppercase",
  opacity: 0.8
};

const titleStyle: CSSProperties = {
  fontSize: 76,
  fontWeight: 700,
  lineHeight: 1.05,
  marginTop: 24,
  marginBottom: 12
};

const descriptionStyle: CSSProperties = {
  fontSize: 32,
  opacity: 0.9,
  maxWidth: 960
};

export default async function OpenGraphImage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const tenantLabel = buildTenantLabel(context);
  const test = resolveTenantTestBySlug(context.tenantId, context.locale, params.slug);

  const title = test?.title ?? "Quiz Factory";
  const description =
    test?.short_description ?? "Browse the available tests and start when ready.";

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
