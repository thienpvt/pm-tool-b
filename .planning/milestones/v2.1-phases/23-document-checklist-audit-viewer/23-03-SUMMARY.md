---
phase: 23-document-checklist-audit-viewer
plan: 03
subsystem: ui
tags: [react, vitest, documents, checklist, confluence, sonner, tdd]

requires:
  - phase: 23-01
    provides: Shared types, fixtures, Phase 22 page shell patterns
provides:
  - PM checklist page at /projects/[id]/document-checklist via thin re-export
  - useProjectChecklist GET/PATCH hook against existing APIs
  - ChecklistItemRow inline editor with singular field errors (D-13)
  - Project hub Document checklist quick-link card (D-15)
affects: [23-04, 23-05]

actuals:
  tokens: 42000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN commits per task for checklist page and hub card"
    - "PATCH 400 maps { error, field } to inline text-red-600 under matching control"
    - "Checklist status Select uses five API snake_case values with human labels"

key-files:
  created:
    - modules/documents/ui/checklist/useProjectChecklist.ts
    - modules/documents/ui/checklist/ProjectChecklistPage.tsx
    - modules/documents/ui/checklist/ChecklistItemRow.tsx
    - modules/documents/ui/checklist/ProjectChecklistPage.component.test.tsx
    - app/projects/[id]/document-checklist/page.tsx
    - app/projects/[id]/page.checklist-card.test.ts
  modified:
    - app/projects/[id]/page.tsx

key-decisions:
  - "Conditional field tests use pre-set item status because base-ui Select does not accept jsdom option clicks reliably"
  - "Document checklist hub card appended after Documents; ClipboardCheck icon per UI-SPEC"

patterns-established:
  - "ProjectChecklistPage mirrors WeeklyReportEditorPage loading/error shell with projectId Sidebar prop"
  - "ChecklistItemRow expands inline editor row; Save checklist item uses bg-blue-600"

requirements-completed: [DOC-08]

coverage:
  - id: D1
    description: "PM opens document checklist via re-export; GET populates table with loading and 403 copy"
    requirement: DOC-08
    verification:
      - kind: unit
        ref: "modules/documents/ui/checklist/ProjectChecklistPage.component.test.tsx#GET shell"
        status: pass
    human_judgment: false
  - id: D2
    description: "PM PATCHes checklist items with status-specific fields and singular field errors"
    requirement: DOC-08
    verification:
      - kind: unit
        ref: "modules/documents/ui/checklist/ProjectChecklistPage.component.test.tsx#PATCH editor"
        status: pass
    human_judgment: false
  - id: D3
    description: "Project hub exposes Document checklist card beside Documents v1 card"
    requirement: DOC-08
    verification:
      - kind: unit
        ref: "app/projects/[id]/page.checklist-card.test.ts"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-28
status: complete
---

# Phase 23 Plan 03: PM Confluence Checklist Editor Summary

**PM checklist page with GET/PATCH against existing APIs, inline editor with singular field errors, and project-hub entry card.**

## Performance

- **Duration:** 12 min
- **Tasks:** 3/3
- **Commits:** 6 implementation + 1 docs
- **Estimate delta:** 42000 vs 48000 estimated tokens (~12% under)

## Accomplishments

- `ProjectChecklistPage` loads `/api/projects/{id}/document-checklist`, shows loading/error/table shell, optional project name link
- `ChecklistItemRow` expands inline editor: five API statuses, conditional approved/N/A fields, HTTPS Open in Confluence link, no file input
- `patchItem` parses 400 `{ error, field }` (never `fields[]`), inline errors + validation toast
- Thin re-export at `app/projects/[id]/document-checklist/page.tsx`
- Hub `QUICK_LINKS` adds Document checklist card; Documents card unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test] Status Select interaction in jsdom**
- **Found during:** Task 2 GREEN
- **Issue:** base-ui Select popup options do not update state under fireEvent in jsdom
- **Fix:** Tests assert conditional fields using items pre-set to `approved` / `not_applicable` after expanding editor
- **Files modified:** `ProjectChecklistPage.component.test.tsx`
- **Commit:** 967661d

None otherwise — plan executed as written.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED task 1 | 69b597f | PASS |
| GREEN task 1 | 359982c | PASS |
| RED task 2 | bbaebe3 | PASS |
| GREEN task 2 | 967661d | PASS |
| RED task 3 | 20826ef | PASS |
| GREEN task 3 | 4858e34 | PASS |

## Self-Check: PASSED

- FOUND: modules/documents/ui/checklist/ProjectChecklistPage.tsx
- FOUND: modules/documents/ui/checklist/ChecklistItemRow.tsx
- FOUND: app/projects/[id]/document-checklist/page.tsx
- FOUND: app/projects/[id]/page.checklist-card.test.ts
- FOUND: 69b597f, 359982c, bbaebe3, 967661d, 20826ef, 4858e34
