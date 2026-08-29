# PM Tool B — Portfolio One View

## What This Is

Multi-tenant project/portfolio management app (Next.js 16 App Router, React 19, PostgreSQL) used as a centralized PPM for CPMO, PMs, and viewers. v1.0 established layers, tenant isolation, Jira/AI/export clients, and decomposed god pages. v2.0 brought the product into compliance with the GuiIT Portfolio One View business spec (PR-01..PR-15) at the API/service gate. v2.1 closes leftover debt: one migration cutover, repo-wide per-module backend/UI split, Kysely, performance, leftover routes, v2 UI consumers, and audit nits.

## Core Value

One source of truth for projects, milestones, RAID, and weekly reports — role- and project-scoped — so CPMO and PMs act on highlights, nearest milestones, open risks/issues, and items that need leadership support.

## Current Milestone: v2.1 Hardening & Deferred Debt (shipped)

**Goal:** Close leftover v1.0/v2.0 debt, and reorganize the whole repo so each feature module keeps backend and UI in separate directories.

**Shipped 2026-08-29.** Archive: `.planning/milestones/v2.1-*` and `.planning/milestones/v2.1-phases/`. Audit: `passed` (28/28).

**Target features:**
- Repo-wide per-module backend/UI split (every existing feature area, not only new v2 screens)
- One migration task (DATA-01..03 together): replay origin `gsd/quick-260826-ded-data-layer-migrations` onto current master; regenerate baseline for v2.0 schema
- ENF-01 wrapper ESLint/CI gate; ENF-02 repositories adopt Kysely
- PERF-01..03 grid virtualization, RSC chrome, cold-start budget
- Leftover v1 debt: ops/admin/config thinning, proxy JSON 401, Jira search hygiene, HYG-02 confirm
- v2 UI consumers per module: dashboards, weekly reports, document checklist, audit viewer
- Audit nits: unused wrappers, fiscal KPIs, no-op milestone audit, v1 budget coexistence, Nyquist validate-phase

## Requirements

### Validated

<!-- Shipped and relied upon. Spec-compliant replacements land in Active; these must not regress tenant isolation or integrations. -->

- ✓ Multi-tenant auth: scrypt password hash, DB-backed sessions, company scoping — `lib/auth.ts`
- ✓ Project CRUD + nested resources (activities, risks, issues, meetings, escalations, team, documents, bugs, holidays, milestones, budget)
- ✓ Portfolio views: home, roadmap, report, budget, members
- ✓ Programs, Resources, Operations modules
- ✓ Jira Cloud import: search, fields, test, sync-mappings, JQL presets; per-company credential config
- ✓ AI report generation via Anthropic (portfolio/project reports, email HTML)
- ✓ Export: Excel (`exceljs`), PowerPoint (`pptxgenjs`), Word (`docx`), client PDF
- ✓ Deploy: Docker → GHCR via GH Actions; Railway + K8s manifests; `/api/health`

### Validated (v1.0)

- ✓ Layer structure: route handler → service → repository, `lib/integrations/*` for external clients
- ✓ Core project-scoped routes thin: parse → authorize (`withAuth` / `withProjectAccess`) → service → respond
- ✓ SQL behind repositories with column allowlists (REPO-01..06)
- ✓ Typed Jira / Anthropic / Resend clients; unified `resolveJiraCredentials` / Anthropic / Resend resolvers (INTG-07, INTG-08 cutover)
- ✓ Zod validation at Jira and Anthropic client boundaries
- ✓ Seven god pages split into hooks + feature modules (UI-01..11)
- ✓ `withProjectAccess` on project-scoped, import, and export routes; 401/403 tests (ROUTE-03, 04, 08–11)
- ✓ Vitest 4 harness + layer tests including cross-company 403 and mocked integration clients (1019 passing after Phase 10)
- ✓ TENANT-01 — `company_id` on `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, `jira_sync_mappings`; multi-company CROSS JOIN backfill; cross-company 403 — Phase 9
- ✓ PR-01 / USER-01..06 — CPMO user admin: unique username+email, multi-role union, Active/Inactive/Locked, lock/unlock with actor+time, soft-delete only — Phase 10
- ✓ PR-02 / AUTH-01..06 — SessionUser.roles is authorization truth; company-scoped CPMO; PM write follows assignment windows (Phase 11 replaced interim email/name lookup); Viewer mutators 403; Inactive/Locked cannot obtain or keep a session — Phase 10–11
- ✓ PR-03 / PROJ-01..08 — Company-scoped unique `project_code`, L0–L5 governance with JSON warnings, live `progress_pct`, weekly-report flag — Phase 11
- ✓ PR-04 / PMAS-01..04 — Assignment windows (`project_pm_assignments`); one active primary or none; collaborators cascade when primary ends; write access follows the window — Phase 11
- ✓ PR-07 / MS-01..03, MS-05 — Milestone master: cancel-in-place (no physical delete), upcoming 7-day and overdue helpers — Phase 12
- ✓ RAID-01, RAID-04..06 — RAID master: unique codes, deactivate-in-place, due-date history, High-open record counts, tech-council list — Phase 12
- ✓ PR-10 / PERD-01..03 — CPMO weekly periods, frozen due/config snapshot, overdue computed, obligated shells only — Phase 13
- ✓ PR-11 / WKRP-01..06, MS-04, RAID-02..03 — PM draft/submit/correct with versioned snapshots; RAID writes on submit only; progress_pct copy-never-write-back — Phase 13
- ✓ PR-12 / CPMO-01..04 — Period tracking counts/filters and snapshot-only consolidated xlsx/docx/pptx export — Phase 14
- ✓ PR-06 / DEP-01..03 — Bidirectional cross-project dependencies (write on from, access on to, soft-end, no physical DELETE) — Phase 15
- ✓ PR-08 / BUDG-01..06 — Parallel fiscal budget (integer VND, append-only adjustments), financial/non-financial benefits, honest ROI — Phase 15
- ✓ PR-13 / PDSH-01..06 — Spec CPMO portfolio KPIs, AND session filters, drill-downs, xlsx/pdf export on `/api/dashboards/portfolio` — Phase 16
- ✓ PR-14 / MDSH-01..05 — Assignment-scoped PM dashboard with weekly/milestone/RAID action queues and deep-link hrefs — Phase 16
- ✓ PR-15 / DOC-01..06 — Document catalog, URL-only templates, Confluence HTTPS checklist (no project binaries), CPMO compliance — Phase 17
- ✓ AUDIT-01 — Governed mutations append actor/time/entity/before-after on `audit_logs`; INSERT+SELECT only; CPMO GET `/api/audit` company-scoped — Phase 18

v2.0 remainder (no React consumers of v2 APIs, no repo-wide module split, Kysely, RSC chrome) is **this milestone's remaining Active set**. See `.planning/milestones/v1.0-MILESTONE-AUDIT.md` and `v2.0-MILESTONE-AUDIT.md`.

### Active

- ✓ MOD-01 / MOD-02 — Feature modules under `modules/<feature>/{backend,ui}/`; thin `app/` re-exports keep URLs — Phase 24
- ✓ DATA-01..03 — External versioned SQL migrate + checksum ledger; `getDb()` connects, asserts ledger, seeds only; data-fixes under `scripts/data-fixes/` — Phase 19
- ✓ PROXY-01 — Unauthenticated `/api/*` JSON 401 `{ error: 'Unauthorized' }`; pages still redirect to login — Phase 20
- ✓ JIRA-01 — Jira search drops field dump; malformed JSON → 400 `{ error: 'Invalid JSON' }` — Phase 20
- ✓ ENF-01 — ESLint `require-auth-wrapper` + allowlist file; `npm run lint` in CI — Phase 20
- ✓ THIN-01 — Ops/admin/config/import-mapping through services; D-23 break-glass unchanged — Phase 20
- ✓ PDSH-07 / MDSH-06 / NIT-04 — Spec portfolio + PM dashboard pages in `modules/dashboards/ui/`; fiscal KPIs omitted (live on `/portfolio/budget`) — Phase 21
- ✓ PERD-04 / WKRP-07 / CPMO-05 / PERF-01 — Weekly periods, PM editor, tracking/export, in-repo VirtualRows in `modules/weekly/ui/` — Phase 22
- ✓ DOC-07 / DOC-08 / DOC-09 / AUDIT-02 — Catalog, Confluence checklist, compliance, audit viewer in `modules/documents/ui/` and `modules/audit/ui/` — Phase 23
- ✓ ENF-02 — Repositories query through Kysely on the existing `pg.Pool`; runtime `pickAllowed` / `UnknownColumnError` mass-assignment stays — Phase 25
- ✓ PERF-02 / PERF-03 — Server `PageChrome` on v2 Sidebar routes; `getDb()` cold-start p95 budget recorded — Phase 26
- ✓ NIT-01 — `listPeriodShells` and `listOpenProjectDependencies` stay consumed (contract test) — Phase 27
- ✓ NIT-02 — No-op milestone PATCH skips `auditLog`; partial PATCH preserves omitted fields — Phase 27
- ✓ NIT-03 — v1 `budget_items` vs fiscal ledger coexistence documented — Phase 27
- ✓ NYQ-01 — Phases 19–27 have non-draft `VALIDATION.md` with `nyquist_compliant: true` — Phase 27
- ✓ HYG-02 — Operator accepts Anthropic malformed-output 502 (vs old 500) on the three report routes; no rewrite — Phase 27

### Out of Scope

- Replacing Jira import, AI report generation, or Excel/PPT/Word export — keep them alongside spec work
- Uploading project document binaries into the app — spec stores Confluence links only
- Replacing Next.js / React / PostgreSQL
- CASL / casbin / a second policy engine — three fixed roles; extend existing wrappers
- Merging `origin/gsd/quick-260826-ded-data-layer-migrations` as-is — v1.0-era baseline would drop v2.0 tables; replay the runner pattern and regenerate SQL from current `lib/db.ts`
- Committing the GuiIT Word spec — local reference only (`docs/GuiIT_2008_Portfolio One View_Yeu cau nghiep vu (1).docx`)

## Current State

**Shipped:** v1.0 Layer Reorg & Hardening (2026-08-25) — 8 phases, 35 plans. Archive: `.planning/milestones/`.

**Shipped:** v2.0 Portfolio One View (2026-08-26) — Phases 9–18, 40 plans. Archive: `.planning/milestones/`. Audit: `tech_debt` (79/79 requirements, UI deferred).

**Shipped:** v2.1 Hardening & Deferred Debt (2026-08-29) — Phases 19–27, 56 plans. Archive: `.planning/milestones/`. Audit: `passed` (28/28).

**Now:** Awaiting next milestone (`/gsd-new-milestone`).

CPMO/PM/Viewer is enforced on spec APIs. Feature areas live under `modules/<feature>/{backend,ui}/` with thin `app/` re-exports. Repositories query through Kysely on the existing `pg.Pool`. v2 Sidebar routes use server `PageChrome`. Nits, Nyquist closeout, and HYG-02 502 accept are recorded.

## Next Milestone Goals

None defined. Run `/gsd-new-milestone` when ready.

## Context

Brownfield, post-v2.0. Codebase map still in `.planning/codebase/` (dated 2026-08-07; structure has moved).

Business spec (reference only, not in git): `docs/GuiIT_2008_Portfolio One View_Yeu cau nghiep vu (1).docx` — Draft 1.0, 20/08/2026.

Origin branch `gsd/quick-260826-ded-data-layer-migrations` already implements DATA-01..03 against **v1.0** schema (merge-base `f793e7d`). Use it as the runner/ledger/data-fix pattern. Do not merge it onto current master. Regenerated `migrations/0001` must include v2.0 weekly, fiscal, roles, RAID master, dashboard, checklist, and audit tables.

This milestone:

- **Migrations leave `getDb()`.** External migrate job + versioned SQL + one-off data-fix scripts.
- **Repo layout.** Every feature module: backend dir and UI dir, separate. Whole repo, not only new screens.
- **Non-core routes.** operations/admin/config/import-mapping move onto services.

## Constraints

- **Tech stack**: Next.js 16.2.4 / React 19.2.4 / TypeScript strict / PostgreSQL — no Next/React/Postgres swap. Kysely over the existing pool is in scope (ENF-02); do not introduce a second ORM
- **Module layout**: Each feature module keeps backend and UI in separate directories across the whole repo; exact App Router mapping is a planning decision
- **Migrations**: DATA-01..03 is one task; replay origin branch pattern; regenerate baseline from current schema; do not merge the v1.0-era branch as-is
- **Spec authority**: GuiIT Portfolio One View is source of truth for product behavior; keep Jira/AI/export
- **Layers**: New work follows route → service → repository; tenant isolation is not optional
- **Testing**: Vitest 4 is the gate; a capability is not done until its tests exist and pass (HYG-03)
- **Deployment**: Docker/GHCR + Railway + K8s must keep building; `output: 'standalone'` and `serverExternalPackages` (`exceljs`, `pptxgenjs`) preserved
- **Security**: Multi-tenant company scoping plus spec roles (CPMO / PM / Viewer); hiding UI is not access control; passwords/tokens follow bank ATTT expectations in the spec
- **Documents**: Templates live in-app; actual project files live on Confluence (link + metadata only)
- **Import convention**: `@/` alias for all app-root imports

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Reorg layers before fixing concerns | Fixing auth per-file in the current shape means copy-paste that the next route will skip; layers give one place to enforce it | Shipped — wrappers + services are the enforcement point |
| Full stack incl. UI, not backend-only | God pages are as much of the mess as the routes; stopping at the backend leaves half the problem | Shipped — Phase 7 decomposed the seven named pages |
| Layer-by-layer sweep over per-feature incremental | Fewer coexisting old/new shapes; the codebase is already inconsistent enough | Shipped — 8 sequential phases |
| Security first among concerns | IDOR + mass-assignment SQL are live tenant-isolation holes; migrations and perf are not | Shipped on project-scoped routes; two live IDORs closed in Phase 4 |
| Tests alongside reorg, not a pre-built safety net | Contract snapshots over endpoints that are about to move by design would mostly re-encode the mess | Vitest 4 + 727 tests; HYG-03 held |
| Refactor + opportunistic fixes, not pure freeze | Moving code surfaces real bugs; leaving them in place to preserve a bug-for-bug freeze wastes the pass | HYG-02 accepted 502 (Phase 27) |
| Migrations-out-of-`getDb()` deferred in v1–v2 | Cold-start slowness was not a correctness risk then | Reopened — single DATA task in v2.1 |
| DATA-01..03 as one task | Origin `gsd/quick-260826-ded-data-layer-migrations` already shipped them together; splitting into three phases adds ceremony | Shipped Phase 19 |
| Replay DATA branch, do not merge | Branch baseline is post-v1.0 / pre-v2.0; merge would omit weekly/fiscal/roles/RAID/dashboard/checklist/audit tables | Shipped Phase 19 (pattern-only; regenerated 0001) |
| API vs page by `/api/` prefix | Accept-header detection would 401 HTML navigations that send `application/json` | Shipped Phase 20 |
| ENF-01 allowlist file, not comments | Comment exemptions drift; posix path list is the D-23 carve-out | Shipped Phase 20 |
| Repo-wide backend/UI split per module | Not only new v2 screens — every existing feature area gets separate backend and UI dirs | Shipped Phase 24 |
| Kysely in v2.1 (ENF-02) | Allowlists stay; compile-time column safety. Still no Prisma / second ORM / Postgres replacement | Shipped Phase 25 |
| INTG-08 evidence before deleting dead Jira helpers | Resolver live paths already matched; deletion gated on `verify-credential-cutover.ts` | Closed Phase 8 (`e0b2cea`) |
| Spec as source of truth for v2.0 | Bank PPM requirements are the product; existing screens that already match stay, mismatches change | Shipped Phases 9–18 (PR-01..15 + AUDIT-01) |
| Spec dashboard pages consume Phase 16 APIs only | Do not mix `/api/portfolio` or overwrite `/` and `/dashboard` | Shipped Phase 21 |
| In-repo VirtualRows, no new npm | PERF-01 at ~100+ rows without `@tanstack/react-virtual`; Phase 16 weekly hrefs kept | Shipped Phase 22 |
| Keep Jira / AI / Excel-PPT-Word export | Spec does not replace those integrations; they remain differentiators beside One View | Kept — not rewritten |
| Keep existing `audit_logs` + INSERT `auditLog` | Second table would dual-write; column `company_id` already existed | Shipped Phase 18 (D-01, D-10 skip migrate) |
| GET `/api/audit` withCpmo + `assertCompanyWrite` | Company-scoped SELECT; PM/Viewer/null-company 403; INSERT+SELECT only | Shipped Phase 18 (D-04..D-07) |
| RAID audit entity_type stays `risk` / `issue` | Do not invent a unified `raid` string; fill create/update gaps only | Shipped Phase 18 (D-02) |
| v2.0 deferred pack is TENANT-01 only | User pointed at the four mapping-table `company_id` follow-up, not DATA/ENF/PERF or leftover route debt | Shipped Phase 9 |
| Mapping tenancy via `migrateMappingTableTenancy` | Nullable column → duplicate-per-company backfill → NOT NULL+FK → `UNIQUE(company_id, name)` (JQL adds `context`); never collapse to company 1 | Shipped Phase 9 |
| Authorization truth is `roles[]`, not `is_admin` | Backfilled admins stay `is_admin=1` for leftover platform routes; product checks must not use that flag as a cross-tenant bypass (D-03, D-13) | Shipped Phase 10 |
| Interim PM match via `pm_email` then `pm_name` | Phase 11 replaces the lookup only; `assertPmWriteAccess` is the seam (D-14) | Shipped Phase 10 |
| AUTH-05 leftover carve-out (D-23) | `operations/**` and platform `/api/admin/companies` stay session+tenant; product mutators including AI POSTs and mapping tables are role-gated | Shipped Phase 10 |
| Word spec stays local, not committed | Reference document only; do not add the `.docx` to git | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-29 after v2.1 milestone complete*
