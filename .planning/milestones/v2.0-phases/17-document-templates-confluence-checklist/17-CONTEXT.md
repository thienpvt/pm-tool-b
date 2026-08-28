# Phase 17: Document Templates & Confluence Checklist - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Deliver a company-scoped document catalog, versioned templates, and per-project stage checklists whose evidence is a **Confluence HTTPS link** — PMs cannot upload project file binaries. Creating a project or changing `stage` generates applicable checklist rows; prior-stage items remain for history. CPMO sees portfolio compliance and is warned when a stage change would leave mandatory items incomplete.

**Requirements:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06

**In:** CPMO CRUD catalog (name, purpose, stage L0–L5, mandatory, active) with an apply-to-in-flight flag; template upload/replace/retire (name, document type, version, effective date, guidance) — only the effective version is default for PMs; generate checklist on project create and stage change; PM PATCH checklist metadata + Confluence HTTPS URL + status None/Drafting/Pending approval/Approved/Not applicable; Approved requires date+approver; N/A requires reason; mandatory Approved = compliant; CPMO compliance listing with filters; stage-change warning when mandatory incomplete.

**Out:** Binary project-document uploads (reject multipart/file bodies on checklist routes); redesign of v1 `/api/projects/[id]/documents` if that store is a free-form file dump — leave it, do not use it as the spec checklist; dashboards (Phase 16 done); full audit coverage (Phase 18 — incremental `auditLog` on catalog/template/checklist mutations is OK); UI-SPEC (`workflow.ui_phase` false).

</domain>

<decisions>
## Implementation Decisions

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

### the agent's Discretion

- Whether templates attach to catalog_id vs a separate document_type enum.
- Whether template bytes live in Postgres BYTEA vs a URL-only template (prefer URL-only if v1 already struggles with blobs; otherwise BYTEA on template table only).
- Exact generate hook inside `createProject` vs a dedicated `generateProjectChecklist(projectId)` called from the service.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 17 success criteria 1–4
- `.planning/REQUIREMENTS.md` — DOC-01..06
- `.planning/PROJECT.md` — PR-15
- `.planning/phases/10-users-roles-server-authorization/10-CONTEXT.md` — withCpmo, D-23 leftover
- `.planning/phases/11-project-master-pm-assignment-stakeholders/11-CONTEXT.md` — createProject, stage PATCH, L0–L5
- `.planning/phases/16-portfolio-pm-dashboards/16-CONTEXT.md` — parallel surface, ui_phase false

</canonical_refs>

<code_context>
## Existing Code Insights

### Landmines
- v1 `documents` project nested resource may allow file-like rows — do not reuse as spec checklist
- Stage PATCH already exists on project update — hook generate + mandatory warning here
- Seed admin null company_id is 403 on CPMO catalog (correct)

### Reuse
- `assertProjectWriteAccess`, `withCpmo`, `assertCompanyWrite`, settings-flag DDL after `migrateDashboards`
- `https://` URL validation — new small helper analog `parseIsoDate`

</code_context>

<deferred>
## Deferred Ideas

- Full append-only audit coverage — Phase 18
- Pixel UI for catalog admin
- Migrating v1 documents rows into the checklist

</deferred>

---

*Phase: 17-document-templates-confluence-checklist*
*Context gathered: 2026-08-26*
