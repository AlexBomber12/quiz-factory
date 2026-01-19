#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import validate_catalog

ROOT_DIR = Path(__file__).resolve().parents[2]
ALLOWED_LOCALES = ["en", "es", "pt-BR"]
SECTION_TITLES = {
    "title": "title",
    "short description": "short_description",
    "intro": "intro",
    "instructions": "instructions",
    "paywall hook": "paywall_hook",
    "paid report structure": "paid_report_structure",
    "questions": "questions"
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert universal_human_v1 markdown sources into a test spec"
    )
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def strip_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def parse_list(value: str) -> list[str]:
    trimmed = value.strip()
    if not trimmed.startswith("[") or not trimmed.endswith("]"):
        return []
    inner = trimmed[1:-1].strip()
    if not inner:
        return []
    items = []
    for raw in inner.split(","):
        item = strip_quotes(raw.strip())
        if item:
            items.append(item)
    return items


def parse_yaml_lines(lines: list[str], label: str, errors: list[str]) -> dict[str, object]:
    result: dict[str, object] = {}
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in stripped:
            errors.append(f"{label} front matter line {index + 1} is invalid")
            continue
        key, raw_value = stripped.split(":", 1)
        key = key.strip()
        value = raw_value.strip()
        if not key:
            errors.append(f"{label} front matter line {index + 1} is missing a key")
            continue
        if key in result:
            errors.append(f"{label} front matter has duplicate key {key}")
            continue
        if value.startswith("[") and value.endswith("]"):
            result[key] = parse_list(value)
        else:
            result[key] = strip_quotes(value)
    return result


def split_front_matter(
    path: Path,
    errors: list[str]
) -> tuple[dict[str, object] | None, list[str]]:
    if not path.exists():
        errors.append(f"missing source file: {path}")
        return None, []

    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        errors.append(f"{path} missing YAML front matter")
        return None, []

    end_index = None
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            end_index = index
            break

    if end_index is None:
        errors.append(f"{path} YAML front matter is not closed with ---")
        return None, []

    front_lines = lines[1:end_index]
    body_lines = lines[end_index + 1:]
    meta = parse_yaml_lines(front_lines, str(path), errors)
    return meta, body_lines


def expect_string(
    value: object,
    path: str,
    errors: list[str]
) -> str:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{path} must be a non-empty string")
        return ""
    return value.strip()


def expect_int(
    value: object,
    path: str,
    errors: list[str]
) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    errors.append(f"{path} must be an integer")
    return 0


def expect_list(
    value: object,
    path: str,
    errors: list[str]
) -> list[str]:
    if not isinstance(value, list):
        errors.append(f"{path} must be a list")
        return []
    items: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, str) or not item.strip():
            errors.append(f"{path}[{index}] must be a non-empty string")
            continue
        items.append(item.strip())
    return items


def parse_metadata(
    raw: dict[str, object],
    label: str,
    errors: list[str]
) -> dict[str, object]:
    meta: dict[str, object] = {}

    format_id = expect_string(raw.get("format_id"), f"{label}.format_id", errors)
    if format_id and format_id != "universal_human_v1":
        errors.append(f"{label}.format_id must be universal_human_v1")

    test_id = expect_string(raw.get("test_id"), f"{label}.test_id", errors)
    if test_id and not validate_catalog.TEST_ID_PATTERN.match(test_id):
        errors.append(f"{label}.test_id must match test-<slug>")

    slug = expect_string(raw.get("slug"), f"{label}.slug", errors)
    if slug and not validate_catalog.SLUG_PATTERN.match(slug):
        errors.append(f"{label}.slug must be url-safe")
    if test_id and slug and test_id != f"test-{slug}":
        errors.append(f"{label}.test_id must align with slug")

    version = expect_int(raw.get("version"), f"{label}.version", errors)
    if version < 1:
        errors.append(f"{label}.version must be >= 1")

    category = expect_string(raw.get("category"), f"{label}.category", errors)

    primary_locale = expect_string(raw.get("primary_locale"), f"{label}.primary_locale", errors)
    if primary_locale:
        canonical = validate_catalog.normalize_locale_tag(primary_locale)
        if not canonical:
            errors.append(f"{label}.primary_locale must be en, es, or pt-BR")
        elif canonical != primary_locale:
            errors.append(f"{label}.primary_locale must be {canonical}")

    locales = expect_list(raw.get("locales"), f"{label}.locales", errors)
    normalized_locales: list[str] = []
    seen: set[str] = set()
    for locale in locales:
        canonical = validate_catalog.normalize_locale_tag(locale)
        if not canonical:
            errors.append(f"{label}.locales includes invalid locale {locale}")
            continue
        if canonical != locale:
            errors.append(f"{label}.locales entry {locale} must be {canonical}")
            continue
        if canonical in seen:
            errors.append(f"{label}.locales has duplicate locale {canonical}")
            continue
        normalized_locales.append(canonical)
        seen.add(canonical)
    if normalized_locales and set(normalized_locales) != set(ALLOWED_LOCALES):
        errors.append(f"{label}.locales must include en, es, and pt-BR")

    question_type = expect_string(raw.get("question_type"), f"{label}.question_type", errors)
    if question_type and question_type != "likert_5":
        errors.append(f"{label}.question_type must be likert_5")

    scoring_model = expect_string(raw.get("scoring_model"), f"{label}.scoring_model", errors)
    if scoring_model and scoring_model != "multi_scale":
        errors.append(f"{label}.scoring_model must be multi_scale")

    scales = expect_list(raw.get("scales"), f"{label}.scales", errors)
    scale_ids: list[str] = []
    scale_seen: set[str] = set()
    for scale_id in scales:
        if scale_id in scale_seen:
            errors.append(f"{label}.scales has duplicate scale {scale_id}")
            continue
        scale_seen.add(scale_id)
        scale_ids.append(scale_id)

    missing_policy = expect_string(raw.get("missing_policy"), f"{label}.missing_policy", errors)
    if missing_policy and missing_policy != "required_all":
        errors.append(f"{label}.missing_policy must be required_all")

    question_count = expect_int(raw.get("question_count"), f"{label}.question_count", errors)
    if question_count < 1:
        errors.append(f"{label}.question_count must be >= 1")

    if primary_locale and normalized_locales and primary_locale not in normalized_locales:
        errors.append(f"{label}.primary_locale must be listed in locales")

    meta.update(
        {
            "format_id": format_id,
            "test_id": test_id,
            "slug": slug,
            "version": version,
            "category": category,
            "primary_locale": primary_locale,
            "locales": normalized_locales,
            "question_type": question_type,
            "scoring_model": scoring_model,
            "scales": scale_ids,
            "missing_policy": missing_policy,
            "question_count": question_count
        }
    )
    return meta


def parse_sections(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current_key: str | None = None
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            title = stripped.lstrip("#").strip().lower()
            key = SECTION_TITLES.get(title)
            current_key = key
            if key and key not in sections:
                sections[key] = []
            continue
        if current_key:
            sections[current_key].append(line.rstrip())
    return sections


def coerce_section_text(lines: list[str]) -> str:
    text = "\n".join(lines).strip()
    return text


def parse_questions(
    lines: list[str],
    scales: list[str],
    expected_count: int,
    label: str,
    errors: list[str]
) -> list[dict[str, str]]:
    blocks: list[dict[str, str]] = []
    current: dict[str, str] = {}

    def flush() -> None:
        nonlocal current
        if current:
            blocks.append(current)
            current = {}

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("QID:"):
            flush()
            current = {"question_id": stripped[len("QID:"):].strip()}
            continue
        if stripped.startswith("Scale:"):
            if not current:
                errors.append(f"{label} has Scale before QID")
                continue
            if "scale_id" in current:
                errors.append(f"{label} has duplicate Scale in a question block")
                continue
            current["scale_id"] = stripped[len("Scale:"):].strip()
            continue
        if stripped.startswith("Prompt:"):
            if not current:
                errors.append(f"{label} has Prompt before QID")
                continue
            if "prompt" in current:
                errors.append(f"{label} has duplicate Prompt in a question block")
                continue
            current["prompt"] = stripped[len("Prompt:"):].strip()
            continue
        errors.append(f"{label} has invalid line in Questions section")

    flush()

    if expected_count != len(blocks):
        errors.append(f"{label} expected {expected_count} questions, found {len(blocks)}")

    width = max(2, len(str(expected_count)))
    expected_ids = [f"q{index:0{width}d}" for index in range(1, expected_count + 1)]
    seen: set[str] = set()
    for block in blocks:
        question_id = block.get("question_id", "").strip()
        scale_id = block.get("scale_id", "").strip()
        prompt = block.get("prompt", "").strip()

        if not question_id:
            errors.append(f"{label} question is missing QID")
            continue
        if question_id in seen:
            errors.append(f"{label} has duplicate question id {question_id}")
            continue
        seen.add(question_id)
        if question_id not in expected_ids:
            errors.append(f"{label} question id {question_id} must match q01..qNN")

        if not scale_id:
            errors.append(f"{label} question {question_id} missing Scale")
        elif scale_id not in scales:
            errors.append(f"{label} question {question_id} scale {scale_id} not in scales")

        if not prompt:
            errors.append(f"{label} question {question_id} missing Prompt")

    if set(expected_ids) != seen:
        missing = [qid for qid in expected_ids if qid not in seen]
        if missing:
            errors.append(f"{label} missing questions: {', '.join(missing)}")

    return blocks


def load_locale_source(
    locale: str,
    path: Path,
    errors: list[str]
) -> tuple[dict[str, object] | None, dict[str, object], list[dict[str, str]]]:
    meta_raw, body_lines = split_front_matter(path, errors)
    if meta_raw is None:
        return None, {}, []

    meta = parse_metadata(meta_raw, str(path), errors)
    sections = parse_sections(body_lines)

    locale_sections = {
        "title": coerce_section_text(sections.get("title", [])),
        "short_description": coerce_section_text(sections.get("short_description", [])),
        "intro": coerce_section_text(sections.get("intro", [])),
        "instructions": coerce_section_text(sections.get("instructions", [])),
        "paywall_hook": coerce_section_text(sections.get("paywall_hook", [])),
        "paid_report_structure": coerce_section_text(sections.get("paid_report_structure", []))
    }

    question_lines = sections.get("questions")
    if question_lines is None:
        errors.append(f"{path} missing Questions section")
        return meta, locale_sections, []

    questions = parse_questions(
        question_lines,
        meta.get("scales", []),
        meta.get("question_count", 0),
        str(path),
        errors
    )

    return meta, locale_sections, questions


def merge_questions(
    locale_questions: dict[str, list[dict[str, str]]],
    locales: list[str],
    scales: list[str],
    question_count: int,
    errors: list[str]
) -> list[dict[str, object]]:
    merged: dict[str, dict[str, object]] = {}

    width = max(2, len(str(question_count)))
    expected_ids = [f"q{index:0{width}d}" for index in range(1, question_count + 1)]

    for locale, questions in locale_questions.items():
        for question in questions:
            qid = question.get("question_id", "")
            scale_id = question.get("scale_id", "")
            prompt = question.get("prompt", "")
            if not qid:
                continue
            entry = merged.get(qid)
            if not entry:
                entry = {"question_id": qid, "scale_id": scale_id, "prompt": {}}
                merged[qid] = entry
            if entry["scale_id"] != scale_id:
                errors.append(f"question {qid} scale mismatch between locales")
            entry_prompts = entry["prompt"]
            if isinstance(entry_prompts, dict):
                entry_prompts[locale] = prompt

    questions: list[dict[str, object]] = []
    for qid in expected_ids:
        entry = merged.get(qid)
        if not entry:
            errors.append(f"missing merged question {qid}")
            continue
        prompt_map = entry.get("prompt", {})
        if isinstance(prompt_map, dict):
            for locale in locales:
                if locale not in prompt_map:
                    errors.append(f"question {qid} missing prompt for {locale}")
        questions.append(entry)

    return questions


def main() -> int:
    args = parse_args()
    errors: list[str] = []

    source_dir = Path(args.source_dir)
    sources = {
        "en": source_dir / "source.en.md",
        "es": source_dir / "source.es.md",
        "pt-BR": source_dir / "source.pt-BR.md"
    }

    meta_by_locale: dict[str, dict[str, object]] = {}
    locales_copy: dict[str, dict[str, object]] = {}
    locale_questions: dict[str, list[dict[str, str]]] = {}

    for locale, path in sources.items():
        meta, locale_copy, questions = load_locale_source(locale, path, errors)
        if meta is None:
            continue
        meta_by_locale[locale] = meta
        locales_copy[locale] = locale_copy
        locale_questions[locale] = questions

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    if set(meta_by_locale.keys()) != set(ALLOWED_LOCALES):
        errors.append("missing metadata for one or more locales")
    else:
        reference = meta_by_locale["en"]
        for locale, meta in meta_by_locale.items():
            for key in [
                "format_id",
                "test_id",
                "slug",
                "version",
                "category",
                "primary_locale",
                "locales",
                "question_type",
                "scoring_model",
                "missing_policy",
                "question_count",
                "scales"
            ]:
                if meta.get(key) != reference.get(key):
                    errors.append(f"{locale} metadata mismatch for {key}")

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    reference_meta = meta_by_locale["en"]
    locales = reference_meta["locales"]
    if not isinstance(locales, list):
        errors.append("locales metadata must be a list")
        locales = []

    questions = merge_questions(
        locale_questions,
        locales,
        reference_meta.get("scales", []),
        reference_meta.get("question_count", 0),
        errors
    )

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    spec = {
        "format_id": reference_meta["format_id"],
        "test_id": reference_meta["test_id"],
        "slug": reference_meta["slug"],
        "version": reference_meta["version"],
        "category": reference_meta["category"],
        "question_count": reference_meta["question_count"],
        "locales": locales_copy,
        "scales": reference_meta["scales"],
        "questions": questions,
        "scoring": {
            "model": reference_meta["scoring_model"],
            "missing_policy": reference_meta["missing_policy"]
        },
        "price_eur_single": 0,
        "pack_options": []
    }

    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
