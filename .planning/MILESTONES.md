# Milestones

## v2.1 Hardening & Deferred Debt (Shipped: 2026-08-29)

**Phases completed:** 9 phases, 56 plans, 151 tasks

**Key accomplishments:**

- Checksum-ledger migrate engine with advisory lock, assertMigrated boot guard, and tsx CLI — origin pattern ported without v1.0 baseline SQL
- Regenerated three-part 0001 baseline from live v2.0 schema with RAID backfill-before-indexes ordering and content integrity tests
- Boot UPDATEs and v2.0 backfills relocated to tsx operator scripts with runFix runner and content integrity tests — not on getDb boot path
- getDb connect-assert-seed only with Docker/CI/K8s migrate-before-start — dual writers eliminated
- Jira search POST uses withAuth + schema for Invalid JSON 400 and drops the custom-field debug log (JIRA-01, D-03)
- Local ESLint rule with JSON allowlist gates project-scoped route.ts handlers; CI runs scoped npm run lint after npm ci
- Operations systems collection and [id] routes rewired through operations.service with D-23 session+tenant break-glass unchanged
- Six nested budget/expense/incident operations routes rewired through 20-04 service helpers with D-23 session gate unchanged
- admin-platform.service backs companies, demo-requests, and resource-audit with D-23 break-glass requireAdmin unchanged on companies
- Domain services for settings, jira-config, and rag-config with thinned routes; import-mapping family verified already THIN (D-06)
- Module-based Spec dashboard at `/dashboards/portfolio` with six Phase 16 KPI tiles, role-gated Sidebar links, and NIT-04 fiscal omission.
- Portfolio spec dashboard AND filters persist via Phase 16 PUT/POST routes with Apply/Clear/Reset chrome, refreshing refetch, and in-page 401/403/5xx Copywriting panels.
- Spec portfolio dashboard shows CSS stage/RAG charts, filtered project table, KPI tile drill-downs with id-based links, and server xlsx/pdf export via downloadBlob.
- My dashboard at `/dashboards/pm` with weekly, milestone, and RAID queues deep-linking via server hrefs, AND filters, and live refetch on tab focus.
- CPMO weekly periods list via module re-export, in-repo VirtualRows window, and role-gated Sidebar NAV links
- CPMO can save company weekly due schedule and create ISO-week periods from /weekly/periods using existing config and POST APIs
- CPMO tracking page with shareable periodId query, six count chips, filter bar, and VirtualRows grid with ordered checkbox selection
- CPMO export pack POSTs checkbox-ordered project_ids via downloadBlob with xlsx/docx/pptx format Select and no preview UI
- PM weekly report editor with Phase 16 path re-export, debounced draft PATCH, submit/correct POSTs, and single-column stacked form
- CPMO document catalog GET page with module re-export, shared types/fixtures, and role-gated Sidebar Catalog/Compliance/Audit links
- CPMO catalog mutations and URL-only template panel on /documents/catalog using existing API routes, apply_to_in_flight checkbox, and sonner toasts
- PM checklist page with GET/PATCH against existing APIs, inline editor with singular field errors, and project-hub entry card.
- CPMO document compliance UI with GET-only filters, checklist links, and weekly VirtualRows window above 100 projects
- CPMO audit log at `/audit` with filterable GET, expandable before/after JSON as safe pre text, and VirtualRows above 100 collapsed rows
- Dashboards backend module split with P2 API shells, S1/S2 service/repo moves, and contract tests proving P1/P2/P6 patterns for Wave 1
- Audit backend module split with P2 GET /api/audit shell, S1/S2 service/repo moves, and exhaustive importer retargets preserving withCpmo auth
- Weekly backend moved to modules/weekly/backend with P2 weekly-periods shells and P3 wrapper-stays for project-scoped weekly-reports and export routes.
- Document catalog, templates, compliance dashboard, and project checklist APIs moved to modules/documents/backend with P2 re-exports and P3 wrapper-stays (ENF-01)
- Portfolio v1 UI and backend moved to modules/portfolio with P1 page shells, P2 API re-exports, and P3 program-id wrappers preserving ENF-01
- Projects UI and backend moved to modules/projects with P1 page shells, P2 list API shell, and P3 withProjectAccess wrappers on all owned project-scoped routes.
- Reports module owns portfolio/project report UI and backend with D-11 /portfolio/report P1 shell, P2 portfolio APIs, and P3 withProjectAccess export wrappers
- Jira sync/import dialogs and all jira/import APIs moved into `modules/jira` with P2 re-export shells and P3 resource-plan wrapper preserved in `app/api`.
- Admin UI and all /api/admin handlers moved into `modules/admin` with P1 page shell, P4 companies auth preserved (D-07), and P2 re-export shells for remaining routes.
- Operations UI and all /api/operations/
- Single-pool Kysely factory with hand-authored Database types and audit repo tracer proving typed queries on the existing pg.Pool
- Runtime pickAllowed allowlist mirroring UnknownColumnError plus ALS-bound Kysely joining runInTransactionOnPool BEGIN/ROLLBACK
- Dashboard filter state, auth.repo user CRUD, and settings kv repos converted to getKysely with testKysely mocks
- Five admin repos converted to getKysely with isAdmin scoping preserved and company_id PK upserts
- Three documents module repositories converted to getKysely with colocated integration tests and company/project scoping preserved
- Jira import-mapping and operations repositories converted to getKysely with company-scoped mappings and isAdmin operations list filter preserved
- Three portfolio repos converted to getKysely with TDD red-green commits; company tenant filters preserved on programs and resources
- 725-line portfolio.repo.ts converted to getKysely in three TDD slices with company-scope tests preserved
- Weekly periods and export logs on getKysely with createPeriodWithShells still joining runInTransaction ALS (D-05, D-06, W8)
- weekly-reports.repo.ts fully on getKysely with insertShell joining ALS inside createPeriodWithShells
- Six non-allowlist project repositories (budget, bugs, documents, holidays, financial-benefits, milestones) query through getKysely with testKysely mocks
- Six remaining W9a project repos converted to getKysely with overlap predicates, append-only raid history, and runInTransaction replacing ad-hoc Pool in pm-assignments
- Three project write repos converted to getKysely with pickAllowed-guarded PATCH paths preserving UnknownColumnError mass-assignment semantics (ENF-02, D-04, W9b).
- Four remaining allowlist writers converted to getKysely with pickAllowed PATCH guards; HTTP 400 UnknownColumnError chain verified via with-auth tests
- Filesystem gate test proves all production repos use getKysely; buildUpdate SET helper removed while UnknownColumnError and pickAllowed remain
- Server PageChrome owns static shell on four pilot routes; client Sidebar and module pages render content only (PERF-02)
- Server PageChrome wrappers for 28 remaining Sidebar routes; login, landing, operations, and portfolio/budget unchanged
- Vitest p95 benchmark for getDb() connect+assert+seed with recorded COLD-START.md budget (2000ms target, 5000ms CI fail)
- Vitest node contract test locks listPeriodShells and listOpenProjectDependencies exports plus documented consumers via static imports and source scans (D-01, D-06).
- Local snapshotsEqual guard on updateMilestone skips audit_logs on identical auditSnapshot; real field changes and create/cancel still audit
- Budget coexistence documented, operator 502 accepted on record, and Phases 19/26/27 VALIDATION.md reconciled without report-route or milestone-archive edits.

**Closeout type:** verified_closeout (9/9 phases verified, 28/28 requirements checked off)

**Known tech debt (accepted at close):** D-23 leftover ops/admin session+tenant; PageChrome + inner `100vh` may double-scroll; `listOpenProjectDependencies` locked by tests not a dashboard. See [v2.1-MILESTONE-AUDIT.md](milestones/v2.1-MILESTONE-AUDIT.md).

---

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
