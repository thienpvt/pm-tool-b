# Codebase Concerns

**Analysis Date:** 2026-08-25

## Tech Debt

**Operations and admin routes bypass the service layer (SVC-01 / ROUTE-05 remainder):**
- Issue: Most project/portfolio routes call `lib/services/*`; operations, admin, config, import-mapping, Jira preset/sync, demo-requests, auth, and some export routes still import repositories directly from route handlers.
- Files: `app/api/operations/systems/**/*.ts` → `lib/repositories/operations.repo.ts`; `app/api/admin/**/*.ts` → `lib/repositories/admin.repo.ts`, `lib/repositories/jira-config.repo.ts`, `lib/repositories/rag-config.repo.ts`; `app/api/config/route.ts` → `lib/repositories/settings.repo.ts`; `app/api/import-mapping/**/*.ts`, `app/api/bug-import-mapping/**/*.ts` → `lib/repositories/import-mapping.repo.ts`; `app/api/jira/jql-presets/**/*.ts`, `app/api/jira/sync-mappings/route.ts` → `lib/repositories/jira-config.repo.ts`; `app/api/demo-requests/route.ts` → `lib/repositories/demo-requests.repo.ts`; `app/api/resources/route.ts` → `lib/repositories/resources.repo.ts`
- Impact: Business rules and tenant checks live in route files or repos inconsistently; harder to test and extend; new ops/admin endpoints tend to skip the service-layer pattern established in Phase 4.
- Fix approach: Introduce thin `lib/services/operations.service.ts`, `admin.service.ts`, etc.; routes become wrappers only. Prioritize operations (multi-table writes) and admin (privilege-sensitive).

**Four mapping tables lack `company_id` (TENANT-01 — accepted v1.0 debt, v2 Phase 9 scope):**
- Issue: `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, and `jira_sync_mappings` are global tables. Repos and routes list/create/delete without company filter even though handlers are session-gated.
- Files: Schema in `lib/db.ts`; repos in `lib/repositories/import-mapping.repo.ts`, `lib/repositories/jira-config.repo.ts` (`listJqlPresets`, `createJqlPreset`, `listRecentJiraSyncMappings`); routes `app/api/import-mapping/**/*.ts`, `app/api/bug-import-mapping/**/*.ts`, `app/api/jira/jql-presets/**/*.ts`, `app/api/jira/sync-mappings/route.ts`
- Impact: Authenticated user in company A can read, overwrite, or delete import/Jira templates belonging to company B (IDOR at authenticated-user level). Phase 6 closed anonymous access; company isolation is the remaining gap.
- Fix approach: v2 Phase 9 — add `company_id` column + migration, scope all repo queries, add cross-company 403 tests.

**Proxy returns HTML 307 for unauthenticated API callers (accepted v1.0 debt):**
- Issue: `proxy.ts` redirects any non-`PUBLIC` path without a `pm_session` cookie to `/login?from=<path>` with HTTP 307. API clients expecting JSON `{ error: 'Unauthorized' }` with 401 receive an HTML login redirect instead.
- Files: `proxy.ts` (lines 29–34 redirect branch); confirmed live in `.planning/milestones/v1.0-phases/06-access-enforcement-rollout/06-PROXY-FINDING.md` (Test 2: `/api/portfolio` → 307)
- Impact: Programmatic clients, curl scripts, and misconfigured fetch calls without credentials get HTML, not JSON; monitoring may misread 307 as success path. Route-level `withAuth` still returns proper 401 when the request reaches the handler (e.g. stale cookie).
- Fix approach: In `proxy.ts`, branch on `pathname.startsWith('/api/')` → return `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` instead of redirect. Deferred from v1.0 per `STATE.md`.

**HYG-02 Anthropic status split (502 vs 500) — operator confirmation pending:**
- Issue: Malformed Anthropic responses on report routes now return 502 (`kind: 'validation'`) where pre-Phase-3 code returned 500. Upstream/timeout/network on the three GET report routes still use `force500: true` → 500; generate-email routes use 502.
- Files: `lib/api-errors.ts` (`integrationErrorResponse`, validation branch at lines 139–141); `app/api/portfolio/report/route.ts`, `app/api/projects/[id]/report/route.ts`, `app/api/projects/[id]/project-report/route.ts` (pass `{ force500: true }`)
- Impact: Dashboards or alerts keyed on HTTP 500 for AI failures may miss validation failures (now 502). Behavior is intentional (INTG-06) but needs operator sign-off.
- Fix approach: Confirm monitoring/alerting tolerates 502; document status contract in runbook. No code change unless operators require revert.

**God-page decomposition remainder (Phase 7 targets done; other large pages remain):**
- Issue: Phase 7 decomposed the worst offenders (`app/portfolio/report/page.tsx` ~129 lines, `app/projects/[id]/timeline/page.tsx` ~257 lines, `app/projects/[id]/report/page.tsx`, `app/projects/[id]/milestones/page.tsx`, `app/portfolio/roadmap/page.tsx`, `components/timeline/ImportMappingDialog.tsx` ~317 lines with `_components/` split). Many feature pages remain 700–1170 lines with inline fetch, state, and dialogs.
- Files: `app/projects/[id]/documents/page.tsx` (~1171), `app/portfolio/budget/page.tsx` (~1100), `app/projects/[id]/dashboard/page.tsx` (~1027), `app/projects/[id]/budget/page.tsx` (~995), `app/projects/[id]/bugs/page.tsx` (~919), `app/resources/page.tsx` (~899), `components/jira/JiraSyncDialog.tsx` (~877), `app/projects/[id]/reports/page.tsx` (~872), `app/portfolio/resources/page.tsx` (~863), `app/admin/page.tsx` (~709)
- Impact: Higher regression risk on changes; no unit-test seams for table/dialog logic buried in pages.
- Fix approach: Apply Phase 7 pattern — extract `use*Page` hooks, `_components/` subfolders, keep pages as composition shells. Prioritize documents and budget (largest).

**SQLite-dialect SQL over PostgreSQL adapter:**
- Issue: Application SQL uses `?` placeholders and `INSERT OR IGNORE`; `PostgresClient` in `lib/db.ts` rewrites at runtime via `toPositional`, `needsReturningId`, and `noIdTables` allowlist.
- Files: `lib/db.ts` (`PostgresClient`, `toPositional`, `run`, `migratePostgresSchema`)
- Impact: New INSERT patterns or non-`id` primary keys can break silently or return wrong `lastInsertRowid`. Every repo must follow conventions the adapter expects.
- Fix approach: Write native `$n` SQL or adopt a query builder (ENF-02 deferred); stop growing dialect translation.

**Schema init and migrations on every cold `getDb()`:**
- Issue: First request after process start runs `initPostgresSchema`, a large `migratePostgresSchema` loop, `backfillWeightedCompletion`, and `seedAuthData`.
- Files: `lib/db.ts` (`getDb`, `migratePostgresSchema`, `seedAuthData`, `backfillWeightedCompletion`)
- Impact: Slow cold start; data-fix UPDATEs run as inline migrations; schema evolution mixed with application boot.
- Fix approach: External versioned migration job (DATA-01..03 deferred); app connects only.

**Portfolio summary RAG diverges from `lib/rag.ts`:**
- Issue: `lib/services/portfolio.service.ts` uses inline thresholds (`open_risks >= 3` → red, `days_until_deadline <= 14` → amber) extracted verbatim from the pre-refactor route. Report routes and project views use `lib/rag.ts:calculateRAG` with per-company `company_rag_config`.
- Files: `lib/services/portfolio.service.ts` (comments at lines 43–45, 72–79); `lib/rag.ts`
- Impact: Portfolio dashboard RAG badges can disagree with project report RAG for the same project.
- Fix approach: Reconcile via shared `calculateRAG` call — tracked as HYG-02 behavior change; needs dedicated commit and UAT.

**AI/report routes use `rawBody` instead of Zod schemas (ROUTE-06 remainder):**
- Issue: Multipart and large JSON report/generate-email routes skip `withAuth` schema validation and parse bodies manually.
- Files: `app/api/portfolio/report/route.ts`, `app/api/portfolio/report/generate-email/route.ts`, `app/api/projects/[id]/report/route.ts`, `app/api/projects/[id]/project-report/**/*.ts`, export routes with form uploads
- Impact: Shape validation is ad hoc; malformed bodies handled per-route (some return 400, others may 500).
- Fix approach: Add Zod schemas where body shape is stable; keep `rawBody: true` only for true multipart.

**Default seed credentials in source:**
- Issue: Empty database seeds `admin` / `Khang@19` and `ct_user1` / `Ctech@26`.
- Files: `lib/db.ts` (`seedAuthData`, lines 557–565)
- Impact: Fresh deploys expose known default logins until passwords changed.
- Fix approach: Dev-only seed gate; env-driven bootstrap password; force change on first login.

## Known Bugs

**`app/api/resources/route.ts` still leaks errors via `String(e)`:**
- Symptoms: Unexpected failures return `{ error: "<raw exception text>" }` with 500.
- Files: `app/api/resources/route.ts` (line 12)
- Trigger: Any thrown error in `listResourceMembers`.
- Workaround: None. Also returns `[]` with 401 instead of a standard `{ error: 'Unauthorized' }` body.

**`lib/log.test.ts` breaks the Vitest suite:**
- Symptoms: `npm test` reports `No test suite found in file lib/log.test.ts` — 1 failed suite despite 727 passing tests.
- Files: `lib/log.test.ts` (tsx self-check script, not Vitest); picked up by `vitest.config.ts` include pattern `{lib,app}/**/*.test.ts`
- Trigger: Any CI run of `npm test` (`.github/workflows/test.yml`).
- Workaround: Rename to `lib/log.self-check.ts` or exclude from Vitest include.

**PDF export via `document.write` blocks the browser tab:**
- Symptoms: Opening print/PDF flow hangs the tab waiting for print dialog.
- Files: `app/projects/[id]/report/useProjectReportPageActions.ts` (line 118); `app/projects/[id]/milestones/useMilestonesActions.ts` (line 202)
- Trigger: User clicks PDF/print export on project report or milestones.
- Workaround: Use HTML download instead. Preserved under HYG-02 behavior freeze in Phase 7 UAT.

**Jira search debug logging in production path:**
- Symptoms: Every successful search logs all custom field IDs and values from the first issue.
- Files: `app/api/jira/search/route.ts` (lines 46–52)
- Trigger: Any authenticated Jira search returning at least one issue.
- Workaround: None in code; noisy logs and potential data leakage in log aggregators.

**Jira search `req.json()` unguarded:**
- Symptoms: Malformed JSON body throws before try/catch → bare 500.
- Files: `app/api/jira/search/route.ts` (line 26)
- Trigger: POST with invalid JSON.
- Workaround: Client must send valid JSON. Contrast with `app/api/jira/test/route.ts` which guards parse.

**Jira search `extraFields` not validated as `string[]`:**
- Symptoms: Non-array or non-string entries passed through to Jira client.
- Files: `app/api/jira/search/route.ts` (lines 27–32, 43)
- Trigger: Client sends `extraFields: "summary"` or nested objects.
- Workaround: Send correct shape from UI (`components/jira/JiraSyncDialog.tsx`).

**UI hooks treat 401/403 JSON as data:**
- Symptoms: Some pages call `res.json().then(setState)` without checking `res.ok`; error body becomes table rows.
- Files: `app/projects/[id]/resources/page.tsx` (line 263), `app/projects/[id]/communication/page.tsx` (line 27)
- Trigger: Session expiry or 403 during inline create.
- Workaround: Re-login; fragile UX.

**Project report send-email posts to portfolio route:**
- Symptoms: Project report email flow calls `/api/portfolio/report/send-email` (session-only gate, no project access check).
- Files: `app/projects/[id]/report/useProjectReport.ts` (line 83); `app/api/portfolio/report/send-email/route.ts`
- Trigger: Any authenticated user sends email from project report page.
- Workaround: Low risk (email content is client-built); inconsistent with project-scoped patterns.

## Security Considerations

**Proxy cookie-presence gate is not session validation:**
- Risk: `proxy.ts` only checks `pm_session` cookie exists — not valid/unexpired in DB.
- Files: `proxy.ts` (line 8); real validation in `lib/auth.ts:getSessionFromRequest` and route wrappers
- Current mitigation: Route-level `withAuth` / `withProjectAccess` on protected APIs; two-layer model documented in `06-PROXY-FINDING.md`.
- Recommendations: Keep route wrappers mandatory for all new routes; do not rely on proxy alone.

**Mapping-table cross-tenant IDOR (authenticated):**
- Risk: Any logged-in user can CRUD another tenant's import/Jira mapping templates by ID.
- Files: See TENANT-01 files above
- Current mitigation: Session required (Phase 6); no company filter.
- Recommendations: Phase 9 migration + scoped queries.

**Config POST accepts arbitrary settings keys:**
- Risk: Admin POST iterates all body keys into `settings` table without key allowlist.
- Files: `app/api/config/route.ts` (lines 32–34); `lib/repositories/settings.repo.ts:setSetting`
- Current mitigation: `withAuth` + `is_admin` 403; GET masks `anthropic_api_key`.
- Recommendations: Allowlist keys (`anthropic_api_key`, known settings only).

**DB TLS verification disabled when SSL enabled:**
- Risk: `resolveSsl` returns `{ rejectUnauthorized: false }` for non-LAN hosts when `sslmode` is not `disable`.
- Files: `lib/db.ts` (`resolveSsl`, lines 577–590)
- Current mitigation: LAN/internal hosts can disable SSL entirely.
- Recommendations: Use proper CA for managed Postgres; set `sslmode=verify-full` with CA bundle when available.

**No rate limiting on auth, demo, or LLM routes:**
- Risk: Brute-force login, demo-request spam, unbounded Anthropic spend.
- Files: `app/api/auth/login/route.ts`, `app/api/demo-requests/route.ts`, `app/api/portfolio/report/route.ts`, generate-email routes; `proxy.ts` PUBLIC list includes `/api/demo-requests`
- Current mitigation: scrypt password hashing (`lib/auth.ts`); required fields on demo schema.
- Recommendations: Edge rate limit or middleware counter; captcha on demo intake.

**Session lifecycle gaps:**
- Risk: Sessions expire after 7 days but expired rows are never purged; no logout-all; no idle timeout.
- Files: `lib/auth.ts` (`createSession`, `deleteSession` — single-session delete only)
- Current mitigation: Expiry checked on read (`getSessionUser` WHERE `expires_at > now`).
- Recommendations: Scheduled `DELETE FROM sessions WHERE expires_at < now()` job.

**Jira credentials resolved from process env var names:**
- Risk: `company_jira_config` stores env var *names*; tokens live in process environment — shared across companies if misconfigured.
- Files: `lib/integrations/credentials.ts`, `lib/repositories/jira-config.repo.ts`, `app/api/jira/search/route.ts`
- Current mitigation: Per-company var name mapping; session + `company_id` required.
- Recommendations: Per-company encrypted token storage or secret manager.

**`.env` file present locally:**
- Risk: Local environment configuration (existence only — contents not inspected).
- Files: `.env` (gitignored); `docker-compose.yml` references `env_file: .env`
- Current mitigation: Listed in `.gitignore`.
- Recommendations: Never commit; use secret store in production.

## Performance Bottlenecks

**Cold start schema/migrate/seed:**
- Problem: First request after deploy pays full migration + seed cost.
- Files: `lib/db.ts` (`getDb`)
- Cause: Inline migrations in application boot path.
- Improvement path: Separate migrate step (PERF/DATA deferred).

**Portfolio report and LLM generation:**
- Problem: Large portfolio JSON assembled in one request; Anthropic calls with high `max_tokens` and 120s SDK timeout.
- Files: `app/api/portfolio/report/route.ts`, `lib/services/portfolio-report.service.ts`, `app/api/portfolio/report/generate-email/route.ts`
- Cause: Monolithic aggregation + synchronous LLM wait.
- Improvement path: Cache snapshots; stream responses; queue jobs (PERF-03 deferred).

**Client-heavy pages without virtualization:**
- Problem: 900–1100 line pages render full tables client-side.
- Files: `app/portfolio/budget/page.tsx`, `app/projects/[id]/documents/page.tsx`, `app/projects/[id]/bugs/page.tsx`, others listed above
- Cause: All state and rows in one component; limited evidence of row virtualization.
- Improvement path: Virtualize grids; server components for static chrome (PERF-01/02 deferred).

**Excel workbook full load in request handlers:**
- Problem: ExcelJS loads entire workbook into memory on import/export.
- Files: `lib/export/excel.ts`, `app/api/parse-file-headers/route.ts`, import routes
- Cause: Synchronous parse in Node request thread.
- Improvement path: Max upload size middleware; worker process for large files.

## Fragile Areas

**PostgresClient dialect bridge:**
- Files: `lib/db.ts`
- Why fragile: String rewrites for `OR IGNORE`, `?` → `$n`, RETURNING id; `noIdTables` allowlist for tables without serial `id`.
- Safe modification: Extend allowlist with integration test per new INSERT pattern; read `lib/db.test.ts` before changing adapter.
- Test coverage: `lib/db.test.ts` exists; adapter edge cases partially covered.

**Import / mapping pipelines:**
- Files: `components/timeline/ImportMappingDialog.tsx`, `components/timeline/_components/importLogic.ts`, `app/api/projects/[id]/activities/import/route.ts`, `app/api/parse-file-headers/route.ts`
- Why fragile: Multi-step wizard + CSV/Excel parsing; column mapping errors corrupt activity plans silently.
- Safe modification: Golden-file fixtures; transaction-wrap imports; run `components/timeline/ImportMappingDialog.component.test.tsx`.
- Test coverage: Component test exists; no end-to-end import golden files.

**RAG scoring edge cases:**
- Files: `lib/rag.ts`, `lib/services/portfolio.service.ts` (inline divergent copy)
- Why fragile: Date strings append `T00:00:00` / `T23:59:59` (local semantics); Closing phase always green; SPI null until 10% elapsed.
- Safe modification: Unit tests before changing thresholds — `lib/status-weights.test.ts` and service tests exist for some paths.
- Test coverage: Partial — portfolio inline RAG not tested against `calculateRAG`.

**Access-control wrapper consistency:**
- Files: `lib/http/with-auth.ts`, `lib/http/with-project-access.ts`, `lib/http/with-program-access.ts`
- Why fragile: New routes that copy old hand-rolled `getSessionFromRequest` patterns skip company scope; ops/admin routes use manual checks.
- Safe modification: Always wrap with `withAuth` / `withProjectAccess`; copy from `app/api/projects/[id]/route.ts`; run `lib/http/route-401-matrix.test.ts`.
- Test coverage: 401 matrix test exists; not every route permutation covered.

## Scaling Limits

**Single-process connection pool:**
- Current capacity: Module singleton `_client` in `lib/db.ts`; one pool per Node process.
- Limit: Horizontal scale multiplies pools against Postgres `max_connections`.
- Scaling path: Set pool `max` per pod; external connection pooler (PgBouncer); move migrations off boot.

**LLM cost and latency:**
- Current capacity: On-demand Claude calls per user action on report pages.
- Limit: Unbounded concurrent generates; large prompts for full portfolio context.
- Scaling path: Per-user rate limits; queue; cheaper model tier for drafts.

**File parse memory:**
- Current capacity: Full workbook in request memory.
- Limit: Large uploads can OOM the Node worker.
- Scaling path: File size limits; streaming parse; background workers.

## Dependencies at Risk

**Next.js 16.2.4 + React 19:**
- Risk: Proxy/middleware naming changed in Next 16; training data may not match installed APIs.
- Impact: Auth edge behavior, App Router conventions, build breaks on upgrade.
- Migration plan: Read `node_modules/next/dist/docs/` before middleware changes; CI build on every PR (`.github/workflows/test.yml`, `docker-build.yml`).

**jspdf ^2.5.1:**
- Risk: Older major in PDF ecosystem; verify CVE status before public exposure.
- Impact: Any client-side PDF generation paths.
- Migration plan: Audit usage; upgrade or replace when PDF export is next touched.

**Custom auth (no Auth.js/OIDC):**
- Risk: Session fixation, rotation, and SSO patterns maintained manually.
- Impact: Security maintenance burden on `lib/auth.ts`.
- Migration plan: Keep custom for v2 unless SSO required; then evaluate Auth.js.

## Missing Critical Features

**External migration tooling:**
- Problem: Migrations live in `lib/db.ts` application code.
- Blocks: Safe schema evolution without redeploy side effects (DATA-01..03 deferred).

**Central authorization for non-project routes:**
- Problem: Ops/admin/import routes use ad hoc session checks.
- Blocks: Confident multi-tenant SaaS hardening beyond project scope.

**Production observability product:**
- Problem: Errors logged via `console.error`; no Sentry/Datadog integration.
- Blocks: Incident diagnosis at scale; `lib/log.ts` provides request-id correlation only.

**E2E test suite:**
- Problem: Vitest unit/component tests only; no Playwright in CI.
- Blocks: Full user-flow regression detection (Phase 7 UAT used manual Playwright MCP).

**Proxy JSON 401 for API paths:**
- Problem: API clients get HTML redirect, not JSON error.
- Blocks: Clean machine-to-machine integration without session cookie.

## Test Coverage Gaps

**Cross-tenant mapping tables (TENANT-01):**
- What's not tested: Company A cannot read/delete company B's timeline/bug/Jira mapping rows.
- Files: `app/api/import-mapping/**/*.ts`, `app/api/bug-import-mapping/**/*.ts`, `app/api/jira/jql-presets/**/*.ts`
- Risk: IDOR ships until Phase 9; authenticated cross-tenant abuse unnoticed.
- Priority: High (Phase 9)

**Operations route service-layer behavior:**
- What's not tested: Business rules embedded in `app/api/operations/**` handlers (if any grow beyond CRUD).
- Files: `app/api/operations/systems/**/*.ts`
- Risk: Regressions when ops features expand.
- Priority: Medium

**Large UI pages (documents, budget, bugs):**
- What's not tested: No component tests for pages still 900+ lines.
- Files: `app/projects/[id]/documents/page.tsx`, `app/portfolio/budget/page.tsx`, `app/projects/[id]/bugs/page.tsx`
- Risk: UI regressions on refactor.
- Priority: Medium

**Portfolio inline RAG vs `calculateRAG`:**
- What's not tested: Same project inputs produce different RAG on portfolio dashboard vs report.
- Files: `lib/services/portfolio.service.ts`, `lib/rag.ts`
- Risk: Executives see inconsistent status.
- Priority: Medium

**RAG boundary conditions:**
- What's not tested: SPI at exactly 0.6/0.8, deadline at day 0/14, Closing phase override.
- Files: `lib/rag.ts`
- Risk: Wrong RAG color at thresholds.
- Priority: Medium (partial coverage elsewhere)

**Import/export golden files:**
- What's not tested: Real Excel/CSV workbooks through full import pipeline.
- Files: `lib/export/excel.ts`, `app/api/parse-file-headers/route.ts`
- Risk: Silent bad imports on edge-case spreadsheets.
- Priority: Medium

**E2E flows:**
- What's not tested: Login → project → timeline import → report export in automated CI.
- Files: N/A
- Risk: Integration breaks between layers.
- Priority: Low (manual UAT done for v1.0)

---

*Concerns audit: 2026-08-25*
