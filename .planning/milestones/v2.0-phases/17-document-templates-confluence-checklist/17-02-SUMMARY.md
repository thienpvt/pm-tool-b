---
phase: 17-document-templates-confluence-checklist
plan: 02
subsystem: api
tags: [document-templates, checklist, https-url, confluence, vitest, nextjs]

requires:
  - phase: 17-01
    provides: document_catalog DDL, project_document_checklist repo, document-catalog routes
provides:
  - parseHttpsUrl URL validation helper
  - Versioned HTTPS document template POST/GET/retire API
  - Checklist PATCH with status rules and binary rejection
  - Project document-checklist GET list/item and PATCH routes
affects: [17-03, document-compliance]

actuals:
  tokens: 82000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "parseHttpsUrl analog to parseIsoDate for HTTPS-only evidence URLs"
    - "Template replace = retire current + insert monotonic version"
    - "Checklist PATCH via assertProjectWriteAccess with status-dependent URL rules"

key-files:
  created:
    - lib/documents/https-url.ts
    - lib/documents/checklist-status.ts
    - lib/repositories/document-templates.repo.ts
    - lib/services/document-templates.service.ts
    - lib/services/project-document-checklist.service.ts
    - app/api/document-templates/route.ts
    - app/api/document-templates/[id]/route.ts
    - app/api/projects/[id]/document-checklist/route.ts
    - app/api/projects/[id]/document-checklist/[itemId]/route.ts
  modified:
    - lib/repositories/project-document-checklist.repo.ts

key-decisions:
  - "URL-only templates via template_url TEXT — no BYTEA on template or checklist tables"
  - "Effective template list uses DISTINCT ON (catalog_id) with retired_at IS NULL and effective_date <= CURRENT_DATE"
  - "Checklist auditLog fires on status or confluence_url change only"

patterns-established:
  - "rejectBinaryFields blocks file/content/blob/attachment/data keys on checklist PATCH"
  - "assertChecklistPatchRules encodes D-07/D-08 per-status validation in one function"

requirements-completed: [DOC-03, DOC-04, DOC-05]

coverage:
  - id: D1
    description: "CPMO uploads/replaces HTTPS template versions with monotonic versioning and retire"
    requirement: DOC-03
    verification:
      - kind: unit
        ref: lib/services/document-templates.service.unit.test.ts#createTemplateVersion
        status: pass
      - kind: unit
        ref: app/api/document-templates/route.test.ts#POST
        status: pass
    human_judgment: false
  - id: D2
    description: "PM lists effective templates; GET by id returns retired history"
    requirement: DOC-03
    verification:
      - kind: unit
        ref: lib/services/document-templates.service.unit.test.ts#listEffectiveTemplates
        status: pass
    human_judgment: false
  - id: D3
    description: "Checklist PATCH enforces HTTPS URLs, status rules, binary rejection, Viewer 403"
    requirement: DOC-04
    verification:
      - kind: unit
        ref: lib/documents/https-url.unit.test.ts#assertChecklistPatchRules
        status: pass
      - kind: unit
        ref: lib/services/project-document-checklist.service.unit.test.ts#patchChecklistItem
        status: pass
    human_judgment: false
  - id: D4
    description: "Checklist routes GET for Viewer/PM, PATCH for PM only, FormData 400, no collection POST"
    requirement: DOC-04
    verification:
      - kind: unit
        ref: app/api/projects/[id]/document-checklist/[itemId]/route.test.ts
        status: pass
    human_judgment: false
  - id: D5
    description: "Approved requires date+approver; N/A requires na_reason"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: lib/documents/https-url.unit.test.ts#approved requires
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 17 Plan 02: Document Templates & Checklist PATCH Summary

**Versioned HTTPS document templates with CPMO upload/replace/retire, plus PM checklist PATCH enforcing Confluence HTTPS links and approved/N/A status rules**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-26T15:02:00Z
- **Completed:** 2026-08-26T15:27:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- CPMO can POST JSON `{ catalog_id, name, document_type, effective_date, guidance, template_url }` to create monotonic template versions; previous current row gets `retired_at`
- PM/CPMO GET effective templates (non-retired, `effective_date <= today`, highest version per catalog); GET by id returns retired history
- CPMO PATCH `{ retire: true }` retires current template version with auditLog
- PM PATCH checklist items with HTTPS-only `confluence_url`, status-dependent validation, binary field rejection; Viewer GET 200, PATCH 403
- Collection checklist route is GET-only (generation remains server-side in 17-03)

## Task Commits

Each task followed TDD RED → GREEN:

1. **Task 1: Template URL upload, replace, retire, effective GET**
   - `073f185` test(17-02): red template versioning and parseHttpsUrl
   - `f9bc721` feat(17-02): versioned HTTPS document templates
2. **Task 2: Checklist PATCH HTTPS and status rules**
   - `c22368b` test(17-02): red checklist PATCH rules
   - `cba8461` feat(17-02): checklist PATCH HTTPS and status rules
3. **Task 3: Checklist list and item routes plus JSON-only boundary**
   - `0fc0fb8` test(17-02): red checklist routes
   - `111735b` feat(17-02): project document-checklist routes

## Files Created/Modified

- `lib/documents/https-url.ts` — parseHttpsUrl helper (https-only, rejects data: URLs)
- `lib/documents/checklist-status.ts` — CHECKLIST_STATUSES, rejectBinaryFields, assertChecklistPatchRules
- `lib/repositories/document-templates.repo.ts` — retire-then-insert versioning queries
- `lib/services/document-templates.service.ts` — createTemplateVersion, listEffectiveTemplates, getTemplate, retireTemplate
- `lib/services/project-document-checklist.service.ts` — list/get/patch with access and audit
- `app/api/document-templates/route.ts` — GET withAuth, POST withCpmo
- `app/api/document-templates/[id]/route.ts` — GET withAuth, PATCH withCpmo retire
- `app/api/projects/[id]/document-checklist/route.ts` — GET withProjectAccess only
- `app/api/projects/[id]/document-checklist/[itemId]/route.ts` — GET/PATCH withProjectAccess
- `lib/repositories/project-document-checklist.repo.ts` — getChecklistItem, updateChecklistItem

## Decisions Made

- Used DISTINCT ON (catalog_id) for effective template listing per catalog
- auditLog on checklist fires when status or confluence_url changes (not on notes-only edits)
- Route tests use repo mocks with real access layer for authentic Viewer 403 behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added getMaxVersion mock to template service unit test**
- **Found during:** Task 1 GREEN
- **Issue:** Service calls getMaxVersion but RED mock omitted it
- **Fix:** Added getMaxVersion to vi.mock exports and beforeEach setup
- **Files modified:** lib/services/document-templates.service.unit.test.ts
- **Committed in:** f9bc721

**2. [Rule 1 - Bug] Route test switched from service mock to repo mock for access enforcement**
- **Found during:** Task 3 GREEN
- **Issue:** Full service mock bypassed assertProjectWriteAccess, Viewer PATCH would not 403
- **Fix:** Mock repos + audit; exercise real service and access layer
- **Files modified:** app/api/projects/[id]/document-checklist/[itemId]/route.test.ts
- **Committed in:** 111735b

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Test infrastructure fixes only; no contract changes.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 17-03 can hook createProject/stage generate and compliance GET using checklist service/repo
- All 46 plan verification tests pass

## Self-Check: PASSED

- FOUND: lib/documents/https-url.ts
- FOUND: lib/documents/checklist-status.ts
- FOUND: lib/services/document-templates.service.ts
- FOUND: lib/services/project-document-checklist.service.ts
- FOUND: app/api/document-templates/route.ts
- FOUND: app/api/projects/[id]/document-checklist/route.ts
- FOUND: 073f185, f9bc721, c22368b, cba8461, 0fc0fb8, 111735b

---
*Phase: 17-document-templates-confluence-checklist*
*Completed: 2026-08-26*
