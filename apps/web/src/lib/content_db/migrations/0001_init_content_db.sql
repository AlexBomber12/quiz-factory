CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('uploaded', 'processed', 'failed')),
  files_json jsonb NOT NULL,
  detected_meta jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  default_locale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('draft', 'archived')),
  spec_json jsonb NOT NULL,
  source_import_id uuid REFERENCES imports(id) ON DELETE SET NULL,
  checksum text NOT NULL CHECK (char_length(checksum) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  CONSTRAINT test_versions_test_id_version_unique UNIQUE (test_id, version)
);

CREATE TABLE IF NOT EXISTS tenant_tests (
  tenant_id text NOT NULL,
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  published_version_id uuid REFERENCES test_versions(id) ON DELETE SET NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  published_by text,
  CONSTRAINT tenant_tests_tenant_id_test_id_unique UNIQUE (tenant_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_test_versions_test_id
  ON test_versions (test_id);

CREATE INDEX IF NOT EXISTS idx_tenant_tests_tenant_id
  ON tenant_tests (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_tests_published_version_id
  ON tenant_tests (published_version_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tests_set_updated_at ON tests;
CREATE TRIGGER tests_set_updated_at
BEFORE UPDATE ON tests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
