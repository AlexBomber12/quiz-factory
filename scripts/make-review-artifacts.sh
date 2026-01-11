#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p artifacts

./scripts/ci.sh 2>&1 | tee artifacts/ci.log

git fetch origin main

git diff --binary origin/main...HEAD > artifacts/pr.patch

git archive --format=zip -o artifacts/snapshot.zip HEAD
