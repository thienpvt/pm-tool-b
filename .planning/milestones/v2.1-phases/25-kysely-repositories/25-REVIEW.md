---
phase: 25-kysely-repositories
reviewed: 2026-08-29T01:27:00Z
depth: deep
files_reviewed: 43
files_reviewed_list:
  - lib/db/kysely.ts
  - lib/db-tx.ts
  - lib/repositories/_kysely-helpers.ts
  - lib/repositories/auth.repo.ts
  - lib/repositories/settings.repo.ts
  - modules/admin/backend/repositories/admin.repo.ts
  - modules/admin/backend/repositories/demo-requests.repo.ts
  - modules/admin/backend/repositories/jira-config.repo.ts
  - modules/admin/backend/repositories/rag-config.repo.ts
  - modules/admin/backend/repositories/users.repo.ts
  - modules/audit/backend/repositories/audit.repo.ts
  - modules/dashboards/backend/repositories/dashboard-filter-state.repo.ts
  - modules/documents/backend/repositories/document-catalog.repo.ts
  - modules/documents/backend/repositories/document-templates.repo.ts
  - modules/documents/backend/repositories/project-document-checklist.repo.ts
  - modules/jira/backend/repositories/import-mapping.repo.ts
  - modules/operations/backend/repositories/operations.repo.ts
  - modules/portfolio/backend/repositories/fiscal-budget.repo.ts
  - modules/portfolio/backend/repositories/portfolio.repo.ts
  - modules/portfolio/backend/repositories/programs.repo.ts
  - modules/portfolio/backend/repositories/resources.repo.ts
  - modules/projects/backend/repositories/activities.repo.ts
  - modules/projects/backend/repositories/budget-adjustments.repo.ts
  - modules/projects/backend/repositories/budget.repo.ts
  - modules/projects/backend/repositories/bugs.repo.ts
  - modules/projects/backend/repositories/documents.repo.ts
  - modules/projects/backend/repositories/escalations.repo.ts
  - modules/projects/backend/repositories/financial-benefits.repo.ts
  - modules/projects/backend/repositories/holidays.repo.ts
  - modules/projects/backend/repositories/issues.repo.ts
  - modules/projects/backend/repositories/meetings.repo.ts
  - modules/projects/backend/repositories/milestones.repo.ts
  - modules/projects/backend/repositories/nonfinancial-benefits.repo.ts
  - modules/projects/backend/repositories/pm-assignments.repo.ts
  - modules/projects/backend/repositories/project-dependencies.repo.ts
  - modules/projects/backend/repositories/projects.repo.ts
  - modules/projects/backend/repositories/raid-due-date-history.repo.ts
  - modules/projects/backend/repositories/risks.repo.ts
  - modules/projects/backend/repositories/stakeholders.repo.ts
  - modules/projects/backend/repositories/team.repo.ts
  - modules/weekly/backend/repositories/weekly-export.repo.ts
  - modules/weekly/backend/repositories/weekly-periods.repo.ts
  - modules/weekly/backend/repositories/weekly-reports.repo.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-08-29T01:27:00Z  
**Depth:** deep  
**Files Reviewed:** 43 (40 production `*.repo.ts` + Kysely factory/ALS/helpers)  
**Status:** issues_found

## Summary

Deep review of Phase 25 Kysely migration against ENF-02 / D-01–D-07 focus areas. All five **BLOCKER** categories passed: single pool (no Prisma/Drizzle), zero `as any` / `as unknown as` in repos, all seven former `buildUpdate` writers retain `pickAllowed`, no production repo binds `getDb` string SQL, and `kysely-migration.gate.test.ts` passes (5/5).

Kysely infra is sound: `getKysely()` wraps the existing `getPool()` singleton; `runInTransactionOnPool` publishes transactional Kysely via `txKyselyStore` ALS; weekly period creation and PM-assignment replace/cascade paths correctly call `getKysely()` inside `runInTransaction`.

Four **WARNING** findings remain around multi-statement repo helpers that omit `runInTransaction` where partial failure leaves inconsistent rows. D-23 respected: ops/admin companies paths were not flagged for missing `withCpmo`.

## Narrative Findings (AI reviewer)

### Focus-area BLOCKER checklist (all clear)

| Focus | Verdict | Evidence |
|-------|---------|----------|
| Second Pool / Prisma / Drizzle | **PASS** | `package.json` pins `kysely@0.29.5` only; `getKysely()` calls `getPool()`; no Prisma/Drizzle deps |
| `as any` in repos | **PASS** | Grep across 40 production `*.repo.ts`: zero `as any` / `as unknown as` |
| `pickAllowed` on former `buildUpdate` writers | **PASS** | All seven (`projects`, `activities`, `risks`, `issues`, `meetings`, `team`, `escalations`) call `pickAllowed` before `.set(picked)` |
| `getDb` string SQL in production repos | **PASS** | Zero `getDb` imports; remaining raw SQL uses Kysely `sql` template on `getKysely()` (allowed per 25-PATTERNS) |
| Tx ALS where needed | **PARTIAL** | ALS bridge works (see `lib/db-tx.kysely.test.ts`); four repo helpers still lack wrapping (warnings below) |

## Warnings

### WR-01: `replaceUserRoles` deletes and re-inserts without a transaction

**File:** `modules/admin/backend/repositories/users.repo.ts:177-194`  
**Issue:** `replaceUserRoles` runs `DELETE FROM user_roles` then loops `INSERT` per role. A failure mid-loop leaves the user with zero or partial roles with no rollback.  
**Fix:**

```typescript
import { runInTransaction } from '@/lib/db';

export async function replaceUserRoles(/* ... */): Promise<void> {
  return runInTransaction(async () => {
    const db = await getKysely();
    await db.deleteFrom('user_roles').where('user_id', '=', Number(userId)).execute();
    for (const role of roles) {
      await db.insertInto('user_roles').values({ user_id: Number(userId), role, company_id: companyId }).execute();
    }
  });
}
```

### WR-02: `addMissingTeamMembersToPortfolio` batch inserts are not atomic

**File:** `modules/admin/backend/repositories/admin.repo.ts:187-212`  
**Issue:** The helper loops `missing.rows` and inserts one `portfolio_members` row per iteration outside any transaction. A mid-loop error yields a partially backfilled portfolio.  
**Fix:** Wrap the loop in `runInTransaction` and use `getKysely()` inside the callback so all inserts share one ALS-bound client.

### WR-03: `createProject` seeds meetings and escalations outside a transaction

**File:** `modules/projects/backend/repositories/projects.repo.ts:173-234`  
**Issue:** After inserting the project row, default meetings (lines 205–217) and escalation levels (219–231) run as separate autocommit statements. Failure after the project insert leaves a project missing default child rows.  
**Fix:**

```typescript
return runInTransaction(async () => {
  const db = await getKysely();
  const project = await db.insertInto('projects').values(values).returningAll().executeTakeFirstOrThrow();
  for (const m of DEFAULT_MEETINGS) { /* insert via db */ }
  for (const e of DEFAULT_ESCALATIONS) { /* insert via db */ }
  return project;
});
```

### WR-04: `syncProjectPmDisplay` runs outside the assignment transaction

**File:** `modules/projects/backend/repositories/pm-assignments.repo.ts:198-214`  
**Issue:** `replaceActivePrimary` / `endPrimaryWithCollaboratorCascade` correctly use `runInTransaction` + ALS, but `syncProjectPmDisplay` (denormalized `projects.pm_name` / `pm_email` update) is a separate commit. The service calls it after the transaction completes (`pm-assignments.service.ts:109-110`, `159-160`). If sync fails, assignment state and display columns diverge.  
**Fix:** Call `syncProjectPmDisplay` inside the same `runInTransaction` callback (before return), or expose a single repo entry point that ends/replaces primary and syncs atomically.

## Info

### IN-01: Weekly draft repo write lacks repo-level allowlist guard

**File:** `modules/weekly/backend/repositories/weekly-reports.repo.ts:139-149`  
**Issue:** `buildDraftSet` copies every key from `Object.entries(fields)` without throwing `UnknownColumnError`. The service layer filters via `pickAllowlistedDraft` first, so routes are safe today, but direct repo callers could pass extra keys into `.set(set)`.  
**Fix:** Add a `WEEKLY_DRAFT_COLUMNS` const and call `pickAllowed` (or inline equivalent) inside `buildDraftSet`.

### IN-02: `createActivity` uses a vacuous type assertion

**File:** `modules/projects/backend/repositories/activities.repo.ts:63`  
**Issue:** `const b = body as Record<string, never>` silences TypeScript without runtime validation on create. Not `as any`, but it defeats compile-time checking on the insert path (update path correctly uses `pickAllowed`).  
**Fix:** Replace with an explicit field map or typed `ActivityCreateInput` interface matching the insert columns.

---

_Reviewed: 2026-08-29T01:27:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
