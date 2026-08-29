---
phase: 27-nits-validation-operator-gate
verified: 2026-08-29T03:02:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Operator confirms Anthropic malformed-output 502 is acceptable for the three report routes"
    reason: "Operator gate satisfied by 27-HYG-02.md accept record plus passing lib/api-errors.test.ts; user pre-accepted autonomous verification (HYG-02 human confirmation)"
    accepted_by: "operator"
    accepted_at: "2026-08-29T03:02:00Z"
---

# Phase 27: Nits, Validation & Operator Gate Verification Report

**Phase Goal:** Leftover nits are resolved, every v2.1 phase has a reconciled validation file, and the operator has confirmed the Anthropic 502 behavior  
**Verified:** 2026-08-29T03:02:00Z  
**Status:** passed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `listPeriodShells` and `listOpenProjectDependencies` remain consumed (not removed) | ✓ VERIFIED | Exports exist in `weekly-reports.service.ts` and `project-dependencies.repo.ts`; consumers verified via `nit-01-exports.contract.test.ts` source scans |
| 2 | NIT-01 contract test exists and locks export consumption | ✓ VERIFIED | `modules/weekly/backend/services/nit-01-exports.contract.test.ts` exists; static imports + consumer token scans; 6 tests pass |
| 3 | No-op milestone PATCH does not append an audit row | ✓ VERIFIED | `milestones.service.ts` wraps `auditLog` in `if (!snapshotsEqual(...))`; unit test `updateMilestone skips auditLog when before equals after (NIT-02)` passes |
| 4 | Real milestone changes still audit; create/cancel always audit | ✓ VERIFIED | `updateMilestone calls auditLog action update on success` passes; create/cancel tests assert `auditLog` called |
| 5 | No-op PATCH still runs repository UPDATE | ✓ VERIFIED | NIT-02 test expects `updateMilestoneRepo` called with `(7, 3, { name: 'M' })` |
| 6 | v1 `budget_items` vs fiscal ledger coexistence documented | ✓ VERIFIED | `.planning/BUDGET-COEXISTENCE.md` names both stores, repos, APIs, and UI paths |
| 7 | Operator accepts Anthropic validation-kind 502; no report-route rewrite | ✓ VERIFIED (override) | `27-HYG-02.md` records Accepted; `lib/api-errors.ts` validation branch returns 502 (lines 147–149); no Phase 27 commits touch `lib/api-errors.ts` or `modules/reports/**` |
| 8 | Phases 19, 26, 27 VALIDATION.md non-draft with `nyquist_compliant: true` | ✓ VERIFIED | Frontmatter: 19=`validated`, 26=`audited`, 27=`validated`; all `nyquist_compliant: true` |
| 9 | Every v2.1 phase (19–27) has reconciled VALIDATION.md | ✓ VERIFIED | Nine phase VALIDATION files under `.planning/phases/`; none draft; all `nyquist_compliant: true` |
| 10 | D-06 prohibitions: no new npm, no UI-SPEC, milestones archive untouched | ✓ VERIFIED | No Phase 27 commits to `package.json`, `27-UI-SPEC.md` absent, `.planning/milestones/**` diff empty |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `modules/weekly/backend/services/nit-01-exports.contract.test.ts` | NIT-01 consumer contract | ✓ VERIFIED | Exists, substantive (57 lines), wired via vitest node project |
| `modules/projects/backend/services/milestones.service.ts` | snapshotsEqual guard | ✓ VERIFIED | Local helper + conditional auditLog |
| `modules/projects/backend/services/milestones.service.unit.test.ts` | NIT-02 tests | ✓ VERIFIED | No-op skip + real-change audit tests pass |
| `.planning/BUDGET-COEXISTENCE.md` | Budget coexistence map | ✓ VERIFIED | Documents both stores and explicit no-rewrite stance |
| `.planning/phases/27-nits-validation-operator-gate/27-HYG-02.md` | Operator 502 accept | ✓ VERIFIED | Sign-off table marks Accepted; cites three report routes |
| `.planning/phases/19-data-layer-cutover/19-VALIDATION.md` | Reconciled Phase 19 | ✓ VERIFIED | `status: validated`, `nyquist_compliant: true` |
| `.planning/phases/26-rsc-chrome-cold-start/26-VALIDATION.md` | Reconciled Phase 26 | ✓ VERIFIED | `status: audited`, `nyquist_compliant: true` |
| `.planning/phases/27-nits-validation-operator-gate/27-VALIDATION.md` | Phase 27 Nyquist file | ✓ VERIFIED | `status: validated`, `nyquist_compliant: true` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `nit-01-exports.contract.test.ts` | `weekly-reports.service.ts` | static import + export scan | ✓ WIRED | gsd-tools key-links verified |
| `nit-01-exports.contract.test.ts` | `spec-dashboards.service.ts` | listPeriodShellsRepo scan | ✓ WIRED | gsd-tools key-links verified |
| `nit-01-exports.contract.test.ts` | `project-dependencies.repo.ts` | static import | ✓ WIRED | gsd-tools key-links verified |
| `milestones.service.ts` | `audit.service.ts` | auditLog when snapshots differ | ✓ WIRED | `snapshotsEqual` guard present |
| `BUDGET-COEXISTENCE.md` | `budget.repo.ts` | budget_items documentation | ✓ WIRED | References repo path and table |
| `BUDGET-COEXISTENCE.md` | `PortfolioBudgetPage.tsx` | fiscal UI documentation | ✓ WIRED | References `/portfolio/budget` |
| `27-HYG-02.md` | `lib/api-errors.ts` | validation → 502 | ✓ WIRED | Manual verify: validation branch returns 502 regardless of force500 |
| `19-VALIDATION.md` | `19-VERIFICATION.md` | requirement map | ✓ WIRED | gsd-tools key-links verified |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `milestones.service.ts` | `beforeSnap` / `afterSnap` | `getMilestoneRepo` / `updateMilestoneRepo` | ✓ | ✓ FLOWING |
| `BUDGET-COEXISTENCE.md` | N/A (documentation) | Existing production paths | N/A | ✓ (doc-only) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| NIT-01 contract | `npx vitest run --project node modules/weekly/backend/services/nit-01-exports.contract.test.ts` | 6 passed | ✓ PASS |
| NIT-02 audit skip | `npx vitest run --project node modules/projects/backend/services/milestones.service.unit.test.ts` | all passed | ✓ PASS |
| HYG-02 502 behavior | `npx vitest run --project node lib/api-errors.test.ts` | all passed (incl. validation escapes force500) | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NIT-01 | 27-01 | Export consumption contract | ✓ SATISFIED | Contract test + consumer imports |
| NIT-02 | 27-02 | Skip audit on no-op milestone PATCH | ✓ SATISFIED | snapshotsEqual guard + unit test |
| NIT-03 | 27-03 | Budget coexistence documentation | ✓ SATISFIED | BUDGET-COEXISTENCE.md |
| HYG-02 | 27-03 | Operator 502 accept, no rewrite | ✓ SATISFIED | 27-HYG-02.md + api-errors tests |
| NYQ-01 | 27-03 | Reconcile VALIDATION.md files | ✓ SATISFIED | Phases 19–27 all non-draft, nyquist compliant |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None in Phase 27 modified production files | — | — |

### Human Verification Required

None — operator HYG-02 gate pre-accepted per verification session instruction (recorded as override).

### Gaps Summary

No gaps. All roadmap success criteria and CONTEXT decisions D-01 through D-06 hold in the codebase.

---

_Verified: 2026-08-29T03:02:00Z_  
_Verifier: Claude (gsd-verifier)_
