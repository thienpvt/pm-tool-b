---
phase: 24-repo-wide-module-split
plan: 04
subsystem: api
tags: [documents, module-split, p2-re-export, p3-wrapper-stays, vitest, nextjs]

requires:
  - phase: 24-03
    provides: weekly P2/P3 split pattern and contract-test tracer
provides:
  - modules/documents/backend tree (services, repos, routes, handlers)
  - P2 app/api/document-catalog/**, document-templates/**, dashboards/document-compliance shells
  - P3 app/api/projects/[id]/document-checklist/** shells with local withProjectAccess
  - documents-module-split.test.ts contract (S1, P1, P2, P3 ENF-01)
  - Retargeted projects.service checklist imports
affects: [24-06, repo-wide-module-split]

actuals:
  tokens: 48000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "P2: export { GET, POST } from '@/modules/documents/backend/routes/document-catalog/route'"
    - "P3: export const GET = withProjectAccess(handlerFromModule)"
    - "document-compliance dashboard API owned by documents backend (D-06)"

key-files:
  created:
    - modules/documents/backend/documents-module-split.test.ts
    - modules/documents/backend/routes/projects/[id]/document-checklist/handlers.ts
    - modules/documents/backend/routes/projects/[id]/document-checklist/[itemId]/handlers.ts
    - modules/documents/backend/routes/projects/[id]/document-checklist/[itemId]/schema.ts
  modified:
    - app/api/document-catalog/route.ts
    - app/api/projects/[id]/document-checklist/route.ts
    - lib/services/projects.service.ts

key-decisions:
  - "Catalog, templates, and document-compliance dashboard are P2 pure re-exports; checklist stays P3 with wrappers in app/api (ENF-01, D-06)"
  - "document-compliance.service lives under modules/documents/backend, not dashboards (D-06)"
  - "Mechanical git mv only — no business logic rewrites (D-03)"

patterns-established:
  - "Wave 4 tracer: documents-module-split.test.ts asserts S1/P1/P2/P3 before expansion"
  - "P3 checklist handlers extracted to handlers.ts + schema.ts; tests import wrapped routes from @/app/api"

requirements-completed: [MOD-01, MOD-02]

coverage:
  - id: D1
    description: "modules/documents/backend exists with moved services, repos, and routes"
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "modules/documents/backend/documents-module-split.test.ts#S1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Catalog, templates, and document-compliance APIs resolve via P2 re-exports"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/documents/backend/documents-module-split.test.ts#P2"
        status: pass
    human_judgment: false
  - id: D3
    description: "Project document-checklist routes keep withProjectAccess in app/api (ENF-01)"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/documents/backend/documents-module-split.test.ts#P3 ENF-01"
        status: pass
      - kind: unit
        ref: "npx eslint app/api/projects/[id]/document-checklist/route.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Documents UI shells unchanged; /projects/:id/documents fat page untouched"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/documents/backend/documents-module-split.test.ts#Wave 6 guard"
        status: pass
      - kind: manual_procedural
        ref: "Open /documents/catalog and /projects/:id/document-checklist"
        status: unknown
    human_judgment: true
    rationale: "URL smoke and visual chrome require human verification (D-10)"

duration: 12min
completed: 2026-08-28
status: complete
---

# Phase 24 Plan 04: Documents Backend Split Summary

**Document catalog, templates, compliance dashboard, and project checklist APIs moved to modules/documents/backend with P2 re-exports and P3 wrapper-stays (ENF-01)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-28T13:08:00Z
- **Completed:** 2026-08-28T13:20:00Z
- **Tasks:** 3
- **Files modified:** 35+

## Accomplishments

- Created `modules/documents/backend/` with catalog, templates, compliance services/repos and P2 route bodies
- P2 shells for `/api/document-catalog`, `/api/document-templates`, `/api/dashboards/document-compliance`
- P3 checklist handlers extracted; `app/api/projects/[id]/document-checklist/**` keep `withProjectAccess` wrappers
- `app/projects/[id]/documents/page.tsx` left untouched for Wave 6
- 94 vitest tests pass under `modules/documents`

## Task Commits

Each task followed TDD with RED then GREEN commits:

1. **Task 1: Contract tests plus document-catalog P2 tracer**
   - RED: `ae295be` test(24-04): red documents catalog tracer
   - GREEN: `e3b19ec` feat(24-04): documents catalog P2 tracer
2. **Task 2: Move templates, compliance, generate, and remaining P2 routes**
   - RED: `5ea62b7` test(24-04): red documents remaining P2 routes
   - GREEN: `c785fc3` feat(24-04): documents remaining P2 routes
3. **Task 3: Extract P3 document-checklist handlers**
   - RED: `8453b3c` test(24-04): red checklist P3 wrapper-stays
   - GREEN: `ead504e` feat(24-04): checklist P3 wrapper-stays

## Files Created/Modified

- `modules/documents/backend/documents-module-split.test.ts` — Wave 4 contract (S1, P1, P2, P3, Wave 6 guard)
- `modules/documents/backend/services/document-catalog.service.ts` — moved catalog service
- `modules/documents/backend/routes/dashboards/document-compliance/route.ts` — compliance dashboard API (documents-owned)
- `modules/documents/backend/routes/projects/[id]/document-checklist/handlers.ts` — P3 checklist collection handlers
- `app/api/document-catalog/route.ts` — P2 shell re-exporting GET/POST

## Decisions Made

- Document-compliance dashboard API stays documents-feature-owned per D-06 (not dashboards module)
- P3 test regex uses `withProjectAccess[\(<]` to match generic wrapper syntax on checklist routes
- Colocated checklist route.test.ts imports wrapped handlers from `@/app/api/.../route` (matches weekly wave)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] P3 contract test regex for generic withProjectAccess**
- **Found during:** Task 1 RED verification
- **Issue:** Checklist routes use `withProjectAccess<{ id: string }>(` — literal `withProjectAccess(` substring absent in source
- **Fix:** Changed contract assertion to `/withProjectAccess[\(<]/`
- **Files modified:** modules/documents/backend/documents-module-split.test.ts
- **Committed in:** e3b19ec (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test contract)
**Impact on plan:** Test-only fix; no runtime behavior change.

## Issues Encountered

None — all automated verifications passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Documents backend complete; Wave 5 (portfolio) can proceed
- Wave 6 projects UI must still split `app/projects/[id]/documents/page.tsx` separately

## Self-Check: PASSED

- FOUND: modules/documents/backend/documents-module-split.test.ts
- FOUND: modules/documents/backend/routes/projects/[id]/document-checklist/handlers.ts
- FOUND: app/api/document-catalog/route.ts
- FOUND: ae295be, e3b19ec, 5ea62b7, c785fc3, 8453b3c, ead504e

---
*Phase: 24-repo-wide-module-split*
*Completed: 2026-08-28*
