#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p artifacts

./scripts/ci.sh 2>&1 | tee artifacts/ci.log

git fetch origin main

git diff --binary origin/main...HEAD > artifacts/pr.patch

timestamp_utc="$(date -u +%Y%m%d-%H%M%S)"
timestamped_snapshot="artifacts/snapshot_${timestamp_utc}.zip"
stable_snapshot="artifacts/snapshot.zip"

git archive --format=zip -o "$timestamped_snapshot" HEAD
cp "$timestamped_snapshot" "$stable_snapshot"

snapshot_size_bytes="$(wc -c < "$timestamped_snapshot" | tr -d '[:space:]')"
printf 'Snapshot timestamp (UTC): %s\n' "$timestamp_utc"
printf 'Snapshot artifact: %s\n' "$timestamped_snapshot"
printf 'Snapshot size (bytes): %s\n' "$snapshot_size_bytes"
printf 'Snapshot alias: %s\n' "$stable_snapshot"
