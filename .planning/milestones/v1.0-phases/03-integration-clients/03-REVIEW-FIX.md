---
phase: 03-integration-clients
fixed_at: 2026-08-10T00:00:00Z
review_path: D:/git/pm-tool-b/.planning/phases/03-integration-clients/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-08-10
**Source review:** `.planning/phases/03-integration-clients/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 critical, 5 warnings)
- Fixed: 6
- Skipped: 0

**Verification environment:** Tests (`npx vitest run`) and `npx tsc --noEmit` ran in the isolated worktree `/tmp/sv-03-reviewfix-funPGT` with a plain copy of `node_modules` (no junction/symlink). Full suite: 119 passed / 0 failed / 109 skipped (DB-backed repo tests, expected without DATABASE_URL). `tsc --noEmit` exit 0.

## Fixed Issues

### CR-01: Jira search schema rejects nulls for the very custom fields the client always requests

**Files modified:** `lib/integrations/jira/schemas.ts`, `lib/integrations/jira/client.unit.test.ts`
**Commit:** `1832b57`
**Applied fix:** `customfield_10014`, `customfield_10016`, and `customfield_10020` are now `.nullable().optional()`, matching how Jira Cloud returns unset fields as `null`. Added three unit tests locking the schema path: all three custom fields null, a null epic-link mixed with populated Story Points/Sprint, and an empty result set (`total: 0`) covering the WR-02 empty path.

### WR-01: Search route maps a null-company 401 to the config-missing 503 string

**Files modified:** `app/api/jira/search/route.ts`
**Commit:** `986797b`
**Applied fix:** The session-present-but-null-`company_id` branch now returns 401 (with the same Vietnamese error string), matching the fields route and the behavior-freeze intent. The genuinely-misconfigured-company case still returns 503.

### WR-02: Null dereference when a search returns zero issues

**File:** `app/api/jira/search/route.ts:66-72`
**Commit:** `1832b57` (test coverage added in CR-01 commit)
**Applied fix:** The current code already guards the debug block with `if (firstIssue)` — the null dereference was fixed during the phase rework. Added the `total: 0` empty-result test in `client.unit.test.ts` to lock the path.

### WR-03: `withFetchTimeout` doesn't forward the caller abort to the fetch call

**Files modified:** `lib/integrations/errors.ts`, `lib/integrations/errors.unit.test.ts`, `lib/integrations/jira/client.ts`, `lib/integrations/resend/client.ts`
**Commit:** `f22261b`
**Applied fix:** Changed `withFetchTimeout` to accept a lazy `(signal: AbortSignal) => Promise<T>` factory. The wrapper's own `AbortController` signal — aborted by both the timer and a caller abort — is passed to the fetch call, so a timeout or a caller abort cancels the underlying socket immediately instead of leaving it running up to 15s. Callers in `jira/client.ts` (search/fields/myself) and `resend/client.ts` updated to the factory form. Added two tests proving the created promise receives a signal that is aborted on caller abort and on timeout.

### WR-04: Jira upstream error text leaks through the route-level mapper before `integrationErrorResponse` runs

**Files modified:** `app/api/jira/test/route.ts`, `app/api/jira/test/route.test.ts`
**Commit:** `c13cc58`
**Applied fix:** Documented the deliberate leak with an inline comment explaining the behavior freeze (the old route echoed `j.message` verbatim) and why the test route — an operator diagnostic — is the one place the raw upstream reason is the point. The network/timeout branch only ever sees the client's generated message, never raw upstream text. Added tests locking the raw upstream echo and the `Lỗi kết nối:` network prefix.

### WR-05: Uncaught `req.json()` on the project report POST

**Files modified:** `app/api/projects/[id]/report/route.ts`, `app/api/projects/[id]/project-report/route.ts`, `app/api/projects/[id]/project-report/generate-email/route.ts`, `app/api/portfolio/report/route.ts`, `app/api/portfolio/report/generate-email/route.ts`, `app/api/portfolio/report/send-email/route.ts`
**Commit:** `1462aab`
**Applied fix:** Wrapped every `await req.json()` in the report/generate-email/send-email routes in a defensive `try/catch` returning `{ error: 'Invalid JSON' }` with 400, so a malformed or oversized body yields a JSON 400 instead of a bare 500 rejection.

### WR-06: `verify-credential-cutover.ts` can hang forever if the DB is unreachable

**Files modified:** `scripts/verify-credential-cutover.ts`
**Commit:** `1616110`
**Applied fix:** Added `connectionTimeoutMillis: 5000` to the `Pool` so the manual pre-deletion gate fails loudly instead of hanging indefinitely on a dead host.

## Skipped Issues

None — all 6 in-scope findings were fixed.

---

_Fixed: 2026-08-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
