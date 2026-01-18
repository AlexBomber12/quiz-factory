#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
FIXTURE_DIR = ROOT_DIR / "content" / "sources" / "test-universal-mini"
CONVERTER = ROOT_DIR / "scripts" / "content" / "universal_human_md_to_spec.py"


def main() -> int:
    with tempfile.TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "spec.json"
        cmd = [
            sys.executable,
            str(CONVERTER),
            "--source-dir",
            str(FIXTURE_DIR),
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
        if data.get("format_id") != "universal_human_v1":
            print("ERROR: format_id must be universal_human_v1", file=sys.stderr)
            return 1

        if data.get("question_count") != 4:
            print("ERROR: expected question_count of 4", file=sys.stderr)
            return 1

        locales = data.get("locales", {})
        if set(locales.keys()) != {"en", "es", "pt-BR"}:
            print("ERROR: spec must include en, es, and pt-BR locales", file=sys.stderr)
            return 1

        scales = data.get("scales", [])
        if len(scales) != 2:
            print("ERROR: expected 2 scales", file=sys.stderr)
            return 1

        questions = data.get("questions", [])
        if len(questions) != 4:
            print("ERROR: expected 4 questions", file=sys.stderr)
            return 1

        for index, question in enumerate(questions):
            scale_id = question.get("scale_id")
            if scale_id not in scales:
                print(f"ERROR: question {index + 1} has invalid scale_id", file=sys.stderr)
                return 1
            prompt = question.get("prompt", {})
            if set(prompt.keys()) != {"en", "es", "pt-BR"}:
                print(f"ERROR: question {index + 1} missing locale prompts", file=sys.stderr)
                return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
