# PR Template

## Scope
- 

## Checklist
- [ ] Requirements verified
- [ ] CI clean
- [ ] Artifacts generated

## Notes
- 

## Queue Checklist
- [ ] Before starting: mark QUEUE status DOING using scripts/queue.*
- [ ] After local CI green: run scripts/queue.* sync (do not force DONE)
- [ ] After merge to main: run scripts/queue.* sync on main (or the next PR will sync it)

## Fixups
- Small follow-up changes discovered during the same PR should be appended to the current tasks/PR-xx.md under Fixups, rather than creating a new PR task file.
