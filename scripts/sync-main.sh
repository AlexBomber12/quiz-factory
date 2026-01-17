#!/usr/bin/env bash
set -euo pipefail

current_branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$current_branch" == "main" ]]; then
  git pull --ff-only origin main
else
  git fetch origin main:main --prune
fi
