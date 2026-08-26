# Phase 17 coverage map

Maps ROADMAP requirements and CONTEXT locked decisions to executable plans. Server tests are the gate (`workflow.ui_phase: false`).

## Requirements

| ID | Description | Plan | Tasks |
|----|-------------|------|-------|
| DOC-01 | CPMO catalog CRUD + apply-to-in-flight | 17-01 | 17-01-01, 17-01-02, 17-01-03 |
| DOC-02 | Generate checklist on create/stage; prior-stage rows stay | 17-01 (helper), 17-03 (hooks) | 17-01-01, 17-03-02 |
| DOC-03 | Template upload/replace/retire; effective version default | 17-02 | 17-02-01 |
| DOC-04 | PM checklist metadata + Confluence HTTPS; no project binaries | 17-02 | 17-02-02, 17-02-03 |
| DOC-05 | Approved date+approver; N/A reason; mandatory approved = compliant | 17-02 (status rules), 17-03 (rollup helper) | 17-02-02, 17-03-01 |
| DOC-06 | Portfolio compliance listing + stage-change mandatory warning | 17-03 | 17-03-02, 17-03-03 |

## Decisions (D-01..D-14)

| ID | Lock | Plan |
|----|------|------|
| D-01 | Parallel tables/routes; do not store checklist in legacy `documents`; leave `/api/projects/[id]/documents` unchanged | all (prohibitions + import guard) |
| D-02 | Company-scoped catalog; stage L0–L5 or ALL; soft-retire `active=false` | 17-01 |
| D-03 | `apply_to_in_flight=true` backfills Active matching projects; default false; never implicit | 17-01-02 |
| D-04 | Generate on `createProject` + stage PATCH; skip existing catalog_id; prior-stage rows stay | 17-01 helper, 17-03 hooks |
| D-05 | Templates belong to `catalog_id`; monotonic version; replace = insert + `retired_at`; URL-only `template_url` | 17-02-01 |
| D-06 | Checklist fields + `assertProjectWriteAccess` PATCH; Viewer GET only | 17-02-02, 17-02-03 |
| D-07 | Reject file/multipart/data-URL; `parseHttpsUrl`; empty URL only for none/drafting | 17-02 |
| D-08 | approved requires date+approver; N/A requires reason; optional items do not fail compliance | 17-02-02, 17-03-01 |
| D-09 | Stage PATCH 409 `{ code: 'mandatory_incomplete', items }` unless `acknowledge_incomplete_mandatory: true` | 17-03-01, 17-03-02 |
| D-10 | CPMO GET `/api/dashboards/document-compliance`; filters stage/status/rag/program; `withCpmo` + `assertCompanyWrite` | 17-03-03 |
| D-11 | Settings-flag `lib/db-documents.ts` after `migrateDashboards`; no Prisma; no physical row-removal | 17-01 |
| D-12 | Catalog/templates/compliance writes: `withCpmo` + `assertCompanyWrite`; checklist PATCH: `assertProjectWriteAccess`; PM GET catalog/templates | 17-01, 17-02, 17-03 |
| D-13 | `ui_phase` false; server tests are the gate | all |
| D-14 | No CASL; incremental `auditLog` on catalog, template version, checklist status, stage ack | 17-01, 17-02, 17-03 |

## Planner-locked contracts

| Lock | Plan |
|------|------|
| Templates attach via `catalog_id` FK (not a separate enum) | 17-01 DDL, 17-02 |
| Template storage is `template_url` TEXT HTTPS (DOC-03 upload = POST URL + metadata) | 17-01 DDL, 17-02-01 |
| `generateProjectChecklist` called after repo write in `createProject` / `updateProject` | 17-01, 17-03 |
| Compliance route `/api/dashboards/document-compliance` | 17-03 |
| Stage guard evaluates mandatory items whose catalog.stage equals **current** (pre-change) stage, not ALL | 17-03-02 |
| Catalog/templates GET uses `withAuth` (PM + CPMO, company match); Viewer 403; writes stay `withCpmo` | 17-01, 17-02 |
| `migrateDocuments` immediately after `migrateDashboards` and before `backfillWeightedCompletion` | 17-01 |
| Peel `acknowledge_incomplete_mandatory` before `applyProjectGovernance` / `updateProjectRepo` | 17-03-02 |

## Deferred (not planned)

- Full append-only audit coverage — Phase 18
- Pixel UI for catalog admin
- Migrating legacy `documents` rows into the checklist

## File-layout lock (RESEARCH + PATTERNS)

| Path | Plan |
|------|------|
| `lib/db-documents.ts` + ddl unit test; `lib/db.ts` wire | 17-01 |
| `document-catalog.repo/service` + `/api/document-catalog` | 17-01 |
| `document-checklist-generate.ts` + checklist repo insert/list | 17-01 |
| `lib/documents/https-url.ts`, `checklist-status.ts` | 17-02 |
| `document-templates.repo/service` + `/api/document-templates` | 17-02 |
| checklist PATCH service + `/api/projects/[id]/document-checklist` | 17-02 |
| `MandatoryIncompleteError` + `serviceErrorResponse` | 17-03 |
| `lib/documents/compliance.ts` + `document-compliance.service` | 17-03 |
| `projects.service` create/stage hooks | 17-03 |
| `/api/dashboards/document-compliance` | 17-03 |

## Source audit

| SOURCE | ID | Feature/Requirement | Plan | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | — | Catalog + templates; PM Confluence checklist; no project binaries | 01-03 | COVERED | ROADMAP Phase 17 goal |
| REQ | DOC-01 | Catalog + apply-to-in-flight | 01 | COVERED | |
| REQ | DOC-02 | Generate on create/stage; history stays | 01, 03 | COVERED | Helper then hooks |
| REQ | DOC-03 | Template upload/replace/retire; effective default | 02 | COVERED | URL POST = upload |
| REQ | DOC-04 | HTTPS link + no binaries | 02 | COVERED | |
| REQ | DOC-05 | Approved/N/A rules; mandatory approved = compliant | 02, 03 | COVERED | |
| REQ | DOC-06 | Compliance listing + stage warning | 03 | COVERED | |
| RESEARCH | — | Parallel tables; leave diary routes | 01-03 | COVERED | D-01 |
| RESEARCH | — | `parseHttpsUrl` + JSON-only checklist | 02 | COVERED | |
| RESEARCH | — | `MandatoryIncompleteError` 409 `{ code, items }` | 03 | COVERED | |
| RESEARCH | — | `migrateDocuments` after `migrateDashboards` | 01 | COVERED | |
| RESEARCH | — | URL-only `template_url`; no binary column type | 01, 02 | COVERED | Discretion locked |
| RESEARCH | — | Reuse dashboard filter keys stage/status/rag/program | 03 | COVERED | |
| CONTEXT | D-01..D-14 | All locked decisions | 01-03 | COVERED | See table above |
