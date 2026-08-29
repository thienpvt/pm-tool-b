---
schema_version: 1
open_count: 4
waived_count: 0
fixed_count: 3
total_count: 7
last_updated: 2026-08-29T00:59:48.273Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | stub | app/api/jira/search/route.ts | 13 | Old inline Jira credential block kept as dead code (INTG-08 cutover gate blocked, no DATABASE_URL) — delete after verify-credential-cutover.ts passes | fixed |  | 2026-08-10T08:26:18.238Z | 2026-08-25T15:05:11.142Z |
| 2 | 03 | stub | app/api/jira/fields/route.ts | 47 | Old inline Jira credential block kept as dead code (INTG-08 cutover gate blocked, no DATABASE_URL) — delete after verify-credential-cutover.ts passes | fixed |  | 2026-08-10T08:26:19.806Z | 2026-08-25T15:05:13.187Z |
| 3 | 03 | unrun-verify | scripts/verify-credential-cutover.ts |  | INTG-08 cutover evidence could not be run — no reachable DATABASE_URL; operator must run npx tsx scripts/verify-credential-cutover.ts then land HYG-01 deletion commit | fixed |  | 2026-08-10T08:26:21.183Z | 2026-08-25T15:05:15.137Z |
| 4 | 25 | unrun-verify | modules/audit/backend/repositories/audit.repo.test.ts |  | Integration tests skipped — TEST_DATABASE_URL not set in executor environment | open |  | 2026-08-29T00:26:00.038Z |  |
| 5 | 25 | unrun-verify | lib/db-tx.kysely.test.ts |  | Integration test skipped — TEST_DATABASE_URL not set in executor environment | open |  | 2026-08-29T00:29:00.579Z |  |
| 6 | 25 | unrun-verify | modules/weekly/backend/repositories/weekly-periods.repo.test.ts |  | Integration tests skipped — TEST_DATABASE_URL not set in executor environment | open |  | 2026-08-29T00:59:47.410Z |  |
| 7 | 25 | unrun-verify | modules/weekly/backend/repositories/weekly-export.repo.test.ts |  | Integration tests skipped — TEST_DATABASE_URL not set in executor environment | open |  | 2026-08-29T00:59:48.273Z |  |

````json
[
  {
    "id": 1,
    "kind": "stub",
    "phase": "03",
    "file": "app/api/jira/search/route.ts",
    "line": 13,
    "description": "Old inline Jira credential block kept as dead code (INTG-08 cutover gate blocked, no DATABASE_URL) — delete after verify-credential-cutover.ts passes",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T08:26:18.238Z",
    "resolved_at": "2026-08-25T15:05:11.142Z"
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "03",
    "file": "app/api/jira/fields/route.ts",
    "line": 47,
    "description": "Old inline Jira credential block kept as dead code (INTG-08 cutover gate blocked, no DATABASE_URL) — delete after verify-credential-cutover.ts passes",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T08:26:19.806Z",
    "resolved_at": "2026-08-25T15:05:13.187Z"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "scripts/verify-credential-cutover.ts",
    "line": null,
    "description": "INTG-08 cutover evidence could not be run — no reachable DATABASE_URL; operator must run npx tsx scripts/verify-credential-cutover.ts then land HYG-01 deletion commit",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T08:26:21.183Z",
    "resolved_at": "2026-08-25T15:05:15.137Z"
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "25",
    "file": "modules/audit/backend/repositories/audit.repo.test.ts",
    "line": null,
    "description": "Integration tests skipped — TEST_DATABASE_URL not set in executor environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-29T00:26:00.038Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "25",
    "file": "lib/db-tx.kysely.test.ts",
    "line": null,
    "description": "Integration test skipped — TEST_DATABASE_URL not set in executor environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-29T00:29:00.579Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "25",
    "file": "modules/weekly/backend/repositories/weekly-periods.repo.test.ts",
    "line": null,
    "description": "Integration tests skipped — TEST_DATABASE_URL not set in executor environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-29T00:59:47.410Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "25",
    "file": "modules/weekly/backend/repositories/weekly-export.repo.test.ts",
    "line": null,
    "description": "Integration tests skipped — TEST_DATABASE_URL not set in executor environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-29T00:59:48.273Z",
    "resolved_at": null
  }
]
````
