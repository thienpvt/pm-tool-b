---
phase: 12
slug: milestone-raid-master-registers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (node + jsdom projects) |
| **Quick run command** | `npx vitest run lib/services/milestones.service.unit.test.ts lib/services/risks.service.unit.test.ts lib/services/issues.service.unit.test.ts lib/services/raid-masters.service.unit.test.ts lib/db-raid-masters.ddl.unit.test.ts -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the focused vitest file(s) in that task's `<verify><automated>`
- **After every plan wave:** `npx vitest run lib/services/milestones.service.unit.test.ts lib/services/risks.service.unit.test.ts lib/services/issues.service.unit.test.ts lib/services/raid-masters.service.unit.test.ts lib/db-raid-masters.ddl.unit.test.ts -x`
- **Before `/gsd-verify-work`:** Full suite must be green for Phase 12 files
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | MS-01, MS-05 | T-12-01, T-12-02, T-12-07 | Cancel in place via HTTP DELETE; Viewer 403; no row-removal export | unit | `npx vitest run lib/db-raid-masters.ddl.unit.test.ts lib/services/milestones.service.unit.test.ts app/api/projects/[id]/milestones/[milestoneId]/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | MS-02, MS-03 | T-12-05 | Upcoming 7-day UTC window; overdue after effective end; company-scoped | unit | `npx vitest run lib/services/raid-masters.service.unit.test.ts lib/services/milestones.service.unit.test.ts lib/repositories/milestones.repo.test.ts -x` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | RAID-01 | T-12-03, T-12-01 | Unique risk code ConflictError; auto R-nnn; deactivate + audit | unit | `npx vitest run lib/services/risks.service.unit.test.ts lib/repositories/risks.repo.test.ts -x` | ✅ extend | ⬜ pending |
| 12-02-02 | 02 | 2 | RAID-01 | T-12-03, T-12-06 | Unique issue code; auto I-nnn; technology_council allowlisted; deactivate | unit | `npx vitest run lib/services/issues.service.unit.test.ts lib/repositories/issues.repo.test.ts -x` | ✅ extend | ⬜ pending |
| 12-02-03 | 02 | 2 | RAID-01 | T-12-08 | HTTP DELETE maps to deactivate; 200 `{ ok: true }` | route unit | `npx vitest run app/api/projects/[id]/risks/route.test.ts app/api/projects/[id]/issues/route.test.ts app/api/projects/[id]/risks/route.access.test.ts lib/http/role-matrix.test.ts -x` | ✅ extend | ⬜ pending |
| 12-03-01 | 03 | 3 | RAID-04 | T-12-04 | Due-date change appends history + auditLog; same value does not | unit | `npx vitest run lib/services/risks.service.unit.test.ts lib/services/issues.service.unit.test.ts -x` | ❌ W0 | ⬜ pending |
| 12-03-02 | 03 | 3 | RAID-04, RAID-05 | T-12-04 | Open list High→Medium→Low, overdue first, is_overdue flagged | unit | `npx vitest run lib/repositories/risks.repo.test.ts lib/repositories/issues.repo.test.ts -x` | ✅ extend | ⬜ pending |
| 12-03-03 | 03 | 3 | RAID-06 | T-12-05 | listHighOpenRaid counts records; listTechnologyCouncilIssues company-scoped | unit | `npx vitest run lib/services/raid-masters.service.unit.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/db-raid-masters.ddl.unit.test.ts` — flags, unique index names, milestone/RAID columns, exactly one `CREATE TABLE` (`raid_due_date_history`), no Phase 13 snapshot tables
- [ ] Extend `lib/services/milestones.service.unit.test.ts` — cancelMilestone write gate, auditLog, NotFound; deleteMilestone export gone
- [ ] Extend `app/api/projects/[id]/milestones/[milestoneId]/route.test.ts` — DELETE returns `{ ok: true }` via cancel
- [ ] `lib/services/raid-masters.service.unit.test.ts` — upcoming/overdue window args; High RAID record count; tech-council filter
- [ ] Extend `lib/repositories/milestones.repo.test.ts` — cancel scoped no-op; upcoming/overdue; dual-write `plan_end`/`end_date`
- [ ] Extend `lib/services/risks.service.unit.test.ts` — ConflictError, auto code, deactivate, due-date history
- [ ] Extend `lib/services/issues.service.unit.test.ts` — same plus `technology_council`
- [ ] Extend `lib/repositories/risks.repo.test.ts` / `issues.repo.test.ts` — deactivate RETURNING; RAID-05 order
- [ ] `lib/repositories/raid-due-date-history.repo.ts` — append helper (covered via service mocks)
- [ ] Extend `test/repo-db.ts` — Phase 12 columns + `raid_due_date_history`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing milestone and RAID screens still load after cancel/deactivate | D-11 | `workflow.ui_phase` is false; server tests are the gate | After execute: open a project milestones page and risks page; confirm lists render. DELETE in the UI should still return success and leave the row cancelled/deactivated. |

All other phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
