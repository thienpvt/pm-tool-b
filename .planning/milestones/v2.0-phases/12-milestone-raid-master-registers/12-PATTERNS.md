# Phase 12: Milestone & RAID Master Registers - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 18 new/modified files
**Analogs found:** 16 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db-raid-masters.ts` | migration | batch | `lib/db-project-master.ts` | exact |
| `lib/db-raid-masters.ddl.unit.test.ts` | test | transform | `lib/db-project-master.ddl.unit.test.ts` | exact |
| `lib/db.ts` | config | batch | `lib/db.ts` (migrateProjectMaster wire) | exact |
| `lib/repositories/milestones.repo.ts` | repository | CRUD | `lib/repositories/milestones.repo.ts` | exact |
| `lib/repositories/risks.repo.ts` | repository | CRUD | `lib/repositories/risks.repo.ts` | exact |
| `lib/repositories/issues.repo.ts` | repository | CRUD | `lib/repositories/issues.repo.ts` | exact |
| `lib/repositories/raid-due-date-history.repo.ts` | repository | CRUD (append) | `lib/repositories/audit.repo.ts` | role-match |
| `lib/services/milestones.service.ts` | service | request-response | `lib/services/milestones.service.ts` | exact |
| `lib/services/risks.service.ts` | service | request-response | `lib/services/risks.service.ts` | exact |
| `lib/services/issues.service.ts` | service | request-response | `lib/services/issues.service.ts` | exact |
| `lib/services/raid-masters.service.ts` | service | transform | `lib/services/portfolio.service.ts` | role-match |
| `app/api/projects/[id]/milestones/[milestoneId]/route.ts` | route | request-response | same file (DELETE→cancel) | exact |
| `app/api/projects/[id]/risks/route.ts` | route | request-response | same file (DELETE→deactivate) | exact |
| `app/api/projects/[id]/issues/route.ts` | route | request-response | same file (DELETE→deactivate) | exact |
| `lib/services/milestones.service.unit.test.ts` | test | — | same file | exact |
| `lib/services/risks.service.unit.test.ts` | test | — | same file | exact |
| `lib/services/issues.service.unit.test.ts` | test | — | `lib/services/risks.service.unit.test.ts` | exact |
| `lib/repositories/milestones.repo.test.ts` (new) | test | — | `lib/db-project-master.ddl.unit.test.ts` | partial |

## Pattern Assignments

### `lib/db-raid-masters.ts` (migration, batch)

**Analog:** `lib/db-project-master.ts`

**Imports pattern** (lines 1-5):

```typescript
import type { Pool } from 'pg';

export const RAID_MASTERS_DDL_FLAG = 'raid_masters_ddl_v1';
export const RAID_MASTERS_BACKFILL_FLAG = 'raid_masters_backfill_v1';
```

**DDL export array** (lines 7-51 of analog — mirror structure):

```typescript
/** Hermetic unit-test assertions against the DDL strings (D-01, D-10). */
export const RAID_MASTERS_DDL = [
  `ALTER TABLE milestones ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planned'`,
  `ALTER TABLE milestones ADD COLUMN IF NOT EXISTS plan_end TEXT`,
  `ALTER TABLE milestones ADD COLUMN IF NOT EXISTS adjusted_end TEXT`,
  `ALTER TABLE milestones ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`,
  `ALTER TABLE milestones ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id)`,
  `ALTER TABLE risks ADD COLUMN IF NOT EXISTS code TEXT`,
  `ALTER TABLE risks ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ`,
  `ALTER TABLE issues ADD COLUMN IF NOT EXISTS code TEXT`,
  `ALTER TABLE issues ADD COLUMN IF NOT EXISTS technology_council BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE issues ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ`,
  // raid_due_date_history CREATE TABLE ...
  // partial unique indexes on (project_id, LOWER(code))
];
```

**Settings-flag idempotency** (lines 73-97):

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

async function migrateRaidMastersDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, RAID_MASTERS_DDL_FLAG)) return;
  for (const sql of RAID_MASTERS_DDL) {
    await pool.query(sql);
  }
  await writeSettingsFlag(pool, RAID_MASTERS_DDL_FLAG);
}
```

**Orchestrator with try/catch retry** (lines 145-157):

```typescript
export async function migrateRaidMasters(pool: Pool): Promise<void> {
  try {
    await migrateRaidMastersDdl(pool);
    await backfillRaidMasters(pool); // plan_end FROM end_date; code FROM risk_id/issue_id
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
```

**Backfill pattern** (lines 109-143 of analog):

```typescript
export async function backfillRaidMasters(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, RAID_MASTERS_BACKFILL_FLAG)) return;
  await pool.query(`UPDATE milestones SET plan_end = end_date WHERE plan_end IS NULL AND end_date IS NOT NULL`);
  await pool.query(`UPDATE risks SET code = LOWER(TRIM(risk_id)) WHERE code IS NULL AND risk_id IS NOT NULL`);
  await pool.query(`UPDATE issues SET code = LOWER(TRIM(issue_id)) WHERE code IS NULL AND issue_id IS NOT NULL`);
  await writeSettingsFlag(pool, RAID_MASTERS_BACKFILL_FLAG);
}
```

---

### `lib/db.ts` (config, batch)

**Analog:** `lib/db.ts` lines 612-615

**Wire after migrateProjectMaster**:

```typescript
const { migrateProjectMaster } = await import('./db-project-master');
await migrateProjectMaster(pool);
const { migrateRaidMasters } = await import('./db-raid-masters');
await migrateRaidMasters(pool);
await backfillWeightedCompletion(pool);
```

---

### `lib/db-raid-masters.ddl.unit.test.ts` (test, transform)

**Analog:** `lib/db-project-master.ddl.unit.test.ts`

**Test harness** (lines 1-16):

```typescript
import { describe, expect, it } from 'vitest';
import { RAID_MASTERS_DDL, RAID_MASTERS_DDL_FLAG } from './db-raid-masters';

describe('migrateRaidMasters DDL fragments', () => {
  it('exports raid_masters_ddl_v1 settings flag key', () => {
    expect(RAID_MASTERS_DDL_FLAG).toBe('raid_masters_ddl_v1');
  });

  it('includes partial unique index risks_project_code_lower_unique', () => {
    const ddl = RAID_MASTERS_DDL.join('\n');
    expect(ddl).toMatch(/risks_project_code_lower_unique/);
    expect(ddl).toMatch(/LOWER\(code\)/);
    expect(ddl).toMatch(/project_id/);
  });
});
```

Assert: milestone status columns, `raid_due_date_history` table, `technology_council` column, issues unique index.

---

### `lib/repositories/milestones.repo.ts` (repository, CRUD)

**Analog:** `lib/repositories/milestones.repo.ts`

**Imports** (lines 1-2):

```typescript
import { getDb } from '@/lib/db';
```

**Scoped UPDATE (replace DELETE)** — extend lines 29-38 pattern:

```typescript
export async function cancelMilestone(
  projectId: number | string,
  milestoneId: number | string,
  cancelledBy: number,
) {
  const db = await getDb();
  return db.get(
    `UPDATE milestones SET status = 'cancelled', cancelled_at = now(), cancelled_by = ?
     WHERE id = ? AND project_id = ? AND status != 'cancelled' RETURNING *`,
    cancelledBy, milestoneId, projectId,
  );
}
```

**Company-scoped list helper** — copy tenant filter from `listPortfolioMilestones` (portfolio.repo.ts lines 218-231):

```typescript
export async function listUpcomingMilestones(companyId: number | null, today: string, windowEnd: string) {
  const db = await getDb();
  const base = `SELECT m.*, p.name AS project_name
    FROM milestones m JOIN projects p ON p.id = m.project_id
    LEFT JOIN customers c ON p.customer_id = c.id`;
  const where = `m.status NOT IN ('completed', 'cancelled')
    AND COALESCE(m.adjusted_end, m.plan_end) IS NOT NULL
    AND COALESCE(m.adjusted_end, m.plan_end) >= ?
    AND COALESCE(m.adjusted_end, m.plan_end) <= ?`;
  if (companyId !== null) {
    return db.all(`${base} WHERE (p.company_id = ? OR c.company_id = ?) AND ${where}`,
      companyId, companyId, today, windowEnd);
  }
  return db.all(`${base} WHERE p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL) AND ${where}`,
    today, windowEnd);
}
```

**Dual-write on create/update** (extend lines 20-37): when `plan_end` is set, also write `end_date = plan_end` (D-14).

**Remove:** `deleteMilestone` (lines 41-44) — no `DELETE FROM milestones`.

---

### `lib/repositories/risks.repo.ts` (repository, CRUD)

**Analog:** `lib/repositories/risks.repo.ts`

**Allowlist — extend RISK_COLUMNS** (lines 8-11):

```typescript
export const RISK_COLUMNS = [
  'risk_id', 'description', 'category', 'owner', 'trigger', 'mitigation', 'due_date',
  'status', 'priority', 'impact', 'affected_activity_id', 'code',
] as const;
```

**Auto-code on create** (lines 24-35 — upgrade padding):

```typescript
const n = (await countRisks(projectId)) + 1;
const code = (body.code as string | undefined)?.trim() || `R-${String(n).padStart(3, '0')}`;
const riskId = b.risk_id || code; // keep legacy risk_id populated
```

**Code lookup for ConflictError pre-check** (mirror `findProjectByCompanyCode` in projects.repo.ts lines 77-85):

```typescript
export async function findRiskByCode(projectId: number | string, code: string, excludeId?: number) {
  const db = await getDb();
  return db.get<{ id: number }>(
    `SELECT id FROM risks WHERE project_id = ? AND LOWER(code) = LOWER(?) AND id != COALESCE(?, -1) LIMIT 1`,
    projectId, code, excludeId ?? null,
  );
}
```

**Deactivate (replace deleteRisk lines 52-55)**:

```typescript
export async function deactivateRisk(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.get(
    `UPDATE risks SET status = 'deactivated', deactivated_at = now()
     WHERE id = ? AND project_id = ? RETURNING *`,
    rowId, projectId,
  );
}
```

**Default list order RAID-05** (replace listOpenRisks lines 58-63):

```typescript
export async function listOpenRisks(projectId: number | string, today: string) {
  const db = await getDb();
  return db.all(
    `SELECT *, (due_date < ? AND status IN ('Open', 'In Progress')) AS is_overdue
     FROM risks WHERE project_id = ? AND status IN ('Open', 'In Progress')
     ORDER BY
       CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END,
       CASE WHEN due_date < ? AND status IN ('Open', 'In Progress') THEN 0 ELSE 1 END,
       due_date NULLS LAST, id`,
    today, projectId, today,
  );
}
```

**Company-scoped High RAID count** (D-08 — `COUNT(*)` not `COUNT(DISTINCT project_id)`):

```typescript
export async function countHighOpenRisks(companyId: number | null): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM risks r
     JOIN projects p ON p.id = r.project_id
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE (p.company_id = ? OR c.company_id = ?)
       AND r.status IN ('Open', 'In Progress') AND r.priority = 'High'`,
    companyId, companyId,
  );
  return Number(row?.c ?? 0);
}
```

---

### `lib/repositories/issues.repo.ts` (repository, CRUD)

**Analog:** `lib/repositories/issues.repo.ts`

Mirror all `risks.repo.ts` Phase 12 changes. Additional allowlist column:

```typescript
export const ISSUE_COLUMNS = [
  'issue_id', 'description', 'root_cause', 'category', 'owner', 'trigger', 'mitigation',
  'due_date', 'status', 'priority', 'impact', 'affected_activity_id', 'code', 'technology_council',
] as const;
```

**Technology council list** (D-08):

```typescript
export async function listTechnologyCouncilIssues(companyId: number | null) {
  const db = await getDb();
  const base = `SELECT i.*, p.name AS project_name
    FROM issues i JOIN projects p ON p.id = i.project_id
    LEFT JOIN customers c ON p.customer_id = c.id`;
  if (companyId !== null) {
    return db.all(
      `${base} WHERE (p.company_id = ? OR c.company_id = ?)
        AND i.technology_council = TRUE AND i.status IN ('Open', 'In Progress')`,
      companyId, companyId,
    );
  }
  return db.all(`${base} WHERE p.company_id IS NULL
    AND (p.customer_id IS NULL OR c.company_id IS NULL)
    AND i.technology_council = TRUE AND i.status IN ('Open', 'In Progress')`);
}
```

Auto-code prefix: `I-${String(n).padStart(3, '0')}`.

---

### `lib/repositories/raid-due-date-history.repo.ts` (repository, append)

**Analog:** `lib/repositories/audit.repo.ts`

**Imports + insert shape** (audit.repo.ts lines 1-25):

```typescript
import { getDb } from '@/lib/db';

export type DueDateHistoryInput = {
  entity_type: 'risk' | 'issue';
  entity_id: string;
  old_due: string | null;
  new_due: string | null;
  changed_by: number;
};

export async function appendDueDateHistory(input: DueDateHistoryInput): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO raid_due_date_history (entity_type, entity_id, old_due, new_due, changed_by)
     VALUES (?, ?, ?, ?, ?)`,
    input.entity_type, input.entity_id, input.old_due, input.new_due, input.changed_by,
  );
}
```

---

### `lib/services/milestones.service.ts` (service, request-response)

**Analog:** `lib/services/milestones.service.ts`

**Imports** (lines 1-11 — add audit):

```typescript
import {
  cancelMilestone as cancelMilestoneRepo,
  // remove deleteMilestone import
  createMilestone as createMilestoneRepo,
  listUpcomingMilestones as listUpcomingMilestonesRepo,
  listOverdueMilestones as listOverdueMilestonesRepo,
  // ...
} from '@/lib/repositories/milestones.repo';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from './access';
import { auditLog } from './audit.service';
import { NotFoundError } from './errors';
```

**Write gate on mutate** (lines 18-24):

```typescript
export async function createMilestone(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  return createMilestoneRepo(projectId, body);
}
```

**Cancel replaces delete** (extend deleteMilestone lines 43-54):

```typescript
export async function cancelMilestone(
  projectId: number | string,
  actor: AccessActor,
  milestoneId: number | string,
) {
  await assertProjectWriteAccess(projectId, actor);
  const prior = await getMilestoneRepo(projectId, milestoneId); // or fetch before cancel
  const updated = await cancelMilestoneRepo(projectId, milestoneId, actor.user_id);
  if (!updated) throw new NotFoundError('Not found', 'milestone');
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'milestone',
    entity_id: String(milestoneId),
    action: 'cancel',
    before: { status: prior?.status },
    after: { status: 'cancelled' },
  });
  return updated;
}
```

**Company-scoped helpers for Phase 16** (read-only, no write gate):

```typescript
export async function listUpcomingMilestones(actor: AccessActor) {
  const today = new Date().toISOString().slice(0, 10);
  const windowEnd = /* today + 7 days UTC date string */;
  return listUpcomingMilestonesRepo(actor.company_id, today, windowEnd);
}
```

Keep `linkEpic`/`unlinkEpic` unchanged (D-04).

---

### `lib/services/risks.service.ts` (service, request-response)

**Analog:** `lib/services/risks.service.ts` + `lib/services/projects.service.ts` (ConflictError) + `lib/services/holidays.service.ts` (duplicate check)

**Imports** (extend lines 1-8):

```typescript
import { findRiskByCode, /* deactivateRisk, appendDueDateHistory via repo */ } from '@/lib/repositories/...';
import { auditLog } from './audit.service';
import { ConflictError, NotFoundError } from './errors';
```

**Create with code conflict** (holidays.service.ts lines 21-26 + projects.service.ts lines 75-77):

```typescript
export async function createRisk(projectId: number | string, actor: AccessActor, body: Record<string, unknown>) {
  await assertProjectWriteAccess(projectId, actor);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (code && await findRiskByCode(projectId, code)) {
    throw new ConflictError('Risk code already exists');
  }
  return createRiskRepo(projectId, body);
}
```

**Update with due-date history + audit** (projects.service.ts lines 150-158):

```typescript
export async function updateRisk(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const prior = await getRiskRepo(projectId, rowId);
  if (!prior) throw new NotFoundError('Not found', 'risk');

  if (typeof fields.code === 'string') {
    const newCode = fields.code.trim();
    if (newCode && await findRiskByCode(projectId, newCode, Number(rowId))) {
      throw new ConflictError('Risk code already exists');
    }
  }

  const updated = await updateRiskRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'risk');

  if (fields.due_date !== undefined && fields.due_date !== prior.due_date) {
    await appendDueDateHistory({
      entity_type: 'risk',
      entity_id: String(rowId),
      old_due: prior.due_date as string | null,
      new_due: fields.due_date as string | null,
      changed_by: actor.user_id,
    });
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'risk',
      entity_id: String(rowId),
      action: 'due_date_change',
      before: { due_date: prior.due_date },
      after: { due_date: fields.due_date },
    });
  }
  return updated;
}
```

**Deactivate replaces delete** (lines 36-48):

```typescript
export async function deactivateRisk(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
) {
  await assertProjectWriteAccess(projectId, actor);
  const prior = await getRiskRepo(projectId, rowId);
  const updated = await deactivateRiskRepo(projectId, rowId);
  if (!updated) throw new NotFoundError('Not found', 'risk');
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'risk',
    entity_id: String(rowId),
    action: 'deactivate',
    before: { status: prior?.status },
    after: { status: 'deactivated' },
  });
  return updated;
}
```

---

### `lib/services/issues.service.ts` (service, request-response)

**Analog:** `lib/services/issues.service.ts` — mirror `risks.service.ts` Phase 12 patterns exactly.

Same structure: `assertProjectWriteAccess` → `findIssueByCode` → `ConflictError` → `deactivateIssue` → `auditLog` on deactivate and due-date change.

---

### `lib/services/raid-masters.service.ts` (service, transform)

**Analog:** `lib/services/portfolio.service.ts` lines 381-383

**Thin company-scoped re-exports** (D-15 — not inside portfolio.service logic):

```typescript
import type { AccessActor } from './access';
import { listUpcomingMilestones, listOverdueMilestones } from './milestones.service';
import { countHighOpenRisks, listTechnologyCouncilIssues } from '@/lib/repositories/...';

export async function listHighOpenRaid(actor: AccessActor) {
  const count = await countHighOpenRisks(actor.company_id);
  return { count }; // or return rows — D-08 counts records
}

export { listUpcomingMilestones, listOverdueMilestones, listTechnologyCouncilIssues };
```

---

### Route files (route, request-response)

**Analog:** `app/api/projects/[id]/milestones/[milestoneId]/route.ts`, `risks/route.ts`

**DELETE maps to cancel/deactivate, keeps `{ ok: true }`** (D-13):

```typescript
// milestones/[milestoneId]/route.ts — swap import
import { cancelMilestone, updateMilestone } from '@/lib/services/milestones.service';

export const DELETE = withProjectAccess<Params>(async (_req, { params, actor }) => {
  await cancelMilestone(params.id, actor, params.milestoneId);
  return NextResponse.json({ ok: true });
});
```

```typescript
// risks/route.ts — swap import
import { createRisk, deactivateRisk, listRisks, updateRisk } from '@/lib/services/risks.service';

export const DELETE = withProjectAccess(async (req, { params, actor }) => {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deactivateRisk(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
});
```

Same for `issues/route.ts` with `deactivateIssue`.

---

### Test files (test)

**Analog:** `lib/services/milestones.service.unit.test.ts`

**Mock harness** (lines 1-51):

```typescript
vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/repositories/milestones.repo', () => ({ cancelMilestone: cancelMilestoneRepo, ... }));
vi.mock('@/lib/services/audit.service', () => ({ auditLog: vi.fn() }));
```

**Write gate assertion** (lines 63-67):

```typescript
it('createMilestone does not call the repository when write access is denied', async () => {
  assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
  await expect(createMilestone(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
  expect(createMilestoneRepo).not.toHaveBeenCalled();
});
```

**New tests to add:**
- `cancelMilestone` calls `auditLog`, never `deleteMilestoneRepo`
- `createRisk` duplicate code → `ConflictError`
- `updateRisk` due-date change → `appendDueDateHistory` + `auditLog`
- `deactivateRisk`/`deactivateIssue` zero-row → `NotFoundError`

---

## Shared Patterns

### assertProjectWriteAccess (all mutate services)

**Source:** `lib/services/access.ts` lines 131-138
**Apply to:** milestones.service, risks.service, issues.service — all create/update/cancel/deactivate paths

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

Do not add a second wrapper family (D-02). Viewer-only → `ForbiddenError` via `assertCanMutate` (lines 57-61).

---

### ConflictError → 409

**Source:** `lib/services/errors.ts` lines 38-43
**Apply to:** risks.service, issues.service on duplicate `code`

```typescript
/** Resource-state conflict (e.g. duplicate holiday date). Maps to 409. */
export class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}
```

**Pre-check pattern** (holidays.service.ts lines 23-25):

```typescript
if (await findRiskByCode(projectId, code)) {
  throw new ConflictError('Risk code already exists');
}
```

**HTTP mapping** (lib/api-errors.ts lines 54-55) — services stay HTTP-free:

```typescript
if (e instanceof ConflictError) {
  return NextResponse.json({ error: e.message }, { status: 409 });
}
```

---

### auditLog (cancel, deactivate, due-date change)

**Source:** `lib/services/audit.service.ts` lines 5-8; call shape from `lib/services/projects.service.ts` lines 150-158
**Apply to:** cancelMilestone, deactivateRisk, deactivateIssue, due-date updates

```typescript
/** Append-only audit log INSERT (D-08). No update or delete helpers. */
export async function auditLog(input: AuditLogInput): Promise<void> {
  await insertAuditLog(input);
}

await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'milestone',
  entity_id: String(milestoneId),
  action: 'cancel',
  before: { status: prior.status },
  after: { status: 'cancelled' },
});
```

---

### Scoped UPDATE (IDOR prevention)

**Apply to:** all repo cancel/deactivate/update functions

```typescript
`UPDATE risks SET ... WHERE id = ? AND project_id = ? RETURNING *`
```

Zero rows → service throws `NotFoundError` (milestones.service.ts lines 49-52 pattern).

---

### UTC date-only for upcoming/overdue

**Source:** project-report.service.ts pattern (RESEARCH)
**Apply to:** listUpcomingMilestones, listOverdueMilestones, listOpenRisks is_overdue

```typescript
const today = new Date().toISOString().slice(0, 10);
```

Effective milestone end: `COALESCE(adjusted_end, plan_end)`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/repositories/milestones.repo.test.ts` | test | transform | No existing repo SQL unit tests; use DDL hermetic test pattern + inline SQL assertions |

## Metadata

**Analog search scope:** `lib/db-project-master.ts`, `lib/services/milestones.service.ts`, `lib/services/risks.service.ts`, `lib/services/issues.service.ts`, `lib/services/access.ts`, `lib/services/audit.service.ts`, `lib/services/errors.ts`, `lib/services/holidays.service.ts`, `lib/services/projects.service.ts`, `lib/repositories/milestones.repo.ts`, `lib/repositories/risks.repo.ts`, `lib/repositories/issues.repo.ts`, `lib/repositories/portfolio.repo.ts`, `lib/repositories/audit.repo.ts`, `app/api/projects/[id]/*/route.ts`
**Files scanned:** 18
**Pattern extraction date:** 2026-08-26
