# Project Research Summary

**Project:** PM Tool B — Layer Reorg & Hardening
**Domain:** Layered-architecture refactor + security hardening of an existing Next.js 16 App Router multi-tenant PM/portfolio app
**Researched:** 2026-08-07
**Confidence:** MEDIUM-HIGH (layer boundaries and build order HIGH — derived from this codebase; tooling versions MEDIUM — verified live but re-pin at implementation; pitfalls MEDIUM — informed synthesis)

## Executive Summary

This is a brownfield refactor milestone, not a product build. The app ships today; the problem is organization: route handlers hold parsing, authorization, SQL, and external API calls in one file; auth is applied to some project routes and not others; there is no integration layer; and there are zero tests. Research converged on a bottom-up layer sweep — repositories → integration clients → services → thinned routes — with UI god-component decomposition deferred to the next milestone because decomposing a 2828-line page against an API surface that is about to change shape means doing the work twice.

The load-bearing recommendation is structural, not procedural: tenant isolation must be enforced by a wrapper (`withProjectAccess(handler)`) that loads the project, checks `project.company_id === session.companyId`, and hands the already-authorized project into the handler. A route that does not call the wrapper has no code path to the data. That is what makes a *new* route unable to skip the check — replacing "call `checkAccess()` and hope every route remembers." A cross-company 403 regression suite over `app/api/projects/[id]/**` is the backstop; a custom ESLint rule is a nice-to-have, not a blocker.

Two findings change the plan as scoped. First, `proxy.ts` is the *correct* Next 16 convention (Middleware was renamed to Proxy; `middleware.ts` now warns) — CONCERNS.md's "verify Next 16 may expect proxy convention" is resolved, and the file needs no migration. But it stays a coarse cookie/session-validity gate: `pg` is not edge-runtime viable, so real authorization lives in the Node-runtime route wrapper. Second, the project's own decisions carry the top two risks — flipping ~15 unauthed routes to enforced access risks a 403 storm against UI callers that never sent proper context, and replacing `Object.keys(body)` dynamic SQL with column allowlists has a silent-drop failure mode where a field simply stops persisting with no error. Both need explicit detection, not just careful coding.

## Key Findings

### Recommended Stack

No framework changes — Next 16.2.4 / React 19.2.4 / TypeScript strict / `pg` / npm are fixed. Additions only, and the split between dev-only and runtime matters because runtime deps land in the Docker image.

**Core technologies:**
- `vitest` `^4.1.10` + `@vitejs/plugin-react` + `jsdom` + `@testing-library/react` `^16.3.2` (dev-only): the official Next 16 testing path for App Router. RTL peer range covers React 19.
- `zod` (runtime dep): request-body schemas and external-boundary validation for Jira responses and Anthropic output. Already an accepted peer of `@anthropic-ai/sdk`, so no version conflict.
- `kysely` `^0.29.4` (runtime, optional/scoped): typed query builder that wraps the existing `pg.Pool`. Makes column allowlisting compile-time. Additive — does not touch the fragile `lib/db.ts` PostgresClient bridge, which is out of scope to rewrite.

**Notable non-need:** `node-mocks-http`. App Router handlers take a Web-standard `Request` and return `Response`, so a route test constructs a `NextRequest` and calls the exported `GET`/`POST` directly — no server, no mock library.

### Expected Capabilities

Feature set is frozen, so "features" here means what each layer must provide for the refactor to have actually fixed anything.

**Must have (table stakes):**
- Thin route handlers — no SQL, no `fetch`/SDK call, no business logic left in `route.ts`
- Shared tenant guard wrapper covering every project/company-scoped route, including import and export paths
- Explicit input schema at the route boundary plus a column allowlist in the repository (belt and suspenders against mass assignment)
- Typed integration clients providing credential resolution, error normalization, and timeouts
- Services framework-agnostic: plain args in, plain data out, typed errors (`ForbiddenError`/`NotFoundError`/`ValidationError`) that the wrapper maps to status codes
- Repositories take already-resolved scoping params (`companyId`, `projectId`) — they do not decide who may ask
- Tests per layer; a layer is not done without them

**Should have (differentiators):**
- ESLint rule or CI grep failing the build when a project-scoped `route.ts` exports an unwrapped handler
- Generic 500 messages replacing the current `String(e)` responses, which leak stack text

**Defer:**
- UI god-component decomposition (next milestone — depends on stable API contracts)
- Moving schema init/migrations out of `getDb()`
- Grid virtualization and perf work

### Architecture

Target layering reuses the existing `lib/` root rather than introducing `src/server/`, because `tsconfig.json` maps `@/*` → `./*` at the project root and no `src/` exists — adding one would mean re-pointing every existing import for no structural gain.

Import direction is the contract, and the forbidden directions matter more than the allowed ones: client components may never import `@/lib/db`, repositories, services, integrations, or `pg`. Routes may not reach past services into repositories or `lib/db`. Services may not import `next/server`. Repositories may import only `lib/db.ts`. Integrations do not read the DB — a service fetches a company's Jira credential names via a repository and hands resolved values to the client.

**Build order (bottom-up, each step shippable):**
1. **Repositories** — mechanical SQL extraction, behavior identical, no auth logic yet. Lowest regression risk; verifiable by comparing API responses before/after.
2. **Integration clients** — independent of the DB refactor, so it parallelizes cleanly.
3. **Services** — where the missing tenant-scoping logic is actually *written* (net-new, not extracted). Third because services with nothing to call would recreate today's coupling under new filenames.
4. **Route thinning** — every route through `lib/http/with-auth.ts`; closes the uneven-auth gap structurally. Last because it depends on services existing.

### Critical Pitfalls

Ten identified, five critical. The top ones are consequences of decisions already made:

1. **403 storm** — flipping ~15 previously-unauthed routes to enforced access breaks legitimate callers that never sent proper context. Needs a shadow/log-only pass before enforcement.
2. **Allowlist silent drop** — a field omitted from a column allowlist stops persisting with no error. Needs a diff of accepted keys against current `Object.keys(body)` behavior per resource, not eyeballing.
3. **"Tests alongside" gets skipped under pressure** on the layer that is mid-move — the project's main exposure, since there is no pre-built safety net by design.
4. **Aggregate/export/join queries leak tenancy** even when single-resource routes are correct — portfolio rollups and report generation are the risk surface.
5. **Opportunistic fixes make regressions un-bisectable** — mitigable by committing behavior changes separately from moves.

Moderate: stale-closure and effect-ordering bugs during component extraction; unified credential resolver breaking a live tenant mid-swap; contract validation rejecting shapes the old ad-hoc parsing tolerated.

## Implications for Roadmap

- **Phase order is settled by dependency, not preference:** repositories → integrations → services → routes. Do not reorder; each step's tests depend on the prior layer existing.
- **Test harness must land before or with phase 1**, since "tests alongside" is the only regression guardrail.
- **Security enforcement needs its own sub-step with a shadow-mode gate** — the 403 storm risk means "add wrapper" and "enforce wrapper" are not the same commit.
- **A migration inventory of the ~15 unauthed routes and the per-resource column allowlists is a planning artifact**, not something to derive during implementation.
- **UI decomposition is a separate milestone** with an explicit dependency on this one completing.

## Confidence Assessment

**HIGH:** layer boundaries and forbidden import directions; build order and its dependency rationale; `proxy.ts` being the correct Next 16 convention.

**MEDIUM:** exact pinned tool versions (verified live against npm/official docs but `vitest` 4.x moves fast — re-verify at install); pitfall severity ordering (informed synthesis, not vendor-documented).

**Open questions for planning:**
- Whether `proxy.ts` actually executes in the deployed Docker/Railway/K8s runtime — unverified, and CONCERNS.md flagged it. Confirm against deploy config rather than assuming.
- Whether `proxy.ts` can touch the DB at all for session validation given `pg`'s Node-runtime requirement — treat as open, do not build on it.
- Whether Kysely is adopted or repositories stay on raw `pg` with runtime allowlists — a phase-level decision, both are viable.
- Whether the same `pg.Pool` is shared if Kysely is adopted (connection limits could double otherwise).

## Sources

### Primary (HIGH confidence)
- This repo's `.planning/codebase/` map (ARCHITECTURE, STRUCTURE, STACK, CONCERNS, INTEGRATIONS, CONVENTIONS, TESTING) — layer boundaries, god-page line counts, unauthed route list, credential split
- `tsconfig.json`, `package-lock.json` — alias mapping, existing peer ranges
- Next.js official docs, testing/vitest guide and Proxy file convention (Next 16.3, updated 2026-02)

### Secondary (MEDIUM confidence)
- npm registry latest-version lookups (2026-08-07) for `vitest`, `@testing-library/react`, `zod`, `kysely`
- Next.js `with-vitest` example — devDependency set and minimal config shape

### Tertiary (LOW confidence)
- Refactor/security engineering patterns applied to this codebase's specifics — no live-web corroboration this run

---
*Research completed: 2026-08-07*
*Ready for roadmap: yes*
