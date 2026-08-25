---
status: complete
phase: 06-access-enforcement-rollout
source: [06-VERIFICATION.md]
started: 2026-08-25T13:58:00Z
updated: 2026-08-25T14:06:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Shadow-mode operational review (ROUTE-08)
expected: Deploy with ACCESS_ENFORCEMENT=shadow and a live DATABASE_URL, observe [ACCESS-SHADOW] structured log lines for would-be-denials on the newly-gated routes, review each line, then redeploy without the env var to enforce.
result: pass
reported: |
  2026-08-25 local Docker Postgres + next dev.
  Newly-gated routes (invalid cookie, proxy bypass): GET bug-import-mapping, import-mapping, jql-presets, sync-mappings, config; DELETE bug-import-mapping/1, import-mapping/1, jql-presets/1; POST parse-file-headers — all 401.
  Enforcing (no flag): ct_user1 (company_id=1) GET /api/projects/1/milestones → 403 (project company_id is null). admin → 200.
  ACCESS_ENFORCEMENT=shadow restart: same ct_user1 GET logged three [ACCESS-SHADOW] lines {"method":"GET","path":"/api/projects/1/milestones","userId":2,"companyId":1,"errorKind":"ForbiddenError","targetId":"1"} then 500 (handler re-asserts after wrapper softens). Reviewed: expected isolation, not a legitimate caller. Legitimate ct_user1 GET /api/projects/2/milestones (company_id=1) → 200, no shadow line. Invalid-cookie 401s unchanged under shadow.
  Flag removed, restart: ct_user1 project 1 → 403; project 2 → 200; no [ACCESS-SHADOW] in the enforcing log.

### 2. v2 tenancy-residual risk acceptance
expected: Product/security owner records acceptance of residual cross-tenant risk on the 4 tenancy-less tables and schedules the company_id migration in the next milestone.
result: pass
reported: "Owner accepted for v1 on 2026-08-25. Residual cross-tenant read/write on timeline_import_mappings, bug_import_mappings, jira_jql_presets, and jira_sync_mappings remains gated at withAuth (401) only. company_id migration scheduled for the next milestone (v2 / DATA/ENF backlog)."

### 3. proxy.ts runtime finding (ROUTE-11)
expected: 307 redirect to /login?from=%2Fportfolio (and /api/portfolio) with no cookie.
result: pass
reported: "2026-08-25 next dev + Docker DB. curl -sI http://localhost:3000/portfolio → 307 location /login?from=%2Fportfolio. /api/portfolio → 307 /login?from=%2Fapi%2Fportfolio. /api/projects/1/milestones → 307 /login?from=%2Fapi%2Fprojects%2F1%2Fmilestones. Matches 06-PROXY-FINDING.md."

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
