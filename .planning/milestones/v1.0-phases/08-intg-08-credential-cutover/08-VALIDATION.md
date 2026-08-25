---
phase: 8
slug: intg-08-credential-cutover
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-25
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run app/api/jira/test lib/integrations/credentials.unit.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` plus `npx vitest run app/api/jira/test`
- **After every plan wave:** Run `npm test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | INTG-08 | T-08-01 | Script prints OK/UNSET labels only; never logs tokens | script | `npx tsx --env-file=.env.local scripts/verify-credential-cutover.ts` | ✅ | ⬜ pending |
| 08-01-02 | 01 | 1 | INTG-08 | T-08-02 | Dead helpers gone; live routes still call `resolveJiraCredentials` | grep + unit | `npx vitest run app/api/jira/test` then `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-01-03 | 01 | 1 | HYG-03 | — | Full suite green after deletion | unit | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files. The cutover script is the INTG-08 tenant-equivalence proof.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-tenant old vs new credential match | INTG-08 | Needs live `DATABASE_URL` and `company_jira_config` rows | `npx tsx --env-file=.env.local scripts/verify-credential-cutover.ts` — record stdout; halt on non-zero or any `match: no` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
