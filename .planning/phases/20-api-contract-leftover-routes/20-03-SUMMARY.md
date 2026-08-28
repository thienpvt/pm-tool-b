---
phase: 20-api-contract-leftover-routes
plan: 03
subsystem: testing
tags: [eslint, typescript-eslint, ci, route-wrappers, enf-01]

requires: []
provides:
  - pm-tool/require-auth-wrapper ESLint rule for project-scoped route.ts files
  - eslint/route-wrapper-allowlist.json for D-23 operations, companies, and health
  - npm run lint scoped to app/api/**/route.ts with CI gate after npm ci
affects: [20-api-contract-leftover-routes, enf-01]

actuals:
  tokens: 14200
  tasks: 2
  commits: 5

tech-stack:
  added: ["@typescript-eslint/utils@8.68.0"]
  patterns:
    - "Local ESLint plugin (eslint/plugin.mjs) with path-gated require-auth-wrapper rule"
    - "Explicit JSON allowlist for D-23 carve-outs instead of comment exemptions"

key-files:
  created:
    - eslint/rules/require-auth-wrapper.mjs
    - eslint/rules/require-auth-wrapper.test.ts
    - eslint/plugin.mjs
    - eslint/route-wrapper-allowlist.json
  modified:
    - eslint.config.mjs
    - package.json
    - package-lock.json
    - vitest.config.ts
    - .github/workflows/test.yml

key-decisions:
  - "Path gate uses literal /projects/[id]/ segments in context.filename, not minimatch globs"
  - "Allowlist JSON file for D-23 exemptions — no comment-based skips"
  - "lint script targets app/api/**/route.ts only so CI enforces ENF-01 without whole-repo cleanup"

patterns-established:
  - "Project-scoped routes must export HTTP handlers as direct calls to sanctioned wrappers"
  - "TSInstantiationExpression wrappers (withProjectAccess<Params>) count as wrapped"

requirements-completed: [ENF-01]

coverage:
  - id: D1
    description: "ESLint rule reports unwrapped project-scoped HTTP method exports"
    requirement: ENF-01
    verification:
      - kind: unit
        ref: "eslint/rules/require-auth-wrapper.test.ts#enforces sanctioned wrappers on project-scoped routes"
        status: pass
    human_judgment: false
  - id: D2
    description: "CI runs npm run lint after npm ci on app/api route files"
    requirement: ENF-01
    verification:
      - kind: other
        ref: "npm run lint"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-23 allowlist covers operations/**, admin/companies, and health"
    requirement: ENF-01
    verification:
      - kind: unit
        ref: "eslint/route-wrapper-allowlist.json"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 03: ENF-01 ESLint Route Wrapper Gate Summary

**Local ESLint rule with JSON allowlist gates project-scoped route.ts handlers; CI runs scoped npm run lint after npm ci**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-28T07:22:00Z
- **Completed:** 2026-08-28T07:27:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added `pm-tool/require-auth-wrapper` rule detecting unwrapped GET/POST/PUT/PATCH/DELETE exports in project-scoped paths
- Created `eslint/route-wrapper-allowlist.json` with health, eight operations routes, and admin/companies (D-23)
- Wired `npm run lint` into `.github/workflows/test.yml` after `npm ci`; lint scoped to `app/api/**/route.ts`
- Rule unit tests cover wrapped handlers, type-arg wrappers, unwrapped violations, and non-project portfolio paths

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: require-auth-wrapper rule tests** - `c96b56a` (test)
2. **Task 1 GREEN: rule, allowlist, lint script** - `d4639bc` (feat)
3. **Task 2: CI lint step and eslint.config registration** - `4f6e84b` (feat)
4. **Fix: declare @typescript-eslint/utils in package.json** - `9182e4d` (fix)

**Plan metadata:** `0080ae8` (docs: complete plan)

## Files Created/Modified

- `eslint/rules/require-auth-wrapper.mjs` - ESLint rule with path gate and wrapper detection
- `eslint/rules/require-auth-wrapper.test.ts` - RuleTester cases for ENF-01 behavior
- `eslint/plugin.mjs` - Local pm-tool ESLint plugin registration
- `eslint/route-wrapper-allowlist.json` - D-23 + health posix path allowlist
- `eslint.config.mjs` - Registers rule on app/api/**/route.ts
- `package.json` - lint script scope + @typescript-eslint/utils@8.68.0 pin
- `vitest.config.ts` - Includes eslint/**/*.test.ts in node project
- `.github/workflows/test.yml` - npm run lint step after npm ci

## Decisions Made

- Path gate matches literal `/projects/[id]/`, `/programs/[id]/`, export `[id]` segments, and import/resource-plan paths — avoids minimatch character-class pitfall
- Portfolio and collection routes remain out of scope even if they use raw `export async function GET`
- Whole-repo eslint deferred; ENF-01 enforced only on route.ts files via scoped lint script

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @typescript-eslint/utils missing from package.json devDependencies**
- **Found during:** Task 1 GREEN commit verification
- **Issue:** npm install updated lockfile but package.json lacked explicit devDependency entry
- **Fix:** Added `"@typescript-eslint/utils": "8.68.0"` to devDependencies
- **Files modified:** package.json
- **Committed in:** 9182e4d

**2. [Rule 1 - Bug] RuleTester not recognized by Vitest without describe/it wrapper**
- **Found during:** Task 1 GREEN verification
- **Issue:** Standalone RuleTester.run produced "No test suite found"
- **Fix:** Wrapped RuleTester.run in vitest describe/it block
- **Files modified:** eslint/rules/require-auth-wrapper.test.ts
- **Committed in:** d4639bc (included in GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Required for acceptance criteria and test execution. No scope creep.

## Issues Encountered

None beyond the auto-fixed items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ENF-01 CI gate active; unwrapped project-scoped handlers will fail `npm run lint`
- Ready for Phase 20 Plan 04 (THIN-01 service extraction) without further ENF-01 wiring

## Self-Check: PASSED

- FOUND: eslint/rules/require-auth-wrapper.mjs
- FOUND: eslint/route-wrapper-allowlist.json
- FOUND: eslint.config.mjs (plugin registered)
- FOUND: c96b56a, d4639bc, 4f6e84b, 9182e4d

---
*Phase: 20-api-contract-leftover-routes*
*Completed: 2026-08-28*
