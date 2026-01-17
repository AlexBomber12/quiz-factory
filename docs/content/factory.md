# Content Factory

## Create a new test
1) Run the generator with a test id, slug, locales, and category.
2) Fill in the placeholder copy in `spec.json`.
3) Add the `test_id` to `config/catalog.json` under the right tenant.
4) Run `scripts/content/validate_catalog.py` or CI.

Example:
```
python3 scripts/content/new_test.py \
  --test-id test-mindset-check \
  --slug mindset-check \
  --locales en es pt-BR \
  --category daily-habits
```

## Import questions from CSV
1) Prepare a CSV with the required columns.
2) Run the importer to append questions, or pass `--replace` to overwrite.
3) Re-run validation after the import.

Example:
```
python3 scripts/content/import_questions_csv.py \
  --test-id test-mindset-check \
  --csv /path/to/questions.csv \
  --replace
```

Required CSV columns:
- question_id
- option_id
- prompt_en
- prompt_es
- prompt_pt_br
- option_label_en
- option_label_es
- option_label_pt_br
- weight

## Common pitfalls
- `test_id` must be `test-<slug>` and match `--slug`.
- Locale tags must be `en`, `es`, or `pt-BR`.
- CSV weights must be integers.
- Option ids must be unique across the file.
