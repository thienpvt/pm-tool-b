# Phase 17: Document Templates & Confluence Checklist - Research

**Researched:** 2026-08-26
**Domain:** Parallel CPMO document catalog + versioned templates + per-project Confluence-link checklist (no project binary uploads) — separate from v1 `documents` JSON diary
**Confidence:** HIGH

## Summary

Phase 17 delivers a **parallel product surface** for spec document governance. v1 `documents` stores per-project JSON blobs (`content_json TEXT`) via `upsertDocument` — status reports, project report templates, Word export payloads — **not** a stage checklist with compliance semantics [VERIFIED: lib/repositories/documents.repo.ts:17-63] [VERIFIED: lib/db.ts:229-237]. That table and `/api/projects/[id]/documents` must remain untouched [D-01].

The spec checklist lives in new tables `document_catalog`, `document_templates`, and `project_document_checklist`, with routes under `/api/document-catalog`, `/api/document-templates`, `/api/projects/[id]/document-checklist`, and `/api/dashboards/document-compliance` (or `/api/document-compliance`). PM evidence is **HTTPS Confluence links only** — reject multipart, file fields, and data-URL blobs on checklist mutators [D-07]. CPMO template library may store an optional **HTTPS URL pointer** on `document_templates`; the repo has **no BYTEA column anywhere** and v1 `documents` already stores large JSON in TEXT — prefer URL-only template storage [D-05, D-14 discretion].

Checklist rows generate on `createProject` success and on project `stage` PATCH when stage value changes: every **active** catalog item whose `stage` is `ALL` or equals the project's new stage, skipping existing `(project_id, catalog_id)` pairs; prior-stage rows stay [D-04]. Hook inside `lib/services/projects.service.ts` after repo write (or dedicated `generateProjectChecklist` called from there) [VERIFIED: lib/services/projects.service.ts:49-88, 97-163] [VERIFIED: lib/repositories/projects.repo.ts:140-194].

Stage change with incomplete **mandatory** items for the **current (pre-change) stage** returns **409** `{ code: 'mandatory_incomplete', items: [...] }` unless body includes `acknowledge_incomplete_mandatory: true` [D-09]. Existing `ConflictError` maps only to `{ error: message }` [VERIFIED: lib/api-errors.ts:58-60] — planner must add a structured conflict error (e.g. `MandatoryIncompleteError`) and extend `serviceErrorResponse`.

Schema DDL follows the settings-flag pattern in new `lib/db-documents.ts`, invoked from `getDb()` **after** `migrateDashboards` [VERIFIED: lib/db.ts:633-636] [VERIFIED: lib/db-dashboards.ts:3-51]. Auth: catalog/templates/compliance = `withCpmo` + `assertCompanyWrite`; checklist PATCH = `assertProjectWriteAccess`; checklist GET = `assertProjectAccess` [VERIFIED: lib/services/access.ts:79-138] [VERIFIED: lib/http/with-role.ts:26-34]. Compliance filters reuse dashboard keys (`stage`, `status`, `rag`, `program`) [VERIFIED: lib/dashboards/filter-schema.ts:3-15] [D-10].

**Primary recommendation:** Add `lib/services/document-catalog.service.ts`, `document-templates.service.ts`, `project-document-checklist.service.ts`, `document-compliance.service.ts`, pure helpers in `lib/documents/`, `lib/db-documents.ts` + repos, structured HTTPS URL helper `parseHttpsUrl`, extend `projects.service` for generate + mandatory warning, and gate with Vitest 4 service + route tests (`workflow.ui_phase: false`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Decision IDs D-01..D-14.

### Parallel surface

- **D-01:** New tables `document_catalog`, `document_templates`, `project_document_checklist`. Do **not** store spec checklist rows in v1 `documents` if that table is a project file dump. New routes under `/api/document-catalog`, `/api/document-templates`, `/api/projects/[id]/document-checklist`, `/api/dashboards/document-compliance` (or `/api/document-compliance`). Leave v1 documents routes unchanged. — **Reversibility:** costly.

### Catalog (DOC-01, DOC-02)

- **D-02:** Catalog rows are company-scoped (`company_id`). Fields: name, purpose, `stage` (L0–L5 or `ALL`), `mandatory` boolean, `active` boolean. Soft-retire via `active=false` — no physical DELETE.
- **D-03:** Creating a catalog item with `apply_to_in_flight=true` inserts checklist rows for existing in-flight projects (status Active, any stage matching catalog.stage or ALL) that do not already have that catalog_id. `false` (default) only affects future generate. Changing catalog mandatory/active similarly: in-flight apply is explicit on the write, not implicit.
- **D-04:** On `createProject` success and on project `stage` PATCH, generate checklist rows for every **active** catalog item whose stage is `ALL` or equals the project's new stage, skipping catalog_ids already on the project. Prior-stage checklist rows stay (no delete). Generation is server-side in the same service transaction as the project write when practical; otherwise immediately after in `createProject` / `updateProject` service.

### Templates (DOC-03)

- **D-05:** Templates belong to a catalog item (or company-level type). Fields: name, document_type, version (monotonic integer per catalog item), effective_date, guidance, optional storage pointer. **Replace** = insert a new version row and mark previous `retired_at`. PMs list the currently effective version by default (`effective_date <= CURRENT_DATE` and `retired_at IS NULL`, latest version). Old versions remain GET-able by id for history. Template **file** may be stored as a CPMO-uploaded blob **only on the template table** (company template library), never on the project checklist. If storing bytes is heavy, store a template Confluence/HTTPS URL instead — planner picks one already-in-repo approach; **project checklist still cannot accept binaries**.

### Checklist & compliance (DOC-04, DOC-05, DOC-06)

- **D-06:** Checklist row: catalog_id, project_id, status `none|drafting|pending_approval|approved|not_applicable`, confluence_url (nullable text), approved_at, approved_by, na_reason, notes. PM with `assertProjectWriteAccess` may PATCH. Viewer 403 on mutators. GET `assertProjectAccess`.
- **D-07:** Reject checklist POST/PATCH bodies that include a file, `multipart/form-data`, or a data-URL/base64 blob field. `confluence_url` must be `https://` (http rejected). Empty URL allowed only when status is none/drafting.
- **D-08:** Status `approved` requires `approved_at` date and `approved_by` (user id or non-empty name). Status `not_applicable` requires non-empty `na_reason`. Mandatory catalog + approved → that item is compliant. Mandatory + not_applicable → not_applicable (not a compliance failure). Mandatory + any other status → not compliant. Optional catalog items do not fail project compliance.
- **D-09:** Stage change: if any **mandatory** checklist item for the **current** (pre-change) stage is not approved and not N/A, the PATCH returns **409** with `{ code: 'mandatory_incomplete', items: [...] }` unless the body includes `acknowledge_incomplete_mandatory: true`. That is the CPMO warning (DOC-06). After ack, stage still changes and new-stage rows generate.
- **D-10:** CPMO GET compliance: company-scoped project list with `compliant | not_compliant | not_applicable` (project-level: all mandatory items approved → compliant; any mandatory neither approved nor N/A → not_compliant; all remaining mandatory are N/A and none pending → not_applicable). Filters: stage, status, rag, program — reuse dashboard filter keys where they exist. `withCpmo` + `assertCompanyWrite`.

### Schema, authz, UI

- **D-11:** Settings-flag DDL `lib/db-documents.ts` from `getDb()` **after** `migrateDashboards`. No Prisma. No physical DELETE of catalog/template/checklist rows.
- **D-12:** Writes: catalog/templates/compliance = `withCpmo` + `assertCompanyWrite`. Checklist mutators = `assertProjectWriteAccess`. Reads: catalog/templates visible to project-access PMs (company match); Viewer may GET checklist but not PATCH.
- **D-13:** `workflow.ui_phase` false. Server tests are the gate. Thin pages optional, not must_haves.
- **D-14:** No CASL. Do not re-gate D-23 leftover ops/admin. Incremental `auditLog` on catalog create/update, template version insert, checklist status change, stage-change ack.

### Claude's Discretion

- Whether templates attach to catalog_id vs a separate document_type enum.
- Whether template bytes live in Postgres BYTEA vs a URL-only template (prefer URL-only if v1 already struggles with blobs; otherwise BYTEA on template table only).
- Exact generate hook inside `createProject` vs a dedicated `generateProjectChecklist(projectId)` called from the service.

### Deferred Ideas (OUT OF SCOPE)

- Full append-only audit coverage — Phase 18
- Pixel UI for catalog admin
- Migrating v1 documents rows into the checklist
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-01 | CPMO maintains document catalog (name, purpose, stage, mandatory, active) + apply-to-in-flight flag | `document_catalog` table + `/api/document-catalog` CRUD; `apply_to_in_flight` on write triggers backfill [D-02, D-03] |
| DOC-02 | Project create / stage change generates checklist; prior-stage items remain | Hook `createProject` / `updateProject` stage branch; `generateProjectChecklist` idempotent insert [D-04]; do not touch v1 `documents` [D-01] |
| DOC-03 | CPMO upload/replace/retire templates; effective version default for PMs | `document_templates` version rows + `retired_at`; effective query `effective_date <= CURRENT_DATE AND retired_at IS NULL ORDER BY version DESC` [D-05]; URL-only storage recommended |
| DOC-04 | PM updates checklist metadata + Confluence HTTPS link + status; no project binaries | Checklist PATCH schema + service rejects file/multipart/base64 [D-07]; `parseHttpsUrl` helper [D-07] |
| DOC-05 | Approved requires date+approver; N/A requires reason; mandatory approved = compliant | Status transition validators in checklist service [D-08]; compliance pure helper |
| DOC-06 | CPMO portfolio compliance listing + stage-change mandatory warning | `/api/dashboards/document-compliance` + filter reuse [D-10]; `MandatoryIncompleteError` 409 on stage PATCH [D-09] |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Document catalog CRUD (CPMO) | API / Backend (`document-catalog.service`) | Database (`document_catalog`) | Company-scoped; soft-retire only [D-02, D-11] |
| Template versioning (CPMO) | API / Backend (`document-templates.service`) | Database (`document_templates`) | Replace = new row + retire previous [D-05] |
| Checklist generation on project create/stage | API / Backend (`projects.service` + checklist generator) | Database (`project_document_checklist`) | Same transaction when practical [D-04] |
| Checklist PATCH (PM Confluence link + status) | API / Backend (`project-document-checklist.service`) | — | `assertProjectWriteAccess`; no binaries [D-06, D-07] |
| Mandatory-incomplete stage warning | API / Backend (`projects.service` pre-stage guard) | Database (checklist read) | 409 before stage write unless ack [D-09] |
| Portfolio compliance listing | API / Backend (`document-compliance.service`) | Database (join catalog + checklist + projects) | CPMO filters [D-10] |
| HTTPS URL validation | API / Backend (`lib/documents/https-url.ts`) | — | Analog to `parseIsoDate` [VERIFIED: lib/fiscal/iso-date.ts:3-8] |
| Multipart/binary rejection | API / Backend (route schema + Content-Type guard) | — | JSON-only checklist routes; never `rawBody: true` [VERIFIED: lib/http/with-auth.ts:67-70] |
| Schema DDL | Database (`migrateDocuments` on boot) | — | After `migrateDashboards` [VERIFIED: lib/db.ts:635-636] [D-11] |
| Incremental audit | API / Backend (`auditLog`) | Database (`audit_logs`) | Catalog/template/checklist/ack [D-14] |
| v1 project documents (unchanged) | API / Backend (existing `documents.service`) | Database (`documents.content_json`) | **Landmine** — do not reuse for checklist [D-01] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | ^8.20.0 [VERIFIED: package.json:26] | PostgreSQL pool | Existing `getDb()` client |
| `zod` | ^4.4.3 [VERIFIED: package.json:35] | Route body/query validation | Matches existing API schema pattern |
| `vitest` | 4.1.10 [VERIFIED: package.json:49] | Service + route tests | Phase gate (D-13); TDD enabled |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `withCpmo` | — | CPMO route wrapper | Catalog, templates, compliance routes [VERIFIED: lib/http/with-role.ts:26-34] |
| Existing `withProjectAccess` | — | Project-scoped wrapper | Checklist nested under project [VERIFIED: app/api/projects/[id]/route.ts:18-22] |
| Existing `assertCompanyWrite` | — | CPMO company write gate | Catalog/templates/compliance [VERIFIED: lib/services/access.ts:126-128] |
| Existing `parseIsoDate` pattern | — | Date field validation | Model `parseHttpsUrl` + approved_at dates [VERIFIED: lib/fiscal/iso-date.ts:3-8] |
| Existing `dashboardFiltersSchema` keys | — | Compliance filter subset | `stage`, `status`, `rag`, `program` [VERIFIED: lib/dashboards/filter-schema.ts:3-15] |
| Existing `auditLog` | — | Incremental audit | Catalog/template/checklist mutations [VERIFIED: lib/services/audit.service.ts:6-8] |
| Existing `runInTransaction` | — | Atomic project + checklist generate | When generation must share transaction [VERIFIED: lib/db.ts:602-606] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New tables + routes | Reuse v1 `documents` rows | **Rejected** — v1 is JSON diary/upsert-by-type, not catalog+compliance [VERIFIED: lib/repositories/documents.repo.ts:6-8, 51-63] |
| BYTEA template blob | `template_url TEXT` HTTPS only | **Recommended** — no BYTEA in repo; v1 already uses TEXT JSON [VERIFIED: lib/db.ts:229-237] |
| Extend `ConflictError` message only | New `MandatoryIncompleteError` with `code` + `items` | **Required** — D-09 contract exceeds `{ error }` [VERIFIED: lib/api-errors.ts:58-60] |
| `rawBody: true` + form upload for templates | JSON body with `template_url` | **Recommended for checklist** — D-07 forbids multipart on checklist; template upload can be URL POST only |
| Prisma migrations | Settings-flag DDL module | **Rejected** — D-11; follow `lib/db-dashboards.ts` [VERIFIED: lib/db-dashboards.ts:34-51] |

**Installation:** No new packages. Use existing dependencies only.

**Version verification:** All libraries already in `package.json` — no new installs this phase.

## Package Legitimacy Audit

> Phase 17 installs **no new external packages**.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (none new) | — | — | No install step |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart TD
  CPMO[CPMO client] -->|CRUD| CAT[/api/document-catalog]
  CPMO -->|CRUD| TPL[/api/document-templates]
  CPMO -->|GET| COMP[/api/dashboards/document-compliance]
  PM[PM client] -->|GET/PATCH JSON| CHK[/api/projects/id/document-checklist]

  CAT --> WC[withCpmo + assertCompanyWrite]
  TPL --> WC
  COMP --> WC
  CHK --> WPA[withProjectAccess + assertProjectWriteAccess on PATCH]

  PROJ_POST[POST /api/projects] --> PS[projects.service createProject]
  PROJ_PATCH[PATCH /api/projects/id] --> PU[projects.service updateProject]
  PS --> GEN[generateProjectChecklist]
  PU --> GUARD{stage changing?}
  GUARD -->|yes| MAND{mandatory incomplete?}
  MAND -->|yes, no ack| E409[409 mandatory_incomplete]
  MAND -->|ack or clean| UPD[updateProjectRepo]
  GUARD -->|no| UPD
  UPD --> GEN

  GEN --> DB[(project_document_checklist)]
  CAT --> DB2[(document_catalog)]
  TPL --> DB3[(document_templates)]
  COMP --> DB2
  COMP --> DB
  COMP --> PROJ[(projects live master)]

  V1DOC[/api/projects/id/documents v1] -.->|unchanged| V1T[(documents content_json)]
  AUD[auditLog incremental] --> AL[(audit_logs)]
```

### Recommended Project Structure

```
lib/
├── db-documents.ts                         # settings-flag DDL (D-11)
├── db-documents.ddl.unit.test.ts
├── documents/
│   ├── https-url.ts                        # parseHttpsUrl (D-07)
│   ├── https-url.unit.test.ts
│   ├── checklist-status.ts                 # status enum + transition rules (D-08)
│   ├── checklist-status.unit.test.ts
│   ├── compliance.ts                       # project-level compliant/not_compliant/not_applicable (D-08, D-10)
│   └── compliance.unit.test.ts
├── repositories/
│   ├── document-catalog.repo.ts
│   ├── document-templates.repo.ts
│   └── project-document-checklist.repo.ts
├── services/
│   ├── document-catalog.service.ts
│   ├── document-templates.service.ts
│   ├── project-document-checklist.service.ts
│   ├── document-compliance.service.ts
│   ├── document-checklist-generate.ts      # generateProjectChecklist (D-04 discretion)
│   └── projects.service.ts                 # extend: create + stage PATCH hooks (D-04, D-09)
app/api/
├── document-catalog/route.ts
├── document-templates/route.ts
├── document-templates/[id]/route.ts
├── dashboards/document-compliance/route.ts
└── projects/[id]/document-checklist/
    ├── route.ts                            # GET list, PATCH row
    └── [checklistId]/route.ts              # optional single-row PATCH
```

### Pattern 1: Settings-flag DDL after migrateDashboards

**What:** Idempotent DDL gated by `settings.key`, mirroring Phase 16 dashboards module.  
**When to use:** All new Phase 17 tables.  
**Example:**

```typescript
// lib/db-documents.ts — after lib/db-dashboards.ts pattern [VERIFIED: lib/db-dashboards.ts:3-51]
export const DOCUMENTS_DDL_FLAG = 'documents_ddl_v1';

export const DOCUMENTS_DDL = [
  `CREATE TABLE IF NOT EXISTS document_catalog (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL CHECK (stage IN ('L0','L1','L2','L3','L4','L5','ALL')),
    mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // document_templates, project_document_checklist ...
];

// lib/db.ts — insert after migrateDashboards(pool) [VERIFIED: lib/db.ts:635-636]
const { migrateDocuments } = await import('./db-documents');
await migrateDocuments(pool);
```

### Pattern 2: parseHttpsUrl (Confluence evidence)

**What:** Small validator throwing `ValidationError`, modeled on `parseIsoDate`.  
**When to use:** Checklist `confluence_url`; optional `template_url` on templates.  
**Example:**

```typescript
// lib/documents/https-url.ts — D-07
import { ValidationError } from '@/lib/services/errors';

export function parseHttpsUrl(value: unknown, field: string, opts?: { allowEmpty?: boolean }): string | null {
  if (value === null || value === undefined || value === '') {
    if (opts?.allowEmpty) return null;
    throw new ValidationError(`${field} is required`, field);
  }
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`, field);
  const trimmed = value.trim();
  if (!trimmed) {
    if (opts?.allowEmpty) return null;
    throw new ValidationError(`${field} is required`, field);
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ValidationError(`${field} must be a valid URL`, field);
  }
  if (url.protocol !== 'https:') {
    throw new ValidationError(`${field} must use https://`, field);
  }
  return trimmed;
}
```

### Pattern 3: Reject multipart and binary fields on checklist routes

**What:** JSON-only routes with zod `.strict()` rejecting `file`, `content`, `blob`, data-URL prefixes; optional Content-Type guard.  
**When to use:** All checklist POST/PATCH handlers — **never** `{ rawBody: true }` (that pattern is for intentional multipart routes like parse-file-headers [VERIFIED: app/api/parse-file-headers/route.ts:47-123]).  
**Example:**

```typescript
// route schema — D-07
const FORBIDDEN_KEYS = ['file', 'content', 'blob', 'attachment', 'data'] as const;

export const checklistPatchSchema = z
  .object({
    status: z.enum(['none', 'drafting', 'pending_approval', 'approved', 'not_applicable']).optional(),
    confluence_url: z.string().optional(),
    approved_at: z.string().optional(),
    approved_by: z.union([z.number(), z.string()]).optional(),
    na_reason: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    for (const key of FORBIDDEN_KEYS) {
      if (key in (body as object)) {
        ctx.addIssue({ code: 'custom', message: 'File upload not allowed', path: [key] });
      }
    }
    const url = body.confluence_url;
    if (typeof url === 'string' && url.startsWith('data:')) {
      ctx.addIssue({ code: 'custom', message: 'Data URLs not allowed', path: ['confluence_url'] });
    }
  });
```

Default `withAuth` + schema calls `req.json()` only [VERIFIED: lib/http/with-auth.ts:98-112] — `multipart/form-data` POST returns **400 Invalid JSON**, which satisfies D-07 at the boundary; service layer should still reject forbidden keys if passthrough schemas are avoided.

### Pattern 4: Stage PATCH mandatory guard + ack

**What:** Before applying stage change in `updateProject`, load mandatory checklist items tied to catalog entries matching **current** stage; if any status ∉ `{approved, not_applicable}`, throw structured 409 unless `acknowledge_incomplete_mandatory: true`.  
**When to use:** Only when `fields.stage` is present and differs from `current.stage`.  
**Example:**

```typescript
// lib/services/errors.ts extension — D-09 (new class; maps in serviceErrorResponse)
export class MandatoryIncompleteError extends Error {
  readonly code = 'mandatory_incomplete' as const;
  readonly items: Array<{ checklist_id: number; catalog_id: number; name: string; status: string }>;

  constructor(items: MandatoryIncompleteError['items']) {
    super('Mandatory checklist items incomplete');
    this.name = 'MandatoryIncompleteError';
    this.items = items;
  }
}

// lib/api-errors.ts — add before generic ConflictError branch
if (e instanceof MandatoryIncompleteError) {
  return NextResponse.json({ code: e.code, items: e.items }, { status: 409 });
}
```

### Pattern 5: Template URL-only storage (recommended discretion)

**What:** CPMO POST template version with `template_url` (HTTPS) + metadata; no BYTEA column.  
**When to use:** Default unless product explicitly requires binary template library.  
**Rationale:** Repo has zero BYTEA usage; v1 `documents.content_json` is TEXT JSON for structured report content — not a pattern for CPMO file hosting [VERIFIED: lib/repositories/documents.repo.ts:51-62] [VERIFIED: lib/db.ts:229-237].

### Anti-Patterns to Avoid

- **Reusing v1 `documents` for checklist rows:** Different semantics (upsert-by-type JSON diary vs catalog-linked compliance) — data model collision [D-01].
- **`rawBody: true` on checklist routes:** Opens multipart path intentionally used elsewhere [VERIFIED: lib/http/with-auth.ts:67-70].
- **Physical DELETE on catalog/template/checklist:** Violates D-11; use `active=false` / `retired_at`.
- **HTTP Confluence links:** D-07 requires `https://` only.
- **Checking mandatory items for new stage before change:** D-09 explicitly evaluates **current (pre-change) stage** mandatory items.
- **Calling v1 `upsertDocument` from checklist flow:** Keeps landmine boundary clear.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTPS URL validation | Regex-only `^https://` | `URL` constructor + `protocol === 'https:'` | Rejects `http://`, malformed URLs, userinfo edge cases |
| ISO date for `approved_at` | Ad-hoc splits | `parseIsoDate` pattern [VERIFIED: lib/fiscal/iso-date.ts:3-8] | Consistent ValidationError field paths |
| Settings-flag DDL | Ad-hoc migrations table | `migrateDocuments` copying `lib/db-dashboards.ts` | Proven boot-time idempotency [VERIFIED: lib/db-dashboards.ts:34-51] |
| 409 structured body | String-only ConflictError | `MandatoryIncompleteError` + api-errors branch | D-09 contract `{ code, items }` |
| Compliance filters | New filter vocabulary | Subset of `dashboardFiltersSchema` keys | D-10 reuse |
| Project write auth | Custom PM checks | `assertProjectWriteAccess` [VERIFIED: lib/services/access.ts:131-138] | Assignment-window source of truth |
| Multipart rejection | Custom body parser | JSON schema routes + no `rawBody` | Existing withAuth behavior |

**Key insight:** v1 `documents` is a **content diary**, not a governance checklist — parallel tables are cheaper than retrofitting compliance semantics onto `content_json`.

## Common Pitfalls

### Pitfall 1: v1 documents landmine

**What goes wrong:** Checklist rows stored in `documents` with synthetic `type` values; compliance queries join wrong shape; Word export breaks.  
**Why it happens:** Route already exists at `/api/projects/[id]/documents` [VERIFIED: app/api/projects/[id]/documents/route.ts:11-34].  
**How to avoid:** New table `project_document_checklist` only; no imports from `documents.service` in checklist code [D-01].  
**Warning signs:** `findDocumentByType(projectId, 'checklist_item')` or similar in new services.

### Pitfall 2: Mandatory guard checks wrong stage

**What goes wrong:** Stage change blocked on new-stage items instead of leaving-stage items.  
**Why it happens:** Guard runs after stage is merged into `governed` fields.  
**How to avoid:** Compare `current.stage` (pre-PATCH) against catalog mandatory rows for that stage before `updateProjectRepo` [D-09].  
**Warning signs:** Unit test: L2→L3 guard fires on L3 catalog items (wrong).

### Pitfall 3: Generation deletes prior-stage rows

**What goes wrong:** History lost on stage change.  
**Why it happens:** DELETE+INSERT regenerate pattern.  
**How to avoid:** INSERT only missing `(project_id, catalog_id)` pairs [D-04].  
**Warning signs:** SQL `DELETE FROM project_document_checklist WHERE project_id = ?`.

### Pitfall 4: ConflictError for mandatory incomplete

**What goes wrong:** Client receives `{ error: "..." }` without `items` array — CPMO warning UI cannot list blockers.  
**Why it happens:** Reusing generic ConflictError [VERIFIED: lib/api-errors.ts:58-60].  
**How to avoid:** `MandatoryIncompleteError` with structured mapper [D-09].  
**Warning signs:** Route test expects `items` but gets only `error`.

### Pitfall 5: Template BYTEA without infra

**What goes wrong:** Large blobs in Postgres, backup bloat, no download route pattern in repo.  
**Why it happens:** DOC-03 says "upload" literally.  
**How to avoid:** URL-only `template_url` on `document_templates` (recommended discretion) [D-05].  
**Warning signs:** DDL includes `BYTEA` column; no existing blob serve route to copy.

### Pitfall 6: Seed admin expects catalog access

**What goes wrong:** False regression — admin 403 is correct.  
**Why it happens:** `assertCompanyWrite` requires cpmo + non-null `company_id` [VERIFIED: lib/services/access.ts:126-128].  
**How to avoid:** Route tests use cpmo session with `company_id: 5`.  
**Warning signs:** `{ is_admin: 1, company_id: null }` expects 200 on catalog POST.

### Pitfall 7: Viewer PATCH allowed

**What goes wrong:** Viewer mutates checklist.  
**Why it happens:** Only checking project access, not `assertCanMutate`.  
**How to avoid:** `assertProjectWriteAccess` on PATCH [D-06, D-12].  
**Warning signs:** Viewer session returns 200 on checklist PATCH.

## Code Examples

### generateProjectChecklist (idempotent)

```typescript
// lib/services/document-checklist-generate.ts — D-04
export async function generateProjectChecklist(
  projectId: number,
  companyId: number,
  projectStage: string | null,
  projectStatus: string,
) {
  if (projectStatus !== 'Active') return { inserted: 0 };

  const catalogItems = await listActiveCatalogForStage(companyId, projectStage);
  const existing = await listChecklistCatalogIds(projectId);
  const existingSet = new Set(existing);

  let inserted = 0;
  for (const item of catalogItems) {
    if (existingSet.has(item.id)) continue;
    await insertChecklistRow({ project_id: projectId, catalog_id: item.id, status: 'none' });
    inserted++;
  }
  return { inserted };
}
```

### createProject hook

```typescript
// lib/services/projects.service.ts — after createProjectRepo [VERIFIED: lib/services/projects.service.ts:86-87]
const row = await createProjectRepo(actor.company_id, fields);
await generateProjectChecklist(
  Number(row.id),
  actor.company_id!,
  (row.stage as string | null) ?? null,
  String(row.status ?? 'Active'),
);
return { ...row, warnings };
```

### Effective template query

```sql
-- document_templates.repo — D-05
SELECT * FROM document_templates
WHERE catalog_id = $1
  AND retired_at IS NULL
  AND effective_date <= CURRENT_DATE
ORDER BY version DESC
LIMIT 1;
```

### Compliance project rollup

```typescript
// lib/documents/compliance.ts — D-08, D-10
export function projectComplianceStatus(
  mandatoryItems: Array<{ status: string; mandatory: true }>,
): 'compliant' | 'not_compliant' | 'not_applicable' {
  if (mandatoryItems.length === 0) return 'compliant';
  const allNa = mandatoryItems.every((i) => i.status === 'not_applicable');
  if (allNa) return 'not_applicable';
  const allApprovedOrNa = mandatoryItems.every(
    (i) => i.status === 'approved' || i.status === 'not_applicable',
  );
  if (allApprovedOrNa && mandatoryItems.some((i) => i.status === 'approved')) return 'compliant';
  if (mandatoryItems.some((i) => i.status !== 'approved' && i.status !== 'not_applicable')) {
    return 'not_compliant';
  }
  return 'not_compliant';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1 `documents` JSON diary | Spec checklist + catalog + templates | Phase 17 (parallel) | v1 routes unchanged |
| No stage document gate | Mandatory checklist 409 + ack | Phase 17 (new) | CPMO warned on stage change |
| No portfolio doc compliance | CPMO compliance GET + filters | Phase 17 (new) | Reuses dashboard filter keys |
| File/binary evidence (out of scope) | Confluence HTTPS links only | Phase 17 (locked) | No multipart on checklist |

**Deprecated/outdated for this phase:**

- Storing checklist state in v1 `documents.content_json`.
- BYTEA template storage (unless explicitly chosen over URL-only recommendation).
- Generic `ConflictError` for mandatory-incomplete stage guard.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Templates attach via `catalog_id` FK (not separate enum) | Schema | Minor refactor if enum preferred |
| A2 | Template storage is URL-only (`template_url TEXT`) | D-05 discretion | CPMO may need binary upload in follow-up |
| A3 | `generateProjectChecklist` called after repo write (not inside repo) | D-04 discretion | Transaction boundary differs if mid-repo hook chosen |
| A4 | Mandatory incomplete items filtered by catalog.stage matching **current project stage** (not ALL-stage catalog on every guard) | D-09 | Over-blocking if ALL mandatory items always checked |
| A5 | `approved_by` accepts numeric user id OR non-empty display string | D-08 | Validation rules need adjustment if id-only |

## Open Questions (RESOLVED)

1. **Exact compliance route path**
   - What we know: D-01 allows `/api/dashboards/document-compliance` or `/api/document-compliance`.
   - What's unclear: Which path Phase 17 plans standardize on.
   - Recommendation: Prefer `/api/dashboards/document-compliance` for consistency with Phase 16 dashboard namespace.
   - RESOLVED: Plans lock `/api/dashboards/document-compliance` (17-03, COVERAGE.md).

2. **Template "upload" UX without bytes**
   - What we know: D-05 allows URL pointer; DOC-03 says upload/replace.
   - What's unclear: Whether CPMO accepts URL-only as satisfying "upload".
   - Recommendation: POST body `{ template_url, ...metadata }` counts as upload; document in PLAN.
   - RESOLVED: DOC-03 upload is POST JSON `{ catalog_id, name, document_type, effective_date, guidance, template_url }` with `parseHttpsUrl`; no BYTEA (17-02, COVERAGE.md).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next | ✓ | (runtime) | — |
| vitest | D-13 test gate | ✓ | 4.1.10 [VERIFIED: package.json:49] | — |
| PostgreSQL (`DATABASE_URL` / `TEST_DATABASE_URL`) | DDL + repo tests | optional | — | Unit tests mock repos; integration skip pattern |
| zod / pg | Validation + DB | ✓ | see package.json | — |

**Missing dependencies with no fallback:** none for unit-test gate.

**Missing dependencies with fallback:** Live Postgres optional for repo integration tests (skip pattern from prior phases).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [VERIFIED: package.json:49] |
| Config file | `vitest.config.ts` [VERIFIED: vitest.config.ts:1-32] |
| Quick run command | `npx vitest run lib/documents lib/services/document-catalog.service.unit.test.ts lib/services/project-document-checklist.service.unit.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | Catalog CRUD company-scoped; soft-retire | unit/route | `npx vitest run lib/services/document-catalog.service.unit.test.ts` | ❌ Wave 0 |
| DOC-01 | apply_to_in_flight backfill | unit | same | ❌ Wave 0 |
| DOC-02 | createProject generates checklist rows | unit | `npx vitest run lib/services/projects.service.unit.test.ts` | ❌ extend |
| DOC-02 | stage PATCH generates new-stage rows; prior kept | unit | same + checklist generate tests | ❌ Wave 0 |
| DOC-03 | Template version insert retires previous | unit | `npx vitest run lib/services/document-templates.service.unit.test.ts` | ❌ Wave 0 |
| DOC-03 | Effective version query | unit/repo | template repo test | ❌ Wave 0 |
| DOC-04 | PATCH rejects file/multipart/data URL | unit/route | checklist route test | ❌ Wave 0 |
| DOC-04 | https required; http rejected | unit | `lib/documents/https-url.unit.test.ts` | ❌ Wave 0 |
| DOC-05 | approved requires date+approver; N/A requires reason | unit | checklist status unit tests | ❌ Wave 0 |
| DOC-05 | mandatory approved → compliant item | unit | `lib/documents/compliance.unit.test.ts` | ❌ Wave 0 |
| DOC-06 | Compliance listing + filters | unit | `lib/services/document-compliance.service.unit.test.ts` | ❌ Wave 0 |
| DOC-06 | Stage 409 mandatory_incomplete + ack | unit/route | projects.service + route test | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** run task `<verify><automated>` file(s)
- **Per wave merge:** `npx vitest run lib/documents lib/db-documents.ddl.unit.test.ts lib/services/document-*.unit.test.ts app/api/document-catalog app/api/document-templates app/api/dashboards/document-compliance app/api/projects/*/document-checklist`
- **Phase gate:** full `npm test` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `lib/db-documents.ts` + `.ddl.unit.test.ts`
- [ ] `lib/documents/https-url.ts`, `checklist-status.ts`, `compliance.ts` + unit tests
- [ ] `lib/repositories/document-*.repo.ts` + tests
- [ ] `lib/services/document-*.service.ts` + `.unit.test.ts`
- [ ] `lib/services/document-checklist-generate.ts`
- [ ] `MandatoryIncompleteError` + `serviceErrorResponse` branch
- [ ] `app/api/document-catalog/route.ts` + route tests
- [ ] `app/api/document-templates/route.ts` + route tests
- [ ] `app/api/projects/[id]/document-checklist/route.ts` + route tests
- [ ] `app/api/dashboards/document-compliance/route.ts` + route tests
- [ ] Extend `lib/services/projects.service.ts` + unit tests for generate + stage guard

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing session via `withAuth` / `withCpmo` |
| V3 Session Management | yes | Existing session cookie pattern |
| V4 Access Control | yes | `assertCompanyWrite`, `assertProjectWriteAccess`, company_id scoping [D-12] |
| V5 Input Validation | yes | zod strict schemas; `parseHttpsUrl`; reject binary fields [D-07] |
| V6 Cryptography | no | No secrets stored in checklist rows |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant catalog read/write | Elevation | `company_id` on catalog + `assertCompanyWrite` [D-12] |
| PM uploads malware via checklist | Tampering | Reject multipart/file/data-URL; HTTPS URL text only [D-07] |
| HTTP downgrade Confluence link | Tampering | `https://` only via `parseHttpsUrl` [D-07] |
| Viewer mutates checklist | Elevation | `assertProjectWriteAccess` on PATCH [D-06] |
| Stage change bypasses mandatory gate | Tampering | 409 unless `acknowledge_incomplete_mandatory` [D-09] |
| SQL injection | Tampering | Parameterized repo queries (existing pattern) |

## Sources

### Primary (HIGH confidence)

- Codegraph exploration + verbatim source — `documents.repo`, `projects.service`, `db.ts`, `db-dashboards.ts`, `with-auth.ts`, `access.ts`, `filter-schema.ts`, `iso-date.ts`
- Phase 17 `17-CONTEXT.md` — D-01..D-14 locked decisions

### Secondary (MEDIUM confidence)

- Phase 16 `16-RESEARCH.md` — parallel surface + DDL + validation doc shape

### Tertiary (LOW confidence)

- None material — core patterns verified in-repo this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing pg/zod/vitest/withCpmo patterns verified
- Architecture: HIGH — v1 documents landmine confirmed; hook points located in projects.service
- Pitfalls: HIGH — ConflictError gap for D-09 identified; BYTEA absent in repo

**Research date:** 2026-08-26  
**Valid until:** 2026-09-26 (stable stack; new error class is the main planner action)
