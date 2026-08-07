<!-- refreshed: 2026-08-07 -->
# Architecture

**Analysis Date:** 2026-08-07

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser (React 19 client pages)                            │
│  `app/**/page.tsx` + `components/**`                        │
├──────────────────┬──────────────────┬───────────────────────┤
│  Portfolio UI    │  Project UI      │  Admin / Auth UI      │
│  `app/page.tsx`  │  `app/projects/` │  `app/login` `admin`  │
│  `portfolio/*`   │  `[id]/*`        │  `landing`            │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │ fetch('/api/...')│                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Edge gate: `proxy.ts` (session cookie `pm_session`)         │
├─────────────────────────────────────────────────────────────┤
│  Next.js App Router Route Handlers                           │
│  `app/api/**/route.ts`                                       │
│  Auth: `@/lib/auth`  ·  Data: `@/lib/db`  ·  RAG: `@/lib/rag`│
│  Export: `@/lib/export/*`  ·  Jira: env via company config   │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL (`DATABASE_URL`) via `pg` Pool                   │
│  Schema + migrations + seed in `lib/db.ts`                   │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root layout | Font, shell, toaster | `app/layout.tsx` |
| Proxy / session gate | Redirect unauthenticated HTML; allow public paths | `proxy.ts` |
| Auth helpers | Password hash, session CRUD, request user | `lib/auth.ts` |
| DB client | PG pool, `?`→`$n`, schema init, migrations, types | `lib/db.ts` |
| RAG status | SPI + risk/issue thresholds → red/amber/green | `lib/rag.ts` |
| Status weights | Activity completion % from status | `lib/status-weights.ts` |
| Export engines | Word / Excel / PPT buffers | `lib/export/word.ts`, `excel.ts`, `ppt.ts` |
| Sidebar shell | Portfolio + project nav, logout, password | `components/layout/Sidebar.tsx` |
| UI primitives | shadcn/Base UI wrappers | `components/ui/*` |
| Domain API | REST-ish JSON handlers | `app/api/**/route.ts` |
| Domain pages | Client-heavy dashboards & forms | `app/**/page.tsx` |

## Pattern Overview

**Overall:** Monolithic Next.js full-stack app (App Router). No separate backend service. No ORM — raw SQL through thin `DbClient`. Multi-tenant by `company_id` on users, projects, customers (programs), portfolio entities.

**Key Characteristics:**
- Route handlers = API surface; pages = `'use client'` UIs that `fetch` those APIs
- Cookie session (`pm_session`, httpOnly, 7d) — not JWT
- Programs domain name in UI map to DB table `customers`
- Company-scoped Jira credentials: DB stores env var *names*, values live in process env
- Schema lives in app boot path (`getDb()`), not external migration tool

## Layers

**Presentation (pages + components):**
- Purpose: Interactive PM UI (portfolio, project sub-apps, ops, admin)
- Location: `app/`, `components/`
- Contains: Client components, local state, charts (`recharts`), dialogs
- Depends on: `/api/*` JSON, `@/components/ui`, `@/lib/utils`
- Used by: Browser only

**API (route handlers):**
- Purpose: Authz, CRUD, exports, Jira proxy, AI report generation
- Location: `app/api/`
- Contains: `GET`/`POST`/`PUT`/`PATCH`/`DELETE` exports per `route.ts`
- Depends on: `@/lib/db`, `@/lib/auth`, sometimes `@/lib/export/*`, Anthropic SDK, Jira HTTP
- Used by: Pages and export download links

**Domain / shared libs:**
- Purpose: Auth, persistence, RAG math, document generation
- Location: `lib/`
- Contains: Pure helpers + DB singleton + export builders
- Depends on: `pg`, Node `crypto`, `docx` / `exceljs` / `pptxgenjs`
- Used by: API routes (and rarely client — only pure utils like `cn`)

**Data:**
- Purpose: PostgreSQL multi-tenant store
- Location: external; DDL in `lib/db.ts` (`initPostgresSchema`, `migratePostgresSchema`)
- Depends on: `DATABASE_URL`
- Used by: all authenticated APIs

## Data Flow

### Primary request path (authenticated page data)

1. Browser hits path → `proxy.ts` checks `pm_session` cookie; public list: `/login`, `/landing`, `/api/auth/`, `/api/health`, `/api/demo-requests`
2. Client page mounts (`'use client'`) → `fetch('/api/...')` with cookies
3. Route handler calls `getSessionFromRequest(req)` (`lib/auth.ts`) → join `sessions` + `users` + `companies`
4. Handler scopes SQL by `user.is_admin` vs `user.company_id` (e.g. `app/api/projects/route.ts`)
5. `getDb()` returns singleton `PostgresClient` → `get`/`all`/`run`
6. `NextResponse.json(...)` back to client; UI sets React state

### Login flow

1. `POST /api/auth/login` (`app/api/auth/login/route.ts`)
2. `verifyPassword` + `createSession` → set `pm_session` cookie
3. Client navigates to app; subsequent proxy passes

### Project create side effects

1. `POST /api/projects` inserts `projects` with company scope
2. Seeds default `meetings` and `escalation_levels` rows for new project id

### Export download

1. Browser `GET /api/export/word/[id]/[type]` (or excel/ppt/weekly-report/…)
2. Handler calls `generateWordDoc` / peers in `lib/export/*`
3. Binary `NextResponse` with attachment headers

### Jira integration

1. Company row in `company_jira_config` holds env key names
2. API resolves `process.env[cfg.*_var]`, Basic-auth to Jira REST (`app/api/jira/search/route.ts`)
3. Sync/import writes `activities` / `bugs` with `jira_key` etc.

### AI report generation

1. Portfolio/project report routes use `@anthropic-ai/sdk` when configured
2. Files: `app/api/portfolio/report/route.ts`, `generate-email`, `app/api/projects/[id]/project-report/*`, `report/route.ts`

**State Management:**
- No Redux/React Query — per-page `useState` + `useEffect` fetch
- Server session state in `sessions` table
- Module singleton `_client` in `lib/db.ts` for pool lifecycle

## Key Abstractions

**DbClient:**
- Purpose: SQLite-ish API (`get`/`all`/`run`/`exec`) over Postgres
- Examples: `lib/db.ts` (`PostgresClient`)
- Pattern: Convert `?` placeholders; `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`; `RETURNING id` on insert

**SessionUser:**
- Purpose: Request identity for multi-tenant filters
- Examples: `lib/auth.ts`
- Pattern: Cookie id → DB row; `is_admin` bypasses company filter

**RAG / calculateRAG:**
- Purpose: Portfolio health color from SPI, deadlines, open risks/issues
- Examples: `lib/rag.ts`, company overrides in `company_rag_config`
- Pattern: Pure function + per-company thresholds

**Program ≡ customer:**
- Purpose: Portfolio grouping entity
- Examples: table `customers`; routes `app/api/programs/*`; UI `/programs`
- Pattern: Keep dual naming; SQL uses `customers` / `customer_id`

**Export generators:**
- Purpose: Build Office docs server-side
- Examples: `lib/export/word.ts`, `excel.ts`, `ppt.ts`
- Pattern: Load project graph from DB → library buffer → route streams file

## Entry Points

**Next.js app:**
- Location: `app/layout.tsx`, `app/page.tsx` (portfolio home)
- Triggers: `next dev` / `next start` (standalone Docker)
- Responsibilities: Render tree, global styles `app/globals.css`

**Proxy:**
- Location: `proxy.ts` (matcher excludes static assets)
- Triggers: Every non-static request
- Responsibilities: Cookie presence only (not DB session expiry — API re-checks)

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
- **Circular imports:** Keep routes → lib only; avoid lib importing `app/`.
- **Multi-tenancy:** Non-admin queries must filter `company_id` (or program’s company). Admin sees all.
- **Params:** Dynamic route `params` are `Promise<...>` (Next 16) — always `await params`.
- **Standalone:** `next.config.ts` `output: 'standalone'`; `serverExternalPackages: ['exceljs','pptxgenjs']`.
- **Path alias:** `@/*` → repo root (`tsconfig.json`).

## Anti-Patterns

### Skip session check on new API route

**What happens:** Handler uses `getDb()` without `getSessionFromRequest`.
**Why it's wrong:** Cross-tenant data leak; export routes already weak on auth in places.
**Do this instead:** Mirror `app/api/projects/route.ts` — session first, then company-scoped SQL.

### Put business SQL only in huge page components

**What happens:** Logic lives only in 1000-line `page.tsx` with inline fetch.
**Why it's wrong:** Unreusable; hard to test; duplicates filters.
**Do this instead:** New persistence/rules go in `app/api/**/route.ts` or `lib/*`; pages stay UI.

### Hardcode Jira tokens in DB

**What happens:** Store raw tokens in `company_jira_config`.
**Why it's wrong:** Breaks env-based secret model used by `getJiraCredentials`.
**Do this instead:** Store env var *names*; put secrets in deployment env.

### New tables without `migratePostgresSchema`

**What happens:** Only add to `initPostgresSchema`.
**Why it's wrong:** Existing DBs never get columns/tables.
**Do this instead:** Add both `CREATE TABLE IF NOT EXISTS` / `ALTER ... IF NOT EXISTS` migration entries in `lib/db.ts`.

## Error Handling

**Strategy:** Per-route try/catch → `NextResponse.json({ error: String(e) }, { status: 500 })`. Auth helpers return 401/403 Response.

**Patterns:**
- Validate body early → 400
- Missing session → 401 JSON (API) or redirect (proxy for pages)
- Forbidden admin → `forbidden()` from `lib/auth.ts`
- Client: `sonner` toasts on failed fetch (Sidebar, forms)

## Cross-Cutting Concerns

**Logging:** No structured logger — rely on platform stdout / uncaught errors.
**Validation:** Ad-hoc in handlers (no Zod). Prefer explicit field checks on trust boundaries.
**Authentication:** Cookie session + scrypt password hashes (`lib/auth.ts`).
**Authorization:** Admin flag + company_id row filters in SQL.
**Theming:** Tailwind 4 + slate base; Geist font in root layout.

---

*Architecture analysis: 2026-08-07*
