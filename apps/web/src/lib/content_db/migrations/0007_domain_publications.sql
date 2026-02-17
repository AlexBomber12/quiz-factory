CREATE TABLE IF NOT EXISTS content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_key text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_items_content_type_content_key_unique UNIQUE (content_type, content_key),
  CONSTRAINT content_items_content_type_slug_unique UNIQUE (content_type, slug)
);

CREATE INDEX IF NOT EXISTS idx_content_items_content_type
  ON content_items (content_type);

DROP TRIGGER IF EXISTS content_items_set_updated_at ON content_items;
CREATE TRIGGER content_items_set_updated_at
BEFORE UPDATE ON content_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS domain_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  published_version_id uuid,
  enabled boolean NOT NULL DEFAULT TRUE,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_publications_tenant_id_content_item_id_unique UNIQUE (tenant_id, content_item_id)
);

CREATE INDEX IF NOT EXISTS idx_domain_publications_tenant_id
  ON domain_publications (tenant_id);

CREATE INDEX IF NOT EXISTS idx_domain_publications_content_item_id
  ON domain_publications (content_item_id);

CREATE INDEX IF NOT EXISTS idx_domain_publications_published_version_id
  ON domain_publications (published_version_id);

DROP TRIGGER IF EXISTS domain_publications_set_updated_at ON domain_publications;
CREATE TRIGGER domain_publications_set_updated_at
BEFORE UPDATE ON domain_publications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO content_items (
  content_type,
  content_key,
  slug
)
SELECT
  'test' AS content_type,
  t.test_id AS content_key,
  t.slug
FROM tests t
ON CONFLICT (content_type, content_key) DO UPDATE
SET slug = EXCLUDED.slug;

INSERT INTO tenants (
  tenant_id,
  default_locale,
  enabled
)
SELECT DISTINCT
  tt.tenant_id,
  'en' AS default_locale,
  TRUE AS enabled
FROM tenant_tests tt
LEFT JOIN tenants tenant_row
  ON tenant_row.tenant_id = tt.tenant_id
WHERE tenant_row.tenant_id IS NULL;

INSERT INTO domain_publications (
  tenant_id,
  content_item_id,
  published_version_id,
  enabled,
  published_at
)
SELECT
  tt.tenant_id,
  ci.id AS content_item_id,
  tt.published_version_id,
  tt.is_enabled AS enabled,
  tt.published_at
FROM tenant_tests tt
JOIN tests t
  ON t.id = tt.test_id
JOIN content_items ci
  ON ci.content_type = 'test'
  AND ci.content_key = t.test_id
ON CONFLICT (tenant_id, content_item_id) DO UPDATE
SET
  published_version_id = EXCLUDED.published_version_id,
  enabled = EXCLUDED.enabled,
  published_at = COALESCE(EXCLUDED.published_at, domain_publications.published_at);

ALTER TABLE tenant_tests RENAME TO tenant_tests_legacy;

CREATE OR REPLACE VIEW tenant_tests AS
SELECT
  dp.tenant_id,
  t.id AS test_id,
  dp.published_version_id,
  dp.enabled AS is_enabled,
  dp.published_at,
  NULL::text AS published_by
FROM domain_publications dp
JOIN content_items ci
  ON ci.id = dp.content_item_id
JOIN tests t
  ON ci.content_type = 'test'
  AND ci.content_key = t.test_id;
