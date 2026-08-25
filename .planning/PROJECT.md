# PM Tool B — Portfolio One View

## What This Is

Multi-tenant project/portfolio management app (Next.js 16 App Router, React 19, PostgreSQL) used as a centralized PPM for CPMO, PMs, and viewers. v1.0 established layers, tenant isolation, Jira/AI/export clients, and decomposed god pages. v2.0 brings the product into compliance with the GuiIT Portfolio One View business spec (PR-01..PR-15) while keeping Jira import, AI reports, and Excel/PPT/Word export.

## Core Value

One source of truth for projects, milestones, RAID, and weekly reports — role- and project-scoped — so CPMO and PMs act on highlights, nearest milestones, open risks/issues, and items that need leadership support.

## Current Milestone: v2.0 Portfolio One View

**Goal:** Bring the existing PPM app into compliance with the GuiIT Portfolio One View spec (PR-01..PR-15), keep Jira/AI/export, and put `company_id` on the four mapping tables left from v1.0.

**Target features:**
- Users, roles, login, and server-side authorization (CPMO / PM / Viewer)
- Project master data, PM assignment, stakeholders, dependencies, milestones
- Budget & value, RAID register as master with weekly snapshots
- Weekly-report period config, PM submit/versioning, CPMO tracking/export
- Portfolio and PM dashboards
- Project documents: templates + Confluence checklist (no file upload)

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

Remainder (ops/admin/config routes still repo-direct, proxy HTML-307 for API callers) is accepted v1.0 tech debt — see `.planning/milestones/v1.0-MILESTONE-AUDIT.md`. D-23 leftover: `app/api/operations/**` and platform `/api/admin/companies` stay session+tenant this milestone until later phases.

### Active

**v2.0 Portfolio One View** — spec is source of truth. Existing screens/APIs that already match stay; mismatches change. Jira import, AI reports, and Excel/PPT/Word export stay.

- [ ] PR-06 Cross-project dependencies
- [ ] PR-07 Milestones (dashboard UI in Phase 16; weekly snapshot in Phase 13)
- [ ] PR-08 Budget and value (approved vs actual, financial/non-financial benefits, ROI)
- [ ] PR-09 Risk & Issue register weekly snapshots and sync on submit (masters shipped Phase 12)
- [ ] PR-10 CPMO weekly-report period configuration
- [ ] PR-11 PM draft/submit weekly report with versioned snapshots
- [ ] PR-12 CPMO submission tracking, consolidate, and export
- [ ] PR-13 Portfolio dashboard (active count, RAG, stage, high RAID, overdue milestones, drill-down)
- [ ] PR-14 PM personal dashboard (assigned projects + weekly/milestone/RAID actions)
- [ ] PR-15 Project documents: CPMO templates + Confluence checklist (PM does not upload files)

### Out of Scope

- DATA-01..03 (migrations out of `getDb()`, versioned migration files, data-fix scripts) — still deferred; cold-start slowness is not this milestone
- ENF-01..02 (ESLint wrapper gate, Kysely) — still deferred
- PERF-01..03 (grid virtualization, RSC chrome, cold-start budget) — still deferred
- Remaining ops/admin/config/import-mapping service thinning, proxy JSON 401, Anthropic 502 operator confirm, Jira search debug log — leftover v1.0 debt, not this milestone
- Replacing Jira import, AI report generation, or Excel/PPT/Word export — keep them alongside spec work
- Uploading project document binaries into the app — spec stores Confluence links only
- Replacing the stack (Next/React/Postgres/`pg`)
- Rewriting `lib/db.ts` PostgresClient dialect bridge
- Committing the GuiIT Word spec — local reference only (`docs/GuiIT_2008_Portfolio One View_Yeu cau nghiep vu (1).docx`)

## Current State

**Shipped:** v1.0 Layer Reorg & Hardening (2026-08-25) — 8 phases, 35 plans. Archive: `.planning/milestones/`.

**Now:** v2.0 Portfolio One View — Phases 9–12 shipped. Next is Phase 13: weekly periods and PM submit.

The brownfield mess listed at kickoff is largely gone on the project-scoped path: tests exist (Vitest, 1019 passing), SQL lives in repositories, Jira/Anthropic/Resend go through clients + one credential resolver, services own tenant checks, wrappers enforce access, and the seven named god pages are decomposed.

Existing project/RAID/budget/report/dashboard screens now enforce CPMO/PM/Viewer on the server; they still do not match L0–L5 rules, snapshot weekly reports, or the Confluence document checklist.

## Next Milestone Goals

v2.0 is in progress. After it: leftover v1.0 debt (ops-route thinning, proxy JSON 401, HYG-02 confirm) and DATA/ENF/PERF.

## Context

Brownfield, post-reorg. Codebase map still in `.planning/codebase/` (dated 2026-08-07; structure has moved).

Business spec (reference only, not in git): `docs/GuiIT_2008_Portfolio One View_Yeu cau nghiep vu (1).docx` — Draft 1.0, 20/08/2026. General principles: one master data source; least-privilege by role and project; actionable data first.

Still true and still not this milestone:

- **Migrations in app code.** `getDb()` still runs schema init + migrate on cold start.
- **Non-core routes.** operations/admin/config/import-mapping still call repos directly.

## Constraints

- **Tech stack**: Next.js 16.2.4 / React 19.2.4 / TypeScript strict / PostgreSQL via `pg` — no framework swaps
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
| Refactor + opportunistic fixes, not pure freeze | Moving code surfaces real bugs; leaving them in place to preserve a bug-for-bug freeze wastes the pass | HYG-02: Anthropic 500→502 still needs operator confirm |
| Migrations-out-of-`getDb()` deferred | Real problem, but cold-start slowness is not a correctness or isolation risk | Still deferred (not v2.0) |
| INTG-08 evidence before deleting dead Jira helpers | Resolver live paths already matched; deletion gated on `verify-credential-cutover.ts` | Closed Phase 8 (`e0b2cea`) |
| Spec as source of truth for v2.0 | Bank PPM requirements are the product; existing screens that already match stay, mismatches change | — Pending |
| Keep Jira / AI / Excel-PPT-Word export | Spec does not replace those integrations; they remain differentiators beside One View | — Pending |
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
*Last updated: 2026-08-26 after Phase 12*
