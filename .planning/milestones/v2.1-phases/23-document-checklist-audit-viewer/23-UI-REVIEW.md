# Phase 23 — UI Review

**Audited:** 2026-08-28
**Baseline:** `23-UI-SPEC.md` (approved design contract)
**Screenshots:** not captured (code-only audit per orchestrator request)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract copy largely matched; compliance badges and several template strings diverge |
| 2. Visuals | 3/4 | Compact table hierarchy solid; semantic badge styling and compliance scanability gaps |
| 3. Color | 3/4 | Slate/white/blue shell correct; catalog Active badge and accent link spread need tightening |
| 4. Typography | 4/4 | `text-xs`/`text-sm`/`text-base` and two-weight scale adhered across all surfaces |
| 5. Spacing | 3/4 | Page shell and table density match Phase 21/22; recurring `space-y-1.5` off-scale |
| 6. Experience Design | 3/4 | Loading/error/empty coverage strong; template retire lacks confirmation; audit expand drops virtualization |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **Humanize compliance badge labels** — Raw `compliant` / `not_compliant` / `not_applicable` enums in the Compliance column hurt CPMO scan speed — Map to "Compliant", "Not compliant", "Not applicable" in `ComplianceTable.tsx` `ComplianceBadge` (keep semantic background classes).
2. **Apply green outline to Active catalog status** — Active and Retired both use generic `Badge variant="outline"` — Give Active rows `border-green-600 text-green-700` (or equivalent) per UI-SPEC semantic badge table; keep Retired slate/muted.
3. **Add confirmation before template retire** — "Retire template" fires immediately with no dialog — Mirror catalog retire pattern: confirmation title/body plus destructive primary; align toast copy with Copywriting Contract or extend contract explicitly.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**WARNING — Compliance column shows API enum strings**

`ComplianceTable.tsx` renders `{compliance}` directly inside the badge (line 41), producing `compliant`, `not_compliant`, and `not_applicable` instead of human labels. UI-SPEC semantic badges imply readable status text for CPMO dashboards.

**WARNING — Checklist Confluence column link label**

`ChecklistItemRow.tsx` line 146 uses `"Open"` in the collapsed table cell, while the row editor correctly uses `"Open in Confluence"` (line 218). Inconsistent with the Copywriting Contract secondary CTA.

**WARNING — Undocumented template strings**

Not in Copywriting Contract but present in code:

| Location | String |
|----------|--------|
| `TemplatePanel.tsx:104` | `Loading templates…` |
| `TemplatePanel.tsx:167` | `Retire template` |
| `useDocumentCatalog.ts:198,205` | `Couldn't publish template — try again.` |
| `useDocumentCatalog.ts:227` | `Template retired` |

**PASS — Core contract strings verified**

Page titles, loading strings, empty states, error panels, primary CTAs (`Add catalog item`, `Save catalog item`, `Publish template`, `Save checklist item`, `Apply filters`, `Retire item`), retire dialog copy, audit subtitle, and project hub card (`Document checklist` / hub description) all match `23-UI-SPEC.md` Copywriting Contract.

**PASS — Toast messages (catalog/checklist/compliance filters)**

Catalog create/save/retire, template publish success, checklist save/validation, and filter error toasts match contract strings in hooks.

**Minor — Extra UX copy**

`ComplianceFiltersBar.tsx` adds `Clear filters` (line 180) — reasonable addition, not in contract.

---

### Pillar 2: Visuals (3/4)

**WARNING — Catalog status badges lack visual distinction**

`CatalogList.tsx` lines 155–156: both Active and Retired use `Badge variant="outline"` with no color differentiation. UI-SPEC requires Active = green outline, Retired = slate strikethrough on name (strikethrough present; badge color missing).

**WARNING — Template URL column shows document name, not URL**

`TemplatePanel.tsx` lines 137–145: external link text is `{row.name}` rather than a URL fragment or "Open" label. Users cannot distinguish links visually from the Name column duplicate.

**PASS — Page focal hierarchy**

Catalog table is primary with templates panel below (`TemplatePanel` `mt-6`). Compliance grid follows filter bar. Checklist table + inline expand editor is primary. Audit filter bar precedes expandable audit table. Headers use `text-base font-semibold` with muted subtitles.

**PASS — Compact table contract**

All four tables use `TableHead` `h-8 px-2 text-xs font-semibold` and `TableCell` `p-2 text-sm` with `overflow-x-auto` wrappers per UI-SPEC Component Contracts.

**PASS — Audit expand control**

Chevron toggle includes `aria-label="Show audit details"` and `aria-expanded` (`AuditTable.tsx` lines 65–72).

**PASS — Checklist status badge mapping**

`ChecklistItemRow.tsx` `STATUS_BADGE` implements slate/amber/green semantic variants per spec.

---

### Pillar 3: Color (3/4)

**WARNING — Active catalog badge not green**

See CatalogList finding above; accent/semantic color reserved for Active status not applied.

**WARNING — Accent blue on internal navigation links**

Compliance project names (`ComplianceTable.tsx:50`) and checklist project breadcrumb (`ProjectChecklistPage.tsx:68`) use `text-blue-600`. UI-SPEC reserves accent for primary buttons, external URLs, and sidebar active state. Internal project links could use default foreground + underline to preserve 60/30/10 balance.

**PASS — Primary CTAs**

All primary actions use `bg-blue-600 hover:bg-blue-700 text-white` as specified.

**PASS — Destructive retire dialog**

Catalog retire confirmation button uses `bg-red-600 hover:bg-red-700` (`DocumentCatalogPage.tsx:163).

**PASS — Semantic compliance/RAG badges**

`ComplianceTable.tsx` uses green/red/slate for compliance and green/amber/red for RAG — matches spec palette.

**PASS — No hardcoded hex or dangerouslySetInnerHTML**

Grep found no `#` color literals or `dangerouslySetInnerHTML` in audited modules. Loading spinners use `border-blue-500`.

---

### Pillar 4: Typography (4/4)

**PASS — Size roles**

| Role | Spec | Implementation |
|------|------|----------------|
| Body | `text-sm` (14px) | Table cells, forms, error text |
| Label | `text-xs font-semibold` | FieldRow labels, filter labels, JSON panel headers |
| Heading | `text-base font-semibold` | Page titles, card titles, empty headings |

**PASS — Weight constraint**

Only default (400) and `font-semibold` (600) appear; no `font-bold`, `font-medium`, or display sizes (`text-lg`+).

**PASS — Audit action monospace**

`AuditTable.tsx:63` uses `text-xs font-mono` for action column per contract.

**PASS — JSON pre panel**

`text-xs font-mono whitespace-pre-wrap` inside `<pre>` matches spec snippet exactly.

---

### Pillar 5: Spacing (3/4)

**PASS — Page shell**

All page components use `flex flex-col lg:flex-row min-h-screen bg-slate-50` with main `flex-1 p-4 lg:p-6 lg:p-8 overflow-auto` — matches spec.

**PASS — Table cell padding**

Consistent `p-2` (8px/sm) on cells; filter bars use `gap-2` and `p-3` on Card wrappers.

**PASS — Declared truncation exceptions**

`max-w-[200px]` used for purpose, project name, template URL, N/A reason — aligns with UI Considerations backstop rows.

**WARNING — Off-scale `space-y-1.5` (6px)**

`FieldRow` in CatalogForm, TemplatePanel, ComplianceFiltersBar, AuditFiltersBar, and ChecklistItemRow editor uses `space-y-1.5`, which is not on the declared 4px-multiple scale (xs=4, sm=8). Prefer `space-y-1` (4px) or `space-y-2` (8px).

**WARNING — Checkbox row `gap-6`**

`CatalogForm.tsx:149` uses `gap-6` (24px/lg) between checkbox labels while form fields use `gap-4` (16px/md) — minor inconsistency within the same card.

**PASS — Empty state vertical padding**

`py-12` (48px/2xl) on empty table rows matches major section break token.

---

### Pillar 6: Experience Design (3/4)

**PASS — State coverage (loading/error/empty)**

All four page shells implement spinner + contract loading copy, centered forbidden/error panel with contract strings, and empty states with contract heading + body in table colspan or dedicated blocks.

**PASS — Mutation loading disabled states**

Create catalog, publish template, save checklist, and apply filters buttons disable while in-flight (`creating`, `publishing`, `saving`, `refreshing` flags).

**PASS — Checklist inline validation**

400 `{ error, field }` maps to inline `text-red-600 text-xs` under the matching control plus validation toast (`useProjectChecklist.ts:88–95`, `ChecklistItemRow.tsx:208–282`).

**PASS — Audit JSON safety**

`JSON.stringify(value, null, 2)` in `<pre>` text content only; no `dangerouslySetInnerHTML` (`AuditTable.tsx:21–26`).

**PASS — VirtualRows threshold**

Compliance and audit tables use `VirtualRows` when count > 100 with `ROW_HEIGHT = 40` (`h-10` equivalent) — matches D-09.

**WARNING — Audit expand disables virtualization abruptly**

`AuditTable.tsx:50`: when any row expands, `useVirtual` becomes false and the full list re-renders in DOM. Functional but violates spec preference to virtualize collapsed rows only; large audit logs may jank on expand.

**WARNING — Template retire without confirmation**

`TemplatePanel.tsx:165` calls `onRetireTemplate` directly. Unlike catalog retire (dialog in `DocumentCatalogPage.tsx:150–171`), no confirmation step for a destructive PATCH.

**WARNING — Native checkboxes vs shadcn Checkbox**

`CatalogForm.tsx:151–167` uses native `<input type="checkbox">` instead of installed shadcn `Checkbox` — minor consistency gap with design system table.

**PASS — Sidebar NAV and project hub**

Sidebar inserts Catalog, Compliance, Audit log after weekly links, gated `cpmo` only (`Sidebar.tsx:196–262`). Project hub includes Document checklist card with contract label and description (`app/projects/[id]/page.tsx:82`).

**PASS — Compliance filter error handling**

400 responses trigger contract toast and inline filter error (`useDocumentCompliance.ts:49–52`).

---

## Registry Safety

Registry audit: shadcn initialized (`components.json` present). UI-SPEC lists **no third-party registries** — 0 third-party blocks checked, no flags.

---

## Files Audited

**Documents module**

- `modules/documents/ui/catalog/DocumentCatalogPage.tsx`
- `modules/documents/ui/catalog/CatalogList.tsx`
- `modules/documents/ui/catalog/CatalogForm.tsx`
- `modules/documents/ui/catalog/TemplatePanel.tsx`
- `modules/documents/ui/catalog/useDocumentCatalog.ts`
- `modules/documents/ui/compliance/DocumentCompliancePage.tsx`
- `modules/documents/ui/compliance/ComplianceFiltersBar.tsx`
- `modules/documents/ui/compliance/ComplianceTable.tsx`
- `modules/documents/ui/compliance/useDocumentCompliance.ts`
- `modules/documents/ui/checklist/ProjectChecklistPage.tsx`
- `modules/documents/ui/checklist/ChecklistItemRow.tsx`
- `modules/documents/ui/checklist/useProjectChecklist.ts`

**Audit module**

- `modules/audit/ui/AuditLogPage.tsx`
- `modules/audit/ui/AuditFiltersBar.tsx`
- `modules/audit/ui/AuditTable.tsx`
- `modules/audit/ui/useAuditLog.ts`

**Layout / routing (NAV & hub contract)**

- `components/layout/Sidebar.tsx`
- `app/projects/[id]/page.tsx`

**Reference**

- `.planning/phases/23-document-checklist-audit-viewer/23-UI-SPEC.md`
- `modules/weekly/ui/shared/VirtualRows.tsx`
