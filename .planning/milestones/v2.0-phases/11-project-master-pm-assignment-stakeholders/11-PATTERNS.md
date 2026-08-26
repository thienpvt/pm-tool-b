# Phase 11: Project Master, PM Assignment & Stakeholders - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 22 new/modified files
**Analogs found:** 20 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db-project-master.ts` | migration | batch | `lib/db-roles.ts` | exact |
| `lib/db.ts` | config | batch | `lib/db.ts:608-613` migrate loop | exact |
| `lib/services/access.ts` | service | request-response | `lib/services/access.ts` (rewire) | exact |
| `lib/services/projects.service.ts` | service | CRUD + transform | `lib/services/projects.service.ts` + `users.service.ts` audit | exact |
| `lib/services/project-governance.ts` | utility | transform | `lib/services/users.service.ts` validation helpers | role-match |
| `lib/services/pm-assignments.service.ts` | service | CRUD | `lib/services/users.service.ts` + `milestones.service.ts` | role-match |
| `lib/services/stakeholders.service.ts` | service | CRUD | `lib/services/milestones.service.ts` + `users.service.ts` audit | role-match |
| `lib/repositories/projects.repo.ts` | repository | CRUD | `lib/repositories/projects.repo.ts` (extend) | exact |
| `lib/repositories/pm-assignments.repo.ts` | repository | CRUD | `lib/repositories/users.repo.ts` soft-end pattern | role-match |
| `lib/repositories/stakeholders.repo.ts` | repository | CRUD | `lib/repositories/milestones.repo.ts` (list/soft-end nested child) | role-match |
| `app/api/projects/route.ts` | route | request-response | `app/api/projects/route.ts` (extend POST) | exact |
| `app/api/projects/[id]/route.ts` | route | request-response | `app/api/projects/[id]/route.ts` (extend PATCH) | exact |
| `app/api/projects/[id]/pm-assignments/route.ts` | route | CRUD | `app/api/projects/[id]/milestones/route.ts` + `app/api/admin/users/route.ts` CPMO gate | exact |
| `app/api/projects/[id]/stakeholders/route.ts` | route | CRUD | `app/api/projects/[id]/milestones/route.ts` | exact |
| `app/api/projects/[id]/pm-assignments/schema.ts` | config | transform | `app/api/projects/[id]/milestones/schema.ts` | exact |
| `app/api/projects/[id]/stakeholders/schema.ts` | config | transform | `app/api/projects/[id]/milestones/schema.ts` | exact |
| `test/repo-db.ts` | config | batch | `test/repo-db.ts:68-82` projects DDL | exact |
| `lib/repositories/ALLOWLIST-DIFF.md` | config | transform | existing ALLOWLIST-DIFF entries | exact |
| `lib/services/access.unit.test.ts` | test | batch | `lib/services/access.unit.test.ts` (extend) | exact |
| `lib/services/projects.service.unit.test.ts` | test | CRUD | `lib/services/projects.service.unit.test.ts` (extend) | exact |
| `lib/services/pm-assignments.service.unit.test.ts` | test | CRUD | `lib/services/users.service.unit.test.ts` | role-match |
| `lib/services/stakeholders.service.unit.test.ts` | test | CRUD | `lib/services/users.service.unit.test.ts` | role-match |

## Pattern Assignments

### `lib/db-project-master.ts` (migration, batch)

**Analog:** `lib/db-roles.ts`

**Settings-flag helpers** (lines 3-20):
```typescript
const DDL_FLAG = 'project_master_ddl_v1';
export const PM_ASSIGNMENT_BACKFILL_FLAG = 'pm_assignment_backfill_v1';

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
```

**Idempotent DDL block** (lines 22-73):
```typescript
async function migrateRolesDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, DDL_FLAG)) return;

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`);
  // ... CREATE TABLE IF NOT EXISTS ...
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON users (LOWER(email))
    WHERE email IS NOT NULL AND email <> ''
  `);

  await writeSettingsFlag(pool, DDL_FLAG);
}
```

**Backfill with NOT EXISTS guard** (lines 79-94):
```typescript
export async function backfillUserRoles(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, ROLES_BACKFILL_FLAG)) return;

  await pool.query(`
    INSERT INTO user_roles (user_id, role, company_id)
    SELECT u.id, ...
    FROM users u
    WHERE u.company_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
    ON CONFLICT (user_id, role) DO NOTHING
  `);

  await writeSettingsFlag(pool, ROLES_BACKFILL_FLAG);
}
```

**Phase 11 apply:** Copy the two-flag pattern (`project_master_ddl_v1`, `pm_assignment_backfill_v1`). DDL adds `project_code`, `portfolio_year`, `stage`, governance columns, `progress_pct`, `weekly_report_*`, `CREATE TABLE project_pm_assignments`, `CREATE TABLE project_stakeholders`, and partial unique index on `(company_id, LOWER(project_code))`. Backfill inserts open primary windows from `pm_email`/`pm_name` with `NOT EXISTS (SELECT 1 FROM project_pm_assignments WHERE project_id = p.id)`.

**Export entry point** (lines 99-106):
```typescript
export async function migrateUsersRolesAndAudit(pool: Pool): Promise<void> {
  try {
    await migrateRolesDdl(pool);
    await backfillUserRoles(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
```

---

### `lib/db.ts` (config, batch)

**Analog:** `lib/db.ts:608-613`

**Migrate loop wiring:**
```typescript
await migratePostgresSchema(pool);
const { migrateMappingTableTenancy } = await import('./db-mapping-tenant');
await migrateMappingTableTenancy(pool);
const { migrateUsersRolesAndAudit } = await import('./db-roles');
await migrateUsersRolesAndAudit(pool);
await backfillWeightedCompletion(pool);
```

**Phase 11 apply:** Insert after `migrateUsersRolesAndAudit`:
```typescript
const { migrateProjectMaster } = await import('./db-project-master');
await migrateProjectMaster(pool);
```

---

### `lib/services/access.ts` (service, request-response)

**Analog:** `lib/services/access.ts` (rewire in place — keep function names)

**Current interim PM lookup to replace** (lines 43-57, 120-125, 130-140):
```typescript
function matchesPmAssignment(
  project: { pm_name: string | null; pm_email: string | null },
  actor: AccessActor,
): boolean {
  const email = (project.pm_email ?? '').trim();
  if (email) {
    return actor.email.toLowerCase() === email.toLowerCase();
  }
  const pmName = (project.pm_name ?? '').trim().toLowerCase();
  if (!pmName) return false;
  return (
    pmName === actor.display_name.trim().toLowerCase() ||
    pmName === actor.username.trim().toLowerCase()
  );
}

// assertProjectAccess PM-only branch (lines 120-125):
if (isPmOnly(actor)) {
  const identity = await getProjectPmIdentity(projectId);
  if (!identity || !matchesPmAssignment(identity, actor)) {
    throw new ForbiddenError();
  }
}

/** Interim D-14 PM write gate — Phase 11 replaces the lookup, not this function name. */
export async function assertPmWriteAccess(
  projectId: number | string,
  actor: AccessActor,
): Promise<void> {
  if (isCpmo(actor)) return;
  const identity = await getProjectPmIdentity(projectId);
  if (!identity || !matchesPmAssignment(identity, actor)) {
    throw new ForbiddenError();
  }
}
```

**Phase 11 apply:** Remove `matchesPmAssignment` and `getProjectPmIdentity` imports from access path. Import `hasActivePmAssignment` from `pm-assignments.repo.ts`. All three call sites (`assertPmWriteAccess`, `assertProjectAccess` PM-only branch, `listProjects` filter) must use the same repo function — update in one wave.

**CPMO-only gate for assignment mutations** (lines 142-146):
```typescript
export function assertCompanyWrite(actor: AccessActor): void {
  if (!isCpmo(actor)) throw new ForbiddenError();
  if (actor.company_id === null) throw new ForbiddenError();
}
```

**Project write gate composition** (lines 148-155):
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

Stakeholder mutations use `assertProjectWriteAccess` (D-17). Assignment mutations use `assertCompanyWrite` at service top (D-15) after `assertProjectAccess`.

---

### `lib/repositories/projects.repo.ts` (repository, CRUD)

**Analog:** `lib/repositories/projects.repo.ts` (extend)

**PROJECT_COLUMNS allowlist** (lines 4-28):
```typescript
/**
 * Updatable columns for `projects`.
 *
 * `company_id` and `customer_id` are deliberately absent: they decide which
 * tenant owns the row, and the PATCH handler used to let a caller set them.
 */
export const PROJECT_COLUMNS = [
  'name',
  'client',
  'pm_name',
  'pm_email',
  'start_date',
  'end_date',
  'status',
  'current_phase',
  'description',
  'objective',
  'project_owner',
  'budget',
  'budget_currency',
  'headcount_quota',
  'budget_status',
] as const;
```

**Phase 11 apply:** Extend with `project_code`, `portfolio_year`, `stage`, `status_reason`, `rag`, `progress_pct`, `weekly_report_enabled`, `weekly_report_start_period`, `plan_end`, `adjusted_end`, `actual_end`, `classification`, `governance`. Keep `customer_id` absent from allowlist — program stays FK set at create only (D-04).

**Program join in list SELECT** (lines 51-52):
```typescript
const LIST_SELECT = `SELECT p.*, c.name as program_name, c.industry as program_industry
   FROM projects p LEFT JOIN customers c ON p.customer_id = c.id`;
```

**Tenancy access row** (lines 36-43):
```typescript
return db.get<ProjectAccessRow>(
  `SELECT p.company_id, c.company_id AS customer_company_id
   FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
   WHERE p.id = ?`,
  Number(projectId)
);
```

**listProjects PM filter — replace email/name predicate** (lines 69-88):
```typescript
export async function listProjects(
  companyId: number | null,
  opts?: { pmEmail?: string; pmName?: string; username?: string },
) {
  // ...
  if (opts) {
    sql += ` AND (
      (TRIM(COALESCE(p.pm_email, '')) != '' AND LOWER(p.pm_email) = LOWER(?))
      OR (TRIM(COALESCE(p.pm_email, '')) = '' AND (
        LOWER(TRIM(COALESCE(p.pm_name, ''))) = LOWER(TRIM(?))
        OR LOWER(TRIM(COALESCE(p.pm_name, ''))) = LOWER(TRIM(?))
      ))
    )`;
  }
}
```

**Phase 11 apply:** Change opts to `{ pmUserId?: number }` and use `EXISTS` subquery on `project_pm_assignments` with date window predicate.

**updateProject via buildUpdate** (lines 146-152):
```typescript
export async function updateProject(projectId: number | string, fields: Record<string, unknown>) {
  const { sql, values } = buildUpdate('projects', PROJECT_COLUMNS, fields);
  const db = await getDb();
  await db.run(`UPDATE projects SET ${sql} WHERE id = ?`, ...values, projectId);
  return getProject(projectId);
}
```

**createProject INSERT** (lines 116-125) — extend for `project_code`, `portfolio_year`, `customer_id`:
```typescript
const result = await db.run(
  `INSERT INTO projects (name, client, customer_id, pm_name, pm_email, start_date, end_date, description, current_phase, objective, project_owner, budget, budget_currency, company_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  body.name, body.client ?? '', body.customer_id ?? null, ...
);
```

Program validation: resolve `customer_id` against `customers` table scoped to actor company — same FK as existing create; do not add a programs table (D-04). See `lib/repositories/programs.repo.ts:6` and `lib/services/programs.service.ts:14-16`.

---

### `lib/services/projects.service.ts` (service, CRUD + transform)

**Analog:** `lib/services/projects.service.ts` + `lib/services/users.service.ts` audit

**listProjects PM-only branch** (lines 28-38):
```typescript
export async function listProjects(actor: AccessActor) {
  const pmOnly =
    hasRole(actor, 'pm') && !hasRole(actor, 'cpmo') && !hasRole(actor, 'viewer');
  if (pmOnly) {
    return listProjectsRepo(actor.company_id, {
      pmEmail: actor.email,
      pmName: actor.display_name,
      username: actor.username,
    });
  }
  return listProjectsRepo(actor.company_id);
}
```

**Phase 11 apply:** Replace opts with `{ pmUserId: actor.user_id }`.

**CPMO-only create** (lines 49-53):
```typescript
export async function createProject(actor: AccessActor, body: Record<string, unknown>) {
  if (!isCpmo(actor)) throw new ForbiddenError();
  if (actor.company_id === null) throw new ForbiddenError();
  return createProjectRepo(actor.company_id, body);
}
```

**Phase 11 apply:** Validate required `project_code`, `portfolio_year`, `customer_id` (program). Duplicate code → `ConflictError`. Return `{ project, warnings: [] }` shape from create/update when governance defaults apply.

**updateProject — do not swallow UnknownColumnError** (lines 62-68):
```typescript
export async function updateProject(
  projectId: number | string,
  actor: AccessActor,
  fields: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  return updateProjectRepo(projectId, fields);
}
```

**Phase 11 apply:** Before repo call: strip `project_code` from fields when `!isCpmo(actor)` (D-03). Apply L5/terminal governance defaults; collect `warnings: string[]`; call `auditLog` on code change. CPMO code change uses in-place UPDATE only (D-02).

**auditLog on governed mutation** — from `lib/services/users.service.ts` (lines 76-87, 111-119):
```typescript
function auditSnapshot(row: UserRow | undefined) {
  if (!row) return null;
  return { id: row.id, username: row.username, /* minimal fields */ };
}

await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'user',
  entity_id: String(created.id),
  action: 'create',
  before: null,
  after: auditSnapshot(after),
});
```

**Phase 11 apply:** Use `entity_type: 'project'`, `action: 'code_change'` with `{ project_code }` before/after snapshots. Same pattern for assignment/stakeholder entity types.

---

### `lib/services/pm-assignments.service.ts` (service, CRUD)

**Analog:** `lib/services/users.service.ts` (CPMO gate + audit) + `lib/services/milestones.service.ts` (project-scoped asserts)

**Read list pattern** from milestones (lines 13-16):
```typescript
export async function listMilestones(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listMilestonesRepo(projectId);
}
```

**Write mutate pattern** (lines 18-25):
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

**CPMO-only gate** from users.service (lines 40-44):
```typescript
function assertCpmoCompany(actor: AccessActor): void {
  if (!isCpmo(actor) || actor.company_id === null) {
    throw new ForbiddenError();
  }
}
```

**Phase 11 apply:**
- `listPmAssignments`: `assertProjectAccess` (read — any in-company role)
- `createPmAssignment` / `endPmAssignment`: `assertProjectAccess` then `assertCpmoCompany` (D-15)
- Validate invariants D-12: one active primary, collaborators require primary, no dual-role overlap
- Soft-end via `effective_to` UPDATE — never DELETE (D-11)
- `auditLog` on create/end with assignment window snapshot
- After primary change, denormalize `pm_name`/`pm_email` on `projects` from active primary user row

---

### `lib/services/stakeholders.service.ts` (service, CRUD)

**Analog:** `lib/services/milestones.service.ts` + `lib/services/users.service.ts`

**Write access** — use `assertProjectWriteAccess` (CPMO or assigned PM per D-17), not CPMO-only.

**Exported list helper** (STKH-03):
```typescript
export async function listProjectStakeholders(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listStakeholdersRepo(projectId);
}
```

**Create validation:** Either `user_id` (company-scoped via `findUserById`) or `external_name`/`external_email`. At most one active sponsor/chair/director (D-18) — end prior window before opening new.

**Soft-end:** PATCH sets `effective_to`; never DELETE (D-16).

**auditLog** on create/end mutations — same `users.service.ts` before/after snapshot pattern.

---

### `lib/repositories/pm-assignments.repo.ts` (repository, CRUD)

**Analog:** `lib/repositories/projects.repo.ts` query style + `lib/db-roles.ts` backfill INSERT

**Shared active-window query** (consumed by access + listProjects):
```typescript
export async function hasActivePmAssignment(projectId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    `SELECT 1 AS ok FROM project_pm_assignments
     WHERE project_id = ? AND user_id = ?
       AND effective_from <= CURRENT_DATE
       AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
     LIMIT 1`,
    projectId,
    userId,
  );
  return !!row;
}
```

**Insert open window:**
```typescript
await db.run(
  `INSERT INTO project_pm_assignments (project_id, user_id, role, effective_from, effective_to)
   VALUES (?, ?, ?, CURRENT_DATE, NULL)`,
  projectId, userId, role,
);
```

**Soft-end:**
```typescript
await db.run(
  `UPDATE project_pm_assignments SET effective_to = CURRENT_DATE
   WHERE id = ? AND project_id = ? AND effective_to IS NULL`,
  assignmentId, projectId,
);
```

---

### `lib/repositories/stakeholders.repo.ts` (repository, CRUD)

**Analog:** `lib/repositories/milestones.repo.ts` list/soft-end (11-04 is wave 2; assignment repository does not exist yet)

**List with history:**
```typescript
export async function listStakeholders(projectId: number | string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM project_stakeholders WHERE project_id = ? ORDER BY effective_from DESC, id DESC`,
    Number(projectId),
  );
}
```

**Active singleton check** for sponsor/chair/director:
```sql
SELECT 1 FROM project_stakeholders
WHERE project_id = ? AND stakeholder_role = ?
  AND effective_from <= CURRENT_DATE
  AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
LIMIT 1
```

---

### `app/api/projects/[id]/pm-assignments/route.ts` (route, CRUD)

**Analog:** `app/api/projects/[id]/milestones/route.ts` + `app/api/admin/users/route.ts`

**Nested route with withProjectAccess** (milestones lines 1-14):
```typescript
import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { createMilestone, listMilestones } from '@/lib/services/milestones.service';
import { milestoneInputSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listMilestones(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await createMilestone(params.id, actor, body as Record<string, unknown>), { status: 201 }),
  { schema: milestoneInputSchema },
);
```

**Admin route CPMO wrapper** (`app/api/admin/users/route.ts` lines 1-30):
```typescript
import { withCpmo } from '@/lib/http/with-role';

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const newUser = await createUser(actor, body);
    return NextResponse.json(newUser, { status: 201 });
  },
  { schema: createUserSchema, badRequest: () => NextResponse.json({ error: '...' }, { status: 400 }) },
);
```

**Phase 11 apply:** Use `withProjectAccess` (not `withCpmo`) — tenancy via project assert; CPMO enforcement stays in service layer (D-15). Add PATCH route for soft-end (`effective_to`). Schema: `z.object({}).passthrough()` like milestones.

---

### `app/api/projects/[id]/stakeholders/route.ts` (route, CRUD)

**Analog:** `app/api/projects/[id]/milestones/route.ts`

Same `withProjectAccess` + service delegation. GET lists; POST creates; PATCH ends role. Service enforces `assertProjectWriteAccess` (CPMO or PM).

---

### `app/api/projects/route.ts` & `app/api/projects/[id]/route.ts` (route, request-response)

**Analog:** existing files (extend)

**POST create** (`route.ts` lines 18-29):
```typescript
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const actor = toAccessActor(user);
    return NextResponse.json(await createProject(actor, body), { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
```

**PATCH with passthrough schema** (`[id]/route.ts` lines 6-21):
```typescript
const projectUpdateSchema = z.object({}).passthrough();

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await updateProject(params.id, actor, body as Record<string, unknown>)),
  { schema: projectUpdateSchema },
);
```

**Phase 11 apply:** Response shape becomes `{ project, warnings }` when governance defaults fire. Route returns 200 with warnings — not 400 (D-07, D-08).

---

### `test/repo-db.ts` (config, batch)

**Analog:** `test/repo-db.ts:68-82`

**Projects DDL comment** (lines 68-73):
```typescript
/**
 * Minimal DDL for the tables Phase 2 repository tests touch. Column sets match
 * `lib/repositories/ALLOWLIST-DIFF.md`, including the migration-added columns
 */
```

**Projects CREATE** (lines 76-82):
```typescript
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY, name TEXT, client TEXT, pm_name TEXT, pm_email TEXT,
  start_date TEXT, end_date TEXT, status TEXT, current_phase TEXT, description TEXT,
  objective TEXT, project_owner TEXT, budget NUMERIC, budget_currency TEXT,
  headcount_quota INTEGER, budget_status TEXT,
  customer_id INTEGER, company_id INTEGER, created_at TIMESTAMPTZ DEFAULT now()
);
```

**Phase 11 apply:** Mirror every column/table from `db-project-master.ts` here in Wave 0 — drift causes UnknownColumnError in tests (Pitfall 5).

---

### Test files

**Analog:** `lib/services/access.unit.test.ts` + `lib/services/projects.service.unit.test.ts`

**Mock hoist pattern** (access.unit.test.ts lines 1-8):
```typescript
const { projectAccessRow, getProjectPmIdentity } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  getProjectPmIdentity: vi.fn(),
}));

vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow, getProjectPmIdentity }));
```

**Phase 11 apply:** Replace `getProjectPmIdentity` mock with `hasActivePmAssignment` from pm-assignments.repo. Extend `assertPmWriteAccess` tests for window-based access (PMAS-04).

**Service test mock pattern** (projects.service.unit.test.ts lines 3-33):
```typescript
vi.mock('@/lib/services/access', () => ({
  assertProjectAccess,
  assertProjectWriteAccess,
  isCpmo: (actor) => actor.roles?.includes('cpmo') ?? false,
  hasRole: (actor, role) => actor.roles?.includes(role) ?? false,
}));
vi.mock('@/lib/repositories/projects.repo', () => ({ /* repo fns */ }));
```

New service tests for pm-assignments and stakeholders follow `users.service.unit.test.ts` — mock repo + access, assert ForbiddenError on non-CPMO assignment create.

---

## Shared Patterns

### Schema migration (settings-flag DDL + backfill)

**Source:** `lib/db-roles.ts`
**Apply to:** `lib/db-project-master.ts`, wired in `lib/db.ts`

Two flags: DDL once, backfill once. Partial unique index pattern from lines 66-70:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS projects_company_code_lower_unique
ON projects (company_id, LOWER(project_code))
WHERE project_code IS NOT NULL AND TRIM(project_code) <> '';
```

### PM access — single lookup function

**Source:** `lib/services/access.ts` (rewire) + `lib/repositories/pm-assignments.repo.ts` (new)
**Apply to:** `assertPmWriteAccess`, `assertProjectAccess` PM branch, `listProjects` filter

Keep `assertPmWriteAccess` name (Phase 10 D-14 contract). Remove email/name fallback after backfill (D-13).

### Incremental audit trail

**Source:** `lib/services/audit.service.ts` + `lib/services/users.service.ts:111-119`
**Apply to:** code change, assignment mutations, stakeholder mutations

```typescript
/** Append-only audit log INSERT (D-08). No update or delete helpers. */
export async function auditLog(input: AuditLogInput): Promise<void> {
  await insertAuditLog(input);
}
```

Minimal before/after snapshots — do not dump full stakeholder PII beyond name/email fields.

### Program = customers table

**Source:** `lib/repositories/programs.repo.ts:6`, `lib/services/programs.service.ts:14-16`, `projects.repo.ts:51-52`
**Apply to:** createProject validation, list SELECT joins

```typescript
/** Programs are stored in the legacy `customers` table. */
const LIST_SELECT = `SELECT p.*, c.name as program_name, c.industry as program_industry
   FROM projects p LEFT JOIN customers c ON p.customer_id = c.id`;
```

Project `customer_id` FK is the program link (D-04). Do not invent `programs` table or duplicate program columns on `projects`.

### Column allowlist enforcement

**Source:** `lib/repositories/_helpers.ts:32-47` + `PROJECT_COLUMNS`
**Apply to:** all project PATCH paths

```typescript
export function buildUpdate(
  table: string,
  allowlist: readonly string[],
  fields: Record<string, unknown>,
): { sql: string; values: unknown[] } {
  const unknown = keys.filter(k => !allowlist.includes(k));
  if (unknown.length) throw new UnknownColumnError(unknown);
  // ...
}
```

### Nested route auth composition

**Source:** `lib/http/with-project-access.ts:30-55`
**Apply to:** pm-assignments and stakeholders routes

```typescript
project = await assertProjectAccess(ctx.params.id, ctx.actor);
// ForbiddenError/NotFoundError → 403/404 via withAuth catch tail
return handler(req, { ...ctx, project: project as ProjectAccessRow });
```

Service layer adds role-specific gates (CPMO for assignments, write access for stakeholders).

### Governance warnings (not blocking 400)

**Apply to:** `projects.service.ts` create/update

When `stage === 'L5'` or terminal status: persist server defaults, return `{ project, warnings: string[] }`. Use `ValidationError` only for hard requirements (`status_reason` when Other, `weekly_report_start_period` when enabled — D-06).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/services/project-governance.ts` | utility | transform | No existing L5/terminal default helper — extract from inline validation or new file; use `users.service.ts` ValidationError pattern for hard rules only |

---

## Metadata

**Analog search scope:** `lib/db-roles.ts`, `lib/db-mapping-tenant.ts`, `lib/db.ts`, `lib/services/access.ts`, `lib/services/projects.service.ts`, `lib/services/users.service.ts`, `lib/services/milestones.service.ts`, `lib/services/programs.service.ts`, `lib/services/audit.service.ts`, `lib/repositories/projects.repo.ts`, `lib/repositories/programs.repo.ts`, `lib/repositories/_helpers.ts`, `lib/http/with-project-access.ts`, `app/api/projects/**`, `app/api/admin/users/route.ts`, `test/repo-db.ts`, Phase 10 unit tests

**Files scanned:** ~35
**Pattern extraction date:** 2026-08-26
