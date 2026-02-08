# Docker Deploy (Single Host)

## Prerequisites
- Docker Engine 24+ running on a Linux host.
- Docker Compose plugin (`docker compose` command).

## Bootstrap and configure
1. Run bootstrap:
   ```bash
   ./scripts/bootstrap.sh
   ```
2. Edit `config/tenants.local.json` and set:
   - `tenant_id` (for example `tenant-qf-local`)
   - `domains` (for example `qf.local`)
3. Point your browser host to the Linux machine:
   - DNS: create an `A`/`AAAA` record for `qf.local`, or
   - Hosts file: add `<LINUX_HOST_IP> qf.local`
4. Review `.env.production` and replace non-generated placeholders as needed.

## Start services
```bash
docker compose up -d --build
```

## Health checks
- API health:
  ```bash
  curl -sSf -H "Host: qf.local" http://localhost:3000/api/health
  ```
- Browser:
  - Open `http://qf.local:3000/` from a machine that resolves `qf.local` to the Linux host.

## Troubleshooting
- Ports already in use:
  - Change `web` host port mapping in `docker-compose.yml` (for example `3001:3000`).
- View logs:
  ```bash
  docker compose logs -f web
  docker compose logs -f content-db
  ```
- Reset database:
  ```bash
  docker compose down -v
  docker compose up -d --build
  ```
- Need DB access from host for debugging:
  - Create `docker-compose.override.yml` with:
    ```yaml
    services:
      content-db:
        ports:
          - "5433:5432"
    ```
