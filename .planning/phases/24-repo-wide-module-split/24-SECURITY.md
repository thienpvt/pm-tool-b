---
phase: 24
slug: repo-wide-module-split
status: verified
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-08-28
---

# Phase 24 — Security

> Mechanical module split. Auth wrappers stay in `app/api` for project-scoped routes (ENF-01). Operations and `/api/admin/companies` keep session+tenant / `requireAdmin` (D-07). No new API contracts.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `app/api/**/route.ts` → `modules/*/backend` | Thin shells; wrappers must remain visible to ESLint `require-auth-wrapper` | Authz decision |
| Browser → `/api/projects/[id]/**` | Session + `withProjectAccess` in `app/api` | Project-scoped JSON |
| Browser → `/api/operations/**` | Session + tenant via `getSessionFromRequest` (not `withCpmo`) | Operations JSON |
| Browser → `/api/admin/companies` | `getSessionFromRequest` + `requireAdmin` | Company admin JSON |
| Page shells `app/**/page.tsx` | Default re-export of module UI; URLs unchanged | HTML |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-24-01 | Elevation of Privilege | Dashboards handlers | high | mitigate | `withCpmo` preserved on moved dashboard routes | closed |
| T-24-02 | Tampering | Dashboard services | medium | mitigate | Mechanical move; colocated unit tests | closed |
| T-24-03 | Information Disclosure | Audit GET | high | mitigate | `withCpmo` on `modules/audit/backend/routes/audit/route.ts` | closed |
| T-24-04 | Elevation of Privilege | Weekly reports P3 | critical | mitigate | `withProjectAccess` stays in `app/api/projects/[id]/weekly-reports` | closed |
| T-24-05 | Elevation of Privilege | Weekly export P3 | high | mitigate | `withProjectAccess` on `app/api/export/weekly-report/[id]` | closed |
| T-24-06 | Elevation of Privilege | Document checklist P3 | critical | mitigate | `withProjectAccess` in `app/api` | closed |
| T-24-07 | Elevation of Privilege | Programs P3 | critical | mitigate | `withProgramAccess` in `app/api/programs/[id]` | closed |
| T-24-08 | Elevation of Privilege | Project `[id]` tree | critical | mitigate | All owned `[id]/**/route.ts` keep `withProjectAccess`; no bare `export { GET }` | closed |
| T-24-09 | Elevation of Privilege | Report/export `[id]` | critical | mitigate | `withProjectAccess` on report and scoped export shells | closed |
| T-24-10 | Information Disclosure | Portfolio report email | medium | mitigate | `getSessionFromRequest` + `isCpmo` | closed |
| T-24-11 | Elevation of Privilege | Resource-plan import | critical | mitigate | `withProjectAccess` in `app/api/import/resource-plan/[id]` | closed |
| T-24-12 | Information Disclosure | Jira search | medium | mitigate | `withAuth` unchanged on moved handler | closed |
| T-24-13 | Elevation of Privilege | Admin companies | critical | mitigate | `getSessionFromRequest` + `requireAdmin`; no `withCpmo` (D-07) | closed |
| T-24-14 | Elevation of Privilege | Operations | critical | mitigate | `getSessionFromRequest` on all ops handlers; allowlist unchanged | closed |
| T-24-SC | Tampering | npm installs | high | accept | D-08: no `package.json` changes in feat(24-*) | closed |
| T-ENF-01 | Elevation of Privilege | ESLint gate | critical | mitigate | Wrappers remain in `app/api/**/route.ts` | closed |
| T-D-07 | Elevation of Privilege | Ops/admin companies | critical | mitigate | No `@/lib/http/with-role` on those handlers | closed |
| T-auth | Elevation of Privilege | Moved handlers | high | mitigate | P2/P4 handlers retain original auth | closed |
| T-xss | Tampering | Module UI | medium | mitigate | No new `dangerouslySetInnerHTML` in feat(24-*) | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-24-01 | T-24-SC | Mechanical split; no new npm | gsd-security-auditor | 2026-08-28 |

---

## Verdict

**SECURED** — threats_open: 0
