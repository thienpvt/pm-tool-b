# Phase 12: Milestone & RAID Master Registers - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Deliver milestone and RAID **masters**: assigned PM and CPMO mutate; Viewer cannot; upcoming/overdue rules; unique RAID codes; due-date history; no physical delete of milestones that would later appear in weekly snapshots.

**Requirements:** MS-01, MS-02, MS-03, MS-05, RAID-01, RAID-04, RAID-05, RAID-06

**In:** create/update/cancel milestones in scope; upcoming window (7 days before plan or adjusted end, exclude Completed/Cancelled); overdue = today after plan or adjusted end and not Completed/Cancelled; unique risk/issue code per project; deactivate not physical delete; overdue RAID flagged; due-date history; default Open/In progress, High→Medium→Low with overdue first; High open/in-progress counts are records not projects; technology-council listable flag.

**Out:** weekly snapshot on submit (MS-04, RAID-02, RAID-03 — Phase 13); dashboard pages (Phase 16 consumes list helpers from this phase); budget/ROI (Phase 15).

</domain>

<decisions>
## Implementation Decisions

Decision IDs D-01..D-16.

### Milestones (MS-01, MS-02, MS-03, MS-05)

- **D-01:** Keep existing `milestones` table. Add `status` (`planned` | `completed` | `cancelled`), `plan_end`, `adjusted_end` (nullable), `cancelled_at` / `cancelled_by`. Cancel is the only retire path. **Never `DELETE FROM milestones`** this phase (MS-05 pre-emptive: weekly reports do not exist yet).
- **D-02:** Mutate via `assertProjectWriteAccess` (Phase 11 windows). Viewer 403. Do not add a second wrapper family.
- **D-03:** Upcoming helper: status not completed/cancelled AND the earlier of plan_end/adjusted_end is within 7 days (inclusive) from today (UTC date). Overdue helper: today is after that date and status not completed/cancelled. Export `listUpcomingMilestones` / `listOverdueMilestones` for Phase 16; do not build dashboard UI here.
- **D-04:** Existing `linkEpic`/`unlinkEpic` stay write-gated (already Phase 10). No change to Jira sync semantics.

### RAID (RAID-01, RAID-04, RAID-05, RAID-06)

- **D-05:** Keep `risks` and `issues` tables. Add `code` unique per project: `UNIQUE(project_id, LOWER(code))`. Auto-generate `R-nnn` / `I-nnn` if client omits code. Deactivate via `status = deactivated` (or `closed`) + `deactivated_at`; never physical DELETE.
- **D-06:** Due-date history table `raid_due_date_history` (`entity_type` risk|issue, `entity_id`, `old_due`, `new_due`, `changed_at`, `changed_by`). Append on due-date change only.
- **D-07:** Default list: Open / In progress first; order High, Medium, Low; within a severity overdue first. Overdue = due date < today and status open/in progress.
- **D-08:** `listHighOpenRaid(companyId)` counts **records** not projects. `technology_council` boolean on issues; `listTechnologyCouncilIssues(companyId)`. Phase 16 dashboards call these — no dashboard page this phase.
- **D-09:** Mutate via `assertProjectWriteAccess`. Unique code conflict → `ConflictError` 409.

### Schema, UI, testing

- **D-10:** Schema in `getDb()` helper `lib/db-raid-masters.ts`. No Prisma. Incremental `auditLog` on cancel milestone, deactivate RAID, due-date change.
- **D-11:** `workflow.ui_phase` is false. Existing milestone/RAID screens may show status/code/overdue; server tests are the gate.
- **D-12:** MS-04 / RAID-02 / RAID-03 stay Phase 13. Do not create weekly snapshot tables.
- **D-13:** Existing HTTP DELETE on milestones/risks/issues maps to cancel/deactivate (200 `{ ok: true }`), not 405. Clients keep calling DELETE; the row remains.
- **D-14:** Dual-write `end_date` when `plan_end` is set until report services read the new columns.
- **D-15:** Company-scoped helpers live in `lib/services/raid-masters.service.ts` (or similarly named), not inside portfolio.service.

### the agent's Discretion

- Exact status enum strings (`deactivated` vs `closed`), code prefix padding, whether overdue uses date-only vs datetime — planner locks: `deactivated`, zero-padded 3-digit codes, date-only UTC.

</decisions>

<code_context>
## Existing Code Insights

- `lib/services/milestones.service.ts`, `risks.service.ts`, `issues.service.ts` already call `assertProjectWriteAccess`
- `lib/repositories/milestones.repo.ts`, `risks.repo.ts`, `issues.repo.ts`
- Phase 11 `assertPmWriteAccess` uses assignment windows
- `audit.service.ts` `auditLog`

</code_context>

<specifics>
Keep existing RAID/milestone routes; extend schema and list helpers. No weekly tables. No dashboard pages.

</specifics>

<deferred>
- MS-04, RAID-02, RAID-03 — Phase 13
- Dashboard UI for upcoming/overdue/High RAID — Phase 16 (must call this phase's list helpers)
- Full audit — Phase 18

</deferred>
