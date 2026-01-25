#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Iterable

ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_TESTS_ROOT = ROOT_DIR / "content" / "tests"
DEFAULT_ALLOWLIST_PATH = ROOT_DIR / "config" / "locale_lint_allowlist.json"

DEFAULT_REQUIRED_LOCALES = ["en", "es", "pt-BR"]
DEFAULT_SIMILARITY_THRESHOLD = 0.95
DEFAULT_SHORT_TOKEN_LENGTH = 4
DEFAULT_TECHNICAL_TERMS = {
    "epc",
    "rfid"
}

WHITESPACE_RE = re.compile(r"\s+")
TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


@dataclass(frozen=True)
class LintIssue:
    spec_path: str
    key: str
    locale: str
    reason: str
    similarity: float | None = None


@dataclass(frozen=True)
class Allowlist:
    spec_exceptions: set[str]
    technical_terms: set[str]
    short_token_length: int


def collapse_whitespace(value: str) -> str:
    return WHITESPACE_RE.sub(" ", value.strip())


def normalize_text(value: str) -> str:
    return collapse_whitespace(value).lower()


def compute_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def to_root_relative(path: Path) -> str:
    try:
        return path.relative_to(ROOT_DIR).as_posix()
    except ValueError:
        return path.as_posix()


def load_json(path: Path) -> tuple[Any | None, str | None]:
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except json.JSONDecodeError as exc:
        return None, f"{to_root_relative(path)} is not valid JSON: {exc}"


def load_allowlist(path: Path) -> tuple[Allowlist, str | None]:
    if not path.exists():
        return Allowlist(set(), set(DEFAULT_TECHNICAL_TERMS), DEFAULT_SHORT_TOKEN_LENGTH), None

    data, error = load_json(path)
    if error:
        return Allowlist(set(), set(DEFAULT_TECHNICAL_TERMS), DEFAULT_SHORT_TOKEN_LENGTH), error

    spec_exceptions: set[str] = set()
    technical_terms = set(DEFAULT_TECHNICAL_TERMS)
    short_token_length = DEFAULT_SHORT_TOKEN_LENGTH

    if isinstance(data, dict):
        exceptions = data.get("spec_exceptions")
        if isinstance(exceptions, list):
            for entry in exceptions:
                if isinstance(entry, str):
                    spec_exceptions.add(entry)
                elif isinstance(entry, dict) and isinstance(entry.get("spec"), str):
                    spec_exceptions.add(entry["spec"])

        terms = data.get("terms")
        if isinstance(terms, list):
            for term in terms:
                if isinstance(term, str) and term.strip():
                    technical_terms.add(term.strip().lower())

        length_override = data.get("short_token_length")
        if isinstance(length_override, int) and length_override > 0:
            short_token_length = length_override

    return Allowlist(spec_exceptions, technical_terms, short_token_length), None


def tokenize(value: str) -> list[str]:
    return TOKEN_RE.findall(value)


def is_trivial_or_allowlisted(value: str, allowlist: Allowlist) -> bool:
    collapsed = collapse_whitespace(value)
    if not collapsed:
        return True

    tokens = tokenize(collapsed)
    if not tokens:
        return True

    normalized = collapsed.lower()
    if normalized in allowlist.technical_terms:
        return True

    if len(tokens) == 1 and len(tokens[0]) <= allowlist.short_token_length:
        return True

    if all(token.isdigit() for token in tokens):
        return True

    if all(
        token.lower() in allowlist.technical_terms or len(token) <= allowlist.short_token_length or token.isdigit()
        for token in tokens
    ):
        return True

    return False


def compare_locale_pair(
    spec_path: str,
    key: str,
    locale: str,
    en_value: str,
    locale_value: str,
    threshold: float,
    allowlist: Allowlist
) -> LintIssue | None:
    en_collapsed = collapse_whitespace(en_value)
    locale_collapsed = collapse_whitespace(locale_value)
    if not en_collapsed or not locale_collapsed:
        return None

    if is_trivial_or_allowlisted(en_collapsed, allowlist) and is_trivial_or_allowlisted(locale_collapsed, allowlist):
        return None

    en_normalized = en_collapsed.lower()
    locale_normalized = locale_collapsed.lower()

    if en_normalized == locale_normalized:
        return LintIssue(spec_path, key, locale, "identical to en")

    similarity = compute_similarity(en_normalized, locale_normalized)
    if similarity >= threshold:
        return LintIssue(
            spec_path,
            key,
            locale,
            f"similarity {similarity:.3f} >= {threshold:.2f}",
            similarity=similarity
        )

    return None


def iter_spec_paths(tests_root: Path) -> Iterable[Path]:
    return sorted(tests_root.glob("**/spec.json"))


def lint_locales(
    tests_root: Path,
    required_locales: list[str],
    threshold: float,
    allowlist_path: Path
) -> tuple[list[LintIssue], list[str]]:
    issues: list[LintIssue] = []
    errors: list[str] = []

    allowlist, allowlist_error = load_allowlist(allowlist_path)
    if allowlist_error:
        errors.append(allowlist_error)

    target_locales = [locale for locale in required_locales if locale != "en"]

    for spec_path in iter_spec_paths(tests_root):
        relative_spec_path = to_root_relative(spec_path)
        if relative_spec_path in allowlist.spec_exceptions:
            continue

        data, error = load_json(spec_path)
        if error:
            errors.append(error)
            continue
        if not isinstance(data, dict):
            errors.append(f"{relative_spec_path} must be a JSON object")
            continue

        locales = data.get("locales")
        if not isinstance(locales, dict):
            errors.append(f"{relative_spec_path}.locales must be an object")
            continue

        en_locale = locales.get("en")
        if not isinstance(en_locale, dict):
            errors.append(f"{relative_spec_path}.locales.en must be an object")
            continue

        for field in ["title", "short_description"]:
            en_value = en_locale.get(field)
            if not isinstance(en_value, str):
                continue
            for locale in target_locales:
                locale_block = locales.get(locale)
                if not isinstance(locale_block, dict):
                    continue
                locale_value = locale_block.get(field)
                if not isinstance(locale_value, str):
                    continue
                issue = compare_locale_pair(
                    relative_spec_path,
                    f"locales.{locale}.{field}",
                    locale,
                    en_value,
                    locale_value,
                    threshold,
                    allowlist
                )
                if issue:
                    issues.append(issue)

        questions = data.get("questions")
        if isinstance(questions, list):
            for index, question in enumerate(questions):
                if not isinstance(question, dict):
                    continue

                question_id = question.get("id") or question.get("question_id") or f"index-{index}"

                prompt = question.get("prompt")
                if isinstance(prompt, dict):
                    en_prompt = prompt.get("en")
                    if isinstance(en_prompt, str):
                        for locale in target_locales:
                            locale_prompt = prompt.get(locale)
                            if not isinstance(locale_prompt, str):
                                continue
                            issue = compare_locale_pair(
                                relative_spec_path,
                                f"questions.{question_id}.prompt.{locale}",
                                locale,
                                en_prompt,
                                locale_prompt,
                                threshold,
                                allowlist
                            )
                            if issue:
                                issues.append(issue)

                options = question.get("options")
                if isinstance(options, list):
                    for opt_index, option in enumerate(options):
                        if not isinstance(option, dict):
                            continue
                        option_id = option.get("id") or f"index-{opt_index}"
                        label = option.get("label")
                        if not isinstance(label, dict):
                            continue
                        en_label = label.get("en")
                        if not isinstance(en_label, str):
                            continue
                        for locale in target_locales:
                            locale_label = label.get(locale)
                            if not isinstance(locale_label, str):
                                continue
                            issue = compare_locale_pair(
                                relative_spec_path,
                                f"questions.{question_id}.options.{option_id}.label.{locale}",
                                locale,
                                en_label,
                                locale_label,
                                threshold,
                                allowlist
                            )
                            if issue:
                                issues.append(issue)

        result_bands = data.get("result_bands")
        if isinstance(result_bands, list):
            for band_index, band in enumerate(result_bands):
                if not isinstance(band, dict):
                    continue
                band_id = band.get("band_id") or f"index-{band_index}"
                copy_block = band.get("copy")
                if not isinstance(copy_block, dict):
                    continue
                en_copy = copy_block.get("en")
                if not isinstance(en_copy, dict):
                    continue

                for field in ["headline", "summary"]:
                    en_value = en_copy.get(field)
                    if not isinstance(en_value, str):
                        continue
                    for locale in target_locales:
                        locale_copy = copy_block.get(locale)
                        if not isinstance(locale_copy, dict):
                            continue
                        locale_value = locale_copy.get(field)
                        if not isinstance(locale_value, str):
                            continue
                        issue = compare_locale_pair(
                            relative_spec_path,
                            f"result_bands.{band_id}.copy.{locale}.{field}",
                            locale,
                            en_value,
                            locale_value,
                            threshold,
                            allowlist
                        )
                        if issue:
                            issues.append(issue)

    return issues, errors


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Lint localized content to catch EN copy-paste in other locales."
    )
    parser.add_argument(
        "--tests-root",
        type=Path,
        default=DEFAULT_TESTS_ROOT,
        help=f"Path to content tests root (default: {to_root_relative(DEFAULT_TESTS_ROOT)})"
    )
    parser.add_argument(
        "--required-locales",
        nargs="+",
        default=list(DEFAULT_REQUIRED_LOCALES),
        help="Locales to check (default: en es pt-BR)"
    )
    parser.add_argument(
        "--similarity-threshold",
        type=float,
        default=DEFAULT_SIMILARITY_THRESHOLD,
        help=f"Similarity threshold for warnings (default: {DEFAULT_SIMILARITY_THRESHOLD})"
    )
    parser.add_argument(
        "--allowlist-path",
        type=Path,
        default=DEFAULT_ALLOWLIST_PATH,
        help=f"Path to allowlist config (default: {to_root_relative(DEFAULT_ALLOWLIST_PATH)})"
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])

    tests_root: Path = args.tests_root
    if not tests_root.exists():
        print(f"ERROR: tests root not found: {tests_root}", file=sys.stderr)
        return 2

    issues, errors = lint_locales(
        tests_root=tests_root,
        required_locales=list(args.required_locales),
        threshold=float(args.similarity_threshold),
        allowlist_path=args.allowlist_path
    )

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 2

    if not issues:
        print(
            "Locale lint passed "
            f"({len(list(iter_spec_paths(tests_root)))} specs checked, threshold={args.similarity_threshold:.2f})."
        )
        return 0

    print(
        "Locale lint failed "
        f"({len(issues)} issue(s), threshold={args.similarity_threshold:.2f})."
    )
    for issue in issues:
        print(f"- {issue.spec_path}: {issue.key} [{issue.locale}] -> {issue.reason}")

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
