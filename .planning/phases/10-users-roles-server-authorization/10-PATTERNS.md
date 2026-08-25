# Phase 10: Users, Roles & Server Authorization - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 28 new/modified files
**Analogs found:** 24 / 28

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/auth.ts` | service | request-response | `lib/auth.ts` (extend) | exact |
| `lib/services/access.ts` | service | request-response | `lib/services/access.ts` (extend) | exact |
| `lib/services/users.service.ts` | service | CRUD | `lib/services/holidays.service.ts` + `lib/repositories/admin.repo.ts` | role-match |
| `lib/services/audit.service.ts` | service | batch (append) | `lib/repositories/holidays.repo.ts` insert pattern | partial |
| `lib/repositories/users.repo.ts` | repository | CRUD | `lib/repositories/admin.repo.ts` + `lib/repositories/auth.repo.ts` | role-match |
| `lib/repositories/auth.repo.ts` | repository | CRUD | `lib/repositories/auth.repo.ts` (extend) | exact |
| `lib/repositories/admin.repo.ts` | repository | CRUD | `lib/repositories/admin.repo.ts` (slim) | exact |
| `lib/http/with-auth.ts` | middleware | request-response | `lib/http/with-auth.ts` (extend) | exact |
| `lib/http/with-role.ts` | middleware | request-response | `app/api/admin/users/route.ts` `requireAdmin` + `withAuth` | role-match |
| `lib/db.ts` (`migratePostgresSchema`) | migration | batch | `lib/db.ts:420` + `lib/db-mapping-tenant.ts` | exact |
| `app/api/auth/login/route.ts` | route | request-response | `app/api/auth/login/route.ts` (extend) | exact |
| `app/api/auth/session/extend/route.ts` | route | request-response | `app/api/auth/logout/route.ts` + `lib/auth.ts` `createSession` | role-match |
| `app/api/auth/logout/route.ts` | route | request-response | `app/api/auth/logout/route.ts` | exact (no change) |
| `app/api/admin/users/route.ts` | route | CRUD | `app/api/admin/users/route.ts` + `withAuth` pattern | exact |
| `app/api/admin/users/schema.ts` | config | transform | `app/api/admin/users/schema.ts` (extend) | exact |
| `lib/services/*.service.ts` (mutators) | service | CRUD | `lib/services/risks.service.ts` | exact |
| `lib/services/projects.service.ts` | service | CRUD | `lib/services/projects.service.ts` (extend list/create) | exact |
| `lib/repositories/projects.repo.ts` | repository | CRUD | `lib/repositories/projects.repo.ts` `listProjects` | exact |
| `components/layout/Sidebar.tsx` | component | event-driven | `components/layout/Sidebar.tsx:213-227` | exact |
| `app/admin/page.tsx` | component | CRUD | `app/admin/page.tsx` (extend) | exact |
| `lib/services/access.unit.test.ts` | test | batch | `lib/services/access.unit.test.ts` | exact |
| `app/api/projects/[id]/route.access.test.ts` | test | request-response | `app/api/projects/[id]/route.access.test.ts` | exact |
| `lib/http/role-matrix.test.ts` | test | request-response | `app/api/projects/[id]/route.access.test.ts` | role-match |
| `lib/services/users.service.unit.test.ts` | test | CRUD | `lib/services/holidays.service.unit.test.ts` | role-match |
| `lib/repositories/users.repo.test.ts` | test | CRUD | `lib/repositories/auth.repo.unit.test.ts` + `test/repo-db.ts` | role-match |
| `lib/auth.session.unit.test.ts` | test | request-response | `lib/repositories/auth.repo.unit.test.ts` | role-match |
| `app/api/auth/login/route.test.ts` | test | request-response | `app/api/projects/[id]/route.access.test.ts` | role-match |
| `lib/services/audit.service.unit.test.ts` | test | batch | `lib/repositories/auth.repo.unit.test.ts` | role-match |

## Pattern Assignments

### `lib/auth.ts` (service, request-response)

**Analog:** `lib/auth.ts` (extend in place)

**SessionUser type** (lines 23-31):
```typescript
export type SessionUser = {
  id: number;
  username: string;
  display_name: string;
  company_id: number | null;
  company_name: string | null;
  is_admin: number;
  onboarding_completed: number;
};
```

**Session resolution query** (lines 33-44) — extend SELECT with `email`, `status`, aggregate `roles[]`:
```typescript
export async function getSessionUser(sessionId: string): Promise<SessionUser | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  return (await db.get<SessionUser>(`
    SELECT u.id, u.username, u.display_name, u.company_id, u.is_admin,
           COALESCE(u.onboarding_completed, 0) as onboarding_completed,
           c.name as company_name
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN companies c ON u.company_id = c.id
    WHERE s.id = ? AND s.expires_at > ?
  `, sessionId, now)) ?? null;
}
```

**Session create + 7-day expiry** (lines 53-58) — reuse for `extendSession`:
```typescript
export async function createSession(userId: number): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const db = await getDb();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.run('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', sessionId, userId, expires);
  return sessionId;
}
```

**Status gate pattern:** After fetch, if `status !== 'active'`, call `deleteSession(sessionId)` and return `null` (AUTH-06 mid-session invalidation).

---

### `lib/services/access.ts` (service, request-response)

**Analog:** `lib/services/access.ts` (extend)

**AccessActor type** (lines 4-8):
```typescript
export type AccessActor = {
  company_id: number | null;
  is_admin: number | boolean;
};
```

**assertProjectAccess — replace admin bypass with CPMO company scope** (lines 25-48):
```typescript
export async function assertProjectAccess(
  projectId: number | string,
  actor: AccessActor,
): Promise<ProjectAccessRow> {
  if (actor.is_admin) {
    const row = await projectAccessRow(projectId);
    if (!row) throw new NotFoundError('Not found', 'project');
    return row;
  }
  const row = await projectAccessRow(projectId);
  if (!row) throw new NotFoundError('Not found', 'project');
  if (actor.company_id !== null) {
    const allowed =
      row.company_id === actor.company_id || row.customer_company_id === actor.company_id;
    if (!allowed) throw new ForbiddenError();
    return row;
  }
  if (row.company_id === null && row.customer_company_id === null) return row;
  throw new ForbiddenError();
}
```

**New helpers:** Add `hasRole`, `isCpmo`, `assertCanMutate`, `assertPmWriteAccess` alongside existing assert. Keep throw-on-deny (never boolean return). Compose: tenant first (`assertProjectAccess`), then role write rules.

**PM interim lookup fields** — from `lib/repositories/projects.repo.ts:12-16`:
```typescript
export const PROJECT_COLUMNS = [
  'name', 'client', 'pm_name', 'pm_email', /* ... */
] as const;
```

---

### `lib/services/users.service.ts` (service, CRUD)

**Analog:** `lib/services/holidays.service.ts` (assert + validation + repo) + `lib/repositories/admin.repo.ts` (user CRUD)

**Service assert-then-repo pattern** (lines 15-27):
```typescript
export async function createHoliday(
  projectId: number | string,
  actor: AccessActor,
  date: string | undefined,
  name: string,
) {
  await assertProjectAccess(projectId, actor);
  if (!date) throw new ValidationError('date required', 'date');
  if (await findHolidayByDate(projectId, date)) {
    throw new ConflictError('date already exists');
  }
  return createHolidayRepo(projectId, date, name);
}
```

**Apply to users.service:** Replace `assertProjectAccess` with CPMO company-scope assert (`hasRole(actor, 'cpmo')` + `actor.company_id` match). Call `auditLog()` after successful lock/unlock/update. Throw `ConflictError` on unique violations (USER-02). Throw `ValidationError` on empty roles array (USER-03).

---

### `lib/services/audit.service.ts` (service, batch)

**Analog:** `lib/repositories/holidays.repo.ts` insert + `lib/db-mapping-tenant.ts` settings flag (no existing audit service)

**Append-only insert pattern** (from `lib/repositories/holidays.repo.ts:24-30`):
```typescript
export async function createHoliday(projectId: number | string, date: string, name: string) {
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO project_holidays (project_id, date, name) VALUES (?, ?, ?)',
    Number(projectId), date, name,
  );
  return db.get('SELECT * FROM project_holidays WHERE id = ?', r.lastInsertRowid);
}
```

**Apply:** `auditLog({ actor_id, company_id, entity_type, entity_id, action, before, after })` — single INSERT into `audit_logs`, no diff library. Called from `users.service` after commit.

---

### `lib/repositories/users.repo.ts` (repository, CRUD)

**Analog:** `lib/repositories/admin.repo.ts` + `lib/repositories/auth.repo.ts`

**List with company filter** (admin.repo lines 35-45):
```typescript
export async function listAdminUsers(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  const where = isAdmin ? '' : 'WHERE u.company_id = ?';
  const params = isAdmin ? [] : [companyId];
  return db.all(
    `SELECT u.id, u.username, u.display_name, u.company_id, u.is_admin, u.created_at,
       c.name as company_name
     FROM users u LEFT JOIN companies c ON u.company_id = c.id
     ${where} ORDER BY u.is_admin DESC, u.username`,
    ...params,
  );
}
```

**Create user** (lines 48-64):
```typescript
export async function createAdminUser(
  username: string, passwordHash: string, displayName: string,
  companyId: number | null, isAdmin: boolean,
) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO users (username, password_hash, display_name, company_id, is_admin)
     VALUES (?, ?, ?, ?, ?)`,
    username, passwordHash, displayName, companyId, isAdmin ? 1 : 0,
  );
  return db.get(
    'SELECT id, username, display_name, company_id, is_admin FROM users WHERE id = ?',
    r.lastInsertRowid,
  );
}
```

**Soft-delete analog:** Replace `deleteAdminUser` DELETE (lines 85-88) with `UPDATE users SET status = 'inactive', deleted_at = now()` — never physical DELETE (USER-06).

**Role join:** Add `user_roles` CRUD; list/filter JOIN on roles for USER-01.

---

### `lib/repositories/auth.repo.ts` (repository, CRUD)

**Analog:** `lib/repositories/auth.repo.ts` (extend)

**Login row fetch** (lines 12-26):
```typescript
export type AuthUserRow = {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  company_id: number | null;
  is_admin: number;
  onboarding_completed: number;
};

export async function findUserByUsername(username: string) {
  const db = await getDb();
  return db.get<AuthUserRow>('SELECT * FROM users WHERE username = ?', username);
}
```

**Extend:** Add `status`, `email` to `AuthUserRow`; login route checks `status === 'active'`.

---

### `lib/http/with-auth.ts` (middleware, request-response)

**Analog:** `lib/http/with-auth.ts` (extend)

**AccessActor derivation** (lines 97-98):
```typescript
const actor: AccessActor = { company_id: user.company_id, is_admin: user.is_admin };
```

**Extend to:**
```typescript
const actor: AccessActor = {
  company_id: user.company_id,
  is_admin: user.is_admin,
  roles: user.roles,
  status: user.status,
  user_id: user.id,
};
```

**Error mapping catch tail** (lines 124-139) — unchanged; `ForbiddenError` → 403 via `serviceErrorResponse`.

**Zod boundary validation** (lines 101-111):
```typescript
if (opts?.schema) {
  const raw = await req.json();
  const parsed = opts.schema.safeParse(raw);
  if (!parsed.success) {
    if (opts.badRequest) return opts.badRequest(parsed.error);
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    );
  }
  body = parsed.data;
}
```

---

### `lib/http/with-role.ts` (middleware, request-response)

**Analog:** `app/api/admin/users/route.ts:12-17` `requireAdmin` composed with `withAuth`

**Inline admin gate** (lines 12-17):
```typescript
async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}
```

**Target pattern:** Thin wrapper over `withAuth` that checks `hasRole(actor, 'cpmo')` (not `is_admin`) and scopes to `actor.company_id`. Platform break-glass routes (`/api/admin/companies`) keep `requireAdmin`/`is_admin`.

---

### `lib/http/with-project-access.ts` (middleware, request-response)

**Analog:** `lib/http/with-project-access.ts` (no structural change)

**Compose withAuth + assertProjectAccess** (lines 40-55):
```typescript
return withAuth<TParams, TBody>(
  async (req, ctx) => {
    let project: ProjectAccessRow | undefined;
    try {
      project = await assertProjectAccess(ctx.params.id, ctx.actor);
    } catch (e) {
      if (isAccessShadowMode() && (e instanceof ForbiddenError || e instanceof NotFoundError)) {
        logAccessShadowDenial(req, ctx.user, e, ctx.params.id);
      } else {
        throw e;
      }
    }
    return handler(req, { ...ctx, project: project as ProjectAccessRow });
  },
  opts,
);
```

Role checks stay in services (not wrapper) — `withProjectAccess` unchanged; mutators add `assertCanMutate` at service top.

---

### `lib/db.ts` / `migratePostgresSchema` (migration, batch)

**Analog:** `lib/db.ts:420` migration array + `lib/db-mapping-tenant.ts:44-163` settings-flag backfill

**Idempotent ALTER pattern** (db.ts lines 421-435):
```typescript
async function migratePostgresSchema(pool: Pool) {
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`,
    /* ... */
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed INTEGER DEFAULT 0`,
  ];
```

**Settings-flag one-time backfill** (db-mapping-tenant.ts lines 59-64, 155-158):
```typescript
async function migrateOneTable(pool: Pool, spec: MappingTableSpec, flagKey: string): Promise<void> {
  const done = await pool.query('SELECT value FROM settings WHERE key = $1', [flagKey]);
  if (done.rows.length > 0) return;
  /* ... DDL + backfill ... */
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
    [flagKey, new Date().toISOString()],
  );
}
```

**Apply:** Add `user_roles`, `audit_logs`, user columns via `ALTER TABLE ... IF NOT EXISTS`. Role backfill (`is_admin=1` → cpmo, else → pm) uses settings flag `roles_backfill_v1`.

---

### `app/api/auth/login/route.ts` (route, request-response)

**Analog:** `app/api/auth/login/route.ts` (extend)

**Login flow** (lines 5-25):
```typescript
export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }
  const user = await findUserByUsername(String(username).trim());
  if (!user || !verifyPassword(String(password), user.password_hash)) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }
  const sessionId = await createSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
```

**Extend:** Add status gate before password verify — same 401 message for inactive/locked (no enumeration):
```typescript
if (!user || user.status !== 'active' || !verifyPassword(...)) {
  return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
}
```

---

### `app/api/auth/session/extend/route.ts` (route, request-response)

**Analog:** `app/api/auth/logout/route.ts` + `lib/auth.ts` session UPDATE

**Logout session handling** (logout/route.ts lines 4-9):
```typescript
export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) deleteSession(sessionId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
```

**Extend pattern:** Keep same cookie value; `UPDATE sessions SET expires_at = ? WHERE id = ? AND expires_at > now()`. Return 401 if expired. No new cookie — AUTH-02 draft preservation.

---

### `app/api/admin/users/route.ts` (route, CRUD)

**Analog:** `app/api/admin/users/route.ts` (refactor to CPMO scope)

**requireAdmin + CRUD** (lines 12-63):
```typescript
async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function POST(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const parsed = createUserSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }
  try {
    const newUser = await createAdminUser(/* ... */);
    return NextResponse.json(newUser, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }
}
```

**Target:** Route becomes thin — `withAuth` + CPMO role check → `users.service.createUser(actor, body)`. DELETE becomes deactivate via service. Keep platform `is_admin` routes separate (`/api/admin/companies`).

---

### `app/api/admin/users/schema.ts` (config, transform)

**Analog:** `app/api/admin/users/schema.ts` (extend)

**Zod schema** (lines 9-15):
```typescript
export const createUserSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  display_name: z.string().optional(),
  company_id: z.unknown().optional(),
  is_admin: z.unknown().optional(),
});
```

**Extend:** Add `email: z.email()`, `roles: z.array(z.enum(['cpmo','pm','viewer'])).min(1)`, `status: z.enum(['active','inactive','locked']).default('active')`. Replace `is_admin` with roles in new schema; keep compat field optional during transition.

---

### `lib/services/*.service.ts` mutators (service, CRUD)

**Analog:** `lib/services/risks.service.ts`

**Mutator with assertProjectAccess only today** (lines 15-22):
```typescript
export async function createRisk(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  return createRiskRepo(projectId, body);
}
```

**Target:** Add at top of every create/update/delete:
```typescript
await assertProjectAccess(projectId, actor);
await assertCanMutate(actor, projectId);  // Viewer → ForbiddenError
await assertPmWriteAccess(projectId, actor);  // PM unassigned → ForbiddenError; CPMO bypasses
```

Read-only methods (list/get) keep `assertProjectAccess` only.

---

### `lib/services/projects.service.ts` + `projects.repo.ts` (service/repo, CRUD)

**Analog:** `lib/services/projects.service.ts:22-24` + `projects.repo.ts:62-77`

**listProjects admin bypass to replace** (projects.service.ts):
```typescript
export async function listProjects(actor: AccessActor) {
  return listProjectsRepo(actor.company_id, Boolean(actor.is_admin));
}
```

**Repo admin branch** (projects.repo.ts lines 62-66):
```typescript
export async function listProjects(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  if (isAdmin) {
    return db.all(`${LIST_SELECT} ORDER BY p.created_at DESC`);
  }
```

**Target:** CPMO uses company filter (same as non-admin branch), not global list. Pass `isCpmo(actor)` instead of `is_admin`.

---

### `components/layout/Sidebar.tsx` (component, event-driven)

**Analog:** `components/layout/Sidebar.tsx:213-227`

**Admin nav gated by is_admin** (lines 213-227):
```tsx
{me?.is_admin ? (
  <Link href="/admin" /* ... */>
    <ShieldCheck className="h-4 w-4 shrink-0" />
    Admin Panel
  </Link>
) : null}
```

**Target:** Show Admin link for CPMO (`roles includes 'cpmo'`) OR platform `is_admin`. Viewer: hide mutate controls on admin page (server 403 is gate).

---

### Test files

#### `lib/services/access.unit.test.ts` (extend)

**Analog:** `lib/services/access.unit.test.ts`

**Actor fixtures + assert tests** (lines 16-18, 46-49):
```typescript
const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const admin = { company_id: 5 as number | null, is_admin: 1 as number | boolean };

it('throws ForbiddenError for a cross-company actor (not NotFoundError)', async () => {
  projectAccessRow.mockResolvedValue({ company_id: 9, customer_company_id: 8 });
  await expect(assertProjectAccess(1, owner)).rejects.toBeInstanceOf(ForbiddenError);
});
```

**Add:** CPMO company-scoped tests (no global bypass), `hasRole` union, `assertPmWriteAccess` interim match, `assertCanMutate` Viewer deny.

#### `app/api/projects/[id]/route.access.test.ts` (extend)

**Analog:** `app/api/projects/[id]/route.access.test.ts`

**Mock setup + session fixtures** (lines 4-57):
```typescript
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));

const ownerSession = {
  id: 2, username: 'ava', company_id: 5, is_admin: 0, onboarding_completed: 1,
};
```

**403 cross-company proof** (lines 67-76):
```typescript
it('returns 403 for a cross-company project on GET', async () => {
  vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
  projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
  const res = await GET(req('GET'), params());
  expect(res.status).toBe(403);
});
```

**Add role matrix cases:** `viewerSession` with `roles: ['viewer']` → PATCH 403; PM on unassigned project → 403; CPMO same company → 200. Extend session fixture with `roles`, `status`.

#### `lib/repositories/auth.repo.unit.test.ts` (pattern for new repo tests)

**Mock getDb pattern** (lines 3-9):
```typescript
const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));
```

#### `test/repo-db.ts` (extend DDL)

**Analog:** `test/repo-db.ts:75+`

Extend minimal DDL with `user_roles`, `audit_logs`, `users.status/email/locked_at/locked_by/deleted_at` for integration-style repo tests.

---

## Shared Patterns

### Authentication & Session
**Source:** `lib/auth.ts`, `lib/http/with-auth.ts`
**Apply to:** All authenticated routes

```typescript
// Session cookie + scrypt — do not replace
export const SESSION_COOKIE_NAME = 'pm_session';
// withAuth: 401 on missing session
const user = await getSessionFromRequest(req);
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

### Error Handling (403/404/409)
**Source:** `lib/services/errors.ts` + `lib/api-errors.ts:41-58`
**Apply to:** All services and routes using `withAuth`

```typescript
// Service layer — HTTP-free throws
export class ForbiddenError extends Error { /* ... */ }
export class ConflictError extends Error { /* ... */ }

// Route catch via withAuth → serviceErrorResponse
if (e instanceof ForbiddenError) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
if (e instanceof ConflictError) {
  return NextResponse.json({ error: e.message }, { status: 409 });
}
```

### Tenant + Role Composition (Pitfall 10)
**Source:** `lib/services/access.ts` + `lib/services/risks.service.ts`
**Apply to:** All project-scoped mutators

Order: (1) `assertProjectAccess`, (2) `assertCanMutate`, (3) `assertPmWriteAccess`. Never replace tenant check with role check.

### Route → Service → Repository
**Source:** `lib/services/projects.service.ts`, `app/api/admin/users/route.ts`
**Apply to:** User admin and all domain services

Routes stay thin (session + Zod + service call). Business rules and authz in services. SQL in repositories.

### Validation at Route Boundary
**Source:** `lib/http/with-auth.ts` WrapperOptions + `app/api/admin/users/schema.ts`
**Apply to:** User create/update routes

Use Zod via `withAuth(handler, { schema: createUserSchema })` or manual `safeParse` with frozen 400 bodies.

### Platform vs CPMO Admin Split (Pitfall 6)
**Source:** `app/api/admin/companies/route.ts:11-15` vs target CPMO user routes

- **Platform ops:** `is_admin` + `requireAdmin` — cross-tenant companies, demo, Jira config
- **CPMO company admin:** `roles.includes('cpmo')` + `company_id` scope — user CRUD only

### Vitest Access Test Convention
**Source:** `app/api/projects/[id]/route.access.test.ts`

Mock at repository boundary (`projectAccessRow`), not service. Real `assertProjectAccess` runs under test. Session via `vi.mock('@/lib/auth')`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/services/audit.service.ts` | service | batch (append) | No audit service exists — use holidays.repo INSERT + RESEARCH.md JSONB schema |
| `lib/http/role-matrix.test.ts` | test | request-response | New cross-route matrix file — extend `route.access.test.ts` pattern across ≥1 GET + ≥1 POST |
| `app/api/auth/session/extend/route.ts` | route | request-response | No extend endpoint — compose logout cookie handling + session UPDATE |
| `lib/auth.session.unit.test.ts` | test | request-response | No session unit tests yet — follow auth.repo.unit.test.ts mock pattern |

## Metadata

**Analog search scope:** `lib/auth.ts`, `lib/services/access.ts`, `lib/http/with-auth.ts`, `lib/http/with-project-access.ts`, `lib/repositories/admin.repo.ts`, `lib/repositories/auth.repo.ts`, `lib/repositories/projects.repo.ts`, `lib/services/projects.service.ts`, `lib/services/risks.service.ts`, `lib/services/holidays.service.ts`, `app/api/admin/users/`, `app/api/auth/`, `app/api/projects/[id]/route.access.test.ts`, `lib/services/access.unit.test.ts`, `lib/db.ts`, `lib/db-mapping-tenant.ts`, `components/layout/Sidebar.tsx`, `test/repo-db.ts`
**Files scanned:** ~35 source + test files via codegraph_explore
**Pattern extraction date:** 2026-08-26
