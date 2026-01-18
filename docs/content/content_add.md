Content add pipeline
====================

Overview
--------
This repo stores human authored sources and machine readable specs for tests.
Use the content add pipeline to convert sources into spec.json and update the
catalog in a repeatable way.

Source placement
----------------
Create a folder per test_id and add three locale files:
- content/sources/<test_id>/source.en.md
- content/sources/<test_id>/source.es.md
- content/sources/<test_id>/source.pt-BR.md

Do not include secrets or PII in these files.

Run the converter manually
--------------------------
The converter reads the three locale sources and writes a spec.json file.

Example:
```
python3 scripts/content/values_compass_md_to_spec.py \
  --test-id test-values-compass \
  --slug values-compass \
  --category values \
  --version 1 \
  --en content/sources/test-values-compass/source.en.md \
  --es content/sources/test-values-compass/source.es.md \
  --ptbr content/sources/test-values-compass/source.pt-BR.md \
  --out content/tests/test-values-compass/spec.json
```

Run the orchestrator
--------------------
The orchestrator validates sources, runs the converter, and updates the catalog.

Example:
```
python3 scripts/content/content_add.py \
  --format values_compass_v1 \
  --test-id test-values-compass \
  --tenant-id tenant-tenant-example-com \
  --slug values-compass \
  --category values \
  --version 1
```

Run CONTENT ADD mode in Codex
------------------------------
1) Ensure the sources are in content/sources/<test_id>/.
2) Use the trigger phrase: Run CONTENT ADD: <test_id>
3) Provide tenant_id, and optional slug, category, or version.

Add a new converter format
--------------------------
1) Add a new converter script in scripts/content/.
2) Add fixtures and a unit test for the new format.
3) Update scripts/content/content_add.py to recognize the new format.
4) Document the new format and CLI flags in this file.
