#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

from tenant_utils import build_registry, normalize_domain, normalize_locale, serialize_registry

REQUIRED_COLUMNS = {"tenant_id", "domains", "default_locale"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import tenants from CSV and write config/tenants.json"
    )
    parser.add_argument(
        "--csv",
        default="config/tenants.csv",
        help="Path to the tenants CSV file (default: config/tenants.csv)"
    )
    parser.add_argument(
        "--output",
        default="config/tenants.json",
        help="Path to the tenants.json output (default: config/tenants.json)"
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Validate CSV without writing tenants.json"
    )
    return parser.parse_args()


def split_domains(raw: str) -> list[str]:
    parts = [(part or "").strip() for part in raw.split(",")]
    domains = [part for part in parts if part]
    if not domains:
        raise ValueError("domains is required")
    return domains


def main() -> int:
    args = parse_args()
    csv_path = Path(args.csv)
    output_path = Path(args.output)

    if not csv_path.exists():
        print(f"ERROR: CSV not found: {csv_path}", file=sys.stderr)
        return 1

    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        header = reader.fieldnames or []
        missing = REQUIRED_COLUMNS - set(header)
        if missing:
            missing_list = ", ".join(sorted(missing))
            print(f"ERROR: Missing CSV columns: {missing_list}", file=sys.stderr)
            return 1

        tenant_records: dict[str, dict[str, object]] = {}
        domain_to_tenant: dict[str, str] = {}
        errors: list[str] = []

        for row in reader:
            row_number = reader.line_num
            tenant_id = (row.get("tenant_id") or "").strip()
            raw_domains = row.get("domains")
            raw_locale = (row.get("default_locale") or "").strip()

            row_errors: list[str] = []
            if not tenant_id:
                row_errors.append("tenant_id is required")
            if raw_domains is None or not raw_domains.strip():
                row_errors.append("domains is required")
            if not raw_locale:
                row_errors.append("default_locale is required")

            if row_errors:
                for message in row_errors:
                    errors.append(f"Row {row_number}: {message}")
                continue

            try:
                locale = normalize_locale(raw_locale)
            except ValueError as exc:
                errors.append(f"Row {row_number}: {exc}")
                continue

            existing = tenant_records.get(tenant_id)
            if existing:
                existing_locale = existing["default_locale"]
                if existing_locale != locale:
                    errors.append(
                        f"Row {row_number}: tenant_id {tenant_id} has conflicting default_locale"
                    )
                    continue
            else:
                tenant_records[tenant_id] = {
                    "default_locale": locale,
                    "domains": set()
                }

            try:
                domain_values = split_domains(raw_domains)
            except ValueError as exc:
                errors.append(f"Row {row_number}: {exc}")
                continue

            for domain_raw in domain_values:
                try:
                    domain = normalize_domain(domain_raw)
                except ValueError as exc:
                    errors.append(f"Row {row_number}: {exc}")
                    continue

                if domain in domain_to_tenant:
                    existing_tenant = domain_to_tenant[domain]
                    errors.append(
                        f"Row {row_number}: domain {domain} already assigned to {existing_tenant}"
                    )
                    continue

                domain_to_tenant[domain] = tenant_id
                tenant_records[tenant_id]["domains"].add(domain)

        if errors:
            for message in errors:
                print(f"ERROR: {message}", file=sys.stderr)
            return 1

    for tenant_id, record in tenant_records.items():
        if not record["domains"]:
            print(f"ERROR: tenant_id {tenant_id} has no domains", file=sys.stderr)
            return 1

    tenants = build_registry(tenant_records)
    output_json = serialize_registry(tenants)

    if args.check_only:
        return 0

    output_path.write_text(output_json, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
