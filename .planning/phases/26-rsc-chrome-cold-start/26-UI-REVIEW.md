# Phase 26 — UI Review

**Audited:** 2026-08-29
**Baseline:** 26-UI-SPEC.md (preserve-existing contract)
**Screenshots:** not captured (no dev server at localhost:3000, 5173, or 8080)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Pilot `loading.tsx` and module hook-loading copy match UI-SPEC verbatim; ERROR_COPY unchanged |
| 2. Visuals | 3/4 | PageChrome shell classes match contract; code-only audit cannot confirm pixel regression |
| 3. Color | 4/4 | New shells use spec tokens (`bg-slate-50`, `border-blue-500`, `text-slate-400/600`) with no new hex |
| 4. Typography | 4/4 | PageLoadingShell/PageErrorShell use `text-sm` weight-400 only; no third weight introduced |
| 5. Spacing | 4/4 | Per-route `mainClassName` preserved verbatim; gate covers 32 chrome routes |
| 6. Experience Design | 3/4 | RSC boundary enforced; 5 pilot `loading.tsx` only; `PageErrorShell` defined but unused |

**Overall: 22/24**

**Chrome verdict:** No evidence Phase 26 accidentally redesigned UI. New server shells extract duplicated markup; module pages retain hook-driven loading/error panels with class-equivalent markup. Deviations flagged below are gaps in optional server-side wiring or unverified visual regression — not copy or spacing regressions.

---

## Top 3 Priority Fixes

1. **Run URL smoke with dev server when available** — Code-only audit could not capture pixel-level regression. Hit representative Page Inventory URLs (`/dashboards/portfolio`, `/projects/[id]/timeline`, `/documents/catalog`) and confirm Sidebar NAV, outer shell, spinner size/color, and loading copy match pre-Phase-26 behavior.
2. **Decide fate of `PageErrorShell`** — `components/layout/PageErrorShell.tsx` matches UI-SPEC markup but is never imported by any route or `error.tsx`. Client modules correctly keep inline error panels (D-03). Either wire it to server error boundaries for navigation-time errors, or remove the dead export to avoid drift between two error implementations.
3. **Extend `loading.tsx` beyond pilots or document the gap** — Only 5 routes have server `loading.tsx` (dashboards, weekly periods/tracking, audit). Non-pilot chrome routes (e.g. `/`, `/documents/catalog`, `/projects`) rely on client hook spinners after hydration. Per UI-SPEC this is optional, but users may see a brief blank main on slow networks before client JS loads — consider adding `loading.tsx` to high-traffic routes if that flash is visible in smoke.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Pilot route `loading.tsx` messages match UI-SPEC Copywriting Contract verbatim:

| File | Message | Spec |
|------|---------|------|
| `app/dashboards/portfolio/loading.tsx:7` | `Loading dashboard…` | ✅ |
| `app/dashboards/pm/loading.tsx:7` | `Loading dashboard…` | ✅ |
| `app/weekly/periods/loading.tsx:7` | `Loading weekly periods…` | ✅ |
| `app/weekly/tracking/loading.tsx:7` | `Loading tracking…` | ✅ |
| `app/audit/loading.tsx:7` | `Loading audit log…` | ✅ |

Client module hook-loading copy preserved with same strings, e.g.:

- `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx:31` — `Loading dashboard…`
- `modules/portfolio/ui/home/PortfolioHomePage.tsx:92` — `Loading portfolio...` (three ASCII dots per spec table)
- `modules/documents/ui/catalog/DocumentCatalogPage.tsx:67` — `Loading document catalog…`

ERROR_COPY unchanged in client modules (`PortfolioDashboardPage.tsx:15–18`: unauthorized/forbidden/load_failed dashboard strings).

**WARNING (pre-existing, preserved):** Ellipsis inconsistency (`…` vs `...`) on portfolio/project loading strings — present in UI-SPEC table and unchanged by chrome extraction.

Gate test `PILOT_LOADING` asserts copy strings (`lib/rsc-chrome.gate.test.ts:203–308`). All 11 gate tests pass.

### Pillar 2: Visuals (3/4)

**WARNING:** No screenshots — visual hierarchy, Sidebar active states, and mobile drawer behavior unverified this audit.

Positive preservation signals from code:

- `PageChrome.tsx:13–16` — outer shell `flex flex-col lg:flex-row min-h-screen bg-slate-50` + `<main>` landmark matches D-01 contract.
- `PageLoadingShell.tsx:3–6` — centered column, `w-8 h-8` spinner, message below — matches spec markup.
- `PageErrorShell.tsx:5–8` — `AlertTriangle h-8 w-8 text-muted-foreground` + centered message — matches spec (unused in routes).
- Module pages no longer render duplicate shell: grep finds zero `min-h-screen bg-slate-50` or Sidebar imports in `modules/**/*Page.tsx`.
- Per-route visual exceptions preserved: e.g. `app/portfolio/roadmap/page.tsx` uses `flex flex-col overflow-hidden`; `app/projects/[id]/report/page.tsx` uses `flex-1 min-w-0`.

**WARNING:** `PageErrorShell` is dead code — no consumer imports it. Not a user-visible regression (client inline errors render), but two parallel error markups exist in codebase.

EXCLUDED routes unchanged: `app/login`, `app/landing`, `app/operations/*`, `app/portfolio/budget` remain client re-exports without PageChrome (gate test D-05/D-06).

### Pillar 3: Color (4/4)

New server shell color usage matches UI-SPEC exactly:

| Element | Classes | Spec role |
|---------|---------|-----------|
| Page shell | `bg-slate-50` | Dominant 60% canvas |
| Spinner ring | `border-blue-500 border-t-transparent` | Accent loading |
| Loading message | `text-slate-400` | Muted loading copy |
| Error message | `text-slate-600` | Error body copy |
| Error icon | `text-muted-foreground` | Semantic muted |

No hardcoded `#hex` or `rgb()` in `components/layout/Page{Chrome,LoadingShell,ErrorShell}.tsx`.

Accent not expanded: new shells use blue only on spinner ring — same element class as pre-refactor inline spinners in module pages (`PortfolioDashboardPage.tsx:30`).

Sidebar color palette untouched (still `bg-[#0f172a]` via existing client component — pre-existing, not introduced in Phase 26).

### Pillar 4: Typography (4/4)

New Phase 26 layout files introduce no new font weights:

- `PageLoadingShell.tsx:5` — `text-slate-400 text-sm` (400)
- `PageErrorShell.tsx:7` — `text-sm text-slate-600` (400)
- `PageChrome.tsx` — no typography classes (structural only)

**WARNING (pre-existing baseline debt, not Phase 26):** `Sidebar.tsx` uses `font-bold`, `font-semibold`, `font-medium` — unchanged from pre-Phase-26. UI-SPEC D-06 two-weight rule applies to refactored files; new shells comply.

Four size roles in production unchanged; chrome extraction did not add display/heading sizes to shell components.

### Pillar 5: Spacing (4/4)

Per-route `mainClassName` passed verbatim from server wrappers — intentional variance preserved per 26-UI-SPEC Pitfall 4:

| Route | `mainClassName` |
|-------|-----------------|
| Default dashboards | `flex-1 p-4 lg:p-6 lg:p-8 overflow-auto` |
| Project hub | `flex-1 p-4 lg:p-8 max-w-5xl` |
| New project | `flex-1 p-4 lg:p-8 max-w-2xl` |
| Timeline | `flex-1 p-4 lg:p-6 overflow-x-auto` |
| Roadmap | `flex-1 flex flex-col overflow-hidden` |
| Project report | `flex-1 min-w-0` |

Loading/error centered main: pilot `loading.tsx` files use `flex-1 flex items-center justify-center` — matches spec.

`PageLoadingShell` uses `gap-3` (12px) — consistent with pre-refactor inline spinners (`gap-3` in `PortfolioDashboardPage.tsx:29`).

No new arbitrary spacing in shell components. Pre-existing Sidebar `text-[10px]` arbitrary values unchanged.

### Pillar 6: Experience Design (3/4)

**State coverage — preserved:**

- **Route navigation loading:** 5 pilot `loading.tsx` wrap `PageChrome` + `PageLoadingShell` — server-rendered chrome + spinner before client hydration (D-03, D-06).
- **Hook-driven loading:** Client modules retain inline spinner markup with identical classes (`border-blue-500`, `gap-3`, `text-slate-400 text-sm`) — e.g. all 26 module pages with spinners grep-match `border-blue-500 border-t-transparent`.
- **Hook-driven error:** Inline `AlertTriangle` + ERROR_COPY panels preserved in client modules; no server shell imports from client files (gate test D-03).
- **RSC boundary:** `lib/rsc-chrome.gate.test.ts` — 32 CHROME_ROUTES are Server Components; 28 module pages stripped of Sidebar; EXCLUDED routes stay client.
- **projectId forwarding:** All 16 project-scoped `app/projects/[id]/**/page.tsx` wrappers pass `projectId={id}` to PageChrome.

**WARNING:** Non-pilot chrome routes lack `loading.tsx`. Navigation to `/`, `/documents/catalog`, `/projects` may show empty main until client bundle hydrates — pre-existing behavior for most routes before Phase 26, but RSC wrapper theoretically enables server loading UI that is not yet wired.

**WARNING:** `PageErrorShell` never used — no server `error.tsx` files compose it. Error UX depends entirely on client hook branches (unchanged from pre-refactor).

**INFO:** `app/portfolio/budget/page.tsx` excluded from PageChrome per D-05/D-06 — UI-SPEC Page Inventory table lists it under chrome routes but CONTEXT/gate explicitly exclude it; implementation matches gate, not inventory table.

Registry audit: shadcn initialized; UI-SPEC lists no third-party registries — **0 third-party blocks checked, no flags**.

Automated evidence: `npx vitest run --project node lib/rsc-chrome.gate.test.ts` — 11/11 passed.

---

## Files Audited

**New layout shells:**
- `components/layout/PageChrome.tsx`
- `components/layout/PageLoadingShell.tsx`
- `components/layout/PageErrorShell.tsx`

**Pilot loading routes:**
- `app/dashboards/portfolio/loading.tsx`
- `app/dashboards/pm/loading.tsx`
- `app/weekly/periods/loading.tsx`
- `app/weekly/tracking/loading.tsx`
- `app/audit/loading.tsx`

**Sample server wrappers:**
- `app/page.tsx`
- `app/dashboards/portfolio/page.tsx`
- `app/projects/[id]/timeline/page.tsx`
- `app/projects/[id]/report/page.tsx`
- `app/portfolio/roadmap/page.tsx`

**Sample stripped client modules:**
- `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx`
- `modules/portfolio/ui/home/PortfolioHomePage.tsx`
- `modules/documents/ui/catalog/DocumentCatalogPage.tsx`

**Gate / contract:**
- `lib/rsc-chrome.gate.test.ts`
- `.planning/phases/26-rsc-chrome-cold-start/26-UI-SPEC.md`
- `components/layout/Sidebar.tsx` (unchanged baseline reference)
- `components.json`
