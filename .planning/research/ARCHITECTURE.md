# Architecture Research

**Domain:** v2.0 Portfolio One View — brownfield integration into existing Next.js 16 layered PPM app
**Researched:** 2026-08-25
**Confidence:** HIGH (layer placement, integration points, build order — derived from live codebase via codegraph + repo reads) / MEDIUM (exact spec field names — Word spec is local reference only)

## Standard Architecture

### System Overview (v2.0 target — layers unchanged)

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 client pages + decomposed hooks/modules)         │
│  app/**/page.tsx  ·  components/**  ·  app/**/_components/**       │
├─────────────────────────────────────────────────────────────────────┤
│  proxy.ts — pm_session cookie presence (HTML redirect only)         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ fetch('/api/...')
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ROUTE HANDLERS  app/api/**/route.ts                                 │
│  withAuth / withProjectAccess / withProgramAccess (+ new role gates) │
│  Zod at boundary → service call → NextResponse.json                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVICES  lib/services/*.service.ts                                 │
│  assertProjectAccess + NEW role/PM asserts + audit hooks            │
│  Orchestration: snapshot-on-submit, version immutability, ROI math    │
└──────────────┬──────────────────────────────┬───────────────────────┘
               ▼                              ▼
┌──────────────────────────────┐  ┌───────────────────────────────────┐
│  REPOSITORIES                │  │  INTEGRATIONS (unchanged)         │
│  lib/repositories/*.repo.ts  │  │  lib/integrations/{jira,         │
│  Column allowlists, scoped SQL │  │  anthropic,resend}/ + export/*   │
└──────────────┬───────────────┘  └───────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PostgreSQL via lib/db.ts (schema init + migratePostgresSchema)      │
│  NEW tables for roles, assignments, snapshots, versions, audit      │
└─────────────────────────────────────────────────────────────────────┘
```

**What stays:** Next.js 16 App Router, `pg` pool in `lib/db.ts`, cookie sessions in `lib/auth.ts`, route→service→repository on project-scoped paths, Jira/Anthropic/Resend clients, Excel/PPT/Word export engines.

**What changes:** Authorization model expands from `is_admin + company_id` to **CPMO / PM / Viewer** with **project-scoped PM assignment**; RAID/milestones/budget become **master registers** feeding **immutable weekly-report versions**; four global mapping tables gain **company_id** (TENANT-01).

## Component Responsibilities

| Component | v1.0 today | v2.0 responsibility |
|-----------|------------|---------------------|
| `lib/http/with-auth.ts` | Session, body parse, error tail | Same + expose `ctx.user.roles` when loaded |
| `lib/http/with-project-access.ts` | `assertProjectAccess` → `ctx.project` | Compose with PM/Viewer project gate |
| `lib/services/access.ts` | Tenant ownership via `company_id` | **Extend:** role asserts, PM-assignment assert, CPMO company scope |
| `lib/auth.ts` | `SessionUser` with `is_admin` | **Extend:** load roles union, account status, lock check at login |
| `lib/repositories/projects.repo.ts` | CRUD + `PROJECT_COLUMNS` allowlist | **Extend columns:** L0–L5, RAG, progress, weekly-report flag |
| `lib/repositories/risks.repo.ts` / `issues.repo.ts` | Live CRUD master register | **Extend:** soft-delete/no physical delete; snapshot read helpers |
| `lib/services/project-report.service.ts` | Live aggregation for report UI | **Split:** live preview stays; submit path writes version + snapshots |
| `lib/repositories/import-mapping.repo.ts` | Global timeline/bug mappings | **Modify:** all queries scoped by `company_id` |
| `lib/repositories/jira-config.repo.ts` | Global JQL presets + sync mappings | **Modify:** `company_id` on presets/sync; thin service wrapper |
| `lib/services/portfolio.service.ts` | Company-scoped portfolio home | **Extend:** spec RAG/stage filters, CPMO drill-down aggregates |
| `lib/export/*` + export routes | Live DB → Office buffers | **Extend:** read submitted weekly-report version when exporting |

## Recommended Project Structure

No new top-level folder. Extend existing layout:

```
app/
├── api/
│   ├── admin/users/              # MODIFY — roles, status, no physical delete
│   ├── auth/                     # MODIFY — lock/inactive checks
│   ├── portfolio/
│   │   ├── route.ts              # MODIFY — PR-13 dashboard aggregates
│   │   ├── weekly-periods/       # NEW — PR-10 CPMO period config
│   │   └── weekly-tracking/      # NEW — PR-12 submission tracking
│   ├── projects/[id]/
│   │   ├── route.ts              # MODIFY — L0–L5 master fields
│   │   ├── pm-assignments/       # NEW — PR-04
│   │   ├── stakeholders/         # NEW — PR-05
│   │   ├── dependencies/         # NEW — PR-06
│   │   ├── weekly-reports/       # NEW — PR-11 draft/submit/versions
│   │   ├── risks/                # MODIFY — master register rules
│   │   ├── issues/               # MODIFY — master register rules
│   │   ├── milestones/           # MODIFY — soft delete, snapshot flags
│   │   ├── budget/               # MODIFY — adjustment ledger + ROI
│   │   └── documents/            # MODIFY — Confluence checklist
│   ├── document-templates/       # NEW — PR-15 CPMO templates
│   ├── pm-dashboard/             # NEW — PR-14
│   ├── import-mapping/           # MODIFY — TENANT-01 scope
│   ├── bug-import-mapping/       # MODIFY — TENANT-01 scope
│   └── jira/jql-presets/         # MODIFY — TENANT-01 + service layer
├── page.tsx                      # MODIFY — PR-13 portfolio dashboard
└── pm-dashboard/page.tsx         # NEW — PR-14

lib/
├── http/
│   ├── with-auth.ts              # MODIFY — role on context
│   ├── with-project-access.ts    # MODIFY — PM/Viewer gate option
│   ├── with-role-access.ts       # NEW — CPMO-only routes
│   └── with-pm-access.ts         # NEW — PM write on assigned project
├── services/
│   ├── access.ts                 # MODIFY — role + assignment asserts
│   ├── users.service.ts          # NEW — PR-01
│   ├── pm-assignments.service.ts # NEW — PR-04
│   ├── stakeholders.service.ts   # NEW — PR-05
│   ├── dependencies.service.ts   # NEW — PR-06
│   ├── weekly-report-periods.service.ts  # NEW — PR-10
│   ├── weekly-reports.service.ts # NEW — PR-11 submit/version/snapshot
│   ├── weekly-tracking.service.ts# NEW — PR-12 CPMO consolidate
│   ├── raid-snapshots.service.ts # NEW — PR-09 sync on submit
│   ├── budget-adjustments.service.ts # NEW — PR-08 ledger + ROI
│   ├── document-templates.service.ts # NEW — PR-15
│   ├── pm-dashboard.service.ts   # NEW — PR-14
│   ├── audit.service.ts          # NEW — cross-cutting mutation log
│   ├── projects.service.ts       # MODIFY — master data
│   ├── milestones.service.ts     # MODIFY — delete guards
│   ├── risks.service.ts          # MODIFY — no physical delete
│   ├── issues.service.ts         # MODIFY — no physical delete
│   ├── portfolio.service.ts      # MODIFY — PR-13
│   └── project-report.service.ts # MODIFY — preview vs versioned submit
└── repositories/
    ├── users.repo.ts             # NEW (split from admin.repo user SQL)
    ├── user-roles.repo.ts        # NEW
    ├── pm-assignments.repo.ts    # NEW
    ├── stakeholders.repo.ts      # NEW
    ├── project-dependencies.repo.ts # NEW
    ├── weekly-report-periods.repo.ts # NEW
    ├── weekly-reports.repo.ts    # NEW — reports + immutable versions
    ├── raid-snapshots.repo.ts    # NEW — milestone + RAID snapshot rows
    ├── budget-adjustments.repo.ts# NEW
    ├── document-templates.repo.ts# NEW
    ├── audit-log.repo.ts         # NEW
    ├── projects.repo.ts          # MODIFY — columns + list filters
    ├── milestones.repo.ts        # MODIFY — soft delete, snapshot link
    ├── risks.repo.ts             # MODIFY — status/deactivate not DELETE
    ├── issues.repo.ts            # MODIFY — same
    ├── documents.repo.ts         # MODIFY — checklist types
    ├── import-mapping.repo.ts    # MODIFY — company_id
    └── jira-config.repo.ts       # MODIFY — company_id
```

### Structure Rationale

- **Follow v1.0 reorg conventions:** one `*.service.ts` per domain, one `*.repo.ts` per table cluster, thin routes with wrappers — do not re-inline SQL into routes.
- **New domains get new files** rather than bloating `projects.service.ts` — PM assignments, weekly reports, and snapshots have distinct lifecycles and test surfaces.
- **Auth extensions stay in `lib/http/` and `lib/services/access.ts`** — same enforcement point that 28+ routes already use via `withProjectAccess`.
- **Integrations untouched:** Jira import, AI report generation, and export remain in `lib/integrations/*` and `lib/export/*`; v2.0 only changes *which data* they read (live master vs submitted version).

## Architectural Patterns

### Pattern 1: Master Register + Snapshot on Submit

**What:** Risks, issues, and milestones are edited in place (master). On weekly-report **submit**, the service copies relevant rows into snapshot tables keyed by `weekly_report_version_id`. Submitted versions are immutable.

**When to use:** PR-07, PR-09, PR-11 — spec principle "one master data source."

**Trade-offs:** (+) PMs always edit one RAID register; (+) historical reports stay stable; (−) snapshot schema must track enough fields for export/CPMO review; (−) submit transaction spans multiple repos.

**Example flow:**
```typescript
// lib/services/weekly-reports.service.ts (new)
export async function submitWeeklyReport(projectId, actor, reportId) {
  await assertPmOnProject(projectId, actor);           // PR-04 + PR-02
  const version = await createVersionRepo(reportId);      // immutable row
  await snapshotRaidRepo(projectId, version.id);          // PR-09
  await snapshotMilestonesRepo(projectId, version.id);    // PR-07
  await finalizeVersionRepo(version.id);
  await auditLog(actor, 'weekly_report.submit', version.id);
  return version;
}
```

### Pattern 2: Role Gate Composition (CPMO / PM / Viewer)

**What:** Keep `withAuth` as the outer shell. Add `withRole(['CPMO'])` for company-wide config routes, and extend `assertProjectAccess` (or add `assertPmWriteAccess`) for project mutations.

**When to use:** Every route after PR-02. Viewers get read via `withProjectAccess`; PMs get write only on assigned projects; CPMO gets company-wide read/write.

**Trade-offs:** (+) Same error-mapping tail as v1.0; (+) Vitest can unit-test asserts in `access.ts`; (−) `SessionUser` load must join roles — one extra query per request unless cached on session.

**Example:**
```typescript
// lib/services/access.ts (extend)
export async function assertPmWriteAccess(projectId: string, actor: AccessActor, userId: number) {
  const row = await assertProjectAccess(projectId, actor);
  if (actorHasRole(actor, 'CPMO')) return row;
  if (await isAssignedPm(projectId, userId)) return row;
  throw new ForbiddenError();
}
```

### Pattern 3: Company-Scoped Mapping Tables (TENANT-01)

**What:** Add `company_id` to four global tables; repositories take `companyId` as first filter parameter; routes pass `ctx.actor.company_id` (admin may pass explicit company).

**When to use:** `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, `jira_sync_mappings`.

**Trade-offs:** (+) Closes cross-tenant mapping leak; (+) independent of roles work; (−) migration must backfill existing rows to a default company.

**Example:** Mirror `listProjects(companyId, isAdmin)` — `listTimelineMappings(companyId)` with admin bypass optional.

### Pattern 4: Audit Hook at Service Layer

**What:** `audit.service.ts` appends rows after successful mutations — not in repositories (no actor context) and not in routes (too scattered).

**When to use:** User/role changes, PM assignment history, budget adjustments, weekly-report submit, master-data changes per spec.

**Trade-offs:** (+) Central shape for `who/when/what/entity_id`; (−) must not fail the primary transaction — append after commit or same transaction with best-effort.

## Data Flow

### Request Flow (unchanged skeleton)

```
Browser action
    ↓
Client page/hook → fetch('/api/...')
    ↓
proxy.ts (cookie presence)
    ↓
route.ts → withAuth / withProjectAccess / withRole
    ↓
service.ts → assert* → business rules → repo(s)
    ↓
PostgreSQL
    ↓
NextResponse.json → React state
```

### Key Data Flows (new/changed)

#### 1. Login + role resolution (PR-01, PR-02)

```
POST /api/auth/login
  → auth.repo findUserByUsername
  → check status != Locked/Inactive
  → verifyPassword (lib/auth.ts)
  → user-roles.repo loadRoleUnion(userId)
  → createSession → Set-Cookie pm_session
GET /api/auth/me
  → extend to return roles[], status
```

**Modified:** `lib/auth.ts` (`getSessionUser` or me-route enrichment), `auth.repo.ts`, new `users.repo.ts` / `user-roles.repo.ts`.
**New:** `users.service.ts`, admin user routes switch from physical delete to status=Inactive.

#### 2. PM assignment → project access (PR-04 before PM write paths)

```
CPMO POST /api/projects/[id]/pm-assignments
  → assertRole CPMO
  → pm-assignments.service assignPrimary / addCollaborator
  → pm-assignments.repo INSERT + history row
  → audit.service

PM GET /api/projects/[id]/risks (write routes)
  → withProjectAccess + assertPmWriteAccess
  → existing risks.service → risks.repo
```

**New:** `pm-assignments.*`, history table.
**Modified:** `access.ts`, all PM-mutation services.

#### 3. RAID master CRUD (PR-09 master half)

```
PM PUT /api/projects/[id]/risks
  → assertPmWriteAccess
  → risks.service updateRisk (no DELETE — status → Closed/Inactive)
  → risks.repo UPDATE (allowlist unchanged)
  → audit.service
```

**Modified:** `risks.service.ts`, `issues.service.ts`, routes (remove DELETE or map to deactivate).
**Unchanged:** Repository allowlists — extend columns only if spec adds fields.

#### 4. Weekly report submit with snapshots (PR-09 + PR-11)

```
PM POST /api/projects/[id]/weekly-reports/[id]/submit
  → assertPmWriteAccess
  → weekly-reports.service submit:
       1. Validate period open (weekly-report-periods.repo)
       2. INSERT weekly_report_versions (immutable)
       3. raid-snapshots.repo copy open risks/issues
       4. raid-snapshots.repo copy milestone status snapshot
       5. Store PM narrative fields on version row
       6. status → Submitted
  → audit.service

CPMO GET /api/portfolio/weekly-tracking
  → weekly-tracking.service listByPeriod(companyId, periodId)
  → join versions + projects + submission status
```

**New:** `weekly-reports.*`, `raid-snapshots.*`, `weekly-report-periods.*`.
**Modified:** `project-report.service.ts` — `getWeeklyProjectReport` remains **live preview** for draft UI; export/submit reads **version** when `versionId` present.

#### 5. Period config → auto-create report shells (PR-10 → PR-11)

```
CPMO POST /api/portfolio/weekly-periods
  → withRole CPMO
  → weekly-report-periods.service createPeriod
  → for each project where weekly_report_flag=true:
       weekly-reports.repo createDraftShell(projectId, periodId)

PM GET /api/projects/[id]/weekly-reports?period=current
  → returns draft shell + live master preview merged
```

**Dependency:** Period config before bulk draft creation; project master `weekly_report_flag` (PR-03) before auto-create filter.

#### 6. TENANT-01 mapping isolation

```
POST /api/import-mapping
  → withAuth
  → import-mapping.service create(companyId, ...)
  → import-mapping.repo INSERT with company_id

GET /api/jira/jql-presets?context=bugs
  → withAuth
  → jira-presets.service list(companyId, context)  // NEW thin service
  → jira-config.repo scoped SELECT
```

**Modified:** `import-mapping.repo.ts`, `jira-config.repo.ts`, routes currently **repo-direct** (`app/api/jira/jql-presets/route.ts`) gain a service for company filter.

#### 7. Portfolio / PM dashboards (PR-13, PR-14)

```
GET /api/portfolio (existing)
  → portfolio.service getPortfolioSummary
  → extend: filter by role (CPMO=all company, PM=assigned, Viewer=read assigned)
  → add: stage L0–L5 buckets, high RAID count, overdue milestones drill-down

GET /api/pm-dashboard (new)
  → pm-dashboard.service getPmActions(userId)
  → assigned projects + pending weekly reports + overdue milestones + open RAID
```

**Modified:** `portfolio.service.ts`, `portfolio.repo.ts` list queries, `app/page.tsx` + `usePortfolioDashboard`.
**New:** `pm-dashboard.*`, `app/pm-dashboard/page.tsx`.

#### 8. Documents — templates + Confluence checklist (PR-15)

```
CPMO CRUD /api/document-templates
  → document-templates.service (company-scoped)

PM GET/PUT /api/projects/[id]/documents
  → documents.service checklist against templates
  → store confluence_url + metadata only (no upload)
  → documents.repo extend types
```

**Modified:** `documents.repo.ts`, `documents.service.ts`.
**New:** `document-templates.*`.

#### 9. Budget adjustment ledger + ROI (PR-08)

```
PM POST /api/projects/[id]/budget/adjustments
  → assertPmWriteAccess
  → budget-adjustments.service recordAdjustment
  → INSERT ledger row (approved vs actual delta, reason, effective_date)
  → recompute ROI summary (service-level, not trigger)
  → existing budget.repo for line items unchanged
```

**New:** `budget-adjustments.*`.
**Modified:** `budget.service.ts` for summary endpoint; project budget UI.

### State Management

Unchanged: per-page `useState` + `fetch`, no Redux/React Query. Weekly-report **draft** state lives server-side (`weekly_reports.status=Draft`); client refetches on save/submit. Submitted **versions** are read-only — client disables edits when `version.status=Submitted`.

## Integration Matrix: PR Feature → New vs Modified

| ID | Feature | New components | Modified components |
|----|---------|----------------|---------------------|
| TENANT-01 | Mapping `company_id` | Migration in `lib/db.ts` | `import-mapping.repo.ts`, `jira-config.repo.ts`, mapping routes, optional `jira-presets.service.ts` |
| PR-01 | Users & roles | `users.repo.ts`, `user-roles.repo.ts`, `users.service.ts` | `admin.repo.ts` (user CRUD → status not delete), `app/api/admin/users/*`, admin UI |
| PR-02 | Login & auth | `with-role-access.ts`, role asserts in `access.ts` | `lib/auth.ts`, `auth.repo.ts`, login/me routes, `SessionUser` type |
| PR-03 | Project master L0–L5 | — | `projects.repo.ts` (`PROJECT_COLUMNS`), `projects.service.ts`, project form UI, `lib/rag.ts` alignment |
| PR-04 | PM assignment | `pm-assignments.repo.ts`, `pm-assignments.service.ts`, assignment routes/history | `access.ts` (`assertPmWriteAccess`), project detail UI |
| PR-05 | Stakeholders | `stakeholders.repo.ts`, `stakeholders.service.ts`, routes | Project settings UI |
| PR-06 | Cross-project deps | `project-dependencies.repo.ts`, `dependencies.service.ts`, routes | Portfolio dependency view (optional) |
| PR-07 | Milestones + snapshot | `raid-snapshots.repo.ts` (milestone slice) | `milestones.repo.ts` (soft delete), `milestones.service.ts` (delete guard if in report) |
| PR-08 | Budget & ROI | `budget-adjustments.repo.ts`, `budget-adjustments.service.ts` | `budget.service.ts`, budget UI, `budget.repo.ts` (benefit columns if needed) |
| PR-09 | RAID master + snapshot | `raid-snapshots.repo.ts`, `raid-snapshots.service.ts` | `risks.service.ts`, `issues.service.ts` (deactivate not delete), submit flow |
| PR-10 | Weekly period config | `weekly-report-periods.repo.ts`, `weekly-report-periods.service.ts`, CPMO routes | — |
| PR-11 | PM submit/version | `weekly-reports.repo.ts`, `weekly-reports.service.ts`, routes | `project-report.service.ts` (preview vs version), report UI |
| PR-12 | CPMO tracking/export | `weekly-tracking.service.ts`, tracking routes | `lib/export/*` weekly-report path (read version), portfolio report UI |
| PR-13 | Portfolio dashboard | — | `portfolio.service.ts`, `portfolio.repo.ts`, `app/page.tsx`, `usePortfolioDashboard` |
| PR-14 | PM dashboard | `pm-dashboard.service.ts`, `app/pm-dashboard/*`, `/api/pm-dashboard` | Sidebar nav by role |
| PR-15 | Document templates | `document-templates.repo.ts`, `document-templates.service.ts` | `documents.repo.ts`, `documents.service.ts`, documents UI |
| Audit | Audit log | `audit-log.repo.ts`, `audit.service.ts` | All mutation services (incremental wiring) |

## Suggested Build Order

Phases respect dependencies: **roles before PM assignment before weekly reports**; **RAID master before snapshot sync**; **period config before auto-create**; **TENANT-01 early/independent**.

```text
Wave 0 — Independent tenant fix
  └── TENANT-01  company_id on 4 mapping tables + backfill + repo/route scope

Wave 1 — Auth substrate (blocks everything role-aware)
  ├── PR-01  users, multi-role union, status, no physical delete
  └── PR-02  login lock/inactive, SessionUser roles, withRole, access asserts

Wave 2 — Project master & assignment (blocks PM-scoped writes)
  ├── PR-03  project master L0–L5, RAG, weekly_report_flag
  └── PR-04  PM assignment primary/collaborator/history + assertPmWriteAccess

Wave 3 — Master registers (parallel tracks)
  ├── PR-05  stakeholders
  ├── PR-06  cross-project dependencies
  ├── PR-08  budget adjustment ledger + ROI
  ├── PR-09a RAID master rules (deactivate, field completeness)
  └── PR-07a milestone soft-delete + "in report" guard (logic only; snapshot table comes Wave 4)

Wave 4 — Weekly report pipeline
  ├── PR-10  CPMO period configuration
  ├── PR-09b raid-snapshots.repo + sync on submit
  ├── PR-07b milestone snapshot slice (same submit transaction)
  ├── PR-11  draft/submit/version immutable + auto-create shells from PR-10
  └── PR-12  CPMO tracking, consolidate, export from version

Wave 5 — Dashboards & documents (needs Waves 1–4 data)
  ├── PR-13  portfolio dashboard (role-filtered aggregates)
  ├── PR-14  PM personal dashboard
  └── PR-15  document templates + Confluence checklist

Wave 6 — Cross-cutting (wire throughout, complete last)
  └── Audit log  audit.service called from Waves 1–5 mutation services
```

**Critical path:** TENANT-01 → PR-01 → PR-02 → PR-04 → PR-10 → PR-09b → PR-11 → PR-12 → PR-13/14.

**Parallel-safe after Wave 2:** PR-05, PR-06, PR-08, PR-09a, PR-15 (UI gates only need PR-02).

**Keep green throughout:** Each wave adds Vitest coverage at service + route auth layer (403 cross-company, 403 wrong role) per HYG-03.

## Scaling Considerations

| Scale | Architecture adjustments |
|-------|--------------------------|
| 0–1k users | Monolith unchanged; snapshot tables grow ~(#projects × #weeks × RAID rows) — index `(project_id, period_id)` on versions |
| 1k–100k users | Add read replicas for dashboard aggregates; consider materialized view for PR-13 KPIs; audit log partition by month |
| 100k+ users | Weekly-report submit is write-heavy — batch snapshot inserts; archive old versions to cold storage |

### Scaling Priorities

1. **First bottleneck:** Portfolio dashboard aggregate queries (PR-13) — multiple joins across projects/risks/milestones; add repo-level summary queries rather than N+1 in service.
2. **Second bottleneck:** Weekly-report snapshot copy on submit — single transaction per project per week; acceptable until high concurrent submit on Monday deadlines.

## Anti-Patterns

### Anti-Pattern 1: UI-Only Role Hiding

**What people do:** Hide buttons for Viewer in React without server checks.
**Why it's wrong:** Spec requires server-side authorization; v1.0 reorg exists precisely to prevent this.
**Do this instead:** Every mutating route goes through `assertPmWriteAccess` or `withRole(['CPMO'])`; Viewer gets 403 on POST/PUT/DELETE.

### Anti-Pattern 2: Editing Submitted Weekly Report Version

**What people do:** UPDATE `weekly_report_versions` when PM wants to "fix" last week.
**Why it's wrong:** Spec immutable versions; breaks CPMO audit trail.
**Do this instead:** New version on resubmit if period still open; otherwise CPMO override workflow with audit entry.

### Anti-Pattern 3: Snapshot-as-Master

**What people do:** PM edits RAID in snapshot table during draft.
**Why it's wrong:** Violates "one master data source"; duplicates divergence.
**Do this instead:** Draft UI reads live master via `getWeeklyProjectReport`; submit copies to snapshot once.

### Anti-Pattern 4: Physical Delete on Users/RAID/Milestones

**What people do:** Keep `DELETE FROM users/risks/milestones`.
**Why it's wrong:** Spec forbids physical delete; breaks report integrity references.
**Do this instead:** Status columns (`Inactive`, `Closed`) + soft-delete flags; repo drops hard DELETE exports.

### Anti-Pattern 5: Global Mapping Tables Post-TENANT-01

**What people do:** Forget `company_id` filter on one of four mapping repos.
**Why it's wrong:** Reintroduces cross-tenant mapping leak (v1.0 known gap).
**Do this instead:** Every list/create/delete takes `companyId`; admin bypass explicit in service.

### Anti-Pattern 6: Bypassing Service Layer on New Routes

**What people do:** Copy `jira/jql-presets/route.ts` repo-direct pattern for new weekly-report routes.
**Why it's wrong:** v1.0 accepted debt on ops routes; v2.0 spec features are not ops debt.
**Do this instead:** route → service → repo for all PR-01..15 endpoints.

## Integration Points

### External Services (unchanged)

| Service | Integration pattern | v2.0 notes |
|---------|---------------------|------------|
| Jira Cloud | `lib/integrations/jira` + `company_jira_config` env var names | Keep; mapping tables get `company_id` (TENANT-01) |
| Anthropic | `lib/integrations/anthropic` | Keep AI report/email; may summarize submitted version |
| Resend | `lib/integrations/resend` | Keep; PR-12 may email consolidated CPMO export |
| Excel/PPT/Word | `lib/export/*` | Extend weekly-report export to read version snapshot |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| access.ts ↔ all services | Sync assert calls | Single place for role + tenant + assignment |
| weekly-reports.service ↔ raid-snapshots.service | Sync in submit transaction | Must succeed or roll back together |
| project-report.service ↔ weekly-reports.service | Preview uses live; submit delegates | Avoid duplicating aggregation logic — extract shared `buildReportPayload(projectId, period)` |
| portfolio.service ↔ pm-dashboard.service | Shared repo queries | Extract `listAssignedProjects(userId)` to avoid drift |
| audit.service ↔ mutation services | Fire-and-forget append | Never block primary operation on audit failure |

## Sources

- `.planning/PROJECT.md` — v2.0 requirements PR-01..PR-15, TENANT-01, constraints
- `.planning/codebase/ARCHITECTURE.md` — v1.0 layer diagram (2026-08-07)
- Live codebase (2026-08-25): `lib/http/with-auth.ts`, `with-project-access.ts`, `lib/services/access.ts`, `risks.service.ts`, `projects.service.ts`, `project-report.service.ts`, `portfolio.service.ts`, `import-mapping.repo.ts`, `jira-config.repo.ts`, `milestones.repo.ts`, `budget.repo.ts`, `documents.repo.ts`, `admin.repo.ts`
- Codegraph exploration — auth wrappers, RAID/milestone/budget/report flows, mapping table call sites

---
*Architecture research for: v2.0 Portfolio One View (PR-01..PR-15 + TENANT-01)*
*Researched: 2026-08-25*
