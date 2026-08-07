# Coding Conventions

**Analysis Date:** 2026-08-07

## Naming Patterns

**Files:**
- App Router pages: `page.tsx`, layouts: `layout.tsx` under `app/`
- API handlers: `app/api/**/route.ts` (HTTP method exports only)
- Feature UI: PascalCase under domain folders — `components/bugs/BugImportDialog.tsx`, `components/layout/Sidebar.tsx`
- shadcn/ui primitives: kebab-case — `components/ui/button.tsx`, `components/ui/dialog.tsx`
- Shared libs: kebab or short names — `lib/db.ts`, `lib/auth.ts`, `lib/status-weights.ts`, `lib/export/excel.ts`

**Functions:**
- camelCase for helpers and exports: `getSessionFromRequest`, `hashPassword`, `weightedProgress`, `statusWeight`
- React components: PascalCase — `Button`, `Sidebar`, `BugImportDialog`
- API route handlers: uppercase HTTP verbs — `GET`, `POST`, `PUT`, `DELETE`, `PATCH` in `route.ts`

**Variables:**
- camelCase locals: `sessionId`, `companyId`, `projects`
- DB / API payload fields often snake_case matching SQL columns: `company_id`, `pm_name`, `plan_end`, `is_admin`
- Module constants: SCREAMING_SNAKE or Pascal-ish maps — `SESSION_COOKIE_NAME`, `STATUS_WEIGHTS`, `PHASE_ORDER`, `DONE_STATUSES`

**Types:**
- Prefer `type` aliases (not always `interface`) near use site: `SessionUser` in `lib/auth.ts`, page-local `Project`, `Activity` in `app/projects/[id]/dashboard/page.tsx`
- Generics on DB helpers: `db.get<SessionUser>(...)`
- Avoid separate `types/` tree — types live next to consumers

## Code Style

**Formatting:**
- No Prettier / Biome config in repo
- Mixed quotes: single quotes dominate app/API (`'use client'`, `'next/server'`); some UI/shadcn files use double quotes (`"clsx"`)
- Semicolons common in API/lib; some UI files omit trailing style consistency
- Indentation: 2 spaces
- Section banners in large client pages: `// ─── Types ───` style dividers

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
5. Third-party UI/utils: `sonner`, `lucide-react`, charts
6. Internal lib: `@/lib/*` (when used)

**Order (API route):**
1. `next/server` (`NextRequest`, `NextResponse`)
2. `@/lib/db`, `@/lib/auth`, domain libs (`@/lib/export/*`, `@/lib/rag`)

**Path Aliases:**
- `@/*` maps to project root (`./*`) — use `@/lib/...`, `@/components/...` from anywhere
- Relative imports only inside same package area (e.g. `lib/auth.ts` → `./db`)

## Error Handling

**Patterns:**
- API: wrap handler body in `try/catch`; on failure `return NextResponse.json({ error: String(e) }, { status: 500 })` — see `app/api/projects/route.ts`
- Auth gate: `const user = await getSessionFromRequest(req); if (!user) return NextResponse.json(..., { status: 401 })` or helpers `unauthorized()` / `forbidden()` in `lib/auth.ts`
- Validation: early return 400 with `{ error: '...' }` message strings — `app/api/auth/login/route.ts`
- Password verify: swallow crypto errors → `false` in `verifyPassword` (`lib/auth.ts`)
- Client: `toast` from `sonner` for user-visible success/failure after `fetch`
- Prefer JSON error shape `{ error: string }` over thrown exceptions crossing the HTTP boundary

## Logging

**Framework:** `console` only (no structured logger package)

**Patterns:**
- Sparse server logging; many routes return errors to client without `console.error`
- Prefer not adding noisy logs; if debugging routes, keep temporary and remove
- Client errors surface via toast, not console-as-product

## Comments

**When to Comment:**
- Domain rules and weighted status math — block comments in `lib/status-weights.ts` (VI + EN)
- Seed data / business defaults inline near inserts (meetings, escalations in `app/api/projects/route.ts`)
- Section dividers in large page files for Types / Constants / Helpers / Component

**JSDoc/TSDoc:**
- Light JSDoc on pure helpers (`statusWeight`, `weightedProgress` in `lib/status-weights.ts`)
- Not required on every export; use when formula or domain meaning non-obvious
- No enforced TSDoc coverage

## Function Design

**Size:**
- Prefer small pure helpers for dates/status (`daysFromNow`, `isOverdue` on dashboard)
- Large client pages (`app/page.tsx`, project dashboards) hold substantial UI + local state — acceptable pattern today; extract only when reused
- `lib/db.ts` is a fat module (schema + pool + query facade) — treat as infrastructure, not copy pattern for features

**Parameters:**
- API: parse `req.json()` into `body`, then `body.field ?? default`
- DB: positional `?` placeholders via `db.run/get/all(sql, ...params)`
- Session: pass `NextRequest` into `getSessionFromRequest`

**Return Values:**
- API: always `NextResponse.json(...)` with explicit status (200 default, 201 create, 400/401/403/500)
- Auth helpers: `Promise<SessionUser | null>`
- UI: React elements; shared class merge via `cn()` from `lib/utils.ts`

## Module Design

**Exports:**
- Named exports for lib utilities (`export function`, `export type`, `export const`)
- Default export common for page-level layout pieces (`Sidebar`) and some components
- UI primitives: named `Button` + `buttonVariants` pattern (CVA) in `components/ui/button.tsx`

**Barrel Files:**
- Not used as a project standard — import concrete paths `@/components/ui/button`, not `@/components`
- Do not add barrel `index.ts` unless clear multi-export package

## UI / Client Patterns

- Mark interactive pages/components with `'use client'` at top
- Fetch JSON from `/api/...` with credentials/cookies (session cookie `pm_session`)
- Forms: controlled React state + dialogs from `@/components/ui/dialog`
- Styling: Tailwind utility classes; merge conflicts with `cn()`; variants via `class-variance-authority`
- Icons: `lucide-react`
- Toasts: `sonner` (`toast` / Toaster in layout via `components/ui/sonner.tsx`)

## Data / SQL Conventions

- SQL written inline in route handlers and `lib/db.ts` (no ORM query builder)
- Column names snake_case in DB and JSON responses
- Multi-tenant filter: admin sees all; else scope by `user.company_id` (and null company special case)
- Prefer `getDb()` singleton entry from `@/lib/db` before queries

## What To Follow When Adding Code

1. New API: `app/api/<resource>/route.ts` — session check, try/catch, `{ error }` JSON
2. New page: `app/<route>/page.tsx` — `'use client'` if hooks/state; compose Sidebar + ui/*
3. New shared pure logic: `lib/<name>.ts` named exports
4. New reusable control: `components/<domain>/PascalCase.tsx` or extend `components/ui/` only for primitives
5. Reuse `@/lib/status-weights` for progress math — avoid redefining `STATUS_WEIGHTS` in new files (dashboard still has local copy; prefer import for new work)
6. Run `npm run lint`; keep `strict` TypeScript happy; use `@/` imports

---

*Convention analysis: 2026-08-07*
