import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT_DIR = Path(__file__).resolve().parents[2]
CONTENT_DIR = ROOT_DIR / "scripts" / "content"
sys.path.insert(0, str(CONTENT_DIR))

import import_questions_csv
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


if __name__ == "__main__":
    unittest.main()
