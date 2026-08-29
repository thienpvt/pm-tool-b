# Coding Conventions

**Analysis Date:** 2026-08-29

## Naming Patterns

**Files:**
- App Router shells: `page.tsx`, `layout.tsx` under `app/` — server components that wrap module UI with `PageChrome`
- API surface: `app/api/**/route.ts` — thin re-exports or wrapper wiring only
- Module routes: `modules/<domain>/backend/routes/**/route.ts`, `handlers.ts`, `schema.ts`
- Service layer: `modules/<domain>/backend/services/<domain>.service.ts` (40 service files across 10 domains)
- Repository layer: `modules/<domain>/backend/repositories/<entity>.repo.ts` (38 repo files)
- Cross-cutting services: `lib/services/access.ts`, `lib/services/errors.ts`, `lib/services/settings.service.ts`
- Shared repositories: `lib/repositories/auth.repo.ts`, `lib/repositories/settings.repo.ts`, `lib/repositories/_helpers.ts`, `lib/repositories/_kysely-helpers.ts`
- HTTP wrappers: `lib/http/with-auth.ts`, `lib/http/with-project-access.ts`, `lib/http/with-program-access.ts`, `lib/http/with-cpmo.ts`, `lib/http/with-role.ts`
- Error mappers (HTTP boundary): `lib/api-errors.ts` — lives outside services/repos by design
- Integration clients: `lib/integrations/<vendor>/client.ts`, `lib/integrations/<vendor>/schemas.ts`
- Module UI pages: PascalCase — `modules/projects/ui/milestones/MilestonesPage.tsx`
- Module UI components: `_components/` subfolder with PascalCase files — `modules/projects/ui/milestones/_components/MilestoneList.tsx`
- Shared layout: `components/layout/PageChrome.tsx`, `components/layout/Sidebar.tsx`
- shadcn/ui primitives: kebab-case — `components/ui/button.tsx`, `components/ui/dialog.tsx`
- Shared libs: kebab or short names — `lib/db.ts`, `lib/auth.ts`, `lib/status-weights.ts`, `lib/utils.ts`

**Functions:**
- camelCase for helpers and exports: `getSessionFromRequest`, `assertProjectAccess`, `pickAllowed`, `serviceErrorResponse`
- React components: PascalCase — `Button`, `MilestonesPage`, `PageChrome`
- Route handlers in `handlers.ts`: camelCase named exports — `getProjectHandler`, `patchProjectHandler`
- HTTP verb exports in `route.ts`: uppercase — `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Service functions mirror domain verbs: `listMilestones`, `createProject`, `replaceSnapshot`
- Custom hooks: `use` prefix — `useMilestonesPage`, `useMilestonesActions`

**Variables:**
- camelCase locals: `sessionId`, `companyId`, `projectId`
- DB / API payload fields use snake_case matching SQL columns: `company_id`, `pm_name`, `plan_end`, `is_admin`
- Module constants: SCREAMING_SNAKE or Pascal-ish maps — `SESSION_COOKIE_NAME`, `STATUS_WEIGHTS`, `PROJECT_COLUMNS`

**Types:**
- Prefer `type` aliases near use site: `SessionUser` in `lib/auth.ts`, `AccessActor` in `lib/services/access.ts`
- Page-local types in module UI: `modules/projects/ui/milestones/types.ts`
- Generics on DB helpers: `db.get<T>(...)`, `HandlerContext<TParams, TBody>` in `lib/http/with-auth.ts`
- Avoid a separate top-level `types/` tree — types live next to consumers
- Repository column allowlists exported as `*_COLUMNS` constants (e.g. `RISK_COLUMNS` in `modules/projects/backend/repositories/risks.repo.ts`)

## Code Style

**Formatting:**
- No Prettier / Biome config in repo
- Mixed quotes: single quotes dominate API/lib/tests/modules backend (`'use client'`, `'next/server'`); some shadcn/shared files use double quotes (`"clsx"` in `lib/utils.ts`)
- Semicolons common in API/lib/tests; some UI files omit trailing semicolons
- Indentation: 2 spaces
- Section banners in large files: `// ─── Types ───` or `// ─── Public routes ───` style dividers (see `lib/http/route-401-matrix.test.ts`)

**Linting:**
- ESLint 9 flat config: `eslint.config.mjs`
- Presets: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Custom plugin: `eslint/plugin.mjs` with rule `pm-tool/require-auth-wrapper` (error on project-scoped `app/api/**/route.ts` handlers not wrapped in `withAuth`, `withProjectAccess`, `withProgramAccess`, `withCpmo`, or `withRole`)
- Allowlist for legacy routes: `eslint/route-wrapper-allowlist.json`
- Script: `npm run lint` → `eslint --no-error-on-unmatched-pattern "app/api/**/route.ts"`
- TypeScript: `strict: true` in `tsconfig.json`; path alias `@/*` → repo root

## Import Organization

**Order (module UI page — client):**
1. `'use client'` directive at top
2. React hooks: `react`
3. Next navigation: `next/navigation`
4. Internal lib: `@/lib/*`
5. Co-located module files: `./types`, `./useMilestonesPage`, `./_components/*`

**Order (app route shell — server):**
1. `@/components/layout/PageChrome`
2. Default import of module page from `@/modules/<domain>/ui/...`

**Order (API route — thin wrapper):**
1. HTTP wrapper: `@/lib/http/with-project-access` or `@/lib/http/with-auth`
2. `zod` when schema needed
3. Handlers from `@/modules/<domain>/backend/routes/.../handlers`
4. Local schema from `./schema` or module path

**Order (service module):**
1. Repository imports from `@/modules/<domain>/backend/repositories/*.repo`
2. `@/lib/services/access` for `assertProjectAccess` / `AccessActor`
3. `@/lib/services/errors` for typed service errors
4. Cross-module services when needed (e.g. `@/modules/audit/backend/services/audit.service`)

**Path Aliases:**
- `@/*` maps to project root (`./*`) — use `@/lib/...`, `@/modules/...`, `@/components/...` from anywhere
- Relative imports inside same module area (e.g. `./handlers` within a routes folder)
- Do not use barrel `index.ts` files — import concrete paths

## Layered Architecture

**Domain modules (10):** `admin`, `audit`, `dashboards`, `documents`, `jira`, `operations`, `portfolio`, `projects`, `reports`, `weekly`

**Four layers with strict import boundaries:**

| Layer | Location | May import | Must NOT import |
|-------|----------|------------|-----------------|
| App shells | `app/**/page.tsx`, `app/api/**/route.ts` | modules (UI + backend routes), HTTP wrappers, `PageChrome` | Direct repository calls, inline SQL |
| HTTP wrappers | `lib/http/*.ts` | auth, api-errors, services/access | Business logic beyond session/params/body parsing |
| Services | `modules/*/backend/services/*.service.ts` | repositories, `@/lib/services/access`, `@/lib/services/errors`, integrations | `next/server` (SVC-03) |
| Repositories | `modules/*/backend/repositories/*.repo.ts` | `lib/db/kysely`, `lib/repositories/_helpers`, `lib/repositories/_kysely-helpers` | `next/server` (REPO-06) |

**App page pattern (server shell + client module page):**
```typescript
// app/projects/[id]/milestones/page.tsx
import { PageChrome } from '@/components/layout/PageChrome';
import MilestonesPage from '@/modules/projects/ui/milestones/MilestonesPage';

export default async function MilestonesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 overflow-auto">
      <MilestonesPage />
    </PageChrome>
  );
}
```

**API route pattern (wrapper + handlers):**
```typescript
// app/api/projects/[id]/route.ts
import { withProjectAccess } from '@/lib/http/with-project-access';
import { z } from 'zod';
import { getProjectHandler, patchProjectHandler, deleteProjectHandler } from '@/modules/projects/backend/routes/projects/[id]/handlers';

const projectUpdateSchema = z.object({}).passthrough();

export const GET = withProjectAccess(getProjectHandler);
export const PATCH = withProjectAccess(patchProjectHandler, { schema: projectUpdateSchema });
export const DELETE = withProjectAccess(deleteProjectHandler);
```

**Re-export pattern (stable URL, module implementation):**
```typescript
// app/api/projects/route.ts
export { GET, POST } from '@/modules/projects/backend/routes/projects/route';
```

**Service pattern:**
```typescript
// modules/projects/backend/services/milestones.service.ts
export async function createMilestone(projectId, actor, body) {
  await assertProjectWriteAccess(projectId, actor);
  const created = await createMilestoneRepo(projectId, body);
  await auditLog({ ... });
  return created;
}
```

**Repository pattern (Kysely):**
```typescript
// modules/projects/backend/repositories/milestones.repo.ts
import { getKysely } from '@/lib/db/kysely';

export async function listMilestones(projectId: number | string) {
  const db = await getKysely();
  return db.selectFrom('milestones').selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('start_date').orderBy('id').execute();
}
```

## Error Handling

**Typed service errors (`lib/services/errors.ts`):**
- `ForbiddenError` — access denied; maps to 403 (message never echoed to client)
- `NotFoundError` — missing resource; optional `resource` field; maps to 404
- `ValidationError` — business-rule rejection; optional `field` field; maps to 400
- `ConflictError` — duplicate/state conflict; maps to 409
- `MandatoryIncompleteError` — stage-change guard; maps to 409 `{ code, items }`
- `SubmitValidationError` — multi-field validation; maps to 400 `{ error, fields }`
- These classes are HTTP-code-free by design — no `status` property on the error object

**HTTP mapping (`lib/api-errors.ts`):**
- `serviceErrorResponse(e)` — maps service errors to JSON responses; unknown errors → generic 500, never `String(e)`
- `repoErrorResponse(e)` — maps `UnknownColumnError` → 400 with `{ error, columns }`; other repo errors → 500
- `integrationErrorResponse(e, opts?)` — maps `IntegrationError` per service (jira/resend/anthropic)
- `IntegrationError` is NOT handled by `serviceErrorResponse` — services re-throw it; routes call `integrationErrorResponse` in catch chain

**Repository errors (`lib/repositories/_helpers.ts`, `lib/repositories/_kysely-helpers.ts`):**
- `UnknownColumnError` — thrown when UPDATE fields contain keys outside the allowlist (mass-assignment guard, REPO-03)
- `pickAllowed(allowlist, fields)` — Kysely write-path filter; rejects unknown columns

**Integration errors (`lib/integrations/errors.ts`):**
- `IntegrationError` with `kind`: `'timeout' | 'auth' | 'upstream' | 'validation' | 'network'`
- `cause` (raw upstream/Zod detail) stays server-side — never crosses to client (INTG-06)

**Route wrapper catch tail (`lib/http/with-auth.ts`):**
- Unified error mapping in `withAuth` / `withProjectAccess` / `withProgramAccess`
- Order: `ForbiddenError` → 403, `NotFoundError` → 404, `ValidationError` → 400, `ConflictError` → 409, `UnknownColumnError` → `repoErrorResponse`, else → 500
- Malformed JSON on POST/PUT/PATCH → 400 `{ error: 'Invalid JSON' }`
- Shadow mode: `ACCESS_ENFORCEMENT=shadow` logs `[ACCESS-SHADOW]` denials via `logAccessShadowDenial` without blocking

**Client-side:**
- `toast` from `sonner` for user-visible success/failure after `fetch`
- JSON error shape: `{ error: string }` with optional `field`, `columns`, or `fields`

## Zod Validation

**Boundary validation only — do not duplicate service rules:**
- Schemas live in `modules/<domain>/backend/routes/**/schema.ts`, co-located with handlers
- Passed to wrappers via `{ schema: myInputSchema }` in `withAuth` / `withProjectAccess` options
- Use `.passthrough()` when the route accepts extra keys the service handles
- Keep fields optional when the service owns the required-field check — service throws `ValidationError`
- On `safeParse` failure: default 400 with first issue message, or custom via `badRequest` option
- Integration response validation uses Zod in `lib/integrations/*/schemas.ts`; failures become `IntegrationError({ kind: 'validation', ... })`

**Example schema:**
```typescript
// modules/projects/backend/routes/projects/[id]/bugs/schema.ts
export const bugsInputSchema = z.object({
  bugs: z.array(z.record(z.string(), z.unknown())).optional(),
  snapshot_date: z.string().optional(),
}).passthrough();
```

## Logging

**Framework:** `console` + structured helpers in `lib/log.ts`

**Patterns:**
- `logError(req, error, status)` — logs path without query strings; correlates via request ID
- `logRequest(id, method, path, hasSession)` — marks session presence without logging cookie value
- `logAccessShadowDenial(req, user, error, targetId)` — structured `[ACCESS-SHADOW]` JSON when `ACCESS_ENFORCEMENT=shadow`
- Unexpected errors in mappers: `console.error('Unexpected service error', e)` before returning generic 500
- Do not log secrets, query strings, or raw integration `cause` objects to clients

## Comments

**When to Comment:**
- Layer boundary rules and behavior-freeze rationale — see file headers in `lib/services/errors.ts`, `lib/api-errors.ts`, `lib/http/with-auth.ts`
- Domain rules and weighted status math — block comments in `lib/status-weights.ts`
- Scoping/authorization caveats on repositories — see `modules/projects/backend/repositories/milestones.repo.ts`
- Pitfall callouts at schema/service boundaries (Zod vs service validation split)
- Test intent blocks explaining what layer the suite proves (see `app/api/projects/[id]/risks/route.access.test.ts`)

**JSDoc/TSDoc:**
- Use on public helpers where formula or contract is non-obvious (`pickAllowed`, `withFetchTimeout`, `serviceErrorResponse`, HTTP wrappers)
- Not required on every export
- No enforced TSDoc coverage

## Function Design

**Size:**
- `app/api/**/route.ts` and `app/**/page.tsx` stay thin — delegate to modules
- Handlers in `handlers.ts` are single-purpose async functions receiving `HandlerContext`
- Services: one exported function per route operation; assert access first, then call repo
- Repositories: Kysely queries + allowlist enforcement; no session awareness
- Module UI pages may be large with co-located hooks (`useMilestonesPage.ts`); extract `_components/` when sections grow

**Parameters:**
- Services receive `(resourceId, actor: AccessActor, ...payload)` — actor carries `{ company_id, is_admin, roles, user_id, ... }`
- HTTP wrappers parse body via Zod and pass typed `body` in handler context
- DB (legacy paths): positional `?` placeholders via `db.run/get/all(sql, ...params)` in `lib/db.ts`
- DB (module repos): Kysely query builder via `getKysely()` from `lib/db/kysely`

**Return Values:**
- Handlers: `NextResponse.json(...)` with data from service calls
- Services: return repository rows or throw typed errors — never return HTTP responses
- Repositories: return Kysely result rows; throw `UnknownColumnError` on bad columns via `pickAllowed`

## Module Design

**Exports:**
- Named exports for lib utilities and handlers (`export function`, `export type`, `export const`)
- Default export for module UI pages (`MilestonesPage`) and some layout pieces (`Sidebar`)
- UI primitives: named `Button` + `buttonVariants` pattern (CVA) in `components/ui/button.tsx`
- Repository allowlists exported as `*_COLUMNS` for test assertions

**Barrel Files:**
- Not used as a project standard — import concrete paths `@/components/ui/button`, not `@/components`
- Do not add barrel `index.ts` unless clear multi-export package

## UI / Client Patterns

- `'use client'` on module UI pages and interactive components — not on `app/**/page.tsx` shells
- `PageChrome` wraps every authenticated page shell; passes optional `projectId` for sidebar context
- Fetch JSON from `/api/...` with session cookie (`pm_session`)
- Co-locate hooks: `useMilestonesPage.ts`, `useMilestonesActions.ts` next to page component
- Private components in `_components/` subfolder within module UI directory
- Forms: controlled React state + dialogs from `@/components/ui/dialog`
- Styling: Tailwind utility classes; merge with `cn()` from `lib/utils.ts`; variants via `class-variance-authority`
- Icons: `lucide-react`
- Toasts: `sonner` (`toast` / Toaster via `components/ui/sonner.tsx`)

## Data / SQL Conventions

- Module repositories use Kysely via `getKysely()` (`lib/db/kysely.ts`); legacy/shared code may use `getDb()` from `lib/db.ts`
- Generated types: `lib/db/database.ts` via `npm run codegen:db` (kysely-codegen)
- Column names snake_case in DB and JSON responses
- Multi-tenant filter: non-admin scoped by `user.company_id`; admin behavior varies by endpoint
- Mass-assignment prevention: Kysely writes use `pickAllowed` with explicit allowlists; fixed-column writes documented in repo headers when no allowlist needed
- Tenancy columns (`company_id`, `customer_id`, `id`) excluded from allowlists
- Tests use `testDb()` / `testKysely()` from `test/repo-db.ts` — never `getDb()` in repo tests (avoids seeding production admin credentials)

## What To Follow When Adding Code

1. **New domain feature:** add under `modules/<domain>/backend/` (services, repositories, routes) and `modules/<domain>/ui/` (pages, `_components/`, hooks)
2. **New API route:** add `handlers.ts` + optional `schema.ts` in module routes; wire in `app/api/**/route.ts` with `withAuth` / `withProjectAccess`; ensure ESLint wrapper rule passes
3. **New service:** `modules/<domain>/backend/services/<entity>.service.ts` — assert access, throw typed errors, delegate to repo; add `<entity>.service.unit.test.ts`
4. **New repository:** `modules/<domain>/backend/repositories/<entity>.repo.ts` — use Kysely + `pickAllowed` for updates; add `<entity>.repo.test.ts` (Postgres) or `.unit.test.ts` (mocked)
5. **New page:** `app/<route>/page.tsx` server shell with `PageChrome` + module UI page; `'use client'` only on the module UI component
6. **New Zod schema:** co-locate in `modules/<domain>/backend/routes/**/schema.ts`; keep service-owned validation in the service
7. **New error type:** add to `lib/services/errors.ts` (HTTP-free); map in `lib/api-errors.ts` `serviceErrorResponse`
8. **New protected route:** update `ROUTE_MATRIX` in `lib/http/route-401-matrix.test.ts`
9. Run `npm run lint` and `npm test`; keep `strict` TypeScript happy; use `@/` imports

---

*Convention analysis: 2026-08-29*
