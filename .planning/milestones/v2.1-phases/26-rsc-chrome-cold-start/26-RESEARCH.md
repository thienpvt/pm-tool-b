# Phase 26: RSC Chrome & Cold Start - Research

**Researched:** 2026-08-29
**Domain:** Next.js 16 App Router Server/Client composition; PostgreSQL cold-start timing in Vitest
**Confidence:** HIGH

## Summary

Phase 26 delivers two independent performance outcomes: **server-rendered static chrome** on v2 authenticated pages (PERF-02) and a **recorded cold-start budget** for `getDb()` after Phase 19 removed inline migrate from the boot path (PERF-03). No new npm packages, no visual redesign, and no conversion of data-fetching pages to full RSC.

Today every v2 route is a `'use client'` re-export in `app/**/page.tsx`, and each module page duplicates the same shell: outer flex container, `<Sidebar />`, and `<main>`. Loading and error branches repeat that shell again. The root layout (`app/layout.tsx`) is already a Server Component with fonts and toaster only — it does not provide nav chrome. Extracting a server `PageChrome` and static loading/error shells lets the HTML payload include layout + nav slot markup on first paint while `Sidebar` stays client-side for `/api/auth/me` and project list fetches (D-02).

Cold-start measurement targets the real boot path in `lib/db.ts`: create pool → `assertMigrated` → seed check — not schema migration. Use Vitest with `TEST_DATABASE_URL`, `vi.resetModules()` per sample, `pool.end()` teardown, p95 assertion (fail >5000ms, document 2000ms target in `COLD-START.md`).

**Primary recommendation:** Wave 1 — add server `PageChrome` + shells, convert `app/**/page.tsx` to server wrappers (exclude login/landing/operations), strip duplicated shell from module pages. Wave 2 — add `lib/db.cold-start.test.ts` + `COLD-START.md` budget artifact.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `app/layout.tsx` stays a Server Component (already is). Add a server `PageChrome` (or equivalent) that owns `min-h-screen bg-slate-50` + main landmark. Do not mark the root layout `'use client'`.
- **D-02:** `components/layout/Sidebar.tsx` stays `'use client'` because it fetches `/api/auth/me`. Do not move session fetch into a client layout. Optional: a thin server wrapper that renders the client Sidebar as a child.
- **D-03:** KPI / page loading shells that are static markup become Server Components. Data-fetching dashboard/weekly/document pages remain client (preserve-existing). No visual redesign (2 font weights).
- **D-04:** Cold-start measurement is a vitest or `tsx` script that times `getPool()`/`getDb()` against TEST_DATABASE_URL (migrate already applied). Record budget in `.planning/phases/26-rsc-chrome-cold-start/COLD-START.md` (p95 target: 2000ms local connect+assert; fail the test if p95 exceeds 5000ms so CI is not flaky).
- **D-05:** No new npm. Isolation none. TDD. No second pool. Do not add `withCpmo` to ops/admin companies.
- **D-06:** UI-SPEC is preserve-existing. Typography: 400 + 600 only.

### Claude's Discretion
Grey areas auto-accepted: chrome-only RSC, Sidebar stays client, cold-start budget 2s target / 5s CI fail, no new npm, preserve-existing UI.

### Deferred Ideas (OUT OF SCOPE)
- Nits, Nyquist remainder, operator HYG-02 — Phase 27
- Full RSC data fetching for dashboards
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-02 | Static chrome (layout, nav, KPI shells) on v2 pages renders as Server Components | Server `PageChrome` + `PageLoadingShell`/`PageErrorShell`; server `app/**/page.tsx` wrappers; optional route `loading.tsx`; module pages strip inline shell |
| PERF-03 | Cold-start connect time is measured and has a recorded budget after migrate cutover | Vitest integration test with `vi.resetModules`, `TEST_DATABASE_URL`, p95 gate; `COLD-START.md` artifact |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page shell (`min-h-screen`, flex, `<main>` landmark) | Frontend Server (RSC) | — | Static markup; no hooks; belongs in server `PageChrome` [CITED: next.js Server/Client docs] |
| Nav sidebar (auth, projects, mobile drawer) | Browser / Client | — | Uses `usePathname`, `useEffect` + `fetch('/api/auth/me')` — must stay `'use client'` [VERIFIED: components/layout/Sidebar.tsx:1-4,406-408] |
| Route-level instant loading UI | Frontend Server (RSC) | — | `loading.tsx` is Server Component by default [CITED: next.js loading.js convention] |
| In-page data loading spinners | Browser / Client | — | Client hooks (`usePortfolioSpecDashboard`, etc.) still gate content; inner spinner only, no duplicated outer shell |
| KPI tile grid (clickable drill-down) | Browser / Client | — | `onClick`, `aria-pressed`, client state — stays client [VERIFIED: modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx:1,38-79] |
| KPI / page loading shells (spinner + copy) | Frontend Server (RSC) | — | Static markup extracted to server components per D-03 |
| DB pool connect + migrate assert | API / Backend | Database | `getDb()` singleton in `lib/db.ts` [VERIFIED: lib/db.ts:128-148] |
| Cold-start benchmark | Test (Vitest node) | Database | Times real `getDb()` against `TEST_DATABASE_URL` [VERIFIED: test/db.ts:3-6] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.4 | App Router RSC + client boundaries | Project pin [VERIFIED: package.json:27] |
| react / react-dom | 19.2.4 | Server/Client components | Project pin [VERIFIED: package.json:31-32] |
| vitest | 4.1.10 | Cold-start timing + component tests | Project pin [VERIFIED: package.json:55] |
| pg | 8.20.0 | Pool under test for cold start | Used by `getDb()` [VERIFIED: package.json:29, lib/db.ts:135-138] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.2 | Module page component tests after shell strip | Update existing `*.component.test.tsx` mocks |
| tsx | 4.23.12 | Optional one-off cold-start script | Only if Vitest module isolation proves insufficient (prefer Vitest per D-04) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server `PageChrome` wrapper | Client layout group | Violates D-01; keeps chrome in client bundle |
| Route `loading.tsx` only | Client-only loading branches | Does not server-render chrome on client-side `loading` state after mount |
| New APM npm (Datadog, etc.) | Vitest timing test | Explicitly out of scope per CONTEXT |

**Installation:** None — no new packages (D-05).

## Package Legitimacy Audit

> Phase installs no external packages.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| — | — | — | No installs |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Browser request
    │
    ▼
app/layout.tsx (RSC — fonts, body bg, Toaster)
    │
    ▼
app/.../page.tsx (RSC — NEW: remove 'use client')
    │
    ├── PageChrome (RSC)
    │       ├── Sidebar ('use client' — fetch /api/auth/me, /api/projects)
    │       └── <main>{children}</main>
    │
    └── ClientPageModule ('use client' — data hooks, KPI widgets, tables)
            └── renders content ONLY (no outer shell)

Optional parallel branch on navigation:
app/.../loading.tsx (RSC)
    └── PageChrome > PageLoadingShell(message)

Cold-start benchmark (Vitest node, not request path):
TEST_DATABASE_URL → vi.resetModules → import getDb → assertMigrated path → pool.end()
    └── record p95 → COLD-START.md
```

### Recommended Project Structure

```
components/layout/
├── Sidebar.tsx              # unchanged 'use client'
├── PageChrome.tsx           # NEW — Server Component (no directive)
├── PageLoadingShell.tsx     # NEW — Server Component spinner + message
└── PageErrorShell.tsx       # NEW — Server Component error panel (static markup)

app/dashboards/portfolio/
├── page.tsx                 # RSC wrapper: PageChrome > PortfolioDashboardPage
└── loading.tsx              # optional: PageChrome > PageLoadingShell

modules/dashboards/ui/portfolio/
└── PortfolioDashboardPage.tsx   # stays 'use client'; strips shell branches

lib/
└── db.cold-start.test.ts    # NEW — PERF-03 integration benchmark

.planning/phases/26-rsc-chrome-cold-start/
└── COLD-START.md            # NEW — recorded samples + p95 budget
```

### Pattern 1: Server PageChrome wraps client Sidebar + children

**What:** A Server Component owns the static page frame; it imports the existing client `Sidebar` as a child (allowed — server parents may render client children). [CITED: https://github.com/vercel/next.js/blob/v16.2.9/docs/01-app/01-getting-started/05-server-and-client-components.mdx]

**When to use:** Every v2 authenticated page that today duplicates `flex … min-h-screen bg-slate-50` + `<Sidebar />`.

**Example:**

```tsx
// components/layout/PageChrome.tsx — Server Component (no 'use client')
import Sidebar from '@/components/layout/Sidebar';

export function PageChrome({
  children,
  projectId,
  mainClassName = 'flex-1 overflow-auto',
}: {
  children: React.ReactNode;
  projectId?: string;
  mainClassName?: string;
}) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar projectId={projectId} />
      <main className={mainClassName}>{children}</main>
    </div>
  );
}
```

### Pattern 2: Server route page wraps client module (strip inner shell)

**What:** Remove `'use client'` from `app/**/page.tsx`; module page keeps `'use client'` but only renders main content.

**When to use:** All targeted v2 routes listed in rollout table below.

**Example:**

```tsx
// app/dashboards/portfolio/page.tsx — Server Component
import { PageChrome } from '@/components/layout/PageChrome';
import PortfolioDashboardPage from '@/modules/dashboards/ui/portfolio/PortfolioDashboardPage';

export default function Page() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <PortfolioDashboardPage />
    </PageChrome>
  );
}
```

```tsx
// modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx — client body only
'use client';
import { PageLoadingShell } from '@/components/layout/PageLoadingShell'; // ❌ INVALID — cannot import RSC into client

// Correct: client loading branch uses inline minimal spinner OR route loading.tsx handles first paint.
if (loading) {
  return (
    <div className="flex flex-col items-center gap-3 flex-1 flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">Loading dashboard…</p>
    </div>
  );
}
```

**Critical boundary rule:** Client Components cannot import Server Components. Loading shells used *inside* client pages during hook-driven `loading` states must either remain minimal client markup (same classes, no redesign) **or** rely on route-level `loading.tsx` for navigation-time loading. Server `PageLoadingShell` is for `loading.tsx` and server pages only. [CITED: next.js Server and Client Components composition rules]

### Pattern 3: Route-level loading.tsx for instant server loading chrome

**What:** Co-located `loading.tsx` wraps the page segment in Suspense and shows server loading UI immediately on navigation. [CITED: https://github.com/vercel/next.js/blob/v16.2.9/docs/01-app/03-api-reference/03-file-conventions/loading.mdx]

**When to use:** High-traffic v2 routes (dashboards, weekly, documents) where first paint should include chrome + spinner without waiting for client JS hydration.

**Example:**

```tsx
// app/dashboards/portfolio/loading.tsx
import { PageChrome } from '@/components/layout/PageChrome';
import { PageLoadingShell } from '@/components/layout/PageLoadingShell';

export default function Loading() {
  return (
    <PageChrome mainClassName="flex-1 flex items-center justify-center">
      <PageLoadingShell message="Loading dashboard…" />
    </PageChrome>
  );
}
```

### Pattern 4: Cold-start Vitest benchmark with module reset

**What:** Measure true cold `getDb()` by resetting the module singleton between samples.

**When to use:** PERF-03; run in CI only when `TEST_DATABASE_URL` is set (same gate as repo tests).

**Example:**

```typescript
// lib/db.cold-start.test.ts
import { afterAll, describe, expect, it, vi } from 'vitest';
import { closeTestPool, hasTestDb, TEST_DATABASE_URL } from '@/test/db';

const SAMPLE_COUNT = 20;
const P95_FAIL_MS = 5000;

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

describe.skipIf(!hasTestDb)('getDb cold start (PERF-03)', () => {
  afterAll(async () => {
    await closeTestPool();
  });

  it(`p95 connect+assert ≤ ${P95_FAIL_MS}ms`, async () => {
    const samples: number[] = [];

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      vi.resetModules();
      process.env.DATABASE_URL = TEST_DATABASE_URL!;
      const t0 = performance.now();
      const { getDb, getPool } = await import('@/lib/db');
      await getDb();
      samples.push(performance.now() - t0);
      const pool = await getPool();
      await pool.end();
    }

    const measured = p95(samples);
    expect(measured).toBeLessThan(P95_FAIL_MS);
    // Executor writes measured p95 + samples to COLD-START.md (target note: 2000ms)
  }, 120_000);
});
```

### Anti-Patterns to Avoid

- **Marking root layout `'use client'`:** Forces entire tree client-side; violates D-01 [VERIFIED: app/layout.tsx:13-21 has no `'use client'`].
- **Importing `PageLoadingShell` inside `'use client'` module pages:** Breaks RSC boundary; build error or unintended client bundling.
- **Moving `/api/auth/me` fetch to a Server Component:** Would change auth pattern and session handling; violates D-02.
- **Second pool or test-only pool in production code:** Violates D-05; use `vi.resetModules()` + `pool.end()` instead.
- **Running cold-start test without `_test` DB guard:** `test/db.ts` refuses non-`_test` database names [VERIFIED: test/db.ts:14-16].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server/client boundary | Custom bundler hints | Next.js default RSC boundaries | Mis-placed `'use client'` silently ships server logic to client |
| Route loading fallback | Manual Suspense in every page | `loading.tsx` convention | Built-in instant loading state [CITED: next.js loading.js] |
| Percentile stats | New stats npm | 10-line p95 in test file | D-05 no new npm |
| DB migrate on boot | Re-inline migrate in `getDb()` | `assertMigrated` only | Phase 19 cutover; migrate is external job |
| APM for cold start | Datadog/New Relic agent | Vitest timing + markdown artifact | Explicitly out of scope |

**Key insight:** The performance win is **moving repeated static shell markup to the server tier**, not rewriting data fetching. Keep client hooks intact; delete duplicated outer shells.

## v2 Page Rollout Inventory

Pages **with** standard Sidebar chrome (include in Wave 26-01/02):

| Area | Module page | App route | Notes |
|------|-------------|-----------|-------|
| Portfolio home | `modules/portfolio/ui/home/PortfolioHomePage.tsx` | `app/page.tsx` | |
| Dashboards | `PortfolioDashboardPage`, `PmDashboardPage` | `app/dashboards/portfolio`, `app/dashboards/pm` | Pilot routes |
| Weekly | `WeeklyPeriodsPage`, `WeeklyTrackingPage`, `WeeklyReportEditorPage` | `app/weekly/*`, `app/projects/[id]/weekly-reports/[reportId]` | |
| Documents | catalog, compliance, checklist | `app/documents/*`, `app/projects/[id]/document-checklist` | |
| Audit | `AuditLogPage` | `app/audit` | |
| Portfolio | roadmap, report, budget, programs, resources | `app/portfolio/*`, `app/programs`, `app/resources` | |
| Projects | hub, dashboard, timeline, milestones, etc. | `app/projects/**` | Pass `projectId` to `PageChrome` / `Sidebar` where used today |
| Reports | project/portfolio report pages | `app/projects/[id]/report`, `app/portfolio/report` | |
| Admin | `AdminPage` | `app/admin` | Has Sidebar [VERIFIED: modules/admin/ui/AdminPage.tsx:4] |

Pages **without** standard chrome (exclude from `PageChrome` rollout):

| Route | Reason |
|-------|--------|
| `app/login`, `app/landing` | Auth/marketing; no Sidebar |
| `app/operations`, `app/operations/[id]` | Standalone layout preserved in Phase 24 [VERIFIED: modules/operations/ui/OperationsListPage.tsx:1-13 — no Sidebar import] |

**Scale:** ~35 `app/**/page.tsx` files carry `'use client'` today [VERIFIED: grep count]; ~30 need server wrapper conversion after exclusions.

## Common Pitfalls

### Pitfall 1: Client page imports server shell component

**What goes wrong:** Build fails or shell becomes client-bundled, defeating PERF-02.

**Why it happens:** Developer extracts `PageLoadingShell` then imports it inside `'use client'` module page.

**How to avoid:** Server shells only in `app/**/page.tsx`, `loading.tsx`, or other server files; client pages render inner content or duplicate minimal spinner markup for hook-driven loading.

**Warning signs:** `'use client'` file importing from `PageChrome.tsx`.

### Pitfall 2: Duplicated shell left in loading/error branches

**What goes wrong:** Sidebar renders twice or layout classes diverge after refactor.

**Why it happens:** Partial refactor — success path uses wrapper but `if (loading)` still wraps `<Sidebar />`.

**How to avoid:** Mechanical search for `<Sidebar />` inside module pages; each occurrence should be removed when route uses `PageChrome`.

**Warning signs:** Component tests still mock Sidebar inside module page tests — acceptable for now, but module should not render Sidebar after strip.

### Pitfall 3: Cold-start test measures warm singleton

**What goes wrong:** p95 ≈ 0ms; false green budget.

**Why it happens:** `_client` / `_pool` module cache survives between iterations [VERIFIED: lib/db.ts:113-114,129].

**How to avoid:** `vi.resetModules()` before each `import('@/lib/db')`; call `pool.end()` after each sample.

**Warning signs:** All samples identical sub-10ms with no pool teardown.

### Pitfall 4: `main` padding mismatch changes visuals

**What goes wrong:** UI-SPEC preserve-existing violation.

**Why it happens:** `PageChrome` uses default `main` classes that differ from per-page padding (e.g. `p-4 lg:p-6 lg:p-8` vs centered loading).

**How to avoid:** Pass `mainClassName` prop mirroring each page's current `<main className="…">` verbatim from module page.

**Warning signs:** Visual diff on dashboard vs weekly pages in human verify.

### Pitfall 5: Component tests break after Sidebar removal

**What goes wrong:** Tests expect sidebar mock inside module page render tree.

**Why it happens:** Existing pattern mocks `@/components/layout/Sidebar` in module tests [VERIFIED: modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx:6].

**How to avoid:** Remove Sidebar mock from module tests; optionally add thin server page smoke test or keep layout testing in human verify (D-06 preserve-existing).

**Warning signs:** `getByTestId('sidebar')` failures post-refactor.

## Code Examples

### Server loading shell (static markup)

```tsx
// components/layout/PageLoadingShell.tsx — Server Component
export function PageLoadingShell({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}
```

Matches existing copy/classes [VERIFIED: modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx:29-35]:
```
"flex flex-col lg:flex-row min-h-screen bg-slate-50"
"w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
"text-slate-400 text-sm"
"Loading dashboard…"
```

### getDb boot path (what cold-start measures)

```typescript
// lib/db.ts excerpt — connect + assert + seed (no migrate loop)
export async function getDb(): Promise<DbClient> {
  if (_client) return _client;
  // ...
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: resolveSsl(...) });
  try {
    await assertMigrated((sql) => pool.query(sql));
    _pool = pool;
    _client = new PostgresClient(pool);
    await seedAuthData(_client);
    return _client;
  } catch (err) {
    await pool.end();
    throw err;
  }
}
```
[VERIFIED: lib/db.ts:128-148]

### assertMigrated (fast ledger check)

```typescript
const res = await query(`SELECT 1 FROM ${ledgerTable} LIMIT 1`);
if (res.rows.length === 0) throw new Error(RUNBOOK_MESSAGE);
```
[VERIFIED: lib/migrate/assertMigrated.ts:27-29]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline migrate in `getDb()` | External `npm run migrate` + `assertMigrated` | Phase 19 | Cold-start measures connect+assert only |
| Monolithic client page with shell | Server wrapper + client body | Phase 26 (this) | Chrome in RSC payload |
| All `app/page.tsx` client re-exports | Server pages compose client modules | Phase 26 (this) | Matches Next.js 16 recommended layout pattern [CITED: next.js docs] |

**Deprecated/outdated:**
- Duplicated per-page `min-h-screen bg-slate-50` + `<Sidebar />` blocks inside every loading/error/success branch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Route `loading.tsx` is sufficient for navigation-time server loading chrome; hook-driven client `loading` may keep minimal client spinner | Pattern 2 | Minor — inner spinner still client-rendered during refetch |
| A2 | `vi.resetModules()` fully clears `_client`/`_pool` singleton between cold-start samples | Pattern 4 | False budget if warm cache persists — mitigate with assert sub-50ms detection |
| A3 | Operations routes stay excluded from PageChrome | Rollout inventory | Adding chrome would be visual regression vs Phase 24 preserve |
| A4 | KPI "shells" means loading placeholders, not interactive `PortfolioKpiTiles` | Summary | Mis-scoping if planner RSC-converts clickable tiles |

## Open Questions

1. **Shared vs per-route loading.tsx**
   - What we know: Messages differ (`Loading dashboard…`, `Loading weekly periods…`, etc.) [VERIFIED: modules/weekly/ui/periods/WeeklyPeriodsPage.tsx:32].
   - What's unclear: Whether to add `loading.tsx` on every route or only pilots.
   - Recommendation: Pilot on dashboards + weekly; expand if human verify shows navigation flash without it.

2. **Project-scoped `projectId` prop propagation**
   - What we know: `Sidebar` accepts optional `projectId` [VERIFIED: components/layout/Sidebar.tsx:394].
   - What's unclear: Which project pages pass it today.
   - Recommendation: Grep each `app/projects/[id]/**/page.tsx` wrapper and forward `params.id` to `PageChrome`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next build | ✓ (assumed) | 20+ | — |
| PostgreSQL TEST_DATABASE_URL | Cold-start test | ✗/✓ (CI-dependent) | — | `describe.skipIf(!hasTestDb)` skips locally [VERIFIED: test/db.ts:5-6] |
| npm run migrate (pre-applied) | assertMigrated pass | ✓ (dev/CI setup) | — | Test fails with RUNBOOK_MESSAGE if ledger empty |

**Missing dependencies with no fallback:**
- None for chrome work (code-only).

**Missing dependencies with fallback:**
- `TEST_DATABASE_URL` absent → cold-start test skipped; planner must still commit `COLD-START.md` template noting "no CI sample this run" or run manually where DB available.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 [VERIFIED: package.json:55] |
| Config file | vitest.config.ts [VERIFIED: vitest.config.ts:1-32] |
| Quick run command | `npm test -- lib/db.cold-start.test.ts -x` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-02 | v2 route pages are Server Components wrapping PageChrome | unit (source gate) | `npm test -- lib/rsc-chrome.gate.test.ts -x` | ❌ Wave 0 |
| PERF-02 | Module pages no longer import Sidebar | unit (grep gate) | same gate test | ❌ Wave 0 |
| PERF-02 | PageChrome renders without `'use client'` | unit | `npm test -- components/layout/PageChrome.test.ts -x` | ❌ Wave 0 |
| PERF-03 | p95 getDb cold start ≤ 5000ms | integration | `npm test -- lib/db.cold-start.test.ts -x` | ❌ Wave 0 |
| PERF-03 | COLD-START.md records p95 + target | manual artifact | file exists in phase dir | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- <changed-test> -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green; `COLD-START.md` committed with measured p95 (or skip note)

### Wave 0 Gaps

- [ ] `components/layout/PageChrome.tsx` + shells
- [ ] `lib/rsc-chrome.gate.test.ts` — asserts pilot/full `app/**/page.tsx` lack `'use client'` for chrome routes
- [ ] `lib/db.cold-start.test.ts` — p95 benchmark
- [ ] `.planning/phases/26-rsc-chrome-cold-start/COLD-START.md` — budget artifact
- [ ] Update module `*.component.test.tsx` — remove Sidebar mocks where module no longer renders it

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | Session still via client Sidebar fetch + existing API |
| V3 Session Management | no change | No new cookies or storage |
| V4 Access Control | no change | No route auth changes |
| V5 Input Validation | no | No new inputs |
| V6 Cryptography | no | No crypto changes |

### Known Threat Patterns for Next.js + PostgreSQL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accidental secret in RSC props | Information Disclosure | Do not pass secrets through `PageChrome`; no change to auth model |
| TEST_DATABASE_URL pointing at prod | Tampering | `_test` suffix guard [VERIFIED: test/db.ts:14-16] |

## Recommended Wave Split

| Wave | Scope | Requirements | Rationale |
|------|-------|--------------|-----------|
| **26-01 Chrome foundation** | `PageChrome`, `PageLoadingShell`, `PageErrorShell`; gate test; pilot routes (`app/dashboards/*`, `app/weekly/periods`, `app/audit`); strip shell from matching module pages; optional `loading.tsx` on pilots | PERF-02 | Proves RSC boundary pattern + component test updates before ~30-route rollout |
| **26-02 Chrome rollout** | Remaining Sidebar chrome routes (portfolio, projects, documents, reports, admin); remove duplicated shells; gate test expanded to full route list | PERF-02 | Mechanical bulk; depends on 26-01 pattern |
| **26-03 Cold start** | `lib/db.cold-start.test.ts`; `COLD-START.md` with p95 samples; document 2000ms target vs 5000ms CI fail threshold | PERF-03 | Independent of UI; can parallel after 26-01 but safer sequential to avoid merge conflicts in `lib/` |

**Parallelization note:** 26-03 can run in parallel with 26-02 if different owners; do not parallel 26-01 and 26-03 both touching `lib/` without coordination.

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` is empty in this repo — no additional project-wide directives beyond AGENTS.md model routing (planner/executor concern, not phase implementation).

## Sources

### Primary (HIGH confidence)
- `/vercel/next.js/v16.2.9` — Server/Client composition, `loading.tsx` conventions (Context7)
- `app/layout.tsx`, `components/layout/Sidebar.tsx`, `lib/db.ts`, `lib/migrate/assertMigrated.ts`, `test/db.ts`, `vitest.config.ts` — in-repo verification

### Secondary (MEDIUM confidence)
- Phase 24 UI review — operations pages excluded from standard chrome

### Tertiary (LOW confidence)
- None material — phase is constrained by locked CONTEXT decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; Next 16.2.4 pinned; patterns from official docs
- Architecture: HIGH — verified current duplication and RSC boundary rules
- Pitfalls: HIGH — client/server import boundary is well-documented failure mode

**Research date:** 2026-08-29
**Valid until:** 2026-09-28 (stable App Router patterns)
