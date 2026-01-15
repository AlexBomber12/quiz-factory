#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from urllib.parse import urlparse

ALLOWED_LOCALES = {
    "en": "en",
    "es": "es",
    "pt-br": "pt-BR"
}

HOST_PORT_PATTERN = re.compile(r":\d+$")


def normalize_locale(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        raise ValueError("default_locale is required")

    canonical = ALLOWED_LOCALES.get(value.lower())
    if not canonical:
        allowed = ", ".join(sorted(ALLOWED_LOCALES.values()))
        raise ValueError(f"default_locale must be one of: {allowed}")

    return canonical


def normalize_domain(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        raise ValueError("domain is required")

    if "://" in value:
        parsed = urlparse(value)
        host = parsed.netloc or parsed.path
    else:
        parsed = urlparse("https://" + value)
        host = parsed.netloc or parsed.path

    host = host.strip()
    if not host:
        raise ValueError(f"invalid domain: {raw}")

    host = host.split("@")[-1]
    host = HOST_PORT_PATTERN.sub("", host)
    host = host.rstrip(".").lower()

    if not host or "/" in host or " " in host:
        raise ValueError(f"invalid domain: {raw}")

    return host


def build_registry(tenant_records: dict[str, dict[str, object]]) -> list[dict[str, object]]:
    tenants: list[dict[str, object]] = []
    for tenant_id in sorted(tenant_records.keys()):
        record = tenant_records[tenant_id]
        tenants.append(
            {
                "tenant_id": tenant_id,
                "domains": sorted(record["domains"]),
                "default_locale": record["default_locale"]
            }
        )
    return tenants


def serialize_registry(tenants: list[dict[str, object]]) -> str:
    registry = {"tenants": tenants}
    return json.dumps(registry, indent=2, ensure_ascii=True) + "\n"
