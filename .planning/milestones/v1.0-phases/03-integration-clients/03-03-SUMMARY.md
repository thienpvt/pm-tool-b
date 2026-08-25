---
phase: 03-integration-clients
plan: 03
subsystem: integrations
tags: [integrations, anthropic, api-errors, tdd, route-rewire]
depends_on:
  requires: [03-01 (IntegrationError, credential resolver), 03-02 (integrationErrorResponse mapper + client pattern)]
  provides: [lib/integrations/anthropic/client.ts, models.ts, schemas.ts, anthropic status split in lib/api-errors.ts]
  affects: [03-04 (route-rewiring completion + old-path deletion after INTG-08 evidence), 03-05 (Jira client reuses client+mapper pattern)]
tech-stack:
  added: []
  patterns:
    - "SDK-error hierarchy (APIConnectionTimeoutError/AuthenticationError/APIError) mapped to normalized kinds via instanceof on root package exports"
    - "Scan message.content for a text block, not content[0] — extended thinking prepends a ThinkingBlock"
    - "Zod boundary validation of the found text block; missing block -> kind validation, never silent empty report"
    - "One mapper preserving a per-route status split (500 vs 502) via an opts.force500 flag"
key-files:
  created:
    - lib/integrations/anthropic/client.ts
    - lib/integrations/anthropic/client.unit.test.ts
    - lib/integrations/anthropic/models.ts
    - lib/integrations/anthropic/schemas.ts
  modified:
    - lib/api-errors.ts
    - app/api/projects/[id]/report/route.ts
    - app/api/projects/[id]/project-report/route.ts
    - app/api/projects/[id]/project-report/generate-email/route.ts
    - app/api/portfolio/report/route.ts
    - app/api/portfolio/report/generate-email/route.ts
decisions:
  - "Zod validates the FOUND text block (not the whole content array) — a heterogeneous ContentBlock[] like [thinking, text] must pass, so the schema is applied after the .find scan"
  - "SDK maxRetries left at default (2) per orchestrator — documented in a client comment, no per-route note needed"
estimate:
  tokens: 70000
actuals:
  tokens: 6600    # chars/4 over the realized diff (12 files, 286+/89-)
  tasks: 3
  commits: 8
metrics:
  duration_min: 40
  completed: "2026-08-10"
status: complete
---

# Phase [3] Plan [3]: Anthropic Client + 5-Route Rewire Summary

Extracted all five Anthropic call sites into `lib/integrations/anthropic/client.ts` — `createMessage(creds, params)` constructs the SDK once per call with a 120s timeout (HYG-02: adds a timeout where none existed), validates model output at the boundary, and throws normalized `IntegrationError`s. Model IDs moved to named constants (`MODEL_OPUS_4_7`, `MODEL_SONNET_4_6`) with verbatim values; keys now resolve through `resolveAnthropicCredentials()`; the orchestrator-locked 500 (report routes) vs 502 (generate-email routes) status split is preserved in `lib/api-errors.ts` via a `force500` flag. All five routes keep their auth gates, `NO_API_KEY` 503 string, model/max_tokens, prompt construction, Vietnamese SYSTEM_PROMPTs, Subject:line parsing, and response shapes byte-identical. Client unit tests (8) cover happy path, extended-thinking validation (INTG-06/10), text-block scanning, all four error mappings, and the 120s constructor timeout.

## Completed Tasks

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | TDD the Anthropic client | tdd | d0b4f45 (RED), d399ce6 (GREEN) | lib/integrations/anthropic/client.ts, client.unit.test.ts, models.ts, schemas.ts |
| 2 | Extend integrationErrorResponse for the Anthropic status split | auto | 0cecd64 | lib/api-errors.ts |
| 3 | Rewire the five routes | auto | e149db7, b4664ee, ee92fd0, 1156d20, ed342b7 | app/api/projects/[id]/report, project-report, project-report/generate-email, app/api/portfolio/report, portfolio/report/generate-email |

## Verification Evidence

| Check | Result |
|-------|--------|
| `npx vitest run lib/integrations/anthropic` | 8 tests, 8 passed |
| `npm test` (full suite) | 86 suites, 0 failed, 0 passed-assertions regressed; exit 0 (109 DB tests skipped — no TEST_DATABASE_URL) |
| `npx tsc --noEmit` | exit 0 |
| `grep -rn "new Anthropic(\|messages.create" app/` | no output (INTG-02) |
| `grep -rln "next/server\|@/lib/repositories" lib/integrations/anthropic/` | no output (INTG-09) |
| `grep -rn "getSetting('anthropic_api_key')" app/` | no output (inline key resolution fully removed) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod schema on the whole content array rejected mixed Thinking+Text blocks**
- **Found during:** Task 1 GREEN verification (Test 3 failed)
- **Issue:** The plan's schemas.ts (`z.array(textBlock).nonempty()`) validates the ENTIRE `message.content`. When extended thinking prepends a ThinkingBlock, content is `[thinking, text]` and the schema fails — exactly the heterogeneous case the plan's scan-not-index0 rule exists to handle. A standalone zod schema cannot represent the heterogeneous ContentBlock[] union.
- **Fix:** The schema still asserts the text-block shape (per plan must_haves), but the client applies it to the FOUND text block (`content.find(b => b.type === 'text')`) rather than the whole array. Missing block -> validation error directly; found block -> schema double-checks `{type:'text', text:string}` so a malformed text value is still caught at the boundary.
- **Files modified:** lib/integrations/anthropic/client.ts
- **Commit:** d399ce6

**2. [Rule 1 - Build] Test error constructors clash with real SDK types**
- **Found during:** Task 2 tsc after Task 1 (TS2559/TS2554/TS2540)
- **Issue:** `vi.mock` replaces the SDK at runtime, but tsc types the imported error classes as the real SDK classes whose constructors take options objects and whose `status` is readonly — `new APIConnectionTimeoutError('timed out')` and `err.status = 429` fail to typecheck.
- **Fix:** Added a `sdkErr(Ctor, message)` helper in the test that builds errors through a `never`-cast, and `Object.assign(err, { status: 429 })` for the upstream case. Runtime behavior unchanged (mocked classes are plain Error subclasses).
- **Files modified:** lib/integrations/anthropic/client.unit.test.ts
- **Commit:** 0cecd64

### TDD Gate Compliance

- RED gate commit present: `test(03-03): add failing Anthropic client unit tests` (d0b4f45) — failed with `Cannot find module '/lib/integrations/anthropic/client'` before any implementation existed.
- GREEN gate commit present: `feat(03-03): implement Anthropic client with output validation` (d399ce6) — all 8 tests passed after the mixed-content scan fix.
- No `refactor(...)` commit — no post-GREEN cleanup was needed.

## Requirement Coverage

| Requirement | Evidence |
|-------------|----------|
| INTG-02 (all Anthropic calls in lib/integrations/*/client.ts) | grep `new Anthropic(|messages.create` in app/ -> no matches; only createMessage callers remain |
| INTG-04 (timeout + normalized error per client) | SDK timeout 120s at construction; errors normalized to IntegrationError with kinds timeout/auth/upstream/network |
| INTG-06 (output validated at client boundary) | content scanned for text block; missing -> validation error, never silent empty report |
| INTG-10 (mocked-response tests incl. malformed case) | 8 unit tests incl. no-text-block validation and text-block-scanning cases |
| INTG-09 (clients never import a repository / next/server) | grep `next/server\|@/lib/repositories` in lib/integrations/anthropic -> no matches |

## Threat Surface

| Flag | File | Description |
|------|------|-------------|
| none | — | All surface introduced was in the plan's `<threat_model>`: outbound HTTPS with apiKey (T-03-12, output validated at boundary), raw SDK errors kept in `cause` server-side with `e.message ?? 'AI generation failed'` only crossing (T-03-13), 120s client timeout with retries at SDK default (T-03-14), key resolved only through resolver (T-03-15), 5 routes rewired in 5 commits verified by grep+tsc (T-03-16). No new network endpoints, auth paths, file access, or schema changes outside the model. |

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired components. Every route returns real createMessage text; the two report routes and two email routes keep their exact response shapes.

## Self-Check: PASSED

- [x] lib/integrations/anthropic/client.ts exists
- [x] lib/integrations/anthropic/models.ts exports MODEL_OPUS_4_7 / MODEL_SONNET_4_6 with verbatim values
- [x] lib/integrations/anthropic/client.unit.test.ts exists (8 tests pass)
- [x] lib/api-errors.ts integrationErrorResponse handles anthropic with force500; resend arm intact
- [x] grep "new Anthropic(|messages.create" app/ -> no output
- [x] grep "next/server|@/lib/repositories" lib/integrations/anthropic/ -> no output
- [x] Commits present: d0b4f45, d399ce6, 0cecd64, e149db7, b4664ee, ee92fd0, 1156d20, ed342b7
- [x] Full suite 86 suites 0 failed; `npx tsc --noEmit` exit 0

## Execution Notes

- All five route rewires followed the plan's exact per-route values: `projects/[id]/report` opus/1024, `project-report` opus/1200, `project-report/generate-email` sonnet/3000 + SYSTEM_PROMPT, `portfolio/report` opus/2000, `portfolio/generate-email` opus/3500 + SYSTEM_PROMPT.
- The generate-email routes no longer construct the client outside try/catch (`const client = new Anthropic(...)` was previously unguarded) — construction now happens inside `createMessage`, which is called within try, so a construction error (e.g. bad key shape) also maps cleanly.
- Wave 1 (IntegrationError/withFetchTimeout/credentials) and wave 2 (resend client + mapper) untouched; full-suite green confirms no regression.
- `grep getSetting('anthropic_api_key') app/` confirms the inline env-then-DB fallback is fully gone from this plan's routes (deleted in plan 03-04 for the whole tree).
