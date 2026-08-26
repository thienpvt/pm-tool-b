---
phase: 18
slug: append-only-audit-log
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 18 — Validation Strategy

> Nyquist-style must-haves mapped to AUDIT-01. Server tests are the phase gate (`workflow.ui_phase: false`, D-08).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run lib/repositories/audit.repo.test.ts lib/services/audit.service.unit.test.ts app/api/audit/route.test.ts lib/services/projects.service.unit.test.ts lib/services/risks.service.unit.test.ts lib/services/issues.service.unit.test.ts lib/services/milestones.service.unit.test.ts lib/services/project-document-checklist.service.unit.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~120 seconds |

Do not use `-x` in automated plan commands (Vitest 4 ignores it).

---

## Requirement Must-Haves (AUDIT-01)

| Req | Must-have behavior | Automated proof | Min test type |
|-----|-------------------|-----------------|---------------|
| **AUDIT-01** | User create/update/lock/unlock/deactivate append audit row with actor, time, entity, before/after | `users.service.unit.test.ts` mock `auditLog` | unit |
| **AUDIT-01** | PM assignment create/end append audit | `pm-assignments.service.unit.test.ts` | unit |
| **AUDIT-01** | Project master mutations append audit (create, update, soft-delete if applicable) | `projects.service.unit.test.ts` — extend for gaps | unit |
| **AUDIT-01** | Risk create/update/deactivate append audit | `risks.service.unit.test.ts` — extend | unit |
| **AUDIT-01** | Issue create/update/deactivate append audit | `issues.service.unit.test.ts` — extend | unit |
| **AUDIT-01** | Milestone create/update/cancel append audit | `milestones.service.unit.test.ts` — extend | unit |
| **AUDIT-01** | Budget adjustment create append audit | `fiscal-budget.service.unit.test.ts` | unit |
| **AUDIT-01** | Weekly report submit + correction append audit (`weekly_submit` / `weekly_correct`) | `weekly-reports.service.unit.test.ts` | unit |
| **AUDIT-01** | Document checklist status mutations append audit | `project-document-checklist.service.unit.test.ts` — extend for all compliance fields | unit |
| **AUDIT-01** | Audit rows cannot be updated/deleted via repo | Static scan: no `UPDATE audit_logs` / `DELETE FROM audit_logs` in `audit.repo.ts` | unit |
| **AUDIT-01** | No PATCH/DELETE on `/api/audit` | Route exports GET only; optional negative test if methods added | route |
| **AUDIT-01** | After second mutation, first audit row unchanged | Repo test: insert two rows, re-read first — same actor/time/payload | unit/repo |
| **AUDIT-01** | GET `/api/audit` returns only actor's company rows | Route + repo test with two company fixtures | route/repo |
| **AUDIT-01** | Cross-company actor gets 403 or empty — no foreign rows | `app/api/audit/route.test.ts` | route |
| **AUDIT-01** | PM and Viewer GET `/api/audit` → 403 | Route auth matrix | route |
| **AUDIT-01** | Seed admin (null `company_id`) GET → 403 via `assertCompanyWrite` | Route test session mirror | route |
| **AUDIT-01** | GET supports filters: entity_type, entity_id, from, to | Service/repo unit with filter fixture | unit |
| **AUDIT-01** | Pagination: default limit 50, max 200 | Route/service unit — reject/limit >200 | unit/route |

### Cross-cutting (locked D-01..D-10)

| Must-have | Automated proof |
|-----------|-----------------|
| Single table `audit_logs` + existing `auditLog()` INSERT path | No second audit table in DDL/migrations; `audit.service.unit.test.ts` delegates to `insertAuditLog` |
| `company_id` stamped at insert from actor | Existing callers pass `actor.company_id`; spot-check in gap-fill tests |
| No new npm packages | No package.json dependency changes in plan |
| No CASL; no D-23 ops/admin audit | Static: gap-fill limited to D-02 services only |
| Settings-flag migrate only if new index/column | If index added: DDL unit test wired after `migrateDocuments` |
| Incremental callers from Phases 10–17 remain | Full `npm test` regression |

---

## D-02 Gap Closure Checklist (test must fail before fix)

| Entity | Service function | Expected entity_type | Test file |
|--------|------------------|---------------------|-----------|
| project | `createProject` | `'project'` | `projects.service.unit.test.ts` |
| project | `updateProject` (general fields) | `'project'` | `projects.service.unit.test.ts` |
| project | `deleteProject` | `'project'` | `projects.service.unit.test.ts` |
| raid | `createRisk`, `updateRisk` (non-due_date) | `'risk'` | `risks.service.unit.test.ts` |
| raid | `createIssue`, `updateIssue` (non-due_date) | `'issue'` | `issues.service.unit.test.ts` |
| milestone | `createMilestone`, `updateMilestone` | `'milestone'` | `milestones.service.unit.test.ts` |
| document_checklist | `patchChecklistItem` (approved/na fields) | `'document_checklist'` | `project-document-checklist.service.unit.test.ts` |

Already covered (regression only): `user`, `pm_assignment`, `budget_adjustment`, `weekly_report` submit/correct, existing risk/issue deactivate + due_date_change, milestone cancel.

---

## Sampling Rate

- **After every task commit:** run task `<verify><automated>` file(s)
- **After every plan wave:** quick run command above
- **Before `$gsd-verify-work`:** full `npm test` green
- **Max feedback latency:** 120 seconds

---

## Wave 0 Files (all ❌ until created)

- [ ] `lib/repositories/audit.repo.ts` — add `listAuditLogs` SELECT (INSERT-only mutability preserved)
- [ ] `lib/repositories/audit.repo.test.ts` — immutability source scan, company filter, pagination, D-07 two-row persistence
- [ ] `lib/services/audit.service.ts` — `listCompanyAuditLogs` + unit test
- [ ] `app/api/audit/route.ts` — GET only, `withCpmo`, `assertCompanyWrite`
- [ ] `app/api/audit/route.test.ts` — CPMO 200, pm/viewer 403, null-company 403, cross-company isolation, filters, limit cap
- [ ] Extend `lib/services/projects.service.unit.test.ts` — project gap audits
- [ ] Extend `lib/services/risks.service.unit.test.ts` — create/update audit
- [ ] Extend `lib/services/issues.service.unit.test.ts` — create/update audit
- [ ] Extend `lib/services/milestones.service.unit.test.ts` — create/update audit
- [ ] Extend `lib/services/project-document-checklist.service.unit.test.ts` — full PATCH audit coverage

Optional Wave 0:

- [ ] `lib/db-audit-index.ts` + DDL unit test — if planner adds `(company_id, created_at)` index per D-10

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
|----------|-------------|------------|--------------|
| Thin audit history UI (if added) | UI hint in ROADMAP | `ui_phase: false` | Optional smoke: CPMO opens audit list. Server tests remain gate. |

All AUDIT-01 behaviors above have intended automated coverage.

---

## Validation Sign-Off

- [ ] Every AUDIT-01 must-have row has a Wave 0 test target
- [ ] D-02 gap checklist mapped to failing-red tests before implementation
- [ ] Immutability: repo source scan + no PATCH/DELETE route methods
- [ ] D-07 two-mutation persistence test specified
- [ ] Cross-company GET isolation covered at route layer
- [ ] `nyquist_compliant: true` when Wave 0 complete

**Approval:** pending
