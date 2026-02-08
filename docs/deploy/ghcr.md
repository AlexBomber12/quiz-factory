# Deploy with GHCR Image (Single Host)

## Prerequisites
- Docker Engine 24+ running on a Linux host.
- Docker Compose plugin (`docker compose` command).

## Bootstrap local config files
Run bootstrap from PR-DOCKER-EXAMPLES-01 to create local runtime files:

```bash
./scripts/bootstrap.sh
```

This creates local copies such as `.env.production` and `config/tenants.local.json` when missing.
Review and update them for your server before deploying.

## Deploy using prebuilt GHCR image
Use the GHCR compose template (no local image build):

```bash
docker compose -f docker-compose.ghcr.example.yml pull
docker compose -f docker-compose.ghcr.example.yml up -d
```

## GHCR package visibility
- Public package: `docker pull` works anonymously.
- Private package: authenticate on the server first with a PAT that has `read:packages`:

```bash
echo "<GH_PAT_WITH_READ_PACKAGES>" | docker login ghcr.io -u "<github-username>" --password-stdin
```

## Pin and rollback with sha tags
By default, the compose file uses `latest`. To pin a specific build:

```bash
export QF_WEB_IMAGE_TAG=sha-<shortsha>
docker compose -f docker-compose.ghcr.example.yml pull
docker compose -f docker-compose.ghcr.example.yml up -d
```

To rollback, set `QF_WEB_IMAGE_TAG` to an older `sha-` tag and run the same pull/up commands again.
