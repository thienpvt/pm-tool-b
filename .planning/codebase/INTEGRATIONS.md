# External Integrations

**Analysis Date:** 2026-08-25

## APIs & External Services

**Issue Tracking (Jira Cloud):**
- Atlassian Jira Cloud REST API v3 — issue search, field listing, connection testing
  - Client: `lib/integrations/jira/client.ts` (native `fetch`, 15s timeout via `withFetchTimeout`)
  - Schemas: `lib/integrations/jira/schemas.ts` (Zod validation)
  - Endpoints used:
    - `POST /rest/api/3/search/jql` — cursor-based issue search (`searchIssues`)
    - `GET /rest/api/3/field` — custom field listing (`listFields`)
    - `GET /rest/api/3/myself` — connection test (`testConnection`)
  - Auth: HTTP Basic (`email:api_token` base64-encoded)
  - API routes: `app/api/jira/search/route.ts`, `app/api/jira/fields/route.ts`, `app/api/jira/test/route.ts`, `app/api/jira/jql-presets/route.ts`, `app/api/jira/sync-mappings/route.ts`
  - Admin config: `app/api/admin/jira-config/[companyId]/route.ts` → `lib/repositories/jira-config.repo.ts`

**AI / LLM (Anthropic):**
- Anthropic Messages API — AI-generated portfolio reports, project reports, and email content
  - SDK: `@anthropic-ai/sdk` in `lib/integrations/anthropic/client.ts`
  - Models (constants in `lib/integrations/anthropic/models.ts`):
    - `claude-opus-4-7` (`MODEL_OPUS_4_7`) — email generation
    - `claude-sonnet-4-6` (`MODEL_SONNET_4_6`) — report generation
  - Timeout: 120s per request (SDK client config)
  - API routes:
    - `app/api/portfolio/report/route.ts`
    - `app/api/portfolio/report/generate-email/route.ts`
    - `app/api/projects/[id]/report/route.ts`
    - `app/api/projects/[id]/project-report/route.ts`
    - `app/api/projects/[id]/project-report/generate-email/route.ts`
  - Auth: API key via `resolveAnthropicCredentials()` in `lib/integrations/credentials.ts`

**Email (Resend):**
- Resend transactional email API — send portfolio report emails
  - Client: `lib/integrations/resend/client.ts` (native `fetch` to `https://api.resend.com/emails`, 15s timeout)
  - API route: `app/api/portfolio/report/send-email/route.ts`
  - Auth: Bearer token via `RESEND_API_KEY`
  - From address: `MAIL_FROM` env var, default `'PMO Reports <onboarding@resend.dev>'`

**Not integrated:**
- Stripe, Supabase, AWS SDK, Sentry, Datadog — not detected in dependencies or source
- OAuth/OIDC providers — not used; auth is custom session-based (`lib/auth.ts`)

## Data Storage

**Databases:**
- PostgreSQL 17
  - Connection: `DATABASE_URL` environment variable
  - Client: `pg` `Pool` wrapped by `PostgresClient` implementing `DbClient` in `lib/db.ts`
  - ORM: None — raw SQL via repository layer (`lib/repositories/*.repo.ts`)
  - Schema: auto-created on startup (`initPostgresSchema`, `migratePostgresSchema` in `lib/db.ts`)
  - Key tables for integrations:
    - `company_jira_config` — stores env var *names* for Jira credentials per company
    - `settings` — key/value store including `anthropic_api_key` DB fallback
    - `jira_jql_presets`, `jira_sync_mappings` — Jira workflow persistence
  - Test database: `TEST_DATABASE_URL` (must end in `_test`; enforced in `test/db.ts`)

**File Storage:**
- Local filesystem only — no cloud object storage SDK
- Generated exports (Word, Excel, PPT, PDF) streamed from API routes; no persistent file store
- Static assets in `public/` served by Next.js

**Caching:**
- None — no Redis, Memcached, or in-memory cache layer detected
- Singleton `DbClient` in `lib/db.ts` (`_client`) persists pool for process lifetime

## Authentication & Identity

**Auth Provider:**
- Custom (not third-party IdP)
  - Implementation: `lib/auth.ts` — scrypt password hashing, session cookies, PostgreSQL `sessions` table
  - Session cookie: `pm_session` (HTTP-only, `sameSite: 'lax'`, 7-day TTL)
  - Login: `app/api/auth/login/route.ts` → `lib/repositories/auth.repo.ts`
  - Session resolution: `getSessionFromRequest()` used by routes and `withAuth` wrapper
  - Multi-tenant: users belong to `companies`; `company_id` scopes data access via `lib/services/access.ts`

**Access enforcement:**
- `ACCESS_ENFORCEMENT=shadow` — optional shadow mode logs would-be denials without blocking (`lib/http/with-auth.ts`, `isAccessShadowMode()`)
- Project/program ownership checks via `lib/http/with-project-access.ts`, `lib/http/with-program-access.ts`

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Bugsnag, or similar SDK
- Server errors logged via Next.js instrumentation hook: `instrumentation.ts` (`onRequestError`)

**Logs:**
- Structured stdout/stderr via `console` in `lib/log.ts`
- Request correlation: `x-request-id` header stamped by `proxy.ts`, read in route handlers and `instrumentation.ts`
- API request logging: method, path, session presence (no bodies — passwords/tokens excluded by design)
- Access shadow denials: `[ACCESS-SHADOW]` JSON lines in `lib/http/with-auth.ts`

## CI/CD & Deployment

**Hosting:**
- Docker container (`Dockerfile` — Node 20 slim, standalone Next.js)
- `docker-compose.yml` for local/production compose with health check on `/api/health`
- GitHub Container Registry (`ghcr.io`) — images built and pushed on `master` branch (`.github/workflows/docker-build.yml`)
- Railway-compatible PostgreSQL SSL handling in `lib/db.ts` (`*.railway.internal` host detection)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/test.yml`
  - Triggers: push, PR to `master`, manual dispatch
  - Postgres 17 service container for integration tests
  - Steps: `npm ci` → `npm test` with `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pm_tool_test`
- Docker build workflow — `.github/workflows/docker-build.yml` (buildx, GHA cache, push on non-PR events)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` — PostgreSQL connection string (required at app startup)

**Integration credentials:**
- `ANTHROPIC_API_KEY` — Anthropic API key (env takes precedence over DB `settings.anthropic_api_key`)
- `RESEND_API_KEY` — Resend API key (env only, no DB fallback)
- Jira — tenant-specific; admin configures env var *names* in `company_jira_config`:
  - Values read from `process.env[base_url_var]`, `process.env[email_var]`, `process.env[token_var]`
  - Example pattern (names vary per tenant): custom vars like `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_TOKEN`

**Optional env vars:**
- `MAIL_FROM` — sender address for Resend emails
- `ACCESS_ENFORCEMENT` — set to `shadow` for access-control shadow mode
- `TEST_DATABASE_URL` — PostgreSQL test DB for Vitest repository suites (CI and local)
- `NODE_ENV` — `production` enables secure cookies on login

**Secrets location:**
- Production: operator-supplied `.env` file (referenced by `docker-compose.yml`) or platform env injection (Railway, K8s, etc.)
- Jira credential *names* in PostgreSQL; actual secrets only in environment
- Anthropic key optionally in DB `settings` table (masked in `GET /api/config`)
- Verification script: `scripts/verify-credential-cutover.ts` (requires live `DATABASE_URL`; run with `npx tsx --env-file=.env.local`)

## Integration Error Handling

**Normalized errors:**
- `IntegrationError` class in `lib/integrations/errors.ts` — kinds: `timeout`, `auth`, `upstream`, `validation`, `network`
- HTTP mapping: `integrationErrorResponse()` in `lib/api-errors.ts` (used by Jira, Anthropic, Resend routes)
- Fetch timeout wrapper: `withFetchTimeout()` — 15s for Jira/Resend; Anthropic uses SDK's 120s timeout

**Credential resolution (single entry point):**
- `lib/integrations/credentials.ts` — the only module under `lib/integrations/` that imports repositories
- Precedence preserved per integration:
  - Jira: DB config row → `process.env[name]`
  - Anthropic: `process.env.ANTHROPIC_API_KEY` → DB `settings.anthropic_api_key`
  - Resend: `process.env.RESEND_API_KEY` only

## Webhooks & Callbacks

**Incoming:**
- None — no webhook receiver routes detected

**Outgoing:**
- None — all external calls are request/response (fetch/SDK); no outbound webhook subscriptions

## Export Integrations (Local Generation)

These produce files server-side without external API calls:

| Format | Library | Route | Module |
|--------|---------|-------|--------|
| Word (.docx) | `docx` | `app/api/export/word/[id]/[type]/route.ts` | `lib/export/word.ts` |
| Excel (.xlsx) | `exceljs` | `app/api/export/excel/[id]/route.ts` | `lib/export/excel.ts` |
| PowerPoint (.pptx) | `pptxgenjs` | `app/api/export/ppt/[id]/route.ts` | `lib/export/ppt.ts` |
| Weekly report | — | `app/api/export/weekly-report/[id]/route.ts` | — |
| Resource plan | — | `app/api/export/resource-plan/[id]/route.ts` | — |
| Portfolio members | — | `app/api/export/portfolio/members/route.ts` | — |

Client-side PDF/image capture uses `jspdf` and `html-to-image` in report UI components.

## Public Unauthenticated Endpoints

Routes bypassed by `proxy.ts` session check (`PUBLIC` list in `proxy.ts`):
- `/login`, `/landing`
- `/api/auth/*` — login, logout, me
- `/api/health` — health check (`app/api/health/route.ts` returns `{ ok: true }`)
- `/api/demo-requests` — demo request submission (`app/api/demo-requests/route.ts`)

---

*Integration audit: 2026-08-25*
