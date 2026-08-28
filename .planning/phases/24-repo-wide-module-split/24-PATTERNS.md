# Phase 24: Repo-wide Module Split - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 10 feature areas (~200+ move targets)
**Analogs found:** 6 pattern archetypes / 6

## File Classification

Move targets collapse into **six shell/handler archetypes**. Every `app/**/page.tsx` and `app/api/**/route.ts` file maps to exactly one row.

| Pattern | New/Modified Role | Data Flow | Closest Analog | Match Quality | Shell / move targets (representative) |
|---------|-------------------|-----------|----------------|---------------|---------------------------------------|
| **P1** | page shell | request-response | `app/dashboards/portfolio/page.tsx` | exact | All existing v2 pages; new shells: `app/page.tsx`, `app/portfolio/**/page.tsx`, `app/programs/page.tsx`, `app/resources/page.tsx`, `app/projects/**/page.tsx`, `app/admin/page.tsx`, `app/operations/**/page.tsx`, `app/portfolio/report/page.tsx` |
| **P2** | api shell (pure re-export) | request-response | `app/api/weekly-periods/route.ts` (becomes module body) | role-match | `app/api/weekly-periods/**`, `app/api/audit/route.ts`, `app/api/dashboards/**`, `app/api/document-catalog/**`, `app/api/document-templates/**`, most `app/api/portfolio/**`, `app/api/jira/**`, `app/api/import-mapping/**`, `app/api/bug-import-mapping/**`, `app/api/parse-file-headers/route.ts`, `app/api/resources/route.ts` |
| **P3** | api shell (wrapper stays) | request-response | `app/api/projects/[id]/route.ts` | exact | `app/api/projects/[id]/**` (except weekly-reports & document-checklist shells), `app/api/programs/[id]/**`, `app/api/export/**/[id]/**`, `app/api/import/resource-plan/[id]/route.ts`, `app/api/projects/[id]/weekly-reports/**`, `app/api/projects/[id]/document-checklist/**`, `app/api/projects/[id]/report/**` |
| **P4** | api shell (D-23 session+tenant) | request-response | `app/api/operations/systems/route.ts` | exact | `app/api/operations/**`, `app/api/admin/companies/route.ts` (allowlisted — wrapper logic moves with handler; shell may pure re-export) |
| **P5** | module ui page | CRUD / fetch | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` | exact | All UI bodies moved from `app/` and feature-owned `components/` per RESEARCH file maps |
| **P6** | module backend route | request-response | `app/api/weekly-periods/route.ts` | exact | Handler bodies + colocated `schema.ts`, `route.test.ts`, `route.access.test.ts` under `modules/<feature>/backend/routes/` |

### Backend support files (move-only, no `app/` shell)

| Pattern | Role | Data Flow | Analog | Match Quality |
|---------|------|-----------|--------|---------------|
| **S1** | module service | CRUD | `lib/services/audit.service.ts` | exact |
| **S2** | module repository | CRUD | `lib/repositories/audit.repo.ts` | exact |

---

## Pattern Assignments

### P1 — Thin page re-export shell (`page.tsx`, request-response)

**Analog:** `app/dashboards/portfolio/page.tsx`

**Established v2 shell** (lines 1-3):

```tsx
'use client';

export { default } from '@/modules/dashboards/ui/portfolio/PortfolioDashboardPage';
```

**Same pattern elsewhere** — copy verbatim, swap path:

| Shell (URL unchanged) | Re-export target |
|-----------------------|------------------|
| `app/audit/page.tsx` | `@/modules/audit/ui/AuditLogPage` |
| `app/weekly/periods/page.tsx` | `@/modules/weekly/ui/periods/WeeklyPeriodsPage` |
| `app/documents/catalog/page.tsx` | `@/modules/documents/ui/catalog/DocumentCatalogPage` |
| `app/projects/[id]/document-checklist/page.tsx` | `@/modules/documents/ui/checklist/ProjectChecklistPage` |

**New v1 shells after UI move** — identical structure:

```tsx
// app/page.tsx — URL stays /
'use client';
export { default } from '@/modules/portfolio/ui/home/PortfolioHomePage';

// app/projects/page.tsx
'use client';
export { default } from '@/modules/projects/ui/list/ProjectsListPage';

// app/portfolio/report/page.tsx (UI in reports module, URL under portfolio)
'use client';
export { default } from '@/modules/reports/ui/portfolio-report/PortfolioReportPage';

// app/admin/page.tsx
'use client';
export { default } from '@/modules/admin/ui/AdminPage';
```

**Rules:**
- Always `'use client'` on shell (matches all v2 shells).
- Default export only — no local logic in shell.
- Rename moved page to descriptive component name (`PortfolioHomePage`, not `page`).

---

### P5 — Module UI page body (component, CRUD/fetch)

**Analog:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx`

**Imports pattern** (lines 1-14):

```tsx
'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { PortfolioCharts } from './PortfolioCharts';
import { usePortfolioSpecDashboard } from './usePortfolioSpecDashboard';
```

**Page structure** (lines 22-38):

```tsx
export default function PortfolioDashboardPage() {
  const { data, loading, error, ... } = usePortfolioSpecDashboard();

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">…</main>
      </div>
    );
  }
  // error state, then main layout with Sidebar + content
}
```

**v1 source to transform:** `app/page.tsx` (lines 1-16) — same Sidebar + hook + `_components` pattern; move body wholesale, keep `components/layout/Sidebar` import (D-05).

**Colocated tests:** move `*.component.test.tsx` next to page; vitest already includes `modules/**` [VERIFIED: `vitest.config.ts:14-26`].

---

### P2 — Non–project-scoped API: full handler move + pure re-export shell

**Analog (handler source):** `app/api/weekly-periods/route.ts`

**Module route file** (move body verbatim, fix service imports):

```typescript
// modules/weekly/backend/routes/weekly-periods/route.ts
import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { createWeeklyPeriod, listWeeklyPeriods } from '@/modules/weekly/backend/services/weekly-reports.service';
import { createPeriodSchema } from './schema';

export const GET = withCpmo(async (_req, { actor }) =>
  NextResponse.json(await listWeeklyPeriods(actor)),
);

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const period = await createWeeklyPeriod(actor, body as Record<string, unknown>);
    return NextResponse.json(period, { status: 201 });
  },
  { schema: createPeriodSchema },
);
```

**App shell after move** (new pattern — no existing shell yet; mirror P1 named-export style):

```typescript
// app/api/weekly-periods/route.ts — URL unchanged
export { GET, POST } from '@/modules/weekly/backend/routes/weekly-periods/route';
```

**Same archetype — additional handler analogs:**

| Current handler | Module destination | Shell re-export |
|-----------------|-------------------|-----------------|
| `app/api/audit/route.ts` | `modules/audit/backend/routes/audit/route.ts` | `export { GET } from '@/modules/audit/backend/routes/audit/route'` |
| `app/api/dashboards/portfolio/route.ts` | `modules/dashboards/backend/routes/dashboards/portfolio/route.ts` | `export { GET } from '@/modules/dashboards/backend/routes/dashboards/portfolio/route'` |
| `app/api/document-catalog/route.ts` | `modules/documents/backend/routes/document-catalog/route.ts` | `export { GET, POST } from '@/modules/documents/backend/routes/document-catalog/route'` |

**document-catalog handler note** — uses `withAuth` + `withCpmo`; move both exports together:

```typescript
// app/api/document-catalog/route.ts (current, lines 21-31)
export const GET = withAuth(async (_req, { actor }) =>
  NextResponse.json(await listDocumentCatalog(actor)),
);

export const POST = withCpmo(
  async (_req, { actor, body }) => { … },
  { schema: createCatalogSchema },
);
```

**ENF-01 safety:** Pure re-export is allowed only when route is **not** project-scoped (`eslint/rules/require-auth-wrapper.mjs:31-37`). Never use P2 for `/projects/[id]/`, `/programs/[id]/`, `/export/**/[id]/`, `/import/resource-plan/[id]/`.

---

### P3 — Project/program-scoped API: wrapper stays in `app/api`, handler in module

**Analog:** `app/api/projects/[id]/route.ts`

**Current wrapper pattern** (lines 1-22):

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { deleteProject, getProject, updateProject } from '@/lib/services/projects.service';

const projectUpdateSchema = z.object({}).passthrough();

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await getProject(params.id, actor)),
);

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await updateProject(params.id, actor, body as Record<string, unknown>)),
  { schema: projectUpdateSchema },
);
```

**After split — shell keeps wrapper; module holds handler body:**

```typescript
// modules/projects/backend/routes/projects/[id]/handlers.ts
import { NextResponse } from 'next/server';
import type { ProjectAccessContext } from '@/lib/http/with-project-access';
import { getProject } from '@/modules/projects/backend/services/projects.service';

export async function getProjectHandler(_req: Request, { params, actor }: ProjectAccessContext) {
  return NextResponse.json(await getProject(params.id, actor));
}

// app/api/projects/[id]/route.ts — ENF-01 gate unchanged
import { withProjectAccess } from '@/lib/http/with-project-access';
import { getProjectHandler, patchProjectHandler, deleteProjectHandler } from '@/modules/projects/backend/routes/projects/[id]/handlers';

export const GET = withProjectAccess(getProjectHandler);
export const PATCH = withProjectAccess(patchProjectHandler, { schema: projectUpdateSchema });
export const DELETE = withProjectAccess(deleteProjectHandler);
```

**Program-scoped analog:** `app/api/programs/[id]/route.ts` (lines 1-18) — use `withProgramAccess` instead:

```typescript
import { withProgramAccess } from '@/lib/http/with-program-access';
export const GET = withProgramAccess(async (_req, { params, actor }) =>
  NextResponse.json(await getProgramDetail(params.id, actor)),
);
```

**Export route analog:** `app/api/export/excel/[id]/route.ts` (lines 1-17) — `withProjectAccess` + binary response; wrapper stays in shell.

**Weekly under projects URL (D-06 exception):** `app/api/projects/[id]/weekly-reports/route.ts`:

```typescript
import { withProjectAccess } from '@/lib/http/with-project-access';
import { listProjectWeeklyHistory } from '@/modules/weekly/backend/services/weekly-reports.service';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listProjectWeeklyHistory(params.id, actor)),
);
```

**Documents checklist:** `app/api/projects/[id]/document-checklist/route.ts` (lines 1-7) — same P3 shape.

**Critical:** Shell file MUST contain local `withProjectAccess` / `withProgramAccess` / `withAuth` call — not `export { GET } from '@/modules/...'` (ESLint bypass pitfall).

---

### P4 — D-23 session+tenant routes (ops / admin companies)

**Analog:** `app/api/operations/systems/route.ts`

**Auth + handler pattern** (lines 1-32):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import { createOperationsSystem, listOperationsSystems } from '@/lib/services/operations.service';
import { createOperationsSystemSchema } from './schema';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const systems = await listOperationsSystems(user);
  return NextResponse.json(systems);
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // parseRequestJson + schema + service call…
}
```

**Admin companies analog:** `app/api/admin/companies/route.ts` (lines 13-24):

```typescript
async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const companies = await listCompaniesPlatform();
  return NextResponse.json(companies);
}
```

**After move:**
- Move entire route file (including auth helpers) to `modules/operations/backend/routes/operations/systems/route.ts` or `modules/admin/backend/routes/admin/companies/route.ts`.
- **Do not** add `withCpmo` (D-07).
- Shell may pure re-export (routes are allowlisted + not project-scoped):

```typescript
// app/api/operations/systems/route.ts
export { GET, POST } from '@/modules/operations/backend/routes/operations/systems/route';
```

**Allowlist paths unchanged** — same `app/api/...` strings in `eslint/route-wrapper-allowlist.json`.

---

### P6 — Module backend route (non-scoped, with wrappers inside module)

**Analog:** `app/api/dashboards/portfolio/route.ts` (lines 1-7):

```typescript
import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { getPortfolioDashboard } from '@/lib/services/spec-dashboards.service';

export const GET = withCpmo(async (_req, { actor }) => {
  return NextResponse.json(await getPortfolioDashboard(actor));
});
```

**Colocated files move together** (D-09):

```
modules/dashboards/backend/routes/dashboards/portfolio/
├── route.ts          ← handler
├── route.test.ts     ← tests import ./route
└── export/schema.ts  ← if present
```

---

### S1 — Module service (move, fix imports)

**Analog:** `lib/services/audit.service.ts`

**Imports pattern** (lines 1-8):

```typescript
import {
  insertAuditLog,
  listAuditLogs as listAuditLogsRepo,
  type AuditListFilters,
  type AuditLogInput,
} from '@/lib/repositories/audit.repo';
import { parseIsoDate } from '@/lib/fiscal/iso-date';
import { assertCompanyWrite, type AccessActor } from './access';
```

**After move to `modules/audit/backend/services/audit.service.ts`:**
- Repo import → `@/modules/audit/backend/repositories/audit.repo`
- Cross-cutting stays: `@/lib/fiscal/*`, `@/lib/services/access` (or `./access` if colocated sibling in same feature — prefer `@/lib/services/access` for shared access)
- Cross-feature service imports update to new module paths (e.g. spec-dashboards importing weekly → `@/modules/weekly/backend/services/weekly-reports.service`)

**Test file:** move `*.unit.test.ts` alongside; update mock paths.

---

### S2 — Module repository (move, fix imports)

**Analog:** `lib/repositories/audit.repo.ts`

**Imports pattern** (lines 1-2):

```typescript
import { getDb } from '@/lib/db';
```

**After move:** only `@/lib/db` and other cross-cutting imports need updating; no `app/` shell.

---

## Shared Patterns

### `'use client'` page shells (P1)
**Source:** `app/dashboards/portfolio/page.tsx`, `app/audit/page.tsx`  
**Apply to:** Every `app/**/page.tsx` after UI move

```tsx
'use client';
export { default } from '@/modules/<feature>/ui/<path>/<ComponentName>';
```

### Named-export API shells (P2, P4 re-export case)
**Apply to:** Non–project-scoped routes after handler move

```typescript
export { GET, POST, PUT, PATCH, DELETE } from '@/modules/<feature>/backend/routes/<mirror-path>/route';
```

Export only HTTP methods the module file actually exports.

### ENF-01 wrapper gate (P3)
**Source:** `eslint/rules/require-auth-wrapper.mjs:31-37`, `84-100`  
**Apply to:** All project/program/export/import-scoped `app/api/**/route.ts`

```javascript
function isProjectScoped(filename) {
  const posix = filename.replace(/\\/g, '/');
  if (posix.includes('/projects/[id]/')) return true;
  if (posix.includes('/programs/[id]/')) return true;
  if (posix.includes('/export/') && posix.includes('/[id]/')) return true;
  if (posix.includes('/import/resource-plan/[id]/')) return true;
  return false;
}
```

Rule inspects **local** declarations only — pure re-export bypasses check (forbidden on scoped paths).

### Shared UI chrome (D-05)
**Source:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx:7-8`  
**Apply to:** All module UI pages

```tsx
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
```

Do not move `components/ui/*`, `components/layout/*`, `components/brand/*` into feature modules.

### Cross-cutting lib (D-01) — never move
**Stay at:** `lib/http/**`, `lib/auth/**`, `lib/db/**`, `lib/services/access.ts`, `lib/services/errors.ts`, `lib/repositories/_helpers.ts`

---

## Wave Shell Quick Reference

| Wave | Feature | Page shells to create/keep | API shell pattern |
|------|---------|---------------------------|-------------------|
| 1 | dashboards | KEEP existing P1 | P2 re-export |
| 2 | audit | KEEP existing P1 | P2 re-export |
| 3 | weekly | KEEP existing P1 | P2 + P3 (projects weekly-reports, export weekly-report) |
| 4 | documents | KEEP existing P1 | P2 + P3 (document-checklist) |
| 5 | portfolio | NEW P1 for 6 pages | P2 (portfolio/programs/resources APIs) + P3 (programs/[id]) |
| 6 | projects | NEW P1 for ~15 pages | P3 (all projects/[id] APIs) |
| 7 | reports | NEW P1 for report pages | P3 (projects/[id]/report, export/[id]) |
| 8 | jira | No page shells (dialog components only) | P2 + P3 (import/resource-plan/[id]) |
| 9 | admin | NEW P1 for admin page | P2 + P4 (companies) |
| 10 | operations | NEW P1 for 2 pages | P4 (all operations APIs) |

---

## No Analog Found

| Target | Role | Reason | Planner fallback |
|--------|------|--------|------------------|
| Pure `export { GET } from '@/modules/...'` API shell | api shell | No post-split shell exists yet | Extend P1 named-export pattern; handler analog is current fat `route.ts` |
| Handler extraction to `handlers.ts` | module backend | Not implemented; inline handlers today | RESEARCH Pattern 2 — extract from P3 analogs without changing behavior |
| `app/portfolio/report/route.ts` POST AI body | module backend route | Fat session-based handler (lines 64-192) | Move entire file to `modules/reports/backend/routes/portfolio/report/route.ts`; P2 shell re-export |

---

## Metadata

**Analog search scope:** `app/**/page.tsx`, `app/api/**/route.ts`, `modules/**/ui/**`, `lib/services/**`, `lib/repositories/**`, `eslint/**`  
**Files scanned:** ~120 route/page + 45 module UI files  
**Pattern extraction date:** 2026-08-28
