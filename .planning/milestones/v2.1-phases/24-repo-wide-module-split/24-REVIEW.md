---
phase: 24-repo-wide-module-split
reviewed: 2026-08-28T14:22:00Z
depth: deep
files_reviewed: 48
files_reviewed_list:
  - app/api/projects/[id]/route.ts
  - app/api/projects/[id]/bugs/route.ts
  - app/api/projects/[id]/benefits/route.ts
  - app/api/projects/[id]/documents/route.ts
  - app/api/projects/[id]/team/route.ts
  - app/api/projects/[id]/stakeholders/route.ts
  - app/api/projects/[id]/dependencies/route.ts
  - app/api/projects/[id]/escalations/route.ts
  - app/api/projects/[id]/holidays/route.ts
  - app/api/projects/[id]/milestones/[milestoneId]/epics/route.ts
  - app/api/projects/[id]/milestones/[milestoneId]/route.ts
  - app/api/programs/[id]/route.ts
  - app/api/export/excel/[id]/route.ts
  - app/api/import/resource-plan/[id]/route.ts
  - app/api/operations/systems/route.ts
  - app/api/admin/companies/route.ts
  - app/page.tsx
  - app/projects/page.tsx
  - app/portfolio/report/page.tsx
  - app/operations/page.tsx
  - app/admin/page.tsx
  - modules/projects/backend/routes/projects/[id]/handlers.ts
  - modules/projects/backend/routes/projects/[id]/bugs/handlers.ts
  - modules/projects/backend/routes/projects/[id]/benefits/handlers.ts
  - modules/projects/backend/routes/projects/[id]/documents/handlers.ts
  - modules/projects/backend/routes/projects/[id]/team/handlers.ts
  - modules/projects/backend/routes/projects/[id]/issues/handlers.ts
  - modules/projects/backend/routes/projects/[id]/holidays/handlers.ts
  - modules/projects/backend/routes/projects/[id]/escalations/handlers.ts
  - modules/operations/backend/routes/operations/systems/route.ts
  - modules/admin/backend/routes/admin/companies/route.ts
  - modules/operations/backend/operations-module-split.test.ts
  - modules/portfolio/backend/portfolio-module-split.test.ts
  - modules/projects/backend/projects-module-split.test.ts
  - modules/dashboards/backend/dashboards-module-split.test.ts
  - modules/audit/backend/audit-module-split.test.ts
  - modules/weekly/backend/weekly-module-split.test.ts
  - modules/documents/backend/documents-module-split.test.ts
  - modules/reports/backend/reports-module-split.test.ts
  - modules/jira/backend/jira-module-split.test.ts
  - modules/admin/backend/admin-module-split.test.ts
  - eslint/route-wrapper-allowlist.json
  - app/api/operations/systems/route.test.ts
  - app/api/admin/companies/route.test.ts
  - app/api/projects/[id]/weekly-reports/route.ts
  - app/api/projects/[id]/document-checklist/route.ts
  - app/api/projects/[id]/fiscal-budget/route.ts
  - app/api/projects/[id]/report/route.ts
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-08-28T14:22:00Z
**Depth:** deep
**Files Reviewed:** 48
**Status:** issues_found

## Summary

Phase 24 mechanical module split is largely correct for non-projects areas: P1 page shells re-export module UI, P2/P4 API shells preserve URLs, D-07 session+tenant auth is intact on operations and admin companies, and ENF-01 wrappers remain local in `app/api` for project/program/export/import-scoped routes. No production code imports moved feature services from `@/lib/services/<feature>`.

**Wave 6 (projects P3 handler extraction) ships two blockers:** fourteen `handlers.ts` files contain syntax errors from a failed automated extraction (orphaned `withProjectAccess` closure fragments, broken imports, undefined `req` references), and nine project-scoped route shells dropped `{ schema: ... }` from `withProjectAccess` while still importing the schemas. `npx tsc --noEmit` fails on the broken handlers; affected `/api/projects/[id]/**` routes will not compile or load.

## Critical Issues

### CR-01: Wave 6 P3 handler files are syntactically invalid

**File:** `modules/projects/backend/routes/projects/[id]/bugs/handlers.ts:4-33` (and 13 sibling handlers)
**Issue:** Automated handler extraction left malformed TypeScript: dangling `import {` blocks, orphaned `}, { schema: ... },` fragments from the old inline `withProjectAccess(...)` closures, and `req` references where the parameter is named `_req`. `npx tsc --noEmit` reports 40+ errors across these files. Next.js will fail to compile any route that imports these handlers.

**Affected handler files (14):**

| Handler file | Defects |
|---|---|
| `bugs/handlers.ts` | broken import, orphaned schema, `req.url` |
| `team/handlers.ts` | broken import, orphaned schema, `req.url` |
| `stakeholders/handlers.ts` | broken import, orphaned schema |
| `meetings/handlers.ts` | broken import, orphaned schema, `req.url` |
| `dependencies/handlers.ts` | broken import, orphaned schema |
| `documents/handlers.ts` | broken import, 2× orphaned schema, `req.url` |
| `benefits/handlers.ts` | broken import, orphaned schema |
| `activities/handlers.ts` | broken import, orphaned schema, `req.url` |
| `budget/[itemId]/handlers.ts` | broken import |
| `issues/handlers.ts` | orphaned schema, `req.url` |
| `risks/handlers.ts` | orphaned schema, `req.url` |
| `holidays/handlers.ts` | orphaned schema, `req.url` |
| `escalations/handlers.ts` | orphaned schema, incomplete function body |
| `milestones/[milestoneId]/epics/handlers.ts` | orphaned schema, `req.url` |

**Fix:** Re-extract each handler from pre-split `git` originals (e.g. `78f54d9^:app/api/projects/[id]/bugs/route.ts`). Each handler should be a plain `async function` with complete service imports and no wrapper/schema syntax. Example target for bugs:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { deleteBugs, listBugs, listSnapshotDates, replaceSnapshot } from '@/modules/projects/backend/services/bugs.service';

export async function getBugsHandler(_req: NextRequest, { params, actor }: HandlerContext<{ id: string }>) {
  const url = new URL(_req.url);
  if (url.searchParams.get('list_dates') === '1') {
    return NextResponse.json(await listSnapshotDates(params.id, actor));
  }
  return NextResponse.json(await listBugs(params.id, actor, url.searchParams.get('date')));
}
```

Rename `_req` consistently and remove all `{ schema: ... }` lines from handler bodies (schemas belong on the shell — see CR-02).

### CR-02: P3 route shells dropped Zod validation on mutating methods

**File:** `app/api/projects/[id]/benefits/route.ts:9` (and 8 sibling shells)
**Issue:** Wave 6 moved handler bodies but did not reattach `{ schema: ... }` to `withProjectAccess` on several mutating exports. Schemas are imported (ESLint `@typescript-eslint/no-unused-vars` fires on `benefitPatchSchema`, `bugsInputSchema`) but never passed to the wrapper, bypassing request validation that existed pre-split (verified against `78f54d9^` originals). This violates D-03 behavior-preserving split.

**Routes with dropped schema (wrapper still present — ENF-01 OK, validation NOT OK):**

| Shell route | Method | Missing schema |
|---|---|---|
| `app/api/projects/[id]/benefits/route.ts` | PATCH | `benefitPatchSchema` |
| `app/api/projects/[id]/bugs/route.ts` | POST | `bugsInputSchema` |
| `app/api/projects/[id]/documents/route.ts` | POST, PUT | `documentInputSchema`, `documentUpdateSchema` |
| `app/api/projects/[id]/stakeholders/route.ts` | PATCH | `stakeholderEndSchema` |
| `app/api/projects/[id]/dependencies/route.ts` | PATCH | `dependencyEndSchema` |
| `app/api/projects/[id]/escalations/route.ts` | PUT | `escalationUpdateSchema` |
| `app/api/projects/[id]/holidays/route.ts` | POST | `holidayInputSchema` |
| `app/api/projects/[id]/milestones/[milestoneId]/epics/route.ts` | POST | `epicInputSchema` |
| `app/api/projects/[id]/milestones/[milestoneId]/route.ts` | PUT | `milestoneUpdateSchema` |

**Fix:** Reattach schemas on the shell, e.g.:

```typescript
// app/api/projects/[id]/benefits/route.ts
export const PATCH = withProjectAccess(patchBenefitsHandler, { schema: benefitPatchSchema });

// app/api/projects/[id]/bugs/route.ts
export const POST = withProjectAccess(postBugsHandler, { schema: bugsInputSchema });
```

Apply the same pattern for every row in the table above.

## Warnings

### WR-01: Stale portfolio contract tests reference deleted lib/services paths

**File:** `modules/portfolio/backend/portfolio-module-split.test.ts:129-138`
**Issue:** Two D-03 contract tests still read `lib/services/roi.service.ts` and `lib/services/projects.service.ts`, which were moved to module paths and no longer exist at `lib/`. `npx vitest run modules/portfolio/backend/portfolio-module-split.test.ts` fails with ENOENT (2/21 tests).

**Fix:** Retarget assertions to module paths:

```typescript
it('D-03: roi.service imports fiscal-budget.repo from module path', () => {
  const source = readUtf8('modules/projects/backend/services/roi.service.ts');
  expect(source).toContain('@/modules/portfolio/backend/repositories/fiscal-budget.repo');
});
```

### WR-02: app/api integration tests mock deleted @/lib/services paths

**File:** `app/api/operations/systems/route.test.ts:10` (and 10 sibling test files under `app/api/admin/**`, `app/api/operations/**`)
**Issue:** Route tests still `vi.mock('@/lib/services/operations.service')`, `@/lib/services/admin-platform.service`, etc. Module route handlers now import from `@/modules/*/backend/services/*`. Mocks on old paths silently fail to intercept, so tests may hit real service code or pass vacuously.

**Fix:** Retarget mocks to module service paths, e.g.:

```typescript
vi.mock('@/modules/operations/backend/services/operations.service', () => ({
  listOperationsSystems: vi.fn(),
  createOperationsSystem: vi.fn(),
}));
```

### WR-03: projects-module-split.test.ts passes despite handler syntax errors

**File:** `modules/projects/backend/projects-module-split.test.ts` (P3 ENF-01 section)
**Issue:** Contract test regex-checks that `app/api/projects/[id]/**/route.ts` files contain `withProjectAccess(` but does not import or transpile the underlying `handlers.ts` files. All 27 assertions pass while `tsc` fails on 14 handler files. Test gives false confidence for Wave 6.

**Fix:** Add a contract assertion that every `modules/projects/backend/routes/projects/[id]/**/handlers.ts` file parses under `tsc --noEmit`, or import each handler in a smoke test.

## Info

### IN-01: Auth and landing pages correctly excluded from P1 shell pattern

**File:** `app/login/page.tsx:10`, `app/landing/page.tsx:67`
**Issue:** These pages retain local component bodies rather than thin module re-exports. This is expected — they are cross-cutting auth/marketing pages, not feature-module URLs in D-06 scope.

**Fix:** None required.

## Checks Passed (review focus areas)

| Check | Result |
|---|---|
| Broken `@/lib/services/<feature>` production imports | **PASS** — only cross-cutting `access`, `errors`, `settings` remain at `lib/services/` |
| ENF-01: project-scoped routes keep local `withProjectAccess`/`withProgramAccess` | **PASS** — no pure `export { GET }` on `/projects/[id]/`, `/programs/[id]/`, `/export/**/[id]/`, `/import/resource-plan/[id]/` |
| D-07: no `withCpmo` on operations or admin companies | **PASS** — handlers use `getSessionFromRequest` + `requireAdmin`; contract tests green |
| Public URLs / P1 page shells | **PASS** — sampled pages are `'use client'` + `export { default } from '@/modules/...'` |
| ESLint allowlist drift | **PASS** — `eslint/route-wrapper-allowlist.json` matches operations-module-split expected list |
| Module-split contract tests (waves 1–5, 7–10) | **PASS** — 8/10 tracers green; portfolio tracer fails on stale lib paths (WR-01) |

---

_Reviewed: 2026-08-28T14:22:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
