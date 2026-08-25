# Phase 4: Service Layer - Research

**Researched:** 2026-08-10
**Domain:** Service-layer extraction over the existing repository/integration layers (Next.js 16 App Router, TypeScript strict, Vitest)
**Confidence:** HIGH (route inventory is exhaustive — all 85 `route.ts` files read this session; behavior-freeze risks are per-file established)

## Summary

Phase 4 moves business logic and tenant-ownership checks out of `app/api/**/route.ts` into `lib/services/*.service.ts` modules. `lib/services/` is greenfield. The repositories (Phase 2) and integration clients (Phase 3) already take plain, resolved arguments and throw typed errors; the service layer is the missing middle that (a) adds the SVC-04 ownership assert at every project-scoped entry point and (b) becomes the single place business logic lives so the Phase 5 route wrapper can thin handlers to parse → authorize → call service → respond.

All 85 routes were read this session. 27 are project-scoped (take a project id, act on that project's child rows); 22 of those have **no session check at all** — a caller holding any project id reads/mutates that project's data. The 5 export/import routes are the worst: they return full project documents with no session and no company scoping. Every project-scoped service must begin with `assertProjectAccess(projectId, user)` (SVC-04), which wraps `projectAccessRow` from `lib/repositories/projects.repo.ts:36`.

The route-layer auth wrapper is Phase 5 — this phase does **not** add a route-level `withAuth`/`withProjectAccess`. The service assert landing here is the service-layer half of defense in depth. Sessions are resolved in the route today (`getSessionFromRequest`) and stay there; services receive plain `(projectId, companyId, isAdmin, ...)` arguments.

**Primary recommendation:** Build substrate first (errors + assert + one reference service) before touching any route. Then fix the 6 unauthenticated export/import leaks, then the 5 orchestration-heavy routes, then the thin resource sweep. Each slice lands with its unit tests. Total: 4-5 plans, first two strictly serial, last two parallelizable.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ownership assert (SVC-04) | Service layer | Route (Phase 5) | Services receive plain args and throw `ForbiddenError`; route wrapper adds 401 gate in Phase 5 — deliberate defense in depth |
| Business logic / aggregation | Service layer | — | `portfolio/report` GET (499 lines) and `project-report` GET (262 lines) move nearly wholesale |
| Export/import data fetch scoping (SVC-06) | Service layer (`lib/export/*`) | — | `lib/export/*` already service-shaped; needs only a `companyId` + assert |
| Session resolution (401) | Route layer | — | `getSessionFromRequest(req)` stays in routes; services never see a `NextRequest` |
| HTTP status mapping | `lib/api-errors.ts` | — | `serviceErrorResponse(e)` maps `ForbiddenError→403`, `NotFoundError→404`, `ValidationError→400`, else 500 |
| SQL | Repository layer | — | Services call repos, never `getDb()` (REPO-01/02) |

## Standard Stack

### Core

No new dependencies. The phase is pure TypeScript restructuring over already-installed packages.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 4.1.10 | Unit tests for every service | Already the test runner; `vi.hoisted` + `vi.mock` idiom established in Phase 2 |
| `pg` | ^8.20.0 | Real-DB gated tests (SVC-05) | `test/repo-db.ts` `testDb()` adapter already exists |
| Next.js | 16.2.4 | Route handlers stay the HTTP boundary | No `next/server` import may enter `lib/services/` (SVC-02) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk` | ^0.92.0 | POST handlers on report routes | Only when a service wraps a client call — `IntegrationError` re-thrown untouched |
| `exceljs` / `pptxgenjs` / `docx` | ^4.4.0 / ^4.0.1 / ^9.6.1 | Export engines | Only in `lib/export/*`, already externalized via `serverExternalPackages` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `lib/services/errors.ts` | Reuse `IntegrationError` | **Rejected by CONTEXT** — `IntegrationError` carries `status?: number` (SVC-03 forbids HTTP status on service errors) |
| DI / constructor-injected repos | `vi.mock` at module boundary | Rejected — the codebase idiom is `vi.hoisted` + `vi.mock`, no DI anywhere |
| Fold `portfolio-report.service.ts` into `portfolio.service.ts` | Separate file | **Rejected by CONTEXT** — 499-line GET gets its own module |

**Version verification:** versions read from `package.json` this session. No package installs planned.

## Package Legitimacy Audit

No external packages are installed in this phase. The only artifacts are new `lib/services/*.service.ts` files, one new `lib/services/errors.ts`, additions to `lib/api-errors.ts`, edits to `lib/export/*`, and edits to `app/api/**/route.ts`. Package-legitimacy gate: N/A.

## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Service Granularity & Scope** — Every project-scoped and company-scoped resource gets a service, including thin pass-through routes; the service is where the SVC-04 assert lives. System-level routes (health, auth/me) exempt. One service per resource, 1:1 with repositories (`risks.service.ts` ↔ `risks.repo.ts`). `portfolio/report` GET gets its own `portfolio-report.service.ts`. The report routes' POST handlers (~50 lines prompt template + `createMessage(creds, ...)`) stay in the route — already factored, moving is churn.
2. **Ownership & Access Semantics** — Unify cross-company denials on 403; 401 reserved for missing/invalid session. This changes `app/api/projects/[id]/budget/route.ts` (HYG-02 behavior change). The ownership assert lives in the service (SVC-04). `is_admin` bypass preserved exactly. The 5 unauthenticated export/import routes are fixed this phase (SVC-06).
3. **Typed Errors & Mapping** — Three classes in new `lib/services/errors.ts`, mirroring `lib/integrations/errors.ts` structure; copy `UnknownColumnError` shape from `lib/repositories/_helpers.ts` — bare `extends Error`, sets `this.name`, structured payload, **no HTTP status**. `IntegrationError` NOT a base. Routes map via new `serviceErrorResponse(e)` in `lib/api-errors.ts`: `ForbiddenError`→403, `NotFoundError`→404, `ValidationError`→400, else 500. `IntegrationError` escaping a service is re-thrown untouched. `ValidationError` distinct from `UnknownColumnError`.
4. **Testing & Rollout** — Default tier `*.service.unit.test.ts` with `vi.mock`'d repositories, no DB, always runs. SVC-05 additionally gets real-DB gated tests (`seedProject(name, {company_id})` already exists). Plan slicing substrate-first: (1) errors + assert + one reference service, (2) unauthenticated export/import leaks, (3) orchestration-heavy routes, (4) thin resource sweep. Each slice lands with its tests (HYG-03). `app/api/portfolio/route.ts` RAG divergence extracted as-is, preserved, recorded — not silently reconciled.

### Claude's Discretion

All four grey areas accepted at the recommended answer — no open discretion items.

### Deferred Ideas (OUT OF SCOPE)

RAG divergence reconciliation (portfolio/route.ts vs lib/rag.ts — extraction surfaces it; if they disagree that is a separate HYG-02 commit). Route-level auth wrapper (`lib/http/with-auth.ts`, `withProjectAccess`) — Phase 5. Shadow-mode rollout / 403-storm avoidance — Phase 6. Whether `proxy.ts` executes in deployed Docker runtime (ROUTE-11) — Phase 6; do not build service enforcement assuming proxy.ts works.

## Route → Service Inventory

This is the complete mapping. 85 `route.ts` files read this session. Groups:

- **P = Project-scoped** — needs `assertProjectAccess` in the service (SVC-04). Session check column: ✅ = currently calls `getSessionFromRequest`; ✗ = no session/company check at all (the Phase-4 leak class).
- **C = Company-scoped** — repo functions take `companyId`; service passes the session's company through.
- **A = Admin-only** — admin gate stays in route or moves to an admin service.
- **S = System/exempt** — no service (CONTEXT: health, auth/me exempt).

### Project-scoped (27 routes)

| Route | Methods | Session? | Target Service | Notes |
|-------|---------|----------|----------------|-------|
| `projects/[id]` | GET/PATCH/DELETE | ✅ (checkAccess) | `projects.service.ts` | Reference 3-way access helper lives here (replaced) |
| `projects/[id]/activities` | GET/POST/PUT/DELETE | ✗ | `activities.service.ts` | PUT uses repo's `(projectId, rowId, fields)` signature |
| `projects/[id]/activities/import` | POST/GET | ✗ | `activities.service.ts` | Batch import loop; errors array `{inserted, updated, errors}` shape must survive |
| `projects/[id]/budget` | GET/POST | ✅ (checkBudgetAccess, collapses to 401) | `budget.service.ts` | GET has real aggregation (expenses-by-item map); POST validates CAPEX/OPEX; **403 fix here** |
| `projects/[id]/budget/[itemId]` | PUT/DELETE | ✅ (authorize, collapses to 401) | `budget.service.ts` | Duplicate private `authorize` helper |
| `projects/[id]/budget/[itemId]/expenses` | GET/POST | ✅ (authorize) | `budget.service.ts` | `getBudgetItemInProject` → 404 path |
| `projects/[id]/budget/[itemId]/expenses/[expId]` | DELETE | ✅ (authorize) | `budget.service.ts` | |
| `projects/[id]/bugs` | GET/POST/DELETE | ✗ | `bugs.service.ts` | `list_dates=1` branch, snapshot replace |
| `projects/[id]/documents` | GET/POST/PUT/DELETE | ✗ | `documents.service.ts` | status_report diary-create vs upsert branch; `findDocumentInProject` 404s |
| `projects/[id]/escalations` | GET/PUT | ✗ | `escalations.service.ts` | |
| `projects/[id]/holidays` | GET/POST/DELETE | ✗ | `holidays.service.ts` | 409 duplicate-date guard is real logic |
| `projects/[id]/issues` | GET/POST/PUT/DELETE | ✗ | `issues.service.ts` | |
| `projects/[id]/meetings` | GET/POST/PUT/DELETE | ✗ | `meetings.service.ts` | |
| `projects/[id]/milestones` | GET/POST | ✗ | `milestones.service.ts` | |
| `projects/[id]/milestones/[milestoneId]` | PUT/DELETE | ✗ | `milestones.service.ts` | |
| `projects/[id]/milestones/[milestoneId]/epics` | GET/POST/DELETE | ✗ | `milestones.service.ts` | POST swallows duplicate-link error → 201; preserve |
| `projects/[id]/project-report` | GET | ✗ | `project-report.service.ts` | 262 lines GET logic; **also reads `companyRagConfig(project.company_id)` — the inversion bug pattern** (reads company off project row, not session) |
| `projects/[id]/project-report/generate-email` | POST | ✅ | — (stays in route) | POST handler stays in route per CONTEXT |
| `projects/[id]/report` | GET | ✗ | `report.service.ts` | 90 lines GET logic; local STATUS_WEIGHTS copy |
| `projects/[id]/risks` | GET/POST/PUT/DELETE | ✗ | `risks.service.ts` | |
| `projects/[id]/team` | GET/POST/PUT/DELETE | ✗ | `team.service.ts` | |
| `export/excel/[id]` | GET | ✗ | `lib/export/excel.ts` + `export.service.ts` | **Worst leak** — no session, returns full project plan |
| `export/ppt/[id]` | POST | ✗ | `lib/export/ppt.ts` | `Error('Project not found')` → `NotFoundError` |
| `export/word/[id]/[type]` | GET | ✗ | `lib/export/word.ts` | docId query param |
| `export/weekly-report/[id]` | POST | ✗ | `weekly-report.service.ts` | Report data comes from body (not repo); needs a lightweight assert only — the body is the payload. Route is 253 lines of ExcelJS. **Lowest-leverage extraction; see open questions** |
| `export/resource-plan/[id]` | GET | ✗ | `resource-plan.service.ts` | Inline ExcelJS in route + `getProject` + `listForExport` |
| `import/resource-plan/[id]` | POST | ✗ | `resource-plan.service.ts` | Excel parse → `{members, monthColumns}`; file parsing is not business logic — see open questions |

### Company-scoped (27 routes)

Session check on every one: ✅ (all call `getSessionFromRequest`; `programs/[id]` and `config`/`import-mapping`/`jql-presets`/`sync-mappings`/`parse-file-headers`/`bug-import-mapping`/`demo-requests` do not — see system/exempt).

| Route | Methods | Target Service | Notes |
|-------|---------|----------------|-------|
| `projects` | GET/POST | `projects.service.ts` | POST: admin body-company vs user-session-company; `listProjects` 3-branch null-company logic lives in repo |
| `portfolio` | GET | `portfolio.service.ts` | 99 lines; **inline RAG thresholds diverge from `lib/rag.ts:calculateRAG` — extract as-is, record divergence** |
| `portfolio/budgets` | GET/POST | `portfolio.service.ts` | |
| `portfolio/budgets/[id]` | GET/PUT/DELETE | `portfolio.service.ts` | GET aggregates allocations + category warnings (loop `spendByCategory`) |
| `portfolio/budgets/[id]/allocations` | GET/POST | `portfolio.service.ts` | |
| `portfolio/budgets/[id]/allocations/[allocId]` | PUT/DELETE | `portfolio.service.ts` | |
| `portfolio/budgets/[id]/categories` | GET/POST | `portfolio.service.ts` | |
| `portfolio/budgets/[id]/categories/[catId]` | PUT/DELETE | `portfolio.service.ts` | |
| `portfolio/bug-assignees` | GET | `portfolio.service.ts` | |
| `portfolio/members` | GET/POST | `portfolio.service.ts` | |
| `portfolio/members/[id]` | PUT/DELETE | `portfolio.service.ts` | |
| `portfolio/milestones` | GET | `portfolio.service.ts` | |
| `portfolio/program-allocations` | GET/POST | `portfolio.service.ts` | POST returns `String(e)` 500 today — service throw + mapper improves this; flag HYG-02 |
| `portfolio/program-allocations/[id]` | PUT/DELETE | `portfolio.service.ts` | |
| `portfolio/quota` | GET/PUT | `portfolio.service.ts` | |
| `portfolio/roadmap` | GET | `roadmap.service.ts` | 85 lines; **second copy of inline RAG thresholds** |
| `portfolio/roadmap/epics` | GET | `roadmap.service.ts` | Takes `project_id` from query param → **project-scoped in practice; needs assert** |
| `portfolio/report` | GET | `portfolio-report.service.ts` | 499 lines GET — the big move |
| `portfolio/report` | POST | — (stays in route) | Prompt template + `createMessage` |
| `portfolio/report/generate-email` | POST | — (stays in route) | Prompt template + `createMessage` |
| `portfolio/report/send-email` | POST | — (stays in route) | `sendEmail(creds, ...)` |
| `programs` | GET/POST | `programs.service.ts` | |
| `programs/[id]/project-allocations` | GET/POST | `programs.service.ts` | POST cross-checks project access? **Flag: `upsertProgramProjectAllocation(programId, projectId, ...)` has NO ownership check on the project being allocated — check in plan** |
| `operations/systems` | GET/POST | `operations.service.ts` | |
| `operations/systems/[id]` | GET/PUT/DELETE | `operations.service.ts` | GET: system exists check + 3 child lists |
| `operations/systems/[id]/budget-items` | GET/POST | `operations.service.ts` | |
| `operations/systems/[id]/budget-items/[itemId]` | PUT/DELETE | `operations.service.ts` | |
| `operations/systems/[id]/expenses` | GET/POST | `operations.service.ts` | |
| `operations/systems/[id]/expenses/[expId]` | DELETE | `operations.service.ts` | |
| `operations/systems/[id]/incidents` | GET/POST | `operations.service.ts` | |
| `operations/systems/[id]/incidents/[incId]` | PUT/DELETE | `operations.service.ts` | |
| `export/portfolio/members` | GET | `portfolio.service.ts` or stays in route | ExcelJS render with session; company-scoped data fetch via repo already |

### Admin-only (6 routes)

| Route | Target Service | Notes |
|-------|----------------|-------|
| `admin/companies` | `admin.service.ts` | `requireAdmin` local helper duplicated in 4 files — candidate for a shared service gate |
| `admin/users` | `admin.service.ts` | `hashPassword` called in route today — moves into service |
| `admin/jira-config/[companyId]` | `admin.service.ts` | |
| `admin/rag-config/[companyId]` | `admin.service.ts` | |
| `admin/demo-requests` | `admin.service.ts` | |
| `admin/resource-audit` | `admin.service.ts` | Only **session** check (401), no admin gate today — resource-audit + POST add-missing are company-scoped actions mislabeled admin |

### System / Exempt (no service per CONTEXT)

| Route | Reason |
|-------|--------|
| `auth/login`, `auth/logout`, `auth/me`, `auth/change-password`, `auth/complete-onboarding` | Auth subsystem; CONTEXT exempts auth/me; the rest are session plumbing, not tenant-scoped resources |
| `health` | Probe |
| `config` | Global settings, no tenant scope; **has NO session check** — masking logic is real but it is config, not a resource |
| `demo-requests` | Public lead-capture, no session by design |
| `bug-import-mapping`, `bug-import-mapping/[id]`, `import-mapping`, `import-mapping/[id]`, `jira/jql-presets`, `jira/jql-presets/[id]`, `jira/sync-mappings` | Global template/config tables, **no session check today**; CONTEXT's "every project-scoped and company-scoped resource" does not reach these. Flag: decide in discuss/plan whether they need a service or are exempt like `config` |
| `jira/search`, `jira/fields`, `jira/test` | Credential/config plumbing (Phase 3 rewired); `search`/`fields` have session+company gates already, `test` has `resolveCfg` |
| `parse-file-headers` | File parsing util, **no session check** |

### Session-check census

- Project-scoped routes with a session check: `projects/[id]`, `projects/[id]/budget` + 3 child budget routes (6 total).
- Project-scoped routes with **no session check** (21): activities, activities/import, bugs, documents, escalations, holidays, issues, meetings, milestones, milestones/[milestoneId], milestones/[milestoneId]/epics, project-report, report, risks, team, export/excel, export/ppt, export/word, export/weekly-report, export/resource-plan, import/resource-plan.
- Note: the scout's "22 project-scoped routes with no session check" counts `programs/[id]` (no session) in the same bucket. `programs/[id]` is company-scoped but has **no session check** — `getProgram`, `updateProgram`, `deleteProgram` by raw id, any caller. This is an additional leak in the same class and must be in scope for the assert sweep.

## The `assertProjectAccess` Contract

### Exact semantics to preserve (from `app/api/projects/[id]/route.ts:8-18`, the reference)

```typescript
const user = await getSessionFromRequest(req);
if (!user) return 401;                       // missing session — ROUTE's job in Phase 4 (services never see a request)
if (user.is_admin) return allowed;           // admin bypass preserved exactly — admin sees all companies
const project = await projectAccessRow(projectId);
if (!project) return 404;                    // project does not exist → NotFoundError
const allowed = project.company_id === user.company_id
            || project.customer_company_id === user.company_id;   // dual ownership OR-branch
if (!allowed) return 403;                    // wrong company → ForbiddenError (the 403 unification)
```

### The divergence being unified (HYG-02 behavior change)

`app/api/projects/[id]/budget/route.ts:14-22` (`checkBudgetAccess`) collapses missing-session, no-project, and wrong-company all to `null`, and the caller (`route.ts:27`) returns **401** for all three. CONTEXT locks: missing session → 401 (route gate), project not found → **404**, wrong company → **403**. The same flattening bug is copied into the private `authorize` helper in `budget/[itemId]`, `budget/[itemId]/expenses`, and `budget/[itemId]/expenses/[expId]`.

### Null-company case — do NOT reopen the CR-01 hole

Phase 2's CR-01 (`02-REVIEW-FIX.md:25`) fixed null-company query paths so a null-company user only sees projects where both `p.company_id IS NULL` **and** (`p.customer_id IS NULL OR c.company_id IS NULL`). For the access assert, the rule is:

- A user with `company_id === null` and `is_admin === 0` must be **denied** any project whose `company_id` or `customer_company_id` is non-null (the comparison `null === non-null` is already false — the OR-branch handles this correctly).
- A null-company user should only ever match a project where `project.company_id === null` **and** `project.customer_company_id === null`. The assert must NOT treat `null === null` as "owned" in a way that bypasses the customer check — replicate the list-query predicate shape from `listProjects` (`projects.repo.ts:73-76`): project and customer ownership must both be unassigned.
- `projectAccessRow` returns `undefined` when the project does not exist → that maps to `NotFoundError` (404), and it must be checked **before** the ownership comparison so a cross-company project id cannot be distinguished from a nonexistent one (404 vs 403 information leak — the reference `checkAccess` already orders it this way).

### Signature (services take plain args, so):

```typescript
// lib/services/access.ts (or inside errors.ts per planner choice)
export type ServiceUser = { company_id: number | null; is_admin: number };  // minimal shape — services need no more

export async function assertProjectAccess(
  projectId: number | string,
  user: ServiceUser,
): Promise<void> {
  if (user.is_admin) return;                                   // admin bypass — unchanged
  const row = await projectAccessRow(projectId);
  if (!row) throw new NotFoundError(`Project ${projectId} not found`);
  const owned = row.company_id === user.company_id
             || row.customer_company_id === user.company_id;
  if (!owned) throw new ForbiddenError(`No access to project ${projectId}`);
  // null-company user: row.company_id and row.customer_company_id are both null for
  // unassigned projects — comparison succeeds only in that case; CR-01 shape preserved.
}
```

**Who resolves the session:** the route. Every Phase-4 handler that needs the assert already has (or gains) a `getSessionFromRequest(req)` call, passes `{ company_id: user.company_id, is_admin: user.is_admin }` (or the full `SessionUser`) into the service. The route keeps the 401 gate; the service throws `ForbiddenError`/`NotFoundError`; the route's `serviceErrorResponse` maps them. For the 21 currently-unprotected project routes, the route gains the session call in this phase (that is the minimal delta — no `withAuth` wrapper, that is Phase 5).

**Where it lives:** one shared helper (`lib/services/access.ts` or exported from `lib/services/errors.ts` — planner's call, PATTERNS suggests `access.ts`). Every project-scoped service function calls it first. The two file-private helpers (`checkAccess`, `checkBudgetAccess`, and the three `authorize` copies) are deleted.

## Behavior-Freeze Risk Inventory

Per-route, what silently changes if logic moves. **Mitigation convention: HYG-01 pure moves committed separately; HYG-02 every behavior change called out in the commit message.**

| Route | Frozen behavior that must survive extraction | Risk if mishandled |
|-------|----------------------------------------------|--------------------|
| `portfolio/report` GET | Full JSON shape (all 18 top-level keys incl. `milestoneInfo`, `periodStart/End`, `reportDate`); milestone-mode filtering rules; `portfolioMilestoneSelection` scoping (CR-03); FTE math incl. the overhead-remaining heuristic (`explicit > 0 ? explicit : max(0, 1 − inProject)`); `fteStats: null` when `company_id` null; RAG via `calculateRAG` with company config | Highest: 499 lines, any reordering or `??`-vs-`||` change alters numbers |
| `portfolio/route.ts` GET | **Inline RAG thresholds** (`open_risks >= 3` red, `<= 14` days amber, `completion_pct < 30` amber, `current_phase !== 'Closing'` guard) — **do NOT reconcile with `lib/rag.ts`** (extract as-is, record divergence, separate HYG-02 if reconciled later); `{projects, programs, noProgramProjects, phaseDist, programBar, kpi}` shape; `days_until_deadline` computed from `end_date + 'T23:59:59'` | Divergence is known; a silent "fix" changes RAG colors on the portfolio page |
| `portfolio/roadmap` GET | **Second inline RAG copy**, same thresholds; `ROADMAP_DONE_STATUSES` list; `PHASE_ORDER` sort | Same as above |
| `projects/[id]/budget` GET | `completion_pct: Math.round(stats?.avg_pct ?? 0)`; expenses grouped into `expByItem` map; items keep `...i, expenses: [...]` spread order | Shape drift breaks budget page |
| `projects/[id]/budget` POST + child routes | `Name is required` / `Invalid type` (CAPEX/OPEX) 400 strings; **401→403 status change** (HYG-02, deliberate); `Budget item not found` 404 | Status-code change is the sanctioned one; error strings must stay |
| `projects/[id]/activities/import` POST | `{inserted, updated, errors}` response; insert-then-child ordering; per-row `catch` collecting error keys; `GET` returns `listJiraKeys` | Reordering parents after children breaks `parent_id` resolution |
| `projects/[id]/documents` POST | `status_report` always creates new row; other types upsert; `created` returns 201, upsert update returns 200 | Diary-style semantics lost if folded into generic create |
| `projects/[id]/holidays` POST | Duplicate-date → 409 `date already exists` | 409 is a distinct status; mapper must not collapse to 400 |
| `projects/[id]/milestones/[milestoneId]/epics` POST | Duplicate link error swallowed → always 201 `{ok:true}` | The catch-and-ignore is the contract |
| `projects/[id]/project-report` GET | `companyRagConfig(project.company_id)` — company read off the **project row**, not session. This is the inversion bug pattern. Moving to service: decide whether it becomes session-company (behavior change, HYG-02) or stays project-company (keeps freeze but keeps the bug). **Flag for planner** | Legit different-company users on a shared project would get different RAG configs vs session — today they get the project's config |
| `projects/[id]/report` GET | Local `STATUS_WEIGHTS` copy + `DONE_STATUSES`/`IN_PROGRESS_STATUSES` derived lists; week bounds from `week` param or current Monday; `completion_pct` weighted math | Duplicated status weights already exist in `lib/status-weights.ts` — **do not silently switch** (weights are identical today; a switch is still a HYG-02 candidate) |
| `projects/[id]/report` POST + `project-report` POST | `force500: true` on `integrationErrorResponse`; `NO_API_KEY` 503; `Invalid JSON` 400 (WR-05); prompt text byte-for-byte | Any reordering of prompt lines changes AI output |
| `portfolio/report` POST / `generate-email` / `send-email` | Same: `createMessage`/`sendEmail` wrapped, `IntegrationError` re-thrown untouched, `force500` split preserved | Catching-and-rewrapping `IntegrationError` breaks the Phase-3 freeze |
| `export/excel` / `ppt` / `word` / `resource-plan` / `weekly-report` | `Error('Project not found')` currently → `String(e)` 500 in route. Becomes `NotFoundError` → **404** (HYG-02, sanctioned). 404 body text changes from `"Project not found"` to mapper's `e.message` | Status change is deliberate; ensure download links treat non-200 uniformly (they do — `!res.ok` → toast) |
| `portfolio/program-allocations` POST | `console.error` + `{ error: String(e) }` 500 today → service throw + `serviceErrorResponse` 500 with different text | Error text change on the 500 path — flag HYG-02, low impact |
| `programs/[id]` | **No session check**; GET returns `{program, projects}`; PUT/DELETE by raw id. Adding the company assert changes 401/403 for previously-open endpoints | Sanctioned security change |
| `admin/*` | `requireAdmin` duplicated 4×; `Cannot delete yourself` 400 on `admin/users` DELETE; `Company name already exists` 409; `Username already exists` 409 | Consolidation must keep 409s distinct |
| `operations/*` | `findOperationsSystem` exists-check → 404 (`Not found`), matching the route's current behavior; `listOperations*` child queries are system-scoped | The system-company check (`findOperationsSystem(id, company_id, is_admin)`) is the ownership gate — do not replace with `assertProjectAccess` (systems are company-owned, not project-owned) |
| `portfolio/roadmap/epics` | `project_id` query param; no session; no company scoping on `roadmapEpicRows(projectId)` | Adding the assert here is a security fix (sanctioned) — but the route currently serves any project's epics, so the 403 will be new |

## Where the New 403s Will Bite

Every page that calls these routes passes the **current project id from the URL** (`useParams`), so a legitimate owner is unaffected. The bite risk is concentrated in cross-company / admin-shared flows:

**Low risk — direct URL-scoped pages (verified):**
- `app/projects/[id]/page.tsx:127` → `/api/export/excel/${id}` — page is reached only from the project list, which is already company-scoped. Owner passes.
- `app/projects/[id]/documents/page.tsx:700,726` → export/word, export/ppt — same.
- `app/projects/[id]/reports/page.tsx:430` → export/weekly-report — same.
- `app/projects/[id]/resources/page.tsx:295` → export/resource-plan — same.
- `app/projects/[id]/dashboard/page.tsx:266-271` → `/api/projects/${id}`, activities, team, risks, issues, budget — all owner-scoped. Note `budget` is already checked today.
- Milestones page fetches `/api/projects/${id}/milestones/.../epics` — owner-scoped.

**Real bite risk — must be checked in the plan:**

1. **`programs/[id]` (no session check today).** `app/programs/page.tsx` fetches `/api/programs/${program.id}/project-allocations` for each program row (`:100,249`) and DELETEs `/api/programs/${c.id}` (`:302`). Program rows come from `/api/programs` (already company-scoped), so a legitimate user passes — **but** the programs page shows programs from the company-scoped list; if any page surfaces a program id that isn't in the user's company, the new 403 breaks it. Admin users see all programs and pass via bypass. **Verify `app/programs/page.tsx` only lists user-scoped programs** — it does (fetches `/api/programs`), so low risk, but the assert must be added deliberately.

2. **`portfolio/roadmap/epics?project_id=X`** — the roadmap page fetches epics for `selectedMilestone.project_id` (`page.tsx:215,227`), where the milestone list comes from `/api/portfolio/milestones` (company-scoped). Owner passes. Low risk.

3. **`operations/systems/[id]`** — system list is company-scoped (`listOperationsSystems`), and `findOperationsSystem(id, company_id, is_admin)` already gates every child route. Adding a **service-layer** assert on systems must NOT use `assertProjectAccess` (systems are company-owned). The existing 404 on wrong-company already applies. No new 403 for operations — keep 404.

4. **`admin/resource-audit`** — called from `app/admin/page.tsx`; only session-gated today, no admin check. If this phase adds an admin gate, a non-admin calling it would flip from 200→403. `admin/page.tsx` is reached via `app/admin` layout — **check whether non-admins can navigate there**; if the page is admin-only by navigation, the new 403 only bites direct API calls (desired).

5. **`config` route (no session check)** — `app/portfolio/report/page.tsx:1583,1631,1639` calls `/api/config` to read/mask the API key and to save `ceo_email` / `anthropic_api_key`. No session today. **Adding a session check here would 401 a flow that currently works** — but CONTEXT lists config as exempt from services; do not add auth to config in this phase.

**Net:** all UI callers resolve project ids from company-scoped lists, so the 22 new asserts produce 403s only for direct API abuse — no legitimate-owner break identified. The one flow to watch is `admin/resource-audit` (admin gate addition) and any page that shares a project id across companies (none found — the app has no cross-company project-sharing UI today).

## Next.js 16 Specifics

Verified from `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and the codebase:

- **`params` are `Promise`** — every handler does `const { id } = await params` today; service extraction keeps the handler signature `{ params }: { params: Promise<{...}> }` unchanged.
- **Route Handlers are the HTTP boundary** — services must not import `next/server` (SVC-02). The existing layer discipline is documented in `lib/api-errors.ts:12-13`; `lib/services/` gets the same rule.
- **GET handlers are not cached by default** — no `force-static`/`force-dynamic` config exists in any route; extraction must not add route segment config.
- **No layouts/`page.tsx` at the same segment** — the `app/api/**/route.ts` files are standalone; a service extraction touches only handler bodies, never the route file's exports.
- **Error propagation** — handlers must keep their `try/catch`. Next 16 does not provide automatic error mapping for route handlers; `serviceErrorResponse(e)` is a plain function returning `NextResponse`, called inside the existing `catch`.
- **`RouteContext` helper exists** (`ctx.params`) but the codebase uses the `{ params }` destructure form — keep the codebase's form.
- **Nothing about module boundaries changed for `lib/` non-route modules** — a plain `lib/services/*.service.ts` is regular Node/TS code, bundled by Next's server compiler, no special handling.

## Sequencing and Blast Radius

CONTEXT locks substrate-first slicing. Given the inventory, this is **4-5 plans**:

```
P4-01  Substrate (SERIAL — no other plan can start)
       lib/services/errors.ts (3 classes)
       lib/services/access.ts (assertProjectAccess)  [+ unit tests]
       serviceErrorResponse in lib/api-errors.ts  [+ unit tests]
       ONE reference service end-to-end: risks.service.ts, rewire app/api/projects/[id]/risks/route.ts
         (also adds the missing session call + assert, proving the whole pattern)
       Deletes checkAccess / checkBudgetAccess / the 3 authorize copies? NO — delete at the end of the
         sweep; P4-01 replaces them only for the reference route.
       Gate: grep no next/server in lib/services/, reference service unit tests green.

P4-02  The 6 unauthenticated export/import leaks (SERIAL after P4-01)
       lib/export/{excel,ppt,word}.ts gain companyId + NotFoundError/assert
       new export.service.ts / resource-plan.service.ts / weekly-report.service.ts
       routes gain session + assert; unit tests incl. cross-company 403 per service (SVC-06/SVC-07)
       Gate: cross-company access-denied case present in every export service test.

P4-03  Orchestration-heavy routes (can PARALLEL internally after P4-02)
       portfolio-report.service.ts (the 499-line GET)
       project-report.service.ts (262-line GET) + report.service.ts (90-line GET)
       portfolio.service.ts + roadmap.service.ts (the two inline-RAG routes, extracted as-is)
       SVC-05 real-DB gated tests land here (cross-company fixture)
       Gate: cross-company fixture test proves portfolio/roadmap/budget/report aggregates exclude
         company B rows.

P4-04  Thin resource sweep (PARALLEL with P4-03, must finish after P4-01)
       ~15 services 1:1 with repos: activities (incl. import), bugs, documents, escalations, holidays,
         issues, meetings, milestones, team, budget (+3 children, unifying the 401-collapse),
         operations, programs (incl. the missing session on programs/[id] + project-allocations),
         projects (list/create/[id])
       Each: extract logic, add assert, unit tests. Deletes the remaining local access helpers.
       Gate: grep no route under app/api/projects/[id]/** imports repos directly without a service.

P4-05  Admin + company-scope finishing (can fold into P4-04)
       admin.service.ts (requireAdmin consolidation), portfolio budgets/members/quota/program-allocations,
         export/portfolio/members
       OR split if P4-04 grows — 5 plans total.
```

**Serialization rules:**
- P4-01 MUST be first and alone (everything depends on errors + assert + the mapper).
- P4-02 MUST follow P4-01 (needs the assert; it is the security-critical slice).
- P4-03 and P4-04 are independent once P4-01/P4-02 land — run as parallel waves (config `parallelization: true`).
- P4-05 folds into P4-04 or runs as its own final wave; it touches no project-scoped route, so it cannot conflict with P4-04's route edits.

**Blast radius per plan:** each plan edits a disjoint set of route files (P4-02: 6 export/import files; P4-03: 5 big route files; P4-04: ~30 small route files). The one shared file is `lib/api-errors.ts` (P4-01 only) and `lib/services/access.ts` (P4-01). `lib/export/*` is touched by P4-02 only. No plan edits another plan's files → the parallel waves are safe.

## Common Pitfalls

### Pitfall 1: Catching-and-rewrapping `IntegrationError` in a service
**What goes wrong:** A service wraps `createMessage`/`sendEmail`/`searchIssues` and maps failures to `ForbiddenError`/`ValidationError`, erasing the `kind`/`service`/`status` fields.
**Why:** CONTEXT locks re-throw-untouched — the Phase-3 freeze (force500 split, Jira upstream-status passthrough, validation-escapes-force500) depends on the original `IntegrationError` reaching `integrationErrorResponse`.
**Avoid:** Services that call integration clients either let the error propagate (no catch) or `catch (e) { if (e instanceof IntegrationError) throw e; ... }`.
**Warning sign:** A `try/catch` around a client call that constructs a new error.

### Pitfall 2: Reopening the null-company hole in the assert
**What goes wrong:** `assertProjectAccess(null-company-user, unassigned-project)` returns allowed when only the project's `company_id` is null but the customer is tenant-owned.
**Why:** `null === null` is true; if the assert checks only `row.company_id === user.company_id`, a null-company user "owns" every customer-less project.
**Avoid:** Check `row.customer_company_id === user.company_id` in the same OR, matching the CR-01 predicate shape (`p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)`).
**Warning sign:** The assert has a single equality instead of the dual-ownership comparison.

### Pitfall 3: "Fixing" the two inline RAG copies
**What goes wrong:** `portfolio/route.ts` and `portfolio/roadmap/route.ts` have inline thresholds; a well-meaning extraction swaps in `calculateRAG` and changes portfolio colors.
**Why:** The milestone says behavior freeze except sanctioned security fixes.
**Avoid:** Extract as-is. Record the divergence in the summary. Reconcile in a separate HYG-02 commit if the discuss-phase wants it.
**Warning sign:** The extracted service calls `calculateRAG` where the route called inline math.

### Pitfall 4: `programs/[id]` and the operations child routes get the wrong gate
**What goes wrong:** `programs/[id]` has no session check (leak) — but operations systems are company-owned, not project-owned; applying `assertProjectAccess` to a system id breaks operations.
**Avoid:** `assertProjectAccess` for projects only. Operations keeps `findOperationsSystem(id, company_id, is_admin)` as its gate (404 today — do not change to 403 without a HYG-02 note). Programs need a company-scope assert via `getProgram(id)` + `company_id` comparison.
**Warning sign:** A service for operations routes calls `projectAccessRow`.

### Pitfall 5: Losing the diary/upsert split or the duplicate-link swallow
**What goes wrong:** `documents` POST status_report diary-create; `milestones/[milestoneId]/epics` POST swallow-error-201; `holidays` 409; `activities/import` parent-first ordering. All are distinct contracts that a naive "move the CRUD" extraction flattens.
**Avoid:** Extract function-per-handler with the exact branch structure; keep status codes (409, 201-vs-200) intact.
**Warning sign:** The service has a single `createX` where the route had a conditional.

### Pitfall 6: Changing error-text/status on the sanctioned-fix routes without a HYG-02 commit
**What goes wrong:** Export routes flip `Error('Project not found')` → 404 and budget routes flip 401→403; these are deliberate (CONTEXT). If they land in the same commit as a pure move, a regression can't be bisected.
**Avoid:** HYG-01 pure moves and HYG-02 behavior changes in separate commits, every time.
**Warning sign:** One commit that both moves logic and changes a status.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typed service errors | A new error hierarchy | `lib/services/errors.ts` (3 classes, `UnknownColumnError` shape) | The codebase already has the exact pattern in `_helpers.ts` |
| Error → HTTP mapping | Per-route `if (e instanceof ...)` chains | `serviceErrorResponse(e)` in `lib/api-errors.ts` | Third sibling of `repoErrorResponse`/`integrationErrorResponse`; one place |
| Ownership check | A per-route access helper | `assertProjectAccess` in `lib/services/access.ts` | The two existing helpers + 3 `authorize` copies are the bug — one shared assert |
| Mocked-unit testing | A DI container / factory | `vi.hoisted` + `vi.mock('@/lib/repositories/...')` | The established idiom (auth.repo.unit.test.ts); zero new machinery |
| Real-DB scoping proof | Inspection / manual SQL review | `*.service.repo.test.ts` with `describe.skipIf(!hasTestDb)` + `seedProject(name, {company_id})` | SVC-05 literally requires "proven with a cross-company fixture" |
| Report aggregation math | Re-deriving weighted progress | `lib/status-weights.ts` (`statusWeight`, `weightedProgress`, `DONE_STATUSES`) | Already the single source of truth; report routes carry stale copies |

**Key insight:** This phase installs no packages and builds no new machinery. Every building block — error shape, mapper, assert primitive, mock idiom, real-DB fixture — already exists in the codebase; the phase's job is to move code behind those blocks and delete the duplicates.

## Runtime State Inventory

N/A — greenfield service layer; no rename/refactor/migration of stored state. The phase creates files and moves code; nothing database-backed or OS-registered changes identity.

## Validation Architecture

> Required by the Nyquist gate. `workflow.nyquist_validation: true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (two projects: node + jsdom, `vitest.config.ts`) |
| Config file | `vitest.config.ts` — node project includes `{lib,app}/**/*.test.ts` |
| Quick run command | `npx vitest run --project node lib/services/` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SVC-01 | Every API resource has a `lib/services/*.service.ts` module; route handlers call services, not repos | unit + grep | `grep -rL next/server lib/services/`; route-level repo-import grep | ❌ Wave 0 |
| SVC-02 | No service imports `next/server` / touches `NextRequest`/`NextResponse` | static grep (CI) | `grep -rn "next/server" lib/services/` must be empty | ❌ Wave 0 |
| SVC-03 | `ForbiddenError`/`NotFoundError`/`ValidationError` carry no HTTP status | unit | `lib/services/errors.unit.test.ts` asserts `!('status' in err)` and `instanceof Error`, `err.name` set | ❌ Wave 0 |
| SVC-04 | Every project-scoped service asserts company ownership before read/mutate | unit | `*.service.unit.test.ts` per service: happy path + cross-company `ForbiddenError` + missing project `NotFoundError` | ❌ Wave 0 |
| SVC-05 | Portfolio/roadmap/budget-rollup/report aggregates scope by company | **real-DB gated** | `portfolio.service.repo.test.ts`, `project-report.service.repo.test.ts` etc. with `describe.skipIf(!hasTestDb)` | ❌ Wave 0 |
| SVC-06 | Export services (Excel/PPT/Word) scope data fetch by company | unit | `lib/export/*.unit.test.ts` — mock repos, assert `projectAccessRow` called / wrong company → `ForbiddenError` | ❌ Wave 0 (no test files exist in `lib/export/`) |
| SVC-07 | Each service has unit tests with mocked repos + explicit cross-company denied case | unit | one `*.service.unit.test.ts` per service, each containing ≥1 cross-company `ForbiddenError` assertion | ❌ Wave 0 |

### The SVC-05 cross-company fixture (concrete shape)

Uses the existing helpers in `test/repo-db.ts` (`seedCompany`, `seedProject(name, {company_id})`, `testDb`, `setupRepoTables`) and the `test/db.ts` `hasTestDb` gate — no new harness:

```typescript
// lib/services/portfolio.service.repo.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedCompany, seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

describe.skipIf(!hasTestDb)('portfolio.service — SVC-05 company scoping', () => {
  let companyA: number; let companyB: number;
  beforeAll(async () => {
    await setupRepoTables();
    companyA = await seedCompany('Service A');
    companyB = await seedCompany('Service B');
    // company A: one direct project + one customer-owned project (dual-ownership OR-branch)
    await seedProject('A direct',    { company_id: companyA, customer_id: null });
    // company B: a project that must never leak into A's aggregates
    await seedProject('B project',   { company_id: companyB });
    await seedProject('A unassigned', { company_id: null, customer_id: null });
  });
  afterAll(async () => { const { closeTestPool } = await import('../../test/db'); await closeTestPool(); });

  it('portfolio aggregate for company A excludes company B projects', async () => {
    const { listPortfolioProjects } = await import('./portfolio.service');
    const rows = await listPortfolioProjects(companyA, false) as { name: string }[];
    expect(rows.map(r => r.name)).toContain('A direct');
    expect(rows.map(r => r.name)).not.toContain('B project');
  });

  it('budget rollup and report aggregates exclude company B rows', async () => {
    // same seed, drive each aggregate function, assert every returned row's company is A
  });

  it('assertProjectAccess denies company B on a company A project', async () => {
    const { assertProjectAccess } = await import('./access');
    const { ForbiddenError } = await import('./errors');
    const aProject = (await testDb().get<{id:number}>('SELECT id FROM projects WHERE name=?', 'A direct'))!.id;
    await expect(assertProjectAccess(aProject, { company_id: companyB, is_admin: 0 }))
      .rejects.toThrow(ForbiddenError);
    await expect(assertProjectAccess(aProject, { company_id: companyA, is_admin: 0 })).resolves.toBeUndefined();
    await expect(assertProjectAccess(aProject, { company_id: companyB, is_admin: 1 })).resolves.toBeUndefined(); // admin bypass
  });
});
```

The fixture pattern is exactly `lib/repositories/portfolio.repo.test.ts:9-32` (two seeded companies, project in each, assert non-admin exclusion + admin inclusion), extended to the service layer and to the four SVC-05 aggregate families (portfolio list, roadmap, budget rollup, project report).

### Sampling Rate

- **Per task commit:** `npx vitest run --project node lib/services/`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green + `grep -rn "next/server" lib/services/` empty + no route under `app/api/projects/[id]/**` importing a repository directly — before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `lib/services/errors.unit.test.ts` — SVC-03 (no-status + name assertions)
- [ ] `lib/services/access.unit.test.ts` — SVC-04 (admin bypass, dual-ownership, 404, null-company, 403)
- [ ] `lib/api-errors.test.ts` extension — `serviceErrorResponse` mapping (403/404/400/500 + fallback logging)
- [ ] One reference `lib/services/risks.service.unit.test.ts` — lands in P4-01
- [ ] `lib/export/excel.unit.test.ts`, `ppt.unit.test.ts`, `word.unit.test.ts` — SVC-06 (none exist today)
- [ ] `lib/services/portfolio.service.repo.test.ts`, `roadmap.service.repo.test.ts`, `project-report.service.repo.test.ts` — SVC-05 cross-company fixtures

## Security Domain

> `security_enforcement: true` in `.planning/config.json` (absent would be enabled; it is explicitly true).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (Phase 5/6 adds route gate; Phase 4 only adds session resolution where missing) | `getSessionFromRequest` stays in routes |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | `assertProjectAccess` (SVC-04) on every project-scoped service; `is_admin` bypass preserved; company-scope params on all portfolio/operations/programs services |
| V5 Input Validation | yes | Route body validation stays in routes; `ValidationError` for business-rule violations; `UnknownColumnError` for column allowlists (unchanged, Phase 2) |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR / cross-tenant read via project id (the 22 unprotected routes) | Information Disclosure / Elevation | `assertProjectAccess` at every project-scoped service entry; 403 on wrong company, 404 on nonexistent |
| Unauthenticated document exfiltration via export routes (worst live leak) | Information Disclosure | Session + company assert in `lib/export/*` (SVC-06) — the export route that had no session now 401s without one, 403s cross-company |
| Null-company tenant confusion (CR-01) | Elevation | Assert preserves the dual-ownership null-safe predicate; test locks it |
| Error-text / status oracle | Information Disclosure | `serviceErrorResponse` 404-vs-403 ordering matches the reference (project-missing checked before ownership) |
| `programs/[id]` raw-id mutation (no session today) | Elevation | Program-scope assert added in P4-04 |

## Sources

### Primary (HIGH confidence — read this session)
- All 85 route files under `app/api/` (exhaustive inventory)
- `lib/repositories/projects.repo.ts` (`projectAccessRow`, `listProjects` null-company branches)
- `lib/repositories/portfolio.repo.ts` (`reportCompanyScope`, `idScope`, aggregate signatures)
- `lib/repositories/programs.repo.ts`, `operations.repo.ts`, `activities.repo.ts`, `team.repo.ts`
- `lib/export/excel.ts`, `ppt.ts`, `word.ts` (signatures, untyped `Error('Project not found')`)
- `lib/api-errors.ts` (`repoErrorResponse`, `integrationErrorResponse`)
- `lib/repositories/_helpers.ts` (`UnknownColumnError` shape)
- `lib/auth.ts` (`SessionUser`, `getSessionFromRequest`)
- `lib/rag.ts`, `lib/status-weights.ts`
- `test/repo-db.ts` (`setupRepoTables`, `seedCompany`, `seedProject`, `testDb`), `test/db.ts` (`hasTestDb`)
- `lib/repositories/auth.repo.unit.test.ts` (mock idiom), `projects.repo.test.ts` + `portfolio.repo.test.ts` (real-DB gated idiom)
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (Next 16 params/route-handler contract)
- `.planning/phases/02-repository-layer/02-REVIEW-FIX.md` (CR-01 null-company fix)
- Client pages under `app/` (fetch-call verification for 403-bite analysis)

### Secondary (MEDIUM confidence)
- 04-CONTEXT.md decisions (locked, treated as authoritative for this phase)

### Tertiary (LOW confidence)
- None — every factual claim in this research is from a file read this session or a locked CONTEXT decision.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All UI callers of the newly-gated project routes resolve the project id from company-scoped lists, so no legitimate owner hits a new 403 | 403-bite analysis | If some page hardcodes or shares a cross-company project id, a legit user gets 403 — plan should add one UI smoke check per affected page |
| A2 | The inline RAG thresholds in `portfolio/route.ts` and `portfolio/roadmap/route.ts` are intentional divergences worth preserving as-is | Behavior-freeze | If the divergence is actually a bug, extracting as-is locks it in; the separate HYG-02 reconciliation is the sanctioned path |
| A3 | The report routes' duplicated `STATUS_WEIGHTS` copies are identical to `lib/status-weights.ts` today | Behavior-freeze | They are byte-identical to `lib/status-weights.ts` per this session's read; if the plan silently switches, the HYG-02 note covers it |
| A4 | `programs/[id]` GET/PUT/DELETE with no session is a leak worth fixing in this phase | Inventory | CONTEXT's exempt list (health, auth/me) does not include programs; the assert sweep must include it or explicitly defer |
| A5 | `export/weekly-report/[id]` and `import/resource-plan/[id]` (ExcelJS-heavy, body/file-driven) are better extracted as thin wrappers than full services | Inventory | The report body is the payload, not repo data — a full service adds a file with no security gain; flag for planner confirmation |
| A6 | `config`, `jql-presets`, `sync-mappings`, `import-mapping`, `bug-import-mapping`, `parse-file-headers` are exempt from services per CONTEXT's "project-scoped and company-scoped" scope | Inventory | If the planner reads CONTEXT more broadly, 7 more services appear — the plan should state the exemption explicitly |

## Open Questions

1. **`project-report` GET RAG config source.** Route reads `companyRagConfig(project.company_id)`. Does the service use the session company (behavior change: a shared-project user gets their own company's thresholds) or keep project-company (freeze preserved, bug kept)? Recommendation: keep project-company to honor the freeze; note the inversion as a HYG-02 candidate for the discuss-phase.
2. **`export/weekly-report/[id]` scope.** The POST body *is* the report data; the route only needs a project-ownership assert, not a data-fetch service. Is a 20-line service worth it, or does the route call `assertProjectAccess` directly? Recommendation: direct assert in route — the assert is the SVC-04 requirement; a service with no logic is ceremony.
3. **`import/resource-plan/[id]` parsing.** File parsing is not business logic. Move the parse to a service that takes `(projectId, user, buffer)` and asserts, or keep the parse in the route with an assert? Recommendation: keep parse in route, add assert; the parse is a pure util like `parse-file-headers`.
4. **`admin/resource-audit` admin gate.** It is only session-gated today; adding an admin gate would 403 non-admin callers. Is that a sanctioned fix this phase or a Phase-6 concern? Recommendation: session-only stays; do not add an admin gate here.
5. **Where `assertProjectAccess` lives.** `lib/services/access.ts` vs exported from `lib/services/errors.ts`. PATTERNS suggests `access.ts`; either is fine — the planner picks, both keep services `next/server`-free.

## Environment Availability

Step 2.6: SKIPPED — no external dependencies beyond the already-running Next.js/Vitest/PostgreSQL toolchain. The only runtime requirement for the SVC-05 gated tests is `TEST_DATABASE_URL` (present-or-skipped, per `hasTestDb`); the default `npm test` run passes without it.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every building block verified in-repo this session
- Architecture: HIGH — exhaustive route inventory (85/85 read), service boundaries per CONTEXT
- Pitfalls: HIGH — per-file behavior-freeze risks established from direct reads
- 403-bite analysis: MEDIUM — caller-verified for the flagged pages; A1 assumption logged

**Research date:** 2026-08-10
**Valid until:** 2026-09-10 (stable domain; re-verify only if Phase 3/5 land changes that touch `lib/api-errors.ts` or add route wrappers)
