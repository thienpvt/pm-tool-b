# Phase 1: Test Harness - Context

**Gathered:** 2026-08-07
**Mode:** Smart discuss (autonomous — recommended options accepted)

<domain>
## Domain

Test infrastructure for an existing Next.js 16 App Router app (React 19, PostgreSQL via `pg`). Zero test coverage today — no runner, no config, no CI test job. This phase installs the harness only; it does not write coverage for existing code beyond one proof test per capability.

Four distinct test shapes must work:
1. Node-environment unit tests (pure functions — e.g. `lib/status-weights.ts`)
2. jsdom component tests (React 19 client components)
3. Route-handler tests (import `app/api/**/route.ts` exports, pass a `NextRequest`, no server)
4. Repository/integration tests against a real Postgres database
</domain>

<decisions>
## Decisions

| Area | Decision | Rationale |
|---|---|---|
| Runner | Vitest (pinned exact version) | Mandated by TEST-01. Native ESM + TS, no Babel step, works with Next 16 + React 19. |
| Config shape | Single `vitest.config.ts` with `projects` (workspace-in-config) | One committed file per TEST-01. Node default env + a jsdom project, instead of two configs or per-file `@vitest-environment` docblocks everywhere. |
| Default environment | `node` | TEST-01 explicit. jsdom only where opted in. |
| Component testing lib | `@testing-library/react` + `@testing-library/jest-dom` + `vitest-dom` matchers via setup file | Standard for React 19; RTL 16+ supports React 19. |
| jsdom opt-in | Path-based: files under `**/*.component.test.tsx` (or `components/**`) run in the jsdom project | Avoids docblock-per-file drift; discoverable by convention. |
| Route-handler tests | Direct import of exported `GET`/`POST` etc., constructing real `NextRequest` from `next/server` | TEST-03 explicit. No `next-test-api-route-handler` dependency — YAGNI. |
| Route-handler DB isolation | `vi.mock('@/lib/db')` in route tests; repository tests own the real DB | Route tests stay fast and hermetic; DB truth is covered by TEST-04 tests. |
| Postgres test DB | Docker Compose service (`docker-compose.test.yml`) on a non-default port, plus documented `npm run test:db:up` | TEST-04 wants a *documented setup command*. Compose is reproducible locally and reusable in CI. No Testcontainers dependency. |
| Schema for test DB | Reuse the app's existing idempotent `CREATE TABLE IF NOT EXISTS` init path from `lib/db.ts` | Schema already lives in code; duplicating it into a `.sql` fixture would guarantee drift. |
| Repo test env var | `DATABASE_URL` pointed at the test DB via `.env.test` loaded by the harness | Matches how `lib/db.ts` already resolves its connection. |
| Repo test opt-in | Files matching `**/*.db.test.ts`, skipped with a clear message when the test DB is unreachable | `npm test` must not hard-fail on a machine with no Docker running; CI always has it. |
| CI | New `.github/workflows/test.yml` — `npm ci` → `npm test`, with a `postgres` service container | TEST-05. Kept separate from `docker-build.yml` so a test failure is legible and doesn't entangle image publishing. |
| CI trigger | `push` (all branches) + `pull_request` to master | TEST-05 says "on push"; PR runs come nearly free and gate merges. |
| Coverage reporting | Not configured this phase | Not in TEST-01..05. Add when a coverage threshold is actually wanted. |
| E2E (Playwright) | Out of scope | No requirement asks for it. |
</decisions>

<specifications>
## Specifications

**`npm test`** runs the full Vitest suite once (CI mode, non-watch). `npm run test:watch` for the interactive loop.

**Scripts added to `package.json`:**
- `test` — `vitest run`
- `test:watch` — `vitest`
- `test:db:up` / `test:db:down` — Compose lifecycle for the Postgres test DB

**Proof tests delivered (one per success criterion):**
| Criterion | Proof test |
|---|---|
| 1 — Node suite runs | a unit test on an existing pure module (`lib/status-weights.ts`) |
| 2 — jsdom component | renders one existing client component, asserts on rendered DOM |
| 3 — route handler | constructs `NextRequest`, calls an exported handler, asserts on the `Response` |
| 4 — repository/Postgres | connects to the test DB, initializes schema, round-trips one row |
| 5 — CI gate | `test.yml` runs `npm test`; a deliberately broken test must fail the job |

**Documentation:** README gains a short "Testing" section — how to run tests, how to start the test DB, what each test file suffix means.

**Constraint:** no changes to application behavior in this phase. Touching `lib/db.ts` is allowed only if the existing schema-init path cannot be reused from a test without an export; in that case the smallest possible export is added, no logic change.
</specifications>

<constraints>
## Constraints

- Next.js `16.2.4`, React `19.2.4`, Node types `^20` — pick Vitest/RTL versions compatible with this exact set.
- `lib/db.ts` requires `DATABASE_URL` at `getDb()` time and seeds auth data on connect; test DB setup must tolerate that seeding.
- `lib/db.ts` translates `?` placeholders to `$n` and rewrites `INSERT OR IGNORE` — repository tests exercise the real client, not a mock, so this translation is covered implicitly.
- Path alias `@/*` from `tsconfig.json` must resolve in tests (Vitest needs the alias configured or `vite-tsconfig-paths`).
- Dependencies pinned to exact versions, per project convention on new additions.
- Existing `docker-build.yml` must not be modified.
</constraints>

<deferred>
## Deferred Ideas

- Coverage thresholds and reporting — revisit once repository/service layers exist (Phases 2-4) and there is something meaningful to threshold.
- Playwright/E2E smoke suite — candidate for a later milestone.
- Fixture/factory helpers for test data — add when repetition in Phase 2+ tests justifies it.
</deferred>
