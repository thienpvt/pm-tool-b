# Milestones

## v2.0 Portfolio One View (Shipped: 2026-08-26)

**Phases completed:** 10 phases, 40 plans, 99 tasks

**Key accomplishments:**

- Company-scoped timeline import mappings with migrateMappingTableTenancy, service tenant assert, and Vitest 403/list/create coverage (TENANT-01 tracer on timeline_import_mappings)
- Company-scoped bug_import_mappings with migrateMappingTableTenancy registration, service tenant assert, per-company cap eviction, and Vitest 403/list/create coverage (TENANT-01 wave 2)
- Company-scoped jira_jql_presets and jira_sync_mappings with migrateMappingTableTenancy, jira-mapping.service tenant assert, scoped sync eviction, and Vitest 403/list coverage (TENANT-01 wave 3 — completes all four mapping tables)
- Roles schema in getDb, login status gate, SessionUser.roles on AccessActor, and Viewer createRisk 403 — end-to-end authorization spine before expanding mutators
- In-place session extend via UPDATE expires_at (same pm_session cookie), logout/mid-session invalidation tests, and /api/auth/me exposing roles and status
- Removed global admin project bypass; CPMO is company-scoped, PM uses D-14 interim assignment on read/write/list, createProject is CPMO-only
- Nested project mutators for risks, issues, milestones (including epic link/unlink), and activities (including import) now call assertProjectWriteAccess so Viewer and unassigned PM are denied server-side
- CPMO-scoped user service with unique credentials, multi-role union, lock/unlock/deactivate audit trail, and thin /api/admin/users split from platform break-glass routes
- Nested project mutators for meetings, team, bugs (replaceSnapshot/deleteBugs), and escalations (updateEscalation) now call assertProjectWriteAccess so Viewer and unassigned PM are denied server-side
- Nested project mutators for holidays, documents (upsertDocument/updateDocument/deleteDocument), budget, budget-items, and expenses (createExpense/deleteExpense) now call assertProjectWriteAccess so Viewer and unassigned PM are denied server-side
- Six AI report/email POST routes now enforce AUTH-05: project paths use assertProjectWriteAccess; portfolio paths require CPMO via isCpmo before Anthropic or Resend
- assertCompanyWrite plus company-scoped program/portfolio/roadmap lists; CPMO-only writes on allocations POST and POST resource-audit (D-24)
- D-19 role-matrix test plus toAccessActor peel on all leftover portfolio/programs two-field actors (D-24)
- CPMO company user management in /admin Users tab plus Sidebar Admin Panel link without break-glass; platform Companies/Demo stay on is_admin only
- migrateProjectMaster in getDb loop with per-company case-insensitive project_code unique index and CPMO create validation for code, portfolio year, and in-company program
- Pure governance helper with L5/terminal warning-not-block defaults wired into PATCH/create; CPMO in-place project_code UPDATE with auditLog
- CPMO nested pm-assignments with D-12 invariants; all three PM access sites wired to hasActivePmAssignment; D-14 backfill idempotent
- Nested stakeholders API with exported listProjectStakeholders, soft-end history, D-18 singleton roles, and write-access-gated mutations
- Create and detail screens expose project_code, portfolio_year, L0–L5 governance fields, and nested PM assignment / stakeholder lists — server tests remain the gate (D-20).
- migrateRaidMasters boot DDL, cancel-in-place milestones with auditLog on HTTP DELETE, and company-scoped upcoming/overdue list helpers with plan_end/end_date dual-write
- Unique R-nnn/I-nnn RAID codes with ConflictError 409, deactivate-in-place with audit, and HTTP DELETE preserved at 200 { ok: true }
- Append-only due-date history, overdue-flagged severity-ordered RAID registers, and company-scoped High RAID record counts plus technology-council issue lists via raid-masters.service
- CPMO weekly periods with UTC ISO week bounds, frozen config snapshots, transactional obligated shells, and withCpmo routes — parallel to v1 activity reports
- Versioned weekly report draft/submit/correct API with read-only prev-week RAG, immutable first lateness, and newest-first history — no RAID master writes on PATCH
- Submit validates multi-field RAID, writes masters through existing services, locks RAID/milestone snapshots, copies progress_pct without write-back, and syncs RAG only when changed — plus company-scoped listPeriodShells and access tests.
- Company-scoped GET tracking with period-wide counts, version RAG grid, live tech-council filter flag, and weekly_export_logs DDL
- CPMO POST export/preview with caller-ordered snapshot sections, SubmitValidationError eligibility gate, and assembleSnapshotSections exported for 14-03
- Snapshot-driven xlsx/docx/pptx consolidated packs with append-only weekly_export_logs and auditLog weekly_export on POST export
- Parallel fiscal ledger spine: integer-VND POST/GET/PATCH with computed metrics and append-only adjustments, wired after weekly migrate
- Financial/nonfinancial benefits API with NULL-vs-zero actual contract and year-level ROI GET that returns insufficient instead of fake 0%
- Bidirectional project dependencies with overlap validation, soft-end via effective_to, auditLog on create/end, and listOpenProjectDependencies for Phase 16
- Parallel GET /api/dashboards/portfolio with live-master KPIs, AND filters, matching drill-downs, and dashboard_filter_state DDL — v1 /api/portfolio untouched
- CPMO portfolio filter upsert per user+surface, clear/defaults to {}, and xlsx/pdf export with dashboard_export audit trail
- Assignment-scoped PM dashboard with weekly/milestone/RAID action queues, deep-link hrefs, live refresh, and pm-surface filter persist via withAuth
- Parallel document catalog spine with settings-flag DDL, CPMO catalog API, idempotent generateProjectChecklist helper, and explicit apply_to_in_flight backfill — legacy diary untouched.
- Versioned HTTPS document templates with CPMO upload/replace/retire, plus PM checklist PATCH enforcing Confluence HTTPS links and approved/N/A status rules
- Checklist generation on create/stage change, structured 409 mandatory-incomplete warnings, and CPMO document-compliance GET with dashboard filters
- Company-scoped GET /api/audit with assertCompanyWrite, SQL tenant filter, limit cap 50/200, and immutability source-scan — insert path unchanged
- createRisk/createIssue and general updateRisk/updateIssue append actor/time/entity/before-after via auditLog; entity_type stays risk and issue (D-02 RAID half closed)
- Append-only auditLog on project master CRUD, milestone create/update, and all six document-checklist PATCH fields with D-03 before/after snapshots

**Closeout type:** verified_closeout (10/10 phases verified, 79/79 requirements checked off)

**Known tech debt (accepted at close):** `workflow.ui_phase` false — no React consumers for dashboards/weekly/checklist/audit APIs; D-23 leftover ops/admin; parallel v1 `budget_items`; Nyquist VALIDATION.md remains `draft`; DATA/ENF/PERF deferred. See [v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md).

---

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
