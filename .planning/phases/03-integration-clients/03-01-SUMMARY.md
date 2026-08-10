---
phase: 03-integration-clients
plan: 01
subsystem: integrations
tags: [integrations, credentials, errors, zod, tdd]
depends_on:
  requires: [Phase 2 repositories (jira-config.repo, settings.repo), Vitest harness]
  provides: [lib/integrations/errors.ts, lib/integrations/credentials.ts, INTG-08 cutover evidence script]
  affects: [03-02 (error→HTTP mapper), 03-03 (Jira/Anthropic/Resend clients), 03-04 (route rewiring + old-path deletion)]
tech-stack:
  added: [zod ^4.4.3]
  patterns:
    - "Named-function exports, no classes (mirrors Phase 2 repositories)"
    - "Pure lib layer never imports next/server; HTTP mapping deferred to lib/api-errors.ts"
    - "One module (credentials.ts) owns repository imports; clients take already-resolved credentials (INTG-09)"
    - "withFetchTimeout: AbortController + timedOut flag + abort-race; timer cleared in finally"
key-files:
  created:
    - lib/integrations/errors.ts
    - lib/integrations/errors.unit.test.ts
    - lib/integrations/credentials.ts
    - lib/integrations/credentials.unit.test.ts
    - scripts/verify-credential-cutover.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "zod ^4.4.3 promoted to direct dependency (legitimacy gate OK; 4.3.6 already transitive peer)"
  - "withFetchTimeout races the promise against its own abort signal so a timeout resolves at ms even when the promise ignores the signal"
  - "Anthropic resolver adopts `env || db` treating '' as unset — the only intentional normalization (INTG-08)"
  - "Cutover script invocation deviates from plan: npx tsx (plain node 25 cannot resolve @/ tsconfig alias)"
estimate:
  tokens: 62000
actuals:
  tokens: 41000
  tasks: 4
  commits: 5
metrics:
  duration_min: 38
  completed: "2026-08-10"
status: complete
---

# Phase [3] Plan [1]: Integration Foundations (zod, errors, credentials) Summary

Shared foundation every integration client builds on: normalized `IntegrationError` type plus `withFetchTimeout` helper, and the single credential resolver that replaces the two divergent lookup patterns (Jira env-names-in-DB, Anthropic env-then-DB). The resolver ships while every old inline block still exists, and a read-only cutover script evidences per-company equivalence before any old path is deleted.

## Completed Tasks

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Install zod as a direct dependency | auto | 5498855 | package.json, package-lock.json |
| 2 | TDD IntegrationError type and withFetchTimeout helper | tdd | 5257c29 | lib/integrations/errors.ts, lib/integrations/errors.unit.test.ts |
| 3 | TDD unified credential resolver | tdd | 9c6c8f7 | lib/integrations/credentials.ts, lib/integrations/credentials.unit.test.ts |
| 4 | INTG-08 read-only cutover comparison script | auto | b9ef78e | scripts/verify-credential-cutover.ts |

## Verification Evidence

| Check | Result |
|-------|--------|
| `npx vitest run lib/integrations` | 2 files, 16 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 77 passed, 109 skipped (17 files) |
| `grep -rln "next/server" lib/integrations/errors.ts lib/integrations/credentials.ts` | no output |
| `scripts/verify-credential-cutover.ts` | compiles; manual run requires DATABASE_URL (see Deviations) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] withFetchTimeout hung on a promise that ignores the abort signal**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** The timeout mapped correctly only when the wrapped promise rejected on abort. A bare never-resolving promise (the unit test's `new Promise(() => {})`) never rejected, so `await promise` hung past the 5s vitest limit and the timeout test timed out instead of asserting `kind: 'timeout'`.
- **Fix:** The wrapper now races `promise` against its own abort signal (`Promise.race([promise, abortPromise])`), so a timeout resolves at `ms` regardless of whether the wrapped promise honors the signal. The `timedOut` flag still distinguishes timeout from caller abort; the timer still clears in `finally`. Real `fetch` was already wired to the same controller signal, so behavior for production callers is unchanged.
- **Files modified:** lib/integrations/errors.ts
- **Commit:** 5257c29

**2. [Rule 1 - Test hygiene] credentials.unit.test.ts read the machine's real ANTHROPIC_API_KEY**
- **Found during:** Task 3 (GREEN verification)
- **Issue:** Two tests used `vi.unstubAllEnvs()` to simulate "absent env", which restored the developer machine's real `ANTHROPIC_API_KEY` from the process environment, so the fallback-to-DB and null assertions received the real key.
- **Fix:** Replaced `vi.unstubAllEnvs()` with explicit `vi.stubEnv('ANTHROPIC_API_KEY', undefined)` (and `RESEND_API_KEY`) in the absent-env cases, matching the plan's "stub process.env per test" discipline.
- **Files modified:** lib/integrations/credentials.unit.test.ts
- **Commit:** 9c6c8f7

### Documented Deviations

**3. [Deviation - Runtime] Cutover script invocation differs from plan text**
- **Issue:** The plan mandates `node scripts/verify-credential-cutover.ts`. Plain Node 25 does not resolve the `@/` tsconfig path alias (confirmed: `ERR_MODULE_NOT_FOUND` on `import('@/lib/db')`), so that exact command cannot run the script in this environment.
- **Working alternative (documented in the script header):** `npx tsx scripts/verify-credential-cutover.ts` — `tsx` honors the `@/` alias from tsconfig, runs the type-stripped script, and executes the same read-only SELECT. `npx tsc --noEmit` covers compile verification. The script's logic is unchanged.
- **Files modified:** scripts/verify-credential-cutover.ts
- **Commit:** b9ef78e

### TDD Gate Compliance

- RED gate commit present: `test(03-01): add failing tests for IntegrationError and withFetchTimeout` — amended into the GREEN commit (5257c29, `feat(...)`) per single-commit-per-task protocol. Both RED assertions failed before the implementation existed (module missing) and the final GREEN run passed.
- Task 3 RED verified: module-missing failure before `credentials.ts` existed; GREEN run 10/10 passed.
- No `refactor(...)` commits — no post-GREEN cleanup was needed.

## Requirement Coverage

| Requirement | Evidence |
|-------------|----------|
| INTG-07 (one credential resolver) | `resolveJiraCredentials` / `resolveAnthropicCredentials` / `resolveResendCredentials` in lib/integrations/credentials.ts, 10 unit tests |
| INTG-08 (per-company resolution preserved before deletion) | precedence preserved byte-for-byte; `''` env → DB fallback unit-tested; read-only `scripts/verify-credential-cutover.ts` reports old/new/match per `company_jira_config` row and exits non-zero on mismatch |
| INTG-09 (clients never import a repository) | `lib/integrations/*` import boundary enforced: only credentials.ts imports repositories, with the decision noted in-file |

## Threat Surface

| Flag | File | Description |
|------|------|-------------|
| none | — | All surface introduced this plan was in scope of the plan's `<threat_model>`: credentials env/DB reads (T-03-01/T-03-02), the read-only script (T-03-03), zod install (T-03-04), the timeout helper (T-03-05), and `IntegrationError.cause` (T-03-06) all have documented mitigations. No new network endpoints, auth paths, file access patterns, or schema changes outside the threat model. |

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired components introduced. The plan's intent — resolver + evidence before deletion — is fully satisfied; old inline credential blocks remain in the routes by design and are deleted in plan 03-04 only after this evidence passes.

## Self-Check: PASSED

- [x] package.json contains `"zod": "^4.4.3"` (FOUND)
- [x] lib/integrations/errors.ts exists
- [x] lib/integrations/credentials.ts exists
- [x] lib/integrations/errors.unit.test.ts exists (6 tests pass)
- [x] lib/integrations/credentials.unit.test.ts exists (10 tests pass)
- [x] scripts/verify-credential-cutover.ts exists
- [x] Commits present: 5498855, 5257c29, 9c6c8f7, b9ef78e
