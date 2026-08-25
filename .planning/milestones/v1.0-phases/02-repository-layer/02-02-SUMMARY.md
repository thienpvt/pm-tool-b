---
phase: 02-repository-layer
plan: 02
status: complete
commits: [7c618fd, ce4cbd7, 4306ae5]
---

# Phase 2 Plan 02 Summary: Project-Scoped Route SQL → Repositories

## Outcome

Every `db.get` / `db.all` / `db.run` call under `app/api/projects/` is gone. The
plan's own pass condition:

```
$ grep -rn "db\.\(get\|all\|run\)" app/api/projects/ --include=route.ts
(no matches)
```

## Verified

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx next build` | exit 0 |
| `npm test` with `TEST_DATABASE_URL` | 124 tests, 124 pass, 0 fail |
| `npm test` without it | exit 0, 23 pass, 101 skipped cleanly |
| `grep next/server\|@/lib/auth` in `lib/repositories/` | no matches (REPO-06) |
| Repo module imports | only `@/lib/db` and `./_helpers` |

## Repositories added or extended

`milestones` (+ epic links), `holidays`, `bugs` (snapshot model), `documents`,
`budget` (items + expenses), `settings`, `rag-config`, plus report-read functions
appended to `activities`, `risks`, `issues`, `team`, `projects`.

Every module has a `*.repo.test.ts` covering read, write, and — where the module
has an allowlist — rejected-column cases (REPO-05).

## Deviations from the plan

**Task 1 was already done.** Plan 01 rewired all four verbs on activities, risks,
issues, meetings, team, and escalations, not just the PUT paths. Task 1 of this
plan described work that no longer existed. Recorded rather than re-done.

**`escalation_levels` has no POST or DELETE** in the codebase — only GET and PUT.
Built only what exists rather than inventing endpoints.

**Epic links stay scoped by `milestone_id` alone.** The current SQL filters
`milestone_epics` by `milestone_id` without joining through `project_id`. Adding
that join would change authorization behavior, which this phase deliberately does
not do. Carried forward to Phase 5/6.

## Two real bugs found while extracting

**1. `company_rag_config` INSERT failed at runtime.** `lib/db.ts` appends
`RETURNING id` to every INSERT except `settings` and `company_jira_config`. But
`company_rag_config` also has no serial `id` — `company_id` is its primary key. So
`POST /api/admin/rag-config/[companyId]` threw `column "id" does not exist` on every
call. Fixed by adding the table to the exclusion list (`lib/db.ts:31`).

**2. The settings fallback for the Anthropic API key never worked.**
`app/api/projects/[id]/project-report/generate-email/route.ts` called:

```ts
db.get('SELECT value FROM settings WHERE key = ?', ['anthropic_api_key'])
```

The array-wrapped param reached pg as a single Postgres array literal, so the
lookup never matched a row. Routing through `getSetting('anthropic_api_key')`
passes the key as text, which fixes it. This is a behavior change — the DB
fallback now actually works — recorded here rather than left silent.

## Open findings for later phases

- Budget routes call their own local `authorize()` helper; project routes call a
  local `checkAccess`. Two parallel implementations of the same idea — Phase 5/6.
- `app/api/config/route.ts` writes the Anthropic API key into `settings` with no
  admin check. Untouched here by design; it is plan 03's scope to move the SQL and
  Phase 5/6's to add the check.
