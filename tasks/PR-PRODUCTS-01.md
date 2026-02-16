PR-PRODUCTS-01: Products Content Type Skeleton + Publish to Domains

Read and follow AGENTS.md strictly.

Context
- Domains will host more than tests over time. We need at least 1 additional content type to validate the universal publication model.
- This PR introduces products as a skeleton: content, versions, publishing, and minimal public pages.

Goal
- Implement products as a new content type:
  - products registry and versioning in Content DB
  - publishing to domains via the universal domain_publications model
  - minimal public pages to browse and view products for a tenant

Non-goals
- Do not implement payments for products in this PR.
- Do not implement inventory, shipping, carts, or checkout for products.

Implementation requirements
- DB schema
  - Add migration creating:
    - products:
      - product_id text PRIMARY KEY (use product-<slug> pattern)
      - slug text UNIQUE NOT NULL
      - created_at, updated_at
    - product_versions:
      - id uuid PK
      - product_id text REFERENCES products(product_id) ON DELETE CASCADE
      - version integer NOT NULL
      - status text (draft, published, archived)
      - spec_json jsonb NOT NULL (title, description, price fields, images, attributes, locales)
      - created_by text
      - created_at
      - UNIQUE(product_id, version)
- Admin UI
  - /admin/products: list products + create new
  - /admin/products/[product_id]: versions list + create draft version + publish to tenant
  - publishing must create/update:
    - content_items row with content_type=product, content_key=product_id, slug
    - domain_publications row for tenant
- Public UI (minimal)
  - /products: list published products for tenant
  - /p/[slug]: product detail for tenant
  - reuse the same tenant resolution and content source selection logic
- API
  - Add content provider functions for products:
    - listTenantProducts
    - loadPublishedProductBySlug
  - Use the universal publications model to decide what is published.
- Testing
  - basic unit tests for repo functions and public route behavior for empty and non-empty tenant catalogs

Workflow rules
- Create a new branch from main named: pr-products-01-skeleton
- Implement only what this task requests.

Definition of Done
- A product can be created and versioned in admin.
- A product version can be published to a tenant and appears on the public /products page for that tenant.
- Existing tests flow remains unaffected.
- scripts/ci.sh --scope app passes.
