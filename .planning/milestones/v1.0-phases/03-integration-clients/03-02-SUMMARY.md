---
phase: 03-integration-clients
plan: 02
subsystem: integrations
tags: [integrations, resend, api-errors, tdd, route-test]
depends_on:
  requires: [03-01 (IntegrationError, withFetchTimeout, credential resolver), Vitest harness]
  provides: [lib/integrations/resend/client.ts, integrationErrorResponse in lib/api-errors.ts, send-email route test convention]
  affects: [03-03 (Jira/Anthropic clients reuse the client + mapper pattern), 03-04 (route rewiring + old-path deletion)]
tech-stack:
  added: []
  patterns:
    - "Named-function client taking already-resolved credentials (INTG-09)"
    - "Client throws IntegrationError; lib/api-errors.ts integrationErrorResponse maps to HTTP — no next/server in lib/integrations"
    - "Route test mocks auth + credential resolver + client; mapper exercised via real IntegrationError rejection"
    - "zod passthrough envelope at boundary; 2xx missing id -> kind validation (never a partial value)"
key-files:
  created:
    - lib/integrations/resend/client.ts
    - lib/integrations/resend/client.unit.test.ts
    - app/api/portfolio/report/send-email/route.test.ts
  modified:
    - lib/api-errors.ts
    - lib/integrations/errors.ts
decisions:
  - "withFetchTimeout gains an optional service label (default 'jira') so non-Jira clients carry the right identity in timeout/network errors"
  - "Resend upstream errors always map to 502 regardless of upstream status (behavior freeze, Pitfall 5) — Task 1's 'status ?? 502' was superseded by Task 3 test + must_haves"
  - "Resend 2xx schema requires id (z.string()) with passthrough — an id-less 200 is a validation error, not a partial messageId (T-03-07)"
estimate:
  tokens: 62000
actuals:
  tokens: 33000
  tasks: 3
  commits: 5
metrics:
  duration_min: 25
  completed: "2026-08-10"
status: complete
---

# Phase [3] Plan [2]: Resend Client + Error Mapper Summary

Extracted the single Resend call into `lib/integrations/resend/client.ts` (15s timeout, normalized `IntegrationError`, zod boundary validation) and extended `lib/api-errors.ts` with the `integrationErrorResponse` mapper — the pattern every later integration (Anthropic, Jira) reuses. The send-email route keeps its auth gate, `NO_RESEND_KEY` 503, `MISSING_FIELDS` 400, the `{ok, messageId}` 200 shape, and the user-visible 502 strings verbatim; the only difference is where the HTTP call happens. Client unit tests (6) and a route-level test (6) prove it end-to-end with mocked fetch and no network or DB.

## Completed Tasks

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Extend lib/api-errors.ts with integrationErrorResponse | auto | 7d24e4d | lib/api-errors.ts |
| 2 | TDD the Resend client | tdd | da7fa6c (RED), 4fdded8 (GREEN) | lib/integrations/resend/client.ts, client.unit.test.ts, lib/integrations/errors.ts |
| 3 | Rewire send-email route to the client and mapper | auto | f20c681 | app/api/portfolio/report/send-email/route.ts, route.test.ts, lib/api-errors.ts |

## Verification Evidence

| Check | Result |
|-------|--------|
| `npx vitest run lib/integrations/resend app/api/portfolio/report/send-email` | 2 files, 12 assertions passed |
| `npm test` (full suite) | 39 files, 198 assertions, 0 failed |
| `npx tsc --noEmit` | exit 0 |
| `grep -rn "api.resend.com\|RESEND_API_KEY" app/` | no fetch, no key read — only UI copy strings referencing the env var name |
| `grep -rln "next/server\|@/lib/repositories" lib/integrations/resend/` | no output (INTG-09) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] withFetchTimeout hardcoded `service: 'jira'` on timeout/network errors**
- **Found during:** Task 2 pre-work (03-01 shipped `withFetchTimeout` without a service parameter)
- **Issue:** The resend client needed timeout/network `IntegrationError`s to carry `service: 'resend'` (the mapper branches on it, and the plan's Test 5/6 assert it). The helper always stamped `'jira'`.
- **Fix:** Added an optional fourth parameter `service = 'jira'` (default preserves all existing jira callers), documented in the helper JSDoc. Resend passes `'resend'`.
- **Files modified:** lib/integrations/errors.ts
- **Commit:** 4fdded8

**2. [Rule 1 - Bug] Resend zod schema could not catch a malformed 2xx response**
- **Found during:** Task 2 GREEN verification (Test 4 failed: promise resolved `undefined` instead of rejecting)
- **Issue:** `z.object({ id: z.string().optional() }).passthrough()` accepts `{unexpected:true}` — an id-less 200 passes validation and returns `undefined`, silently losing the messageId (the exact INTG-10/T-03-07 failure mode).
- **Fix:** `id` is now required (`z.string()`); `.passthrough()` still tolerates unknown upstream fields, so a well-formed `{id, extra}` never 502s. Verification is not weakened — `.passthrough()` was already tested by the happy path asserting an id-only 200.
- **Files modified:** lib/integrations/resend/client.ts
- **Commit:** 4fdded8

**3. [Rule 1 - Contract] Resend upstream maps to 502 always, not `status ?? 502`**
- **Found during:** Task 3 route-test verification (Test asserted 502, mapper returned 400)
- **Issue:** The plan is internally contradictory: Task 1's action says `status from e.status when set else 502`, but Task 3's route test asserts 502 for an upstream 400, must_haves says "resend upstream to 502", Pitfall 5 and success criterion 2 both pin "502 `{error: ...}`". The current route returns 502 for every non-ok Resend response. Behavior freeze (Pitfall 5) is the dominant contract.
- **Fix:** Mapper returns 502 unconditionally for resend `upstream`, with a comment citing Pitfall 5. The `status` field remains on the `IntegrationError` for server-side diagnostics.
- **Files modified:** lib/api-errors.ts
- **Commit:** f20c681

### TDD Gate Compliance

- RED gate commit present: `test(03-02): add failing Resend client unit tests` (da7fa6c) — failed with `Cannot find module '/lib/integrations/resend/client'` before any implementation existed.
- GREEN gate commit present: `feat(03-02): implement Resend client...` (4fdded8) — all 6 tests passed after the schema fix.
- No `refactor(...)` commit — no post-GREEN cleanup was needed.

## Requirement Coverage

| Requirement | Evidence |
|-------------|----------|
| INTG-03 (Jira/Anthropic/Resend calls inside lib/integrations/*/client.ts) | send-email route has no fetch; only `api.resend.com` call is in `lib/integrations/resend/client.ts` (grep verified) |
| INTG-04 (timeout + normalized error per client) | `withFetchTimeout(..., 15_000, undefined, 'resend')`; timeout → kind 'timeout', network → kind 'network'; unit-tested |
| INTG-05 (Resend response zod-validated; mismatch → 502) | `z.object({id: z.string()}).passthrough()` at the boundary; malformed 2xx → kind 'validation' → 502 |
| INTG-06 (output validated at client boundary) | Test 4 + route validation test assert `{error:'Resend API error'}` fixed string, never partial value |
| INTG-10 (each client has mocked-response tests incl. malformed case) | 6 client unit tests incl. malformed-2xx; 6 route tests |
| INTG-09 (clients never import a repository / next/server) | grep `next/server\|@/lib/repositories` in lib/integrations/resend → no matches |

## Threat Surface

| Flag | File | Description |
|------|------|-------------|
| none | — | All surface introduced was in the plan's `<threat_model>`: the outbound HTTPS POST (T-03-07 tampering, zod boundary validation), upstream-body disclosure (T-03-08, only `data.message ?? data.name ?? 'Resend API error'` crosses to the client, `cause` stays server-side), 15s timeout with timer cleared on success (T-03-09), Bearer read only from resolver result (T-03-10), and mocked route/client tests (T-03-11 accepted). No new network endpoints, auth paths, file access, or schema changes outside the model. |

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired components introduced. The route preserves every user-visible string/code and the client returns the real messageId.

## Self-Check: PASSED

- [x] lib/integrations/resend/client.ts exists
- [x] lib/integrations/resend/client.unit.test.ts exists (6 tests pass)
- [x] app/api/portfolio/report/send-email/route.test.ts exists (6 tests pass)
- [x] lib/api-errors.ts exports integrationErrorResponse
- [x] app/api/portfolio/report/send-email/route.ts contains no fetch / api.resend.com call
- [x] Commits present: 7d24e4d, da7fa6c, 4fdded8, f20c681
- [x] `npm test` 198 assertions 0 failed; `npx tsc --noEmit` exit 0

## Execution Notes

- Commit `4fdded8` carries both the GREEN gate and the `withFetchTimeout` service-label fix — the helper lived in the same wave-1 file and was the natural place for it.
- The route now resolves credentials via `resolveResendCredentials()` (precedence unchanged: env-only) and passes `MAIL_FROM` as the client's `from` parameter, exactly as the plan specifies.
- Full-suite run (39 files) was green after plan 03-02 — the wave-1 tests remain unaffected by the `withFetchTimeout` default-arg change.
