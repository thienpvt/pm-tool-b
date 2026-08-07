# PM Tool B — Layer Reorg & Hardening

## What This Is

Multi-tenant project/portfolio management app (Next.js 16 App Router, React 19, PostgreSQL) with Jira import, AI-generated reports, and Excel/PPT/Word export. This milestone is not new features — it is a structural reorg of an existing messy codebase: introduce real layers front to back, then fix the security and integration concerns the codebase map surfaced.

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

### Active

**Layer reorg (full stack, layer-by-layer sweep):**

- [ ] Define target layer structure: route handler → service → repository, and `lib/integrations/*` for external clients
- [ ] Backend sweep: move all `app/api/**` business logic into services; routes become thin (parse → authorize → call service → respond)
- [ ] Data sweep: all SQL behind repositories; no inline SQL in routes or services
- [ ] Integration sweep: typed clients for Jira, Anthropic, Resend in `lib/integrations/` — no raw `fetch`/SDK calls in routes
- [ ] Unified credential resolution: one resolver replacing the env-name-in-DB (Jira) vs env-then-DB (Anthropic) split patterns
- [ ] Contract validation at external boundaries: parse/validate Jira responses and Claude output instead of trusting untyped shapes
- [ ] UI sweep: break up god pages into feature modules + hooks — `app/portfolio/report/page.tsx` (~2828), `app/projects/[id]/timeline/page.tsx` (~1978), `app/projects/[id]/report/page.tsx` (~1426), `app/projects/[id]/milestones/page.tsx` (~1275), `components/timeline/ImportMappingDialog.tsx` (~1265), `app/portfolio/roadmap/page.tsx` (~1230), `app/page.tsx` (~1064)

**Security fixes (first priority after reorg):**

- [ ] `requireUser` + `assertProjectAccess(projectId, user)` enforced on every project-scoped, import, and export route — replaces uneven per-file checks
- [ ] Eliminate dynamic SQL column assignment (`UPDATE ... SET ${k} = ?` from `Object.keys(body)`) — explicit column allowlists per resource
- [ ] Real session validation at the edge, or guaranteed `getSessionFromRequest` on every route — `proxy.ts` currently checks cookie presence only
- [ ] Confirm Next 16 actually runs `proxy.ts` in deploy (no `middleware.ts` present)

**Tests (alongside each layer, not after):**

- ✓ Stand up a test runner — Phase 1 (Vitest 4: node + jsdom + route-handler + Postgres repo patterns; CI gate)
- [ ] Repository/service tests per layer as it is moved
- [ ] Route-level authorization tests proving 403 on cross-company `project_id`
- [ ] Integration client tests with mocked Jira/Anthropic/Resend responses

**Deferred to a later milestone (tracked, not in this scope):**

- [ ] Move schema init + migration loop out of `getDb()` into an external migrate job

### Out of Scope

- New product features — this milestone is structural; feature work resumes after
- API/UI redesign — refactor + opportunistic bug fixes only, not a redesign; endpoint shapes and screens stay recognizable
- Replacing the stack (Next/React/Postgres/`pg`) — the mess is organization, not technology choice
- Rewriting `lib/db.ts` PostgresClient dialect bridge — fragile but working; touch only where a repository requires it
- Perf work (grid virtualization, server components for chrome) — follows the UI sweep, not part of it

## Context

Brownfield. Codebase already mapped — see `.planning/codebase/` (ARCHITECTURE, STRUCTURE, STACK, CONVENTIONS, INTEGRATIONS, CONCERNS, TESTING), analysis dated 2026-08-07.

The mess, concretely:

- **No layers.** Route handlers hold parsing, authorization, SQL, and external API calls in one file.
- **Auth applied unevenly.** `app/api/projects/route.ts` and budget routes check access; activities, risks, issues, meetings, escalations, team, documents, bugs, holidays, milestones, import-mapping, export, config, parse-file-headers do not. New routes copy the unauthed template → silent IDOR.
- **Integration layer absent.** Native `fetch` for Jira and Resend, `@anthropic-ai/sdk` inline. Each route reinvents auth, parsing, and error mapping.
- **Two credential patterns.** Jira stores env-var *names* per company in `company_jira_config` and reads `process.env[name]`; Anthropic resolves env-then-DB `settings`. Neither is discoverable from the other.
- **External responses untyped.** Jira field shapes and Claude output parsed ad-hoc per route.
- **God UI pages.** Seven components 1000–2800 lines mixing fetch, state, tables, dialogs, export. No unit seams.
- **Zero tests.** No runner, no `*.test.*`. Every refactor is currently unverifiable.
- **Migrations in app code.** `getDb()` runs `initPostgresSchema` + a long `migratePostgresSchema` loop + backfill + seed on every cold start.

## Constraints

- **Tech stack**: Next.js 16.2.4 / React 19.2.4 / TypeScript strict / PostgreSQL via `pg` — no framework swaps
- **Compatibility**: Behavior freeze except intentional security changes (new 403s) and opportunistic bug fixes; existing endpoints and screens keep working
- **Migration strategy**: Layer-by-layer sweep — establish target structure, move backend layers in one pass, UI in the next. Fewer half-states, larger blast radius per phase, so tests land with each layer
- **Testing**: Zero coverage today; a layer is not done until it has tests. This is the only guardrail against a full-stack refactor
- **Deployment**: Docker/GHCR + Railway + K8s must keep building; `output: 'standalone'` and `serverExternalPackages` (`exceljs`, `pptxgenjs`) preserved
- **Security**: Multi-tenant — tenant isolation is not optional; every project-scoped path must assert company access
- **Import convention**: `@/` alias for all app-root imports

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Reorg layers before fixing concerns | Fixing auth per-file in the current shape means copy-paste that the next route will skip; layers give one place to enforce it | — Pending |
| Full stack incl. UI, not backend-only | God pages are as much of the mess as the routes; stopping at the backend leaves half the problem | — Pending |
| Layer-by-layer sweep over per-feature incremental | Fewer coexisting old/new shapes; the codebase is already inconsistent enough | — Pending |
| Security first among concerns | IDOR + mass-assignment SQL are live tenant-isolation holes; migrations and perf are not | — Pending |
| Tests alongside reorg, not a pre-built safety net | Contract snapshots over endpoints that are about to move by design would mostly re-encode the mess | Vitest 4 harness shipped in Phase 1 — node unit, jsdom component, route-handler (no server), Postgres repo, CI gate all proven |
| Refactor + opportunistic fixes, not pure freeze | Moving code surfaces real bugs; leaving them in place to preserve a bug-for-bug freeze wastes the pass | — Pending |
| Migrations-out-of-`getDb()` deferred | Real problem, but cold-start slowness is not a correctness or isolation risk | — Pending |

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
*Last updated: 2026-08-07 after Phase 1 (Test Harness)*
