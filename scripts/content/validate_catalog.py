#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[2]
TENANTS_PATH = ROOT_DIR / "config" / "tenants.json"
CATALOG_PATH = ROOT_DIR / "config" / "catalog.json"
TESTS_ROOT = ROOT_DIR / "content" / "tests"

ALLOWED_LOCALES = {
    "en": "en",
    "es": "es",
    "pt-br": "pt-BR"
}
UNIVERSAL_REQUIRED_LOCALES = ["en", "es", "pt-BR"]

TEST_ID_PATTERN = re.compile(r"^test-[a-z0-9]+(?:-[a-z0-9]+)*$")
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def load_json(path: Path, label: str, errors: list[str]) -> Any:
    if not path.exists():
        errors.append(f"{label} not found: {path}")
        return None

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"{label} is not valid JSON: {exc}")
        return None


def normalize_locale_tag(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    return ALLOWED_LOCALES.get(trimmed.lower())


def validate_string(value: object, path: str, errors: list[str]) -> str | None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{path} must be a non-empty string")
        return None
    return value.strip()


def validate_integer(value: object, path: str, errors: list[str]) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        errors.append(f"{path} must be an integer")
        return None
    return value


def validate_localized_map(
    value: object,
    locale_keys: list[str],
    path: str,
    errors: list[str]
) -> None:
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return

    for locale in locale_keys:
        validate_string(value.get(locale), f"{path}.{locale}", errors)


def validate_locale_block(
    value: object,
    path: str,
    errors: list[str]
) -> None:
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return

    for field in [
        "title",
        "short_description",
        "intro",
        "paywall_headline",
        "report_title"
    ]:
        validate_string(value.get(field), f"{path}.{field}", errors)


def validate_result_copy(
    value: object,
    locale_keys: list[str],
    path: str,
    errors: list[str]
) -> None:
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return

    for locale in locale_keys:
        locale_path = f"{path}.{locale}"
        localized = value.get(locale)
        if not isinstance(localized, dict):
            errors.append(f"{locale_path} must be an object")
            continue

        validate_string(localized.get("headline"), f"{locale_path}.headline", errors)
        validate_string(localized.get("summary"), f"{locale_path}.summary", errors)
        bullets = localized.get("bullets")
        if not isinstance(bullets, list):
            errors.append(f"{locale_path}.bullets must be an array")
        else:
            for index, bullet in enumerate(bullets):
                validate_string(bullet, f"{locale_path}.bullets[{index}]", errors)


class SpecInfo:
    def __init__(self, test_id: str | None, slug: str | None, locales: list[str]):
        self.test_id = test_id
        self.slug = slug
        self.locales = locales


def validate_spec(path: Path, data: object, errors: list[str]) -> SpecInfo:
    prefix = str(path)
    if not isinstance(data, dict):
        errors.append(f"{prefix} must be a JSON object")
        return SpecInfo(None, None, [])

    format_id = data.get("format_id")
    if format_id is None:
        format_id = "values_compass_v1"
    if not isinstance(format_id, str) or not format_id.strip():
        errors.append(f"{prefix}.format_id must be a non-empty string")
        return SpecInfo(None, None, [])
    format_id = format_id.strip()

    if format_id == "universal_human_v1":
        return validate_universal_spec(path, data, errors)
    if format_id != "values_compass_v1":
        errors.append(f"{prefix}.format_id must be values_compass_v1 or universal_human_v1")
        return SpecInfo(None, None, [])

    test_id = validate_string(data.get("test_id"), f"{prefix}.test_id", errors)
    if test_id and not TEST_ID_PATTERN.match(test_id):
        errors.append(f"{prefix}.test_id must match test-<slug>")

    slug = validate_string(data.get("slug"), f"{prefix}.slug", errors)
    if slug and not SLUG_PATTERN.match(slug):
        errors.append(f"{prefix}.slug must be url-safe")
    if test_id and slug and test_id != f"test-{slug}":
        errors.append(f"{prefix}.test_id must align with slug")

    version = validate_integer(data.get("version"), f"{prefix}.version", errors)
    if version is not None and version < 1:
        errors.append(f"{prefix}.version must be >= 1")
    validate_string(data.get("category"), f"{prefix}.category", errors)

    locales_value = data.get("locales")
    locale_keys: list[str] = []
    if not isinstance(locales_value, dict):
        errors.append(f"{prefix}.locales must be an object")
    else:
        for key in locales_value.keys():
            canonical = normalize_locale_tag(key)
            if not canonical:
                errors.append(f"{prefix}.locales.{key} is not an allowed locale tag")
                continue
            if canonical != key:
                errors.append(f"{prefix}.locales.{key} must be {canonical}")
                continue
            locale_keys.append(key)

        if not locale_keys:
            errors.append(f"{prefix}.locales must include at least one locale")

        for locale in locale_keys:
            validate_locale_block(locales_value.get(locale), f"{prefix}.locales.{locale}", errors)

    questions = data.get("questions")
    if not isinstance(questions, list):
        errors.append(f"{prefix}.questions must be an array")
    else:
        for index, question in enumerate(questions):
            question_path = f"{prefix}.questions[{index}]"
            if not isinstance(question, dict):
                errors.append(f"{question_path} must be an object")
                continue

            validate_string(question.get("id"), f"{question_path}.id", errors)
            question_type = validate_string(question.get("type"), f"{question_path}.type", errors)
            if question_type and question_type != "single_choice":
                errors.append(f"{question_path}.type must be single_choice")

            validate_localized_map(question.get("prompt"), locale_keys, f"{question_path}.prompt", errors)

            options = question.get("options")
            if not isinstance(options, list):
                errors.append(f"{question_path}.options must be an array")
            else:
                for option_index, option in enumerate(options):
                    option_path = f"{question_path}.options[{option_index}]"
                    if not isinstance(option, dict):
                        errors.append(f"{option_path} must be an object")
                        continue

                    validate_string(option.get("id"), f"{option_path}.id", errors)
                    validate_localized_map(option.get("label"), locale_keys, f"{option_path}.label", errors)

    scoring = data.get("scoring")
    if not isinstance(scoring, dict):
        errors.append(f"{prefix}.scoring must be an object")
    else:
        scales = scoring.get("scales")
        if not isinstance(scales, list):
            errors.append(f"{prefix}.scoring.scales must be an array")
        else:
            for index, scale in enumerate(scales):
                validate_string(scale, f"{prefix}.scoring.scales[{index}]", errors)

        option_weights = scoring.get("option_weights")
        if not isinstance(option_weights, dict):
            errors.append(f"{prefix}.scoring.option_weights must be an object")
        else:
            for option_id, weights in option_weights.items():
                option_key = validate_string(option_id, f"{prefix}.scoring.option_weights.key", errors)
                weight_path = f"{prefix}.scoring.option_weights.{option_key or 'unknown'}"
                if not isinstance(weights, dict):
                    errors.append(f"{weight_path} must be an object")
                    continue

                for scale_id, weight in weights.items():
                    scale_key = validate_string(scale_id, f"{weight_path}.key", errors)
                    numeric_path = f"{weight_path}.{scale_key or 'unknown'}"
                    validate_integer(weight, numeric_path, errors)

    result_bands = data.get("result_bands")
    if not isinstance(result_bands, list):
        errors.append(f"{prefix}.result_bands must be an array")
    else:
        for index, band in enumerate(result_bands):
            band_path = f"{prefix}.result_bands[{index}]"
            if not isinstance(band, dict):
                errors.append(f"{band_path} must be an object")
                continue

            validate_string(band.get("band_id"), f"{band_path}.band_id", errors)
            validate_integer(band.get("min_score_inclusive"), f"{band_path}.min_score_inclusive", errors)
            validate_integer(band.get("max_score_inclusive"), f"{band_path}.max_score_inclusive", errors)
            validate_result_copy(band.get("copy"), locale_keys, f"{band_path}.copy", errors)

    return SpecInfo(test_id, slug, locale_keys)


def validate_universal_spec(path: Path, data: dict[str, Any], errors: list[str]) -> SpecInfo:
    prefix = str(path)

    test_id = validate_string(data.get("test_id"), f"{prefix}.test_id", errors)
    if test_id and not TEST_ID_PATTERN.match(test_id):
        errors.append(f"{prefix}.test_id must match test-<slug>")

    slug = validate_string(data.get("slug"), f"{prefix}.slug", errors)
    if slug and not SLUG_PATTERN.match(slug):
        errors.append(f"{prefix}.slug must be url-safe")
    if test_id and slug and test_id != f"test-{slug}":
        errors.append(f"{prefix}.test_id must align with slug")

    version = validate_integer(data.get("version"), f"{prefix}.version", errors)
    if version is not None and version < 1:
        errors.append(f"{prefix}.version must be >= 1")
    validate_string(data.get("category"), f"{prefix}.category", errors)

    locales_value = data.get("locales")
    locale_keys: list[str] = []
    if not isinstance(locales_value, dict):
        errors.append(f"{prefix}.locales must be an object")
    else:
        for key in locales_value.keys():
            canonical = normalize_locale_tag(key)
            if not canonical:
                errors.append(f"{prefix}.locales.{key} is not an allowed locale tag")
                continue
            if canonical != key:
                errors.append(f"{prefix}.locales.{key} must be {canonical}")
                continue
            locale_keys.append(key)

        for required_locale in UNIVERSAL_REQUIRED_LOCALES:
            if required_locale not in locale_keys:
                errors.append(f"{prefix}.locales must include {required_locale}")

        for locale in locale_keys:
            if not isinstance(locales_value.get(locale), dict):
                errors.append(f"{prefix}.locales.{locale} must be an object")

    question_count = validate_integer(
        data.get("question_count"),
        f"{prefix}.question_count",
        errors
    )
    if question_count is not None and question_count < 1:
        errors.append(f"{prefix}.question_count must be >= 1")

    scales = data.get("scales")
    scale_ids: list[str] = []
    if not isinstance(scales, list):
        errors.append(f"{prefix}.scales must be an array")
    else:
        for index, scale in enumerate(scales):
            scale_id = validate_string(scale, f"{prefix}.scales[{index}]", errors)
            if scale_id:
                scale_ids.append(scale_id)

    questions = data.get("questions")
    if not isinstance(questions, list):
        errors.append(f"{prefix}.questions must be an array")
    else:
        if question_count is not None and len(questions) != question_count:
            errors.append(
                f"{prefix}.question_count must match number of questions"
            )

        expected_count = question_count if question_count is not None else len(questions)
        width = max(2, len(str(expected_count))) if expected_count else 2
        expected_ids = [f"q{index:0{width}d}" for index in range(1, expected_count + 1)]
        seen: set[str] = set()

        for index, question in enumerate(questions):
            question_path = f"{prefix}.questions[{index}]"
            if not isinstance(question, dict):
                errors.append(f"{question_path} must be an object")
                continue

            question_id = validate_string(question.get("question_id"), f"{question_path}.question_id", errors)
            if question_id:
                if question_id in seen:
                    errors.append(f"{question_path}.question_id {question_id} is duplicated")
                seen.add(question_id)
                if question_id not in expected_ids:
                    errors.append(f"{question_path}.question_id must match q01..qNN")

            scale_id = validate_string(question.get("scale_id"), f"{question_path}.scale_id", errors)
            if scale_id and scale_id not in scale_ids:
                errors.append(f"{question_path}.scale_id must be listed in scales")

            validate_localized_map(question.get("prompt"), locale_keys, f"{question_path}.prompt", errors)

        if expected_ids and set(expected_ids) != seen:
            missing = [qid for qid in expected_ids if qid not in seen]
            if missing:
                errors.append(f"{prefix}.questions missing ids: {', '.join(missing)}")

    return SpecInfo(test_id, slug, locale_keys)


def load_tenants(data: object, errors: list[str]) -> dict[str, str]:
    if not isinstance(data, dict):
        errors.append("tenants.json must contain a top-level object")
        return {}

    tenants = data.get("tenants")
    if not isinstance(tenants, list):
        errors.append("tenants.json must contain a tenants array")
        return {}

    tenant_locales: dict[str, str] = {}
    for index, tenant in enumerate(tenants):
        label = f"tenants[{index}]"
        if not isinstance(tenant, dict):
            errors.append(f"{label} must be an object")
            continue

        tenant_id = validate_string(tenant.get("tenant_id"), f"{label}.tenant_id", errors)
        default_locale = validate_string(tenant.get("default_locale"), f"{label}.default_locale", errors)
        canonical_locale = normalize_locale_tag(default_locale)
        if default_locale and not canonical_locale:
            errors.append(f"{label}.default_locale must be one of: en, es, pt-BR")
            continue
        if default_locale and canonical_locale and canonical_locale != default_locale:
            errors.append(f"{label}.default_locale must be {canonical_locale}")
            continue

        if tenant_id:
            tenant_locales[tenant_id] = default_locale or ""

    return tenant_locales


def load_catalog(data: object, errors: list[str]) -> dict[str, list[str]]:
    if not isinstance(data, dict):
        errors.append("catalog.json must contain a top-level object")
        return {}

    tenants = data.get("tenants")
    if not isinstance(tenants, dict):
        errors.append("catalog.json must contain a tenants object")
        return {}

    catalog: dict[str, list[str]] = {}
    for tenant_id, tests in tenants.items():
        if not isinstance(tenant_id, str) or not tenant_id.strip():
            errors.append("catalog.json tenant ids must be non-empty strings")
            continue

        if not isinstance(tests, list):
            errors.append(f"catalog.json tenants.{tenant_id} must be an array")
            continue

        test_ids: list[str] = []
        for index, test_id in enumerate(tests):
            value = validate_string(test_id, f"catalog.json tenants.{tenant_id}[{index}]", errors)
            if value:
                test_ids.append(value)

        catalog[tenant_id] = test_ids

    return catalog


def main() -> int:
    errors: list[str] = []

    tenants_data = load_json(TENANTS_PATH, "tenants.json", errors)
    catalog_data = load_json(CATALOG_PATH, "catalog.json", errors)

    tenants = load_tenants(tenants_data, errors) if tenants_data is not None else {}
    catalog = load_catalog(catalog_data, errors) if catalog_data is not None else {}

    specs: dict[str, SpecInfo] = {}
    if TESTS_ROOT.exists():
        for spec_path in TESTS_ROOT.glob("*/spec.json"):
            spec_data = load_json(spec_path, str(spec_path), errors)
            if spec_data is None:
                continue
            spec_info = validate_spec(spec_path, spec_data, errors)
            specs[spec_path.parent.name] = spec_info
    else:
        errors.append(f"content/tests not found: {TESTS_ROOT}")

    test_id_to_path: dict[str, Path] = {}
    slug_to_path: dict[str, Path] = {}
    for directory, spec in specs.items():
        if spec.test_id:
            existing = test_id_to_path.get(spec.test_id)
            if existing:
                errors.append(
                    f"duplicate test_id {spec.test_id} in {existing} and {TESTS_ROOT / directory}"
                )
            else:
                test_id_to_path[spec.test_id] = TESTS_ROOT / directory

        if spec.slug:
            existing = slug_to_path.get(spec.slug)
            if existing:
                errors.append(
                    f"duplicate slug {spec.slug} in {existing} and {TESTS_ROOT / directory}"
                )
            else:
                slug_to_path[spec.slug] = TESTS_ROOT / directory

    for tenant_id, tests in catalog.items():
        if tenant_id not in tenants:
            errors.append(f"catalog.json tenant {tenant_id} does not exist in tenants.json")
            continue

        seen: set[str] = set()
        for test_id in tests:
            if test_id in seen:
                errors.append(f"catalog.json tenant {tenant_id} has duplicate test {test_id}")
                continue
            seen.add(test_id)

            spec_path = TESTS_ROOT / test_id / "spec.json"
            if not spec_path.exists():
                errors.append(f"catalog.json tenant {tenant_id} references missing test {test_id}")
                continue

            spec_info = specs.get(test_id)
            default_locale = tenants.get(tenant_id)
            if spec_info and default_locale:
                if default_locale not in spec_info.locales:
                    errors.append(
                        f"test {test_id} missing default locale {default_locale} for tenant {tenant_id}"
                    )

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
