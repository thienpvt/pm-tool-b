# Codebase Concerns

**Analysis Date:** 2026-08-29

## Tech Debt

**D-23: Operations and admin routes bypass sanctioned auth wrappers (accepted v2.1 design):**
- Issue: Operations and platform-admin routes use hand-rolled `getSessionFromRequest` + manual 401/403 checks instead of `withCpmo`, `withRole`, or `withAuth`. ESLint `require-auth-wrapper` only applies to project-scoped `app/api/**/route.ts` files; module backend routes are not covered.
- Files: `modules/operations/backend/routes/operations/systems/**/*.ts`, `modules/admin/backend/routes/admin/companies/route.ts`, `modules/admin/backend/routes/admin/demo-requests/route.ts`, `modules/admin/backend/routes/admin/rag-config/[companyId]/route.ts`; allowlist in `eslint/route-wrapper-allowlist.json`
- Impact: New ops/admin endpoints can copy the manual pattern and miss role or tenant checks; inconsistent with project routes that use `withProjectAccess` / `withAuth`.
- Fix approach: Keep D-23 carve-out only where spec requires session+tenant without CPMO; migrate other admin routes to `withRole` when SSO/role matrix expands. Extend ESLint or a module-split contract test to flag new manual-session routes outside the allowlist.

**Dual database access: Kysely repos + legacy `DbClient` for auth:**
- Issue: All module repositories use Kysely via `lib/db/kysely.ts`, but `lib/auth.ts` still calls `getDb()` and writes SQLite-dialect SQL (`?` placeholders, `INSERT OR IGNORE`) through `PostgresClient` in `lib/db.ts`.
- Files: `lib/auth.ts`, `lib/db.ts` (`PostgresClient`, `toPositional`, `needsReturningId`, `noIdTables`), `lib/db/kysely.ts`
- Impact: Two query paths share one pool but different translation rules; auth SQL changes must respect the dialect bridge and `noIdTables` allowlist. ENF-02 (native `$n` SQL everywhere) remains deferred.
- Fix approach: Migrate session CRUD in `lib/auth.ts` to Kysely + `lib/repositories/auth.repo.ts`; retire `DbClient` once seed-only boot path is isolated.

**PostgresClient dialect bridge (auth and seed only):**
- Issue: `PostgresClient` rewrites `?` → `$n`, `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`, and appends `RETURNING id` except for tables in `noIdTables`.
- Files: `lib/db.ts` (lines 18–34, 48–53)
- Impact: Any new INSERT into a table without serial `id` must be added to `noIdTables` or runtime fails (historical example: `company_rag_config` PK is `company_id`).
- Fix approach: Extend allowlist with integration test per new table; prefer Kysely for new writes.

**Portfolio summary RAG diverges from `lib/rag.ts` (HYG-02 deferred):**
- Issue: `getPortfolioSummary` in `modules/portfolio/backend/services/portfolio.service.ts` uses inline thresholds (`open_risks >= 3` → red, `days_until_deadline <= 14` → amber) extracted verbatim from the pre-refactor route. Dashboards and reports use `lib/rag.ts:calculateRAG` with per-company `company_rag_config`.
- Files: `modules/portfolio/backend/services/portfolio.service.ts` (lines 44–47, 73–85); `lib/rag.ts`
- Impact: Portfolio home/dashboard RAG badges can disagree with project report RAG for the same project.
- Fix approach: Reconcile via shared `calculateRAG` call in a dedicated HYG-02 commit with UAT; do not silently change inside refactors.

**Large UI pages remain monolithic (Phase 7 pattern not applied everywhere):**
- Issue: Phase 7 decomposed timeline, milestones, roadmap, and report shells; many feature surfaces in `modules/*/ui/` still combine fetch, state, tables, and dialogs in single files (900–1200+ lines).
- Files: `modules/projects/ui/documents/ProjectDocumentsPage.tsx` (~1250), `modules/portfolio/ui/budget/PortfolioBudgetPage.tsx` (~1185), `modules/projects/ui/dashboard/ProjectDashboardPage.tsx` (~1074), `modules/projects/ui/budget/ProjectBudgetPage.tsx` (~1036), `modules/projects/ui/bugs/ProjectBugsPage.tsx` (~967), `modules/portfolio/ui/members/ResourcesMembersPage.tsx` (~948), `modules/admin/ui/AdminPage.tsx` (~919), `modules/portfolio/ui/resources/PortfolioResourcesPage.tsx` (~907), `modules/reports/ui/project-reports-list/ProjectReportsListPage.tsx` (~925), `modules/jira/ui/JiraSyncDialog.tsx` (~938)
- Impact: Higher regression risk; limited unit-test seams for table/dialog logic.
- Fix approach: Apply Phase 7 pattern — extract `use*Page` hooks and `_components/` subfolders; keep page files as composition shells. Prioritize documents, budget, and bugs.

**`eslint-disable @typescript-eslint/no-explicit-any` on extracted services/handlers:**
- Issue: Portfolio, roadmap, and report services/handlers retain file-level `any` suppressions from verbatim route extraction.
- Files: `modules/portfolio/backend/services/portfolio.service.ts`, `modules/portfolio/backend/services/roadmap.service.ts`, `modules/reports/backend/services/portfolio-report.service.ts`, `modules/reports/backend/services/project-report.service.ts`, `modules/reports/backend/routes/projects/[id]/report/handlers.ts`, `modules/reports/backend/routes/projects/[id]/project-report/handlers.ts`
- Impact: Type errors in report payloads and portfolio aggregates are not caught at compile time.
- Fix approach: Introduce typed DTOs incrementally when touching report or portfolio services.

**Duplicate `snapshotsEqual` helper (D-01 plan lock):**
- Issue: Identical local `snapshotsEqual` functions exist in two services for audit-skip logic on milestone/project PATCH.
- Files: `modules/projects/backend/services/projects.service.ts`, `modules/projects/backend/services/milestones.service.ts`
- Impact: Threshold or field-list changes must be edited twice; drift risk.
- Fix approach: Extract shared helper when a non-locking phase allows (v2.1 audit accepted duplicate).

**`listOpenProjectDependencies` exported for contract tests only (D-01):**
- Issue: Named export exists and is locked by NIT-01 contract tests but is not consumed by production dashboard code.
- Files: `modules/projects/backend/repositories/project-dependencies.repo.ts`, `modules/weekly/backend/services/nit-01-exports.contract.test.ts`
- Impact: Dead surface area; confusing for planners searching for dependency UI wiring.
- Fix approach: Wire into PM dashboard or document as intentional test-only export until Phase 16 consumer lands.

**Lint scope limited to `app/api/**/route.ts`:**
- Issue: `npm run lint` runs ESLint only on `app/api/**/route.ts`. Module backend routes, UI, and services rely on Vitest contract tests, not ESLint auth-wrapper enforcement.
- Files: `package.json` (`lint` script), `eslint.config.mjs`
- Impact: New module routes can ship without static auth-wrapper checks.
- Fix approach: Expand lint glob to `modules/**/routes/**/route.ts` or add module-split contract tests for every new route file.

**AI/report routes use `rawBody: true` instead of automatic Zod validation:**
- Issue: Multipart and large JSON report/generate-email/import routes skip auto `req.json()` parsing; handlers validate bodies manually.
- Files: `app/api/projects/[id]/project-report/route.ts`, `app/api/projects/[id]/report/route.ts`, `app/api/portfolio/report/generate-email/route.ts`, `app/api/export/ppt/[id]/route.ts`, `modules/jira/backend/routes/parse-file-headers/route.ts`
- Impact: Shape validation is ad hoc; malformed bodies handled per-route.
- Fix approach: Add Zod schemas where body shape is stable; keep `rawBody: true` only for true multipart.

**Default seed credentials in source:**
- Issue: Empty database seeds `admin` / `Khang@19` and `ct_user1` / `Ctech@26` on first boot via `seedAuthData`.
- Files: `lib/db.ts` (`seedAuthData`, lines 69–87)
- Impact: Fresh deploys expose known default logins until passwords are changed.
- Fix approach: Dev-only seed gate; env-driven bootstrap password; force change on first login.

**Legacy boot tolerance when migration ledger is missing:**
- Issue: `assertMigrated` in `lib/migrate/assertMigrated.ts` warns and allows boot when `schema_migrations` is absent but `companies` exists (pre–Phase 19 databases).
- Files: `lib/migrate/assertMigrated.ts`, `lib/db.ts` (`getDb`)
- Impact: Operators may run without stamping the ledger; drift detection deferred until `npm run migrate`.
- Fix approach: Treat warn path as migration debt; run `npm run migrate` in CI and k8s Job (`k8s-migrate-job.yaml`) before app replicas start.

## Known Bugs

**`modules/portfolio/backend/routes/resources/route.ts` leaks errors via `String(e)`:**
- Symptoms: Unexpected failures return `{ error: "<raw exception text>" }` with 500.
- Files: `modules/portfolio/backend/routes/resources/route.ts` (line 12)
- Trigger: Any thrown error in `listResourceMembers`.
- Workaround: None. Also returns `[]` with 401 instead of standard `{ error: 'Unauthorized' }` (line 8).

**Several list routes return `[]` on 401 instead of error JSON:**
- Symptoms: Unauthenticated GET returns empty array with 401, not `{ error: 'Unauthorized' }`.
- Files: `modules/portfolio/backend/routes/resources/route.ts`, `modules/portfolio/backend/routes/programs/route.ts`, `modules/projects/backend/routes/projects/route.ts`
- Trigger: Session missing or expired on list endpoints.
- Workaround: Clients must check `res.status`, not only parse JSON as data.

**Project report email send requires CPMO but UI calls portfolio send-email route:**
- Symptoms: PM-role users on project report page get 403 when sending email; only CPMO passes `isCpmo` gate on the shared endpoint.
- Files: `modules/reports/ui/project-report/useProjectReport.ts` (line 83, posts to `/api/portfolio/report/send-email`); `modules/reports/backend/routes/portfolio/report/send-email/route.ts` (lines 12–15)
- Trigger: PM user completes project report email flow and clicks send.
- Workaround: Use CPMO account or copy HTML manually. Portfolio report flow works for CPMO.

**PDF export via `document.write` blocks the browser tab:**
- Symptoms: Print/PDF flow opens a new window and blocks until print dialog completes.
- Files: `modules/reports/ui/project-report/useProjectReportPageActions.ts` (line 118); `modules/projects/ui/milestones/useMilestonesActions.ts` (line 202)
- Trigger: User clicks PDF/print export on project report or milestones.
- Workaround: Use HTML download instead. Preserved under HYG-02 behavior freeze.

**UI hooks treat error JSON as success data:**
- Symptoms: Inline create handlers call `res.json().then(setState)` without checking `res.ok`; 401/403 body becomes table rows.
- Files: `modules/projects/ui/resources/ProjectResourcesPage.tsx` (line 262), `modules/projects/ui/communication/ProjectCommunicationPage.tsx` (line 26)
- Trigger: Session expiry or 403 during inline create.
- Workaround: Re-login; fragile UX.

**Public demo-requests POST has unguarded `req.json()`:**
- Symptoms: Malformed JSON throws before handler try/catch → bare 500.
- Files: `app/api/demo-requests/route.ts` (line 6)
- Trigger: POST with invalid JSON to public endpoint (`proxy.ts` PUBLIC list includes `/api/demo-requests`).
- Workaround: Send valid JSON. Contrast with send-email route which guards parse (`modules/reports/backend/routes/portfolio/report/send-email/route.ts` lines 23–27).

**Login route has unguarded `req.json()`:**
- Symptoms: Malformed JSON on login throws → bare 500 via `instrumentation.ts` hook.
- Files: `app/api/auth/login/route.ts` (line 6)
- Trigger: POST with invalid JSON body.
- Workaround: Client must send valid JSON.

**PageChrome + inner `100vh` layouts may double-scroll:**
- Symptoms: Milestones and timeline views set viewport-height inside `PageChrome` main, producing nested scroll regions.
- Files: `modules/projects/ui/milestones/MilestonesPage.tsx` (line 166), `modules/projects/ui/timeline/_components/TimelineTable.tsx` (line 37)
- Trigger: View milestones or timeline on standard layout.
- Workaround: Scroll inner container. Accepted Phase 26 advisory per v2.1 audit.

## Security Considerations

**Proxy cookie-presence gate is not session validation:**
- Risk: `proxy.ts` only checks `pm_session` cookie exists — not valid/unexpired in DB.
- Files: `proxy.ts` (line 8); real validation in `lib/auth.ts:getSessionFromRequest` and route wrappers
- Current mitigation: Route-level `withAuth` / `withProjectAccess` on protected APIs; API paths now get JSON 401 (lines 29–31) instead of HTML redirect.
- Recommendations: Keep route wrappers mandatory for all new routes; do not rely on proxy alone.

**Config POST accepts arbitrary settings keys:**
- Risk: Admin POST iterates all body keys into `settings` table via `z.record(z.string(), z.unknown())` passthrough — no key allowlist.
- Files: `app/api/config/route.ts` (lines 30–32); `lib/services/settings.service.ts:setSettings`; `app/api/config/schema.ts`
- Current mitigation: `withAuth` + `is_admin` 403; GET masks `anthropic_api_key`.
- Recommendations: Allowlist keys (`anthropic_api_key`, known settings only).

**DB TLS verification disabled when SSL enabled:**
- Risk: `resolveSsl` returns `{ rejectUnauthorized: false }` for non-LAN hosts when `sslmode` is not `disable`.
- Files: `lib/db.ts` (`resolveSsl`, lines 96–109)
- Current mitigation: LAN/internal hosts can disable SSL entirely via `sslmode=disable`.
- Recommendations: Use proper CA for managed Postgres; set `sslmode=verify-full` with CA bundle when available.

**No application-level rate limiting on auth, demo, or LLM routes:**
- Risk: Brute-force login, demo-request spam, unbounded Anthropic spend.
- Files: `app/api/auth/login/route.ts`, `app/api/demo-requests/route.ts`, `modules/reports/backend/routes/portfolio/report/route.ts`, generate-email routes; `proxy.ts` PUBLIC list (line 4)
- Current mitigation: scrypt password hashing (`lib/auth.ts`); Zod schema on demo intake.
- Recommendations: Edge rate limit or middleware counter; captcha on demo intake.

**Session lifecycle gaps:**
- Risk: Sessions expire after 7 days but expired rows are never purged; no logout-all; no idle timeout; `deleteSession` removes one row only.
- Files: `lib/auth.ts` (`createSession`, `deleteSession`, `SESSION_DURATION_MS`)
- Current mitigation: Expiry checked on read (`getSessionUser` WHERE `expires_at > now`).
- Recommendations: Scheduled `DELETE FROM sessions WHERE expires_at < now()` job.

**Jira credentials resolved from process env var names:**
- Risk: `company_jira_config` stores env var *names*; tokens live in process environment — shared across companies if misconfigured.
- Files: `lib/integrations/credentials.ts`, `modules/admin/backend/repositories/jira-config.repo.ts`, `modules/jira/backend/routes/jira/search/route.ts`
- Current mitigation: Per-company var name mapping; session + `company_id` required; Jira search now Zod-validated (`modules/jira/backend/routes/jira/search/schema.ts`).
- Recommendations: Per-company encrypted token storage or secret manager.

**`.env` file present locally:**
- Risk: Local environment configuration (existence only — contents not inspected).
- Files: `.env` (gitignored); `docker-compose.yml` references `env_file: .env`
- Current mitigation: Listed in `.gitignore`.
- Recommendations: Never commit; use secret store in production.

## Performance Bottlenecks

**Portfolio report and LLM generation:**
- Problem: Large portfolio JSON assembled in one request; Anthropic calls with high `max_tokens` and SDK timeout.
- Files: `modules/reports/backend/routes/portfolio/report/route.ts`, `modules/reports/backend/services/portfolio-report.service.ts`, `app/api/portfolio/report/generate-email/route.ts`
- Cause: Monolithic aggregation + synchronous LLM wait.
- Improvement path: Cache snapshots; stream responses; queue jobs (PERF-03 addressed at page level in v2.1; server-side queue still absent).

**Client-heavy pages without virtualization:**
- Problem: 900–1200 line pages render full tables client-side; limited row virtualization outside weekly shared components.
- Files: `modules/portfolio/ui/budget/PortfolioBudgetPage.tsx`, `modules/projects/ui/documents/ProjectDocumentsPage.tsx`, `modules/projects/ui/bugs/ProjectBugsPage.tsx`; contrast `modules/weekly/ui/shared/VirtualRows.component.test.tsx`
- Cause: All state and rows in one component.
- Improvement path: Virtualize grids; server components for static chrome (PERF-01/02 partially addressed via RSC chrome in Phase 26).

**Excel workbook full load in request handlers:**
- Problem: ExcelJS loads entire workbook into memory on import/export.
- Files: `lib/export/excel.ts`, `modules/jira/backend/routes/parse-file-headers/route.ts`, import routes under `modules/projects/backend/routes/projects/[id]/activities/import/`
- Cause: Synchronous parse in Node request thread.
- Improvement path: Max upload size middleware; worker process for large files.

**Cold boot still runs `seedAuthData`:**
- Problem: First `getDb()` after migrate runs default user seed when `users` is empty — not schema migration, but still boot-path side effect.
- Files: `lib/db.ts` (`getDb`, `seedAuthData`)
- Cause: Seed coupled to pool initialization.
- Improvement path: Move seed to `scripts/migrate.ts` only (already runs post-migrate) and remove from app boot.

## Fragile Areas

**PostgresClient dialect bridge (auth SQL):**
- Files: `lib/db.ts`
- Why fragile: String rewrites for `OR IGNORE`, `?` → `$n`, RETURNING id; `noIdTables` allowlist.
- Safe modification: Extend allowlist with test per new INSERT; read `lib/db.getDb.boot.unit.test.ts` before changing boot path.
- Test coverage: `lib/db.cold-start.test.ts`, `lib/db.getDb.boot.unit.test.ts`.

**Import / mapping pipelines:**
- Files: `modules/jira/ui/timeline-import/ImportMappingDialog.tsx`, `modules/jira/backend/routes/parse-file-headers/route.ts`, `modules/projects/backend/routes/projects/[id]/activities/import/handlers.ts`
- Why fragile: Multi-step wizard + CSV/Excel parsing; column mapping errors can corrupt activity plans.
- Safe modification: Golden-file fixtures; transaction-wrap imports; run `modules/jira/ui/timeline-import/ImportMappingDialog.component.test.tsx`.
- Test coverage: Component test exists; no end-to-end import golden files.

**RAG scoring edge cases and portfolio divergence:**
- Files: `lib/rag.ts`, `modules/portfolio/backend/services/portfolio.service.ts` (inline copy)
- Why fragile: Date strings append `T00:00:00` / `T23:59:59` (local semantics); Closing phase always green; SPI null until 10% elapsed; portfolio summary skips SPI entirely.
- Safe modification: Unit tests before changing thresholds — `modules/portfolio/backend/services/portfolio.service.unit.test.ts` covers inline path only.
- Test coverage: Partial — no cross-check that inline RAG matches `calculateRAG` for same inputs.

**Access-control wrapper consistency:**
- Files: `lib/http/with-auth.ts`, `lib/http/with-project-access.ts`, `lib/http/with-program-access.ts`, `lib/http/with-cpmo.ts`, `lib/http/with-role.ts`
- Why fragile: Ops/admin/resources/send-email routes use manual `getSessionFromRequest`; ESLint rule does not cover module paths.
- Safe modification: Wrap new routes with sanctioned wrappers; copy from `app/api/projects/[id]/bugs/route.ts`; run `lib/http/route-401-matrix.test.ts`.
- Test coverage: 401 matrix test exists; not every route permutation covered.

**Module split re-export indirection:**
- Files: `app/api/**/route.ts` (thin re-exports), `modules/**/backend/routes/**/route.ts` (implementations)
- Why fragile: Handler logic lives in modules; app paths must re-export correctly or routes 404.
- Safe modification: Run module-split contract tests (`*-module-split.test.ts`) after moving handlers.
- Test coverage: Per-module split tests under `modules/*/backend/*-module-split.test.ts`.

## Scaling Limits

**Single-process connection pool:**
- Current capacity: Module singleton `_pool` / `_client` in `lib/db.ts`; one pool per Node process; Kysely shares pool via `getPool()`.
- Limit: Horizontal scale multiplies pools against Postgres `max_connections`.
- Scaling path: Set pool `max` per pod; external connection pooler (PgBouncer); migrations via `k8s-migrate-job.yaml` before replicas.

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
- Risk: Proxy/middleware and App Router APIs evolve quickly; training data may not match installed conventions.
- Impact: Auth edge behavior, build breaks on upgrade.
- Migration plan: CI build on every PR (`.github/workflows/test.yml`, `docker-build.yml`); read Next 16 release notes before middleware changes.

**jspdf ^2.5.1:**
- Risk: Older major in PDF ecosystem; verify CVE status before public exposure.
- Impact: Any client-side PDF generation paths if added.
- Migration plan: Audit usage; upgrade or replace when PDF export is next touched.

**Custom auth (no Auth.js/OIDC):**
- Risk: Session fixation, rotation, and SSO patterns maintained manually.
- Impact: Security maintenance burden on `lib/auth.ts`.
- Migration plan: Keep custom for current scope unless SSO required; then evaluate Auth.js.

## Missing Critical Features

**Production observability product:**
- Problem: Errors logged via `console.error` and request-id correlation in `lib/log.ts`; no Sentry/Datadog integration (explicitly absent per `lib/rsc-chrome.gate.test.ts`).
- Blocks: Incident diagnosis at scale beyond log grep.

**E2E test suite in CI:**
- Problem: Vitest unit/component tests only (~339 `*.test.ts` / `*.component.test.tsx` files); no Playwright in CI.
- Blocks: Full user-flow regression detection (v2.1 UAT used manual flows).

**PM-accessible project report send-email route:**
- Problem: Project report UI shares CPMO-only portfolio send-email endpoint.
- Blocks: PM self-service email from project report without CPMO role.

## Test Coverage Gaps

**Large UI pages (documents, budget, bugs, admin):**
- What's not tested: No component tests for pages still 900+ lines.
- Files: `modules/projects/ui/documents/ProjectDocumentsPage.tsx`, `modules/portfolio/ui/budget/PortfolioBudgetPage.tsx`, `modules/projects/ui/bugs/ProjectBugsPage.tsx`, `modules/admin/ui/AdminPage.tsx`
- Risk: UI regressions on refactor.
- Priority: Medium

**Portfolio inline RAG vs `calculateRAG`:**
- What's not tested: Same project inputs produce identical RAG on portfolio summary vs report/dashboard.
- Files: `modules/portfolio/backend/services/portfolio.service.ts`, `lib/rag.ts`
- Risk: Executives see inconsistent status colors.
- Priority: Medium

**Project report send-email PM forbidden path:**
- What's not tested: PM session receives 403 from shared send-email route when invoked from project report hook.
- Files: `modules/reports/backend/routes/portfolio/report/send-email/route.test.ts` (CPMO success only), `modules/reports/ui/project-report/useProjectReport.ts`
- Risk: PM email button appears to work until send fails.
- Priority: Medium

**Import/export golden files:**
- What's not tested: Real Excel/CSV workbooks through full import pipeline end-to-end.
- Files: `lib/export/excel.ts`, `modules/jira/backend/routes/parse-file-headers/route.ts`
- Risk: Silent bad imports on edge-case spreadsheets.
- Priority: Medium

**Non-standard 401 list responses:**
- What's not tested: Client behavior when list routes return `[]` + 401.
- Files: `modules/portfolio/backend/routes/resources/route.ts`, `modules/portfolio/backend/routes/programs/route.ts`, `modules/projects/backend/routes/projects/route.ts`
- Risk: Frontend treats error body as empty success.
- Priority: Low

**E2E flows:**
- What's not tested: Login → project → timeline import → report export in automated CI.
- Files: N/A (no Playwright config)
- Risk: Integration breaks between layers.
- Priority: Low (manual UAT completed for v2.1)

---

*Concerns audit: 2026-08-29*
