# Phase 9: Mapping Table Tenant Isolation - Research

**Researched:** 2026-08-25
**Domain:** Multi-tenant PostgreSQL schema migration + company-scoped API enforcement on four global mapping tables
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Backfill & Schema

- **Migration order:** add nullable `company_id` → backfill every row → `NOT NULL` + FK to `companies(id)` → drop global unique on `name` → add `UNIQUE(company_id, name)` (or equivalent per table if the unique key is not `name`).
- **Single-company DB:** assign all existing rows to that company.
- **Multi-company DB:** duplicate each previously-global row once per existing company so every tenant keeps a usable copy of shared templates. Never assign every row to `company_id = 1` when multiple companies exist (Pitfall 7).
- **No orphans:** after backfill, zero rows with NULL `company_id`. Empty tables are fine — the constraint still applies.

#### API Contract

- **Cross-company GET/PUT/PATCH/DELETE by id → 403** `{ error: 'Forbidden' }` (success criteria; not 404).
- **List endpoints** return only the session company's rows (empty array is success, not 403).
- **Create** stamps `company_id` from the session; a session without `company_id` cannot create (403).
- **Unique names** collide only within a company. Two companies may reuse the same template/preset name. In-company collision follows existing 400/409 patterns on these routes.

#### Enforcement Layer

- Keep `withAuth` on these routes (they are company-scoped, not project-scoped — do not force `withProjectAccess`).
- **Service layer owns the tenant assert**; repos always take `companyId` and filter SQL with `WHERE company_id = ?`. Do not rely on UI hiding.
- Follow route → service → repository. If a mapping route still calls the repo directly, introduce a thin service in this phase for those four tables only — do not thin unrelated ops/admin/config routes (out of scope).
- **No new wrapper** (`withCompanyAccess`) unless an existing helper already covers this exact case. Prefer passing `ctx.user.company_id` / `ctx.actor.company_id` into the service.

#### Testing

- Vitest 4 is the gate (HYG-03). Cross-company 403 tests on all four tables for read and mutate-by-id.
- Same name allowed across companies; uniqueness enforced inside a company.
- Backfill coverage: two-company fixture with pre-migration global rows; after migrate, no NULL `company_id`, no all-rows-on-company-1 collapse, each company can list its copy.
- Do not add a UI visual regression suite for this phase.

### Claude's Discretion

- Exact service file names, migration loop placement in `lib/db.ts` (DATA-01 still deferred — schema init stays in `getDb()`), and whether Jira preset/sync SQL lives in `import-mapping.repo.ts` vs `jira-config.repo.ts` stay at the agent's discretion as long as all four tables are covered and patterns match existing tenant-scoped repos (`listProjects(companyId)`).

### Deferred Ideas (OUT OF SCOPE)

- CPMO / PM / Viewer authorization on these routes — Phase 10
- DATA-01 (migrations out of `getDb()`)
- Remaining ops/admin/config service thinning (v1.0 leftover, not this milestone)
- Import dialog UI redesign
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TENANT-01 | `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, and `jira_sync_mappings` are scoped by `company_id` with backfill, non-null company, unique keys including company, and cross-company 403 tests | Migration sequence + backfill algorithm (Runtime State Inventory); repo `companyId` filter pattern (`listProjects`); thin service + `ForbiddenError` → 403 via `serviceErrorResponse`; route inventory; Vitest 4 test matrix (Validation Architecture) |
</phase_requirements>

## Summary

Phase 9 closes the last v1.0 tenant-isolation gap: four **global** PostgreSQL tables that power timeline import templates, bug import templates, Jira JQL presets, and Jira field-sync presets. Today every repo query is `SELECT * FROM …` with no `company_id` predicate, and six route files call repositories directly under `withAuth` (401 only). A authenticated user who guesses another tenant's numeric row id can read or mutate foreign mapping data — the residual IDOR v1.0 Phase 6 documented as TENANT-01 follow-up.

The fix is a **brownfield migration + enforcement pass**, not a product UX change. Schema work stays in `migratePostgresSchema()` inside `getDb()` (DATA-01 deferred). Enforcement follows the established v1.0 stack: thin routes → new mapping services (tenant assert) → repos with mandatory `companyId` and `WHERE company_id = ?`. Cross-company access by id throws `ForbiddenError`, which `serviceErrorResponse` maps to `{ error: 'Forbidden' }` / 403 — matching export and project-scoped route tests. Multi-company backfill **duplicates** each legacy global row once per company (never mass-assign to company 1). No new npm packages; Vitest 4.1.10 remains the gate.

**Primary recommendation:** Add `company_id` via the locked migration order, backfill with single- vs multi-company branching, introduce `import-mapping.service.ts` + `jira-mapping.service.ts` (names at executor discretion), refactor all six mapping routes to call services, and land TDD-first tests for tenant assert / list scoping / composite unique / 403 before wiring routes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema migration + backfill | Database / Storage — `migratePostgresSchema` in `lib/db.ts` | — | Column, FK, and unique constraints are PostgreSQL concerns; cold-start migrate loop is the project's only migration mechanism until DATA-01 |
| Row ownership (`company_id`) | Database / Storage — NOT NULL + FK | — | DB enforces referential integrity; app cannot insert orphan rows after migration |
| Per-company unique names | Database / Storage — composite UNIQUE | API tier — map `23505` to 409 | Presets/templates collide only within a tenant |
| List scoping (session company only) | API tier — mapping service | Database — indexed `company_id` | List endpoints return `[]` for empty tenant, never 403; SQL filter is defense-in-depth |
| Cross-company by-id deny (403) | API tier — mapping service tenant assert | — | Must not live in React hooks (`useImportMapping`, `JiraSyncDialog`); UI has no company filter today |
| Session gate (401) | API tier — `withAuth` | — | Already on all mapping routes; keep unchanged |
| Cap/eviction logic (5 bug templates, 10 JQL presets, 5 sync maps) | API tier — service | Database — scoped DELETE | Eviction SQL must include `company_id` or one tenant's POST deletes another's rows |

## Standard Stack

### Core (unchanged — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 | App Router API routes | Existing mapping routes already use `withAuth` |
| PostgreSQL + `pg` | ^8.20.0 | Persistence, UNIQUE constraints, FK | Tenant columns added via existing migrate loop [VERIFIED: lib/db.ts:420-504] |
| Vitest | 4.1.10 | Unit + route tests (HYG-03) | `npm test` / `vitest run`; 727 passing baseline [VERIFIED: package.json:49] |
| Zod | ^4.4.3 | Request body validation | Schemas already on POST routes (`createTimelineMappingSchema`, etc.) |

### Supporting (in-repo patterns — extend, do not replace)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `lib/http/with-auth.ts` | 401 gate, `AccessActor`, error catch tail | All six mapping routes — keep as-is |
| `lib/services/errors.ts` | `ForbiddenError`, `NotFoundError`, `ConflictError` | Service tenant assert; PG unique → `ConflictError` |
| `lib/api-errors.ts` | `serviceErrorResponse` → 403 `{ error: 'Forbidden' }` | Route catch via `withAuth` |
| `lib/repositories/projects.repo.ts` | `listProjects(companyId, isAdmin)` | Template for repo list scoping [VERIFIED: lib/repositories/projects.repo.ts:62-77] |
| `test/repo-db.ts` | `testDb()`, `seedCompany()`, real Postgres DDL | Backfill + repo integration tests |

**Installation:** None — phase is schema + in-repo layers only.

**Version verification:** `vitest@4.1.10`, `next@16.2.4`, `pg@^8.20.0` confirmed in `package.json` (2026-08-25).

## Package Legitimacy Audit

> No external packages are installed in this phase.

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
HTTP (cookie session)
        │
        ▼
┌───────────────────┐
│ withAuth          │──401──► { error: 'Unauthorized' }
│ · getSession      │
│ · actor.company_id│
└─────────┬─────────┘
          │ ctx.user / ctx.actor
          ▼
┌───────────────────┐
│ Mapping service   │──403──► ForbiddenError → { error: 'Forbidden' }
│ · requireCompany  │         (cross-company by-id OR null company_id on create)
│ · assertRowTenant │──404──► NotFoundError (id genuinely missing)
│ · stamp company   │         on create
└─────────┬─────────┘
          │ companyId + payload
          ▼
┌───────────────────┐
│ Repository        │──409──► ConflictError (23505 unique per company)
│ WHERE company_id=?│
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ PostgreSQL        │
│ 4 mapping tables  │◄── migratePostgresSchema on cold start
└───────────────────┘
```

### Current Schema (pre-phase — no `company_id`)

All four tables are created without tenant columns [VERIFIED: lib/db.ts]:

```239:244:lib/db.ts
    CREATE TABLE IF NOT EXISTS timeline_import_mappings (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      mappings_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
```

```404:409:lib/db.ts
    CREATE TABLE IF NOT EXISTS jira_jql_presets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      jql TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
```

```410:415:lib/db.ts
    CREATE TABLE IF NOT EXISTS bug_import_mappings (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      mappings_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
```

```479:479:lib/db.ts
    `CREATE TABLE IF NOT EXISTS jira_sync_mappings (id SERIAL PRIMARY KEY, mappings_json TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
```

```480:480:lib/db.ts
    `ALTER TABLE jira_jql_presets ADD COLUMN IF NOT EXISTS context TEXT DEFAULT ''`,
```

**Note:** No global `UNIQUE(name)` constraint exists on these tables today — verified in `initPostgresSchema` and `migratePostgresSchema` [VERIFIED: lib/db.ts:239-504]. The migration step "drop global unique" is defensive/idempotent (`DROP INDEX IF EXISTS`); the required add is composite unique per table.

### Recommended Composite Unique Keys

| Table | Composite unique | Rationale |
|-------|------------------|-----------|
| `timeline_import_mappings` | `(company_id, name)` | Named templates; CONTEXT locked |
| `bug_import_mappings` | `(company_id, name)` | Same shape as timeline |
| `jira_jql_presets` | `(company_id, name, context)` | Presets filtered by `context` query param [VERIFIED: lib/repositories/jira-config.repo.ts:31-36]; same name in different contexts must not collide |
| `jira_sync_mappings` | none on name | No `name` column — retention is "keep last 5 per company" in app logic |

### Route & Repository Inventory

| Table | Routes (all `withAuth`) | Repo module | Direct repo calls today |
|-------|-------------------------|-------------|-------------------------|
| `timeline_import_mappings` | `app/api/import-mapping/route.ts`, `[id]/route.ts` | `import-mapping.repo.ts` | GET/POST/PUT/DELETE [VERIFIED: app/api/import-mapping/route.ts:3-18] |
| `bug_import_mappings` | `app/api/bug-import-mapping/route.ts`, `[id]/route.ts` | `import-mapping.repo.ts` | GET/POST/DELETE |
| `jira_jql_presets` | `app/api/jira/jql-presets/route.ts`, `[id]/route.ts` | `jira-config.repo.ts` | GET/POST/DELETE |
| `jira_sync_mappings` | `app/api/jira/sync-mappings/route.ts` only | `jira-config.repo.ts` | GET/POST — **no by-id route** [VERIFIED: app/api/jira/sync-mappings/route.ts:9-21] |

Global repo SQL (must change) [VERIFIED: lib/repositories/import-mapping.repo.ts:8-9,14-16]:

> "Both tables are global, not company-scoped — that is the current behavior"

```14:16:lib/repositories/import-mapping.repo.ts
export async function listTimelineMappings() {
  const db = await getDb();
  return db.all('SELECT * FROM timeline_import_mappings ORDER BY created_at DESC');
```

Jira sync eviction is global today — **high-risk** after tenant column [VERIFIED: lib/repositories/jira-config.repo.ts:65-71]:

```65:71:lib/repositories/jira-config.repo.ts
export async function saveJiraSyncMapping(mappingsJson: string) {
  const db = await getDb();
  await db.run('INSERT INTO jira_sync_mappings (mappings_json) VALUES (?)', mappingsJson);
  await db.run(
    `DELETE FROM jira_sync_mappings
     WHERE id NOT IN (SELECT id FROM jira_sync_mappings ORDER BY created_at DESC LIMIT 5)`,
  );
}
```

### Pattern 1: Company-scoped list (mirror `listProjects`)

**What:** Every list repo function takes `companyId: number` and adds `WHERE company_id = ?`.

**When:** All GET list handlers.

**Example:**

```typescript
// Pattern source: lib/repositories/projects.repo.ts:62-71
export async function listTimelineMappings(companyId: number) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM timeline_import_mappings WHERE company_id = ? ORDER BY created_at DESC',
    companyId,
  );
}
```

Service passes `actor.company_id` after null check; list returns `[]` when tenant has no rows — not 403.

### Pattern 2: By-id tenant assert (403 not 404 on cross-company)

**What:** Fetch row by primary key without company in SQL; compare `row.company_id` to `actor.company_id`. Missing row → `NotFoundError` (404). Wrong tenant → `ForbiddenError` (403). Mirrors `assertProjectAccess` ordering [VERIFIED: lib/services/access.ts:35-42].

**When:** PUT/DELETE on `[id]` routes; optional GET-by-id if added later.

**Example:**

```typescript
// Error mapping: lib/api-errors.ts:42-44 → { error: 'Forbidden' }, status 403
function assertCompanyRow(actor: AccessActor, row: { company_id: number } | undefined) {
  if (!row) throw new NotFoundError('Not found');
  if (actor.company_id === null || row.company_id !== actor.company_id) {
    throw new ForbiddenError();
  }
}
```

### Pattern 3: Migration + backfill in `migratePostgresSchema`

**What:** Append statements to the existing migrations array; each wrapped in try/catch (idempotent column adds) [VERIFIED: lib/db.ts:501-503].

**Backfill algorithm (per table):**

1. `ALTER TABLE … ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`
2. Count companies:
   - **One company:** `UPDATE … SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL`
   - **Multiple companies:** For rows still `company_id IS NULL`, `INSERT INTO … (name, mappings_json, company_id, …) SELECT …, c.id FROM legacy_rows CROSS JOIN companies c`, then `DELETE FROM … WHERE company_id IS NULL`
3. `ALTER TABLE … ALTER COLUMN company_id SET NOT NULL`
4. `CREATE UNIQUE INDEX IF NOT EXISTS … ON … (company_id, name)` (+ `context` for JQL presets)
5. `CREATE INDEX IF NOT EXISTS … ON … (company_id)` for list queries

Run backfill **before** NOT NULL. Never `UPDATE … SET company_id = 1` when `COUNT(companies) > 1`.

### Pattern 4: Thin route → service (this phase only)

**What:** Routes stop importing repos; call service with `ctx.actor`. Handler body becomes parse/validate → service → JSON.

**Files to thin (six routes, four tables):** listed in route inventory above. Do **not** touch ops/admin/config routes.

### Anti-Patterns to Avoid

- **Filter in UI only:** `useImportMapping` and `JiraSyncDialog` fetch list APIs with no client-side tenant filter — API must scope [VERIFIED: 09-CONTEXT.md code_context].
- **404 on cross-company id:** Leaks existence; success criteria require 403.
- **Global cap eviction after tenant column:** `saveJiraSyncMapping` DELETE must be scoped to `company_id`.
- **`withProjectAccess` on company-global config:** Wrong abstraction — mappings are not project-scoped.
- **Admin bypass listing all tenants' templates:** CONTEXT requires session-company lists only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session → company context | Custom header / query param company | Existing `SessionUser.company_id` + `AccessActor` from `withAuth` | Already populated on every authenticated request |
| HTTP 403 mapping | Per-route `{ status: 403 }` | `ForbiddenError` + `serviceErrorResponse` | Single wire shape used across 20+ route tests |
| SQL tenant filter | Post-query JS filter | `WHERE company_id = ?` in repo | IDOR-safe even if service assert regresses |
| Migration runner | New migrate CLI (DATA-01) | Append to `migratePostgresSchema` array | DATA-01 explicitly deferred; `getDb()` is production path |
| Company access wrapper | New `withCompanyAccess` middleware | Service-level assert + existing `withAuth` | CONTEXT locked — no new wrapper unless identical helper exists |

**Key insight:** These tables are **company-global configuration** (like `company_jira_config`), not project resources. Reuse company-id stamping and SQL scoping, not `assertProjectAccess`.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | PostgreSQL rows in `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, `jira_sync_mappings` — all lack `company_id` today | **Data migration:** backfill per locked single/multi-company rules; then NOT NULL |
| Live service config | None — mapping data lives entirely in PostgreSQL, not external UIs | None |
| OS-registered state | None — verified no Task Scheduler / pm2 names reference mapping tables | None |
| Secrets/env vars | None — no env keys name these tables | None |
| Build artifacts | `.next/` cache only; no compiled mapping state | None — schema change applies on next `getDb()` cold start |

**Post-file-edit runtime:** After code deploy, **every app instance** running `getDb()` executes new migrate statements once (singleton `_client` per process). Existing global rows remain readable only after backfill completes in same migrate pass — plan must not ship NOT NULL before backfill in the same migration batch.

## Common Pitfalls

### Pitfall 1: Mass-assign all rows to company 1 (Pitfall 7)

**What goes wrong:** Multi-tenant DB with two companies; backfill sets `company_id = 1` on all legacy templates. Company B inherits Company A's Jira JQL presets.

**How to avoid:** Branch on `SELECT COUNT(*) FROM companies`; duplicate via `CROSS JOIN` when count > 1.

**Warning signs:** Backfill test with two companies shows identical row ids across tenants; Company B lists Company A template names without creating them.

### Pitfall 2: Scoped list but unscoped by-id mutate

**What goes wrong:** List filtered; PUT/DELETE still uses `WHERE id = ?` only — classic IDOR.

**How to avoid:** Service assert on every by-id path; repo mutates with `WHERE id = ? AND company_id = ?`.

### Pitfall 3: Global eviction DELETE on sync mappings

**What goes wrong:** Company A saves sync map; eviction deletes Company B's rows.

**How to avoid:** Change `saveJiraSyncMapping(companyId, json)` — subquery adds `WHERE company_id = ?`.

### Pitfall 4: UNIQUE without company_id blocks other tenants

**What goes wrong:** Adding `UNIQUE(name)` before composite migration prevents two companies from both having template "Standard".

**How to avoid:** Composite `(company_id, name)` or `(company_id, name, context)` only after backfill.

### Pitfall 5: Route tests still mock repos after service extraction

**What goes wrong:** Tests pass but production calls real repos without companyId.

**How to avoid:** Update route tests to mock **service** module; add service unit tests for assert/scoping.

## Code Examples

### Cross-company 403 route test (existing pattern)

```typescript
// Source: app/api/export/ppt/[id]/route.test.ts:83-91
it('returns 403 for a cross-company project', async () => {
  vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
  projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

  const res = await POST(req(), params());

  expect(res.status).toBe(403);
  await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
});
```

Apply same shape to `PUT/DELETE /api/import-mapping/[id]`, `DELETE /api/bug-import-mapping/[id]`, `DELETE /api/jira/jql-presets/[id]`. For `jira/sync-mappings`, assert GET list for company A does not include company B rows (no by-id route).

### Service error mapping

```typescript
// Source: lib/api-errors.ts:42-44
if (e instanceof ForbiddenError) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Company-scoped create

```typescript
export async function createTimelineMapping(actor: AccessActor, name: string, mappingsJson: string) {
  if (actor.company_id === null) throw new ForbiddenError();
  try {
    return await createTimelineMappingRepo(actor.company_id, name, mappingsJson);
  } catch (e) {
    if (isPgUniqueViolation(e)) throw new ConflictError('Template name already exists');
    throw e;
  }
}
```

### TDD vs execute classification (project `tdd_mode: true`)

| Behavior | TDD (write failing test first) | Execute (implement to test) |
|----------|-------------------------------|----------------------------|
| `assertCompanyRow` → 403 cross-company | Yes — service unit test | — |
| List returns only session company rows | Yes — repo + route test | — |
| Same name allowed across companies | Yes — integration/repo test | — |
| Duplicate name within company → 409 | Yes — service/route test | — |
| Backfill: two companies, no NULL, no all-on-1 | Yes — migrate integration test | — |
| Migration SQL statements in `lib/db.ts` | — | Execute (DDL glue) |
| Route import path change repo→service | Partial — update existing 401 tests to mock service | — |
| UI hooks (`useImportMapping`) | No tests — no UI change | Execute only if API contract unchanged |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global mapping tables + 401 only | Company-scoped rows + service assert + 403 | Phase 9 (this) | Closes IDOR on preset/mapping ids |
| Routes call repos directly | Thin service for four tables | Phase 9 (partial SVC-01) | Matches v1.0 layer convention |
| Migrations in external files | In-code `migratePostgresSchema` | Still current (DATA-01 deferred) | Phase adds statements to existing array |

**Deprecated/outdated:**
- `import-mapping.repo.ts` header comment "global, not company-scoped" — remove/replace after phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No global `UNIQUE(name)` exists today on the four tables — only composite uniques need to be added | Migration | Redundant DROP harmless; wrong if undocumented unique index exists elsewhere |
| A2 | `is_admin` does **not** bypass company scoping on mapping lists (session company only) | API Contract | Admin users might expect cross-tenant template admin |
| A3 | Cross-company **non-existent** id returns 404 (not 403) — locked wording targets foreign rows that exist | API Contract | Ambiguous spec if product wants uniform 403 |
| A4 | `jira_sync_mappings` "read/mutate-by-id" tests = list isolation + POST scoping (no `[id]` route) | Testing | Success criteria wording mentions by-id; sync table has no id route |

## Open Questions

1. **JQL preset unique key: `(company_id, name)` vs `(company_id, name, context)`**
   - What we know: Routes filter by `context`; same display name in two contexts is plausible.
   - Recommendation: Use `(company_id, name, context)` — matches query shape; still satisfies "unique within company" per context slice.

2. **Admin user with `company_id` null**
   - What we know: Create without company → 403 (locked). Legacy admin may have null company.
   - Recommendation: Reject create/list/mutate with 403 when `actor.company_id === null`; no special case.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next build | ✓ | v24.14.0 (dev); Docker uses 20 | — |
| npm | Scripts | ✓ | 11.9.0 | — |
| PostgreSQL | Migration + repo integration tests | ✓ (via `DATABASE_URL` in test) | 15+ hosting | Tests skip if no URL — see skipped suites |
| Vitest | HYG-03 gate | ✓ | 4.1.10 | — |

**Missing dependencies with no fallback:** none for implementation (PostgreSQL required at runtime for app — pre-existing).

**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.ts` (node + jsdom projects) |
| Quick run command | `npx vitest run lib/services/import-mapping.service.unit.test.ts lib/repositories/import-mapping.repo.unit.test.ts -x` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TENANT-01 | Cross-company PUT/DELETE timeline mapping → 403 | route unit | `npx vitest run app/api/import-mapping/route.test.ts -t "403" -x` | ❌ Wave 0 |
| TENANT-01 | Cross-company DELETE bug mapping → 403 | route unit | `npx vitest run app/api/bug-import-mapping/route.test.ts -t "403" -x` | ❌ Wave 0 |
| TENANT-01 | Cross-company DELETE JQL preset → 403 | route unit | `npx vitest run app/api/jira/jql-presets/route.test.ts -t "403" -x` | ❌ Wave 0 |
| TENANT-01 | Sync mappings list scoped per company | route unit | `npx vitest run app/api/jira/sync-mappings/route.test.ts -t "company" -x` | ❌ Wave 0 |
| TENANT-01 | List SQL includes `WHERE company_id = ?` | repo unit | `npx vitest run lib/repositories/import-mapping.repo.unit.test.ts -t "company" -x` | ❌ Wave 0 (extend existing file) |
| TENANT-01 | Same name two companies allowed | repo/service integration | `npx vitest run lib/repositories/import-mapping.repo.integration.test.ts -t "unique" -x` | ❌ Wave 0 |
| TENANT-01 | Duplicate name same company rejected | service unit | `npx vitest run lib/services/import-mapping.service.unit.test.ts -t "Conflict" -x` | ❌ Wave 0 |
| TENANT-01 | Backfill duplicates for 2 companies, no NULL | integration | `npx vitest run lib/db.mapping-tenant-migration.integration.test.ts -x` | ❌ Wave 0 |
| TENANT-01 | Service assert throws ForbiddenError cross-company | service unit | `npx vitest run lib/services/import-mapping.service.unit.test.ts -t "Forbidden" -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** quick run command for touched service/repo test file
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `lib/services/import-mapping.service.ts` + unit tests — timeline + bug tables
- [ ] `lib/services/jira-mapping.service.ts` (or extend jira-config service) + unit tests — JQL presets + sync mappings
- [ ] Migration statements + `lib/db.mapping-tenant-migration.integration.test.ts` — backfill fixture with two companies
- [ ] Extend `test/repo-db.ts` DDL with four mapping tables + `company_id` columns for integration tests
- [ ] Cross-company 403 cases in existing route test files (4 route test files)
- [ ] Update route handlers to import services (six route files)
- [ ] Repo signature change: all list/create/mutate take `companyId`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Existing `withAuth` session gate |
| V3 Session Management | no change | DB-backed sessions unchanged |
| V4 Access Control | yes | Service tenant assert; repo `company_id` filter; 403 on cross-tenant by-id |
| V5 Input Validation | yes | Existing Zod schemas on POST bodies; no new user-controlled SQL |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR via guessed mapping/preset id | Elevation of privilege / Info disclosure | Fetch by id + `company_id` match; 403 not silent success |
| Cross-tenant list leak | Info disclosure | `WHERE company_id = ?` on all lists |
| Mass assignment of `company_id` in POST body | Tampering | Stamp from session only; ignore body `company_id` if present |
| Eviction DELETE cross-tenant | Destruction | Scope DELETE subqueries by `company_id` |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/09-mapping-table-tenant-isolation/09-CONTEXT.md` — locked decisions
- `lib/db.ts:239-504` — table definitions and migrate loop
- `lib/repositories/import-mapping.repo.ts` — global SQL today
- `lib/repositories/jira-config.repo.ts` — JQL preset + sync mapping SQL
- `lib/services/access.ts` — `assertProjectAccess` 403 ordering pattern
- `lib/api-errors.ts` — `ForbiddenError` → 403 wire shape
- `app/api/import-mapping/route.ts`, `app/api/jira/sync-mappings/route.ts` — route→repo direct calls
- `.planning/research/PITFALLS.md` Pitfall 7 — backfill guidance

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` — tenant mapping schema pattern (`company_id NOT NULL` on four tables)
- `.planning/milestones/v1.0-phases/06-access-enforcement-rollout/06-RESEARCH.md` — 403 test matrix conventions
- `app/api/export/ppt/[id]/route.test.ts` — cross-company 403 fixture pattern

### Tertiary (LOW confidence)

- None material — all critical claims verified against live source this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; verified package.json and existing patterns
- Architecture: HIGH — verbatim schema and route/repo reads this session
- Pitfalls: HIGH — Pitfall 7 cross-checked with CONTEXT and global eviction SQL

**Research date:** 2026-08-25  
**Valid until:** 2026-09-25 (stable migration pattern; schema unchanged unless DATA-01 lands)
