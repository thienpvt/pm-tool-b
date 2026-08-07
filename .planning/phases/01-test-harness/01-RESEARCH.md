# Phase 1: Test Harness — Research

**Researched:** 2026-08-07
**Note:** Produced inline by the orchestrator (subagent dispatch returned API 402 limit).

## Existing State

| Fact | Evidence |
|---|---|
| No test runner installed | `package.json` scripts = dev/build/start/lint only; no vitest/jest deps |
| No test config files | `vitest.config.*`, `jest.config.*`, `playwright.config.*` all absent |
| Next 16.2.4 / React 19.2.4 | `package.json` dependencies |
| Path alias `@/*` → repo root | `tsconfig.json` `paths` |
| `lib/db.ts` exports `getDb()` singleton | requires `DATABASE_URL`, creates schema via `initPostgresSchema`, then `seedAuthData` |
| Routes import `getDb` + `getSessionFromRequest` directly | e.g. `app/api/projects/route.ts:1-11` |
| CI = one workflow, Docker build only | `.github/workflows/docker-build.yml` |
| ~100+ route handlers under `app/api/` | all export `GET`/`POST`/etc. taking `NextRequest` |

## Stack Decision

Vitest 4.x. Reasons: Vite-native so `.ts`/`.tsx`/ESM works with no Babel step; `test.projects` gives one config with two environments (node + jsdom) satisfying TEST-01 + TEST-02 without a second config file; Next 16 has no first-party Jest transform advantage anymore.

**Deps to add (dev, pinned):**
```
vitest@4.1.10
@vitejs/plugin-react@6.0.5
jsdom@30.0.1
@testing-library/react@16.3.2
@testing-library/jest-dom@6.1.1
vite-tsconfig-paths@6.0.1
```

`vite-tsconfig-paths` resolves `@/lib/db` from `tsconfig.json` — avoids hand-maintaining a duplicate alias map.

## Key Patterns

### Multi-environment config (TEST-01 + TEST-02)
```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      { extends: true, test: { name: 'node', environment: 'node', include: ['{lib,app}/**/*.test.ts'] } },
      { plugins: [react(), tsconfigPaths()], test: { name: 'jsdom', environment: 'jsdom',
        include: ['{components,app}/**/*.test.tsx'], setupFiles: ['./test/setup.tsx'] } },
    ],
  },
});
```
`environment: 'node'` is the default for the root; the `node` project states it explicitly for TEST-01.

### Route handler test (TEST-03)
Route handlers are plain exported functions — import and call directly, no server:
```ts
import { GET } from '@/app/api/projects/route';
const res = await GET(new NextRequest('http://localhost/api/projects'));
expect(res.status).toBe(401);
```
The 401-without-session path is the natural smoke test: it exercises `getSessionFromRequest` (which calls `getDb()`) but needs no fixture data. **Gotcha:** it still touches the DB, so it needs `DATABASE_URL`. Cleanest harness proof is to `vi.mock('@/lib/auth')` for the unit-level route test and keep real-DB work in the repo test.

### Postgres test DB (TEST-04)
`getDb()` already does `CREATE TABLE IF NOT EXISTS` for every table plus seeds — so pointing `DATABASE_URL` at an empty test database self-provisions the schema. No migration tooling needed.

Setup command: docker one-liner, documented in README.
```
docker run -d --name pm-tool-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=pm_tool_test -p 5433:5432 postgres:17-alpine
```
`DATABASE_URL=postgresql://postgres:test@localhost:5433/pm_tool_test?sslmode=disable` — `sslmode=disable` matters: `lib/db.ts` only skips TLS when the URL says so or the host is localhost/private.

Repo tests must be `sequential` or share the singleton carefully — `getDb()` caches `_client` per module registry, and Vitest isolates per test file, so each file gets its own pool. Pools must be closed or the run hangs; simplest is `pool.end()` unavailable through `DbClient`, so keep DB tests in one file and accept the process exiting via Vitest's default teardown.

### CI (TEST-05)
Separate workflow, `postgres:17-alpine` service container with a health check, `npm ci && npm test`. Fails build on non-zero exit — Vitest's default.

## Pitfalls

1. **`server-only` imports** — if any tested module imports `server-only`, Vitest throws. None of `lib/db.ts`, `lib/auth.ts` do; verify before widening scope.
2. **`next/headers` in route handlers** — `getSessionFromRequest(req)` reads the cookie off the request, not `next/headers`, so no async-context shim needed. Routes that use `cookies()` would need one.
3. **jsdom + React 19** — needs `@testing-library/react` ≥16 for the React 19 peer. 16.3.2 satisfies it.
4. **`@testing-library/jest-dom`** — import `@testing-library/jest-dom/vitest` in setup, not the bare package.
5. **Postgres service port in CI** — map 5432 directly in CI (no conflict), keep 5433 locally to avoid clashing with a dev DB.

## Validation Architecture

| Requirement | Proof |
|---|---|
| TEST-01 | `npm test` exits 0 with a passing node-env test; `vitest.config.ts` committed |
| TEST-02 | jsdom test renders a real client component and asserts on the DOM |
| TEST-03 | test calls an exported route handler with a constructed `NextRequest`, asserts status |
| TEST-04 | repo test does a real INSERT+SELECT round-trip against Postgres; skips with a clear message when `DATABASE_URL` is unset |
| TEST-05 | CI workflow file runs `npm test` on push with a Postgres service |
