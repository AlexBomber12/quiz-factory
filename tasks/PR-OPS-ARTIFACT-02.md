PR-OPS-ARTIFACT-02: Timestamped Snapshot Artifact Name

Read and follow AGENTS.md strictly.

Context
- The repo currently produces an archive named snapshot.zip for review.
- Reusing the same filename causes confusion and makes verification unreliable.
- We need a minimal, safe change: generate a timestamped filename (date + time), while keeping backward compatibility.

Goal
- Change the snapshot/archive generation so the produced archive filename includes date and time.
- Keep generating snapshot.zip as a stable alias so any existing tooling (or human habit) still works.

Requirements
1) Timestamped filename
- New primary output: snapshot_<YYYYMMDD-HHMMSS>.zip
- Use UTC time for determinism: date -u (or an equivalent UTC timestamp in Node).
- The filename must contain only safe characters: digits and hyphen, no spaces, no colons.

2) Backward compatibility
- Also create or overwrite snapshot.zip as an alias to the latest timestamped archive.
- Prefer copying over symlinks if there is any risk the environment does not preserve symlinks in uploads.

3) Update references
- Find every place that assumes a hardcoded snapshot.zip name.
- Update docs and scripts to mention the timestamped file as the primary artifact.
- Keep snapshot.zip supported.

4) Minimal change
- Do not redesign the artifact pipeline.
- No new infrastructure.

Implementation steps
1) Locate the snapshot/archive generation code
- Search for "snapshot.zip" and "zip" usage:
  - rg "snapshot\\.zip" .
  - rg "zip -" .
- Identify the single source of truth that produces the archive (script, Node utility, or CI step).

2) Implement timestamped naming
- Compute timestamp string:
  - UTC: YYYYMMDD-HHMMSS
- Build output path: snapshot_<timestamp>.zip
- Produce the archive at that path.
- Copy it to snapshot.zip (overwrite if exists).

3) Update CI / docs
- If a GitHub Action uploads snapshot.zip, either:
  - upload the timestamped file and snapshot.zip, or
  - upload the timestamped file only but still create snapshot.zip for local workflow
- Update the relevant documentation/runbook sections that tell the user where to find the archive.

4) Verification
- Add a small smoke check in the generating script (or as a separate helper) that prints:
  - resolved timestamp
  - produced filename
  - file size
- Ensure the repo still passes all existing checks.

Definition of Done
- Running the snapshot generation produces 2 files:
  - snapshot_<YYYYMMDD-HHMMSS>.zip
  - snapshot.zip (alias to the latest)
- No workflow step breaks due to the filename change.
- Documentation referencing snapshot.zip is updated to mention the timestamped filename.
- CI passes.

Branch
- Create a new branch from main named: pr-ops-artifact-02-timestamped-snapshot
