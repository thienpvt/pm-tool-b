# Phase 16: Portfolio & PM Dashboards - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 22 new/modified files
**Analogs found:** 20 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db-dashboards.ts` | migration | batch | `lib/db-fiscal-budget.ts` | exact |
| `lib/db-dashboards.ddl.unit.test.ts` | test | transform | `lib/db-fiscal-budget.ddl.unit.test.ts` | exact |
| `lib/db.ts` | config | batch | `lib/db.ts` (migrateFiscalBudget wire) | exact (extend) |
| `lib/repositories/dashboard-filter-state.repo.ts` | repository | CRUD (upsert-in-place) | `lib/repositories/weekly-periods.repo.ts` (`upsertCompanyWeeklyConfig`) | exact |
| `lib/services/spec-dashboards.service.ts` | service | request-response + transform | `lib/services/weekly-tracking.service.ts` (`applyTrackingFilters` + `buildCounts`) + `lib/services/raid-masters.service.ts` | role-match |
| `lib/export/dashboard-portfolio.ts` (or extend export module) | utility | transform + file-I/O | `lib/export/consolidated-weekly.ts` (`generateConsolidatedXlsx`) | exact |
| `app/api/dashboards/portfolio/route.ts` | route | request-response | `app/api/weekly-periods/[periodId]/tracking/route.ts` | role-match |
| `app/api/dashboards/portfolio/filters/route.ts` | route | request-response | `app/api/weekly-periods/config/route.ts` | exact |
| `app/api/dashboards/portfolio/export/route.ts` | route | file-I/O | `app/api/weekly-periods/[periodId]/export/route.ts` | exact |
| `app/api/dashboards/pm/route.ts` | route | request-response | `app/api/projects/route.ts` (withAuth + pm/cpmo gate) | role-match |
| `app/api/dashboards/pm/filters/route.ts` | route | request-response | `app/api/dashboards/portfolio/filters/route.ts` (surface param) | exact (reuse) |
| `lib/services/spec-dashboards.service.unit.test.ts` | test | — | `lib/services/weekly-tracking.service.unit.test.ts` | exact |
| `lib/repositories/dashboard-filter-state.repo.test.ts` | test | transform | `lib/repositories/weekly-periods.repo.test.ts` | exact |
| `app/api/dashboards/portfolio/route.test.ts` | test | — | `app/api/weekly-periods/[periodId]/tracking/route.test.ts` | exact |
| `app/api/dashboards/pm/route.test.ts` | test | — | `app/api/weekly-periods/[periodId]/tracking/route.test.ts` (invert cpmo/pm matrix) | role-match |
| `app/api/dashboards/portfolio/export/route.test.ts` | test | — | `app/api/weekly-periods/[periodId]/export/route.test.ts` | exact |
| `lib/export/dashboard-portfolio.unit.test.ts` | test | transform | `lib/export/consolidated-weekly.unit.test.ts` | role-match |
| `lib/dashboards/apply-filters.ts` (optional pure helper) | utility | transform | `weekly-tracking.service.ts` `applyTrackingFilters` (lines 147-176) | exact |
| `lib/dashboards/kpi-counts.ts` (optional pure helper) | utility | transform | `weekly-tracking.service.ts` `buildCounts` (lines 136-145) | role-match |
| `lib/dashboards/rag-normalize.ts` (optional pure helper) | utility | transform | `lib/services/weekly-reports.service.ts` `isWeeklyReportOverdue` (pure fn shape) | partial |
| `test/repo-db.ts` | test harness | batch | `test/repo-db.ts` (extend or call migrate) | exact (extend) |

## Pattern Assignments

### `lib/db-dashboards.ts` (migration, batch)

**Analog:** `lib/db-fiscal-budget.ts` (settings-flag DDL)

**Flag + DDL export** (db-fiscal-budget.ts lines 1-73):

```typescript
import type { Pool } from 'pg';

export const DASHBOARDS_DDL_FLAG = 'dashboards_ddl_v1';

export const DASHBOARDS_DDL = [
  `
    CREATE TABLE IF NOT EXISTS dashboard_filter_state (
      user_id INTEGER NOT NULL REFERENCES users(id),
      surface TEXT NOT NULL CHECK (surface IN ('portfolio', 'pm')),
      filters_json JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, surface)
    )
  `,
];
```

**Settings-flag idempotency** — copy `settingsFlagExists` / `writeSettingsFlag` / try-catch from `lib/db-fiscal-budget.ts` lines 75-108:

```typescript
export async function migrateDashboards(pool: Pool): Promise<void> {
  try {
    if (await settingsFlagExists(pool, DASHBOARDS_DDL_FLAG)) return;
    for (const sql of DASHBOARDS_DDL) {
      await pool.query(sql);
    }
    await writeSettingsFlag(pool, DASHBOARDS_DDL_FLAG);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
```

**Never:** physical DELETE helpers on `dashboard_filter_state` (D-15 upsert-in-place is OK).

---

### `lib/db.ts` (config, batch)

**Analog:** `lib/db.ts` lines 633-635

```typescript
const { migrateFiscalBudget } = await import('./db-fiscal-budget');
await migrateFiscalBudget(pool);
// Phase 16: dashboard filter state table
const { migrateDashboards } = await import('./db-dashboards');
await migrateDashboards(pool);
await backfillWeightedCompletion(pool);
```

Wire **after** `migrateFiscalBudget`, **before** `backfillWeightedCompletion` (D-07).

---

### `lib/repositories/dashboard-filter-state.repo.ts` (repository, upsert-in-place)

**Analog:** `lib/repositories/weekly-periods.repo.ts` `upsertCompanyWeeklyConfig` (lines 61-79)

**Get stored filters**:

```typescript
export async function getDashboardFilters(userId: number, surface: 'portfolio' | 'pm') {
  const db = await getDb();
  const row = await db.get<{ filters_json: unknown; updated_at: string }>(
    `SELECT filters_json, updated_at FROM dashboard_filter_state
     WHERE user_id = ? AND surface = ?`,
    userId,
    surface,
  );
  if (!row) return { filters: {}, updated_at: null };
  return { filters: row.filters_json ?? {}, updated_at: row.updated_at };
}
```

**Upsert replace** — mirror `ON CONFLICT DO UPDATE` from weekly-periods.repo.ts lines 66-78:

```typescript
export async function upsertDashboardFilters(
  userId: number,
  surface: 'portfolio' | 'pm',
  filtersJson: Record<string, unknown>,
) {
  const db = await getDb();
  await db.run(
    `INSERT INTO dashboard_filter_state (user_id, surface, filters_json)
     VALUES (?, ?, ?::jsonb)
     ON CONFLICT (user_id, surface) DO UPDATE SET
       filters_json = excluded.filters_json,
       updated_at = now()`,
    userId,
    surface,
    JSON.stringify(filtersJson),
  );
}
```

**Clear / defaults** — `upsertDashboardFilters(userId, surface, {})` (D-07 POST `clear` and `defaults`).

Unique `(user_id, surface)` per D-07 — same idiom as `company_weekly_config(company_id)`.

---

### `lib/services/spec-dashboards.service.ts` (service, KPI + filter apply)

**Analog (filter AND-apply):** `lib/services/weekly-tracking.service.ts` `applyTrackingFilters` (lines 147-176) — **NOT** `getPeriodTracking` wholesale

**Filter type + pure apply** — adapt keys from D-06 (`portfolio_year`, `program`, `unit`, `pm_user_id`, `stage`, `status`, `rag`, `type`, `weekly_report_enabled`):

```typescript
export type PortfolioDashboardFilters = {
  portfolio_year?: number;
  program?: number; // customer_id
  unit?: string;
  pm_user_id?: number;
  stage?: string;
  status?: string;
  rag?: string;
  type?: string;
  weekly_report_enabled?: boolean;
};

function applyPortfolioFilters<T extends { /* project row shape */ }>(
  rows: T[],
  filters: PortfolioDashboardFilters,
): T[] {
  return rows.filter((row) => {
    if (filters.portfolio_year !== undefined && row.portfolio_year !== filters.portfolio_year) return false;
    if (filters.program !== undefined && row.customer_id !== filters.program) return false;
    if (filters.pm_user_id !== undefined && row.pm_user_id !== filters.pm_user_id) return false;
    if (filters.stage !== undefined && row.stage !== filters.stage) return false;
    if (filters.status !== undefined && row.status !== filters.status) return false;
    if (filters.rag !== undefined && normalizeRag(row.rag) !== normalizeRag(filters.rag)) return false;
    if (filters.weekly_report_enabled !== undefined && row.weekly_report_enabled !== filters.weekly_report_enabled) return false;
    // unit/type: skip silently if column absent (D-06 planner discretion)
    return true;
  });
}
```

**Analog (KPI counts):** `buildCounts` (weekly-tracking.service.ts lines 136-145) + compose Phase 12 helpers

**Portfolio GET flow** (D-01..D-05):

```typescript
export async function getPortfolioDashboard(actor: AccessActor) {
  assertCompanyWrite(actor);
  const stored = await getDashboardFilters(actor.user_id, 'portfolio');
  const filters = parsePortfolioFilters(stored.filters); // unknown keys → ValidationError 400

  const allProjects = await listProjects(actor.company_id);
  const filtered = applyPortfolioFilters(enrichWithPm(allProjects), filters);

  const activeRows = filtered.filter(isActiveL0L4); // D-02 status Active + stage L0-L4
  const kpis = {
    active_count: activeRows.length,
    on_track_count: activeRows.filter((r) => normalizeRag(r.rag) === 'green').length,
    watch_act_count: activeRows.filter((r) => ['amber', 'red'].includes(normalizeRag(r.rag))).length,
    // D-03: missing/invalid rag → amber; green+amber+red === active_count
    overdue_milestone_project_count: distinctProjects(
      (await listOverdueMilestones(actor.company_id)).filter(inFilteredSet(filtered)),
    ).length,
    high_open_raid_count: (await listHighOpenRaid(actor.company_id)).records.filter(inFilteredSet(filtered)).length,
    technology_council_count: (await listTechnologyCouncilIssues(actor.company_id)).filter(inFilteredSet(filtered)).length,
  };

  return { filters: stored.filters, kpis, charts: buildCharts(filtered, activeRows), list: filtered, drilldowns: { ... } };
}
```

**Consume, do not reimplement** — import from `lib/services/raid-masters.service.ts` (lines 14-32):

```typescript
export async function listOverdueMilestones(companyId: number | null) { ... }
export async function listHighOpenRaid(companyId: number | null) { ... }
export async function listTechnologyCouncilIssues(companyId: number | null) { ... }
```

**RAG source** — live `projects.rag` / `projects.stage` / `projects.status` (D-16), **not** weekly snapshot `wv.rag`.

**PM dashboard GET** (D-09..D-11) — **NOT** `getPeriodTracking`:

```typescript
export async function getPmDashboard(actor: AccessActor) {
  if (actor.company_id === null) throw new ForbiddenError();
  if (!hasRole(actor, 'pm') && !hasRole(actor, 'cpmo')) throw new ForbiddenError();

  const stored = await getDashboardFilters(actor.user_id, 'pm');
  const assigned = await listProjects(actor.company_id, { pmUserId: actor.user_id }); // projects.repo.ts lines 94-118
  const projectIds = new Set(assigned.map((p) => p.id));

  const period = await resolveCurrentCompanyPeriod(actor.company_id); // listWeeklyPeriods + date window (D-10)
  const shells = period
    ? (await listPeriodShellsRepo(actor.company_id, period.id)).filter((s) => projectIds.has(s.project_id))
    : [];
  const now = new Date();
  const weeklyActions = shells
    .filter((s) => s.status === 'not_submitted' || s.status === 'draft')
    .map((s) => ({
      project_id: s.project_id,
      report_id: s.report_id,
      overdue: isWeeklyReportOverdue(s.status, s.due_at, now),
      href: `/projects/${s.project_id}/weekly-reports/${s.report_id}`,
    }));

  // milestones + raid: filter Phase 12 lists to projectIds; deep-link href strings (D-11)
  return { projects: assigned, actions: { weekly: weeklyActions, milestones: [...], raid: [...] } };
}
```

**Filter save/export audit** — `auditLog` action `dashboard_export` on export (D-08); optional `filter_save` on PUT filters.

---

### `lib/export/dashboard-portfolio.ts` (utility, xlsx export)

**Analog:** `lib/export/consolidated-weekly.ts` `generateConsolidatedXlsx` (lines 240-256) + styling helpers (lines 32-92, 132-164)

**Workbook bootstrap**:

```typescript
import ExcelJS from 'exceljs';

export async function generatePortfolioDashboardXlsx(payload: PortfolioExportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PM Tool';
  wb.created = new Date();

  const ws = wb.addWorksheet('Portfolio Dashboard');
  sectionTitle(ws, 'Portfolio KPIs', 4);
  labelValueRow(ws, 'Active', payload.kpis.active_count);
  labelValueRow(ws, 'On Track', payload.kpis.on_track_count);
  // ... stage/RAG summary rows, filtered project table (reuse navHeader/labelValueRow/thinBorder)

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
```

Copy `navHeader`, `sectionTitle`, `labelValueRow`, `thinBorder`, `BODY_FONT` from consolidated-weekly.ts — do **not** import v1 portfolio Excel helpers (D-14).

**PDF path** — if no in-repo generator, planner picks zero-new-package path; `docx`/`pptx` are **not** substitutes for PDF (D-08).

---

### `app/api/dashboards/portfolio/route.ts` (route, request-response)

**Analog:** `app/api/weekly-periods/[periodId]/tracking/route.ts` (lines 1-61)

```typescript
import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { getPortfolioDashboard } from '@/lib/services/spec-dashboards.service';

export const GET = withCpmo(async (_req, { actor }) =>
  NextResponse.json(await getPortfolioDashboard(actor)),
);
```

Portfolio GET/export/filters: `withCpmo` + service `assertCompanyWrite` (D-12). Null-company admin 403.

---

### `app/api/dashboards/portfolio/filters/route.ts` (route, filter CRUD)

**Analog:** `app/api/weekly-periods/config/route.ts` (lines 1-19)

```typescript
export const GET = withCpmo(async (_req, { actor }) =>
  NextResponse.json(await getPortfolioDashboardFilters(actor)),
);

export const PUT = withCpmo(
  async (_req, { actor, body }) => {
    await savePortfolioDashboardFilters(actor, body as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  },
  { schema: portfolioFiltersSchema },
);

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const action = (body as { action?: string }).action;
    if (action === 'clear' || action === 'defaults') {
      await clearPortfolioDashboardFilters(actor);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  },
  { schema: filterActionSchema },
);
```

Unknown filter keys → service `ValidationError` → 400 (D-06).

---

### `app/api/dashboards/portfolio/export/route.ts` (route, file-I/O)

**Analog:** `app/api/weekly-periods/[periodId]/export/route.ts` (lines 1-34) + `exportConsolidatedWeekly` audit tail (weekly-tracking.service.ts lines 341-355)

```typescript
export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const result = await exportPortfolioDashboard(actor, body as { format: 'xlsx' | 'pdf'; filters?: Record<string, unknown> });
    return new NextResponse(result.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  },
  { schema: portfolioExportSchema },
);
```

**Export service** — mirror `exportConsolidatedWeekly` (lines 295-356):

```typescript
await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'dashboard',
  entity_id: 'portfolio',
  action: 'dashboard_export',
  before: null,
  after: { format: body.format, filters: appliedFilters },
});
```

Export applies stored filters + optional query-string override for one-shot export (D-07, D-08).

---

### `app/api/dashboards/pm/route.ts` (route, request-response)

**Analog:** `withAuth` + role gate from `lib/services/projects.service.ts` `listProjects` (lines 32-38)

```typescript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { hasRole } from '@/lib/services/access';
import { ForbiddenError } from '@/lib/services/errors';
import { getPmDashboard } from '@/lib/services/spec-dashboards.service';

export const GET = withAuth(async (_req, { actor }) => {
  if (actor.company_id === null) throw new ForbiddenError();
  if (!hasRole(actor, 'pm') && !hasRole(actor, 'cpmo')) throw new ForbiddenError();
  return NextResponse.json(await getPmDashboard(actor));
});
```

Viewer 403 (D-12). CPMO hitting `/api/dashboards/pm` still assignment-scoped inside service (D-09).

PM filters route — same shape as portfolio filters with `surface: 'pm'`.

---

### Test files

#### `lib/services/spec-dashboards.service.unit.test.ts`

**Analog:** `lib/services/weekly-tracking.service.unit.test.ts` (lines 1-100)

```typescript
vi.mock('./access', () => ({ assertCompanyWrite, hasRole }));
vi.mock('@/lib/repositories/projects.repo', () => ({ listProjects }));
vi.mock('@/lib/repositories/dashboard-filter-state.repo', () => ({ getDashboardFilters, upsertDashboardFilters }));
vi.mock('@/lib/services/raid-masters.service', () => ({ listOverdueMilestones, listHighOpenRaid, listTechnologyCouncilIssues }));
vi.mock('@/lib/repositories/weekly-reports.repo', () => ({ listPeriodShellsRepo }));
vi.mock('./weekly-reports.service', () => ({ isWeeklyReportOverdue }));
vi.mock('./audit.service', () => ({ auditLog: vi.fn() }));
```

Cases:
- Portfolio: `assertCompanyWrite` before list; null-company admin ForbiddenError
- KPI invariant: green + amber + red === active_count; missing rag → amber (D-03)
- Filters AND-combined; unknown filter key ValidationError
- PM: viewer ForbiddenError; uses `listProjects(..., { pmUserId })` not `getPeriodTracking`
- Weekly actions: `not_submitted`/`draft` only; overdue computed via `isWeeklyReportOverdue`
- Export: `auditLog` action `dashboard_export`

#### `lib/repositories/dashboard-filter-state.repo.test.ts`

**Analog:** `lib/repositories/weekly-periods.repo.test.ts` (lines 1-28)

```typescript
import { hasTestDb, testPool } from '@/test/db';
import { setupRepoTables, testDb } from '@/test/repo-db';
import { migrateDashboards } from '@/lib/db-dashboards';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

describe.skipIf(!hasTestDb)('dashboard-filter-state.repo', () => {
  beforeAll(async () => {
    await setupRepoTables();
    await migrateDashboards(testPool());
  });
});
```

Assert upsert replaces same `(user_id, surface)` row; two surfaces independent.

#### `app/api/dashboards/portfolio/route.test.ts`

**Analog:** `app/api/weekly-periods/[periodId]/tracking/route.test.ts` (lines 1-119)

```typescript
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/spec-dashboards.service', () => ({ getPortfolioDashboard }));

// 401 no session; 403 pm/viewer; 200 cpmo
// reuse cpmoSession, pmSession, viewerSession fixtures
```

#### `app/api/dashboards/pm/route.test.ts`

**Analog:** tracking route.test.ts — **invert** matrix: 403 viewer; 200 pm and cpmo-with-assignment; 401 no session.

#### `app/api/dashboards/portfolio/export/route.test.ts`

**Analog:** `app/api/weekly-periods/[periodId]/export/route.test.ts` (lines 1-80)

401 / 403 pm / 403 viewer / 400 invalid format from Zod / 200 binary response with Content-Disposition.

#### `lib/db-dashboards.ddl.unit.test.ts`

**Analog:** `lib/db-fiscal-budget.ddl.unit.test.ts` (lines 10-47)

Assert `CREATE TABLE dashboard_filter_state`, `PRIMARY KEY (user_id, surface)`, `filters_json JSONB`, surface CHECK, wire order in `lib/db.ts` after `migrateFiscalBudget`.

#### `lib/export/dashboard-portfolio.unit.test.ts`

**Analog:** `lib/export/consolidated-weekly.unit.test.ts` — buffer non-empty; worksheet names; KPI rows present.

---

## Shared Patterns

### assertCompanyWrite (portfolio surface)

**Source:** `lib/services/access.ts` lines 125-129
**Apply to:** portfolio GET, filters PUT/POST, export POST

```typescript
export function assertCompanyWrite(actor: AccessActor): void {
  if (!isCpmo(actor)) throw new ForbiddenError();
  if (actor.company_id === null) throw new ForbiddenError();
}
```

---

### withCpmo routes (portfolio)

**Source:** `lib/http/with-role.ts` lines 26-34
**Apply to:** `/api/dashboards/portfolio`, `/filters`, `/export`

```typescript
export const GET = withCpmo(async (_req, { actor }) =>
  NextResponse.json(await getPortfolioDashboard(actor)),
);
```

---

### withAuth + hasRole (PM surface)

**Source:** `lib/http/with-auth.ts` lines 83-138; `lib/services/access.ts` lines 32-34
**Apply to:** `/api/dashboards/pm`

```typescript
if (!hasRole(actor, 'pm') && !hasRole(actor, 'cpmo')) throw new ForbiddenError();
```

Viewer-only → 403. Do not use `withCpmo` on PM dashboard (D-12).

---

### listProjects assignment predicate

**Source:** `lib/repositories/projects.repo.ts` lines 94-118
**Apply to:** PM dashboard project list + action scoping (MDSH-01)

```typescript
export async function listProjects(companyId: number | null, opts?: { pmUserId?: number }) {
  // EXISTS active project_pm_assignments window when pmUserId set
}
```

---

### isWeeklyReportOverdue (computed overdue flag)

**Source:** `lib/services/weekly-reports.service.ts` lines 242-250
**Apply to:** PM weekly action rows (D-10, MDSH-05)

```typescript
export function isWeeklyReportOverdue(status: string, dueAt: Date | string, now: Date): boolean {
  if (status !== 'not_submitted' && status !== 'draft') return false;
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  return now.getTime() > due.getTime();
}
```

Never store overdue status on dashboard rows.

---

### auditLog on export

**Source:** `lib/services/weekly-tracking.service.ts` lines 341-349
**Apply to:** portfolio dashboard export (D-08)

```typescript
await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'dashboard',
  entity_id: 'portfolio',
  action: 'dashboard_export',
  before: null,
  after: { format, filters: appliedFilters },
});
```

---

### describe.skipIf(!hasTestDb) repo integration

**Source:** `test/db.ts`; `lib/repositories/weekly-periods.repo.test.ts` line 20
**Apply to:** `dashboard-filter-state.repo.test.ts`

```typescript
describe.skipIf(!hasTestDb)('dashboard-filter-state.repo', () => {
  beforeAll(async () => {
    await setupRepoTables();
    await migrateDashboards(testPool());
  });
});
```

Prefer `migrateDashboards(testPool())` in `beforeAll` over hand-copying DDL into `test/repo-db.ts`.

---

### serviceErrorResponse (HTTP mapping)

**Source:** `lib/api-errors.ts` lines 42-62
**Apply to:** all dashboard routes via `withAuth` / `withCpmo` catch tail

`ValidationError` → 400 with field; `ForbiddenError` → 403.

---

## Anti-Patterns / Landmines (do NOT analogize)

| Surface | Why forbidden | Verified location |
|---------|---------------|-------------------|
| `getPortfolioSummary` | v1 inline RAG from open risks + `current_phase` Initiation/Planning/Execution/Closing — spec uses live master `stage` L0-L5 + `rag` (D-01, D-16) | `lib/services/portfolio.service.ts` lines 49-135 |
| `GET /api/portfolio` | v1 portfolio home; Phase 16 is parallel `/api/dashboards/*` (D-01) | `app/api/portfolio/route.ts` |
| `getPeriodTracking` | Asserts CPMO via `assertCompanyWrite`; PM weekly actions must use `listPeriodShellsRepo` + assignment filter (D-10, D-11) | `lib/services/weekly-tracking.service.ts` lines 178-226 |
| Weekly snapshot `wv.rag` for dashboard KPIs | Live project master is source of truth (D-16) | `weekly-reports.repo.ts` `listPeriodShellsRepo` |
| v1 consolidated weekly export for dashboard tiles | Different payload; reuse **exceljs styling** only (D-14) | `lib/export/consolidated-weekly.ts` |
| `npm install` for PDF | No new packages (D-08, CONTEXT landmine) | — |
| CASL / D-23 leftover re-gate | Explicitly out of scope (D-12) | — |

Phase 16 must **not** mutate `getPortfolioSummary`, `listPortfolioProjects` enrichment, or `GET /api/portfolio`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `normalizeRag` + active L0-L4 predicate | utility | transform | No existing spec RAG normalizer — borrow pure-fn shape from `isWeeklyReportOverdue` only; business rules are new (D-02, D-03) |
| `resolveCurrentCompanyPeriod` | utility | transform | No helper finds period containing today — compose from `listWeeklyPeriods` date bounds (D-10) |
| Portfolio dashboard PDF generator | utility | file-I/O | No in-repo PDF path verified yet — planner must pick installed dependency (D-08 discretion) |
| PM RAID/milestone action due-window filter | service | transform | Phase 12 lists are company-wide; assignment + upcoming-window filter is new composition |

---

## Metadata

**Analog search scope:** `lib/db-fiscal-budget.ts`, `lib/db-weekly-reports.ts`, `lib/db.ts`, `lib/repositories/weekly-periods.repo.ts`, `lib/repositories/projects.repo.ts`, `lib/repositories/weekly-reports.repo.ts`, `lib/repositories/weekly-export.repo.ts`, `lib/services/weekly-tracking.service.ts`, `lib/services/weekly-reports.service.ts`, `lib/services/raid-masters.service.ts`, `lib/services/portfolio.service.ts`, `lib/services/projects.service.ts`, `lib/services/access.ts`, `lib/services/audit.service.ts`, `lib/export/consolidated-weekly.ts`, `lib/http/with-role.ts`, `lib/http/with-auth.ts`, `app/api/weekly-periods/[periodId]/tracking/route.ts`, `app/api/weekly-periods/[periodId]/export/route.ts`, `app/api/weekly-periods/config/route.ts`, `app/api/weekly-periods/[periodId]/tracking/route.test.ts`, `app/api/weekly-periods/[periodId]/export/route.test.ts`, `lib/services/weekly-tracking.service.unit.test.ts`, `lib/repositories/weekly-periods.repo.test.ts`, `lib/db-fiscal-budget.ddl.unit.test.ts`, `test/repo-db.ts`, `test/db.ts`
**Files scanned:** 28
**Pattern extraction date:** 2026-08-26

## PATTERNS COMPLETE
