# Phase 5: Route Thinning & Validation - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all three grey areas accepted at the recommended answer

<domain>
## Phase Boundary

A shared auth/access wrapper and Zod request validation exist, so a route handler wrapped by them contains only parse → authorize → call service → respond, with no SQL, no external call, and no business logic left inline.

This phase builds the *mechanism* and proves it on the project-scoped tree. It does NOT roll the wrapper out everywhere (Phase 6 does that, shadow-mode first), does NOT touch `proxy.ts`, and does NOT build UI (Phase 7).

**Requirements:** ROUTE-01, ROUTE-02, ROUTE-05, ROUTE-06, ROUTE-07, ROUTE-12.
**Explicitly deferred to Phase 6:** ROUTE-03's full rollout into shadow-mode enforcement (ROUTE-08), ROUTE-04's import/export/config hard rollout, ROUTE-09/10's across-the-board 401/403 test matrix, ROUTE-11's proxy.ts empirical runtime confirm.

**Scale established by scout (2026-08-11):**
- 85 `route.ts` files. 73 call `getSessionFromRequest`; **31 have an identical `actorOf + getSessionFromRequest + try/catch + mapError` shape** — the boilerplate `withAuth` absorbs.
- 65 routes parse a JSON body. ~30-35 unique Zod schemas for core scope.
- `lib/http/` does not exist. Greenfield.
- zod ^4.4.3 already a dependency; existing idiom is `safeParse` against a schema in an adjacent `schemas.ts` (3 integration clients), zero `.parse()` calls.
- `proxy.ts` IS correctly wired for Next 16's renamed-middleware convention and deploys via standalone, but runtime execution is unverified — ROUTE-11 stays open to Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Wrapper Contract & Placement

- Wrappers live in a new **`lib/http/`** directory (matches the Phase-4 research note; `lib/http/` has no existing home, avoids colliding with Next's `middleware` mental model). Files: `lib/http/with-auth.ts`, `lib/http/with-project-access.ts`, plus a shared `lib/http/actor.ts` or inline type if needed.
- **`withAuth(handler)`** where handler receives `(req: NextRequest, ctx)` and `ctx = { user: SessionUser, actor: AccessActor, params: any, body?: unknown }`. The wrapper absorbs: session resolution (`getSessionFromRequest` → 401 on missing), `actorOf` (the helper duplicated in 31 files), `await params` (Next 16 async params), the try/catch → error-mapping tail. Handler body becomes one line: `return NextResponse.json(await fn(id, actor, body), { status: 201 })`.
- **Change `assertProjectAccess` to return the project row** instead of `void`. One-line change, mirrors `assertProgramAccess` (which already returns the row), and every existing caller ignores the return so nothing breaks. This is the enabler for `withProjectAccess` to hand the authorized project to the handler without a second fetch.
- **Two wrappers, not a parameterized one**: `withProjectAccess` (project — company_id OR customer_company_id, `projectAccessRow` JOIN) and `withProgramAccess` (program/customer — one company_id column). The SQL and rules genuinely differ; a generic `withAccess(scope, idParam)` would hide that behind config.

### Zod Validation Strategy

- Schemas live **adjacent to the route**: `app/api/<resource>/schema.ts`, mirroring the `lib/integrations/*/schemas.ts` idiom (schema next to its consumer). No central `lib/schemas/` tree.
- **`safeParse`**, matching the existing codebase idiom (all 3 integration clients use it; zero `.parse()` calls). On failure, return the route's pre-existing 400 response shape — do not invent a new error body.
- **Core scope validation**: validate resources that HAVE inline validation today (`if (!name?.trim())`, `if (!project_id)`, CAPEX/OPEX membership, `if (!id)`) — roughly 30 schemas. Defer report/export/auth payload schemas (ad-hoc-cast by design) to their owning phases.
- **No duplicate enum checks**: trust the service for CAPEX/OPEX already in `budget.service.ts:56` (ValidationError → 400). A Zod enum would be a second source of truth. Zod catches shape/required-field errors; services keep business-rule enums.

### Behavior Freeze & proxy.ts

- **`proxy.ts` untouched.** Route-level `withAuth` enforcement is confirmed-sufficient without it. ROUTE-11's empirical runtime confirm stays in Phase 6 (where shadow-mode exists). Record as an open finding: proxy.ts is correctly named for Next 16 and deploys via standalone, but its runtime execution is unverified.
- **Frozen error strings preserved verbatim**: `'Name required'`, Vietnamese Jira error strings, `MISSING_DATA`/`MISSING_FIELDS`, `Lỗi kết nối Jira: ...`, and Jira "fields route" 503 variants. Wrapper may map errors but must not change these bodies or statuses.
- **Frozen behavior contracts**: T-04-25 (`UnknownColumnError` → 400 naming columns, never 500/403), `force500` split on the 3 report routes, `validation`-escapes-force500, Jira upstream-status passthrough, `integrationErrorResponse` NOT auto-added to non-integration routes.
- **Phase 5 rollout scope**: build the wrapper + convert the `app/api/projects/[id]/**` tree as ROUTE-03 names it (activities, risks, issues, meetings, escalations, team, documents, bugs, holidays, milestones, budget). The full 73-route rollout with shadow-mode and the 401/403 everywhere test matrix is Phase 6.

### Claude's Discretion

All three grey areas accepted at the recommended answer; no open discretion items beyond ordinary implementation choices within these constraints.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **31 routes with the identical converted Phase-4 shape** — the template `withAuth` must absorb verbatim:
  `app/api/projects/[id]/risks/route.ts` is the fullest form (with `UnknownColumnError` dual-mapper `mapError`).
  `app/api/portfolio/budgets/route.ts` is the simpler form (no repo-error branch).
- `lib/services/access.ts` — `assertProjectAccess(projectId, actor): Promise<void>` returning void TODAY (Phase 5 flips it to return the row); `AccessActor = { company_id: number | null; is_admin: number | boolean }`.
- `lib/services/programs.service.ts:21` — `assertProgramAccess` already returns the row (the idiom to mirror).
- `lib/repositories/projects.repo.ts:36` — `projectAccessRow(projectId)` returns `ProjectAccessRow = { company_id, customer_company_id } | undefined`.
- `lib/api-errors.ts` — the three mappers. The HTTP-code mapping (Forbidden→403, NotFound→404, Validation→400, Conflict→409) lives ENTIRELY in `serviceErrorResponse`; the wrapper calls it, doesn't reimplement. `repoErrorResponse` handles `UnknownColumnError` (T-04-25). `integrationErrorResponse` is NOT auto-added (integration routes call it in their own catch).
- `lib/integrations/*/schemas.ts` (jira, anthropic, resend) — the Zod idiom: `import { z } from 'zod'`, `z.object(...)`, `.safeParse(data)`, branch on `parsed.success`.
- `lib/integrations/jira/schemas.ts` — the richest example (nullable, optional, .or(), .array).

### Established Patterns

- **`.safeParse` only** — no `.parse()` anywhere in the codebase.
- **`serviceErrorResponse`** returns `NextResponse`; routes that need the `UnknownColumnError→400` branch use a local `mapError(e)` that checks `instanceof UnknownColumnError` first (T-04-25). Wrapper must preserve this branch for routes that have it (the ~12 allowlist-gated write routes from Phase 2).
- **Vietnamese error strings** in Jira routes are user-facing and frozen.
- Report POST handlers keep `integrationErrorResponse(e, { force500: true })` in their own catch — the wrapper does not add it.

### Integration Points

- `lib/http/` is greenfield — no existing dir.
- `assertProjectAccess` has callers across services and the 04-05 gated routes — changing its return type from void to the row is safe (callers ignore the return).
- proxy.ts is a root-level Next 16 proxy (renamed middleware) — not touched in Phase 5.

</code_context>

<specifics>
## Specific Ideas

- **The wrapper's whole value is deleting the 31-file boilerplate** to one line per handler. The plan's acceptance should grep that wrapped handlers contain no `getSessionFromRequest`, no `actorOf`, no `try/catch` — just the service call.
- **Estimating schema count from inline validation**: admin/companies (×3 `if(!name)`), admin/users (required fields + self-delete guard), admin/demo-requests, auth/login, auth/change-password, demo-requests (×4 `.trim()`), import-mapping (×3 + jira/sync-mappings), jql-presets, operations systems/budget-items/incidents, program allocations, config, rag/jira-config. Defer report prompt payloads and export extras.
- **`mapError` dual-mapper must survive the wrap** — the 12 allowlist-gated write routes need `UnknownColumnError → 400` not the generic 500/403. The wrapper's catch should check `instanceof UnknownColumnError` before `serviceErrorResponse`, or expose the branch.
- **`withProjectAccess` hands the authorized project to the handler** so routes that need the project row (e.g. projects/[id]/route.ts GET) don't re-fetch. The return-row flip makes this free.

</specifics>

<deferred>
## Deferred Ideas

- **proxy.ts runtime confirmation** (ROUTE-11) → Phase 6, which already owns it and has shadow mode.
- **Shadow-mode enforcement rollout** (ROUTE-08) → Phase 6.
- **Full 73-route rollout + 401/403 everywhere test matrix** (ROUTE-09, ROUTE-10) → Phase 6.
- **Import/export/config hard rollout** (ROUTE-04) → Phase 6.
- **Report/export/auth payload schemas** → owning phases (report POST stays ad-hoc-cast by design).
- **CAPEX/OPEX enum in Zod** → not added (services own the business-rule enum).

</deferred>
