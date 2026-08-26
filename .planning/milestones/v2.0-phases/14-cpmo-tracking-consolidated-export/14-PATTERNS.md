# Phase 14: CPMO Tracking & Consolidated Export - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 16 new/modified files
**Analogs found:** 15 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db-weekly-export.ts` (or extend `lib/db-weekly-reports.ts`) | migration | batch | `lib/db-weekly-reports.ts` | exact |
| `lib/db-weekly-export.ddl.unit.test.ts` | test | transform | `lib/db-weekly-reports.ddl.unit.test.ts` | exact |
| `lib/db.ts` | config | batch | `lib/db.ts` (migrateWeeklyReports wire) | exact (extend) |
| `lib/repositories/weekly-export.repo.ts` | repository | CRUD (append-only) | `lib/repositories/audit.repo.ts` | exact |
| `lib/repositories/weekly-reports.repo.ts` | repository | CRUD + batch | `lib/repositories/weekly-reports.repo.ts` (`listPeriodShellsRepo`) | exact (extend) |
| `lib/services/weekly-export.service.ts` (or extend `weekly-reports.service.ts`) | service | request-response + transform + file-I/O | `lib/services/weekly-reports.service.ts` (`listPeriodShells`) + `lib/services/raid-masters.service.ts` | role-match |
| `lib/export/weekly-period-pack.ts` | utility | transform + file-I/O | `lib/export/excel.ts` + `app/api/export/weekly-report/[id]/route.ts` (styling only) | role-match |
| `app/api/weekly-periods/[periodId]/tracking/route.ts` | route | request-response | `app/api/weekly-periods/route.ts` + `app/api/portfolio/report/route.ts` (GET query) | role-match |
| `app/api/weekly-periods/[periodId]/export/preview/route.ts` | route | request-response | `app/api/weekly-periods/route.ts` (withCpmo POST + schema) | exact |
| `app/api/weekly-periods/[periodId]/export/route.ts` | route | file-I/O | `app/api/export/excel/[id]/route.ts` + `app/api/weekly-periods/route.ts` (withCpmo) | role-match |
| `lib/services/weekly-export.service.unit.test.ts` | test | — | `lib/services/weekly-reports.service.unit.test.ts` | exact |
| `app/api/weekly-periods/[periodId]/tracking/route.test.ts` | test | — | `app/api/weekly-periods/route.test.ts` | exact |
| `app/api/weekly-periods/[periodId]/export/**/route.test.ts` | test | — | `app/api/weekly-periods/route.test.ts` | exact |
| `lib/export/weekly-period-pack.unit.test.ts` | test | transform | `lib/export/excel.unit.test.ts` | exact |
| `lib/repositories/weekly-export.repo.test.ts` | test | transform | `lib/repositories/weekly-periods.repo.test.ts` | partial |
| `lib/repositories/weekly-export.repo.test.ts` (DDL hermetic) | test | transform | `lib/db-weekly-reports.ddl.unit.test.ts` | partial |

## Pattern Assignments

### `lib/db-weekly-export.ts` (migration, batch)

**Analog:** `lib/db-weekly-reports.ts` (settings-flag DDL + index flags)

**Flag + DDL export** (db-weekly-reports.ts lines 1-4, 76-119):

```typescript
import type { Pool } from 'pg';

export const WEEKLY_EXPORT_DDL_FLAG = 'weekly_export_logs_ddl_v1';

export const WEEKLY_EXPORT_DDL = [
  `
    CREATE TABLE IF NOT EXISTS weekly_export_logs (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES weekly_periods(id),
      company_id INTEGER NOT NULL REFERENCES companies(id),
      exported_by INTEGER NOT NULL REFERENCES users(id),
      exported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      format TEXT NOT NULL,
      data_version INTEGER NOT NULL,
      project_ids JSONB NOT NULL,
      period_display_name TEXT NOT NULL
    )
  `,
];
```

**Settings-flag idempotency** — copy `settingsFlagExists` / `writeSettingsFlag` / try-catch retry from `lib/db-weekly-reports.ts` lines 76-119. Invoke from `migrateWeeklyReports` **after** weekly report tables exist (D-10), or export `migrateWeeklyExportLogs` and call immediately after `migrateWeeklyReports` in `lib/db.ts` lines 631-632.

**Never:** physical DELETE helpers on `weekly_export_logs` (D-09).

---

### `lib/db.ts` (config, batch)

**Analog:** `lib/db.ts` lines 631-632

```typescript
const { migrateWeeklyReports } = await import('./db-weekly-reports');
await migrateWeeklyReports(pool);
// Phase 14: append-only export log table
const { migrateWeeklyExportLogs } = await import('./db-weekly-export');
await migrateWeeklyExportLogs(pool);
await backfillWeightedCompletion(pool);
```

---

### `lib/repositories/weekly-export.repo.ts` (repository, append-only)

**Analog:** `lib/repositories/audit.repo.ts` lines 3-26

**Append-only insert** (no UPDATE/DELETE):

```typescript
import { getDb } from '@/lib/db';

export type WeeklyExportLogInput = {
  period_id: number;
  company_id: number;
  exported_by: number;
  format: 'xlsx' | 'docx' | 'pptx';
  data_version: number;
  project_ids: number[];
  period_display_name: string;
};

export async function insertWeeklyExportLog(input: WeeklyExportLogInput): Promise<number> {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO weekly_export_logs
       (period_id, company_id, exported_by, format, data_version, project_ids, period_display_name)
     VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)
     RETURNING id`,
    input.period_id,
    input.company_id,
    input.exported_by,
    input.format,
    input.data_version,
    JSON.stringify(input.project_ids),
    input.period_display_name,
  );
  return Number(r.lastInsertRowid);
}
```

Company scope on read (if needed later): `WHERE company_id = ? AND period_id = ?` — mirror `getWeeklyPeriodByCompany` in `lib/repositories/weekly-reports.repo.ts` lines 385-394.

---

### `lib/repositories/weekly-reports.repo.ts` (extend `listPeriodShellsRepo`, company join)

**Analog:** existing `listPeriodShellsRepo` (lines 397-409) + `getWeeklyPeriodByCompany` (lines 385-394)

**D-13 defense-in-depth** — extend repo join when touched:

```typescript
export async function listPeriodShellsRepo(
  companyId: number,
  periodId: number,
): Promise<PeriodShellListRow[]> {
  const db = await getDb();
  return db.all<PeriodShellListRow>(
    `SELECT wr.project_id, wr.status, wr.first_submitted_at, wr.first_lateness,
            wr.latest_version, wr.id AS report_id, wp.due_at, wv.rag
     FROM weekly_reports wr
     JOIN weekly_periods wp ON wp.id = wr.period_id AND wp.company_id = ?
     LEFT JOIN weekly_report_versions wv
       ON wv.report_id = wr.id AND wv.version = wr.latest_version
     WHERE wr.period_id = ?
     ORDER BY wr.project_id`,
    companyId,
    periodId,
  );
}
```

**Snapshot read for export sections** — `getLatestVersionSnapshot` (lines 343-354):

```typescript
export async function getLatestVersionSnapshot(
  reportId: number,
  version: number,
): Promise<Record<string, unknown> | undefined> {
  const db = await getDb();
  const row = await db.get<{ snapshot: Record<string, unknown> }>(
    `SELECT snapshot FROM weekly_report_versions WHERE report_id = ? AND version = ?`,
    reportId,
    version,
  );
  return row?.snapshot;
}
```

Phase 14 export/preview must read snapshots only — never `listRisks` / `listIssues` for pack RAID (D-01, D-08).

---

### `lib/services/weekly-export.service.ts` — `getPeriodTracking` (service, request-response + transform)

**Analog:** `lib/services/weekly-reports.service.ts` `listPeriodShells` (lines 555-576) + `isWeeklyReportOverdue` (lines 242-250) + `lib/services/raid-masters.service.ts` `listTechnologyCouncilIssues` (lines 30-32)

**CPMO company gate** (listPeriodShells lines 555-576):

```typescript
export async function getPeriodTracking(
  companyId: number,
  periodId: number,
  actor: AccessActor,
  filters: PeriodTrackingFilters,
) {
  assertCompanyWrite(actor);
  if (actor.company_id !== companyId) throw new ForbiddenError();
  const period = await getWeeklyPeriodByCompany(companyId, periodId);
  if (!period) throw new NotFoundError('Not found', 'weekly_period');

  const shells = await listPeriodShellsRepo(companyId, periodId);
  const now = new Date();

  // Live tech-council filter flag only (D-02) — not exported RAID
  const tcIssues = await listTechnologyCouncilIssues(companyId);
  const tcProjectIds = new Set(tcIssues.map((i) => i.project_id));

  const rows = await Promise.all(
    shells.map(async (row) => {
      const project = await getProject(row.project_id);
      const pm = await getActivePrimaryAssignment(row.project_id);
      return {
        project_id: row.project_id,
        report_id: row.report_id,
        name: project?.name ?? '',
        project_code: project?.project_code ?? null,
        stage: project?.stage ?? null,
        status: row.status,
        overdue: isWeeklyReportOverdue(row.status, row.due_at, now),
        rag: row.rag,
        first_lateness: row.first_lateness,
        pm_user_id: pm?.user_id ?? null,
        pm_display_name: pm?.display_name ?? project?.pm_name ?? null,
        has_technology_council_issues: tcProjectIds.has(row.project_id),
      };
    }),
  );

  const counts = {
    obligated: rows.length,
    not_submitted: rows.filter((r) => r.status === 'not_submitted').length,
    draft: rows.filter((r) => r.status === 'draft').length,
    submitted: rows.filter((r) => r.status === 'submitted').length,
    overdue: rows.filter((r) => r.overdue).length,
    late: rows.filter((r) => r.first_lateness === 'late').length,
  };

  const filtered = applyTrackingFilters(rows, filters); // status, lateness, pm_user_id, stage, rag, technology_council
  return { period, counts, rows: filtered };
}
```

**PM lookup** — `getActivePrimaryAssignment` (`lib/repositories/pm-assignments.repo.ts` lines 47-55):

```typescript
export async function getActivePrimaryAssignment(projectId: number | string) {
  const db = await getDb();
  return db.get<PmAssignmentRow>(
    `SELECT * FROM project_pm_assignments
     WHERE project_id = ? AND role = 'primary' AND ${ACTIVE_WINDOW}
     LIMIT 1`,
    Number(projectId),
  );
}
```

**Tech-council live filter** — `listTechnologyCouncilIssues` (`lib/repositories/issues.repo.ts` lines 153-172): Open/In Progress + `technology_council IS TRUE`, company-scoped via project/customer join.

Grid RAG is `wv.rag` from shell join — **not** live `projects.rag` (D-03).

---

### `lib/services/weekly-export.service.ts` — `previewPeriodExport` / `exportPeriodPack` (service, transform + file-I/O)

**Analog:** `listPeriodShells` gate + `SubmitValidationError` for ineligible ids + `auditLog` + `lib/export/excel.ts` buffer return

**Eligibility check** (D-06, D-14) — reuse `SubmitValidationError` (`lib/services/errors.ts` lines 46-54):

```typescript
const ineligible = projectIds.filter((pid) => {
  const shell = shellByProject.get(pid);
  return !shell || shell.status !== 'submitted' || shell.latest_version < 1;
});
if (ineligible.length > 0) {
  throw new SubmitValidationError('Projects not eligible for export', ineligible.map(String));
}
```

Maps to 400 `{ error, fields }` via `serviceErrorResponse` (`lib/api-errors.ts` lines 55-57).

**Preview payload** — for each `project_id` in caller order, load `getLatestVersionSnapshot(report_id, latest_version)` and map section summary from snapshot fields only (D-08): identity, PM display name, stage, `prev_week_rag`, `this_week_rag` / version.rag, `progress_pct`, highlights, next-week goals, nearest milestone, RAID counts from `snapshot.raid`, tech-issue counts from snapshot issues where `technology_council === true`.

**Export orchestration** (D-07, D-09):

```typescript
export async function exportPeriodPack(
  companyId: number,
  periodId: number,
  actor: AccessActor,
  body: { project_ids: number[]; format: 'xlsx' | 'docx' | 'pptx' },
) {
  assertCompanyWrite(actor);
  const preview = await buildExportSections(companyId, periodId, actor, body.project_ids);
  const dataVersion = Math.max(...preview.sections.map((s) => s.latest_version));

  const buffer = await generateWeeklyPeriodPack(preview, body.format);

  await insertWeeklyExportLog({
    period_id: periodId,
    company_id: companyId,
    exported_by: actor.user_id,
    format: body.format,
    data_version: dataVersion,
    project_ids: body.project_ids,
    period_display_name: preview.period.display_name,
  });

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'weekly_period',
    entity_id: String(periodId),
    action: 'weekly_export',
    before: null,
    after: { format: body.format, data_version: dataVersion, project_ids: body.project_ids },
  });

  return { buffer, filename: preview.filename, contentType: preview.contentType };
}
```

**auditLog** (`lib/services/audit.service.ts` lines 5-8) — append-only, same call shape as Phase 13 submit.

---

### `lib/export/weekly-period-pack.ts` (utility, transform + file-I/O)

**Analog:** `lib/export/excel.ts` `generateProjectPlan` (lines 106-120, buffer return) + styling helpers from `app/api/export/weekly-report/[id]/route.ts` (lines 18-50, 253-260)

**Excel primary (xlsx)** — one workbook: summary sheet + one sheet per project (D-07). Copy palette/helpers from `lib/export/excel.ts`:

```typescript
import ExcelJS from 'exceljs';

const NAV_COLOR = '1E293B';
const LIGHT_GRAY = 'FFF8FAFC';
// hdr/info helpers from app/api/export/weekly-report/[id]/route.ts lines 27-50

export async function generateWeeklyPeriodPack(
  payload: WeeklyPeriodPackPayload,
  format: 'xlsx' | 'docx' | 'pptx',
): Promise<Buffer> {
  if (format === 'xlsx') return generateWeeklyPeriodXlsx(payload);
  if (format === 'docx') return generateWeeklyPeriodDocx(payload);
  return generateWeeklyPeriodPptx(payload);
}

async function generateWeeklyPeriodXlsx(payload: WeeklyPeriodPackPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PM Tool';
  const summary = wb.addWorksheet('Summary');
  // period_display_name, project count, data_version header rows
  for (const section of payload.sections) {
    const ws = wb.addWorksheet(sanitizeSheetName(section.project_code ?? section.name));
    // identity, PM, stage, prev/current RAG, progress, highlights, goals, milestone, RAID table, tech issues
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
```

**Word** — follow `lib/export/word.ts` `generateWordDoc` structure: `Document` + `Packer.toBuffer`, heading/body/table helpers (lines 11-55, 76-80). No `assertProjectAccess` inside generator — auth stays in service/route.

**PPT** — follow `lib/export/ppt.ts` `generateKickoffPPT` (lines 90-99, 464-465): `PptxGenJS`, `PRIMARY`/`slideTitle`/`headerCell`, return `Buffer.from(await pptx.write({ outputType: 'arraybuffer' }))`. One slide per project + cover/summary slide.

**Input contract:** pure snapshot payload — generators must **not** import repos or call `listRisks`/`listIssues`/`getWeeklyProjectReport`.

---

### `app/api/weekly-periods/[periodId]/tracking/route.ts` (route, request-response)

**Analog:** `app/api/weekly-periods/route.ts` (withCpmo) + `app/api/portfolio/report/route.ts` GET query parsing (lines 12-26)

```typescript
import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { getPeriodTracking } from '@/lib/services/weekly-export.service';

export const GET = withCpmo(async (req, { actor, params }) => {
  const periodId = Number(params.periodId);
  const { searchParams } = new URL(req.url);
  const filters = {
    status: searchParams.get('status') ?? undefined,
    lateness: searchParams.get('lateness') ?? undefined,
    pm_user_id: searchParams.get('pm_user_id') ? Number(searchParams.get('pm_user_id')) : undefined,
    stage: searchParams.get('stage') ?? undefined,
    rag: searchParams.get('rag') ?? undefined,
    technology_council: searchParams.get('technology_council') === 'true' ? true : undefined,
  };
  return NextResponse.json(
    await getPeriodTracking(actor.company_id!, periodId, actor, filters),
  );
});
```

**withCpmo** (`lib/http/with-role.ts` lines 26-34) — PM/Viewer → 403 before service. Service also calls `assertCompanyWrite` (defense in depth).

**No** `withProjectAccess` — period-scoped CPMO surface only (D-11).

Foreign period → 404 via `getWeeklyPeriodByCompany` + `NotFoundError`.

---

### `app/api/weekly-periods/[periodId]/export/preview/route.ts` (route, request-response)

**Analog:** `app/api/weekly-periods/route.ts` POST (lines 10-16)

```typescript
import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { previewPeriodExport } from '@/lib/services/weekly-export.service';
import { periodExportPreviewSchema } from './schema';

export const POST = withCpmo(
  async (_req, { actor, params, body }) => {
    const sections = await previewPeriodExport(
      actor.company_id!,
      Number(params.periodId),
      actor,
      body.project_ids,
    );
    return NextResponse.json({ sections });
  },
  { schema: periodExportPreviewSchema },
);
```

Schema: `{ project_ids: z.array(z.number().int().positive()).min(1) }` — empty array → 400 via Zod (D-14).

---

### `app/api/weekly-periods/[periodId]/export/route.ts` (route, file-I/O)

**Analog:** `app/api/export/excel/[id]/route.ts` (binary response) + `withCpmo` auth

```typescript
import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { exportPeriodPack } from '@/lib/services/weekly-export.service';
import { periodExportSchema } from './schema';

const CONTENT_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export const POST = withCpmo(
  async (_req, { actor, params, body }) => {
    const { buffer, filename, contentType } = await exportPeriodPack(
      actor.company_id!,
      Number(params.periodId),
      actor,
      body,
    );
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType ?? CONTENT_TYPES[body.format],
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  },
  { schema: periodExportSchema },
);
```

Compare Word/PPT existing routes: `app/api/export/word/[id]/[type]/route.ts` lines 16-22, `app/api/export/ppt/[id]/route.ts` lines 13-18.

---

### Test files

#### `lib/services/weekly-export.service.unit.test.ts`

**Analog:** `lib/services/weekly-reports.service.unit.test.ts` lines 1-95 + `listPeriodShells` describe block (lines 908-962)

**Mock harness**:

```typescript
vi.mock('./access', () => ({ assertCompanyWrite }));
vi.mock('./audit.service', () => ({ auditLog: vi.fn() }));
vi.mock('@/lib/repositories/weekly-reports.repo', () => ({
  getWeeklyPeriodByCompany,
  listPeriodShellsRepo,
  getLatestVersionSnapshot,
}));
vi.mock('@/lib/repositories/weekly-export.repo', () => ({ insertWeeklyExportLog: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ getProject: vi.fn() }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ getActivePrimaryAssignment: vi.fn() }));
vi.mock('@/lib/repositories/issues.repo', () => ({ listTechnologyCouncilIssues: vi.fn() }));
vi.mock('@/lib/export/weekly-period-pack', () => ({ generateWeeklyPeriodPack: vi.fn() }));
```

**Tests to add:**
- `getPeriodTracking` calls `assertCompanyWrite`; foreign `companyId` → `ForbiddenError`; unknown period → `NotFoundError`
- Counts: `overdue` computed, `late` from `first_lateness === 'late'`, never stored as status
- Filters: `status=overdue`, `technology_council=true`, `pm_user_id`, `rag`
- `previewPeriodExport` ineligible project ids → `SubmitValidationError` with `fields`
- `exportPeriodPack` inserts log + `auditLog` action `weekly_export`; never reads live RAID repos
- Snapshot-only: mock `getLatestVersionSnapshot`, assert generators receive snapshot payload

#### `app/api/weekly-periods/[periodId]/tracking/route.test.ts`

**Analog:** `app/api/weekly-periods/route.test.ts` lines 1-76

```typescript
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/weekly-export.service', () => ({ getPeriodTracking: vi.fn() }));

const ctx = (periodId: string) => ({ params: Promise.resolve({ periodId }) });

// 401 without session; 403 pm/viewer; 200 cpmo; query params forwarded
```

Reuse `cpmoSession`, `pmSession`, `viewerSession` fixtures from `route.test.ts` lines 15-40.

#### `app/api/weekly-periods/[periodId]/export/**/route.test.ts`

**Analog:** `app/api/weekly-periods/route.test.ts` + binary assertion from export routes

- Preview POST: 403 non-cpmo; 400 ineligible via mocked `SubmitValidationError`
- Export POST: 403 non-cpmo; 200 returns `Content-Type` for xlsx/docx/pptx; mocks service buffer

No `hasActivePmAssignment` mock — CPMO-only routes (D-11).

#### `lib/export/weekly-period-pack.unit.test.ts`

**Analog:** `lib/export/excel.unit.test.ts` lines 1-58

Pure function tests — pass fixture snapshot sections, assert Buffer returned, sheet/slide counts. Mock **nothing** from repos when testing layout helpers; optional smoke test per format.

#### `lib/repositories/weekly-export.repo.test.ts`

**Analog:** `lib/repositories/weekly-periods.repo.test.ts` lines 1-18 (`describe.skipIf(!hasTestDb)`, `migrateWeeklyReports`, `setupRepoTables`)

Integration: insert log row, verify JSON `project_ids`, no DELETE path exported.

#### `lib/db-weekly-export.ddl.unit.test.ts`

**Analog:** `lib/db-weekly-reports.ddl.unit.test.ts`

Assert `weekly_export_logs` CREATE TABLE, FK to `weekly_periods` / `companies` / `users`, no DELETE helpers.

---

## Shared Patterns

### withCpmo + assertCompanyWrite (all Phase 14 routes)

**Source:** `lib/http/with-role.ts` lines 26-34; `lib/services/access.ts` `assertCompanyWrite`
**Apply to:** tracking GET, export preview POST, export POST

```typescript
export function withCpmo(handler, opts?) {
  return withRole('cpmo', handler, opts);
}

export function assertCompanyWrite(actor: AccessActor): void {
  if (!isCpmo(actor)) throw new ForbiddenError();
  if (actor.company_id === null) throw new ForbiddenError();
}
```

Seed `admin` (`company_id: null`) → 403 on all Phase 14 routes (Phase 10).

---

### serviceErrorResponse (HTTP mapping)

**Source:** `lib/api-errors.ts` lines 42-62
**Apply to:** all routes via `withAuth` catch tail

```typescript
if (e instanceof SubmitValidationError) {
  return NextResponse.json({ error: e.message, fields: e.fields }, { status: 400 });
}
if (e instanceof ConflictError) {
  return NextResponse.json({ error: e.message }, { status: 409 });
}
```

Use `SubmitValidationError` for ineligible `project_ids` (D-06). Empty `project_ids` → Zod 400 at route boundary.

---

### isWeeklyReportOverdue (computed overdue, not stored status)

**Source:** `lib/services/weekly-reports.service.ts` lines 242-250
**Apply to:** tracking counts + `status=overdue` filter

```typescript
export function isWeeklyReportOverdue(status: string, dueAt: Date | string, now: Date): boolean {
  if (status !== 'not_submitted' && status !== 'draft') return false;
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  return now.getTime() > due.getTime();
}
```

---

### Snapshot read path (export + preview)

**Source:** `getLatestVersionSnapshot` + Phase 13 submit immutability
**Apply to:** preview sections, xlsx/docx/pptx pack bodies

```typescript
const snapshot = await getLatestVersionSnapshot(shell.report_id, shell.latest_version);
// snapshot.progress_pct, snapshot.raid, snapshot.this_week_rag, snapshot.prev_week_rag, ...
// NEVER: getWeeklyProjectReport, listOpenIssues, listOpenRisks for pack content
```

Live `listTechnologyCouncilIssues` is **filter-only** on tracking grid (D-02).

---

### Binary file response

**Source:** `app/api/export/excel/[id]/route.ts` lines 8-16
**Apply to:** `POST .../export`

```typescript
return new NextResponse(buf as unknown as BodyInit, {
  status: 200,
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
  },
});
```

---

### auditLog + append-only export log

**Source:** `lib/repositories/audit.repo.ts` lines 13-26; `lib/services/audit.service.ts` lines 5-8
**Apply to:** successful export only

```typescript
await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'weekly_period',
  entity_id: String(periodId),
  action: 'weekly_export',
  before: null,
  after: { format, data_version, project_ids },
});
```

Concurrent exports allowed — append-only log (D-14).

---

## Anti-Patterns / Landmines (do NOT analogize)

| Surface | Why forbidden | Verified location |
|---------|---------------|-------------------|
| `getWeeklyProjectReport` | Activity-weighted live data | `lib/services/project-report.service.ts` |
| `POST /api/export/weekly-report/[id]` | v1 live-data Excel | `app/api/export/weekly-report/[id]/route.ts` |
| `generateProjectPlan` / kickoff exports | Pull live RAID/activities | `lib/export/excel.ts`, `lib/export/ppt.ts` |
| Live RAID in export pack | Violates CPMO-04 / RAID-02 | D-01 |
| `projects.rag` for grid RAG | Grid uses version snapshot RAG | D-03 |
| Physical DELETE on export logs | D-09 append-only | — |
| `listPeriodShellsRepo(periodId)` without company join | IDOR at repo layer | D-13, 13-REVIEW IN-02 |

Phase 14 must **not** import `project-report.service` or reuse v1 weekly-report export route handlers.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/export/weekly-period-pack.ts` (multi-project consolidated layout) | utility | transform + file-I/O | No existing multi-project weekly snapshot pack — borrow styling from v1 weekly-report Excel route and structure from `generateProjectPlan`, but payload contract is new |

---

## Metadata

**Analog search scope:** `lib/db-weekly-reports.ts`, `lib/db.ts`, `lib/repositories/audit.repo.ts`, `lib/repositories/weekly-reports.repo.ts`, `lib/repositories/weekly-periods.repo.ts`, `lib/repositories/pm-assignments.repo.ts`, `lib/repositories/issues.repo.ts`, `lib/services/weekly-reports.service.ts`, `lib/services/raid-masters.service.ts`, `lib/services/audit.service.ts`, `lib/services/errors.ts`, `lib/api-errors.ts`, `lib/http/with-role.ts`, `lib/http/with-auth.ts`, `lib/export/excel.ts`, `lib/export/word.ts`, `lib/export/ppt.ts`, `app/api/weekly-periods/route.ts`, `app/api/weekly-periods/route.test.ts`, `app/api/export/excel/[id]/route.ts`, `app/api/export/weekly-report/[id]/route.ts`, `app/api/portfolio/report/route.ts`, `lib/services/weekly-reports.service.unit.test.ts`, `lib/export/excel.unit.test.ts`, `lib/repositories/weekly-periods.repo.test.ts`
**Files scanned:** 26
**Pattern extraction date:** 2026-08-26

## PATTERNS COMPLETE
