<!-- refreshed: 2026-08-25 -->
# Architecture

**Analysis Date:** 2026-08-25

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 client pages)                                        │
│  `app/**/page.tsx` + `components/**`                                    │
├──────────────────┬──────────────────┬───────────────────────────────────┤
│  Portfolio UI    │  Project UI      │  Admin / Auth / Ops UI            │
│  `app/page.tsx`  │  `app/projects/` │  `app/login` `admin` `operations` │
│  `portfolio/*`   │  `[id]/*`        │  `landing`                        │
└────────┬─────────┴────────┬─────────┴──────────────┬────────────────────┘
         │ fetch('/api/...')│                          │
         ▼                  ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Edge gate: `proxy.ts`                                                  │
│  Session cookie check · request-id stamp · API access logging           │
├─────────────────────────────────────────────────────────────────────────┤
│  HTTP wrappers: `lib/http/with-auth.ts`                                 │
│  `withProjectAccess` · `withProgramAccess`                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Route handlers: `app/api/**/route.ts`                                  │
│  Zod boundary validation · error mapping via `lib/api-errors.ts`        │
├─────────────────────────────────────────────────────────────────────────┤
│  Service layer: `lib/services/*.service.ts`                             │
│  Access asserts · business rules · orchestration                        │
├──────────────┬──────────────────────────────┬───────────────────────────┤
│ Repositories │ Integrations                 │ Export                    │
│ `lib/repositories/*.repo.ts`               │ `lib/integrations/*`      │
│ SQL + column allowlists                    │ Jira · Anthropic · Resend │
│                                            │ `lib/export/*`            │
└──────────────┴──────────────────────────────┴───────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (`DATABASE_URL`) via `pg` Pool in `lib/db.ts`               │
│  Schema init + migrations co-located in `lib/db.ts`                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root layout | Font, shell, toaster | `app/layout.tsx` |
| Proxy / edge gate | Cookie presence, public-path bypass, request-id, API logging | `proxy.ts` |
| HTTP wrappers | Session resolution, body parse, access assert composition, error catch tail | `lib/http/with-auth.ts`, `with-project-access.ts`, `with-program-access.ts` |
| Error mappers | Map repo/service/integration errors to HTTP responses | `lib/api-errors.ts` |
| Auth helpers | Password hash, session CRUD, request user | `lib/auth.ts` |
| Service layer | Business logic, tenant access asserts, orchestration | `lib/services/*.service.ts` |
| Access asserts | Project/program ownership checks | `lib/services/access.ts`, `lib/services/programs.service.ts` |
| Repository layer | Raw SQL, column allowlists, tenant-scoped queries | `lib/repositories/*.repo.ts` |
| Integration clients | External HTTP/SDK calls, normalized errors | `lib/integrations/jira/client.ts`, `anthropic/client.ts`, `resend/client.ts` |
| Credential resolver | Env-var-name → secret resolution | `lib/integrations/credentials.ts` |
| DB client | PG pool, `?`→`$n`, schema init, migrations, types | `lib/db.ts` |
| RAG status | SPI + risk/issue thresholds → red/amber/green | `lib/rag.ts` |
| Export engines | Word / Excel / PPT buffers | `lib/export/word.ts`, `excel.ts`, `ppt.ts` |
| Structured logging | Request correlation, `[req]`/`[err]` lines | `lib/log.ts` |
| Instrumentation | Uncaught route error hook | `instrumentation.ts` |
| Sidebar shell | Portfolio + project nav, logout, password | `components/layout/Sidebar.tsx` |
| UI primitives | shadcn/Base UI wrappers | `components/ui/*` |
| Domain API | REST-ish JSON handlers | `app/api/**/route.ts` |
| Domain pages | Client-heavy dashboards & forms | `app/**/page.tsx` |

## Pattern Overview

**Overall:** Monolithic Next.js 16 full-stack app (App Router). No separate backend service. No ORM — raw SQL through a thin `DbClient` abstraction over PostgreSQL. Multi-tenant by `company_id` on users, projects, customers (programs), and portfolio entities.

**Layered request handling (v1.0 canonical stack):**

1. **Edge** — `proxy.ts` checks `pm_session` cookie presence and stamps `x-request-id` on API requests
2. **Route wrapper** — `withAuth` / `withProjectAccess` / `withProgramAccess` resolve session, parse body, run access assert
3. **Route handler** — thin orchestration: call service, return `NextResponse.json(...)` or binary export
4. **Service** — business rules, `assertProjectAccess` / `assertProgramAccess`, call repositories
5. **Repository** — SQL only; column allowlists via `buildUpdate` in `lib/repositories/_helpers.ts`
6. **Integration client** — external HTTP; throws `IntegrationError` for route-level mapping

**Key Characteristics:**
- Route handlers = API surface; pages = `'use client'` UIs that `fetch` those APIs
- Cookie session (`pm_session`, httpOnly, 7d) — not JWT
- Programs domain name in UI maps to DB table `customers`
- Company-scoped Jira credentials: DB stores env var *names*, values live in process env
- Schema lives in app boot path (`getDb()`), not external migration tool
- Services and repositories must not import `next/server` — HTTP mapping lives in `lib/api-errors.ts` and route wrappers
- Large UI pages decomposed into co-located `_components/` folders and `use*Page.ts` / `use*Actions.ts` hooks

## Layers

**Presentation (pages + components):**
- Purpose: Interactive PM UI (portfolio, project sub-apps, ops, admin)
- Location: `app/`, `components/`
- Contains: Client components, local state, charts (`recharts`), import dialogs, decomposed subcomponents
- Depends on: `/api/*` JSON, `@/components/ui`, `@/lib/utils`
- Used by: Browser only

**Edge gate (`proxy.ts`):**
- Purpose: First-line session check for all non-static requests; API request logging and correlation
- Location: `proxy.ts` (root)
- Contains: Public path allowlist, redirect to `/login`, request-id header injection
- Depends on: `@/lib/log`
- Used by: Next.js middleware matcher before pages and API routes

**HTTP wrappers (`lib/http/`):**
- Purpose: Deduplicate session resolution, body parsing, access assert composition, and unified error catch tails across route handlers
- Location: `lib/http/with-auth.ts`, `with-project-access.ts`, `with-program-access.ts`
- Contains: `withAuth` (session + JSON parse + error mapping), `withProjectAccess` (composes `assertProjectAccess`), `withProgramAccess` (composes `assertProgramAccess`)
- Depends on: `@/lib/auth`, `@/lib/api-errors`, `@/lib/services/access`, `@/lib/services/programs.service`
- Used by: Project-scoped routes, program routes, config/import/export routes that adopted the wrapper model

**API (route handlers):**
- Purpose: Authz boundary, CRUD, exports, Jira proxy, AI report generation
- Location: `app/api/`
- Contains: `GET`/`POST`/`PUT`/`PATCH`/`DELETE` exports per `route.ts`; co-located `schema.ts` for Zod shapes on some routes
- Depends on: HTTP wrappers or manual `getSessionFromRequest`, services, integration clients, export generators
- Used by: Pages and export download links

**Service layer (`lib/services/`):**
- Purpose: Business rules, tenant access asserts, orchestration across repositories
- Location: `lib/services/*.service.ts` (18 modules)
- Contains: CRUD functions taking `AccessActor`, typed errors (`ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`)
- Depends on: `@/lib/repositories/*`, `./access`, `./errors`
- Used by: Route handlers; export generators (`lib/export/*`) for access-checked reads

**Repository layer (`lib/repositories/`):**
- Purpose: SQL persistence with explicit column allowlists and tenant-scoped list queries
- Location: `lib/repositories/*.repo.ts` (23 modules), shared helpers in `_helpers.ts`
- Contains: `get`/`all`/`run` via `getDb()`, `PROJECT_COLUMNS`-style allowlists, `buildUpdate` guard
- Depends on: `@/lib/db` only (no `next/server`)
- Used by: Services; `lib/integrations/credentials.ts` (jira-config, settings repos only)

**Integration layer (`lib/integrations/`):**
- Purpose: External service HTTP/SDK calls with normalized error taxonomy
- Location: `lib/integrations/jira/`, `anthropic/`, `resend/`, `credentials.ts`, `errors.ts`
- Contains: Client functions, Zod response schemas, `IntegrationError`, `withFetchTimeout`
- Depends on: `@anthropic-ai/sdk` (Anthropic), `fetch` (Jira/Resend), credential resolver
- Used by: API routes and services that call AI/email/Jira; routes map errors via `integrationErrorResponse`

**Export layer (`lib/export/`):**
- Purpose: Server-side Office document generation
- Location: `lib/export/word.ts`, `excel.ts`, `ppt.ts`
- Contains: Load project graph from DB via services/repos → library buffer
- Depends on: `docx`, `exceljs`, `pptxgenjs`, services for access-checked reads
- Used by: `app/api/export/**/route.ts`

**Domain / shared libs (cross-cutting):**
- Purpose: Auth, persistence bootstrap, RAG math, logging, utilities
- Location: `lib/auth.ts`, `lib/db.ts`, `lib/rag.ts`, `lib/status-weights.ts`, `lib/utils.ts`, `lib/log.ts`, `lib/api-errors.ts`
- Depends on: `pg`, Node `crypto`, platform stdout
- Used by: All layers above

**Data:**
- Purpose: PostgreSQL multi-tenant store
- Location: external; DDL in `lib/db.ts` (`initPostgresSchema`, `migratePostgresSchema`)
- Depends on: `DATABASE_URL`
- Used by: All authenticated APIs via repositories

## Data Flow

### Primary request path (wrapped project-scoped API)

1. Browser `fetch('/api/projects/42/...')` with cookies → `proxy.ts` checks `pm_session`, stamps `x-request-id`, logs `[req]` line (`proxy.ts:6-36`)
2. Route exports handler wrapped by `withProjectAccess` (`lib/http/with-project-access.ts:30-56`)
3. `withAuth` resolves session via `getSessionFromRequest` → 401 if missing (`lib/http/with-auth.ts:94-95`)
4. Derives `actor: { company_id, is_admin }` from session (`lib/http/with-auth.ts:98`)
5. `assertProjectAccess(params.id, actor)` runs in wrapper try block (`lib/services/access.ts:25-48`)
6. Handler calls service function, e.g. `getProject(params.id, actor)` (`lib/services/projects.service.ts:42-47`)
7. Service re-asserts access (defense in depth), calls repository SQL (`lib/repositories/projects.repo.ts`)
8. `getDb()` returns singleton `PostgresClient` → `get`/`all`/`run` (`lib/db.ts`)
9. Success → `NextResponse.json(...)`; typed errors caught by wrapper → `serviceErrorResponse` / `repoErrorResponse` (`lib/api-errors.ts`)

Example canonical route:

```ts
// app/api/projects/[id]/route.ts
export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await getProject(params.id, actor)),
);
```

### Primary request path (legacy manual-session route)

Some routes (portfolio, admin, operations, Jira search) still call `getSessionFromRequest` directly and construct `actor` inline, then call services or repositories. New routes should prefer the wrapper model.

Example: `app/api/projects/route.ts` — manual session + `listProjects(actor)` service call.

### Login flow

1. `POST /api/auth/login` (`app/api/auth/login/route.ts`)
2. `verifyPassword` + `createSession` → set `pm_session` cookie (`lib/auth.ts`)
3. Client navigates to app; subsequent proxy passes

### Program-scoped access

1. Route uses `withProgramAccess` (`lib/http/with-program-access.ts`)
2. Wrapper calls `assertProgramAccess` in `lib/services/programs.service.ts:21-40`
3. Program ownership is single `company_id` on `customers` row (not dual project/customer columns)

### Export download

1. Browser `GET /api/export/excel/[id]` (or word/ppt/weekly-report/resource-plan)
2. Route wrapped with `withProjectAccess` → calls `generateProjectPlan(id, actor)` in `lib/export/excel.ts`
3. Binary `NextResponse` with attachment headers (`app/api/export/excel/[id]/route.ts`)

### Jira integration

1. Route resolves session company → `resolveJiraCredentials(companyId)` (`lib/integrations/credentials.ts:19-30`)
2. DB row in `company_jira_config` holds env key names; secrets from `process.env`
3. `searchIssues(creds, params)` in `lib/integrations/jira/client.ts` → Basic-auth to Jira REST
4. Route catch → `integrationErrorResponse(err)` preserves upstream status semantics (`lib/api-errors.ts:69-103`)

### AI report generation

1. Portfolio/project report routes resolve Anthropic credentials via `resolveAnthropicCredentials()`
2. Service aggregates data (`lib/services/portfolio-report.service.ts`, `project-report.service.ts`)
3. Route calls `createMessage` from `lib/integrations/anthropic/client.ts`
4. `IntegrationError` mapped via `integrationErrorResponse` with frozen 500/502 split per route

### Project create side effects

1. `POST /api/projects` → `createProject(actor, body)` service (`lib/services/projects.service.ts:37-40`)
2. Repository inserts `projects` with resolved company, seeds default `meetings` and `escalation_levels` (`lib/repositories/projects.repo.ts:99-127`)

### Access shadow mode (operational)

When `ACCESS_ENFORCEMENT=shadow`, `ForbiddenError`/`NotFoundError` from access asserts are logged as `[ACCESS-SHADOW]` and the handler proceeds anyway (`lib/http/with-auth.ts:35-62`, `135-138`). Never defaults on — absent env value means enforcing mode.

**State Management:**
- No Redux/React Query — per-page `useState` + `useEffect` fetch, or custom hooks (`useTimelinePage.ts`, `usePortfolioReport.ts`)
- Server session state in `sessions` table
- Module singleton `_client` in `lib/db.ts` for pool lifecycle

## Key Abstractions

**DbClient:**
- Purpose: SQLite-ish API (`get`/`all`/`run`/`exec`) over Postgres
- Examples: `lib/db.ts` (`PostgresClient`)
- Pattern: Convert `?` placeholders; `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`; `RETURNING id` on insert

**AccessActor:**
- Purpose: Tenant identity stripped from session for service/repository calls
- Examples: `lib/services/access.ts:5-8`, `lib/http/with-auth.ts:10-13`
- Pattern: `{ company_id: number | null, is_admin: number | boolean }` — never pass full session into repos

**assertProjectAccess / assertProgramAccess:**
- Purpose: Throw-on-deny ownership checks; return authorized row on success
- Examples: `lib/services/access.ts:25-48`, `lib/services/programs.service.ts:21-40`
- Pattern: Admin bypass still fetches row; missing resource → `NotFoundError`; wrong tenant → `ForbiddenError`

**HTTP wrappers (withAuth family):**
- Purpose: Standard route handler envelope
- Examples: `lib/http/with-auth.ts`, `with-project-access.ts`, `with-program-access.ts`
- Pattern: Compose outward — `withProjectAccess` wraps `withAuth`; handler receives `{ user, actor, params, body, project? }`

**Service errors (HTTP-free):**
- Purpose: Typed business failures without framework coupling
- Examples: `lib/services/errors.ts` — `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`
- Pattern: Services throw; `serviceErrorResponse` in `lib/api-errors.ts` maps to 403/404/400/409

**UnknownColumnError:**
- Purpose: Reject PATCH keys outside repository allowlist
- Examples: `lib/repositories/_helpers.ts:10-48`, used by `updateProject` and peers
- Pattern: `buildUpdate(table, ALLOWLIST, fields)` → route catch maps via `repoErrorResponse` → 400 with column names

**IntegrationError:**
- Purpose: Normalized external service failure
- Examples: `lib/integrations/errors.ts`, thrown by Jira/Anthropic/Resend clients
- Pattern: Services re-throw untouched; routes call `integrationErrorResponse` — never map in service layer

**SessionUser:**
- Purpose: Full request identity for multi-tenant filters
- Examples: `lib/auth.ts:23-31`
- Pattern: Cookie id → DB join `sessions` + `users` + `companies`

**RAG / calculateRAG:**
- Purpose: Portfolio health color from SPI, deadlines, open risks/issues
- Examples: `lib/rag.ts`, company overrides in `company_rag_config`
- Pattern: Pure function + per-company thresholds

**Program ≡ customer:**
- Purpose: Portfolio grouping entity
- Examples: table `customers`; routes `app/api/programs/*`; UI `/programs`
- Pattern: Keep dual naming; SQL uses `customers` / `customer_id`

**Export generators:**
- Purpose: Build Office docs server-side with access-checked reads
- Examples: `lib/export/word.ts`, `excel.ts`, `ppt.ts`
- Pattern: Accept `AccessActor`, assert access internally or rely on route wrapper

**UI decomposition hooks:**
- Purpose: Split large client pages into testable units
- Examples: `app/projects/[id]/timeline/useTimelinePage.ts`, `app/portfolio/roadmap/useRoadmapPage.ts`, `app/projects/[id]/milestones/_components/`
- Pattern: Page imports hook for state/fetch + `_components/` for render; actions in separate `use*Actions.ts`

## Entry Points

**Next.js app:**
- Location: `app/layout.tsx`, `app/page.tsx` (portfolio home)
- Triggers: `next dev` / `next start` (standalone Docker)
- Responsibilities: Render tree, global styles `app/globals.css`

**Proxy:**
- Location: `proxy.ts` (matcher excludes static assets)
- Triggers: Every non-static request
- Responsibilities: Cookie presence check (not DB session expiry — API re-checks), request-id stamp, API access logging

**Instrumentation:**
- Location: `instrumentation.ts`
- Triggers: Uncaught server errors in route handlers
- Responsibilities: Log `[err]` with request-id, route path, and stack trace

**API auth:**
- Location: `app/api/auth/login|logout|me|change-password|complete-onboarding/route.ts`
- Triggers: Login UI, Sidebar

**Health:**
- Location: `app/api/health/route.ts`
- Triggers: K8s/Railway probes

**DB bootstrap:**
- Location: `getDb()` in `lib/db.ts`
- Triggers: First DB use per process
- Responsibilities: Pool, schema, migrations, completion backfill, seed users if empty

## Architectural Constraints

- **Threading:** Node single-threaded event loop; PG pool for concurrency. No worker threads.
- **Global state:** `_client` singleton in `lib/db.ts`; do not create second pools.
- **Import direction:** Routes → services → repositories. Integrations called from routes/services. Never import `app/` from `lib/`.
- **Framework isolation:** `lib/services/` and `lib/repositories/` must not import `next/server`. HTTP mapping lives in `lib/api-errors.ts` and `lib/http/*`.
- **Multi-tenancy:** Non-admin queries must filter by `company_id` (or program's company). Admin sees all. Project access also checks `customer_company_id`.
- **Params:** Dynamic route `params` are `Promise<...>` (Next 16) — wrappers handle `await rawCtx.params`.
- **Standalone:** `next.config.ts` `output: 'standalone'`; `serverExternalPackages: ['exceljs','pptxgenjs']`.
- **Path alias:** `@/*` → repo root (`tsconfig.json`).
- **Credential storage:** Jira config stores env var names in DB; secrets only in deployment env. Anthropic: env then DB settings fallback. Resend: env only.

## Anti-Patterns

### Skip wrapper or session check on new API route

**What happens:** Handler uses `getDb()` or calls repository directly without session or access assert.
**Why it's wrong:** Cross-tenant data leak; bypasses unified error mapping.
**Do this instead:** Use `withProjectAccess` / `withProgramAccess` / `withAuth` for new routes. Mirror `app/api/projects/[id]/route.ts`.

### Put SQL or business rules in route handlers

**What happens:** Route builds SQL, filters by company inline, or duplicates access logic.
**Why it's wrong:** Untestable duplication; inconsistent tenant enforcement.
**Do this instead:** Route calls service; service calls repository. Access in `lib/services/access.ts`.

### Import `next/server` in service or repository modules

**What happens:** Service returns `NextResponse` or repo imports response helpers.
**Why it's wrong:** Breaks layer isolation; prevents unit testing without Next runtime.
**Do this instead:** Throw typed errors; map in `lib/api-errors.ts` at route/wrapper boundary.

### PATCH with unguarded column keys

**What happens:** Route passes raw body keys directly into `UPDATE` SQL.
**Why it's wrong:** Client could set `company_id` or other tenancy columns.
**Do this instead:** Repository uses `buildUpdate` with explicit `*_COLUMNS` allowlist (`lib/repositories/_helpers.ts`).

### Catch IntegrationError in service layer

**What happens:** Service swallows or remaps Jira/Anthropic failures.
**Why it's wrong:** Breaks frozen status-code contracts per route.
**Do this instead:** Let `IntegrationError` propagate; route catch calls `integrationErrorResponse`.

### Put business SQL only in huge page components

**What happens:** Logic lives only in 1000-line `page.tsx` with inline fetch.
**Why it's wrong:** Unreusable; hard to test; duplicates filters.
**Do this instead:** Persistence in service/repo; UI in page + `_components/` + hooks.

### New tables without `migratePostgresSchema`

**What happens:** Only add to `initPostgresSchema`.
**Why it's wrong:** Existing DBs never get columns/tables.
**Do this instead:** Add both `CREATE TABLE IF NOT EXISTS` / `ALTER ... IF NOT EXISTS` migration entries in `lib/db.ts`.

## Error Handling

**Strategy:** Layered error taxonomy with centralized mappers at the HTTP boundary.

**Patterns:**
- **Repository:** `UnknownColumnError` → `repoErrorResponse` → 400 with column list (`lib/api-errors.ts:21-27`)
- **Service:** `ForbiddenError` → 403, `NotFoundError` → 404, `ValidationError` → 400, `ConflictError` → 409 via `serviceErrorResponse` (`lib/api-errors.ts:41-59`)
- **Integration:** `IntegrationError` → `integrationErrorResponse` with service-specific status preservation (`lib/api-errors.ts:69-146`)
- **Wrapper catch tail:** `withAuth` catches handler throws and routes to appropriate mapper (`lib/http/with-auth.ts:126-140`)
- **Uncaught:** `instrumentation.ts` `onRequestError` logs with request-id
- **Malformed JSON:** Wrapper returns 400 `{ error: 'Invalid JSON' }` on POST/PUT/PATCH
- **Missing session:** 401 JSON (API) or redirect to `/login` (proxy for pages)
- **Client:** `sonner` toasts on failed fetch (Sidebar, forms)

## Cross-Cutting Concerns

**Logging:** Structured stdout via `lib/log.ts` — `[req]` on API ingress (proxy), `[err]` on failures, `[ACCESS-SHADOW]` in shadow mode. No request/response bodies logged (credential leak risk).
**Validation:** Zod schemas at route boundary via wrapper `opts.schema`; co-located `schema.ts` on some routes. Repository allowlists for write columns.
**Authentication:** Cookie session + scrypt password hashes (`lib/auth.ts`).
**Authorization:** Three-tier — proxy cookie gate, wrapper access asserts, service-level re-assert (defense in depth).
**Theming:** Tailwind 4 + slate base; Geist font in root layout.
**Testing:** Vitest with node + jsdom projects (`vitest.config.ts`); co-located `*.test.ts` / `*.component.test.tsx`.

---

*Architecture analysis: 2026-08-25*
