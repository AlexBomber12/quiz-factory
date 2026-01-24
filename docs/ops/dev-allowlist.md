# Dev Allowlist Mode

Purpose
- Local development should work without editing `config/tenants.json`.
- Production remain strict and only allow tenant domains.

Behavior
- Production (`NODE_ENV=production`): Host and Origin must match tenant domains; missing Origin is rejected.
- Non-production: Host and Origin allow localhost/loopback (`localhost`, `127.0.0.1`, `::1`) on any port.
- Optional: set `EXTRA_ALLOWED_HOSTS` (comma-separated) to allow additional hosts in non-production.

Usage
- Run the web app locally at `http://localhost:3000` and call `/api/page/view` or `/api/test/start` without 403s.
- To allow extra hosts in dev:
  - `EXTRA_ALLOWED_HOSTS=preview.localhost,devbox.example.com:3001`

Notes
- Do not set `NODE_ENV=production` locally unless you want strict allowlist checks.
- Production behavior is unchanged and continues to reject unknown hosts.
