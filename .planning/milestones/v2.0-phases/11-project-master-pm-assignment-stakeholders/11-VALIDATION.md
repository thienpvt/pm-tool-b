---
phase: 11
slug: project-master-pm-assignment-stakeholders
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (node + jsdom projects) |
| **Quick run command** | `npx vitest run lib/services/projects.service.unit.test.ts lib/services/access.unit.test.ts -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the focused vitest file(s) in that task's `<verify><automated>`
- **After every plan wave:** `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green for Phase 11 files (pre-existing failures outside this phase stay advisory per Phase 10 VERIFICATION)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | PROJ-01 | T-11-01 | CPMO create requires project_code, portfolio_year, program; unique per company | unit | `npx vitest run lib/services/projects.service.unit.test.ts lib/db-project-master.ddl.unit.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | PROJ-01 | T-11-02 | Duplicate code ConflictError; program must belong to actor company | unit | `npx vitest run lib/services/projects.service.unit.test.ts -x` | ✅ extend | ⬜ pending |
| 11-02-01 | 02 | 2 | PROJ-05, PROJ-06 | T-11-04 | L5/terminal defaults persist; warnings array; not ValidationError for RAG override | unit | `npx vitest run lib/services/project-governance.unit.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 2 | PROJ-02, PROJ-03, PROJ-04, PROJ-07, PROJ-08 | T-11-03 | PM cannot change project_code; Other needs reason; progress_pct only on projects | unit | `npx vitest run lib/services/projects.service.unit.test.ts lib/services/project-governance.unit.test.ts -x` | ✅ extend | ⬜ pending |
| 11-03-01 | 03 | 3 | PMAS-01, PMAS-02, PMAS-03 | T-11-06 | CPMO-only assignment mutations; overlap/dual-role rejected; soft-end | unit | `npx vitest run lib/services/pm-assignments.service.unit.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 3 | PMAS-04 | T-11-05 | assertPmWriteAccess, PM-only assertProjectAccess, and listProjects all use windows | unit | `npx vitest run lib/services/access.unit.test.ts lib/services/projects.service.unit.test.ts lib/repositories/projects.repo.unit.test.ts -x` | ✅ extend | ⬜ pending |
| 11-04-01 | 04 | 2 | STKH-01, STKH-02, STKH-03 | T-11-07 | User or external; singleton sponsor/chair/director; list helper is the only source | unit | `npx vitest run lib/services/stakeholders.service.unit.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-04-02 | 04 | 2 | STKH-01, STKH-02 | T-11-08 | Nested stakeholders route; write access; PATCH soft-end; no row delete | route unit | `npx vitest run app/api/projects/[id]/stakeholders/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-05-01 | 05 | 4 | PROJ-01, D-20 | — | Create form posts project_code, portfolio_year, customer_id | grep + lint | `npx vitest run lib/services/projects.service.unit.test.ts -x` | ✅ | ⬜ pending |
| 11-05-02 | 05 | 4 | PMAS-03, STKH-03, D-20 | — | Project page can PATCH identity fields and list assignments/stakeholders | grep | see 11-05-PLAN.md | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/db-project-master.ddl.unit.test.ts` — DDL flags, unique index SQL, table names, no Phase 13 snapshot tables
- [ ] Extend `lib/services/projects.service.unit.test.ts` — create required identity; duplicate code; program company; CPMO-only code; L5 warnings; listProjects `pmUserId`
- [ ] `lib/services/project-governance.unit.test.ts` — L5/terminal defaults + warnings (PROJ-05, PROJ-06)
- [ ] `lib/services/pm-assignments.service.unit.test.ts` — one primary, collaborator rules, dual-role, CPMO-only, soft-end
- [ ] `lib/db-project-master.backfill.unit.test.ts` — D-14 backfill idempotent
- [ ] Extend `lib/services/access.unit.test.ts` — mock `hasActivePmAssignment`; PM window vs no window
- [ ] Extend `lib/repositories/projects.repo.unit.test.ts` — list filter uses assignment EXISTS + `pmUserId`
- [ ] `lib/services/stakeholders.service.unit.test.ts` — user/external, singleton roles, soft-end, exported list helper
- [ ] `app/api/projects/[id]/pm-assignments/route.test.ts` — CPMO POST 201; PM POST 403
- [ ] `app/api/projects/[id]/stakeholders/route.test.ts` — write-access POST; viewer 403
- [ ] Extend `test/repo-db.ts` projects DDL with Phase 11 columns + both history tables

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CPMO can set code/year/stage on existing create/edit screens | D-20 | `workflow.ui_phase` is false; server tests are the gate | After 11-05: open `/projects/new` and a project detail edit dialog; confirm required identity fields submit |

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
