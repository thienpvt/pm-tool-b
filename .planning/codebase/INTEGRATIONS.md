# External Integrations

**Analysis Date:** 2026-08-29

## APIs & External Services

**AI / Report Generation:**
- Anthropic Messages API — Portfolio and project report generation, email draft generation
  - SDK/Client: `@anthropic-ai/sdk` wrapped in `lib/integrations/anthropic/client.ts`
  - Models: `claude-opus-4-7`, `claude-sonnet-4-6` (constants in `lib/integrations/anthropic/models.ts`)
  - Auth: `ANTHROPIC_API_KEY` env var, with DB fallback via `settings.anthropic_api_key` (`lib/integrations/credentials.ts` → `resolveAnthropicCredentials()`)
  - Admin UI can store DB key via `POST /api/config` (`app/api/config/route.ts`); env var takes precedence
  - Timeout: 120s per request (report generation is slow by design)
  - Call sites: `modules/reports/backend/routes/portfolio/report/route.ts`, `modules/reports/backend/routes/projects/[id]/report/handlers.ts`, `modules/reports/backend/routes/projects/[id]/project-report/handlers.ts`, generate-email routes under `modules/reports/backend/routes/`

**Issue Tracking:**
- Atlassian Jira Cloud REST API v3 — Issue search, field listing, connection testing, timeline import
  - SDK/Client: Native `fetch` in `lib/integrations/jira/client.ts` (no Jira SDK)
  - Endpoints used: `POST /rest/api/3/search/jql`, `GET /rest/api/3/field`, `GET /rest/api/3/myself`
  - Auth: Basic auth (email + API token); credentials resolved per company via `resolveJiraCredentials()` in `lib/integrations/credentials.ts`
  - Credential storage: `company_jira_config` table stores **env var names** (not values); actual secrets live in `process.env` (`modules/admin/backend/repositories/jira-config.repo.ts`)
  - Admin config: `GET/POST /api/admin/jira-config/[companyId]` (`modules/admin/backend/routes/admin/jira-config/[companyId]/route.ts`)
  - Test connection: `POST /api/jira/test` (`modules/jira/backend/routes/jira/test/route.ts`)
  - Search/import routes: `app/api/jira/search/route.ts`, `app/api/jira/fields/route.ts`, `app/api/jira/sync-mappings/route.ts`, `app/api/jira/jql-presets/route.ts`
  - Timeout: 15s per request (`withFetchTimeout` in `lib/integrations/errors.ts`)

**Email:**
- Resend — Transactional email for report delivery
  - SDK/Client: Native `fetch` to `https://api.resend.com/emails` in `lib/integrations/resend/client.ts`
  - Auth: `RESEND_API_KEY` env var only (`resolveResendCredentials()` — no DB fallback)
  - From address: `MAIL_FROM` env var, default `PMO Reports <onboarding@resend.dev>` (`modules/reports/backend/routes/portfolio/report/send-email/route.ts`)
  - Call sites: `modules/reports/backend/routes/portfolio/report/send-email/route.ts`, project-level send-email handlers under `modules/reports/backend/routes/projects/[id]/project-report/`
  - Timeout: 15s per request

## Data Storage

**Databases:**
- PostgreSQL (managed or self-hosted)
  - Connection: `DATABASE_URL` env var (required at app boot — `lib/db.ts` `getDb()`)
  - SSL: Controlled via `sslmode` query param on connection string; smart fallback for localhost/private/Railway hosts (`lib/db.ts` `resolveSsl()`)
  - Client layer 1: `pg` connection pool — raw SQL via `DbClient` interface in `lib/db.ts` (SQLite-style `?` placeholders auto-converted to `$1`, `$2`)
  - Client layer 2: Kysely typed query builder — `lib/db/kysely.ts` `getKysely()` shares the same pool; schema types in `lib/db/database.ts`
  - Migrations: Versioned SQL in `migrations/` applied by `scripts/migrate.ts`; ledger table `schema_migrations`
  - Test DB: `TEST_DATABASE_URL` for integration tests (`test/db.ts`); CI uses `postgres://postgres:postgres@localhost:5432/pm_tool_test`
  - Repositories: `lib/repositories/*.repo.ts` and `modules/*/backend/repositories/*.repo.ts`

**File Storage:**
- Local filesystem only — No S3, blob storage, or CDN integration detected
- Uploaded files parsed in-memory (Excel header parsing via `app/api/parse-file-headers/route.ts`; resource plan import via `modules/jira/backend/routes/import/resource-plan/[id]/handlers.ts`)
- Generated exports streamed as HTTP responses (Word/Excel/PPT/PDF routes under `app/api/export/` and `modules/reports/backend/routes/export/`)
- Document content stored as JSON in PostgreSQL `documents.content_json` column

**Caching:**
- None — No Redis, Memcached, or in-memory cache layer detected
- Singleton DB pool and Kysely instance in `lib/db.ts` / `lib/db/kysely.ts` are process-level, not distributed cache

## Authentication & Identity

**Auth Provider:**
- Custom session-based auth (no OAuth, SSO, or third-party IdP)
  - Implementation: `lib/auth.ts` — password hashing (scrypt), session CRUD against `sessions` + `users` tables
  - Session cookie: `pm_session` (httpOnly, secure in production, 7-day max age) — set in `app/api/auth/login/route.ts`
  - Gate: `proxy.ts` redirects unauthenticated users to `/login`; API calls return 401 JSON
  - Public paths (no session): `/login`, `/landing`, `/api/auth/*`, `/api/health`, `/api/demo-requests`
  - Route protection: `withAuth()` wrapper in `lib/http/with-auth.ts`; ESLint enforces usage on all `app/api/**/route.ts`
  - Role-based access: `lib/http/with-role.ts`, `lib/http/with-project-access.ts`, `lib/http/with-program-access.ts`; actor model in `lib/services/access.ts`
  - Shadow mode: `ACCESS_ENFORCEMENT=shadow` logs but does not block unauthorized access (`lib/http/with-auth.ts`)
  - Auth routes: `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/api/auth/me/route.ts`, `app/api/auth/session/extend/route.ts`, `app/api/auth/change-password/route.ts`, `app/api/auth/complete-onboarding/route.ts`

## Monitoring & Observability

**Error Tracking:**
- None — No Sentry, Datadog, or similar APM integration
- Uncaught route errors logged via `instrumentation.ts` `onRequestError` hook
- Handler-level errors use `serverError()` / `logError()` from `lib/log.ts`

**Logs:**
- Plain `console.log` / `console.error` to stdout/stderr (`lib/log.ts`)
- Request correlation via `x-request-id` header stamped by `proxy.ts`
- Format: ISO timestamp + tag (`[req]`, `[err]`) + request id + method + path
- Designed for container log collection (Railway, Kubernetes) — no log shipping library
- Explicit policy: never log request/response bodies (passwords, tokens risk)

## CI/CD & Deployment

**Hosting:**
- Docker standalone container (primary production path)
- GitHub Container Registry (`ghcr.io`) — image built by `.github/workflows/docker-build.yml`
- Kubernetes — migrate Job spec in `k8s-migrate-job.yaml` (namespace `inhouse`, secret `app-env`)
- Railway — referenced in SSL fallback logic (`lib/db.ts`); pre-start migrate documented in `migrations/README.md`
- Docker Compose — local/production-like stack in `docker-compose.yml`

**CI Pipeline:**
- GitHub Actions (`.github/workflows/test.yml`, `.github/workflows/docker-build.yml`)
- Test job: checkout → Node 22 → `npm ci` → lint → migrate against Postgres 17 service → vitest
- Docker job: buildx → push to GHCR on non-PR events to `master`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` — PostgreSQL connection string (required for app boot and migrations)

**Optional env vars (feature-dependent):**
- `ANTHROPIC_API_KEY` — Anthropic API key for AI report generation (overrides DB-stored key)
- `RESEND_API_KEY` — Resend API key for email delivery
- `MAIL_FROM` — Sender address for Resend emails
- `ACCESS_ENFORCEMENT` — Set to `shadow` to log-but-not-block unauthorized access
- `NODE_ENV` — `production` enables secure cookies on login
- Per-company Jira vars — Names stored in `company_jira_config`; values referenced by env var name (e.g., custom `JIRA_BASE_URL_VAR`, `JIRA_EMAIL_VAR`, `JIRA_TOKEN_VAR` names configured per company)
- `TEST_DATABASE_URL` — Test-only Postgres URL (must end in `_test`)

**DB-stored settings (via `settings` table, managed through `/api/config`):**
- `anthropic_api_key` — Fallback when `ANTHROPIC_API_KEY` env var is unset
- `ceo_email` — Default recipient for portfolio report emails

**Secrets location:**
- Production: `.env` file loaded by Docker Compose; Kubernetes secret `app-env` (key `DATABASE_URL` in `k8s-migrate-job.yaml`)
- Jira tokens: referenced by env var name in DB, actual values in deployment environment
- Anthropic key: env var preferred, DB fallback for admin-configured deployments
- Resend key: env var only

## Webhooks & Callbacks

**Incoming:**
- None — No webhook receiver endpoints detected; all integrations are pull/outbound-initiated from route handlers

**Outgoing:**
- Anthropic Messages API — `POST` via `@anthropic-ai/sdk` (`lib/integrations/anthropic/client.ts`)
- Jira Cloud REST API — `fetch` to `{baseUrl}/rest/api/3/*` (`lib/integrations/jira/client.ts`)
- Resend Email API — `POST https://api.resend.com/emails` (`lib/integrations/resend/client.ts`)

**Internal callbacks (not external webhooks):**
- Demo request form — `POST /api/demo-requests` stores lead in `demo_requests` table (`app/api/demo-requests/route.ts`); public, no auth
- Health probe — `GET /api/health` used by Docker Compose healthcheck (`docker-compose.yml`)

## Integration Error Handling

All external calls use a unified pattern:
- Credential resolution: `lib/integrations/credentials.ts` (single entry point for Jira, Anthropic, Resend)
- Error type: `IntegrationError` in `lib/integrations/errors.ts` with kinds: `auth`, `timeout`, `upstream`, `network`, `validation`
- Route mapping: `integrationErrorResponse()` converts errors to HTTP responses; preserves upstream messages for Jira
- Response codes: `503` with `{ error: 'NO_API_KEY' }` or `{ error: 'NO_RESEND_KEY' }` when credentials missing

---

*Integration audit: 2026-08-29*
