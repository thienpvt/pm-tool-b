---
phase: 17-document-templates-confluence-checklist
verified: 2026-08-26T15:12:00Z
status: passed
score: 22/22 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 17: Document Templates & Confluence Checklist Verification Report

**Phase Goal:** CPMO maintains a document catalog and templates; PMs complete a stage checklist with Confluence links and cannot upload project file binaries
**Verified:** 2026-08-26T15:12:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CPMO can maintain company-scoped document catalog (name, purpose, stage L0–L5/ALL, mandatory, active) via POST/GET/PATCH `/api/document-catalog` (DOC-01, D-02) | ✓ VERIFIED | `document-catalog.service.ts` + route tests (401/403/201); 6/6 artifacts pass gsd-tools |
| 2 | Catalog soft-retire via `active=false`; no physical DELETE on catalog/template/checklist repos (D-02, D-11) | ✓ VERIFIED | `updateDocumentCatalogItem` sets `active`; repo grep shows zero DELETE on document_* tables |
| 3 | `apply_to_in_flight=true` backfills Active matching-stage projects; default false does not (D-03) | ✓ VERIFIED | `applyCatalogToInFlightProjects` + unit tests in `document-catalog.service.unit.test.ts` |
| 4 | `generateProjectChecklist` inserts missing active catalog rows for project stage/ALL; never removes prior-stage rows (D-04, DOC-02) | ✓ VERIFIED | `document-checklist-generate.ts` insert-only; unit tests for idempotent insert |
| 5 | `migrateDocuments` runs after `migrateDashboards` in `getDb()` (D-11) | ✓ VERIFIED | `lib/db.ts:637-638`; `db-documents.ddl.unit.test.ts` ordering assertion |
| 6 | `createProject` calls `generateProjectChecklist` after repo insert (DOC-02, D-04) | ✓ VERIFIED | `projects.service.ts:94-98`; unit test asserts mock call with companyId + stage |
| 7 | Stage PATCH with incomplete mandatory current-stage items throws `MandatoryIncompleteError` unless ack (D-09, DOC-06) | ✓ VERIFIED | `projects.service.ts:164-182`; unit test `L2→L3 with incomplete mandatory L2 row` |
| 8 | `serviceErrorResponse` maps `MandatoryIncompleteError` → HTTP 409 `{ code: 'mandatory_incomplete', items }` (D-09) | ✓ VERIFIED | `lib/api-errors.ts:59-60`; `lib/api-errors.test.ts` named test passes |
| 9 | After ack, stage updates, generate runs, prior rows remain, `stage_change_ack` auditLog fires (D-04, D-09, D-14) | ✓ VERIFIED | `projects.service.ts:202-220`; unit test `acknowledge_incomplete_mandatory allows stage write...` |
| 10 | CPMO POST templates with HTTPS `template_url` inserts monotonic version, retires previous (D-05, DOC-03) | ✓ VERIFIED | `document-templates.service.ts` + `createTemplateVersion` unit tests |
| 11 | PM GET templates returns effective version; GET by id returns retired history (D-05, DOC-03) | ✓ VERIFIED | `listEffectiveTemplates` / `getTemplate` services + unit tests |
| 12 | CPMO can retire current template via PATCH without new version (D-05) | ✓ VERIFIED | `retireTemplate` + unit test |
| 13 | PM PATCH checklist: HTTPS `confluence_url`, status rules, binary fields rejected; Viewer GET 200 / PATCH 403 (D-06, D-07, DOC-04) | ✓ VERIFIED | `checklist-status.ts`, `project-document-checklist.service.ts`, route + service unit tests |
| 14 | Status `approved` requires `approved_at` + `approved_by`; `not_applicable` requires `na_reason` (D-08, DOC-05) | ✓ VERIFIED | `assertChecklistPatchRules` + service unit tests |
| 15 | Mandatory approved = compliant; mandatory N/A not failure; optional items ignored in rollup (D-08, DOC-05) | ✓ VERIFIED | `compliance.ts` + 6 unit tests |
| 16 | CPMO GET `/api/dashboards/document-compliance` with stage/status/rag/program filters (D-10, DOC-06) | ✓ VERIFIED | `document-compliance.service.ts` + route tests (401/403/200) |
| 17 | Catalog/template writes use `withCpmo` + `assertCompanyWrite`; checklist PATCH uses `assertProjectWriteAccess` (D-12) | ✓ VERIFIED | Route wrappers + service access asserts; route tests for role matrix |
| 18 | `auditLog` on catalog create/update, template version insert/retire, checklist status change, stage-change ack (D-14) | ✓ VERIFIED | Service implementations + unit test assertions on `auditLog` mock |
| 19 | New parallel tables/routes; v1 `/api/projects/[id]/documents` untouched (D-01) | ✓ VERIFIED | Git history shows no Phase 17 commits on documents routes/service/repo; isolation tests in catalog + generate unit tests |
| 20 | Templates URL-only (`template_url TEXT`); no BYTEA anywhere in document DDL or lib (D-05) | ✓ VERIFIED | `db-documents.ts` DDL; repo-wide grep: zero BYTEA matches |
| 21 | Checklist rejects multipart, binary field keys, data-URL confluence URLs (D-07) | ✓ VERIFIED | `rejectBinaryFields`, `parseHttpsUrl` data: guard; route test FormData → 400 |
| 22 | `acknowledge_incomplete_mandatory` peeled before repo update; never in PROJECT_COLUMNS (D-09) | ✓ VERIFIED | `projects.service.ts:119-121`; unit test confirms not passed to `updateProjectRepo` |

**Score:** 22/22 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `lib/db-documents.ts` | DDL + migrateDocuments | ✓ VERIFIED | 3 tables, settings flag, wired in getDb |
| `lib/repositories/document-catalog.repo.ts` | Catalog CRUD | ✓ VERIFIED | insert/list/update/get/listActiveCatalogForStage |
| `lib/repositories/document-templates.repo.ts` | Versioned templates | ✓ VERIFIED | insert, retire, list effective |
| `lib/repositories/project-document-checklist.repo.ts` | Checklist rows | ✓ VERIFIED | idempotent insert, list joined to catalog, update |
| `lib/services/document-catalog.service.ts` | CPMO catalog + in-flight | ✓ VERIFIED | Wired to routes + auditLog |
| `lib/services/document-checklist-generate.ts` | Generate helper | ✓ VERIFIED | Wired from projects.service |
| `lib/services/document-templates.service.ts` | Template versioning | ✓ VERIFIED | HTTPS URL only |
| `lib/services/project-document-checklist.service.ts` | Checklist PATCH | ✓ VERIFIED | HTTPS + status rules |
| `lib/services/document-compliance.service.ts` | Compliance rollup | ✓ VERIFIED | Filters + projectComplianceStatus |
| `lib/documents/https-url.ts` | parseHttpsUrl | ✓ VERIFIED | https-only, rejects data: |
| `lib/documents/checklist-status.ts` | Status + binary reject | ✓ VERIFIED | All 5 statuses |
| `lib/documents/compliance.ts` | Rollup pure fn | ✓ VERIFIED | compliant/not_compliant/not_applicable |
| `app/api/document-catalog/route.ts` | Catalog API | ✓ VERIFIED | GET withAuth, POST withCpmo |
| `app/api/document-templates/route.ts` | Template API | ✓ VERIFIED | GET/POST |
| `app/api/projects/[id]/document-checklist/[itemId]/route.ts` | Checklist API | ✓ VERIFIED | GET/PATCH |
| `app/api/dashboards/document-compliance/route.ts` | Compliance API | ✓ VERIFIED | GET withCpmo |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `lib/db.ts` | `lib/db-documents.ts` | migrateDocuments after migrateDashboards | ✓ WIRED | Ordering verified |
| `app/api/document-catalog/route.ts` | `document-catalog.service.ts` | POST/GET handlers | ✓ WIRED | Pattern found |
| `document-checklist-generate.ts` | `project-document-checklist.repo.ts` | insertChecklistRowIfMissing | ✓ WIRED | ON CONFLICT idempotent |
| `projects.service.ts` | `document-checklist-generate.ts` | generateProjectChecklist on create/stage | ✓ WIRED | 4/4 key links pass gsd-tools |
| `lib/api-errors.ts` | `MandatoryIncompleteError` | 409 structured body | ✓ WIRED | Before ConflictError branch |
| `document-compliance/route.ts` | `document-compliance.service.ts` | getDocumentCompliance | ✓ WIRED | Pattern found |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Compliance GET | `compliance` per project | `listChecklistByProject` → `projectComplianceStatus` | DB checklist + catalog join | ✓ FLOWING |
| Catalog GET | catalog rows | `listDocumentCatalogRepo(company_id)` | Postgres document_catalog | ✓ FLOWING |
| Template GET | effective templates | `listEffectiveTemplatesRepo` with retired_at/effective_date filter | Postgres document_templates | ✓ FLOWING |
| Checklist GET | checklist rows | `listChecklistByProject` joined to catalog | Postgres project_document_checklist | ✓ FLOWING |
| Generate hook | new checklist rows | `listActiveCatalogForStage` + insertIfMissing | Postgres catalog query | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 17 unit/route tests (15 files, 144 tests) | `npx vitest run lib/db-documents.ddl.unit.test.ts ... app/api/dashboards/document-compliance/route.test.ts` | 15 files passed, 144/144 tests | ✓ PASS |
| MandatoryIncompleteError 409 mapping | `npx vitest run lib/api-errors.test.ts -t "maps MandatoryIncompleteError"` | pass | ✓ PASS |
| DDL has template_url TEXT not BYTEA | `lib/db-documents.ddl.unit.test.ts` | pass | ✓ PASS |
| Compliance rollup rules | `lib/documents/compliance.unit.test.ts` | 6/6 pass | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| DOC-01 | 17-01 | CPMO catalog + in-flight apply | ✓ SATISFIED | Catalog CRUD + apply_to_in_flight tests |
| DOC-02 | 17-01, 17-03 | Generate on create/stage; prior rows remain | ✓ SATISFIED | generateProjectChecklist + projects.service hooks |
| DOC-03 | 17-02 | Template upload/replace/retire, effective version | ✓ SATISFIED | document-templates service + HTTPS URL |
| DOC-04 | 17-02 | PM checklist HTTPS + no binaries | ✓ SATISFIED | parseHttpsUrl + rejectBinaryFields + PATCH routes |
| DOC-05 | 17-02, 17-03 | Approved/N/A rules; mandatory compliance | ✓ SATISFIED | assertChecklistPatchRules + projectComplianceStatus |
| DOC-06 | 17-03 | Compliance GET + 409 stage warning | ✓ SATISFIED | document-compliance route + MandatoryIncompleteError |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `lib/http/route-401-matrix.test.ts` | — | Phase 17 routes missing from ROUTE_MATRIX | ℹ️ Info | Dedicated `route.test.ts` per Phase 17 endpoint covers 401/403; D-13 designates server tests as gate, not matrix drift |

No TBD/FIXME/XXX markers in Phase 17 source files.

### Human Verification Required

None. `workflow.ui_phase` is false (D-13); all observable behaviors are covered by 144 passing unit/route tests. No behavior-dependent truths lack named test coverage.

### Gaps Summary

No gaps. Phase goal achieved: parallel document catalog/template/checklist spine is implemented, wired into project create/stage flows, enforces HTTPS-only evidence (no project binary uploads), returns structured 409 on incomplete mandatory stage changes, and exposes CPMO compliance listing — without touching v1 documents or introducing BYTEA storage.

---

_Verified: 2026-08-26T15:12:00Z_
_Verifier: Claude (gsd-verifier)_
