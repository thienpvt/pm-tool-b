---
status: testing
phase: 06-access-enforcement-rollout
source: [06-VERIFICATION.md]
started: 2026-08-25T13:58:00Z
updated: 2026-08-25T13:58:00Z
---

## Current Test

number: 1
name: Shadow-mode operational review (ROUTE-08)
expected: |
  No legitimate caller produces a shadow log line; any line is investigated and the caller fixed before enforcement is switched on. Enforcement then defaults on (isAccessShadowMode() returns false when the env var is absent).
awaiting: user response

## Tests

### 1. Shadow-mode operational review (ROUTE-08)
expected: Deploy with ACCESS_ENFORCEMENT=shadow and a live DATABASE_URL, observe [ACCESS-SHADOW] structured log lines for would-be-denials on the newly-gated routes, review each line, then redeploy without the env var to enforce.
result: [pending]
blocked_by: release-build
reason: Local Docker Postgres + next dev is up (DATABASE_URL live). Full operator review still needs ACCESS_ENFORCEMENT=shadow on a boot plus a cross-company probe against real/would-be-denied traffic — not yet run in this session.

### 2. v2 tenancy-residual risk acceptance
expected: Product/security owner records acceptance of residual cross-tenant risk on the 4 tenancy-less tables and schedules the company_id migration in the next milestone.
result: [pending]

### 3. proxy.ts runtime finding (ROUTE-11)
expected: 307 redirect to /login?from=%2Fportfolio (and /api/portfolio) with no cookie.
result: pass
reported: "2026-08-25 next dev + Docker DB. curl -sI http://localhost:3000/portfolio → 307 location /login?from=%2Fportfolio. /api/portfolio → 307 /login?from=%2Fapi%2Fportfolio. /api/projects/1/milestones → 307 /login?from=%2Fapi%2Fprojects%2F1%2Fmilestones. Matches 06-PROXY-FINDING.md."

## Summary

total: 3
passed: 1
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
