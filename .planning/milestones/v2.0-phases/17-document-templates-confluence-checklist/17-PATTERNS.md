# Phase 17: Document Templates & Confluence Checklist - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 24 new/modified files
**Analogs found:** 22 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db-documents.ts` | migration | batch | `lib/db-dashboards.ts` | exact |
| `lib/db-documents.ddl.unit.test.ts` | test | transform | `lib/db-dashboards.ddl.unit.test.ts` | exact |
| `lib/db.ts` | config | batch | `lib/db.ts` (migrateDashboards wire) | exact (extend) |
| `lib/repositories/document-catalog.repo.ts` | repository | CRUD (soft-retire) | `lib/repositories/programs.repo.ts` + `lib/repositories/import-mapping.repo.ts` | role-match |
| `lib/repositories/document-templates.repo.ts` | repository | CRUD (version insert) | `lib/repositories/import-mapping.repo.ts` + `lib/repositories/weekly-reports.repo.ts` (`insertWeeklyReportVersion`) | role-match |
| `lib/repositories/project-document-checklist.repo.ts` | repository | CRUD (idempotent insert) | `lib/repositories/weekly-reports.repo.ts` (`insertShell`) + `lib/repositories/holidays.repo.ts` | exact |
| `lib/services/document-catalog.service.ts` | service | request-response | `lib/services/programs.service.ts` + `lib/services/import-mapping.service.ts` | role-match |
| `lib/services/document-templates.service.ts` | service | request-response | `lib/services/import-mapping.service.ts` | role-match |
| `lib/services/project-document-checklist.service.ts` | service | request-response | `lib/services/weekly-reports.service.ts` (`saveWeeklyReportDraft`) + `lib/services/holidays.service.ts` | exact |
| `lib/services/document-compliance.service.ts` | service | request-response + transform | `lib/services/spec-dashboards.service.ts` (`getPortfolioDashboard` + filters) | exact |
| `lib/services/projects.service.ts` (extend) | service | batch + request-response | `lib/services/projects.service.ts` + `lib/repositories/weekly-periods.repo.ts` (`createPeriodWithShells`) | role-match |
| `lib/fiscal/parse-https-url.ts` (or `lib/validation/parse-https-url.ts`) | utility | transform | `lib/fiscal/iso-date.ts` (`parseIsoDate`) | exact (shape) |
| `lib/services/errors.ts` (extend) | model | — | `SubmitValidationError` (structured payload) | partial |
| `lib/api-errors.ts` (extend) | middleware | request-response | `lib/api-errors.ts` (`SubmitValidationError` branch) | partial |
| `app/api/document-catalog/route.ts` | route | request-response | `app/api/weekly-periods/route.ts` | exact |
| `app/api/document-catalog/[id]/route.ts` | route | request-response | `app/api/programs/[id]/route.ts` (withCpmo + service) | role-match |
| `app/api/document-templates/route.ts` | route | request-response | `app/api/weekly-periods/route.ts` | exact |
| `app/api/document-templates/[id]/route.ts` | route | request-response | `app/api/weekly-periods/route.ts` POST + version replace in service | role-match |
| `app/api/projects/[id]/document-checklist/route.ts` | route | request-response | `app/api/projects/[id]/weekly-reports/route.ts` | exact |
| `app/api/projects/[id]/document-checklist/[itemId]/route.ts` | route | request-response | `app/api/projects/[id]/weekly-reports/[reportId]/route.ts` | exact |
| `app/api/dashboards/document-compliance/route.ts` | route | request-response | `app/api/dashboards/portfolio/route.ts` | exact |
| `lib/services/document-catalog.service.unit.test.ts` | test | — | `lib/services/programs.service.unit.test.ts` | role-match |
| `lib/services/project-document-checklist.service.unit.test.ts` | test | — | `lib/services/weekly-reports.service.unit.test.ts` | exact |
| `lib/services/document-compliance.service.unit.test.ts` | test | — | `lib/services/spec-dashboards.service.unit.test.ts` | exact |
| `lib/repositories/project-document-checklist.repo.test.ts` | test | transform | `lib/repositories/weekly-periods.repo.test.ts` | exact |
| `lib/db-documents.ddl.unit.test.ts` | test | transform | `lib/db-dashboards.ddl.unit.test.ts` | exact |
| `app/api/document-catalog/route.test.ts` | test | — | `app/api/dashboards/portfolio/route.test.ts` | exact |
| `app/api/projects/[id]/document-checklist/[itemId]/route.test.ts` | test | — | `app/api/projects/[id]/weekly-reports/[reportId]/route.test.ts` | exact |

## Pattern Assignments

### `lib/db-documents.ts` (migration, batch)

**Analog:** `lib/db-dashboards.ts` (settings-flag DDL — user-specified analog)

**Flag + DDL export** (db-dashboards.ts lines 1-16):

```typescript
import type { Pool } from 'pg';

export const DOCUMENTS_DDL_FLAG = 'documents_ddl_v1';

export const DOCUMENTS_DDL = [
  `
    CREATE TABLE IF NOT EXISTS document_catalog (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL CHECK (stage IN ('L0','L1','L2','L3','L4','L5','ALL')),
      mandatory BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `,
  // document_templates, project_document_checklist — D-01, D-05, D-06
];
```

**Settings-flag idempotency** — copy `settingsFlagExists` / `writeSettingsFlag` / try-catch from `lib/db-dashboards.ts` lines 18-51:

```typescript
export async function migrateDocuments(pool: Pool): Promise<void> {
  try {
    if (await settingsFlagExists(pool, DOCUMENTS_DDL_FLAG)) return;
    for (const sql of DOCUMENTS_DDL) {
      await pool.query(sql);
    }
    await writeSettingsFlag(pool, DOCUMENTS_DDL_FLAG);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
```

**Never:** physical DELETE helpers on catalog/template/checklist rows (D-11, D-02). Soft-retire via `active=false` / `retired_at`.

---

### `lib/db.ts` (config, batch)

**Analog:** `lib/db.ts` lines 634-637

```typescript
const { migrateDashboards } = await import('./db-dashboards');
await migrateDashboards(pool);
// Phase 17: document catalog / templates / checklist tables
const { migrateDocuments } = await import('./db-documents');
await migrateDocuments(pool);
await backfillWeightedCompletion(pool);
```

Wire **after** `migrateDashboards`, **before** `backfillWeightedCompletion` (D-11).

---

### `lib/repositories/document-catalog.repo.ts` (repository, company-scoped CRUD)

**Analog (company list + insert):** `lib/repositories/programs.repo.ts` lines 7-50

```typescript
export async function listDocumentCatalog(companyId: number) {
  const db = await getDb();
  return db.all(
    `SELECT id, company_id, name, purpose, stage, mandatory, active, created_at, updated_at
     FROM document_catalog
     WHERE company_id = ?
     ORDER BY name`,
    companyId,
  );
}

export async function insertDocumentCatalog(companyId: number, body: Record<string, unknown>) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO document_catalog (company_id, name, purpose, stage, mandatory, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    companyId,
    body.name,
    body.purpose ?? '',
    body.stage,
    body.mandatory ?? false,
    body.active ?? true,
  );
  return db.get('SELECT * FROM document_catalog WHERE id = ?', r.lastInsertRowid);
}
```

**Analog (soft-retire, no DELETE):** `lib/repositories/risks.repo.ts` deactivate pattern — use `active = FALSE, updated_at = now()` instead of `deactivated_at` on catalog rows (D-02).

**Analog (company-scoped update WHERE):** `lib/repositories/import-mapping.repo.ts` lines 46-60 — always filter `company_id = ?` on writes.

---

### `lib/repositories/document-templates.repo.ts` (repository, version insert)

**Analog (company-scoped create):** `lib/repositories/import-mapping.repo.ts` lines 37-44

**Analog (monotonic version + retire previous):** compose from weekly version insert + soft retire:

```typescript
export async function insertTemplateVersion(input: {
  catalogId: number;
  companyId: number;
  name: string;
  documentType: string;
  version: number;
  effectiveDate: string;
  guidance: string;
  templateUrl: string | null;
}) {
  const db = await getDb();
  await db.run(
    `UPDATE document_templates SET retired_at = now()
     WHERE catalog_id = ? AND company_id = ? AND retired_at IS NULL`,
    input.catalogId,
    input.companyId,
  );
  const r = await db.run(
    `INSERT INTO document_templates
       (catalog_id, company_id, name, document_type, version, effective_date, guidance, template_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.catalogId,
    input.companyId,
    input.name,
    input.documentType,
    input.version,
    input.effectiveDate,
    input.guidance,
    input.templateUrl,
  );
  return db.get('SELECT * FROM document_templates WHERE id = ?', r.lastInsertRowid);
}
```

**Effective version query** (D-05): `effective_date <= CURRENT_DATE AND retired_at IS NULL ORDER BY version DESC LIMIT 1`.

**Do not** store project checklist bytes here — template library only (D-05, D-07).

---

### `lib/repositories/project-document-checklist.repo.ts` (repository, idempotent generate)

**Analog (idempotent row insert):** `lib/repositories/weekly-reports.repo.ts` `insertShell` lines 67-80

```typescript
export async function insertChecklistRowIfMissing(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { id: number }[] }> },
  projectId: number,
  catalogId: number,
): Promise<{ id: number } | undefined> {
  const res = await client.query(
    `INSERT INTO project_document_checklist (project_id, catalog_id, status)
     VALUES ($1, $2, 'none')
     ON CONFLICT (project_id, catalog_id) DO NOTHING
     RETURNING id`,
    [projectId, catalogId],
  );
  return res.rows[0];
}
```

**Analog (project-scoped list):** `lib/repositories/holidays.repo.ts` lines 11-14 — filter `project_id = ? ORDER BY ...`.

**Analog (PATCH fields):** `lib/repositories/weekly-reports.repo.ts` `updateWeeklyReportDraft` — fixed-column UPDATE, no allowlist from body keys.

**Unique constraint:** `(project_id, catalog_id)` required for skip-existing generate (D-04).

---

### Generate on `createProject` / stage change

**Analog (batch insert after parent write):** `lib/repositories/weekly-periods.repo.ts` `createPeriodWithShells` lines 120-163

```typescript
// Inside createProject service after createProjectRepo succeeds (D-04):
const project = await createProjectRepo(actor.company_id, fields);
await generateProjectChecklist(Number(project.id), {
  companyId: actor.company_id!,
  stage: String(project.stage ?? fields.stage ?? ''),
});
return { ...project, warnings };
```

**Analog (transaction + loop):** mirror `withPgTransaction` / `runInTransaction` from weekly-periods.repo.ts lines 137-161:

```typescript
export async function generateProjectChecklist(
  projectId: number,
  opts: { companyId: number; stage: string },
) {
  const catalogRows = await listActiveCatalogForStage(opts.companyId, opts.stage);
  await runInTransaction(async (client) => {
    for (const row of catalogRows) {
      await insertChecklistRowIfMissing(client, projectId, row.id);
    }
  });
}
```

**Stage PATCH hook** — extend `lib/services/projects.service.ts` `updateProject` (lines 97-162) **before** `updateProjectRepo` when `stage` changes:

1. Load mandatory incomplete items for **current** stage (pre-change).
2. If any and body lacks `acknowledge_incomplete_mandatory: true` → throw structured conflict (D-09).
3. After successful update → `generateProjectChecklist` for **new** stage (D-04).

**Do not** delete prior-stage checklist rows (D-04).

---

### `lib/fiscal/parse-https-url.ts` (utility, URL validation)

**Analog:** `lib/fiscal/iso-date.ts` `parseIsoDate` lines 1-8

```typescript
import { ValidationError } from '@/lib/services/errors';

export function parseHttpsUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.startsWith('https://')) {
    throw new ValidationError(`${field} must be an https:// URL`, field);
  }
  if (value.startsWith('http://')) {
    throw new ValidationError(`${field} must be an https:// URL`, field);
  }
  return value.trim();
}
```

**Apply in checklist PATCH service** (D-07): empty URL allowed only when status is `none` or `drafting`; `approved` / `pending_approval` require non-empty https URL.

**Reject binaries** — never accept `multipart/form-data`; use route `withProjectAccess` + Zod schema on JSON body only (D-07). Do **not** use `{ rawBody: true }` unless rejecting non-JSON at route boundary.

---

### `lib/services/document-catalog.service.ts` (service, CPMO catalog)

**Analog:** `lib/services/programs.service.ts` lines 82-88 + `lib/services/import-mapping.service.ts` lines 40-51

```typescript
export async function createDocumentCatalogItem(actor: AccessActor, body: Record<string, unknown>) {
  assertCompanyWrite(actor);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new ValidationError('Name required', 'name');
  // stage L0-L5|ALL validation
  const row = await insertDocumentCatalogRepo(actor.company_id!, body);
  if (body.apply_to_in_flight === true) {
    await applyCatalogToInFlightProjects(actor.company_id!, row.id, row.stage);
  }
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'document_catalog',
    entity_id: String(row.id),
    action: 'create',
    before: null,
    after: { name: row.name, stage: row.stage, mandatory: row.mandatory },
  });
  return row;
}
```

**In-flight apply** (D-03) — explicit on write when `apply_to_in_flight=true`; query Active projects matching stage/ALL, call `insertChecklistRowIfMissing` per project (reuse generate repo helper).

**Reads for PM** — company match via `assertProjectAccess` on linked project routes; catalog GET for CPMO uses `assertCompanyWrite` (D-12).

---

### `lib/services/project-document-checklist.service.ts` (service, PM PATCH)

**Analog (read):** `lib/services/holidays.service.ts` lines 10-13

```typescript
export async function listProjectDocumentChecklist(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listChecklistByProjectRepo(Number(projectId));
}
```

**Analog (write + validation):** `lib/services/weekly-reports.service.ts` `saveWeeklyReportDraft` lines 335-368

```typescript
export async function patchChecklistItem(
  projectId: number | string,
  itemId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  rejectBinaryFields(body); // D-07: file, data URL, base64 keys → ValidationError

  const status = String(body.status ?? '');
  const confluenceUrl =
    body.confluence_url === undefined || body.confluence_url === null || body.confluence_url === ''
      ? null
      : parseHttpsUrl(body.confluence_url, 'confluence_url');

  if (status === 'approved') {
    if (!body.approved_at) throw new ValidationError('approved_at required', 'approved_at');
    if (!body.approved_by) throw new ValidationError('approved_by required', 'approved_by');
  }
  if (status === 'not_applicable' && !String(body.na_reason ?? '').trim()) {
    throw new ValidationError('na_reason required', 'na_reason');
  }
  if (confluenceUrl === null && !['none', 'drafting'].includes(status)) {
    throw new ValidationError('confluence_url required for this status', 'confluence_url');
  }

  const updated = await updateChecklistItemRepo(Number(projectId), Number(itemId), { ... });
  await auditLog({ entity_type: 'document_checklist', action: 'status_change', ... });
  return updated;
}
```

**Viewer 403 on mutators** — `assertProjectWriteAccess` already blocks viewer-only (D-06).

---

### Stage-change mandatory warning (409)

**Analog (structured service error):** `SubmitValidationError` in `lib/services/errors.ts` lines 46-55 — add sibling error with payload:

```typescript
export class MandatoryIncompleteError extends Error {
  readonly code = 'mandatory_incomplete' as const;
  readonly items: Array<{ id: number; catalog_name: string; status: string }>;

  constructor(items: MandatoryIncompleteError['items']) {
    super('Mandatory checklist items incomplete');
    this.name = 'MandatoryIncompleteError';
    this.items = items;
  }
}
```

**Map in `lib/api-errors.ts`** (after SubmitValidationError branch):

```typescript
if (e instanceof MandatoryIncompleteError) {
  return NextResponse.json({ code: e.code, items: e.items }, { status: 409 });
}
```

**Hook site:** `updateProject` in `projects.service.ts` when `fields.stage` differs from `current.stage` (D-09).

---

### `lib/services/document-compliance.service.ts` (service, CPMO compliance listing)

**Analog:** `lib/services/spec-dashboards.service.ts` `getPortfolioDashboard` + `buildPortfolioDashboard` lines 79-120

```typescript
export async function getDocumentCompliance(actor: AccessActor, query: ComplianceQuery) {
  assertCompanyWrite(actor);
  const rawProjects = await listProjects(actor.company_id!);
  const enriched = await enrichProjectListRows(rawProjects as Record<string, unknown>[]);
  const filtered = applyDashboardFilters(enriched, parseComplianceFilters(query)); // reuse stage/status/rag/program keys (D-10)

  const rows = [];
  for (const p of filtered) {
    const mandatory = await listMandatoryChecklistForProject(p.id);
    const status = computeProjectCompliance(mandatory); // compliant | not_compliant | not_applicable (D-10)
    rows.push({ project_id: p.id, project_code: p.project_code, compliance: status, ... });
  }
  return { filters: query, projects: rows };
}
```

**Reuse** `listProjects`, `applyDashboardFilters`, `parseDashboardFilters` from Phase 16 — do not reimplement filter keys (D-10).

---

### `app/api/document-catalog/route.ts` (route, CPMO catalog)

**Analog:** `app/api/weekly-periods/route.ts` lines 1-16

```typescript
import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { createDocumentCatalogItem, listDocumentCatalog } from '@/lib/services/document-catalog.service';

export const GET = withCpmo(async (_req, { actor }) =>
  NextResponse.json(await listDocumentCatalog(actor)),
);

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const row = await createDocumentCatalogItem(actor, body as Record<string, unknown>);
    return NextResponse.json(row, { status: 201 });
  },
  { schema: documentCatalogSchema },
);
```

Catalog/templates/compliance writes: `withCpmo` + service `assertCompanyWrite` (D-12). Null-company seed admin → 403 (landmine).

---

### `app/api/projects/[id]/document-checklist/[itemId]/route.ts` (route, PM PATCH)

**Analog:** `app/api/projects/[id]/weekly-reports/[reportId]/route.ts` lines 1-27

```typescript
import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { patchChecklistItem } from '@/lib/services/project-document-checklist.service';
import { checklistPatchSchema } from './schema';

export const GET = withProjectAccess<{ id: string; itemId: string }>(
  async (_req, { params, actor }) =>
    NextResponse.json(await getChecklistItem(params.id, actor, params.itemId)),
);

export const PATCH = withProjectAccess<{ id: string; itemId: string }>(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await patchChecklistItem(params.id, params.itemId, actor, body as Record<string, unknown>),
    ),
  { schema: checklistPatchSchema },
);
```

**No POST** for new checklist rows — generation is server-side only (D-04). Reject file upload bodies at schema + service (D-07).

List route analog: `app/api/projects/[id]/weekly-reports/route.ts` lines 1-7.

---

### `app/api/dashboards/document-compliance/route.ts` (route, CPMO compliance)

**Analog:** `app/api/dashboards/portfolio/route.ts` lines 1-7

```typescript
export const GET = withCpmo(async (req, { actor }) => {
  const query = Object.fromEntries(req.nextUrl.searchParams);
  return NextResponse.json(await getDocumentCompliance(actor, query));
});
```

---

### Test files

#### `lib/services/project-document-checklist.service.unit.test.ts`

**Analog:** `lib/services/weekly-reports.service.unit.test.ts`

```typescript
vi.mock('./access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/repositories/project-document-checklist.repo', () => ({ ... }));
vi.mock('./audit.service', () => ({ auditLog: vi.fn() }));
```

Cases:
- Viewer PATCH → ForbiddenError
- `http://` URL → ValidationError
- `approved` without `approved_at` / `approved_by` → ValidationError
- `not_applicable` without `na_reason` → ValidationError
- Body with `file` / base64 field → ValidationError (D-07)
- Mandatory + approved → compliant helper returns true (D-08)

#### `lib/repositories/project-document-checklist.repo.test.ts`

**Analog:** `lib/repositories/weekly-periods.repo.test.ts` lines 1-44

```typescript
describe.skipIf(!hasTestDb)('project-document-checklist.repo', () => {
  beforeAll(async () => {
    await setupRepoTables();
    await migrateDocuments(testPool());
  });
});
```

Assert `ON CONFLICT (project_id, catalog_id) DO NOTHING` — second generate does not duplicate.

#### `app/api/projects/[id]/document-checklist/[itemId]/route.test.ts`

**Analog:** `app/api/projects/[id]/weekly-reports/[reportId]/route.test.ts` lines 1-80

401 no session; 403 viewer on PATCH; 200 pm PATCH; mock `projectAccessRow` + `hasActivePmAssignment`.

#### `app/api/document-catalog/route.test.ts`

**Analog:** `app/api/dashboards/portfolio/route.test.ts`

401 / 403 pm / 403 viewer / 200 cpmo matrix.

#### `lib/db-documents.ddl.unit.test.ts`

**Analog:** `lib/db-dashboards.ddl.unit.test.ts` lines 10-36

Assert `document_catalog`, `document_templates`, `project_document_checklist` DDL fragments; wire order after `migrateDashboards`.

---

## Shared Patterns

### assertCompanyWrite (catalog / templates / compliance)

**Source:** `lib/services/access.ts` lines 125-129
**Apply to:** catalog CRUD, template version insert, compliance GET

```typescript
export function assertCompanyWrite(actor: AccessActor): void {
  if (!isCpmo(actor)) throw new ForbiddenError();
  if (actor.company_id === null) throw new ForbiddenError();
}
```

---

### withCpmo routes (catalog / templates / compliance)

**Source:** `lib/http/with-role.ts` lines 26-34; `app/api/weekly-periods/route.ts`
**Apply to:** `/api/document-catalog`, `/api/document-templates`, `/api/dashboards/document-compliance`

```typescript
export const POST = withCpmo(
  async (_req, { actor, body }) => NextResponse.json(await createX(actor, body), { status: 201 }),
  { schema: xSchema },
);
```

---

### withProjectAccess + assertProjectWriteAccess (checklist)

**Source:** `lib/http/with-project-access.ts` lines 30-56; `lib/services/access.ts` lines 131-138
**Apply to:** `/api/projects/[id]/document-checklist/*`

```typescript
export const PATCH = withProjectAccess<{ id: string; itemId: string }>(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await patchChecklistItem(params.id, params.itemId, actor, body)),
  { schema: checklistPatchSchema },
);
```

GET uses `assertProjectAccess` only (viewer allowed). PATCH uses `assertProjectWriteAccess` inside service.

---

### parseIsoDate-shaped validators

**Source:** `lib/fiscal/iso-date.ts` lines 3-8
**Apply to:** `parseHttpsUrl`, optional `parseChecklistStatus` enum guard

```typescript
export function parseIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${field} must be YYYY-MM-DD`, field);
  }
  return value;
}
```

---

### auditLog on mutations

**Source:** `lib/services/audit.service.ts` lines 5-8; `lib/repositories/audit.repo.ts` lines 13-25
**Apply to:** catalog create/update, template version insert, checklist status change, stage-change ack (D-14)

```typescript
await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'document_checklist',
  entity_id: String(itemId),
  action: 'status_change',
  before: { status: prev.status },
  after: { status: next.status, confluence_url: next.confluence_url },
});
```

---

### Dashboard filter reuse (compliance listing)

**Source:** `lib/services/spec-dashboards.service.ts` — `parseDashboardFilters` / `applyDashboardFilters`
**Apply to:** document compliance GET filters (stage, status, rag, program) (D-10)

---

### describe.skipIf(!hasTestDb) repo integration

**Source:** `lib/repositories/weekly-periods.repo.test.ts` line 20
**Apply to:** checklist + catalog repo tests

```typescript
describe.skipIf(!hasTestDb)('project-document-checklist.repo', () => {
  beforeAll(async () => {
    await setupRepoTables();
    await migrateDocuments(testPool());
  });
});
```

Prefer `migrateDocuments(testPool())` in `beforeAll` over hand-copying DDL into `test/repo-db.ts`.

---

### serviceErrorResponse (HTTP mapping)

**Source:** `lib/api-errors.ts` lines 42-62
**Apply to:** all routes via `withAuth` / `withCpmo` / `withProjectAccess` catch tail

Extend with `MandatoryIncompleteError` → 409 `{ code, items }` (D-09).

---

## Anti-Patterns / Landmines (do NOT analogize)

| Surface | Why forbidden | Verified location |
|---------|---------------|-------------------|
| `lib/repositories/documents.repo.ts` | v1 project `documents` table is a free-form content_json / status_report diary — **not** spec checklist (D-01, CONTEXT landmine) | `lib/repositories/documents.repo.ts` lines 1-63 |
| `app/api/projects/[id]/documents/route.ts` | v1 nested document upsert/upload surface — leave unchanged; do not route checklist through it | `app/api/projects/[id]/documents/route.ts` lines 1-34 |
| `lib/services/documents.service.ts` | Same v1 file-dump semantics | `lib/services/documents.service.ts` |
| Checklist binary / multipart upload | Project checklist evidence is Confluence HTTPS URL only (D-07) | — |
| Physical DELETE on catalog/template/checklist | Soft-retire / history retention (D-11) | — |
| CASL / D-23 leftover re-gate | Explicitly out of scope (D-12) | — |
| Prisma migrations | Settings-flag DDL in `lib/db-documents.ts` only (D-11) | — |

Phase 17 must **not** mutate v1 `/api/projects/[id]/documents` or store checklist rows in the legacy `documents` table.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `MandatoryIncompleteError` + 409 `{ code, items }` | model | request-response | No existing ConflictError carries structured payload — extend errors/api-errors using SubmitValidationError shape (D-09) |
| Template effective-version selector | repository | transform | Monotonic version + `retired_at` is new; compose from import-mapping create + weekly version insert |
| In-flight catalog apply query | service | batch | No existing "apply master row to all Active projects" helper — compose from `listProjects` + stage filter + `insertChecklistRowIfMissing` |
| Compliance per-project rollup | utility | transform | Business rules for compliant / not_compliant / not_applicable are new (D-08, D-10) — pure-fn shape only from dashboard KPI helpers |

---

## Metadata

**Analog search scope:** `lib/db-dashboards.ts`, `lib/db-fiscal-budget.ts`, `lib/db.ts`, `lib/db-raid-masters.ts`, `lib/repositories/programs.repo.ts`, `lib/repositories/import-mapping.repo.ts`, `lib/repositories/weekly-periods.repo.ts`, `lib/repositories/weekly-reports.repo.ts`, `lib/repositories/holidays.repo.ts`, `lib/repositories/documents.repo.ts`, `lib/repositories/projects.repo.ts`, `lib/repositories/risks.repo.ts`, `lib/services/programs.service.ts`, `lib/services/import-mapping.service.ts`, `lib/services/weekly-reports.service.ts`, `lib/services/holidays.service.ts`, `lib/services/projects.service.ts`, `lib/services/spec-dashboards.service.ts`, `lib/services/access.ts`, `lib/services/audit.service.ts`, `lib/services/errors.ts`, `lib/fiscal/iso-date.ts`, `lib/api-errors.ts`, `lib/http/with-role.ts`, `lib/http/with-project-access.ts`, `app/api/weekly-periods/route.ts`, `app/api/dashboards/portfolio/route.ts`, `app/api/projects/[id]/weekly-reports/route.ts`, `app/api/projects/[id]/weekly-reports/[reportId]/route.ts`, `app/api/projects/[id]/documents/route.ts`, `lib/db-dashboards.ddl.unit.test.ts`, `lib/repositories/weekly-periods.repo.test.ts`, `app/api/projects/[id]/weekly-reports/[reportId]/route.test.ts`, `test/repo-db.ts`, `test/db.ts`
**Files scanned:** 32
**Pattern extraction date:** 2026-08-26

## PATTERNS COMPLETE
