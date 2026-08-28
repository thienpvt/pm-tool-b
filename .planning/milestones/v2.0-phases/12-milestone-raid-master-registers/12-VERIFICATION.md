---
phase: 12-milestone-raid-master-registers
verified: 2026-08-26T03:45:00Z
status: passed
score: 17/17 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 15
  total: 15
  not_honored: []
deferred:
  - truth: "Dashboard UI renders upcoming/overdue milestones and RAID action lists"
    addressed_in: "Phase 16"
    evidence: "Phase 16 goal: Portfolio One View dashboards; Phase 12 exports listUpcomingMilestones, listOverdueMilestones, listHighOpenRaid, listTechnologyCouncilIssues from raid-masters.service.ts"
  - truth: "Weekly report snapshots of milestones and RAID on submit"
    addressed_in: "Phase 13"
    evidence: "Phase 13 requirements MS-04, RAID-02, RAID-03; D-12 prohibits weekly snapshot tables in Phase 12"
---

# Phase 12: Milestone & RAID Master Registers Verification Report

**Phase Goal:** Milestones and RAID are the project masters — upcoming/overdue rules, soft-delete, Viewer cannot mutate
**Verified:** 2026-08-26T03:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Assigned PM/CPMO can create, update, and cancel milestones; Viewer gets ForbiddenError (MS-01) | ✓ VERIFIED | `cancelMilestone` calls `assertProjectWriteAccess` before repo (`lib/services/milestones.service.ts:50`); unit test rejects Viewer with `ForbiddenError` and skips repo call |
| 2 | Milestones retire via cancel UPDATE only — no physical DELETE (MS-05) | ✓ VERIFIED | `cancelMilestone` repo sets `status='cancelled'`, `cancelled_at`, `cancelled_by` (`lib/repositories/milestones.repo.ts:88-92`); grep finds no `DELETE FROM milestones` in `lib/`; no `deleteMilestone` export |
| 3 | HTTP DELETE on milestone calls cancelMilestone and returns `{ ok: true }` (D-13) | ✓ VERIFIED | `app/api/projects/[id]/milestones/[milestoneId]/route.ts:16-18`; route test passes |
| 4 | Cancel writes auditLog action `cancel` with before/after status (D-10) | ✓ VERIFIED | `milestones.service.ts:54-62`; unit test asserts `auditLog` call |
| 5 | listUpcomingMilestones uses 7-day inclusive UTC window; excludes completed/cancelled (MS-02) | ✓ VERIFIED | Repo SQL filters `status NOT IN ('completed','cancelled')` and `COALESCE(adjusted_end, plan_end) BETWEEN today AND windowEnd` (`milestones.repo.ts:104-107`); `raid-masters.service.ts:14-17` computes `windowEnd = today + 7`; repo integration tests pass |
| 6 | listOverdueMilestones returns rows with effective end strictly before today UTC (MS-03) | ✓ VERIFIED | Repo SQL `COALESCE(adjusted_end, plan_end) < ?` with status filter (`milestones.repo.ts:127-129`); repo test includes yesterday, excludes today |
| 7 | create/update dual-writes plan_end and end_date (D-14) | ✓ VERIFIED | `createMilestone`/`updateMilestone` in `milestones.repo.ts:31-72`; dual-write tests pass |
| 8 | migrateRaidMasters runs in getDb after migrateProjectMaster; no Prisma; only new table is raid_due_date_history (D-10, D-12) | ✓ VERIFIED | `lib/db.ts:614-617`; `RAID_MASTERS_DDL` has exactly one `CREATE TABLE` (`raid_due_date_history`); no Prisma imports in `lib/`; DDL unit test passes |
| 9 | PM/CPMO create/update/deactivate risks and issues; Viewer cannot mutate (RAID-01) | ✓ VERIFIED | All mutate paths call `assertProjectWriteAccess`; risks/issues service unit tests reject Viewer; risks route access test passes |
| 10 | Unique code per project (case-insensitive); duplicate throws ConflictError → 409 (RAID-01) | ✓ VERIFIED | Partial unique indexes `risks_project_code_lower_unique` / `issues_project_code_lower_unique`; `findRiskByCode`/`findIssueByCode` + service pre-check; repo/service tests for duplicate and SQLSTATE 23505 |
| 11 | Omitted code auto-generates zero-padded R-nnn / I-nnn (D-05) | ✓ VERIFIED | `nextAutoRiskCode`/`nextAutoIssueCode` with `padStart(3,'0')`; repo tests assert R-001 / I-001 pattern |
| 12 | HTTP DELETE on risks/issues deactivates in place; returns `{ ok: true }` (RAID-01, D-13) | ✓ VERIFIED | Routes call `deactivateRisk`/`deactivateIssue`; repo UPDATE sets `status='deactivated'`, `deactivated_at`; no `deleteRisk`/`deleteIssue` exports; route tests pass |
| 13 | Deactivate calls auditLog action `deactivate` (D-10) | ✓ VERIFIED | `risks.service.ts:104-112`, `issues.service.ts:104-112`; unit tests assert |
| 14 | Due-date change appends raid_due_date_history + auditLog; identical due_date does not append (RAID-04) | ✓ VERIFIED | `appendDueDateHistory` INSERT-only repo; `updateRisk`/`updateIssue` compare normalized strings before append; service unit tests cover change/no-change/omitted |
| 15 | Open RAID lists expose is_overdue; default order Open/In Progress → High→Medium→Low → overdue first (RAID-04, RAID-05) | ✓ VERIFIED | `RAID_IS_OVERDUE`, `RAID_OPEN_ORDER`, `RAID_ALL_ORDER` in risks/issues repos; repo integration tests assert order and `is_overdue` flags |
| 16 | listHighOpenRaid counts High Open/In Progress records (not distinct projects); listTechnologyCouncilIssues is company-scoped (RAID-06) | ✓ VERIFIED | `listHighOpenRaid` UNION ALL risks+issues, service returns `{ records, count: records.length }`; `listTechnologyCouncilIssues` filters `technology_council IS TRUE`; service unit test asserts count=3 for two risks + one issue |
| 17 | Company-scoped helpers exported from raid-masters.service.ts, not portfolio.service (D-15) | ✓ VERIFIED | `raid-masters.service.ts` exports all four helpers; grep finds no matches in `portfolio.service.ts` |

**Score:** 17/17 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Dashboard UI for upcoming/overdue/High RAID | Phase 16 | Phase 16 consumes list helpers; Phase 12 scope is backend masters only (D-03, D-08, D-11) |
| 2 | Weekly snapshot persistence on report submit | Phase 13 | MS-04, RAID-02, RAID-03 mapped to Phase 13; D-12 explicitly prohibits snapshot tables here |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `lib/db-raid-masters.ts` | DDL, migrateRaidMasters | ✓ VERIFIED | 130 lines; settings-flag idempotency; exports verified |
| `lib/db.ts` | getDb awaits migrateRaidMasters | ✓ VERIFIED | After migrateProjectMaster, before backfillWeightedCompletion |
| `lib/repositories/milestones.repo.ts` | cancel, upcoming/overdue lists | ✓ VERIFIED | WIRED via services and raid-masters.service |
| `lib/repositories/raid-due-date-history.repo.ts` | appendDueDateHistory INSERT only | ✓ VERIFIED | WIRED from risks/issues update services |
| `lib/repositories/risks.repo.ts` | code, deactivate, listHighOpenRaid, ordering | ✓ VERIFIED | WIRED |
| `lib/repositories/issues.repo.ts` | code, technology_council, deactivate, ordering | ✓ VERIFIED | WIRED |
| `lib/services/milestones.service.ts` | cancelMilestone with write gate + audit | ✓ VERIFIED | No deleteMilestone export |
| `lib/services/risks.service.ts` | ConflictError, deactivate, due-date history | ✓ VERIFIED | No deleteRisk export |
| `lib/services/issues.service.ts` | Same RAID patterns | ✓ VERIFIED | No deleteIssue export |
| `lib/services/raid-masters.service.ts` | Four company-scoped list exports | ✓ VERIFIED | listUpcomingMilestones, listOverdueMilestones, listHighOpenRaid, listTechnologyCouncilIssues |
| Milestone/RAID DELETE routes | cancel/deactivate mapping | ✓ VERIFIED | All return `{ ok: true }` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `lib/db.ts` | `lib/db-raid-masters.ts` | getDb → migrateRaidMasters | ✓ WIRED | Dynamic import at boot |
| `[milestoneId]/route.ts` | `milestones.service.ts` | DELETE → cancelMilestone | ✓ WIRED | Pattern verified |
| `raid-masters.service.ts` | `milestones.repo.ts` | upcoming/overdue with UTC window | ✓ WIRED | Pattern verified |
| `risks.service.ts` | `raid-due-date-history.repo.ts` | appendDueDateHistory on due_date change | ✓ WIRED | Import + call in updateRisk |
| `issues.service.ts` | `raid-due-date-history.repo.ts` | appendDueDateHistory on due_date change | ✓ WIRED | Import + call in updateIssue |
| `risks/route.ts` | `risks.service.ts` | DELETE → deactivateRisk | ✓ WIRED | rowId query param preserved |
| `issues/route.ts` | `issues.service.ts` | DELETE → deactivateIssue | ✓ WIRED | rowId query param preserved |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `listUpcomingMilestones` | milestone rows | JOIN milestones→projects→customers with tenant filter | ✓ | ✓ FLOWING |
| `listOverdueMilestones` | milestone rows | Same tenant SQL, `< today` predicate | ✓ | ✓ FLOWING |
| `listHighOpenRaid` | risk/issue records | UNION ALL with company tenant join | ✓ | ✓ FLOWING |
| `listTechnologyCouncilIssues` | issue rows | JOIN with technology_council filter | ✓ | ✓ FLOWING |
| `appendDueDateHistory` | history row | INSERT from prior getRisk/getIssue due_date | ✓ | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 12 test suite (123 tests) | `npx vitest run lib/db-raid-masters.ddl.unit.test.ts lib/services/*.unit.test.ts lib/repositories/*.repo.test.ts app/api/.../route*.test.ts` with `TEST_DATABASE_URL` | 13 files, 123 passed | ✓ PASS |
| DDL exactly one CREATE TABLE | `lib/db-raid-masters.ddl.unit.test.ts` | Passed | ✓ PASS |
| Viewer cancel forbidden | `milestones.service.unit.test.ts` cancelMilestone | Passed | ✓ PASS |
| RAID duplicate code ConflictError | `risks.service.unit.test.ts` | Passed | ✓ PASS |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `milestones.service.unit.test.ts` | MS-01, MS-05 | Yes | 0 | No | Behavioral | PASS |
| `milestones.repo.test.ts` | MS-02, MS-03 | Yes | 0 | No | Value/behavioral | PASS |
| `risks.service.unit.test.ts` | RAID-01, RAID-04 | Yes | 0 | No | Behavioral | PASS |
| `risks.repo.test.ts` | RAID-05 | Yes | 0 | No | Value/behavioral | PASS |
| `raid-masters.service.unit.test.ts` | RAID-06, MS-02/03 | Yes | 0 | No | Behavioral | PASS |
| `db-raid-masters.ddl.unit.test.ts` | D-10, D-12 | Yes | 0 | No | Value | PASS |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0

### Decision Coverage

All 15 trackable CONTEXT.md decisions (D-01..D-15) honored by shipped artifacts. gsd-tools decision-coverage gate: 15/15.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| MS-01 | 12-01 | PM/CPMO mutate milestones; Viewer cannot | ✓ SATISFIED | assertProjectWriteAccess on create/update/cancel |
| MS-02 | 12-01 | Upcoming milestones 7-day window | ✓ SATISFIED | listUpcomingMilestones repo + service; list helpers exported (dashboard UI deferred Phase 16) |
| MS-03 | 12-01 | Overdue milestone rule | ✓ SATISFIED | listOverdueMilestones repo + service |
| MS-05 | 12-01 | No physical milestone delete | ✓ SATISFIED | Cancel-only UPDATE; DELETE FROM milestones absent |
| RAID-01 | 12-02 | Unique codes, deactivate, Viewer gate | ✓ SATISFIED | Full RAID mutate/deactivate path |
| RAID-04 | 12-03 | Overdue flag + due-date history | ✓ SATISFIED | is_overdue SQL + appendDueDateHistory |
| RAID-05 | 12-03 | Default register ordering | ✓ SATISFIED | CASE ORDER BY in risks/issues repos; repo tests |
| RAID-06 | 12-03 | High RAID record count + tech-council list | ✓ SATISFIED | listHighOpenRaid + listTechnologyCouncilIssues |

No orphaned requirements for Phase 12.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No TBD/FIXME/XXX, stubs, or physical DELETE paths in phase artifacts |

### Human Verification

N/A — Infrastructure/foundation phase. All acceptance criteria verified programmatically via unit and repo integration tests (123/123 passed). Dashboard rendering deferred to Phase 16 per roadmap.

### Gaps Summary

No gaps found. Phase 12 delivers the master-register backend contract: soft-delete (cancel/deactivate), unique RAID codes, append-only due-date history, company-scoped list helpers in `raid-masters.service.ts`, and Viewer write-denial — without Phase 13 snapshot tables or Prisma.

---

_Verified: 2026-08-26T03:45:00Z_
_Verifier: Claude (gsd-verifier)_
