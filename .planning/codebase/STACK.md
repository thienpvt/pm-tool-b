# Technology Stack

**Analysis Date:** 2026-08-29

## Languages

**Primary:**
- TypeScript 5 — All application code under `app/`, `lib/`, `modules/`, `components/`, `test/`, and `scripts/` (`.ts`, `.tsx`)
- SQL — Versioned schema in `migrations/0001-baseline-schema.sql`; operator data-fix scripts in `scripts/data-fixes/`

**Secondary:**
- JavaScript (ESM) — One-off decomposition/refactor scripts in `scripts/*.mjs` and custom ESLint plugin at `eslint/plugin.mjs`

## Runtime

**Environment:**
- Node.js 20 — Production Docker image (`Dockerfile` uses `node:20-slim`)
- Node.js 22 — CI test runner (`.github/workflows/test.yml`)

**Package Manager:**
- npm (bundled with Node)
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- Next.js 16.2.4 — Full-stack App Router app; pages in `app/`, API routes re-export from `modules/*/backend/routes/`
- React 19.2.4 — UI in `app/`, `components/`, `modules/*/ui/`
- React DOM 19.2.4 — Client components and jsdom tests

**Testing:**
- Vitest 4.1.10 — Dual-project runner configured in `vitest.config.ts`
  - `node` project: `{lib,app,eslint,modules}/**/*.test.ts`
  - `jsdom` project: `{components,app,modules}/**/*.test.tsx` and `*.component.test.tsx`
- @testing-library/react 16.3.2 + @testing-library/jest-dom 7.0.0 — Component tests with setup in `test/setup-jsdom.ts`
- jsdom 30.0.1 — Browser-like environment for React tests

**Build/Dev:**
- TypeScript 5 — Strict mode, path alias `@/*` → repo root (`tsconfig.json`)
- Tailwind CSS 4 — Utility styling via `@tailwindcss/postcss` (`postcss.config.mjs`, `app/globals.css`)
- shadcn 4.6.0 + @base-ui/react 1.4.1 — UI primitives in `components/ui/` (configured in `components.json`, style `base-nova`)
- ESLint 9 + eslint-config-next 16.2.4 — Flat config in `eslint.config.mjs`; custom `pm-tool/require-auth-wrapper` rule on `app/api/**/route.ts`
- tsx 4.23.12 — Runs migration CLI (`scripts/migrate.ts`) and data-fix scripts

## Key Dependencies

**Critical:**
- `pg` 8.20.0 — PostgreSQL connection pool; singleton in `lib/db.ts`
- `kysely` 0.29.5 — Type-safe query builder; typed schema in `lib/db/database.ts` (generated via `npm run codegen:db`)
- `zod` 4.4.3 — Request/response and integration boundary validation across `modules/*/backend/routes/**/schema.ts` and `lib/integrations/*/schemas.ts`
- `@anthropic-ai/sdk` 0.92.0 — AI report generation via `lib/integrations/anthropic/client.ts`
- `next` 16.2.4 — Standalone server output (`next.config.ts`: `output: 'standalone'`)

**UI & Visualization:**
- `lucide-react` 1.14.0 — Icons (shadcn default per `components.json`)
- `recharts` 3.8.1 — Dashboard and report charts
- `next-themes` 0.4.6 — Theme switching support
- `sonner` 2.0.7 — Toast notifications (`components/ui/sonner.tsx`, wired in `app/layout.tsx`)
- `class-variance-authority`, `clsx`, `tailwind-merge` — Component variant utilities (`lib/utils.ts`)

**Document Export (server-side):**
- `exceljs` 4.4.0 — Excel exports (`lib/export/excel.ts`, weekly/portfolio export routes)
- `docx` 9.6.1 — Word document generation (`lib/export/word.ts`)
- `pptxgenjs` 4.0.1 — PowerPoint generation (`lib/export/ppt.ts`)
- `jspdf` 2.5.1 — PDF export (`lib/export/dashboard-portfolio.ts`)

**Document Export (client-side):**
- `html-to-image` 1.11.13 — PNG capture of report HTML (`modules/reports/ui/portfolio-report/useReportPageActions.ts`)

**Infrastructure:**
- `@types/pg`, `@types/node`, `@types/react`, `@types/react-dom` — Type definitions
- `kysely-codegen` 0.20.0 (dev) — Regenerates `lib/db/database.ts` from live Postgres schema

## Configuration

**Environment:**
- `.env` file referenced by `docker-compose.yml` (`env_file: .env`) — contains runtime secrets; never commit
- Required at runtime: `DATABASE_URL` (PostgreSQL connection string with optional `sslmode` query param)
- Optional runtime: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `ACCESS_ENFORCEMENT`, `NODE_ENV`
- Test-only: `TEST_DATABASE_URL` (must end in `_test`; enforced in `test/db.ts`)

**Build:**
- `next.config.ts` — Standalone output; `serverExternalPackages: ['exceljs', 'jspdf', 'pptxgenjs']` to avoid bundling heavy native deps
- `tsconfig.json` — ES2017 target, strict, `@/*` path alias, Next.js plugin
- `eslint.config.mjs` — Next core-web-vitals + TypeScript + custom auth-wrapper lint on API routes
- `postcss.config.mjs` — Tailwind v4 PostCSS plugin only
- `vitest.config.ts` — Dual-environment test projects with `@` alias
- `components.json` — shadcn/ui configuration (RSC, Tailwind CSS variables, `@/components` aliases)
- `instrumentation.ts` — Next.js `onRequestError` hook for uncaught route errors (stdout via `console.error`)
- `proxy.ts` — Request gate (session check, public path allowlist, request-id stamping); acts as Next.js middleware equivalent

**Database migrations:**
- `npm run migrate` — Applies `migrations/*.sql` via `scripts/migrate.ts`; uses advisory lock, checksum ledger in `schema_migrations`
- `npm run migrate -- --check` — Fails if pending migrations exist (deploy gate)
- `npm run codegen:db` — Regenerates Kysely types from connected Postgres

## Platform Requirements

**Development:**
- Node.js 20+ recommended (matches Docker; CI uses 22)
- PostgreSQL 17 (CI service image; local dev via Docker per `README.md`)
- `npm ci` then `npm run dev` for local server on port 3000
- Set `DATABASE_URL` before starting; run `npm run migrate` once against target DB

**Production:**
- Docker multi-stage build (`Dockerfile`) → standalone Next.js server on port 3000
- Startup: `npx tsx scripts/migrate.ts && node server.js` (migrations then app)
- Health check: `GET /api/health` returns `{ ok: true }` (`app/api/health/route.ts`)
- Deployment targets documented in `migrations/README.md`:
  - **Docker Compose** — `docker-compose.yml` (app service + healthcheck)
  - **GitHub Container Registry** — `.github/workflows/docker-build.yml` pushes to `ghcr.io/${{ github.repository }}`
  - **Kubernetes** — `k8s-migrate-job.yaml` (one-shot migrate Job in `inhouse` namespace)
  - **Railway** — SSL fallback logic in `lib/db.ts` `resolveSsl()` handles `railway.internal` hosts

**CI:**
- `.github/workflows/test.yml` — `npm ci`, `npm run lint`, `npm run migrate`, `npm test` against Postgres 17 service
- `.github/workflows/docker-build.yml` — Build and push Docker image on `master` branch

---

*Stack analysis: 2026-08-29*
