---
phase: 13
slug: weekly-periods-pm-submit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (node + jsdom projects) |
| **Quick run command** | `npx vitest run lib/services/weekly-reports.service.unit.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~90 seconds |

Note: Vitest 4 ignores `-x`; do not put it in plan `<automated>` commands.

---

## Sampling Rate

- **After every task commit:** Run the focused vitest file(s) in that task's `<verify><automated>`
- **After every plan wave:** `npx vitest run lib/services/weekly-reports.service.unit.test.ts lib/repositories/weekly-periods.repo.test.ts lib/repositories/weekly-reports.repo.test.ts lib/db-weekly-reports.ddl.unit.test.ts`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | PERD-01, D-14 | T-13-01 | DDL flags, uniques, no v1 document store | unit | `npx vitest run lib/db-weekly-reports.ddl.unit.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | PERD-01, PERD-02, WKRP-01 | T-13-01 | Period snapshot + shells; config change does not mutate periods | unit | `npx vitest run lib/services/weekly-reports.service.unit.test.ts lib/repositories/weekly-periods.repo.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 2 | WKRP-02, WKRP-03 | T-13-02 | Draft fields; prev RAG read-only; no RAID master write | unit | `npx vitest run lib/services/weekly-reports.service.unit.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | PERD-03, WKRP-04, WKRP-05 | T-13-03 | Submit versions; first lateness frozen; PATCH submitted 409 | unit | `npx vitest run lib/services/weekly-reports.service.unit.test.ts` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 3 | RAID-02, RAID-03, MS-04, WKRP-03 | T-13-04, T-13-05 | Submit writes masters then locks snapshot; progress copy only | unit | `npx vitest run lib/services/weekly-reports.service.unit.test.ts` | ❌ W0 | ⬜ pending |
| 13-03-02 | 03 | 3 | WKRP-06, D-13 | T-13-01, T-13-02 | History newest first; Viewer 403 mutate; CPMO period routes | route unit | `npx vitest run app/api/weekly-periods/route.test.ts app/api/projects/[id]/weekly-reports/route.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/db-weekly-reports.ts` + `lib/db-weekly-reports.ddl.unit.test.ts`
- [ ] `lib/repositories/weekly-periods.repo.ts` + tests
- [ ] `lib/repositories/weekly-reports.repo.ts` + tests
- [ ] `lib/services/weekly-reports.service.ts` + unit tests
- [ ] Multi-field submit validation (`fields: [...]`)
- [ ] `app/api/weekly-periods/route.test.ts`
- [ ] `app/api/projects/[id]/weekly-reports/**/route.test.ts`
- [ ] Wire `migrateWeeklyReports` in `lib/db.ts` after `migrateRaidMasters`

Existing Vitest + `test/db.ts` (`TEST_DATABASE_URL` must end in `_test`) covers the framework. Wave 0 is new files only.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Thin period-admin / project weekly form still operable if UI fields are added | D-16 | `workflow.ui_phase` is false | After execute: CPMO can create a period; assigned PM can draft/submit if a form exists. Server tests remain the gate. |

All other phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
