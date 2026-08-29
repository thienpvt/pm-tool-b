No external API integration: Phase 21 consumes in-repo Phase 16 `/api/dashboards/*` routes only; no third-party SDK.

# Phase 21 coverage map

Maps ROADMAP requirements, CONTEXT locked decisions, RESEARCH constraints, and UI-SPEC UI Considerations to executable plans. Component tests are the gate (`workflow.ui_phase: true`).

## Requirements

| ID | Description | Plan | Tasks |
|----|-------------|------|-------|
| PDSH-07 | CPMO portfolio page with spec KPIs, AND filters, drill-downs, export | 21-01, 21-02, 21-03 | 21-01-01..03, 21-02-*, 21-03-* |
| MDSH-06 | Assigned PM dashboard with weekly/milestone/RAID queues and deep links | 21-04 | 21-04-01..03 |
| NIT-04 | Fiscal KPIs omitted from spec portfolio dashboard; decision recorded | 21-01, 21-03 | 21-01-03, 21-03-01 |

## Decisions (D-01..D-17)

| ID | Lock | Plan |
|----|------|------|
| D-01 | `modules/dashboards/ui/` + thin `app/dashboards/*/page.tsx` re-exports | 21-01, 21-04 |
| D-02 | URLs `/dashboards/portfolio` and `/dashboards/pm`; do not reuse `/dashboard` or overwrite `/` | 21-01, 21-04 |
| D-03 | Sidebar Spec dashboard (cpmo) and My dashboard (pm\|cpmo) | 21-01 |
| D-04 | Consume Phase 16 APIs only; no new endpoints; no KPI formula edits | 21-01, 21-02, 21-03, 21-04 |
| D-05 | One GET loads filters, kpis, charts, list, drilldowns; six spec tiles | 21-01, 21-03 |
| D-06 | AND filter keys + GET/PUT/POST portfolio filters; refetch GET | 21-02 |
| D-07 | Tile click opens matching drilldowns; id-based deep links | 21-03 |
| D-08 | Export POST xlsx\|pdf blob download; no client Excel/PDF lib | 21-03 |
| D-09 | Portfolio CPMO-only; API 403 in-page; no second authz layer | 21-01 (NAV), 21-02 (panel) |
| D-10 | PM GET actions + server href only | 21-04 |
| D-11 | Completing an action is the destination page; refetch on return/focus | 21-04 |
| D-12 | CPMO on PM page still own assignments; Viewer 403 | 21-04 |
| D-13 | PM filters `/api/dashboards/pm/filters` same AND keys | 21-04 |
| D-14 | Omit fiscal tiles; comment + UI-SPEC record | 21-01 |
| D-15 | Do not add fiscal fields to PortfolioKpis; do not embed budgets API | 21-01 |
| D-16 | Sidebar, shadcn Card/Button/Badge/Table, sonner, compact English | 21-01..21-04 |
| D-17 | UI-SPEC gate; mocked-fetch component tests including NIT-04 | 21-01..21-04 |

## RESEARCH constraints

| Item | Plan |
|------|------|
| Wave 0 vitest glob includes `modules/**` | 21-01-01 |
| Do not reuse `usePortfolioDashboard` / home collection endpoint | 21-01 prohibition |
| No new npm packages | all plans T-21-SC accept |
| `unit` filter still bound (server no-op) | 21-02 |
| CSS bars per UI-SPEC Charts (recharts not required) | 21-03-02 |
| downloadBlob revokeObjectURL | 21-03-03 |

## UI-SPEC UI Considerations → plans

| Category | Element | Plan |
|----------|---------|------|
| empty | portfolio-kpi-row | 21-01 |
| loading | portfolio-page-shell | 21-01 |
| populated/overflow/zero-one-many | portfolio-kpi-row | 21-01 |
| populated/error/loading/long-text/overflow | sidebar-nav-links | 21-01 |
| NIT-04 backstop | portfolio-kpi-row | 21-01, 21-03 |
| loading/error/partial/overflow/long-text/populated | portfolio-filter-bar | 21-02 |
| error | portfolio-page-shell | 21-02 |
| empty/populated/overflow/long-text | portfolio-project-list | 21-03 |
| empty/populated/overflow/long-text/zero-one-many/loading/error/partial | portfolio-drilldown-panel | 21-03 |
| empty/populated/partial | portfolio-charts | 21-03 |
| loading/error/empty/populated | portfolio-export-actions | 21-03 |
| empty/populated/partial/overflow/zero-one-many/long-text | pm-action-queues | 21-04 |
| empty/loading/error | pm-page-shell | 21-04 |
| loading/error/partial/populated | pm-filter-bar | 21-04 |

## Deferred (not planned)

- Repo-wide `modules/<feature>/{backend,ui}` — Phase 24
- Weekly period / report UI — Phase 22
- Document checklist and audit viewer — Phase 23
- Grid virtualization — PERF-01 / Phase 22
- RSC chrome — PERF-02 / Phase 26
