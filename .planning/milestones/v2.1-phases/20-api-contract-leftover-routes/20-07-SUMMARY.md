---
phase: 20-api-contract-leftover-routes
plan: 07
subsystem: api
tags: [nextjs, vitest, settings, jira-config, rag-config, thin-routes]

requires:
  - phase: 20-api-contract-leftover-routes
    provides: D-05 service split pattern from users.service and admin-platform.service
provides:
  - settings.service.ts with listSettings/setSettings
  - jira-config.service.ts with getCompanyJiraConfigOrEmpty/setCompanyJiraConfigVars
  - rag-config.service.ts with getCompanyRagConfigOrDefault/setCompanyRagConfigValues
  - Service-backed /api/config, /api/admin/jira-config, /api/admin/rag-config routes
  - D-06 verification that import-mapping family already uses services
affects: [phase-27-hyg-02, phase-24-module-split]

actuals:
  tokens: 5200
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Route → domain service → repository for config/admin-config (D-05 split)"
    - "requireAdmin break-glass preserved on jira/rag admin routes (no withCpmo)"

key-files:
  created:
    - lib/services/settings.service.ts
    - lib/services/jira-config.service.ts
    - lib/services/rag-config.service.ts
  modified:
    - app/api/config/route.ts
    - app/api/config/route.test.ts
    - app/api/admin/jira-config/[companyId]/route.ts
    - app/api/admin/rag-config/[companyId]/route.ts
    - app/api/admin/rag-config/[companyId]/route.test.ts

key-decisions:
  - "D-05 split: settings/jira-config/rag-config as separate services, not folded into admin-platform.service"
  - "RAG Number() coercion and eight-field merge stay in route (shape freeze); service handles repo + default fallback"
  - "D-06 verify-only: all seven mapping routes already service-backed — no rewrite"

patterns-established:
  - "Config POST calls setSettings once with parsed body object (service loops setSetting internally)"
  - "Admin jira/rag routes use requireAdmin { err, user } pattern unchanged from Phase 10 break-glass"

requirements-completed: [THIN-01]

coverage:
  - id: D1
    description: "/api/config GET/POST call settings.service with mask and is_admin 403 preserved"
    requirement: THIN-01
    verification:
      - kind: unit
        ref: "app/api/config/route.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Admin jira-config and rag-config routes call domain services with requireAdmin"
    requirement: THIN-01
    verification:
      - kind: unit
        ref: "app/api/admin/rag-config/[companyId]/route.test.ts"
        status: pass
      - kind: other
        ref: "node import assert for jira-config and rag-config route.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Import-mapping family verified already service-backed (D-06 verify-only)"
    requirement: THIN-01
    verification:
      - kind: other
        ref: "node verify script for 7 mapping route.ts files"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 07: Config & Admin Config Services Summary

**Domain services for settings, jira-config, and rag-config with thinned routes; import-mapping family verified already THIN (D-06)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-28T07:34:00Z
- **Completed:** 2026-08-28T07:39:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Created `settings.service.ts`, `jira-config.service.ts`, and `rag-config.service.ts` per D-05 split
- `/api/config` now calls `listSettings`/`setSettings`; anthropic key mask and in-handler `is_admin` 403 preserved
- Admin jira-config and rag-config routes call services; `requireAdmin` break-glass unchanged (no withCpmo)
- Verified all seven import-mapping/jira-mapping routes already import services only (D-06 — no rewrite)

## Task Commits

Each task was committed atomically:

1. **Task 1: settings.service and thin /api/config** - `9b18cbb` (feat)
2. **Task 2: jira-config.service and rag-config.service; thin admin config routes** - `553b401` (feat)
3. **Task 3: Verify import-mapping family already uses services** - verify-only, no commit

**Plan metadata:** pending (docs commit after state update)

## Files Created/Modified
- `lib/services/settings.service.ts` - listSettings/setSettings wrapper over settings.repo
- `lib/services/jira-config.service.ts` - getCompanyJiraConfigOrEmpty/setCompanyJiraConfigVars
- `lib/services/rag-config.service.ts` - getCompanyRagConfigOrDefault/setCompanyRagConfigValues
- `app/api/config/route.ts` - imports settings.service; POST calls setSettings once
- `app/api/config/route.test.ts` - mocks retargeted to settings.service
- `app/api/admin/jira-config/[companyId]/route.ts` - imports jira-config.service
- `app/api/admin/rag-config/[companyId]/route.ts` - imports rag-config.service
- `app/api/admin/rag-config/[companyId]/route.test.ts` - mocks retargeted to rag-config.service

## Decisions Made
- Kept RAG Number() coercion in route per shape-freeze; service owns repo call and DEFAULT_RAG_CONFIG fallback
- D-06 verify-only confirmed — no production changes to mapping routes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 20 config/admin-config THIN-01 debt closed
- Phase 20 complete (all 7 plans done) — ready for phase closeout/verification

---
*Phase: 20-api-contract-leftover-routes*
*Completed: 2026-08-28*

## Self-Check: PASSED

- All key files found on disk
- Commits 9b18cbb and 553b401 verified in git log
