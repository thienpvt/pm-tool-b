---
phase: 20
slug: api-contract-leftover-routes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-28
---

# Phase 20 — Validation Strategy

> PROXY-01, JIRA-01, ENF-01, THIN-01. Server tests + lint are the gate. UI-SPEC skipped (API/infra; no UI hint).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run proxy lib/http app/api/jira app/api/operations app/api/admin app/api/config` |
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

| Req | Must-have | Automated proof |
|-----|-----------|-----------------|
| PROXY-01 | Unauthenticated `/api/*` JSON 401 `{ error: 'Unauthorized' }` | proxy test |
| PROXY-01 | Unauthenticated page still redirects to login | proxy test |
| JIRA-01 | No console.log of Jira custom fields | search route test / source scan |
| JIRA-01 | Malformed JSON → 400 `{ error: 'Invalid JSON' }` | search route test |
| ENF-01 | Unwrapped project-scoped handler fails lint | fixture or rule unit test + `npm run lint` in CI |
| ENF-01 | D-23 allowlist explicit file | allowlist JSON + lint pass |
| THIN-01 | Ops/admin/config/import-mapping call services not repos | route tests mock services |
| THIN-01 | D-23 break-glass semantics unchanged | admin companies / operations access tests |

---

## Wave 0

- [ ] Proxy JSON 401 + page redirect tests
- [ ] Jira search 400 + no-log tests
- [ ] ESLint wrapper rule + allowlist + CI lint step
- [ ] Ops/admin/config service extraction tests

## Manual-Only

All listed behaviors have automated verification.

## Validation Sign-Off

- [ ] All tasks have automated verify
- [ ] `nyquist_compliant: true` when Wave 0 complete

**Approval:** pending
