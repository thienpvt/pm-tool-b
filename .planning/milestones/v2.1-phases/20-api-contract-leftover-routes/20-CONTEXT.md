# Phase 20: API Contract & Leftover Routes - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Unauthenticated API callers get JSON, leftover ops/admin/config/import-mapping routes go through services, and project-scoped handlers cannot ship unwrapped.

**Requirements:** PROXY-01, JIRA-01, ENF-01, THIN-01

**In:**
- `proxy.ts` (or Next.js proxy/middleware): unauthenticated `/api/*` → JSON `{ error: 'Unauthorized' }` 401; unauthenticated **page** requests still redirect to login
- Jira search: drop debug `console.log` of issue custom fields; malformed JSON body → 400
- CI/ESLint fails when a project-scoped `route.ts` exports a handler not wrapped by a sanctioned helper (`withAuth` / `withProjectAccess` / `withProgramAccess` / `withCpmo` / `withRole`); D-23 exemptions are an explicit list
- Ops, admin, config, and import-mapping routes call services rather than repositories; D-23 session+tenant vs platform break-glass semantics stay

**Out:**
- Module split (Phase 24), Kysely (Phase 25), v2 UI consumers (21–23)
- Changing D-23 carve-out meaning (operations/** and `/api/admin/companies` stay as Phase 10 locked)
- New policy engine / CASL

</domain>

<decisions>
## Implementation Decisions

- **D-01:** Detect API vs page by pathname prefix `/api/` (not Accept header). API → JSON 401. Pages → existing login redirect.
- **D-02:** Reuse `{ error: 'Unauthorized' }` already used by `withAuth`.
- **D-03:** Jira malformed JSON → 400 `{ error: 'Invalid JSON' }` via `withAuth` catch. Do not invent a new envelope. Do not change Jira credential resolution.
- **D-04:** ESLint rule plus explicit allowlist file (paths, not comments); wire `npm run lint` into CI. List public health if exempt.
- **D-05:** Split leftover admin/ops/config services like `users.service` (operations, admin-platform, settings, jira-config, rag-config).
- **D-06:** Import-mapping already through services — verify, do not rewrite if already THIN.
- **D-23:** `operations/**` and `/api/admin/companies` keep existing break-glass; do not add `withCpmo`/`withRole` there.

### PROXY-01 JSON vs redirect
- Detect API by pathname prefix `/api/` (not Accept header). API → JSON 401 `{ error: 'Unauthorized' }`. Pages → existing login redirect.
- Reuse the same error string already used by `withAuth` (`Unauthorized`) so clients and tests stay consistent.
- Cover with a unit/integration test on the proxy matcher (existing `proxy.matcher.test.mjs` analog).

### JIRA-01 hygiene
- Remove debug dump of Jira issue custom fields from search path.
- Malformed `req.json()` → 400 with existing ValidationError / `{ error: ... }` shape used by other POST APIs — do not invent a new envelope.
- Do not change Jira credential resolution (INTG-08 already shipped).

### ENF-01 wrapper CI gate
- Ship an ESLint rule (or CI script invoked from `npm run lint` / test workflow) that fails when a project-scoped `app/api/**/route.ts` exports GET/POST/PUT/PATCH/DELETE not wrapped by sanctioned helpers.
- D-23 exemptions are an **explicit allowlist file** (paths), not a comment convention that can drift.
- Do not require wrapping of truly public health endpoints if they are already exempt; list them.

### THIN-01 leftover routes
- Ops, admin, config, import-mapping routes call **services**, not repositories (same route → service → repo pattern as v1.0).
- Keep D-23: operations/** and `/api/admin/companies` retain session+tenant vs platform break-glass semantics — do not add `withCpmo`/`withRole` where Phase 10 explicitly left them out.
- Reuse existing service/error patterns (`ConflictError`, `ValidationError`, `assertCompanyWrite`).

### Claude's Discretion
- Exact ESLint rule implementation (custom plugin vs `no-restricted-syntax` vs node script).
- How many new service files vs extending existing services.
- Test file placement (`*.test.ts` next to routes).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/http/with-auth.ts` already returns `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`
- `lib/http/with-project-access.ts`, `withProgramAccess`, `withCpmo`, `withRole`
- `proxy.matcher.test.mjs` at repo root
- `app/api/operations/**`, `app/api/admin/**`, `app/api/config/route.ts`
- Import-mapping routes under Jira/import APIs

### Established Patterns
- Route → service → repository; Zod at boundaries
- Phase 10 D-23 carve-out: no role asserts on operations/** or `/api/admin/companies`
- Vitest 4 dual project (node + jsdom)

### Integration Points
- Next.js proxy/middleware for unauthenticated API vs page
- `eslint.config.mjs` + `.github/workflows/test.yml` for ENF-01
- Jira search route/client

</code_context>

<specifics>
## Specific Ideas

- Phase 19 already shipped migrate-before-test; keep that CI step.
- Do not merge origin DATA branch leftover.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. UI dashboards, module split, Kysely are later phases.

</deferred>
