# Testing Patterns

**Analysis Date:** 2026-08-07

## Test Framework

**Runner:**
- Not detected — no Jest, Vitest, Playwright, Cypress, or Testing Library in `package.json`
- Config: none (`vitest.config.*`, `jest.config.*`, `playwright.config.*` absent)

**Assertion Library:**
- Not applicable

**Run Commands:**
```bash
npm run lint          # ESLint only (eslint-config-next)
npm run build         # next build — compile-time / type check surrogate
# No npm test script
```

## Test File Organization

**Location:**
- No `*.test.ts(x)` / `*.spec.ts(x)` files in repo
- No `__tests__/` or `tests/` directories for automated tests

**Naming:**
- Not established — when adding tests, prefer co-located `*.test.ts` next to pure modules under `lib/`, or `lib/__tests__/` if suite grows

**Structure:**
```
# Current (no automated tests)
lib/           # pure helpers are best first unit targets
app/api/       # route handlers — integration later
components/    # UI — optional RTL later

# Suggested when introducing tests
lib/status-weights.test.ts
lib/auth.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// Not present in codebase. Suggested style for pure lib modules:
import { describe, it, expect } from 'vitest'; // if Vitest adopted
import { statusWeight, weightedProgress, DONE_STATUSES } from '@/lib/status-weights';

describe('statusWeight', () => {
  it('maps Done to 1', () => {
    expect(statusWeight('Done')).toBe(1);
  });

  it('unknown status is 0', () => {
    expect(statusWeight('Nope')).toBe(0);
  });
});
```

**Patterns:**
- Setup pattern: not established
- Teardown pattern: not established
- Assertion pattern: not established
- Current quality gate: TypeScript `strict` + ESLint core-web-vitals + manual UAT

## Mocking

**Framework:** Not detected

**Patterns:**
```typescript
// No project mocks. For future API tests, mock getDb / getSessionFromRequest:
// vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));
// vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
```

**What to Mock:**
- When tests exist: Postgres/`getDb()`, external Jira HTTP, Anthropic RAG (`lib/rag.ts`), cookie/session for route tests

**What NOT to Mock:**
- Pure functions in `lib/status-weights.ts`, password hash format helpers (use real crypto with fixtures), pure date helpers

## Fixtures and Factories

**Test Data:**
```typescript
// No shared factories. Production seed patterns live in API handlers, e.g.
// default meetings/escalations arrays in app/api/projects/route.ts POST
// For tests, build minimal objects matching snake_case DB shapes:
const sampleUser = {
  id: 1,
  username: 'pm',
  display_name: 'PM',
  company_id: 1,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
};
```

**Location:**
- Not applicable today
- Prefer `lib/test-fixtures.ts` or inline fixtures next to first test file when added

## Coverage

**Requirements:** None enforced (no coverage tool or CI test step for unit/e2e)

**View Coverage:**
```bash
# N/A until a runner is added, e.g.:
# npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- None automated
- Highest-value pure targets without I/O: `lib/status-weights.ts` (`statusWeight`, `statusPct`, `weightedProgress`, `DONE_STATUSES`), pure crypto paths in `lib/auth.ts` (`hashPassword`/`verifyPassword` round-trip), export builders under `lib/export/*` if pure enough

**Integration Tests:**
- None automated
- Manual: hit `app/api/**/route.ts` via running `next dev` with real DB
- Auth/session cookie `pm_session` required for protected routes

**E2E Tests:**
- Not used
- No Playwright/Cypress dependency or scripts

## Common Patterns

**Async Testing:**
```typescript
// Not established. Route handlers are async; future tests should await:
// const res = await GET(req as NextRequest);
// expect(res.status).toBe(401);
```

**Error Testing:**
```typescript
// Mirror API contract used in production:
// body: { error: string }, status 400 | 401 | 403 | 500
// Example production shape — app/api/auth/login/route.ts returns 400/401 JSON
```

## Manual / Implicit Verification

- `npm run build` — Next.js compile + typecheck surface
- `npm run lint` — ESLint
- Runtime smoke via deployed or local app (Docker/`Dockerfile`, `k8s.yaml`, Railway `railway.json` present for deploy — not test harnesses)
- Domain correctness often verified through UI (dashboard progress, imports, exports)

## Guidance For Adding Tests Later

1. Start with Vitest (or Jest) on pure `lib/*` — zero DB needed
2. Add one auth round-trip test for `hashPassword`/`verifyPassword` in `lib/auth.ts`
3. Keep route tests behind mocked `getDb` to avoid live Postgres
4. Do not block features on full e2e suite until product prioritizes it
5. Wire `npm test` in `package.json` when first runner lands; optional CI job after

---

*Testing analysis: 2026-08-07*
