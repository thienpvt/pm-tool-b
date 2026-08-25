# Phase 7: UI Decomposition - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 52 (7 god targets + Wave 0 config + ~45 implied extractions)
**Analogs found:** 48 / 52

## File Classification

### Wave 0 — Test Infrastructure

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `vitest.config.ts` | config | batch | `vitest.config.ts` (existing jsdom project) | exact |

### Archetypes (apply to all 7 decompositions)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/**/page.tsx` (thin container) | route / component | request-response | `app/projects/[id]/bugs/page.tsx` | role-match |
| `app/**/use*.ts` (colocated hook) | hook | request-response | fetch blocks in god pages (see per-page table) | exact (source) |
| `app/**/_components/*.tsx` | component | transform | `components/jira/JiraSyncDialog.tsx` section banners | role-match |
| `app/**/_components/*.ts` (pure helpers) | utility | transform | banner helper blocks in god pages | exact (source) |
| `app/**/*.component.test.tsx` | test | request-response | `components/ui/badge.test.tsx` | role-match |
| `components/timeline/ImportMappingDialog.tsx` (thin) | component | request-response | `components/resources/ResourceImportDialog.tsx` | role-match |
| `components/timeline/useImportMapping.ts` | hook | request-response | `ImportMappingDialog.tsx:292-300` | exact (source) |
| `components/timeline/_components/*.tsx` | component | transform | `components/jira/JiraSyncDialog.tsx` | role-match |
| `components/timeline/ImportMappingDialog.component.test.tsx` | test | request-response | `components/ui/badge.test.tsx` + RESEARCH Pattern 3 | role-match |
| `app/**/types.ts` (optional) | model | transform | type blocks at top of god pages | exact (source) |

### Per-Page Targets (god file → extraction source)

| God File | Hook (create) | Test (create) | `_components/` modules (from banners) | Primary Fetch Analog |
|----------|---------------|---------------|---------------------------------------|----------------------|
| `app/page.tsx` (1020) | `usePortfolioDashboard.ts` | `app/page.component.test.tsx` | HealthScoreArc, MiniSparkline, ListRow, ProjectCard, ProgramSection | `app/page.tsx:300-311` |
| `app/portfolio/report/page.tsx` (2655) | `usePortfolioReport.ts` | `page.component.test.tsx` | ReportToolbar, ReportPreview, EmailModal, buildTemplateReport, buildHtmlReport | `page.tsx:1582-1610` |
| `app/projects/[id]/timeline/page.tsx` (1838) | `useTimelinePage.ts` | `page.component.test.tsx` | ActivityDetail, RoadmapView, TimelineTable, LagCalc, CsvHelpers | timeline page fetch callbacks |
| `app/projects/[id]/report/page.tsx` (1346) | `useProjectReport.ts` | `page.component.test.tsx` | SvgCharts, HtmlReportBuilder, TemplateTextBuilder, EmailModal | report page loadData |
| `app/projects/[id]/milestones/page.tsx` (1182) | `useMilestonesPage.ts` | `page.component.test.tsx` | ActivityDetail, MilestoneTree, MilestoneToolbar | milestones useEffect fetches |
| `app/portfolio/roadmap/page.tsx` (1141) | `useRoadmapPage.ts` | `page.component.test.tsx` | PhaseColours, EpicColours, QuickViewPresets, RoadmapGrid | roadmap `/api/portfolio/roadmap` |
| `components/timeline/ImportMappingDialog.tsx` (1179) | `useImportMapping.ts` | `ImportMappingDialog.component.test.tsx` | MappingStep, CsvParser, ValueNormalizers, ImportPreview | `ImportMappingDialog.tsx:292-300` |

---

## Pattern Assignments

### Wave 0: `vitest.config.ts` (config, batch)

**Analog:** `vitest.config.ts` lines 17-25

**Current jsdom include** (lines 17-25):
```typescript
{
  resolve: { alias },
  test: {
    name: 'jsdom',
    environment: 'jsdom',
    include: ['{components,app}/**/*.test.tsx'],
    setupFiles: ['./test/setup-jsdom.ts'],
  },
},
```

**Copy pattern:** extend `include` array — keep existing `*.test.tsx`, add `*.component.test.tsx`:
```typescript
include: [
  '{components,app}/**/*.test.tsx',
  '{components,app}/**/*.component.test.tsx',
],
```

**Setup file** (`test/setup-jsdom.ts:1-5`) — no change needed:
```typescript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

---

### Archetype A: Thin Page Container (`page.tsx`, route/component, request-response)

**Analog:** `app/projects/[id]/bugs/page.tsx` (973 lines — same `'use client'` + Sidebar + useParams + dialog imports, smaller than gods)

**Imports pattern** (lines 1-15):
```typescript
'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import BugImportDialog from '@/components/bugs/BugImportDialog';
import JiraSyncDialog from '@/components/jira/JiraSyncDialog';
```

**Layout shell** (compose Sidebar + main — same as all authenticated pages):
```typescript
return (
  <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
    <Sidebar projectId={id} />
    <main className="flex-1 p-4 lg:p-6 overflow-auto">
      {/* feature modules here */}
    </main>
  </div>
);
```

**Container owns UI state only** (bugs page lines 104-128 — filter/dialog/tab state stays in container or passes to `_components/`):
```typescript
export default function BugsPage() {
  const { id } = useParams<{ id: string }>();
  const [bugs, setBugs] = useState<BugRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'list'>('summary');
  const [importOpen, setImportOpen] = useState(false);
  const [jiraSyncOpen, setJiraSyncOpen] = useState(false);
  // ... filter state, dialog open flags — NOT in hook
```

**Portfolio home variant** (`app/page.tsx:291-319` — after hook extraction, container keeps filter/view state):
```typescript
export default function PortfolioDashboard() {
  const { data, loading, companyName, meUser, refetch } = usePortfolioDashboard();
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showOnboarding, setShowOnboarding] = useState(false);
  // hook owns data/loading; container owns selectedProgramId, viewMode, showOnboarding
```

**Loading gate** (`app/page.tsx:380-392` — preserve verbatim, do not invent new spinners):
```typescript
if (loading) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading portfolio...</p>
        </div>
      </main>
    </div>
  );
}
```

---

### Archetype B: Colocated Data Hook (`use*.ts`, hook, request-response)

**No project-root `hooks/` exists.** Copy fetch blocks verbatim from each god page into a named export. Hook returns server-backed state + refetch only.

#### `usePortfolioDashboard.ts` — analog: `app/page.tsx:300-311`

```typescript
import { useCallback, useEffect, useState } from 'react';

export function usePortfolioDashboard() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [meUser, setMeUser] = useState<MeUser | null>(null);

  const loadPortfolio = useCallback(() => {
    setLoading(true);
    fetch('/api/portfolio').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  useEffect(() => {
    loadPortfolio();
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(u => {
      if (u?.company_name) setCompanyName(u.company_name);
      if (u) setMeUser(u);
    });
  }, [loadPortfolio]);

  return { data, loading, companyName, meUser, refetch: loadPortfolio };
}
```

#### `usePortfolioReport.ts` — analog: `app/portfolio/report/page.tsx:1582-1610`

```typescript
const loadConfig = useCallback(async () => {
  const res = await fetch('/api/config');
  const d = await res.json();
  if (d.anthropic_api_key_set === 'env') setApiKeySet('env');
  else if (d.anthropic_api_key_set === 'true') setApiKeySet('db');
  else setApiKeySet(false);
  if (d.ceo_email) setCeoEmail(d.ceo_email);
}, []);

const loadData = useCallback(async () => {
  setLoading(true);
  try {
    const url = reportMode === 'milestone' && selectedMilestoneIds.size > 0
      ? `/api/portfolio/report?milestone_ids=${[...selectedMilestoneIds].join(',')}`
      : `/api/portfolio/report?start=${periodStart}&end=${periodEnd}`;
    const res = await fetch(url);
    const d = await res.json();
    setData(d);
    setReport(''); setHtmlReport('');
  } finally {
    setLoading(false);
  }
}, [reportMode, selectedMilestoneIds, periodStart, periodEnd]);

useEffect(() => { loadConfig(); }, [loadConfig]);
useEffect(() => { loadData(); }, [loadData]);
useEffect(() => {
  fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.company_name) setCompanyName(d.company_name); });
}, []);
```

**Planner note:** `reportMode`, `selectedMilestoneIds`, `periodStart`, `periodEnd` are UI filter state — if hook needs them for URL construction, pass as hook args from container OR keep loadData in container with hook owning only initial loads. Prefer single `usePortfolioReport({ reportMode, selectedMilestoneIds, periodStart, periodEnd })` accepting UI deps as params rather than moving filter state into hook internals.

#### Project-scoped pages — analog: `app/projects/[id]/bugs/page.tsx:132-169`

```typescript
const fetchDates = useCallback(async () => {
  try {
    const res = await fetch(`/api/projects/${id}/bugs?list_dates=1`);
    if (!res.ok) return;
    const dates: SnapshotDate[] = await res.json();
    setSnapshotDates(dates);
    return dates;
  } catch { return undefined; }
}, [id]);

const fetchBugs = useCallback(async (date?: string) => {
  setLoading(true);
  try {
    const url = date
      ? `/api/projects/${id}/bugs?date=${date}`
      : `/api/projects/${id}/bugs`;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    setBugs(await res.json());
  } catch { toast.error('Không thể tải danh sách bug'); }
  setLoading(false);
}, [id]);

useEffect(() => {
  fetch(`/api/projects/${id}`).then(r => r.ok ? r.json() : null).then(p => {
    if (p?.name) setProjectName(p.name);
  });
  (async () => {
    const dates = await fetchDates();
    if (dates && dates.length > 0) {
      setSelectedDate(dates[0].snapshot_date);
      await fetchBugs(dates[0].snapshot_date);
    } else {
      await fetchBugs();
    }
  })();
}, [id]);
```

Apply same `useCallback` + `useEffect` + `fetch('/api/projects/${id}/...')` shape to timeline, milestones, project report hooks. Endpoints per RESEARCH fetch table — move verbatim.

#### `useImportMapping.ts` — analog: `components/timeline/ImportMappingDialog.tsx:292-300`

```typescript
useEffect(() => {
  if (open) {
    fetch('/api/import-mapping').then(r => r.json()).then(setSavedMappings).catch(() => {});
    fetch(`/api/projects/${projectId}/activities/import`)
      .then(r => r.json())
      .then((keys: string[]) => setExistingJiraKeys(new Set(keys)))
      .catch(() => {});
  }
}, [open, projectId]);
```

Hook accepts `{ open, projectId }`; returns `{ savedMappings, existingJiraKeys, ... }`. Step/mapping/upload state stays in dialog container or `_components/`.

---

### Archetype C: Feature Module (`_components/*.tsx`, component, transform)

**Analog:** `components/jira/JiraSyncDialog.tsx` — multi-step dialog with section banners, already shared-domain UI under `components/<domain>/`.

**Section banner convention** (JiraSyncDialog lines 16-17, 62-63, 113-114, 245-246):
```typescript
// ─── Types ─────────────────────────────────────────────────────────────────────
// ─── Constants ─────────────────────────────────────────────────────────────────
// ─── Field Mapping helpers ─────────────────────────────────────────────────────
// ─── Main component ────────────────────────────────────────────────────────────
```

**Sidebar uses same banner style** (`components/layout/Sidebar.tsx:71-72, 276-277`):
```typescript
// ─── Shared nav content (used in both desktop sidebar and mobile drawer) ───────
function SidebarNav({ ... }) { ... }

// ─── Main Sidebar component ────────────────────────────────────────────────────
export default function Sidebar({ projectId }: { projectId?: string }) {
```

**Split rule:** each `// ─── Section Name ───` in the god file becomes one `_components/` file. Sub-split only when a single banner block exceeds 400 lines — use inner comment seams (timeline page has `// ─── Phase groups` at line 1260).

**Step-wizard dialog module** — analog: `components/resources/ResourceImportDialog.tsx:74-97` (reset + step state local to dialog):
```typescript
export default function ResourceImportDialog({ projectId, open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  // ... all step/mapping UI state local

  const reset = () => {
    setStep(1);
    setColumns([]);
    // ...
  };
```

**Props-down pattern for extracted presentational modules** — pass data + callbacks from container; no fetch inside `_components/`:
```typescript
// _components/ReportToolbar.tsx
type Props = {
  selectedProgramIds: Set<number>;
  onProgramToggle: (id: number) => void;
  onExport: () => void;
};
export function ReportToolbar({ selectedProgramIds, onProgramToggle, onExport }: Props) {
  // render only — no useEffect fetch
}
```

---

### Archetype D: Pure Helper Module (`_components/*.ts`, utility, transform)

**Analog:** helper blocks at top of god pages before the Page section.

**Example from `app/page.tsx:43-49`** (constants/maps — copy to `_components/helpers.ts` or colocate with owning module):
```typescript
const PHASE_COLOR: Record<string, string> = {
  Initiation: 'bg-purple-100 text-purple-700 border-purple-200',
  Planning:   'bg-blue-100 text-blue-700 border-blue-200',
  Execution:  'bg-amber-100 text-amber-700 border-amber-200',
  Closing:    'bg-green-100 text-green-700 border-green-200',
};
```

**Pure lib import allowed in client** — `@/lib/status-weights` (`app/projects/[id]/timeline/page.tsx:13`):
```typescript
import { statusPct, weightedProgress } from '@/lib/status-weights';
```
Keep in timeline/roadmap/milestones modules that need progress math. Not a UI-09 violation.

---

### Archetype E: Component Test (`*.component.test.tsx`, test, request-response)

**Analog:** `components/ui/badge.test.tsx` (harness) + RESEARCH Pattern 3 (fetch mock recipe)

**Harness imports** (badge.test.tsx lines 1-3):
```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';
```

**Page test template** — adapt for each decomposed page:
```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortfolioDashboard from './page';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: '1' }) }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const portfolioFixture = { programs: [], projects: [], noProgramProjects: [], phaseDist: [], programBar: [], kpi: { totalProjects: 0, totalPrograms: 0, totalOpenRisks: 0, totalOpenIssues: 0, avgCompletion: 0, activeProjects: 0 } };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/portfolio') return Promise.resolve({ ok: true, json: () => Promise.resolve(portfolioFixture) });
    if (url === '/api/auth/me') return Promise.resolve({ ok: true, json: () => Promise.resolve({ company_name: 'Acme', onboarding_completed: 1, display_name: 'Test', username: 'test' }) });
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as typeof fetch);
});

describe('PortfolioDashboard', () => {
  it('renders after load', async () => {
    render(<PortfolioDashboard />);
    await waitFor(() => expect(screen.queryByText(/Loading portfolio/i)).not.toBeInTheDocument());
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('toggles view mode', async () => {
    render(<PortfolioDashboard />);
    await waitFor(() => expect(screen.queryByText(/Loading portfolio/i)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    // assert cards ↔ list behavior unchanged
  });
});
```

**Mock isolation philosophy** — analog: `app/api/import-mapping/route.test.ts:4-19` (vi.hoisted + vi.mock, no real server):
```typescript
const { listTimelineMappings, ... } = vi.hoisted(() => ({
  listTimelineMappings: vi.fn(),
  // ...
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/import-mapping.repo', () => ({ listTimelineMappings, ... }));
```

Component tests use `vi.stubGlobal('fetch', ...)` instead of MSW — same isolation principle, zero deps.

**Per-page mock endpoints** (from RESEARCH):

| Page test | Mock URLs (minimum) | Interaction to assert |
|-----------|----------------------|------------------------|
| `app/page.component.test.tsx` | `/api/portfolio`, `/api/auth/me` | Program tab or cards/list toggle |
| `app/portfolio/report/page.component.test.tsx` | `/api/config`, `/api/portfolio/report?...`, `/api/auth/me` | Program/project filter |
| `app/projects/[id]/timeline/page.component.test.tsx` | `/api/projects/1`, `/api/projects/1/activities`, team, holidays | Phase filter |
| `app/projects/[id]/report/page.component.test.tsx` | `/api/config`, `/api/auth/me`, `/api/projects/1/project-report?...` | Generate report |
| `app/projects/[id]/milestones/page.component.test.tsx` | milestones, activities, project, team | Milestone select |
| `app/portfolio/roadmap/page.component.test.tsx` | `/api/portfolio/roadmap` | Program filter |
| `ImportMappingDialog.component.test.tsx` | `/api/import-mapping`, `/api/projects/1/activities/import` | Mapping step advance |

---

### Archetype F: Dialog Thin Container (`ImportMappingDialog.tsx`)

**Analog:** `components/resources/ResourceImportDialog.tsx` (434 lines — step wizard under `components/<domain>/`, under 400 lines)

**Dialog shell** (ResourceImportDialog lines 195-207):
```typescript
return (
  <Dialog open={open} onOpenChange={o => { if (!o && !saving) { reset(); onOpenChange(false); } }}>
    <DialogContent className="!max-w-4xl !w-[95vw] max-h-[92vh] flex flex-col gap-3">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3 text-base">
          <Upload className="h-5 w-5 text-blue-500 shrink-0" />
          Import Resource Plan
          <span className="text-sm font-normal text-slate-400">
            — Step {step} of 3: {step === 1 ? 'Upload File' : ...}
          </span>
        </DialogTitle>
      </DialogHeader>
```

**ImportMappingDialog stays at** `components/timeline/ImportMappingDialog.tsx` — decompose into `components/timeline/_components/` (private folder, not routed). Same pattern as page `_components/` but under shared domain path per locked decision.

**Fetch-on-open** (ImportMappingDialog lines 290-300) moves to `useImportMapping.ts`; container wires hook + composes step modules.

---

### Archetype G: Optional Shared Types (`types.ts`)

**Analog:** type blocks at top of god pages — only create when 2+ modules share a type.

**From `app/page.tsx:18-41`:**
```typescript
type ProjectRow = {
  id: number; name: string; client: string; customer_id: number | null;
  program_name: string; program_industry: string;
  // ...
};
type ProgramGroup = { id: number; name: string; industry: string; projects: ProjectRow[] };
type PortfolioData = {
  projects: ProjectRow[];
  programs: ProgramGroup[];
  noProgramProjects: ProjectRow[];
  // ...
};
```

Do not promote to `lib/types/`. Single-module types stay in that module file.

---

## Shared Patterns

### `'use client'` + Import Alias

**Source:** all god pages
**Apply to:** every new `.tsx` in `app/` and `components/timeline/_components/`

```typescript
'use client';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
```

Concrete `@/components/ui/*` paths — no barrel import.

### Section Banner Split Seams

**Source:** god pages + `components/layout/Sidebar.tsx:71`
**Apply to:** all extractions

```typescript
// ─── Types ────────────────────────────────────────────────────────────────────
// ─── Helpers ──────────────────────────────────────────────────────────────────
// ─── ComponentName ────────────────────────────────────────────────────────────
// ─── Page ─────────────────────────────────────────────────────────────────────
```

Split on these banners first. Never mechanical 400-line chunking.

### Sidebar Composition

**Source:** `app/page.tsx:407-418`, `app/projects/[id]/bugs/page.tsx`
**Apply to:** all authenticated pages except login

```typescript
<div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
  <Sidebar projectId={id} />  {/* omit projectId on portfolio-level pages */}
  <main className="flex-1 p-4 lg:p-6 overflow-auto">...</main>
</div>
```

### Toast Error Handling

**Source:** `app/projects/[id]/bugs/page.tsx:151-152`
**Apply to:** all hooks and handlers — preserve Vietnamese strings byte-identical

```typescript
} catch { toast.error('Không thể tải danh sách bug'); }
```

### UI-09 Client Boundary

**Source:** RESEARCH UI-09 grep gate
**Apply to:** all client files — verify after each wave

```bash
rg "from '@/lib/db'|from '@/lib/repositories|from '@/lib/services|from '@/lib/integrations|from 'pg'|from \"pg\"" app components --glob "*.tsx"
```

Allowed: `@/lib/status-weights`, `@/lib/utils` (cn). Forbidden: any server layer import.

### Dialog Import from Shared Domain

**Source:** `app/projects/[id]/timeline/page.tsx:11-12`
**Apply to:** pages that use shared dialogs — do not move to `_components/`

```typescript
import ImportMappingDialog from '@/components/timeline/ImportMappingDialog';
import JiraSyncDialog from '@/components/jira/JiraSyncDialog';
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/**/_components/` (private folder) | component | transform | Next.js `_folder` convention — no in-repo precedent yet; follow [Next.js private folders](https://nextjs.org/docs/app/getting-started/project-structure#private-folders) |
| `app/**/use*.ts` as standalone hooks | hook | request-response | Greenfield extraction — pattern is the god page's own fetch blocks, not an existing hook file |
| `*.component.test.tsx` for pages | test | request-response | Greenfield — only `badge.test.tsx` exists; RESEARCH Pattern 3 is the template |
| `test/mock-fetch.ts` shared helper | utility | transform | YAGNI until 3+ pages duplicate identical fetch routing |

---

## Metadata

**Analog search scope:** `app/`, `components/`, `vitest.config.ts`, `test/setup-jsdom.ts`, `app/api/**/*.test.ts` (mock isolation style)
**Files scanned:** 43 via codegraph_explore + targeted reads of 7 god targets, 4 shared dialogs, 1 component test, 1 route test
**Pattern extraction date:** 2026-08-25

**Key extraction sources (god → hook + modules):**
- `app/page.tsx` — UI-08, simplest hook (2 endpoints)
- `app/portfolio/report/page.tsx` — UI-02, largest, multi-loader hook
- `app/projects/[id]/timeline/page.tsx` — UI-03, useParams + status-weights + shared dialogs
- `components/timeline/ImportMappingDialog.tsx` — UI-07, dialog not route

**Decompose order (locked default):** portfolio report → timeline → project report → milestones → ImportMappingDialog → roadmap → home
