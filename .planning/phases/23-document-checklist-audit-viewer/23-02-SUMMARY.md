---
phase: 23-document-checklist-audit-viewer
plan: 02
subsystem: ui
tags: [react, vitest, documents, catalog, templates, sonner, tdd]

requires:
  - phase: 23-01
    provides: Catalog GET page shell, CatalogList, useDocumentCatalog load hook, fixtures
provides:
  - CatalogForm create/edit with apply_to_in_flight checkbox
  - Catalog retire confirmation dialog (PATCH active false)
  - TemplatePanel URL-only publish and list for selected catalog row
  - Hook mutations for catalog POST/PATCH and template GET/POST/PATCH retire
affects: [23-03, 23-04, 23-05]

actuals:
  tokens: 38000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN commits per task with sonner toast mocks in component tests"
    - "Native checkbox for mandatory and apply_to_in_flight (no shadcn Checkbox)"
    - "Template URL client HTTPS gate before POST; server field errors inline"

key-files:
  created:
    - modules/documents/ui/catalog/CatalogForm.tsx
    - modules/documents/ui/catalog/TemplatePanel.tsx
  modified:
    - modules/documents/ui/catalog/useDocumentCatalog.ts
    - modules/documents/ui/catalog/DocumentCatalogPage.tsx
    - modules/documents/ui/catalog/CatalogList.tsx
    - modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx

key-decisions:
  - "Edit and retire actions shown on all catalog rows; retire button hidden when already retired"
  - "Template link accessible name uses template name; URL shown via title tooltip with truncate"
  - "catalogId search param selects row and loads templates on mount"

patterns-established:
  - "CatalogForm shared for create and edit modes with mode-specific test ids"
  - "Retire catalog uses Dialog with red-600 confirm; template retire uses row action PATCH retire true"

requirements-completed: [DOC-07]

coverage:
  - id: D1
    description: "CPMO can POST catalog item with apply_to_in_flight and list refresh"
    requirement: DOC-07
    verification:
      - kind: unit
        ref: "modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx#create catalog item"
        status: pass
    human_judgment: false
  - id: D2
    description: "CPMO can edit catalog item and retire with confirmation dialog"
    requirement: DOC-07
    verification:
      - kind: unit
        ref: "modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx#edit and retire catalog item"
        status: pass
    human_judgment: false
  - id: D3
    description: "Selected catalog row loads URL-only templates; publish and retire template"
    requirement: DOC-07
    verification:
      - kind: unit
        ref: "modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx#templates panel"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-08-28
status: complete
---

# Phase 23 Plan 02: Catalog Create Edit Retire and Templates Summary

**CPMO catalog mutations and URL-only template panel on /documents/catalog using existing API routes, apply_to_in_flight checkbox, and sonner toasts**

## Performance

- **Duration:** 18 min
- **Tasks:** 3
- **Files modified:** 6
- **Commits:** 7 (6 task + 1 docs)

## Accomplishments

- CatalogForm create card POSTs name, purpose, stage, mandatory, and apply_to_in_flight with loading-disabled Add catalog item
- Edit form pre-fills row fields; Save PATCHes including apply_to_in_flight; Retire dialog PATCHes `{ active: false }`
- TemplatePanel loads GET `/api/document-templates?catalog_id=` on row select or `?catalogId=`; publish POST with HTTPS validation; retire PATCH `{ retire: true }`
- 21 component tests pass (14 from 23-01 + 7 new mutation/template cases)

## Task Commits

1. **test(23-02): red catalog create** - `8230170`
2. **feat(23-02): catalog create with apply_to_in_flight** - `45f20dc`
3. **test(23-02): red catalog edit and retire** - `4e861b7`
4. **feat(23-02): catalog edit and retire** - `f662a8e`
5. **test(23-02): red templates panel** - `ea32207`
6. **feat(23-02): catalog templates panel** - `340c90e`

## Files Created/Modified

- `modules/documents/ui/catalog/CatalogForm.tsx` - Create/edit fields, native checkboxes, primary CTAs
- `modules/documents/ui/catalog/TemplatePanel.tsx` - Template table, publish form, HTTPS inline error
- `modules/documents/ui/catalog/useDocumentCatalog.ts` - POST/PATCH catalog, GET/POST/PATCH templates
- `modules/documents/ui/catalog/DocumentCatalogPage.tsx` - Wires forms, list, panel, retire dialog
- `modules/documents/ui/catalog/CatalogList.tsx` - Row select, Edit/Retire actions column
- `modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx` - TDD tests for all mutations

## Decisions Made

- Retire button on list hidden for already-retired rows; Edit remains available for re-activation via Active checkbox
- Template URL column link uses template name as link text with full URL in title attribute

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scoped catalog list L2 assertion after create form added default stage L2**
- **Found during:** Task 1 GREEN verification
- **Issue:** `getByText('L2')` matched both table cell and create form stage select
- **Fix:** Assert L2 within catalog-list test id
- **Files modified:** DocumentCatalogPage.component.test.tsx
- **Committed in:** `45f20dc`

**2. [Rule 1 - Bug] Edit and template tests scoped to avoid duplicate Name/Edit queries**
- **Found during:** Tasks 2–3 GREEN verification
- **Issue:** Create + edit forms and template table duplicated accessible names
- **Fix:** Use getAllByRole for Edit; query within catalog-edit-form and templates-panel
- **Files modified:** DocumentCatalogPage.component.test.tsx
- **Committed in:** `f662a8e`, `340c90e`

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Test-only fixes; no behavior change.

## Issues Encountered

None blocking.

## User Setup Required

None.

## Next Phase Readiness

- 23-03 can build PM checklist page using shared fixtures and patterns from 23-01/23-02
- Catalog page ready for CPMO UAT on create/edit/retire/templates flows

## Self-Check: PASSED

- FOUND: modules/documents/ui/catalog/CatalogForm.tsx
- FOUND: modules/documents/ui/catalog/TemplatePanel.tsx
- FOUND: modules/documents/ui/catalog/useDocumentCatalog.ts
- FOUND: 8230170, 45f20dc, 4e861b7, f662a8e, ea32207, 340c90e

---
*Phase: 23-document-checklist-audit-viewer*
*Completed: 2026-08-28*
