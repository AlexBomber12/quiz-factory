import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT_DIR = Path(__file__).resolve().parents[2]
CONTENT_DIR = ROOT_DIR / "scripts" / "content"
sys.path.insert(0, str(CONTENT_DIR))

import import_questions_csv
import lint_locales
import new_test
import validate_catalog


class ContentFactoryTest(unittest.TestCase):
    def test_new_test_scaffold_is_valid(self) -> None:
        with TemporaryDirectory() as temp_dir:
            tests_root = Path(temp_dir) / "content" / "tests"
            tests_root.mkdir(parents=True)
            spec_path, errors = new_test.create_test_spec(
                test_id="test-sample",
                slug="sample",
                locales=["en", "es", "pt-BR"],
                category="daily-habits",
                tests_root=tests_root
            )

            self.assertEqual(errors, [])
            self.assertIsNotNone(spec_path)
            self.assertTrue(spec_path.exists())

            data = json.loads(spec_path.read_text(encoding="utf-8"))
            validation_errors: list[str] = []
            validate_catalog.validate_spec(spec_path, data, validation_errors)
            self.assertEqual(validation_errors, [])

    def test_import_questions_csv_updates_spec(self) -> None:
        with TemporaryDirectory() as temp_dir:
            tests_root = Path(temp_dir) / "content" / "tests"
            tests_root.mkdir(parents=True)
            spec_path, errors = new_test.create_test_spec(
                test_id="test-import",
                slug="import",
                locales=["en", "es", "pt-BR"],
                category="daily-habits",
                tests_root=tests_root
            )

            self.assertEqual(errors, [])
            self.assertIsNotNone(spec_path)
            self.assertTrue(spec_path.exists())

            csv_path = Path(temp_dir) / "questions.csv"
            csv_path.write_text(
                "question_id,option_id,prompt_en,prompt_es,prompt_pt_br,"
                "option_label_en,option_label_es,option_label_pt_br,weight\n"
                "q1,q1-a,Question one,Question one,Question one,"
                "Option A,Option A,Option A,1\n"
                "q1,q1-b,Question one,Question one,Question one,"
                "Option B,Option B,Option B,0\n",
                encoding="utf-8"
            )

            import_errors = import_questions_csv.import_questions_from_csv(
                test_id="test-import",
                csv_path=csv_path,
                replace=True,
                tests_root=tests_root
            )
            self.assertEqual(import_errors, [])

            data = json.loads(spec_path.read_text(encoding="utf-8"))
            self.assertEqual(len(data["questions"]), 1)
            self.assertIn("q1-a", data["scoring"]["option_weights"])
            self.assertIn("q1-b", data["scoring"]["option_weights"])
            self.assertEqual(data["scoring"]["option_weights"]["q1-a"]["score"], 1)

            validation_errors: list[str] = []
            validate_catalog.validate_spec(spec_path, data, validation_errors)
            self.assertEqual(validation_errors, [])

    def test_import_questions_csv_rejects_duplicate_question_ids(self) -> None:
        with TemporaryDirectory() as temp_dir:
            tests_root = Path(temp_dir) / "content" / "tests"
            tests_root.mkdir(parents=True)
            spec_path, errors = new_test.create_test_spec(
                test_id="test-duplicate",
                slug="duplicate",
                locales=["en", "es", "pt-BR"],
                category="daily-habits",
                tests_root=tests_root
            )

            self.assertEqual(errors, [])
            self.assertIsNotNone(spec_path)
            self.assertTrue(spec_path.exists())

            data = json.loads(spec_path.read_text(encoding="utf-8"))
            data["questions"] = [
                {
                    "id": "q1",
                    "type": "single_choice",
                    "prompt": {
                        "en": "Existing question",
                        "es": "Existing question",
                        "pt-BR": "Existing question"
                    },
                    "options": [
                        {
                            "id": "q1-a",
                            "label": {
                                "en": "Existing option",
                                "es": "Existing option",
                                "pt-BR": "Existing option"
                            }
                        }
                    ]
                }
            ]
            data["scoring"]["option_weights"]["q1-a"] = {"score": 1}
            spec_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

            csv_path = Path(temp_dir) / "dup_questions.csv"
            csv_path.write_text(
                "question_id,option_id,prompt_en,prompt_es,prompt_pt_br,"
                "option_label_en,option_label_es,option_label_pt_br,weight\n"
                "q1,q1-b,Existing question,Existing question,Existing question,"
                "Option B,Option B,Option B,0\n",
                encoding="utf-8"
            )

            import_errors = import_questions_csv.import_questions_from_csv(
                test_id="test-duplicate",
                csv_path=csv_path,
                replace=False,
                tests_root=tests_root
            )

            self.assertEqual(len(import_errors), 1)
            self.assertIn("question_id q1 already exists", import_errors[0])

    def test_universal_spec_is_valid(self) -> None:
        spec_path = ROOT_DIR / "content" / "tests" / "test-universal-mini" / "spec.json"
        data = json.loads(spec_path.read_text(encoding="utf-8"))
        validation_errors: list[str] = []
        validate_catalog.validate_spec(spec_path, data, validation_errors)
        self.assertEqual(validation_errors, [])

    def test_universal_spec_rejects_unknown_scale(self) -> None:
        spec_path = ROOT_DIR / "content" / "tests" / "test-universal-mini" / "spec.json"
        data = json.loads(spec_path.read_text(encoding="utf-8"))
        data["questions"][0]["scale_id"] = "unknown"
        validation_errors: list[str] = []
        validate_catalog.validate_spec(spec_path, data, validation_errors)
        self.assertTrue(any("scale_id must be listed in scales" in error for error in validation_errors))

    def test_locale_lint_short_multiword_phrase_is_not_trivial(self) -> None:
        allowlist = lint_locales.Allowlist(set(), {"epc", "rfid"}, 4)
        self.assertFalse(
            lint_locales.is_trivial_or_allowlisted("Work with your team", allowlist)
        )

    def test_locale_lint_single_short_token_is_trivial(self) -> None:
        allowlist = lint_locales.Allowlist(set(), {"epc", "rfid"}, 4)
        self.assertTrue(lint_locales.is_trivial_or_allowlisted("Plan", allowlist))

    def test_locale_lint_allowlisted_terms_remain_trivial(self) -> None:
        allowlist = lint_locales.Allowlist(set(), {"epc", "rfid"}, 4)
        self.assertTrue(lint_locales.is_trivial_or_allowlisted("EPC RFID", allowlist))


if __name__ == "__main__":
    unittest.main()
