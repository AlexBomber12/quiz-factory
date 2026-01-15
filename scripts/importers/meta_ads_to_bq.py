#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from google.cloud import bigquery

RAW_COSTS_DATASET = "raw_costs"
TMP_DATASET = "tmp"
TABLE_NAME = "ad_spend_daily"
PLATFORM = "meta"
LOOKBACK_DAYS_DEFAULT = 14
MERGE_KEYS = ["date", "platform", "account_id", "campaign_id"]
META_API_VERSION = "v19.0"

UTM_CAMPAIGN_PATTERN = re.compile(r"(?:utm_campaign=|utm_campaign:)([A-Za-z0-9_-]+)", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Import Meta ad spend into BigQuery raw_costs.ad_spend_daily"
  )
  parser.add_argument("--since", help="Start date in YYYY-MM-DD format")
  parser.add_argument("--until", help="End date in YYYY-MM-DD format")
  parser.add_argument(
    "--lookback-days",
    type=int,
    default=LOOKBACK_DAYS_DEFAULT,
    help="Number of days to look back when --since/--until are not provided"
  )
  parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Fetch data and report row count without writing to BigQuery"
  )
  return parser.parse_args()


def require_env(name: str) -> str:
  value = os.getenv(name)
  if not value:
    print(f"Missing required env var: {name}", file=sys.stderr)
    sys.exit(1)
  return value


def parse_date(value: str) -> date:
  return datetime.strptime(value, "%Y-%m-%d").date()


def resolve_date_range(lookback_days: int, today: Optional[date] = None) -> Tuple[date, date]:
  if lookback_days < 1:
    raise ValueError("lookback_days must be at least 1")
  anchor = today or date.today()
  start = anchor - timedelta(days=lookback_days - 1)
  return start, anchor


def normalize_account_id(account_id: str) -> Tuple[str, str]:
  clean = account_id.strip()
  if not clean:
    raise ValueError("META_AD_ACCOUNT_ID is empty")
  if clean.startswith("act_"):
    return clean, clean[4:]
  return f"act_{clean}", clean


def fetch_json(url: str) -> Dict[str, object]:
  request = Request(url, headers={"Accept": "application/json"})
  try:
    with urlopen(request) as response:
      payload = response.read().decode("utf-8")
      return json.loads(payload)
  except HTTPError as exc:
    payload = exc.read().decode("utf-8") if exc.fp else ""
    message = ""
    if payload:
      try:
        error_body = json.loads(payload)
        error_info = error_body.get("error", {})
        message = error_info.get("message", "")
        code = error_info.get("code")
        if code is not None:
          message = f"{message} (code {code})"
      except json.JSONDecodeError:
        message = payload
    raise RuntimeError(f"Meta API request failed: {message or exc.reason}") from exc


def fetch_meta_insights(
  access_token: str,
  api_account_id: str,
  since: date,
  until: date
) -> List[Dict[str, object]]:
  params = {
    "access_token": access_token,
    "fields": "campaign_id,campaign_name,impressions,clicks,spend,date_start",
    "level": "campaign",
    "time_increment": "1",
    "time_range": json.dumps({"since": since.isoformat(), "until": until.isoformat()}),
    "limit": "5000"
  }
  url = (
    f"https://graph.facebook.com/{META_API_VERSION}/{api_account_id}/insights?"
    f"{urlencode(params)}"
  )

  results: List[Dict[str, object]] = []
  next_url = url
  while next_url:
    response = fetch_json(next_url)
    batch = response.get("data", [])
    if isinstance(batch, list):
      results.extend(batch)
    paging = response.get("paging", {})
    next_url = paging.get("next")
  return results


def parse_decimal(value: Optional[str]) -> Decimal:
  if value is None or value == "":
    return Decimal("0")
  try:
    return Decimal(str(value))
  except InvalidOperation as exc:
    raise ValueError(f"Invalid decimal value: {value}") from exc


def parse_int(value: Optional[str]) -> int:
  if value is None or value == "":
    return 0
  try:
    return int(value)
  except ValueError:
    return 0


def extract_utm_campaign(name: Optional[str]) -> Optional[str]:
  if not name:
    return None
  match = UTM_CAMPAIGN_PATTERN.search(name)
  if not match:
    return None
  return match.group(1)


def format_decimal(value: Decimal) -> str:
  return format(value, "f")


def normalize_rows(
  rows: Iterable[Dict[str, object]],
  account_id: str
) -> List[Dict[str, object]]:
  normalized: List[Dict[str, object]] = []
  for row in rows:
    campaign_id = row.get("campaign_id")
    date_start = row.get("date_start")
    if not campaign_id or not date_start:
      continue
    campaign_name = row.get("campaign_name") or None
    utm_campaign = extract_utm_campaign(campaign_name)
    amount = parse_decimal(row.get("spend"))
    normalized.append(
      {
        "date": date_start,
        "platform": PLATFORM,
        "account_id": account_id,
        "campaign_id": campaign_id,
        "campaign_name": campaign_name,
        "utm_campaign": utm_campaign,
        "amount_eur": format_decimal(amount),
        "impressions": parse_int(row.get("impressions")),
        "clicks": parse_int(row.get("clicks"))
      }
    )
  return normalized


def dedupe_rows(rows: List[Dict[str, object]]) -> List[Dict[str, object]]:
  aggregated: Dict[Tuple[str, str, str, str], Dict[str, object]] = {}
  for row in rows:
    key = (
      str(row["date"]),
      str(row["platform"]),
      str(row["account_id"]),
      str(row["campaign_id"])
    )
    existing = aggregated.get(key)
    if not existing:
      aggregated[key] = row
      continue
    existing_amount = parse_decimal(existing.get("amount_eur"))
    incoming_amount = parse_decimal(row.get("amount_eur"))
    existing["amount_eur"] = format_decimal(existing_amount + incoming_amount)
    existing["impressions"] = int(existing.get("impressions") or 0) + int(
      row.get("impressions") or 0
    )
    existing["clicks"] = int(existing.get("clicks") or 0) + int(
      row.get("clicks") or 0
    )
    if not existing.get("campaign_name") and row.get("campaign_name"):
      existing["campaign_name"] = row.get("campaign_name")
    if not existing.get("utm_campaign") and row.get("utm_campaign"):
      existing["utm_campaign"] = row.get("utm_campaign")
  return list(aggregated.values())


def build_merge_condition(keys: List[str]) -> str:
  return " AND ".join(
    [
      f"(T.`{key}` = S.`{key}` OR (T.`{key}` IS NULL AND S.`{key}` IS NULL))"
      for key in keys
    ]
  )


def build_merge_query(
  dataset_id: str,
  table: str,
  tmp_dataset_id: str,
  tmp_table: str,
  columns: List[str],
  merge_keys: List[str]
) -> str:
  column_list = ", ".join([f"`{column}`" for column in columns])
  values_list = ", ".join([f"S.`{column}`" for column in columns])
  update_list = ", ".join([f"`{column}` = S.`{column}`" for column in columns])
  condition = build_merge_condition(merge_keys)

  return f"""
    MERGE `{dataset_id}.{table}` T
    USING `{tmp_dataset_id}.{tmp_table}` S
    ON {condition}
    WHEN MATCHED THEN
      UPDATE SET {update_list}
    WHEN NOT MATCHED THEN
      INSERT ({column_list}) VALUES ({values_list})
  """


def build_schema() -> List[bigquery.SchemaField]:
  return [
    bigquery.SchemaField("date", "DATE"),
    bigquery.SchemaField("platform", "STRING"),
    bigquery.SchemaField("account_id", "STRING"),
    bigquery.SchemaField("campaign_id", "STRING"),
    bigquery.SchemaField("campaign_name", "STRING"),
    bigquery.SchemaField("utm_campaign", "STRING"),
    bigquery.SchemaField("amount_eur", "NUMERIC"),
    bigquery.SchemaField("impressions", "INT64"),
    bigquery.SchemaField("clicks", "INT64")
  ]


def merge_to_bigquery(
  client: bigquery.Client,
  project_id: str,
  rows: List[Dict[str, object]]
) -> None:
  tmp_table_id = f"tmp_meta_ads_{int(time.time())}"
  tmp_dataset = client.dataset(TMP_DATASET, project=project_id)
  tmp_table_ref = tmp_dataset.table(tmp_table_id)
  schema = build_schema()
  table = bigquery.Table(tmp_table_ref, schema=schema)

  try:
    client.create_table(table)
    errors = client.insert_rows_json(table, rows)
    if errors:
      raise RuntimeError(f"Failed to insert rows: {errors}")

    columns = [field.name for field in schema]
    query = build_merge_query(
      f"{project_id}.{RAW_COSTS_DATASET}",
      TABLE_NAME,
      f"{project_id}.{TMP_DATASET}",
      tmp_table_id,
      columns,
      MERGE_KEYS
    )
    job = client.query(query)
    job.result()
  finally:
    client.delete_table(tmp_table_ref, not_found_ok=True)


def main() -> int:
  args = parse_args()
  access_token = require_env("META_ACCESS_TOKEN")
  account_id_raw = require_env("META_AD_ACCOUNT_ID")
  project_id = require_env("BQ_PROJECT_ID")

  api_account_id, account_id = normalize_account_id(account_id_raw)

  if args.since or args.until:
    if not args.since or not args.until:
      print("Both --since and --until are required when overriding date range", file=sys.stderr)
      return 2
    since = parse_date(args.since)
    until = parse_date(args.until)
  else:
    since, until = resolve_date_range(args.lookback_days)

  if since > until:
    print("--since must be on or before --until", file=sys.stderr)
    return 2

  print(
    f"Fetching Meta insights for account {account_id} from {since.isoformat()} to"
    f" {until.isoformat()}"
  )
  insights = fetch_meta_insights(access_token, api_account_id, since, until)
  rows = dedupe_rows(normalize_rows(insights, account_id))

  print(f"Fetched {len(rows)} rows")

  if args.dry_run:
    print(
      "Dry run mode enabled. "
      f"Would upsert {len(rows)} rows into {RAW_COSTS_DATASET}.{TABLE_NAME}."
    )
    return 0

  if not rows:
    print("No rows to upsert. Exiting.")
    return 0

  client = bigquery.Client(project=project_id)
  merge_to_bigquery(client, project_id, rows)
  print("Merge completed successfully.")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
