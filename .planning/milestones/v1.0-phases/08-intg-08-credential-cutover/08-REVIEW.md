---
phase: 08-intg-08-credential-cutover
reviewed: 2026-08-25T15:09:00Z
depth: deep
files_reviewed: 2
files_reviewed_list:
  - app/api/jira/search/route.ts
  - app/api/jira/fields/route.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-08-25T15:09:00Z  
**Depth:** deep  
**Files Reviewed:** 2  
**Status:** issues_found

## Summary

Phase 8 HYG-01 deletion is structurally correct: both live handlers call `resolveJiraCredentials`, the fields route preserves the `companyJiraConfig` → two-503 split (`Jira chưa cấu hình` vs `Thiếu env vars`), and the search route no longer imports `companyJiraConfig` (dead-helper import correctly removed). Cross-file tracing confirms the resolver’s DB-names-then-env precedence is the sole credential path for these routes.

No regressions were found in the cutover-specific requirements. Remaining findings are pre-existing live-path quality issues in `search/route.ts` (debug logging, unguarded JSON parse, weak body validation). The fields route is clean aside from absent route-level tests for its 503 contract.

## Narrative Findings (AI reviewer)

### WR-01: Production debug log leaks Jira issue field values

**File:** `app/api/jira/search/route.ts:46-53`  
**Issue:** Every successful search logs all custom-field key/value pairs from the first issue via `console.log`, including `JSON.stringify(v)` of arbitrary Jira payloads. In production this can write PII or sensitive project data to stdout/log aggregators. Phase 3 explicitly frozen this log as operator behavior, but it remains an information-disclosure surface.  
**Fix:**
```typescript
// Remove the block entirely, or gate behind an explicit dev flag:
if (process.env.JIRA_SEARCH_DEBUG === '1' && firstIssue) {
  // ... existing log ...
}
```

### WR-02: Malformed JSON body surfaces as unhandled 500

**File:** `app/api/jira/search/route.ts:26`  
**Issue:** `await req.json()` sits outside the `try/catch` that wraps `searchIssues`. Invalid or empty JSON rejects the handler before the catch, producing a framework 500 instead of a JSON 400. The portfolio report route already guards this pattern (WR-05 elsewhere in the codebase).  
**Fix:**
```typescript
let body: { jql?: string; nextPageToken?: string; maxResults?: number; extraFields?: string[] };
try {
  body = await req.json();
} catch {
  return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
}
const { jql, nextPageToken, maxResults = 100, extraFields = [] } = body;
```

### WR-03: `extraFields` accepted without array validation

**File:** `app/api/jira/search/route.ts:27-43`  
**Issue:** The body is cast to `{ extraFields?: string[] }` without runtime checks. A non-array value (e.g. `"customfield_10016"`) is spread in `searchIssues` (`...(params.extraFields ?? [])`), yielding per-character “field names” and unpredictable Jira API errors instead of a controlled 400.  
**Fix:**
```typescript
if (extraFields !== undefined && (!Array.isArray(extraFields) || extraFields.some(f => typeof f !== 'string'))) {
  return NextResponse.json({ error: 'extraFields phải là mảng chuỗi' }, { status: 400 });
}
```

### IN-01: Misleading auth comment vs fields route error body

**File:** `app/api/jira/search/route.ts:10-11`  
**Issue:** Comment states the null-`company_id` branch “matching the fields route,” but fields returns `{ error: 'Unauthorized' }` while search returns the Vietnamese Jira-config string. Status code (401) aligns; message bodies do not.  
**Fix:** Update the comment to document the intentional message divergence (behavior freeze), or align messages in a dedicated auth-hardening phase.

### IN-02: No route-level tests for fields 503 split or search resolver path

**File:** `app/api/jira/fields/route.ts` (whole handler), `app/api/jira/search/route.ts` (resolver + 503 branch)  
**Issue:** Only `route-401-matrix.test.ts` covers null-session 401 for these routes. Unlike `app/api/jira/test/route.test.ts`, there are no assertions that fields GET emits `Jira chưa cấu hình` vs `Thiếu env vars`, or that search POST calls `resolveJiraCredentials` and maps missing creds to 503. Phase 8 verification relied on greps and indirect resolver unit tests.  
**Fix:** Add focused route tests mirroring the test-route 503 patterns when the milestone test sweep reaches Jira routes.

---

_Reviewed: 2026-08-25T15:09:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
