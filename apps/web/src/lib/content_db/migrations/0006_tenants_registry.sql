CREATE TABLE IF NOT EXISTS tenants (
  tenant_id text PRIMARY KEY,
  default_locale text NOT NULL CHECK (default_locale IN ('en', 'es', 'pt-BR')),
  enabled boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_domains (
  tenant_id text NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  domain text NOT NULL,
  PRIMARY KEY (tenant_id, domain),
  CONSTRAINT tenant_domains_domain_unique UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain
  ON tenant_domains (domain);

DROP TRIGGER IF EXISTS tenants_set_updated_at ON tenants;
CREATE TRIGGER tenants_set_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
