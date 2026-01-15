#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from tenant_utils import build_registry, normalize_domain, normalize_locale, serialize_registry

EXPECTED_KEYS = {"tenant_id", "domains", "default_locale"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate config/tenants.json")
    parser.add_argument(
        "--file",
        default="config/tenants.json",
        help="Path to tenants.json (default: config/tenants.json)"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    file_path = Path(args.file)

    if not file_path.exists():
        print(f"ERROR: tenants.json not found: {file_path}", file=sys.stderr)
        return 1

    raw_text = file_path.read_text(encoding="utf-8")

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        print(f"ERROR: tenants.json is not valid JSON: {exc}", file=sys.stderr)
        return 1

    if not isinstance(data, dict):
        print("ERROR: tenants.json must contain a top-level object", file=sys.stderr)
        return 1

    tenants = data.get("tenants")
    if not isinstance(tenants, list):
        print("ERROR: tenants.json must contain a tenants array", file=sys.stderr)
        return 1

    errors: list[str] = []
    tenant_records: dict[str, dict[str, object]] = {}
    domain_to_tenant: dict[str, str] = {}

    for index, tenant in enumerate(tenants):
        label = f"tenants[{index}]"
        if not isinstance(tenant, dict):
            errors.append(f"{label} must be an object")
            continue

        tenant_keys = set(tenant.keys())
        if tenant_keys != EXPECTED_KEYS:
            missing = EXPECTED_KEYS - tenant_keys
            extra = tenant_keys - EXPECTED_KEYS
            if missing:
                errors.append(
                    f"{label} is missing keys: {', '.join(sorted(missing))}"
                )
            if extra:
                errors.append(
                    f"{label} has unexpected keys: {', '.join(sorted(extra))}"
                )

        tenant_id = tenant.get("tenant_id")
        if not isinstance(tenant_id, str) or not tenant_id.strip():
            errors.append(f"{label}.tenant_id must be a non-empty string")
            continue

        if tenant_id != tenant_id.strip():
            errors.append(f"{label}.tenant_id must not include leading or trailing spaces")

        if tenant_id in tenant_records:
            errors.append(f"{label}.tenant_id {tenant_id} is duplicated")
            continue

        default_locale = tenant.get("default_locale")
        if not isinstance(default_locale, str) or not default_locale.strip():
            errors.append(f"{label}.default_locale must be a non-empty string")
            continue

        try:
            canonical_locale = normalize_locale(default_locale)
        except ValueError as exc:
            errors.append(f"{label}.default_locale {exc}")
            continue

        if canonical_locale != default_locale:
            errors.append(f"{label}.default_locale must be {canonical_locale}")

        domains = tenant.get("domains")
        if not isinstance(domains, list) or not domains:
            errors.append(f"{label}.domains must be a non-empty array")
            continue

        normalized_domains: set[str] = set()
        for domain in domains:
            if not isinstance(domain, str) or not domain.strip():
                errors.append(f"{label}.domains entries must be non-empty strings")
                continue

            try:
                normalized = normalize_domain(domain)
            except ValueError as exc:
                errors.append(f"{label}.domains {exc}")
                continue

            if normalized != domain:
                errors.append(
                    f"{label}.domains {domain} is not normalized, use {normalized}"
                )

            if normalized in domain_to_tenant:
                existing_tenant = domain_to_tenant[normalized]
                errors.append(
                    f"{label}.domains {normalized} already assigned to {existing_tenant}"
                )
                continue

            domain_to_tenant[normalized] = tenant_id
            normalized_domains.add(normalized)

        tenant_records[tenant_id] = {
            "default_locale": canonical_locale,
            "domains": normalized_domains
        }

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    canonical = serialize_registry(build_registry(tenant_records))
    if canonical != raw_text:
        print(
            "ERROR: tenants.json is not deterministically sorted or formatted. "
            "Run the tenant import script to regenerate it.",
            file=sys.stderr
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
