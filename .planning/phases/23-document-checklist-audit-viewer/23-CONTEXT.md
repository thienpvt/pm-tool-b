# Phase 23: Document Checklist & Audit Viewer - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

CPMO manages the document catalog and templates, PMs complete Confluence checklists, and CPMO inspects compliance plus the company audit trail — all in React UI consuming existing Phase 17/18 APIs.

**Requirements:** DOC-07, DOC-08, DOC-09, AUDIT-02

**In:**
- React pages under `modules/documents/ui/` and `modules/audit/ui/` with thin `app/` re-exports (Phase 21/22 pattern)
- Catalog + URL-only templates (existing `/api/document-catalog`, `/api/document-templates`)
- Per-project Confluence checklist (existing `/api/projects/[id]/document-checklist`)
- CPMO document compliance (existing `/api/dashboards/document-compliance`)
- CPMO audit log viewer (existing `GET /api/audit` with filters; before/after JSON)
- Sidebar links for CPMO catalog/compliance/audit; PM reaches checklist from the project hub without overwriting v1 `/projects/[id]/documents`
- Component tests with mocked fetch

**Out:**
- Rewriting Phase 17/18 APIs
- Overwriting v1 project document dump at `/projects/[id]/documents` (Phase 17 D-01 parallel surface)
- Binary checklist uploads
- Repo-wide module split (Phase 24)
- New npm packages
- Kysely / RSC chrome (25–26)

</domain>

<decisions>
## Implementation Decisions

### Layout and routes
- **D-01:** Implement under `modules/documents/ui/` and `modules/audit/ui/` with thin App Router re-exports. URLs: `/documents/catalog` (CPMO catalog + templates), `/documents/compliance` (CPMO compliance), `/projects/[id]/document-checklist` (PM checklist), `/audit` (CPMO audit). Do not overwrite `/projects/[id]/documents`.
- **D-02:** Sidebar: add CPMO-only **Catalog**, **Compliance**, and **Audit log** after weekly NAV (same role-gate pattern as dashboards/weekly). Do not put a PM checklist item on global NAV — PMs open it from the project hub (`app/projects/[id]/page.tsx` card) using `/projects/{id}/document-checklist`. Existing `/documents` NAV_PRIMARY link: if it has no page, retarget it to `/documents/catalog` for cpmo only or leave it; planner must not 404 CPMO. Honor existing hrefs if any Phase 16/17 APIs emit them.
- **D-03:** Consume existing APIs only. No new document or audit endpoints.

### Catalog and templates (DOC-07)
- **D-04:** Catalog list/create/update (soft-retire `active=false`) via existing catalog routes. Template list/create uses URL-only `template_url` (existing schema). Viewer 403 in-page. English copy matching Phase 21/22 density. Primary CTAs `bg-blue-600`. Two font weights only (400 + 600).

### PM checklist (DOC-08)
- **D-05:** Editor loads GET checklist; PATCH item with Confluence HTTPS URL and status None/Drafting/Pending approval/Approved/Not applicable. Approved requires date+approver fields the API already enforces; N/A requires reason. Show 400 `{ error, fields }` inline. No file input.
- **D-06:** Do not invent a second document dump UI; v1 `/projects/[id]/documents` stays.

### Compliance (DOC-09)
- **D-07:** Compliance page GET `/api/dashboards/document-compliance` with existing query filters. 403 in-page.

### Audit viewer (AUDIT-02)
- **D-08:** Audit page GET `/api/audit` with entity_type, entity_id, from, to, limit. Table of actor/time/entity/action. Expanding a row shows before/after JSON (read-only `<pre>` / text, no `dangerouslySetInnerHTML`). Viewer/PM 403 in-page. No PATCH/DELETE UI.
- **D-09:** If the list can exceed ~100 rows, reuse `modules/weekly/ui/shared/VirtualRows` (or a documents/audit copy if cross-module import is awkward). No new npm virtualizer.

### Locked research defaults (autonomous)
- **D-10:** JSON snapshots render as pretty-printed text in a scrollable panel, not a custom JSON tree widget.
- **D-11:** Checklist status uses the API enum as-is; do not invent extra statuses.
- **D-12:** Catalog `apply_to_in_flight` is a checkbox on create/update, posted only when the existing API field exists.
- **D-13:** Checklist 400 bodies use `{ error, field }` (singular) from `lib/api-errors.ts`. Show that field inline. Do not invent a `fields[]` array.
- **D-14:** Catalog UI is one page: catalog table plus a template panel for the selected catalog row.
- **D-15:** Project hub card label **Document checklist**, body **Complete Confluence evidence for this stage.**, href `/projects/{id}/document-checklist`.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 23
- `.planning/REQUIREMENTS.md` — DOC-07, DOC-08, DOC-09, AUDIT-02
- `.planning/milestones/v2.0-phases/17-document-templates-confluence-checklist/17-CONTEXT.md`
- `.planning/milestones/v2.0-phases/18-append-only-audit-log/18-CONTEXT.md`
- `app/api/document-catalog/**`, `app/api/document-templates/**`
- `app/api/projects/[id]/document-checklist/**`
- `app/api/dashboards/document-compliance/**`
- `app/api/audit/**`
- `.planning/phases/22-weekly-workflow-surfaces/22-CONTEXT.md` — module + re-export + VirtualRows pattern
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Catalog/template/checklist/compliance/audit APIs already gated
- Phase 21/22 page shell (Sidebar + loading/error Copywriting)
- `VirtualRows` in `modules/weekly/ui/shared/`
- Sidebar role-aware NAV

### Established Patterns
- `modules/<feature>/ui` + `app/<route>/page.tsx` re-export
- Client `fetch` hooks; 401/403 in-page

### Integration Points
- Project hub card should deep-link to the spec checklist URL
- Do not replace v1 documents dump
</code_context>

<specifics>
## Specific Ideas

Grey areas auto-accepted: module layout, consume APIs, URL-only templates, no audit write UI, reuse VirtualRows if lists are long, do not replace v1 `/projects/[id]/documents`.
</specifics>

<deferred>
## Deferred Ideas

- Repo-wide module split — Phase 24
- Binary uploads
</deferred>
