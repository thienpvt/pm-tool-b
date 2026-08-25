# Phase 3: Integration Clients - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (recommended answers accepted as default per user instruction)

<domain>
## Phase Boundary

All external calls — Jira Cloud REST, Anthropic, Resend — go through one dedicated client module each under `lib/integrations/`, with an explicit request timeout, a normalized error type, and boundary validation of the parts callers actually consume. One credential resolver replaces the two divergent lookup patterns (Jira's env-var-names-in-DB, Anthropic's env-then-DB fallback) without changing any tenant's effective configuration.

In scope: `lib/integrations/{jira,anthropic,resend}/client.ts`, `lib/integrations/credentials.ts`, `lib/integrations/errors.ts`, adding `zod`, rewriting the 9 route files that currently call out directly, and tests per client.

Out of scope: auth/authorization changes on those routes (Phase 5/6), moving business logic into services (Phase 4), model upgrades, new Jira endpoints, retry/backoff policy.

</domain>

<decisions>
## Implementation Decisions

### Client Shape & Credentials
- Named function exports per operation — `searchIssues()`, `listFields()`, `testConnection()`, `createMessage()`, `sendEmail()`. No classes. Mirrors the Phase 2 repository convention.
- One credential resolver at `lib/integrations/credentials.ts` exposing `resolveCredentials(kind, companyId)` returning typed credentials or `null`. Single module, per-integration branches inside.
- **Precedence is preserved exactly per integration — the interface unifies, the order does not.** Jira: read `company_jira_config` for env var *names*, then `process.env[name]`. Anthropic: `process.env.ANTHROPIC_API_KEY` first, then `settings.anthropic_api_key` from DB. Resend: `process.env.RESEND_API_KEY` only. INTG-08 forbids behavior drift; changing precedence would silently break a configured tenant.
- The two Anthropic variants in the current code (`env || dbKey` vs `if (!env) db`) are equivalent except when the env var is set to an empty string; the resolver adopts the `env || db` form and treats empty-string as unset. This is the only intentional normalization.
- The caller (route, later service) resolves credentials and passes values into the client. A client never imports a repository — INTG-09.

### Errors, Timeouts, Validation
- Normalized error: `IntegrationError` class in `lib/integrations/errors.ts` with `kind: 'timeout' | 'auth' | 'upstream' | 'validation' | 'network'`, plus `service`, optional upstream `status`, and `cause`.
- Timeouts: `AbortController` + `signal` for Jira and Resend `fetch`; the Anthropic SDK's own `timeout` option for Anthropic. Jira/Resend 15s. Anthropic 120s — report generation is legitimately slow and a shared 15s would break working features.
- HTTP mapping lives in `lib/api-errors.ts` as a new `integrationErrorResponse(e)` alongside the existing `repoErrorResponse`. This keeps `next/server` out of `lib/integrations/`, exactly as Phase 2 kept it out of `lib/repositories/`.
- Add `zod` as a dependency (not currently installed). Validate only the fields callers actually consume — Jira issue and field shapes, Anthropic text-block output — not full upstream response schemas. Over-strict schemas turn a harmless upstream addition into an outage.

### Behavior Preservation & Tests
- Existing user-facing error strings and codes are preserved verbatim, including the Vietnamese ones (`Lỗi kết nối Jira: …`, `chưa cấu hình`) and `NO_API_KEY` / `NO_RESEND_KEY`. Behavior freeze — the milestone changes structure, not what a user sees.
- Existing HTTP status choices are preserved: 503 for missing credentials, upstream status pass-through for Jira, 502 for Resend upstream failure, 500/502 as currently used for Anthropic.
- Hardcoded model IDs move to `lib/integrations/anthropic/models.ts` as named constants with the same values (`claude-opus-4-7`, `claude-sonnet-4-6`). No model upgrades in this phase.
- A validation failure logs and throws `IntegrationError{kind:'validation'}` → 502 to the caller. Never return a partial or silently-wrong value (INTG-05, INTG-06).
- Tests mock `fetch` (Jira, Resend) and the SDK (Anthropic). No network, no database. Each client gets a malformed-response case per INTG-10.
- Per HYG-01, the credential-resolver cutover is committed separately from the client extraction, so a tenant-config regression bisects to one commit.

### Claude's Discretion
- Order of integration migration (Resend is smallest, Jira is riskiest — suggested order: Resend → Anthropic → Jira).
- Internal file layout within each integration directory (e.g. whether schemas live in `schemas.ts` or inline).
- Whether the Jira `FIELDS` list and customfield IDs move into a constants module or stay at the client's call site.
- How INTG-08's "verified per configured company" is evidenced — a read-only script that enumerates `company_jira_config` rows and reports which resolve successfully under both old and new paths is acceptable.

</decisions>

<code_context>
## Existing Code Insights

### Current call sites (survey, 2026-08-10)

**Jira — 4 routes, raw `fetch`, no timeout.** Credential resolution is duplicated verbatim in 3 of them:
```ts
const cfg = await companyJiraConfig(user.company_id);
if (!cfg?.base_url_var || !cfg?.email_var || !cfg?.token_var) return null;
const baseUrl = process.env[cfg.base_url_var]?.replace(/\/$/, '');
const email   = process.env[cfg.email_var];
const token   = process.env[cfg.token_var];
// auth: 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64')
```
- `app/api/jira/search/route.ts` — POST `/rest/api/3/search/jql`, cursor pagination, hardcoded FIELDS incl. customfield IDs
- `app/api/jira/fields/route.ts` — GET `/rest/api/3/field`
- `app/api/jira/test/route.ts` — GET/POST `/rest/api/3/myself`; admin may pass un-saved var names in the body
- `app/api/jira/sync-mappings/route.ts` — DB only, no external call

**Anthropic — 5 routes**, each constructing `new Anthropic({ apiKey })` and calling `messages.create`, no timeout:
- `app/api/projects/[id]/report/route.ts` — `claude-opus-4-7`, max_tokens 1024
- `app/api/projects/[id]/project-report/route.ts` — `claude-opus-4-7`, max_tokens 1200
- `app/api/projects/[id]/project-report/generate-email/route.ts` — `claude-sonnet-4-6`, max_tokens 3000
- `app/api/portfolio/report/route.ts` — `claude-opus-4-7`, max_tokens 2000
- `app/api/portfolio/report/generate-email/route.ts` — `claude-opus-4-7`, max_tokens 3500

**Resend — 1 route:** `app/api/portfolio/report/send-email/route.ts` — POST `https://api.resend.com/emails`, Bearer auth; `MAIL_FROM` falls back to `'PMO Reports <onboarding@resend.dev>'`.

### Reusable Assets
- `lib/api-errors.ts` — `repoErrorResponse(e)`; the exact pattern to extend for integrations. Deliberately outside `lib/repositories/` so repos never import `next/server`.
- `lib/repositories/jira-config.repo.ts` — `companyJiraConfig()` / `setCompanyJiraConfig()`.
- `lib/repositories/settings.repo.ts` — `getSetting()` / `setSetting()` for `anthropic_api_key`.
- Phase 1 test harness: Vitest, `test/db.ts`, `test/repo-db.ts`. Mocked-unit suites (`*.unit.test.ts`) run without a database — the right model for integration client tests.

### Established Patterns
- Named function exports, no classes (Phase 2 repositories).
- Typed error thrown from the pure layer, mapped to HTTP at the route edge (`UnknownColumnError` → `repoErrorResponse`).
- `lib/` never imports from `app/`; the pure layer never imports `next/server`.
- `@/` alias for all app-root imports.

### Integration Points
- 9 route files change. Each keeps its current auth checks untouched — auth is Phase 5/6.
- `app/api/config/route.ts` masks the Anthropic key (`***`, `anthropic_api_key_set`) and must keep working after the resolver lands.
- `next.config.ts` `serverExternalPackages` (`exceljs`, `pptxgenjs`) is unaffected but must not be disturbed.

### Known Traps
- No timeouts exist anywhere today; adding them is a real behavior change and can surface latent slow-call bugs. Anthropic report generation genuinely runs long — do not apply a short shared timeout.
- `zod` is absent from `package.json` and must be added; `package-lock.json` mentions it only as a transitive peer range.
- `app/api/jira/test/route.ts` accepts env var names from the request body for admins — the resolver must not assume names always come from the database.
- Empty-string env vars are the one place where the two Anthropic resolution variants disagree.

</code_context>

<specifics>
## Specific Ideas

- STATE.md blocker, carried in verbatim: "Credential resolver unification (Phase 3, INTG-07/08) risks silently breaking a tenant's Jira or Anthropic config if precedence order changes — verify every configured company before deleting old paths." The resolution above is to preserve per-integration precedence exactly and to evidence per-company resolution before the old code is removed.
- Deletion of the old inline credential code is a separate, later commit than the resolver's introduction, so both paths are briefly live and comparable.

</specifics>

<deferred>
## Deferred Ideas

- Retry/backoff and circuit-breaking on integration failures — not required by any INTG requirement; revisit after the clients exist.
- Anthropic model upgrades and a per-company model setting — behavior freeze this milestone.
- Streaming Anthropic responses — would change the API surface the UI consumes.
- Caching Jira field metadata — performance work, already deferred to v2 (PERF-01/02/03).
- Moving `lib/auth.ts` session SQL into a repository — noted during Phase 2, out of scope here.

</deferred>
