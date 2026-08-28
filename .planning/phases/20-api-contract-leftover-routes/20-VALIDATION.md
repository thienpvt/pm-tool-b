---
phase: 20
slug: api-contract-leftover-routes
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-28
validated: 2026-08-28
---

# Phase 20 — Validation Strategy

> PROXY-01, JIRA-01, ENF-01, THIN-01. Server tests + lint are the gate. UI-SPEC skipped (API/infra; no UI hint).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run proxy lib/http app/api/jira app/api/operations app/api/admin app/api/config eslint` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- After every task commit: targeted vitest / `npm run lint` for ENF-01
- After every wave: `npm test` + `node proxy.matcher.test.mjs`
- Before verify-work: `npm run lint && npm test`
- Max feedback latency: 120 seconds

---

## Requirement Must-Haves

| Req | Must-have | Automated proof | Status |
|-----|-----------|-----------------|--------|
| PROXY-01 | Unauthenticated `/api/*` JSON 401 `{ error: 'Unauthorized' }` | `lib/http/proxy.auth.test.ts` | ✅ green |
| PROXY-01 | Unauthenticated page still redirects to login | `lib/http/proxy.auth.test.ts` | ✅ green |
| PROXY-01 | Matcher still bypasses static assets | `node proxy.matcher.test.mjs` | ✅ green |
| JIRA-01 | No console.log of Jira custom fields | `app/api/jira/search/route.test.ts` | ✅ green |
| JIRA-01 | Malformed JSON → 400 `{ error: 'Invalid JSON' }` | `app/api/jira/search/route.test.ts` | ✅ green |
| ENF-01 | Unwrapped project-scoped handler fails lint | `eslint/rules/require-auth-wrapper.test.ts` | ✅ green |
| ENF-01 | D-23 allowlist explicit file | `eslint/route-wrapper-allowlist.json` + `npm run lint` | ✅ green |
| ENF-01 | CI runs lint after npm ci | `.github/workflows/test.yml` | ✅ green |
| THIN-01 | Ops/admin/config/import-mapping call services not repos | route tests + node import asserts | ✅ green |
| THIN-01 | D-23 break-glass semantics unchanged | `app/api/admin/companies/route.test.ts`, operations route tests | ✅ green |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | PROXY-01 | unit | `npx vitest run lib/http/proxy.auth.test.ts` | ✅ | ✅ green |
| 20-01-02 | 01 | 1 | PROXY-01 | unit | `npx vitest run lib/http/proxy.auth.test.ts` | ✅ | ✅ green |
| 20-01-03 | 01 | 1 | PROXY-01 | unit | `node proxy.matcher.test.mjs` | ✅ | ✅ green |
| 20-02-01 | 02 | 1 | JIRA-01 | unit | `npx vitest run app/api/jira/search/route.test.ts` | ✅ | ✅ green |
| 20-02-02 | 02 | 1 | JIRA-01 | unit | `npx vitest run app/api/jira/search/route.test.ts` | ✅ | ✅ green |
| 20-03-01 | 03 | 2 | ENF-01 | unit | `npx vitest run eslint/rules/require-auth-wrapper.test.ts` | ✅ | ✅ green |
| 20-03-02 | 03 | 2 | ENF-01 | lint | `npm run lint` | ✅ | ✅ green |
| 20-04-01 | 04 | 2 | THIN-01 | unit | `npx vitest run lib/services/operations.service.unit.test.ts` | ✅ | ✅ green |
| 20-04-02 | 04 | 2 | THIN-01 | unit | `npx vitest run app/api/operations/systems/route.test.ts` | ✅ | ✅ green |
| 20-04-03 | 04 | 2 | THIN-01 | unit | `npx vitest run app/api/operations/systems/[id]/route.test.ts` | ✅ | ✅ green |
| 20-05-01 | 05 | 3 | THIN-01 | unit | `npx vitest run app/api/operations/systems/[id]/budget-items/route.test.ts` + node import assert | ✅ | ✅ green |
| 20-05-02 | 05 | 3 | THIN-01 | unit | `npx vitest run app/api/operations/systems/[id]/expenses/route.test.ts` + node import assert | ✅ | ✅ green |
| 20-05-03 | 05 | 3 | THIN-01 | unit | `npx vitest run app/api/operations/systems/[id]/incidents/route.test.ts` + node import assert | ✅ | ✅ green |
| 20-06-01 | 06 | 3 | THIN-01 | unit | `npx vitest run lib/services/admin-platform.service.unit.test.ts app/api/admin/companies/route.test.ts` | ✅ | ✅ green |
| 20-06-02 | 06 | 3 | THIN-01 | unit | `npx vitest run app/api/admin/demo-requests/route.test.ts` | ✅ | ✅ green |
| 20-06-03 | 06 | 3 | THIN-01 | unit | `npx vitest run app/api/admin/resource-audit/route.access.test.ts` | ✅ | ✅ green |
| 20-07-01 | 07 | 4 | THIN-01 | unit | `npx vitest run app/api/config/route.test.ts` | ✅ | ✅ green |
| 20-07-02 | 07 | 4 | THIN-01 | unit | `npx vitest run app/api/admin/rag-config/[companyId]/route.test.ts` + node import assert | ✅ | ✅ green |
| 20-07-03 | 07 | 4 | THIN-01 | smoke | node import assert (import-mapping + jira mapping routes) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0

- [x] Proxy JSON 401 + page redirect tests (`lib/http/proxy.auth.test.ts`)
- [x] Jira search 400 + no-log tests (`app/api/jira/search/route.test.ts`)
- [x] ESLint wrapper rule + allowlist + CI lint step (`eslint/rules/require-auth-wrapper.test.ts`, `npm run lint`)
- [x] Ops/admin/config service extraction tests (operations, admin, config route tests)

---

## Manual-Only

All listed behaviors have automated verification.

---

## Validation Audit 2026-08-28

| Metric | Count |
|--------|-------|
| Requirements audited | 4 (PROXY-01, JIRA-01, ENF-01, THIN-01) |
| PLAN verify blocks | 19/19 green |
| Tests run | 68 vitest + matcher + lint |
| Gaps found | 0 |
| Resolved | 0 (pre-existing coverage) |
| Escalated | 0 |

**Audit commands executed:**
- `npx vitest run lib/http/proxy.auth.test.ts app/api/jira/search/route.test.ts eslint/rules/require-auth-wrapper.test.ts app/api/config/route.test.ts app/api/admin/companies/route.test.ts app/api/admin/demo-requests/route.test.ts app/api/admin/resource-audit/route.access.test.ts app/api/admin/rag-config/[companyId]/route.test.ts lib/services/operations.service.unit.test.ts lib/services/admin-platform.service.unit.test.ts app/api/operations/systems/route.test.ts app/api/operations/systems/[id]/route.test.ts app/api/operations/systems/[id]/budget-items/route.test.ts app/api/operations/systems/[id]/expenses/route.test.ts app/api/operations/systems/[id]/incidents/route.test.ts` — 68 passed
- `node proxy.matcher.test.mjs` — ok
- `npm run lint` — exit 0
- node import asserts (import-mapping, admin config) — ok

---

## Validation Sign-Off

- [x] All tasks have automated verify
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** autonomous
