---
phase: 07-ui-decomposition
plan: 01
subsystem: ui
tags: [react, vitest, jsdom, nextjs, decomposition]

requires:
  - phase: 07-00
    provides: vitest jsdom include for *.component.test.tsx
provides:
  - Colocated usePortfolioDashboard hook pattern for home dashboard
  - app/_components/ module layout proven on smallest god page
  - page.component.test.tsx with load + view-toggle interaction
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07, 07-08]

actuals:
  tokens: 32000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Colocated hook owns fetch; container owns filter/viewMode state"
    - "Section-banner _components/ extraction under app/"
    - "vi.stubGlobal fetch mocks in *.component.test.tsx"

key-files:
  created:
    - app/usePortfolioDashboard.ts
    - app/types.ts
    - app/_components/HealthScoreArc.tsx
    - app/_components/MiniSparkline.tsx
    - app/_components/helpers.ts
    - app/_components/ListRow.tsx
    - app/_components/ProjectCard.tsx
    - app/_components/ProgramSection.tsx
    - app/page.component.test.tsx
  modified:
    - app/page.tsx

key-decisions:
  - "Exposed setMeUser from hook to preserve onboarding onComplete optimistic update (behavior freeze)"
  - "Sub-split Page banner into PortfolioHeader, ProgramTabs, KpiCardsRow, etc. to keep page.tsx under 400 lines"

patterns-established:
  - "Archetype A/B/E: thin container + colocated hook + _components + component test"
  - "UI-09 grep gate clean on app/page.tsx decomposition tree"

requirements-completed: [UI-01, UI-08, UI-09, UI-10, UI-11, HYG-01, HYG-02, HYG-03]

coverage:
  - id: D1
    description: "Home dashboard decomposed with colocated hook and _components under 400 lines per file"
    requirement: UI-08
    verification:
      - kind: unit
        ref: "app/page.component.test.tsx#renders after load"
        status: pass
    human_judgment: false
  - id: D2
    description: "View mode toggle cards to list without behavior change"
    requirement: UI-11
    verification:
      - kind: automated_ui
        ref: "app/page.component.test.tsx#toggles view mode from cards to list"
        status: pass
    human_judgment: false
  - id: D3
    description: "Screens remain visually recognizable (no redesign verification)"
    requirement: UI-11
    verification: []
    human_judgment: true
    rationale: "Visual identity requires human UAT checklist per phase CONTEXT; component tests cover interaction only"

duration: 35min
completed: 2026-08-25
status: complete
---

# Phase 7 Plan 01: Home Dashboard Tracer Summary

**app/page.tsx decomposed into usePortfolioDashboard hook, 16 _components modules, 129-line container, and passing jsdom component tests**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-25T12:00:00Z
- **Completed:** 2026-08-25T12:35:00Z
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments

- Extracted `usePortfolioDashboard` with verbatim `/api/portfolio` and `/api/auth/me` fetch; filter/viewMode state stays in container
- Split all banner sections into `app/_components/` presentational modules; `app/page.tsx` is 129 lines
- Added `app/page.component.test.tsx` with render-after-load, cards/list toggle, and fetch URL rejection tests
- UI-09 grep returns zero forbidden imports in the decomposition tree

## Task Commits

1. **Task 1–2: Hook + modules + thin container** - `cb06699` (feat)
2. **Task 3: Component tests (load + interaction + fetch guard)** - `2718bb7` (test)

## Files Created/Modified

- `app/usePortfolioDashboard.ts` - Data hook (portfolio + auth/me fetch)
- `app/types.ts` - Shared ProjectRow, ProgramGroup, PortfolioData, MeUser types
- `app/_components/*.tsx` - Presentational modules split on section banners
- `app/page.tsx` - Thin container composing hook + modules
- `app/page.component.test.tsx` - jsdom tests with mocked fetch and Sidebar

## Decisions Made

- Exposed `setMeUser` from hook so OnboardingModal `onComplete` can optimistically set `onboarding_completed: 1` without behavior drift
- Extracted additional Page sub-sections (PortfolioHeader, KpiCardsRow, etc.) beyond the plan's minimum module list to satisfy the 400-line cap on `page.tsx`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Exposed setMeUser from hook for onboarding behavior freeze**
- **Found during:** Task 1 (container refactor)
- **Issue:** Moving meUser into hook removed page-local setMeUser used by OnboardingModal onComplete
- **Fix:** Return setMeUser from usePortfolioDashboard; restore original onComplete handler verbatim
- **Files modified:** app/usePortfolioDashboard.ts, app/page.tsx
- **Committed in:** cb06699

**2. [Rule 3 - Blocking] Extra _components beyond plan list to meet 400-line gate**
- **Found during:** Task 2 (line-count verify)
- **Issue:** page.tsx remained 733 lines after planned extractions
- **Fix:** Sub-split Page banner into PortfolioHeader, ProgramTabs, KpiCardsRow, AnalyticsMiddleRow, RecommendationsRow, PortfolioHealthMatrix, ProgramScorecard, ProjectsSection
- **Files modified:** app/page.tsx, app/_components/*
- **Committed in:** cb06699

---

**Total deviations:** 2 auto-fixed (1 behavior freeze, 1 line-count gate)
**Impact on plan:** No API or visual changes; extra modules are pure moves from Page banner.

## Issues Encountered

- Component test initially asserted "Status" text for list toggle, but PortfolioHealthMatrix table also renders a Status column; switched assertion to list-only "Alerts" header

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Home dashboard tracer pattern validated; wave 2 can parallelize larger god pages using same hook + _components + component test shape
- RagBadge.tsx added as helper-banner split (not in plan artifact table but required by multiple modules)

## Self-Check: PASSED

- FOUND: app/usePortfolioDashboard.ts
- FOUND: app/page.component.test.tsx
- FOUND: app/_components/HealthScoreArc.tsx
- FOUND: app/_components/MiniSparkline.tsx
- FOUND: cb06699
- FOUND: 2718bb7

---
*Phase: 07-ui-decomposition*
*Completed: 2026-08-25*
