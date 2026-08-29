# Phase 26: RSC Chrome & Cold Start - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 38 (6 new + ~30 modified + 2 test/artifact)
**Analogs found:** 34 / 38

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `components/layout/PageChrome.tsx` | component (server) | request-response | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` shell | exact (markup source) |
| `components/layout/PageLoadingShell.tsx` | component (server) | request-response | `modules/audit/ui/AuditLogPage.tsx` loading branch | exact |
| `components/layout/PageErrorShell.tsx` | component (server) | request-response | `modules/audit/ui/AuditLogPage.tsx` error branch | exact |
| `components/layout/PageChrome.test.ts` | test | — | `lib/db.getDb.boot.unit.test.ts` + `components/ui/badge.test.tsx` | role-match |
| `app/**/page.tsx` (chrome routes, ~30) | route | request-response | `app/api/dashboards/portfolio/route.ts` (thin compose) | partial |
| `app/**/loading.tsx` (pilot routes) | route | request-response | — | no analog |
| `app/projects/[id]/**/page.tsx` (scoped) | route | request-response | `modules/projects/ui/risks/ProjectRisksPage.tsx` (`projectId`) | role-match |
| `app/login`, `app/landing`, `app/operations/**` | route | request-response | `app/operations/page.tsx` (unchanged client re-export) | exact (exclude) |
| `modules/**/**Page.tsx` (strip shell) | component (client) | CRUD | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` | exact |
| `modules/**/*.component.test.tsx` (updates) | test | — | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx` | exact |
| `lib/rsc-chrome.gate.test.ts` | test | — | `lib/repositories/kysely-migration.gate.test.ts` | exact |
| `lib/db.cold-start.test.ts` | test | batch | `lib/db.test.ts` | exact |
| `.planning/phases/26-rsc-chrome-cold-start/COLD-START.md` | config (artifact) | transform | RESEARCH.md Pattern 4 example | partial |
| `app/layout.tsx` | route (unchanged) | request-response | `app/layout.tsx` (self) | exact |
| `components/layout/Sidebar.tsx` | component (client, unchanged) | request-response | `components/layout/Sidebar.tsx` (self) | exact |

## Pattern Assignments

### `components/layout/PageChrome.tsx` (component server, request-response)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` (shell markup) + `app/layout.tsx` (Server Component conventions)

**Server Component convention — no `'use client'`** (from `app/layout.tsx` lines 1-21):

```typescript
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
// ... no 'use client' directive anywhere
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${geist.className} bg-slate-50 min-h-screen`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
```

**Shell markup to centralize** (from `PortfolioDashboardPage.tsx` lines 57-60):

```tsx
<div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
  <Sidebar />
  <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
    {/* children only */}
  </main>
</div>
```

**Client child import pattern** (from `Sidebar.tsx` line 394 — props to forward):

```tsx
export default function Sidebar({ projectId }: { projectId?: string }) {
```

**Core PageChrome pattern** (compose server frame + client Sidebar):

```tsx
// components/layout/PageChrome.tsx — no 'use client'
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

**Import convention** (from `components/brand/Logo.tsx` lines 1-4 — server component in `components/`):

```tsx
import Image from 'next/image';
import { cn } from '@/lib/utils';
```

Use `@/components/layout/Sidebar` default import (same as all module pages today).

---

### `components/layout/PageLoadingShell.tsx` (component server, request-response)

**Analog:** `modules/audit/ui/AuditLogPage.tsx` loading inner markup

**Loading spinner markup** (lines 23-26):

```tsx
<div className="flex flex-col items-center gap-3">
  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  <p className="text-slate-400 text-sm">Loading audit log…</p>
</div>
```

**Also verified in** `PortfolioDashboardPage.tsx` lines 32-35 (`"Loading dashboard…"`).

**Core pattern:**

```tsx
// components/layout/PageLoadingShell.tsx — no 'use client'
export function PageLoadingShell({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}
```

**Per-route messages** (copy verbatim from module pages):

| Route area | Message source |
|------------|----------------|
| Dashboards | `"Loading dashboard…"` — `PortfolioDashboardPage.tsx:34` |
| Audit | `"Loading audit log…"` — `AuditLogPage.tsx:25` |
| Weekly | `"Loading weekly periods…"` — `WeeklyPeriodsPage.tsx:32` |

---

### `components/layout/PageErrorShell.tsx` (component server, request-response)

**Analog:** `modules/audit/ui/AuditLogPage.tsx` error branch

**Error panel markup** (lines 37-40):

```tsx
<div className="flex flex-col items-center gap-3 text-center px-4">
  <AlertTriangle className="h-8 w-8 text-muted-foreground" />
  <p className="text-sm text-slate-600">{ERROR_COPY[error]}</p>
</div>
```

**ERROR_COPY shape** (lines 9-13 — client pages keep this; server shell accepts `message` string):

```tsx
const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;
```

**Core pattern** (static server version — no Lucide import needed if using plain markup, or import Lucide in server component same as client pages do):

```tsx
import { AlertTriangle } from 'lucide-react';

export function PageErrorShell({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center px-4">
      <AlertTriangle className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}
```

**Usage constraint:** Only import in server files (`app/**/page.tsx`, `loading.tsx`, `error.tsx`). Client module pages keep inline error branches with same classes during hook-driven errors.

---

### `app/**/page.tsx` — server wrapper conversion (route, request-response)

**Analog:** `app/dashboards/portfolio/page.tsx` (current) + `app/api/dashboards/portfolio/route.ts` (thin compose)

**Current client re-export** (`app/dashboards/portfolio/page.tsx` lines 1-3):

```tsx
'use client';

export { default } from '@/modules/dashboards/ui/portfolio/PortfolioDashboardPage';
```

**Thin compose analog** (`app/api/dashboards/portfolio/route.ts` line 1):

```typescript
export { GET } from '@/modules/dashboards/backend/routes/dashboards/portfolio/route';
```

**Target server wrapper** (pilot pattern):

```tsx
// app/dashboards/portfolio/page.tsx — Server Component (remove 'use client')
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

**Preserve `mainClassName` verbatim** from each module page's current `<main className="…">`. Examples:

| Page | Current `mainClassName` | Source |
|------|-------------------------|--------|
| Portfolio dashboard | `flex-1 p-4 lg:p-6 lg:p-8 overflow-auto` | `PortfolioDashboardPage.tsx:60` |
| Audit | `flex-1 p-4 lg:p-6 lg:p-8 overflow-auto` | `AuditLogPage.tsx:51` |
| Loading/centered | `flex-1 flex items-center justify-center` | `AuditLogPage.tsx:22` |
| Project risks | `flex-1 p-4 lg:p-6` | `ProjectRisksPage.tsx:628` |

**Excluded routes — keep current pattern** (`app/operations/page.tsx` lines 1-3):

```tsx
'use client';

export { default } from '@/modules/operations/ui/OperationsListPage';
```

Also exclude: `app/login`, `app/landing`, `app/operations/[id]`.

**Module split gate will need updating** (`modules/dashboards/backend/dashboards-module-split.test.ts` lines 29-32):

```typescript
it('P1: app/dashboards/portfolio/page.tsx still points at PortfolioDashboardPage', () => {
  const source = readUtf8('app/dashboards/portfolio/page.tsx');
  expect(source).toContain('modules/dashboards/ui/portfolio/PortfolioDashboardPage');
});
```

Gate should assert `PageChrome` present and `'use client'` absent instead of only module path.

---

### `app/projects/[id]/**/page.tsx` — project-scoped wrapper (route, request-response)

**Analog:** `modules/projects/ui/risks/ProjectRisksPage.tsx` (`Sidebar projectId={id}`)

**ProjectId forwarding today** (lines 626-628):

```tsx
<div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
  <Sidebar projectId={id} />
  <main className="flex-1 p-4 lg:p-6">
```

**Server wrapper pattern** (Next 16 — params may be async; no in-repo precedent yet):

```tsx
import { PageChrome } from '@/components/layout/PageChrome';
import ProjectRisksPage from '@/modules/projects/ui/risks/ProjectRisksPage';

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6">
      <ProjectRisksPage />
    </PageChrome>
  );
}
```

Module pages keep `useParams()` internally for API calls; only the route wrapper forwards `id` to `PageChrome`/`Sidebar`.

---

### `app/**/loading.tsx` (route, request-response) — pilot only

**Analog:** None in repo (0 existing `loading.tsx` files).

**Follow RESEARCH Pattern 3** — compose `PageChrome` + `PageLoadingShell`:

```tsx
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

Pilot routes: `app/dashboards/portfolio`, `app/dashboards/pm`, `app/weekly/periods`, `app/audit`.

---

### Module pages — strip duplicated shell (component client, CRUD)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx`

**Before (loading branch — lines 27-38):**

```tsx
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

**After (client inner spinner only — preserve classes, no Sidebar):**

```tsx
if (loading) {
  return (
    <div className="flex flex-col items-center gap-3 flex-1 flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">Loading dashboard…</p>
    </div>
  );
}
```

**Success path strip** (remove outer shell, keep content — lines 57-60 become content-only):

```tsx
// Remove: outer div + Sidebar + main wrapper
// Keep: everything inside <main> (filters, KPIs, tables)
return (
  <>
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <div>
        <h1 className="text-base font-semibold">Spec dashboard</h1>
        ...
```

**Remove Sidebar import** (line 7):

```tsx
import Sidebar from '@/components/layout/Sidebar';  // DELETE after strip
```

**Mechanical grep target:** `<Sidebar` inside `modules/**/*.tsx` — each occurrence in chrome-route module pages should be removed.

**Same pattern applies to:** `AuditLogPage.tsx`, `WeeklyPeriodsPage.tsx`, `PortfolioHomePage.tsx`, all `modules/projects/ui/**Page.tsx`, `AdminPage.tsx`, documents/weekly/report module pages per RESEARCH rollout table.

---

### `components/layout/PageChrome.test.ts` (test)

**Analog:** `lib/db.getDb.boot.unit.test.ts` (source inspection) + `components/ui/badge.test.tsx` (render)

**Source gate — no `'use client'`** (`db.getDb.boot.unit.test.ts` lines 1-4, 23-25):

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('getDb boot path (DATA-01, D-05)', () => {
  const src = readFileSync(resolve(__dirname, 'db.ts'), 'utf8');
```

**Apply to PageChrome + shells:**

```typescript
it('PageChrome is a Server Component (no use client)', () => {
  const src = readFileSync(resolve(__dirname, 'layout/PageChrome.tsx'), 'utf8');
  expect(src).not.toMatch(/^['"]use client['"]/m);
  expect(src).toContain('PageChrome');
  expect(src).toContain('Sidebar');
});
```

**Optional render test** (`badge.test.tsx` lines 1-9):

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
```

Note: rendering `PageChrome` in jsdom requires mocking `@/components/layout/Sidebar` (client boundary). Prefer source gate for shells; render test optional.

---

### `lib/rsc-chrome.gate.test.ts` (test)

**Analog:** `lib/repositories/kysely-migration.gate.test.ts`

**File walk + source inspection** (lines 1-4, 16-38, 56-73):

```typescript
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');

function collectRepoFiles(): string[] {
  const files: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.repo.ts')) files.push(full);
    }
  }
  walk(join(root, 'modules'));
  return files;
}
```

**Gate assertions for Phase 26:**

```typescript
const CHROME_ROUTES = [
  'app/dashboards/portfolio/page.tsx',
  'app/dashboards/pm/page.tsx',
  // ... expand in wave 26-02
];

const EXCLUDED = ['app/login/page.tsx', 'app/landing/page.tsx', 'app/operations/page.tsx'];

it('PERF-02: chrome route page.tsx files are Server Components', () => {
  for (const rel of CHROME_ROUTES) {
    const source = readFileSync(join(root, rel), 'utf8');
    expect(source, rel).not.toMatch(/^['"]use client['"]/m);
    expect(source, rel).toContain('PageChrome');
  }
});

it('PERF-02: module pages no longer import Sidebar', () => {
  // walk modules/**/**Page.tsx on chrome routes; assert no Sidebar import
});
```

Use `relative(root, file).replace(/\\/g, '/')` for Windows-safe paths (line 60).

---

### `lib/db.cold-start.test.ts` (test, batch)

**Analog:** `lib/db.test.ts` + `test/db.ts` + `lib/db.ts` getDb boot path

**Test DB gate** (`test/db.ts` lines 3-6, 14-16):

```typescript
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasTestDb = Boolean(TEST_DATABASE_URL);

// Refuse non-_test database names
if (!dbName.endsWith('_test')) {
  throw new Error(`Refusing to run tests against database "${dbName}" — name must end in _test`);
}
```

**Integration harness** (`lib/db.test.ts` lines 1-4, 16-18):

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeTestPool, hasTestDb, testPool } from '../test/db';

describe.skipIf(!hasTestDb)('repository layer against real Postgres', () => {
  afterAll(async () => {
    await closeTestPool();
  });
```

**getDb boot path under measurement** (`lib/db.ts` lines 128-148):

```typescript
export async function getDb(): Promise<DbClient> {
  if (_client) return _client;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: resolveSsl(process.env.DATABASE_URL),
  });
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

**Cold-start loop** (from RESEARCH Pattern 4):

```typescript
describe.skipIf(!hasTestDb)('getDb cold start (PERF-03)', () => {
  afterAll(async () => { await closeTestPool(); });

  it('p95 connect+assert ≤ 5000ms', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      vi.resetModules();
      process.env.DATABASE_URL = TEST_DATABASE_URL!;
      const t0 = performance.now();
      const { getDb, getPool } = await import('@/lib/db');
      await getDb();
      samples.push(performance.now() - t0);
      const pool = await getPool();
      await pool.end();
    }
    expect(p95(samples)).toBeLessThan(5000);
  }, 120_000);
});
```

Run in `node` vitest project (`vitest.config.ts` lines 12-14): `include: ['{lib,app,eslint,modules}/**/*.test.ts']`.

---

### `modules/**/*.component.test.tsx` — remove Sidebar mock (test)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx`

**Sidebar mock to remove** (lines 5-6):

```typescript
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboards/portfolio' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));
```

After shell strip, delete the Sidebar mock line. Tests should assert page content only (KPI tiles, filters, etc.) — not sidebar presence.

**Keep navigation mock** if module still uses hooks indirectly; remove only Sidebar mock and any `getByTestId('sidebar')` assertions.

---

### `.planning/phases/26-rsc-chrome-cold-start/COLD-START.md` (artifact)

**Analog:** RESEARCH.md Pattern 4 documentation block

**Template structure:**

```markdown
# Cold Start Budget (PERF-03)

**Target:** p95 ≤ 2000ms (local connect + assertMigrated + seedAuthData)
**CI fail threshold:** p95 > 5000ms
**Measured:** [date]
**Environment:** TEST_DATABASE_URL, vitest node project

## Samples (ms)
| # | connect+assert |
|---|----------------|
| 1 | ... |

**p95:** XXXms
**Verdict:** PASS / SKIP (no TEST_DATABASE_URL)
```

---

## Shared Patterns

### Server/Client Boundary
**Source:** `app/layout.tsx` (server root) + `components/layout/Sidebar.tsx` (client leaf)
**Apply to:** All new layout components and route wrappers

```tsx
// Server parent MAY import client child:
import Sidebar from '@/components/layout/Sidebar';  // in PageChrome.tsx — OK

// Client child MUST NOT import server shell:
// ❌ import { PageLoadingShell } from '@/components/layout/PageLoadingShell';  // in 'use client' module
```

### Duplicated Shell Markup (extract source of truth)
**Source:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` lines 29, 58
**Apply to:** `PageChrome`, all module page strips

```tsx
className="flex flex-col lg:flex-row min-h-screen bg-slate-50"
```

### Typography (preserve-existing, D-06)
**Source:** `AuditLogPage.tsx` lines 53-54
**Apply to:** All module content after strip (unchanged)

```tsx
<h1 className="text-base font-semibold">Audit log</h1>
<p className="text-sm text-muted-foreground mt-1">Append-only company audit trail</p>
```

Only `font-semibold` (600) and default (400) — no new weights.

### Test DB Safety Gate
**Source:** `test/db.ts` lines 5-6, 14-16
**Apply to:** `lib/db.cold-start.test.ts`

```typescript
describe.skipIf(!hasTestDb)('getDb cold start (PERF-03)', () => { ... });
```

### Vitest Project Split
**Source:** `vitest.config.ts` lines 8-28
**Apply to:** Gate + cold-start tests → `node` project; component tests → `jsdom`

```typescript
include: ['{lib,app,eslint,modules}/**/*.test.ts'],  // node — gate + cold-start
include: ['{components,app,modules}/**/*.component.test.tsx'],  // jsdom — module tests
```

### Auth Unchanged (D-02)
**Source:** `components/layout/Sidebar.tsx` lines 406-408
**Apply to:** Do not move session fetch to server

```tsx
useEffect(() => {
  fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => { if (data) setMe(data); });
  fetch('/api/projects').then(r => r.ok ? r.json() : []).then((data: ProjectItem[]) => setProjects(data ?? []));
}, []);
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/**/loading.tsx` | route | request-response | Zero existing `loading.tsx` files in repo; follow Next.js 16 convention from RESEARCH Pattern 3 |
| Server `app/**/page.tsx` with `PageChrome` | route | request-response | All 35+ app pages are currently `'use client'` re-exports; Phase 26 introduces this pattern |
| `app/projects/[id]/**/page.tsx` async params | route | request-response | No server dynamic route pages exist yet; use Next 16 `params: Promise<{id}>` per RESEARCH |

## Metadata

**Analog search scope:** `app/`, `components/layout/`, `components/brand/`, `modules/**/ui/`, `lib/*.test.ts`, `lib/repositories/*.gate.test.ts`, `test/db.ts`
**Files scanned:** ~120
**Pattern extraction date:** 2026-08-29
