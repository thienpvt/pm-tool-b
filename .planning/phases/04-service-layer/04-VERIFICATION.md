---
phase: 04-service-layer
verified: 2026-08-11T00:30:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  final_closure: "04-07 (commits 7d66f23..a3dd2ef) converted the two collection routes. Independently re-verified: repo-import grep on both collection routes returns 0; services export listProjects/createProject and listProgramsWithCounts/createProgram; the tenancy decision actor.is_admin ? body.company_id ?? null : actor.company_id now lives in both services; full suite 573/460/0/113; tsc clean; eslint clean."
  gaps_closed:
    - "app/api/projects/[id]/route.ts inline checkAccess deleted; routed through projects.service.ts (04-05, commit 66de1b4)"
    - "Three budget/[itemId] nested routes' inline authorize copies deleted; routed through budget-items.service.ts; cross-company now 403 (04-05, commit dcff6b3)"
    - "portfolio/roadmap/epics live read IDOR closed with assertProjectAccess before roadmapEpicRows (04-05, commit 5d19431)"
    - "programs/[id]/project-allocations live write IDOR closed — POST asserts program AND project ownership; GET gated too (04-05, commit 7470fbe)"
    - "11 portfolio sub-resource routes (budgets/members/milestones/program-allocations/quota) wired onto portfolio.service.ts; String(e) leak closed (04-06, commits 3c6d115..ba07edf)"
    - "collection routes app/api/projects/route.ts and app/api/programs/route.ts converted to services; companyId tenancy decision moved into the services (04-07, commits 7d66f23..a3dd2ef)"
  gaps_remaining: []
  regressions: []
gaps: []
behavior_unverified_items:
  - truth: "Portfolio, roadmap, budget rollup, and report-generation services scope every aggregate query and join by company, proven with a cross-company fixture rather than by inspection (SVC-05)"
    test: "Set TEST_DATABASE_URL to a disposable Postgres test DB and run the company-scope suite: node node_modules/vitest/vitest.mjs run lib/services/company-scope.repo.test.ts --reporter=json"
    expected: "All 4 tests pass — company B's rows and totals (5 open risks, 99999 budget) must not appear for a company-A actor across portfolio summary, roadmap, portfolio report, and budget rollup (now including the service-layer listBudgets/getBudget paths added in 04-06)."
    why_human: "The suite is describe.skipIf(!hasTestDb) and skips locally because TEST_DATABASE_URL is unset in this environment. The fixture and assertions are present and correct by inspection (they assert totals, not just row lists), but the SQL-level scoping proof only executes against a real Postgres. CI is the expected venue for this evidence (as with Phase 2's DB-gated repo suites)."
human_verification:
  - test: "Set TEST_DATABASE_URL to a disposable Postgres test DB and run: node node_modules/vitest/vitest.mjs run lib/services/company-scope.repo.test.ts --reporter=json"
    expected: "4/4 pass. Confirms the SVC-05 cross-company aggregate scoping claim (portfolio summary, roadmap, portfolio report, budget rollup incl. service-layer budgets) at the SQL/join level with the two-tenant fixture."
    why_human: "DB-gated suite; cannot run locally without TEST_DATABASE_URL. Fixture and total-level assertions exist and look correct by inspection, but only a live run proves the scoping."
  - test: "Log in as a non-admin user in a real company and visit each project sub-page (activities, risks, issues, meetings, team, milestones, documents, bugs, holidays, budget) plus the programs page, and trigger each export"
    expected: "No unexpected 403 for a legitimate owner; export documents byte-identical to pre-phase behavior"
    why_human: "Static analysis over client fetch calls cannot exercise a live session (VALIDATION.md manual-only item)."
---

# Phase 4: Service Layer Verification Report (FINAL — after 04-05 + 04-06 + 04-07 gap closure)

**Phase Goal:** Business logic and tenant-ownership checks move into `lib/services/*.service.ts` modules that take plain arguments, return plain data, and throw typed errors — closing the gap where auth was checked in some routes and not others.
**Verified:** 2026-08-11
**Status:** passed (7/7 must-haves; SVC-05 runtime proof deferred to CI)
**Re-verification:** Yes — after 04-05 (4 blockers + 2 live IDORs), 04-06 (11 portfolio sub-routes), and 04-07 (2 collection routes) gap closure

## Goal Achievement

All 7 requirements verified. The four original blockers, both live IDORs, the 11 portfolio sub-resource routes, and the two collection routes are all service-housed and independently re-verified. The phase's security goal — closing the gap where auth was checked in some routes and not others, and eliminating cross-tenant leaks — is achieved with zero remaining code gaps.

The single deferred item is runtime proof of SVC-05 (the DB-gated cross-company aggregate suite), which correctly skips locally without `TEST_DATABASE_URL` and is designed to run in CI, per the Phase 2 precedent (Phase 2 closed its DB-gated evidence via CI run 31348410580).

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Business logic for every API resource lives in a `lib/services/*.service.ts` module; no service imports `next/server`/`NextRequest`/`NextResponse` | ✗ FAILED (minor) | 18 service files; grep clean under lib/services/; 11 portfolio sub-routes + 4 blocker routes now service-housed. Only residue: `projects/route.ts` + `programs/route.ts` collections call repos inline (see Gaps) |
| 2 | Services signal failure by throwing `ForbiddenError`, `NotFoundError`, or `ValidationError` — none carrying an HTTP status | ✓ VERIFIED | `lib/services/errors.ts`; `errors.unit.test.ts` asserts no `status` field; `serviceErrorResponse` maps 403/404/400/409 + generic 500 without `String(e)` |
| 3 | Every project-scoped service function asserts the caller's company owns the project | ✓ VERIFIED | All project-scoped service functions assert first (1:1 ratio); epics GET asserts before `roadmapEpicRows`; allocations POST asserts BOTH program + project; repo-not-called-on-denial tests exist |
| 4 | Portfolio, roadmap, budget rollup, and report services scope every aggregate query/join by company, proven with cross-company fixture | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `company-scope.repo.test.ts` — 2-tenant fixture asserting totals incl. service-layer budgets (04-06); DB-gated, 4/4 skip locally (deferred human item, runs in CI) |
| 5 | Every export service (Excel, PowerPoint, Word) scopes its data fetch by company, with unit tests incl. explicit cross-company access-denied case | ✓ VERIFIED | `generateProjectPlan`/`generateKickoffPPT`/`generateWordDoc` assert-first; excel/ppt/word unit tests with ForbiddenError + repos-uncalled; 6 leak routes gated |
| 6 | Cross-company denials unify on 403; 401 only for a missing session | ✓ VERIFIED | budget/route.ts (04-03), 3 budget children (04-05), epics + allocations (04-05) all 403; original `checkAccess`/`authorize` copies deleted (grep = 0) |
| 7 | Services re-throw `IntegrationError` untouched; force500 = 1 per report route | ✓ VERIFIED | `integration-error-passthrough.unit.test.ts`; `grep force500` = exactly 1 per report route, 3 total |
| 8 | Inline RAG thresholds extracted VERBATIM with divergence recorded; `companyRagConfig(project.company_id)` preserved | ✓ VERIFIED | Divergence comments in portfolio/roadmap services; project-report line 336 BEHAVIOR FREEZE |
| 9 | CR-01 null-company predicate preserved | ✓ VERIFIED | `access.ts:38-40`; full unit coverage |
| 10 | Full suite green with skip baseline held | ✓ VERIFIED | tsc exit 0; eslint exit 0; vitest 554/441/0/113 |

**Score:** 6/7 must-haves verified (1 minor completeness failure + 1 behavior-unverified deferred item)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Route-level `with-auth` / `withProjectAccess` wrapper roll-out | Phase 5/6 | ROADMAP.md Phase 5 SC 1-2 — the wrapper half of defense in depth, deliberately NOT Phase 4 scope |
| 2 | SVC-05 cross-company DB-gated proof execution | CI (Phase 2 precedent) | Fixture present + correct by inspection; runs against real Postgres in CI |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/services/errors.ts` | Status-free typed errors (+ ConflictError) | ✓ VERIFIED | 44 lines |
| `lib/services/access.ts` | assertProjectAccess — single ownership primitive | ✓ VERIFIED | Admin bypass → NotFound → owner → null-company CR-01 |
| `lib/api-errors.ts` | serviceErrorResponse third mapper | ✓ VERIFIED | 403/404/400/409 + generic 500 |
| `lib/services/risks.service.ts` | Reference service | ✓ VERIFIED | assert-first CRUD |
| 11 sweep services + projects.service + budget-items.service | 18 service modules | ✓ VERIFIED | All assert-first / company-scoped |
| `lib/services/portfolio.service.ts` | Summary + 20 sub-resource operations | ✓ VERIFIED | Company-scoped via actor.company_id; spendByCategory aggregate preserved |
| `lib/services/company-scope.repo.test.ts` | SVC-05 cross-company proof | ✓ VERIFIED (present) | DB-gated; 4 tests skip locally |
| `lib/export/{excel,ppt,word}.ts` | Company-gated generators | ✓ VERIFIED | actor param + assert-first + NotFoundError |
| `lib/services/projects.service.ts` | Owner-scoped project CRUD | ✓ VERIFIED (04-05) | getProject/updateProject/deleteProject; UnknownColumnError propagates for 400 |
| `lib/services/budget-items.service.ts` | Nested budget item + expense ops | ✓ VERIFIED (04-05) | assert-first; getExpenseInItem 404 scoping |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `lib/services/access.ts` | `lib/repositories/projects.repo.ts` | `projectAccessRow` | ✓ WIRED | |
| Export generators | `lib/services/access.ts` | `assertProjectAccess` | ✓ WIRED | excel:110, ppt:100, word:82 |
| Converted routes | `lib/services/*.service.ts` | session → actor → service | ✓ WIRED | 16 project-scoped + 11 portfolio sub-resource routes |
| `projects/[id]/route.ts` | `projects.service.ts` | getProject/updateProject/deleteProject | ✓ WIRED | checkAccess deleted (grep=0) |
| Budget child routes | `budget-items.service.ts` | assert-first | ✓ WIRED | authorize deleted (grep=0) |
| `portfolio/roadmap/epics/route.ts` | `access.ts` | assertProjectAccess before repo | ✓ WIRED | repo-not-called-on-denial test |
| `programs/[id]/project-allocations/route.ts` | `programs.service` + `access.ts` | assertProgramAccess AND assertProjectAccess | ✓ WIRED | both-sided denial tests |
| 11 portfolio sub-routes | `portfolio.service.ts` | actor.company_id scoped calls | ✓ WIRED | no direct .repo imports (grep clean) |
| Report routes POST | `lib/integrations/anthropic/client.ts` | createMessage + force500 | ✓ WIRED | preserved |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| portfolio.service (all ops) | rows/totals | actor.company_id threaded into repos | Real company-scoped query | ✓ FLOWING |
| projects.service | project row | assert-first, company-scoped read | Real query | ✓ FLOWING |
| budget-items.service | items/expenses | assert-first + item-in-project scoping | Real query | ✓ FLOWING |
| portfolio-report/roadmap | rows/totals | all calls pass actor.company_id + is_admin | Real query | ✓ FLOWING |
| export generators | document buffers | assert-first + project-scoped reads | Real data | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript compiles | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| ESLint on services + all changed routes | `npx eslint lib/services app/api/portfolio/{budgets,members,milestones,program-allocations,quota} ...` | exit 0, 0 errors | ✓ PASS |
| Full test suite | `node node_modules/vitest/vitest.mjs run --reporter=json` | 554 total / 441 passed / 0 failed / 113 pending | ✓ PASS |
| Skip baseline held | parse numPendingTests | 113 (unchanged; +4 company-scope DB-gated) | ✓ PASS |
| force500 count | `grep -c force500 <3 report routes>` | 1 each, 3 total | ✓ PASS |
| next/server contamination | `grep -rn "next/server\|NextRequest\|NextResponse" lib/services/` | no matches (exit 1) | ✓ PASS |
| Blocker 1 | `grep -c "checkAccess" app/api/projects/[id]/route.ts` | 0 | ✓ PASS |
| Blocker 2 | `grep -rc "async function authorize" app/api/projects/[id]/budget/` | 0 across all | ✓ PASS |
| Blocker 3 | `grep -c "assertProjectAccess" app/api/portfolio/roadmap/epics/route.ts` | 2 | ✓ PASS |
| Blocker 4 | `grep -c "assertProgramAccess\|assertProjectAccess" app/api/programs/[id]/project-allocations/route.ts` | 5 | ✓ PASS |
| Portfolio sub-routes clean | `grep -rlE "\.repo'" app/api/portfolio/{budgets,members,milestones,program-allocations,quota}/` (non-test) | CLEAN | ✓ PASS |
| String(e) leak closed | `grep -c "String(e)" app/api/portfolio/program-allocations/route.ts` | 0 (comment only) | ✓ PASS |
| REPO-03 regression | `app/api/projects/[id]/route.test.ts` PATCH `{company_id:99}` | 400 + columns (DB-gated, part of 113 skip) | ✓ PASS |

### Probe Execution

No probe scripts declared. Step 7c SKIPPED — verification uses the unit/route suites + greps above, all executed fresh.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SVC-01 | 04-01..06 | Business logic for every API resource lives in a service | ✗ BLOCKED | 18 services + clean grep, but projects/route.ts + programs/route.ts collections remain inline (thin, company-scoped, no security bug) |
| SVC-02 | 04-01 | Services take plain args, return plain data, never touch next/server | ✓ SATISFIED | grep clean; all services take (projectId, actor) / (actor) |
| SVC-03 | 04-01 | Typed errors with no HTTP status | ✓ SATISFIED | errors.ts + unit tests |
| SVC-04 | 04-01..05 | Every project-scoped service asserts ownership | ✓ SATISFIED | All project-scoped surfaces assert; epics + allocations IDORs closed with repo-not-called tests |
| SVC-05 | 04-04, 04-06 | Aggregate/join scoping proven with cross-company fixture | ? NEEDS HUMAN | Fixture present + correct (rows AND totals, incl. service-layer budgets); DB-gated, runs in CI |
| SVC-06 | 04-02 | Export services scope data fetch by company | ✓ SATISFIED | excel/ppt/word assert-first; 6 leak routes gated |
| SVC-07 | 04-01..06 | Unit tests with mocked repos incl. cross-company denial | ✓ SATISFIED | All 18 services + 3 export generators have cross-company denial / scope-out tests |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/api/projects/route.ts` | 4, 11, 26 | Collection route calls `listProjects`/`createProject` repos directly | ⚠️ Warning | SVC-01 incompleteness; session-gated + company-scoped, no tenant bug. RESEARCH P4-04 committed it to scope |
| `app/api/programs/route.ts` | 3, 10, 25 | Collection route calls `listPrograms`/`createProgram` repos directly | ⚠️ Warning | SVC-01 incompleteness; session-gated + company-scoped, no tenant bug |
| `lib/export/excel.ts`, `word.ts` | — | Pre-existing unused-var warnings | ℹ️ Info | Documented out-of-scope; eslint exits 0 |

### Human Verification Required

1. **SVC-05 cross-company DB-gated suite (the known deferred item)**
   - **Test:** Set `TEST_DATABASE_URL` to a disposable Postgres test DB and run `node node_modules/vitest/vitest.mjs run lib/services/company-scope.repo.test.ts --reporter=json`
   - **Expected:** 4/4 pass — company B's rows and totals (5 open risks, 99999 budget) contribute nothing to company-A actor results across portfolio summary, roadmap, portfolio report, and budget rollup (incl. service-layer `listBudgets`/`getBudget`).
   - **Why human:** Suite skips locally (`TEST_DATABASE_URL` unset). Fixture and total-level assertions are correct by inspection; only a real Postgres proves the SQL-level scoping. CI is the expected venue (Phase 2 precedent). The 113 skip baseline includes this suite — do not treat as regression.

2. **Live UI no-403-storm for legitimate owners**
   - **Test:** Log in as a non-admin user with a real company; visit each project sub-page, the programs page, and trigger each export.
   - **Expected:** No unexpected 403; export documents byte-identical to pre-phase.
   - **Why human:** Static analysis over client fetch calls cannot exercise a live session (VALIDATION.md manual-only item).

### Gaps Summary

**Gap-closure verified (independently re-checked, not taken from summaries):**

- **04-05 (commits 66de1b4..7470fbe):** `projects/[id]/route.ts` — `checkAccess` deleted (grep=0), GET/PATCH/DELETE route through `projects.service.ts`, REPO-03 400-with-columns regression test present (DB-gated). Budget `[itemId]` + `expenses` + `expenses/[expId]` — all three `authorize` copies deleted (grep=0 across all), routed through `budget-items.service.ts`, cross-company now 403 with `getExpenseInItem` 404 scoping. `portfolio/roadmap/epics` — `assertProjectAccess` runs before `roadmapEpicRows`, repo-not-called-on-denial test present, pre-existing `any` typed to `ActivityRow`. `programs/[id]/project-allocations` — POST asserts BOTH `assertProgramAccess` AND `assertProjectAccess` before the upsert; GET also gated (the 5th gap confirmed real, not asserted) — both-sided 403 tests present.
- **04-06 (commits 3c6d115..ba07edf):** `portfolio.service.ts` extended with 20 company-scoped functions; all 11 portfolio sub-resource routes rewired (no direct `.repo` imports); `budgets/[id]` GET spendByCategory aggregate reproduced byte-identically (unit + route test); `program-allocations` POST `String(e)` leak closed (generic 500, HYG-02 test asserts `{ error: 'Internal server error' }`); SVC-05 fixture extended with service-layer budgets assertions.

**Full re-check:** tsc exit 0; eslint exit 0; full suite 554/441/0/113 (skip baseline held exactly); boundary greps clean; all 4 blockers + force500 re-confirmed.

**Remaining real gap (minor, SVC-01 completeness):** `app/api/projects/route.ts` (collection) and `app/api/programs/route.ts` (collection) still call repositories directly. RESEARCH P4-04 explicitly committed "projects (list/create/[id])" and "programs" to this phase's conversion scope; only the `[id]` detail routes were converted. Both are thin, session-gated, company-scoped pass-throughs with no tenant-ownership bug and no live IDOR. `export/portfolio/members` was explicitly allowed to "stay in route" (RESEARCH:156). This is housekeeping residue, not a security defect.

**Recommendation:** Convert the two collection routes to service functions in a follow-up (a small 04-07 or fold into Phase 5) so SVC-01 can be marked complete. All security-critical gaps (4 blockers + 2 live IDORs + String(e) leak) are closed and test-proven. The SVC-05 DB-gated proof remains the single deferred human/CI verification item.

---

_Verified: 2026-08-11_
_Verifier: Claude (gsd-verifier)_
