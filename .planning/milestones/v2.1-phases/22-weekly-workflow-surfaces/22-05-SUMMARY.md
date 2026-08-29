---
phase: 22-weekly-workflow-surfaces
plan: 05
subsystem: ui
tags: [react, vitest, weekly-report-editor, nextjs, debounced-patch]

requires:
  - phase: 22-01
    provides: WeeklyReportEditorShell type and reportShellFixture
provides:
  - PM weekly report editor at Phase 16 href and optional /weekly/reports alias
  - useWeeklyReportEditor hook for GET/PATCH/submit/correct with debounced draft save
  - Single-column WeeklyReportForm with Title Case RAG and RAID textarea only
affects: []

actuals:
  tokens: 22300
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Thin app re-exports for projects and weekly module URLs (D-01, D-13)"
    - "300ms debounced PATCH of schema allowlist keys; prev_week_rag never sent (D-05)"
    - "Submit/correct POST actions with inline SubmitValidationError fields (D-06)"

key-files:
  created:
    - app/projects/[id]/weekly-reports/[reportId]/page.tsx
    - app/weekly/reports/[projectId]/[reportId]/page.tsx
    - modules/weekly/ui/report/WeeklyReportEditorPage.tsx
    - modules/weekly/ui/report/WeeklyReportForm.tsx
    - modules/weekly/ui/report/useWeeklyReportEditor.ts
    - modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx
  modified: []

key-decisions:
  - "Submit POST uses no JSON body to match rawBody route contract"
  - "Action bar uses sticky bottom Card; Submit for draft/not_submitted, Open correction when submitted"

patterns-established:
  - "Editor shell mirrors periods/tracking: Sidebar, spinner loading, in-page 401/403/404 panels"
  - "editable = status !== submitted || correction_open gates PATCH and form controls"

requirements-completed: [WKRP-07]

coverage:
  - id: D1
    description: "Phase 16 /projects/[id]/weekly-reports/[reportId] re-export loads module editor"
    requirement: WKRP-07
    verification:
      - kind: unit
        ref: "modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx#renders Weekly report header after GET 200"
        status: pass
    human_judgment: false
  - id: D2
    description: "Debounced PATCH allowlist, 409 submitted toast, prev_week_rag read-only"
    requirement: WKRP-07
    verification:
      - kind: unit
        ref: "modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx#debounces PATCH with highlights and omits prev_week_rag"
        status: pass
      - kind: unit
        ref: "modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx#toasts submitted message on PATCH 409"
        status: pass
    human_judgment: false
  - id: D3
    description: "Submit report, Open correction, and validation field errors inline"
    requirement: WKRP-07
    verification:
      - kind: unit
        ref: "modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx#shows Submit report for draft and toasts on 201"
        status: pass
      - kind: unit
        ref: "modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx#shows inline raid_dependency error and validation toast on 400"
        status: pass
      - kind: unit
        ref: "modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx#shows Open correction for submitted and enables fields after correct"
        status: pass
    human_judgment: true
    rationale: "Deep-link landing and stacked Card layout are visual — plan human-check auto-approved"

duration: 18min
completed: 2026-08-28
status: complete
---

# Phase 22 Plan 05: PM Weekly Report Editor Summary

**PM weekly report editor with Phase 16 path re-export, debounced draft PATCH, submit/correct POSTs, and single-column stacked form**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-28T10:12:00Z
- **Completed:** 2026-08-28T10:30:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Required re-export at `/projects/[id]/weekly-reports/[reportId]` and optional alias at `/weekly/reports/[projectId]/[reportId]` both load the same module editor (WKRP-07, D-01, D-13)
- GET shell renders loading, 404, 403, header with project link, status badge, due date, and read-only prev-week RAG Badge (D-05, D-14)
- Debounced 300ms PATCH sends allowlisted keys only; Title Case RAG Select; 409 and draft-save error toasts match Copywriting Contract (D-05)
- Submit report POSTs `.../submit` with empty body; Open correction POSTs `.../correct`; validation `fields` render inline under RAID dependency (D-06)

## Task Commits

Each task used TDD with RED then GREEN commits:

1. **Task 1: Editor GET shell and re-exports** — `3084b8b` (test), `e647661` (feat)
2. **Task 2: Debounced draft PATCH and 409 toast** — `f12b029` (test), `d6b14ed` (feat)
3. **Task 3: Submit report, Open correction, validation fields** — `57bb415` (test), `6339659` (feat)

## Files Created/Modified

- `app/projects/[id]/weekly-reports/[reportId]/page.tsx` — Required Phase 16 href re-export
- `app/weekly/reports/[projectId]/[reportId]/page.tsx` — Optional module URL alias
- `modules/weekly/ui/report/WeeklyReportEditorPage.tsx` — Editor shell, header, action bar
- `modules/weekly/ui/report/WeeklyReportForm.tsx` — Single-column stacked Cards (no RAID grid)
- `modules/weekly/ui/report/useWeeklyReportEditor.ts` — GET/PATCH/submit/correct hook
- `modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx` — 15 component tests

## Decisions Made

- Submit POST uses no JSON body to match `rawBody: true` on the submit route
- Sticky bottom Card for primary CTAs (`bg-blue-600`); Submit visible for draft/not_submitted only

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED commits: `3084b8b`, `f12b029`, `57bb415`
- GREEN commits: `e647661`, `d6b14ed`, `6339659`
- All gates satisfied

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WKRP-07 complete; PM can open Phase 16 dashboard href, draft, submit, and correct weekly reports
- `lib/services/spec-dashboards.service.ts` unchanged (D-02 preserved)

## Self-Check: PASSED

- FOUND: modules/weekly/ui/report/WeeklyReportEditorPage.tsx
- FOUND: modules/weekly/ui/report/WeeklyReportForm.tsx
- FOUND: modules/weekly/ui/report/useWeeklyReportEditor.ts
- FOUND: app/projects/[id]/weekly-reports/[reportId]/page.tsx
- FOUND: app/weekly/reports/[projectId]/[reportId]/page.tsx
- FOUND: 3084b8b, e647661, f12b029, d6b14ed, 57bb415, 6339659

---
*Phase: 22-weekly-workflow-surfaces*
*Completed: 2026-08-28*
