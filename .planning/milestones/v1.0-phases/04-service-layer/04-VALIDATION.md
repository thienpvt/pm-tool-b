---
phase: 4
slug: service-layer
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed Phase 1) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `node node_modules/vitest/vitest.mjs run lib/services --reporter=json --outputFile=vt.json` |
| **Full suite command** | `node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=vt.json` |
| **Estimated runtime** | ~35 seconds full suite |

**Reporter note (environment-specific):** the default vitest reporter output is mangled by an RTK shell hook in this
environment — it returns a few unreadable lines regardless of shell. Always use `--reporter=json --outputFile=<name>.json`
and parse the JSON (`numTotalTests`, `numPassedTests`, `numFailedTests`, `numPendingTests`), then delete the file.
`--outputFile` must be repo-relative. Exit codes remain trustworthy; only the human-readable output is lost.

**Baseline entering Phase 4:** 43 files, 233 tests, 124 passed, 109 skipped, 0 failed. The 109 skips are DB-gated
repository suites requiring `TEST_DATABASE_URL`; expected to skip, not a failure. Any *drop* below 124 passing or any
non-zero failure count is a regression.

---

## Sampling Rate

- **After every task commit:** Run the quick command (`lib/services` scope) — new service suites are mocked-repo unit
  tier, so they always execute and give real signal without a database.
- **After every plan wave:** Run the full suite command. Confirm passing count is ≥ baseline + new tests, and skipped
  count is unchanged at 109 (a rising skip count hides a suite that silently stopped running).
- **Before `/gsd-verify-work`:** Full suite green, plus `npx tsc --noEmit` exit 0 and `npx eslint` clean on changed files.
- **Max feedback latency:** ~35 seconds.

---

## Per-Task Verification Map

Task IDs are assigned by the planner. This map fixes the *requirement → test type → command* contract each task must
satisfy; the planner fills in concrete task IDs against these rows.

| Plan | Requirement | Secure Behavior | Test Type | Automated Command |
|------|-------------|-----------------|-----------|-------------------|
| substrate | SVC-03 | `ForbiddenError`/`NotFoundError`/`ValidationError` carry no HTTP status; `instanceof` narrows correctly | unit | `vitest run lib/services/errors` |
| substrate | SVC-04 | `assertProjectAccess` throws `ForbiddenError` on cross-company, `NotFoundError` on missing project, returns silently for owner and for admin | unit | `vitest run lib/services/access` |
| substrate | SVC-04 | CR-01 null-company predicate preserved: a null-company user matches ONLY fully-unassigned projects, never a real tenant's | unit | `vitest run lib/services/access` |
| substrate | SVC-02 | `serviceErrorResponse` maps 403/404/400 and delegates unknown errors to a generic 500 without leaking `String(e)` | unit | `vitest run lib/api-errors` |
| leaks | SVC-06 | Each export service rejects a cross-company `projectId` before any repository read | unit | `vitest run lib/export` |
| leaks | SVC-06 | `generateProjectPlan`/`generateKickoffPPT`/`generateWordDoc` require `companyId`; untyped `Error('Project not found')` becomes `NotFoundError` | unit | `vitest run lib/export` |
| orchestration | SVC-05 | Portfolio, roadmap, budget-rollup, report aggregates exclude another company's rows | **db-gated** | `vitest run lib/services --db` (requires `TEST_DATABASE_URL`) |
| orchestration | SVC-01 | Report/portfolio GET logic returns byte-identical output to the pre-extraction route for a fixed fixture | unit | `vitest run lib/services` |
| sweep | SVC-01 | No service imports `next/server` or references `NextRequest`/`NextResponse` | grep | `grep -rE "next/server\|NextRequest\|NextResponse" lib/services/ ; test $? -eq 1` |
| sweep | SVC-04 | Every project-scoped service function calls the access assert | grep + unit | `vitest run lib/services` |
| all | SVC-07 | Every service suite includes an explicit cross-company access-denied case | unit | full suite |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — vitest, `test/db.ts` (`hasTestDb`), and `test/repo-db.ts`
(`setupRepoTables`, `seedCompany`, `seedProject(name, { company_id })`, `testDb`) all landed in Phases 1-2. No framework
install and no new harness needed.

- [x] vitest + `vitest.config.ts` — Phase 1
- [x] `test/repo-db.ts` with `seedCompany` / `seedProject(name, {company_id})` — Phase 2 (the SVC-05 cross-company fixture)
- [ ] `lib/services/` directory — created by the substrate plan

---

## The SVC-05 Cross-Company Fixture (concrete shape)

SVC-05 requires aggregate scoping be "proven with a cross-company fixture rather than by inspection". The fixture is
db-gated because it must prove SQL-level join scoping, which a mocked repository cannot demonstrate:

```
describe.skipIf(!hasTestDb)('portfolio aggregates are company-scoped', () => {
  // seedCompany() twice → companyA, companyB
  // seedProject('a-project', { company_id: companyA })
  // seedProject('b-project', { company_id: companyB })
  // → call the service as a companyA user
  // → assert b-project contributes nothing: not in rows, not in counts,
  //   not in any rollup total, not in any join-derived aggregate
})
```

The assertion must check *totals*, not just row lists — a leak that adds a foreign project's budget to a sum while
omitting it from the returned array is exactly the failure mode inspection misses.

The mocked unit tier still carries the access-denied case for every service (SVC-07); the db tier is additive and
covers only the aggregate/join scoping claim.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New 403s do not break a legitimate owner in the live UI | SVC-04 | Research found every UI caller resolves project ids from company-scoped lists, so no break is predicted — but the prediction is static analysis over client fetch calls, not an exercised session | Log in as a non-admin user with a real company; visit each project sub-page (activities, risks, issues, meetings, team, milestones, documents, bugs, holidays, budget), the programs page, and trigger each export. Confirm no unexpected 403. |
| `admin/resource-audit` behavior if an admin gate is added | SVC-04 | Route is session-only today; adding an admin gate is a live behavior change for any non-admin currently using it | Confirm with an operator whether non-admins are expected to reach resource-audit before tightening it. |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or an explicit Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] Full-suite passing count ≥ baseline 124, skipped still 109, failures 0
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
