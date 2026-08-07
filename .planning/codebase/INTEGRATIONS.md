# External Integrations

**Analysis Date:** 2026-08-07

## APIs & External Services

**LLM / AI reports:**
- Anthropic Claude API — generate portfolio/project reports and email HTML
  - SDK/Client: `@anthropic-ai/sdk` (`Anthropic` class)
  - Models in use: `claude-opus-4-7` (portfolio/project report routes), `claude-sonnet-4-6` (`app/api/projects/[id]/project-report/generate-email/route.ts`)
  - Auth: `ANTHROPIC_API_KEY` env, else DB `settings` key `anthropic_api_key`
  - Routes: `app/api/portfolio/report/route.ts`, `app/api/portfolio/report/generate-email/route.ts`, `app/api/projects/[id]/report/route.ts`, `app/api/projects/[id]/project-report/route.ts`, `app/api/projects/[id]/project-report/generate-email/route.ts`
  - Config surface: `app/api/config/route.ts` (masks key; reports env vs DB)

**Issue tracker:**
- Atlassian Jira Cloud REST API v3 — search/import activities & bugs, field list, connection test
  - SDK/Client: native `fetch` (no official Jira SDK)
  - Auth: HTTP Basic `email:api_token` (Base64)
  - Credential resolution: per-company rows in `company_jira_config` store **names** of env vars (`base_url_var`, `email_var`, `token_var`); runtime reads `process.env[name]`
  - Endpoints used: `POST /rest/api/3/search/jql`, `GET /rest/api/3/myself`, fields helpers
  - Routes: `app/api/jira/search/route.ts`, `app/api/jira/fields/route.ts`, `app/api/jira/test/route.ts`, `app/api/jira/sync-mappings/route.ts`, `app/api/jira/jql-presets/**`, admin `app/api/admin/jira-config/[companyId]/route.ts`
  - UI: `components/jira/JiraSyncDialog.tsx`, admin company Jira config on `app/admin/page.tsx`

**Transactional email:**
- Resend HTTP API — send portfolio report email
  - SDK/Client: `fetch('https://api.resend.com/emails')`
  - Auth: `Authorization: Bearer ${RESEND_API_KEY}`
  - From: `MAIL_FROM` or default `PMO Reports <onboarding@resend.dev>`
  - Route: `app/api/portfolio/report/send-email/route.ts`

**RAG status (domain logic, not vector RAG):**
- In-process SPI/deadline/risk thresholds — `lib/rag.ts` + per-company `company_rag_config` (admin `app/api/admin/rag-config/[companyId]/route.ts`)
  - Not an external embedding service

## Data Storage

**Databases:**
- PostgreSQL
  - Connection: `DATABASE_URL` (required)
  - Client: `pg` `Pool` wrapped by `PostgresClient` / `getDb()` in `lib/db.ts`
  - Schema: created/migrated at first `getDb()` call (`initPostgresSchema`, `migratePostgresSchema`, `backfillWeightedCompletion`, `seedAuthData`)
  - SSL: disabled for `sslmode=disable|false`, Railway internal host, localhost/private LAN; else `{ rejectUnauthorized: false }`
  - Deploy: `k8s.yaml` injects `DATABASE_URL` into Deployment; Railway expects same env

**File Storage:**
- Local/app filesystem only for static assets (`public/`)
- Exports generated in-memory / response streams (`lib/export/*`, `app/api/export/**`) — no S3/blob store detected
- Import uploads parsed in API routes (e.g. `app/api/parse-file-headers/route.ts`, resource/timeline import routes)

**Caching:**
- None (no Redis/Memcached). Module singleton `_client` for DB pool in `lib/db.ts`

## Authentication & Identity

**Auth Provider:**
- Custom session auth (not OAuth/NextAuth/Clerk)
  - Implementation: `lib/auth.ts`
  - Password: Node `crypto.scryptSync` with salt (`hashPassword` / `verifyPassword`)
  - Session: random 32-byte hex id, table `sessions`, cookie `pm_session` (`SESSION_COOKIE_NAME`), 7-day expiry
  - Request helper: `getSessionFromRequest`
  - Routes: `app/api/auth/login/route.ts`, `logout`, `me`, `change-password`, `complete-onboarding`
  - Gate: `proxy.ts` redirects unauthenticated users (public: `/login`, `/landing`, `/api/auth/`, `/api/health`, `/api/demo-requests`)
  - Roles: `users.is_admin`, multi-tenant `company_id` / `companies`
  - Seed users created when users table empty (`seedAuthData` in `lib/db.ts`) — change defaults in production

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry/Datadog SDK)

**Logs:**
- Default process/console logging only; no structured logging library

**Health:**
- `GET /api/health` — liveness for Railway/K8s (`app/api/health/route.ts`)

## CI/CD & Deployment

**Hosting:**
- Railway — `railway.json` (Dockerfile build, `npm start`, healthcheck `/api/health`)
- Kubernetes — `k8s.yaml` (Deployment `nextjs`, Service NodePort, image from GHCR)
- Container registry: GitHub Container Registry `ghcr.io`

**CI Pipeline:**
- GitHub Actions `.github/workflows/docker-build.yml`
  - Triggers: push/PR to `master`, `workflow_dispatch`
  - Buildx + push tags (sha, branch, `latest` on default branch)
  - Auth: `GITHUB_TOKEN` for GHCR

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` — PostgreSQL URL (mandatory for app boot via `getDb()`)

**Feature env vars:**
- `ANTHROPIC_API_KEY` — Claude reports (optional if DB setting set)
- `RESEND_API_KEY` — outbound email
- `MAIL_FROM` — Resend from address
- Company-specific Jira vars — names configured in DB (`company_jira_config`); values must exist in process env (ops set on Railway/K8s)

**Secrets location:**
- Local: `.env` (present; gitignored — do not commit)
- Runtime: platform env (Railway / K8s env on Deployment)
- Optional: Anthropic key also in DB `settings` table
- CI: `secrets.GITHUB_TOKEN` for package push only

## Webhooks & Callbacks

**Incoming:**
- None detected (no Stripe/GitHub webhook handlers). Public write: `app/api/demo-requests/route.ts` (landing demo form)

**Outgoing:**
- Jira REST calls from server routes
- Anthropic Messages API from report routes
- Resend email API from `send-email` route

## Integration Patterns (prescriptive)

**Add new Jira call:** implement under `app/api/jira/`, resolve creds like `getJiraCredentials` in `app/api/jira/search/route.ts` (company config → env vars → Basic auth). Do not hardcode URL/token.

**Add AI generation:** use `@anthropic-ai/sdk`, resolve key env-then-DB (see `generate-email` routes), return `NO_API_KEY` 503 when missing.

**Add email send:** call Resend REST with `RESEND_API_KEY`; keep `MAIL_FROM` configurable.

**DB access:** always `const db = await getDb()` then `db.get` / `db.all` / `db.run` with `?` placeholders (converted to `$n` in `lib/db.ts`). Prefer schema changes via migrations array in `migratePostgresSchema`.

---

*Integration audit: 2026-08-07*
