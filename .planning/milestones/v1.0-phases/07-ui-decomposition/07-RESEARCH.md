# Phase 7: UI Decomposition - Research

**Researched:** 2026-08-25
**Domain:** Next.js 16 App Router client-page structural decomposition + Vitest jsdom component tests
**Confidence:** HIGH

## Summary

Phase 7 is a pure structural refactor of seven god client components (1020–2655 lines each) into thin route containers, colocated `_components/` feature modules, and per-page data-fetching hooks — with zero visual or behavioral change. The API surface from Phases 1–6 is stable; all pages already use `fetch('/api/...')` with no forbidden server-layer imports in client code (UI-09 baseline is clean). The hardest work is not architecture invention but **faithful extraction**: split on existing `// ───` section banners, move fetch blocks into hooks unchanged, and prove behavior identity with one jsdom test per page/dialog.

Two infrastructure gaps block execution: (1) `vitest.config.ts` jsdom project includes `{components,app}/**/*.test.tsx` but Phase 7 locked `*.component.test.tsx` — the config must be extended before page tests run; (2) no page-level component tests exist yet (only `components/ui/badge.test.tsx`). Each decomposition should be a HYG-01 pure-move commit followed by its `*.component.test.tsx` (HYG-03).

**Primary recommendation:** Decompose largest-first (portfolio report → timeline → project report → milestones → ImportMappingDialog → roadmap → home). For each file: extract banner sections into `_components/` modules, extract `useEffect`/`useCallback` fetch blocks into a colocated hook, leave UI state in feature modules, add one mock-fetch component test (render + one filter/export interaction), grep-verify UI-09.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Module Layout & Split Strategy

- Extracted feature modules colocate next to each page (`app/portfolio/report/_components/`, `app/projects/[id]/timeline/_components/`, etc.). Page-private pieces stay private. `components/<domain>/` remains for shared UI (existing `components/timeline/`, `components/bugs/`, `ImportMappingDialog`).
- Split each god page on the existing `// ───` section banners (toolbar/filters, table/grid, dialogs, export) — those are the seams already in the files. Do not mechanical-chunk to 400 lines and do not invent a new feature taxonomy.
- `page.tsx` (or the dialog default export) is a thin container: route params, Sidebar where applicable, hook wiring, compose feature modules. Target well under 400 lines.
- Page-local types travel with the feature that owns them. A colocated `types.ts` exists only when 2+ modules share a type (CONVENTIONS: type aliases near use site). Do not promote to `lib/types/`.

#### Data Fetching Hooks

- Named hooks colocate with the page (`app/portfolio/report/usePortfolioReport.ts` or `_hooks/`). Do not create a project-root `hooks/` directory and do not put hooks under `lib/` (UI-09 forbids client code reaching server layers; a `lib/hooks` next to services is a footgun).
- A hook owns fetch + server-backed state only: data, loading, error, refetch. Filter, dialog-open, and selection state stay in the feature module that renders them (UI-01: data fetching extracted, separate from rendering).
- Keep the existing `fetch('/api/...')` calls, moved into hooks unchanged. No SWR, no React Query, no new `apiClient` wrapper — PROJECT forbids API redesign; the stack has none of those libraries.
- Per-page hooks. Extract a shared helper only when two of the 7 pages already duplicate the same fetch (YAGNI).

#### Behavior Freeze & Visual Identity

- Zero visual change. PROJECT out of scope: "not a redesign; endpoint shapes and screens stay recognizable." UI-11 requires identical load/filter/export behavior.
- Vietnamese copy, toasts, and error strings stay byte-identical. No copy pass, no i18n extraction.
- Preserve whatever each page already does for loading, empty, and error UI — including missing-error cases. Do not invent new spinners, error banners, or error boundaries.
- Freeze export, filter, and dialog interactions: same click order, same payloads, same toast text. Accidental behavior change is HYG-02 and must be named in the commit message.

#### Testing & Verification

- Co-located `*.component.test.tsx` next to each page/container. Phase 1 already locked this as the jsdom opt-in (`@testing-library/react` + jest-dom).
- Mock `fetch` with JSON fixtures; render the container + feature modules; no running server. Same isolation as route-handler tests mocking `@/lib/db`. No MSW.
- UI-11 proof: automated load + one filter or export interaction per page. Visual identity via UAT checklist (screens stay recognizable). No Playwright — Phase 1 put E2E out of scope.
- One `*.component.test.tsx` per decomposed page/dialog (UI-10 is per page, not per module). HYG-03 is satisfied at that seam. No test-per-extracted-file and no mandatory `renderHook` suite.

### Claude's Discretion

All four grey areas accepted at the recommended answer. Remaining discretion is ordinary implementation within these constraints: hook file naming (`useX.ts` vs `_hooks/useX.ts`), exact `_components/` filenames, and the order the 7 files are decomposed (largest first is the obvious default).

### Deferred Ideas (OUT OF SCOPE)

- Phase 6 live-deploy shadow-mode operational review and v1 tenancy-residual risk acceptance — resume with `/gsd-verify-work 6`. Not part of this phase.
- Perf work (grid virtualization, server components for chrome) — PROJECT: follows the UI sweep, not part of it.
- SWR / React Query / shared `apiClient` — rejected for this phase; revisit only if a later milestone wants a data-fetching library.
- Playwright E2E for visual identity — Phase 1 out of scope; do not add it here.
- None of the 7 pages should gain new product features during the split.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Data fetching extracted into named hooks, separate from rendering | Hook owns fetch/loading/error/refetch; UI state stays in `_components/` modules; per-page colocated hook pattern documented below |
| UI-02 | `app/portfolio/report/page.tsx` decomposed, no file >400 lines | 10 section banners mapped; sub-split plan for sections >400 lines (Build Template Report, Build HTML Report, Page) |
| UI-03 | `app/projects/[id]/timeline/page.tsx` decomposed same way | 7 banners + inline sub-seams in Component section; fetch endpoints catalogued |
| UI-04 | `app/projects/[id]/report/page.tsx` decomposed same way | 8 banners mapped; AI/email/export fetch blocks identified |
| UI-05 | `app/projects/[id]/milestones/page.tsx` decomposed same way | 5 banners; ActivityDetail panel is natural module |
| UI-06 | `app/portfolio/roadmap/page.tsx` decomposed same way | 8 banners; phase vs milestone view modes |
| UI-07 | `components/timeline/ImportMappingDialog.tsx` decomposed same way | 6 banners; stays under `components/timeline/` |
| UI-08 | `app/page.tsx` decomposed same way | 8 banners; portfolio dashboard hook + presentational sections |
| UI-09 | No client imports of `@/lib/db`, repo, service, integration, or `pg` | Baseline grep clean; allowed `@/lib/status-weights` (pure); post-phase grep gate command |
| UI-10 | Component test per page: primary render + one interaction | Vitest jsdom + RTL pattern from `badge.test.tsx`; fetch mock recipe; Wave 0 config fix |
| UI-11 | Identical load/filter/export behavior | Test one interaction path per page; HYG-02 on any accidental fix; UAT checklist for visual |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Portfolio/project data load | Browser / Client (hook) | API / Backend | Pages already fetch JSON from `/api/*`; hooks stay client-side |
| Filter/selection/dialog UI state | Browser / Client (feature module) | — | Locked: not in hooks |
| Report/HTML/email generation display | Browser / Client (feature module) | API (AI endpoints) | Generation POST stays in hook or container handler; rendering is client |
| Export (Excel/PDF/PNG/client blob) | Browser / Client | API (binary export routes) | Client triggers fetch/download; server generates file |
| Tenant isolation / auth | API / Backend | — | Already enforced Phases 5–6; client never touches services |
| Pure progress math | Browser / Client | — | `@/lib/status-weights` is pure functions, safe in client bundle |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.4 | App Router, `'use client'` pages | Project stack [VERIFIED: package.json:24] |
| `react` / `react-dom` | 19.2.4 | Client components | Project stack [VERIFIED: package.json:28-29] |
| `vitest` | 4.1.10 | Test runner, jsdom project | Phase 1 harness [VERIFIED: vitest.config.ts:1-28] |
| `@testing-library/react` | 16.3.2 | Render + query component tests | React 19 compatible [VERIFIED: package.json:40] |
| `@testing-library/jest-dom` | 7.0.0 | DOM matchers (`toBeInTheDocument`) | Setup in `test/setup-jsdom.ts` [VERIFIED: test/setup-jsdom.ts:1] |
| `jsdom` | 30.0.1 | Browser environment for component tests | Vitest jsdom project [VERIFIED: package.json:46] |
| `sonner` | 2.0.7 | Toasts (existing, unchanged) | All god pages use `toast` [VERIFIED: app/portfolio/report/page.tsx:10] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/status-weights` | in-repo | `statusPct`, `weightedProgress` | Timeline + roadmap pages only — pure, no server deps [VERIFIED: lib/status-weights.ts:1-28] |
| `@/components/ui/*` | shadcn | Primitives | Existing import pattern — concrete paths, no barrel |
| `@/components/layout/Sidebar` | in-repo | Nav shell | Every authenticated page composes it |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` in hooks | SWR / React Query | **Rejected locked** — no library in stack; API redesign out of scope |
| `*.component.test.tsx` | MSW | **Rejected locked** — `vi.stubGlobal('fetch')` matches route-test isolation style |
| Project-root `hooks/` | Colocated page hooks | **Rejected locked** — footgun next to `lib/services` |

**Installation:** None — all dependencies already installed. No new packages this phase.

## Package Legitimacy Audit

> No external packages are installed in this phase. Existing stack verified in `package.json`.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (none new) | — | — | N/A |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (client component tree)                                │
│                                                                 │
│  page.tsx (thin container)                                      │
│    ├─ useXxx.ts hook ──fetch('/api/...')──► JSON state          │
│    ├─ _components/Toolbar.tsx  (filter UI state local)          │
│    ├─ _components/Grid.tsx     (renders hook data)              │
│    └─ _components/ExportDialog.tsx (dialog open state local)    │
│                                                                 │
│  ImportMappingDialog.tsx (shared, under components/timeline/)   │
│    └─ same pattern: hook + _components/                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fetch (session cookie)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  API / Backend (Phases 1–6 — unchanged)                         │
│  app/api/**/route.ts → service → repository                     │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
app/portfolio/report/
├── page.tsx                          # thin container (<400 lines)
├── usePortfolioReport.ts             # or _hooks/usePortfolioReport.ts
├── page.component.test.tsx           # render + filter/export interaction
├── types.ts                          # only if 2+ modules share types
└── _components/
    ├── ReportToolbar.tsx
    ├── ReportPreview.tsx
    ├── EmailModal.tsx
    ├── buildTemplateReport.ts        # pure helpers from banner sections
    ├── buildHtmlReport.ts            # may split further if >400 lines
    └── filterDataByProjects.ts

app/projects/[id]/timeline/
├── page.tsx
├── useTimelinePage.ts
├── page.component.test.tsx
└── _components/
    ├── ActivityDetail.tsx
    ├── RoadmapView.tsx
    ├── TimelineTable.tsx
    └── ...

components/timeline/
├── ImportMappingDialog.tsx           # thin container
├── useImportMapping.ts
├── ImportMappingDialog.component.test.tsx
└── _components/
    ├── MappingStep.tsx
    ├── CsvParser.ts                  # from banner section
    └── ...
```

Private folders use Next.js `_folderName` convention — excluded from routing [CITED: https://nextjs.org/docs/app/getting-started/project-structure#private-folders].

### Pattern 1: Colocated Data Hook

**What:** Move `useEffect` + `useCallback` fetch blocks from page into a named hook returning `{ data, loading, error, refetch, ...mutators }`.

**When to use:** Every god page — UI-01.

**Hook owns:** server-backed state, loading flags tied to fetch, refetch functions.

**Hook does NOT own:** filter selections, dialog open state, pagination UI, view mode toggles.

**Example:**

```typescript
// app/page.tsx pattern — after extraction
'use client';
import { usePortfolioDashboard } from './usePortfolioDashboard';
import { PortfolioHeader } from './_components/PortfolioHeader';
import Sidebar from '@/components/layout/Sidebar';

export default function PortfolioDashboard() {
  const { data, loading, companyName, meUser, refetch } = usePortfolioDashboard();
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  // ... UI-only state stays here or in _components/

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar />
      <main>...</main>
    </div>
  );
}
```

```typescript
// usePortfolioDashboard.ts — fetch unchanged from app/page.tsx:300-311
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

### Pattern 2: Section-Banner Module Extraction

**What:** Each `// ─── Section Name ───` block becomes a file (component for JSX, `.ts` for pure helpers).

**When to use:** Primary split seam per locked decision.

**Example banner inventory (verified line numbers):**

| File | Banner sections → modules |
|------|---------------------------|
| `app/portfolio/report/page.tsx` (2655 lines) | Types, Helpers, SummaryTemplates, EmailPromptTemplates, BuildTemplateReport, filterDataByProjects, markdownToHtml, emailDocWrapper, BuildHtmlReport, Page |
| `app/projects/[id]/timeline/page.tsx` | LagCalc, CsvHelpers, RoadmapHelpers, DateCell, ActivityDetail, RoadmapView, Component (+ inline sub-seams at 1260/1314/1333/1345/1361) |
| `app/projects/[id]/report/page.tsx` | Types, EmailPrompts, Helpers, SvgCharts, HtmlReportBuilder, TemplateTextBuilder, MainPage |
| `app/projects/[id]/milestones/page.tsx` | Types, Helpers, ActivityDetail, MainPage |
| `app/portfolio/roadmap/page.tsx` | Types, PhaseColours, EpicColours, Layout, QuickViewPresets, Helpers, ProjectInYearCheck, Page |
| `components/timeline/ImportMappingDialog.tsx` | ActivityFields, Types, ValueNormalizers, CsvParser, MainComponent |
| `app/page.tsx` (1020 lines) | Types, Helpers, HealthScoreArc, MiniSparkline, ListRow, ProjectCard, ProgramSection, Page |

### Pattern 3: Component Test with Mock Fetch

**What:** One `*.component.test.tsx` per page/dialog — render after fetch resolves, assert DOM, fire one filter or export interaction.

**When to use:** UI-10 + UI-11 per decomposed page.

**Example** (adapt from existing harness):

```typescript
// app/page.component.test.tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortfolioDashboard from './page';

vi.mock('next/navigation', () => ({ useParams: () => ({}) }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const portfolioFixture = { programs: [], projects: [], noProgramProjects: [] };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/portfolio') return Promise.resolve({ ok: true, json: () => Promise.resolve(portfolioFixture) });
    if (url === '/api/auth/me') return Promise.resolve({ ok: true, json: () => Promise.resolve({ company_name: 'Acme', onboarding_completed: 1 }) });
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as typeof fetch);
});

describe('PortfolioDashboard', () => {
  it('renders after load', async () => {
    render(<PortfolioDashboard />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('filters when program selected', async () => {
    render(<PortfolioDashboard />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    // fire one filter interaction — use stable visible label from existing UI
    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    // assert view mode changed (cards ↔ list) — behavior freeze, no new copy
  });
});
```

For pages with `useParams` (timeline, milestones, report): mock `useParams` to return `{ id: '1' }` [ASSUMED: standard Vitest `vi.mock('next/navigation')` pattern — not yet proven in-repo].

### Anti-Patterns to Avoid

- **Mechanical 400-line chunking:** Violates locked split strategy; use banner seams, then inner comment blocks only when a single banner section exceeds 400 lines.
- **Shared project-root `hooks/` or `lib/hooks/`:** Locked forbidden — colocate per page.
- **Moving filter state into hooks:** Violates UI-01 separation; hooks are fetch-only.
- **Introducing SWR/React Query/apiClient:** Locked out of scope.
- **Changing fetch URLs or response handling:** Behavior freeze — move verbatim.
- **Adding Playwright or MSW:** Locked out of scope.
- **Promoting page-local types to `lib/types/`:** Violates CONVENTIONS.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component test environment | Custom JSDOM setup | Existing `vitest.config.ts` jsdom project + `test/setup-jsdom.ts` | Phase 1 proven |
| Fetch mocking in tests | MSW server | `vi.stubGlobal('fetch', ...)` | Matches route-test `vi.mock` isolation style; zero deps |
| Data fetching library | Custom cache/refetch | Raw `fetch` in colocated hooks | Locked; stack has no SWR/RQ |
| Route-private colocation | Top-level `components/` for page-only UI | `app/.../page/_components/` | Keeps page-private code private |
| Server data in client | Direct `@/lib/db` import | Existing `/api/*` endpoints | UI-09 security gate |

**Key insight:** The decomposition problem is organizational, not technical — every pattern already exists in the codebase (client fetch pages, Vitest jsdom, section banners). Do not introduce abstractions the milestone explicitly rejected.

## Common Pitfalls

### Pitfall 1: Banner Section Still Exceeds 400 Lines

**What goes wrong:** `BuildHtmlReport` (lines 870–1538, ~668 lines) and `BuildTemplateReport` (213–779, ~566 lines) in portfolio report; `RoadmapView` (~467 lines); main `Component` sections in timeline and ImportMappingDialog (~900+ lines) exceed the limit as single extractions.

**Why it happens:** Locked rule says split on banners, but success criteria also cap at 400 lines per file.

**How to avoid:** Extract the banner block first, then sub-split within that block at existing inner comment seams (timeline page already has `// ─── Phase groups` at 1260, etc.) or at natural function/component boundaries — never arbitrary line counts.

**Warning signs:** Any extracted file still >400 lines after first pass.

### Pitfall 2: Vitest Won't Pick Up `*.component.test.tsx`

**What goes wrong:** New page tests silently never run.

**Why it happens:** Current jsdom include is `{components,app}/**/*.test.tsx` [VERIFIED: vitest.config.ts:22] but Phase 7 locks `*.component.test.tsx` [VERIFIED: 07-CONTEXT.md:60]. Phase 1 intent was `*.component.test.tsx` [VERIFIED: 01-CONTEXT.md:27] but implementation used `badge.test.tsx`.

**How to avoid:** Wave 0 — extend jsdom `include` to add `{components,app}/**/*.component.test.tsx` (keep existing `*.test.tsx` for badge).

### Pitfall 3: Behavior Drift During Move (HYG-02)

**What goes wrong:** Subtle filter/export payload change breaks production silently.

**Why it happens:** Large inline handlers get rewritten instead of moved.

**How to avoid:** Pure-move commits (HYG-01); copy fetch URLs/bodies verbatim; component test asserts one interaction path; name any fix in commit message.

**Warning signs:** Changed query strings, toast text, or default filter state.

### Pitfall 4: Hook Absorbs UI State

**What goes wrong:** `selectedProgramIds`, `viewMode`, dialog open flags land in hook — violates UI-01 and makes testing harder.

**How to avoid:** Hook returns only server-backed fields; container or `_components/` own UI state.

### Pitfall 5: Sidebar / next/navigation Break Tests

**What goes wrong:** Component test throws on `useParams` or Sidebar fetch.

**How to avoid:** `vi.mock('next/navigation')` and stub Sidebar as null render (see Pattern 3).

### Pitfall 6: `@/lib/status-weights` Mistaken for UI-09 Violation

**What goes wrong:** Planner removes valid pure-lib import from timeline/roadmap.

**Why it happens:** UI-09 grep targets `@/lib/db`, repos, services, integrations, `pg` only.

**How to avoid:** Grep gate uses explicit forbidden paths; `status-weights` stays.

## Code Examples

### UI-09 Verification Grep (post-phase gate)

```bash
# Must return zero matches in app/ and components/ client files
rg "from '@/lib/db'|from '@/lib/repositories|from '@/lib/services|from '@/lib/integrations|from 'pg'|from \"pg\"" app components --glob "*.tsx"
```

Baseline today: **zero matches** in `components/`; **zero forbidden imports** in the 7 god pages. Timeline imports `@/lib/status-weights` only [VERIFIED: app/projects/[id]/timeline/page.tsx:13].

### Fetch Endpoints Per God Page (move verbatim into hooks)

| Page | Primary load endpoints | Filter/export endpoints |
|------|------------------------|-------------------------|
| `app/page.tsx` | `/api/portfolio`, `/api/auth/me` | Program filter (client-side on loaded data) |
| `app/portfolio/report/page.tsx` | `/api/config`, `/api/portfolio/report?...`, `/api/auth/me` | `/api/portfolio/report` POST (AI), `/api/portfolio/report/generate-email`, `/api/portfolio/report/send-email`, client PNG/PDF export |
| `app/portfolio/roadmap/page.tsx` | `/api/portfolio/roadmap` | `/api/portfolio/milestones`, `/api/projects/{id}/milestones/{mid}/epics`, `/api/portfolio/roadmap/epics?project_id=` |
| `app/projects/[id]/timeline/page.tsx` | `/api/projects/{id}`, `/api/projects/{id}/activities`, `/api/projects/{id}/team`, `/api/projects/{id}/holidays` | Activity CRUD, CSV export (client), ImportMappingDialog, JiraSyncDialog |
| `app/projects/[id]/report/page.tsx` | `/api/config`, `/api/auth/me`, `/api/projects/{id}/project-report?...` | POST AI generate, `/api/projects/{id}/project-report/generate-email`, send-email |
| `app/projects/[id]/milestones/page.tsx` | `/api/projects/{id}/milestones`, `/api/projects/{id}/activities`, `/api/projects/{id}`, `/api/projects/{id}/team` | Milestone/epic CRUD |
| `ImportMappingDialog.tsx` | `/api/import-mapping`, `/api/projects/{id}/activities/import` | `/api/parse-file-headers` POST, mapping CRUD, import POST |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| God page: fetch + UI + helpers in one file | Container + hook + `_components/` | Phase 7 (this) | Testable seams, <400 lines per file |
| No page component tests | `*.component.test.tsx` per page | Phase 7 | UI-10/11 proof |
| Optional colocation | `_components/` private folders | Next.js App Router standard [CITED: nextjs.org project-structure] | Safe colocation beside routes |

**Deprecated/outdated:**
- "Large client pages acceptable — extract only when reused" (CONVENTIONS) — superseded by this phase's mandatory extraction.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vi.mock('next/navigation')` with `{ useParams: () => ({ id: '1' }) }` works for project pages | Pattern 3 | Tests fail to render; need `next/navigation` async mock for Next 16 |
| A2 | Sub-splitting oversized banner sections at inner comment seams satisfies "no mechanical 400-line chunk" | Pitfall 1 | Plan checker rejects module sizes |
| A3 | `{components,app}/**/*.component.test.tsx` added to vitest include is sufficient Wave 0 fix | Pitfall 2 | Tests don't run in CI |

**If A1 wrong:** Read `node_modules/next/dist/docs/` for Next 16 navigation testing guidance before executor starts project-scoped pages.

## Open Questions (RESOLVED)

1. **Exact sub-split boundaries for >400-line banner sections (portfolio BuildHtmlReport, timeline RoadmapView)**
   - What we know: Banner is the primary seam; inner comments exist in timeline Component section.
   - RESOLVED: Executor splits at top-level `function`/`const` boundaries inside the banner block — semantic seams, not arbitrary line counts.

2. **Hook granularity for portfolio report (many loaders)**
   - What we know: `loadConfig`, `loadData`, email flows are separate callbacks today [VERIFIED: app/portfolio/report/page.tsx:1582-1604].
   - RESOLVED: Single `usePortfolioReport` hook exporting all fetch state; split only if that file exceeds 400 lines.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next build | ✓ | v24.14.0 | — |
| npm | test/lint scripts | ✓ | 11.9.0 | — |
| vitest | UI-10 component tests | ✓ | 4.1.10 | — |
| jsdom | Component test env | ✓ | 30.0.1 | — |
| @testing-library/react | UI-10 | ✓ | 16.3.2 | — |
| PostgreSQL | Page runtime (not unit tests) | ✗ locally | — | Mock fetch — no DB needed for component tests |
| Docker / TEST_DATABASE_URL | Repo tests only | optional | — | Component tests unaffected |

**Missing dependencies with no fallback:** none for this phase.

**Missing dependencies with fallback:** Postgres only needed for `*.test.ts` repo suites, not page decomposition.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --project jsdom app/portfolio/report/page.component.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-10/11 | Portfolio home load + view toggle | component | `npx vitest run --project jsdom app/page.component.test.tsx` | ❌ Wave 0 |
| UI-10/11 | Portfolio report load + filter | component | `npx vitest run --project jsdom app/portfolio/report/page.component.test.tsx` | ❌ Wave 0 |
| UI-10/11 | Timeline load + phase filter | component | `npx vitest run --project jsdom "app/projects/[id]/timeline/page.component.test.tsx"` | ❌ Wave 0 |
| UI-10/11 | Project report load + generate | component | `npx vitest run --project jsdom "app/projects/[id]/report/page.component.test.tsx"` | ❌ Wave 0 |
| UI-10/11 | Milestones load + milestone select | component | `npx vitest run --project jsdom "app/projects/[id]/milestones/page.component.test.tsx"` | ❌ Wave 0 |
| UI-10/11 | Roadmap load + program filter | component | `npx vitest run --project jsdom app/portfolio/roadmap/page.component.test.tsx` | ❌ Wave 0 |
| UI-10/11 | Import dialog render + mapping step | component | `npx vitest run --project jsdom components/timeline/ImportMappingDialog.component.test.tsx` | ❌ Wave 0 |
| UI-09 | No forbidden client imports | static grep | `rg "from '@/lib/db'|..." app components --glob "*.tsx"` | ✅ gate script (0 matches today) |

### Sampling Rate

- **Per task commit:** `npx vitest run --project jsdom <new-page>.component.test.tsx`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + UI-09 grep clean before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — add `{components,app}/**/*.component.test.tsx` to jsdom project `include` (keep existing `*.test.tsx`)
- [ ] `app/page.component.test.tsx` — covers UI-08/UI-10/UI-11
- [ ] `app/portfolio/report/page.component.test.tsx` — covers UI-02
- [ ] `app/projects/[id]/timeline/page.component.test.tsx` — covers UI-03
- [ ] `app/projects/[id]/report/page.component.test.tsx` — covers UI-04
- [ ] `app/projects/[id]/milestones/page.component.test.tsx` — covers UI-05
- [ ] `app/portfolio/roadmap/page.component.test.tsx` — covers UI-06
- [ ] `components/timeline/ImportMappingDialog.component.test.tsx` — covers UI-07
- [ ] Shared test helper (optional): `test/mock-fetch.ts` for URL→fixture routing — only if duplication appears across 3+ pages (YAGNI until then)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (UI phase) | Session cookie already set; pages use `/api/auth/me` |
| V3 Session Management | no (UI phase) | — |
| V4 Access Control | yes (client boundary) | UI-09: client must not import server layers; all data via authorized API |
| V5 Input Validation | no (UI phase) | Validation at route boundary (Phase 5) — unchanged |
| V6 Cryptography | no (UI phase) | — |

### Known Threat Patterns for Next.js Client Pages

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client imports `@/lib/db` / repos / services | Elevation of privilege / IDOR | UI-09 grep gate; move behind `/api/` if found |
| Client-side fetch bypassing auth | Spoofing | Existing session cookie on fetch; API wrappers enforce auth (Phase 5–6) |
| Accidental secret in client bundle | Information disclosure | No server imports in `'use client'` files |

## Project Constraints (from .cursor/rules/)

- **Next.js 16 breaking changes:** Read `node_modules/next/dist/docs/` before assuming App Router APIs — do not rely on training-data Next.js patterns [VERIFIED: AGENTS.md:1-5].
- **RTK prefix:** Use `rtk` prefix on shell commands when applicable (project CLAUDE.md / user rules).

## Sources

### Primary (HIGH confidence)

- In-repo god page section banners and fetch calls — verified via codegraph + Read [VERIFIED: line ranges cited above]
- `vitest.config.ts`, `test/setup-jsdom.ts`, `components/ui/badge.test.tsx` — Phase 1 harness [VERIFIED: read this session]
- `07-CONTEXT.md` — locked decisions [VERIFIED: read this session]
- UI-09 baseline grep — zero forbidden imports in client components [VERIFIED: grep this session]

### Secondary (MEDIUM confidence)

- [Next.js project structure — private folders](https://nextjs.org/docs/app/getting-started/project-structure#private-folders) — `_components/` colocation

### Tertiary (LOW confidence)

- Vitest `vi.mock('next/navigation')` for Next 16 — standard pattern [ASSUMED: A1]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing pinned deps, no new packages
- Architecture: HIGH — locked CONTEXT decisions + verified codebase patterns
- Pitfalls: HIGH — banner inventory and vitest config mismatch confirmed in-repo

**Research date:** 2026-08-25
**Valid until:** 2026-09-25 (stable refactor patterns)
