---
phase: 24
slug: repo-wide-module-split
status: validated
nyquist_compliant: false
wave_0_complete: true
validated_at: 2026-08-28
created: 2026-08-28
---

# Phase 24 — Validation Strategy

> MOD-01, MOD-02. Nyquist 8e: every requirement maps to a plan and an automated test. Mechanical module split; vitest node contract tests plus moved colocated route/service tests are the gate. UI-SPEC is preserve-existing (`workflow.ui_phase=true`). Wave 0 vitest `modules/**` glob already shipped in Phase 21.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (jsdom/node already include `modules/**`) |
| **Quick run command** | `npx vitest run modules/<feature>/backend/<feature>-module-split.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- After every task commit: targeted `npx vitest run` on that task's test files (no watch flags)
- After every plan wave: `npx vitest run modules/<feature>` plus eslint on any P3 `app/api` files the wave touched
- Before verify-work: `npm test` and `npm run lint` and `npm run build`
- Max feedback latency: 180 seconds

---

## Requirement → Plan → Test (Nyquist 8e)

| Req | Must-have | Plans | Automated proof | Status |
|-----|-----------|-------|-----------------|--------|
| MOD-01 | Each of 10 feature areas has `modules/<feature>/{backend,ui}/` | 24-01 through 24-10 | `<feature>-module-split.test.ts` per wave; 24-10 also asserts all ten backend dirs | ✅ green |
| MOD-01 | Backend holds routes/services/repos; UI holds pages/hooks/components | 24-01..24-10 | Dynamic import of moved S1/S2 + P5 page modules in contract tests | ✅ green |
| MOD-02 | Page URLs unchanged via P1 `app/**/page.tsx` re-exports | 24-01 (keep), 24-05..24-10 (new shells) | Contract tests read `app/**/page.tsx` source for `export { default } from '@/modules/...` | ✅ green |
| MOD-02 | `/api/*` URLs unchanged via P2/P3/P4 `app/api/**/route.ts` shells | 24-01..24-10 | Contract tests plus moved `route.test.ts`; P3 eslint `require-auth-wrapper` | ⚠️ partial — see 24-06-03 escalation |
| ENF-01 (preserve) | Project-scoped `route.ts` still contains local wrapper calls | 24-03, 24-04, 24-05, 24-06, 24-07, 24-08 | `withProjectAccess(` / `withProgramAccess(` in app/api source; `npx eslint` on those files | ✅ green |
| D-07 / D-23 (preserve) | Ops and admin companies do not import `@/lib/http/with-role` | 24-09, 24-10 | `admin-module-split.test.ts`, `operations-module-split.test.ts` | ✅ green |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | MOD-01, MOD-02 | T-24-01 | P2 keeps withCpmo on moved dashboard GET | node | `npx vitest run --project node modules/dashboards/backend/dashboards-module-split.test.ts modules/dashboards/backend/routes/dashboards/portfolio/route.test.ts modules/dashboards/backend/services/spec-dashboards.service.unit.test.ts` | ✅ | ✅ green |
| 24-01-02 | 01 | 1 | MOD-02 | T-24-01 | Remaining dashboards P2 shells | node | `npx vitest run --project node modules/dashboards/backend/dashboards-module-split.test.ts modules/dashboards/backend/routes` | ✅ | ✅ green |
| 24-01-03 | 01 | 1 | MOD-01 | T-24-02 | Importers retargeted; UI tests unchanged | node+jsdom | `npx vitest run modules/dashboards/backend/dashboards-module-split.test.ts lib/export/dashboard-portfolio.unit.test.ts modules/dashboards/ui` | ✅ | ✅ green |
| 24-02-01 | 02 | 2 | MOD-01, MOD-02 | T-24-03 | Audit GET wrapper moves with handler | node | `npx vitest run --project node modules/audit/backend` | ✅ | ✅ green |
| 24-02-02 | 02 | 2 | MOD-01 | T-24-03 | Audit importers including dashboards spec | node | `npx vitest run --project node modules/audit/backend modules/dashboards/backend/services/spec-dashboards.service.unit.test.ts` | ✅ | ✅ green |
| 24-03-01 | 03 | 3 | MOD-01, MOD-02 | T-24-04 | P2 weekly-periods; P3 contract stated | node | `npx vitest run --project node modules/weekly/backend/weekly-module-split.test.ts modules/weekly/backend/routes/weekly-periods/route.test.ts modules/weekly/backend/services/weekly-reports.service.unit.test.ts` | ✅ | ✅ green |
| 24-03-02 | 03 | 3 | MOD-02 | T-24-04 | Remaining weekly-periods P2 | node | `npx vitest run --project node modules/weekly/backend` | ✅ | ✅ green |
| 24-03-03 | 03 | 3 | MOD-02, ENF-01 | T-24-04 / T-24-05 | withProjectAccess stays in app/api | node+eslint | `npx vitest run --project node modules/weekly/backend && npx eslint "app/api/projects/[id]/weekly-reports/**/route.ts" "app/api/export/weekly-report/[id]/route.ts"` | ✅ | ✅ green |
| 24-04-01 | 04 | 4 | MOD-01, MOD-02 | T-24-06 | Catalog P2; documents page not overwritten | node | `npx vitest run --project node modules/documents/backend/documents-module-split.test.ts modules/documents/backend/routes/document-catalog/route.test.ts modules/documents/backend/services/document-catalog.service.unit.test.ts` | ✅ | ✅ green |
| 24-04-02 | 04 | 4 | MOD-02 | T-24-06 | Templates/compliance P2 | node | `npx vitest run --project node modules/documents/backend` | ✅ | ✅ green |
| 24-04-03 | 04 | 4 | MOD-02, ENF-01 | T-24-06 | Checklist P3 wrapper-stays | node+eslint | `npx vitest run --project node modules/documents/backend && npx eslint "app/api/projects/[id]/document-checklist/**/route.ts"` | ✅ | ✅ green |
| 24-05-01 | 05 | 5 | MOD-01, MOD-02 | T-24-07 | Home P1 plus portfolio API P2 | node+jsdom | `npx vitest run modules/portfolio/backend/portfolio-module-split.test.ts modules/portfolio/ui/home` | ✅ | ✅ green |
| 24-05-02 | 05 | 5 | MOD-02, D-11 | — | Remaining P1; report UI not moved | mixed | `npx vitest run modules/portfolio/ui modules/portfolio/backend/portfolio-module-split.test.ts` | ✅ | ✅ green |
| 24-05-03 | 05 | 5 | MOD-02, ENF-01 | T-24-07 | programs/[id] withProgramAccess | node+eslint | `npx vitest run --project node modules/portfolio/backend && npx eslint "app/api/programs/[id]/**/route.ts"` | ✅ | ✅ green |
| 24-06-01 | 06 | 6 | MOD-01, MOD-02 | T-24-08 | Hub P1 plus project GET P3 | node+eslint | `npx vitest run --project node modules/projects/backend/projects-module-split.test.ts && npx eslint "app/api/projects/[id]/route.ts"` | ✅ | ✅ green |
| 24-06-02 | 06 | 6 | MOD-02 | T-24-08 | Remaining project P1 shells | mixed | `npx vitest run modules/projects/ui modules/projects/backend/projects-module-split.test.ts` | ✅ | ✅ green |
| 24-06-03 | 06 | 6 | MOD-02, ENF-01 | T-24-08 | Remaining P3 project APIs | node+eslint | `npx vitest run --project node modules/projects/backend && npx eslint "app/api/projects/[id]/route.ts" "app/api/projects/[id]/milestones/**/route.ts" "app/api/projects/[id]/risks/route.ts"` | ✅ | ❌ red — stale `../schema` import in `milestones/[milestoneId]/route.ts` |
| 24-07-01 | 07 | 7 | MOD-02, D-11 | T-24-10 | /portfolio/report P1 in reports module | mixed | `npx vitest run modules/reports/backend/reports-module-split.test.ts modules/reports/ui/portfolio-report` | ✅ | ✅ green |
| 24-07-02 | 07 | 7 | MOD-02, ENF-01 | T-24-09 | Project report P1/P3 | mixed+eslint | `npx vitest run modules/reports && npx eslint "app/api/projects/[id]/report/**/route.ts" "app/api/projects/[id]/project-report/**/route.ts"` | ✅ | ✅ green |
| 24-07-03 | 07 | 7 | MOD-02, ENF-01 | T-24-09 | Export/[id] P3 | node+eslint | `npx vitest run --project node modules/reports/backend && npx eslint "app/api/export/excel/[id]/route.ts" "app/api/export/ppt/[id]/route.ts" "app/api/export/word/[id]/[type]/route.ts" "app/api/export/resource-plan/[id]/route.ts"` | ✅ | ✅ green |
| 24-08-01 | 08 | 8 | MOD-01, MOD-02 | T-24-12 | Jira search P2 plus dialogs | node | `npx vitest run --project node modules/jira/backend/jira-module-split.test.ts modules/jira/backend/routes/jira/search/route.test.ts` | ✅ | ✅ green |
| 24-08-02 | 08 | 8 | MOD-01 | — | Timeline import UI under jira | jsdom | `npx vitest run modules/jira/ui modules/projects/ui/timeline` | ✅ | ✅ green |
| 24-08-03 | 08 | 8 | MOD-02, ENF-01 | T-24-11 | resource-plan P3 | node+eslint | `npx vitest run --project node modules/jira/backend && npx eslint "app/api/import/resource-plan/[id]/route.ts"` | ✅ | ✅ green |
| 24-09-01 | 09 | 9 | MOD-02, D-07 | T-24-13 | Admin P1; companies session+requireAdmin | node | `npx vitest run --project node modules/admin/backend/admin-module-split.test.ts` | ✅ | ✅ green |
| 24-09-02 | 09 | 9 | MOD-01, D-07 | T-24-13 | Remaining admin P2; D-07 holds | node | `npx vitest run --project node modules/admin/backend` | ✅ | ✅ green |
| 24-10-01 | 10 | 10 | MOD-01, MOD-02, D-07 | T-24-14 | Ops P1; systems P4 no with-role | node | `npx vitest run --project node modules/operations/backend/operations-module-split.test.ts` | ✅ | ✅ green |
| 24-10-02 | 10 | 10 | MOD-01, D-07 | T-24-14 | Nested ops P4; admin companies regression | node | `npx vitest run --project node modules/operations/backend modules/admin/backend/admin-module-split.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Wave 0 infrastructure: `vitest.config.ts` already collects `modules/**` (Phase 21). Contract test files are created during TDD RED of each wave. Do not edit `vitest.config.ts` this phase.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- [x] `vitest.config.ts` node include `{lib,app,eslint,modules}/**/*.test.ts`
- [x] `vitest.config.ts` jsdom include `{components,app,modules}/**/*.test.tsx` and `*.component.test.tsx`
- [x] `eslint/rules/require-auth-wrapper.mjs` still lints `app/api/**/route.ts` only

Test files listed in the per-task map are created by TDD RED, not pre-stubbed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|----------------|-------------------|
| One page per feature area loads at the same URL | MOD-02, D-10 | Layout/chrome density | After each wave, smoke the UI-SPEC URLs for that feature (200 or login redirect) |
| Sidebar NAV unchanged | D-05, D-10 | Role-gated NAV is visual | Confirm NAV entries/order after UI-moving waves 5–10 |

End-of-phase `human_verify_mode` visual pass is orchestrator-owned, not a per-task checkpoint.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (Wave 0 vitest already covers `modules/**`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no new test runner)
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [ ] `nyquist_compliant: true` — blocked by 24-06-03: `app/api/projects/[id]/milestones/[milestoneId]/route.ts` imports `../schema` (file absent after split); contract test added in `projects-module-split.test.ts`

## Nyquist Audit (2026-08-28)

**Contract suite:** `npx vitest run --project node modules/*/backend/*-module-split.test.ts` — 195/196 pass (1 red: milestone schema import).

### Filled gaps
| Gap | Fix | Command |
|-----|-----|---------|
| Stale Wave 6 guard in `documents-module-split.test.ts` expected fat page; wave 6 moved page to projects module | Retargeted assertion to D-06 projects-owned thin shell | `npx vitest run --project node modules/documents/backend/documents-module-split.test.ts` ✅ |

### Escalated (BLOCKER)
| Task | Requirement | Reason | Test |
|------|-------------|--------|------|
| 24-06-03 | MOD-02 | P3 shell `app/api/projects/[id]/milestones/[milestoneId]/route.ts` uses `import { milestoneUpdateSchema } from '../schema'` — module lives at `@/modules/projects/backend/routes/projects/[id]/milestones/schema`; breaks route load (`route-401-matrix.test.ts`) | `projects-module-split.test.ts` P3 MOD-02 assertion ❌ |

**Approval:** pending fix for 24-06-03 escalation
