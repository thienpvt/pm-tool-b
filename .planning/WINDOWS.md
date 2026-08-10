---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-08-10T08:26:21.183Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | stub | app/api/jira/search/route.ts | 13 | Old inline Jira credential block kept as dead code (INTG-08 cutover gate blocked, no DATABASE_URL) — delete after verify-credential-cutover.ts passes | open |  | 2026-08-10T08:26:18.238Z |  |
| 2 | 03 | stub | app/api/jira/fields/route.ts | 47 | Old inline Jira credential block kept as dead code (INTG-08 cutover gate blocked, no DATABASE_URL) — delete after verify-credential-cutover.ts passes | open |  | 2026-08-10T08:26:19.806Z |  |
| 3 | 03 | unrun-verify | scripts/verify-credential-cutover.ts |  | INTG-08 cutover evidence could not be run — no reachable DATABASE_URL; operator must run npx tsx scripts/verify-credential-cutover.ts then land HYG-01 deletion commit | open |  | 2026-08-10T08:26:21.183Z |  |

````json
[
  {
    "id": 1,
    "kind": "stub",
    "phase": "03",
    "file": "app/api/jira/search/route.ts",
    "line": 13,
    "description": "Old inline Jira credential block kept as dead code (INTG-08 cutover gate blocked, no DATABASE_URL) — delete after verify-credential-cutover.ts passes",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-10T08:26:18.238Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "03",
    "file": "app/api/jira/fields/route.ts",
    "line": 47,
    "description": "Old inline Jira credential block kept as dead code (INTG-08 cutover gate blocked, no DATABASE_URL) — delete after verify-credential-cutover.ts passes",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-10T08:26:19.806Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "scripts/verify-credential-cutover.ts",
    "line": null,
    "description": "INTG-08 cutover evidence could not be run — no reachable DATABASE_URL; operator must run npx tsx scripts/verify-credential-cutover.ts then land HYG-01 deletion commit",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-10T08:26:21.183Z",
    "resolved_at": null
  }
]
````
