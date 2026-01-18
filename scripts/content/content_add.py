#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import validate_catalog

ROOT_DIR = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT_DIR / "config" / "catalog.json"
TESTS_ROOT = ROOT_DIR / "content" / "tests"
SOURCES_ROOT = ROOT_DIR / "content" / "sources"
CONVERTER_PATH = ROOT_DIR / "scripts" / "content" / "values_compass_md_to_spec.py"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Add content sources and update the catalog")
    parser.add_argument("--format", required=True, help="values_compass_v1")
    parser.add_argument("--test-id", required=True)
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--slug")
    parser.add_argument("--category")
    parser.add_argument("--version", type=int)
    return parser.parse_args()


def validate_format(format_id: str, errors: list[str]) -> None:
    if format_id != "values_compass_v1":
        errors.append("format must be values_compass_v1")


def resolve_slug(test_id: str, slug: str | None, errors: list[str]) -> str:
    if slug:
        return slug
    if test_id.startswith("test-"):
        return test_id[len("test-"):]
    errors.append("slug is required when test_id does not start with test-")
    return ""


def resolve_category(category: str | None) -> str:
    return category.strip() if category else "values-compass"


def resolve_version(version: int | None) -> int:
    return version if version is not None else 1


def ensure_sources(test_id: str, errors: list[str]) -> dict[str, Path]:
    source_dir = SOURCES_ROOT / test_id
    sources = {
        "en": source_dir / "source.en.md",
        "es": source_dir / "source.es.md",
        "pt-BR": source_dir / "source.pt-BR.md"
    }
    for locale, path in sources.items():
        if not path.exists():
            errors.append(f"missing source for {locale}: {path}")
    return sources


def run_converter(
    test_id: str,
    slug: str,
    category: str,
    version: int,
    sources: dict[str, Path],
    output_path: Path,
    errors: list[str]
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        str(CONVERTER_PATH),
        "--test-id",
        test_id,
        "--slug",
        slug,
        "--category",
        category,
        "--version",
        str(version),
        "--en",
        str(sources["en"]),
        "--es",
        str(sources["es"]),
        "--ptbr",
        str(sources["pt-BR"]),
        "--out",
        str(output_path)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        errors.append("values_compass_md_to_spec.py failed")
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)


def update_catalog(test_id: str, tenant_id: str, errors: list[str]) -> bool:
    if not CATALOG_PATH.exists():
        errors.append(f"catalog.json not found at {CATALOG_PATH}")
        return False

    raw = CATALOG_PATH.read_text(encoding="utf-8")
    try:
        catalog = json.loads(raw)
    except json.JSONDecodeError as exc:
        errors.append(f"catalog.json is not valid JSON: {exc}")
        return False

    tenants = catalog.get("tenants")
    if not isinstance(tenants, dict):
        errors.append("catalog.json must contain tenants object")
        return False

    if tenant_id not in tenants:
        errors.append(f"tenant_id not found in catalog.json: {tenant_id}")
        return False

    tests = tenants.get(tenant_id)
    if not isinstance(tests, list):
        errors.append(f"catalog.json tenants.{tenant_id} must be an array")
        return False

    if test_id in tests:
        return False

    tests.append(test_id)
    new_raw = json.dumps(catalog, indent=2) + "\n"
    if new_raw != raw:
        CATALOG_PATH.write_text(new_raw, encoding="utf-8")
    return True


def main() -> int:
    args = parse_args()
    errors: list[str] = []

    test_id = args.test_id.strip()
    tenant_id = args.tenant_id.strip()

    if not test_id:
        errors.append("test_id is required")
    if not tenant_id:
        errors.append("tenant_id is required")

    validate_format(args.format, errors)

    slug = resolve_slug(test_id, args.slug, errors)
    category = resolve_category(args.category)
    version = resolve_version(args.version)

    if test_id and not validate_catalog.TEST_ID_PATTERN.match(test_id):
        errors.append("test_id must match test-<slug>")
    if slug and not validate_catalog.SLUG_PATTERN.match(slug):
        errors.append("slug must be url-safe")
    if test_id and slug and test_id != f"test-{slug}":
        errors.append("test_id must align with slug")
    if version < 1:
        errors.append("version must be >= 1")
    if not category:
        errors.append("category must be a non-empty string")

    sources = ensure_sources(test_id, errors) if test_id else {}

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    output_path = TESTS_ROOT / test_id / "spec.json"
    run_converter(test_id, slug, category, version, sources, output_path, errors)

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    catalog_updated = update_catalog(test_id, tenant_id, errors)

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    print(f"Wrote spec: {output_path}")
    if catalog_updated:
        print(f"Updated catalog: added {test_id} to {tenant_id}")
    else:
        print(f"Catalog already contains {test_id} for {tenant_id}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
