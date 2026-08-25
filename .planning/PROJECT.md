# PM Tool B — Layer Reorg & Hardening

## What This Is

Multi-tenant project/portfolio management app (Next.js 16 App Router, React 19, PostgreSQL) with Jira import, AI-generated reports, and Excel/PPT/Word export. v1.0 was a structural reorg of a messy codebase: real layers front to back, then the security and integration concerns the codebase map surfaced. Feature work resumes after `$gsd-new-milestone`.

## Core Value

Every project-scoped request is tenant-isolated and every layer has one job — so a new route or page cannot silently reintroduce IDOR or a 2000-line god component.

## Requirements

### Validated

<!-- Inferred from existing code — shipped and relied upon. Behavior must survive the reorg. -->

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
- ✓ Vitest 4 harness + layer tests including cross-company 403 and mocked integration clients (727 passing)

Remainder (ops/admin/config routes still repo-direct, proxy HTML-307 for API callers) is accepted v1.0 tech debt — see `.planning/milestones/v1.0-MILESTONE-AUDIT.md`.

### Active

**Next milestone** — not defined. Run `$gsd-new-milestone` to gather goals.

Carried-forward debt candidates:

- [ ] Service-layer remaining ops/admin/config/import-mapping routes (SVC-01 / ROUTE-05 remainder)
- [ ] Confirm Anthropic malformed-output 502 vs old 500 with operators (HYG-02)
- [ ] JSON 401 from `proxy.ts` for API callers (currently HTML 307)
- [ ] Remove Jira search debug `console.log` / guard `req.json()`

**Deferred to a later milestone (tracked, not in this scope):**

- [ ] Move schema init + migration loop out of `getDb()` into an external migrate job

### Out of Scope

- New product features — this milestone is structural; feature work resumes after
- API/UI redesign — refactor + opportunistic bug fixes only, not a redesign; endpoint shapes and screens stay recognizable
- Replacing the stack (Next/React/Postgres/`pg`) — the mess is organization, not technology choice
- Rewriting `lib/db.ts` PostgresClient dialect bridge — fragile but working; touch only where a repository requires it
- Perf work (grid virtualization, server components for chrome) — follows the UI sweep, not part of it

## Current State

**Shipped:** v1.0 Layer Reorg & Hardening (2026-08-25) — 8 phases, 35 plans. Archive: `.planning/milestones/`.

The brownfield mess listed at kickoff is largely gone on the project-scoped path: tests exist (Vitest, 727 passing), SQL lives in repositories, Jira/Anthropic/Resend go through clients + one credential resolver, services own tenant checks, wrappers enforce access, and the seven named god pages are decomposed.

## Next Milestone Goals

Undefined. Start with `$gsd-new-milestone`. Likely inputs: remaining admin/ops service thinning, proxy API 401, operator confirm of Anthropic 502.

## Context

Brownfield, post-reorg. Codebase map still in `.planning/codebase/` (dated 2026-08-07; structure has moved).

Still true:

- **Migrations in app code.** `getDb()` still runs schema init + migrate on cold start (deferred).
- **Non-core routes.** operations/admin/config/import-mapping still call repos directly.

## Constraints

- **Tech stack**: Next.js 16.2.4 / React 19.2.4 / TypeScript strict / PostgreSQL via `pg` — no framework swaps
- **Compatibility**: Behavior freeze except intentional security changes (new 403s) and opportunistic bug fixes; existing endpoints and screens keep working
- **Migration strategy**: Layer-by-layer sweep — establish target structure, move backend layers in one pass, UI in the next. Fewer half-states, larger blast radius per phase, so tests land with each layer
- **Testing**: Vitest 4 is the gate; a layer is not done until its tests exist and pass (HYG-03)
- **Deployment**: Docker/GHCR + Railway + K8s must keep building; `output: 'standalone'` and `serverExternalPackages` (`exceljs`, `pptxgenjs`) preserved
- **Security**: Multi-tenant — tenant isolation is not optional; every project-scoped path must assert company access
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
| Migrations-out-of-`getDb()` deferred | Real problem, but cold-start slowness is not a correctness or isolation risk | Still deferred |
| INTG-08 evidence before deleting dead Jira helpers | Resolver live paths already matched; deletion gated on `verify-credential-cutover.ts` | Closed Phase 8 (`e0b2cea`) |

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
*Last updated: 2026-08-25 after v1.0 milestone complete*
