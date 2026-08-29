# Phase 23: Document Checklist & Audit Viewer - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 27 new/modified files
**Analogs found:** 25 / 27

## CONTEXT overrides analog copy

Copy structure (hooks, fetch guards, Sidebar `cn()`, Card density, test mocks) from analogs. **Do not copy analog strings or enums** — `23-CONTEXT.md` and `23-RESEARCH.md` win:

| Analog (do not copy) | Locked (use this) |
|----------------------|-------------------|
| `You don't have access to this dashboard.` | `You don't have access to this page.` |
| `Couldn't load the dashboard.` | `Couldn't load this page. Try again.` |
| Weekly report `{ error, fields[] }` on 400 | Checklist PATCH uses `{ error, field? }` (singular) per `lib/api-errors.ts` |
| Hub card VN descriptions on other cards | Checklist card: **Document checklist** / **Complete Confluence evidence for this stage.** (D-15) |
| v1 `/projects/[id]/documents` route | Parallel surface at `/projects/[id]/document-checklist` only (D-06) |
| Template retire `{ active: false }` | Template retire `{ retire: true }` on PATCH |

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/documents/catalog/page.tsx` | route | request-response | `app/dashboards/portfolio/page.tsx` | exact |
| `app/documents/compliance/page.tsx` | route | request-response | `app/dashboards/portfolio/page.tsx` | exact |
| `app/audit/page.tsx` | route | request-response | `app/dashboards/portfolio/page.tsx` | exact |
| `app/projects/[id]/document-checklist/page.tsx` | route | request-response | `app/weekly/reports/[projectId]/[reportId]/page.tsx` | exact |
| `modules/documents/ui/catalog/DocumentCatalogPage.tsx` | component | request-response + CRUD | `modules/weekly/ui/periods/WeeklyPeriodsPage.tsx` | exact |
| `modules/documents/ui/catalog/useDocumentCatalog.ts` | hook | CRUD | `modules/weekly/ui/periods/useWeeklyPeriods.ts` | exact |
| `modules/documents/ui/catalog/CatalogList.tsx` | component | transform | `modules/weekly/ui/periods/WeeklyPeriodList.tsx` | exact |
| `modules/documents/ui/catalog/CatalogForm.tsx` | component | CRUD | `modules/weekly/ui/periods/WeeklyConfigForm.tsx` + create form block in `WeeklyPeriodsPage.tsx` | role-match |
| `modules/documents/ui/catalog/TemplatePanel.tsx` | component | CRUD | `modules/weekly/ui/periods/WeeklyPeriodList.tsx` (selected-row panel) | role-match |
| `modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx` | test | request-response | `modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx` | exact |
| `modules/documents/ui/compliance/DocumentCompliancePage.tsx` | component | request-response | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` | exact |
| `modules/documents/ui/compliance/useDocumentCompliance.ts` | hook | request-response | `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts` | exact |
| `modules/documents/ui/compliance/ComplianceFiltersBar.tsx` | component | request-response | `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx` | exact |
| `modules/documents/ui/compliance/ComplianceTable.tsx` | component | transform | `modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx` + `TrackingGrid.tsx` VirtualRows gate | partial |
| `modules/documents/ui/compliance/DocumentCompliancePage.component.test.tsx` | test | request-response | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx` | exact |
| `modules/documents/ui/checklist/ProjectChecklistPage.tsx` | component | request-response + CRUD | `modules/weekly/ui/report/WeeklyReportEditorPage.tsx` | exact |
| `modules/documents/ui/checklist/useProjectChecklist.ts` | hook | CRUD | `modules/weekly/ui/report/useWeeklyReportEditor.ts` | role-match |
| `modules/documents/ui/checklist/ChecklistItemRow.tsx` | component | CRUD | `modules/weekly/ui/report/WeeklyReportForm.tsx` (inline field + PATCH) | role-match |
| `modules/documents/ui/checklist/ProjectChecklistPage.component.test.tsx` | test | request-response | `modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx` | exact |
| `modules/documents/ui/shared/types.ts` | utility | transform | `modules/dashboards/ui/shared/types.ts` | exact |
| `modules/documents/ui/shared/documents.fixture.ts` | test | transform | `modules/weekly/ui/shared/weekly.fixture.ts` | exact |
| `modules/audit/ui/AuditLogPage.tsx` | component | request-response | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` | exact |
| `modules/audit/ui/useAuditLog.ts` | hook | request-response | `modules/weekly/ui/periods/useWeeklyPeriods.ts` | exact |
| `modules/audit/ui/AuditFiltersBar.tsx` | component | request-response | `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx` | role-match |
| `modules/audit/ui/AuditTable.tsx` | component | transform | `modules/weekly/ui/tracking/TrackingGrid.tsx` + expand toggle from `app/projects/[id]/budget/page.tsx` | partial |
| `modules/audit/ui/AuditLogPage.component.test.tsx` | test | request-response | `modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx` | exact |
| `components/layout/Sidebar.tsx` | component | request-response | CPMO weekly block (lines 194–222) | exact |
| `components/layout/Sidebar.documents-nav.component.test.tsx` | test | request-response | `components/layout/Sidebar.weekly-nav.component.test.tsx` | exact |
| `app/projects/[id]/page.tsx` | component | request-response | existing `QUICK_LINKS` grid (lines 74–82, 490–506) | exact |

## Pattern Assignments

### Thin App Router re-exports (4 route files)

**Analog:** `app/dashboards/portfolio/page.tsx`

**Re-export pattern** (lines 1–3):

```typescript
'use client';

export { default } from '@/modules/dashboards/ui/portfolio/PortfolioDashboardPage';
```

**Apply to:**

| Route file | Module import |
|------------|---------------|
| `app/documents/catalog/page.tsx` | `@/modules/documents/ui/catalog/DocumentCatalogPage` |
| `app/documents/compliance/page.tsx` | `@/modules/documents/ui/compliance/DocumentCompliancePage` |
| `app/audit/page.tsx` | `@/modules/audit/ui/AuditLogPage` |
| `app/projects/[id]/document-checklist/page.tsx` | `@/modules/documents/ui/checklist/ProjectChecklistPage` |

Project checklist re-export is one line; do not duplicate editor logic in `app/`.

---

### `modules/documents/ui/catalog/DocumentCatalogPage.tsx` (component, request-response + CRUD)

**Analog:** `modules/weekly/ui/periods/WeeklyPeriodsPage.tsx`

**Page shell + ERROR_COPY** (lines 14–18, 25–51, 57–59):

```typescript
const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;

if (loading) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading document catalog…</p>
        </div>
      </main>
    </div>
  );
}
```

**Primary CTA** (lines 84–92):

```typescript
<Button
  size="sm"
  className="bg-blue-600 text-white hover:bg-blue-700"
  onClick={...}
>
  Create catalog entry
</Button>
```

**Layout (D-14):** One page — `CatalogList` above, `TemplatePanel` below for selected catalog row. Mirror weekly periods zone order (config → create → list).

---

### `modules/documents/ui/catalog/useDocumentCatalog.ts` (hook, CRUD)

**Analog:** `modules/weekly/ui/periods/useWeeklyPeriods.ts`

**Imports + error tristate** (lines 1–20, 22–44):

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type DocumentCatalogError = 'unauthorized' | 'forbidden' | 'load_failed';

export function useDocumentCatalog() {
  const [data, setData] = useState<CatalogRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DocumentCatalogError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/document-catalog');
      if (res.status === 401) { setError('unauthorized'); setData(null); return; }
      if (res.status === 403) { setError('forbidden'); setData(null); return; }
      if (!res.ok) { setError('load_failed'); setData(null); return; }
      setData(await res.json());
      setError(null);
    } catch {
      setError('load_failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);
```

**POST create + reload** (lines 82–108 — adapt for catalog POST):

```typescript
const createCatalog = useCallback(async (payload: CreateCatalogPayload) => {
  const res = await fetch('/api/document-catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    toast.error("Couldn't save catalog entry — try again.");
    return;
  }
  toast.success('Catalog entry saved');
  await load();
}, [load]);
```

**Soft retire:** PATCH `/api/document-catalog/[id]` with `{ active: false }`. Template retire uses separate endpoint `{ retire: true }` (see RESEARCH Pitfall 5).

---

### `modules/documents/ui/catalog/CatalogList.tsx` (component, transform)

**Analog:** `modules/weekly/ui/periods/WeeklyPeriodList.tsx`

**Table shell + empty state** (lines 26–48):

```typescript
<section data-testid="catalog-list" className="mt-6">
  <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-8 px-2 text-xs">Name</TableHead>
          {/* stage, mandatory, active, actions */}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={COLUMN_COUNT} className="p-2 text-sm text-center py-12">
              <p className="font-semibold text-slate-600">No catalog entries yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create the first document type for your company above.
              </p>
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id} onClick={() => onSelect(row.id)}>...</TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
</section>
```

Row click selects catalog row for `TemplatePanel` (D-14).

---

### `modules/documents/ui/compliance/DocumentCompliancePage.tsx` (component, request-response)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx`

**Filters + table wiring** (lines 22–24, 57–101):

```typescript
export default function DocumentCompliancePage() {
  const { data, loading, refreshing, error, saveFilters, clearFilters } =
    useDocumentCompliance();

  // same loading/error shell as PortfolioDashboardPage

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
        <div className="mb-4">
          <h1 className="text-base font-semibold">Document compliance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.projects.length} project{data.projects.length === 1 ? '' : 's'}
          </p>
        </div>
        <ComplianceFiltersBar
          filters={data.filters}
          refreshing={refreshing}
          onApply={saveFilters}
          onClear={clearFilters}
        />
        <ComplianceTable projects={data.projects} />
      </main>
    </div>
  );
}
```

Compliance filters expose **only** `stage`, `status`, `rag`, `program` (RESEARCH Pitfall 6).

---

### `modules/documents/ui/compliance/useDocumentCompliance.ts` (hook, request-response)

**Analog:** `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts`

**GET with query string** (adapt lines 19–54):

```typescript
const load = useCallback(async (filters?: ComplianceFilters, isRefresh = false) => {
  const qs = new URLSearchParams();
  if (filters?.stage) qs.set('stage', filters.stage);
  if (filters?.status) qs.set('status', filters.status);
  if (filters?.rag) qs.set('rag', filters.rag);
  if (filters?.program) qs.set('program', String(filters.program));

  const res = await fetch(`/api/dashboards/document-compliance?${qs}`);
  if (res.status === 401) { setError('unauthorized'); return; }
  if (res.status === 403) { setError('forbidden'); return; }
  if (!res.ok) { setError('load_failed'); return; }
  setData(await res.json());
}, []);
```

Trust API `compliance` field (`compliant` | `not_compliant` | `not_applicable`) — do not recompute client-side.

---

### `modules/documents/ui/compliance/ComplianceFiltersBar.tsx` (component, request-response)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx`

**FieldRow + draft/apply pattern** (lines 10–17, 69–80):

```typescript
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

const selectClass =
  'h-8 text-sm border border-input rounded-md px-2 bg-white min-w-[100px] max-w-[200px] truncate';
```

Apply button triggers hook reload with draft filters; Clear resets to empty query.

---

### `modules/documents/ui/compliance/ComplianceTable.tsx` (component, transform)

**Analog:** `modules/weekly/ui/tracking/TrackingGrid.tsx` (VirtualRows gate)

**VirtualRows when >100 rows** (lines 120–128):

```typescript
import VirtualRows, { ROW_HEIGHT } from '@/modules/weekly/ui/shared/VirtualRows';

{projects.length > 100 ? (
  <VirtualRows
    items={projects}
    height={480}
    rowHeight={ROW_HEIGHT}
    rowKey={(row) => row.project_id}
    renderRow={(row) => <ComplianceRow project={row} />}
  />
) : (
  projects.map((row) => <ComplianceRow key={row.project_id} project={row} />)
)}
```

Prefer direct cross-module import (Phase 22 precedent for `downloadBlob`).

---

### `modules/documents/ui/checklist/ProjectChecklistPage.tsx` (component, request-response + CRUD)

**Analog:** `modules/weekly/ui/report/WeeklyReportEditorPage.tsx`

**Project-scoped Sidebar + params** (lines 55–76):

```typescript
export default function ProjectChecklistPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { items, loading, error, patchItem, fieldError } = useProjectChecklist(projectId);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar projectId={projectId} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 text-sm">Loading checklist…</p>
        </main>
      </div>
    );
  }
```

No file inputs; status enum values from API as-is (D-11): `none`, `drafting`, `pending_approval`, `approved`, `not_applicable`.

---

### `modules/documents/ui/checklist/useProjectChecklist.ts` (hook, CRUD)

**Analog:** `modules/weekly/ui/report/useWeeklyReportEditor.ts` (adapt for singular `field`)

**PATCH with inline 400 handling** (adapt lines 141–168):

```typescript
const patchItem = useCallback(async (itemId: number, body: ChecklistPatchBody) => {
  setFieldError(null);
  const res = await fetch(`/api/projects/${projectId}/document-checklist/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 400) {
    const err = (await res.json()) as { error?: string; field?: string };
    setFieldError({ message: err.error ?? 'Validation failed', field: err.field });
    return false;
  }
  if (!res.ok) {
    toast.error("Couldn't save checklist item — try again.");
    return false;
  }
  toast.success('Checklist updated');
  await load();
  return true;
}, [projectId, load]);
```

**Server rules to mirror in UI** (`lib/documents/checklist-status.ts` lines 39–60):
- `approved` → require `approved_at`, `approved_by`, HTTPS `confluence_url`
- `not_applicable` → require `na_reason`
- `pending_approval` → require HTTPS `confluence_url`

---

### `modules/documents/ui/checklist/ChecklistItemRow.tsx` (component, CRUD)

**Analog:** `modules/weekly/ui/report/WeeklyReportForm.tsx` + validation display pattern

**Inline field error** (map `fieldError.field` to input):

```typescript
{fieldError?.field === 'confluence_url' && (
  <p className="text-xs text-red-600 mt-1">{fieldError.message}</p>
)}
```

Use shadcn `Select`, `Input`, `Label`; two font weights only (400 + 600).

---

### `modules/audit/ui/AuditLogPage.tsx` (component, request-response)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx`

Same page shell as compliance. Title: **Audit log**. Read-only — no PATCH/DELETE UI (D-08).

---

### `modules/audit/ui/useAuditLog.ts` (hook, request-response)

**Analog:** `modules/weekly/ui/periods/useWeeklyPeriods.ts`

**GET with filters** (adapt for `/api/audit`):

```typescript
const qs = new URLSearchParams();
if (filters.entity_type) qs.set('entity_type', filters.entity_type);
if (filters.entity_id) qs.set('entity_id', filters.entity_id);
if (filters.from) qs.set('from', filters.from);
if (filters.to) qs.set('to', filters.to);
if (filters.limit) qs.set('limit', String(filters.limit));

const res = await fetch(`/api/audit?${qs}`);
```

Default limit 50; clamp UI input to 50–200 per API.

---

### `modules/audit/ui/AuditTable.tsx` (component, transform)

**Analog:** `modules/weekly/ui/tracking/TrackingGrid.tsx` + expand toggle from `app/projects/[id]/budget/page.tsx`

**Expand row + JSON `<pre>`** (D-10 — no `dangerouslySetInnerHTML`):

```typescript
function formatJson(value: unknown): string {
  if (value == null) return '—';
  return JSON.stringify(value, null, 2);
}

const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

// Toggle button pattern from budget page lines 613–620:
<button onClick={() => toggleExpand(row.id)} className="p-0.5 rounded hover:bg-slate-100">
  {expandedIds.has(row.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
</button>

{expandedIds.has(row.id) && (
  <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50">
    <pre className="overflow-auto max-h-64 text-xs p-2 bg-white border rounded">{formatJson(row.before)}</pre>
    <pre className="overflow-auto max-h-64 text-xs p-2 bg-white border rounded">{formatJson(row.after)}</pre>
  </div>
)}
```

Use `VirtualRows` when `rows.length > 100` (same gate as compliance).

---

### `components/layout/Sidebar.tsx` (component, request-response)

**Analog:** CPMO weekly block (lines 194–222)

**Insert after weekly links, before NAV_SECONDARY** (D-02):

```typescript
{me?.roles?.includes('cpmo') ? (
  <>
    {/* existing Weekly periods + Weekly tracking */}
    <Link
      href="/documents/catalog"
      onClick={onNavClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
        pathname === '/documents/catalog' || pathname.startsWith('/documents/catalog')
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      )}
    >
      <FileText className="h-4 w-4 shrink-0" />
      Catalog
    </Link>
    <Link href="/documents/compliance" ...>Compliance</Link>
    <Link href="/audit" ...>Audit log</Link>
  </>
) : null}
```

Retarget global `/documents` NAV_PROJECT link only if it 404s for CPMO; do **not** add PM checklist to global nav (D-02).

---

### `app/projects/[id]/page.tsx` (component, request-response)

**Analog:** existing `QUICK_LINKS` (lines 74–82, 490–506)

**Add hub card — keep v1 Documents card** (D-06, D-15):

```typescript
const QUICK_LINKS = [
  // ... existing links including { href: '/documents', label: 'Documents', ... }
  {
    href: '/document-checklist',
    icon: ListChecks, // or ClipboardCheck — lucide
    label: 'Document checklist',
    desc: 'Complete Confluence evidence for this stage.',
  },
];
```

Card href resolves to `/projects/${id}/document-checklist` via existing `Link` template:

```typescript
<Link key={href} href={`/projects/${id}${href}`}>
```

---

### Component tests (4 page tests + Sidebar test)

**Analog:** `modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx`

**Standard mocks** (lines 6–16):

```typescript
vi.mock('next/navigation', () => ({ usePathname: () => '/documents/catalog' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
```

**Project checklist test** — add `useParams` mock per `WeeklyReportEditorPage.component.test.tsx` lines 9–15:

```typescript
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '42' }),
  usePathname: () => '/projects/42/document-checklist',
}));
vi.mock('@/components/layout/Sidebar', () => ({
  default: ({ projectId }: { projectId?: string }) => (
    <nav data-testid="sidebar" data-project-id={projectId} />
  ),
}));
```

**Required test cases per surface:**
- Loading copy + sidebar present
- 403 forbidden in-page (no redirect)
- 401 session expired in-page
- 200 renders primary content
- Catalog: POST create refreshes list
- Checklist: PATCH 400 shows inline error on named `field`
- Compliance: filter apply builds correct query string
- Audit: expand row renders pretty-printed JSON in `<pre>`

**Sidebar test analog:** `components/layout/Sidebar.weekly-nav.component.test.tsx` — stub `/api/auth/me` with `roles: ['cpmo']`, assert Catalog/Compliance/Audit log links; hide for `pm`/`viewer`.

---

### `modules/documents/ui/shared/types.ts` (utility, transform)

**Analog:** `modules/dashboards/ui/shared/types.ts`

Client-safe types only — do not import `lib/services` or `lib/repositories`. Mirror API JSON shapes:

```typescript
export type CatalogRow = { id: number; name: string; stage: string; mandatory: boolean; active: boolean; ... };
export type TemplateRow = { id: number; catalog_id: number; template_url: string; ... };
export type ChecklistItem = { id: number; status: string; confluence_url: string | null; ... };
export type ComplianceProject = { project_id: number; name: string; compliance: string; ... };
export type AuditLogRow = { id: number; actor_id: number; entity_type: string; entity_id: number; action: string; before: unknown; after: unknown; created_at: string };
```

Import enums/constants from `lib/documents/checklist-status.ts` only if tree-shake safe; otherwise duplicate string unions in types file.

---

### `modules/documents/ui/shared/documents.fixture.ts` (test, transform)

**Analog:** `modules/weekly/ui/shared/weekly.fixture.ts`

Export: `catalogFixture`, `templatesFixture`, `checklistFixture`, `complianceFixture`, `auditRowsFixture`, `auditRows150` (for VirtualRows gate test).

---

## Shared Patterns

### Page shell (loading / error / main)

**Source:** `modules/weekly/ui/periods/WeeklyPeriodsPage.tsx` lines 25–59  
**Apply to:** All four page components (`DocumentCatalogPage`, `DocumentCompliancePage`, `ProjectChecklistPage`, `AuditLogPage`)

```typescript
const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;
```

Project-scoped pages pass `projectId` to `<Sidebar projectId={projectId} />`.

### Fetch hook auth tristate

**Source:** `modules/weekly/ui/periods/useWeeklyPeriods.ts` lines 30–44  
**Apply to:** All `use*.ts` hooks

```typescript
if (res.status === 401) { setError('unauthorized'); setData(null); return; }
if (res.status === 403) { setError('forbidden'); setData(null); return; }
if (!res.ok) { setError('load_failed'); setData(null); return; }
```

### Primary CTA styling

**Source:** `modules/weekly/ui/periods/WeeklyPeriodsPage.tsx` line 88  
**Apply to:** All form submit / create buttons

```typescript
className="bg-blue-600 text-white hover:bg-blue-700"
```

### Validation error shape (checklist PATCH)

**Source:** `lib/api-errors.ts` lines 51–54  
**Apply to:** `useProjectChecklist.ts`, `ChecklistItemRow.tsx`

```typescript
if (e instanceof ValidationError) {
  const body: { error: string; field?: string } = { error: e.message };
  if (e.field !== undefined) body.field = e.field;
  return NextResponse.json(body, { status: 400 });
}
```

Do **not** use `fields[]` array — that is `SubmitValidationError` for weekly report submit, not checklist PATCH.

### VirtualRows for long lists

**Source:** `modules/weekly/ui/shared/VirtualRows.tsx`  
**Apply to:** `ComplianceTable.tsx`, `AuditTable.tsx` when `items.length > 100`

```typescript
import VirtualRows, { ROW_HEIGHT } from '@/modules/weekly/ui/shared/VirtualRows';
```

### CPMO Sidebar role gate

**Source:** `components/layout/Sidebar.tsx` lines 194–222  
**Apply to:** Catalog, Compliance, Audit log links only

```typescript
{me?.roles?.includes('cpmo') ? ( /* links */ ) : null}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `modules/audit/ui/AuditTable.tsx` expand-row JSON panel | component | transform | No existing audit/JSON viewer; combine TrackingGrid VirtualRows + budget expand toggle + RESEARCH `formatJson` snippet |

## Metadata

**Analog search scope:** `modules/weekly/ui/**`, `modules/dashboards/ui/**`, `app/dashboards/**`, `app/weekly/**`, `components/layout/Sidebar.tsx`, `app/projects/[id]/page.tsx`, `lib/api-errors.ts`, `lib/documents/checklist-status.ts`
**Files scanned:** ~45
**Pattern extraction date:** 2026-08-28
