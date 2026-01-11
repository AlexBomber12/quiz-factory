# Development

## Web app

1. `corepack enable`
2. `pnpm install --frozen-lockfile`
3. `pnpm dev`

## Analytics (dbt)

1. `uv sync --frozen`
2. `uv run dbt deps`
3. `uv run dbt parse`
