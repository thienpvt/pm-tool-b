---
phase: 17
slug: document-templates-confluence-checklist
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 17 — Validation Strategy

> Nyquist-style must-haves mapped to DOC-01..06. Server tests are the phase gate (`workflow.ui_phase: false`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run lib/documents lib/services/document-catalog.service.unit.test.ts lib/services/project-document-checklist.service.unit.test.ts lib/services/document-compliance.service.unit.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~90 seconds |

Do not use `-x` in automated plan commands (Vitest 4 ignores it).

---

## Requirement Must-Haves (DOC-01..06)

| Req | Must-have behavior | Automated proof | Min test type |
|-----|-------------------|-----------------|---------------|
| **DOC-01** | CPMO creates catalog row: name, purpose, stage (L0–L5 or ALL), mandatory, active | Service unit: create with company_id stamp | unit |
| **DOC-01** | Catalog list scoped to actor company | Service/route unit: cross-company 403 | unit/route |
| **DOC-01** | Soft-retire sets `active=false`; no physical DELETE | Repo/service unit: UPDATE only | unit |
| **DOC-01** | `apply_to_in_flight=true` inserts checklist rows for Active projects matching stage/ALL | Service unit with mocked repos | unit |
| **DOC-01** | `apply_to_in_flight=false` (default) does not backfill existing projects | Service unit | unit |
| **DOC-02** | `createProject` success generates checklist for active catalog matching project stage + ALL | `projects.service.unit.test.ts` mock generate | unit |
| **DOC-02** | Stage PATCH generates rows for new stage; skips existing catalog_id | Service unit on stage change | unit |
| **DOC-02** | Prior-stage checklist rows remain after stage change | Service/repo unit: no DELETE | unit |
| **DOC-02** | Generation idempotent — second call inserts 0 duplicates | `document-checklist-generate` unit | unit |
| **DOC-03** | Template replace inserts new version; previous gets `retired_at` | `document-templates.service.unit.test.ts` | unit |
| **DOC-03** | PM list returns effective version (`effective_date <= today`, not retired, max version) | Repo/service unit | unit |
| **DOC-03** | Old template version GET by id still returns row | Route/repo unit | unit/route |
| **DOC-03** | Template storage uses URL pointer (recommended) — no BYTEA on checklist | DDL unit test asserts no BYTEA on checklist table | unit |
| **DOC-04** | PM GET checklist with `assertProjectAccess` | Route test: pm 200, cross-tenant 403 | route |
| **DOC-04** | Viewer GET checklist 200; Viewer PATCH 403 | Route tests | route |
| **DOC-04** | PATCH rejects body keys `file`, `blob`, `attachment`, data-URL `confluence_url` | Schema/service unit | unit |
| **DOC-04** | `multipart/form-data` POST/PATCH → 400 (JSON-only boundary) | Route test with FormData body | route |
| **DOC-04** | `confluence_url` must be `https://`; `http://` → 400 | `lib/documents/https-url.unit.test.ts` | unit |
| **DOC-04** | Empty URL allowed when status is `none` or `drafting` only | https-url + checklist service unit | unit |
| **DOC-05** | Status `approved` requires `approved_at` + non-empty `approved_by` | Checklist service unit | unit |
| **DOC-05** | Status `not_applicable` requires non-empty `na_reason` | Checklist service unit | unit |
| **DOC-05** | Mandatory + approved → item counts compliant | `lib/documents/compliance.unit.test.ts` | unit |
| **DOC-05** | Mandatory + not_applicable → not a compliance failure | compliance unit | unit |
| **DOC-05** | Mandatory + drafting/none/pending → not compliant | compliance unit | unit |
| **DOC-05** | Optional catalog items do not fail project compliance | compliance unit | unit |
| **DOC-06** | Compliance GET returns project-level `compliant \| not_compliant \| not_applicable` | `document-compliance.service.unit.test.ts` | unit |
| **DOC-06** | Filters: stage, status, rag, program (dashboard keys) | Service unit with filter fixture | unit |
| **DOC-06** | Unknown filter key → 400 | Route or schema unit | unit/route |
| **DOC-06** | Stage PATCH with incomplete mandatory (current stage) → 409 `{ code: 'mandatory_incomplete', items }` | `projects.service.unit.test.ts` | unit |
| **DOC-06** | Stage PATCH with `acknowledge_incomplete_mandatory: true` proceeds + generates new-stage rows | Service unit | unit |
| **DOC-06** | CPMO compliance route: `withCpmo` + `assertCompanyWrite`; pm/viewer 403 | Route tests | route |

### Cross-cutting (locked D-01..D-14)

| Must-have | Automated proof |
|-----------|-----------------|
| Parallel surface — v1 `documents` repo/service untouched | Static unit: checklist services do not import `@/lib/services/documents.service` |
| v1 `/api/projects/[id]/documents` unchanged | No edits in `app/api/projects/[id]/documents/route.ts`; existing tests pass |
| New routes only under document-catalog, document-templates, document-checklist, document-compliance | Path existence + negative import test |
| Catalog/template writes: `withCpmo` + `assertCompanyWrite` | Route tests: cpmo 200, pm 403, viewer 403 |
| Seed admin (`is_admin=1`, null `company_id`) → catalog 403 | Route test session mirrors landmine |
| DDL via settings flag after `migrateDashboards` in `getDb()` | `lib/db-documents.ddl.unit.test.ts` |
| No physical DELETE on catalog/template/checklist | Repo tests: INSERT/UPDATE/soft-retire only |
| Incremental `auditLog` on catalog create/update, template version, checklist status, stage ack | Service unit mock `auditLog` |
| No new npm packages | package.json diff guard / no install in plan |
| No CASL; no D-23 ops/admin re-gate | N/A — follow existing route wrappers |

---

## Sampling Rate

- **After every task commit:** run task `<verify><automated>` file(s)
- **After every plan wave:** `npx vitest run lib/documents lib/db-documents.ddl.unit.test.ts lib/services/document-*.unit.test.ts lib/services/projects.service.unit.test.ts app/api/document-catalog app/api/document-templates app/api/dashboards/document-compliance app/api/projects`
- **Before `$gsd-verify-work`:** full `npm test` green
- **Max feedback latency:** 90 seconds

---

## Wave 0 Files (all ❌ until created)

- [ ] `lib/db-documents.ts` + `.ddl.unit.test.ts`
- [ ] `lib/documents/https-url.ts`, `checklist-status.ts`, `compliance.ts` + unit tests
- [ ] `lib/repositories/document-catalog.repo.ts` + `.repo.test.ts`
- [ ] `lib/repositories/document-templates.repo.ts` + `.repo.test.ts`
- [ ] `lib/repositories/project-document-checklist.repo.ts` + `.repo.test.ts`
- [ ] `lib/services/document-catalog.service.ts` + `.unit.test.ts`
- [ ] `lib/services/document-templates.service.ts` + `.unit.test.ts`
- [ ] `lib/services/project-document-checklist.service.ts` + `.unit.test.ts`
- [ ] `lib/services/document-compliance.service.ts` + `.unit.test.ts`
- [ ] `lib/services/document-checklist-generate.ts` + unit tests
- [ ] `lib/services/errors.ts` — `MandatoryIncompleteError` + `lib/api-errors.ts` mapper
- [ ] `app/api/document-catalog/route.ts` + `route.test.ts`
- [ ] `app/api/document-templates/route.ts` + `[id]/route.ts` + route tests
- [ ] `app/api/projects/[id]/document-checklist/route.ts` + `route.test.ts`
- [ ] `app/api/dashboards/document-compliance/route.ts` + `route.test.ts`
- [ ] Extend `lib/services/projects.service.ts` + `.unit.test.ts` (generate + stage guard)

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
|----------|-------------|------------|--------------|
| Thin catalog/checklist UI (if added) | D-13 | `ui_phase: false` | Optional smoke: CPMO creates catalog, PM patches Confluence URL. Server tests remain gate. |
| Real Confluence URL reachability | DOC-04 | Out of scope — store link only | No live HTTP probe required in automated tests |

All DOC-01..06 behaviors above have intended automated coverage.

---

## Validation Sign-Off

- [ ] Every DOC-01..06 must-have row has a Wave 0 test target
- [ ] No three consecutive tasks without `<automated>` verify
- [ ] v1 `documents` landmine covered by negative import test
- [ ] `MandatoryIncompleteError` 409 shape covered (not generic ConflictError)
- [ ] Multipart rejection covered at checklist route boundary
- [ ] `migrateDocuments` wired after `migrateDashboards` in DDL unit test
- [ ] `nyquist_compliant: true` when Wave 0 complete

**Approval:** pending
