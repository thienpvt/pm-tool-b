# Roadmap: PM Tool B — Layer Reorg & Hardening

## Overview

This milestone takes the app from zero test coverage and a flat `lib/` where routes inline SQL, reinvent auth, and call external APIs directly, to a real layered architecture with tests at every layer. The sweep runs bottom-up by dependency: stand up a test harness first (nothing else is verifiable without it), then repositories (SQL moves out of routes), integration clients (Jira/Anthropic/Resend get one client each plus a unified credential resolver), services (business logic and tenant-ownership checks land in one place), route thinning (a shared auth/access wrapper replaces ad hoc per-route checks), access enforcement rollout (the wrapper goes live everywhere, shadow-mode first to avoid a 403 storm), and finally UI decomposition (god pages split into hooks + feature modules once the API surface they call is stable). Each phase is independently shippable and independently testable before the next starts.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Test Harness** - Stand up Vitest so every later layer lands with tests, not a promise to add them (completed 2026-08-07)
- [x] **Phase 2: Repository Layer** - Move every SQL statement into repository modules with explicit scoping and column allowlists (completed 2026-08-10)
- [ ] **Phase 3: Integration Clients** - Route all Jira/Anthropic/Resend calls through dedicated, validated clients with one credential resolver
- [ ] **Phase 4: Service Layer** - Concentrate business logic and tenant-ownership checks in service modules with typed errors
- [ ] **Phase 5: Route Thinning & Validation** - Build the shared auth/access wrapper and Zod validation so routes shrink to parse/authorize/call/respond
- [ ] **Phase 6: Access Enforcement Rollout** - Roll the wrapper out to every project-scoped route, shadow-mode first, with 401/403 tests proving it
- [ ] **Phase 7: UI Decomposition** - Split the 7 named god pages/components into hooks + feature modules against the now-stable API surface

## Cross-Cutting Conventions

Three requirements apply to every phase's execution rather than to a specific layer. They are not "Phase 8" — they are how each phase above gets done:

- **HYG-01**: Pure code moves are committed separately from behavior changes, so a regression can be bisected to one or the other
- **HYG-02**: Every opportunistic bug fix made during the sweep is called out in its commit message as a behavior change
- **HYG-03**: A layer is not marked done until its tests exist and pass — no layer advances on a promise to add tests later

`/gsd-plan-phase` and `/gsd-execute-phase` should treat these as standing constraints on every plan in every phase below, not as a checklist item to satisfy once.

## Phase Details

### Phase 1: Test Harness

**Goal**: Automated tests are runnable — Node unit tests, jsdom component tests, route-handler tests without a running server, and repository tests against a real Postgres test DB — and CI fails the build on a failing test. Nothing in Phases 2-7 can claim "tests exist and pass" (HYG-03) until this exists.
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):

  1. `npm test` runs a Vitest suite from a committed `vitest.config.ts`, defaulting to the Node environment
  2. A component test renders a React 19 client component in a `jsdom` environment and passes
  3. A route-handler test constructs a `NextRequest` and calls an exported handler directly, with no running server
  4. A repository test runs against a real PostgreSQL test database via a documented setup command
  5. CI runs `npm test` on push and fails the build when a test fails

**Plans**: 1/1 plans executed

- [x] 01-01-PLAN.md

### Phase 2: Repository Layer

**Goal**: Every SQL statement lives in `lib/repositories/*.repo.ts`. Repositories take already-resolved scoping params and never inspect a session; writes go through a per-resource column allowlist instead of raw `Object.keys(body)` mass assignment.
**Depends on**: Phase 1
**Requirements**: REPO-01, REPO-02, REPO-03, REPO-04, REPO-05, REPO-06
**Success Criteria** (what must be TRUE):

  1. A grep for raw SQL or `pg` calls outside `lib/repositories/*.repo.ts` and `lib/db.ts` returns nothing in `route.ts`, service, or component files
  2. Repository functions take explicit `companyId`/`projectId` arguments and contain no session or request inspection
  3. Every write path rejects an unknown column key instead of silently persisting it, per an explicit per-resource allowlist
  4. Each resource's allowlist has been diffed against the fields the current `Object.keys(body)` code actually persists, with the diff recorded
  5. Each repository module has passing tests covering read, write, and rejected-column cases, and imports only `@/lib/db`

**Plans**: 3/3 plans executed

- [x] 02-01-PLAN.md
- [x] 02-02-PLAN.md
- [x] 02-03-PLAN.md

### Phase 3: Integration Clients

**Goal**: All external calls (Jira, Anthropic, Resend) go through one dedicated client module each, with a timeout, a normalized error type, and boundary validation — replacing ad hoc `fetch`/SDK calls and the two divergent credential-lookup patterns.
**Depends on**: Phase 2
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, INTG-06, INTG-07, INTG-08, INTG-09, INTG-10
**Success Criteria** (what must be TRUE):

  1. A grep confirms all Jira Cloud REST calls, all Anthropic calls, and all Resend calls happen only inside their respective `lib/integrations/*/client.ts` module — zero direct calls from any route
  2. Each client applies an explicit request timeout and returns a normalized error type rather than a raw SDK or fetch throw
  3. Jira responses are validated against a Zod schema and Anthropic output is validated at the client boundary before any caller consumes it; a shape mismatch logs a validation error instead of producing a silent wrong value or a 500
  4. One credential resolver serves all integrations, replacing the Jira env-var-names-in-DB / Anthropic env-then-DB split, and every currently-working tenant configuration is verified against it before the old paths are deleted
  5. Each integration client has tests using recorded/mocked responses including a malformed-response case, and imports no repository directly

**Plans**: TBD

### Phase 4: Service Layer

**Goal**: Business logic and tenant-ownership checks move into `lib/services/*.service.ts` modules that take plain arguments, return plain data, and throw typed errors — closing the gap where auth was checked in some routes and not others.
**Depends on**: Phase 3
**Requirements**: SVC-01, SVC-02, SVC-03, SVC-04, SVC-05, SVC-06, SVC-07
**Success Criteria** (what must be TRUE):

  1. Business logic for every API resource lives in a `lib/services/*.service.ts` module, and a grep confirms no service imports `next/server` or touches `NextRequest`/`NextResponse`
  2. Services signal failure by throwing `ForbiddenError`, `NotFoundError`, or `ValidationError` — none of which carry an HTTP status
  3. Every project-scoped service function asserts the caller's company owns the project before returning or mutating data
  4. Portfolio, roadmap, budget rollup, and report-generation services scope every aggregate query and join by company, proven with a cross-company fixture rather than by inspection
  5. Every export service (Excel, PowerPoint, Word) scopes its data fetch by company, and each service has unit tests with mocked repositories including an explicit cross-company access-denied case

**Plans**: TBD

### Phase 5: Route Thinning & Validation

**Goal**: A shared auth/access wrapper and Zod request validation exist, so a route handler wrapped by them contains only parse → authorize → call service → respond, with no SQL, no external call, and no business logic left inline.
**Depends on**: Phase 4
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-05, ROUTE-06, ROUTE-07, ROUTE-12
**Success Criteria** (what must be TRUE):

  1. `lib/http/with-auth.ts` resolves the session, returns 401 on a missing or invalid session, and passes an authorized context into the handler
  2. `withProjectAccess` loads the project, verifies `project.company_id` matches the session company, and hands the already-authorized project to the handler
  3. A route handler wrapped by these helpers contains only parse, authorize, call service, respond — a grep confirms no dynamic SQL column assignment remains anywhere in `app/api/**`
  4. Every request body is validated against an explicit Zod schema at the route boundary before reaching a service
  5. The wrapper maps typed service errors to status codes (403/404/400) and returns a generic message for unexpected errors instead of `String(e)`

**Plans**: TBD

### Phase 6: Access Enforcement Rollout

**Goal**: Every project-scoped route and its import/export/config/file-parsing neighbors are provably protected by the wrapper built in Phase 5 — rolled out in log-only shadow mode first so legitimate callers don't get hit with a 403 storm on cutover.
**Depends on**: Phase 5
**Requirements**: ROUTE-03, ROUTE-04, ROUTE-08, ROUTE-09, ROUTE-10, ROUTE-11
**Success Criteria** (what must be TRUE):

  1. Every route under `app/api/projects/[id]/**` — activities, risks, issues, meetings, escalations, team, documents, bugs, holidays, milestones, budget — uses the project-access wrapper
  2. Import, export, config, and file-header-parsing routes enforce the same access check as project routes
  3. Access enforcement ran in log-only shadow mode first, and the recorded would-be-denials were reviewed and resolved before enforcement was switched on
  4. A test asserts 403 for a cross-company `project_id` on every route under `app/api/projects/[id]/**`, and a test asserts 401 for a missing or expired session on every non-public route
  5. Whether `proxy.ts` executes in the deployed runtime is confirmed empirically (or route-level enforcement is confirmed sufficient without it), with the finding written down either way

**Plans**: TBD

### Phase 7: UI Decomposition

**Goal**: The 7 named god pages/components split into a container plus feature modules with data-fetching extracted into named hooks, against the now-stable API surface from Phases 1-6 — with no client code reaching past that surface into server-only layers.
**Depends on**: Phase 6
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11
**Success Criteria** (what must be TRUE):

  1. `app/portfolio/report/page.tsx`, `app/projects/[id]/timeline/page.tsx`, `app/projects/[id]/report/page.tsx`, `app/projects/[id]/milestones/page.tsx`, `app/portfolio/roadmap/page.tsx`, `components/timeline/ImportMappingDialog.tsx`, and `app/page.tsx` are each decomposed into a container plus feature modules with no single file over 400 lines
  2. Data fetching in each decomposed page is extracted into named hooks, separate from rendering
  3. A grep confirms no client component imports `@/lib/db`, a repository, a service, an integration client, or `pg`
  4. Each decomposed page has a component test covering its primary render path and one interaction
  5. Each decomposition is verified against the pre-refactor page for identical behavior on load, filter, and export paths

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Test Harness | 1/1 | Complete    | 2026-08-07 |
| 2. Repository Layer | 3/3 | In Progress|  |
| 3. Integration Clients | 0/TBD | Not started | - |
| 4. Service Layer | 0/TBD | Not started | - |
| 5. Route Thinning & Validation | 0/TBD | Not started | - |
| 6. Access Enforcement Rollout | 0/TBD | Not started | - |
| 7. UI Decomposition | 0/TBD | Not started | - |
