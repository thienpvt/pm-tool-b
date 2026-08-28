---
phase: 22
slug: weekly-workflow-surfaces
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-28
---

# Phase 22 — Validation Strategy

> PERD-04, WKRP-07, CPMO-05, PERF-01. Vitest jsdom component tests are the gate. UI-SPEC is required (`workflow.ui_phase=true`). Wave 0 vitest `modules/**` glob already shipped in Phase 21.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (jsdom/node include `modules/**` from Phase 21) |
| **Quick run command** | `npx vitest run --project jsdom modules/weekly` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- After every task commit: targeted `npx vitest run --project jsdom` on that task's test files (no watch flags)
- After every plan wave: `npx vitest run --project jsdom modules/weekly components/layout/Sidebar.weekly-nav.component.test.tsx`
- Before verify-work: `npm test`
- Max feedback latency: 120 seconds

---

## Requirement Must-Haves

| Req | Must-have | Automated proof | Status |
|-----|-----------|-----------------|--------|
| PERD-04 | Periods list from GET `/api/weekly-periods` | `WeeklyPeriodsPage.component.test.tsx` | ⬜ pending |
| PERD-04 | Create period POST + config PUT | `WeeklyPeriodsPage.component.test.tsx` | ⬜ pending |
| PERD-04 | Viewer 403 in-page | `WeeklyPeriodsPage.component.test.tsx` | ⬜ pending |
| WKRP-07 | Draft PATCH + submit/correct | `WeeklyReportEditorPage.component.test.tsx` | ⬜ pending |
| WKRP-07 | 409 toast on PATCH of submitted snapshot | `WeeklyReportEditorPage.component.test.tsx` | ⬜ pending |
| CPMO-05 | Tracking grid + `?periodId=` | `WeeklyTrackingPage.component.test.tsx` | ⬜ pending |
| CPMO-05 | Export pack POST + `downloadBlob` | `WeeklyTrackingPage.component.test.tsx` | ⬜ pending |
| PERF-01 | VirtualRows 150-row DOM bound | `VirtualRows.component.test.tsx` | ⬜ pending |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | PERD-04 / PERF-01 | T-22-02 / T-22-03 | Consume GET `/api/weekly-periods` only; window math is UX-only | component | `npx vitest run --project jsdom modules/weekly/ui/shared/VirtualRows.component.test.tsx modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | PERD-04 | T-22-01 | NAV hide is not authz | component | `npx vitest run --project jsdom components/layout/Sidebar.weekly-nav.component.test.tsx components/layout/Sidebar.dashboard-nav.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-01-03 | 01 | 1 | PERD-04 | T-22-01 | 401/403 in-page; rely on withCpmo | component | `npx vitest run --project jsdom modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 2 | PERD-04 | T-22-04 / T-22-05 | Create POST uses existing withCpmo route | component | `npx vitest run --project jsdom modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 2 | PERD-04 | T-22-04 | Config PUT uses existing withCpmo route | component | `npx vitest run --project jsdom modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-02-03 | 02 | 2 | PERD-04 | T-22-04 | 403 stays in-page; no client role skip | component | `npx vitest run --project jsdom modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 2 | CPMO-05 | T-22-06 / T-22-07 | Tracking GET withCpmo; invalid periodId falls back locally | component | `npx vitest run --project jsdom modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-03-02 | 03 | 2 | CPMO-05 | T-22-06 | Filters stay on existing tracking query params | component | `npx vitest run --project jsdom modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-03-03 | 03 | 2 | CPMO-05 / PERF-01 | T-22-03 | Grid consumes in-repo VirtualRows; no npm | component | `npx vitest run --project jsdom modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx modules/weekly/ui/shared/VirtualRows.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-05-01 | 05 | 2 | WKRP-07 | T-22-11 / T-22-13 | withProjectAccess GET; required Phase 16 re-export | component | `npx vitest run --project jsdom modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-05-02 | 05 | 2 | WKRP-07 | T-22-12 | PATCH allowlisted keys; no innerHTML | component | `npx vitest run --project jsdom modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-05-03 | 05 | 2 | WKRP-07 | T-22-11 | submit/correct use existing write-access routes | component | `npx vitest run --project jsdom modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-04-01 | 04 | 3 | CPMO-05 | T-22-08 / T-22-09 | POST existing withCpmo export; project_ids from selection | component | `npx vitest run --project jsdom modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 22-04-02 | 04 | 3 | CPMO-05 | T-22-10 / T-22-08 | No preview UI; exporting flag disables repeat clicks | component | `npx vitest run --project jsdom modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Wave 0 infrastructure: `vitest.config.ts` already collects `modules/**` (Phase 21). Test files are created during TDD RED of each task.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- [x] `vitest.config.ts` jsdom include `{components,app,modules}/**/*.test.tsx` and `*.component.test.tsx`
- [x] `vitest.config.ts` node include `{lib,app,eslint,modules}/**/*.test.ts`
- [x] `modules/dashboards/ui/shared/downloadBlob.ts` reused for export (no new download helper required)

Test files listed in the per-task map are created by TDD RED, not pre-stubbed.

---

## Manual-Only Verifications

All listed behaviors have automated verification. End-of-phase `human_verify_mode` visual pass is orchestrator-owned, not a per-task checkpoint.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter (set by `/gsd-validate-phase` after execute)

**Approval:** pending
