#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import validate_catalog

ROOT_DIR = Path(__file__).resolve().parents[2]
TESTS_ROOT = ROOT_DIR / "content" / "tests"

REQUIRED_COLUMNS = {
    "question_id",
    "option_id",
    "prompt_en",
    "prompt_es",
    "prompt_pt_br",
    "option_label_en",
    "option_label_es",
    "option_label_pt_br",
    "weight"
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import questions from a CSV file into a test spec."
    )
    parser.add_argument("--test-id", required=True, help="Test id in the form test-<slug>")
    parser.add_argument("--csv", required=True, help="Path to CSV file")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing questions instead of appending"
    )
    return parser.parse_args()


def parse_weight(raw: str, row_label: str, errors: list[str]) -> int | None:
    try:
        weight = int(raw)
    except (TypeError, ValueError):
        errors.append(f"{row_label} weight must be an integer")
        return None
    return weight


def load_csv_rows(csv_path: Path, errors: list[str]) -> list[dict[str, str]]:
    if not csv_path.exists():
        errors.append(f"csv file not found: {csv_path}")
        return []

    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = set(reader.fieldnames or [])
        missing = REQUIRED_COLUMNS - fieldnames
        if missing:
            errors.append(
                "csv file missing required columns: "
                + ", ".join(sorted(missing))
            )
            return []
        rows = list(reader)

    if not rows:
        errors.append("csv file must include at least one data row")
    return rows


def build_questions_from_rows(
    rows: list[dict[str, str]],
    errors: list[str]
) -> tuple[list[dict[str, object]], dict[str, dict[str, int]]]:
    questions_by_id: dict[str, dict[str, object]] = {}
    question_order: list[str] = []
    option_weights: dict[str, dict[str, int]] = {}
    seen_option_ids: set[str] = set()

    for index, row in enumerate(rows, start=2):
        row_label = f"row {index}"
        question_id = (row.get("question_id") or "").strip()
        option_id = (row.get("option_id") or "").strip()

        if not question_id:
            errors.append(f"{row_label} question_id is required")
            continue
        if not option_id:
            errors.append(f"{row_label} option_id is required")
            continue
        if option_id in seen_option_ids:
            errors.append(f"{row_label} option_id {option_id} is duplicated")
            continue
        seen_option_ids.add(option_id)

        prompt = {
            "en": (row.get("prompt_en") or "").strip(),
            "es": (row.get("prompt_es") or "").strip(),
            "pt-BR": (row.get("prompt_pt_br") or "").strip()
        }
        label = {
            "en": (row.get("option_label_en") or "").strip(),
            "es": (row.get("option_label_es") or "").strip(),
            "pt-BR": (row.get("option_label_pt_br") or "").strip()
        }

        if not all(prompt.values()):
            errors.append(f"{row_label} prompt fields must be non-empty")
            continue
        if not all(label.values()):
            errors.append(f"{row_label} option label fields must be non-empty")
            continue

        weight = parse_weight(row.get("weight", "").strip(), row_label, errors)
        if weight is None:
            continue

        if question_id not in questions_by_id:
            questions_by_id[question_id] = {
                "id": question_id,
                "type": "single_choice",
                "prompt": prompt,
                "options": []
            }
            question_order.append(question_id)
        else:
            existing_prompt = questions_by_id[question_id]["prompt"]
            if existing_prompt != prompt:
                errors.append(f"{row_label} prompt does not match other rows for {question_id}")
                continue

        questions_by_id[question_id]["options"].append(
            {
                "id": option_id,
                "label": label
            }
        )
        option_weights[option_id] = {"score": weight}

    questions = [questions_by_id[qid] for qid in question_order]
    if not questions and not errors:
        errors.append("csv file did not produce any questions")
    return questions, option_weights


def import_questions_from_csv(
    test_id: str,
    csv_path: Path,
    replace: bool = False,
    tests_root: Path = TESTS_ROOT
) -> list[str]:
    errors: list[str] = []

    spec_path = tests_root / test_id / "spec.json"
    if not spec_path.exists():
        return [f"spec.json not found for {test_id}: {spec_path}"]

    try:
        spec_data = json.loads(spec_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"spec.json is not valid JSON: {exc}"]

    if not isinstance(spec_data, dict):
        return ["spec.json must contain a JSON object"]

    rows = load_csv_rows(csv_path, errors)
    if errors:
        return errors

    questions, option_weights = build_questions_from_rows(rows, errors)
    if errors:
        return errors

    existing_questions = spec_data.get("questions")
    if not isinstance(existing_questions, list):
        return ["spec.json questions must be an array"]

    if replace:
        spec_data["questions"] = questions
    else:
        spec_data["questions"] = existing_questions + questions

    scoring = spec_data.get("scoring")
    if not isinstance(scoring, dict):
        return ["spec.json scoring must be an object"]

    scales = scoring.get("scales")
    if not isinstance(scales, list):
        return ["spec.json scoring.scales must be an array"]
    if "score" not in scales:
        scales.append("score")

    option_weights_map = scoring.get("option_weights")
    if not isinstance(option_weights_map, dict):
        return ["spec.json scoring.option_weights must be an object"]

    if replace:
        scoring["option_weights"] = option_weights
    else:
        for option_id, weights in option_weights.items():
            if option_id in option_weights_map:
                return [f"option_id {option_id} already exists in scoring.option_weights"]
            option_weights_map[option_id] = weights

    validation_errors: list[str] = []
    validate_catalog.validate_spec(spec_path, spec_data, validation_errors)
    if validation_errors:
        return validation_errors

    spec_path.write_text(json.dumps(spec_data, indent=2) + "\n", encoding="utf-8")
    return []


def main() -> int:
    args = parse_args()
    errors = import_questions_from_csv(
        test_id=args.test_id,
        csv_path=Path(args.csv),
        replace=args.replace
    )
    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
