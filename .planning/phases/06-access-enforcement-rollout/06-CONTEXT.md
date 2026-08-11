# Phase 6: Access Enforcement Rollout - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all three grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Every project-scoped route and its import/export/config/file-parsing neighbors are provably protected by the wrapper built in Phase 5 — rolled out in log-only shadow mode first so legitimate callers don't get hit with a 403 storm on cutover. Plus: the 401/403 test matrix proving it, and the ROUTE-11 proxy.ts runtime confirmation.

**Requirements:** ROUTE-03, ROUTE-04, ROUTE-08, ROUTE-09, ROUTE-10, ROUTE-11.

This phase is three distinct things, and the plan must not conflate them:
1. **Wrapper conversions** (behavior-freeze refactors of routes that already enforce) — 3 projects/[id] report routes + 8 ROUTE-04 targets.
2. **The last genuinely-live IDORs** — 8 multi-tenant routes with NO session and NO ownership, including destructive bare-id DELETEs.
3. **Proof** — the 401/403 test matrix (~45 401s, 3 403s) + the proxy.ts runtime finding.
And shadow-mode machinery for the routes where enforcement is NEW, not for the ones already enforcing.

**Scale established by scout (2026-08-11):**
- 85 route.ts. 73 session-routes. **18 wrapped** (all withProjectAccess). 55 raw getSessionFromRequest. 12 no session check (5 public, 7 multi-tenant + parse-file-headers).
- `withProgramAccess` exists, 0 Phase 5 consumers, 3 Phase 6 consumers (programs/[id], programs/[id]/project-allocations, portfolio/program-allocations).
- `withAuth` has **0 direct route consumers** — Phase 6 is its rollout too.
- ~45 routes lack a 401 test; 3 projects/[id] routes lack any test file.

</domain>

<decisions>
## Implementation Decisions

### Shadow Mode & Urgency

- **Shadow flag inside the existing wrappers**, ~6 lines: `process.env.ACCESS_ENFORCEMENT === 'shadow'` → catch the ForbiddenError/NotFoundError the assert throws, `console.error` a structured line (path, method, user id, company_id, target id), re-throw only when flag is off. Applied ONLY to Phase 6's NEW-denial routes; the 18 already-wrapped routes are enforcing and must NOT be shadowed (regression). No separate Shadow wrapper (doubles sync surface).
- **7 tenancy-less tables** (timeline_import_mappings, bug_import_mappings, jira_jql_presets, jira_sync_mappings — confirmed no company_id column in lib/db.ts): gate at `withAuth` (401) and explicitly RECORD the residual cross-tenant read/write risk as a v2 follow-up needing a `company_id` migration. Do not invent scoping.
- **proxy.ts (ROUTE-11)**: resolve empirically, two-step. (1) Static: standalone `middleware-manifest.json` has empty `middleware`/`sortedMiddleware` — proxy compiles in but is never dispatched. (2) Local prod: `npm run build && node .next/standalone/server.js`, `curl -i /portfolio` no-cookie expecting 307 (proxy live) vs 200 (dead). Write the finding to `06-PROXY-FINDING.md`. Conclusion already strongly indicated: **route-level enforcement is necessary, proxy.ts is dead code** — nothing catches the 8 ungated routes upstream. Do not try to make proxy.ts work in Phase 6 (needs a Next 16.2.4 opt-in; outside behavior freeze).

### Conversions & Testing

- **Add `opts.rawBody: true` to `withAuth`** to skip auto `req.json()`, BEFORE wrapping any formData route. The wrapper currently unconditionally `req.json()`s POST/PUT/PATCH when no schema — breaks import/resource-plan, export/ppt, parse-file-headers with a 400 before the handler. Sequence FIRST.
- **401 matrix as ONE table-driven spec** (not 45 files): a single route-401.spec that imports each route module and asserts 401 with a mocked null session — grows as an invariant. Template from `projects/[id]/risks/route.test.ts` (`route.access.test.ts` convention).
- **`project-allocations` POST two-assert shape**: withProgramAccess covers the program assert; the body-field `assertProjectAccess(project_id)` stays inline (a body value no wrapper can reach). Its test files already have 401+403 coverage.
- **`export/ppt/[id]` body passthrough** via `opts.rawBody` — its generator already does `req.json().catch(() => ({}))`.

### Added 403s & Cutover

- **New 403s appear ONLY on the 8 previously-unprotected multi-tenant routes** (they had no session check). Every ROUTE-03/04 conversion is a wrapper refactor preserving Phase 4-5's existing 401/403s — no new denials there. The 403-storm risk is confined to the 8.
- **Cutover**: conversions ship enforcing immediately (no behavior change). The 8 NEW-denial routes go **shadow-first for one deploy cycle**, recorded would-be-denials reviewed, then enforce. If no live DB lets us see real traffic, the shadow-run review is an operator task (set DATABASE_URL, deploy with `ACCESS_ENFORCEMENT=shadow`, review logs, then flip to enforce) — recorded, not blocked here.
- **`config` GET stays `withAuth`** (system, no id; its POST is already admin-gated). The 3 projects/[id] report routes get `withProjectAccess` like their siblings (project-scoped, Phase 5 just didn't reach them).

### Claude's Discretion

All three grey areas accepted at the recommended answer; no open discretion beyond ordinary implementation within these constraints.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **The 18 already-wrapped routes** (all withProjectAccess) — proving the conversion shape end-to-end. `app/api/projects/[id]/risks/route.ts` is the reference.
- `lib/http/with-auth.ts` — absorbs session/actor/params/try-catch; needs `opts.rawBody` added. Also auto-parses JSON for POST/PUT/PATCH (the multipart bug).
- `lib/http/with-project-access.ts` — composes withAuth + assertProjectAccess, hands ctx.project. Converted-tree template.
- `lib/http/with-program-access.ts` — exists, 0 consumers, 3 Phase 6 targets.
- `lib/api-errors.ts` — serviceErrorResponse (only structured logging in lib/, 9 console.error, the shadow-log shape to mirror).
- `projects/[id]/risks/route.test.ts` — the route-test template (mock @/lib/auth + repo, assert 401 before repo call) for the table-driven matrix.

### Established Patterns

- assertProjectAccess returns the project row (Phase 5 flip); assertProgramAccess returns the program row. Both throw ForbiddenError/NotFoundError.
- withAuth auto-behavior: parses JSON on POST/PUT/PATCH when no schema → 400 'Invalid JSON' on malformed (WR-05, sanctioned).
- The 6 export routes split: 3 push the assert into lib/export/* (excel/ppt/word generators take actor), 3 inline-assert (weekly-report, resource-plan, import/resource-plan). Converting the lib/export generators adds a redundant but harmless idempotent assert.

### Integration Points

- `proxy.ts` correctly named for Next 16 renamed-middleware, compiled into `.next/server/middleware.js`, BUT `sortedMiddleware` is EMPTY in the standalone manifest — never dispatched. Route-level is the only enforcement line.
- The 3 projects/[id] report routes (report, project-report, project-report/generate-email) are ROUTE-03 residue — project-scoped, Phase 5 skipped, no test files. Convert to withProjectAccess like siblings; their POST handlers keep integrationErrorResponse + force500 (Phase 3 frozen).
- The 7 tenancy-less `[id]` DELETE routes (`deleteBugMapping(id)` etc.) are anonymous-DELETE destructive holes with NO tenancy column to scope by — ceiling is withAuth (401) for this milestone.

</code_context>

<specifics>
## Specific Ideas

- **The 8 live IDORs are the security point of Phase 6.** bug-import-mapping (+[id] DELETE), import-mapping (+[id] DELETE/PUT), jira/jql-presets (+[id] DELETE), jira/sync-mappings, parse-file-headers POST (anonymous upload), config GET (half-open). Verbatim from scout: `bug-import-mapping/[id]/route.ts` is `DELETE → deleteBugMapping(id) → {ok:true}` with zero session; anonymous `DELETE /api/bug-import-mapping/1..N` wipes every tenant's templates.
- **Shadow flag requested as ~6 lines inside both wrappers** — mirrors the existing console.error shape in api-errors.ts (Railway surfaces it in deploy logs; no log-sink to build).
- **`opts.rawBody` unblocks 3 formData routes** — must land before ROUTE-04 conversion of import/resource-plan, export/ppt, parse-file-headers.
- **Table-driven 401 spec** is the only sane shape for ~45 routes; 45 per-route files would drift.

</specifics>

<deferred>
## Deferred Ideas

- **Add `company_id` to the 7 tenancy-less tables + migration** (timeline_import_mappings, bug_import_mappings, jira_jql_presets, jira_sync_mappings) — v2. This milestone gates them at 401 and records the residual cross-tenant read/write as accepted risk.
- **proxy.ts opt-in/fix for Next 16.2.4** — v2 or eliminated. This phase only records that it's dead and route-level is the enforcement line.
- **auth login/change-password/onboarding payloads** — owning phases.
- **The shadow-run review itself** — operator task after a live deploy with DATABASE_URL and ACCESS_ENFORCEMENT=shadow.

</deferred>
