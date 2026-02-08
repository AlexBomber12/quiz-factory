#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

EXPECTED_TOP_LEVEL_KEYS = {"profiles"}
EXPECTED_PROFILE_KEYS = {
    "tenant_id",
    "tenant_kind",
    "label",
    "home_headline",
    "home_subheadline",
    "featured_test_slugs"
}
ALLOWED_TENANT_KINDS = {"hub", "niche"}
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate config/tenant_profiles.json")
    parser.add_argument(
        "--file",
        default="config/tenant_profiles.json",
        help="Path to tenant_profiles.json (default: config/tenant_profiles.json)"
    )
    parser.add_argument(
        "--tenants-file",
        default="config/tenants.json",
        help="Path to tenants.json (default: config/tenants.json)"
    )
    return parser.parse_args()


def load_json(path: Path, label: str) -> tuple[str | None, object | None, list[str]]:
    if not path.exists():
        return None, None, [f"{label} not found: {path}"]

    raw_text = path.read_text(encoding="utf-8")
    try:
        return raw_text, json.loads(raw_text), []
    except json.JSONDecodeError as exc:
        return raw_text, None, [f"{label} is not valid JSON: {exc}"]


def load_tenant_ids(tenants_data: object) -> tuple[set[str], list[str]]:
    errors: list[str] = []
    if not isinstance(tenants_data, dict):
        errors.append("tenants.json must contain a top-level object")
        return set(), errors

    tenants = tenants_data.get("tenants")
    if not isinstance(tenants, list):
        errors.append("tenants.json must contain a tenants array")
        return set(), errors

    tenant_ids: set[str] = set()
    for index, tenant in enumerate(tenants):
        label = f"tenants[{index}]"
        if not isinstance(tenant, dict):
            errors.append(f"{label} must be an object")
            continue

        tenant_id = tenant.get("tenant_id")
        if not isinstance(tenant_id, str) or not tenant_id.strip():
            errors.append(f"{label}.tenant_id must be a non-empty string")
            continue

        normalized = tenant_id.strip()
        if normalized != tenant_id:
            errors.append(f"{label}.tenant_id must not include leading or trailing spaces")
            continue

        tenant_ids.add(normalized)

    return tenant_ids, errors


def expect_non_empty_string(value: object, path: str, errors: list[str]) -> str | None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{path} must be a non-empty string")
        return None

    normalized = value.strip()
    if normalized != value:
        errors.append(f"{path} must not include leading or trailing spaces")
        return None

    return normalized


def serialize_profiles(profiles: list[dict[str, object]]) -> str:
    sorted_profiles = sorted(profiles, key=lambda profile: profile["tenant_id"])
    canonical_profiles: list[dict[str, object]] = []

    for profile in sorted_profiles:
        featured = sorted(profile["featured_test_slugs"])
        canonical_profiles.append(
            {
                "tenant_id": profile["tenant_id"],
                "tenant_kind": profile["tenant_kind"],
                "label": profile["label"],
                "home_headline": profile["home_headline"],
                "home_subheadline": profile["home_subheadline"],
                "featured_test_slugs": featured
            }
        )

    return json.dumps({"profiles": canonical_profiles}, indent=2, ensure_ascii=True) + "\n"


def validate_profiles(data: object, tenant_ids: set[str]) -> tuple[list[dict[str, object]], list[str]]:
    errors: list[str] = []
    profiles: list[dict[str, object]] = []

    if not isinstance(data, dict):
        errors.append("tenant_profiles.json must contain a top-level object")
        return profiles, errors

    top_level_keys = set(data.keys())
    if top_level_keys != EXPECTED_TOP_LEVEL_KEYS:
        missing = EXPECTED_TOP_LEVEL_KEYS - top_level_keys
        extra = top_level_keys - EXPECTED_TOP_LEVEL_KEYS
        if missing:
            errors.append(f"tenant_profiles.json is missing keys: {', '.join(sorted(missing))}")
        if extra:
            errors.append(f"tenant_profiles.json has unexpected keys: {', '.join(sorted(extra))}")

    raw_profiles = data.get("profiles")
    if not isinstance(raw_profiles, list):
        errors.append("tenant_profiles.json.profiles must be an array")
        return profiles, errors

    seen_tenant_ids: set[str] = set()
    for index, raw_profile in enumerate(raw_profiles):
        label = f"profiles[{index}]"
        if not isinstance(raw_profile, dict):
            errors.append(f"{label} must be an object")
            continue

        profile_keys = set(raw_profile.keys())
        if profile_keys != EXPECTED_PROFILE_KEYS:
            missing = EXPECTED_PROFILE_KEYS - profile_keys
            extra = profile_keys - EXPECTED_PROFILE_KEYS
            if missing:
                errors.append(f"{label} is missing keys: {', '.join(sorted(missing))}")
            if extra:
                errors.append(f"{label} has unexpected keys: {', '.join(sorted(extra))}")

        tenant_id = expect_non_empty_string(raw_profile.get("tenant_id"), f"{label}.tenant_id", errors)
        if tenant_id:
            if tenant_id not in tenant_ids:
                errors.append(f"{label}.tenant_id {tenant_id} does not exist in tenants.json")
            if tenant_id in seen_tenant_ids:
                errors.append(f"{label}.tenant_id {tenant_id} is duplicated")
            seen_tenant_ids.add(tenant_id)

        tenant_kind = expect_non_empty_string(raw_profile.get("tenant_kind"), f"{label}.tenant_kind", errors)
        if tenant_kind and tenant_kind not in ALLOWED_TENANT_KINDS:
            errors.append(f"{label}.tenant_kind must be one of: hub, niche")

        profile_label = expect_non_empty_string(raw_profile.get("label"), f"{label}.label", errors)
        home_headline = expect_non_empty_string(
            raw_profile.get("home_headline"),
            f"{label}.home_headline",
            errors
        )
        home_subheadline = expect_non_empty_string(
            raw_profile.get("home_subheadline"),
            f"{label}.home_subheadline",
            errors
        )

        featured_raw = raw_profile.get("featured_test_slugs")
        featured_test_slugs: list[str] = []
        if not isinstance(featured_raw, list):
            errors.append(f"{label}.featured_test_slugs must be an array")
        else:
            seen_slugs: set[str] = set()
            for slug_index, slug_value in enumerate(featured_raw):
                slug_path = f"{label}.featured_test_slugs[{slug_index}]"
                if not isinstance(slug_value, str) or not slug_value.strip():
                    errors.append(f"{slug_path} must be a non-empty string")
                    continue

                normalized_slug = slug_value.strip().lower()
                if slug_value != normalized_slug:
                    errors.append(f"{slug_path} must be normalized, use {normalized_slug}")
                    continue

                if not SLUG_PATTERN.match(normalized_slug):
                    errors.append(f"{slug_path} must be a normalized slug")
                    continue

                if normalized_slug in seen_slugs:
                    errors.append(f"{slug_path} duplicates slug {normalized_slug}")
                    continue

                seen_slugs.add(normalized_slug)
                featured_test_slugs.append(normalized_slug)

        if (
            tenant_id
            and tenant_kind in ALLOWED_TENANT_KINDS
            and profile_label
            and home_headline
            and home_subheadline
        ):
            profiles.append(
                {
                    "tenant_id": tenant_id,
                    "tenant_kind": tenant_kind,
                    "label": profile_label,
                    "home_headline": home_headline,
                    "home_subheadline": home_subheadline,
                    "featured_test_slugs": featured_test_slugs
                }
            )

    return profiles, errors


def main() -> int:
    args = parse_args()
    profiles_path = Path(args.file)
    tenants_path = Path(args.tenants_file)

    _, tenants_data, tenant_load_errors = load_json(tenants_path, "tenants.json")
    raw_profiles_text, profiles_data, profile_load_errors = load_json(
        profiles_path,
        "tenant_profiles.json"
    )

    errors = [*tenant_load_errors, *profile_load_errors]

    tenant_ids: set[str] = set()
    if tenants_data is not None:
        tenant_ids, tenant_validation_errors = load_tenant_ids(tenants_data)
        errors.extend(tenant_validation_errors)

    parsed_profiles: list[dict[str, object]] = []
    if profiles_data is not None:
        parsed_profiles, profile_validation_errors = validate_profiles(profiles_data, tenant_ids)
        errors.extend(profile_validation_errors)

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    canonical = serialize_profiles(parsed_profiles)
    if canonical != raw_profiles_text:
        print(
            "ERROR: tenant_profiles.json is not deterministically sorted or formatted. "
            "Sort profiles by tenant_id and featured_test_slugs alphabetically.",
            file=sys.stderr
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
