# Project Research Summary

**Project:** PM Tool B — Portfolio One View (v2.0)
**Domain:** Bank PPM / enterprise portfolio management on brownfield Next.js 16
**Researched:** 2026-08-25
**Confidence:** HIGH

## Executive Summary

PM Tool B v2.0 is not a greenfield build — it is a **spec-compliance pass** on a validated v1.0 stack (Next.js 16.2.4, React 19, PostgreSQL/`pg`, route→service→repository layers, Vitest 4). The GuiIT Portfolio One View spec defines a bank-grade PPM product: three fixed roles (CPMO / PM / Viewer), L0–L5 project lifecycle, a RAID register as single master with immutable weekly-report snapshots, CPMO-owned reporting periods, and Confluence-only document compliance. Enterprise PPM tools (Planview, Clarity, Smartsheet PMO templates) converge on the same shape; this spec is tighter on governance, audit, and snapshot immutability than generic PPM.

The recommended approach is **additive brownfield extension**: keep the v1.0 stack and integrations (Jira, Anthropic AI, Excel/PPT/Word export); add one runtime dependency (`date-fns` for period math); extend authorization from `is_admin + company_id` to multi-role union with project-scoped PM assignment; introduce new tables for weekly-report versions, snapshots, audit, and PM assignments; and build a **parallel weekly-report product surface** — not an enhancement of the existing activity-weighted report pages. Jira/AI/export remain differentiators alongside spec compliance, never substitutes for PR-11 structured submit.

The highest risks are authorization migration (naive `is_admin` → CPMO swap leaks cross-tenant data), RAID/report divergence (second source of truth if snapshots are skipped), and submitted-report mutability (current document PUT overwrites history). Mitigate with route-by-route role migration, master-register + snapshot-on-submit transactions, versioned immutable submit, typed ROI (`insufficient_data` not 0%), soft-delete everywhere, and server-side authz tests per role before any UI ships.

## Key Findings

### Recommended Stack

v1.0 stack is fixed — do not swap frameworks, ORMs, or auth libraries. v2.0 adds **schema patterns and one npm package**, not a replatform.

**Core technologies (unchanged):**
- **Next.js 16.2.4 / React 19.2.4** — extend routes/services on validated App Router layers
- **PostgreSQL + `pg` ^8.20** — relational integrity, JSONB snapshots, BIGINT VND amounts (string in TS, never `parseInt8`)
- **Zod ^4.4.3** — extend boundary schemas for roles, email, Confluence HTTPS URLs
- **Node `crypto` + scrypt sessions** — extend session payload with roles/status; no next-auth
- **Vitest 4** — RBAC 403 matrix, snapshot immutability, ROI edge cases (HYG-03 gate)

**Stack additions:**
- **`date-fns` ^4.4.0** — CPMO weekly period bounds, ISO week IDs, fiscal-year labels; replace ad-hoc `getWeekBounds()` math
- **PostgreSQL schema patterns** — `user_roles` multi-role union; `weekly_report_periods` / `weekly_report_submissions` / immutable JSONB snapshots; append-only `audit_logs`; `BIGINT` budget columns; `company_id` on four mapping tables (TENANT-01)

**Explicitly avoid:** CASL/accesscontrol/casbin (3 static roles), Prisma/Drizzle/Kysely, decimal.js (integer VND), multer/S3 (no file upload), json-diff libraries, background job queues.

### Expected Features

**Must have (table stakes — missing or wrong shape today):**
- **PR-01/PR-02** — CPMO/PM/Viewer multi-role union, account lifecycle (Active/Inactive/Locked), server-side authz on every route
- **PR-03** — L0–L5 project master, status/RAG coupling, weekly-report obligation flag
- **PR-04** — Primary PM + collaborators with history; assignment drives PM scope
- **PR-07** — Milestone overdue/upcoming rules + snapshot immutability after report
- **PR-09** — RAID register as master; draft buffer syncs to master on submit only
- **PR-10/PR-11/PR-12** — CPMO period config, PM structured submit with versioned snapshots, late/on-time tracking & consolidation
- **PR-13/PR-14** — Spec-defined portfolio KPIs and PM action queue dashboards
- **PR-08** — Fiscal-year budget, adjustment ledger, ROI with `insufficient_data` state
- **PR-05/PR-15** — Stakeholders with effective dates; Confluence checklist (no binary upload)
- **TENANT-01** — `company_id` on four global mapping tables

**Should have (spec-included, sequenced after foundation):**
- **PR-06** — Cross-project dependencies (bidirectional display, validity windows)
- **Retained differentiators** — Jira import, AI report generation, Excel/PPT/Word/PDF export (parallel to spec weekly reports, not replacement)

**Defer (explicitly out of v2.0):**
- DATA-01..03 migrations out of `getDb()`, ENF/PERF packs, ops-route service thinning
- Generic custom fields, in-app document storage, activity-weighted % as official PMO progress
- Full PPM suite replacement (ERP, agile boards)

**Anti-features to reject:** in-app file upload (PR-15), second editable RAID copy, in-place submitted report edits, backfilling weekly obligations retroactively, UI-only authorization.

### Architecture Approach

Extend v1.0 layer conventions — no new top-level folders. Authorization composes on existing `withAuth` / `withProjectAccess`; new domains get dedicated `*.service.ts` + `*.repo.ts` files (weekly reports, PM assignments, audit, document templates). Three core patterns govern v2.0: **(1) master register + snapshot on submit** for RAID/milestones; **(2) role gate composition** (CPMO company-wide, PM write on assigned projects, Viewer read-only); **(3) company-scoped mapping tables** with repo-first `companyId` filter.

**Major components:**
1. **`lib/services/access.ts` + new HTTP wrappers** — role asserts, `assertPmWriteAccess`, CPMO-only routes; single enforcement point for 28+ existing routes
2. **`weekly-reports.service.ts` + `raid-snapshots.service.ts`** — draft/submit state machine, atomic snapshot copy on submit, immutable version reads for export
3. **`audit.service.ts`** — append-only mutation log with before/after JSONB; wired at service layer after successful writes
4. **Extended master repos** — `projects.repo` (L0–L5 columns), `risks`/`issues`/`milestones` (deactivate not DELETE), `import-mapping`/`jira-config` (TENANT-01 scope)

### Critical Pitfalls

1. **`is_admin` → roles migration breaks admin/ops paths** — Use explicit `isPlatformAdmin` vs `isCPMO(companyId)` vs `isPM(projectId)`; migrate route-by-route; never map CPMO → global `is_admin`
2. **Weekly report becomes second RAID source of truth** — Master register edits only on risks/issues pages; submit copies snapshot; export reads snapshot never live RAID
3. **Submitted report overwrite via PUT** — Separate `weekly_report_versions` with immutability; corrections = new version; first-submit timestamp preserved for late tracking
4. **ROI displays 0% instead of insufficient data** — Typed `{ value, status }` in service; never `?? 0` on null benefits/cost
5. **Physical delete of users/milestones referenced in snapshots** — Soft-delete + reference guard; denormalize display names into snapshot at submit
6. **TENANT-01 migration without backfill/unique-key change** — Nullable → backfill → NOT NULL → `UNIQUE(company_id, name)`; never default all rows to company 1
7. **UI-only role hiding without API enforcement** — Viewer POST → 403 tests in same plan as UI; `authorize()` at top of every mutator
8. **PM assignment replaces company check** — Every query applies both `company_id` and assignment filters unless CPMO portfolio view

## Implications for Roadmap

v1.0 shipped Phases 1–8. v2.0 continues numbering at **Phase 9**. Critical path: **TENANT-01 → PR-01/02 → PR-03/04 → PR-07/09 → PR-10/11 → PR-12 → PR-13/14**. Audit log wires incrementally from Phase 10 onward; complete coverage by Phase 18.

### Phase 9: TENANT-01 — Mapping Table Tenant Isolation
**Rationale:** Independent security closure; no product dependency on roles but needs stable `company_id` session context (deploy after or alongside Phase 10 PR-02). Closes cross-tenant IDOR on Jira/timeline import config.
**Delivers:** `company_id` on `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, `jira_sync_mappings`; backfill migration; repo/route scoping; cross-company tests.
**Addresses:** TENANT-01
**Avoids:** Pitfall 7 (global rows after migration), mapping table IDOR

### Phase 10: PR-01 + PR-02 — Users, Roles & Server Authorization
**Rationale:** Foundation for every other PR-ID. Role union and account states are meaningless without enforcement; dashboards and weekly submit on current `is_admin` model will leak data.
**Delivers:** `user_roles` table; Active/Inactive/Locked lifecycle; soft-delete users; `SessionUser.roles[]`; `withRole` / extended `access.ts`; login lock/inactive checks; Viewer/PM/CPMO route tests.
**Addresses:** PR-01, PR-02
**Avoids:** Pitfalls 1, 8, 10 (auth foundation, UI-only authz, tenant+role regression)

### Phase 11: PR-03 + PR-04 + PR-05 — Project Master, PM Assignment & Stakeholders
**Rationale:** Data model anchor — L0–L5, RAG rules, and weekly-report flag drive obligation engine (PR-10), dashboard KPIs (PR-13), and document checklists (PR-15). PM assignment must exist before any PM-scoped write path.
**Delivers:** L0–L5 stage/status/RAG coupling with override audit; `weekly_report_flag` + start period; primary/collaborator PM assignment + history; `assertPmWriteAccess`; stakeholder effective-date records; resolve governance field duplication with PR-03.
**Addresses:** PR-03, PR-04, PR-05
**Avoids:** Pitfall 9 (silent RAG override), Pitfall 10 (assignment without company check)

### Phase 12: PR-07 + PR-09 — Milestones & RAID Master Register
**Rationale:** Master registers must enforce soft-delete and field rules **before** weekly submit snapshots reference them. Highest-risk integration (PR-09 ↔ PR-11) starts here with master half only.
**Delivers:** Milestone upcoming/overdue engine; soft-delete + "in submitted report" guard; RAID deactivate-not-delete; master CRUD rules; audit on master mutations. Snapshot tables deferred to Phase 13 but delete guards land now.
**Addresses:** PR-07 (master rules), PR-09 (master half)
**Avoids:** Pitfall 5 (physical delete), Pitfall 2 setup (master discipline before snapshots)

### Phase 13: PR-10 + PR-11 — Weekly Periods & PM Submit/Versioning
**Rationale:** Core PMO cadence — parallel product surface, not enhancement of activity-weighted reports. Period config gates auto-create; submit transaction spans versions + RAID/milestone snapshots atomically.
**Delivers:** `date-fns` period math; CPMO period CRUD with overlap validation; auto-create draft shells for obligated projects; draft/submit state machine (Chưa nộp/Nháp/Đã nộp); immutable JSONB snapshots; post-submit correction as new version; `project-report.service` split (live preview vs version read).
**Addresses:** PR-10, PR-11, PR-09 (snapshot half), PR-07 (snapshot half)
**Uses:** `date-fns`, JSONB snapshot tables, exceljs path prep for Phase 14
**Avoids:** Pitfalls 2, 3 (RAID divergence, report overwrite)

### Phase 14: PR-12 — CPMO Submission Tracking & Consolidated Export
**Rationale:** CPMO ops value depends on versioned submits from Phase 13; export must read snapshots only.
**Delivers:** Submission registry (on-time vs late locked to first submit); filter grid by period/status/PM/stage/RAG; tick-select consolidation; Excel/PPT/Word export from submitted version JSONB (extend existing export clients).
**Addresses:** PR-12
**Avoids:** Pitfall 2/3 export variants (live RAID recompute)

### Phase 15: PR-08 + PR-06 — Budget/Value/ROI & Cross-Project Dependencies
**Rationale:** Budget ROI typed results needed before dashboard consumption; dependencies are spec-included P2 — ship after core report path but before executive dashboards finalize all KPI sources.
**Delivers:** Fiscal-year budget rows; BIGINT VND amounts; append-only adjustment ledger; ROI `{ value, status: 'ok' | 'insufficient_data' }`; cross-project dependency entity with validation; optional portfolio dependency surfacing.
**Addresses:** PR-08, PR-06
**Avoids:** Pitfall 4 (ROI null → 0%)

### Phase 16: PR-13 + PR-14 — Portfolio & PM Dashboards
**Rationale:** KPIs and action cards lie if built before master data, assignments, and weekly obligation exist. Share query functions between portfolio and PM dashboards to prevent count drift.
**Delivers:** Spec-defined active count (Status Active AND L0–L4); RAG chart summing to active count; high RAID record counts; tech-council issue tile; drill-down with inherited filters; PM action queue (pending reports, overdue milestones, open RAID) scoped to assignment; role-filtered aggregates; dashboard export.
**Addresses:** PR-13, PR-14
**Avoids:** Pitfall 10 (PM sees unassigned projects), wrong RAG field on dashboards

### Phase 17: PR-15 — Document Templates & Confluence Checklist
**Rationale:** Likely conflicts with existing upload-oriented documents module — implement after core PMO path stable; requires CPMO role (Phase 10) and stage model (Phase 11).
**Delivers:** CPMO template CRUD with versioning; stage-based mandatory checklist generation; Confluence URL + metadata only (`z.url()` validation); compliance rollup; remove/replace binary upload path for spec document types.
**Addresses:** PR-15
**Avoids:** Pitfall 6 (file upload creep)

### Phase 18: Audit Log — Cross-Cutting Completion
**Rationale:** Incrementally wire `auditLog()` from Phase 10 onward; this phase completes coverage and verifies append-only integrity across all mutation services.
**Delivers:** `audit_logs` table; `audit.service.ts`; wiring on users, assignments, budget adjustments, RAID, submissions, master-data changes; query by company/entity/time.
**Addresses:** Spec audit requirement (cross-cutting)
**Avoids:** Missing actor context from trigger-only approaches

### Phase Ordering Rationale

- **Phase 9 early but after session company context:** TENANT-01 is parallel-safe and low-effort security win; pitfalls research recommends stable PR-02 company context before backfill — schedule Phase 9 immediately after or concurrent with Phase 10 PR-02 landing.
- **Auth before master before registers before weekly pipeline before dashboards:** Matches dependency graph in FEATURES.md and architecture critical path; weekly reports are a **new module**, not a refactor of existing report pages.
- **PR-05 grouped with PR-03/04:** Stakeholder governance overlaps project master fields — resolve single source of truth in one phase to prevent duplication.
- **PR-08/06 before dashboards, PR-15 after dashboards:** ROI typing must exist before PR-13 widgets; documents module is disruptive to existing UX and anti-upload — isolate last among product features.
- **Audit as capstone:** Service-layer hooks start in Phase 10; Phase 18 verifies completeness rather than blocking feature delivery.

### Research Flags

Phases likely needing `/gsd-plan-phase --research-phase` during planning:
- **Phase 13 (PR-10/PR-11):** Submit transaction design, draft RAID buffer UX, version immutability edge cases — highest integration complexity
- **Phase 11 (PR-03):** Exact L0–L5 transition matrix and RAG override rules — Word spec is local reference; field names need spec cross-check during planning
- **Phase 17 (PR-15):** Legacy documents module migration strategy (upload vs Confluence checklist coexistence)

Phases with standard patterns (lighter research):
- **Phase 9 (TENANT-01):** Well-understood tenant column pattern; mirror existing `listProjects(companyId)` 
- **Phase 10 (PR-01/02):** Extend existing `withAuth`/`access.ts`; Vitest 403 patterns established in v1.0
- **Phase 14 (PR-12):** Extend existing exceljs/pptxgenjs export pipeline to read version JSONB
- **Phase 18 (Audit):** Single INSERT helper pattern; no framework choice

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Additive on validated v1.0; one new dep; codebase-verified auth/report flows |
| Features | HIGH | GuiIT spec read directly; gaps mapped against live codebase |
| Architecture | HIGH | Layer placement and build order derived from codegraph + repo reads |
| Pitfalls | HIGH | Pitfalls verified against live services (`access.ts`, `documents.service.ts`, `import-mapping.repo.ts`) |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact L0–L5 field names and transition rules:** Word spec is local-only; plan Phase 11 with direct spec cross-reference during `/gsd-discuss-phase`
- **Draft RAID buffer UX:** Whether PM stages RAID changes in report draft vs edits master directly during draft period — spec says sync on submit; UI flow needs Phase 13 design decision
- **Platform ops vs CPMO split:** Legacy admin/ops routes (`operations/*`, `config`) need explicit mapping to break-glass ops account vs company-scoped CPMO during PR-02 migration
- **Existing documents module coexistence:** PR-15 may require schema split or feature flag — assess during Phase 17 planning, not before

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — v2.0 requirements PR-01..PR-15, TENANT-01, constraints
- `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` — parallel researcher outputs (2026-08-25)
- Live codebase: `lib/auth.ts`, `lib/http/with-auth.ts`, `lib/services/access.ts`, `lib/services/project-report.service.ts`, `lib/repositories/import-mapping.repo.ts`, `lib/services/documents.service.ts`
- GuiIT Portfolio One View business spec Draft 1.0 (20/08/2026) — local Word reference

### Secondary (MEDIUM confidence)
- Context7: `/brianc/node-postgres`, `/colinhacks/zod/v4.0.1`, `/date-fns/date-fns` — library behavior verification
- Broadcom Clarity PPM access-rights model — enterprise role scoping patterns
- Planview / PMI / Atlassian weekly status report conventions — table-stakes feature validation

### Tertiary (LOW confidence)
- RBAC library suitability (CASL/accesscontrol) — conclusion to skip is HIGH confidence; individual library feature claims are LOW

---
*Research completed: 2026-08-25*
*Ready for roadmap: yes*
