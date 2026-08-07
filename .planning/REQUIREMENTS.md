# Requirements: PM Tool B — Layer Reorg & Hardening

**Defined:** 2026-08-07
**Core Value:** Every project-scoped request is tenant-isolated and every layer has one job — so a new route or page cannot silently reintroduce IDOR or a 2000-line god component.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Test Harness

- [ ] **TEST-01**: `npm test` runs a Vitest suite from a committed `vitest.config.ts` with Node as the default environment
- [ ] **TEST-02**: Developer can write a component test that renders a React 19 client component in a `jsdom` environment
- [ ] **TEST-03**: Developer can test an App Router route handler by constructing a `NextRequest` and calling the exported handler directly, with no running server
- [ ] **TEST-04**: Repository tests run against a real PostgreSQL test database with a documented setup command
- [ ] **TEST-05**: `npm test` runs in CI on push and fails the build on a failing test

### Repository Layer

- [ ] **REPO-01**: Every SQL statement in the codebase lives in a `lib/repositories/*.repo.ts` module — no inline SQL in any `route.ts`, service, or component
- [ ] **REPO-02**: Each repository function takes already-resolved scoping parameters (`companyId`, `projectId`) as explicit arguments and never inspects a session or request
- [ ] **REPO-03**: Every write path accepts only columns on an explicit per-resource allowlist; an unknown key is rejected, not silently ignored
- [ ] **REPO-04**: Each resource's column allowlist is verified against the fields the current `Object.keys(body)` code actually persists, with the comparison recorded so no field silently stops saving
- [ ] **REPO-05**: Each repository module has tests covering read, write, and rejected-column cases
- [ ] **REPO-06**: A repository module imports `@/lib/db` only — importing a service, `next/server`, or a session type fails review

### Integration Clients

- [ ] **INTG-01**: All Jira Cloud REST calls go through `lib/integrations/jira/client.ts` — no `fetch` to Atlassian from any route
- [ ] **INTG-02**: All Anthropic calls go through `lib/integrations/anthropic/client.ts` — no direct `@anthropic-ai/sdk` construction in any route
- [ ] **INTG-03**: All Resend calls go through `lib/integrations/resend/client.ts`
- [ ] **INTG-04**: Every integration client applies an explicit request timeout and returns a normalized error type rather than throwing a raw SDK or fetch error
- [ ] **INTG-05**: Jira REST responses are validated against a Zod schema at the client boundary; a shape mismatch produces a logged validation error, not a silent wrong value or a 500
- [ ] **INTG-06**: Anthropic model output is validated at the client boundary before any caller consumes it
- [ ] **INTG-07**: One credential resolver serves all integrations, replacing the split between Jira's env-var-names-in-DB pattern and Anthropic's env-then-DB fallback
- [ ] **INTG-08**: The credential resolver preserves every currently-working tenant configuration — verified per configured company before the old paths are deleted
- [ ] **INTG-09**: An integration client never imports a repository; a service resolves credentials and passes values in
- [ ] **INTG-10**: Each integration client has tests using recorded/mocked external responses, including a malformed-response case

### Service Layer

- [ ] **SVC-01**: Business logic for every API resource lives in a `lib/services/*.service.ts` module
- [ ] **SVC-02**: A service function takes plain arguments and returns plain data — it never imports `next/server` or touches `NextRequest`/`NextResponse`
- [ ] **SVC-03**: Services signal failure by throwing typed errors (`ForbiddenError`, `NotFoundError`, `ValidationError`) that carry no HTTP status of their own
- [ ] **SVC-04**: Every service function operating on a project asserts the caller's company owns that project before returning or mutating data
- [ ] **SVC-05**: Portfolio, roadmap, budget rollup, and report-generation services scope every aggregate query and join by company — verified with a cross-company fixture, not by inspection
- [ ] **SVC-06**: Every export service (Excel, PowerPoint, Word) scopes its data fetch by company
- [ ] **SVC-07**: Each service has unit tests with mocked repositories, including an explicit cross-company access-denied case

### Route Layer

- [ ] **ROUTE-01**: `lib/http/with-auth.ts` provides a wrapper that resolves the session, returns 401 on missing or invalid session, and passes an authorized context into the handler
- [ ] **ROUTE-02**: `withProjectAccess` loads the project, verifies `project.company_id` matches the session company, and hands the already-authorized project to the handler — a handler that does not use it has no code path to project data
- [ ] **ROUTE-03**: Every route under `app/api/projects/[id]/**` uses the project-access wrapper, including activities, risks, issues, meetings, escalations, team, documents, bugs, holidays, milestones, and budget
- [ ] **ROUTE-04**: Import, export, config, and file-header-parsing routes enforce the same access check as project routes
- [ ] **ROUTE-05**: Each route handler contains only parse, authorize, call service, respond — no SQL, no external API call, no business logic
- [ ] **ROUTE-06**: Every request body is validated against an explicit Zod schema at the route boundary before reaching a service
- [ ] **ROUTE-07**: The wrapper maps typed service errors to status codes (403, 404, 400) and returns a generic message for unexpected errors instead of the current `String(e)`
- [ ] **ROUTE-08**: Access enforcement runs in log-only shadow mode first, and the recorded would-be-denials are reviewed and resolved before enforcement is switched on
- [ ] **ROUTE-09**: A test asserts 403 for a cross-company `project_id` on every route under `app/api/projects/[id]/**`
- [ ] **ROUTE-10**: A test asserts 401 for a missing or expired session on every non-public route
- [ ] **ROUTE-11**: `proxy.ts` is confirmed to execute in the deployed runtime, or route-level session enforcement is confirmed sufficient without it — with the finding written down either way
- [ ] **ROUTE-12**: No dynamic SQL column assignment built from request keys remains anywhere in `app/api/**`

### UI Decomposition

- [ ] **UI-01**: Data fetching in each god page is extracted into named hooks, separate from rendering
- [ ] **UI-02**: `app/portfolio/report/page.tsx` is decomposed into a container plus feature modules, with no single file over 400 lines
- [ ] **UI-03**: `app/projects/[id]/timeline/page.tsx` is decomposed the same way
- [ ] **UI-04**: `app/projects/[id]/report/page.tsx` is decomposed the same way
- [ ] **UI-05**: `app/projects/[id]/milestones/page.tsx` is decomposed the same way
- [ ] **UI-06**: `app/portfolio/roadmap/page.tsx` is decomposed the same way
- [ ] **UI-07**: `components/timeline/ImportMappingDialog.tsx` is decomposed the same way
- [ ] **UI-08**: `app/page.tsx` is decomposed the same way
- [ ] **UI-09**: No client component imports `@/lib/db`, a repository, a service, an integration client, or `pg`
- [ ] **UI-10**: Each decomposed page has a component test covering its primary render path and one interaction
- [ ] **UI-11**: Each decomposition is verified against the pre-refactor page for identical behavior on load, filter, and export paths

### Refactor Hygiene

- [ ] **HYG-01**: Pure code moves are committed separately from behavior changes, so a regression can be bisected to one or the other
- [ ] **HYG-02**: Every opportunistic bug fix made during the sweep is called out in its commit message as a behavior change
- [ ] **HYG-03**: A layer is not marked done until its tests exist and pass — no layer advances on a promise to add tests later

## v2 Requirements

Deferred. Tracked but not in this milestone's roadmap.

### Data Layer

- **DATA-01**: Schema init and the migration loop move out of `getDb()` into an external migrate job so app start only connects
- **DATA-02**: Migrations become versioned files rather than an in-code loop
- **DATA-03**: Data-fix `UPDATE`s currently running as migrations move to one-off scripts

### Enforcement

- **ENF-01**: An ESLint rule or CI check fails the build when a project-scoped `route.ts` exports a handler not wrapped by the sanctioned helper
- **ENF-02**: Repositories adopt Kysely over the existing `pg.Pool` so column allowlists are enforced at compile time

### Performance

- **PERF-01**: Large grids are virtualized
- **PERF-02**: Static page chrome moves to server components
- **PERF-03**: Cold-start time is measured and budgeted

## Out of Scope

| Feature | Reason |
|---------|--------|
| New product features | Milestone is structural; feature work resumes after |
| API or UI redesign | Refactor plus opportunistic fixes only — endpoint shapes and screens stay recognizable |
| Replacing Next / React / PostgreSQL / `pg` | The mess is organization, not technology choice |
| Rewriting the `lib/db.ts` PostgresClient dialect bridge | Fragile but working; touch only where a repository requires it |
| Moving to a `src/` directory | `@/*` maps to project root and no `src/` exists — would re-point every import for no structural gain |
| Full ORM adoption | Repositories need safe column allowlists, not a data-layer replacement |
| Session validation inside `proxy.ts` | `pg` is not edge-runtime viable; real authorization belongs in the Node-runtime route wrapper |
| Rotating or redesigning default seed credentials | Real issue, but authentication redesign is its own milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 1 | Pending |
| TEST-04 | Phase 1 | Pending |
| TEST-05 | Phase 1 | Pending |
| REPO-01 | Phase 2 | Pending |
| REPO-02 | Phase 2 | Pending |
| REPO-03 | Phase 2 | Pending |
| REPO-04 | Phase 2 | Pending |
| REPO-05 | Phase 2 | Pending |
| REPO-06 | Phase 2 | Pending |
| INTG-01 | Phase 3 | Pending |
| INTG-02 | Phase 3 | Pending |
| INTG-03 | Phase 3 | Pending |
| INTG-04 | Phase 3 | Pending |
| INTG-05 | Phase 3 | Pending |
| INTG-06 | Phase 3 | Pending |
| INTG-07 | Phase 3 | Pending |
| INTG-08 | Phase 3 | Pending |
| INTG-09 | Phase 3 | Pending |
| INTG-10 | Phase 3 | Pending |
| SVC-01 | Phase 4 | Pending |
| SVC-02 | Phase 4 | Pending |
| SVC-03 | Phase 4 | Pending |
| SVC-04 | Phase 4 | Pending |
| SVC-05 | Phase 4 | Pending |
| SVC-06 | Phase 4 | Pending |
| SVC-07 | Phase 4 | Pending |
| ROUTE-01 | Phase 5 | Pending |
| ROUTE-02 | Phase 5 | Pending |
| ROUTE-05 | Phase 5 | Pending |
| ROUTE-06 | Phase 5 | Pending |
| ROUTE-07 | Phase 5 | Pending |
| ROUTE-12 | Phase 5 | Pending |
| ROUTE-03 | Phase 6 | Pending |
| ROUTE-04 | Phase 6 | Pending |
| ROUTE-08 | Phase 6 | Pending |
| ROUTE-09 | Phase 6 | Pending |
| ROUTE-10 | Phase 6 | Pending |
| ROUTE-11 | Phase 6 | Pending |
| UI-01 | Phase 7 | Pending |
| UI-09 | Phase 7 | Pending |
| UI-10 | Phase 7 | Pending |
| UI-11 | Phase 7 | Pending |
| UI-02 | Phase 7 | Pending |
| UI-03 | Phase 7 | Pending |
| UI-04 | Phase 7 | Pending |
| UI-05 | Phase 7 | Pending |
| UI-06 | Phase 7 | Pending |
| UI-07 | Phase 7 | Pending |
| UI-08 | Phase 7 | Pending |
| HYG-01 | All phases | Pending |
| HYG-02 | All phases | Pending |
| HYG-03 | All phases | Pending |

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 52
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-07*
*Last updated: 2026-08-07 after initial definition*
