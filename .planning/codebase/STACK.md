# Technology Stack

**Analysis Date:** 2026-08-07

## Languages

**Primary:**
- TypeScript 5.x (`typescript` in `package.json`) — App Router pages, API routes, `lib/`, `components/`
- TSX / React JSX — UI under `app/` and `components/`

**Secondary:**
- CSS (Tailwind v4 via PostCSS) — `app/globals.css`, `postcss.config.mjs`
- SQL (inline PostgreSQL) — schema/migrations in `lib/db.ts`
- YAML — deploy: `k8s.yaml`, CI: `.github/workflows/docker-build.yml`
- Docker — `Dockerfile`, `.dockerignore`

## Runtime

**Environment:**
- Node.js 20 (Docker base `node:20-slim` in `Dockerfile`; local env observed Node v25.x acceptable for dev)
- Browser DOM for client components (Next App Router)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js `16.2.4` — full-stack App Router (`app/`), API routes (`app/api/**/route.ts`), standalone output (`next.config.ts`)
- React `19.2.4` / `react-dom` `19.2.4` — UI
- Tailwind CSS `^4` + `@tailwindcss/postcss` — styling
- shadcn / Base UI — `components.json` (style `base-nova`), `@base-ui/react`, UI primitives in `components/ui/`

**Testing:**
- Not detected (no test runner or `*.test.*` / `*.spec.*` scripts in `package.json`)

**Build/Dev:**
- `next dev` / `next build` / `next start` — scripts in `package.json`
- ESLint 9 + `eslint-config-next` `16.2.4` — `eslint.config.mjs`
- TypeScript compiler via Next plugin — `tsconfig.json` (`strict: true`, path alias `@/*` → `./*`)

## Key Dependencies

**Critical:**
- `pg` `^8.20.0` + `@types/pg` — PostgreSQL access via `lib/db.ts` (`Pool`, custom `DbClient`)
- `@anthropic-ai/sdk` `^0.92.0` — AI report/email generation (`app/api/**/report/**`, `generate-email`)
- `next` / `react` / `react-dom` — app shell

**Document / export:**
- `exceljs` `^4.4.0` — Excel export (`lib/export/excel.ts`); also `serverExternalPackages` in `next.config.ts`
- `pptxgenjs` `^4.0.1` — PowerPoint export (`lib/export/ppt.ts`); `serverExternalPackages`
- `docx` `^9.6.1` — Word export (`lib/export/word.ts`)
- `jspdf` `^2.5.1` + `html-to-image` `^1.11.13` — client PDF / snapshot flows

**UI / charts:**
- `recharts` `^3.8.1` — charts
- `lucide-react` — icons (`components.json` iconLibrary)
- `sonner` — toasts (`components/ui/sonner.tsx`)
- `next-themes` — theme
- `class-variance-authority`, `clsx`, `tailwind-merge` — class utilities (`lib/utils.ts`)
- `tw-animate-css` — animation helpers
- `shadcn` CLI package present as dependency

**Infrastructure:**
- Node built-in `crypto` — password hash (scrypt) + session IDs (`lib/auth.ts`, `lib/db.ts`)
- Native `fetch` — Jira REST, Resend HTTP API

## Configuration

**Environment:**
- `.env` present (do not commit secrets; never read into docs)
- Required: `DATABASE_URL` (PostgreSQL connection string; `lib/db.ts` throws if missing)
- Optional AI: `ANTHROPIC_API_KEY` (fallback: `settings.anthropic_api_key` in DB)
- Optional email: `RESEND_API_KEY`, `MAIL_FROM`
- Per-company Jira: env var **names** stored in `company_jira_config`; values read via `process.env[varName]` (see `app/api/jira/*`)
- Next standalone: `output: 'standalone'` in `next.config.ts`
- Runtime production env in container: `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `NEXT_TELEMETRY_DISABLED=1` (`Dockerfile`)

**Build:**
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

**Development:**
- Node.js 20+ recommended (Docker uses 20)
- npm + `package-lock.json`
- PostgreSQL reachable via `DATABASE_URL`
- Optional: Anthropic key, Resend key, Jira Cloud env vars for full features

**Production:**
- Docker image `ghcr.io/<org>/pm-tool-b` (workflow: `ghcr.io/${{ github.repository }}`)
- Next standalone server (`node server.js` in image; Railway uses `npm start`)
- Port 3000
- Deploy targets: Railway (`railway.json`), Kubernetes (`k8s.yaml` namespace `inhouse`), GHCR images from GitHub Actions on `master`
- Health: `GET /api/health` → `{ ok: true }` (`app/api/health/route.ts`)

---

*Stack analysis: 2026-08-07*
