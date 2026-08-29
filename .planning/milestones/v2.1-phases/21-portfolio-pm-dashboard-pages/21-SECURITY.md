---
phase: 21
slug: portfolio-pm-dashboard-pages
status: verified
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-08-28
---

# Phase 21 — Security

> Portfolio Spec dashboard (`/dashboards/portfolio`) and PM My dashboard (`/dashboards/pm`) — UI-only module pages consuming Phase 16 `/api/dashboards/*` routes. No new API surface; authz remains server-side.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser module UI → GET /api/dashboards/portfolio | Session cookie; CPMO-only payload via `withCpmo` | Dashboard KPIs, charts, list, drilldowns |
| Browser → PUT/POST /api/dashboards/portfolio/filters | Session cookie; Zod `dashboardFiltersSchema` on route | Filter blob |
| Browser → POST /api/dashboards/portfolio/export | Session cookie; CPMO gate; binary blob | xlsx/pdf export |
| Browser → GET /api/dashboards/pm | Session cookie; pm\|cpmo role + assignment window on server | PM action queues |
| Browser → PUT/POST /api/dashboards/pm/filters | Session cookie; same filter schema | PM filter blob |
| Sidebar NAV → page URL | Role-gated links are UX only; API is authz truth (D-09) | Nav visibility |
| Drill-down / queue Link → project routes | Destination routes enforce project access | Deep-link hrefs |
| Client UI → legacy /api/portfolio/* | **Must not cross** — phase scope prohibits mix-in | N/A (verified absent) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-21-01 | Elevation of Privilege | PortfolioDashboardPage / Sidebar | high | mitigate | NAV hide is not policy; 401/403 in-page; fetch-only via `withCpmo` (D-09) | closed |
| T-21-02 | Information Disclosure | spec-kpi-row | medium | mitigate | NIT-04: no fiscal tiles; no `/api/portfolio/budgets` fetch (D-14, D-15) | closed |
| T-21-03 | Tampering | usePortfolioSpecDashboard | medium | mitigate | Phase 16 GET only; no client KPI recompute (D-04) | closed |
| T-21-04 | Elevation of Privilege | PortfolioDashboardPage | high | mitigate | No client role skip; 403 panel only (D-09) | closed |
| T-21-05 | Spoofing | Filter PUT | medium | mitigate | Same-origin cookie; Zod on route; UI sends DASHBOARD_FILTER_KEYS only | closed |
| T-21-06 | Tampering | Filter persist | low | accept | Server `parseDashboardFilters` rejects unknown keys; UI cannot widen schema | closed |
| T-21-07 | Elevation of Privilege | Drill-down Link href | high | mitigate | Links only when `project_id` present from server drilldown rows (D-07) | closed |
| T-21-08 | Tampering | Export buttons | medium | mitigate | POST existing export route; no client xlsx/pdf library (D-08) | closed |
| T-21-09 | Information Disclosure | KPI tiles after extract | medium | mitigate | NIT-04 regex scoped to `spec-kpi-row` (D-14) | closed |
| T-21-10 | Elevation of Privilege | PmDashboardPage | high | mitigate | No client assignment filter; GET `/api/dashboards/pm` is scope (D-12) | closed |
| T-21-11 | Elevation of Privilege | PmActionQueues Link | high | mitigate | `href={row.href}` from JSON only; no client path concatenation (D-10) | closed |
| T-21-12 | Information Disclosure | CPMO on /dashboards/pm | medium | mitigate | UI uses PM endpoint only; no portfolio payload switch (D-12) | closed |
| T-21-SC | Tampering | npm installs | high | accept | No package-manager install in any Phase 21 plan (D-17) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `block_on: high` count toward `threats_open`*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-21-01 | T-21-06 | Server-side Zod/parse rejects unknown filter keys; UI tampering cannot widen schema beyond server acceptance | gsd-security-auditor | 2026-08-28 |
| AR-21-02 | T-21-SC | All four sub-plans (21-01–21-04) explicitly scoped with no npm installs; supply-chain risk out of scope | gsd-security-auditor | 2026-08-28 |

---

## Scope Verification (User-Requested)

### No client-side authz bypass

- Portfolio and PM hooks call their respective GET endpoints unconditionally on mount (`usePortfolioSpecDashboard.ts:110-112`, `usePmDashboard.ts:85-87`).
- Neither page inspects `me.roles` to skip or short-circuit API calls.
- Sidebar role gates (`Sidebar.tsx:161-191`) affect link visibility only; unauthorized users hitting the URL receive 403 from the API and in-page Copywriting panels (`PortfolioDashboardPage.tsx:41-52`, `PmDashboardPage.tsx:32-43`).
- No `window.location` redirect on 401/403.

### No `/api/portfolio` mix-in

- Grep across `modules/dashboards/**`: zero matches for `/api/portfolio`.
- All client fetches target `/api/dashboards/portfolio`, `/api/dashboards/portfolio/filters`, `/api/dashboards/portfolio/export`, `/api/dashboards/pm`, or `/api/dashboards/pm/filters` only.
- NIT-04 footnote references `/portfolio/budget` as a navigation note only; no fetch to legacy portfolio collection endpoints.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-28 | 13 | 13 | 0 | gsd-security-auditor |

### Evidence Summary (ASVS L1)

| Threat ID | Evidence |
|-----------|----------|
| T-21-01 | `usePortfolioSpecDashboard.ts:26-35` — 401/403 mapping; `app/api/dashboards/portfolio/route.ts:5` — `withCpmo`; `Sidebar.tsx:161-175` — UX gate only |
| T-21-02 | `PortfolioDashboardPage.tsx:3` — NIT-04 comment; `PortfolioKpiTiles.tsx:40-42` — six spec tiles; no budgets fetch; test `PortfolioDashboardPage.component.test.tsx:221` |
| T-21-03 | `usePortfolioSpecDashboard.ts:26` — single GET; no `computePortfolioKpis` / `getPortfolioDashboard` client imports |
| T-21-04 | `PortfolioDashboardPage.tsx:41-52` — forbidden panel; hook always loads on mount; tests `:335-367` |
| T-21-05 | `PortfolioFiltersBar.tsx:45-66` — `buildPayload` whitelists keys; `app/api/dashboards/portfolio/filters/route.ts:14-19` — `dashboardFiltersSchema` |
| T-21-06 | `app/api/dashboards/portfolio/filters/route.ts:19` — Zod strict schema on server (accepted) |
| T-21-07 | `PortfolioDrilldownTable.tsx:28-37,50-61` — link only when `project_id` present |
| T-21-08 | `usePortfolioSpecDashboard.ts:91-101` — POST export; no exceljs/jspdf in `modules/dashboards/**` |
| T-21-09 | `PortfolioKpiTiles.tsx:41` — `data-testid="spec-kpi-row"`; test `:221-227` |
| T-21-10 | `usePmDashboard.ts:23-31` — GET only; `PmDashboardPage.tsx` — no assignment filter branch |
| T-21-11 | `PmActionQueues.tsx:88,149,210` — `href={row.href}` verbatim |
| T-21-12 | `usePmDashboard.ts:23` — `/api/dashboards/pm` only; no portfolio hook import |
| T-21-SC | No Phase 21 changes to `package.json` (accepted) |

### Unregistered Flags

None — no `## Threat Flags` entries in Phase 21 SUMMARY files.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] No client-side authz bypass verified
- [x] No `/api/portfolio` mix-in verified

**Verdict:** SECURED  
**Approval:** verified 2026-08-28
