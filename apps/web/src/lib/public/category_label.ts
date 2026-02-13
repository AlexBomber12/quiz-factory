const SLUG_CATEGORY_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/;

const normalizeLabel = (value: string): string => value.trim();

const capitalizeFirstWord = (value: string): string => {
  if (value.length === 0) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const toHumanCategoryLabel = (value: string): string => {
  const label = normalizeLabel(value);
  if (!label) {
    return "";
  }

  if (!SLUG_CATEGORY_PATTERN.test(label)) {
    return label;
  }

  const words = label.split(/[-_]+/g).filter(Boolean);
  if (words.length === 0) {
    return label;
  }

  const [firstWord, ...restWords] = words;
  return [capitalizeFirstWord(firstWord), ...restWords].join(" ");
};

export const resolveCategoryLabel = (
  label: string,
  slug: string,
  fallback = "General"
): string => {
  const normalizedLabel = toHumanCategoryLabel(label);
  if (normalizedLabel.length > 0) {
    return normalizedLabel;
  }

  const normalizedSlug = toHumanCategoryLabel(slug);
  if (normalizedSlug.length > 0) {
    return normalizedSlug;
  }

  return fallback;
};
