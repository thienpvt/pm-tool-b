---
phase: 03-integration-clients
verified: 2026-08-10T19:40:00Z
status: passed
score: 5/5 must-haves verified
human_resolution:
  resolved: 2026-08-10
  method: "User reviewed both open items and accepted them explicitly. Neither is a failing criterion — the phase verified 5/5 with zero gaps."
  accepted:
    - "INTG-08 cutover + HYG-01 deletion: deferred operator task. No reachable DATABASE_URL in this environment, so scripts/verify-credential-cutover.ts could not gather per-tenant evidence. Old inline Jira credential blocks remain as marked, unreachable dead code pending a gated deletion commit."
    - "HYG-02 status change: a malformed Anthropic response on the three report routes now returns 502 instead of 500. This was the user's explicit decision — validation is an error kind this phase introduced, so it has no pre-phase behavior to freeze; the locked 500/502 split still governs upstream/timeout/network/auth."
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Jira responses are validated against a Zod schema and Anthropic output is validated at the client boundary before any caller consumes it; a shape mismatch logs a validation error instead of producing a silent wrong value or a 500 (SC3 / INTG-05 / INTG-06)"
    - "One credential resolver serves all integrations, replacing the Jira env-var-names-in-DB / Anthropic env-then-DB split (SC4 / INTG-07)"
  gaps_remaining: []
  regressions: []
  fix_commit: 03c2beb
deferred:
  - truth: "Every currently-working tenant configuration is verified against the resolver before the old paths are deleted (SC4 second clause / INTG-08 / HYG-01)"
    addressed_in: "Deferred operator task (HYG-01 deletion commit), explicitly accepted by the user"
    evidence: "No reachable DATABASE_URL, so scripts/verify-credential-cutover.ts cannot gather per-tenant evidence. The old inline blocks in app/api/jira/search/route.ts (getJiraCredentials, line 13) and app/api/jira/fields/route.ts (oldInlineCredentialBlock, line 34) remain preserved as MARKED, UNREACHABLE dead code so the deletion lands as its own gated commit. Verified still unreachable after the fix commit: both routes call resolveJiraCredentials on the live path. Not treated as a phase-blocking failure per explicit user acceptance."
human_verification:
  - test: "With DATABASE_URL pointed at the real production DB, run `npx tsx scripts/verify-credential-cutover.ts`, then land the HYG-01 deletion commit removing getJiraCredentials from app/api/jira/search/route.ts and oldInlineCredentialBlock from app/api/jira/fields/route.ts."
    expected: "Every configured company reports match: yes, proving the resolver returns byte-identical credentials to the old inline blocks for every live tenant. Then the two dead blocks delete cleanly with no behavior change."
    why_human: "Requires DB connectivity and real tenant data that do not exist in this environment. Operator task, explicitly accepted as deferred."
  - test: "Confirm the deliberate HYG-02 behavior change is acceptable to operators: a malformed Anthropic response on the three report routes (projects/[id]/report, projects/[id]/project-report, portfolio/report) now returns 502 where it would previously have returned 500."
    expected: "No client, dashboard, or alerting rule keys off a 500 specifically for these three routes on a malformed-model-output path."
    why_human: "A deliberate, user-approved status change on live endpoints. Only an operator can confirm nothing downstream depends on the old status."
---

# Phase 3: Integration Clients Verification Report

**Phase Goal:** All external calls (Jira, Anthropic, Resend) go through one dedicated client module each, with a timeout, a normalized error type, and boundary validation — replacing ad hoc fetch/SDK calls and the two divergent credential-lookup patterns.
**Verified:** 2026-08-10T19:40:00Z (re-verification)
**Status:** human_needed
**Re-verification:** Yes — after gap closure in commit `03c2beb`

## Executive Summary

Both gaps from the initial verification are genuinely closed. Re-verified independently rather than on the fix report's word: the resolver call now exists in the Jira test route, the three validation branches now log, the force500 escape is implemented with a matching test, `tsc --noEmit` is exit 0, eslint on both changed files is exit 0, and the full suite is **124 passed / 0 failed / 109 skipped (233 total)** — up exactly the 5 tests the new `lib/api-errors.test.ts` adds, with no regressions.

All five ROADMAP success criteria are now met. The status is `human_needed` rather than `passed` solely because two items require an operator: the accepted INTG-08 cutover deferral (unchanged) and confirmation of the deliberate HYG-02 status change introduced by the fix.

**Changed since the last report:** SC3 and SC4 move ✗ FAILED → ✓ VERIFIED. Score 3/5 → 5/5. INTG-05/06/07 now genuinely hold in `.planning/REQUIREMENTS.md`; INTG-08's `[x] Complete` was corrected to deferred (see Requirements Coverage).

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | All Jira/Anthropic/Resend calls happen only inside their respective `lib/integrations/*/client.ts` — zero direct calls from any route | ✓ VERIFIED | Regression re-check: grep for `atlassian.net`, `api.resend.com`, `api.anthropic.com`, `new Anthropic`, `messages.create`, `@anthropic-ai/sdk` still returns **zero production route hits**. Remaining hits are client implementations, test fixtures, and two `app/admin/page.tsx` help strings. |
| 2 | Each client applies an explicit request timeout and returns a normalized error type rather than a raw SDK or fetch throw | ✓ VERIFIED | Unchanged and re-confirmed: `withFetchTimeout(..., 15_000, ...)` on all three Jira fetches and the Resend fetch; `new Anthropic({ timeout: 120_000 })`; `mapAnthropicError` normalizes all four SDK error classes. All timeout/abort/cleanup tests still pass. |
| 3 | Jira responses Zod-validated and Anthropic output validated at the client boundary; a shape mismatch **logs a validation error** instead of a silent wrong value **or a 500** | ✓ VERIFIED | **Gap closed.** Validation was already complete. Logging now exists at `lib/api-errors.ts:59` (jira), `:85` (resend), `:102` (anthropic) — `console.error('Integration response failed validation', { service, cause })`, so the zod detail that was previously captured into `e.cause` and discarded is now emitted server-side. The no-500 clause now holds on every route: lines 101-104 return 502 for `kind:'validation'` **before** the `force500` branch at 106, so the three report routes no longer 500 on a shape mismatch. Behaviorally proven by 5 new tests in `lib/api-errors.test.ts`, including one asserting `force500: true` + validation → 502 and one asserting force500 still yields 500 for non-validation kinds. |
| 4 | One credential resolver serves all integrations, replacing the Jira/Anthropic split, and every tenant config is verified before old paths are deleted | ✓ VERIFIED | **Gap closed.** `app/api/jira/test/route.ts:58` now calls `resolveJiraCredentials(null, cfg)`, passing the `explicit` var names `resolveCfg` settled on — which finally gives that tested-but-unreachable parameter a production caller. `grep "resolveJiraCredentials("` returns **3** production call sites (search:39, fields:18, test:58), up from 2. The unused-import eslint finding is gone; eslint on the file is exit 0. The 503 diagnostic is preserved by recomputing `missing` from the names against `process.env` (lines 63-67) — a name-level presence check for the operator message, not credential resolution; the credential **values** come only from the resolver, and `baseUrl` in the success response now reads `creds.baseUrl` (line 82). All 8 test-route tests still pass, including the missing-var diagnostic and the admin body-supplied-var-names path. Second clause (tenant verification before deletion) → see Deferred. |
| 5 | Each integration client has tests using recorded/mocked responses including a malformed-response case, and imports no repository directly | ✓ VERIFIED | 51 integration-related tests now pass (46 client tests + 5 new mapper tests). Malformed cases present per service, unchanged. Repository isolation re-checked: `grep "from '@/lib/repositories\|from 'next/server'" lib/integrations/` excluding `credentials.ts` still returns **zero** — the fix touched `lib/api-errors.ts`, which is deliberately outside `lib/integrations/` precisely so clients stay `next/server`-free. |

**Score:** 5/5 truths verified (0 present, behavior-unverified) — was 3/5

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | Per-tenant credential-cutover evidence and deletion of the two old inline Jira blocks (SC4 clause 2 / INTG-08 / HYG-01) | Deferred operator task, explicitly accepted by the user | Unchanged by the fix commit. No reachable DATABASE_URL. Blocks still preserved as marked, unreachable dead code (`getJiraCredentials` search/route.ts:13, `oldInlineCredentialBlock` fields/route.ts:34); both routes call the resolver on the live path. Script not run and no code deleted, per instruction. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `lib/integrations/errors.ts` | IntegrationError + withFetchTimeout | ✓ VERIFIED | Unchanged. 5-kind union, lazy signal factory, timer cleared in `finally`. 6 passing tests. |
| `lib/integrations/credentials.ts` | Three resolvers | ✓ VERIFIED | Unchanged code, but the `explicit` parameter now has a production caller. 10 passing tests. |
| `lib/integrations/jira/client.ts` | searchIssues/listFields/testConnection | ✓ VERIFIED | Unchanged. 15s timeout + zod validation on each. |
| `lib/integrations/jira/schemas.ts` | Zod schemas | ✓ VERIFIED | Unchanged. 3 schemas, `.passthrough()` throughout. |
| `lib/integrations/anthropic/client.ts` | createMessage | ✓ VERIFIED | Unchanged. 120s timeout, content scanned for text block. |
| `lib/integrations/anthropic/models.ts` | Model constants | ✓ VERIFIED | Unchanged. Exact frozen values. |
| `lib/integrations/anthropic/schemas.ts` | Output schema | ✓ VERIFIED | Unchanged. |
| `lib/integrations/resend/client.ts` | sendEmail | ✓ VERIFIED | Unchanged. |
| `lib/api-errors.ts` | integrationErrorResponse | ✓ VERIFIED | **Upgraded from ⚠️ PARTIAL.** Validation logging added to all three service arms; `kind:'validation'` now short-circuits before force500 with the rationale recorded in a code comment (lines 95-100). `e.cause` still never serialized into a response body — asserted by test. |
| `lib/api-errors.test.ts` | Mapper tests | ✓ NEW, VERIFIED | 5 tests, all passing. Covers per-service log + 502 + no-schema-leak, the force500 validation escape, and force500 still governing non-validation kinds. Uses `vi.spyOn(console,'error')` with `restoreAllMocks` in `afterEach` — the log assertion is real, not a presence check. |
| `scripts/verify-credential-cutover.ts` | Read-only cutover script | ⚠️ PRESENT, UNRUN | Unchanged. Cannot execute without DATABASE_URL — deferred, not run per instruction. |
| 5 Anthropic routes | Rewired | ✓ VERIFIED | Unchanged wiring; the three force500 routes now get 502 on validation via the mapper, not via a route edit. |
| 3 Jira routes | Rewired | ✓ VERIFIED | **Upgraded from ⚠️ PARTIAL.** All three now resolve through `resolveJiraCredentials`. |
| `app/api/portfolio/report/send-email/route.ts` | Rewired | ✓ VERIFIED | Unchanged. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| 11 route files | `lib/integrations/*` | import + call | ✓ WIRED | Unchanged. |
| jira/search route | resolveJiraCredentials | line 39 | ✓ WIRED | Live path; old block dead. |
| jira/fields route | resolveJiraCredentials | line 18 | ✓ WIRED | Live path; old block dead. |
| jira/test route | resolveJiraCredentials | `resolveJiraCredentials(null, cfg)` line 58 | ✓ WIRED | **Was NOT_WIRED.** Import now has a call site; eslint exit 0. |
| All 5 Anthropic routes | resolveAnthropicCredentials | direct call | ✓ WIRED | Unchanged. |
| send-email route | resolveResendCredentials + sendEmail | direct call | ✓ WIRED | Unchanged. |
| Clients | integrationErrorResponse | throw → route catch → mapper | ✓ WIRED | Unchanged. |
| Validation throw | log sink | `console.error` in all 3 mapper validation branches | ✓ WIRED | **Was NOT_WIRED.** `e.cause` now reaches a consumer. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `jira/client.ts` searchIssues | issues/total/nextPageToken | live fetch → zod → route → client | Yes | ✓ FLOWING |
| `jira/client.ts` listFields | custom fields | live fetch → filter → map → sort | Yes | ✓ FLOWING |
| `anthropic/client.ts` | `{text}` | SDK → scan for text block → zod | Yes | ✓ FLOWING |
| `resend/client.ts` | message id | live fetch → zod `id` | Yes | ✓ FLOWING |
| `credentials.ts` | credential values | repos + `process.env`; now feeds all 3 Jira routes | Yes | ✓ FLOWING |
| validation `e.cause` | zod error detail | attached at throw → **read by the mapper's console.error** | Yes | ✓ FLOWING (was ✗ DISCONNECTED) |
| jira/test success `baseUrl` | resolved base URL | `creds.baseUrl` from the resolver (was an inline env read) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Type safety | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Full test suite | `node node_modules/vitest/vitest.mjs run --reporter=json` | `numTotalTests 233`, **passed 124, failed 0, pending 109**, `success true` | ✓ PASS |
| No regression from the fix | compare to prior run | 119 → 124 passing (+5 = exactly the new `api-errors.test.ts`), 109 skipped unchanged, 0 failed | ✓ PASS |
| Validation logging (SC3) — was FAIL | inspect + new tests | 3 `console.error('Integration response failed validation', ...)` sites; test asserts `toHaveBeenCalledOnce()` and `mock.calls[0][1]` matches `{service}` | ✓ PASS |
| Schema detail never leaks | `lib/api-errors.test.ts` | `expect(JSON.stringify(body)).not.toContain('expected string, got number')` for all 3 services | ✓ PASS |
| Anthropic validation escapes force500 | `lib/api-errors.test.ts` | `integrationErrorResponse(validationError('anthropic'), {force500:true}).status === 502` | ✓ PASS |
| force500 still governs frozen kinds | `lib/api-errors.test.ts` | upstream + force500 → 500; upstream alone → 502 | ✓ PASS |
| Resolver is the single credential path (SC4) — was FAIL | `grep "resolveJiraCredentials("` | 3 production call sites (was 2); zero inline credential-value reads remain on any live path | ✓ PASS |
| Test-route behavior preserved | 8 tests in `jira/test/route.test.ts` | all pass, incl. missing-var diagnostic, admin body-supplied var names, WR-04 upstream echo, network prefix | ✓ PASS |
| Lint on changed files | `npx eslint app/api/jira/test/route.ts lib/api-errors.ts lib/api-errors.test.ts` | exit 0, no output | ✓ PASS |
| Boundary grep (SC1) regression | grep all 3 services | zero production hits outside `lib/integrations/` | ✓ PASS |
| Repository isolation (INTG-09) regression | grep repo/next-server imports | zero hits outside `credentials.ts` | ✓ PASS |
| Cutover script | `npx tsx scripts/verify-credential-cutover.ts` | not run — no DATABASE_URL, and instructed not to | ? SKIP (deferred, accepted) |

Note on method: the vitest default reporter is mangled by an RTK shell hook in this environment, so the suite was run with `--reporter=json --outputFile` and the JSON parsed directly for counts and per-test titles. The temp file was deleted after reading.

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist and no PLAN declares a probe. SKIPPED (no probes declared or discoverable).

### Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| INTG-01 | ✓ SATISFIED | Zero `atlassian.net` fetch in routes |
| INTG-02 | ✓ SATISFIED | Zero `new Anthropic`/`messages.create` in routes |
| INTG-03 | ✓ SATISFIED | Only `api.resend.com` fetch is client.ts:27 |
| INTG-04 | ✓ SATISFIED | 15s/15s/120s + IntegrationError, behaviorally tested |
| INTG-05 | ✓ SATISFIED | **Was BLOCKED.** Zod validation + logged validation error + 502 (never 500) |
| INTG-06 | ✓ SATISFIED | **Was PARTIAL.** Boundary validation + validation escapes force500 on all 5 routes |
| INTG-07 | ✓ SATISFIED | **Was BLOCKED.** All 3 Jira routes + all 5 Anthropic routes + send-email resolve through the shared resolver; no inline credential resolution on any live path |
| INTG-08 | ? DEFERRED | Script exists and is unrunnable here; old blocks preserved as dead code. User-accepted operator task. |
| INTG-09 | ✓ SATISFIED | Zero repo imports outside `credentials.ts` |
| INTG-10 | ✓ SATISFIED | 51 tests, malformed case per service |

**`.planning/REQUIREMENTS.md` corrected during this re-verification.** The previous report flagged that INTG-05/06/07 were marked `[x] Complete` without code support — those three now genuinely hold, so their checkboxes are accurate and were left as-is. INTG-08 was still marked `[x] Complete` while its defining clause ("verified per configured company **before** the old paths are deleted") has not happened; it was changed to `[ ]` with an inline DEFERRED note, and its traceability row changed from `Complete` to `Deferred — cutover evidence needs a live DATABASE_URL (HYG-01 deletion commit outstanding)`. No other requirement rows were touched.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `app/api/jira/search/route.ts` | 13 | `getJiraCredentials` unused | ℹ️ Info | Intentional marked dead code, accepted deferral |
| `app/api/jira/fields/route.ts` | 34 | `oldInlineCredentialBlock` unused | ℹ️ Info | Intentional marked dead code, accepted deferral |

Both blockers from the previous report are resolved: the `resolveJiraCredentials` unused import is gone, and the validation branches now log. The `lib/integrations/anthropic/client.unit.test.ts:42` `Unexpected any` eslint error reported previously is **not** in the changed-file lint scope; it remains a minor pre-existing lint error in a test file and does not affect any success criterion.

Debt markers (`TODO`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER`) across all phase-3 files: **none**. The HYG-01 follow-ups are full explanatory comments referencing the gating script.

### Human Verification Required

**1. Run the INTG-08 cutover script and land the HYG-01 deletion** *(unchanged from the previous report)*

**Test:** With `DATABASE_URL` pointed at the real production DB, run `npx tsx scripts/verify-credential-cutover.ts`, then delete `getJiraCredentials` from `app/api/jira/search/route.ts` and `oldInlineCredentialBlock` from `app/api/jira/fields/route.ts` in a dedicated commit.
**Expected:** Every configured company reports `match: yes`. The two dead blocks then delete with no behavior change.
**Why human:** Requires DB connectivity and real tenant data unavailable here. Explicitly accepted as a deferred operator task.

**2. Confirm the deliberate HYG-02 status change is safe downstream** *(new — introduced by the fix)*

**Test:** Verify no client code, dashboard, or alerting rule keys off a 500 specifically from `projects/[id]/report`, `projects/[id]/project-report`, or `portfolio/report` on a malformed-model-output path.
**Expected:** Nothing downstream depends on the old 500 for that path; the new 502 is absorbed cleanly.
**Why human:** A deliberate, user-approved behavior change on live endpoints. The rationale is sound and recorded in-code (validation is a kind this phase introduced, so it has no pre-phase behavior to freeze, and the locked split still governs upstream/timeout/network/auth) — but only an operator can confirm no consumer depends on the old status.

### Gaps Summary

No gaps remain. Both previously-failing criteria were fixed narrowly and correctly, and I verified them against the code and a fresh test run rather than against the fix report.

**SC3** is closed on both of its clauses. The zod error that was previously packaged into `IntegrationError.cause` and then dropped now reaches `console.error` in all three service arms of the mapper, so an upstream shape change is diagnosable server-side — and the accompanying test asserts the log actually fired and that the schema text never appears in the response body, so this is a real behavioral guarantee rather than a line of code that happens to exist. The force500 collision I escalated was resolved by user decision in the direction that satisfies the criterion: `kind:'validation'` short-circuits to 502 before the force500 branch, so no route can 500 on a shape mismatch. The reasoning recorded in the code comment holds up — validation is an error kind this phase introduced, so there is no pre-phase behavior to freeze — and the frozen 500/502 split still governs every kind that existed before. That is a deliberate behavior change, correctly flagged HYG-02, and it is the one thing worth an operator's eyes.

**SC4** is closed. The Jira test route's inline `process.env` reads are gone; credentials now come from `resolveJiraCredentials(null, cfg)`, which finally exercises the `explicit` parameter that had a passing unit test but no production caller. The route's operator diagnostic survived intact by recomputing the missing-name list from `cfg` against `process.env` — worth being precise about, since that still reads `process.env`: it is a name-level *presence* check feeding the `Biến môi trường chưa được set trên Railway` message, not credential resolution, and no credential value flows from it. All 8 test-route tests still pass, including the diagnostic and the admin body-supplied-var-names path.

The phase goal is achieved. The only outstanding work is the INTG-08 cutover, which was gated on evidence this environment cannot produce and was explicitly accepted as an operator task from the start.

---

_Verified: 2026-08-10T19:40:00Z (re-verification of commit `03c2beb`)_
_Verifier: Claude (gsd-verifier)_
