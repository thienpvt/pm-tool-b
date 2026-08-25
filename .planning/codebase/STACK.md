# Technology Stack

**Analysis Date:** 2026-08-25

## Languages

**Primary:**
- TypeScript 5 (`typescript` ^5 in `package.json`) — all application code under `app/`, `lib/`, `components/`, `test/`
- TSX — React components in `app/` and `components/`

**Secondary:**
- JavaScript (ESM) — config files: `eslint.config.mjs`, `postcss.config.mjs`
- SQL — inline DDL and queries in `lib/db.ts` and `lib/repositories/*.repo.ts` (SQLite-style `?` placeholders translated to PostgreSQL `$n` by `PostgresClient`)

## Runtime

**Environment:**
- Node.js 20 — production Docker image (`Dockerfile` uses `node:20-slim`)
- Node.js 22 — CI test runner (`.github/workflows/test.yml` uses `node-version: 22`)

**Package Manager:**
- npm (default; `npm ci` in CI and Docker)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.2.4 — full-stack App Router (`app/`), API routes (`app/api/**/route.ts`), standalone output (`next.config.ts`)
- React 19.2.4 — UI rendering, Server and Client Components
- PostgreSQL 17 — primary data store via `pg` ^8.20.0; schema bootstrapped at startup in `lib/db.ts`

**Testing:**
- Vitest 4.1.10 — dual-project config in `vitest.config.ts`:
  - `node` project: `{lib,app}/**/*.test.ts`
  - `jsdom` project: `{components,app}/**/*.test.tsx`, `{components,app}/**/*.component.test.tsx`
- @testing-library/react 16.3.2 + @testing-library/jest-dom 7.0.0 — component tests
- jsdom 30.0.1 — browser environment for React tests

**Build/Dev:**
- Tailwind CSS 4 (`tailwindcss` ^4, `@tailwindcss/postcss` ^4) — styling via `app/globals.css`
- ESLint 9 + `eslint-config-next` 16.2.4 — linting (`eslint.config.mjs`, `npm run lint`)
- PostCSS — `postcss.config.mjs` with `@tailwindcss/postcss`
- shadcn/ui 4.6.0 — component system (`components.json`, style `base-nova`, icons via `lucide-react`)
- @base-ui/react ^1.4.1 — headless UI primitives used by shadcn components

## Key Dependencies

**Critical:**
- `next` 16.2.4 — application framework, routing, API handlers, standalone deployment
- `react` / `react-dom` 19.2.4 — UI layer
- `pg` ^8.20.0 + `@types/pg` ^8.20.0 — PostgreSQL connection pool and typed queries
- `zod` ^4.4.3 — request/response and integration boundary validation (routes, Jira/Anthropic schemas)
- `@anthropic-ai/sdk` ^0.92.0 — AI report and email generation (`lib/integrations/anthropic/client.ts`)

**Infrastructure / Integration:**
- `docx` ^9.6.1 — Word export (`lib/export/word.ts`, `app/api/export/word/[id]/[type]/route.ts`)
- `exceljs` ^4.4.0 — Excel export (`lib/export/excel.ts`); listed in `serverExternalPackages` in `next.config.ts`
- `pptxgenjs` ^4.0.1 — PowerPoint export (`lib/export/ppt.ts`); also externalized in Next config
- `jspdf` ^2.5.1 — PDF generation in client/export flows
- `html-to-image` ^1.11.13 — DOM-to-image capture for reports
- `recharts` ^3.8.1 — chart components in portfolio/project report UI

**UI utilities:**
- `class-variance-authority` ^0.7.1, `clsx` ^2.1.1, `tailwind-merge` ^3.5.0 — component styling helpers (`lib/utils.ts`)
- `lucide-react` ^1.14.0 — icon set
- `sonner` ^2.0.7 — toast notifications (`components/ui/sonner.tsx`)
- `next-themes` ^0.4.6 — theme switching support
- `tw-animate-css` ^1.4.0 — animation utilities imported in `app/globals.css`

## Configuration

**Environment:**
- Required at runtime: `DATABASE_URL` — PostgreSQL connection string; `getDb()` in `lib/db.ts` throws if unset
- Integration keys resolved via `lib/integrations/credentials.ts`:
  - `ANTHROPIC_API_KEY` (env, with DB fallback via `settings.anthropic_api_key`)
  - `RESEND_API_KEY` (env only)
  - Jira credentials via tenant-specific env var *names* stored in `company_jira_config` table
- Optional: `MAIL_FROM`, `ACCESS_ENFORCEMENT`, `TEST_DATABASE_URL`, `NODE_ENV`
- `.env` file referenced by `docker-compose.yml` (`env_file: .env`) — existence only; never commit secrets
- No `.env.example` committed to the repository

**Build:**
- `next.config.ts` — `output: 'standalone'`, `serverExternalPackages: ['exceljs', 'pptxgenjs']`
- `tsconfig.json` — `strict: true`, path alias `@/*` → project root
- `vitest.config.ts` — dual-environment test projects with `@` alias
- `components.json` — shadcn config (RSC enabled, neutral base color, `@/components/ui` alias)
- `postcss.config.mjs` — Tailwind PostCSS plugin

**Database:**
- Schema created/migrated on first `getDb()` call: `initPostgresSchema()`, `migratePostgresSchema()`, `backfillWeightedCompletion()` in `lib/db.ts`
- SSL resolved from connection URL host/sslmode in `resolveSsl()` — Railway internal and localhost disable SSL; remote hosts use `{ rejectUnauthorized: false }`

## Platform Requirements

**Development:**
- Node.js 20+ (22 used in CI)
- npm
- PostgreSQL 17 for full test suite (repository integration tests require `TEST_DATABASE_URL` ending in `_test`; see `test/db.ts` and `README.md`)
- Run: `npm run dev` (Next.js dev server on port 3000)

**Production:**
- Docker multi-stage build (`Dockerfile`) → standalone Next.js server on port 3000
- `docker-compose.yml` — app service with health check against `GET /api/health`
- CI publishes images to GitHub Container Registry (`ghcr.io/${{ github.repository }}`) via `.github/workflows/docker-build.yml`
- Logging: structured `console` output in `lib/log.ts`; request correlation via `proxy.ts` and `instrumentation.ts`
- No Vercel-specific deployment config beyond generic Next.js README note

## Application Architecture (Stack Context)

**Layering (v1.0 shipped):**
- **Routes** — `app/api/**/route.ts` (85 route files); auth/session via `withAuth` in `lib/http/with-auth.ts`
- **Services** — `lib/services/*.service.ts` — business logic, access checks, orchestration
- **Repositories** — `lib/repositories/*.repo.ts` — SQL data access through `DbClient` interface
- **Integrations** — `lib/integrations/{jira,anthropic,resend}/` — external API clients; credentials resolved in `lib/integrations/credentials.ts`

**Auth stack:**
- Custom session auth — `lib/auth.ts` (scrypt password hashing, `pm_session` HTTP-only cookie, 7-day sessions in PostgreSQL)
- Route protection — `proxy.ts` (Next.js 16 proxy/middleware pattern) redirects unauthenticated users to `/login`

**Test harness:**
- 727 passing tests, 113 skipped (840 total) when `TEST_DATABASE_URL` unset locally
- Repository tests gated by `describe.skipIf(!hasTestDb)` using `test/db.ts`
- Route handlers tested by importing handlers and constructing `NextRequest` — no dev server required

---

*Stack analysis: 2026-08-25*
