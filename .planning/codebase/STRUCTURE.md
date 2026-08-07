# Codebase Structure

**Analysis Date:** 2026-08-07

## Directory Layout

```
pm-tool-b/
├── app/                    # Next.js App Router (pages + API)
│   ├── api/                # Route handlers (backend)
│   │   ├── admin/          # Platform admin APIs
│   │   ├── auth/           # Login, logout, me, password, onboarding
│   │   ├── export/         # Binary document downloads
│   │   ├── jira/           # Jira proxy + presets + sync
│   │   ├── operations/     # Ops systems budget/incidents
│   │   ├── portfolio/      # Portfolio report, budget, members, roadmap
│   │   ├── programs/       # Programs (DB: customers)
│   │   ├── projects/       # Project CRUD + nested resources
│   │   ├── resources/      # Resource listing
│   │   ├── config/         # App config
│   │   ├── demo-requests/  # Public demo lead form
│   │   ├── health/         # Health check
│   │   ├── import*/        # Import mapping + resource plan import
│   │   └── parse-file-headers/
│   ├── admin/              # Admin UI page
│   ├── landing/            # Marketing / public landing
│   ├── login/              # Login page
│   ├── operations/         # Ops list + detail pages
│   ├── portfolio/          # Roadmap, report, budget, resources pages
│   ├── programs/           # Programs UI
│   ├── projects/           # Project list, new, [id] sub-apps
│   ├── resources/          # Resource management page
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Portfolio dashboard home
│   └── globals.css         # Global styles
├── components/             # Shared React components
│   ├── layout/             # Sidebar shell
│   ├── ui/                 # Design-system primitives
│   ├── bugs/ jira/ onboarding/ resources/ timeline/
│   └── PhaseTracker.tsx
├── lib/                    # Server-oriented shared modules
│   ├── db.ts               # PG client, schema, migrations, domain types
│   ├── auth.ts             # Sessions + passwords
│   ├── rag.ts              # RAG status calculation
│   ├── status-weights.ts   # Activity status → % weights
│   ├── utils.ts            # cn() helper
│   └── export/             # word.ts, excel.ts, ppt.ts
├── public/                 # Static assets
├── proxy.ts                # Auth gate (public vs cookie)
├── next.config.ts          # standalone + external packages
├── package.json
├── tsconfig.json           # @/* → .
├── Dockerfile / k8s.yaml / railway.json
├── .github/workflows/      # CI (e.g. docker-build)
└── .planning/              # GSD planning artifacts (not runtime)
```

## Directory Purposes

**`app/`:**
- Purpose: Routes = URLs. Pages for UI; `api/**/route.ts` for HTTP API
- Contains: `page.tsx`, `layout.tsx`, `route.ts` only (no separate controllers)
- Key files: `app/page.tsx` (portfolio), `app/layout.tsx`, `app/projects/[id]/*/page.tsx`

**`app/api/`:**
- Purpose: All server mutations and queries
- Contains: One folder per resource; dynamic segments `[id]`, `[milestoneId]`, etc.
- Key files: `app/api/projects/route.ts`, `app/api/auth/login/route.ts`, `app/api/portfolio/report/route.ts`

**`components/`:**
- Purpose: Reusable UI; keep pages thinner
- Contains: Feature dialogs + `ui/*` primitives
- Key files: `components/layout/Sidebar.tsx`, `components/ui/button.tsx`

**`lib/`:**
- Purpose: Non-UI server logic and pure domain helpers
- Contains: DB, auth, RAG, export
- Key files: `lib/db.ts` (~646 lines — single source of schema), `lib/auth.ts`

**`public/`:**
- Purpose: Static files served as-is

**Deploy / ops (root):**
- `Dockerfile`, `k8s.yaml`, `railway.json`, `.dockerignore` — container/K8s/Railway deploy
- `.env` present locally — never commit secrets; app needs `DATABASE_URL`

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root HTML shell
- `app/page.tsx`: Authenticated portfolio home
- `proxy.ts`: Request gate
- `lib/db.ts` → `getDb()`: DB process entry

**Configuration:**
- `package.json`: Scripts `dev`/`build`/`start`/`lint`
- `next.config.ts`: standalone output
- `tsconfig.json`: path alias `@/*`
- `components.json`: shadcn config
- `eslint.config.mjs`, `postcss.config.mjs`
- Env: `DATABASE_URL` required; Jira/Anthropic via env names from admin config

**Core Logic:**
- `lib/db.ts`: Schema, migrations, `DbClient`, exported row types
- `lib/auth.ts`: Session lifecycle
- `lib/rag.ts`: Health color
- `lib/export/*`: Document generation

**UI shells:**
- `components/layout/Sidebar.tsx`: Global + project nav (`NAV`, `PROJECT_NAV`)

**Testing:**
- Not detected (no `*.test.*` / vitest / jest config in tree)

## Naming Conventions

**Files:**
- Pages: `page.tsx` under URL segment folders
- APIs: `route.ts` under `app/api/<resource>/`
- Components: PascalCase `.tsx` (`Sidebar.tsx`, `BugImportDialog.tsx`)
- UI primitives: kebab-case under `components/ui/` (`button.tsx`)
- Lib modules: kebab or short names (`status-weights.ts`, `db.ts`)

**Directories:**
- URL-aligned kebab or plural nouns: `projects`, `portfolio`, `bug-import-mapping`
- Dynamic segments: `[id]`, `[companyId]`, `[itemId]`, `[type]`

**Symbols:**
- Handlers: `export async function GET|POST|PUT|PATCH|DELETE`
- DB helpers: `getDb`, `db.get` / `db.all` / `db.run`
- Types: PascalCase near usage or exported from `lib/db.ts` (`Project`, `Activity`)

## Where to Add New Code

**New portfolio-level feature (page + API):**
- Page: `app/<feature>/page.tsx` (client component OK)
- API: `app/api/<feature>/route.ts` (and nested routes as needed)
- Nav link: `components/layout/Sidebar.tsx` → `NAV` array
- Shared pure logic: `lib/<name>.ts` if reused by multiple routes

**New project sub-view:**
- Page: `app/projects/[id]/<view>/page.tsx`
- API: `app/api/projects/[id]/<resource>/route.ts`
- Nav: `PROJECT_NAV` in `components/layout/Sidebar.tsx` (`href` is suffix under project)

**New DB table/column:**
- Add to `initPostgresSchema` **and** `migratePostgresSchema` in `lib/db.ts`
- Export TypeScript type at bottom of `lib/db.ts` if shared
- Scope by `company_id` or `project_id` consistently with peers

**New UI control:**
- Prefer compose from `components/ui/*`
- Feature-specific dialog: `components/<area>/SomethingDialog.tsx`

**New export format:**
- Generator: `lib/export/<format>.ts`
- Route: `app/api/export/<format>/.../route.ts`
- Keep heavy packages listed in `serverExternalPackages` if needed

**New admin-only API:**
- Under `app/api/admin/`
- Check `user.is_admin` after session; use `forbidden()` from `lib/auth.ts`

**Utilities:**
- Class names: `cn` from `lib/utils.ts`
- Do not add client-only deps into `lib/db.ts` / export paths

## Special Directories

**`.planning/`:**
- Purpose: GSD maps, phases, plans
- Generated: Partially (human + agents)
- Committed: Yes (project workflow)

**`.next/` / `node_modules/`:**
- Purpose: Build + deps
- Generated: Yes
- Committed: No

**`.github/workflows/`:**
- Purpose: CI (e.g. `docker-build.yml`)
- Generated: No
- Committed: Yes

**`public/`:**
- Purpose: Static branding assets
- Generated: No
- Committed: Yes

## Page map (quick)

| URL area | Path |
|----------|------|
| Portfolio home | `app/page.tsx` |
| Portfolio roadmap/report/budget | `app/portfolio/*/page.tsx` |
| Programs | `app/programs/page.tsx` |
| Resources | `app/resources/page.tsx` |
| Operations | `app/operations/page.tsx`, `app/operations/[id]/page.tsx` |
| Project hub + subpages | `app/projects/[id]/page.tsx`, `dashboard`, `timeline`, `milestones`, `resources`, `communication`, `budget`, `risks`, `bugs`, `analysis`, `reports`, `documents`, `report` |
| New project | `app/projects/new/page.tsx` |
| Admin | `app/admin/page.tsx` |
| Login / landing | `app/login/page.tsx`, `app/landing/page.tsx` |

## Import path rule

Always use `@/` for app-root imports:

```ts
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';
```

---

*Structure analysis: 2026-08-07*
