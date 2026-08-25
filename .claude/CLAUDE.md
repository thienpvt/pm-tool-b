<!-- GSD:project-start source:PROJECT.md -->

## Project

**PM Tool B — Layer Reorg & Hardening**

Multi-tenant project/portfolio management app (Next.js 16 App Router, React 19, PostgreSQL) with Jira import, AI-generated reports, and Excel/PPT/Word export. This milestone is not new features — it is a structural reorg of an existing messy codebase: introduce real layers front to back, then fix the security and integration concerns the codebase map surfaced.

**Core Value:** Every project-scoped request is tenant-isolated and every layer has one job — so a new route or page cannot silently reintroduce IDOR or a 2000-line god component.

### Constraints

- **Tech stack**: Next.js 16.2.4 / React 19.2.4 / TypeScript strict / PostgreSQL via `pg` — no framework swaps
- **Compatibility**: Behavior freeze except intentional security changes (new 403s) and opportunistic bug fixes; existing endpoints and screens keep working
- **Migration strategy**: Layer-by-layer sweep — establish target structure, move backend layers in one pass, UI in the next. Fewer half-states, larger blast radius per phase, so tests land with each layer
- **Testing**: Zero coverage today; a layer is not done until it has tests. This is the only guardrail against a full-stack refactor
- **Deployment**: Docker/GHCR + Railway + K8s must keep building; `output: 'standalone'` and `serverExternalPackages` (`exceljs`, `pptxgenjs`) preserved
- **Security**: Multi-tenant — tenant isolation is not optional; every project-scoped path must assert company access
- **Import convention**: `@/` alias for all app-root imports

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.x (`typescript` in `package.json`) — App Router pages, API routes, `lib/`, `components/`
- TSX / React JSX — UI under `app/` and `components/`
- CSS (Tailwind v4 via PostCSS) — `app/globals.css`, `postcss.config.mjs`
- SQL (inline PostgreSQL) — schema/migrations in `lib/db.ts`
- YAML — deploy: `k8s.yaml`, CI: `.github/workflows/docker-build.yml`
- Docker — `Dockerfile`, `.dockerignore`

## Runtime

- Node.js 20 (Docker base `node:20-slim` in `Dockerfile`; local env observed Node v25.x acceptable for dev)
- Browser DOM for client components (Next App Router)
- npm
- Lockfile: `package-lock.json` present

## Frameworks

- Next.js `16.2.4` — full-stack App Router (`app/`), API routes (`app/api/**/route.ts`), standalone output (`next.config.ts`)
- React `19.2.4` / `react-dom` `19.2.4` — UI
- Tailwind CSS `^4` + `@tailwindcss/postcss` — styling
- shadcn / Base UI — `components.json` (style `base-nova`), `@base-ui/react`, UI primitives in `components/ui/`
- Not detected (no test runner or `*.test.*` / `*.spec.*` scripts in `package.json`)
- `next dev` / `next build` / `next start` — scripts in `package.json`
- ESLint 9 + `eslint-config-next` `16.2.4` — `eslint.config.mjs`
- TypeScript compiler via Next plugin — `tsconfig.json` (`strict: true`, path alias `@/*` → `./*`)

## Key Dependencies

- `pg` `^8.20.0` + `@types/pg` — PostgreSQL access via `lib/db.ts` (`Pool`, custom `DbClient`)
- `@anthropic-ai/sdk` `^0.92.0` — AI report/email generation (`app/api/**/report/**`, `generate-email`)
- `next` / `react` / `react-dom` — app shell
- `exceljs` `^4.4.0` — Excel export (`lib/export/excel.ts`); also `serverExternalPackages` in `next.config.ts`
- `pptxgenjs` `^4.0.1` — PowerPoint export (`lib/export/ppt.ts`); `serverExternalPackages`
- `docx` `^9.6.1` — Word export (`lib/export/word.ts`)
- `jspdf` `^2.5.1` + `html-to-image` `^1.11.13` — client PDF / snapshot flows
- `recharts` `^3.8.1` — charts
- `lucide-react` — icons (`components.json` iconLibrary)
- `sonner` — toasts (`components/ui/sonner.tsx`)
- `next-themes` — theme
- `class-variance-authority`, `clsx`, `tailwind-merge` — class utilities (`lib/utils.ts`)
- `tw-animate-css` — animation helpers
- `shadcn` CLI package present as dependency
- Node built-in `crypto` — password hash (scrypt) + session IDs (`lib/auth.ts`, `lib/db.ts`)
- Native `fetch` — Jira REST, Resend HTTP API

## Configuration

- `.env` present (do not commit secrets; never read into docs)
- Required: `DATABASE_URL` (PostgreSQL connection string; `lib/db.ts` throws if missing)
- Optional AI: `ANTHROPIC_API_KEY` (fallback: `settings.anthropic_api_key` in DB)
- Optional email: `RESEND_API_KEY`, `MAIL_FROM`
- Per-company Jira: env var **names** stored in `company_jira_config`; values read via `process.env[varName]` (see `app/api/jira/*`)
- Next standalone: `output: 'standalone'` in `next.config.ts`
- Runtime production env in container: `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `NEXT_TELEMETRY_DISABLED=1` (`Dockerfile`)
- `next.config.ts` — standalone + externalize `exceljs`, `pptxgenjs`
- `tsconfig.json` — ES2017 target, bundler moduleResolution, `@/*` paths
- `postcss.config.mjs` — Tailwind PostCSS plugin
- `eslint.config.mjs` — Next core-web-vitals + TypeScript
- `components.json` — shadcn aliases (`@/components`, `@/lib/utils`, etc.)
- `railway.json` — Dockerfile builder, healthcheck `/api/health`
- `Dockerfile` — multi-stage `deps` → `builder` → `runner` (non-root `nextjs` user)
- `k8s.yaml` — Deployment + Service inject `DATABASE_URL`
- `.github/workflows/docker-build.yml` — build/push to GHCR

## Platform Requirements

- Node.js 20+ recommended (Docker uses 20)
- npm + `package-lock.json`
- PostgreSQL reachable via `DATABASE_URL`
- Optional: Anthropic key, Resend key, Jira Cloud env vars for full features
- Docker image `ghcr.io/<org>/pm-tool-b` (workflow: `ghcr.io/${{ github.repository }}`)
- Next standalone server (`node server.js` in image; Railway uses `npm start`)
- Port 3000
- Deploy targets: Railway (`railway.json`), Kubernetes (`k8s.yaml` namespace `inhouse`), GHCR images from GitHub Actions on `master`
- Health: `GET /api/health` → `{ ok: true }` (`app/api/health/route.ts`)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- App Router pages: `page.tsx`, layouts: `layout.tsx` under `app/`
- API handlers: `app/api/**/route.ts` (HTTP method exports only)
- Feature UI: PascalCase under domain folders — `components/bugs/BugImportDialog.tsx`, `components/layout/Sidebar.tsx`
- shadcn/ui primitives: kebab-case — `components/ui/button.tsx`, `components/ui/dialog.tsx`
- Shared libs: kebab or short names — `lib/db.ts`, `lib/auth.ts`, `lib/status-weights.ts`, `lib/export/excel.ts`
- camelCase for helpers and exports: `getSessionFromRequest`, `hashPassword`, `weightedProgress`, `statusWeight`
- React components: PascalCase — `Button`, `Sidebar`, `BugImportDialog`
- API route handlers: uppercase HTTP verbs — `GET`, `POST`, `PUT`, `DELETE`, `PATCH` in `route.ts`
- camelCase locals: `sessionId`, `companyId`, `projects`
- DB / API payload fields often snake_case matching SQL columns: `company_id`, `pm_name`, `plan_end`, `is_admin`
- Module constants: SCREAMING_SNAKE or Pascal-ish maps — `SESSION_COOKIE_NAME`, `STATUS_WEIGHTS`, `PHASE_ORDER`, `DONE_STATUSES`
- Prefer `type` aliases (not always `interface`) near use site: `SessionUser` in `lib/auth.ts`, page-local `Project`, `Activity` in `app/projects/[id]/dashboard/page.tsx`
- Generics on DB helpers: `db.get<SessionUser>(...)`
- Avoid separate `types/` tree — types live next to consumers

## Code Style

- No Prettier / Biome config in repo
- Mixed quotes: single quotes dominate app/API (`'use client'`, `'next/server'`); some UI/shadcn files use double quotes (`"clsx"`)
- Semicolons common in API/lib; some UI files omit trailing style consistency
- Indentation: 2 spaces
- Section banners in large client pages: `// ─── Types ───` style dividers
- ESLint 9 flat config: `eslint.config.mjs`
- Presets: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`
- Script: `npm run lint` → `eslint`
- TypeScript: `strict: true` in `tsconfig.json`; path alias `@/*` → repo root

## Import Organization

- `@/*` maps to project root (`./*`) — use `@/lib/...`, `@/components/...` from anywhere
- Relative imports only inside same package area (e.g. `lib/auth.ts` → `./db`)

## Error Handling

- API: wrap handler body in `try/catch`; on failure `return NextResponse.json({ error: String(e) }, { status: 500 })` — see `app/api/projects/route.ts`
- Auth gate: `const user = await getSessionFromRequest(req); if (!user) return NextResponse.json(..., { status: 401 })` or helpers `unauthorized()` / `forbidden()` in `lib/auth.ts`
- Validation: early return 400 with `{ error: '...' }` message strings — `app/api/auth/login/route.ts`
- Password verify: swallow crypto errors → `false` in `verifyPassword` (`lib/auth.ts`)
- Client: `toast` from `sonner` for user-visible success/failure after `fetch`
- Prefer JSON error shape `{ error: string }` over thrown exceptions crossing the HTTP boundary

## Logging

- Sparse server logging; many routes return errors to client without `console.error`
- Prefer not adding noisy logs; if debugging routes, keep temporary and remove
- Client errors surface via toast, not console-as-product

## Comments

- Domain rules and weighted status math — block comments in `lib/status-weights.ts` (VI + EN)
- Seed data / business defaults inline near inserts (meetings, escalations in `app/api/projects/route.ts`)
- Section dividers in large page files for Types / Constants / Helpers / Component
- Light JSDoc on pure helpers (`statusWeight`, `weightedProgress` in `lib/status-weights.ts`)
- Not required on every export; use when formula or domain meaning non-obvious
- No enforced TSDoc coverage

## Function Design

- Prefer small pure helpers for dates/status (`daysFromNow`, `isOverdue` on dashboard)
- Large client pages (`app/page.tsx`, project dashboards) hold substantial UI + local state — acceptable pattern today; extract only when reused
- `lib/db.ts` is a fat module (schema + pool + query facade) — treat as infrastructure, not copy pattern for features
- API: parse `req.json()` into `body`, then `body.field ?? default`
- DB: positional `?` placeholders via `db.run/get/all(sql, ...params)`
- Session: pass `NextRequest` into `getSessionFromRequest`
- API: always `NextResponse.json(...)` with explicit status (200 default, 201 create, 400/401/403/500)
- Auth helpers: `Promise<SessionUser | null>`
- UI: React elements; shared class merge via `cn()` from `lib/utils.ts`

## Module Design

- Named exports for lib utilities (`export function`, `export type`, `export const`)
- Default export common for page-level layout pieces (`Sidebar`) and some components
- UI primitives: named `Button` + `buttonVariants` pattern (CVA) in `components/ui/button.tsx`
- Not used as a project standard — import concrete paths `@/components/ui/button`, not `@/components`
- Do not add barrel `index.ts` unless clear multi-export package

## UI / Client Patterns

- Mark interactive pages/components with `'use client'` at top
- Fetch JSON from `/api/...` with credentials/cookies (session cookie `pm_session`)
- Forms: controlled React state + dialogs from `@/components/ui/dialog`
- Styling: Tailwind utility classes; merge conflicts with `cn()`; variants via `class-variance-authority`
- Icons: `lucide-react`
- Toasts: `sonner` (`toast` / Toaster in layout via `components/ui/sonner.tsx`)

## Data / SQL Conventions

- SQL written inline in route handlers and `lib/db.ts` (no ORM query builder)
- Column names snake_case in DB and JSON responses
- Multi-tenant filter: admin sees all; else scope by `user.company_id` (and null company special case)
- Prefer `getDb()` singleton entry from `@/lib/db` before queries

## What To Follow When Adding Code

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- Route handlers = API surface; pages = `'use client'` UIs that `fetch` those APIs
- Cookie session (`pm_session`, httpOnly, 7d) — not JWT
- Programs domain name in UI map to DB table `customers`
- Company-scoped Jira credentials: DB stores env var *names*, values live in process env
- Schema lives in app boot path (`getDb()`), not external migration tool

## Layers

- Purpose: Interactive PM UI (portfolio, project sub-apps, ops, admin)
- Location: `app/`, `components/`
- Contains: Client components, local state, charts (`recharts`), dialogs
- Depends on: `/api/*` JSON, `@/components/ui`, `@/lib/utils`
- Used by: Browser only
- Purpose: Authz, CRUD, exports, Jira proxy, AI report generation
- Location: `app/api/`
- Contains: `GET`/`POST`/`PUT`/`PATCH`/`DELETE` exports per `route.ts`
- Depends on: `@/lib/db`, `@/lib/auth`, sometimes `@/lib/export/*`, Anthropic SDK, Jira HTTP
- Used by: Pages and export download links
- Purpose: Auth, persistence, RAG math, document generation
- Location: `lib/`
- Contains: Pure helpers + DB singleton + export builders
- Depends on: `pg`, Node `crypto`, `docx` / `exceljs` / `pptxgenjs`
- Used by: API routes (and rarely client — only pure utils like `cn`)
- Purpose: PostgreSQL multi-tenant store
- Location: external; DDL in `lib/db.ts` (`initPostgresSchema`, `migratePostgresSchema`)
- Depends on: `DATABASE_URL`
- Used by: all authenticated APIs

## Data Flow

### Primary request path (authenticated page data)

### Login flow

### Project create side effects

### Export download

### Jira integration

### AI report generation

- No Redux/React Query — per-page `useState` + `useEffect` fetch
- Server session state in `sessions` table
- Module singleton `_client` in `lib/db.ts` for pool lifecycle

## Key Abstractions

- Purpose: SQLite-ish API (`get`/`all`/`run`/`exec`) over Postgres
- Examples: `lib/db.ts` (`PostgresClient`)
- Pattern: Convert `?` placeholders; `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`; `RETURNING id` on insert
- Purpose: Request identity for multi-tenant filters
- Examples: `lib/auth.ts`
- Pattern: Cookie id → DB row; `is_admin` bypasses company filter
- Purpose: Portfolio health color from SPI, deadlines, open risks/issues
- Examples: `lib/rag.ts`, company overrides in `company_rag_config`
- Pattern: Pure function + per-company thresholds
- Purpose: Portfolio grouping entity
- Examples: table `customers`; routes `app/api/programs/*`; UI `/programs`
- Pattern: Keep dual naming; SQL uses `customers` / `customer_id`
- Purpose: Build Office docs server-side
- Examples: `lib/export/word.ts`, `excel.ts`, `ppt.ts`
- Pattern: Load project graph from DB → library buffer → route streams file

## Entry Points

- Location: `app/layout.tsx`, `app/page.tsx` (portfolio home)
- Triggers: `next dev` / `next start` (standalone Docker)
- Responsibilities: Render tree, global styles `app/globals.css`
- Location: `proxy.ts` (matcher excludes static assets)
- Triggers: Every non-static request
- Responsibilities: Cookie presence only (not DB session expiry — API re-checks)
- Location: `app/api/auth/login|logout|me|change-password|complete-onboarding/route.ts`
- Triggers: Login UI, Sidebar
- Location: `app/api/health/route.ts`
- Triggers: K8s/Railway probes
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

### Put business SQL only in huge page components

### Hardcode Jira tokens in DB

### New tables without `migratePostgresSchema`

## Error Handling

- Validate body early → 400
- Missing session → 401 JSON (API) or redirect (proxy for pages)
- Forbidden admin → `forbidden()` from `lib/auth.ts`
- Client: `sonner` toasts on failed fetch (Sidebar, forms)

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
