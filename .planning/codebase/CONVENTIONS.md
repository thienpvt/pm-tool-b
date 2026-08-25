# Coding Conventions

**Analysis Date:** 2026-08-25

## Naming Patterns

**Files:**
- App Router pages: `page.tsx`, layouts: `layout.tsx` under `app/`
- API handlers: `app/api/**/route.ts` — export HTTP verb handlers only (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
- Zod schemas co-located with routes: `app/api/**/schema.ts` (e.g. `app/api/projects/[id]/bugs/schema.ts`)
- Service layer: `lib/services/<domain>.service.ts` (e.g. `lib/services/projects.service.ts`, `lib/services/holidays.service.ts`)
- Repository layer: `lib/repositories/<domain>.repo.ts` (e.g. `lib/repositories/projects.repo.ts`)
- HTTP wrappers: `lib/http/with-auth.ts`, `lib/http/with-project-access.ts`, `lib/http/with-program-access.ts`
- Error mappers (HTTP boundary): `lib/api-errors.ts` — lives outside services/repos by design
- Typed service errors: `lib/services/errors.ts` — HTTP-code-free
- Integration clients: `lib/integrations/<vendor>/client.ts`, `lib/integrations/<vendor>/schemas.ts`
- Feature UI: PascalCase under domain folders — `components/timeline/ImportMappingDialog.tsx`, `components/layout/Sidebar.tsx`
- shadcn/ui primitives: kebab-case — `components/ui/button.tsx`, `components/ui/badge.tsx`
- Shared libs: kebab or short names — `lib/db.ts`, `lib/auth.ts`, `lib/status-weights.ts`, `lib/utils.ts`

**Functions:**
- camelCase for helpers and exports: `getSessionFromRequest`, `assertProjectAccess`, `buildUpdate`, `serviceErrorResponse`
- React components: PascalCase — `Button`, `Sidebar`, `ImportMappingDialog`
- API route handlers: uppercase HTTP verbs exported from `route.ts`
- Service functions mirror domain verbs: `listProjects`, `createHoliday`, `replaceSnapshot`

**Variables:**
- camelCase locals: `sessionId`, `companyId`, `projectId`
- DB / API payload fields use snake_case matching SQL columns: `company_id`, `pm_name`, `plan_end`, `is_admin`
- Module constants: SCREAMING_SNAKE or Pascal-ish maps — `SESSION_COOKIE_NAME`, `STATUS_WEIGHTS`, `PROJECT_COLUMNS`

**Types:**
- Prefer `type` aliases near use site: `SessionUser` in `lib/auth.ts`, `AccessActor` in `lib/services/access.ts`
- Generics on DB helpers: `db.get<T>(...)`, `HandlerContext<TParams, TBody>` in `lib/http/with-auth.ts`
- Avoid a separate `types/` tree — types live next to consumers
- Repository column allowlists exported as `*_COLUMNS` constants (e.g. `PROJECT_COLUMNS` in `lib/repositories/projects.repo.ts`)

## Code Style

**Formatting:**
- No Prettier / Biome config in repo
- Mixed quotes: single quotes dominate API/lib/tests (`'use client'`, `'next/server'`); some shadcn files use double quotes (`"clsx"` in `lib/utils.ts`)
- Semicolons common in API/lib/tests; some UI files omit trailing semicolons
- Indentation: 2 spaces
- Section banners in large files: `// ─── Types ───` or `// ─── Public routes ───` style dividers (see `lib/http/route-401-matrix.test.ts`)

**Linting:**
- ESLint 9 flat config: `eslint.config.mjs`
- Presets: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`
- Script: `npm run lint` → `eslint`
- TypeScript: `strict: true` in `tsconfig.json`; path alias `@/*` → repo root

## Import Organization

**Order (typical client page):**
1. `'use client'` directive when needed
2. React / Next: `react`, `next/navigation`, `next/link`
3. Internal layout/feature: `@/components/layout/Sidebar`, feature dialogs
4. UI primitives: `@/components/ui/*`
5. Third-party UI/utils: `sonner`, `lucide-react`, `recharts`
6. Internal lib: `@/lib/*` (when used)

**Order (API route — thin handler):**
1. `next/server` (`NextResponse`)
2. HTTP wrapper: `@/lib/http/with-project-access` or `@/lib/http/with-auth`
3. Service functions: `@/lib/services/<domain>.service`
4. Local schema: `./schema`

**Order (service module):**
1. Repository imports from `@/lib/repositories/<domain>.repo`
2. `./access` for `assertProjectAccess` / `AccessActor`
3. `./errors` for typed service errors

**Path Aliases:**
- `@/*` maps to project root (`./*`) — use `@/lib/...`, `@/components/...` from anywhere
- Relative imports inside same package area (e.g. `./errors` within `lib/services/`)

## Layered Architecture

**Four layers with strict import boundaries:**

| Layer | Location | May import | Must NOT import |
|-------|----------|------------|-----------------|
| Routes | `app/api/**/route.ts` | services, HTTP wrappers, local `schema.ts`, `lib/api-errors.ts` (via wrappers) | Direct repository calls (except legacy routes being migrated) |
| HTTP wrappers | `lib/http/*.ts` | auth, api-errors, services/access | Business logic beyond session/params/body parsing |
| Services | `lib/services/*.service.ts` | repositories, `./access`, `./errors`, integrations | `next/server` (SVC-03) |
| Repositories | `lib/repositories/*.repo.ts` | `lib/db`, `./_helpers` | `next/server` (REPO-06) |

**Route pattern (canonical):**
```typescript
// app/api/projects/[id]/bugs/route.ts
export const GET = withProjectAccess(async (req, { params, actor }) => { ... });
export const POST = withProjectAccess(handler, { schema: bugsInputSchema });
```

**Service pattern:**
```typescript
// lib/services/holidays.service.ts
export async function createHoliday(projectId, actor, date, name) {
  await assertProjectAccess(projectId, actor);
  if (!date) throw new ValidationError('date required', 'date');
  if (await findHolidayByDate(projectId, date)) throw new ConflictError('date already exists');
  return createHolidayRepo(projectId, date, name);
}
```

## Error Handling

**Typed service errors (`lib/services/errors.ts`):**
- `ForbiddenError` — access denied; maps to 403 (message never echoed to client)
- `NotFoundError` — missing resource; optional `resource` field; maps to 404
- `ValidationError` — business-rule rejection; optional `field` field; maps to 400
- `ConflictError` — duplicate/state conflict; maps to 409
- These classes are HTTP-code-free by design — no `status` property on the error object

**HTTP mapping (`lib/api-errors.ts`):**
- `serviceErrorResponse(e)` — maps service errors to JSON responses; unknown errors → generic 500, never `String(e)`
- `repoErrorResponse(e)` — maps `UnknownColumnError` → 400 with `{ error, columns }`; other repo errors → 500
- `integrationErrorResponse(e, opts?)` — maps `IntegrationError` per service (jira/resend/anthropic) with behavior-freeze rules
- `IntegrationError` is NOT handled by `serviceErrorResponse` — services re-throw it; routes call `integrationErrorResponse` in catch chain

**Repository errors (`lib/repositories/_helpers.ts`):**
- `UnknownColumnError` — thrown when UPDATE fields contain keys outside the allowlist (mass-assignment guard, REPO-03)
- `buildUpdate(table, allowlist, fields)` — builds parameterized SET clause; rejects unknown columns

**Integration errors (`lib/integrations/errors.ts`):**
- `IntegrationError` with `kind`: `'timeout' | 'auth' | 'upstream' | 'validation' | 'network'`
- `cause` (raw upstream/Zod detail) stays server-side — never crosses to client (INTG-06)

**Route wrapper catch tail (`lib/http/with-auth.ts`):**
- Unified error mapping in `withAuth` / `withProjectAccess` / `withProgramAccess`
- Order: `ForbiddenError` → 403, `NotFoundError` → 404, `ValidationError` → 400, `ConflictError` → 409, `UnknownColumnError` → `repoErrorResponse`, else → 500
- Malformed JSON on POST/PUT/PATCH → 400 `{ error: 'Invalid JSON' }`

**Client-side:**
- `toast` from `sonner` for user-visible success/failure after `fetch`
- JSON error shape: `{ error: string }` with optional `field` or `columns`

## Zod Validation

**Boundary validation only — do not duplicate service rules (Pitfall 3):**
- Schemas live in `app/api/**/schema.ts`, co-located with the route
- Passed to wrappers via `{ schema: myInputSchema }` in `withAuth` / `withProjectAccess` options
- Use `.passthrough()` when the route accepts extra keys the service handles
- Keep fields optional when the service owns the required-field check — e.g. `holidayInputSchema` leaves `date` optional because `holidays.service.ts` throws `ValidationError('date required')`
- On `safeParse` failure: default 400 with first issue message, or custom via `badRequest` option
- Integration response validation uses Zod in `lib/integrations/*/schemas.ts`; failures become `IntegrationError({ kind: 'validation', ... })`

**Example schema:**
```typescript
// app/api/projects/[id]/bugs/schema.ts
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
- Pitfall callouts at schema/service boundaries (Pitfall 3: Zod vs service validation split)
- Test intent blocks explaining what layer the suite proves (see `app/api/projects/[id]/route.access.test.ts`)

**JSDoc/TSDoc:**
- Use on public helpers where formula or contract is non-obvious (`buildUpdate`, `withFetchTimeout`, `serviceErrorResponse`)
- Not required on every export
- No enforced TSDoc coverage

## Function Design

**Size:**
- Routes stay thin — delegate to services; no inline SQL or access checks in new routes
- Services: one exported function per route operation; assert access first, then call repo
- Repositories: SQL + allowlist enforcement; no session awareness
- Large client pages acceptable when feature-local; extract when reused across routes

**Parameters:**
- Services receive `(resourceId, actor: AccessActor, ...payload)` — actor carries `{ company_id, is_admin }`
- API wrappers parse body via Zod and pass typed `body` in handler context
- DB: positional `?` placeholders via `db.run/get/all(sql, ...params)` — rewritten to `$n` for Postgres in `lib/db.ts`

**Return Values:**
- API: `NextResponse.json(...)` with explicit status via wrappers or direct return
- Services: return repository rows or throw typed errors — never return HTTP responses
- Repositories: return rows or `{ lastInsertRowid, changes }`; throw `UnknownColumnError` on bad columns

## Module Design

**Exports:**
- Named exports for lib utilities (`export function`, `export type`, `export const`)
- Default export for page components and some layout pieces (`Sidebar`)
- UI primitives: named `Button` + `buttonVariants` pattern (CVA) in `components/ui/button.tsx`
- Repository allowlists exported as `*_COLUMNS` for test assertions

**Barrel Files:**
- Not used as a project standard — import concrete paths `@/components/ui/button`, not `@/components`
- Do not add barrel `index.ts` unless clear multi-export package

## UI / Client Patterns

- Mark interactive pages/components with `'use client'` at top
- Fetch JSON from `/api/...` with session cookie (`pm_session`)
- Forms: controlled React state + dialogs from `@/components/ui/dialog`
- Styling: Tailwind utility classes; merge with `cn()` from `lib/utils.ts`; variants via `class-variance-authority`
- Icons: `lucide-react`
- Toasts: `sonner` (`toast` / Toaster via `components/ui/sonner.tsx`)

## Data / SQL Conventions

- SQL written inline in repositories and `lib/db.ts` (no ORM query builder)
- Column names snake_case in DB and JSON responses
- Multi-tenant filter: admin sees all; non-admin scoped by `user.company_id`
- Mass-assignment prevention: every UPDATE goes through `buildUpdate` with an explicit allowlist
- Tenancy columns (`company_id`, `customer_id`, `id`) excluded from allowlists
- Prefer `getDb()` singleton from `@/lib/db` in production code; tests use `testDb()` from `test/repo-db.ts`

## What To Follow When Adding Code

1. **New API route:** `app/api/<resource>/route.ts` — wrap with `withAuth` / `withProjectAccess`; add `schema.ts` if body validation needed; call service, not repo
2. **New service:** `lib/services/<domain>.service.ts` — assert access, throw typed errors, delegate to repo; add `<domain>.service.unit.test.ts`
3. **New repository:** `lib/repositories/<domain>.repo.ts` — use `buildUpdate` with allowlist; add `<domain>.repo.test.ts` (Postgres) or `.unit.test.ts` (mocked)
4. **New page:** `app/<route>/page.tsx` — `'use client'` if hooks/state; add `page.component.test.tsx` for critical flows
5. **New Zod schema:** co-locate in `app/api/.../schema.ts`; keep service-owned validation in the service, not the schema
6. **New error type:** add to `lib/services/errors.ts` (HTTP-free); map in `lib/api-errors.ts` `serviceErrorResponse`
7. Run `npm run lint` and `npm test`; keep `strict` TypeScript happy; use `@/` imports

---

*Convention analysis: 2026-08-25*
