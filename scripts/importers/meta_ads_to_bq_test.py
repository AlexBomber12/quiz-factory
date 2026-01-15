import sys
import unittest
from datetime import date
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR))

import scripts.importers.meta_ads_to_bq as importer


class MetaAdsImporterTest(unittest.TestCase):
  def test_build_merge_condition(self) -> None:
    keys = ["date", "platform", "account_id", "campaign_id"]
    expected = (
      "(T.`date` = S.`date` OR (T.`date` IS NULL AND S.`date` IS NULL)) AND "
      "(T.`platform` = S.`platform` OR (T.`platform` IS NULL AND S.`platform` IS NULL)) AND "
      "(T.`account_id` = S.`account_id` OR (T.`account_id` IS NULL AND S.`account_id` IS NULL)) AND "
      "(T.`campaign_id` = S.`campaign_id` OR (T.`campaign_id` IS NULL AND S.`campaign_id` IS NULL))"
    )

    self.assertEqual(importer.build_merge_condition(keys), expected)

  def test_resolve_date_range_defaults(self) -> None:
    start, end = importer.resolve_date_range(14, date(2024, 5, 15))
    self.assertEqual(start, date(2024, 5, 2))
    self.assertEqual(end, date(2024, 5, 15))


if __name__ == "__main__":
  unittest.main()
