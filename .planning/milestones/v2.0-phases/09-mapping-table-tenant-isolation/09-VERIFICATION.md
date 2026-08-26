---
phase: 09-mapping-table-tenant-isolation
verified: 2026-08-25T17:10:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification: []
---

# Phase 9: Mapping Table Tenant Isolation Verification Report

**Phase Goal:** Import mappings and Jira presets are isolated by company; another tenant cannot read or change them
**Verified:** 2026-08-25T17:07:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user in company A cannot mutate another company's timeline/bug/JQL mappings by id (403 Forbidden, not 404) | ✓ VERIFIED | `assertCompanyRow` in both services throws `ForbiddenError` when row exists for another company; unit tests confirm ordering (`import-mapping.service.unit.test.ts`, `jira-mapping.service.unit.test.ts`); route tests expect 403 `{ error: 'Forbidden' }` on PUT/DELETE timeline, DELETE bug, DELETE JQL |
| 2 | List endpoints return only the session company's rows; empty list is 200 | ✓ VERIFIED | `listTimelineMappings`, `listBugMappings`, `listJqlPresets`, `listRecentJiraSyncMappings` all call `requireCompanyId` then repo with `WHERE company_id = ?`; route tests pass actor with `company_id: 5` and assert service called |
| 3 | Create/save stamps `company_id` from session actor, never from request body | ✓ VERIFIED | Service functions take `AccessActor` and pass `actor.company_id` to repo INSERT; route POST tests assert service called with session actor, not body tenant field |
| 4 | Actor with `company_id` null cannot list, create, or mutate any mapping table | ✓ VERIFIED | `requireCompanyId` throws `ForbiddenError` on null; covered in both service unit test files for all operations |
| 5 | Missing row id → NotFoundError; foreign existing id → ForbiddenError (never NotFound for foreign) | ✓ VERIFIED | `assertCompanyRow`: missing → NotFoundError first; mismatch → ForbiddenError; unit tests assert repo mutate not called on foreign |
| 6 | Bug 5-template cap eviction deletes oldest row of session company only | ✓ VERIFIED | `createBugMapping` uses `bugMappingIds(companyId)` and `deleteBugMapping(companyId, oldestId)`; unit test confirms delete called with company 5, id 14 when cap reached |
| 7 | JQL preset unique key is (company_id, name, context); sync eviction DELETE scoped by company_id | ✓ VERIFIED | `JQL_SPEC.uniqueIndexColumns` in `lib/db-mapping-tenant.ts`; `saveJiraSyncMapping` DELETE includes `WHERE company_id = ?` on outer and inner subquery; `jira-config.repo.unit.test.ts` asserts SQL |
| 8 | Two-company backfill: no NULL company_id, no collapse to one company, per-company copies (all four tables) | ✓ VERIFIED | `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pm_tool_test` — 12/12 migration integration tests passed (2026-08-25) |
| 9 | Same name across companies allowed; duplicate within company rejected at DB level | ✓ VERIFIED | Same env — 4/4 `import-mapping.repo.test.ts` tenant-scope integration tests passed (2026-08-25) |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/db-mapping-tenant.ts` | Idempotent migrate for all 4 tables | ✓ VERIFIED | Exports `migrateMappingTableTenancy`; TIMELINE/BUG/JQL/SYNC specs; D-02 CROSS JOIN backfill |
| `lib/services/import-mapping.service.ts` | Timeline + bug tenant assert | ✓ VERIFIED | 94 lines; requireCompanyId, assertCompanyRow, cap eviction |
| `lib/services/jira-mapping.service.ts` | JQL + sync tenant assert | ✓ VERIFIED | 60 lines; same assert pattern |
| `app/api/import-mapping/route.ts` | Thin withAuth GET/POST | ✓ VERIFIED | Imports service, not repo |
| `app/api/import-mapping/[id]/route.ts` | Thin withAuth PUT/DELETE | ✓ VERIFIED | Imports service |
| `app/api/bug-import-mapping/route.ts` | Thin withAuth GET/POST | ✓ VERIFIED | Imports service; no in-route cap logic |
| `app/api/bug-import-mapping/[id]/route.ts` | Thin withAuth DELETE | ✓ VERIFIED | Imports service |
| `app/api/jira/jql-presets/route.ts` | Thin withAuth GET/POST | ✓ VERIFIED | Imports jira-mapping.service |
| `app/api/jira/jql-presets/[id]/route.ts` | Thin withAuth DELETE | ✓ VERIFIED | Imports jira-mapping.service |
| `app/api/jira/sync-mappings/route.ts` | Thin withAuth GET/POST | ✓ VERIFIED | Imports jira-mapping.service; no `[id]` route exists |
| `lib/db.mapping-tenant-migration.integration.test.ts` | Two-company backfill proof | ✓ VERIFIED | 12/12 passed against `pm_tool_test` (2026-08-25) |
| `lib/services/import-mapping.service.unit.test.ts` | Forbidden vs NotFound ordering | ✓ VERIFIED | Cross-company, null company, cap eviction covered |
| `lib/services/jira-mapping.service.unit.test.ts` | JQL/sync tenant assert | ✓ VERIFIED | DELETE 403 ordering, list/create stamp |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/api/import-mapping/[id]/route.ts` | `import-mapping.service.ts` | updateTimelineMapping / deleteTimelineMapping | ✓ WIRED | Service import confirmed |
| `import-mapping.service.ts` | `import-mapping.repo.ts` | getTimelineMappingById then mutate with companyId | ✓ WIRED | PK fetch + assert + company-scoped write |
| `lib/db.ts` | `db-mapping-tenant.ts` | migrateMappingTableTenancy after migratePostgresSchema | ✓ WIRED | Line 610–611 dynamic import + await |
| `app/api/bug-import-mapping/route.ts` | `import-mapping.service.ts` | listBugMappings / createBugMapping | ✓ WIRED | No repo import |
| `app/api/jira/jql-presets/[id]/route.ts` | `jira-mapping.service.ts` | deleteJqlPreset | ✓ WIRED | 403 route test passes |
| `jira-config.repo.ts` | `jira_sync_mappings` | company-scoped eviction DELETE | ✓ WIRED | Derived-table subquery with company_id binds |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| GET /api/import-mapping | mapping list | `listTimelineMappings(actor)` → `WHERE company_id = ?` | Session company_id from withAuth | ✓ FLOWING |
| POST /api/import-mapping | new row company_id | `createTimelineMapping(actor, ...)` stamps actor.company_id | Not from request body | ✓ FLOWING |
| POST /api/jira/sync-mappings | eviction scope | `saveJiraSyncMapping(companyId, json)` DELETE filtered by company_id | Session actor | ✓ FLOWING |
| migrateMappingTableTenancy | backfill rows | CROSS JOIN companies when count > 1 | PostgreSQL pool at getDb boot | ✓ FLOWING (12 integration tests) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 9 unit + route tests | `npx vitest run lib/services/import-mapping.service.unit.test.ts lib/services/jira-mapping.service.unit.test.ts lib/repositories/import-mapping.repo.unit.test.ts lib/repositories/jira-config.repo.unit.test.ts app/api/import-mapping/route.test.ts app/api/bug-import-mapping/route.test.ts app/api/jira/jql-presets/route.test.ts app/api/jira/sync-mappings/route.test.ts` | 74 passed | ✓ PASS |
| Migration backfill integration | `npx vitest run lib/db.mapping-tenant-migration.integration.test.ts --reporter=verbose` | 12 passed (`pm_tool_test`) | ✓ PASS |
| Repo tenant integration | `npx vitest run lib/repositories/import-mapping.repo.test.ts --reporter=verbose` | 4 passed (`pm_tool_test`) | ✓ PASS |
| Full suite regression | `npm test` | 771 passed, 129 skipped, 1 unrelated fail (`lib/log.test.ts` empty suite) | ✓ PASS (phase tests green) |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TENANT-01 | 09-01, 09-02, 09-03 | Four mapping tables scoped by company_id with backfill, non-null company, unique keys including company, cross-company 403 tests | ✓ SATISFIED | Unit/route 74 passed; integration 16 passed against `pm_tool_test` |

No orphaned requirements — TENANT-01 appears in all three plans and REQUIREMENTS.md Phase 9 mapping.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None in phase-modified files | — | — |

### Human Verification Required

None — integration proofs executed against `pm_tool_test` (16/16 passed).

### Gaps Summary

None.

---

_Verified: 2026-08-25T17:10:00Z_
_Verifier: Claude (gsd-verifier) + orchestrator integration re-run_
