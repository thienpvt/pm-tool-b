---
phase: 20
slug: api-contract-leftover-routes
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-28
---

# Phase 20 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Unauthenticated client → proxy.ts | Cookie absence; API vs page response shape decided at edge | Session cookie presence |
| proxy.ts → route handlers | PUBLIC paths skip unauthenticated branch | Request routing |
| Client JSON body → withAuth | Malformed bytes must not 500 | Request body |
| Jira Cloud issue payload → logs | Field values must not be printed | Jira issue fields |
| PR merge → CI | Unwrapped project handlers must fail build | Route handler exports |
| Allowlist file → ESLint rule | D-23 paths skipped only if listed | Route path exemptions |
| Session cookie → operations route | D-23 session gate stays in route | Session + tenant context |
| Service → operations.repo | company_id + is_admin predicates passed | Tenant-scoped queries |
| Nested ops route → service | Tenant visibility via findOperationsSystemForUser | System IDs |
| is_admin break-glass → companies | Platform ops, not CPMO product role | Admin privileges |
| actor.roles → resource-audit POST | Product write via assertCompanyWrite | Write authorization |
| withAuth → /api/config | Session required; POST still is_admin | Config secrets |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-20-01 | Information Disclosure | proxy.ts unauthenticated /api/* | high | mitigate | JSON 401 `{ error: 'Unauthorized' }` for `/api/*` | closed |
| T-20-02 | Spoofing | Accept-header API detection | medium | mitigate | Pathname-only detection: `pathname.startsWith('/api/')` | closed |
| T-20-03 | Elevation of Privilege | PUBLIC list | high | mitigate | PUBLIC check before 401 branch | closed |
| T-20-04 | Information Disclosure | login from= query | low | accept | Existing page redirect behavior unchanged | closed |
| T-20-05 | Information Disclosure | jira/search success path | high | mitigate | No issue field dump; test spy on console | closed |
| T-20-06 | Tampering | malformed POST body | high | mitigate | withAuth JSON catch → 400 `{ error: 'Invalid JSON' }` | closed |
| T-20-07 | Information Disclosure | Jira-not-configured message | low | accept | Existing Vietnamese copy unchanged | closed |
| T-20-08 | Elevation of Privilege | project-scoped route.ts | high | mitigate | ESLint `require-auth-wrapper` error; CI `npm run lint` | closed |
| T-20-09 | Elevation of Privilege | comment exemptions | medium | mitigate | Allowlist JSON file only (`route-wrapper-allowlist.json`) | closed |
| T-20-10 | Denial of Service | D-23 over-gating via lint | medium | mitigate | Allowlist operations + companies; rule path-gated to project-scoped | closed |
| T-20-11 | Elevation of Privilege | operations routes | high | mitigate | getSessionFromRequest 401; company_id passed via service | closed |
| T-20-12 | Elevation of Privilege | withCpmo on ops | high | mitigate | D-23: session+tenant in route; no withCpmo import (LOCKED) | closed |
| T-20-13 | Information Disclosure | cross-company system id | medium | mitigate | Repo predicates use company_id + is_admin from session | closed |
| T-20-14 | Elevation of Privilege | nested operations routes | high | mitigate | Session 401 + null→404; no withCpmo (D-23) | closed |
| T-20-15 | Elevation of Privilege | /api/admin/companies | high | mitigate | requireAdmin is_admin; no withCpmo (D-23) | closed |
| T-20-16 | Elevation of Privilege | resource-audit POST | high | mitigate | assertCompanyWrite in route; viewer 403 test | closed |
| T-20-17 | Tampering | duplicate company name | medium | mitigate | ConflictError → 409 via serviceErrorResponse | closed |
| T-20-18 | Information Disclosure | GET /api/config anthropic key | high | mitigate | Mask `***` / anthropic_api_key_set; tests | closed |
| T-20-19 | Elevation of Privilege | POST /api/config | high | mitigate | !user.is_admin → 403; non-admin persist test | closed |
| T-20-20 | Elevation of Privilege | jira/rag admin config | medium | mitigate | requireAdmin; no withCpmo added | closed |
| T-20-SC | Tampering | npm installs (plan 20-03) | high | mitigate | Pin `@typescript-eslint/utils@8.68.0` | closed |
| T-20-SC | Tampering | npm installs (plans 20-01/02/04–07) | high | accept | No package install in those sub-plans | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-20-01 | T-20-04 | Login redirect `from=` query already exposed pathname before this phase; no change to page redirect behavior | gsd-security-auditor | 2026-08-28 |
| AR-20-02 | T-20-07 | Jira-not-configured Vietnamese error copy unchanged; stricter Unauthorized via withAuth is acceptable | gsd-security-auditor | 2026-08-28 |
| AR-20-03 | T-20-SC | Sub-plans 20-01, 20-02, 20-04–07 explicitly scoped with no npm installs; supply-chain risk out of scope for those plans | gsd-security-auditor | 2026-08-28 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-28 | 22 | 22 | 0 | gsd-security-auditor |

### Evidence Summary (ASVS L1)

| Threat ID | Evidence |
|-----------|----------|
| T-20-01, T-20-03 | `proxy.ts:27-31` — PUBLIC before 401; `/api/*` JSON 401 |
| T-20-02 | `proxy.ts:12` — `pathname.startsWith('/api/')`; no Accept header usage |
| T-20-05 | `app/api/jira/search/route.ts` — no console dump; `route.test.ts:64-74` |
| T-20-06 | `lib/http/with-auth.ts:111,117` — Invalid JSON 400 |
| T-20-08 | `eslint.config.mjs:15`, `eslint/rules/require-auth-wrapper.mjs`, `.github/workflows/test.yml:31` |
| T-20-09, T-20-10 | `eslint/route-wrapper-allowlist.json` — operations + companies exempt |
| T-20-11, T-20-13 | `lib/services/operations.service.ts:23,40` — company_id + is_admin |
| T-20-12, T-20-14 | No `withCpmo` in `app/api/operations/**`; session 401 in route handlers |
| T-20-15 | `app/api/admin/companies/route.ts:13-17` — requireAdmin |
| T-20-16 | `app/api/admin/resource-audit/route.ts:39` — assertCompanyWrite |
| T-20-17 | `admin-platform.service.ts:32`, `lib/api-errors.ts:62-63`, route catch |
| T-20-18, T-20-19 | `app/api/config/route.ts:12-14,27` — mask + is_admin 403 |
| T-20-20 | `app/api/admin/jira-config`, `rag-config` — requireAdmin |
| T-20-SC | `package.json` — `@typescript-eslint/utils@8.68.0` |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-28
