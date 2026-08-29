---
phase: 22
slug: weekly-workflow-surfaces
status: verified
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-08-28
---

# Phase 22 — Security

> Weekly periods, tracking/export, and PM report editor — UI-only module pages consuming Phase 13/14 `/api/weekly-periods/*` and `/api/projects/[id]/weekly-reports/*`. No new API surface; authz remains server-side (`withCpmo`, `withProjectAccess`, `assertProjectWriteAccess`).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → GET/POST `/api/weekly-periods`, GET/PUT `/api/weekly-periods/config` | Session cookie; CPMO via `withCpmo` | Period list, create, due schedule |
| Browser → GET `/api/weekly-periods/{id}/tracking` | Session cookie; CPMO | Counts + obligated rows |
| Browser → POST `/api/weekly-periods/{id}/export` | Session cookie; CPMO; binary blob | xlsx/docx/pptx pack |
| Browser → GET/PATCH `/api/projects/{id}/weekly-reports/{id}` | Session cookie; `withProjectAccess` + write assert on mutate | Draft shell |
| Browser → POST `.../submit` and `.../correct` | Session cookie; write access | Snapshot / correction |
| Sidebar weekly NAV → page URL | Role-gated links are UX only; API is authz truth | Nav visibility |
| Client UI → `/api/weekly-periods/{id}/export/preview` | **Must not cross** — D-11 no preview UI | N/A (verified absent) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-22-01 | Elevation of Privilege | WeeklyPeriodsPage / Sidebar | high | mitigate | NAV hide is not policy; 401/403 in-page; `withCpmo` on periods routes | closed |
| T-22-02 | Information Disclosure | WeeklyPeriodList | medium | mitigate | Consume GET `/api/weekly-periods` only | closed |
| T-22-03 | Tampering | VirtualRows | low | accept | Window math is client UX only | closed |
| T-22-04 | Elevation of Privilege | createPeriod / saveConfig | high | mitigate | Mutations hit `withCpmo` routes; 403 in-page on GET | closed |
| T-22-05 | Tampering | iso_week Input | medium | mitigate | Client posts allowlisted `iso_week` string; server Zod is source of truth | closed |
| T-22-06 | Elevation of Privilege | WeeklyTrackingPage | high | mitigate | 401/403 in-page; `withCpmo` on tracking GET | closed |
| T-22-07 | Information Disclosure | periodId query | medium | mitigate | Invalid id falls back locally; server still 404/403 | closed |
| T-22-08 | Information Disclosure | exportPack | high | mitigate | POST existing `withCpmo` export only; period from loaded Select | closed |
| T-22-09 | Tampering | project_ids body | medium | mitigate | Unique ids from current selection; server `assertExportEligible` | closed |
| T-22-10 | Denial of Service | Export pack | low | accept | `exporting` flag disables repeat clicks; server still enforces | closed |
| T-22-11 | Elevation of Privilege | useWeeklyReportEditor | high | mitigate | `withProjectAccess` + `assertProjectWriteAccess`; 401/403/404 in-page | closed |
| T-22-12 | Tampering | WeeklyReportForm | medium | mitigate | React text nodes only; PATCH allowlisted keys; no innerHTML | closed |
| T-22-13 | Information Disclosure | GET `/api/projects/{id}` | medium | mitigate | Same project id as the report route; existing `withProjectAccess` | closed |
| T-22-SC | Tampering | npm installs | high | accept | No package-manager install in any Phase 22 plan (D-08) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `block_on: high` count toward `threats_open`*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-22-01 | T-22-03 | VirtualRows only slices DOM; server row sets unchanged | gsd-security-auditor | 2026-08-28 |
| AR-22-02 | T-22-10 | Client disable is UX; export generation remains server-enforced | gsd-security-auditor | 2026-08-28 |
| AR-22-03 | T-22-SC | All five plans scoped with no npm installs; supply-chain risk out of scope | gsd-security-auditor | 2026-08-28 |

---

## Scope Verification

### No client-side authz bypass

- Periods, tracking, and editor hooks call APIs unconditionally on mount/load.
- Sidebar weekly links (`Sidebar.tsx`) affect visibility only; unauthorized users hitting the URL receive 401/403 from the API and in-page Copywriting panels.
- No `window.location` redirect on 401/403.

### No export preview mix-in

- Grep across `modules/weekly/**`: zero fetches of `/export/preview`.
- Export POST body is `{ project_ids, format }` only.

### No new npm packages

- `package.json` unchanged for virtualization; in-repo `VirtualRows` only.

---

## Verdict

**SECURED** — threats_open: 0
