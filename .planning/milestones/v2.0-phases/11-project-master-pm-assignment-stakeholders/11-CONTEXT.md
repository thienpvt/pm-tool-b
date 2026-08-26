# Phase 11: Project Master, PM Assignment & Stakeholders - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Deliver PR-03, PR-04, and PR-05: spec-compliant project identity (including unique project code), L0–L5 governance defaults, PM assignment windows that replace Phase 10's interim `pm_email`/`pm_name` lookup, and stakeholder history as one source of truth.

**Requirements:** PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06, PROJ-07, PROJ-08, PMAS-01, PMAS-02, PMAS-03, PMAS-04, STKH-01, STKH-02, STKH-03

**In:** portfolio year, unique project code (CPMO-only create/change; code change does not drop linked rows), classification/governance/stage L0–L5, status/RAG/progress/timeline, status Other requires reason, weekly-report flag + start period, L5/terminal defaults with warnings, live progress must not clobber weekly-report snapshots, weekly-report off / L5 / terminal stops future obligations without deleting history; one active primary PM or none; collaborating PMs only with an active primary; no user both primary and collaborator; assignment history by period; write access follows the window; stakeholders (sponsor, PSC chair/members, project director, key parties) as users or externals with effective ranges; end a role without deleting history.

**Out:** weekly period config and submit (Phase 13), RAID/milestone master registers (Phase 12), dashboards (Phase 16), document templates (Phase 17), full audit (Phase 18 — incremental `auditLog` on assignment/code/stakeholder mutations is OK).

</domain>

<decisions>
## Implementation Decisions

Decision IDs below are the locked set for plan coverage (D-01..D-20).

### Identity & code (PROJ-01, PROJ-02)

- **D-01:** Unique project code is **per company**: `UNIQUE(company_id, code)` (case-insensitive). Not global across tenants.
- **D-02:** Changing code is an in-place `UPDATE` of `projects.code` (or dedicated column). Linked child rows stay on `project_id`. Never drop/recreate the project.
- **D-03:** Only CPMO can set or change `code`. Assigned PM can maintain other identity fields they already have write access to (name, classification, etc.) but not the code.
- **D-04:** Portfolio year is a required integer column (`portfolio_year`). Program remains the existing `customers` row (`customer_id`) — do not invent a second program table.

### Governance, L0–L5, RAG, weekly flag (PROJ-03..08)

- **D-05:** Persist spec stage as `stage` with values `L0`..`L5`. Keep `current_phase` as a free-text/legacy display field; do not break existing Jira/report readers. New UI/API use `stage`.
- **D-06:** Status Other requires non-empty `status_reason`. Weekly-report Yes requires `weekly_report_start_period` (string `YYYY-Wnn` until Phase 13 owns period rows).
- **D-07:** Stage L5 defaults: status Completed, RAG Not applicable, progress 100%. Persist the applied defaults; return a **warning list** in the JSON body (not a blocking 400) if the client sent overrides or prior progress was below 100%.
- **D-08:** Stage L5 or status Completed/Paused/Cancelled/Other defaults RAG to Not applicable; same warning-not-block pattern if the client sends another RAG.
- **D-09:** PROJ-07: there is no weekly-report snapshot table yet. Add `progress_pct` on `projects` for live progress. Do **not** invent a snapshot overwrite. Document the contract: Phase 13 snapshot copy must read `progress_pct` at submit time and never write back. No Phase 13 tables in this phase.
- **D-10:** `weekly_report_enabled` boolean. Turning it off (or L5/terminal status) does not delete history (none yet) and is the flag Phase 13 will use to skip future shells.

### PM assignment windows (PMAS-01..04) — replaces Phase 10 D-14 lookup

- **D-11:** New table `project_pm_assignments`: `project_id`, `user_id`, `role` (`primary` | `collaborator`), `effective_from`, `effective_to` (null = open), `created_at`. Soft-end by setting `effective_to`; never physical DELETE of a window that existed.
- **D-12:** Exactly one **active** primary (today in `[effective_from, effective_to)` or open). Zero primaries allowed. Collaborators only while a primary is active. A user cannot hold both roles on the same project in overlapping windows.
- **D-13:** Replace `getProjectPmIdentity` / `matchesPmAssignment` inside `assertPmWriteAccess` (keep the **function name**). Lookup: actor `user_id` has an active primary **or collaborator** window. CPMO unchanged. Do not keep email/name match as a fallback after backfill.
- **D-14:** Backfill: for each project with non-empty `pm_email` or `pm_name`, if a company user matches Phase 10 D-14 rules, insert one open primary window. Leave `pm_name`/`pm_email` as denormalized display updated from the active primary (not an access source).
- **D-15:** Only CPMO mutates assignment windows. Assigned PM does not self-assign.

### Stakeholders (STKH-01..03)

- **D-16:** Table `project_stakeholders`: `project_id`, `stakeholder_role` (`sponsor` | `psc_chair` | `psc_member` | `project_director` | `key_stakeholder`), `user_id` nullable, `external_name`/`external_email` when no user, `effective_from`, `effective_to` (null = open). End a role by setting `effective_to`. Never physical DELETE.
- **D-17:** Write access: `assertProjectWriteAccess` (CPMO or assigned PM). Same rows are the source for later dashboards/reports (STKH-03) — export a list helper, do not duplicate columns on `projects`.
- **D-18:** Multiple PSC members and key stakeholders allowed. At most one **active** sponsor, PSC chair, and project director at a time (end the previous window first).

### Schema, authz, UI, testing

- **D-19:** Schema stays in the `getDb()` migrate loop (dedicated helper, settings-flag backfill). No Prisma. Incremental `auditLog` on code change, assignment window mutations, and stakeholder mutations.
- **D-20:** `workflow.ui_phase` is false — no UI-SPEC. Existing project create/edit screens may gain fields enough that CPMO can set code/year/stage and manage assignments/stakeholders; server tests are the gate. Viewer remains read-only via Phase 10 asserts.

### the agent's Discretion

- Column names (`code` vs `project_code`), whether `progress_pct` replaces parsing `budget` fields, and whether assignment API is nested `/api/projects/[id]/pm-assignments` vs `/api/admin/...` — planner locks: `project_code`, `progress_pct` new column, nested under `/api/projects/[id]/...` with CPMO for assignments and write-access for stakeholders.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/services/projects.service.ts` — create (CPMO, stamps `actor.company_id`), update/delete via `assertProjectWriteAccess`
- `lib/services/access.ts` — `assertPmWriteAccess` is the seam Phase 11 must rewire (comment already says so)
- `lib/repositories/projects.repo.ts` — `PROJECT_COLUMNS` allowlist; `getProjectPmIdentity` is the interim lookup
- `lib/services/users.service.ts` / `users.repo` — company users for assignment and stakeholder user-picker
- `lib/services/audit.service.ts` — `auditLog` from Phase 10
- Programs = `customers` (`customer_id` on projects)

### Established Patterns
- Tenant then role (D-16 from Phase 10). CPMO company-scoped. Viewer 403 on mutators.
- Soft-end with `deleted_at` / status rather than DELETE (users). Assignments/stakeholders use `effective_to`.
- Vitest 4 TDD for authz I/O.

### Integration Points
- `app/api/projects/route.ts` POST create
- `app/api/projects/[id]/route.ts` PATCH identity/governance
- New nested routes for assignments and stakeholders
- `assertPmWriteAccess` + `listProjects` PM filter must both switch to windows in the same plan

</code_context>

<specifics>
## Specific Ideas

- Keep `assertPmWriteAccess` name (Phase 10 D-14 contract).
- Do not build weekly report tables here (PROJ-07/08 are flag + documented snapshot contract only).
- `workflow.ui_phase=false`.

</specifics>

<deferred>
## Deferred Ideas

- Weekly period shells and snapshot progress copy — Phase 13
- RAID/milestone masters — Phase 12
- Dashboards consuming stakeholders — Phase 16 (must call the same list helper)
- Full append-only audit coverage — Phase 18

</deferred>
