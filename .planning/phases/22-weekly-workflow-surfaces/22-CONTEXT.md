# Phase 22: Weekly Workflow Surfaces - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

CPMO and PMs run the weekly cadence in the UI, and the tracking grid stays usable at enterprise row counts.

**Requirements:** PERD-04, WKRP-07, CPMO-05, PERF-01

**In:**
- React pages consuming existing `/api/weekly-periods` (list/create/config), `/api/projects/[id]/weekly-reports` (draft/submit/correct), `/api/weekly-periods/[periodId]/tracking`, and `/api/weekly-periods/[periodId]/export`
- Pages under `modules/weekly/ui/` with thin `app/` re-exports (same pattern as Phase 21 dashboards)
- Sidebar links for CPMO periods/tracking and PM report editor
- Virtualize the CPMO tracking grid (and any other long list on these surfaces) so ~100+ rows stay usable (PERF-01)
- Component tests with mocked fetch

**Out:**
- Rewriting Phase 13/14 APIs, v1 activity-weighted `/reports` / `/report` pages (Phase 13 D-01: parallel surface)
- Module-wide split of other features (Phase 24)
- Document checklist / audit UI (Phase 23)
- New chart packages; Kysely; RSC chrome (26)

</domain>

<decisions>
## Implementation Decisions

### Layout and routes
- **D-01:** Implement under `modules/weekly/ui/` with thin App Router re-exports. URLs: `/weekly/periods` (CPMO config + period list/create), `/weekly/tracking` (CPMO tracking + export), `/weekly/reports/[projectId]/[reportId]` (PM draft/submit/correct). Do not overwrite v1 `/reports` or `/report`.
- **D-02:** Sidebar: "Weekly periods" and "Weekly tracking" for `cpmo`; PM reaches reports via dashboard deep links already shipped (`/projects/:id/weekly-reports/:id` may be a thin re-export to the module editor if that path is what Phase 16 hrefs use — honor existing `href` strings from `getPmDashboard` rather than inventing a second URL).
- **D-03:** Consume existing APIs only. No new weekly endpoints.

### Periods (PERD-04)
- **D-04:** CPMO page lists periods, creates a period (existing POST), edits company weekly config (existing config route). Viewer 403 in-page. Match Copywriting density from Phase 21.

### PM report (WKRP-07)
- **D-05:** Editor loads GET report, PATCH draft fields (highlights, completed_work, next_week_goals, nearest_milestone, raid_dependency, leadership_support, this_week_rag). Submit and Correct buttons call existing POST submit/correct. Prev-week RAG read-only. 409 on PATCH of submitted snapshot shown as toast.
- **D-06:** Do not invent a second RAID editor; RAID validation errors from submit are shown on the form.

### Tracking and export (CPMO-05)
- **D-07:** Tracking page GET tracking payload; export POST existing pack endpoint; blob download reuse `modules/dashboards/ui/shared/downloadBlob.ts` if it stays generic, else a weekly copy in `modules/weekly/ui/shared/`.

### Virtualization (PERF-01)
- **D-08:** Do **not** add an npm package. Implement a small in-repo windowed table (`VirtualRows`) with fixed row height + overflow container. Apply to CPMO tracking grid first; reuse on any other list on these pages that can exceed ~100 rows.
- **D-09:** Prove with a component test that renders 150 mocked rows without mounting all 150 DOM rows (query row count in the window).

### Claude's Discretion
- Exact field layout of the PM editor (sections vs single column).
- Whether `/projects/:id/weekly-reports/:id` is an additional re-export alias of the module editor (required if Phase 16 hrefs point there).
- Empty/loading copy (English, match Phase 21).
</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 22
- `.planning/REQUIREMENTS.md` — PERD-04, WKRP-07, CPMO-05, PERF-01
- `.planning/milestones/v2.0-phases/13-weekly-periods-pm-submit/13-CONTEXT.md` — D-01 parallel surface
- `.planning/milestones/v2.0-phases/14-*` if present — tracking/export APIs
- `app/api/weekly-periods/**`
- `app/api/projects/[id]/weekly-reports/**`
- Phase 16 `href: /projects/${id}/weekly-reports/${reportId}`
- `.planning/phases/21-portfolio-pm-dashboard-pages/21-CONTEXT.md` — module + re-export pattern
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Weekly period/report/tracking/export APIs already gated
- `downloadBlob` from Phase 21
- Sidebar role-aware NAV
- shadcn Card/Table/Button/Select

### Established Patterns
- Phase 21 `modules/<feature>/ui` + `app/<route>/page.tsx` re-export
- Client `fetch` hooks; 401/403 in-page

### Integration Points
- PM dashboard deep links must keep working
</code_context>

<specifics>
## Specific Ideas

Grey areas auto-accepted: module layout, consume APIs, in-repo virtualization (no new npm), do not replace v1 `/reports`.
</specifics>

<deferred>
## Deferred Ideas

- Repo-wide module split — Phase 24
- Document/audit UI — Phase 23
</deferred>
