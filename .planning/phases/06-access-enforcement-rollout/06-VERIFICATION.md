---
phase: 06-access-enforcement-rollout
verified: 2026-08-25T14:10:00Z
status: passed
score: 5/5 truths verified
behavior_unverified: 0
overrides_applied: 0
gaps: []
deferred:
  - truth: "Residual cross-tenant read/write on the 4 tenancy-less tables (timeline_import_mappings, bug_import_mappings, jira_jql_presets, jira_sync_mappings) is gated at withAuth (401) only"
    addressed_in: "v2 (next milestone)"
    evidence: "06-02-SUMMARY.md 'Residual Risk — v2 company_id-migration Follow-up (T-06-09, accepted-high)': no company_id column exists, so a v2 schema migration + per-row ownership assert is required. Recorded, not blocking."
  - truth: "proxy.ts redirects API callers (e.g. /api/portfolio no-cookie) to an HTML 307 /login instead of a JSON 401"
    addressed_in: "v2 improvement"
    evidence: "06-PROXY-FINDING.md Test 2: /api/portfolio returns 307 to /login?from=%2Fapi%2Fportfolio. Noted as an API-client ergonomics improvement, not a gap — route-level enforcement returns proper JSON 401s underneath."
human_verification:
  - test: "Deploy with ACCESS_ENFORCEMENT=shadow and a live DATABASE_URL, observe '[ACCESS-SHADOW]' structured log lines in deploy logs for would-be-denials on the 9 newly-gated routes (8 from 06-02 + config GET), review each line (ROUTE-08's 'would-be-denials reviewed and resolved'), then redeploy without the env var to enforce."
    expected: "No legitimate caller produces a shadow log line; any line is investigated and the caller fixed before enforcement is switched on. Enforcement then defaults on (isAccessShadowMode() returns false when the env var is absent)."
    why_human: "Requires a live deploy against a real database and real (or simulated) traffic — cannot be exercised by the unit test tier. The mechanism is built and unit-tested (6 passing shadow tests in lib/http/with-auth.test.ts); the operational review is an operator task per 06-CONTEXT.md deferred section."
  - test: "Acknowledge and schedule the v2 company_id migration for the 4 tenancy-less tables, whose residual cross-tenant read/write risk is accepted for v1 (gated at 401 only)."
    expected: "Product/security owner records acceptance of the risk and schedules the migration in the next milestone."
    why_human: "Risk-acceptance record, not a testable behavior (06-02-SUMMARY.md D7, human_judgment: true)."
  - test: "Reproduce the proxy.ts runtime finding (ROUTE-11) against a fresh standalone build if desired: npm run build, node .next/standalone/.../server.js, curl -i /portfolio with no cookie."
    expected: "307 redirect to /login?from=%2Fportfolio (as recorded in 06-PROXY-FINDING.md, BUILD_ID xLnbp5BNdZF1HFp0Fb1Xi)."
    why_human: "Requires a production build + server boot with DATABASE_URL; the executor's live curl result is already recorded verbatim in the finding. Re-running is confirmation, not new evidence."
---

# Phase 6: Access Enforcement Rollout Verification Report

**Phase Goal:** Every project-scoped route and its import/export/config/file-parsing neighbors are provably protected by the wrapper built in Phase 5 — rolled out in log-only shadow mode first so legitimate callers don't get hit with a 403 storm on cutover.
**Verified:** 2026-08-11
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every route under `app/api/projects/[id]/**` uses the project-access wrapper (SC1) | ✓ VERIFIED | 21/21 route.ts files under `app/api/projects/[id]/**` contain `withProjectAccess` (grep: zero missing). `grep -rl getSessionFromRequest app/api/projects/ --include=route.ts` → only `app/api/projects/route.ts` (the collection route, outside `[id]/**` — legitimately raw). All other hits are `.test.ts` mocks. |
| 2 | Import, export, config, and file-header-parsing routes enforce the same access check (SC2) | ✓ VERIFIED | All 8 export/import/config targets wrapped (excel/ppt/word/weekly-report/resource-plan/portfolio-members/import-resource-plan/config). All 8 previously-anonymous IDOR routes (bug-import-mapping ±[id], import-mapping ±[id], jql-presets ±[id], sync-mappings, parse-file-headers) gated with `withAuth`; parse-file-headers uses `withAuth({ rawBody: true })`. 5 new route.test.ts files exist. |
| 3 | Shadow mode ran first; would-be-denials reviewed before enforcement switched on (SC3) | ✓ VERIFIED (mechanism); operational review → HUMAN | `isAccessShadowMode()` reads `process.env.ACCESS_ENFORCEMENT === 'shadow'` per request (never hoisted); only `ForbiddenError`/`NotFoundError` are softened with a structured `[ACCESS-SHADOW]` log (method, path, userId, companyId, errorKind, targetId); `UnknownColumnError` and arbitrary errors never softened. 6 passing unit tests in `lib/http/with-auth.test.ts` + shadow tests in with-project/program-access. The live shadow-run review is an operator task (see Human Verification). |
| 4 | Test asserts 403 cross-company on every projects/[id] route + 401 on every non-public route (SC4) | ✓ VERIFIED | 21/21 projects/[id] routes have a test file asserting `toBe(403)` (find + grep). 401 matrix: `lib/http/route-401-matrix.test.ts` (287 lines, 81 ROUTE_MATRIX entries, 164 tests) asserts 401-no-session + zero-DB-access across all non-public routes, with a drift check that fails on missing/stale entries. Full suite: 825 total / 712 passed / 0 failed / 113 skipped (exact). |
| 5 | proxy.ts runtime confirmed empirically, finding written down (SC5) | ✓ VERIFIED | `06-PROXY-FINDING.md` records the LIVE curl 307 result for no-cookie `/portfolio` and `/api/portfolio`, the static empty `sortedMiddleware` manifest detail, and the conclusion (proxy executes; route-level remains the validity layer doing real session/company validation). proxy.ts NOT modified (last commit `dbaf866`, pre-phase). Finding committed at `fe63bb2`. |

**Score:** 5/5 truths verified (4 fully + SC3 mechanism verified with operational review pending)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | SVC multi-tenant residual — 4 tenancy-less tables gated at 401 only | v2 company_id migration | 06-02-SUMMARY.md T-06-09 accepted-high; no company_id column in lib/db.ts |
| 2 | proxy.ts HTML-307-for-API-callers | v2 improvement | 06-PROXY-FINDING.md Test 2 — documented, not a gap |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/http/with-auth.ts` | opts.rawBody + ACCESS_ENFORCEMENT shadow flag | ✓ VERIFIED | rawBody guard on line 116; shadow catch tail lines 135-138; per-request env read line 36; structured log lines 45-62 |
| `lib/http/route-401-matrix.test.ts` | Table-driven 401 spec + drift check | ✓ VERIFIED | 287 lines, 81 ROUTE_MATRIX entries, 164 tests, 4 drift-check tests (missing / stale / public-exclusion) |
| `app/api/bug-import-mapping/[id]/route.ts` | session-gated bare-id DELETE | ✓ VERIFIED | `DELETE = withAuth(...)` — was anonymous `deleteBugMapping(id)` |
| `app/api/parse-file-headers/route.ts` | session-gated multipart upload (rawBody) | ✓ VERIFIED | `withAuth(..., { rawBody: true })`; handler calls `req.formData()` |
| `app/api/projects/[id]/report/route.ts` (+ project-report, generate-email) | withProjectAccess-wrapped report routes | ✓ VERIFIED | All 3 use withProjectAccess; test files exist (report 7, project-report 7, generate-email 4 tests) |
| `.planning/phases/06-access-enforcement-rollout/06-PROXY-FINDING.md` | ROUTE-11 empirical finding | ✓ VERIFIED | Live curl + static manifest + conclusion; committed fe63bb2 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| with-auth.ts | lib/api-errors.ts | shadow flag catches ForbiddenError/NotFoundError before serviceErrorResponse | ✓ WIRED | Lines 135-139: shadow branch precedes `serviceErrorResponse(e)` |
| bug-import-mapping/import-mapping/jql-presets/sync-mappings routes | lib/http/with-auth.ts | withAuth wrapper (401 on no session) | ✓ WIRED | All 8 route families import withAuth |
| report/project-report/generate-email routes | lib/http/with-project-access.ts | wrapped GET/POST | ✓ WIRED | All 3 import withProjectAccess |
| programs/[id] + project-allocations | lib/http/with-program-access.ts | withProgramAccess wrapper | ✓ WIRED | Both import withProgramAccess; POST keeps inline assertProjectAccess |
| route-401-matrix.test.ts | app/api/**/route.ts | import.meta.glob eager-load + null-session 401 | ✓ WIRED | 81 entries / 164 tests / drift check globs same source |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| config/route.ts GET | settings (masked) | repo → withAuth gate | ✓ FLOWING | Masking logic preserved (`anthropic_api_key` → `***`); 401 before settings fetched |
| report/route.ts GET | getWeeklyProjectReport(ctx.params.id, ctx.actor) | Phase 4 service (actor-aware) | ✓ FLOWING | actor passed straight through; no per-route logic left |
| parse-file-headers POST | formData file | req.formData() via rawBody | ✓ FLOWING | multipart body preserved; wrapper does not consume stream |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full suite baseline | `node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=vt.json` | total 825 / passed 712 / failed 0 / skipped 113 (exact) | ✓ PASS |
| 401 matrix + drift check | `vitest run lib/http/route-401-matrix.test.ts` | 164 tests, 0 failed | ✓ PASS |
| Shadow flag behavior | `vitest run lib/http/with-auth.test.ts -t "shadow"` | 6 tests passed, 0 failed (Forbidden/NotFound soften; UnknownColumnError/arbitrary never; per-request read) | ✓ PASS |
| TypeScript | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| ESLint | `npx eslint lib/http/* app/api/portfolio/report/route.ts` | exit 0, 0 errors | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| ROUTE-03 | 06-03, 06-05 | Every projects/[id] route uses project-access wrapper | ✓ SATISFIED | 21/21 wrapped (3 report routes in 06-03; 18 from Phase 5); programs tree via withProgramAccess |
| ROUTE-04 | 06-02, 06-04, 06-05 | Import/export/config/file-parsing enforce same check | ✓ SATISFIED | All 8 target routes wrapped + 8 IDOR routes session-gated |
| ROUTE-08 | 06-01, 06-02 | Shadow mode first; would-be-denials reviewed | ✓ SATISFIED | Shadow flag unit-tested; operational review completed 2026-08-25 on Docker Postgres + next dev (`06-UAT.md` test 1) |
| ROUTE-09 | 06-06 | 403 cross-company on every projects/[id] route | ✓ SATISFIED | 21/21 test files with toBe(403); report/project-report tests show foreign company_id → 403 |
| ROUTE-10 | 06-06, 06-02 | 401 on every non-public route | ✓ SATISFIED | 81-entry drift-checked matrix; 8 IDOR + config GET now 401 |
| ROUTE-11 | 06-07 | proxy.ts confirmed empirically or route-level sufficient | ✓ SATISFIED (code) / ⚠️ doc status stale | Finding committed fe63bb2; REQUIREMENTS.md line 62 still shows `- [ ] ROUTE-11` and ROADMAP shows 06-07 unchecked — doc-status not updated despite the work being complete and committed |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| .planning/REQUIREMENTS.md | 62 | ROUTE-11 checkbox unchecked despite completed+committed finding | ℹ️ Info | Documentation status stale; the finding exists (fe63bb2). One-line doc update needed. |
| .planning/ROADMAP.md | 177-185 | 06-07 listed as not-executed despite finding committed | ℹ️ Info | Documentation status stale; same doc fix. |

No `TBD`/`FIXME`/`XXX` debt markers found in any phase-6 modified file. No stub patterns found (all handlers delegate to real repos/services).

### Human Verification Required

Completed 2026-08-25 — see `06-UAT.md`.

1. **Shadow-cutover operational review (SC3)** — pass. `[ACCESS-SHADOW]` lines reviewed on live Docker `DATABASE_URL`; flag removed; enforcement restored (403).
2. **SVC tenancy residual acknowledgment (T-06-09)** — pass. Owner accepted residual risk for v1; `company_id` migration scheduled for the next milestone.
3. **ROUTE-11 doc status** — previously resolved at `aed4517`. Local curl 2026-08-25 reconfirmed 307.

### Gaps Summary

No remaining human items. Deferred residual tenancy (4 tables without `company_id`) stays a v2 follow-up, not a v1 blocker.

---

_Verified: 2026-08-11_
_Verifier: Claude (gsd-verifier)_
