#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import validate_catalog

ROOT_DIR = Path(__file__).resolve().parents[2]

VALUE_ID_MAP = {
    "FREEDOM": "freedom",
    "SECURITY": "security",
    "ACHIEVEMENT": "achievement",
    "CONNECTION": "connection",
    "GROWTH": "growth",
    "CONTRIBUTION": "contribution",
    "RECOGNITION": "recognition",
    "ENJOYMENT": "enjoyment",
    "INTEGRITY": "integrity",
    "ORDER": "order"
}

VALUE_ORDER = [
    "freedom",
    "security",
    "achievement",
    "connection",
    "growth",
    "contribution",
    "recognition",
    "enjoyment",
    "integrity",
    "order"
]

VALUE_QUESTION_MAP = {
    "freedom": [1, 11, 21],
    "security": [2, 12, 22],
    "achievement": [3, 13, 23],
    "connection": [4, 14, 24],
    "growth": [5, 15, 25],
    "contribution": [6, 16, 26],
    "recognition": [7, 17, 27],
    "enjoyment": [8, 18, 28],
    "integrity": [9, 19, 29],
    "order": [10, 20, 30]
}

SECTION_HEADER_RE = re.compile(r"^\s*(\d+)\.\s+.+$")
VALUE_LINE_RE = re.compile(r"^\s*\d+\)\s*([A-Z0-9_]+)\s*\(([^)]+)\)\s*-\s*(.+)$")
QUESTION_LINE_RE = re.compile(r"^\s*(\d+)\.\s+(.*)$")
PAIR_LINE_RE = re.compile(r"^\s*(?:\d+\)\s*)?([A-Z0-9_]+)\s+vs\s+([A-Z0-9_]+)\s*$")


class LocaleData:
    def __init__(self, locale: str) -> None:
        self.locale = locale
        self.title = ""
        self.short_description = ""
        self.intro = ""
        self.instructions = ""
        self.scale_labels: dict[int, str] = {}
        self.questions: dict[int, str] = {}
        self.values: dict[str, dict[str, str]] = {}
        self.profiles: dict[str, dict[str, Any]] = {}
        self.conflict_pairs: list[tuple[str, str]] = []
        self.conflict_library: dict[str, dict[str, Any]] = {}
        self.preview_template = ""
        self.paywall_hook = ""
        self.paid_report_title = ""
        self.paid_report_sections: list[str] = []
        self.paywall_copy: dict[str, Any] = {}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert Values Compass markdown sources into a test spec"
    )
    parser.add_argument("--test-id", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--category", required=True)
    parser.add_argument("--version", required=True, type=int)
    parser.add_argument("--en", required=True)
    parser.add_argument("--es", required=True)
    parser.add_argument("--ptbr", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def is_underline(line: str) -> bool:
    return bool(re.match(r"^\s*[-=]{3,}\s*$", line))


def parse_sections(lines: list[str], errors: list[str], label: str) -> dict[int, list[str]]:
    sections: dict[int, list[str]] = {}
    indices: list[tuple[int, int]] = []
    for index in range(len(lines) - 1):
        match = SECTION_HEADER_RE.match(lines[index])
        if match and is_underline(lines[index + 1]):
            number = int(match.group(1))
            indices.append((number, index))

    if not indices:
        errors.append(f"{label} has no numbered sections")
        return sections

    for position, (number, start_index) in enumerate(indices):
        if number in sections:
            errors.append(f"{label} has duplicate section {number}")
            continue
        start = start_index + 2
        end = len(lines)
        if position + 1 < len(indices):
            end = indices[position + 1][1]
        sections[number] = lines[start:end]

    return sections


def first_paragraph(lines: list[str]) -> str:
    buffer: list[str] = []
    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            if buffer:
                break
            continue
        if trimmed.startswith("-"):
            continue
        buffer.append(trimmed)
    return " ".join(buffer).strip()


def parse_label_blocks(lines: list[str]) -> list[tuple[str, list[str]]]:
    blocks: list[tuple[str, list[str]]] = []
    label: str | None = None
    bullets: list[str] = []
    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            if label:
                blocks.append((label, bullets))
                label = None
                bullets = []
            continue
        if trimmed.startswith("-") or trimmed.startswith("*"):
            if label is None:
                continue
            bullets.append(trimmed.lstrip("-* ").strip())
            continue
        if label:
            blocks.append((label, bullets))
        label = trimmed
        bullets = []
    if label:
        blocks.append((label, bullets))
    return blocks


def parse_start_screen(lines: list[str], errors: list[str], label: str) -> tuple[str, str, str, dict[int, str]]:
    blocks = parse_label_blocks(lines)
    if len(blocks) < 3:
        errors.append(f"{label} section 3 must include title, short promise, and instructions")
        return "", "", "", {}

    title = " ".join(blocks[0][1]).strip()
    short_description = " ".join(blocks[1][1]).strip()
    instructions_lines = blocks[2][1]
    instructions = "\n".join(line.strip() for line in instructions_lines if line.strip()).strip()
    if not title:
        errors.append(f"{label} section 3 missing title")
    if not short_description:
        errors.append(f"{label} section 3 missing short promise")
    if not instructions:
        errors.append(f"{label} section 3 missing instructions")

    scale_labels: dict[int, str] = {}
    for line in instructions_lines:
        match = re.match(r"^\s*(\d+)\s*=\s*(.+)$", line)
        if not match:
            continue
        number = int(match.group(1))
        scale_labels[number] = match.group(2).strip()

    missing = [str(num) for num in range(1, 6) if num not in scale_labels]
    if missing:
        errors.append(f"{label} instructions missing scale labels for: {', '.join(missing)}")

    return title, short_description, instructions, scale_labels


def parse_values(lines: list[str], errors: list[str], label: str) -> dict[str, dict[str, str]]:
    values: dict[str, dict[str, str]] = {}
    for line in lines:
        match = VALUE_LINE_RE.match(line)
        if not match:
            continue
        raw_id = match.group(1)
        if raw_id not in VALUE_ID_MAP:
            errors.append(f"{label} has unknown value id {raw_id}")
            continue
        value_id = VALUE_ID_MAP[raw_id]
        values[value_id] = {
            "name": match.group(2).strip(),
            "definition": match.group(3).strip()
        }

    for value_id in VALUE_ORDER:
        if value_id not in values:
            errors.append(f"{label} missing value definition for {value_id}")

    return values


def parse_questions(lines: list[str], errors: list[str], label: str) -> dict[int, str]:
    questions: dict[int, str] = {}
    current_num: int | None = None
    current_text: list[str] = []

    def flush() -> None:
        nonlocal current_num, current_text
        if current_num is not None:
            questions[current_num] = " ".join(current_text).strip()
        current_num = None
        current_text = []

    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue
        match = QUESTION_LINE_RE.match(trimmed)
        if match:
            flush()
            current_num = int(match.group(1))
            current_text = [match.group(2).strip()]
        else:
            if current_num is not None:
                current_text.append(trimmed)

    flush()

    if len(questions) != 30:
        errors.append(f"{label} expected 30 questions, found {len(questions)}")

    for number in range(1, 31):
        if number not in questions:
            errors.append(f"{label} missing question {number}")

    return questions


def parse_scoring_map(lines: list[str], errors: list[str], label: str) -> None:
    table_values: dict[str, list[int]] = {}
    for line in lines:
        match = re.match(r"^\|\s*([A-Z0-9_]+)\s*\|\s*([0-9,\s]+)\|", line.strip())
        if not match:
            continue
        raw_id = match.group(1)
        numbers = [int(value.strip()) for value in match.group(2).split(",") if value.strip()]
        table_values[raw_id] = numbers

    for raw_id, value_id in VALUE_ID_MAP.items():
        expected = VALUE_QUESTION_MAP[value_id]
        actual = table_values.get(raw_id)
        if actual is None:
            errors.append(f"{label} missing scoring map for {raw_id}")
            continue
        if actual != expected:
            errors.append(f"{label} scoring map for {raw_id} must be {expected}")


def parse_conflict_pairs(lines: list[str], errors: list[str], label: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for line in lines:
        match = PAIR_LINE_RE.match(line.strip())
        if not match:
            continue
        left = match.group(1)
        right = match.group(2)
        if left not in VALUE_ID_MAP or right not in VALUE_ID_MAP:
            errors.append(f"{label} has unknown conflict pair {left} vs {right}")
            continue
        pairs.append((VALUE_ID_MAP[left], VALUE_ID_MAP[right]))

    if not pairs:
        errors.append(f"{label} has no conflict pairs")

    return pairs


def parse_profiles(lines: list[str], errors: list[str], label: str) -> dict[str, dict[str, Any]]:
    profiles: dict[str, dict[str, Any]] = {}
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        match = re.match(r"^\s*([A-Z0-9_]+)\s*\(([^)]+)\)\s*$", line)
        if match and match.group(1) in VALUE_ID_MAP:
            raw_id = match.group(1)
            value_id = VALUE_ID_MAP[raw_id]
            start = index + 1
            if start < len(lines) and is_underline(lines[start]):
                start += 1
            end = start
            while end < len(lines):
                next_line = lines[end].strip()
                next_match = re.match(r"^\s*([A-Z0-9_]+)\s*\(([^)]+)\)\s*$", next_line)
                if next_match and next_match.group(1) in VALUE_ID_MAP:
                    break
                end += 1
            blocks = parse_label_blocks(lines[start:end])
            if len(blocks) < 2:
                errors.append(f"{label} profile for {raw_id} missing preview or paid blocks")
            else:
                preview = " ".join(blocks[0][1]).strip()
                paid = [line.strip() for line in blocks[1][1] if line.strip()]
                if not preview:
                    errors.append(f"{label} profile preview missing for {raw_id}")
                if not paid:
                    errors.append(f"{label} profile paid copy missing for {raw_id}")
                profiles[value_id] = {
                    "preview": preview,
                    "paid": paid
                }
            index = end
            continue
        index += 1

    for value_id in VALUE_ORDER:
        if value_id not in profiles:
            errors.append(f"{label} missing profile copy for {value_id}")

    return profiles


def parse_conflict_library(lines: list[str], errors: list[str], label: str) -> dict[str, dict[str, Any]]:
    conflict_library: dict[str, dict[str, Any]] = {}
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        match = PAIR_LINE_RE.match(line)
        if match and match.group(1) in VALUE_ID_MAP and match.group(2) in VALUE_ID_MAP:
            left = VALUE_ID_MAP[match.group(1)]
            right = VALUE_ID_MAP[match.group(2)]
            pair_id = f"{left}_vs_{right}"
            start = index + 1
            if start < len(lines) and is_underline(lines[start]):
                start += 1
            end = start
            while end < len(lines):
                next_line = lines[end].strip()
                next_match = PAIR_LINE_RE.match(next_line)
                if next_match and next_match.group(1) in VALUE_ID_MAP and next_match.group(2) in VALUE_ID_MAP:
                    break
                end += 1
            blocks = parse_label_blocks(lines[start:end])
            if not blocks:
                errors.append(f"{label} conflict block missing for {pair_id}")
            else:
                level = blocks[0][0].strip()
                summary = " ".join(blocks[0][1]).strip()
                playbook: list[str] = []
                if len(blocks) > 1:
                    playbook = [line.strip() for line in blocks[1][1] if line.strip()]
                if not summary:
                    errors.append(f"{label} conflict summary missing for {pair_id}")
                if not playbook:
                    errors.append(f"{label} conflict playbook missing for {pair_id}")
                conflict_library[pair_id] = {
                    "level": level,
                    "summary": summary,
                    "playbook": playbook
                }
            index = end
            continue
        index += 1

    if not conflict_library:
        errors.append(f"{label} conflict library is empty")

    return conflict_library


def parse_subsections(lines: list[str]) -> list[tuple[str, list[str]]]:
    subsections: list[tuple[str, list[str]]] = []
    index = 0
    while index < len(lines) - 1:
        heading = lines[index].strip()
        if heading and is_underline(lines[index + 1]):
            start = index + 2
            end = start
            while end < len(lines) - 1:
                if lines[end].strip() and is_underline(lines[end + 1]):
                    break
                end += 1
            subsections.append((heading, lines[start:end]))
            index = end
            continue
        index += 1
    return subsections


def extract_paywall_hook(lines: list[str]) -> tuple[str, list[str]]:
    cleaned_lines: list[str] = []
    hook_lines: list[str] = []
    skip_until = -1
    for index, line in enumerate(lines):
        if index <= skip_until:
            continue
        trimmed = line.strip()
        if "paywall" in trimmed.lower():
            hook_lines = []
            end = index + 1
            while end < len(lines):
                bullet = lines[end].strip()
                if not bullet:
                    break
                if bullet.startswith("-") or bullet.startswith("*"):
                    hook_lines.append(bullet.lstrip("-* ").strip())
                    end += 1
                    continue
                break
            skip_until = end - 1
            continue
        cleaned_lines.append(line)

    hook = " ".join(hook_lines).strip()
    return hook, cleaned_lines


def parse_result_templates(lines: list[str], errors: list[str], label: str) -> tuple[str, str, list[str]]:
    subsections = parse_subsections(lines)
    if len(subsections) < 2:
        errors.append(f"{label} section 9 must include free preview and paid report structure")
        return "", "", []

    free_preview_lines = subsections[0][1]
    paywall_hook, preview_lines = extract_paywall_hook(free_preview_lines)
    preview_template = "\n".join(line.rstrip() for line in preview_lines if line.strip()).strip()
    if not preview_template:
        errors.append(f"{label} free preview template is empty")
    if not paywall_hook:
        errors.append(f"{label} paywall hook missing")

    paid_lines = subsections[1][1]
    title = ""
    sections: list[str] = []
    for line in paid_lines:
        trimmed = line.strip()
        if not trimmed:
            continue
        if not title and trimmed.startswith("-"):
            title = trimmed.lstrip("-* ").strip()
        match = re.match(r"^\s*\d+\)\s*(.+)$", trimmed)
        if match:
            sections.append(match.group(1).strip())

    if not title:
        errors.append(f"{label} paid report title missing")
    if not sections:
        errors.append(f"{label} paid report sections missing")

    return preview_template, paywall_hook, [title] + sections


def parse_paywall_copy(lines: list[str], errors: list[str], label: str) -> dict[str, Any]:
    blocks = parse_label_blocks(lines)
    if len(blocks) < 3:
        errors.append(f"{label} section 10 must include CTA, bullets, and short line")
        return {}
    cta = " ".join(blocks[0][1]).strip()
    bullets = [line.strip() for line in blocks[1][1] if line.strip()]
    short_line = " ".join(blocks[2][1]).strip()
    if not cta:
        errors.append(f"{label} paywall CTA missing")
    if not bullets:
        errors.append(f"{label} paywall bullets missing")
    if not short_line:
        errors.append(f"{label} paywall short line missing")
    return {
        "cta": cta,
        "bullets": bullets,
        "short_line": short_line
    }


def parse_locale_file(path: Path, locale: str, errors: list[str]) -> LocaleData:
    label = f"{locale} ({path})"
    if not path.exists():
        errors.append(f"{label} source file not found")
        return LocaleData(locale)

    lines = path.read_text(encoding="utf-8").splitlines()
    sections = parse_sections(lines, errors, label)

    locale_data = LocaleData(locale)
    section1 = sections.get(1, [])
    section2 = sections.get(2, [])
    section3 = sections.get(3, [])
    section4 = sections.get(4, [])
    section5 = sections.get(5, [])
    section6 = sections.get(6, [])
    section7 = sections.get(7, [])
    section8 = sections.get(8, [])
    section9 = sections.get(9, [])
    section10 = sections.get(10, [])

    if not section1:
        errors.append(f"{label} missing section 1")
    if not section2:
        errors.append(f"{label} missing section 2")
    if not section3:
        errors.append(f"{label} missing section 3")
    if not section4:
        errors.append(f"{label} missing section 4")
    if not section5:
        errors.append(f"{label} missing section 5")
    if not section6:
        errors.append(f"{label} missing section 6")
    if not section7:
        errors.append(f"{label} missing section 7")
    if not section8:
        errors.append(f"{label} missing section 8")
    if not section9:
        errors.append(f"{label} missing section 9")
    if not section10:
        errors.append(f"{label} missing section 10")

    locale_data.intro = first_paragraph(section1)
    if not locale_data.intro:
        errors.append(f"{label} section 1 intro missing")

    locale_data.values = parse_values(section2, errors, label)
    locale_data.title, locale_data.short_description, locale_data.instructions, locale_data.scale_labels = (
        parse_start_screen(section3, errors, label)
    )
    locale_data.questions = parse_questions(section4, errors, label)
    parse_scoring_map(section5, errors, label)
    locale_data.conflict_pairs = parse_conflict_pairs(section6, errors, label)
    locale_data.profiles = parse_profiles(section7, errors, label)
    locale_data.conflict_library = parse_conflict_library(section8, errors, label)
    preview_template, paywall_hook, paid_parts = parse_result_templates(section9, errors, label)
    locale_data.preview_template = preview_template
    locale_data.paywall_hook = paywall_hook
    if paid_parts:
        locale_data.paid_report_title = paid_parts[0]
        locale_data.paid_report_sections = paid_parts[1:]
    locale_data.paywall_copy = parse_paywall_copy(section10, errors, label)

    return locale_data


def build_questions(locales: dict[str, LocaleData]) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    locale_keys = list(locales.keys())
    for number in range(1, 31):
        question_id = f"q{number:02d}"
        prompt: dict[str, str] = {}
        for locale in locale_keys:
            prompt[locale] = locales[locale].questions[number]
        options: list[dict[str, Any]] = []
        for opt in range(1, 6):
            option_id = f"{question_id}_{opt}"
            labels: dict[str, str] = {}
            for locale in locale_keys:
                labels[locale] = locales[locale].scale_labels[opt]
            options.append({
                "id": option_id,
                "label": labels
            })
        questions.append({
            "id": question_id,
            "type": "single_choice",
            "prompt": prompt,
            "options": options
        })
    return questions


def build_scoring() -> dict[str, Any]:
    option_weights: dict[str, dict[str, int]] = {}
    question_to_value: dict[int, str] = {}
    for value_id, question_numbers in VALUE_QUESTION_MAP.items():
        for number in question_numbers:
            question_to_value[number] = value_id

    for number in range(1, 31):
        question_id = f"q{number:02d}"
        value_id = question_to_value[number]
        for opt in range(1, 6):
            option_id = f"{question_id}_{opt}"
            option_weights[option_id] = {value_id: opt}

    return {
        "scales": VALUE_ORDER,
        "option_weights": option_weights
    }


def build_result_bands(locales: dict[str, LocaleData]) -> list[dict[str, Any]]:
    question_count = 30
    min_score = question_count * 1
    max_score = question_count * 5
    total_range = max_score - min_score + 1
    band_size = total_range // 3
    first_max = min_score + band_size - 1
    second_max = first_max + band_size
    bands = [
        ("low", min_score, first_max, "Lower alignment", "Your total score lands in the lower range."),
        ("mid", first_max + 1, second_max, "Balanced alignment", "Your total score lands in the middle range."),
        ("high", second_max + 1, max_score, "Higher alignment", "Your total score lands in the upper range.")
    ]

    result_bands: list[dict[str, Any]] = []
    for band_id, minimum, maximum, headline, summary in bands:
        copy: dict[str, Any] = {}
        for locale in locales.keys():
            copy[locale] = {
                "headline": headline,
                "summary": summary,
                "bullets": [
                    "Use your results as a reflection tool.",
                    "Compare your highest values and tensions.",
                    "Apply one change in the next week."
                ]
            }
        result_bands.append({
            "band_id": band_id,
            "min_score_inclusive": minimum,
            "max_score_inclusive": maximum,
            "copy": copy
        })

    return result_bands


def build_value_dimensions(locales: dict[str, LocaleData]) -> list[dict[str, Any]]:
    dimensions: list[dict[str, Any]] = []
    for value_id in VALUE_ORDER:
        names: dict[str, str] = {}
        definitions: dict[str, str] = {}
        for locale, data in locales.items():
            names[locale] = data.values[value_id]["name"]
            definitions[locale] = data.values[value_id]["definition"]
        dimensions.append({
            "value_id": value_id,
            "name": names,
            "definition": definitions
        })
    return dimensions


def build_profiles(locales: dict[str, LocaleData]) -> dict[str, Any]:
    profiles: dict[str, Any] = {}
    for value_id in VALUE_ORDER:
        preview: dict[str, str] = {}
        paid: dict[str, list[str]] = {}
        for locale, data in locales.items():
            preview[locale] = data.profiles[value_id]["preview"]
            paid[locale] = data.profiles[value_id]["paid"]
        profiles[value_id] = {
            "preview": preview,
            "paid": paid
        }
    return profiles


def build_conflicts(locales: dict[str, LocaleData], pairs: list[tuple[str, str]]) -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []
    for left, right in pairs:
        pair_id = f"{left}_vs_{right}"
        level: dict[str, str] = {}
        summary: dict[str, str] = {}
        playbook: dict[str, list[str]] = {}
        label_map: dict[str, str] = {}
        for locale, data in locales.items():
            value_left = data.values[left]["name"]
            value_right = data.values[right]["name"]
            label_map[locale] = f"{value_left} vs {value_right}"
            entry = data.conflict_library.get(pair_id, {})
            level[locale] = entry.get("level", "")
            summary[locale] = entry.get("summary", "")
            playbook[locale] = entry.get("playbook", [])
        conflicts.append({
            "pair_id": pair_id,
            "a": left,
            "b": right,
            "label": label_map,
            "copy": {
                "level": level,
                "summary": summary,
                "playbook": playbook
            }
        })
    return conflicts


def build_templates(locales: dict[str, LocaleData]) -> dict[str, Any]:
    preview_template: dict[str, str] = {}
    paywall_hook: dict[str, str] = {}
    paid_report_title: dict[str, str] = {}
    paid_report_sections: dict[str, list[str]] = {}
    paywall_copy: dict[str, Any] = {}

    for locale, data in locales.items():
        preview_template[locale] = data.preview_template
        paywall_hook[locale] = data.paywall_hook
        paid_report_title[locale] = data.paid_report_title
        paid_report_sections[locale] = data.paid_report_sections
        paywall_copy[locale] = data.paywall_copy

    return {
        "preview_template": preview_template,
        "paywall_hook": paywall_hook,
        "paid_report": {
            "title": paid_report_title,
            "sections": paid_report_sections
        },
        "paywall_copy": paywall_copy
    }


def validate_locale_data(locales: dict[str, LocaleData], errors: list[str]) -> None:
    for locale, data in locales.items():
        if not data.title:
            errors.append(f"{locale} missing title")
        if not data.short_description:
            errors.append(f"{locale} missing short description")
        if not data.intro:
            errors.append(f"{locale} missing intro")
        if not data.instructions:
            errors.append(f"{locale} missing instructions")
        if not data.paywall_copy.get("cta"):
            errors.append(f"{locale} missing paywall CTA")
        if not data.paid_report_title:
            errors.append(f"{locale} missing paid report title")
        if len(data.questions) != 30:
            errors.append(f"{locale} missing questions")
        if len(data.values) != 10:
            errors.append(f"{locale} missing values")
        if len(data.profiles) != 10:
            errors.append(f"{locale} missing profiles")
        if len(data.conflict_pairs) == 0:
            errors.append(f"{locale} missing conflict pairs")


def main() -> int:
    args = parse_args()
    errors: list[str] = []

    test_id = args.test_id.strip()
    slug = args.slug.strip()
    category = args.category.strip()

    if not validate_catalog.TEST_ID_PATTERN.match(test_id):
        errors.append("test_id must match test-<slug>")
    if not validate_catalog.SLUG_PATTERN.match(slug):
        errors.append("slug must be url-safe")
    if test_id != f"test-{slug}":
        errors.append("test_id must align with slug")
    if not category:
        errors.append("category must be a non-empty string")
    if args.version < 1:
        errors.append("version must be >= 1")

    locale_paths = {
        "en": Path(args.en),
        "es": Path(args.es),
        "pt-BR": Path(args.ptbr)
    }

    locales: dict[str, LocaleData] = {}
    for locale, path in locale_paths.items():
        locales[locale] = parse_locale_file(path, locale, errors)

    validate_locale_data(locales, errors)

    base_pairs = locales["en"].conflict_pairs
    for locale, data in locales.items():
        if data.conflict_pairs != base_pairs:
            errors.append(f"{locale} conflict pairs do not match")

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1

    locales_output: dict[str, dict[str, str]] = {}
    for locale, data in locales.items():
        locales_output[locale] = {
            "title": data.title,
            "short_description": data.short_description,
            "intro": data.intro,
            "instructions": data.instructions,
            "paywall_headline": data.paywall_copy["cta"],
            "report_title": data.paid_report_title
        }

    spec = {
        "test_id": test_id,
        "slug": slug,
        "version": args.version,
        "category": category,
        "locales": locales_output,
        "questions": build_questions(locales),
        "scoring": build_scoring(),
        "result_bands": build_result_bands(locales),
        "value_dimensions": build_value_dimensions(locales),
        "value_profiles": build_profiles(locales),
        "conflicts": build_conflicts(locales, base_pairs),
        "templates": build_templates(locales)
    }

    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
