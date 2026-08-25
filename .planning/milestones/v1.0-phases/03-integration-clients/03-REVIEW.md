---
phase: 03-integration-clients
reviewed: 2026-08-10T00:00:00Z
depth: deep
files_reviewed: 26
files_reviewed_list:
  - app/api/jira/fields/route.ts
  - app/api/jira/search/route.ts
  - app/api/jira/test/route.test.ts
  - app/api/jira/test/route.ts
  - app/api/portfolio/report/generate-email/route.ts
  - app/api/portfolio/report/route.ts
  - app/api/portfolio/report/send-email/route.test.ts
  - app/api/portfolio/report/send-email/route.ts
  - app/api/projects/[id]/project-report/generate-email/route.ts
  - app/api/projects/[id]/project-report/route.ts
  - app/api/projects/[id]/report/route.ts
  - lib/api-errors.ts
  - lib/integrations/anthropic/client.ts
  - lib/integrations/anthropic/client.unit.test.ts
  - lib/integrations/anthropic/models.ts
  - lib/integrations/anthropic/schemas.ts
  - lib/integrations/credentials.ts
  - lib/integrations/credentials.unit.test.ts
  - lib/integrations/errors.ts
  - lib/integrations/errors.unit.test.ts
  - lib/integrations/jira/client.ts
  - lib/integrations/jira/client.unit.test.ts
  - lib/integrations/jira/schemas.ts
  - lib/integrations/resend/client.ts
  - lib/integrations/resend/client.unit.test.ts
  - package.json
  - scripts/verify-credential-cutover.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-10
**Depth:** deep
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Reviewed the integration-client rework: `lib/integrations/` (errors, credentials, jira/anthropic/resend clients), the `integrationErrorResponse` mapper, all reworked Jira/Anthropic/Resend routes, tests, and the credential-cutover verification script. Cross-checked every rewire against the pre-phase files (diff base `5498855`) and traced call chains into `JiraSyncDialog` and the repositories.

Quality is generally high: secrets stay server-side (`cause` never crosses HTTP), the Resend/Jira/Anthropic clients correctly normalize errors, timeouts clear their timers, and the Jira resolver preserves the exact old precedence. But one critical correctness bug and several robustness gaps remain. Test suite: 112 passed / 0 failed / 109 skipped (DB-backed repo tests, expected without DATABASE_URL).

Key finding: the Jira search client unconditionally requests custom fields `10014`, `10016`, `10020` while its zod schema rejects `null` for exactly those three — a guaranteed runtime breakage once any searched issue lacks one of those fields (verified by probe against zod 4.4.3). Minor: the search route maps the 401 "Unauthorized" (session present, `company_id` null) to the config-missing 503 string instead of 401, and a search for `total=0` throws a null dereference. None of these are caught by the unit tests.

## Critical Issues

### CR-01: Jira search schema rejects nulls for the very custom fields the client always requests

**File:** `lib/integrations/jira/schemas.ts:25-28`
**Issue:** `searchIssues` sends a fixed field list including `customfield_10014` (Epic Link), `customfield_10016` (Story Points), and `customfield_10020` (Sprint) for every issue (jira/client.ts:16-26). When an issue does not have one of those values set, the Jira Cloud search/jql API returns `null` for the requested field. The zod schema declares `customfield_10014: z.string().optional()`, `customfield_10016: z.number().optional()`, `customfield_10020: z.array(...).or(z.string()).optional()` — none nullable. `safeParse` then fails on the first null and the client throws `kind: 'validation'`, which maps to the fixed 502 "Jira trả về dữ liệu không hợp lệ". So one issue without a Sprint or without Story Points breaks the entire search result — the issue list, mappings, and Jira sync all fail. Verified by probe: all three reject `null` while `customfield_10015` (declared nullable) and absent fields pass. `assignee`/`reporter`/`priority`/`resolution`/`parent`/`duedate`/`labels`/`components` null cases are safe (nullable/optional). This is a guaranteed production breakage — every Jira search hits it.
**Fix:**
```ts
customfield_10014: z.string().nullable().optional(),              // Epic Link (classic)
customfield_10016: z.number().nullable().optional(),              // Story Points
customfield_10020: z.array(z.object({ name: z.string(), state: z.string() })).or(z.string()).nullable().optional(), // Sprint
```

## Warnings

### WR-01: Search route maps a null-company 401 to the config-missing 503 string

**File:** `app/api/jira/search/route.ts:30-35`
**Issue:** The old route returned 401 via `getJiraCredentials` returning null. The new POST body lost that distinction: when the session exists but `company_id` is null, it returns 503 with "Jira chưa được cấu hình cho công ty này..." — the same string as a genuinely misconfigured company. Behavior freeze intent (existing statuses preserved verbatim) is violated for this case; the fields route preserves 401 but the search route does not. Fix by collapsing the case into the creds null path with a 401 branch.
**Fix:**
```ts
const user = await getSessionFromRequest(req);
if (!user?.company_id) {
  return NextResponse.json({ error: 'Jira chưa được cấu hình cho công ty này...' }, { status: 401 });
}
```

### WR-02: Null dereference when a search returns zero issues

**File:** `app/api/jira/search/route.ts:66-72`
**Issue:** `issues[0]` is accessed unconditionally in the debug block. `searchIssues` always resolves a non-null `issues` array (default `[]`), but a valid JQL with no matches returns `[]`; `issues[0]` is `undefined`, and `Object.entries(firstIssue.fields ?? {})` throws. Old code used `data.issues?.[0]` and was safe. This throws inside the `try`, so it surfaces as 500 `Internal server error` (mapper's non-IntegrationError branch) for an empty result — wrong behavior and a wasted round trip.
**Fix:**
```ts
const firstIssue = issues[0] as { fields?: Record<string, unknown> } | undefined;
if (firstIssue) { ... }
```

### WR-03: `withFetchTimeout` doesn't forward the caller abort to the fetch call

**File:** `lib/integrations/errors.ts:58-64`, `lib/integrations/jira/client.ts:50-62`
**Issue:** Caller abort is wired only to the internal `controller`, never to the fetch `signal` (the fetch still gets `params.signal`). When the caller aborts, `Promise.race` rejects via `abortPromise` and the route returns — but the underlying network request keeps running until its own 15s timeout (it can keep its socket open, and on the server a stalled upstream still occupies a fetch connection for up to 15s). The intended design is that the timeout and the caller abort are the same signal (comments in errors.ts:31-38). Forwarding the combined controller signal to fetch would cancel the socket immediately. Also `testConnection`/`listFields` never pass a caller signal, so the route can't cancel a hung Jira test at all — the caller waits the full 15s. This is the only consumer of `signal` today; the abort path is exercised only in a unit test. Severity: warning (no wrong data; resource/socket retention for up to 15s per request).
**Fix:**
```ts
const { value: response, error } = await withFetchTimeout(
  fetch(`${creds.baseUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { Authorization: basicAuth(creds.email, creds.token), ... },
    body: JSON.stringify(body),
    // signal: params.signal,
  }),
  15_000,
  params.signal,
  'jira',
);
```
Better: have `withFetchTimeout` return a merged signal and pass it to the fetch in the client.

### WR-04: Jira upstream error text leaks through the route-level mapper before `integrationErrorResponse` runs

**File:** `app/api/jira/test/route.ts:83-96`
**Issue:** The route's catch reads `e.message`/`e.cause` directly for the `upstream`/`network`/`timeout` cases, bypassing `integrationErrorResponse`. Upstream Jira error bodies (which can contain internal URLs, field IDs, full server paths) reach the response verbatim (`{ ok: false, error: errMsg }`). The phase intent (T-03-01, `cause` stays server-side; mapper only lets `e.message` cross) is preserved only for the `search`/`fields` routes that go through the mapper; this route duplicates the mapper's logic instead of routing through it and re-exposes raw upstream text. Behavior freeze says the old route also passed raw `errMsg`, but the stated hardening goal is to stop leaking upstream detail. If behavior freeze wins, at minimum document the deliberate leak; otherwise route this through the mapper with a test-route prefix variant.
**Fix:** Route the upstream case through `integrationErrorResponse` with an added test-route branch, or explicitly sanitize the error to `Jira trả về ${status}` before responding.

### WR-05: Uncaught `req.json()` on the project report POST

**File:** `app/api/projects/[id]/report/route.ts:148`
**Issue:** `const body = await req.json();` is outside the try/catch (the try starts at line 223 around `createMessage`). A malformed/non-JSON body or a payload exceeding the body-size limit rejects the handler, and Next returns a generic 500 with no `{ error }` JSON shape — violating the project convention "Prefer JSON error shape over thrown exceptions crossing the HTTP boundary" and the phase intent around unhandled rejections. The portfolio report route (line 533) and the project-report route (line 302) have the same pattern, but the other routes also parse the body before auth/data validation — the mismatch is inconsistent. `send-email` and `generate-email` routes parse `req.json()` without a guard too. Old code had the same shape, so this is not a regression, but it is an unhandled-rejection gap the phase claims to harden.
**Fix:** Wrap `req.json()` in the existing try/catch, or add a defensive `try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }` like the jira test route does.

### WR-06: `verify-credential-cutover.ts` can hang forever if the DB is unreachable

**File:** `scripts/verify-credential-cutover.ts:56`
**Issue:** `new Pool({ connectionString })` and the `pool.query`/`getDb()` calls have no statement timeout and no connection timeout. The script is a manual pre-deletion gate; if `DATABASE_URL` points at a dead host, it hangs indefinitely with no error. It's a maintenance script (not a shipping path), so warning only, but a `connectionTimeoutMillis` (e.g. 5000) on the Pool would make the gate fail loudly.
**Fix:**
```ts
const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
```

## Info

### IN-01: Dead `oldInlineCredentialBlock` reads env values the route no longer uses

**File:** `app/api/jira/fields/route.ts:34-43`
**Issue:** The kept dead block reads `process.env[cfg.email_var]` and `process.env[cfg.token_var]` and builds an `auth` header that nothing consumes. Unreachable (GET resolves via `resolveJiraCredentials`), and the INTG-08 plan requires the dead blocks stay until the verification script passes. But the block can never be reached, so it is pure dead weight that also trips anyone auditing `process.env` access in `app/`. Confirmed the fields GET has no 401-behavior change: the old GET returned 401 with `user.company_id` null; the new GET does the same (only `search` regressed, see WR-01). Delete in the INTG-08 commit along with the search route's block; add a `// dead code — see INTG-08` comment only if the plan insists on the shape.
**Fix:** Delete with the INTG-08 cutover commit. Keep no env reads in dead code.

### IN-02: `integrationErrorResponse` has an unreachable `auth` branch for Jira

**File:** `lib/api-errors.ts:48-52`
**Issue:** The `jira` `auth` branch is dead — the Jira client never produces `kind: 'auth'` (grep confirms only the Anthropic client does). The Jira 401 comes back as `kind: 'upstream'`, which the branch above already handles with the same status/body passthrough. Harmless but misleading: a future Jira client change that adds `auth` would hit the same code path with no observable difference. Keep or drop; if kept, add a comment that the Jira client maps 401 to `upstream`.

### IN-03: Tests don't exercise the null-custom-field schema path

**File:** `lib/integrations/jira/client.unit.test.ts:15-33`
**Issue:** The `happyIssues` fixture omits the custom fields entirely (or sets only string ones), so the null-rejection in CR-01 is untested. Add a fixture issue with `customfield_10020: null` (and `customfield_10014: null`, `customfield_10016: null`) to lock the fix. Also add a `total: 0` search test to cover the WR-02 empty-result path.

---

_Reviewed: 2026-08-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
