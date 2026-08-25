---
phase: 04-service-layer
plan: 07
subsystem: api
tags: [nextjs, typescript, service-layer, multi-tenant, gap-closure]

requires:
  - phase: 04-service-layer
    provides: "projects.service.ts / programs.service.ts substrate (04-05, 04-06), access.ts (AccessActor), errors.ts (ValidationError), api-errors.ts (repoErrorResponse/serviceErrorResponse)"
provides:
  - "projects.service.ts extended with listProjects(actor) and createProject(actor, body) — collection-level company scoping and companyId tenant-placement resolution"
  - "programs.service.ts extended with listProgramsWithCounts(actor) (Promise.all + countMap merge) and createProgram(actor, body) (companyId placement + Name-required validation)"
  - "app/api/projects/route.ts and app/api/programs/route.ts route through services; no direct repository calls remain in either"
affects: [05-route-hardening]

actuals:
  tokens: 9800
  tasks: 4
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Tenant-placement decision (admin honors body.company_id, non-admin forced to session company) moves from the route into the service function itself, resolved on the same line pattern used across both resources: `actor.is_admin ? (body.company_id ?? null) : actor.company_id`"
    - "Collection-list services take the whole actor object (not pre-destructured companyId/isAdmin) so the admin-bypass and company filter stay in one place"

key-files:
  created:
    - app/api/programs/route.test.ts
  modified:
    - lib/services/projects.service.ts
    - lib/services/projects.service.unit.test.ts
    - lib/services/programs.service.ts
    - lib/services/programs.service.unit.test.ts
    - app/api/projects/route.ts
    - app/api/programs/route.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "createProject/createProgram do not catch UnknownColumnError — same propagation contract as the existing updateProject in projects.service.ts, so the route's repoErrorResponse still maps a rejected column to 400-with-columns instead of a 500."
  - "programs/route.ts GET keeps no try/catch (matching pre-plan behavior — the route never wrapped GET in a catch); POST gets a mapError helper identical in shape to the one already used in projects/[id]/route.ts (UnknownColumnError -> repoErrorResponse, else serviceErrorResponse) since createProgram can now throw a ValidationError."
  - "listProgramsWithCounts moves the whole Promise.all + countMap merge into the service — the route no longer re-assembles project_count itself, closing the risk of two divergent copies of that merge."

requirements-completed: [SVC-01, SVC-04, SVC-07]

coverage:
  - id: D1
    description: "projects.service.ts exports listProjects/createProject, company-scoped with admin bypass, companyId resolution tested for both admin-honored and non-admin-ignored cases"
    requirement: SVC-01
    verification: "lib/services/projects.service.unit.test.ts — listProjects/createProject describe blocks"
  - id: D2
    description: "programs.service.ts exports listProgramsWithCounts/createProgram; project_count merge and companyId placement tested; blank/whitespace/absent name all reject with ValidationError('Name required')"
    requirement: SVC-01
    verification: "lib/services/programs.service.unit.test.ts — listProgramsWithCounts/createProgram describe blocks"
  - id: D3
    description: "Route-level regression coverage for both collection endpoints: 401 shape asymmetry (GET [] vs POST error object), blank-name 400, admin-vs-non-admin company placement"
    requirement: SVC-07
    verification: "app/api/projects/route.test.ts (pre-existing, unchanged, still passes); app/api/programs/route.test.ts (new)"

metrics:
  duration: "~45 min"
  completed: 2026-08-11

status: complete
---

# Phase 4 Plan 07: Gap Closure — Collection Routes onto Services Summary

Converted the last two SVC-01 holdouts — `app/api/projects/route.ts` and `app/api/programs/route.ts` —
from inline repository calls to `lib/services/projects.service.ts` / `lib/services/programs.service.ts`,
moving the admin-vs-session tenant-placement decision (`companyId = actor.is_admin ? (body.company_id ?? null) : actor.company_id`)
out of both routes and into the corresponding service function, with explicit tests for both sides of that decision.

## What Changed

**`lib/services/projects.service.ts`** — extended (not rewritten) with:
- `listProjects(actor)` → thin wrapper over the repo's `listProjects(companyId, isAdmin)`, company-scoped with admin bypass.
- `createProject(actor, body)` → resolves `companyId` inside the service using the frozen tenant-placement rule, then delegates to the repo (which still seeds `DEFAULT_MEETINGS`/`DEFAULT_ESCALATIONS`). Does not catch `UnknownColumnError`, matching the propagation contract already used by `updateProject` in the same file.

**`lib/services/programs.service.ts`** — extended with:
- `listProgramsWithCounts(actor)` → the `Promise.all([listPrograms, projectCountsByProgram])` plus the `countMap` merge onto `project_count`, moved whole out of the route.
- `createProgram(actor, body)` → the `body.name?.trim()` check now throws `ValidationError('Name required')` (exact message preserved) before the same companyId resolution as `createProject`.

**`app/api/projects/route.ts`** — GET/POST now import from `@/lib/services/projects.service` instead of `@/lib/repositories/projects.repo`. Session checks and the GET-returns-`[]`/POST-returns-`{error:'Unauthorized'}` asymmetry on 401 are untouched. `repoErrorResponse` stays in the catch for both handlers.

**`app/api/programs/route.ts`** — GET/POST now import from `@/lib/services/programs.service`. POST gained a `mapError` helper (identical pattern to `projects/[id]/route.ts`: `UnknownColumnError` → `repoErrorResponse`, else `serviceErrorResponse`) since `createProgram` can now throw `ValidationError`. GET has no try/catch, matching the route's pre-existing shape (it never wrapped GET before this plan either).

**Tests** — `projects.service.unit.test.ts` and `programs.service.unit.test.ts` each got `describe` blocks for the new functions, explicitly asserting: list scoping (admin bypass vs company filter), non-admin `body.company_id` ignored, admin `body.company_id` honored, admin absent-`company_id` → `null`, and `UnknownColumnError` propagation. New `app/api/programs/route.test.ts` covers the route boundary (401 shapes, blank-name 400, admin/non-admin placement) — `app/api/projects/route.test.ts` required no changes and still passes unmodified.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 auto-fixes were needed; this was a pure refactor with test-first coverage for the one piece of real logic being relocated (the tenancy decision).

## SVC-01 Status

**SVC-01 is now complete.** All 7 SVC requirements (SVC-01 through SVC-07) are satisfied:
- SVC-01: every API resource's business logic lives in a `lib/services/*.service.ts` module — the two remaining collection routes (`projects`, `programs`) identified in `04-VERIFICATION.md` as the last completeness gap are closed by this plan.
- SVC-02 through SVC-04, SVC-06, SVC-07: previously satisfied (04-01 through 04-06), unaffected by this plan.
- SVC-05 (cross-company aggregate scoping proven with a live-DB fixture) remains **deferred to CI** — `lib/services/company-scope.repo.test.ts` is `describe.skipIf(!hasTestDb)` and requires `TEST_DATABASE_URL`, unavailable in this environment. This is unchanged from 04-06/04-VERIFICATION.md and is not part of this plan's scope.

## Verification

- `grep -c "repositories/projects.repo" app/api/projects/route.ts` → 0
- `grep -c "repositories/programs.repo" app/api/programs/route.ts` → 0
- `grep -rE "next/server|NextRequest|NextResponse" lib/services/` → no matches
- `npx tsc --noEmit` → exit 0
- `npx eslint` on all changed files → exit 0, no errors
- Full suite: `node node_modules/vitest/vitest.mjs run --reporter=json` → 573 total / 460 passed / 0 failed / 113 pending (skip baseline held exactly at 113)

## Self-Check: PASSED
