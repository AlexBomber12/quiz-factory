import { normalizeLocaleTag, type TestSpec } from "../content/types";

const DEFAULT_METADATA_DESCRIPTION = "Take this test to get your result.";

export type AsyncRouteParams<T extends Record<string, unknown>> = Promise<T> | T;

export const resolveRouteParams = async <T extends Record<string, unknown>>(
  params: AsyncRouteParams<T>
): Promise<T> => {
  return Promise.resolve(params);
};

export const safeTrim = (value: unknown, fallback = ""): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export const safeLowercaseSlug = (value: unknown, fallback = "test"): string => {
  const normalizedFallback = safeTrim(fallback, "test").toLowerCase() || "test";
  const normalizedSlug = safeTrim(value, normalizedFallback).toLowerCase();
  return normalizedSlug || normalizedFallback;
};

type SpecMetadata = {
  title: string;
  description: string;
};

const resolveSpecMetadata = (
  spec: TestSpec | null | undefined,
  locale: string | null | undefined
): SpecMetadata => {
  if (!spec) {
    return {
      title: "",
      description: ""
    };
  }

  const normalizedLocale = locale ? normalizeLocaleTag(locale) : null;
  const localized = normalizedLocale ? spec.locales[normalizedLocale] : null;
  if (localized) {
    return {
      title: safeTrim(localized.title, ""),
      description: safeTrim(localized.short_description, "")
    };
  }

  const fallbackLocalized = Object.entries(spec.locales)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value)
    .find((value): value is NonNullable<typeof value> => value !== undefined && value !== null);

  return {
    title: safeTrim(fallbackLocalized?.title, ""),
    description: safeTrim(fallbackLocalized?.short_description, "")
  };
};

const firstNonEmpty = (values: ReadonlyArray<unknown>, fallback: string): string => {
  for (const value of values) {
    const candidate = safeTrim(value, "");
    if (candidate) {
      return candidate;
    }
  }

  return fallback;
};

export type TestMetadataCopyOptions = {
  routeSlug: string;
  slug?: unknown;
  title?: unknown;
  descriptionCandidates?: ReadonlyArray<unknown>;
  spec?: TestSpec | null;
  locale?: string | null;
  fallbackTitle?: string;
  fallbackDescription?: string;
};

export const resolveTestMetadataCopy = (
  options: TestMetadataCopyOptions
): {
  slug: string;
  title: string;
  description: string;
} => {
  const routeSlug = safeLowercaseSlug(options.routeSlug, "test");
  const slug = safeLowercaseSlug(options.slug, routeSlug);
  const specMetadata = resolveSpecMetadata(options.spec, options.locale);
  const fallbackTitle = safeTrim(options.fallbackTitle, slug);
  const fallbackDescription = safeTrim(
    options.fallbackDescription,
    DEFAULT_METADATA_DESCRIPTION
  );
  const title = firstNonEmpty([options.title, specMetadata.title], fallbackTitle);
  const description = firstNonEmpty(
    [...(options.descriptionCandidates ?? []), specMetadata.description],
    fallbackDescription
  );

  return {
    slug,
    title,
    description
  };
};
