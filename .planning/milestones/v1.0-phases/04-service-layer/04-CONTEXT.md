# Phase 4: Service Layer - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all four grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Business logic and tenant-ownership checks move into `lib/services/*.service.ts` modules that take plain arguments, return plain data, and throw typed errors — closing the gap where auth was checked in some routes and not others.

This phase does NOT build the route-level auth wrapper (Phase 5) or roll it out (Phase 6). It does not touch UI (Phase 7). The ownership assert landing here is the service-layer half of defense in depth; Phase 5 adds the route-level half.

**Scale established by codebase scout (2026-08-10):**
- 85 `route.ts` files total. After Phases 2-3, 66 are near-trivial pass-throughs and 19 hold real computation.
- Only 10 routes import 2+ repositories (the orchestration set).
- **4 of ~27 project-scoped routes have any ownership check.** 22 project-scoped routes have no session check at all.
- 5 export/import routes (`export/excel/[id]`, `export/ppt/[id]`, `export/word/[id]/[type]`, `export/weekly-report/[id]`, `export/resource-plan/[id]`, `import/resource-plan/[id]`) take a project id and return full project data with **no session and no company scoping** — the worst live leak in the codebase.
- `lib/services/` does not exist. Greenfield.

</domain>

<decisions>
## Implementation Decisions

### Service Granularity & Scope

- Every project-scoped and company-scoped resource gets a service, including the thin pass-through routes. The service is not boilerplate — it is where the SVC-04 ownership assert lives. Genuinely system-level routes (health, auth/me) are exempt.
- One service per resource, 1:1 with the existing repositories (`risks.service.ts` ↔ `risks.repo.ts`). Matches established naming and keeps the layer legible.
- `app/api/portfolio/report/route.ts` GET (499 lines of logic) gets its own `portfolio-report.service.ts` rather than being folded into `portfolio.service.ts`.
- The report routes' POST handlers (~50 lines of prompt template each, then `createMessage(creds, ...)`) **stay in the route**. They are already correctly factored against the Phase 3 Anthropic client; moving them is churn with no security or logic win.

### Ownership & Access Semantics

- **Unify cross-company denials on 403**; 401 is reserved for a missing or invalid session. This changes `app/api/projects/[id]/budget/route.ts`, whose local `checkBudgetAccess` currently collapses a cross-company hit to 401. The milestone constraint explicitly permits new 403s. Flag as HYG-02 behavior change.
- The ownership assert lives **in the service** (SVC-04). Phase 5's wrapper will add a route-level check later; both layers asserting is deliberate defense in depth, not redundancy to remove.
- The `is_admin` bypass is **preserved exactly as-is** — admin sees all companies. No re-scoping.
- The 5 unauthenticated export/import routes are **fixed in this phase** via SVC-06, not deferred to Phase 6. They are the worst live leak and the export services need only a `companyId` param threaded through.

### Typed Errors & Mapping

- The three error classes live in a new `lib/services/errors.ts`, mirroring the structure of `lib/integrations/errors.ts`. Copy the `UnknownColumnError` shape from `lib/repositories/_helpers.ts`: bare `extends Error`, sets `this.name`, carries a structured payload, **no HTTP status** (SVC-03). `IntegrationError` is explicitly NOT a suitable base — it carries `status?: number`.
- Routes map via a new `serviceErrorResponse(e)` in `lib/api-errors.ts`, alongside the existing `repoErrorResponse` and `integrationErrorResponse`. `ForbiddenError`→403, `NotFoundError`→404, `ValidationError`→400, else delegate to a generic 500. `api-errors.ts` already imports across layer boundaries by design.
- When a service wraps an integration call and an `IntegrationError` escapes, it is **re-thrown untouched**. This is what preserves the Phase 3 behavior freeze — the Anthropic `force500` split, the `validation`-escapes-`force500` decision, and the Jira upstream-status passthrough. The route catches both error families.
- `ValidationError` stays distinct from the repositories' `UnknownColumnError`. UnknownColumnError = a rejected column key (already maps to 400 with the column names). ValidationError = a business-rule violation (e.g. budget category ∉ CAPEX/OPEX).

### Testing & Rollout

- Default tier is `*.service.unit.test.ts` with `vi.mock`'d repositories and no DB, matching the established `vi.hoisted` idiom in `lib/repositories/auth.repo.unit.test.ts` and `lib/integrations/anthropic/client.unit.test.ts`. These always run — they do not need `TEST_DATABASE_URL`.
- SVC-05 says the aggregate/join scoping must be "proven with a cross-company fixture rather than by inspection", so portfolio/roadmap/budget-rollup/report scoping additionally gets **real-DB gated tests**. `seedProject(name, { company_id })` in `test/repo-db.ts` already accepts a company — no new harness needed.
- Plan slicing runs **substrate first**: (1) `lib/services/errors.ts` + `assertProjectAccess` + one reference service end-to-end, (2) the unauthenticated export/import leaks, (3) the orchestration-heavy routes, (4) the thin resource sweep. Each slice lands with its tests (HYG-03).
- `app/api/portfolio/route.ts` hand-rolls RAG thresholds (`open_risks >= 3` → red, `<= 14` days → amber) while the report routes call `lib/rag.ts:calculateRAG`. **Extract as-is, preserve behavior, record the divergence** in the summary. Reconciling them is a behavior change that deserves its own HYG-02 callout, not a silent fix inside a refactor.

### Claude's Discretion

All four grey areas were accepted at the recommended answer, so no open discretion items beyond ordinary implementation choices within these constraints.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `lib/repositories/projects.repo.ts:36` — `projectAccessRow(projectId)` returns `ProjectAccessRow` (type at line 30) with `company_id` and `customer_company_id`. This is the ownership primitive that `assertProjectAccess(projectId, user)` should wrap. Currently used by only 4 routes.
- `lib/repositories/_helpers.ts:10` — `UnknownColumnError`, the no-HTTP-status error shape to copy.
- `lib/integrations/errors.ts` — structural model for `lib/services/errors.ts`.
- `lib/rag.ts` — `calculateRAG`, already used by the report routes.
- `test/repo-db.ts` — `setupRepoTables`, `seedProject(name, { company_id })`, `testDb`. `test/db.ts` — `hasTestDb`.
- 28 repositories in `lib/repositories/`, all taking already-resolved scoping params (Phase 2 contract).
- 3 integration clients in `lib/integrations/{jira,anthropic,resend}/client.ts` taking already-resolved credentials (Phase 3 contract).

### Established Patterns

- **Mocking idiom is `vi.hoisted` + `vi.mock`, no dependency injection.** Modules import collaborators directly; tests intercept at the module boundary. Cleanest example `lib/repositories/auth.repo.unit.test.ts:3-7`. Services should follow suit: import repos directly, tests `vi.mock('@/lib/repositories/projects.repo', ...)`.
- **Two-tier test naming**: `*.unit.test.ts` = fully mocked, always runs. `*.repo.test.ts` = real Postgres, gated by `describe.skipIf(!hasTestDb)`.
- **Layer discipline is enforced and documented** — `lib/api-errors.ts:12-13` states repositories must not import `next/server` (REPO-06). `lib/integrations/credentials.ts:4-5` documents itself as the single sanctioned repository importer under `lib/integrations/`.
- Error mappers live in `lib/api-errors.ts` and return `NextResponse`; the layers that throw never touch `next/server`.

### Integration Points

- **Two existing access helpers, both file-private near-duplicates** — `app/api/projects/[id]/route.ts:8-18` (`checkAccess`, distinguishes 401/404/403) and `app/api/projects/[id]/budget/route.ts:14-22` (`checkBudgetAccess`, collapses to 401). Both get replaced by the service-layer assert.
- `lib/export/{excel,ppt,word}.ts` are **already service-shaped**: plain args in, `Buffer` out, import repositories, never touch `next/server`. Signatures `generateProjectPlan(projectId)`, `generateKickoffPPT(projectId, extras)`, `generateWordDoc(projectId, docType, docId?)`. None take `companyId` — that is the entire SVC-06 delta. `lib/export/ppt.ts:96` throws an untyped `Error('Project not found')` that becomes `NotFoundError`. **No test files exist in `lib/export/`.**
- `app/api/projects/[id]/project-report/route.ts:184` calls `companyRagConfig(project.company_id)` — reads company off the *project row*, not the session. That inversion is the bug pattern the service layer fixes.
- Report route line splits: `portfolio/report` 649 total (GET 33-531 = 499 logic, POST 532-649), `project-report` 395 (GET 262), `report` 240 (GET 90). Roughly 77%/66%/37% is GET-side logic that moves.

</code_context>

<specifics>
## Specific Ideas

- The unified access assert must distinguish three outcomes, not two: missing session → 401, project not found → 404, wrong company → 403. The existing `checkAccess` in `app/api/projects/[id]/route.ts` already does this correctly and is the reference.
- `app/api/export/excel/[id]/route.ts` is 20 lines and calls `generateProjectPlan(Number(id))` with no session and no company. Any caller holding a project id gets the whole plan. This is the single clearest demonstration of why SVC-06 is in scope.
- Preserve the Phase 3 freeze precisely: services must not catch-and-rewrap `IntegrationError`. Any plan that introduces a `try/catch` around a client call needs to re-throw.

</specifics>

<deferred>
## Deferred Ideas

- **Reconciling the RAG divergence** — `app/api/portfolio/route.ts`'s inline thresholds vs `lib/rag.ts:calculateRAG`. Extraction will surface whether they agree. If they disagree, that is a behavior change needing its own HYG-02 commit, not a silent fix folded into this refactor.
- **Route-level auth wrapper** (`lib/http/with-auth.ts`, `withProjectAccess`) — Phase 5 by roadmap dependency order.
- **Shadow-mode enforcement rollout and the 403-storm avoidance** — Phase 6.
- **Whether `proxy.ts` executes in the deployed Docker runtime** (ROUTE-11) — open question carried in STATE.md, resolved in Phase 6. Do not build service-layer enforcement assuming proxy.ts works.

</deferred>
