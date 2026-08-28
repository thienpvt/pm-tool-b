---
phase: 20-api-contract-leftover-routes
verified: 2026-08-28T07:55:00Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 7
  total: 7
  not_honored: []
---

# Phase 20: API Contract & Leftover Routes Verification Report

**Phase Goal:** Unauthenticated API callers get JSON, leftover ops/admin/config/import-mapping routes go through services, and project-scoped handlers cannot ship unwrapped
**Verified:** 2026-08-28T07:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unauthenticated `/api/*` receives JSON `{ error: 'Unauthorized' }` status 401 (pathname prefix, not Accept header) | ✓ VERIFIED | `proxy.ts` L29-31 uses `isApi` from `pathname.startsWith('/api/')`; no Accept header; test passes in `lib/http/proxy.auth.test.ts` |
| 2 | Unauthenticated page requests redirect to `/login` with `from=` (non-API) | ✓ VERIFIED | `proxy.ts` L32-34; test "redirects unauthenticated page requests" passes |
| 3 | PUBLIC paths (`/login`, `/landing`, `/api/auth/`, `/api/health`, `/api/demo-requests`) pass through before unauthenticated branch | ✓ VERIFIED | `proxy.ts` L27 before L29; health and auth tests pass |
| 4 | Requests with `pm_session` cookie are not JSON-401'd by proxy | ✓ VERIFIED | `proxy.ts` L8, L29 guard; test passes |
| 5 | Jira search success path does not log issue custom fields | ✓ VERIFIED | No `console.log` in `app/api/jira/search/route.ts`; test asserts `logSpy` not called |
| 6 | Malformed Jira POST body returns 400 `{ error: 'Invalid JSON' }` via withAuth | ✓ VERIFIED | `with-auth.ts` L111/L117; `route.test.ts` "returns 400 Invalid JSON" passes |
| 7 | ESLint errors when project-scoped `route.ts` exports unwrapped GET/POST/PUT/PATCH/DELETE | ✓ VERIFIED | `eslint/rules/require-auth-wrapper.mjs` + RuleTester invalid case; `npm run lint` exits 0 on current tree |
| 8 | D-23 exemptions and public health in explicit `eslint/route-wrapper-allowlist.json` (posix paths) | ✓ VERIFIED | JSON lists 10 paths including health, companies, all operations routes; rule loads via `createRequire` |
| 9 | `npm run lint` invoked in CI after `npm ci` | ✓ VERIFIED | `.github/workflows/test.yml` L31; `package.json` lint targets `app/api/**/route.ts` |
| 10 | Ops, admin, config routes call services — no direct repository imports in route files | ✓ VERIFIED | Grep: zero `repositories` imports under `app/api/operations`, `admin`, `config`; routes import `operations.service`, `admin-platform.service`, `settings.service`, etc. |
| 11 | D-23 break-glass preserved: operations/** and `/api/admin/companies` use session/requireAdmin, not withCpmo/withRole | ✓ VERIFIED | `companies/route.ts` uses `requireAdmin`; operations routes use `getSessionFromRequest`; grep shows no withCpmo/withRole in those trees; allowlisted in ESLint |
| 12 | Import-mapping, bug-import-mapping, jira/sync-mappings, jira/jql-presets call services (verify-only, D-06) | ✓ VERIFIED | Routes import `import-mapping.service` and `jira-mapping.service`; no repo imports |

**Score:** 12/12 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `proxy.ts` | Edge API vs page unauthenticated contract | ✓ VERIFIED | JSON 401 + redirect + PUBLIC ordering |
| `lib/http/proxy.auth.test.ts` | Vitest proof of proxy contract | ✓ VERIFIED | 6 tests pass |
| `app/api/jira/search/route.ts` | withAuth + schema POST | ✓ VERIFIED | No debug logging |
| `app/api/jira/search/route.test.ts` | 400 Invalid JSON, no field dump | ✓ VERIFIED | 6 tests pass |
| `eslint/rules/require-auth-wrapper.mjs` | pm-tool/require-auth-wrapper rule | ✓ VERIFIED | Project-scoped detection + wrapper check |
| `eslint/route-wrapper-allowlist.json` | Explicit D-23 + health paths | ✓ VERIFIED | 10 posix paths |
| `.github/workflows/test.yml` | npm run lint in CI | ✓ VERIFIED | Step after npm ci |
| `lib/services/operations.service.ts` | Ops route → service → repo | ✓ VERIFIED | Collection, detail, nested helpers |
| `lib/services/admin-platform.service.ts` | Admin companies/demo/audit | ✓ VERIFIED | Wired from admin routes |
| `lib/services/settings.service.ts` | Config GET/POST | ✓ VERIFIED | Used by `app/api/config/route.ts` |
| `lib/services/jira-config.service.ts` | Per-company Jira config | ✓ VERIFIED | Used by admin jira-config route |
| `lib/services/rag-config.service.ts` | Per-company RAG config | ✓ VERIFIED | Used by admin rag-config route |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `proxy.ts` | `with-auth.ts` | Same `{ error: 'Unauthorized' }` body | ✓ WIRED | Pattern present in both |
| `proxy.ts` PUBLIC check | unauthenticated branch | `PUBLIC.some` before session check | ✓ WIRED | L27 precedes L29 (manual trace; gsd-tools from-path not a file) |
| `eslint.config.mjs` | `eslint/plugin.mjs` | require-auth-wrapper error | ✓ WIRED | Plugin + rule configured |
| `.github/workflows/test.yml` | `package.json` lint | `npm run lint` | ✓ WIRED | CI step present |
| Operations routes | `operations.service.ts` | `listOperationsSystems`, `*ForSystem` | ✓ WIRED | All 8 operations route.ts files |
| Admin companies | `admin-platform.service.ts` | `listCompaniesPlatform` etc. | ✓ WIRED | requireAdmin break-glass in route |
| Config route | `settings.service.ts` | `listSettings` / `setSettings` | ✓ WIRED | withAuth wrapper retained |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Operations routes | systems/items/expenses | `operations.service` → `operations.repo` | Service delegates to repo with `company_id` | ✓ FLOWING |
| Admin companies | companies list | `admin-platform.service` → repo | Platform CRUD through service | ✓ FLOWING |
| Config GET | settings rows | `settings.service` → DB | Masked anthropic key in route | ✓ FLOWING |
| Jira search POST | issues | `searchIssues(creds, …)` | Integration client, not static | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Proxy JSON 401 + redirect | `npx vitest run lib/http/proxy.auth.test.ts` | 6/6 pass | ✓ PASS |
| Jira Invalid JSON + no log | `npx vitest run app/api/jira/search/route.test.ts` | 6/6 pass | ✓ PASS |
| ESLint wrapper rule | `npx vitest run eslint/rules/require-auth-wrapper.test.ts` | 1/1 pass | ✓ PASS |
| THIN-01 route tests | `npx vitest run app/api/operations app/api/admin/companies app/api/admin/demo-requests app/api/admin/resource-audit app/api/config` | 36/36 pass | ✓ PASS |
| Proxy matcher unchanged | `node proxy.matcher.test.mjs` | "7 bypass + 7 match cases pass" | ✓ PASS |
| CI lint gate | `npm run lint` | exit 0 (1 unrelated warning in portfolio route) | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no phase-declared probes or `scripts/*/tests/probe-*.sh` for this API-contract phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PROXY-01 | 20-01 | JSON 401 for `/api/*`; page redirect to login | ✓ SATISFIED | `proxy.ts` + `proxy.auth.test.ts` |
| JIRA-01 | 20-02 | No custom-field logging; malformed JSON → 400 | ✓ SATISFIED | Route + tests; no console.log |
| ENF-01 | 20-03 | CI fails unwrapped project-scoped handlers; explicit allowlist | ✓ SATISFIED | ESLint rule, allowlist JSON, CI lint step |
| THIN-01 | 20-04–07 | Ops/admin/config/import-mapping through services; D-23 preserved | ✓ SATISFIED | Service modules + route tests; break-glass unchanged |

No orphaned requirements — all four Phase 20 IDs appear in plan frontmatter and REQUIREMENTS.md traceability table.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `lib/http/proxy.auth.test.ts` | PROXY-01 | 6 | 0 | No | Value (status + JSON body) | PASS |
| `app/api/jira/search/route.test.ts` | JIRA-01 | 6 | 0 | No | Behavioral (400/401/503 + log spy) | PASS |
| `eslint/rules/require-auth-wrapper.test.ts` | ENF-01 | 1 | 0 | No | Behavioral (RuleTester valid/invalid) | PASS |
| Operations/admin/config route tests | THIN-01 | 36 | 0 | No | Behavioral (401/404 + service mocks) | PASS |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0

### Decision Coverage

All 7 trackable CONTEXT.md decisions honored by shipped artifacts (D-01 through D-06, D-23 break-glass).

### Prohibitions (judgment-tier, code-verified)

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| Must not detect API vs page via Accept header | ✓ NOT violated | `proxy.ts` uses pathname only |
| Must not move PUBLIC check after unauthenticated branch | ✓ NOT violated | L27 before L29 |
| Must not change matcher config | ✓ NOT violated | `config.matcher` unchanged; `proxy.matcher.test.mjs` passes |
| Must not use comment-based exemptions | ✓ NOT violated | JSON allowlist only |
| Must not add withCpmo to operations/companies | ✓ NOT violated | grep empty |
| Must not move getSessionFromRequest into operations service | ✓ NOT violated | auth in routes only |
| Must not move assertCompanyWrite into resource-audit service | ✓ NOT violated | L39 in route.ts |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None in phase-modified files | — | — |

### Human Verification Required

N/A — Infrastructure/API-contract phase. All acceptance criteria have automated proof per `20-VALIDATION.md` ("Manual-Only: All listed behaviors have automated verification"). Tests exercised proxy auth, Jira error paths, ESLint wrapper enforcement, and THIN-01 service wiring.

### Gaps Summary

None. Phase goal achieved: proxy JSON 401 contract, Jira hygiene, ESLint CI gate with explicit allowlist, and leftover routes thinned through domain services while D-23 break-glass semantics preserved.

---

_Verified: 2026-08-28T07:55:00Z_
_Verifier: Claude (gsd-verifier)_
