---
phase: 01-test-harness
plan: 01
status: passed
verified_at: 2026-08-07
verifier: claude-code (autonomous)
---

# Phase 1: Test Harness — Verification

## Summary

All 5 success criteria confirmed by direct execution. `npm test` exits 0 (19 tests, 3 Postgres-gated skipped cleanly). CI gate runs with no suppression. Red-fail probe confirmed harness exits 1 on a broken assertion.

## Criteria Verification

| # | Criterion | Evidence | Result |
|---|-----------|----------|--------|
| 1 | `npm test` runs Vitest suite from committed `vitest.config.ts`, node default | `npx vitest run` → exit 0, 19 tests across node + jsdom projects; `vitest.config.ts` committed with `projects` array defaulting node env | ✅ PASS |
| 2 | Component test renders React 19 client component in jsdom and passes | `components/ui/badge.test.tsx` — 4 tests pass in jsdom project with `test/setup-jsdom.ts`; exercises Base UI `useRender` via `toBeInTheDocument` | ✅ PASS |
| 3 | Route-handler test constructs `NextRequest` and calls handler directly, no running server | `app/api/projects/route.test.ts` — 4 tests pass; handler imported directly, `@/lib/db` + `@/lib/auth` mocked via `vi.mock` | ✅ PASS |
| 4 | Repository test runs against real PostgreSQL test database via documented setup | `lib/db.test.ts` 3/3 pass against `pm_tool_test` (postgres:17, port 5455); skips cleanly when `TEST_DATABASE_URL` unset (3 pending, exit 0). Setup documented in README. | ✅ PASS |
| 5 | CI runs `npm test` on push and fails when a test fails | `.github/workflows/test.yml`: triggers on push + PR, runs `npm ci && npm test` with no `|| true` / `continue-on-error`; postgres:17 service injected via `TEST_DATABASE_URL` | ✅ PASS |

## Red/Green Confirmation

| Probe | Exit Code |
|-------|-----------|
| Green suite (clean) | `0` |
| Red probe (`lib/zz-verify-red.test.ts` with `expect(1).toBe(2)`) | `1` |
| After probe removed | `0` |

Red probe removed from working tree before this commit.

## Test Run (clean, no probe)

```
SUITES=11  TESTS=19  PASS=16  FAIL=0  PENDING=3
  lib/db.test.ts           :: 3 passed   (skips without TEST_DATABASE_URL)
  lib/status-weights.test.ts :: 8 passed
  app/api/projects/route.test.ts :: 4 passed
  components/ui/badge.test.tsx   :: 4 passed
```

## Repository Suite (with TEST_DATABASE_URL)

```
TESTS=3  PASS=3  FAIL=0  PENDING=0
  passed :: round-trips a row through real SQL
  passed :: isolates rows by company_id, proving tenant scoping is testable
  passed :: rejects a non-test database name
```

## Notes

- `vitest.config.ts` emits an ESM-in-CJS warning on startup (not an error; does not affect results — all tests pass)
- 3 Postgres tests skipped locally when `TEST_DATABASE_URL` is unset; this is expected and correct per TEST-04 design
- `test/db.ts` reads `TEST_DATABASE_URL` only, never `DATABASE_URL`; rejects any DB name not ending in `_test`
