# Phase 22: Weekly Workflow Surfaces - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 26 new/modified files
**Analogs found:** 24 / 26

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/weekly/periods/page.tsx` | route | request-response | `app/dashboards/portfolio/page.tsx` | exact |
| `app/weekly/tracking/page.tsx` | route | request-response | `app/dashboards/portfolio/page.tsx` | exact |
| `app/weekly/reports/[projectId]/[reportId]/page.tsx` | route | request-response | `app/dashboards/portfolio/page.tsx` | exact |
| `app/projects/[id]/weekly-reports/[reportId]/page.tsx` | route | request-response | `app/dashboards/portfolio/page.tsx` | exact |
| `modules/weekly/ui/periods/WeeklyPeriodsPage.tsx` | component | request-response | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` | exact |
| `modules/weekly/ui/periods/useWeeklyPeriods.ts` | hook | CRUD | `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts` | exact |
| `modules/weekly/ui/periods/WeeklyConfigForm.tsx` | component | CRUD | `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx` | role-match |
| `modules/weekly/ui/periods/WeeklyPeriodList.tsx` | component | transform | `modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx` | role-match |
| `modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx` | test | request-response | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx` | exact |
| `modules/weekly/ui/tracking/WeeklyTrackingPage.tsx` | component | request-response | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` | exact |
| `modules/weekly/ui/tracking/usePeriodTracking.ts` | hook | request-response + file-I/O | `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts` | exact |
| `modules/weekly/ui/tracking/TrackingCountsBar.tsx` | component | transform | `modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx` | role-match |
| `modules/weekly/ui/tracking/TrackingFiltersBar.tsx` | component | request-response | `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx` | exact |
| `modules/weekly/ui/tracking/TrackingGrid.tsx` | component | transform | `modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx` + `VirtualRows` | partial |
| `modules/weekly/ui/tracking/ExportToolbar.tsx` | component | file-I/O | `PortfolioDashboardPage.tsx` export toolbar + hook `exportDashboard` | exact |
| `modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx` | test | request-response | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx` | exact |
| `modules/weekly/ui/report/WeeklyReportEditorPage.tsx` | component | request-response | `modules/dashboards/ui/pm/PmDashboardPage.tsx` | exact |
| `modules/weekly/ui/report/useWeeklyReportEditor.ts` | hook | CRUD | `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts` | role-match |
| `modules/weekly/ui/report/WeeklyReportForm.tsx` | component | CRUD | `app/projects/[id]/communication/page.tsx` | role-match |
| `modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx` | test | request-response | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx` | exact |
| `modules/weekly/ui/shared/VirtualRows.tsx` | component | transform | *(novel — no in-repo virtualizer)* | none |
| `modules/weekly/ui/shared/VirtualRows.component.test.tsx` | test | transform | `modules/dashboards/ui/shared/downloadBlob.test.ts` (jsdom unit) | partial |
| `modules/weekly/ui/shared/types.ts` | utility | transform | `modules/dashboards/ui/shared/types.ts` | exact |
| `modules/weekly/ui/shared/weekly.fixture.ts` | test | transform | `PortfolioDashboardPage.component.test.tsx` fixture block | exact |
| `components/layout/Sidebar.tsx` | component | request-response | existing CPMO dashboard links (lines 161–191) | exact |
| `components/layout/Sidebar.weekly-nav.component.test.tsx` | test | request-response | `components/layout/Sidebar.dashboard-nav.component.test.tsx` | exact |

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
| `app/weekly/periods/page.tsx` | `@/modules/weekly/ui/periods/WeeklyPeriodsPage` |
| `app/weekly/tracking/page.tsx` | `@/modules/weekly/ui/tracking/WeeklyTrackingPage` |
| `app/weekly/reports/[projectId]/[reportId]/page.tsx` | `@/modules/weekly/ui/report/WeeklyReportEditorPage` |
| `app/projects/[id]/weekly-reports/[reportId]/page.tsx` | same editor — **required** for Phase 16 `href` |

PM alias re-export is one line; do not duplicate editor logic in `app/`.

---

### `modules/weekly/ui/periods/WeeklyPeriodsPage.tsx` (component, request-response)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx`

**Page shell + hook wiring** (lines 1–24, 57–59):

```typescript
'use client';

import { AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { useWeeklyPeriods } from './useWeeklyPeriods';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this dashboard.",
  load_failed: "Couldn't load the dashboard. Try again.",
} as const;

export default function WeeklyPeriodsPage() {
  const { data, loading, error, createPeriod, saveConfig } = useWeeklyPeriods();
  // ...
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
```

**Loading shell** (lines 27–38): copy spinner block verbatim; change heading copy to "Loading weekly periods…".

**403/401 error panel** (lines 41–52): reuse `ERROR_COPY` keys and `AlertTriangle` centered layout — CPMO-only page, same strings as Phase 21.

**Child composition:** `WeeklyConfigForm` + `WeeklyPeriodList` below header (mirror filters + table stack on portfolio page).

---

### `modules/weekly/ui/periods/useWeeklyPeriods.ts` (hook, CRUD)

**Analog:** `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts`

**Imports + state** (lines 1–17):

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type WeeklyPeriodsError = 'unauthorized' | 'forbidden' | 'load_failed';

export function useWeeklyPeriods() {
  const [data, setData] = useState<{ periods: unknown[]; config: unknown } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WeeklyPeriodsError | null>(null);
```

**401/403/load guard** (lines 26–41):

```typescript
const res = await fetch('/api/weekly-periods');
if (res.status === 401) {
  setError('unauthorized');
  setData(null);
  return;
}
if (res.status === 403) {
  setError('forbidden');
  setData(null);
  return;
}
if (!res.ok) {
  setError('load_failed');
  setData(null);
  return;
}
```

**Mutations:** `createPeriod` → POST `/api/weekly-periods` with `{ iso_week }`; 409 duplicate → `toast.error`. `saveConfig` → PUT `/api/weekly-periods/config`; failure → `toast.error("Couldn't save filters — try again.")` (same string as portfolio filter save). Load config via parallel GET `/api/weekly-periods/config` on mount or bundled in page load.

---

### `modules/weekly/ui/periods/WeeklyConfigForm.tsx` (component, CRUD)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx`

**Field row + Card wrapper** (lines 10–16, 144–146):

```typescript
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

return (
  <Card size="sm" className="mb-4 p-3" data-testid="weekly-config-form">
```

**Select styling** (lines 22–23):

```typescript
const selectClass =
  'h-8 text-sm border border-input rounded-md px-2 bg-white min-w-[100px] max-w-[200px] truncate';
```

Fields: `due_weekday` (1–7 select), `due_time_utc` (time input). Apply button calls `onSave` prop; disable while saving.

---

### `modules/weekly/ui/periods/WeeklyPeriodList.tsx` (component, transform)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx`

**Table shell + empty state** (lines 35–61):

```typescript
export function WeeklyPeriodList({ periods }: Props) {
  return (
    <section data-testid="weekly-period-list" className="mt-6">
      <h2 className="text-base font-semibold mb-2">Periods</h2>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 px-2 text-xs">ISO week</TableHead>
            {/* display_name, due_at, status columns */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {periods.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="p-2 text-sm text-center py-12">
                <p className="font-semibold text-slate-600">No weekly periods yet</p>
```

No virtualization on period list (typically <100 rows per D-10).

---

### `modules/weekly/ui/tracking/WeeklyTrackingPage.tsx` (component, request-response)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx`

Same Sidebar + main shell. Header row mirrors portfolio export toolbar (lines 61–85):

```typescript
<div className="flex flex-wrap items-center justify-between gap-4 mb-4">
  <div>
    <h1 className="text-base font-semibold">Weekly tracking</h1>
    <p className="text-sm text-muted-foreground mt-1">{/* counts subtitle */}</p>
  </div>
  <ExportToolbar /* ... */ />
</div>
```

**Period selection (D-10):** use `useSearchParams` + `useRouter` like `app/login/page.tsx` (lines 2–3, 12–13, 34):

```typescript
import { useRouter, useSearchParams } from 'next/navigation';

const searchParams = useSearchParams();
const periodId = searchParams.get('periodId');
// invalid/missing → default to latest iso_week from GET /api/weekly-periods
// on Select change → router.replace(`/weekly/tracking?periodId=${id}`)
```

Compose: period `<Select>`, `TrackingCountsBar`, `TrackingFiltersBar`, `TrackingGrid`.

---

### `modules/weekly/ui/tracking/usePeriodTracking.ts` (hook, request-response + file-I/O)

**Analog:** `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts`

**Load with query filters** — extend fetch URL:

```typescript
const qs = new URLSearchParams({ status: 'overdue', technology_council: 'true' });
const res = await fetch(`/api/weekly-periods/${periodId}/tracking?${qs}`);
```

Same 401/403/`load_failed` mapping as portfolio hook.

**Export mutation** (lines 88–108) — adapt path and parse filename:

```typescript
const exportPack = useCallback(async (projectIds: number[], format: 'xlsx' | 'docx' | 'pptx') => {
  setExporting(true);
  try {
    const res = await fetch(`/api/weekly-periods/${periodId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_ids: projectIds, format }),
    });
    if (!res.ok) {
      toast.error('Export failed — try again.');
      return;
    }
    const cd = res.headers.get('Content-Disposition') ?? '';
    const match = /filename="([^"]+)"/.exec(cd);
    downloadBlob(await res.blob(), match?.[1] ?? 'weekly-export.xlsx');
    toast.success('Export downloaded');
  } catch {
    toast.error('Export failed — try again.');
  } finally {
    setExporting(false);
  }
}, [periodId]);
```

Import `downloadBlob` from `@/modules/dashboards/ui/shared/downloadBlob` (D-07 — reuse dashboards utility).

---

### `modules/weekly/ui/tracking/TrackingFiltersBar.tsx` (component, request-response)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx`

Copy draft-state pattern: local `draft` synced via `useEffect` when server filters change (lines 78–82). Apply button triggers refetch with query params (no PUT persist — tracking filters are ephemeral GET params per API).

Filter keys from `PeriodTrackingFilters`: `status`, `lateness`, `pm_user_id`, `stage`, `rag`, `technology_council`. Reuse `FieldRow`, `selectClass`, `Card size="sm"`, `data-testid="tracking-filter-bar"`.

---

### `modules/weekly/ui/tracking/TrackingCountsBar.tsx` (component, transform)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx`

Render count chips from `counts`: obligated, not_submitted, draft, submitted, overdue, late. Use compact Card/grid with `text-base font-semibold` numbers — same density as KPI row. Optional: clicking a count sets filter `status` (Claude's discretion).

---

### `modules/weekly/ui/tracking/TrackingGrid.tsx` (component, transform)

**Analog:** `PortfolioProjectTable.tsx` structure + novel `VirtualRows` for body rows

**Table header** — copy `TableHead className="h-8 px-2 text-xs"` from portfolio table (lines 41–51).

**Body** — wrap rows in `VirtualRows` with `rowHeight={40}` (`h-10`), container height ~400–600px, checkbox column for export selection (selection order = `project_ids` array per D-12). Disable checkbox when `status !== 'submitted'`.

**RAG badge** — tracking rows use lowercase project rag; reuse `RagBadgeCell` pattern from `PortfolioProjectTable.tsx` (lines 27–33).

---

### `modules/weekly/ui/tracking/ExportToolbar.tsx` (component, file-I/O)

**Analog:** `PortfolioDashboardPage.tsx` export buttons (lines 68–85) + hook `exporting` flag

```typescript
<Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" disabled={exporting || selectedIds.length === 0} onClick={() => onExport('xlsx')}>
  {exporting ? 'Exporting…' : 'Export Excel'}
</Button>
```

Add docx/pptx buttons as outline variants. No preview UI this phase (D-11).

---

### `modules/weekly/ui/report/WeeklyReportEditorPage.tsx` (component, request-response)

**Analog:** `modules/dashboards/ui/pm/PmDashboardPage.tsx`

**Shell without global Sidebar project context** — use `<Sidebar />` only (PM deep link; no `projectId` prop). Same loading/error blocks as PM dashboard (lines 9–44).

Pass `projectId` + `reportId` from `useParams` to hook. Header shows `display_name`, `iso_week`, `due_at`, `status` from GET shell.

---

### `modules/weekly/ui/report/useWeeklyReportEditor.ts` (hook, CRUD)

**Analog:** `usePortfolioSpecDashboard.ts` load guard + mutation toasts

**Load:**

```typescript
const res = await fetch(`/api/projects/${projectId}/weekly-reports/${reportId}`);
// same 401/403/load_failed mapping
```

**PATCH draft** — allowlisted keys from `app/api/projects/[id]/weekly-reports/[reportId]/schema.ts`:

```typescript
await fetch(`/api/projects/${projectId}/weekly-reports/${reportId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ highlights, completed_work, /* ... */, this_week_rag }),
});
if (res.status === 409) {
  toast.error('Submitted report cannot be edited — use Correct first.');
  return;
}
```

**Submit / Correct:**

```typescript
await fetch(`/api/projects/${projectId}/weekly-reports/${reportId}/submit`, { method: 'POST' });
await fetch(`/api/projects/${projectId}/weekly-reports/${reportId}/correct`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(partialOverlay),
});
```

**Submit 400 validation** — parse `{ error, fields: string[] }` per `lib/api-errors.ts:56–57`; expose `fieldErrors` state for form.

**RAG enum:** exact Title Case `'Green' | 'Amber' | 'Red' | 'Not applicable'` from schema.ts:3.

---

### `modules/weekly/ui/report/WeeklyReportForm.tsx` (component, CRUD)

**Analog:** `app/projects/[id]/communication/page.tsx`

**Controlled fields + save** (lines 30–34, 77–79):

```typescript
const updateField = (key: string, value: string) => setDraft(d => ({ ...d, [key]: value }));
const saveDraft = async () => {
  await onPatch(draft);
  toast.success('Saved');
};

<Textarea
  className="text-xs min-h-[56px] resize-y"
  value={draft.highlights ?? ''}
  onChange={e => updateField('highlights', e.target.value)}
  onBlur={saveDraft}
  disabled={!editable}
/>
```

**Read-only:** `prev_week_rag` display only. **Editable gate:** `editable = status !== 'submitted' || correction_open`. Submit / Correct buttons in toolbar; map `fieldErrors` from submit validation to field labels (D-06).

Single-column stacked sections (D-14): Card per section with `Label className="text-xs font-semibold text-slate-600"`.

---

### `modules/weekly/ui/shared/VirtualRows.tsx` (component, transform)

**Analog:** None in repo — implement per 22-RESEARCH Pattern 3 (D-08)

**Core windowing contract:**

```typescript
const ROW_H = 40;
const OVERSCAN = 3;

function VirtualRows<T>({ items, height, rowHeight, renderRow, rowKey }: Props<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const visible = Math.ceil(height / rowHeight) + OVERSCAN * 2;
  const end = Math.min(items.length, start + visible);
  const slice = items.slice(start, end);
  const totalH = items.length * rowHeight;

  return (
    <div style={{ height, overflow: 'auto' }} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <div style={{ height: totalH, position: 'relative' }}>
        <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
          {slice.map((item, i) => renderRow(item, start + i))}
        </div>
      </div>
    </div>
  );
}
```

Use inside `<TableBody>` or replace tbody with div-table layout matching shadcn row heights.

---

### `modules/weekly/ui/shared/types.ts` (utility, transform)

**Analog:** `modules/dashboards/ui/shared/types.ts`

Re-export or mirror service types from `lib/services/weekly-tracking.service.ts` (`PeriodTrackingRow`, `PeriodTrackingCounts`, `PeriodTrackingFilters`) and weekly report shell shape from route tests. Keep UI-only types in module; do not import server modules that pull pg.

---

### `modules/weekly/ui/shared/weekly.fixture.ts` (test, transform)

**Analog:** `PortfolioDashboardPage.component.test.tsx` lines 22–71

Centralize tracking payload `{ period, counts, rows }`, period list, report shell, and 150-row tracking array for VirtualRows test.

---

### Component / hook tests (5 test files)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx`

**Standard mocks** (lines 5–20):

```typescript
vi.mock('next/navigation', () => ({ usePathname: () => '/weekly/tracking', useSearchParams: () => new URLSearchParams('periodId=1'), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() } }));

vi.mock('@/modules/dashboards/ui/shared/downloadBlob', () => ({ downloadBlob: vi.fn() }));
```

**Fetch stub pattern** (lines 148–168): route-aware `vi.stubGlobal('fetch', ...)`.

**Required assertions:**

| Test file | Key assertion |
|-----------|---------------|
| `WeeklyPeriodsPage.component.test.tsx` | 403 forbidden copy; POST create period |
| `WeeklyTrackingPage.component.test.tsx` | GET tracking; export POST + downloadBlob |
| `WeeklyReportEditorPage.component.test.tsx` | PATCH draft; 409 → toast; submit 400 `fields` |
| `VirtualRows.component.test.tsx` | 150 items, container 400px, `getAllByRole('row').length` ≤ ~15 |
| `Sidebar.weekly-nav.component.test.tsx` | cpmo sees links; viewer does not |

---

### `components/layout/Sidebar.tsx` (component, request-response)

**Analog:** existing CPMO dashboard links (lines 161–191)

**Insert after My dashboard block, before `NAV_SECONDARY`:**

```typescript
{me?.roles?.includes('cpmo') ? (
  <>
    <Link href="/weekly/periods" /* same cn() active pattern */>
      <Calendar className="h-4 w-4 shrink-0" />
      Weekly periods
    </Link>
    <Link href="/weekly/tracking" /* pathname === '/weekly/tracking' */>
      <ClipboardList className="h-4 w-4 shrink-0" />
      Weekly tracking
    </Link>
  </>
) : null}
```

Import icons from `lucide-react` (already imported). Do **not** add PM report link — PMs use dashboard deep links (D-02).

---

### `components/layout/Sidebar.weekly-nav.component.test.tsx` (test, request-response)

**Analog:** `components/layout/Sidebar.dashboard-nav.component.test.tsx`

Copy `stubFetch` helper (lines 12–35). Assert:

- `cpmo` → links "Weekly periods" (`/weekly/periods`) and "Weekly tracking" (`/weekly/tracking`)
- `pm` / `viewer` → neither weekly link visible
- active class when `mockPathname = '/weekly/tracking'`

---

## Shared Patterns

### Authentication / 403 in-page

**Source:** `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts:26-41`
**Apply to:** all three weekly hooks

```typescript
if (res.status === 401) { setError('unauthorized'); setData(null); return; }
if (res.status === 403) { setError('forbidden'); setData(null); return; }
if (!res.ok) { setError('load_failed'); setData(null); return; }
```

UI: centered `ERROR_COPY` panel in `<main>` — never redirect. NAV hides links; API is authz source of truth.

### Blob download

**Source:** `modules/dashboards/ui/shared/downloadBlob.ts:1-8`
**Apply to:** `usePeriodTracking.exportPack`

```typescript
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

Parse `Content-Disposition` from export POST response; fallback filename `weekly-export.xlsx`.

### Toast errors on mutation failure

**Source:** `usePortfolioSpecDashboard.ts:63-65, 96-98`
**Apply to:** all PUT/POST/PATCH/export paths

```typescript
if (!res.ok) {
  toast.error("Couldn't save filters — try again."); // or context-specific copy
  return;
}
```

### shadcn table density

**Source:** `PortfolioProjectTable.tsx:42-50`
**Apply to:** period list, tracking grid header, PM queues reference

```typescript
<TableHead className="h-8 px-2 text-xs">Name</TableHead>
<TableCell className="p-2 text-sm">{value}</TableCell>
```

### Vitest jsdom gate

**Source:** `vitest.config.ts` — `modules/**` already included (Phase 21 Wave 0). No config change needed.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `modules/weekly/ui/shared/VirtualRows.tsx` | component | transform | No in-repo row virtualizer; D-08 forbids npm — implement fixed-height window per RESEARCH Pattern 3 |
| `modules/weekly/ui/report/WeeklyReportForm.tsx` | component | CRUD | No weekly report editor UI exists; combine communication Textarea save + portfolio error/toast + submit/correct flow from API tests |

---

## Metadata

**Analog search scope:** `modules/dashboards/ui/**`, `app/dashboards/**`, `components/layout/Sidebar*.tsx`, `app/projects/[id]/communication/page.tsx`, `app/login/page.tsx`, weekly API routes/services
**Files scanned:** 35
**Pattern extraction date:** 2026-08-28
