export const mergeHrefWithSearchParams = (href: string, currentSearchParams: URLSearchParams): string => {
  const normalizedHref = href.trim();
  if (!normalizedHref) {
    return href;
  }

  if (currentSearchParams.toString().length === 0) {
    return normalizedHref;
  }

  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalizedHref);
  const base = hasProtocol ? undefined : "https://quiz-factory.local";
  const url = new URL(normalizedHref, base);

  currentSearchParams.forEach((value, key) => {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  });

  if (hasProtocol) {
    return `${url.origin}${url.pathname}${url.search}${url.hash}`;
  }

  return `${url.pathname}${url.search}${url.hash}`;
};
