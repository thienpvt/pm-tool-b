# Phase 18: Append-Only Audit Log - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 16 new/modified files
**Analogs found:** 15 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/repositories/audit.repo.ts` | repository | CRUD (INSERT + SELECT only) | `lib/repositories/raid-due-date-history.repo.ts` + existing `insertAuditLog` | exact |
| `lib/services/audit.service.ts` | service | batch + request-response | existing `auditLog` + `lib/services/users.service.ts` (`listUsers`) | exact |
| `app/api/audit/route.ts` | route | request-response | `app/api/dashboards/portfolio/route.ts` + `app/api/admin/users/route.ts` (filters) | exact |
| `app/api/audit/route.test.ts` | test | — | `app/api/dashboards/portfolio/route.test.ts` | exact |
| `lib/repositories/audit.repo.unit.test.ts` | test | transform (source-scan) | `lib/db-dashboards.ddl.unit.test.ts` + `lib/export/consolidated-weekly.unit.test.ts` | exact |
| `lib/services/audit.service.unit.test.ts` | test | — | existing file + `lib/services/users.service.unit.test.ts` (`auditLog` asserts) | exact (extend) |
| `lib/repositories/audit.repo.test.ts` | test | CRUD (integration) | `lib/repositories/weekly-reports.repo.test.ts` (`test/repo-db`) | role-match |
| `lib/db-audit.ts` (optional — index only) | migration | batch | `lib/db-dashboards.ts` | exact |
| `lib/db-audit.ddl.unit.test.ts` (optional) | test | transform | `lib/db-fiscal-budget.ddl.unit.test.ts` | exact |
| `lib/db.ts` | config | batch | `lib/db.ts` (`migrateDocuments` wire) | exact (extend) |
| `lib/services/risks.service.ts` | service | batch (gap fill) | `lib/services/pm-assignments.service.ts` (`auditSnapshot` + create/end) | exact |
| `lib/services/issues.service.ts` | service | batch (gap fill) | `lib/services/risks.service.ts` (deactivate/due_date_change already audited) | exact |
| `lib/services/milestones.service.ts` | service | batch (gap fill) | `cancelMilestone` audit block in same file | exact |
| `lib/services/projects.service.ts` | service | batch (gap fill) | `lib/services/users.service.ts` create/update auditLog | exact |
| `lib/services/project-document-checklist.service.ts` | service | batch (gap fill) | existing `status_change` block in same file | exact |
| `scripts/audit-coverage-inventory.mjs` (optional planner tool) | utility | transform | grep-only; no analog — use ripgrep in plan | no analog |

### D-02 coverage inventory (existing vs gaps)

| entity_type (D-02) | Current audit calls | Gap mutators |
|---------------------|---------------------|--------------|
| `user` | `users.service.ts` create/update/lock/unlock/deactivate | none |
| `pm_assignment` | `pm-assignments.service.ts` create/end | none |
| `project` | `projects.service.ts` code_change, stage_change_ack | **`createProject`**, general **`updateProject`**, **`deleteProject`** |
| `raid` (`risk`/`issue`) | due_date_change, deactivate only | **`createRisk`/`updateRisk`**, **`createIssue`/`updateIssue`** (general field updates) |
| `milestone` | cancel only | **`createMilestone`**, **`updateMilestone`** |
| `budget_adjustment` | `fiscal-budget.service.ts` create | none |
| `weekly_report` | `weekly-reports.service.ts` submit/correct | none |
| `document_checklist` | `project-document-checklist.service.ts` status_change (status/url) | **PATCH `approved_at`/`approved_by`/`na_reason`/`notes`** |

## Pattern Assignments

### `lib/repositories/audit.repo.ts` (repository, INSERT + SELECT only)

**Analog:** existing `insertAuditLog` + `lib/repositories/raid-due-date-history.repo.ts`

**Existing INSERT pattern** (audit.repo.ts lines 3-26):

```typescript
export type AuditLogInput = {
  actor_id: number;
  company_id: number | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before: unknown;
  after: unknown;
};

export async function insertAuditLog(input: AuditLogInput): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO audit_logs (actor_id, company_id, entity_type, entity_id, action, before, after)
     VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)`,
    input.actor_id,
    input.company_id,
    input.entity_type,
    input.entity_id,
    input.action,
    input.before === null ? null : JSON.stringify(input.before),
    input.after === null ? null : JSON.stringify(input.after),
  );
}
```

**Append-only repo comment pattern** (raid-due-date-history.repo.ts lines 11-22):

```typescript
/** Append-only INSERT into raid_due_date_history (D-06). No update or delete exports. */
export async function appendDueDateHistory(input: DueDateHistoryInput): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO raid_due_date_history (entity_type, entity_id, old_due, new_due, changed_by)
     VALUES (?, ?, ?, ?, ?)`,
    ...
  );
}
```

**Apply:** Add `listAuditLogs(companyId, filters)` with dynamic `WHERE company_id = ?` + optional `entity_type`, `entity_id`, date range, `ORDER BY created_at DESC`, `LIMIT ?`. No `updateAuditLog` / `deleteAuditLog` exports. Table + `company_id` column already created in `lib/db-roles.ts` lines 52-64.

**Company-scoped SELECT analog** (users.repo.ts lines 41-47):

```typescript
export async function listUsers(companyId: number, filters: UserListFilters = {}): Promise<UserRow[]> {
  const db = await getDb();
  const conditions = ['u.company_id = ?'];
  const params: unknown[] = [companyId];
  // push optional filters onto conditions/params
```

**Apply:** Mirror dynamic `conditions`/`params` building; always anchor `company_id = ?`. NULL `company_id` rows excluded from company GET (D-05 discretion OK).

---

### `lib/services/audit.service.ts` (service, list + append)

**Analog:** existing `auditLog` + `lib/services/users.service.ts` list gate

**Existing append-only service** (audit.service.ts lines 5-8):

```typescript
/** Append-only audit log INSERT (D-08). No update or delete helpers. */
export async function auditLog(input: AuditLogInput): Promise<void> {
  await insertAuditLog(input);
}
```

**Company-scoped list gate** (users.service.ts lines 89-92):

```typescript
export async function listUsers(actor: AccessActor, filters: UserListFilters = {}) {
  assertCpmoCompany(actor);
  return listUsersRepo(actor.company_id!, filters);
}
```

**Apply:** Add `listAuditLogs(actor, filters)` calling `assertCompanyWrite(actor)` (D-06) then `listAuditLogsRepo(actor.company_id!, filters)`. Parse `limit` default 50, cap at 200 (no existing pagination analog — clamp in service: `Math.min(Math.max(1, limit ?? 50), 200)`).

---

### `app/api/audit/route.ts` (route, GET only)

**Analog:** `app/api/dashboards/portfolio/route.ts` + `app/api/admin/users/route.ts`

**withCpmo GET shell** (dashboards/portfolio/route.ts lines 1-7):

```typescript
import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { getPortfolioDashboard } from '@/lib/services/spec-dashboards.service';

export const GET = withCpmo(async (_req, { actor }) => {
  return NextResponse.json(await getPortfolioDashboard(actor));
});
```

**Optional query filters** (admin/users/route.ts lines 7-17):

```typescript
export const GET = withCpmo(async (req, { actor }) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? undefined;
  const status = searchParams.get('status') as 'active' | 'inactive' | 'locked' | null;
  const role = searchParams.get('role') as 'cpmo' | 'pm' | 'viewer' | null;
  const users = await listUsers(actor, { q, status: status ?? undefined, role: role ?? undefined });
  return NextResponse.json(users);
});
```

**Apply:** GET-only export — no POST/PUT/PATCH/DELETE (D-04). Parse `entity_type`, `entity_id`, `from`, `to`, `limit` from `searchParams`; delegate to `listAuditLogs(actor, filters)`. `withCpmo` enforces CPMO role; service `assertCompanyWrite` enforces non-null `company_id` (403 for PM/viewer/null-company admin per D-06).

**assertCompanyWrite** (access.ts lines 125-129):

```typescript
export function assertCompanyWrite(actor: AccessActor): void {
  if (!isCpmo(actor)) throw new ForbiddenError();
  if (actor.company_id === null) throw new ForbiddenError();
}
```

---

### `app/api/audit/route.test.ts` (test, access matrix)

**Analog:** `app/api/dashboards/portfolio/route.test.ts`

**Session matrix + 403 gates** (route.test.ts lines 62-89):

```typescript
describe('GET /api/dashboards/portfolio', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(401);
    expect(getPortfolioDashboard).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => { ... });
  it('returns 403 for viewer session', async () => { ... });
  it('returns 403 for null-company admin session', async () => { ... });
```

**Apply:** Mock `@/lib/services/audit.service` `listAuditLogs`. Assert 401/403 matrix identical. Add cross-company isolation: company A CPMO GET returns only A rows (empty or filtered — never B payloads). Assert route exports no PATCH/DELETE (module shape or absence of handlers).

---

### `lib/repositories/audit.repo.unit.test.ts` (test, source-scan immutability)

**Analog:** `lib/db-dashboards.ddl.unit.test.ts` + `lib/export/consolidated-weekly.unit.test.ts`

**Repo source-scan for forbidden SQL** (consolidated-weekly.unit.test.ts lines 169-174):

```typescript
it('generator module has no repository imports (D-01)', () => {
  const src = readFileSync(resolve(__dirname, 'consolidated-weekly.ts'), 'utf8');
  expect(src).not.toMatch(/@\/lib\/repositories\//);
  expect(src).not.toMatch(/getWeeklyProjectReport/);
});
```

**Apply (D-04):**

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

it('audit.repo exports INSERT/SELECT only — no UPDATE or DELETE on audit_logs (D-04)', () => {
  const src = readFileSync(resolve(__dirname, 'audit.repo.ts'), 'utf8');
  expect(src).not.toMatch(/UPDATE\s+audit_logs/i);
  expect(src).not.toMatch(/DELETE\s+FROM\s+audit_logs/i);
  expect(src).not.toMatch(/UPDATE\s+audit\b/i);
  expect(src).not.toMatch(/DELETE\s+FROM\s+audit\b/i);
});
```

Also assert exported function names: `insertAuditLog`, `listAuditLogs` present; no `updateAuditLog` / `deleteAuditLog`.

---

### `lib/services/audit.service.unit.test.ts` (test, extend)

**Analog:** existing file + `lib/services/users.service.unit.test.ts`

**Existing delegate test** (audit.service.unit.test.ts lines 15-36):

```typescript
describe('audit.service auditLog', () => {
  it('INSERTs only — delegates to insertAuditLog (D-08)', async () => {
    insertAuditLog.mockResolvedValue(undefined);
    await auditLog({ actor_id: 1, company_id: 5, entity_type: 'user', ... });
    expect(insertAuditLog).toHaveBeenCalledWith({ ... });
  });
});
```

**auditLog assertion shape** (users.service.unit.test.ts line 156):

```typescript
expect(auditLog).toHaveBeenCalledWith(
  expect.objectContaining({ action: 'create', entity_type: 'user', actor_id: 1, company_id: 5 }),
);
```

**Apply:** Add tests for `listAuditLogs`: mocks repo; verifies `assertCompanyWrite` path (ForbiddenError when `company_id` null). D-07 immutability: mock two sequential `auditLog` calls with same `entity_id`; assert first call args unchanged on second mutation (service-level) or cover in repo integration test.

---

### `lib/repositories/audit.repo.test.ts` (test, integration — D-07)

**Analog:** `lib/repositories/weekly-reports.repo.test.ts`

**Harness pattern** (weekly-reports.repo.test.ts lines 1-16):

```typescript
import { seedCompany, seedProject, setupRepoTables, testDb } from '@/test/repo-db';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
describe.skipIf(!hasTestDb)('weekly-reports.repo', () => {
```

**Apply:** Insert two audit rows for same `entity_id`; re-read both by id; assert first row's `actor_id`, `before`, `after`, `created_at` unchanged after second insert. Requires `audit_logs` in `setupRepoTables` or rely on `migrateUsersRolesAndAudit` via test DB bootstrap.

---

### `lib/db-audit.ts` (optional migration — index only)

**Analog:** `lib/db-dashboards.ts`

**Settings-flag DDL module** (db-dashboards.ts lines 1-51):

```typescript
export const DASHBOARDS_DDL_FLAG = 'dashboards_ddl_v1';

export const DASHBOARDS_DDL = [ `CREATE TABLE IF NOT EXISTS ...` ];

async function settingsFlagExists(pool: Pool, key: string): Promise<boolean> { ... }
async function writeSettingsFlag(pool: Pool, key: string): Promise<void> { ... }

async function migrateDashboardsDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, DASHBOARDS_DDL_FLAG)) return;
  for (const sql of DASHBOARDS_DDL) await pool.query(sql);
  await writeSettingsFlag(pool, DASHBOARDS_DDL_FLAG);
}

export async function migrateDashboards(pool: Pool): Promise<void> {
  try { await migrateDashboardsDdl(pool); } catch { /* settings table may not exist yet */ }
}
```

**Apply (D-10):** Only if planner adds `(company_id, created_at DESC)` index or backfill column. Wire in `lib/db.ts` **after** `migrateDocuments` (db.ts lines 637-638):

```typescript
const { migrateDocuments } = await import('./db-documents');
await migrateDocuments(pool);
// NEW: await migrateAuditIndexes(pool);
```

**DDL unit test wire check** (db-dashboards.ddl.unit.test.ts lines 27-36):

```typescript
const src = readFileSync(resolve(__dirname, 'db.ts'), 'utf8');
const fiscalIdx = src.indexOf('await migrateFiscalBudget(pool)');
const dashboardsIdx = src.indexOf('await migrateDashboards(pool)');
expect(dashboardsIdx).toBeGreaterThan(fiscalIdx);
```

Skip entire module if `company_id` column suffices (already in `db-roles.ts` CREATE TABLE audit_logs).

---

### Coverage gap services (`risks`, `issues`, `milestones`)

**Analog:** `lib/services/pm-assignments.service.ts` + existing `cancelMilestone` block

**Snapshot helper + create audit** (pm-assignments.service.ts lines 24-31, 113-121):

```typescript
function auditSnapshot(row: PmAssignmentRow | null | undefined) {
  if (!row) return null;
  return { id: row.id, project_id: row.project_id, user_id: row.user_id, ... };
}

await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'pm_assignment',
  entity_id: String(created.id),
  action: 'create',
  before: null,
  after: auditSnapshot(created),
});
```

**Milestone cancel (already present)** (milestones.service.ts lines 54-62):

```typescript
await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'milestone',
  entity_id: String(milestoneId),
  action: 'cancel',
  before: { status: prior?.status ?? null },
  after: { status: 'cancelled' },
});
```

**Apply gaps:**

| Service | Function | action | before/after |
|---------|----------|--------|--------------|
| `risks.service.ts` | `createRisk` | `create` | `null` / snapshot |
| `risks.service.ts` | `updateRisk` | `update` | prior row / updated row (when not only due_date_change path) |
| `issues.service.ts` | `createIssue` | `create` | same as risk |
| `issues.service.ts` | `updateIssue` | `update` | same as risk |
| `milestones.service.ts` | `createMilestone` | `create` | `null` / snapshot |
| `milestones.service.ts` | `updateMilestone` | `update` | load prior via `getMilestoneRepo` before update |
| `projects.service.ts` | `createProject` | `create` | `null` / snapshot |
| `projects.service.ts` | `updateProject` | `update` | full snapshots when they differ; keep `code_change` / `stage_change_ack` |
| `projects.service.ts` | `deleteProject` | `delete` | prior snapshot / `null` |
| `project-document-checklist.service.ts` | `patchChecklistItem` | `status_change` or `update` | six-field before/after (`status`, `confluence_url`, `approved_at`, `approved_by`, `na_reason`, `notes`) |

Use `entity_type: 'risk'` / `'issue'` (existing convention) unless planner locks D-02 discretion to unified `'raid'`. Analog for project master: `lib/services/users.service.ts` create/update auditLog. Analog for checklist: existing `status_change` block in the same file.

**Existing partial audit** (risks.service.ts lines 82-90) — keep due_date_change path; add general update audit when other fields change without duplicating the due_date row.

---

## Shared Patterns

### Append-only audit INSERT

**Source:** `lib/services/audit.service.ts` + `lib/repositories/audit.repo.ts`
**Apply to:** all mutators (existing + gap fills)

```typescript
await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: '...',
  entity_id: String(id),
  action: 'create' | 'update' | '...',
  before: priorSnapshot ?? null,
  after: afterSnapshot ?? null,
});
```

Call **after** successful repo commit; never wrap in a transaction that could roll back the business write but leave audit (follow existing services).

### CPMO + company tenancy on reads

**Source:** `lib/http/with-role.ts` (`withCpmo`) + `lib/services/access.ts` (`assertCompanyWrite`)
**Apply to:** `app/api/audit/route.ts`, `listAuditLogs` service

```typescript
export const GET = withCpmo(async (req, { actor }) => {
  return NextResponse.json(await listAuditLogs(actor, parseFilters(req)));
});

// inside service:
assertCompanyWrite(actor);
return listAuditLogsRepo(actor.company_id!, filters);
```

### Error mapping at route boundary

**Source:** `lib/http/with-auth.ts` (automatic via `withCpmo` → `withAuth`)
**Apply to:** audit route — no manual try/catch unless adding filter validation 400s

Forbidden → 403, Unauthorized → 401 via wrapper; use `ValidationError` in service for bad date/limit params if needed.

### Settings-flag DDL (conditional)

**Source:** `lib/db-dashboards.ts`, `lib/db-documents.ts`
**Apply to:** optional `lib/db-audit.ts` only when new index/column required (D-10)

### Source-scan unit tests (immutability gate)

**Source:** `lib/db-dashboards.ddl.unit.test.ts`, `lib/export/consolidated-weekly.unit.test.ts`
**Apply to:** `audit.repo.unit.test.ts` — hermetic, no DB required (D-08 server tests as gate)

### Company-scoped repo queries

**Source:** `lib/repositories/import-mapping.repo.unit.test.ts` (lines 28-32)

```typescript
await listTimelineMappings(5);
expect(normalizedSql()).toContain('WHERE company_id = ?');
expect(db.all).toHaveBeenCalledWith(expect.any(String), 5);
```

**Apply to:** unit test `listAuditLogs` SQL includes `company_id = ?` and never omits the predicate.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Pagination clamp (limit default 50 max 200) | utility | transform | No server-side list pagination pattern in codebase; implement inline in audit service |
| Cross-company GET isolation integration test | test | request-response | No existing `/api/*` test asserts empty result for foreign tenant; compose from dashboard 403 matrix + new repo filter test |

---

## Metadata

**Analog search scope:** `lib/repositories/`, `lib/services/`, `app/api/`, `lib/db-*.ts`, `*.unit.test.ts`, `test/repo-db.ts`
**Files scanned:** ~45
**Pattern extraction date:** 2026-08-26
**Primary analogs requested:** `insertAuditLog`, `withCpmo` GET dashboards, settings-flag DDL, source-scan unit tests — all mapped above.
