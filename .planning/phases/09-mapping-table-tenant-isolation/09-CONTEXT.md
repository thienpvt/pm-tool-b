# Phase 9: Mapping Table Tenant Isolation - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all four grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Close TENANT-01: `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, and `jira_sync_mappings` become company-scoped. A user in company A cannot read or mutate another company's mapping/preset/sync rows (cross-company 403). Every row belongs to a company; listings and unique names are scoped to that company. Existing mapping data remains usable after backfill — no orphaned rows and no collapse of all tenants into one company.

**Requirements:** TENANT-01

This phase is isolation of four leftover global tables, not a product-UX change and not CPMO/PM/Viewer role work (Phase 10). Do not redesign import dialogs, do not add roles, do not thin remaining ops routes.

**Scale from scout (2026-08-25):**
- `lib/repositories/import-mapping.repo.ts` lists/creates/updates/deletes timeline + bug mappings with no `company_id` (comment: "global, not company-scoped").
- Routes already wrap these tables with `withAuth` (401 only) — v1.0 Phase 6 recorded the residual IDOR as this follow-up.
- Session already carries `company_id` (`SessionUser`, `AccessActor`).
- UI (`useImportMapping`, Jira sync dialog) fetches list APIs; no client-side company filter exists or is needed if the API scopes correctly.
- Pitfall 7 (`.planning/research/PITFALLS.md`): never backfill all rows to `company_id = 1`; drop global `UNIQUE(name)` for `UNIQUE(company_id, name)`.

</domain>

<decisions>
## Implementation Decisions

### Backfill & Schema

- **Migration order:** add nullable `company_id` → backfill every row → `NOT NULL` + FK to `companies(id)` → drop global unique on `name` → add `UNIQUE(company_id, name)` (or equivalent per table if the unique key is not `name`).
- **Single-company DB:** assign all existing rows to that company.
- **Multi-company DB:** duplicate each previously-global row once per existing company so every tenant keeps a usable copy of shared templates. Never assign every row to `company_id = 1` when multiple companies exist (Pitfall 7).
- **No orphans:** after backfill, zero rows with NULL `company_id`. Empty tables are fine — the constraint still applies.

### API Contract

- **Cross-company GET/PUT/PATCH/DELETE by id → 403** `{ error: 'Forbidden' }` (success criteria; not 404).
- **List endpoints** return only the session company's rows (empty array is success, not 403).
- **Create** stamps `company_id` from the session; a session without `company_id` cannot create (403).
- **Unique names** collide only within a company. Two companies may reuse the same template/preset name. In-company collision follows existing 400/409 patterns on these routes.

### Enforcement Layer

- Keep `withAuth` on these routes (they are company-scoped, not project-scoped — do not force `withProjectAccess`).
- **Service layer owns the tenant assert**; repos always take `companyId` and filter SQL with `WHERE company_id = ?`. Do not rely on UI hiding.
- Follow route → service → repository. If a mapping route still calls the repo directly, introduce a thin service in this phase for those four tables only — do not thin unrelated ops/admin/config routes (out of scope).
- **No new wrapper** (`withCompanyAccess`) unless an existing helper already covers this exact case. Prefer passing `ctx.user.company_id` / `ctx.actor.company_id` into the service.

### Testing

- Vitest 4 is the gate (HYG-03). Cross-company 403 tests on all four tables for read and mutate-by-id.
- Same name allowed across companies; uniqueness enforced inside a company.
- Backfill coverage: two-company fixture with pre-migration global rows; after migrate, no NULL `company_id`, no all-rows-on-company-1 collapse, each company can list its copy.
- Do not add a UI visual regression suite for this phase.

### the agent's Discretion

- Exact service file names, migration loop placement in `lib/db.ts` (DATA-01 still deferred — schema init stays in `getDb()`), and whether Jira preset/sync SQL lives in `import-mapping.repo.ts` vs `jira-config.repo.ts` stay at the agent's discretion as long as all four tables are covered and patterns match existing tenant-scoped repos (`listProjects(companyId)`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/http/with-auth.ts` — `withAuth` already on mapping/preset routes; `AccessActor.company_id` available.
- `lib/auth.ts` — `SessionUser.company_id`.
- `lib/services/errors.ts` — `ForbiddenError` mapped to 403 by `serviceErrorResponse`.
- `lib/repositories/import-mapping.repo.ts` — timeline + bug mapping SQL (global today).
- Existing tenant-scoped list pattern: `listProjects(companyId)` and project-scoped `WHERE project_id = ? AND company via access assert`.

### Established Patterns
- Route handler → service → repository; tenant checks in services, SQL in repos with column allowlists.
- Cross-company 403 tests already exist for project-scoped routes (v1.0); copy that fixture style (two companies, two users, guessed foreign id).
- Schema changes still live in `getDb()` migrate loop (DATA-01 deferred).

### Integration Points
- `/api/import-mapping`, `/api/import-mapping/[id]`
- `/api/bug-import-mapping` (and id route if present)
- Jira JQL preset and sync-mapping routes (under Jira config / jql-presets)
- Client consumers: `components/timeline/useImportMapping.ts`, `components/jira/JiraSyncDialog.tsx` — no UI change if list APIs are scoped.

</code_context>

<specifics>
## Specific Ideas

Success criteria require 403 (not 404) on cross-company access. Backfill must not collapse tenants into company 1. Unique keys include company. No import UX redesign.

</specifics>

<deferred>
## Deferred Ideas

- CPMO / PM / Viewer authorization on these routes — Phase 10
- DATA-01 (migrations out of `getDb()`)
- Remaining ops/admin/config service thinning (v1.0 leftover, not this milestone)
- Import dialog UI redesign

</deferred>
