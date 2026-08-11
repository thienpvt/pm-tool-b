---
phase: 06-access-enforcement-rollout
plan: 04
subsystem: http-access-wrappers
tags: [export, import, config, withProjectAccess, withAuth, route-conversion]
dependency:
  requires: ["06-01"]
  provides: ["ROUTE-04 export/import/config wrapper conversion"]
  affects: ["app/api/export/*", "app/api/import/resource-plan", "app/api/config"]
tech-stack:
  added: []
  patterns:
    - "withProjectAccess for project-scoped routes ([id] in path)"
    - "withAuth for system/company-scoped routes (no project id)"
    - "opts.rawBody: true for routes that parse their own body (multipart, or JSON passthrough to a generator)"
key-files:
  created:
    - app/api/config/route.test.ts
    - app/api/export/portfolio/members/route.test.ts
  modified:
    - app/api/export/excel/[id]/route.ts
    - app/api/export/ppt/[id]/route.ts
    - app/api/export/word/[id]/[type]/route.ts
    - app/api/export/weekly-report/[id]/route.ts
    - app/api/export/resource-plan/[id]/route.ts
    - app/api/export/portfolio/members/route.ts
    - app/api/import/resource-plan/[id]/route.ts
    - app/api/config/route.ts
decisions:
  - "Generators (excel.ts/ppt.ts/word.ts) keep their internal assertProjectAccess call — the wrapper's assert is a redundant-but-idempotent second projectAccessRow query, uniform across the wrapper model. Not removed."
  - "config GET converted from fully anonymous to withAuth (401 without a session) — HYG-02, same live-IDOR class as plan 06-02's 8 routes, kept in this plan to keep both handlers of config/route.ts in one file/one plan."
  - "config POST's is_admin check stays inside the handler (not at the wrapper level) — withAuth only covers the session 401; double-gating at the wrapper would need a second wrapper variant for one route."
actuals:
  tokens: 24000
  tasks: 4
  commits: 3
status: complete
---

# Phase 6 Plan 04: Convert Export/Import/Config Routes (ROUTE-04) Summary

Converted all 8 export/import/config routes onto the Phase 5 `withProjectAccess`/`withAuth`
wrappers — 3 generator-backed exports, 3 inline-assert exports/import, 1 company-scoped export,
and the config route (with one intentional new 401 on the GET).

## What shipped

**Group A — generator-backed exports → `withProjectAccess`:**
- `export/excel/[id]` (GET), `export/ppt/[id]` (POST), `export/word/[id]/[type]` (GET)
- Manual `getSessionFromRequest` + actor construction replaced with `ctx.actor`
- `generateProjectPlan`/`generateKickoffPPT`/`generateWordDoc` calls preserved exactly —
  each self-asserts project access internally (Phase 4 SVC-06)
- ppt POST uses `{ rawBody: true }` so the handler parses `req.json().catch(() => ({}))` itself,
  preserving the body passthrough verbatim
- Content-Type/Content-Disposition headers byte-identical (verified by grep diff against pre-conversion source)

**Group B — inline-assert exports/import → `withProjectAccess`:**
- `export/weekly-report/[id]` (POST), `export/resource-plan/[id]` (GET), `import/resource-plan/[id]` (POST multipart)
- Local `getSessionFromRequest` block and local `assertProjectAccess` call deleted from all 3 —
  the wrapper now does both (dedup: `grep -c assertProjectAccess` → 0 in all three)
- `import/resource-plan` uses `{ rawBody: true }` so the handler calls `req.formData()` directly;
  extraction logic (header detection, month-column parsing, member rows) untouched

**Group C — system/company-scoped → `withAuth`:**
- `export/portfolio/members` (GET): company-scoped, no project id in path — plain `withAuth`;
  `listPortfolioMembers`/`companyNameAndQuota` company scoping stays in the repo layer unchanged
- `config` (GET + POST): both routed through `withAuth`
  - **GET** (HYG-02): previously fully anonymous — no session check at all. Now 401s without a
    session. Masking logic (`anthropic_api_key` → `***` + `anthropic_api_key_set: 'true'|'env'`)
    preserved byte-for-byte.
  - **POST**: `withAuth` covers the 401; the `user.is_admin` 403 check stays INSIDE the handler
    (T-06-16) — not double-gated at the wrapper level.

## The double-assert (T-06-15)

The 3 Group A generators (`lib/export/excel.ts`, `ppt.ts`, `word.ts`) call `assertProjectAccess`
internally as part of Phase 4's SVC-06 leak closure. Converting their routes to `withProjectAccess`
adds a second `projectAccessRow` query per call — the wrapper's own assert, redundant with the
generator's. Both are kept: removing the generator's internal assert would leave a hole if the
generator is ever invoked without the wrapper (e.g. from a script or another route), and skipping
the wrapper's assert for these 3 routes specifically would fragment the wrapper model for a single
extra query per export call. This is intentional defense-in-depth, not an oversight.

## Zero new 403s; one new 401

Every conversion in Groups A and B is pure behavior-freeze: the same session check + the same
`assertProjectAccess` (now inside the wrapper instead of inline) produce the same 401/403 outcomes
as before. `export/portfolio/members` is also freeze — same session check, same company scoping.

The **one** intentional behavior change is `config` GET's new 401 (HYG-02) — it was fully
anonymous before this plan and now requires a session, matching the class of fix plan 06-02
applied to 8 other previously-anonymous routes.

## Route tests

- `export/excel/[id]`, `export/ppt/[id]`, `export/word/[id]/[type]`, `export/weekly-report/[id]`,
  `export/resource-plan/[id]`, `import/resource-plan/[id]` — pre-existing tests (Phase 4) already
  asserted 401/403/200-with-headers through mocked `getSessionFromRequest` + `projectAccessRow`;
  all passed unmodified against the wrapped routes (no test changes needed — the mocks operate
  at the layer the wrapper also calls through).
- `export/portfolio/members/route.test.ts` — new: 401 no session, 200 with original headers +
  company-scoped repo calls for a session.
- `config/route.test.ts` — new: 401 no session (HYG-02), masked settings shape for a session,
  403 non-admin POST, 200 admin POST persists settings.
- `import/resource-plan/[id]/route.test.ts` — pre-existing test already exercises the multipart
  path via `rawBody` (401 before formData, 403 before formData, 400 on owner-no-file after
  `projectAccessRow` is called) — passed unmodified.

## Verification

- `grep -L "withProjectAccess\|withAuth"` over all 8 route files → empty (all wrapped)
- `grep -c assertProjectAccess` on weekly-report/resource-plan/import-resource-plan → 0 (dedup confirmed)
- `grep -rE "next/server" lib/services/` → empty (REPO-06/SVC-03 boundary intact)
- Content-Type/Content-Disposition headers verified byte-identical against pre-conversion source
- Scoped `npx tsc --noEmit` → 0 errors in export/import/config files (unrelated pre-existing errors
  in `import-mapping`, `jira/*`, `parse-file-headers` test files belong to the parallel 06-02 executor,
  out of this plan's scope)
- `npx eslint` on export/import/config files → clean
- Full suite: 643 total, 530 passed, 0 failed, **113 skipped** (baseline held exactly)

## Deviations from Plan

### Shared-worktree note (not a code deviation)

This is a sequential executor on the main working tree with 3 parallel executors running
concurrently (06-02, 06-03, 06-05) on disjoint files, sharing one git index.

- The `export/portfolio/members` conversion (Group C, task 06-04-03) — while in this plan's
  owned file scope — landed in the parallel 06-05 executor's commit (`de116bb`) rather than a
  commit from this plan, because 06-05's task committed `programs/[id]/project-allocations` and
  `portfolio/program-allocations` in the same wave and the shared git index picked up my
  already-edited `export/portfolio/members/route.ts` + its new test file at that moment. The
  content is identical to what this plan specifies (plain `withAuth`, company scoping unchanged,
  headers preserved) — verified by diff against the committed file. No functional deviation;
  noting for commit-attribution clarity only.
- The `config/route.ts` conversion hit the same race twice while staging: two `git add`/`git
  commit` attempts each picked up a different parallel executor's in-flight staged files instead
  of (or in addition to) mine. Both times this was caught before committing — `git show
  <hash> --name-status` was checked immediately after each commit and, on the second attempt,
  confirmed the commit (`3722945`) contains exactly `app/api/config/route.ts` and
  `app/api/config/route.test.ts`. The first bad attempt's hash is not referenced anywhere (it
  captured `app/api/parse-file-headers/route.ts` and `app/api/portfolio/program-allocations/
  route.test.ts`, both owned by other plans, and is otherwise harmless — those files' real
  content was committed correctly by their owning executors in adjacent commits).
- There was also a doc-only conflict-resolution commit (`3626780`, made by a coordinating agent
  before this plan's execution) that moved the `config/route.ts` GET session-gate task from plan
  06-02 into this plan (06-04) to keep both handlers of that file in one plan — reflected in the
  06-04-PLAN.md frontmatter/tasks already read by this executor. No code impact.

**Lesson for future shared-worktree sequential executors:** always verify `git show <hash>
--name-status` immediately after every commit in a shared-index environment, before moving on —
a same-second `git add` from a concurrent process can silently ride along.

### Auto-fixed Issues

None — plan executed exactly as written for the code changes owned by this executor
(excel, ppt, word, weekly-report, resource-plan export/import, config).

## Self-Check: PASSED

- FOUND: app/api/export/excel/[id]/route.ts
- FOUND: app/api/export/ppt/[id]/route.ts
- FOUND: app/api/export/word/[id]/[type]/route.ts
- FOUND: app/api/export/weekly-report/[id]/route.ts
- FOUND: app/api/export/resource-plan/[id]/route.ts
- FOUND: app/api/export/portfolio/members/route.ts
- FOUND: app/api/import/resource-plan/[id]/route.ts
- FOUND: app/api/config/route.ts
- FOUND: app/api/config/route.test.ts
- FOUND: app/api/export/portfolio/members/route.test.ts
- FOUND commit ce152ed (Group A conversion)
- FOUND commit 2019e84 (Group B conversion)
- FOUND commit 3722945 (Group C: config GET session gate + config test) — verified
  `git show 3722945 --name-status` returns exactly app/api/config/route.ts + route.test.ts
- FOUND commit de116bb (parallel 06-05 executor; carried export/portfolio/members conversion,
  content verified identical to this plan's Group C spec)
