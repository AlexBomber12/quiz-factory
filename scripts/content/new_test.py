#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import validate_catalog

ROOT_DIR = Path(__file__).resolve().parents[2]
TESTS_ROOT = ROOT_DIR / "content" / "tests"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a new test spec scaffold in content/tests."
    )
    parser.add_argument("--test-id", required=True, help="Test id in the form test-<slug>")
    parser.add_argument("--slug", required=True, help="URL-safe slug")
    parser.add_argument(
        "--locales",
        nargs="+",
        required=True,
        help="Locale tags like en es pt-BR"
    )
    parser.add_argument("--category", required=True, help="Category label for the test")
    return parser.parse_args()


def normalize_locales(raw_locales: list[str], errors: list[str]) -> list[str]:
    locales: list[str] = []
    seen: set[str] = set()
    for raw in raw_locales:
        canonical = validate_catalog.normalize_locale_tag(raw)
        if not canonical:
            errors.append(f"locale {raw} is not allowed; use en, es, pt-BR")
            continue
        if canonical in seen:
            errors.append(f"locale {canonical} is duplicated")
            continue
        locales.append(canonical)
        seen.add(canonical)
    if not locales:
        errors.append("at least one locale is required")
    return locales


def build_locales(locale_keys: list[str], slug: str) -> dict[str, dict[str, str]]:
    locales: dict[str, dict[str, str]] = {}
    for locale in locale_keys:
        locales[locale] = {
            "title": f"TODO: {slug} title",
            "short_description": "TODO: Short description",
            "intro": "TODO: Intro copy",
            "paywall_headline": "TODO: Paywall headline",
            "report_title": "TODO: Report title"
        }
    return locales


def build_result_bands(locale_keys: list[str]) -> list[dict[str, object]]:
    bands: list[dict[str, object]] = []
    templates = [
        ("low", 0, 3),
        ("mid", 4, 7),
        ("high", 8, 10)
    ]
    for band_id, minimum, maximum in templates:
        copy: dict[str, dict[str, object]] = {}
        for locale in locale_keys:
            copy[locale] = {
                "headline": f"TODO: {band_id} headline",
                "summary": "TODO: Summary copy",
                "bullets": [
                    "TODO: Bullet one",
                    "TODO: Bullet two",
                    "TODO: Bullet three"
                ]
            }
        bands.append(
            {
                "band_id": band_id,
                "min_score_inclusive": minimum,
                "max_score_inclusive": maximum,
                "copy": copy
            }
        )
    return bands


def create_test_spec(
    test_id: str,
    slug: str,
    locales: list[str],
    category: str,
    tests_root: Path = TESTS_ROOT
) -> tuple[Path | None, list[str]]:
    errors: list[str] = []

    if not validate_catalog.TEST_ID_PATTERN.match(test_id):
        errors.append("test_id must match test-<slug>")
    if not validate_catalog.SLUG_PATTERN.match(slug):
        errors.append("slug must be url-safe (lowercase, digits, hyphens)")
    if test_id != f"test-{slug}":
        errors.append("test_id must align with slug")

    category_value = category.strip()
    if not category_value:
        errors.append("category must be a non-empty string")

    locale_keys = normalize_locales(locales, errors)

    test_dir = tests_root / test_id
    if test_dir.exists():
        errors.append(f"test_id already exists: {test_dir}")

    if errors:
        return None, errors

    test_dir.mkdir(parents=True, exist_ok=False)
    spec_path = test_dir / "spec.json"

    spec = {
        "test_id": test_id,
        "slug": slug,
        "version": 1,
        "category": category_value,
        "locales": build_locales(locale_keys, slug),
        "questions": [],
        "scoring": {
            "scales": ["score"],
            "option_weights": {}
        },
        "result_bands": build_result_bands(locale_keys)
    }

    spec_path.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")

    validation_errors: list[str] = []
    spec_data = json.loads(spec_path.read_text(encoding="utf-8"))
    validate_catalog.validate_spec(spec_path, spec_data, validation_errors)
    if validation_errors:
        return spec_path, validation_errors

    return spec_path, []


def main() -> int:
    args = parse_args()
    spec_path, errors = create_test_spec(
        test_id=args.test_id,
        slug=args.slug,
        locales=args.locales,
        category=args.category
    )
    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    if spec_path is None:
        print("ERROR: spec.json was not created", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
