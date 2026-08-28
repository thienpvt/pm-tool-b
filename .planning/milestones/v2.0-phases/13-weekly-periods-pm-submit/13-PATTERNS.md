# Phase 13: Weekly Periods & PM Submit - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 20 new/modified files
**Analogs found:** 18 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db-weekly-reports.ts` | migration | batch | `lib/db-raid-masters.ts` + `lib/db-project-master.ts` | exact |
| `lib/db-weekly-reports.ddl.unit.test.ts` | test | transform | `lib/db-raid-masters.ddl.unit.test.ts` | exact |
| `lib/db.ts` | config | batch | `lib/db.ts` (migrateRaidMasters wire) | exact |
| `lib/repositories/weekly-periods.repo.ts` | repository | CRUD + batch | `lib/repositories/rag-config.repo.ts` + `lib/repositories/pm-assignments.repo.ts` | role-match |
| `lib/repositories/weekly-reports.repo.ts` | repository | CRUD (append versions) | `lib/repositories/audit.repo.ts` + `lib/repositories/pm-assignments.repo.ts` | role-match |
| `lib/services/weekly-reports.service.ts` | service | request-response + transform | `lib/services/pm-assignments.service.ts` + `lib/services/risks.service.ts` + `lib/services/raid-masters.service.ts` | role-match |
| `lib/services/errors.ts` | utility | — | `lib/services/errors.ts` (`ValidationError`) | exact (extend) |
| `lib/api-errors.ts` | utility | request-response | `lib/api-errors.ts` (`serviceErrorResponse`) | exact (extend) |
| `app/api/weekly-periods/route.ts` | route | request-response | `app/api/admin/users/route.ts` | exact |
| `app/api/weekly-periods/config/route.ts` | route | request-response | `app/api/admin/users/route.ts` + `lib/repositories/rag-config.repo.ts` | role-match |
| `app/api/projects/[id]/weekly-reports/route.ts` | route | request-response | `app/api/projects/[id]/pm-assignments/route.ts` | exact |
| `app/api/projects/[id]/weekly-reports/[reportId]/route.ts` | route | request-response | `app/api/projects/[id]/risks/route.ts` | role-match |
| `app/api/projects/[id]/weekly-reports/[reportId]/submit/route.ts` | route | request-response | `app/api/projects/[id]/risks/route.ts` (POST) | role-match |
| `app/api/projects/[id]/weekly-reports/[reportId]/correct/route.ts` | route | request-response | `app/api/projects/[id]/pm-assignments/route.ts` (PATCH) | partial |
| `lib/services/weekly-reports.service.unit.test.ts` | test | — | `lib/services/risks.service.unit.test.ts` + `lib/services/pm-assignments.service.unit.test.ts` | exact |
| `app/api/weekly-periods/route.test.ts` | test | — | `app/api/admin/users/route.test.ts` | exact |
| `app/api/projects/[id]/weekly-reports/**/route.test.ts` | test | — | `app/api/projects/[id]/risks/route.test.ts` | exact |
| `lib/repositories/weekly-periods.repo.test.ts` | test | transform | `lib/db-project-master.ddl.unit.test.ts` | partial |
| `lib/repositories/weekly-reports.repo.test.ts` | test | transform | `lib/db-project-master.ddl.unit.test.ts` | partial |

## Pattern Assignments

### `lib/db-weekly-reports.ts` (migration, batch)

**Analog:** `lib/db-raid-masters.ts` (CREATE TABLE + flags) + `lib/db-project-master.ts` (multi-table DDL export)

**Imports pattern** (db-raid-masters.ts lines 1-5):

```typescript
import type { Pool } from 'pg';

export const WEEKLY_REPORTS_DDL_FLAG = 'weekly_reports_ddl_v1';
export const WEEKLY_REPORTS_INDEX_FLAG = 'weekly_reports_index_v1';
```

**DDL export array** — mirror `RAID_MASTERS_DDL` / `PROJECT_MASTER_DDL` structure; Phase 13 creates four tables (no ALTER on existing tables except optional `closed_at`):

```typescript
/** Hermetic unit-test assertions against the DDL strings (D-02, D-04, D-14). */
export const WEEKLY_REPORTS_DDL = [
  `
    CREATE TABLE IF NOT EXISTS company_weekly_config (
      company_id INTEGER PRIMARY KEY REFERENCES companies(id),
      due_weekday SMALLINT NOT NULL DEFAULT 5,
      due_time_utc TIME NOT NULL DEFAULT '18:00:00',
      updated_at TIMESTAMPTZ DEFAULT now(),
      updated_by INTEGER REFERENCES users(id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS weekly_periods (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      iso_week TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      due_at TIMESTAMPTZ NOT NULL,
      display_name TEXT NOT NULL,
      config_snapshot JSONB NOT NULL,
      closed_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (company_id, iso_week)
    )
  `,
  // weekly_reports shell + weekly_report_versions — see RESEARCH schema
];
```

**Separate index DDL array** (db-raid-masters.ts lines 32-44 pattern):

```typescript
export const WEEKLY_REPORTS_INDEX_DDL = [
  `CREATE UNIQUE INDEX IF NOT EXISTS weekly_reports_period_project_unique
     ON weekly_reports (period_id, project_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS weekly_report_versions_report_version_unique
     ON weekly_report_versions (report_id, version)`,
];
```

**Settings-flag idempotency** (db-raid-masters.ts lines 46-70):

```typescript
async function settingsFlagExists(pool: Pool, key: string): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 FROM settings WHERE key = $1 LIMIT 1', [key]);
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

async function writeSettingsFlag(pool: Pool, key: string): Promise<void> {
  await pool.query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    [key, new Date().toISOString()],
  );
}

async function migrateWeeklyReportsDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, WEEKLY_REPORTS_DDL_FLAG)) return;
  for (const sql of WEEKLY_REPORTS_DDL) {
    await pool.query(sql);
  }
  await writeSettingsFlag(pool, WEEKLY_REPORTS_DDL_FLAG);
}
```

**Orchestrator with try/catch retry** (db-raid-masters.ts lines 130-137):

```typescript
export async function migrateWeeklyReports(pool: Pool): Promise<void> {
  try {
    await migrateWeeklyReportsDdl(pool);
    await migrateWeeklyReportsIndexes(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
```

**Dependency:** Must run after `migrateProjectMaster` (needs `weekly_report_enabled`, `weekly_report_start_period` on `projects`) and after `migrateRaidMasters` (D-14).

---

### `lib/db.ts` (config, batch)

**Analog:** `lib/db.ts` lines 614-618

**Wire immediately after migrateRaidMasters** (before `backfillWeightedCompletion`):

```typescript
const { migrateProjectMaster } = await import('./db-project-master');
await migrateProjectMaster(pool);
const { migrateRaidMasters } = await import('./db-raid-masters');
await migrateRaidMasters(pool);
const { migrateWeeklyReports } = await import('./db-weekly-reports');
await migrateWeeklyReports(pool);
await backfillWeightedCompletion(pool);
```

---

### `lib/db-weekly-reports.ddl.unit.test.ts` (test, transform)

**Analog:** `lib/db-raid-masters.ddl.unit.test.ts`

**Test harness** (lines 1-13):

```typescript
import { describe, expect, it } from 'vitest';
import {
  WEEKLY_REPORTS_DDL,
  WEEKLY_REPORTS_DDL_FLAG,
  WEEKLY_REPORTS_INDEX_DDL,
  migrateWeeklyReports,
} from './db-weekly-reports';

describe('migrateWeeklyReports DDL fragments', () => {
  it('exports migrateWeeklyReports and weekly_reports_ddl_v1 settings flag key', () => {
    expect(typeof migrateWeeklyReports).toBe('function');
    expect(WEEKLY_REPORTS_DDL_FLAG).toBe('weekly_reports_ddl_v1');
  });
```

**Assert:** `company_weekly_config`, `weekly_periods`, `weekly_reports`, `weekly_report_versions` CREATE TABLE; `UNIQUE (company_id, iso_week)`; `weekly_reports_period_project_unique`; shell status column; version `(report_id, version)` unique; no `DELETE` helpers exported.

---

### `lib/repositories/weekly-periods.repo.ts` (repository, CRUD + batch)

**Analog:** `lib/repositories/rag-config.repo.ts` (company one-row config) + `lib/repositories/pm-assignments.repo.ts` (transaction)

**Imports** (rag-config.repo.ts lines 1-2):

```typescript
import { getDb } from '@/lib/db';
import { Pool } from 'pg';
```

**Company config upsert** (rag-config.repo.ts lines 19-39 — adapt for `company_weekly_config`):

```typescript
export async function upsertCompanyWeeklyConfig(
  companyId: number,
  config: { due_weekday: number; due_time_utc: string; updated_by: number },
) {
  const db = await getDb();
  await db.run(
    `INSERT INTO company_weekly_config (company_id, due_weekday, due_time_utc, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (company_id) DO UPDATE SET
       due_weekday = excluded.due_weekday,
       due_time_utc = excluded.due_time_utc,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    companyId, config.due_weekday, config.due_time_utc, config.updated_by,
  );
}
```

**Obligation query at period create** (D-04 — uses existing project columns from db-project-master.ts lines 15-16):

```typescript
export async function listObligatedProjectIds(companyId: number, isoWeek: string): Promise<number[]> {
  const db = await getDb();
  const rows = await db.all<{ id: number }>(
    `SELECT p.id
     FROM projects p
     WHERE p.company_id = ?
       AND p.weekly_report_enabled = TRUE
       AND p.weekly_report_start_period <= ?
       AND COALESCE(p.stage, '') <> 'L5'
       AND COALESCE(p.status, '') NOT IN ('Completed', 'Paused', 'Cancelled', 'Other')`,
    companyId,
    isoWeek,
  );
  return rows.map((r) => r.id);
}
```

**Terminal status set** — reuse same literals as `lib/services/project-governance.ts` line 3:

```typescript
const TERMINAL_STATUSES = new Set(['Completed', 'Paused', 'Cancelled', 'Other']);
// SQL NOT IN above must match exactly
```

**Transaction for period + shells** (pm-assignments.repo.ts lines 199-216, 218-239):

```typescript
async function withPgTransaction<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(pool);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
```

Period create: INSERT period → SELECT obligated ids → INSERT shells with `ON CONFLICT (period_id, project_id) DO NOTHING`. Company-scoped list: `WHERE company_id = ? ORDER BY iso_week DESC`.

---

### `lib/repositories/weekly-reports.repo.ts` (repository, CRUD + append)

**Analog:** `lib/repositories/audit.repo.ts` (append-only insert) + scoped UPDATE pattern from `lib/repositories/risks.repo.ts` lines 106-116

**Append-only version insert** (audit.repo.ts lines 13-25):

```typescript
export async function insertWeeklyReportVersion(input: {
  report_id: number;
  version: number;
  snapshot: unknown;
  submitted_at: string;
  submitted_by: number;
  rag: string;
  progress_pct: number;
}) {
  const db = await getDb();
  await db.run(
    `INSERT INTO weekly_report_versions
       (report_id, version, snapshot, submitted_at, submitted_by, rag, progress_pct)
     VALUES (?, ?, ?::jsonb, ?, ?, ?, ?)`,
    input.report_id,
    input.version,
    JSON.stringify(input.snapshot),
    input.submitted_at,
    input.submitted_by,
    input.rag,
    input.progress_pct,
  );
}
```

**Scoped shell UPDATE (draft save)** — mirror risks.repo.ts:

```typescript
export async function updateWeeklyReportDraft(
  projectId: number,
  reportId: number,
  fields: Record<string, unknown>,
) {
  const db = await getDb();
  return db.get(
    `UPDATE weekly_reports wr SET /* allowlisted draft columns */
     FROM weekly_periods wp
     JOIN projects p ON p.id = wr.project_id
     WHERE wr.id = ? AND wr.project_id = ? AND wr.period_id = wp.id
       AND wr.status IN ('not_submitted', 'draft')
     RETURNING wr.*`,
    reportId,
    projectId,
  );
}
```

**History join** (WKRP-06): one row per period, newest `iso_week` first — join `weekly_reports` → `weekly_periods` → latest `weekly_report_versions` on `(report_id, version = latest_version)`.

**IDOR prevention:** All shell/version reads JOIN `weekly_reports.project_id = ?` (same as risks `WHERE id = ? AND project_id = ?`).

**Never:** UPDATE `weekly_report_versions.snapshot`; physical DELETE on any weekly table (D-17).

---

### `lib/services/weekly-reports.service.ts` (service, request-response + transform)

**Analog:** `lib/services/pm-assignments.service.ts` (CPMO company writes) + `lib/services/risks.service.ts` (PM write gate, ConflictError) + `lib/services/raid-masters.service.ts` (export list helpers)

**Imports** (pm-assignments.service.ts lines 1-22 + risks.service.ts lines 1-12):

```typescript
import {
  assertCompanyWrite,
  assertProjectAccess,
  assertProjectWriteAccess,
  type AccessActor,
} from './access';
import { auditLog } from './audit.service';
import { createRisk, updateRisk } from './risks.service';
import { createIssue, updateIssue } from './issues.service';
import {
  ConflictError,
  NotFoundError,
  SubmitValidationError,
  ValidationError,
} from './errors';
```

**CPMO period create** (pm-assignments.service.ts lines 48-54 pattern — company write after implicit company scope):

```typescript
export async function createWeeklyPeriod(actor: AccessActor, body: Record<string, unknown>) {
  assertCompanyWrite(actor);
  // validate iso_week via WEEKLY_PERIOD_PATTERN from project-governance.ts line 5
  const period = await createPeriodWithShellsRepo(actor.company_id!, body, actor.user_id);
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'weekly_period',
    entity_id: String(period.id),
    action: 'create',
    before: null,
    after: { iso_week: period.iso_week, display_name: period.display_name },
  });
  return period;
}
```

**PM draft save** (risks.service.ts lines 35-40 write gate):

```typescript
export async function saveWeeklyReportDraft(
  projectId: number | string,
  reportId: number | string,
  actor: AccessActor,
  fields: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const shell = await getWeeklyReportShell(projectId, reportId);
  if (!shell) throw new NotFoundError('Not found', 'weekly_report');
  if (shell.status === 'submitted') {
    throw new ConflictError('Submitted report cannot be edited');
  }
  // Strip prev_week_rag from allowlist (D-07)
  // First save of any draft field → status 'draft' if was 'not_submitted'
  return updateWeeklyReportDraft(projectId, reportId, allowedFields);
}
```

**PM read history** (risks.service.ts lines 30-32 read gate):

```typescript
export async function listProjectWeeklyHistory(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listProjectWeeklyHistoryRepo(projectId);
}
```

**Submit orchestration** — call existing RAID services with same `actor` (risks.service.ts lines 53-92); never call `getWeeklyProjectReport` or write `projects.progress_pct`:

```typescript
// 1. assertProjectWriteAccess
// 2. validate structured fields + draft_raid_json → SubmitValidationError(fields)
// 3. for each raid entry: createRisk/updateRisk/createIssue/updateIssue
// 4. READ projects.progress_pct; conditional UPDATE projects.rag only if this_week_rag differs
// 5. INSERT weekly_report_versions; UPDATE shell status/submitted metadata
// 6. auditLog action 'weekly_submit' | 'weekly_correct'
```

**Export helpers for Phase 14/16** (raid-masters.service.ts lines 14-31 thin re-export pattern):

```typescript
export async function listPeriodShells(
  companyId: number,
  periodId: number,
  actor: AccessActor,
) {
  assertCompanyWrite(actor);
  if (actor.company_id !== companyId) throw new ForbiddenError();
  return listPeriodShellsRepo(companyId, periodId);
}
```

**ConflictError on submitted PATCH** → 409 via `serviceErrorResponse` (lib/api-errors.ts lines 54-55).

---

### `lib/services/errors.ts` + `lib/api-errors.ts` (SubmitValidationError gap)

**Analog:** `lib/services/errors.ts` lines 28-35 (`ValidationError` single field)

**Current ValidationError** (single `field` — insufficient for D-11):

```typescript
export class ValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
```

**Phase 13 extension** — add alongside, do not overload `ValidationError.field`:

```typescript
/** Multi-field submit validation (RAID-03). Maps to 400 { error, fields: string[] }. */
export class SubmitValidationError extends Error {
  readonly fields: string[];

  constructor(message: string, fields: string[]) {
    super(message);
    this.name = 'SubmitValidationError';
    this.fields = fields;
  }
}
```

**Route mapping** — extend `serviceErrorResponse` OR handle in submit route only (RESEARCH open question):

```typescript
// lib/api-errors.ts — add before generic 500 fallback
if (e instanceof SubmitValidationError) {
  return NextResponse.json({ error: e.message, fields: e.fields }, { status: 400 });
}
```

Existing single-field path unchanged (lines 49-52):

```typescript
if (e instanceof ValidationError) {
  const body: { error: string; field?: string } = { error: e.message };
  if (e.field !== undefined) body.field = e.field;
  return NextResponse.json(body, { status: 400 });
}
```

---

### `app/api/weekly-periods/route.ts` (route, request-response)

**Analog:** `app/api/admin/users/route.ts`

**CPMO wrapper + Zod schema** (admin/users lines 1-30):

```typescript
import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { createWeeklyPeriod, listWeeklyPeriods } from '@/lib/services/weekly-reports.service';
import { createPeriodSchema } from './schema';

export const GET = withCpmo(async (_req, { actor }) =>
  NextResponse.json(await listWeeklyPeriods(actor)),
);

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const period = await createWeeklyPeriod(actor, body);
    return NextResponse.json(period, { status: 201 });
  },
  { schema: createPeriodSchema },
);
```

**Error mapping:** `withAuth` catch tail calls `serviceErrorResponse` automatically (with-auth.ts lines 121-136) — no route-level try/catch needed unless custom ValidationError handling like admin/users DELETE (lines 48-55).

**withCpmo definition** (with-role.ts lines 26-34):

```typescript
export function withCpmo<TParams, TBody>(handler, opts?) {
  return withRole('cpmo', handler, opts);
}
```

**Service-side company write:** `assertCompanyWrite(actor)` inside `createWeeklyPeriod` / config upsert (access.ts lines 126-128).

---

### `app/api/weekly-periods/config/route.ts` (route, request-response)

**Analog:** `app/api/admin/users/route.ts` (withCpmo) + `lib/repositories/rag-config.repo.ts` (GET/PUT one row per company)

```typescript
export const GET = withCpmo(async (_req, { actor }) =>
  NextResponse.json(await getCompanyWeeklyConfig(actor)),
);

export const PUT = withCpmo(
  async (_req, { actor, body }) => {
    await upsertCompanyWeeklyConfig(actor, body);
    return NextResponse.json({ ok: true });
  },
  { schema: weeklyConfigSchema },
);
```

Config PUT does not UPDATE existing `weekly_periods` rows (PERD-02) — service only touches `company_weekly_config`.

---

### `app/api/projects/[id]/weekly-reports/route.ts` (route, request-response)

**Analog:** `app/api/projects/[id]/pm-assignments/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { listProjectWeeklyHistory } from '@/lib/services/weekly-reports.service';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listProjectWeeklyHistory(params.id, actor)),
);
```

**Do not reuse:** `app/api/projects/[id]/report/route.ts` (`getWeeklyProjectReport` — landmine).

---

### `app/api/projects/[id]/weekly-reports/[reportId]/route.ts` (route, request-response)

**Analog:** `app/api/projects/[id]/risks/route.ts` (GET read + PATCH/PUT mutate)

```typescript
export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await getWeeklyReportShell(params.id, actor, params.reportId)),
);

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await saveWeeklyReportDraft(params.id, params.reportId, actor, body as Record<string, unknown>),
    ),
  { schema: weeklyReportDraftSchema },
);
```

Write gate lives in service (`assertProjectWriteAccess`), not route — same as risks route driving real service with mocked repos.

---

### `app/api/projects/[id]/weekly-reports/[reportId]/submit/route.ts` (route, request-response)

**Analog:** POST handler shape from risks route; map `SubmitValidationError` if not in global `serviceErrorResponse`:

```typescript
export const POST = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(
    await submitWeeklyReport(params.id, params.reportId, actor),
    { status: 201 },
  ),
);
```

---

### `app/api/projects/[id]/weekly-reports/[reportId]/correct/route.ts` (route, request-response)

**Analog:** `app/api/projects/[id]/pm-assignments/route.ts` PATCH (body + id in payload) — planner names final path.

```typescript
export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await openWeeklyReportCorrection(params.id, params.reportId, actor, body)),
  { schema: weeklyReportCorrectionSchema },
);
```

---

### Test files

#### `lib/services/weekly-reports.service.unit.test.ts`

**Analog:** `lib/services/risks.service.unit.test.ts` lines 1-51 + `lib/services/pm-assignments.service.unit.test.ts` lines 1-53

**Mock harness**:

```typescript
vi.mock('@/lib/services/access', () => ({
  assertProjectAccess,
  assertProjectWriteAccess,
  assertCompanyWrite,
}));
vi.mock('./audit.service', () => ({ auditLog: vi.fn() }));
vi.mock('./risks.service', () => ({ createRisk: vi.fn(), updateRisk: vi.fn() }));
vi.mock('./issues.service', () => ({ createIssue: vi.fn(), updateIssue: vi.fn() }));
vi.mock('@/lib/repositories/weekly-periods.repo', () => ({ /* ... */ }));
vi.mock('@/lib/repositories/weekly-reports.repo', () => ({ /* ... */ }));
```

**Write gate assertion** (risks.service.unit.test.ts pattern):

```typescript
it('saveWeeklyReportDraft does not call repo when write access denied', async () => {
  assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
  await expect(saveWeeklyReportDraft(7, 1, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
  expect(updateDraftRepo).not.toHaveBeenCalled();
});
```

**Tests to add:**
- `createWeeklyPeriod` calls `assertCompanyWrite`, materializes shells, `auditLog`
- Submit success: mocks `createRisk`/`updateIssue`, inserts version, never UPDATE `progress_pct` on projects
- Submit RAID failure: `SubmitValidationError` with `fields: ['raid.risks[0].description']`
- PATCH submitted shell → `ConflictError`
- `first_submitted_at` / `first_lateness` unchanged on correction submit
- `prev_week_rag` stripped from PATCH allowlist

#### `app/api/weekly-periods/route.test.ts`

**Analog:** `app/api/admin/users/route.test.ts` lines 1-72

```typescript
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/weekly-reports.service', () => ({
  listWeeklyPeriods: vi.fn(),
  createWeeklyPeriod: vi.fn(),
}));

// 401 without session; 403 for pm/viewer; 200/201 for cpmo
```

No `hasActivePmAssignment` mock needed — CPMO routes use `withCpmo` only.

#### `app/api/projects/[id]/weekly-reports/**/route.test.ts`

**Analog:** `app/api/projects/[id]/risks/route.test.ts` lines 1-57

```typescript
const { projectAccessRow, hasActivePmAssignment, /* weekly repos */ } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  // ...
}));

vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));

beforeEach(() => {
  vi.clearAllMocks();
  hasActivePmAssignment.mockResolvedValue(true);
  projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
});
```

**Session fixtures** — copy `ownerSession` (pm), `viewerSession`, `cpmoSession` from risks/pm-assignments route tests.

**Key assertions:**
- Viewer PATCH/submit → 403
- PM without assignment (`hasActivePmAssignment.mockResolvedValue(false)`) → 403
- CPMO GET history → 200 (read via `assertProjectAccess`, no assignment required for CPMO)
- Submit validation → 400 with `{ error, fields: [...] }` body shape

---

## Shared Patterns

### withCpmo + assertCompanyWrite (period/config routes)

**Source:** `lib/http/with-role.ts` lines 26-34; `lib/services/access.ts` lines 126-128
**Apply to:** `/api/weekly-periods`, `/api/weekly-periods/config`, `listPeriodShells`

```typescript
export function withCpmo(handler, opts?) {
  return withRole('cpmo', handler, opts);
}

export function assertCompanyWrite(actor: AccessActor): void {
  if (!isCpmo(actor)) throw new ForbiddenError();
  if (actor.company_id === null) throw new ForbiddenError();
}
```

Period routes use **only** `withCpmo` + service `assertCompanyWrite` — no nested `assertProjectAccess`.

---

### assertProjectWriteAccess (PM draft/submit/correct)

**Source:** `lib/services/access.ts` lines 131-138
**Apply to:** all PM mutate paths in `weekly-reports.service.ts`

```typescript
export async function assertProjectWriteAccess(
  projectId: number | string,
  actor: AccessActor,
): Promise<void> {
  await assertProjectAccess(projectId, actor);
  assertCanMutate(actor);
  await assertPmWriteAccess(projectId, actor);
}
```

`assertPmWriteAccess` uses `hasActivePmAssignment` (pm-assignments.repo.ts lines 21-34) — route tests mock this, not `getProjectPmIdentity`.

---

### serviceErrorResponse (HTTP mapping)

**Source:** `lib/api-errors.ts` lines 41-58
**Apply to:** all routes via `withAuth` catch tail

```typescript
export function serviceErrorResponse(e: unknown) {
  if (e instanceof ForbiddenError) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (e instanceof NotFoundError) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (e instanceof ValidationError) {
    const body: { error: string; field?: string } = { error: e.message };
    if (e.field !== undefined) body.field = e.field;
    return NextResponse.json(body, { status: 400 });
  }
  if (e instanceof ConflictError) {
    return NextResponse.json({ error: e.message }, { status: 409 });
  }
  // Phase 13: add SubmitValidationError → { error, fields }
  console.error('Unexpected service error', e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

Services stay HTTP-free (SVC-03).

---

### ConflictError → 409 (submitted shell PATCH)

**Source:** `lib/services/errors.ts` lines 38-43
**Apply to:** PATCH draft when `status === 'submitted'`, duplicate period `(company_id, iso_week)`

```typescript
export class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

if (shell.status === 'submitted') {
  throw new ConflictError('Submitted report cannot be edited');
}
```

---

### auditLog (period create, submit, correction)

**Source:** `lib/services/audit.service.ts` lines 5-8; call shape from `lib/services/pm-assignments.service.ts` lines 113-121

```typescript
export async function auditLog(input: AuditLogInput): Promise<void> {
  await insertAuditLog(input);
}

await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'weekly_report',
  entity_id: String(reportId),
  action: isFirstSubmit ? 'weekly_submit' : 'weekly_correct',
  before: { latest_version: priorVersion },
  after: { latest_version: priorVersion + 1, version_id: newVersionId },
});
```

---

### RAID submit via existing services (not direct SQL)

**Source:** `lib/services/risks.service.ts` lines 35-51, 53-92; `lib/services/issues.service.ts` lines 35-50
**Apply to:** submit transaction only — never on draft PATCH

```typescript
// id: 'new' → createRisk(projectId, actor, fields)
// id: number → updateRisk(projectId, actor, rowId, fields)
// Same for issues — preserves auto-code, ConflictError, due-date history
```

Weekly service passes same `actor` so write gates compose correctly.

---

### progress_pct copy-at-submit, never write-back

**Source:** `lib/services/project-governance.ts` lines 50-51 comment; D-10

```typescript
// READ only at submit:
const project = await getProject(projectId);
const progressPct = project.progress_pct ?? 0;
// snapshot.progress_pct = progressPct
// NEVER: UPDATE projects SET progress_pct = ...
// RAG sync only when this_week_rag !== projects.rag
```

---

### Route test mocks: hasActivePmAssignment

**Source:** `app/api/projects/[id]/risks/route.test.ts` lines 5-28, 52-56

```typescript
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));

beforeEach(() => {
  hasActivePmAssignment.mockResolvedValue(true);
});
```

Mock assignment helper, not `getProjectPmIdentity` (CONVENTIONS / Phase 10 pattern).

---

## Anti-Patterns / Landmines (do NOT analogize)

| Surface | Why forbidden | Verified location |
|---------|---------------|-------------------|
| `getWeeklyProjectReport` | Activity-weighted live data; breaks snapshot/immutability | `lib/services/project-report.service.ts` lines 70-161 |
| `GET /api/projects/[id]/report` | v1 weekly report route | `app/api/projects/[id]/report/route.ts` |
| `documents.type = status_report` | v1 diary persistence | `app/projects/[id]/reports/page.tsx` |
| `POST /api/export/weekly-report/[id]` | Export from documents | Phase 14 replaces with snapshot export |
| Physical DELETE on periods/shells/versions | D-17 soft/immutable history | — |
| Backfill shells on later obligation | D-04 shells only at period create | — |

Phase 13 repo/service/route modules must **not** import `getWeeklyProjectReport`, `project-report.service`, or `documents.repo` upsert for `status_report`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/repositories/weekly-periods.repo.test.ts` | test | transform | No existing repo SQL integration tests; use DDL hermetic tests + optional `describe.skipIf(!hasTestDb)` |
| `lib/repositories/weekly-reports.repo.test.ts` | test | transform | Same — inline SQL assertions or service-level mocks as gate |

---

## Metadata

**Analog search scope:** `lib/db-raid-masters.ts`, `lib/db-project-master.ts`, `lib/db.ts`, `lib/repositories/rag-config.repo.ts`, `lib/repositories/pm-assignments.repo.ts`, `lib/repositories/audit.repo.ts`, `lib/repositories/risks.repo.ts`, `lib/services/pm-assignments.service.ts`, `lib/services/risks.service.ts`, `lib/services/issues.service.ts`, `lib/services/raid-masters.service.ts`, `lib/services/access.ts`, `lib/services/audit.service.ts`, `lib/services/errors.ts`, `lib/services/project-governance.ts`, `lib/api-errors.ts`, `lib/http/with-role.ts`, `lib/http/with-project-access.ts`, `app/api/admin/users/route.ts`, `app/api/projects/[id]/pm-assignments/route.ts`, `app/api/projects/[id]/risks/route.test.ts`
**Files scanned:** 28
**Pattern extraction date:** 2026-08-26

## PATTERNS COMPLETE
