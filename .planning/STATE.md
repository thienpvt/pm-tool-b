---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 04
current_phase_name: Service Layer
status: ready_for_verification
stopped_at: Completed 04-06-PLAN.md (gap closure — portfolio sub-resources onto the service)
last_updated: "2026-08-11T00:00:00.000Z"
last_activity: 2026-08-11
last_activity_desc: Plan 04-06 — wired 11 portfolio sub-resource routes onto portfolio.service.ts; fixed String(e) leak on program-allocations POST
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 14
  completed_plans: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-07)

**Core value:** Every project-scoped request is tenant-isolated and every layer has one job — so a new route or page cannot silently reintroduce IDOR or a 2000-line god component.
**Current focus:** Phase 04 — Service Layer

## Current Position

Phase: 04 (Service Layer) — READY FOR VERIFICATION
Plan: 6 of 6 (all plans complete, including 04-05 and 04-06 gap closure)
Status: 04-06 done — suite 554 total / 441 passed / 0 failed / **113 skipped** (baseline held from 04-05)
Last activity: 2026-08-11 — Plan 04-06 gap closure: wired all 11 portfolio sub-resource routes (budgets, members, milestones, program-allocations, quota) onto portfolio.service.ts with company scoping; fixed the confirmed String(e) leak on program-allocations POST (T-04-27/HYG-02)

Progress: [██████████] 100% (phase 04 plans complete; await verify)

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 1 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01-test-harness P01 | 45m | 8 tasks | 10 files |
| Phase 03-integration-clients P03-01 | 38 | 4 tasks | 7 files |
| Phase 03 P02 | 25 | 3 tasks | 5 files |
| Phase 03-integration-clients P03 | 40 | 3 tasks | 12 files |
| Phase 03-integration-clients P03-04 | 55 | 4 tasks | 8 files |
| Phase 04 P01 | 5 | 6 tasks | 10 files |
| Phase 04 P04 | 11min | 5 tasks | 15 files |
| Phase 04 P05 | 24min | 5 tasks | 19 files |
| Phase 04 P06 | 55min | 6 tasks | 18 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: bottom-up layer order settled by dependency, not preference — repositories → integrations → services → route thinning → enforcement rollout → UI. Do not reorder.
- Roadmap: access enforcement split into two phases (5: build wrapper, 6: roll out) specifically to allow shadow-mode logging before hard enforcement, avoiding a 403 storm.
- Roadmap: HYG-01/02/03 treated as cross-cutting execution conventions applying to every phase, not a standalone phase.
- [Phase ?]: zod ^4.4.3 promoted to direct dependency for integration-client boundary validation (INTG-05/06)
- [Phase ?]: withFetchTimeout races the promise against its own abort signal; timedOut flag distinguishes timeout (kind timeout) from caller abort (kind network)
- [Phase ?]: Anthropic resolver adopts env || db treating empty-string env as unset (INTG-08, the only intentional normalization)
- [Phase ?]: Cutover script runs via npx tsx, not plain node (node 25 cannot resolve the @/ alias); documented in 03-01-SUMMARY
- [Phase ?]: withFetchTimeout gains optional service label (default 'jira') so non-Jira clients stamp correct service on timeout/network errors
- [Phase ?]: Resend upstream errors always map to 502 regardless of upstream status (behavior freeze, Pitfall 5)
- [Phase ?]: Resend 2xx schema requires id with passthrough — id-less 200 is validation error, never partial messageId (T-03-07)
- [Phase ?]: Zod validates the FOUND text block (not the whole content array) — heterogeneous ContentBlock[] like [thinking,text] must pass, so the schema is applied after the .find scan
- [Phase ?]: SDK maxRetries left at default (2) per orchestrator — documented in a client comment, no per-route note needed
- [Phase ?]: Jira upstream message stamped on IntegrationError.message AND cause so route-level e.message rendering and the mapper pass-through both reproduce the preserved string
- [Phase ?]: Test route keeps ok:false wrappers for upstream/network (behavior freeze) — route-level handling wins where shapes differ from the shared mapper
- [Phase ?]: Fields route keeps its two 503 strings (Jira chưa cấu hình vs Thiếu env vars) via config-row presence check; resolver null collapses both
- [Phase ?]: INTG-08 cutover deletion BLOCKED (no DATABASE_URL) — old inline Jira credential blocks preserved as marked dead code so HYG-01 stays a dedicated gated commit
- [Phase ?]: ForbiddenError body is always { error: 'Forbidden' } — message never crosses the wire
- [Phase ?]: deleteRisk treats changes===0 as NotFoundError so the route yields 404 rather than {ok:true} on a miss
- [Phase ?]: Risks route tests mock repos (default tier) so skip count stays 109 without TEST_DATABASE_URL
- [Phase ?]: Extract portfolio/roadmap inline RAG verbatim; reconcile vs calculateRAG is HYG-02
- [Phase ?]: project-report companyRagConfig(project.company_id) behavior freeze (not session company)
- [Phase ?]: Report POST AI handlers stay in routes; force500:true preserved
- [Phase ?]: T-04-21/22 live IDORs closed: epics read gated via assertProjectAccess; program-project-allocations POST gated on BOTH program and project ownership (GET read-leak also closed)
- [Phase ?]: checkAccess/authorize file-local copies deleted from projects/[id] and the three nested budget routes; unified on assertProjectAccess via new projects.service.ts and budget-items.service.ts (cross-company 401->403 on the budget routes, HYG-02)
- [Phase 04-06]: Budget/member/quota/allocation repo functions take only companyId (no is_admin all-companies branch, unlike listPortfolioProjects/listPortfolioMilestones) — services preserve this Phase 2 baseline rather than expanding admin reach
- [Phase 04-06]: portfolio/program-allocations POST String(e) leak fixed (T-04-27) — createProgramAllocation lets errors propagate untouched so the route's serviceErrorResponse maps any failure to the generic 500

### Pending Todos

None yet.

### Blockers/Concerns

- Whether `proxy.ts` executes in the deployed Docker runtime is unconfirmed (ROUTE-11, Phase 6) — treat as open, do not build route-level enforcement as if it depends on proxy.ts working.
- INTG-08 credential cutover deletion DEFERRED (accepted by user 2026-08-10): no reachable DATABASE_URL, so scripts/verify-credential-cutover.ts evidence could not be gathered. Old inline Jira credential blocks preserved as marked, unreachable dead code in app/api/jira/search/route.ts + fields/route.ts. Operator: set DATABASE_URL, run npx tsx scripts/verify-credential-cutover.ts, land HYG-01 deletion commit when all rows match: yes. Not phase-blocking — all three routes call the resolver on their live paths.
- HYG-02 behavior change awaiting operator confirmation (Phase 3): a malformed Anthropic response on the three report routes now returns 502 where it returned 500. Deliberate — INTG-06 forbids a 500 for a shape mismatch, and validation is an error kind Phase 3 introduced so it had no prior behavior to freeze. Confirm no dashboard or alert keys off the old 500.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Data Layer | DATA-01, DATA-02, DATA-03 (migration tooling) | v2 | 2026-08-07 |
| Enforcement | ENF-01, ENF-02 (ESLint gate, Kysely adoption) | v2 | 2026-08-07 |
| Performance | PERF-01, PERF-02, PERF-03 | v2 | 2026-08-07 |

## Session Continuity

Last session: 2026-08-11T00:00:00.000Z
Stopped at: Completed 04-06-PLAN.md (gap closure — portfolio sub-resources onto the service)
Resume file: None
