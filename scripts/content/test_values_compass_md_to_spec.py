#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
FIXTURES_DIR = ROOT_DIR / "scripts" / "content" / "fixtures" / "values_compass"
CONVERTER = ROOT_DIR / "scripts" / "content" / "values_compass_md_to_spec.py"


def main() -> int:
    en_path = FIXTURES_DIR / "en.md"
    es_path = FIXTURES_DIR / "es.md"
    ptbr_path = FIXTURES_DIR / "pt-BR.md"

    with tempfile.TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "spec.json"
        cmd = [
            sys.executable,
            str(CONVERTER),
            "--test-id",
            "test-values-compass",
            "--slug",
            "values-compass",
            "--category",
            "values",
            "--version",
            "1",
            "--en",
            str(en_path),
            "--es",
            str(es_path),
            "--ptbr",
            str(ptbr_path),
            "--out",
            str(output_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            print(result.stdout)
            print(result.stderr, file=sys.stderr)
            return result.returncode

        if not output_path.exists():
            print("ERROR: spec.json was not created", file=sys.stderr)
            return 1

        data = json.loads(output_path.read_text(encoding="utf-8"))
        questions = data.get("questions", [])
        if len(questions) != 30:
            print("ERROR: expected 30 questions", file=sys.stderr)
            return 1

        for index, question in enumerate(questions):
            options = question.get("options", [])
            if len(options) != 5:
                print(f"ERROR: question {index + 1} should have 5 options", file=sys.stderr)
                return 1

        locales = data.get("locales", {})
        if set(locales.keys()) != {"en", "es", "pt-BR"}:
            print("ERROR: spec must include en, es, and pt-BR locales", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
