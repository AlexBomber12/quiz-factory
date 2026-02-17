CREATE TABLE IF NOT EXISTS products (
  product_id text PRIMARY KEY
    CHECK (product_id ~ '^product-[a-z0-9]+(?:-[a-z0-9]+)*$'),
  slug text NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  spec_json jsonb NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_versions_product_id_version_unique UNIQUE (product_id, version)
);

CREATE INDEX IF NOT EXISTS idx_product_versions_product_id
  ON product_versions (product_id);

CREATE INDEX IF NOT EXISTS idx_product_versions_status
  ON product_versions (status);

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
