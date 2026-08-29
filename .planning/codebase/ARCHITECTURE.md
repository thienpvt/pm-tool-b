<!-- refreshed: 2026-08-29 -->
# Architecture

**Analysis Date:** 2026-08-29

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 client components in domain modules)                     │
│  Thin RSC shells: `app/**/page.tsx` → `modules/*/ui/*Page.tsx`             │
├──────────────────┬──────────────────┬───────────────────────────────────────┤
│  Portfolio UI    │  Project UI      │  Admin / Ops / Weekly / Docs UI       │
│  `modules/       │  `modules/       │  `modules/admin/ui`                   │
│   portfolio/ui`  │   projects/ui`   │  `modules/operations/ui`              │
│  `modules/       │                  │  `modules/weekly/ui`                  │
│   dashboards/ui` │                  │  `modules/documents/ui`               │
└────────┬─────────┴────────┬─────────┴──────────────┬──────────────────────┘
         │ fetch('/api/...')│                          │
         ▼                  ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Edge gate: `proxy.ts`                                                      │
│  Session cookie check · request-id stamp · API access logging               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Thin API surface: `app/api/**/route.ts`                                    │
│  Re-exports module routes OR wires handlers + HTTP wrappers                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Domain modules: `modules/<domain>/backend/`                                │
│  routes/handlers → services → repositories                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Cross-cutting: `lib/http/*` · `lib/services/access.ts` · `lib/auth.ts`     │
│  Integrations: `lib/integrations/*` · Export: `lib/export/*`                │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (`DATABASE_URL`)                                                │
│  Pool via `lib/db.ts` · Kysely via `lib/db/kysely.ts`                       │
│  Schema via versioned `migrations/*.sql` (`npm run migrate`)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root layout | Font, shell, toaster | `app/layout.tsx` |
| Page shells | RSC wrappers with `PageChrome` + module page import | `app/**/page.tsx` |
| Domain UI | Client pages, hooks, `_components/` | `modules/<domain>/ui/**` |
| Proxy / edge gate | Cookie presence, public-path bypass, request-id, API logging | `proxy.ts` |
| Thin API routes | URL mount points; re-export or wire module handlers | `app/api/**/route.ts` |
| Module route handlers | HTTP orchestration, call services, return JSON/binary | `modules/<domain>/backend/routes/**/handlers.ts` or `route.ts` |
| HTTP wrappers | Session, body parse, access/role assert, error catch tail | `lib/http/with-auth.ts`, `with-project-access.ts`, `with-program-access.ts`, `with-role.ts` |
| Error mappers | Map repo/service/integration errors to HTTP responses | `lib/api-errors.ts` |
| Auth helpers | Password hash, session CRUD, request user | `lib/auth.ts` |
| Access asserts | Project/program ownership, role checks, mutation guards | `lib/services/access.ts` |
| Domain services | Business rules, tenant asserts, orchestration | `modules/<domain>/backend/services/*.service.ts` |
| Domain repositories | SQL via Kysely (primary) or legacy `DbClient` | `modules/<domain>/backend/repositories/*.repo.ts` |
| Shared repos | Auth sessions, settings | `lib/repositories/auth.repo.ts`, `settings.repo.ts` |
| Integration clients | External HTTP/SDK calls, normalized errors | `lib/integrations/jira/client.ts`, `anthropic/client.ts`, `resend/client.ts` |
| Export engines | Word / Excel / PPT buffers | `lib/export/word.ts`, `excel.ts`, `ppt.ts` |
| DB bootstrap | Pool singleton, migration guard, seed-if-empty | `lib/db.ts`, `lib/migrate/assertMigrated.ts` |
| Kysely client | Typed query builder over shared pool | `lib/db/kysely.ts`, `lib/db/database.ts` (codegen) |
| Structured logging | Request correlation, `[req]`/`[err]` lines | `lib/log.ts` |
| Instrumentation | Uncaught route error hook | `instrumentation.ts` |
| Sidebar shell | Portfolio + project nav, logout, password | `components/layout/Sidebar.tsx` |
| UI primitives | shadcn/Base UI wrappers | `components/ui/*` |

## Pattern Overview

**Overall:** Modular monolith on Next.js 16 App Router. Ten domain modules (`admin`, `audit`, `dashboards`, `documents`, `jira`, `operations`, `portfolio`, `projects`, `reports`, `weekly`) each own backend logic and UI. The `app/` directory is a thin routing shell — URLs only, no business logic. Cross-cutting infrastructure lives in `lib/`.

**Layered request handling:**

1. **Edge** — `proxy.ts` checks `pm_session` cookie presence and stamps `x-request-id` on API requests
2. **Thin route** — `app/api/**/route.ts` re-exports from module or wires handlers with wrappers
3. **Route wrapper** — `withAuth` / `withProjectAccess` / `withProgramAccess` / `withCpmo` resolve session, parse body, run access assert
4. **Handler** — module `handlers.ts` or `route.ts`: call service, return `NextResponse.json(...)` or binary export
5. **Service** — business rules, `assertProjectAccess` / role checks, call repositories, audit logging
6. **Repository** — SQL via Kysely (`getKysely()`) with column allowlists via `pickAllowed` in `lib/repositories/_kysely-helpers.ts`
7. **Integration client** — external HTTP; throws `IntegrationError` for route-level mapping

**Key Characteristics:**
- **Module split:** Domain code colocated under `modules/<domain>/backend/` and `modules/<domain>/ui/`
- **Thin app shell:** `app/**/page.tsx` are RSC shells importing module pages; no `'use client'` in app routes
- **Dual route patterns:** (a) re-export `export { GET, POST } from '@/modules/.../route'`; (b) wire handlers `export const GET = withProjectAccess(getXHandler)`
- Cookie session (`pm_session`, httpOnly, 7d) — not JWT
- Programs domain name in UI maps to DB table `customers`
- Multi-tenant by `company_id` on users, projects, customers, portfolio entities
- Schema managed by versioned SQL migrations (`migrations/`), not boot-time DDL
- Services and repositories must not import `next/server`
- Large UI pages decomposed into co-located `_components/` folders and `use*.ts` hooks inside modules

## Layers

**Presentation — thin app shell (`app/`):**
- Purpose: URL routing only; no business logic
- Location: `app/**/page.tsx`, `app/**/loading.tsx`
- Contains: RSC wrappers that import `PageChrome` + module page component
- Depends on: `@/components/layout/PageChrome`, `@/modules/*/ui/*`
- Used by: Browser via Next.js routing

**Presentation — domain UI (`modules/*/ui/`):**
- Purpose: Interactive PM UI (portfolio, project sub-apps, ops, admin, weekly, documents)
- Location: `modules/<domain>/ui/`
- Contains: Client components (`'use client'`), local state, charts, hooks, `_components/`
- Depends on: `/api/*` JSON, `@/components/ui`, `@/lib/utils`
- Used by: Thin app page shells

**Shared UI (`components/`):**
- Purpose: Cross-route layout shell and design-system primitives
- Location: `components/layout/`, `components/ui/`, `components/brand/`, `components/onboarding/`
- Contains: `Sidebar`, `PageChrome`, shadcn/Base UI wrappers
- Depends on: `@/lib/utils`, Next navigation
- Used by: App shells and module pages

**Edge gate (`proxy.ts`):**
- Purpose: First-line session check; API request logging and correlation
- Location: `proxy.ts` (root)
- Contains: Public path allowlist, redirect to `/login`, request-id header injection
- Depends on: `@/lib/log`
- Used by: Next.js matcher before pages and API routes

**HTTP wrappers (`lib/http/`):**
- Purpose: Composable route handler envelopes
- Location: `lib/http/with-auth.ts`, `with-project-access.ts`, `with-program-access.ts`, `with-role.ts`
- Contains: Session resolution, JSON parse, Zod validation, access assert composition, unified error catch
- Depends on: `@/lib/auth`, `@/lib/api-errors`, `@/lib/services/access`
- Used by: Module route handlers and thin `app/api/` wiring

**API surface — thin routes (`app/api/`):**
- Purpose: Stable HTTP URL mount points (~123 route files)
- Location: `app/api/**/route.ts`
- Contains: Re-exports from module routes OR handler imports + wrapper wiring
- Depends on: Module backend routes, HTTP wrappers
- Used by: Pages, export download links, Sidebar fetch calls

**API logic — module routes (`modules/*/backend/routes/`):**
- Purpose: Handler implementations, Zod schemas, route tests
- Location: `modules/<domain>/backend/routes/**/`
- Contains: `handlers.ts` + `schema.ts` pattern, or self-contained `route.ts` with exports
- Depends on: Module services, HTTP wrappers, `@/lib/api-errors`
- Used by: Thin `app/api/` re-exports

**Service layer (per module):**
- Purpose: Business rules, tenant access asserts, orchestration
- Location: `modules/<domain>/backend/services/*.service.ts`
- Contains: CRUD functions taking `AccessActor`, typed errors from `@/lib/services/errors`
- Depends on: Module repositories, `@/lib/services/access`, cross-module services (e.g. audit)
- Used by: Module route handlers; export generators in `lib/export/*`

**Repository layer (per module):**
- Purpose: SQL persistence with explicit column allowlists
- Location: `modules/<domain>/backend/repositories/*.repo.ts`
- Contains: Kysely queries via `getKysely()`, `*_COLUMNS` allowlists, `pickAllowed` for PATCH
- Depends on: `@/lib/db/kysely`, `@/lib/repositories/_kysely-helpers` (no `next/server`)
- Used by: Module services

**Shared repositories (`lib/repositories/`):**
- Purpose: Cross-cutting persistence (auth sessions, app settings)
- Location: `lib/repositories/auth.repo.ts`, `settings.repo.ts`, `_helpers.ts`, `_kysely-helpers.ts`
- Contains: Column allowlist guards, `UnknownColumnError`, shared Kysely helpers
- Used by: `lib/auth.ts`, `lib/services/settings.service.ts`, module repositories

**Integration layer (`lib/integrations/`):**
- Purpose: External service HTTP/SDK calls with normalized error taxonomy
- Location: `lib/integrations/jira/`, `anthropic/`, `resend/`, `credentials.ts`, `errors.ts`
- Contains: Client functions, Zod response schemas, `IntegrationError`, `withFetchTimeout`
- Depends on: `@anthropic-ai/sdk`, native `fetch`, credential resolver
- Used by: Module services and route handlers; routes map errors via `integrationErrorResponse`

**Export layer (`lib/export/`):**
- Purpose: Server-side Office document generation
- Location: `lib/export/word.ts`, `excel.ts`, `ppt.ts`, `dashboard-portfolio.ts`, `consolidated-weekly.ts`
- Contains: Load data via services/repos → library buffer
- Depends on: `docx`, `exceljs`, `pptxgenjs`, module services
- Used by: `app/api/export/**/route.ts`, module export routes

**Domain / shared libs (cross-cutting):**
- Purpose: Auth, persistence bootstrap, RAG math, fiscal helpers, logging, utilities
- Location: `lib/auth.ts`, `lib/db.ts`, `lib/rag.ts`, `lib/fiscal/`, `lib/dashboards/`, `lib/documents/`, `lib/utils.ts`, `lib/log.ts`, `lib/api-errors.ts`
- Depends on: `pg`, Node `crypto`, platform stdout
- Used by: All layers above

**Data:**
- Purpose: PostgreSQL multi-tenant store
- Location: external; DDL in `migrations/*.sql`; domain DDL fragments in `lib/db-*.ts` (source for migration codegen)
- Depends on: `DATABASE_URL`
- Used by: All authenticated APIs via repositories

## Data Flow

### Primary request path (wrapped project-scoped API)

1. Browser `fetch('/api/projects/42/issues')` with cookies → `proxy.ts` checks `pm_session`, stamps `x-request-id`, logs `[req]` line (`proxy.ts:6-36`)
2. Thin route `app/api/projects/[id]/issues/route.ts` wires handlers with `withProjectAccess` (`app/api/projects/[id]/issues/route.ts:5-11`)
3. `withAuth` resolves session via `getSessionFromRequest` → 401 if missing (`lib/http/with-auth.ts:91-95`)
4. Derives `actor` from session via `toAccessActor(user)` (`lib/http/with-auth.ts:95`)
5. `assertProjectAccess(params.id, actor)` runs in wrapper try block (`lib/http/with-project-access.ts:43-44`)
6. Handler calls service, e.g. `listIssues(params.id, actor)` (`modules/projects/backend/routes/projects/[id]/issues/handlers.ts:11-16`)
7. Service re-asserts access, calls repository Kysely query (`modules/projects/backend/services/issues.service.ts:53-55`, `modules/projects/backend/repositories/issues.repo.ts:21-34`)
8. `getKysely()` returns typed query builder over shared pool (`lib/db/kysely.ts:8-14`)
9. Success → `NextResponse.json(...)`; typed errors caught by wrapper → `serviceErrorResponse` / `repoErrorResponse` (`lib/api-errors.ts`)

Example thin route wiring:

```ts
// app/api/projects/[id]/issues/route.ts
export const GET = withProjectAccess(getIssuesHandler);
export const POST = withProjectAccess(postIssuesHandler, { schema: issueInputSchema });
```

Example module re-export route:

```ts
// app/api/admin/users/route.ts
export { GET, POST, PUT, DELETE } from '@/modules/admin/backend/routes/admin/users/route';
```

### Primary request path (module route with manual session)

Some module routes (portfolio summary, members) still call `getSessionFromRequest` directly inside the module `route.ts`, then call services. New routes should prefer the wrapper model.

Example: `modules/portfolio/backend/routes/portfolio/route.ts` — manual session + `getPortfolioSummary(actor)`.

### Page render path (RSC shell → client module)

1. Request hits `app/projects/[id]/timeline/page.tsx` (RSC, no `'use client'`)
2. Shell awaits `params`, wraps module page in `PageChrome` with `projectId` (`app/projects/[id]/timeline/page.tsx`)
3. `TimelinePage` client component in `modules/projects/ui/timeline/TimelinePage.tsx` mounts
4. Client fetches `/api/projects/[id]/activities` on mount via custom hook `useTimelinePage.ts`

### Login flow

1. `POST /api/auth/login` (`app/api/auth/login/route.ts`)
2. `verifyPassword` + `createSession` → set `pm_session` cookie (`lib/auth.ts`)
3. Client navigates to app; subsequent proxy passes

### Program-scoped access

1. Route uses `withProgramAccess` (`lib/http/with-program-access.ts`)
2. Wrapper calls `assertProgramAccess` in `modules/portfolio/backend/services/programs.service.ts`
3. Program ownership is single `company_id` on `customers` row

### Role-scoped access (CPMO admin)

1. Route uses `withCpmo` from `lib/http/with-role.ts` (composes `withAuth` + `hasRole(actor, 'cpmo')`)
2. Example: `modules/admin/backend/routes/admin/users/route.ts`

### Export download

1. Browser `GET /api/export/excel/[id]`
2. Route wrapped with `withProjectAccess` → calls export generator in `lib/export/excel.ts`
3. Binary `NextResponse` with attachment headers

### Jira integration

1. Route resolves session company → `resolveJiraCredentials(companyId)` (`lib/integrations/credentials.ts`)
2. DB row in `company_jira_config` holds env key names; secrets from `process.env`
3. `searchIssues(creds, params)` in `lib/integrations/jira/client.ts` → Basic-auth to Jira REST
4. Route catch → `integrationErrorResponse(err)`

### AI report generation

1. Portfolio/project report routes resolve Anthropic credentials via `resolveAnthropicCredentials()`
2. Service aggregates data (`modules/reports/backend/services/portfolio-report.service.ts`, `project-report.service.ts`)
3. Route calls `createMessage` from `lib/integrations/anthropic/client.ts`

### Database migration (operator)

1. Operator runs `npm run migrate` (`scripts/migrate.ts`)
2. Applies pending `migrations/*.sql` in version order with advisory lock
3. App boot calls `assertMigrated()` in `getDb()` — fails fast if ledger empty (`lib/migrate/assertMigrated.ts`)

### Access shadow mode (operational)

When `ACCESS_ENFORCEMENT=shadow`, `ForbiddenError`/`NotFoundError` from access asserts are logged as `[ACCESS-SHADOW]` and the handler proceeds anyway (`lib/http/with-auth.ts:32-58`, `132-135`). Never defaults on.

**State Management:**
- No Redux/React Query — per-page `useState` + `useEffect` fetch, or custom hooks (`useTimelinePage.ts`, `usePortfolioReport.ts`) inside modules
- Server session state in `sessions` table
- Module singleton `_client` / `_kysely` in `lib/db.ts` / `lib/db/kysely.ts` for pool lifecycle

## Key Abstractions

**DbClient (legacy):**
- Purpose: SQLite-ish API (`get`/`all`/`run`/`exec`) over Postgres
- Examples: `lib/db.ts` (`PostgresClient`)
- Pattern: Convert `?` placeholders; used by `lib/auth.ts` and legacy code paths

**Kysely + Database types:**
- Purpose: Typed SQL query builder for repositories
- Examples: `lib/db/kysely.ts`, `lib/db/database.ts` (generated via `npm run codegen:db`)
- Pattern: `getKysely()` shares pool with `getDb()`; transaction support via `lib/db-tx.ts`

**AccessActor:**
- Purpose: Tenant identity stripped from session for service/repository calls
- Examples: `lib/services/access.ts:9-18`, `lib/http/with-auth.ts:12-20`
- Pattern: `{ company_id, is_admin, roles, status, user_id, ... }` — never pass full session into repos

**assertProjectAccess / assertProgramAccess:**
- Purpose: Throw-on-deny ownership checks; return authorized row on success
- Examples: `lib/services/access.ts:79+`, `modules/portfolio/backend/services/programs.service.ts`
- Pattern: Missing resource → `NotFoundError`; wrong tenant → `ForbiddenError`

**HTTP wrappers (withAuth family):**
- Purpose: Standard route handler envelope
- Examples: `lib/http/with-auth.ts`, `with-project-access.ts`, `with-program-access.ts`, `with-role.ts`
- Pattern: Compose outward — `withProjectAccess` wraps `withAuth`; handler receives `{ user, actor, params, body, project? }`

**Domain module:**
- Purpose: Vertical slice owning backend + UI for one business area
- Examples: `modules/projects/`, `modules/portfolio/`, `modules/weekly/`
- Pattern: `backend/{routes,services,repositories}` + `ui/{*Page.tsx,_components/,use*.ts}`

**Thin app shell:**
- Purpose: Decouple URL structure from implementation location
- Examples: `app/page.tsx` → `modules/portfolio/ui/home/PortfolioHomePage.tsx`
- Pattern: RSC page imports `PageChrome` + module default export; no `'use client'` in `app/`

**Service errors (HTTP-free):**
- Purpose: Typed business failures without framework coupling
- Examples: `lib/services/errors.ts` — `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`
- Pattern: Services throw; `serviceErrorResponse` in `lib/api-errors.ts` maps to 403/404/400/409

**Column allowlists (Kysely):**
- Purpose: Reject PATCH keys outside repository allowlist
- Examples: `ISSUE_COLUMNS` in `modules/projects/backend/repositories/issues.repo.ts:10-13`, `pickAllowed` in `lib/repositories/_kysely-helpers.ts`
- Pattern: Service passes fields → repo filters via allowlist → `UnknownColumnError` at boundary

**IntegrationError:**
- Purpose: Normalized external service failure
- Examples: `lib/integrations/errors.ts`
- Pattern: Routes call `integrationErrorResponse` — never map in service layer

**SessionUser:**
- Purpose: Full request identity for multi-tenant filters
- Examples: `lib/auth.ts:28-39`
- Pattern: Cookie id → DB join `sessions` + `users` + `companies` + `user_roles`

**Program ≡ customer:**
- Purpose: Portfolio grouping entity
- Examples: table `customers`; routes `app/api/programs/*`; UI `/programs`
- Pattern: Keep dual naming; SQL uses `customers` / `customer_id`

**Module split contract tests:**
- Purpose: Enforce thin-shell and handler-location invariants after repo-wide split
- Examples: `modules/projects/backend/projects-module-split.test.ts`, `modules/*/backend/*-module-split.test.ts`
- Pattern: Assert app pages use `PageChrome`, handlers live under module `backend/routes/`

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
- Triggers: K8s/Railway probes (`railway.json` healthcheck)

**DB bootstrap:**
- Location: `getDb()` in `lib/db.ts`
- Triggers: First DB use per process
- Responsibilities: Pool, migration guard (`assertMigrated`), seed users if empty

**Migration CLI:**
- Location: `scripts/migrate.ts`, invoked via `npm run migrate`
- Triggers: Operator/deploy pre-start
- Responsibilities: Apply `migrations/*.sql`, record in `schema_migrations` ledger

## Architectural Constraints

- **Threading:** Node single-threaded event loop; PG pool for concurrency. No worker threads.
- **Global state:** `_client` / `_pool` singleton in `lib/db.ts`; `_kysely` singleton in `lib/db/kysely.ts`. Do not create second pools.
- **Import direction:** `app/` → `modules/` → `lib/`. Integrations called from module services/routes. Never import `app/` from `lib/` or `modules/`.
- **Framework isolation:** Module `services/` and `repositories/` must not import `next/server`. HTTP mapping lives in `lib/api-errors.ts` and `lib/http/*`.
- **Multi-tenancy:** Non-admin queries must filter by `company_id`. Project access checks `company_id` / `customer_company_id` and PM assignment windows.
- **Params:** Dynamic route `params` are `Promise<...>` (Next 16) — wrappers handle `await rawCtx.params`.
- **Standalone:** `next.config.ts` `output: 'standalone'`; `serverExternalPackages: ['exceljs','jspdf','pptxgenjs']`.
- **Path alias:** `@/*` → repo root (`tsconfig.json`).
- **Schema changes:** Add new `migrations/NNNN-description.sql` — never edit applied migration files. Run `npm run migrate`.
- **Credential storage:** Jira config stores env var names in DB; secrets only in deployment env.

## Anti-Patterns

### Put business logic in `app/` pages or API routes

**What happens:** Route handler or page contains SQL, access checks, or domain rules inline.
**Why it's wrong:** Breaks module boundaries; untestable; duplicates tenant enforcement.
**Do this instead:** Keep `app/` as thin shell. Implement in `modules/<domain>/backend/` (handlers → services → repos).

### Skip wrapper or session check on new API route

**What happens:** Handler uses `getDb()` or calls repository directly without session or access assert.
**Why it's wrong:** Cross-tenant data leak; bypasses unified error mapping; fails ESLint `require-auth-wrapper` rule.
**Do this instead:** Use `withProjectAccess` / `withProgramAccess` / `withAuth` / `withCpmo`. Mirror `app/api/projects/[id]/issues/route.ts`.

### Import `next/server` in service or repository modules

**What happens:** Service returns `NextResponse` or repo imports response helpers.
**Why it's wrong:** Breaks layer isolation; prevents unit testing without Next runtime.
**Do this instead:** Throw typed errors; map in `lib/api-errors.ts` at route/wrapper boundary.

### PATCH with unguarded column keys

**What happens:** Route passes raw body keys directly into UPDATE SQL.
**Why it's wrong:** Client could set `company_id` or other tenancy columns.
**Do this instead:** Repository uses `pickAllowed` with explicit `*_COLUMNS` allowlist (`lib/repositories/_kysely-helpers.ts`).

### Catch IntegrationError in service layer

**What happens:** Service swallows or remaps Jira/Anthropic failures.
**Why it's wrong:** Breaks frozen status-code contracts per route.
**Do this instead:** Let `IntegrationError` propagate; route catch calls `integrationErrorResponse`.

### Add schema only to boot-time init

**What happens:** Developer expects `getDb()` to create tables/columns at runtime.
**Why it's wrong:** Post-cutover boot only asserts migration ledger; schema changes won't apply.
**Do this instead:** Add versioned SQL in `migrations/NNNN-*.sql` and run `npm run migrate`.

### Put feature UI in `app/` instead of module

**What happens:** Large client components and hooks live under `app/projects/[id]/`.
**Why it's wrong:** Violates module split contract; harder to test and reuse.
**Do this instead:** UI in `modules/<domain>/ui/`; app page is RSC shell with `PageChrome`.

## Error Handling

**Strategy:** Layered error taxonomy with centralized mappers at the HTTP boundary.

**Patterns:**
- **Repository:** `UnknownColumnError` → `repoErrorResponse` → 400 with column list (`lib/api-errors.ts`)
- **Service:** `ForbiddenError` → 403, `NotFoundError` → 404, `ValidationError` → 400, `ConflictError` → 409 via `serviceErrorResponse`
- **Integration:** `IntegrationError` → `integrationErrorResponse` with service-specific status preservation
- **Wrapper catch tail:** `withAuth` catches handler throws and routes to appropriate mapper (`lib/http/with-auth.ts:121-137`)
- **Uncaught:** `instrumentation.ts` `onRequestError` logs with request-id
- **Malformed JSON:** Wrapper returns 400 `{ error: 'Invalid JSON' }` on POST/PUT/PATCH
- **Missing session:** 401 JSON (API) or redirect to `/login` (proxy for pages)
- **Unmigrated DB:** `getDb()` throws runbook message — run `npm run migrate`
- **Client:** `sonner` toasts on failed fetch (Sidebar, forms)

## Cross-Cutting Concerns

**Logging:** Structured stdout via `lib/log.ts` — `[req]` on API ingress (proxy), `[err]` on failures, `[ACCESS-SHADOW]` in shadow mode. No request/response bodies logged.
**Validation:** Zod schemas at route boundary via wrapper `opts.schema`; co-located `schema.ts` in module routes. Repository allowlists for write columns.
**Authentication:** Cookie session + scrypt password hashes (`lib/auth.ts`).
**Authorization:** Four-tier — proxy cookie gate, wrapper access asserts, service-level re-assert (defense in depth), role checks via `withCpmo`/`withRole`.
**Theming:** Tailwind 4 + slate base; Geist font in root layout.
**Testing:** Vitest with node + jsdom projects (`vitest.config.ts`); co-located tests in `lib/`, `app/api/`, `modules/`, `components/`.
**Linting:** Custom ESLint rule `require-auth-wrapper` enforces wrapper usage on `app/api/**/route.ts` (`eslint/rules/require-auth-wrapper.mjs`).

---

*Architecture analysis: 2026-08-29*
