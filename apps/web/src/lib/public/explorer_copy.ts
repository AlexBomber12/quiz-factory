export type TenantExplorerCopy = {
  sectionHeading: string;
  searchPlaceholder: string;
  emptyCatalogTitle: string;
  emptyCatalogDescription: string;
  smallCatalogTitle: string;
  smallCatalogDescription: string;
};

export const DEFAULT_TENANT_EXPLORER_COPY: TenantExplorerCopy = Object.freeze({
  sectionHeading: "Featured Assessments",
  searchPlaceholder: "Search for tests (e.g., Big Five, Leadership, Career)...",
  emptyCatalogTitle: "New assessments are on the way",
  emptyCatalogDescription:
    "We are curating this catalog right now. Please check back soon for new assessments.",
  smallCatalogTitle: "Curated starter set",
  smallCatalogDescription:
    "This catalog is intentionally focused. Start with one option now and return as more assessments are added."
});
