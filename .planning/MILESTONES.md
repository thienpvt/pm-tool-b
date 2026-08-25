# Milestones

## v1.0 Layer Reorg & Hardening (Shipped: 2026-08-25)

**Phases completed:** 8 phases, 35 plans, 80 tasks

**Key accomplishments:**

- All remaining route and export-service SQL now sits behind repository boundaries, with explicit company scope and admin-bypass tests for the company-level repositories.
- Portfolio/report/roadmap GET orchestration extracted into company-scoped services; project report GETs gain assertProjectAccess; SVC-05 proven with two-tenant DB fixture asserting rollup totals.
- Deleted the last two file-local access-control copies (`checkAccess` in `projects/[id]`, `authorize()` in three nested budget routes), routed both through new services, and closed two confirmed-live IDORs — a read IDOR on portfolio epics and a write IDOR on program-project allocations (plus an adjacent read leak found while fixing it).
- Wired all 11 portfolio sub-resource routes (budgets, members, milestones, program-allocations, quota) onto a company-scoped `portfolio.service.ts`, and replaced a confirmed `String(e)` internal-error leak on `program-allocations` POST with the generic `serviceErrorResponse` 500.
- Built `lib/http/` wrapper trio (withAuth, withProjectAccess, withProgramAccess), flipped `assertProjectAccess` to return the project row, and converted `risks/route.ts` to the one-line-per-handler reference shape — the tracer every subsequent Phase 5 route conversion repeats.
- Converted all 17 remaining `app/api/projects/[id]/
- Wired Zod `safeParse` validation into all 12 tree-A `projects/[id]/
- withAuth gains opts.rawBody (skip auto-parse for formData routes) and a per-request ACCESS_ENFORCEMENT shadow flag; withProjectAccess/withProgramAccess wire assert-only shadow-deny re-entry so future Phase 6 plans can gate new denials without a code change.
- Closed the last 8 genuinely-anonymous multi-tenant routes (bug-import-mapping, import-mapping, jira/jql-presets, jira/sync-mappings, parse-file-headers) with `withAuth`, including 3 anonymous bare-id destructive DELETEs, while leaving `app/api/config/route.ts` untouched per the 06-04 ownership reassignment.
- The 3 stragglers Phase 5 didn't reach — report, project-report, and project-report/generate-email — now go through withProjectAccess, closing ROUTE-03's full projects/[id]/
- withProgramAccess gets its first 3 consumers — programs/[id] and its project-allocations sub-route move onto the Phase 5 wrapper, and the company-scoped portfolio/program-allocations lands on plain withAuth, with the T-04-22 inline body-field assert on project-allocations POST kept exactly where it was.
- Single table-driven, drift-checked 401 spec covering all 80 non-public `app/api/
- `06-PROXY-FINDING.md` records that `proxy.ts` **does execute** in the standalone runtime. Empty `sortedMiddleware` is a red herring; live curl is 307 to `/login?from=...`. Route-level wrappers remain the session-validity + JSON 401/403 layer.
- app/page.tsx decomposed into usePortfolioDashboard hook, 16 _components modules, 129-line container, and passing jsdom component tests
- 2655-line portfolio report god page split into usePortfolioReport hook, 19 sub-400-line modules, and vitest component tests
- 1838-line timeline god page split into useTimelinePage hook, 14 sub-400-line modules, and passing vitest component tests
- 1346-line project report god page split into useProjectReport hook, 15 sub-400-line modules, and vitest component tests
- 1182-line milestones god page split into useMilestonesPage hook, 8 sub-400-line modules, and passing vitest component tests
- 1141-line portfolio roadmap god page split into useRoadmapPage hook, 12 sub-400-line modules, 233-line container, and passing jsdom component tests
- Shared ImportMappingDialog decomposed in place under components/timeline/ with useImportMapping hook, step modules, and mock-fetch component tests
- Automated gate confirms UI-09 clean imports, 400-line caps, colocated hooks, 727 tests green, and tsc zero errors — ready for /gsd-verify-work UAT
- Gated deletion of dead inline Jira credential paths after cutover script exit 0 (vacuous zero-row + anthropic match: yes)

**Closeout type:** verified_closeout (8/8 phases verified, 54/54 requirements checked off)

**Known tech debt (accepted at close):** non-core routes still call repos (SVC-01/ROUTE-05 remainder); HYG-02 Anthropic 502 vs 500 operator confirm; proxy.ts HTML-307 for API callers; search-route debug log / unguarded `req.json()`; Nyquist VALIDATION.md files remain `draft`. See [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md).

---
