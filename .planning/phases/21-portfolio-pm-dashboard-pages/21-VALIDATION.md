---
phase: 21
slug: portfolio-pm-dashboard-pages
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-28
audited: 2026-08-28
---

# Phase 21 — Validation Strategy

> PDSH-07, MDSH-06, NIT-04. Vitest jsdom component tests are the gate. UI-SPEC is required (`workflow.ui_phase=true`). Fiscal tiles omitted (NIT-04).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (Wave 0 extends include globs to `modules/**`) |
| **Quick run command** | `npx vitest run modules/dashboards` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- After every task commit: targeted `npx vitest run` on that task's test files (no watch flags)
- After every plan wave: `npx vitest run modules/dashboards components/layout/Sidebar.dashboard-nav.component.test.tsx`
- Before verify-work: `npm test`
- Max feedback latency: 120 seconds

---

## Requirement Must-Haves

| Req | Must-have | Automated proof | Status |
|-----|-----------|-----------------|--------|
| PDSH-07 | Spec dashboard KPI tiles from GET `/api/dashboards/portfolio` | `PortfolioDashboardPage.component.test.tsx` | ✅ green |
| PDSH-07 | AND filters PUT/POST then refetch | `PortfolioFiltersBar.component.test.tsx` | ✅ green |
| PDSH-07 | Drill-down tiles + id/href links | `PortfolioKpiTiles.component.test.tsx` | ✅ green |
| PDSH-07 | CSS stage/RAG charts | `PortfolioCharts.component.test.tsx` | ✅ green |
| PDSH-07 | Export POST blob download | `PortfolioDashboardPage.component.test.tsx` + `downloadBlob.test.ts` | ✅ green |
| PDSH-07 | 403 in-page forbidden copy | `PortfolioDashboardPage.component.test.tsx` | ✅ green |
| MDSH-06 | Three queues with server href | `PmDashboardPage.component.test.tsx` | ✅ green |
| MDSH-06 | PM filters + visibility refetch | `PmDashboardPage.component.test.tsx` | ✅ green |
| MDSH-06 | Viewer 403 in-page | `PmDashboardPage.component.test.tsx` | ✅ green |
| NIT-04 | KPI row omits fiscal patterns | `PortfolioDashboardPage.component.test.tsx` spec-kpi-row | ✅ green |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | PDSH-07 | T-21-01 / T-21-03 | Fetch Phase 16 GET only | component | `npx vitest run --project jsdom modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx` | ✅ W0 | ✅ green |
| 21-01-02 | 01 | 1 | PDSH-07 | T-21-01 | NAV hide is not authz | component | `npx vitest run --project jsdom components/layout/Sidebar.dashboard-nav.component.test.tsx` | ✅ W0 | ✅ green |
| 21-01-03 | 01 | 1 | NIT-04 | T-21-02 | No fiscal tiles in spec-kpi-row | component | `npx vitest run --project jsdom modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx` | ✅ W0 | ✅ green |
| 21-02-01 | 02 | 2 | PDSH-07 | T-21-05 | Filter PUT uses existing Zod route | component | `npx vitest run --project jsdom modules/dashboards/ui/portfolio/PortfolioFiltersBar.component.test.tsx` | ✅ W0 | ✅ green |
| 21-02-02 | 02 | 2 | PDSH-07 | T-21-06 | Unknown keys rejected by server | component | `npx vitest run --project jsdom modules/dashboards/ui/portfolio/PortfolioFiltersBar.component.test.tsx` | ✅ W0 | ✅ green |
| 21-02-03 | 02 | 2 | PDSH-07 | T-21-04 | 403 in-page; no client role skip | component | `npx vitest run --project jsdom modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx` | ✅ W0 | ✅ green |
| 21-04-01 | 04 | 2 | MDSH-06 | T-21-11 | href from JSON only | component | `npx vitest run --project jsdom modules/dashboards/ui/pm` | ✅ W0 | ✅ green |
| 21-04-02 | 04 | 2 | MDSH-06 | T-21-10 | PM filters on pm surface | component | `npx vitest run --project jsdom modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx` | ✅ W0 | ✅ green |
| 21-04-03 | 04 | 2 | MDSH-06 | T-21-10 / T-21-12 | Viewer 403; no portfolio payload swap | component | `npx vitest run --project jsdom modules/dashboards/ui/pm` | ✅ W0 | ✅ green |
| 21-03-01 | 03 | 3 | PDSH-07 | T-21-07 | Links only when id present | component | `npx vitest run --project jsdom modules/dashboards/ui/portfolio/PortfolioKpiTiles.component.test.tsx` | ✅ W0 | ✅ green |
| 21-03-02 | 03 | 3 | PDSH-07 | — | CSS charts; no new chart package | component | `npx vitest run --project jsdom modules/dashboards/ui/portfolio/PortfolioCharts.component.test.tsx` | ✅ W0 | ✅ green |
| 21-03-03 | 03 | 3 | PDSH-07 | T-21-08 | Server export POST; no client workbook lib | component | `npx vitest run modules/dashboards/ui/shared/downloadBlob.test.ts modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx` | ✅ W0 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Wave 0 audit (2026-08-28):** `npx vitest run modules/dashboards components/layout/Sidebar.dashboard-nav.component.test.tsx` — 7 files, 66 tests passed in ~3.4s.

---

## Wave 0 Requirements

- [x] Extend `vitest.config.ts` jsdom include to `{components,app,modules}/**/*.test.tsx` and `{components,app,modules}/**/*.component.test.tsx`
- [x] Extend `vitest.config.ts` node include to `{lib,app,eslint,modules}/**/*.test.ts`
- [x] `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx`
- [x] `components/layout/Sidebar.dashboard-nav.component.test.tsx`
- [x] `modules/dashboards/ui/portfolio/PortfolioFiltersBar.component.test.tsx`
- [x] `modules/dashboards/ui/portfolio/PortfolioKpiTiles.component.test.tsx`
- [x] `modules/dashboards/ui/portfolio/PortfolioCharts.component.test.tsx`
- [x] `modules/dashboards/ui/shared/downloadBlob.test.ts`
- [x] `modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx`

Existing Phase 16 route/service tests cover backend; no new API tests required for Phase 21 scope.

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
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** autonomous
