---
schema_version: 1
open_count: 4
waived_count: 0
fixed_count: 3
total_count: 7
last_updated: 2026-08-26T04:35:57.040Z
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
| 4 | 260826-ded | unrun-verify | migrations/0001-baseline-schema.sql |  | Operator-pending: scratch-DB npm run migrate idempotency check (no DB touched per standing constraint) | open |  | 2026-08-26T04:35:18.438Z |  |
| 5 | 260826-ded | unrun-verify | scripts/migrate.ts |  | Operator-pending (standing constraint - no DB touched): scratch-DB npm run migrate twice confirms baseline applies and 2nd run is a no-op; live DB adopts schema and stamps ledger | open |  | 2026-08-26T04:35:53.979Z |  |
| 6 | 260826-ded | unrun-verify | lib/migrate/runner.test.ts |  | Operator-pending (TEST_DATABASE_URL unset - skipped): run npm test -- --project node lib/migrate with TEST_DATABASE_URL=postgres://.../scratch_test to prove real-DB idempotency | open |  | 2026-08-26T04:35:55.368Z |  |
| 7 | 260826-ded | unrun-verify | lib/db.ts |  | Operator-pending (standing constraint - no DB touched): boot app against migrated scratch DB (guard passes) and against fresh empty DB (fails fast with runbook message, not 500 storm) | open |  | 2026-08-26T04:35:57.040Z |  |

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
    "phase": "260826-ded",
    "file": "migrations/0001-baseline-schema.sql",
    "line": null,
    "description": "Operator-pending: scratch-DB npm run migrate idempotency check (no DB touched per standing constraint)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T04:35:18.438Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "260826-ded",
    "file": "scripts/migrate.ts",
    "line": null,
    "description": "Operator-pending (standing constraint - no DB touched): scratch-DB npm run migrate twice confirms baseline applies and 2nd run is a no-op; live DB adopts schema and stamps ledger",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T04:35:53.979Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "260826-ded",
    "file": "lib/migrate/runner.test.ts",
    "line": null,
    "description": "Operator-pending (TEST_DATABASE_URL unset - skipped): run npm test -- --project node lib/migrate with TEST_DATABASE_URL=postgres://.../scratch_test to prove real-DB idempotency",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T04:35:55.368Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "260826-ded",
    "file": "lib/db.ts",
    "line": null,
    "description": "Operator-pending (standing constraint - no DB touched): boot app against migrated scratch DB (guard passes) and against fresh empty DB (fails fast with runbook message, not 500 storm)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T04:35:57.040Z",
    "resolved_at": null
  }
]
````
