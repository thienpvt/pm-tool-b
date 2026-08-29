# Phase 21: Portfolio & PM Dashboard Pages - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 22 new/modified files
**Analogs found:** 20 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/dashboards/portfolio/page.tsx` | route | request-response | *(greenfield thin re-export)* | partial |
| `app/dashboards/pm/page.tsx` | route | request-response | *(greenfield thin re-export)* | partial |
| `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` | component | request-response | `app/portfolio/report/page.tsx` | exact |
| `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts` | hook | request-response | `app/portfolio/report/usePortfolioReport.ts` | role-match |
| `modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx` | component | transform | `app/_components/KpiCardsRow.tsx` | role-match |
| `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx` | component | CRUD | `app/programs/page.tsx` (filter bar) | role-match |
| `modules/dashboards/ui/portfolio/PortfolioCharts.tsx` | component | transform | `app/_components/AnalyticsMiddleRow.tsx` | exact |
| `modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx` | component | transform | `app/portfolio/resources/page.tsx` (table) | role-match |
| `modules/dashboards/ui/portfolio/PortfolioDrilldownTable.tsx` | component | transform | `app/portfolio/resources/page.tsx` (table) | role-match |
| `modules/dashboards/ui/pm/PmDashboardPage.tsx` | component | request-response | `app/portfolio/report/page.tsx` | exact |
| `modules/dashboards/ui/pm/usePmDashboard.ts` | hook | request-response | `app/portfolio/report/usePortfolioReport.ts` | role-match |
| `modules/dashboards/ui/pm/PmActionQueues.tsx` | component | transform | `app/portfolio/resources/page.tsx` (table + Link) | role-match |
| `modules/dashboards/ui/shared/downloadBlob.ts` | utility | file-I/O | `app/projects/[id]/page.tsx` (`exportExcel`) | exact |
| `modules/dashboards/ui/shared/types.ts` | utility | transform | `lib/services/spec-dashboards.service.ts` | exact |
| `modules/dashboards/ui/portfolio/portfolio.fixture.ts` | test | transform | `app/page.component.test.tsx` fixture | role-match |
| `modules/dashboards/ui/pm/pm.fixture.ts` | test | transform | `app/api/dashboards/pm/route.test.ts` | role-match |
| `modules/dashboards/ui/portfolio/*.component.test.tsx` | test | request-response | `app/portfolio/report/page.component.test.tsx` | exact |
| `modules/dashboards/ui/pm/*.component.test.tsx` | test | request-response | `app/portfolio/report/page.component.test.tsx` | exact |
| `modules/dashboards/ui/shared/downloadBlob.test.ts` | test | file-I/O | `app/projects/[id]/page.tsx` export block | role-match |
| `components/layout/Sidebar.tsx` | component | request-response | existing `Sidebar.tsx` Admin link (D-03) | exact |
| `vitest.config.ts` | config | batch | `vitest.config.ts` (extend globs) | exact |

## Pattern Assignments

### `app/dashboards/portfolio/page.tsx` & `app/dashboards/pm/page.tsx` (route, request-response)

**Analog:** Greenfield — no existing `modules/` re-export in repo yet. Follow RESEARCH Pattern 1.

**Thin re-export pattern** (from 21-RESEARCH.md, D-01):

```typescript
'use client';
export { default } from '@/modules/dashboards/ui/portfolio/PortfolioDashboardPage';
```

PM route swaps import to `@/modules/dashboards/ui/pm/PmDashboardPage`.

---

### `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` (component, request-response)

**Analog:** `app/portfolio/report/page.tsx`

**Page shell + imports** (lines 1-12, 78-81):

```typescript
'use client';
import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { usePortfolioSpecDashboard } from './usePortfolioSpecDashboard';
// ... child components

export default function PortfolioDashboardPage() {
  const { data, loading, error, load, saveFilters, exportDashboard } = usePortfolioSpecDashboard();
  // drill-down selection state here

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
        {/* header, filters, KPIs, charts, list, drill-down */}
      </main>
    </div>
  );
}
```

**Loading shell** — copy from `app/page.tsx` (lines 88-99); change copy to UI-SPEC "Loading dashboard…":

```typescript
if (loading) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading dashboard…</p>
        </div>
      </main>
    </div>
  );
}
```

**403/401 error panel** — no dedicated forbidden component exists (RESEARCH A1). After hook sets `error === 'forbidden'`, render centered panel in `<main>` (do not redirect like admin). Copy strings from 21-UI-SPEC Copywriting Contract.

**NIT-04 comment** — top of file:

```typescript
// NIT-04: fiscal KPIs live on /portfolio/budget, not spec tiles.
```

---

### `modules/dashboards/ui/pm/PmDashboardPage.tsx` (component, request-response)

**Analog:** `app/portfolio/report/page.tsx` (same shell) + `app/page.tsx` loading block

Same `Sidebar` + `main` flex layout as portfolio page. Three queue sections instead of KPI/charts/drill-down. No export buttons.

---

### `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts` (hook, request-response)

**Analog:** `app/portfolio/report/usePortfolioReport.ts` — **NOT** `app/usePortfolioDashboard.ts`

**Correct hook pattern** (from `usePortfolioReport.ts` lines 11-42):

```typescript
import { useCallback, useEffect, useState } from 'react';

export function usePortfolioSpecDashboard() {
  const [data, setData] = useState<PortfolioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboards/portfolio');
      if (res.status === 401) { setError('unauthorized'); setData(null); return; }
      if (res.status === 403) { setError('forbidden'); setData(null); return; }
      if (!res.ok) { setError('load_failed'); return; }
      setData(await res.json());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, load, saveFilters, exportDashboard };
}
```

**Filter persist** — mirror filter route contract from `app/api/dashboards/portfolio/filters/route.test.ts`:

```typescript
// PUT apply
await fetch('/api/dashboards/portfolio/filters', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(filters),
});
await load();

// POST clear / defaults
await fetch('/api/dashboards/portfolio/filters', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'clear' }), // or 'defaults'
});
await load();
```

**Export with toast** — combine `app/projects/[id]/page.tsx` export (lines 275-292) with `PORTFOLIO_EXPORT_FILENAME` from `lib/export/dashboard-portfolio.ts` (lines 240-243):

```typescript
import { toast } from 'sonner';
import { PORTFOLIO_EXPORT_FILENAME } from '@/lib/export/dashboard-portfolio';

const exportDashboard = async (format: 'xlsx' | 'pdf') => {
  const res = await fetch('/api/dashboards/portfolio/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format }),
  });
  if (!res.ok) { toast.error('Export failed — try again.'); return; }
  const blob = await res.blob();
  downloadBlob(blob, PORTFOLIO_EXPORT_FILENAME[format]);
  toast.success('Export downloaded');
};
```

### ⛔ Anti-pattern: `app/usePortfolioDashboard.ts` (DO NOT COPY for data)

**Wrong analog for spec dashboards** — hits v1 `/api/portfolio`, not Phase 16 API:

```typescript
// app/usePortfolioDashboard.ts:10-12 — FORBIDDEN for Phase 21 hooks
fetch('/api/portfolio').then(r => r.json()).then(d => { setData(d); setLoading(false); });
```

Use only as a **negative reference**. Shell/loading from `app/page.tsx` is OK; data fetch must use `/api/dashboards/portfolio`.

---

### `modules/dashboards/ui/pm/usePmDashboard.ts` (hook, request-response)

**Analog:** `app/portfolio/report/usePortfolioReport.ts`

Same hook structure as portfolio hook but:
- GET `/api/dashboards/pm`
- Filter routes: `/api/dashboards/pm/filters` (GET/PUT/POST clear/defaults)
- No export method
- Refetch on mount (D-11); optional `visibilitychange` refetch

PM GET shape from `lib/services/spec-dashboards.service.ts` (lines 259-267):

```typescript
{
  filters: DashboardFilters,
  projects: PortfolioDashboardListRow[],
  actions: { weekly: [...], milestones: [...], raid: [...] },
}
```

---

### `modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx` (component, transform)

**Analog:** `app/_components/KpiCardsRow.tsx`

**Grid layout** (lines 27-28):

```typescript
<div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
```

**Tile anatomy** — adapt KpiCardsRow card density (lines 40-54) but use shadcn `Card size="sm"` per UI-SPEC:

```typescript
import { Card } from '@/components/ui/card';

<Card size="sm" className="shadow-sm cursor-pointer hover:bg-slate-50 ring-2 ring-blue-600">
  <p className="text-xs font-semibold text-slate-600">{label}</p>
  <p className="text-3xl font-bold">{count}</p>
</Card>
```

Bind exactly six fields from `PortfolioKpis` (`lib/dashboards/kpi.ts` lines 10-17). Three tiles get `onClick` → set active drill-down key. **Do not** copy fiscal/budget tiles from v1 home or `/portfolio/budget`.

---

### `modules/dashboards/ui/portfolio/PortfolioCharts.tsx` (component, transform)

**Analog:** `app/_components/AnalyticsMiddleRow.tsx` (recharts bar chart)

**recharts imports + bar chart** (lines 3-5, 53-67):

```typescript
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const stageData = ['L0','L1','L2','L3','L4','L5'].map(stage => ({
  stage,
  count: charts.by_stage[stage] ?? 0,
}));

<ResponsiveContainer width="100%" height={120}>
  <BarChart data={stageData} barGap={4}>
    <XAxis dataKey="stage" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
    <YAxis hide allowDecimals={false} />
    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
    <Bar dataKey="count" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

**RAG chart** — map `charts.by_rag` to `{ rag: 'Green', count: n }` rows; color cells like `app/_components/RagBadge.tsx` semantic tokens (green/amber/red).

**Alternate:** 21-UI-SPEC allows CSS horizontal bars (8px height) if executor prefers zero chart deps in this component — recharts is already installed and used in `app/projects/[id]/budget/page.tsx` (lines 508-520).

---

### `modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx` & `PortfolioDrilldownTable.tsx` (component, transform)

**Analog:** `app/portfolio/resources/page.tsx` (compact native table, lines 155-184) + shadcn `Table` wrapper

**shadcn Table imports** (`components/ui/table.tsx` lines 7-18, 68-90):

```typescript
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="h-8 px-2 text-xs">Name</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell className="p-2 text-sm">
        <Link href={`/projects/${row.id}`} className="text-blue-600 hover:underline truncate max-w-[200px]" title={row.name}>
          {row.name}
        </Link>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**Empty row** — copy colspan pattern from resources page (lines 176-182):

```typescript
<tr>
  <td colSpan={8} className="text-center py-12 text-slate-400">
    No projects match these filters
  </td>
</tr>
```

**RAG badge** — reuse `app/_components/RagBadge.tsx` or `Badge` with `bg-green-100 text-green-700` tokens from `app/projects/page.tsx` (lines 16-21).

**Drill-down links** — render `<Link href={row.href}>` when server provides `href` (Phase 16 D-13); do not construct URLs client-side for PM queues.

---

### `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx` & PM filter bar (component, CRUD)

**Analog:** `app/programs/page.tsx` filter row (lines 84-100) + `app/projects/[id]/page.tsx` shadcn Select (lines 410-426)

**Layout**:

```typescript
<div className="flex flex-wrap gap-3 items-end">
  <FieldRow label="Stage">
    <Select>...</Select>
  </FieldRow>
  <Button className="bg-blue-600 hover:bg-blue-700 h-8">Apply filters</Button>
</div>
```

**FieldRow helper** — copy from `app/programs/page.tsx` (lines 68-74):

```typescript
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}
```

Filter keys: `lib/dashboards/filters.ts` `DASHBOARD_FILTER_KEYS`. Omit or disable `unit` control (no-op server-side per RESEARCH Pitfall 3).

On failed PUT/POST: `toast.error("Couldn't save filters — try again.")` from sonner.

---

### `modules/dashboards/ui/pm/PmActionQueues.tsx` (component, transform)

**Analog:** `app/portfolio/resources/page.tsx` table sections + `app/projects/[id]/page.tsx` Link styling

Three `Card size="sm"` sections (weekly / milestones / raid). Each row:

```typescript
<Link href={row.href} className="text-blue-600 text-sm hover:underline">Open</Link>
```

Section header with count badge: `(N)` when N > 0 (UI-SPEC). Empty queue copy from 21-UI-SPEC Copywriting Contract.

---

### `modules/dashboards/ui/shared/downloadBlob.ts` (utility, file-I/O)

**Analog:** `app/projects/[id]/page.tsx` (lines 275-287)

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

Always call `URL.revokeObjectURL` after click (RESEARCH Pitfall 5).

---

### `modules/dashboards/ui/shared/types.ts` (utility, transform)

**Analog:** `lib/services/spec-dashboards.service.ts` + `lib/dashboards/kpi.ts`

Re-export or mirror:
- `PortfolioKpis`, `PortfolioCharts` from `lib/dashboards/kpi.ts`
- `PortfolioDashboardListRow` from `spec-dashboards.service.ts` (lines 29-44)
- GET response shapes (portfolio lines 100-109, PM lines 259-267)

Do not duplicate fiscal types or `/api/portfolio/budgets` shapes.

---

### `components/layout/Sidebar.tsx` (component, modify)

**Analog:** Admin Panel role gate (lines 220-234) + static `NAV` array (lines 22-30)

**Insert after Portfolio Report, before Portfolio Budget** (21-UI-SPEC D-03). Because `NAV` is a static array, add conditional blocks immediately after the `NAV.map(...)` loop (same pattern as Admin Panel):

```typescript
import { LayoutDashboard, ClipboardList } from 'lucide-react'; // LayoutDashboard already imported

// After NAV.map(...) block, before Projects collapsible:
{me?.roles?.includes('cpmo') && (
  <Link
    href="/dashboards/portfolio"
    onClick={onNavClick}
    className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
      pathname === '/dashboards/portfolio'
        ? 'bg-blue-600 text-white'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    )}
  >
    <LayoutDashboard className="h-4 w-4 shrink-0" />
    Spec dashboard
  </Link>
)}
{(me?.roles?.includes('pm') || me?.roles?.includes('cpmo')) && (
  <Link
    href="/dashboards/pm"
    onClick={onNavClick}
    className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
      pathname === '/dashboards/pm'
        ? 'bg-blue-600 text-white'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    )}
  >
    <ClipboardList className="h-4 w-4 shrink-0" />
    My dashboard
  </Link>
)}
```

`me` comes from existing `/api/auth/me` fetch (lines 281-284). Viewer role never sees links.

---

### `vitest.config.ts` (config, modify)

**Analog:** Current `vitest.config.ts` (lines 6-31)

**Wave 0 glob extension** — add `modules` to both projects:

```typescript
// node project (line 14):
include: ['{lib,app,eslint,modules}/**/*.test.ts'],

// jsdom project (lines 23-26):
include: [
  '{components,app,modules}/**/*.test.tsx',
  '{components,app,modules}/**/*.component.test.tsx',
],
```

Without this, `modules/dashboards/ui/**/*.component.test.tsx` never runs (RESEARCH Pitfall 1).

---

### Component / hook tests (`*.component.test.tsx`, `downloadBlob.test.ts`)

**Analog:** `app/portfolio/report/page.component.test.tsx`

**Mock setup** (lines 1-41):

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortfolioDashboardPage from './PortfolioDashboardPage';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboards/portfolio' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/dashboards/portfolio') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(portfolioFixture) });
    }
    if (url === '/api/dashboards/portfolio/filters' && init?.method === 'PUT') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch);
});
```

**Required test cases** (D-17):
- 200: renders six KPI tiles + sidebar
- 403: shows "You don't have access to this dashboard."
- Filter Apply → PUT + GET refetch
- Export POST → blob download mocked
- NIT-04: KPI DOM excludes `/budget|ROI|benefit|\$|₫|VND/i`
- PM: queue rows render `<a href="...">` from fixture `href` strings

**Fixtures** — derive minimal payloads from `lib/dashboards/kpi.ts` + `spec-dashboards.service.ts` return shapes; API route tests in `app/api/dashboards/portfolio/route.test.ts` show session/403 expectations.

---

## Shared Patterns

### Page shell (Sidebar + main)
**Source:** `app/portfolio/report/page.tsx` (lines 78-81), `app/page.tsx` (lines 88-99)
**Apply to:** Both dashboard pages

```typescript
<div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
  <Sidebar />
  <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">...</main>
</div>
```

### Client fetch + useEffect hook
**Source:** `app/portfolio/report/usePortfolioReport.ts` (lines 11-45)
**Apply to:** `usePortfolioSpecDashboard`, `usePmDashboard`
**Not:** `app/usePortfolioDashboard.ts`

### Toast feedback (sonner)
**Source:** `app/projects/[id]/page.tsx` (lines 275-292), `components/layout/Sidebar.tsx` (line 19)
**Apply to:** Export success/error, filter save errors

```typescript
import { toast } from 'sonner';
toast.success('Export downloaded');
toast.error('Export failed — try again.');
```

### shadcn Card / Button / Badge
**Source:** `app/projects/[id]/page.tsx` (lines 7-9, 386-430), `components/ui/card.tsx`
**Apply to:** KPI tiles, filter bar, PM queue sections

```typescript
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
```

Use `Card size="sm"` per UI-SPEC; `Button className="bg-blue-600 hover:bg-blue-700"` for primary actions.

### Role-gated NAV (no duplicate authz)
**Source:** `components/layout/Sidebar.tsx` (lines 220-234)
**Apply to:** Spec dashboard (cpmo), My dashboard (pm | cpmo)
**Policy truth:** API `withCpmo` / `withAuth` — UI hides links only (D-09).

### recharts bar charts
**Source:** `app/_components/AnalyticsMiddleRow.tsx` (lines 53-67), `app/projects/[id]/budget/page.tsx` (lines 508-520)
**Apply to:** `PortfolioCharts.tsx` — `charts.by_stage`, `charts.by_rag`

### Deep links from server JSON
**Source:** `lib/services/spec-dashboards.service.ts` (line 213 weekly href, line 256 raid href)
**Apply to:** PM action queues, drill-down rows

```typescript
href: `/projects/${s.project_id}/weekly-reports/${s.report_id}`,
// UI: <Link href={row.href}>Open</Link>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/dashboards/portfolio/page.tsx` | route | request-response | First `modules/` thin re-export — pattern defined in RESEARCH, not yet in repo |
| `app/dashboards/pm/page.tsx` | route | request-response | Same — greenfield re-export |

---

## Metadata

**Analog search scope:** `app/portfolio/report/`, `app/page.tsx`, `app/usePortfolioDashboard.ts`, `app/_components/`, `app/projects/[id]/`, `app/programs/`, `app/portfolio/resources/`, `components/layout/Sidebar.tsx`, `components/ui/`, `lib/services/spec-dashboards.service.ts`, `lib/dashboards/kpi.ts`, `vitest.config.ts`, `app/api/dashboards/**/route.test.ts`
**Files scanned:** ~35
**Pattern extraction date:** 2026-08-28
