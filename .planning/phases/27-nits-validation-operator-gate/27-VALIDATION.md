---
phase: 27
slug: nits-validation-operator-gate
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-29
validated: 2026-08-29
---

# Phase 27 — Validation Strategy

> NIT-01, NIT-02, NIT-03, NYQ-01, HYG-02. v2.1 closeout: contract tests, audit skip, budget coexistence doc, VALIDATION reconciliation, operator 502 accept. No new npm; no UI-SPEC (D-06). Isolation none.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run modules/projects/backend/services/milestones.service.unit.test.ts modules/weekly/backend/services/nit-01-exports.contract.test.ts lib/api-errors.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

Do not use `-x` in automated plan commands (Vitest 4 ignores it).

---

## Sampling Rate

- After every task commit: targeted vitest on that task's test files
- After every plan wave: wave `<verification>` commands
- Before verify-work: `npm test`
- Max feedback latency: 120 seconds

---

## Requirement Must-Haves

| Req | Must-have | Automated proof | Status |
|-----|-----------|-----------------|--------|
| NIT-01 | `listPeriodShells` and `listOpenProjectDependencies` remain exported and consumed | `modules/weekly/backend/services/nit-01-exports.contract.test.ts` | ✅ green |
| NIT-02 | No-op milestone PATCH skips `auditLog`; real changes still audit | `modules/projects/backend/services/milestones.service.unit.test.ts` | ✅ green |
| NIT-03 | v1 `budget_items` vs fiscal ledger coexistence documented | `.planning/BUDGET-COEXISTENCE.md` | ✅ green |
| NYQ-01 | Phases 19, 26, 27 VALIDATION.md non-draft with `nyquist_compliant: true` | Frontmatter on `19-VALIDATION.md`, `26-VALIDATION.md`, `27-VALIDATION.md` | ✅ green |
| HYG-02 | Operator accepts Anthropic validation 502 on three report routes; no code revert | `27-HYG-02.md` + `lib/api-errors.test.ts` | ✅ green |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | NIT-01 | unit/contract | `npx vitest run modules/weekly/backend/services/nit-01-exports.contract.test.ts` | ✅ | ✅ green |
| 27-01-02 | 01 | 1 | NIT-01 | unit/contract | `npx vitest run modules/weekly/backend/services/nit-01-exports.contract.test.ts` | ✅ | ✅ green |
| 27-02-01 | 02 | 2 | NIT-02 | unit | `npx vitest run modules/projects/backend/services/milestones.service.unit.test.ts` | ✅ | ✅ green |
| 27-02-02 | 02 | 2 | NIT-02 | unit | `npx vitest run modules/projects/backend/services/milestones.service.unit.test.ts` | ✅ | ✅ green |
| 27-03-01 | 03 | 3 | NIT-03 | doc | node check `.planning/BUDGET-COEXISTENCE.md` | ✅ | ✅ green |
| 27-03-02 | 03 | 3 | HYG-02 | unit+doc | `npx vitest run --project node lib/api-errors.test.ts` + `27-HYG-02.md` | ✅ | ✅ green |
| 27-03-03 | 03 | 3 | NYQ-01 | manual | Frontmatter reconcile 19/26/27 VALIDATION.md | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `nit-01-exports.contract.test.ts` — NIT-01 export contract (27-01)
- [x] `milestones.service.unit.test.ts` — NIT-02 no-op audit skip (27-02)
- [x] `.planning/BUDGET-COEXISTENCE.md` — NIT-03 coexistence map (27-03)
- [x] `27-HYG-02.md` — HYG-02 operator accept record (27-03)
- [x] Phase 19 + 26 VALIDATION frontmatter reconciled (27-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator accepts 502 on report routes | HYG-02 | Business/monitoring tolerance | Read `27-HYG-02.md`; confirm no revert to 500 (D-04) — **accepted 2026-08-29** |
| Budget coexistence operator read | NIT-03 | Runbook clarity | Read `.planning/BUDGET-COEXISTENCE.md`; confirm both stores documented |

All other behaviors have automated verification.

---

## Validation Audit 2026-08-29

| Metric | Count |
|--------|-------|
| Requirements audited | 5 (NIT-01..03, NYQ-01, HYG-02) |
| PLAN verify blocks | 7/7 green |
| Tests run | nit-01 contract, milestones unit, api-errors, migrate/getDb (NYQ-01 reconcile) |
| Gaps found | 0 |
| Resolved | Phase 19 draft → validated; Phase 26 draft → audited |
| Escalated | 0 |

**Audit commands executed:**
- `npx vitest run modules/weekly/backend/services/nit-01-exports.contract.test.ts` — pass
- `npx vitest run modules/projects/backend/services/milestones.service.unit.test.ts` — pass
- `npx vitest run --project node lib/api-errors.test.ts` — pass
- `npx vitest run --project node lib/migrate lib/db.getDb.boot.unit.test.ts` — pass (NYQ-01 Phase 19 map)

---

## Validation Sign-Off

- [x] All tasks have automated verify or documented manual accept
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-29 — v2.1 hygiene closeout (NYQ-01, D-05, D-06)
