---
phase: 05-route-thinning-validation
verified: 2026-08-11T12:00:00Z
status: passed
score: 6/6 requirements verified (5/5 roadmap success criteria)
behavior_unverified: 0
overrides_applied: 0
gaps: []
deferred:
  - truth: "ROUTE-11: proxy.ts runtime execution confirmation (empirically verified in deployed runtime)"
    addressed_in: "Phase 6"
    evidence: "Phase 6 SC5: 'Whether proxy.ts executes in the deployed runtime is confirmed empirically (or route-level enforcement is confirmed sufficient without it), with the finding written down either way'. CONTEXT defers this: proxy.ts is correctly wired for Next 16's renamed-middleware convention and deploys via standalone, but runtime execution is unverified. Route-level withAuth enforcement is confirmed sufficient for Phase 5 scope; proxy.ts untouched (last commit dbaf866, pre-Phase 5)."
human_verification: []
---

# Phase 5: Route Thinning & Validation Verification Report

**Phase Goal:** A shared auth/access wrapper and Zod request validation exist, so a route handler wrapped by them contains only parse → authorize → call service → respond, with no SQL, no external call, and no business logic left inline.

**Verified:** 2026-08-11
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `lib/http/with-auth.ts` resolves the session, returns 401 on missing/invalid session, and passes an authorized context into the handler | ✓ VERIFIED | `lib/http/with-auth.ts:55-56` — `getSessionFromRequest(req)`, `if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`. Context `{ user, actor, params, body }` passed at line 86. Behavioral test `lib/http/with-auth.test.ts:46` asserts 401 with `{ error: 'Unauthorized' }` and handler never called; full lib/http suite passes (26/26). |
| 2 | `withProjectAccess` loads the project, verifies `project.company_id` matches the session company, and hands the already-authorized project to the handler | ✓ VERIFIED | `lib/http/with-project-access.ts:26` calls `assertProjectAccess(ctx.params.id, ctx.actor)`; `lib/services/access.ts:38-47` enforces `row.company_id === actor.company_id \|\| row.customer_company_id === actor.company_id` plus null-company CR-01. Row handed via `ctx.project`. Tests `with-project-access.test.ts:56,70` prove a denied caller never reaches the handler (403/404). |
| 3 | A wrapped route handler contains only parse, authorize, call service, respond — no dynamic SQL column assignment remains in `app/api/**` | ✓ VERIFIED | All 18 locked-scope `app/api/projects/[id]/**` route.ts files use `withProjectAccess`, zero `getSessionFromRequest`/`actorOf`/`try {`/`await params` inline (sample verified: risks, route.ts, budget/[itemId]/expenses/[expId]). Grep `Object.keys(body)` in `app/api/` → only 2 pre-existing test-assertion hits in `app/api/admin/rag-config/[companyId]/route.test.ts:45,57` (comparing response keys to expected configKeys — not dynamic SQL, not a body-write path). |
| 4 | Every request body validated against an explicit Zod schema at the route boundary before reaching a service | ✓ VERIFIED | 30 `schema.ts` files (14 tree-A + 16 tree-B). Tree-A (projects/[id]/**) wired via `withProjectAccess(handler, { schema })` (verified risks/activities/holidays/bugs/epics/issues/meetings/escalations/team/documents/milestones/budget/budget[itemId]/expenses + inline PATCH schema in projects/[id]/route.ts). Tree-B routes swapped to inline `schema.safeParse(await req.json())` with frozen literal 400 bodies (verified across companies/users/demo-requests/import-mapping/bug-import-mapping/sync-mappings/jql-presets/operations systems+budget-items+incidents). Passthrough-only schemas for zero-validation-today routes (config, rag-config, jira-config, program-allocations, operations/systems/[id] PUT) with fallback-to-raw-body so no new 400 is invented. |
| 5 | The wrapper maps typed service errors to status codes (403/404/400) and returns a generic message for unexpected errors instead of `String(e)` | ✓ VERIFIED | `lib/http/with-auth.ts:87-92` catch tail: `if (e instanceof UnknownColumnError) return repoErrorResponse(e); return serviceErrorResponse(e);`. `serviceErrorResponse` maps Forbidden→403, NotFound→404, Validation→400, Conflict→409. `with-auth.test.ts:118-121,144` asserts 403/404/400/409 mapping and `{ error: 'Internal server error' }` for generic errors (never `String(e)`). |

**Score:** 5/5 roadmap SCs verified. 6/6 requirement IDs satisfied (ROUTE-01, ROUTE-02, ROUTE-05, ROUTE-06, ROUTE-07, ROUTE-12).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | ROUTE-11: proxy.ts runtime confirmation | Phase 6 | Phase 6 SC5 owns it; proxy.ts untouched this phase, correctly wired for Next 16. Not a Phase 5 gap. |

### Locked Decisions & Critical Fixes Verified

| Decision | Status | Evidence |
|----------|--------|----------|
| `assertProjectAccess` returns the project ROW (was Promise<void>) | ✓ | `lib/services/access.ts:25-47` returns `Promise<ProjectAccessRow>`; admin branch fetches the row; `access.unit.test.ts:24-25` asserts `resolves.toEqual(row)` + `projectAccessRow` called. Wire 401/403/404 bodies unchanged (route tests pass). |
| Wrapper catch tail: UnknownColumnError → repoErrorResponse FIRST, then serviceErrorResponse (T-04-25) | ✓ | `lib/http/with-auth.ts:90` — branch order exactly as locked. `with-auth.test.ts:103` asserts 400-with-columns never 500/403. |
| Wrapper does NOT auto-add integrationErrorResponse; force500 = 1 per report route | ✓ | `with-auth.ts` has no `integrationErrorResponse` import. Report routes own their catches: `app/api/portfolio/report/route.ts:178`, `project-report/route.ts:135`, `report/route.ts:134` all `integrationErrorResponse(e, { force500: true })`. |
| Frozen 400 strings preserved ('Name required', Vietnamese Jira, MISSING_DATA/FIELDS, 'Invalid JSON') | ✓ | Verified byte-identical in tree-B routes: 'Name required'/'id and name required' (admin/companies:27,40), 'Username and password required' (admin/users:29), 'All fields are required' (demo-requests:8), 'Missing fields' (import-mapping:11, bug-import-mapping:13, jql-presets:15), 'Missing mappings_json' (sync-mappings:15), 'name required' (operations systems:22, budget-items:35), 'title required' (incidents:33), 'id required' (admin/demo-requests:22, admin/users:46). Vietnamese 'Lỗi kết nối Jira' preserved in app/api/jira/test/route.ts:95 (untouched). 'Invalid JSON' 400 on malformed body via with-auth.ts:75,81. |
| Schemas: `.safeParse` only, NO `.parse()`, adjacent to routes | ✓ | Zero `.parse(` calls in any schema.ts (grep clean). All tree-B field schemas use `.safeParse` with literal frozen messages. `.passthrough()` used ONLY on shape-guard schemas where today's route accepts any shape (tree-A no-validation resources, config, rag-config, jira-config, program-allocations) — this is the locked freeze-preservation decision (Pitfall 3), not a violation. |
| No CAPEX/OPEX enum duplication | ✓ | `grep CAPEX\|OPEX` on budget schema files → 0 matches (even in comments). Budget schemas are loose optional shape guards; `budget.service.ts:56` ValidationError owns the business rule. |
| auth login/change-password schemas NOT created | ✓ | `ls app/api/auth/login/schema.ts`, `change-password/schema.ts`, `complete-onboarding/schema.ts` → all "No such file". |
| withProgramAccess exists, zero Phase 5 consumers | ✓ | `lib/http/with-program-access.ts` exists with full unit coverage; grep for consumers outside the wrapper/test files → 0. Ships for Phase 6. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/http/with-auth.ts` | withAuth HOF — session resolve, actor derivation, params await, optional body parse, unified catch tail | ✓ VERIFIED | 94 lines; 401 on no session; schema safeParse with frozen 400; UnknownColumnError-first catch; typed generics over TParams+TBody. |
| `lib/http/with-project-access.ts` | Composes withAuth + assertProjectAccess, hands ctx.project | ✓ VERIFIED | 31 lines; denied callers never reach handler. |
| `lib/http/with-program-access.ts` | Composes withAuth + assertProgramAccess, hands ctx.program | ✓ VERIFIED | 35 lines; zero Phase 5 consumers, full unit coverage (ships for Phase 6). |
| `lib/services/access.ts` | assertProjectAccess returns Promise<ProjectAccessRow> | ✓ VERIFIED | Return-row flip; admin branch fetches; T-04-03 order preserved. |
| `app/api/projects/[id]/**/route.ts` (18 files) | One-line-per-handler withProjectAccess conversion | ✓ VERIFIED | All 18 wrapped; zero inline session/auth/try-catch; route-specific quirks preserved (documents 201/200, bugs list_dates, DELETE query params). |
| 30 `schema.ts` files | Adjacent Zod schemas, safeParse-only | ✓ VERIFIED | 14 tree-A + 16 tree-B = 30 schema.ts files, plus 1 inline passthrough schema for projects/[id]/route.ts PATCH; frozen literals preserved; CAPEX/OPEX gate 0. |
| `lib/http/*.test.ts` + `lib/services/access.unit.test.ts` | Unit tests | ✓ VERIFIED | 26 tests pass (wrapper trio + access), covering 401/403/404/400/409 mapping, never-call-handler, UnknownColumnError ordering, row-flip. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/projects/[id]/**/route.ts` | `lib/http/with-project-access.ts` | `withProjectAccess(handler)` | WIRED | 18 route files; verified risks, route.ts, budget/[itemId]/expenses/[expId], activities, holidays, bugs, epics, expenses. |
| `lib/http/with-project-access.ts` | `lib/services/access.ts` | `assertProjectAccess(params.id, actor) -> ProjectAccessRow` | WIRED | Runs inside withAuth's try so Forbidden/NotFound map to 403/404. |
| Tree-A routes | `./schema.ts` | `opts.schema` | WIRED | Verified in 14 route files (all body-accepting methods). |
| Tree-B routes | `./schema.ts` | inline `schema.safeParse` | WIRED | Verified across 13 routes with frozen literal 400s. |
| `lib/http/with-auth.ts` | `lib/api-errors.ts` | `repoErrorResponse` / `serviceErrorResponse` | WIRED | Catch tail calls both, never reimplements. |
| Wrapper → generic errors | `serviceErrorResponse` | `{ error: 'Internal server error' }` | WIRED | `with-auth.test.ts:144` proves no `String(e)`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full suite green at baseline | `node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=vt.json` | 592 total / 479 passed / 0 failed / **113 pending (exactly baseline)** / 248/248 suites | ✓ PASS |
| Wrapper + access tests | `vitest run lib/http lib/services/access.unit.test.ts` | 26/26 passed, 0 failed | ✓ PASS |
| Project-tree route tests | `vitest run app/api/projects/[id]` | 75 passed, 0 failed, 4 pending (DB-gated), 40/40 suites | ✓ PASS |
| ESLint clean on lib/http + changed routes + schemas | `npx eslint` (all schema.ts + 18 routes + lib/http + access.ts) | exit 0 | ✓ PASS |
| ROUTE-12 gate | `grep -rE "Object.keys(body)" app/api/` | only 2 test-assertion hits (rag-config route.test.ts) | ✓ PASS |
| Boilerplate removed | `grep -rE "getSessionFromRequest\|actorOf\|try {\\|await params"` on converted routes | 0 (3 report routes intentionally untouched — deferred) | ✓ PASS |
| Services clean | `grep -rE "next/server\|NextRequest\|NextResponse" lib/services/` | 0 matches | ✓ PASS |

### Probe Execution

Not applicable — no phase-declared probes or `scripts/*/tests/probe-*.sh` files exist for this phase.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| ROUTE-01 | with-auth resolves session, 401 on missing/invalid, passes authorized context | ✓ SATISFIED | with-auth.ts:55-56 + with-auth.test.ts:46 |
| ROUTE-02 | withProjectAccess loads project, verifies company match, hands authorized project | ✓ SATISFIED | with-project-access.ts:26 + access.ts:38-47 + never-call tests |
| ROUTE-05 | Route handler = parse/authorize/call/respond only | ✓ SATISFIED | 18 converted routes, grep-clean, one-line handlers |
| ROUTE-06 | Every body validated against explicit Zod schema at boundary | ✓ SATISFIED | 30 schema.ts files, all in-scope body routes wired |
| ROUTE-07 | Wrapper maps typed errors to 403/404/400, generic for unexpected | ✓ SATISFIED | with-auth.ts:87-92 + with-auth.test.ts:118-144 |
| ROUTE-12 | No dynamic SQL column assignment from request keys in app/api/** | ✓ SATISFIED | grep gate: only 2 test-assertion hits, not SQL |

**All 6 ROUTE-IDs can be marked complete in REQUIREMENTS.md.** They already are (all `[x]` at lines 52-63, and the traceability table lines 151-156). The executor's ROUTE-06 mark is correct; no corrections needed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | TBD/FIXME/XXX debt markers | None | 0 matches across lib/http, access.ts, converted routes, schemas |
| — | — | placeholder/coming-soon stubs | None | 0 matches |
| `app/api/admin/rag-config/[companyId]/route.test.ts:45,57` | `Object.keys(body)` | Info | Test assertions comparing response keys — pre-existing since Phase 2, not dynamic SQL, not a write path. No action. |

### Human Verification Required

None. All behavior-dependent truths (401 on missing session, denied caller never reaches handler, generic error body not String(e), UnknownColumnError ordering) are exercised by passing tests. The single deferred item (ROUTE-11 proxy.ts runtime confirmation) is Phase 6's responsibility and is recorded in `deferred`, not here.

### Gaps Summary

No gaps found. The phase goal is achieved: the `lib/http/` wrapper substrate (withAuth, withProjectAccess, withProgramAccess) exists with the assertProjectAccess return-row flip, all 18 locked-scope project routes are converted to one-line parse→authorize→call→respond handlers, and 30 Zod schemas validate every in-scope request body at the route boundary with frozen 400 bodies preserved. Full suite holds baseline exactly (592/479/0/113). tsc and eslint clean. All 6 requirement IDs (ROUTE-01, ROUTE-02, ROUTE-05, ROUTE-06, ROUTE-07, ROUTE-12) satisfied.

---

_Verified: 2026-08-11_
_Verifier: Claude (gsd-verifier)_
