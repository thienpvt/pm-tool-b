# Phase 24: Repo-wide Module Split - Research

**Researched:** 2026-08-28
**Domain:** Next.js App Router mechanical module split (file moves + thin re-exports)
**Confidence:** HIGH

## Summary

Phase 24 is a **behavior-preserving file reorganization**, not a feature build. Four v2 feature areas (`dashboards`, `weekly`, `documents`, `audit`) already have `modules/<feature>/ui/` trees with thin `app/**/page.tsx` re-exports; **no `modules/*/backend/` directories exist yet** [VERIFIED: glob `modules/**/backend/**` returned 0 files this session]. All route handlers, services, and repositories still live under `app/api/**` and `lib/{services,repositories}/` [VERIFIED: `app/api/weekly-periods/route.ts:1-16`, `app/api/dashboards/portfolio/route.ts:1-7`].

The work is to (1) create `modules/<feature>/backend/` for each ROADMAP area by **moving** (not duplicating) services, repos, route handler bodies, and colocated schemas/tests; (2) move remaining v1 UI out of `app/` into `modules/<feature>/ui/`; (3) leave **thin shells** in `app/` so URLs are unchanged (MOD-02). Cross-cutting `lib/http`, `lib/auth`, `lib/db`, `lib/migrate`, plus shared `lib/services/{access,errors}.ts` and `lib/repositories/{_helpers,auth,settings}.repo.ts`, stay at repo root per D-01.

**Critical ENF-01 constraint:** ESLint `require-auth-wrapper` applies only to `app/api/**/route.ts` [VERIFIED: `eslint.config.mjs:10-16`]. Pure `export { GET } from '@/modules/...'` re-exports bypass the rule (the rule inspects local declarations only) [VERIFIED: `eslint/rules/require-auth-wrapper.mjs:84-101`]. For project-scoped routes (`/projects/[id]/`, `/programs/[id]/`, `/export/**/[id]/`, `/import/resource-plan/[id]/`), **wrappers must remain visible in `app/api/**/route.ts`** — import handler functions from `modules/*/backend/` and wrap with `withAuth` / `withProjectAccess` / etc. Non–project-scoped routes (e.g. `weekly-periods`, `audit`, `dashboards`) may move full handler bodies to modules and re-export, or keep wrappers in `app/api` (either is ENF-01-safe).

**Primary recommendation:** Execute one feature area per wave (D-08). Within each wave: move backend services/repos first, then route handler bodies, then UI trees, then replace `app/` files with thin re-exports and fix `@/` imports. Preserve D-23 auth semantics on ops/admin companies routes (`getSessionFromRequest` + `requireAdmin`, not `withCpmo`) [VERIFIED: `app/api/admin/companies/route.ts:13-18`, `app/api/operations/systems/route.ts:10-16`].

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page UI (all features) | `modules/<feature>/ui/` | Thin `app/**/page.tsx` re-export | D-02: URLs stay in App Router; UI code lives in modules |
| API handlers | `modules/<feature>/backend/routes/` | Thin `app/api/**/route.ts` | D-02/D-07: public `/api/*` paths unchanged; ENF-01 wrappers stay in `app/api` for project-scoped routes |
| Business logic | `modules/<feature>/backend/services/` | — | D-03: move, don't rewrite |
| Data access | `modules/<feature>/backend/repositories/` | `lib/db` pool | D-03; Kysely migration is Phase 25 |
| Auth / HTTP wrappers | `lib/http`, `lib/auth` | — | D-01 cross-cutting |
| Shared chrome | `components/layout`, `components/ui`, `components/brand` | — | D-05 |
| Session / health / config APIs | `app/api/auth/*`, `app/api/{health,config}` | `lib/services/settings.service` | Not a feature module; stays cross-cutting |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Target layout is `modules/<feature>/{backend,ui}/` for every ROADMAP area. Cross-cutting `lib/http`, `lib/auth`, `lib/db`, `lib/migrate` stay at repo `lib/` — they are not a feature module.
- **D-02:** `app/**/page.tsx` and `app/api/**/route.ts` become thin re-exports (or Next.js route files that import handlers from `modules/<feature>/backend`). Public URLs must not change (MOD-02).
- **D-03:** Do not rewrite services/repos — move files and fix `@/` imports. Behavior-preserving mechanical split.
- **D-04:** Already-shipped v2 UI under `modules/dashboards/ui`, `modules/weekly/ui`, `modules/documents/ui`, `modules/audit/ui` stays. Add `backend/` siblings by moving the matching services/repos/route handlers; do not duplicate those UI trees.
- **D-05:** Shared UI chrome (`components/layout/Sidebar.tsx`, `components/ui/*`, `components/brand`) stays in `components/` unless a file is clearly feature-owned. Do not nest shadcn primitives under a random feature.
- **D-06:** Feature mapping (locked):
  - portfolio → home `/`, `/portfolio/*`, `/api/portfolio/*`
  - projects → `/projects/*`, `/api/projects/*` (except weekly-reports and document-checklist already in weekly/documents)
  - admin → `/admin/*`, `/api/admin/*`
  - operations → `/operations/*`, `/api/operations/*`
  - reports → v1 `/reports`, `/report`, `/api/export/*`, AI report routes
  - jira → `/jira*` import screens, `/api/jira/*`, `/api/import-mapping*`, bug/timeline mapping
  - dashboards / weekly / documents / audit → existing UI + matching backend
- **D-07:** D-23 ops/admin companies routes stay session+tenant / `requireAdmin` — moving files must not add `withCpmo`.
- **D-08:** No new npm. Isolation none: one feature-area plan per sequential wave when files overlap (`vitest.config`, `eslint` allowlist, `Sidebar`).
- **D-09:** A route/page test that imported a file by old path must be updated or keep passing via re-export. Prefer tests next to the new module files when they were colocated.
- **D-10:** Visual contract: no intentional UI redesign. Pages must look and behave the same; UI-SPEC records "preserve existing".

### Claude's Discretion

Grey areas auto-accepted: mechanical move, keep URLs, keep D-23, keep `lib/` cross-cutting, sequential execute, no visual redesign.

### Deferred Ideas (OUT OF SCOPE)

- Kysely — Phase 25
- RSC chrome — Phase 26
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOD-01 | Each feature area has backend and UI in separate directories under that module | File-move maps below; backend dirs created for all 10 areas; UI moves for v1 screens still in `app/` |
| MOD-02 | Existing page and `/api/*` URLs keep working via thin `app/` re-exports | Re-export patterns documented; `app/api` paths unchanged; ESLint allowlist paths unchanged |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` at repo root is empty this session. No additional project directives beyond CONTEXT D-01..D-10 and AGENTS.md model routing (not applicable to file moves).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.4 | App Router, `app/` URL shells | Already in use [VERIFIED: `package.json:25`] |
| react | 19.2.4 | UI | Already in use [VERIFIED: `package.json:29`] |
| vitest | (dev) | Unit/component tests | Already covers `modules/**` [VERIFIED: `vitest.config.ts:14-26`] |
| eslint + pm-tool plugin | (dev) | ENF-01 route wrapper gate | Scoped to `app/api/**/route.ts` [VERIFIED: `eslint.config.mjs:10`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript path alias `@/*` | — | Imports after move | Update moved files only; no tsconfig change needed [VERIFIED: `tsconfig.json:21-23`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Thin `app/api` wrappers + module handlers | Move wrappers into modules; widen ESLint glob | Violates CONTEXT integration guidance; ENF-01 regression risk — **reject** |
| Duplicate UI in `app/` and `modules/` | Single source in `modules/` only | Duplication forbidden by D-04 |

**Installation:** None — D-08 forbids new npm packages.

## Package Legitimacy Audit

No new packages. Phase is file moves only.

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  ▼
app/**/page.tsx          (thin re-export — URL unchanged)
  │
  ▼
modules/<feature>/ui/    (pages, hooks, components)
  │
  │ fetch /api/*
  ▼
app/api/**/route.ts      (thin wrapper OR re-export — URL unchanged)
  │
  ├── project-scoped: withProjectAccess(handler)  ← wrapper MUST stay here (ENF-01)
  │
  ▼
modules/<feature>/backend/routes/   (handler bodies, schemas, route tests)
  │
  ▼
modules/<feature>/backend/services/
  │
  ▼
modules/<feature>/backend/repositories/
  │
  ▼
lib/db  +  lib/http  +  lib/auth   (cross-cutting — not moved)
```

### Recommended Project Structure

```
modules/
├── portfolio/
│   ├── backend/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── routes/          # mirrors app/api/portfolio|programs|resources
│   └── ui/
│       ├── home/            # from app/page.tsx + app/_components
│       ├── budget/
│       ├── roadmap/
│       ├── resources/
│       └── programs/
├── projects/
│   ├── backend/
│   └── ui/
│       ├── list/
│       ├── hub/             # [id]/page.tsx
│       ├── milestones/
│       ├── timeline/
│       └── …
├── admin|operations|reports|jira/
│   ├── backend/
│   └── ui/
├── dashboards|weekly|documents|audit/
│   ├── backend/             # NEW — ui/ already exists
│   └── ui/                  # KEEP — do not duplicate (D-04)
app/
├── api/**/route.ts          # thin shells only after split
└── **/page.tsx              # thin shells only after split
lib/
├── http/ auth/ db/ migrate/ # unchanged (D-01)
├── services/access.ts errors.ts
└── repositories/_helpers.ts auth.repo.ts settings.repo.ts
```

### Pattern 1: Thin page re-export (established v2)

**What:** `app/` page is `'use client'` + re-export default from module.  
**When to use:** Every moved page (MOD-02).  
**Example:**

```tsx
// app/dashboards/portfolio/page.tsx (unchanged URL)
'use client';
export { default } from '@/modules/dashboards/ui/portfolio/PortfolioDashboardPage';
```

[VERIFIED: `app/dashboards/portfolio/page.tsx:1-3`]

### Pattern 2: Project-scoped API — wrapper stays in app/api

**What:** Handler body in module; sanctioned wrapper in `app/api/**/route.ts`.  
**When to use:** Any route under `projects/[id]/`, `programs/[id]/`, `export/**/[id]/`, `import/resource-plan/[id]/`.  
**Example:**

```typescript
// modules/projects/backend/routes/projects/[id]/handlers.ts
export async function getProjectHandler(_req: NextRequest, ctx: ProjectAccessContext) {
  return NextResponse.json(await getProject(ctx.actor, ctx.projectId));
}

// app/api/projects/[id]/route.ts — URL + ENF-01 gate unchanged
import { withProjectAccess } from '@/lib/http/with-project-access';
import { getProjectHandler } from '@/modules/projects/backend/routes/projects/[id]/handlers';
export const GET = withProjectAccess(getProjectHandler);
```

### Pattern 3: Non–project-scoped API — full move + re-export

**What:** Move `route.ts` body (including `withCpmo` wrapper) to module; `app/api` re-exports.  
**When to use:** `audit`, `weekly-periods`, `dashboards/*`, etc. (not matched by `isProjectScoped`) [VERIFIED: `eslint/rules/require-auth-wrapper.mjs:31-37`].  
**Example:**

```typescript
// modules/weekly/backend/routes/weekly-periods/route.ts — moved from app/api/weekly-periods/route.ts
import { withCpmo } from '@/lib/http/with-role';
export const GET = withCpmo(async (_req, { actor }) => …);
export const POST = withCpmo(…);

// app/api/weekly-periods/route.ts
export { GET, POST } from '@/modules/weekly/backend/routes/weekly-periods/route';
```

[VERIFIED: current handler at `app/api/weekly-periods/route.ts:1-16`]

### Pattern 4: D-23 session+tenant routes (ops / admin companies)

**What:** Preserve `getSessionFromRequest` + manual 401/403; do **not** wrap with `withCpmo`.  
**When to use:** All `app/api/operations/**` and allowlisted admin routes.  
**Example:** Move handler functions to `modules/operations/backend/routes/…`; keep identical auth flow in moved file.

[VERIFIED: `app/api/operations/systems/route.ts:10-16`, `eslint/route-wrapper-allowlist.json:2-11`]

### Anti-Patterns to Avoid

- **Pure re-export for project-scoped routes:** Bypasses ENF-01 — forbidden.
- **Adding `withCpmo` to ops/admin companies:** Violates D-07/D-23.
- **Duplicating v2 UI trees:** Violates D-04.
- **Moving `components/ui/*` into a feature module:** Violates D-05.
- **Rewriting service logic during move:** Violates D-03.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| New URL routing layer | Custom rewrites | Thin `app/` re-exports | MOD-02; Next.js App Router already maps URLs |
| New module loader | Dynamic import registry | TypeScript path alias `@/modules/...` | Already configured |
| Parallel test runner config | New vitest project | Existing `vitest.config.ts` globs | Already includes `modules/**` |
| Auth wrapper replacement | Custom middleware for ENF-01 | Keep wrappers in `app/api` for scoped routes | ESLint gate is path-scoped |

## Common Pitfalls

### Pitfall 1: ENF-01 bypass via re-export

**What goes wrong:** Project routes moved with `export { GET } from '@/modules/...'` — CI passes but handlers are no longer wrapper-checked.  
**Why it happens:** ESLint rule only inspects local declarations in `app/api/**/route.ts`.  
**How to avoid:** Keep `withProjectAccess` / `withAuth` calls in `app/api` for scoped paths.  
**Warning signs:** `app/api/projects/[id]/*/route.ts` shrinks to a single re-export line.

### Pitfall 2: D-23 auth regression on ops/admin

**What goes wrong:** Refactor "cleans up" ops routes to `withCpmo`.  
**How to avoid:** Copy auth blocks verbatim; add regression tests already colocated (`route.test.ts`, `route.access.test.ts`).  
**Warning signs:** `withCpmo` import added to `operations` or allowlisted admin routes.

### Pitfall 3: Broken imports after service move

**What goes wrong:** Hundreds of `@/lib/services/foo` imports stale.  
**How to avoid:** Move service + all `*.unit.test.ts` together; run `npm test` after each wave; use codemod or scoped search-replace per feature.  
**Warning signs:** Typecheck errors referencing old `lib/services` paths.

### Pitfall 4: Colocated route tests left at old path

**What goes wrong:** Tests pass against deleted implementations.  
**How to avoid:** Move `route.test.ts`, `schema.ts`, `route.access.test.ts` with handler to `modules/*/backend/routes/` (D-09).  
**Warning signs:** `app/api/**/route.test.ts` still imports from `./route` after handler move.

### Pitfall 5: Feature boundary leaks (weekly/docs under projects)

**What goes wrong:** Weekly report or document-checklist code lands in `modules/projects`.  
**How to avoid:** Respect D-06 exceptions — `projects/[id]/weekly-reports/**` → `weekly`; `projects/[id]/document-checklist/**` → `documents`.  
**Warning signs:** Weekly services imported from `modules/projects/backend`.

## Code Examples

### Page shell after UI move

```tsx
// app/page.tsx — URL stays /
'use client';
export { default } from '@/modules/portfolio/ui/home/PortfolioHomePage';
```

### ESLint allowlist — no path changes expected

Allowlist entries are `app/api/...` paths [VERIFIED: `eslint/route-wrapper-allowlist.json:1-11`]. Because MOD-02 keeps those files at the same paths, **allowlist JSON does not need updating** unless a route path is removed (none planned).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All UI in `app/` | v2 UI in `modules/*/ui` + thin re-export | Phases 21–23 | Pattern to extend to v1 screens |
| All backend in `lib/` + fat `app/api` | Split into `modules/*/backend` | Phase 24 (this) | Import path updates only |
| ESLint on `app/api` only | Unchanged | Phase 20 ENF-01 | Dictates wrapper placement |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/programs` and `/resources` pages belong to **portfolio** module (D-06 lists `/portfolio/*` and `/api/portfolio/*`; programs API is separate but program management UI is portfolio-adjacent) | File maps | Mis-filed UI; fix by moving between portfolio/projects |
| A2 | `app/api/programs/**` routes move to **portfolio/backend** (programs are portfolio-level entities) | File maps | Cross-import churn; aligns with `programs.service.ts` |
| A3 | `parse-file-headers` route handler moves to **jira/backend** (used by import dialogs) while URL stays `app/api/parse-file-headers` | jira map | Low — single route |
| A4 | `settings.service` / `config` API stay in **lib/** (cross-cutting admin config, not a feature module) | Cross-cutting | Low — not listed in D-06 feature areas |
| A5 | Report UI at `/portfolio/report` lives in **reports/ui** (reports feature) while URL shell stays under `app/portfolio/report` | reports map | Planner may colocate under portfolio/ui if user prefers URL-owner grouping — D-06 lists reports separately from portfolio |

## Open Questions (RESOLVED)

RESOLVED (CONTEXT D-11): `/portfolio/report` implementation lives in `modules/reports/ui/` with a thin re-export at `app/portfolio/report/page.tsx`.

## Environment Availability

Step 2.6: SKIPPED — no external dependencies; code/config-only moves.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (via `npm test`) [VERIFIED: `package.json:9`] |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOD-01 | Module dirs exist with backend/ui split | structural | `npm test` (existing suite green) | ✅ infra |
| MOD-02 | URLs resolve | integration/manual | `npm run build` + smoke navigation | ✅ build script |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test` + `npm run lint`
- **Phase gate:** `npm run build` before `/gsd-verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers moved paths once imports are updated [VERIFIED: `vitest.config.ts:14-26` includes `modules/**`].

## Security Domain

File moves only; no new attack surface. Preserve existing controls:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V4 Access Control | yes | Keep ENF-01 wrappers in `app/api` for project-scoped routes; D-07 auth unchanged |
| V5 Input Validation | yes | Move `schema.ts` with routes — no schema changes |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auth wrapper bypass during move | Elevation of privilege | Pattern 2 — wrappers stay in `app/api` for scoped routes |
| Accidental `withCpmo` on admin/ops | Elevation of privilege | Pattern 4 — copy D-23 blocks verbatim |

## Sequential Wave Order (D-08)

| Wave | Feature | Rationale |
|------|---------|-----------|
| 1 | dashboards | Smallest backend; UI done; establishes backend pattern |
| 2 | audit | Small backend; UI done |
| 3 | weekly | UI done; includes projects weekly-reports API routes |
| 4 | documents | UI done; includes document-checklist API routes |
| 5 | portfolio | Large v1 UI move; many APIs |
| 6 | projects | Largest surface; depends on weekly/docs routes already split |
| 7 | reports | Export + AI report routes/services |
| 8 | jira | Import dialogs + jira APIs; shared by projects timeline/bugs |
| 9 | admin | Admin page + APIs; jira-config/rag-config |
| 10 | operations | Ops UI + allowlisted routes |

---

## File-Move Maps

Convention:
- **→** means git move (preserve history) + import updates.
- Routes listed as `app/api/...` → `modules/<feature>/backend/routes/...`.
- After each move, source path becomes a **thin shell** (re-export or wrapper-only) unless noted "delete body only".
- Tests (`*.test.ts`, `*.component.test.tsx`) move with their implementation file (D-09).

### Cross-cutting — STAY (no move)

| Path | Reason |
|------|--------|
| `lib/http/**` | D-01 |
| `lib/auth/**` | D-01 |
| `lib/db/**` | D-01 |
| `lib/migrate/**` | D-01 |
| `lib/services/access.ts` (+ `access.unit.test.ts`) | Shared role model |
| `lib/services/errors.ts` (+ `errors.unit.test.ts`) | Shared errors |
| `lib/repositories/_helpers.ts` (+ `_helpers.test.ts`) | Shared repo helpers |
| `lib/repositories/auth.repo.ts` (+ tests) | Auth data access |
| `lib/repositories/settings.repo.ts` (+ tests) | Config store |
| `lib/services/settings.service.ts` (+ tests) | Used by `/api/config` |
| `app/api/auth/**` | Not a feature module |
| `app/api/health/route.ts` | Health check |
| `app/api/config/**` | Cross-cutting settings |
| `app/api/demo-requests/**` | Public + admin-adjacent; thin route stays (handler may call admin repo) |
| `app/login/**`, `app/landing/**`, `app/layout.tsx` | Auth chrome |
| `components/layout/**`, `components/ui/**`, `components/brand/**` | D-05 |
| `components/onboarding/OnboardingModal.tsx` | Used by portfolio home — import path update only; stays in `components/` (shared onboarding) |

---

### 1. dashboards (Wave 1)

#### UI — KEEP (D-04)

`modules/dashboards/ui/**` — no moves.

#### Backend services

| From | To |
|------|-----|
| `lib/services/spec-dashboards.service.ts` | `modules/dashboards/backend/services/spec-dashboards.service.ts` |
| `lib/services/spec-dashboards.service.unit.test.ts` | `modules/dashboards/backend/services/spec-dashboards.service.unit.test.ts` |

#### Backend repositories

| From | To |
|------|-----|
| `lib/repositories/dashboard-filter-state.repo.ts` | `modules/dashboards/backend/repositories/dashboard-filter-state.repo.ts` |
| `lib/repositories/dashboard-filter-state.repo.test.ts` | `modules/dashboards/backend/repositories/dashboard-filter-state.repo.test.ts` |

#### Backend routes (full move + app/api re-export)

| From | To |
|------|-----|
| `app/api/dashboards/portfolio/route.ts` | `modules/dashboards/backend/routes/dashboards/portfolio/route.ts` |
| `app/api/dashboards/portfolio/route.test.ts` | `modules/dashboards/backend/routes/dashboards/portfolio/route.test.ts` |
| `app/api/dashboards/portfolio/filters/route.ts` | `modules/dashboards/backend/routes/dashboards/portfolio/filters/route.ts` |
| `app/api/dashboards/portfolio/filters/route.test.ts` | `modules/dashboards/backend/routes/dashboards/portfolio/filters/route.test.ts` |
| `app/api/dashboards/portfolio/export/route.ts` | `modules/dashboards/backend/routes/dashboards/portfolio/export/route.ts` |
| `app/api/dashboards/portfolio/export/route.test.ts` | `modules/dashboards/backend/routes/dashboards/portfolio/export/route.test.ts` |
| `app/api/dashboards/portfolio/export/schema.ts` | `modules/dashboards/backend/routes/dashboards/portfolio/export/schema.ts` |
| `app/api/dashboards/pm/route.ts` | `modules/dashboards/backend/routes/dashboards/pm/route.ts` |
| `app/api/dashboards/pm/route.test.ts` | `modules/dashboards/backend/routes/dashboards/pm/route.test.ts` |
| `app/api/dashboards/pm/filters/route.ts` | `modules/dashboards/backend/routes/dashboards/pm/filters/route.ts` |
| `app/api/dashboards/pm/filters/route.test.ts` | `modules/dashboards/backend/routes/dashboards/pm/filters/route.test.ts` |
| `app/api/dashboards/document-compliance/route.ts` | `modules/documents/backend/routes/dashboards/document-compliance/route.ts` |
| `app/api/dashboards/document-compliance/route.test.ts` | `modules/documents/backend/routes/dashboards/document-compliance/route.test.ts` |

> Note: `document-compliance` dashboard API is owned by **documents** backend (Wave 4) but listed here for discoverability; execute in Wave 4.

#### Page shells — KEEP

| Path | Status |
|------|--------|
| `app/dashboards/portfolio/page.tsx` | Already thin re-export [VERIFIED: lines 1-3] |
| `app/dashboards/pm/page.tsx` | Already thin re-export |

---

### 2. audit (Wave 2)

#### UI — KEEP (D-04)

`modules/audit/ui/**` — no moves.

#### Backend

| From | To |
|------|-----|
| `lib/services/audit.service.ts` | `modules/audit/backend/services/audit.service.ts` |
| `lib/services/audit.service.unit.test.ts` | `modules/audit/backend/services/audit.service.unit.test.ts` |
| `lib/repositories/audit.repo.ts` | `modules/audit/backend/repositories/audit.repo.ts` |
| `lib/repositories/audit.repo.test.ts` | `modules/audit/backend/repositories/audit.repo.test.ts` |
| `lib/repositories/audit.repo.unit.test.ts` | `modules/audit/backend/repositories/audit.repo.unit.test.ts` |
| `app/api/audit/route.ts` | `modules/audit/backend/routes/audit/route.ts` |
| `app/api/audit/route.test.ts` | `modules/audit/backend/routes/audit/route.test.ts` |

#### Page shell — KEEP

`app/audit/page.tsx` — already thin re-export.

---

### 3. weekly (Wave 3)

#### UI — KEEP (D-04)

`modules/weekly/ui/**` — no moves.

#### Backend services

| From | To |
|------|-----|
| `lib/services/weekly-reports.service.ts` | `modules/weekly/backend/services/weekly-reports.service.ts` |
| `lib/services/weekly-reports.service.unit.test.ts` | `modules/weekly/backend/services/weekly-reports.service.unit.test.ts` |
| `lib/services/weekly-reports.submit.integration.test.ts` | `modules/weekly/backend/services/weekly-reports.submit.integration.test.ts` |
| `lib/services/weekly-tracking.service.ts` | `modules/weekly/backend/services/weekly-tracking.service.ts` |
| `lib/services/weekly-tracking.service.unit.test.ts` | `modules/weekly/backend/services/weekly-tracking.service.unit.test.ts` |

#### Backend repositories

| From | To |
|------|-----|
| `lib/repositories/weekly-periods.repo.ts` | `modules/weekly/backend/repositories/weekly-periods.repo.ts` |
| `lib/repositories/weekly-periods.repo.test.ts` | `modules/weekly/backend/repositories/weekly-periods.repo.test.ts` |
| `lib/repositories/weekly-reports.repo.ts` | `modules/weekly/backend/repositories/weekly-reports.repo.ts` |
| `lib/repositories/weekly-reports.repo.test.ts` | `modules/weekly/backend/repositories/weekly-reports.repo.test.ts` |
| `lib/repositories/weekly-export.repo.ts` | `modules/weekly/backend/repositories/weekly-export.repo.ts` |
| `lib/repositories/weekly-export.repo.test.ts` | `modules/weekly/backend/repositories/weekly-export.repo.test.ts` |

#### Backend routes — weekly-periods

| From | To |
|------|-----|
| `app/api/weekly-periods/route.ts` | `modules/weekly/backend/routes/weekly-periods/route.ts` |
| `app/api/weekly-periods/route.test.ts` | `modules/weekly/backend/routes/weekly-periods/route.test.ts` |
| `app/api/weekly-periods/schema.ts` | `modules/weekly/backend/routes/weekly-periods/schema.ts` |
| `app/api/weekly-periods/config/route.ts` | `modules/weekly/backend/routes/weekly-periods/config/route.ts` |
| `app/api/weekly-periods/config/route.test.ts` | `modules/weekly/backend/routes/weekly-periods/config/route.test.ts` |
| `app/api/weekly-periods/config/schema.ts` | `modules/weekly/backend/routes/weekly-periods/config/schema.ts` |
| `app/api/weekly-periods/[periodId]/tracking/route.ts` | `modules/weekly/backend/routes/weekly-periods/[periodId]/tracking/route.ts` |
| `app/api/weekly-periods/[periodId]/tracking/route.test.ts` | `modules/weekly/backend/routes/weekly-periods/tracking/route.test.ts` |
| `app/api/weekly-periods/[periodId]/export/route.ts` | `modules/weekly/backend/routes/weekly-periods/[periodId]/export/route.ts` |
| `app/api/weekly-periods/[periodId]/export/route.test.ts` | `modules/weekly/backend/routes/weekly-periods/[periodId]/export/route.test.ts` |
| `app/api/weekly-periods/[periodId]/export/schema.ts` | `modules/weekly/backend/routes/weekly-periods/[periodId]/export/schema.ts` |
| `app/api/weekly-periods/[periodId]/export/preview/route.ts` | `modules/weekly/backend/routes/weekly-periods/[periodId]/export/preview/route.ts` |
| `app/api/weekly-periods/[periodId]/export/preview/route.test.ts` | `modules/weekly/backend/routes/weekly-periods/[periodId]/export/preview/route.test.ts` |
| `app/api/weekly-periods/[periodId]/export/preview/schema.ts` | `modules/weekly/backend/routes/weekly-periods/[periodId]/export/preview/schema.ts` |

#### Backend routes — under projects URL (D-06 exception)

| From | To |
|------|-----|
| `app/api/projects/[id]/weekly-reports/route.ts` | `modules/weekly/backend/routes/projects/[id]/weekly-reports/route.ts` |
| `app/api/projects/[id]/weekly-reports/route.test.ts` | `modules/weekly/backend/routes/projects/[id]/weekly-reports/route.test.ts` |
| `app/api/projects/[id]/weekly-reports/route.access.test.ts` | `modules/weekly/backend/routes/projects/[id]/weekly-reports/route.access.test.ts` |
| `app/api/projects/[id]/weekly-reports/[reportId]/route.ts` | `modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/route.ts` |
| `app/api/projects/[id]/weekly-reports/[reportId]/route.test.ts` | `modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/route.test.ts` |
| `app/api/projects/[id]/weekly-reports/[reportId]/schema.ts` | `modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/schema.ts` |
| `app/api/projects/[id]/weekly-reports/[reportId]/submit/route.ts` | `modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/submit/route.ts` |
| `app/api/projects/[id]/weekly-reports/[reportId]/submit/route.test.ts` | `modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/submit/route.test.ts` |
| `app/api/projects/[id]/weekly-reports/[reportId]/correct/route.ts` | `modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/correct/route.ts` |
| `app/api/projects/[id]/weekly-reports/[reportId]/correct/route.test.ts` | `modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/correct/route.test.ts` |

> **ENF-01:** `app/api/projects/[id]/weekly-reports/**/route.ts` shells keep `withProjectAccess` / wrapper calls; import handlers from module.

#### Export route (weekly pack)

| From | To |
|------|-----|
| `app/api/export/weekly-report/[id]/route.ts` | `modules/weekly/backend/routes/export/weekly-report/[id]/route.ts` |
| `app/api/export/weekly-report/[id]/route.test.ts` | `modules/weekly/backend/routes/export/weekly-report/[id]/route.test.ts` |

> **ENF-01:** `app/api/export/weekly-report/[id]/route.ts` — project-scoped; wrapper stays in app/api.

#### Page shells — KEEP

| Path | Status |
|------|--------|
| `app/weekly/periods/page.tsx` | Thin re-export |
| `app/weekly/tracking/page.tsx` | Thin re-export |
| `app/weekly/reports/[projectId]/[reportId]/page.tsx` | Thin re-export |
| `app/projects/[id]/weekly-reports/[reportId]/page.tsx` | Thin re-export |

---

### 4. documents (Wave 4)

#### UI — KEEP (D-04)

`modules/documents/ui/**` — no moves.

#### Backend services

| From | To |
|------|-----|
| `lib/services/document-catalog.service.ts` | `modules/documents/backend/services/document-catalog.service.ts` |
| `lib/services/document-catalog.service.unit.test.ts` | `modules/documents/backend/services/document-catalog.service.unit.test.ts` |
| `lib/services/document-compliance.service.ts` | `modules/documents/backend/services/document-compliance.service.ts` |
| `lib/services/document-compliance.service.unit.test.ts` | `modules/documents/backend/services/document-compliance.service.unit.test.ts` |
| `lib/services/document-templates.service.ts` | `modules/documents/backend/services/document-templates.service.ts` |
| `lib/services/document-templates.service.unit.test.ts` | `modules/documents/backend/services/document-templates.service.unit.test.ts` |
| `lib/services/project-document-checklist.service.ts` | `modules/documents/backend/services/project-document-checklist.service.ts` |
| `lib/services/document-checklist-generate.ts` | `modules/documents/backend/services/document-checklist-generate.ts` |
| `lib/services/document-checklist-generate.unit.test.ts` | `modules/documents/backend/services/document-checklist-generate.unit.test.ts` |

#### Backend repositories

| From | To |
|------|-----|
| `lib/repositories/document-catalog.repo.ts` | `modules/documents/backend/repositories/document-catalog.repo.ts` |
| `lib/repositories/document-templates.repo.ts` | `modules/documents/backend/repositories/document-templates.repo.ts` |
| `lib/repositories/project-document-checklist.repo.ts` | `modules/documents/backend/repositories/project-document-checklist.repo.ts` |

#### Backend routes

| From | To |
|------|-----|
| `app/api/document-catalog/route.ts` | `modules/documents/backend/routes/document-catalog/route.ts` |
| `app/api/document-catalog/route.test.ts` | `modules/documents/backend/routes/document-catalog/route.test.ts` |
| `app/api/document-catalog/[id]/route.ts` | `modules/documents/backend/routes/document-catalog/[id]/route.ts` |
| `app/api/document-catalog/[id]/route.test.ts` | `modules/documents/backend/routes/document-catalog/[id]/route.test.ts` |
| `app/api/document-templates/route.ts` | `modules/documents/backend/routes/document-templates/route.ts` |
| `app/api/document-templates/route.test.ts` | `modules/documents/backend/routes/document-templates/route.test.ts` |
| `app/api/document-templates/[id]/route.ts` | `modules/documents/backend/routes/document-templates/[id]/route.ts` |
| `app/api/projects/[id]/document-checklist/route.ts` | `modules/documents/backend/routes/projects/[id]/document-checklist/route.ts` |
| `app/api/projects/[id]/document-checklist/[itemId]/route.ts` | `modules/documents/backend/routes/projects/[id]/document-checklist/[itemId]/route.ts` |
| `app/api/projects/[id]/document-checklist/[itemId]/route.test.ts` | `modules/documents/backend/routes/projects/[id]/document-checklist/[itemId]/route.test.ts` |
| `app/api/dashboards/document-compliance/route.ts` | `modules/documents/backend/routes/dashboards/document-compliance/route.ts` |
| `app/api/dashboards/document-compliance/route.test.ts` | `modules/documents/backend/routes/dashboards/document-compliance/route.test.ts` |

> **ENF-01:** `projects/[id]/document-checklist/**` — wrappers stay in `app/api`.

#### Page shells — KEEP

| Path | Status |
|------|--------|
| `app/documents/catalog/page.tsx` | Thin re-export |
| `app/documents/compliance/page.tsx` | Thin re-export |
| `app/projects/[id]/document-checklist/page.tsx` | Thin re-export |

---

### 5. portfolio (Wave 5)

#### UI moves

| From | To |
|------|-----|
| `app/page.tsx` | `modules/portfolio/ui/home/PortfolioHomePage.tsx` |
| `app/page.component.test.tsx` | `modules/portfolio/ui/home/PortfolioHomePage.component.test.tsx` |
| `app/usePortfolioDashboard.ts` | `modules/portfolio/ui/home/usePortfolioDashboard.ts` |
| `app/_components/**` | `modules/portfolio/ui/home/_components/**` |
| `app/portfolio/budget/page.tsx` | `modules/portfolio/ui/budget/PortfolioBudgetPage.tsx` |
| `app/portfolio/roadmap/page.tsx` | `modules/portfolio/ui/roadmap/RoadmapPage.tsx` |
| `app/portfolio/roadmap/types.ts` | `modules/portfolio/ui/roadmap/types.ts` |
| `app/portfolio/roadmap/useRoadmapPage.ts` | `modules/portfolio/ui/roadmap/useRoadmapPage.ts` |
| `app/portfolio/roadmap/page.component.test.tsx` | `modules/portfolio/ui/roadmap/RoadmapPage.component.test.tsx` |
| `app/portfolio/roadmap/_components/**` | `modules/portfolio/ui/roadmap/_components/**` |
| `app/portfolio/resources/page.tsx` | `modules/portfolio/ui/resources/PortfolioResourcesPage.tsx` |
| `app/programs/page.tsx` | `modules/portfolio/ui/programs/ProgramsPage.tsx` |
| `app/resources/page.tsx` | `modules/portfolio/ui/members/ResourcesMembersPage.tsx` |
| `components/resources/PortfolioImportDialog.tsx` | `modules/portfolio/ui/resources/PortfolioImportDialog.tsx` |
| `components/resources/ResourceImportDialog.tsx` | `modules/projects/ui/resources/ResourceImportDialog.tsx` |

> `ResourceImportDialog` moves to **projects/ui** (used by `projects/[id]/resources`); update import in that page.

#### UI shells after move

| Shell path | Re-export target |
|------------|------------------|
| `app/page.tsx` | `@/modules/portfolio/ui/home/PortfolioHomePage` |
| `app/portfolio/budget/page.tsx` | `@/modules/portfolio/ui/budget/PortfolioBudgetPage` |
| `app/portfolio/roadmap/page.tsx` | `@/modules/portfolio/ui/roadmap/RoadmapPage` |
| `app/portfolio/resources/page.tsx` | `@/modules/portfolio/ui/resources/PortfolioResourcesPage` |
| `app/programs/page.tsx` | `@/modules/portfolio/ui/programs/ProgramsPage` |
| `app/resources/page.tsx` | `@/modules/portfolio/ui/members/ResourcesMembersPage` |

#### Backend services

| From | To |
|------|-----|
| `lib/services/portfolio.service.ts` | `modules/portfolio/backend/services/portfolio.service.ts` |
| `lib/services/portfolio.service.unit.test.ts` | `modules/portfolio/backend/services/portfolio.service.unit.test.ts` |
| `lib/services/programs.service.ts` | `modules/portfolio/backend/services/programs.service.ts` |
| `lib/services/programs.service.unit.test.ts` | `modules/portfolio/backend/services/programs.service.unit.test.ts` |
| `lib/services/roadmap.service.ts` | `modules/portfolio/backend/services/roadmap.service.ts` |
| `lib/services/fiscal-budget.service.ts` | `modules/portfolio/backend/services/fiscal-budget.service.ts` |
| `lib/services/fiscal-budget.service.unit.test.ts` | `modules/portfolio/backend/services/fiscal-budget.service.unit.test.ts` |

#### Backend repositories

| From | To |
|------|-----|
| `lib/repositories/portfolio.repo.ts` | `modules/portfolio/backend/repositories/portfolio.repo.ts` |
| `lib/repositories/portfolio.repo.test.ts` | `modules/portfolio/backend/repositories/portfolio.repo.test.ts` |
| `lib/repositories/programs.repo.ts` | `modules/portfolio/backend/repositories/programs.repo.ts` |
| `lib/repositories/programs.repo.test.ts` | `modules/portfolio/backend/repositories/programs.repo.test.ts` |
| `lib/repositories/fiscal-budget.repo.ts` | `modules/portfolio/backend/repositories/fiscal-budget.repo.ts` |
| `lib/repositories/fiscal-budget.repo.test.ts` | `modules/portfolio/backend/repositories/fiscal-budget.repo.test.ts` |
| `lib/repositories/resources.repo.ts` | `modules/portfolio/backend/repositories/resources.repo.ts` |
| `lib/repositories/resources.repo.unit.test.ts` | `modules/portfolio/backend/repositories/resources.repo.unit.test.ts` |

#### Backend routes — all `app/api/portfolio/**`

Each directory under `app/api/portfolio/` (28 route dirs listed in inventory):

| From (pattern) | To (pattern) |
|----------------|--------------|
| `app/api/portfolio/<path>/route.ts` | `modules/portfolio/backend/routes/portfolio/<path>/route.ts` |
| `app/api/portfolio/<path>/route.test.ts` | `modules/portfolio/backend/routes/portfolio/<path>/route.test.ts` |
| `app/api/portfolio/<path>/schema.ts` | `modules/portfolio/backend/routes/portfolio/<path>/schema.ts` |

Concrete paths: `portfolio`, `budgets`, `budgets/[id]`, `budgets/[id]/allocations`, `budgets/[id]/allocations/[allocId]`, `budgets/[id]/categories`, `budgets/[id]/categories/[catId]`, `bug-assignees`, `members`, `members/[id]`, `milestones`, `program-allocations`, `program-allocations/[id]`, `quota`, `roadmap`, `roadmap/epics`.

#### Backend routes — programs API

| From (pattern) | To (pattern) |
|----------------|--------------|
| `app/api/programs/**` | `modules/portfolio/backend/routes/programs/**` |

Includes: `programs`, `programs/[id]`, `programs/[id]/project-allocations` (+ tests, schemas).

> **ENF-01:** `programs/[id]/**` — wrappers stay in `app/api`.

#### Backend routes — resources

| From | To |
|------|-----|
| `app/api/resources/route.ts` | `modules/portfolio/backend/routes/resources/route.ts` |

---

### 6. projects (Wave 6)

#### UI moves

| From | To |
|------|-----|
| `app/projects/page.tsx` | `modules/projects/ui/list/ProjectsListPage.tsx` |
| `app/projects/new/page.tsx` | `modules/projects/ui/new/NewProjectPage.tsx` |
| `app/projects/[id]/page.tsx` | `modules/projects/ui/hub/ProjectHubPage.tsx` |
| `app/projects/[id]/page.checklist-card.test.ts` | `modules/projects/ui/hub/ProjectHubPage.checklist-card.test.ts` |
| `app/projects/[id]/analysis/page.tsx` | `modules/projects/ui/analysis/ProjectAnalysisPage.tsx` |
| `app/projects/[id]/budget/page.tsx` | `modules/projects/ui/budget/ProjectBudgetPage.tsx` |
| `app/projects/[id]/bugs/page.tsx` | `modules/projects/ui/bugs/ProjectBugsPage.tsx` |
| `app/projects/[id]/communication/page.tsx` | `modules/projects/ui/communication/ProjectCommunicationPage.tsx` |
| `app/projects/[id]/dashboard/page.tsx` | `modules/projects/ui/dashboard/ProjectDashboardPage.tsx` |
| `app/projects/[id]/documents/page.tsx` | `modules/projects/ui/documents/ProjectDocumentsPage.tsx` |
| `app/projects/[id]/resources/page.tsx` | `modules/projects/ui/resources/ProjectResourcesPage.tsx` |
| `app/projects/[id]/risks/page.tsx` | `modules/projects/ui/risks/ProjectRisksPage.tsx` |
| `app/projects/[id]/milestones/**` | `modules/projects/ui/milestones/**` |
| `app/projects/[id]/timeline/**` | `modules/projects/ui/timeline/**` |
| `components/PhaseTracker.tsx` | `modules/projects/ui/hub/PhaseTracker.tsx` |

**Exclude (already thin re-exports):** `document-checklist/page.tsx`, `weekly-reports/[reportId]/page.tsx`.

**Exclude (reports module — Wave 7):** `[id]/report/**`, `[id]/reports/page.tsx`.

#### Backend services

| From | To |
|------|-----|
| `lib/services/projects.service.ts` | `modules/projects/backend/services/projects.service.ts` |
| `lib/services/projects.service.unit.test.ts` | `modules/projects/backend/services/projects.service.unit.test.ts` |
| `lib/services/project-governance.ts` | `modules/projects/backend/services/project-governance.ts` |
| `lib/services/project-governance.unit.test.ts` | `modules/projects/backend/services/project-governance.unit.test.ts` |
| `lib/services/milestones.service.ts` | `modules/projects/backend/services/milestones.service.ts` |
| `lib/services/milestones.service.unit.test.ts` | `modules/projects/backend/services/milestones.service.unit.test.ts` |
| `lib/services/risks.service.ts` | `modules/projects/backend/services/risks.service.ts` |
| `lib/services/risks.service.unit.test.ts` | `modules/projects/backend/services/risks.service.unit.test.ts` |
| `lib/services/issues.service.ts` | `modules/projects/backend/services/issues.service.ts` |
| `lib/services/issues.service.unit.test.ts` | `modules/projects/backend/services/issues.service.unit.test.ts` |
| `lib/services/bugs.service.ts` | `modules/projects/backend/services/bugs.service.ts` |
| `lib/services/bugs.service.unit.test.ts` | `modules/projects/backend/services/bugs.service.unit.test.ts` |
| `lib/services/activities.service.ts` | `modules/projects/backend/services/activities.service.ts` |
| `lib/services/project-dependencies.service.ts` | `modules/projects/backend/services/project-dependencies.service.ts` |
| `lib/services/project-dependencies.service.unit.test.ts` | `modules/projects/backend/services/project-dependencies.service.unit.test.ts` |
| `lib/services/budget.service.ts` | `modules/projects/backend/services/budget.service.ts` |
| `lib/services/budget.service.unit.test.ts` | `modules/projects/backend/services/budget.service.unit.test.ts` |
| `lib/services/budget-items.service.ts` | `modules/projects/backend/services/budget-items.service.ts` |
| `lib/services/budget-items.service.unit.test.ts` | `modules/projects/backend/services/budget-items.service.unit.test.ts` |
| `lib/services/benefits.service.ts` | `modules/projects/backend/services/benefits.service.ts` |
| `lib/services/escalations.service.ts` | `modules/projects/backend/services/escalations.service.ts` |
| `lib/services/escalations.service.unit.test.ts` | `modules/projects/backend/services/escalations.service.unit.test.ts` |
| `lib/services/meetings.service.ts` | `modules/projects/backend/services/meetings.service.ts` |
| `lib/services/meetings.service.unit.test.ts` | `modules/projects/backend/services/meetings.service.unit.test.ts` |
| `lib/services/stakeholders.service.ts` | `modules/projects/backend/services/stakeholders.service.ts` |
| `lib/services/stakeholders.service.unit.test.ts` | `modules/projects/backend/services/stakeholders.service.unit.test.ts` |
| `lib/services/team.service.ts` | `modules/projects/backend/services/team.service.ts` |
| `lib/services/team.service.unit.test.ts` | `modules/projects/backend/services/team.service.unit.test.ts` |
| `lib/services/pm-assignments.service.ts` | `modules/projects/backend/services/pm-assignments.service.ts` |
| `lib/services/pm-assignments.service.unit.test.ts` | `modules/projects/backend/services/pm-assignments.service.unit.test.ts` |
| `lib/services/holidays.service.ts` | `modules/projects/backend/services/holidays.service.ts` |
| `lib/services/holidays.service.unit.test.ts` | `modules/projects/backend/services/holidays.service.unit.test.ts` |
| `lib/services/roi.service.ts` | `modules/projects/backend/services/roi.service.ts` |
| `lib/services/roi.service.unit.test.ts` | `modules/projects/backend/services/roi.service.unit.test.ts` |
| `lib/services/documents.service.ts` | `modules/projects/backend/services/documents.service.ts` |
| `lib/services/documents.service.unit.test.ts` | `modules/projects/backend/services/documents.service.unit.test.ts` |
| `lib/services/raid-masters.service.ts` | `modules/projects/backend/services/raid-masters.service.ts` |
| `lib/services/raid-masters.service.unit.test.ts` | `modules/projects/backend/services/raid-masters.service.unit.test.ts` |

#### Backend repositories

| From | To |
|------|-----|
| `lib/repositories/projects.repo.ts` | `modules/projects/backend/repositories/projects.repo.ts` |
| `lib/repositories/projects.repo.test.ts` | `modules/projects/backend/repositories/projects.repo.test.ts` |
| `lib/repositories/projects.repo.unit.test.ts` | `modules/projects/backend/repositories/projects.repo.unit.test.ts` |
| `lib/repositories/milestones.repo.ts` | `modules/projects/backend/repositories/milestones.repo.ts` |
| `lib/repositories/milestones.repo.test.ts` | `modules/projects/backend/repositories/milestones.repo.test.ts` |
| `lib/repositories/risks.repo.ts` | `modules/projects/backend/repositories/risks.repo.ts` |
| `lib/repositories/risks.repo.test.ts` | `modules/projects/backend/repositories/risks.repo.test.ts` |
| `lib/repositories/issues.repo.ts` | `modules/projects/backend/repositories/issues.repo.ts` |
| `lib/repositories/issues.repo.test.ts` | `modules/projects/backend/repositories/issues.repo.test.ts` |
| `lib/repositories/bugs.repo.ts` | `modules/projects/backend/repositories/bugs.repo.ts` |
| `lib/repositories/bugs.repo.test.ts` | `modules/projects/backend/repositories/bugs.repo.test.ts` |
| `lib/repositories/activities.repo.ts` | `modules/projects/backend/repositories/activities.repo.ts` |
| `lib/repositories/activities.repo.test.ts` | `modules/projects/backend/repositories/activities.repo.test.ts` |
| `lib/repositories/project-dependencies.repo.ts` | `modules/projects/backend/repositories/project-dependencies.repo.ts` |
| `lib/repositories/project-dependencies.repo.test.ts` | `modules/projects/backend/repositories/project-dependencies.repo.test.ts` |
| `lib/repositories/budget.repo.ts` | `modules/projects/backend/repositories/budget.repo.ts` |
| `lib/repositories/budget.repo.test.ts` | `modules/projects/backend/repositories/budget.repo.test.ts` |
| `lib/repositories/budget-adjustments.repo.ts` | `modules/projects/backend/repositories/budget-adjustments.repo.ts` |
| `lib/repositories/financial-benefits.repo.ts` | `modules/projects/backend/repositories/financial-benefits.repo.ts` |
| `lib/repositories/financial-benefits.repo.test.ts` | `modules/projects/backend/repositories/financial-benefits.repo.test.ts` |
| `lib/repositories/nonfinancial-benefits.repo.ts` | `modules/projects/backend/repositories/nonfinancial-benefits.repo.ts` |
| `lib/repositories/nonfinancial-benefits.repo.test.ts` | `modules/projects/backend/repositories/nonfinancial-benefits.repo.test.ts` |
| `lib/repositories/escalations.repo.ts` | `modules/projects/backend/repositories/escalations.repo.ts` |
| `lib/repositories/escalations.repo.test.ts` | `modules/projects/backend/repositories/escalations.repo.test.ts` |
| `lib/repositories/meetings.repo.ts` | `modules/projects/backend/repositories/meetings.repo.ts` |
| `lib/repositories/meetings.repo.test.ts` | `modules/projects/backend/repositories/meetings.repo.test.ts` |
| `lib/repositories/stakeholders.repo.ts` | `modules/projects/backend/repositories/stakeholders.repo.ts` |
| `lib/repositories/team.repo.ts` | `modules/projects/backend/repositories/team.repo.ts` |
| `lib/repositories/team.repo.test.ts` | `modules/projects/backend/repositories/team.repo.test.ts` |
| `lib/repositories/pm-assignments.repo.ts` | `modules/projects/backend/repositories/pm-assignments.repo.ts` |
| `lib/repositories/holidays.repo.ts` | `modules/projects/backend/repositories/holidays.repo.ts` |
| `lib/repositories/holidays.repo.test.ts` | `modules/projects/backend/repositories/holidays.repo.test.ts` |
| `lib/repositories/documents.repo.ts` | `modules/projects/backend/repositories/documents.repo.ts` |
| `lib/repositories/documents.repo.test.ts` | `modules/projects/backend/repositories/documents.repo.test.ts` |
| `lib/repositories/raid-due-date-history.repo.ts` | `modules/projects/backend/repositories/raid-due-date-history.repo.ts` |

#### Backend routes — all `app/api/projects/**` except weekly-reports & document-checklist

| From (pattern) | To (pattern) |
|----------------|--------------|
| `app/api/projects/<path>/route.ts` | `modules/projects/backend/routes/projects/<path>/route.ts` |
| (+ colocated `*.test.ts`, `schema.ts`, `route.access.test.ts`) | same relative path under `modules/projects/backend/routes/` |

**Exclude** (moved in weekly/documents waves): `weekly-reports/**`, `document-checklist/**`.

> **ENF-01:** All `projects/[id]/**` shells keep wrappers in `app/api`.

---

### 7. reports (Wave 7)

#### UI moves

| From | To |
|------|-----|
| `app/portfolio/report/page.tsx` | `modules/reports/ui/portfolio-report/PortfolioReportPage.tsx` |
| `app/portfolio/report/types.ts` | `modules/reports/ui/portfolio-report/types.ts` |
| `app/portfolio/report/usePortfolioReport.ts` | `modules/reports/ui/portfolio-report/usePortfolioReport.ts` |
| `app/portfolio/report/useReportPageActions.ts` | `modules/reports/ui/portfolio-report/useReportPageActions.ts` |
| `app/portfolio/report/page.component.test.tsx` | `modules/reports/ui/portfolio-report/PortfolioReportPage.component.test.tsx` |
| `app/portfolio/report/_components/**` | `modules/reports/ui/portfolio-report/_components/**` |
| `app/projects/[id]/report/**` | `modules/reports/ui/project-report/**` |
| `app/projects/[id]/reports/page.tsx` | `modules/reports/ui/project-reports-list/ProjectReportsListPage.tsx` |

#### Backend services

| From | To |
|------|-----|
| `lib/services/portfolio-report.service.ts` | `modules/reports/backend/services/portfolio-report.service.ts` |
| `lib/services/portfolio-report.service.unit.test.ts` | `modules/reports/backend/services/portfolio-report.service.unit.test.ts` |
| `lib/services/project-report.service.ts` | `modules/reports/backend/services/project-report.service.ts` |
| `lib/services/project-report.service.unit.test.ts` | `modules/reports/backend/services/project-report.service.unit.test.ts` |

#### Backend routes

| From | To |
|------|-----|
| `app/api/portfolio/report/route.ts` | `modules/reports/backend/routes/portfolio/report/route.ts` |
| `app/api/portfolio/report/route.access.test.ts` | `modules/reports/backend/routes/portfolio/report/route.access.test.ts` |
| `app/api/portfolio/report/generate-email/route.ts` | `modules/reports/backend/routes/portfolio/report/generate-email/route.ts` |
| `app/api/portfolio/report/send-email/route.ts` | `modules/reports/backend/routes/portfolio/report/send-email/route.ts` |
| `app/api/portfolio/report/send-email/route.test.ts` | `modules/reports/backend/routes/portfolio/report/send-email/route.test.ts` |
| `app/api/projects/[id]/report/route.ts` | `modules/reports/backend/routes/projects/[id]/report/route.ts` |
| `app/api/projects/[id]/report/route.test.ts` | `modules/reports/backend/routes/projects/[id]/report/route.test.ts` |
| `app/api/projects/[id]/report/route.access.test.ts` | `modules/reports/backend/routes/projects/[id]/report/route.access.test.ts` |
| `app/api/projects/[id]/project-report/route.ts` | `modules/reports/backend/routes/projects/[id]/project-report/route.ts` |
| `app/api/projects/[id]/project-report/route.test.ts` | `modules/reports/backend/routes/projects/[id]/project-report/route.test.ts` |
| `app/api/projects/[id]/project-report/generate-email/route.ts` | `modules/reports/backend/routes/projects/[id]/project-report/generate-email/route.ts` |
| `app/api/projects/[id]/project-report/generate-email/route.test.ts` | `modules/reports/backend/routes/projects/[id]/project-report/generate-email/route.test.ts` |
| `app/api/export/excel/[id]/route.ts` | `modules/reports/backend/routes/export/excel/[id]/route.ts` |
| `app/api/export/excel/[id]/route.test.ts` | `modules/reports/backend/routes/export/excel/[id]/route.test.ts` |
| `app/api/export/ppt/[id]/route.ts` | `modules/reports/backend/routes/export/ppt/[id]/route.ts` |
| `app/api/export/ppt/[id]/route.test.ts` | `modules/reports/backend/routes/export/ppt/[id]/route.test.ts` |
| `app/api/export/word/[id]/[type]/route.ts` | `modules/reports/backend/routes/export/word/[id]/[type]/route.ts` |
| `app/api/export/word/[id]/[type]/route.test.ts` | `modules/reports/backend/routes/export/word/[id]/[type]/route.test.ts` |
| `app/api/export/portfolio/members/route.ts` | `modules/reports/backend/routes/export/portfolio/members/route.ts` |
| `app/api/export/portfolio/members/route.test.ts` | `modules/reports/backend/routes/export/portfolio/members/route.test.ts` |
| `app/api/export/resource-plan/[id]/route.ts` | `modules/reports/backend/routes/export/resource-plan/[id]/route.ts` |
| `app/api/export/resource-plan/[id]/route.test.ts` | `modules/reports/backend/routes/export/resource-plan/[id]/route.test.ts` |

> **ENF-01:** `export/**/[id]/**` and `projects/[id]/report/**` — wrappers stay in `app/api`.

---

### 8. jira (Wave 8)

#### UI moves (import surfaces — no dedicated `/jira` page route found)

| From | To |
|------|-----|
| `components/jira/JiraSyncDialog.tsx` | `modules/jira/ui/JiraSyncDialog.tsx` |
| `components/bugs/BugImportDialog.tsx` | `modules/jira/ui/BugImportDialog.tsx` |
| `components/timeline/**` | `modules/jira/ui/timeline-import/**` |

Update imports in: `projects/[id]/timeline/**`, `projects/[id]/bugs/page.tsx`, `projects/[id]/milestones/**`, `admin/page.tsx`, etc.

#### Backend services

| From | To |
|------|-----|
| `lib/services/import-mapping.service.ts` | `modules/jira/backend/services/import-mapping.service.ts` |
| `lib/services/jira-mapping.service.ts` | `modules/jira/backend/services/jira-mapping.service.ts` |

#### Backend repositories

| From | To |
|------|-----|
| `lib/repositories/import-mapping.repo.ts` | `modules/jira/backend/repositories/import-mapping.repo.ts` |
| `lib/repositories/import-mapping.repo.test.ts` | `modules/jira/backend/repositories/import-mapping.repo.test.ts` |
| `lib/repositories/import-mapping.repo.unit.test.ts` | `modules/jira/backend/repositories/import-mapping.repo.unit.test.ts` |

#### Backend routes

| From | To |
|------|-----|
| `app/api/jira/fields/route.ts` | `modules/jira/backend/routes/jira/fields/route.ts` |
| `app/api/jira/search/route.ts` | `modules/jira/backend/routes/jira/search/route.ts` |
| `app/api/jira/search/route.test.ts` | `modules/jira/backend/routes/jira/search/route.test.ts` |
| `app/api/jira/search/schema.ts` | `modules/jira/backend/routes/jira/search/schema.ts` |
| `app/api/jira/jql-presets/route.ts` | `modules/jira/backend/routes/jira/jql-presets/route.ts` |
| `app/api/jira/jql-presets/route.test.ts` | `modules/jira/backend/routes/jira/jql-presets/route.test.ts` |
| `app/api/jira/jql-presets/schema.ts` | `modules/jira/backend/routes/jira/jql-presets/schema.ts` |
| `app/api/jira/jql-presets/[id]/route.ts` | `modules/jira/backend/routes/jira/jql-presets/[id]/route.ts` |
| `app/api/jira/sync-mappings/route.ts` | `modules/jira/backend/routes/jira/sync-mappings/route.ts` |
| `app/api/jira/sync-mappings/route.test.ts` | `modules/jira/backend/routes/jira/sync-mappings/route.test.ts` |
| `app/api/jira/sync-mappings/schema.ts` | `modules/jira/backend/routes/jira/sync-mappings/schema.ts` |
| `app/api/jira/test/route.ts` | `modules/jira/backend/routes/jira/test/route.ts` |
| `app/api/jira/test/route.test.ts` | `modules/jira/backend/routes/jira/test/route.test.ts` |
| `app/api/import-mapping/route.ts` | `modules/jira/backend/routes/import-mapping/route.ts` |
| `app/api/import-mapping/route.test.ts` | `modules/jira/backend/routes/import-mapping/route.test.ts` |
| `app/api/import-mapping/schema.ts` | `modules/jira/backend/routes/import-mapping/schema.ts` |
| `app/api/import-mapping/[id]/route.ts` | `modules/jira/backend/routes/import-mapping/[id]/route.ts` |
| `app/api/bug-import-mapping/route.ts` | `modules/jira/backend/routes/bug-import-mapping/route.ts` |
| `app/api/bug-import-mapping/route.test.ts` | `modules/jira/backend/routes/bug-import-mapping/route.test.ts` |
| `app/api/bug-import-mapping/schema.ts` | `modules/jira/backend/routes/bug-import-mapping/schema.ts` |
| `app/api/bug-import-mapping/[id]/route.ts` | `modules/jira/backend/routes/bug-import-mapping/[id]/route.ts` |
| `app/api/import/resource-plan/[id]/route.ts` | `modules/jira/backend/routes/import/resource-plan/[id]/route.ts` |
| `app/api/import/resource-plan/[id]/route.test.ts` | `modules/jira/backend/routes/import/resource-plan/[id]/route.test.ts` |
| `app/api/parse-file-headers/route.ts` | `modules/jira/backend/routes/parse-file-headers/route.ts` |
| `app/api/parse-file-headers/route.test.ts` | `modules/jira/backend/routes/parse-file-headers/route.test.ts` |

> **ENF-01:** `import/resource-plan/[id]/**` — wrapper stays in `app/api`.

---

### 9. admin (Wave 9)

#### UI moves

| From | To |
|------|-----|
| `app/admin/page.tsx` | `modules/admin/ui/AdminPage.tsx` |

#### Backend services

| From | To |
|------|-----|
| `lib/services/admin-platform.service.ts` | `modules/admin/backend/services/admin-platform.service.ts` |
| `lib/services/admin-platform.service.unit.test.ts` | `modules/admin/backend/services/admin-platform.service.unit.test.ts` |
| `lib/services/users.service.ts` | `modules/admin/backend/services/users.service.ts` |
| `lib/services/users.service.unit.test.ts` | `modules/admin/backend/services/users.service.unit.test.ts` |
| `lib/services/jira-config.service.ts` | `modules/admin/backend/services/jira-config.service.ts` |
| `lib/services/rag-config.service.ts` | `modules/admin/backend/services/rag-config.service.ts` |

#### Backend repositories

| From | To |
|------|-----|
| `lib/repositories/admin.repo.ts` | `modules/admin/backend/repositories/admin.repo.ts` |
| `lib/repositories/admin.repo.test.ts` | `modules/admin/backend/repositories/admin.repo.test.ts` |
| `lib/repositories/users.repo.ts` | `modules/admin/backend/repositories/users.repo.ts` |
| `lib/repositories/users.repo.test.ts` | `modules/admin/backend/repositories/users.repo.test.ts` |
| `lib/repositories/jira-config.repo.ts` | `modules/admin/backend/repositories/jira-config.repo.ts` |
| `lib/repositories/jira-config.repo.unit.test.ts` | `modules/admin/backend/repositories/jira-config.repo.unit.test.ts` |
| `lib/repositories/rag-config.repo.ts` | `modules/admin/backend/repositories/rag-config.repo.ts` |
| `lib/repositories/rag-config.repo.unit.test.ts` | `modules/admin/backend/repositories/rag-config.repo.unit.test.ts` |
| `lib/repositories/demo-requests.repo.ts` | `modules/admin/backend/repositories/demo-requests.repo.ts` |
| `lib/repositories/demo-requests.repo.unit.test.ts` | `modules/admin/backend/repositories/demo-requests.repo.unit.test.ts` |

#### Backend routes — all `app/api/admin/**`

| From (pattern) | To (pattern) |
|----------------|--------------|
| `app/api/admin/<path>/**` | `modules/admin/backend/routes/admin/<path>/**` |

Includes: `companies`, `demo-requests`, `jira-config/[companyId]`, `rag-config/[companyId]`, `resource-audit`, `users` (+ tests, schemas, access tests).

> **D-07:** `companies` and all ops routes — preserve `getSessionFromRequest` + `requireAdmin` / session+tenant; **no `withCpmo`**. Allowlist paths unchanged [VERIFIED: `eslint/route-wrapper-allowlist.json:2-11`].

#### Page shell

| Shell | Re-export |
|-------|-----------|
| `app/admin/page.tsx` | `@/modules/admin/ui/AdminPage` |

---

### 10. operations (Wave 10)

#### UI moves

| From | To |
|------|-----|
| `app/operations/page.tsx` | `modules/operations/ui/OperationsListPage.tsx` |
| `app/operations/[id]/page.tsx` | `modules/operations/ui/OperationsDetailPage.tsx` |

#### Backend services

| From | To |
|------|-----|
| `lib/services/operations.service.ts` | `modules/operations/backend/services/operations.service.ts` |
| `lib/services/operations.service.unit.test.ts` | `modules/operations/backend/services/operations.service.unit.test.ts` |

#### Backend repositories

| From | To |
|------|-----|
| `lib/repositories/operations.repo.ts` | `modules/operations/backend/repositories/operations.repo.ts` |
| `lib/repositories/operations.repo.test.ts` | `modules/operations/backend/repositories/operations.repo.test.ts` |

#### Backend routes — all `app/api/operations/**`

| From (pattern) | To (pattern) |
|----------------|--------------|
| `app/api/operations/systems/**` | `modules/operations/backend/routes/operations/systems/**` |

Includes nested `budget-items`, `expenses`, `incidents` (+ tests, schemas).

> **D-07:** Session+tenant auth preserved; routes remain on ESLint allowlist.

#### Page shells

| Shell | Re-export |
|-------|-----------|
| `app/operations/page.tsx` | `@/modules/operations/ui/OperationsListPage` |
| `app/operations/[id]/page.tsx` | `@/modules/operations/ui/OperationsDetailPage` |

---

## Post-split verification checklist

- [ ] `npm test` green (all import paths updated)
- [ ] `npm run lint` green (`app/api/**/route.ts` wrappers intact)
- [ ] `npm run build` succeeds (Next.js resolves all page/route shells)
- [ ] Manual smoke: one page per feature area loads at the **same URL**
- [ ] Manual smoke: one API call per feature returns same shape
- [ ] `eslint/route-wrapper-allowlist.json` paths still valid (unchanged `app/api` paths)
- [ ] No new entries under `lib/services/` except `access.ts`, `errors.ts`, `settings.service.ts`
- [ ] Ten module dirs exist: `portfolio`, `projects`, `admin`, `operations`, `reports`, `jira`, `dashboards`, `weekly`, `documents`, `audit` — each with `backend/` and `ui/`

## Sources

### Primary (HIGH confidence)
- Phase 24 CONTEXT — D-01..D-10 locked decisions [VERIFIED: `.planning/phases/24-repo-wide-module-split/24-CONTEXT.md`]
- Codebase inventory — `app/`, `lib/`, `modules/` listing this session
- ESLint ENF-01 rule + config [VERIFIED: `eslint/rules/require-auth-wrapper.mjs`, `eslint.config.mjs`]

### Secondary (MEDIUM confidence)
- Established v2 re-export pattern [VERIFIED: `app/dashboards/portfolio/page.tsx:1-3`]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing Next/vitest/eslint
- Architecture: HIGH — patterns proven in Phases 21–23; ENF-01 constraint verified in rule source
- Pitfalls: HIGH — D-07 and ESLint bypass documented from primary sources

**Research date:** 2026-08-28  
**Valid until:** 2026-09-28 (stable mechanical refactor)
