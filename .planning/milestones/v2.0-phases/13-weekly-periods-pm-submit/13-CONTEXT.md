# Phase 13: Weekly Periods & PM Submit - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Deliver CPMO weekly-period configuration and PM draft/submit of **versioned** weekly reports that snapshot RAID and milestones from the Phase 12 masters. This is a **parallel product surface** — not an enhancement of the existing activity-weighted `/report` and `/reports` pages.

**Requirements:** PERD-01, PERD-02, PERD-03, WKRP-01, WKRP-02, WKRP-03, WKRP-04, WKRP-05, WKRP-06, MS-04, RAID-02, RAID-03

**In:** company weekly config + period rows with frozen display name `YYYY-Wnn | start – end` and due datetime; auto-create at most one report shell per obligated project; period stores a config snapshot; overdue = now > due and status Not submitted or Draft (late submit still allowed); PM draft + submit structured fields; previous-week RAG prefilled read-only; this-week RAG chosen by PM and synced to `projects.rag` on submit when it differs; first-submit timestamp and on-time/late immutable; submitted versions immutable; correction = new version; history one row per period (latest submitted), newest period first; RAID stays master — draft RAID edits stay on the draft until submit validates, writes the master, stores a locked snapshot, or rejects with fields to fix; later RAID/milestone edits do not change old reports; copy `progress_pct` at submit and never write it back.

**Out:** CPMO tracking grid and consolidated export (Phase 14); dashboard pages (Phase 16 may list helpers); budget/ROI/deps (Phase 15); document templates (Phase 17); full audit coverage (Phase 18 — incremental `auditLog` on period create / submit / correct is OK); redesign of `getWeeklyProjectReport` / `app/projects/[id]/report` / `app/projects/[id]/reports` / `/api/export/weekly-report/[id]`.

</domain>

<decisions>
## Implementation Decisions

Decision IDs D-01..D-18.

### Parallel surface (not v1 activity reports)

- **D-01:** New tables and routes. Do **not** store Phase 13 obligations in `documents` (`type = status_report`) and do **not** extend `getWeeklyProjectReport`. Keep v1 activity-weighted report pages working unchanged. — **Reversibility:** costly — mixing stores would force a later data split.

### Periods & obligation (PERD-01, PERD-02, PERD-03, WKRP-01)

- **D-02:** Table `weekly_periods`: `company_id`, `iso_week` (`YYYY-Wnn`), `start_date`, `end_date`, `due_at` (timestamptz), `display_name` (computed at create: `YYYY-Wnn | start – end`), `config_snapshot` JSON, `created_by`, `created_at`. Unique `(company_id, iso_week)`. ISO week and date bounds use UTC (Thursday rule). — **Reversibility:** one-way — unique week key and stored display names are a published contract.
- **D-03:** Company default due weekday/time lives in `company_weekly_config` (one row per company). Creating a period **copies** due rule + obligated-rule version into `config_snapshot` and materializes `due_at`. Later config edits do not UPDATE existing period rows or shells (PERD-02).
- **D-04:** Obligated project at period-create time: same `company_id` AND `weekly_report_enabled = true` AND `weekly_report_start_period <= iso_week` (lexicographic `YYYY-Wnn`) AND `stage <> 'L5'` AND `status` not in (`Completed`, `Paused`, `Cancelled`, `Other`). Create **at most one** shell per obligated project in the **same transaction** as the period. `UNIQUE(period_id, project_id)`. Projects that become obligated later are **not** backfilled onto already-created periods. Turning weekly off / L5 / terminal after the period exists does **not** delete the shell.
- **D-05:** Shell table `weekly_reports`: `period_id`, `project_id`, `status` (`not_submitted` | `draft` | `submitted`), `first_submitted_at` (null until first successful submit), `first_lateness` (`on_time` | `late` | null), `latest_version`. Overdue is **computed** (never a stored status): `now() > period.due_at` AND status in (`not_submitted`, `draft`). Late submit is allowed and sets `first_lateness = late` only on the first submit.

### Draft, submit, versioning (WKRP-02..06)

- **D-06:** Structured draft fields: `highlights`, `completed_work`, `next_week_goals`, `nearest_milestone` (text + optional `milestone_id`), `raid_dependency`, `leadership_support`, `this_week_rag`. First successful save of any of these moves `not_submitted` → `draft`.
- **D-07:** Previous-week RAG is copied at draft-open time from the previous period's latest **submitted** version's `this_week_rag`, else `projects.rag`. Stored on the draft as `prev_week_rag` and returned read-only. Client cannot PATCH it.
- **D-08:** Submit creates an immutable row in `weekly_report_versions` (`report_id`, `version` int starting at 1, `snapshot` JSON, `submitted_at`, `submitted_by`, `rag`, `progress_pct`). Shell status → `submitted`; `latest_version` increments. PATCH of a submitted shell's snapshot is 409. Correction = POST that opens a new draft payload (or writes draft columns) and a later submit becomes version N+1. `first_submitted_at` and `first_lateness` never change after the first submit (WKRP-04).
- **D-09:** History list: one row per period for the project, newest `iso_week` first. Columns: period display name, status (plus computed overdue flag), latest RAG, submit time, submitter, on-time/late. Viewer may GET via `assertProjectAccess`; mutate via `assertProjectWriteAccess`.
- **D-10:** On submit, copy live `projects.progress_pct` into the version snapshot. **Never** UPDATE `projects.progress_pct` from a weekly report (Phase 11 D-09). If `this_week_rag` differs from `projects.rag`, UPDATE `projects.rag` (WKRP-03).

### RAID & milestone snapshots (RAID-02, RAID-03, MS-04)

- **D-11:** RAID register remains the only durable RAID store. Draft may carry proposed creates/updates (by master `id` or `new`) in draft JSON only — no writes to `risks`/`issues` on draft save. Submit validates required RAID fields, applies writes through existing `risks.service` / `issues.service` (auto-codes, no physical DELETE, due-date history), then stores a **locked copy** of the referenced master rows in the version snapshot. Validation failure → 400 `{ error, fields: [...] }` and no version row. Later master edits do not UPDATE old snapshots.
- **D-12:** Submit also stores a milestone snapshot (nearest + any selected `milestone_id` row, including plan/adjusted end and status). Later milestone cancel/edit does not change old reports (MS-04). Do not `DELETE FROM milestones`.

### Authz, schema, UI, testing

- **D-13:** Period + company config mutate: `withCpmo` and `assertCompanyWrite` (actor `company_id`). Period list is company-scoped. Project draft/submit: `assertProjectWriteAccess`. Reads: `assertProjectAccess`. Do not invent a second wrapper family. Do not gate D-23 leftover ops/admin routes.
- **D-14:** Schema helper `lib/db-weekly-reports.ts` invoked from `getDb()` **after** `migrateRaidMasters`. Settings-flag DDL. No Prisma. Incremental `auditLog` on period create, first submit, and correction submit.
- **D-15:** Routes: `/api/weekly-periods` (CPMO) and `/api/projects/[id]/weekly-reports` (+ `/[reportId]` draft/submit/correct). Do not reuse `/api/projects/[id]/report`.
- **D-16:** `workflow.ui_phase` is false. Existing screens may gain a thin period-admin list and a project weekly history/form so CPMO/PM can operate; server tests are the gate. Do not redesign portfolio report or v1 project report pages.
- **D-17:** Never physical DELETE period rows, shells, or submitted versions. Closing a period (optional `closed_at`) only prevents **new** shells on that period; existing shells remain.
- **D-18:** Phase 14 tracking counts/export and Phase 16 dashboards consume these tables — export list helpers (`listPeriodShells`, `listProjectWeeklyHistory`) from the weekly-report service. Do not build the CPMO tracking grid or consolidated pack here.

### the agent's Discretion

- Exact `snapshot` JSON shape, whether draft columns live on `weekly_reports` vs a `draft` version row, default due weekday (Friday 18:00 UTC recommended), and whether correction POST is `/correct` vs submit-again on a draft overlay — planner locks those names. Prefer draft columns on the shell + immutable version rows on submit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — Phase 13 goal, success criteria 1–5, UI hint yes (ignored: `workflow.ui_phase` false)
- `.planning/REQUIREMENTS.md` — PERD-01..03, WKRP-01..06, MS-04, RAID-02, RAID-03
- `.planning/PROJECT.md` — weekly reports are a parallel product surface; PR-10 / PR-11; Key Decisions table
- `.planning/STATE.md` — current position Phase 13

### Locked prior decisions
- `.planning/phases/11-project-master-pm-assignment-stakeholders/11-CONTEXT.md` — D-06 start period `YYYY-Wnn`; D-09 `progress_pct` copy-at-submit never write-back; D-10 `weekly_report_enabled` skips future shells
- `.planning/phases/11-project-master-pm-assignment-stakeholders/11-RESEARCH.md` — PROJ-07/08 contract
- `.planning/phases/12-milestone-raid-master-registers/12-CONTEXT.md` — D-01 never DELETE milestones; D-05 RAID deactivate not delete; D-12 snapshot tables were deferred here
- `.planning/phases/10-users-roles-server-authorization/10-CONTEXT.md` — `withCpmo`, `assertProjectWriteAccess`, D-13 company-scoped CPMO, D-23 leftover carve-out

### Code maps
- `.planning/codebase/ARCHITECTURE.md` — route → service → repo
- `.planning/codebase/CONVENTIONS.md` — Vitest 4, settings-flag DDL
- `.planning/codebase/TESTING.md` — `TEST_DATABASE_URL` must end in `_test`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/http/with-role.ts` `withCpmo` — period config routes
- `lib/services/access.ts` — `assertCompanyWrite`, `assertProjectWriteAccess`, `assertProjectAccess`
- `lib/db.ts` `getDb()` — append `migrateWeeklyReports` after `migrateRaidMasters`
- `lib/db-project-master.ts` — `weekly_report_enabled`, `weekly_report_start_period`, `rag`, `progress_pct`, `stage`
- `lib/db-raid-masters.ts` — settings-flag DDL + backfill + indexes pattern to copy
- `lib/services/risks.service.ts` / `issues.service.ts` / `milestones.service.ts` — submit must reuse these (codes, deactivate, no physical DELETE)
- `lib/services/audit.service.ts` — `auditLog`
- `lib/services/errors.ts` — `ValidationError`, `ConflictError`, `ForbiddenError`

### Established Patterns
- Tenant then role. CPMO company-scoped. Viewer 403 on mutators.
- Soft-end / immutable history rather than DELETE (assignments, stakeholders, RAID).
- Vitest 4 TDD; route tests mock assignment helpers not `getProjectPmIdentity`.
- Do not invent CASL.

### Integration Points
- New `/api/weekly-periods` and `/api/projects/[id]/weekly-reports`
- Leave `/api/projects/[id]/report` and `/api/export/weekly-report/[id]` untouched
- Phase 14 will list shells by period; keep `listPeriodShells` company-scoped

### Landmines
- Existing `getWeeklyProjectReport` is activity-weighted live data — easy to "reuse" and violate snapshot/version rules
- `app/projects/[id]/reports/page.tsx` persists v1 reports as `documents` — do not fold Phase 13 into that
- `progress_pct` write-back would break Phase 11 PROJ-07
- Physical DELETE of RAID/milestones would break MS-04 / RAID-02

</code_context>

<specifics>
## Specific Ideas

- [auto] Period config — Q: "Where do period rows and shells live?" → Selected: "New `weekly_periods` + `weekly_reports` + `weekly_report_versions`; snapshot config onto each period" (recommended default)
- [auto] Obligation — Q: "When is a project obligated?" → Selected: "enabled + start_period <= iso_week + not L5/terminal; shells only at period create; no backfill" (recommended default)
- [auto] Versioning — Q: "How do corrections work?" → Selected: "Immutable version rows; first-submit lateness frozen; correction = new version" (recommended default)
- [auto] RAID — Q: "Draft vs master?" → Selected: "Draft JSON only until submit validates and writes masters, then lock snapshot" (recommended default)
- [auto] Surface — Q: "Extend v1 report pages?" → Selected: "Parallel routes; leave v1 activity reports unchanged" (recommended default)
- `workflow.ui_phase=false`

</specifics>

<deferred>
## Deferred Ideas

- CPMO tracking counts, filters, tick-select, consolidated Excel/Word/PPT pack — Phase 14
- Portfolio / PM dashboards consuming overdue/RAG — Phase 16 (must call this phase's list helpers)
- Budget, value, ROI, bidirectional deps — Phase 15
- Document templates & Confluence checklist — Phase 17
- Full append-only audit coverage — Phase 18

</deferred>

---

*Phase: 13-Weekly Periods & PM Submit*
*Context gathered: 2026-08-26*
