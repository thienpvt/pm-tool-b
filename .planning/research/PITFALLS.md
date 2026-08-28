# Pitfalls Research

**Domain:** v2.1 Hardening & Deferred Debt — adding versioned migrations, Kysely, repo-wide module backend/UI split, v2 UI consumers, leftover route thinning, and proxy JSON 401 onto the existing post-v2.0 Next.js 16 multi-tenant PPM app
**Researched:** 2026-08-28
**Confidence:** HIGH for brownfield integration pitfalls (verified against `lib/db.ts` migrate loop, `proxy.ts`, `06-PROXY-FINDING.md`, v2.0 milestone audit, D-23 carve-out docs, dual budget Phase 15 decisions); MEDIUM for Kysely cutover specifics (ENF-02 not yet implemented in repo)

## Critical Pitfalls

### Pitfall 1: Merging or replaying the stale DATA origin branch without regenerating baseline

**What goes wrong:**
Origin `gsd/quick-260826-ded-data-layer-migrations` (merge-base `f793e7d`) ships a versioned migration runner, `schema_migrations` ledger, and `0001` baseline against **v1.0 schema only**. Merging it onto current master — or copying its SQL files verbatim — drops every v2.0 table (`weekly_report_*`, `project_fiscal_budgets`, `user_roles`, RAID master columns, dashboard helpers, document catalog, `audit_logs` extensions). CI green on fresh DB; production explodes on first deploy when v2 APIs 500 on missing tables.

**Why it happens:**
The branch name sounds like the finished DATA task. Developers cherry-pick "the migration infrastructure" without re-deriving DDL from today's `lib/db.ts` + `lib/db-*.ts` migrate modules.

**How to avoid:**
- Treat origin branch as **pattern only** (runner CLI, ledger table, data-fix script layout, Vitest harness).
- Regenerate `migrations/0001_baseline.sql` from current schema: union `initPostgresSchema`, `migratePostgresSchema`, and all `migrate*` modules in `getDb()` call order.
- Diff regenerated baseline against a DB that has run through current `getDb()` — row counts and `\d` for v2 tables must match.
- Add explicit checklist in DATA phase: weekly, fiscal, roles, RAID master, dashboards, documents, audit tables present in baseline.

**Warning signs:**
- `0001` SQL has no `project_fiscal_budgets`, `weekly_report_periods`, or `user_roles`.
- PR description says "merge DATA branch" without "regenerate baseline".
- Fresh migrate on empty DB passes but integration tests for Phase 13–18 tables fail.

**Phase to address:** DATA-01..03 (single phase — runner + baseline + data-fix scripts together)

---

### Pitfall 2: Stripping schema init from `getDb()` without a production cutover plan

**What goes wrong:**
Production DBs span three eras: legacy 0.1.x (pre-v1 reorg), v1.0 cold-start migrate loop, and v2.0 in-process `migrate*` modules — **no `schema_migrations` ledger today**. Removing `initPostgresSchema` / migrate calls from `getDb()` before every environment has run external `npm run migrate` yields: (a) empty-schema boot on new pods → 500 on first request; (b) stale pods still running old code assume migrate-on-boot while new pods assume pre-migrated DB → race on DDL; (c) dev/test DBs created only via Vitest `test/repo-db.ts` never exercise the real migration path.

**Why it happens:**
Cold-start slowness is the motivator; teams delete migrate calls first and "add migrate job later." The `getDb()` singleton masks the gap until deploy.

**How to avoid:**
- **Order:** ship external migrate runner + ledger → run once against every env (Railway, K8s, local) → only then slim `getDb()` to connect + seed guard.
- Bootstrap ledger for brownfield: one-time "stamp all current DDL as applied" migration or `schema_migrations` backfill script keyed off sentinel tables (e.g. `audit_logs.company_id`, `project_fiscal_budgets`).
- Keep `seedAuthData` behind explicit env flag (`SEED_ON_EMPTY=1`) — never re-seed production.
- CI: job matrix `empty DB → migrate → npm test` and `brownfield fixture → migrate → npm test`.

**Warning signs:**
- `getDb()` diff removes 200+ lines with no corresponding `npm run migrate` in Dockerfile/Railway/K8s manifest.
- New developer `docker compose up` gets empty DB, app starts, login 500.
- Two replicas deploy simultaneously; Postgres logs show duplicate `CREATE TABLE` or lock timeouts.

**Phase to address:** DATA-01..03 (must complete before treating ENF-02 or PERF cold-start work as done)

---

### Pitfall 3: Kysely compile-time types drift from runtime mass-assignment protection

**What goes wrong:**
ENF-02 replaces raw `buildUpdate(PROJECT_COLUMNS, body)` allowlists with Kysely `.set()`. Teams generate `Database` interface once from schema but: (a) new columns added in SQL migration but not regenerated types → runtime accepts extra keys via raw SQL fallback; (b) Kysely `Insertable`/`Updateable` includes `company_id` or `id` → tenant escape or PK overwrite; (c) partial repo migration — half the repos use Kysely, half use `PostgresClient` with `?` placeholders — doubles dialect debt instead of replacing it.

**Why it happens:**
Kysely is sold as "compile-time allowlists." Developers assume generated types replace discipline; they skip the existing `PROJECT_COLUMNS`-style explicit pick lists and the Vitest tests that assert unknown keys are dropped.

**How to avoid:**
- One `Kysely<Database>` factory wrapping the existing `Pool`; no second connection pool.
- Per-repo **narrow** update types: `Pick<Updateable<'projects'>, 'name' | 'status' | …>` mirroring current const arrays — do not pass `Updateable<'projects'>` wholesale.
- Regenerate types in DATA phase CI gate when migrations change.
- Migrate repos in dependency order; delete `buildUpdate` only when **all** callers of that table are on Kysely.
- Keep Vitest mass-assignment tests (unknown body key must not appear in SQL).

**Warning signs:**
- `as any` on Kysely inserts to silence type errors.
- Grep shows `buildUpdate` and `db.updateTable` for the same table.
- `PostgresClient.toPositional` still growing while Kysely is "done."

**Phase to address:** ENF-02 (after DATA baseline stable; types generated from migrated schema)

---

### Pitfall 4: Repo-wide backend/UI split breaks App Router routes and `@/` imports

**What goes wrong:**
MOD-01 moves feature code into `modules/<feature>/backend` and `modules/<feature>/ui`, but Next.js **only** serves routes from `app/` (and `app/api/`). Outcomes: (a) `app/api/projects/[id]/risks/route.ts` deleted or moved → 404; (b) pages moved under `modules/` without re-export shells in `app/` → build succeeds in dev but routes vanish; (c) `@/` imports break when files move but `tsconfig paths` still point at old trees; (d) colocated `*.test.ts` beside routes moved outside Vitest `include` glob; (e) `output: 'standalone'` trace misses moved server code → runtime `MODULE_NOT_FOUND` in Docker.

**Why it happens:**
"Module split" reads like a filesystem-only refactor. Next 16 App Router coupling is special-cased — unlike a plain Node monorepo.

**How to avoid:**
- **Thin shells stay in `app/`:** one-line re-exports or minimal wrappers that delegate to `modules/*/backend/handlers`.
- Document invariant: `app/**/route.ts` and `app/**/page.tsx` are routing facades only; logic lives in modules.
- Move tests with code; keep paths under `{lib,app,modules}/**/*.test.ts` in `vitest.config.ts`.
- After each module move: `next build`, curl standalone artifact, run route access tests for that module.
- Preserve `@/` → project root; module-internal use relative or `@/modules/...` consistently.

**Warning signs:**
- Grep `app/api` shows shrinking file count with no corresponding `export { GET } from '@/modules/...'`.
- `npm test` pass count drops because tests no longer match include glob.
- Standalone `server.js` starts but specific API returns HTML 404 page.

**Phase to address:** MOD-01 (early — every later phase assumes stable import paths)

---

### Pitfall 5: Proxy JSON 401 breaks browser login redirects

**What goes wrong:**
PROXY-01 changes unauthenticated API handling to `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`. Naive implementation applies 401 to **all** `/api/*` paths, including: (a) browser navigation that expects 307 to `/login?from=` for HTML pages (unchanged — but easy to regress if matcher logic merges branches); (b) `fetch('/api/...')` from client components that relied on redirect to login — now get JSON and throw opaque errors; (c) RSC payload requests mis-detected as API; (d) public paths like `/api/auth/login` accidentally gated.

**Why it happens:**
`proxy.ts` today uses one redirect branch for both pages and APIs (confirmed live: `/api/portfolio` → 307, `06-PROXY-FINDING.md`). Fixers copy-paste "API = JSON" without content negotiation or without preserving page redirect branch.

**How to avoid:**
- Branch explicitly: `pathname.startsWith('/api/')` → 401 JSON **only when no session cookie**; pages keep 307 redirect (except `/` → `/landing`).
- Honor existing `PUBLIC` list; extend with any cookie-less API endpoints.
- Client fetch helpers: treat 401 as "redirect to login" for browser context; leave programmatic clients on JSON.
- Re-run standalone curl matrix from `06-PROXY-FINDING.md` plus new Test 5: API without cookie → 401 JSON `content-type: application/json`; `/portfolio` without cookie → 307 HTML redirect.

**Warning signs:**
- Browser hits protected page → JSON blob instead of login form.
- `fetch` in RSC or middleware loops on 401.
- Monitoring counts 401 spike on health checks (PUBLIC list regression).

**Phase to address:** PROXY-01 (after route-level 401 matrix still green — defense in depth, not replacement)

---

### Pitfall 6: Thinning D-23 leftover ops/admin routes into the wrong authorization model

**What goes wrong:**
THIN-01 moves `app/api/operations/**`, `app/api/admin/companies`, config, and import-mapping onto services. Two failure modes: (a) **over-gating** — apply `assertCompanyWrite` / CPMO product roles to platform break-glass routes (`/api/admin/companies` Jira/RAG config, demo provisioning) → ops cannot manage tenants; (b) **under-gating** — service extraction drops session checks or reintroduces `is_admin` cross-tenant reads → IDOR returns on routes that v2.0 intentionally left as "session+tenant only" (D-23, AUTH-05 carve-out).

**Why it happens:**
D-23 is documented as debt to thin, not to re-gate. Engineers conflate "service layer" with "CPMO/PM/Viewer everywhere" or copy product mutator asserts from Phase 10 plans onto ops routes.

**How to avoid:**
- Maintain explicit route inventory with gate type: `product` (CPMO/PM/Viewer), `platform-break-glass` (`is_admin` / designated ops), `session+tenant` (company scope, no role matrix).
- THIN-01 scope: **structure only** — route → service → repo — preserve existing gate semantics per route class.
- Do not add CPMO asserts to `app/api/operations/**` or platform `/api/admin/companies` unless PRODUCT explicitly reverses D-23.
- Tests: cross-company 403 on product routes; ops admin still reaches Jira credential config; Viewer cannot hit operations mutators that were never Viewer-accessible.

**Warning signs:**
- `assertCompanyWrite` imported in `app/api/admin/companies/route.ts`.
- CPMO user blocked from company-scoped ops that worked pre-thinning.
- Viewer can mutate operations systems after "hardening."

**Phase to address:** THIN-01 (after MOD-01 if ops/admin code moves modules; gate inventory is plan prerequisite)

---

### Pitfall 7: Dual budget surfaces — v1 `budget_items` vs spec fiscal ledger

**What goes wrong:**
Phase 15 deliberately runs **parallel** stores: v1 `budget_items` / `/api/portfolio/budget` vs spec `project_fiscal_budgets` / fiscal APIs. v2.1 UI work (portfolio dashboard NIT-02, budget pages) picks the wrong store: fiscal KPIs wired to v1 aggregates, or fiscal writes accidentally routed to `budget_items`, or v1 pages " migrated" by redirect without data migration plan → two conflicting numbers on leadership reports.

**Why it happens:**
Both exist in schema and UI. Dashboard phase scoped RAG/stage/RAID/milestones KPIs and deferred fiscal tiles; v2.1 closes the gap without a locked product decision on v1 sunset.

**How to avoid:**
- NIT-02 requires explicit decision doc: **coexist** (label sources in UI), **redirect** (v1 read-only + link to fiscal), or **migrate** (one-time ETL script — separate phase).
- Never write spec fiscal fields into `budget_items` (Phase 15 D-01 reversibility warning).
- Portfolio dashboard fiscal tiles must read fiscal repos/services only.
- Tests: same project shows consistent VND totals per store; no cross-table UPDATE.

**Warning signs:**
- `portfolio.repo.ts` JOIN on `budget_items` used for spec fiscal KPIs.
- Single "Budget" nav entry with ambiguous API backend.
- Product asks "which number is truth?" in UAT.

**Phase to address:** NIT-02 (before UI-DASH fiscal tiles); UI budget pages in MOD-01 module split

---

## Moderate Pitfalls

### Pitfall 8: RSC chrome conversion breaks client hooks that fetch in decomposed pages

**What goes wrong:**
PERF-02 lifts static layout (headers, sidebars, filters shell) to Server Components on pages already split in Phase 7 (`use*Page` hooks + `_components/`). Passing non-serializable props (functions, class instances) across RSC boundary → build error. Moving data fetch to RSC while child client components still `useEffect` fetch → double fetch, stale hydration, lost loading states. Session/role UI gated client-side now flashes wrong chrome server-side.

**Why it happens:**
"Make it RSC" is applied file-by-file without tracing hook dependency graph from god-page decomposition.

**How to avoid:**
- Map each page: what **must** be client (virtualized grid, dialogs, DnD) vs static chrome.
- Fetch in one layer: server loader **or** client hook, not both for same data.
- Pass serializable props only; keep interactive islands as client `children`.
- Verify no `useSearchParams` / `useRouter` in files marked `'use server'` or without `'use client'`.

**Phase to address:** PERF-02 (after PERF-01 virtualization — grids stay client)

---

### Pitfall 9: Grid virtualization applied without row-height and selection semantics

**What goes wrong:**
PERF-01 adds `@tanstack/react-virtual` (or similar) to documents, budget, bugs, resources pages (700–1100 LOC). Breakages: variable row heights clip content; keyboard navigation and shift-select break; export-selected-rows silently exports visible window only; sticky column headers desync on horizontal scroll.

**Why it happens:**
Virtualization is dropped onto existing table markup without extracting row renderer contract from decomposed `_components/`.

**How to avoid:**
- Virtualize only after page split has stable `Row` component and measured height (fixed or estimated).
- Preserve "select all matching filter" vs "select visible" semantics explicitly in UX.
- Load test with realistic row counts (500+ activities, 200+ budget lines).
- Keep non-virtual fallback for print/export views.

**Phase to address:** PERF-01 (per large grid page; not one big-bang PR)

---

### Pitfall 10: v2 UI consumers built without server gate parity

**What goes wrong:**
UI-DASH / UI-WEEK / UI-DOC / UI-AUDIT add React pages calling v2 APIs that were gated with server tests only (`ui_phase: false`). UI hides buttons but Viewer still sees routes if linked; PM hits CPMO-only audit viewer; weekly submit UI bypasses draft/submit state machine; dashboard filters omit AND-session rules from PDSH-01.

**Why it happens:**
APIs exist and pass Vitest; UI is treated as thin wrapper without re-reading access matrix from Phases 10–18.

**How to avoid:**
- Each UI module: copy gate table from phase VERIFICATION.md into component-level route guards **and** rely on API 403 (UI hiding is not access control).
- Playwright or route-access tests for page URLs, not just `/api/*`.
- Weekly UI: enforce draft/submitted/locked from API status; disable controls server-side truth.

**Phase to address:** UI-DASH, UI-WEEK, UI-DOC, UI-AUDIT (after MOD-01 ui dirs exist)

---

### Pitfall 11: HYG-02 operator confirm escalates into unnecessary code rewrite

**What goes wrong:**
Anthropic malformed-output paths return 502 (`kind: 'validation'`) on some routes and 500 (`force500: true`) on GET report routes — intentional INTG-06 split. Operator checkpoint becomes "make all AI routes 500 again" or full client refactor, wasting a milestone slot.

**Why it happens:**
HYG-02 is classified as hygiene confirm, not feature work; ambiguity invites scope creep.

**How to avoid:**
- Default action: document status contract in runbook; confirm monitoring tolerates 502.
- Code change only if operator **rejects** 502 — then targeted revert, not broad rewrite.
- Single verification script: hit three GET report routes + generate-email routes; assert expected status codes.

**Phase to address:** HYG-02 (checkpoint early; no dependency blockers)

---

### Pitfall 12: Nyquist validate-phase rewrites archived v1/v2 VALIDATION.md drafts

**What goes wrong:**
NYQ-01 runs `validate-phase` against ten v2.0 phases (and optionally v1.0) whose VALIDATION.md files are `status: draft` / `nyquist_compliant: false` by design at closeout. Tooling "fixes" archived phases — regenerates plans, changes scope, or fails CI on historical artifacts. Conversely, skipping validation on **new** v2.1 phases repeats the gap.

**Why it happens:**
Audit says `not-validated` globally; engineers run bulk validate without scoping to active milestone phases.

**How to avoid:**
- Scope NYQ-01 to **v2.1 phases only** (Phase 19+); treat v1/v2 VALIDATION.md as read-only archive unless explicit retro mandate.
- If retro validation desired: read-only audit report first; no auto-edit of archived PLAN.md.
- New phases: create VALIDATION.md at plan time with `status: active`; validate before execute.

**Phase to address:** NYQ-01 (process phase; parallel to feature work, not blocking DATA)

---

### Pitfall 13: ENF-01 ESLint gate without autofix path blocks large MOD-01 PRs

**What goes wrong:**
CI fails on any project-scoped `route.ts` not wrapped by sanctioned helper — including routes mid-move during MOD-01. Teams disable rule or `@ts-ignore` wrappers to unblock, defeating ENF-01.

**Why it happens:**
Lint gate lands before route shells stabilize.

**How to avoid:**
- Land ESLint rule with `--max-warnings 0` only after MOD-01 facades restored per module **or** use per-directory allowlist shrinking weekly.
- Rule tests: valid `withAuth`, `withProjectAccess`, `withCpmo` patterns from existing green routes.

**Phase to address:** ENF-01 (after MOD-01 route facades stable, or concurrent with final MOD-01 wave)

---

## Minor Pitfalls

### Pitfall 14: JIRA-01 hygiene breaks preset search under load

**What goes wrong:**
Removing debug `console.log` and adding `req.json()` guard on Jira search throws on empty body where clients sent GET-with-query. Low traffic route; breaks admin Jira config UI edge case.

**Prevention:** Characterize current callers before guard; return 400 with clear message, not 500.

**Phase to address:** JIRA-01

---

### Pitfall 15: NIT-01 wire-or-delete leaves dead exports that confuse integration

**What goes wrong:**
`listPeriodShells` service wrapper and `listOpenProjectDependencies` export were orphaned in v2.0 audit. Wiring them without consumer need adds indirection; deleting without grep breaks dynamic imports.

**Prevention:** Grep + integration test update in same commit; prefer wire to spec-dashboard if DEP-03 dependency tiles ever ship.

**Phase to address:** NIT-01

---

### Pitfall 16: No-op milestone PATCH audit noise treated as security fix

**What goes wrong:**
NIT-02 conflates audit log volume (`updateMilestone` no-op PATCH) with immutability bugs — large refactor of audit pipeline for noise reduction.

**Prevention:** Skip audit row when `before === after` JSON; keep entity_type `risk`/`issue` convention (D-02).

**Phase to address:** NIT-02

---

### Pitfall 17: PERF-03 cold-start budget measured before DATA cutover

**What goes wrong:**
Benchmarking cold start while `getDb()` still runs full migrate loop attributes slowness to Next/React; DATA cutover then invalidates baseline.

**Prevention:** Measure twice — pre- and post-DATA; budget gate in CI only after migrate externalized.

**Phase to address:** PERF-03 (after DATA-01..03)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Merge DATA branch SQL as-is | Faster "migrations done" | Missing v2 tables; prod outage | **Never** on this repo |
| Leave migrate in `getDb()` "temporarily" after runner ships | Avoid deploy coordination | Dual DDL paths; replica races | Never past DATA phase exit |
| Kysely `Updateable<T>` without narrow pick | Faster repo conversion | Mass-assignment / tenant escape | Never for mutating repos |
| Move routes out of `app/` without shells | Purer module tree | 404 in production | Never |
| Global proxy 401 without page branch | Simpler proxy | Broken browser login | Never |
| Apply CPMO gates to D-23 ops routes | "Consistent security" | Break platform ops | Never without spec change |
| Wire v1 budget JOINs for fiscal KPIs | Reuse existing SQL | Two truths on reports | Never for spec-facing KPIs |
| Bulk Nyquist validate on archived phases | Green dashboard | Rewrites closed milestone scope | Never without explicit retro project |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PostgreSQL brownfield | Assume empty DB in tests equals prod | Stamp `schema_migrations` + brownfield fixture tests |
| Kysely + `PostgresClient` | Run both indefinitely | Single pool; retire `?` adapter per migrated repo |
| Next standalone Docker | Move server code out of traced paths | `next build` + run `server.js` smoke after MOD-01 |
| `proxy.ts` + route wrappers | Remove route 401 tests because proxy "handles it" | Keep route matrix; proxy is cookie-presence only |
| Anthropic report routes | Unify 500/502 without operator sign-off | HYG-02 confirm first |
| v2 API + new UI | Trust UI hiding | Server 403 + page-level access tests |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cold `getDb()` migrate loop | First request 5–30s | DATA external migrate | Every deploy/replica scale event |
| Non-virtualized 1000-row grids | Tab freeze, INP spike | PERF-01 virtual rows | documents/budget/bugs pages |
| RSC + client double fetch | TTFB ok, TTI slow, layout shift | Single fetch owner | PERF-02 on decomposed pages |
| Full test suite on every grid tweak | CI >10 min | Targeted Vitest projects | PERF-01 iteration |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Kysely update includes `company_id` | Cross-tenant row move | Narrow update types; repo tests |
| THIN-01 drops session check in service | IDOR on ops/admin | Preserve gate inventory |
| PROXY-401 only, no route wrappers | Direct handler access bypass | Keep withAuth matrix |
| Platform admin routes get CPMO gate | Break-glass lockout | D-23 route class labels |
| v2 UI exposes audit/weekly URLs to Viewer | Data leak via bookmark | API 403 + page guard |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| API 401 JSON in browser fetch | Blank error toast | Client helper redirects to login |
| Fiscal vs v1 budget same label | Wrong financial decision | Source labels + NIT-02 decision |
| Virtualized grid loses selection | Export wrong rows | Explicit selection scope copy |
| Weekly UI ignores submitted lock | Trust erosion | Read-only submitted + amendment flow |

## "Looks Done But Isn't" Checklist

- [ ] **DATA:** `getDb()` slimmed **and** Dockerfile/Railway/K8s run migrate **and** brownfield ledger stamped
- [ ] **DATA:** `0001` baseline contains all v2.0 tables (weekly, fiscal, roles, RAID, dashboard, doc, audit)
- [ ] **ENF-02:** Repo on Kysely **and** mass-assignment tests green **and** no dual `buildUpdate` for same table
- [ ] **MOD-01:** Module moved **and** `app/` shell routes curl 200 **and** standalone build smoke
- [ ] **PROXY-01:** API → 401 JSON **and** `/portfolio` → 307 **and** `/api/health` → 200
- [ ] **THIN-01:** Service layer **and** D-23 gate class unchanged per route
- [ ] **UI-DASH/WEEK/DOC/AUDIT:** Page exists **and** Viewer/PM negative tests **and** API gate parity
- [ ] **NIT-02:** Fiscal KPI decision written **and** no v1/store mix in spec tiles
- [ ] **HYG-02:** Operator sign-off recorded **not** assumed from green tests
- [ ] **NYQ-01:** v2.1 phases validated **without** mutating archived v1/v2 VALIDATION.md

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Merged stale DATA baseline | HIGH | Stop deploy; restore DB snapshot; regenerate baseline from `lib/db.ts`; replay stamp script |
| Empty schema after `getDb()` strip | HIGH | Run migrate job manually; temporary revert to migrate-on-boot |
| Kysely tenant column leak | MEDIUM | Hotfix narrow types; audit affected rows; add regression test |
| Broken App Router paths | MEDIUM | Restore `app/` shells pointing at modules; redeploy |
| Proxy browser regression | LOW | Revert PROXY-01 branch; keep route 401 matrix |
| Dual budget data mixed | HIGH | Stop writes; identify rows; ETL or mark v1 read-only |
| Wrong ops route gating | MEDIUM | Revert assert changes; redeploy break-glass path |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stale DATA branch merge | DATA-01..03 | `0001` diff includes v2 tables; empty + brownfield CI |
| Empty-schema boot | DATA-01..03 | New pod + migrate job → login works |
| Kysely allowlist drift | ENF-02 | Mass-assignment tests; no `as any` in repos |
| App Router / import break | MOD-01 | `next build`; standalone curl; Vitest count stable |
| Proxy 401 vs 307 | PROXY-01 | curl matrix from 06-PROXY-FINDING + JSON content-type |
| D-23 over/under gating | THIN-01 | Route gate inventory tests; ops smoke |
| Dual budget confusion | NIT-02 | Decision doc; fiscal KPI source grep |
| RSC/hook double fetch | PERF-02 | React DevTools network single fetch |
| Grid virtualization regressions | PERF-01 | 500-row manual test; export selection test |
| v2 UI gate parity | UI-* modules | Page URL 403 tests for Viewer/PM |
| HYG-02 scope creep | HYG-02 | Operator written confirm; status code script |
| Nyquist archive mutation | NYQ-01 | v2.1-only scope; archived files git unchanged |
| ESLint wrapper gate noise | ENF-01 | CI green on main after MOD-01 |
| Cold-start false baseline | PERF-03 | Post-DATA benchmark recorded |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| DATA-01..03 | Brownfield ledger gap | Stamp script + dual CI matrix |
| MOD-01 | Route 404 | Thin `app/` shells mandatory |
| ENF-02 | Types out of sync with migrations | Generate types in DATA CI |
| ENF-01 | Lint blocks refactor | Allowlist shrink weekly |
| THIN-01 | D-23 gate change | Route class inventory in PLAN |
| PROXY-01 | Browser redirect break | Separate API/page branches |
| PERF-01 | Export/select bugs | Explicit selection semantics |
| PERF-02 | RSC boundary errors | Serializable props audit |
| PERF-03 | Pre-DATA metrics | Re-measure after DATA |
| UI-DASH etc. | UI-only security | API 403 tests duplicated at page layer |
| NIT-02 | Fiscal/v1 mix | Product decision before tiles |
| NYQ-01 | Archive rewrite | Scope to Phase 19+ only |
| HYG-02 | Code rewrite | Confirm-only default |

## Sources

- `.planning/PROJECT.md` — v2.1 scope, DATA replay decision, D-23 context, dual budget
- `.planning/milestones/v2.0-MILESTONE-AUDIT.md` — tech_debt inventory, Nyquist not-validated
- `.planning/milestones/v1.0-phases/06-access-enforcement-rollout/06-PROXY-FINDING.md` — proxy live behavior, standalone manifest
- `lib/db.ts` — migrate loop, seed, no ledger today
- `proxy.ts` — cookie-presence redirect, PUBLIC list
- `.planning/codebase/CONCERNS.md` — ops/admin bypass, HYG-02, cold start
- `.planning/milestones/v2.0-phases/15-budget-value-roi-dependencies/15-CONTEXT.md` — parallel fiscal vs v1 D-01
- `.planning/milestones/v2.0-phases/10-users-roles-server-authorization/10-*-PLAN.md` — D-23 carve-out
- `next.config.ts` — `output: 'standalone'`, `serverExternalPackages`

---
*Pitfalls research for: PM Tool B v2.1 Hardening & Deferred Debt*
*Researched: 2026-08-28*
