import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";

import { loadPublishedTestBySlug } from "../../../lib/content/provider";
import { buildTenantLabel } from "../../../lib/seo/metadata";
import { resolveRouteParams, safeLowercaseSlug } from "../../../lib/seo/metadata_safety";
import { resolveTenantContext } from "../../../lib/tenants/request";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

type PageProps = {
  params: Promise<{ slug?: string }> | { slug?: string };
};

const resolveSlugParam = async (params: PageProps["params"]): Promise<string> => {
  const resolved = await resolveRouteParams(params);
  return safeLowercaseSlug(resolved.slug, "test");
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

export default async function OpenGraphImage({ params }: PageProps) {
  const routeSlug = await resolveSlugParam(params);
  const context = await resolveTenantContext();
  const tenantLabel = buildTenantLabel(context);
  const published = await loadPublishedTestBySlug(context.tenantId, routeSlug, context.locale);
  const test = published?.test ?? null;

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
