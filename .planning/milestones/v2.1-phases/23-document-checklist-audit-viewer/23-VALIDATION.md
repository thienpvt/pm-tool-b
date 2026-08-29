---
phase: 23
slug: document-checklist-audit-viewer
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-28
---

# Phase 23 — Validation Strategy

> DOC-07, DOC-08, DOC-09, AUDIT-02. Vitest jsdom (and one node) component tests are the gate. UI-SPEC is required (`workflow.ui_phase=true`). Wave 0 vitest `modules/**` glob already shipped in Phase 21.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (jsdom/node include `modules/**` from Phase 21) |
| **Quick run command** | `npx vitest run --project jsdom modules/documents modules/audit components/layout/Sidebar.documents-nav.component.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- After every task commit: targeted `npx vitest run --project jsdom` (or `--project node` for 23-03-03) on that task's test files (no watch flags)
- After every plan wave: `npx vitest run --project jsdom modules/documents modules/audit components/layout/Sidebar.documents-nav.component.test.tsx`
- Before verify-work: `npm test`
- Max feedback latency: 120 seconds

---

## Requirement Must-Haves

| Req | Must-have | Automated proof | Status |
|-----|-----------|-----------------|--------|
| DOC-07 | Catalog list from GET `/api/document-catalog` | `DocumentCatalogPage.component.test.tsx` | ✅ green |
| DOC-07 | Create/edit/retire plus URL-only templates | `DocumentCatalogPage.component.test.tsx` | ✅ green |
| DOC-07 | Viewer 403 in-page | `DocumentCatalogPage.component.test.tsx` | ✅ green |
| DOC-08 | Checklist GET plus PATCH with singular `field` | `ProjectChecklistPage.component.test.tsx` | ✅ green |
| DOC-08 | Hub Document checklist card | `page.checklist-card.test.ts` | ✅ green |
| DOC-09 | Compliance GET plus filters | `DocumentCompliancePage.component.test.tsx` | ✅ green |
| DOC-09 | VirtualRows when projects greater than 100 | `DocumentCompliancePage.component.test.tsx` | ✅ green |
| AUDIT-02 | Audit GET plus expand JSON in pre | `AuditLogPage.component.test.tsx` | ✅ green |
| AUDIT-02 | VirtualRows when audit rows greater than 100 | `AuditLogPage.component.test.tsx` | ✅ green |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | DOC-07 | T-23-02 | Consume GET `/api/document-catalog` only | component | `npx vitest run --project jsdom modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx` | ✅ | ✅ green |
| 23-01-02 | 01 | 1 | DOC-07 | T-23-01 | NAV hide is not authz | component | `npx vitest run --project jsdom components/layout/Sidebar.documents-nav.component.test.tsx components/layout/Sidebar.weekly-nav.component.test.tsx components/layout/Sidebar.dashboard-nav.component.test.tsx` | ✅ | ✅ green |
| 23-01-03 | 01 | 1 | DOC-07 | T-23-01 | 401/403 in-page; rely on withAuth | component | `npx vitest run --project jsdom modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx` | ✅ | ✅ green |
| 23-02-01 | 02 | 2 | DOC-07 | T-23-03 | Create POST uses existing withCpmo route | component | `npx vitest run --project jsdom modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx` | ✅ | ✅ green |
| 23-02-02 | 02 | 2 | DOC-07 | T-23-03 | Edit/retire PATCH uses existing withCpmo route | component | `npx vitest run --project jsdom modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx` | ✅ | ✅ green |
| 23-02-03 | 02 | 2 | DOC-07 | T-23-04 | Template URL-only HTTPS; retire `{ retire: true }` | component | `npx vitest run --project jsdom modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx` | ✅ | ✅ green |
| 23-03-01 | 03 | 2 | DOC-08 | T-23-05 | withProjectAccess GET; required re-export | component | `npx vitest run --project jsdom modules/documents/ui/checklist/ProjectChecklistPage.component.test.tsx` | ✅ | ✅ green |
| 23-03-02 | 03 | 2 | DOC-08 | T-23-05 / T-23-06 | PATCH allowlisted keys; 400 `{ error, field }` singular | component | `npx vitest run --project jsdom modules/documents/ui/checklist/ProjectChecklistPage.component.test.tsx` | ✅ | ✅ green |
| 23-03-03 | 03 | 2 | DOC-08 | T-23-05 | Hub card only; v1 Documents href kept | node | `npx vitest run --project node app/projects/[id]/page.checklist-card.test.ts` | ✅ | ✅ green |
| 23-04-01 | 04 | 2 | DOC-09 | T-23-07 | withCpmo GET compliance | component | `npx vitest run --project jsdom modules/documents/ui/compliance/DocumentCompliancePage.component.test.tsx` | ✅ | ✅ green |
| 23-04-02 | 04 | 2 | DOC-09 | T-23-07 | Filters stay on COMPLIANCE_FILTER_KEYS | component | `npx vitest run --project jsdom modules/documents/ui/compliance/DocumentCompliancePage.component.test.tsx` | ✅ | ✅ green |
| 23-04-03 | 04 | 2 | DOC-09 | T-23-SC | Grid consumes in-repo VirtualRows; no npm | component | `npx vitest run --project jsdom modules/documents/ui/compliance/DocumentCompliancePage.component.test.tsx modules/weekly/ui/shared/VirtualRows.component.test.tsx` | ✅ | ✅ green |
| 23-05-01 | 05 | 2 | AUDIT-02 | T-23-09 | withCpmo GET `/api/audit` only | component | `npx vitest run --project jsdom modules/audit/ui/AuditLogPage.component.test.tsx` | ✅ | ✅ green |
| 23-05-02 | 05 | 2 | AUDIT-02 | T-23-08 | Snapshots as pre text via JSON.stringify | component | `npx vitest run --project jsdom modules/audit/ui/AuditLogPage.component.test.tsx` | ✅ | ✅ green |
| 23-05-03 | 05 | 2 | AUDIT-02 | T-23-10 / T-23-SC | Window uses in-repo VirtualRows; no npm | component | `npx vitest run --project jsdom modules/audit/ui/AuditLogPage.component.test.tsx modules/weekly/ui/shared/VirtualRows.component.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Wave 0 infrastructure: `vitest.config.ts` already collects `modules/**` (Phase 21). Test files are created during TDD RED of each task.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- [x] `vitest.config.ts` jsdom include `{components,app,modules}/**/*.test.tsx` and `*.component.test.tsx`
- [x] `vitest.config.ts` node include `{lib,app,eslint,modules}/**/*.test.ts`
- [x] `modules/weekly/ui/shared/VirtualRows.tsx` reused for compliance/audit (no new virtualizer)

Test files listed in the per-task map are created by TDD RED, not pre-stubbed.

---

## Manual-Only Verifications

All listed behaviors have automated verification. End-of-phase `human_verify_mode` visual pass is orchestrator-owned, not a per-task checkpoint.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` confirmed by `/gsd-validate-phase` after execute

**Approval:** approved 2026-08-28 — 15/15 tasks green; 70 tests passing (69 jsdom + 1 node)

---

## Nyquist Run Log

| Date | Command | Result |
|------|---------|--------|
| 2026-08-28 | (plan-time) per-task map authored | 15 tasks mapped |
| 2026-08-28 | `npx vitest run --project jsdom modules/documents modules/audit components/layout/Sidebar.*.component.test.tsx modules/weekly/ui/shared/VirtualRows.component.test.tsx` | 8 files, 69 tests passed |
| 2026-08-28 | `npx vitest run --project node app/projects/[id]/page.checklist-card.test.ts` | 1 file, 1 test passed |
