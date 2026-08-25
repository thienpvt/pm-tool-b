---
phase: 9
slug: mapping-table-tenant-isolation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-25
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (node + jsdom projects) |
| **Quick run command** | `npx vitest run lib/services/import-mapping.service.unit.test.ts lib/repositories/import-mapping.repo.unit.test.ts -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run the focused vitest file for the touched service/repo/route
- **After every plan wave:** Run `npm test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-W0 | 00 | 0 | TENANT-01 | T-09-01 | Test stubs/fixtures for four mapping tables + two-company backfill | unit/integration | `npx vitest run lib/db.mapping-tenant-migration.integration.test.ts -x` | ❌ W0 | ⬜ pending |
| 09-svc | 01 | 1 | TENANT-01 | T-09-01 | Service assert throws ForbiddenError on cross-company by-id | unit | `npx vitest run lib/services/import-mapping.service.unit.test.ts -t "Forbidden" -x` | ❌ W0 | ⬜ pending |
| 09-unique | 01 | 1 | TENANT-01 | T-09-04 | Same name two companies allowed; duplicate name same company rejected | unit | `npx vitest run lib/services/import-mapping.service.unit.test.ts -t "Conflict" -x` | ❌ W0 | ⬜ pending |
| 09-repo | 01 | 1 | TENANT-01 | T-09-02 | List SQL includes `WHERE company_id = ?` | unit | `npx vitest run lib/repositories/import-mapping.repo.unit.test.ts -t "company" -x` | ❌ W0 | ⬜ pending |
| 09-mig | 01 | 1 | TENANT-01 | T-09-05 | Backfill duplicates for 2 companies, no NULL, no collapse to company 1 | integration | `npx vitest run lib/db.mapping-tenant-migration.integration.test.ts -x` | ❌ W0 | ⬜ pending |
| 09-tl | 02 | 2 | TENANT-01 | T-09-01 | Cross-company PUT/DELETE timeline mapping → 403 | route unit | `npx vitest run app/api/import-mapping/route.test.ts -t "403" -x` | ❌ W0 | ⬜ pending |
| 09-bug | 02 | 2 | TENANT-01 | T-09-01 | Cross-company DELETE bug mapping → 403 | route unit | `npx vitest run app/api/bug-import-mapping/route.test.ts -t "403" -x` | ❌ W0 | ⬜ pending |
| 09-jql | 02 | 2 | TENANT-01 | T-09-01 | Cross-company DELETE JQL preset → 403 | route unit | `npx vitest run app/api/jira/jql-presets/route.test.ts -t "403" -x` | ❌ W0 | ⬜ pending |
| 09-sync | 02 | 2 | TENANT-01 | T-09-02 | Sync mappings list scoped per company; eviction DELETE company-scoped | route unit | `npx vitest run app/api/jira/sync-mappings/route.test.ts -t "company" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/services/import-mapping.service.ts` + unit tests — timeline + bug tables
- [ ] `lib/services/jira-mapping.service.ts` (or extend jira-config service) + unit tests — JQL presets + sync mappings
- [ ] `lib/db.mapping-tenant-migration.integration.test.ts` — backfill fixture with two companies
- [ ] Extend `test/repo-db.ts` DDL with four mapping tables + `company_id` columns for integration tests
- [ ] Cross-company 403 cases in existing route test files (4 route groups)
- [ ] Repo signature change: all list/create/mutate take `companyId`

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
