---
phase: 01-test-harness
plan: 01
subsystem: testing
tags: [vitest, jsdom, testing-library, postgres, ci]
status: complete
requires: []
provides:
  - vitest-harness
  - node-test-project
  - jsdom-test-project
  - route-handler-test-pattern
  - postgres-repository-test-pattern
  - ci-test-gate
affects:
  - package.json
  - README.md
tech-stack:
  added:
    - vitest@4.1.10
    - jsdom@30.0.1
    - "@testing-library/react@16.3.2"
    - "@testing-library/jest-dom@7.0.0"
  patterns:
    - "vitest.config.ts `projects` array: node env for *.test.ts, jsdom env for *.test.tsx"
    - "route handlers tested by direct import + constructed NextRequest, deps via vi.mock"
    - "repository tests read TEST_DATABASE_URL only, skipIf when unset, refuse non-*_test DB"
key-files:
  created:
    - vitest.config.ts
    - test/setup-jsdom.ts
    - test/db.ts
    - lib/status-weights.test.ts
    - components/ui/badge.test.tsx
    - app/api/projects/route.test.ts
    - lib/db.test.ts
    - .github/workflows/test.yml
  modified:
    - package.json
    - README.md
decisions:
  - "Dropped @vitejs/plugin-react and vite-tsconfig-paths — unresolvable peer conflict; esbuild transforms JSX via tsconfig jsx: react-jsx and the @ alias is one line of config"
  - "@testing-library/jest-dom pinned at 7.0.0 (plan said 6.9.1) — 7.x is current and its /vitest entry works unchanged"
  - "Repository probe table (harness_probe) created by the test rather than running the app schema — proves real SQL without triggering seedAuthData"
metrics:
  duration: ~45m
  completed: 2026-08-07
actuals:
  tokens: 9000
  tasks: 8
  commits: 8
---

# Phase 1 Plan 01: Test Harness Summary

Vitest 4 harness with two projects (node + jsdom) plus a CI gate, proving all four test shapes this codebase needs: pure-function unit, React 19 component in jsdom, App Router route handler with a constructed `NextRequest`, and real SQL against a throwaway Postgres.

## What Was Built

| Requirement | Artifact | Result |
|---|---|---|
| TEST-01 node suite | `lib/status-weights.test.ts` | 8 tests pass under the `node` project |
| TEST-02 jsdom component | `components/ui/badge.test.tsx` | 4 tests pass; `Badge` (Base UI `useRender`) renders, `toBeInTheDocument` resolves |
| TEST-03 route handler | `app/api/projects/route.test.ts` | 4 tests pass; `GET` called directly, no server, `@/lib/db` + `@/lib/auth` mocked |
| TEST-04 repository | `test/db.ts`, `lib/db.test.ts` | Skips clean with `TEST_DATABASE_URL` unset; 3 tests pass against `postgres:17` at `pm_tool_test` |
| TEST-05 CI gate | `.github/workflows/test.yml` | `npm ci` → `npm test` on push/PR with a `postgres:17` service, no failure suppression |

`vitest.config.ts` splits by file extension: `{lib,app}/**/*.test.ts` runs in node, `{components,app}/**/*.test.tsx` runs in jsdom with `test/setup-jsdom.ts`. The `@` alias resolves to the repo root in both, matching `tsconfig.json`.

`test/db.ts` reads `TEST_DATABASE_URL` only — never `DATABASE_URL` — and throws before opening a pool if the database name does not end in `_test`. Repository tests never call `getDb()`, so `seedAuthData` never writes default admin credentials into a test DB (threat #4).

## Red-Fails / Green-Passes Proof

An expected `1` in `lib/status-weights.test.ts` was temporarily changed to `2`:

| Run | Observed exit code |
|---|---|
| Green (unmodified) | `0` |
| Red (broken assertion) | `1` — 1 failed / 7 passed |
| After revert | `0` |

Broken assertion was reverted and never committed.

## Verification Results

| Check | Result |
|---|---|
| `npm test` | exit 0 — 19 tests across node + jsdom |
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | exit 0 |
| `npx eslint .` | exit 0 — 230 pre-existing problems, zero from new files |
| Repository suite with `TEST_DATABASE_URL` unset | skipped, exit 0 |
| Repository suite against real `pm_tool_test` | 3/3 pass |
| `.github/workflows/docker-build.yml` | SHA `5acf8b8573875ffa2a8b3bfce4ca24bc44d7a65d` before and after — byte-identical |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dropped `@vitejs/plugin-react` and `vite-tsconfig-paths`**
- **Found during:** Task 1
- **Issue:** The plan pinned `@vitejs/plugin-react@6.1.1`, which does not exist — latest is 6.0.5. Installing 6.0.5 produced an unresolvable peer conflict: it pulls `@babel/core@8.0.1` while `@rolldown/plugin-babel` requires `^7`.
- **Fix:** Both packages omitted. Vitest's esbuild transform already handles TSX via `tsconfig.json` `jsx: "react-jsx"`, and the `@` alias is set inline with `path.resolve(__dirname, '.')` per project — one line each, no dependency. Verified by `components/ui/badge.test.tsx` passing 4/4, which exercises JSX transform and alias resolution together.
- **Files modified:** `package.json`, `vitest.config.ts`
- **Commits:** `fa8e7c1`, `3fee237`
- **Note:** Per the package-install exclusion in Rule 3, no similarly-named substitute was installed. The capability was replaced with config, not with a different package.

**2. [Rule 3 - Blocking] `@testing-library/jest-dom` installed at 7.0.0 instead of 6.9.1**
- **Found during:** Task 1
- **Issue:** Plan pinned 6.9.1; 7.0.0 is the current release.
- **Fix:** Installed 7.0.0. The `@testing-library/jest-dom/vitest` entry point is unchanged, and matchers load correctly from `test/setup-jsdom.ts`.
- **Files modified:** `package.json`
- **Commit:** `fa8e7c1`

**3. [Rule 2 - Missing functionality] `test:watch` script**
- **Found during:** Task 8
- **Issue:** Plan Task 1 specified both `test` and `test:watch`, but only `test` landed in the initial install; the README documents `npm run test:watch`.
- **Fix:** Added `"test:watch": "vitest"` to `package.json` scripts.
- **Commit:** `4d3a593`

**4. [Rule 1 - Adjustment] `vitest.config.ts` include globs narrowed**
- **Found during:** Task 2
- **Issue:** The plan's `**/*.test.ts` glob scans `node_modules` and `.next` before the exclude list applies, and would pick up any stray file in the tree.
- **Fix:** Scoped to `{lib,app}/**/*.test.ts` and `{components,app}/**/*.test.tsx`, which covers every location this project puts tests and makes the excludes unnecessary.
- **Commit:** `3fee237`

**5. [Rule 1 - Adjustment] Assertions adapted to actual source**
- **Found during:** Tasks 3, 4, 5
- **Issue:** Plan draft assertions used status weights and Tailwind classes that did not match the real modules (`statusWeight('Blocked')`, `weightedProgress(['Done','In Progress','New'])`, `toHaveClass('bg-primary')`).
- **Fix:** Read `lib/status-weights.ts`, `components/ui/badge.tsx`, and `app/api/projects/route.ts` and wrote assertions against actual behavior — real weight values, `className.toContain` for cva/tailwind-merge output, and the handler's actual three-way admin / company-scoped / null-company branch. No assertion was weakened or deleted.
- **Commits:** `5c04976`, `aed3beb`, `0515f9c`

## Tenant-Isolation Finding

The plan instructed leaving the `company_id` scoping assertion failing if `GET /api/projects` did not filter by company. **It does filter** — the non-admin branch is:

```
WHERE (p.company_id = ? OR c.company_id = ?)
```

with `user.company_id` bound twice. The assertion passes; no tenant-isolation defect to defer from this route. Two related observations for Phase 5/6, neither a failure here:

- The scoping is inline in the route handler, not behind a shared guard — every new project-scoped route must remember to repeat it. That is the structural risk this milestone exists to remove.
- The third branch (`company_id IS NULL`) exposes all null-company projects to any null-company user, which is a shared bucket rather than an isolated tenant. Worth an explicit decision in the authorization phase.

## Known Stubs

None. Every test file asserts real behavior against real source; no placeholder or always-empty data paths were introduced.

## Threat Flags

None. This plan added no network endpoints, auth paths, or schema changes. The CI workflow uses literal throwaway service credentials scoped to the job and references no repository secrets (threat #2 mitigated as planned).

## Commits

| Task | Commit | Description |
|---|---|---|
| 1 | `fa8e7c1` | vitest test harness dependencies |
| 2 | `3fee237` | vitest config with node and jsdom projects |
| 3 | `5c04976` | node unit test for status weights (TEST-01) |
| 4 | `aed3beb` | jsdom component test for Badge (TEST-02) |
| 5 | `0515f9c` | route handler test with NextRequest, no server (TEST-03) |
| 6 | `4a1caa8` | postgres test-db helper and repository test (TEST-04) |
| 7 | `f7e77bf` | test workflow with postgres service (TEST-05) |
| 8 | `4d3a593` | document test harness and add test:watch script |

## Self-Check: PASSED

All 8 created files present on disk; all 8 commit hashes found in `git log`.
