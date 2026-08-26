# Phase 13: Weekly Periods & PM Submit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 13-Weekly Periods & PM Submit
**Areas discussed:** Period & obligation shells, Draft/submit versioning, RAID/milestone snapshots, Parallel vs v1 report pages
**Mode:** `--auto` (accept all recommended)

---

## Period & obligation shells

| Option | Description | Selected |
|--------|-------------|----------|
| New period + shell tables; config snapshotted at create; no backfill | Parallel store; PERD-02 safe | ✓ |
| Reuse `documents` status_report + date-range UI | Would mix v1 activity reports with obligations | |
| Mutable period rows; re-run obligation when flags change | Violates PERD-02 and WKRP-01 "at most one at create" | |

**User's choice:** Recommended default (autonomous accept-all)
**Notes:** [auto] Unique `(company_id, iso_week)`; obligated = enabled + start_period <= week + not L5/terminal.

---

## Draft/submit versioning

| Option | Description | Selected |
|--------|-------------|----------|
| Immutable version rows; first-submit lateness frozen | Matches WKRP-04/05/06 | ✓ |
| In-place overwrite of submitted report | Violates immutability | |
| New shell per correction | Breaks one-row-per-period history | |

**User's choice:** Recommended default (autonomous accept-all)
**Notes:** [auto] Overdue is computed, not stored. Late submit allowed.

---

## RAID/milestone snapshots

| Option | Description | Selected |
|--------|-------------|----------|
| Draft JSON only; submit writes masters then locks snapshot | RAID-02/03, MS-04 | ✓ |
| Weekly report as second RAID store | Spec forbids | |
| Snapshot live masters on draft save | Would freeze unfinished drafts | |

**User's choice:** Recommended default (autonomous accept-all)
**Notes:** [auto] Copy `progress_pct` at submit; never write back. Sync RAG to master on submit when it differs.

---

## Parallel vs v1 report pages

| Option | Description | Selected |
|--------|-------------|----------|
| New `/api/weekly-periods` and `/api/projects/[id]/weekly-reports` | PROJECT.md parallel surface | ✓ |
| Extend `getWeeklyProjectReport` / `/reports` documents | Collides with activity-weighted v1 | |

**User's choice:** Recommended default (autonomous accept-all)
**Notes:** [auto] `workflow.ui_phase` false; server tests are the gate.

---

## the agent's Discretion

Exact snapshot JSON shape, draft-on-shell vs draft-version-row, default due Friday 18:00 UTC, `/correct` vs submit-again path — planner locks.

## Deferred Ideas

- Phase 14 CPMO tracking + consolidated export
- Phase 16 dashboards
- Phase 15 budget/ROI/deps
- Phase 17 templates
- Phase 18 full audit
