# Codebase Concerns

**Analysis Date:** 2026-08-07

## Tech Debt

**Auth only on subset of API routes:**
- Issue: `getSessionFromRequest` / company `checkAccess` applied unevenly. Parent project route checks access; most nested project resources do not.
- Files: Authed examples: `app/api/projects/route.ts`, `app/api/projects/[id]/route.ts`, budget routes under `app/api/projects/[id]/budget/`. Unauthed (no session/company check in handler): `app/api/projects/[id]/activities/route.ts`, `app/api/projects/[id]/risks/route.ts`, `app/api/projects/[id]/issues/route.ts`, `app/api/projects/[id]/meetings/route.ts`, `app/api/projects/[id]/escalations/route.ts`, `app/api/projects/[id]/team/route.ts`, `app/api/projects/[id]/documents/route.ts`, `app/api/projects/[id]/bugs/route.ts`, `app/api/projects/[id]/holidays/route.ts`, `app/api/projects/[id]/milestones/route.ts`, `app/api/import-mapping/route.ts`, `app/api/bug-import-mapping/route.ts`, `app/api/export/excel/[id]/route.ts` (and sibling export routes), `app/api/config/route.ts`, `app/api/parse-file-headers/route.ts`
- Impact: Tenant isolation incomplete if request bypasses edge cookie check or cookie-only gate treated as enough. Cross-company data read/write by guessing `project_id`.
- Fix approach: Shared `requireUser` + `assertProjectAccess(projectId, user)` helper; call on every project-scoped and export/import route. Prefer one middleware/wrapper, not per-file copy-paste.

**Edge auth is cookie-presence only:**
- Issue: `proxy.ts` only checks `pm_session` cookie exists — not valid/unexpired session in DB. No `middleware.ts` found; Next 16 may expect `proxy` convention — verify deploy actually runs it.
- Files: `proxy.ts`
- Impact: Expired/forged cookie format still passes edge; real auth only where handlers call `getSessionFromRequest`.
- Fix approach: Validate session at edge or ensure every API route uses `getSessionFromRequest`. Wire/confirm Next 16 proxy/middleware entry.

**Dynamic SQL column assignment (mass assignment):**
- Issue: `Object.keys(body)` / `Object.keys(fields)` interpolated into `UPDATE ... SET ${k} = ?`.
- Files: `app/api/projects/[id]/route.ts`, `app/api/projects/[id]/activities/route.ts`, `app/api/projects/[id]/risks/route.ts`, `app/api/projects/[id]/issues/route.ts`, `app/api/projects/[id]/meetings/route.ts`, `app/api/projects/[id]/team/route.ts`, `app/api/projects/[id]/escalations/route.ts`
- Impact: Client can set arbitrary columns (e.g. `company_id`, `project_id`) if DB allows; SQL injection if keys not strictly alphanumeric.
- Fix approach: Allowlist fields per entity; reject unknown keys.

**SQLite-dialect SQL over PostgreSQL adapter:**
- Issue: App SQL uses `?` placeholders and `INSERT OR IGNORE`; `PostgresClient.toPositional` rewrites at runtime.
- Files: `lib/db.ts` (`toPositional`, `needsReturningId`, `run` + `RETURNING id`)
- Impact: Edge cases (multiple statements, non-`id` PKs, complex INSERT) break silently or return wrong `lastInsertRowid`.
- Fix approach: Write native `$n` SQL or thin query helpers per table; stop dialect translation growth.

**Schema init + long migration list on first `getDb()`:**
- Issue: Every cold process runs `initPostgresSchema`, large `migratePostgresSchema` loop, backfill, seed.
- Files: `lib/db.ts` (`getDb`, `migratePostgresSchema`, `seedAuthData`, `backfillWeightedCompletion`)
- Impact: Slow cold start; migrations mixed with app code; data-fix UPDATEs run as "migrations" (e.g. company_id sync, parent_id epic fix).
- Fix approach: External migrate job / versioned migration files; app only connects.

**God UI pages:**
- Issue: Feature pages 900–2800 lines: data fetch, state, tables, dialogs, export in one client component.
- Files: `app/portfolio/report/page.tsx` (~2828), `app/projects/[id]/timeline/page.tsx` (~1978), `app/projects/[id]/report/page.tsx` (~1426), `app/projects/[id]/milestones/page.tsx` (~1275), `components/timeline/ImportMappingDialog.tsx` (~1265), `app/portfolio/roadmap/page.tsx` (~1230), `app/page.tsx` (~1064)
- Impact: Hard review, high regression risk, no unit seams.
- Fix approach: Split data hooks, presentational tables, dialogs; move report aggregation server-side where possible.

**No automated tests / no test script:**
- Issue: No `*.test.*` / `*.spec.*`; `package.json` scripts only `dev`/`build`/`start`/`lint`.
- Files: `package.json`
- Impact: Auth, RAG, import, budget math break without detection.
- Fix approach: Vitest/Jest for `lib/rag.ts`, `lib/auth.ts`, allowlisted updates; API integration tests for access control.

**Default seed credentials in source:**
- Issue: Seed creates admin/company users with hardcoded passwords.
- Files: `lib/db.ts` (`seedAuthData` — `admin` / `Khang@19`, `ct_user1` / `Ctech@26`)
- Impact: Anyone with code or fresh DB knows default logins.
- Fix approach: Seed only in dev; force password change; env-driven bootstrap secret; never ship known prod passwords.

## Known Bugs

**PATCH project can rewrite protected columns:**
- Symptoms: Body keys become SET clauses without allowlist.
- Files: `app/api/projects/[id]/route.ts` (PATCH)
- Trigger: Authenticated user (or bypass) sends `{ "company_id": otherId }` or unexpected keys.
- Workaround: None in code.

**Nested project APIs skip company checks:**
- Symptoms: CRUD on activities/risks/etc. by `project_id` without verifying caller's company.
- Files: e.g. `app/api/projects/[id]/activities/route.ts`, `app/api/projects/[id]/risks/route.ts`
- Trigger: Valid session cookie for any user (or unauthenticated if edge not enforced) + known project id.
- Workaround: Rely solely on UI not exposing other projects — insufficient.

**Error responses leak internals:**
- Symptoms: `NextResponse.json({ error: String(e) }, { status: 500 })` returns stack/message text.
- Files: Many routes under `app/api/` (e.g. `app/api/projects/route.ts`, export routes)
- Trigger: Any thrown DB/network error.
- Workaround: None.

**Session cookie missing `secure`:**
- Symptoms: Cookie set without `secure: true` (only `httpOnly`, `sameSite: 'lax'`).
- Files: `app/api/auth/login/route.ts`
- Trigger: HTTPS production still may send cookie over accidental HTTP.
- Workaround: Terminate TLS only; set `secure` when `NODE_ENV=production`.

## Security Considerations

**Unauthenticated / under-authenticated config and exports:**
- Risk: Read/write global `settings` (including ability to store `anthropic_api_key` via POST); export project Excel/PPT/Word without handler auth; parse arbitrary uploads.
- Files: `app/api/config/route.ts`, `app/api/export/**`, `app/api/parse-file-headers/route.ts`, `app/api/import-mapping/**`
- Current mitigation: Edge cookie presence if `proxy` active; config GET masks key as `***` but POST unrestricted in handler.
- Recommendations: Admin-only config; auth on all exports; size limits + virus/type checks on uploads.

**Secrets in repo / deploy manifests:**
- Risk: `k8s.yaml` embeds full Postgres URL with username/password and internal IP. `.env` present locally (do not commit contents).
- Files: `k8s.yaml`; `.env` (existence only)
- Current mitigation: None in-repo.
- Recommendations: Kubernetes Secrets / external secret store; rotate DB password; scrub history if ever pushed.

**DB SSL verification disabled:**
- Risk: `ssl: { rejectUnauthorized: false }` for non-LAN URLs allows MITM on DB traffic.
- Files: `lib/db.ts` (`getDb`)
- Current mitigation: LAN/`sslmode=disable` path for internal hosts.
- Recommendations: Proper CA for managed Postgres; only disable SSL on true private networks.

**Password hashing OK but ops gaps:**
- Risk: scrypt + timing-safe compare is good; no rate limit on login/demo/AI; sessions never cleaned; 7-day fixed lifetime; no CSRF token (cookie + lax helps some cases).
- Files: `lib/auth.ts`, `app/api/auth/login/route.ts`, `app/api/demo-requests/route.ts`, `app/api/portfolio/report/generate-email/route.ts`
- Current mitigation: scrypt hashes; httpOnly cookie.
- Recommendations: Rate limit login/demo/LLM routes; session purge job; optional absolute idle timeout.

**Public demo intake spam:**
- Risk: `POST /api/demo-requests` open by design (`proxy.ts` PUBLIC list) with no captcha/rate limit.
- Files: `app/api/demo-requests/route.ts`, `proxy.ts`
- Current mitigation: Required fields only.
- Recommendations: Rate limit, captcha, or edge WAF.

**Jira credentials via env var names in DB:**
- Risk: Company config stores env var *names*; token still process-wide — any company path that resolves wrong var could misuse shared env.
- Files: `app/api/jira/search/route.ts`, `company_jira_config` in `lib/db.ts`
- Current mitigation: Per-company var name mapping; requires session + company_id.
- Recommendations: Encrypt tokens per company or secret manager; never log Authorization headers.

## Performance Bottlenecks

**Large report aggregation in single request:**
- Problem: Portfolio report API/page loads heavy multi-project data and AI email generation with large prompts.
- Files: `app/api/portfolio/report/route.ts` (~792 lines), `app/portfolio/report/page.tsx`, `app/api/portfolio/report/generate-email/route.ts`
- Cause: Monolithic handlers + LLM `max_tokens: 3500` + full portfolio context in prompt.
- Improvement path: Cache report snapshots; paginate; stream LLM; reduce context payload.

**Cold start schema/migrate/seed:**
- Problem: First request after process start pays full migration cost.
- Files: `lib/db.ts`
- Cause: Migrations inside `getDb()`.
- Improvement path: Separate migrate step; pool reuse without re-init.

**Client-heavy pages:**
- Problem: Multi-thousand-line client pages re-render large tables/charts.
- Files: Timeline/report/roadmap pages under `app/projects/[id]/`, `app/portfolio/`
- Cause: All state in one component; little virtualization evidence from structure.
- Improvement path: Virtualize grids; split fetch; server components for static chrome.

## Fragile Areas

**PostgresClient dialect bridge:**
- Files: `lib/db.ts`
- Why fragile: String rewrites for OR IGNORE / `?` / RETURNING; table allowlist for non-id PKs (`settings`, `company_jira_config`) incomplete if new PK styles added.
- Safe modification: Add integration test per new INSERT pattern; extend `noIdTables` carefully.
- Test coverage: None.

**Access control inconsistency:**
- Files: `app/api/projects/**` vs portfolio/admin routes
- Why fragile: New routes copy unauthed activity/risk template → silent IDOR.
- Safe modification: Always copy from `app/api/projects/[id]/route.ts` `checkAccess` pattern (or better shared helper).
- Test coverage: None.

**Import / mapping pipelines:**
- Files: `components/timeline/ImportMappingDialog.tsx`, `app/api/import/resource-plan/[id]/route.ts`, `app/api/parse-file-headers/route.ts`, `lib/export/excel.ts`
- Why fragile: Large UI + custom CSV/Excel parsing; column mapping errors corrupt plans.
- Safe modification: Golden-file fixtures for sample workbooks; transaction wrap imports.
- Test coverage: None.

**RAG scoring:**
- Files: `lib/rag.ts`, company thresholds in `company_rag_config`
- Why fragile: Date string + `T00:00:00` local semantics; Closing phase always green; SPI null early.
- Safe modification: Unit tests for boundary SPI/deadline cases before changing thresholds.
- Test coverage: None.

## Scaling Limits

**Single-instance assumptions:**
- Current capacity: One Node process + one Postgres (`k8s.yaml` replicas: 1).
- Limit: In-memory `_client` pool per process OK; session store in DB scales; no horizontal sticky needed for sessions.
- Scaling path: Increase replicas after moving migrations out of request path; connection pool max per pod; external object storage if documents grow.

**LLM cost / latency:**
- Current capacity: On-demand Claude calls for portfolio/project email generation.
- Limit: Unbounded concurrent generates per authenticated user; large portfolio JSON in prompt.
- Scaling path: Queue, per-user rate limits, cheaper model tier for drafts.

**File parse memory:**
- Current capacity: Full workbook load via ExcelJS in request handlers.
- Limit: Large uploads OOM worker.
- Scaling path: Max file size middleware; streaming parse; worker process.

## Dependencies at Risk

**Next.js 16.2.4 + React 19:**
- Risk: Project docs warn APIs differ from training data (`AGENTS.md` → `node_modules/next/dist/docs/`). `proxy.ts` vs classic `middleware.ts` easy to miswire.
- Impact: Auth edge, routing, build breaks on upgrade.
- Migration plan: Read Next 16 docs before middleware/auth changes; pin versions; CI build on every PR.

**jspdf ^2.5.1:**
- Risk: Older major; known historical CVEs in PDF ecosystem — verify current advisory status when shipping public.
- Impact: Client-side PDF export paths if used.
- Migration plan: Upgrade or replace with maintained fork; audit usage under `app/` and `lib/export/`.

**No auth library:**
- Risk: Custom sessions without battle-tested session fixation/rotation helpers.
- Impact: Security maintenance burden on `lib/auth.ts`.
- Migration plan: Keep custom if small; else Auth.js/OIDC when multi-tenant SSO required.

## Missing Critical Features

**Automated test suite:**
- Problem: Lint-only quality gate.
- Blocks: Safe refactors of auth, budget, import, report.

**Central authorization layer:**
- Problem: Per-route ad hoc checks.
- Blocks: Confident multi-tenant SaaS hardening.

**Observability:**
- Problem: No error tracking product; errors returned as strings to clients.
- Blocks: Production incident diagnosis.

**Session lifecycle ops:**
- Problem: No expiry sweep, no logout-all, no password policy beyond change endpoint.
- Blocks: Compliance-minded deployments.

**Secret management in deploy:**
- Problem: Credentials in `k8s.yaml` plain value.
- Blocks: Safe multi-env promotion.

## Test Coverage Gaps

**Authorization / multi-tenant:**
- What's not tested: Company isolation on projects, nested resources, exports, admin-only routes.
- Files: `app/api/projects/**`, `app/api/export/**`, `app/api/admin/**`
- Risk: IDOR and privilege escalation ship unnoticed.
- Priority: High

**Auth primitives:**
- What's not tested: Password hash/verify, session create/expire, cookie flags.
- Files: `lib/auth.ts`, `app/api/auth/**`
- Risk: Broken login or weak session acceptance.
- Priority: High

**Dynamic UPDATE allowlisting:**
- What's not tested: Rejection of unknown columns / injection keys.
- Files: Project nested `route.ts` files listed under mass assignment.
- Risk: Data corruption / security hole.
- Priority: High

**RAG and report math:**
- What's not tested: SPI boundaries, deadline RAG, portfolio aggregations.
- Files: `lib/rag.ts`, `app/api/portfolio/report/route.ts`
- Risk: Wrong executive RAG/status.
- Priority: Medium

**Import/export parsers:**
- What's not tested: CSV edge cases, Excel header detection, resource plan import.
- Files: `app/api/parse-file-headers/route.ts`, `lib/export/excel.ts`, import routes
- Risk: Silent bad imports.
- Priority: Medium

**DB adapter:**
- What's not tested: `INSERT OR IGNORE` rewrite, RETURNING id, concurrent pool use.
- Files: `lib/db.ts`
- Risk: Wrong insert ids, failed seeds.
- Priority: Medium

---

*Concerns audit: 2026-08-07*
