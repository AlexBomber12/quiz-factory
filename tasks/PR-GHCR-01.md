PR-GHCR-01: Publish Web Image to GHCR + Deploy Compose Template

Read and follow AGENTS.md strictly.

Context
- We already have Docker support for apps/web (apps/web/Dockerfile) and docker-compose.example.yml.
- We want a no-build deployment path for Linux servers: pull a prebuilt image from GitHub Container Registry (GHCR).
- Production owner is alexbomber12.
- Image naming convention: ghcr.io/alexbomber12/<image-name>

Goal
- Add a GitHub Actions workflow that builds and publishes the web image to GHCR on:
  - push to main
  - git tags like v*
- For pull_request events: build the image but do not push it.
- Add a deploy compose template that uses the GHCR image (no local build).
- Add a short runbook doc describing how to deploy on a fresh Linux machine using the GHCR image.
- Do not commit secrets.

Image requirements
- GHCR image: ghcr.io/alexbomber12/quiz-factory-web
- Tags must include:
  - latest (only on default branch)
  - sha-<shortsha> (for every push build)
  - v<semver> tags when the git ref is a tag (v*)
- Use docker/metadata-action to generate tags and OCI labels.

Workflow requirements (GitHub Actions)
- Add .github/workflows/ghcr-web.yml with:
  - permissions: contents: read, packages: write
  - docker/setup-buildx-action
  - docker/login-action for ghcr.io using GITHUB_TOKEN
  - docker/metadata-action to generate tags and labels for ghcr.io/alexbomber12/quiz-factory-web
  - docker/build-push-action to build from:
    - context: .
    - file: apps/web/Dockerfile
  - Use GitHub Actions cache:
    - cache-from: type=gha
    - cache-to: type=gha,mode=max
- Ensure the workflow does not push images for pull_request events.

Deploy compose template
- Add docker-compose.ghcr.example.yml (or infra/deploy/docker-compose.ghcr.example.yml) that defines:
  - content-db (Postgres) with a named volume
  - web service using:
    - image: ghcr.io/alexbomber12/quiz-factory-web:${QF_WEB_IMAGE_TAG:-latest}
    - env_file: .env.production
    - ports: 3000:3000
    - depends_on content-db healthcheck
- Do not remove the existing docker-compose.example.yml.

Docs
- Add docs/deploy/ghcr.md with:
  - how to run bootstrap (PR-DOCKER-EXAMPLES-01) to create .env.production and local configs
  - how to deploy with GHCR compose:
    - docker compose -f docker-compose.ghcr.example.yml pull
    - docker compose -f docker-compose.ghcr.example.yml up -d
  - note about package visibility:
    - if the package is private, server must docker login with a PAT that has read:packages
    - if the package is public, docker pull can be anonymous
  - how to pin to a specific sha- tag and how to rollback

Workflow rules
- Create a new branch from main named: pr-ghcr-01
- Implement only what this task requests.
- Run the project test gate locally before committing.
- Commit message: "PR-GHCR-01: publish web image to GHCR"
- Push the branch and open a PR.

Success criteria
- A push to main publishes ghcr.io/alexbomber12/quiz-factory-web:latest and ghcr.io/alexbomber12/quiz-factory-web:sha-<shortsha>.
- A pushed tag vX.Y.Z publishes ghcr.io/alexbomber12/quiz-factory-web:vX.Y.Z (plus sha tag).
- Pull request builds run but do not push any images.
- docker-compose.ghcr.example.yml can start the stack using only docker pull (no local build).
- No secrets are added to the repo.
