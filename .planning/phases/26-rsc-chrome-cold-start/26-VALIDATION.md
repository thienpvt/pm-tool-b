---
phase: 26
slug: rsc-chrome-cold-start
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-29
---

# Phase 26 — Validation Strategy

> PERF-02, PERF-03. Nyquist 8e: every requirement maps to a plan and an automated test. Server Component chrome on v2 Sidebar routes; Vitest p95 cold-start budget after migrate cutover. Isolation none; sequential waves 26-01 → 26-02 → 26-03 on the main tree. TDD: `test(26-xx)` RED then `feat(26-xx)` GREEN per task. UI-SPEC preserve-existing (`workflow.ui_phase=true`). Wave 0 vitest `lib/**/*.test.ts` already shipped.

**Do not use `-x` in automated plan commands** (Vitest 4 ignores it).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (node include `{lib,app,eslint,modules}/**/*.test.ts`; jsdom include component tests) |
| **Quick run command** | `npx vitest run --project node lib/rsc-chrome.gate.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~180 seconds (cold-start suite up to 120s when TEST_DATABASE_URL is set) |

---

## Sampling Rate

- After every task commit: targeted `npx vitest run` on that task's test files (no watch flags)
- After every plan wave: the wave command in that PLAN.md `<verification>`
- Before verify-work: `npm test` and `npm run lint` and `npm run build`
- Max feedback latency: 180 seconds

---

## Requirement → Plan → Test (Nyquist 8e)

| Req | Must-have | Plans | Automated proof | Status |
|-----|-----------|-------|-----------------|--------|
| PERF-02 | Static chrome on v2 pages is Server Components | 26-01, 26-02 | `lib/rsc-chrome.gate.test.ts` (PageChrome/shells have no client directive; CHROME_ROUTES wrap PageChrome; EXCLUDED stay client; module pages drop Sidebar import) | ⬜ pending |
| PERF-02 | Interactive KPI tiles stay client | 26-01 | Existing `PortfolioKpiTiles.component.test.tsx` plus module pages remain client with hooks | ⬜ pending |
| PERF-03 | Cold-start connect time measured with a recorded budget | 26-03 | `lib/db.cold-start.test.ts` p95 &lt; 5000ms; `.planning/phases/26-rsc-chrome-cold-start/COLD-START.md` | ⬜ pending |
| D-01 | Root layout stays Server Component | 26-01 | Gate reads `app/layout.tsx` | ⬜ pending |
| D-02 | Sidebar stays client `/api/auth/me` | 26-01 | Gate reads `components/layout/Sidebar.tsx` | ⬜ pending |
| D-04 | p95 target 2000ms / CI fail 5000ms | 26-03 | COLD-START.md + test constant 5000 | ⬜ pending |
| D-05 | No new npm, no second pool | 26-01, 26-03 | Gate: package.json has no APM packages; cold-start uses getDb/getPool only | ⬜ pending |
| D-06 | Preserve-existing / two font weights on new chrome | 26-01, 26-02 | Shell class assertions; EXCLUDED routes; human-check | ⬜ pending |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | PERF-02, D-01, D-02, D-03 | T-26-01, T-26-02, T-26-SC | PageChrome has no secrets; Sidebar stays client; no APM npm | unit | `npx vitest run --project node lib/rsc-chrome.gate.test.ts && npx vitest run --project jsdom modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx && npx vitest run --project node modules/dashboards/backend/dashboards-module-split.test.ts` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 1 | PERF-02, D-03 | T-26-03 | PM + weekly periods are Server PageChrome wrappers | unit+jsdom | `npx vitest run --project node lib/rsc-chrome.gate.test.ts && npx vitest run --project jsdom modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 26-01-03 | 01 | 1 | PERF-02, D-03 | T-26-03 | Audit wrapper + four loading.tsx Server Components | unit+jsdom | `npx vitest run --project node lib/rsc-chrome.gate.test.ts modules/audit/backend/audit-module-split.test.ts && npx vitest run --project jsdom modules/audit/ui/AuditLogPage.component.test.tsx` | ❌ W0 | ⬜ pending |
| 26-02-01 | 02 | 2 | PERF-02, D-06 | T-26-07 | Non-project chrome routes + split-test path pins | unit+jsdom | `npx vitest run --project node lib/rsc-chrome.gate.test.ts modules/portfolio/backend/portfolio-module-split.test.ts modules/admin/backend/admin-module-split.test.ts` | ❌ W0 | ⬜ pending |
| 26-02-02 | 02 | 2 | PERF-02, D-02 | T-26-05 | Async params forward projectId only | unit+jsdom | `npx vitest run --project node lib/rsc-chrome.gate.test.ts modules/projects/backend/projects-module-split.test.ts` | ❌ W0 | ⬜ pending |
| 26-02-03 | 02 | 2 | PERF-02, D-05, D-06 | T-26-06 | EXCLUDED login/landing/operations/budget; no withCpmo | unit | `npx vitest run --project node lib/rsc-chrome.gate.test.ts modules/operations/backend/operations-module-split.test.ts` | ❌ W0 | ⬜ pending |
| 26-03-01 | 03 | 3 | PERF-03, D-04, D-05 | T-26-08 | getDb p95 via resetModules on _test DB only | integration | `npx vitest run --project node lib/db.cold-start.test.ts lib/db.getDb.boot.unit.test.ts` | ❌ W0 | ⬜ pending |
| 26-03-02 | 03 | 3 | PERF-03, D-04 | T-26-10 | COLD-START.md records 2000/5000 | unit | `npx vitest run --project node lib/db.cold-start.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/rsc-chrome.gate.test.ts` — PERF-02 source gate (created 26-01-01 RED)
- [ ] `lib/db.cold-start.test.ts` — PERF-03 p95 (created 26-03-01 RED)
- [ ] `.planning/phases/26-rsc-chrome-cold-start/COLD-START.md` — budget artifact (created 26-03-02 GREEN)
- [x] `vitest.config.ts` node/jsdom projects — already collect `lib/**/*.test.ts` and module component tests
- [x] `test/db.ts` — `hasTestDb` / `_test` suffix guard for 26-03

Existing infrastructure covers the runner. New test files are created in-phase as TDD RED, not as a separate Wave 0 plan.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|----------------|-------------------|
| Visual chrome regression on pilots | PERF-02, D-06 | Pixel/layout judgment | 26-01-03 human-check: four pilot URLs + login/operations |
| Visual chrome regression on remaining routes | PERF-02, D-06 | Pixel/layout judgment | 26-02-03 human-check: home, projects, admin, documents, tracking, login, operations, portfolio/budget |
| End-of-phase UAT batch | PERF-02 | `human_verify_mode=end-of-phase` | Orchestrator harvests human-check blocks into UAT.md |

All requirement behaviors have automated source/integration tests; human-check is preserve-existing visual confirmation only.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (files created during TDD RED)
- [ ] No watch-mode flags
- [ ] Feedback latency &lt; 180s
- [ ] `nyquist_compliant: true` set in frontmatter after `/gsd-validate-phase`

**Approval:** pending
