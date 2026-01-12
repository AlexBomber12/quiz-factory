const HOST_PORT_SEPARATOR = ":";

const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
};

export const resolveTenantId = (hostHeader: string | null): string => {
  const rawHost = hostHeader?.split(HOST_PORT_SEPARATOR)[0] ?? "";
  const slug = slugify(rawHost);
  if (!slug) {
    return "tenant-unknown";
  }

  return `tenant-${slug}`;
};
