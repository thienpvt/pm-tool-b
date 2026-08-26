---
phase: 10
slug: users-roles-server-authorization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-25
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run lib/services/access.unit.test.ts lib/services/users.service.unit.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** focused vitest for touched files
- **After every plan wave:** `npm test`
- **Before `$gsd-verify-work`:** full suite green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

See 10-RESEARCH.md Validation Architecture (USER-01..06, AUTH-01..06 plus cross-company 403 regression).

---

## Wave 0 Requirements

- [ ] `lib/services/users.service.ts` + unit tests
- [ ] `lib/repositories/users.repo.ts` + tests; `test/repo-db.ts` DDL for `user_roles`, `audit_logs`, user status columns
- [ ] `lib/services/audit.service.ts` + append-only insert test
- [ ] `lib/http/role-matrix.test.ts` — Viewer/PM/CPMO matrix
- [ ] Login Inactive/Locked reject tests

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
