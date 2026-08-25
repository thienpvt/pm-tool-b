# Codebase Structure

**Analysis Date:** 2026-08-25

## Directory Layout

```
pm-tool-b/
├── app/                        # Next.js App Router (pages + API)
│   ├── api/                    # Route handlers (backend HTTP surface)
│   │   ├── admin/              # Platform admin APIs (companies, users, jira/rag config)
│   │   ├── auth/               # Login, logout, me, password, onboarding
│   │   ├── export/             # Binary document downloads (word, excel, ppt, reports)
│   │   ├── jira/               # Jira proxy, presets, sync, test
│   │   ├── operations/         # Ops systems budget/incidents/expenses
│   │   ├── portfolio/          # Portfolio report, budget, members, roadmap, quota
│   │   ├── programs/           # Programs (DB: customers)
│   │   ├── projects/           # Project CRUD + nested resources
│   │   ├── resources/          # Resource listing
│   │   ├── config/             # App config
│   │   ├── demo-requests/      # Public demo lead form
│   │   ├── health/             # Health check
│   │   ├── import*/            # Import mapping + resource plan import
│   │   ├── bug-import-mapping/ # Bug CSV import mapping
│   │   └── parse-file-headers/ # CSV header parsing for imports
│   ├── _components/            # Portfolio dashboard shared components
│   ├── admin/                  # Admin UI page
│   ├── landing/                # Marketing / public landing
│   ├── login/                  # Login page
│   ├── operations/             # Ops list + detail pages
│   ├── portfolio/              # Roadmap, report, budget, resources pages
│   │   ├── roadmap/            # Decomposed: _components/, useRoadmapPage.ts
│   │   └── report/             # Decomposed: _components/, usePortfolioReport.ts
│   ├── programs/               # Programs UI
│   ├── projects/               # Project list, new, [id] sub-apps
│   │   └── [id]/               # Per-project views (timeline, milestones, report, …)
│   │       ├── _components/    # (on decomposed pages)
│   │       ├── timeline/       # _components/, useTimelinePage.ts, useTimelineActions.ts
│   │       ├── milestones/     # _components/, useMilestonesPage.ts, useMilestonesActions.ts
│   │       └── report/         # _components/, useProjectReport.ts, useProjectReportPageActions.ts
│   ├── resources/              # Resource management page
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Portfolio dashboard home
│   └── globals.css             # Global styles
├── components/                 # Shared React components (cross-route)
│   ├── layout/                 # Sidebar shell
│   ├── ui/                     # Design-system primitives (shadcn/Base UI)
│   ├── brand/                  # Logo
│   ├── bugs/                   # BugImportDialog
│   ├── jira/                   # JiraSyncDialog
│   ├── onboarding/             # OnboardingModal
│   ├── resources/              # Resource/Portfolio import dialogs
│   └── timeline/               # ImportMappingDialog + _components/
├── lib/                        # Server-oriented shared modules
│   ├── http/                   # Route wrappers: withAuth, withProjectAccess, withProgramAccess
│   ├── services/               # Business logic (*.service.ts)
│   ├── repositories/           # SQL persistence (*.repo.ts, _helpers.ts)
│   ├── integrations/           # External clients (jira/, anthropic/, resend/)
│   ├── export/                 # word.ts, excel.ts, ppt.ts
│   ├── db.ts                   # PG client, schema, migrations, domain types
│   ├── auth.ts                 # Sessions + passwords
│   ├── api-errors.ts           # repoErrorResponse, serviceErrorResponse, integrationErrorResponse
│   ├── rag.ts                  # RAG status calculation
│   ├── status-weights.ts       # Activity status → % weights
│   ├── log.ts                  # Structured request/error logging
│   └── utils.ts                # cn() helper
├── test/                       # Vitest setup (setup-jsdom.ts)
├── public/                     # Static assets
├── scripts/                    # One-off decomposition/refactor scripts (not runtime)
├── proxy.ts                    # Edge auth gate + request-id + API logging
├── instrumentation.ts          # Uncaught route error hook
├── next.config.ts              # standalone + external packages
├── vitest.config.ts            # node + jsdom test projects
├── package.json
├── tsconfig.json               # @/* → .
├── Dockerfile / k8s.yaml / railway.json
├── .github/workflows/          # CI (e.g. docker-build)
└── .planning/                  # GSD planning artifacts (not runtime)
    └── codebase/               # Codebase map docs (this directory)
```

## Directory Purposes

**`app/`:**
- Purpose: Routes = URLs. Pages for UI; `api/**/route.ts` for HTTP API
- Contains: `page.tsx`, `layout.tsx`, `route.ts`; decomposed pages add `_components/` and `use*.ts` hooks co-located
- Key files: `app/page.tsx` (portfolio), `app/layout.tsx`, `app/projects/[id]/*/page.tsx`

**`app/api/`:**
- Purpose: All server mutations and queries (~104 route files)
- Contains: One folder per resource; dynamic segments `[id]`, `[milestoneId]`, `[companyId]`, etc.; co-located `schema.ts` and `*.test.ts` on many routes
- Key files: `app/api/projects/[id]/route.ts` (wrapper model), `app/api/projects/route.ts` (manual session), `app/api/portfolio/report/route.ts` (integration + service)

**`lib/http/`:**
- Purpose: Composable route handler wrappers — the sanctioned API boundary pattern
- Contains: `with-auth.ts`, `with-project-access.ts`, `with-program-access.ts`, matrix tests
- Key files: `lib/http/with-auth.ts` (base wrapper), `with-project-access.ts` (project assert)

**`lib/services/`:**
- Purpose: Business logic, access asserts, orchestration — no HTTP imports
- Contains: 18 `*.service.ts` modules plus `access.ts`, `errors.ts`, co-located `*.unit.test.ts`
- Key files: `lib/services/projects.service.ts`, `lib/services/access.ts`, `lib/services/portfolio-report.service.ts`

**`lib/repositories/`:**
- Purpose: SQL only — no `next/server` imports
- Contains: 23 `*.repo.ts` modules, `_helpers.ts` (`buildUpdate`, `UnknownColumnError`), `ALLOWLIST-DIFF.md`, co-located tests
- Key files: `lib/repositories/projects.repo.ts`, `lib/repositories/_helpers.ts`, `lib/repositories/portfolio.repo.ts`

**`lib/integrations/`:**
- Purpose: External HTTP/SDK clients with normalized `IntegrationError`
- Contains: `jira/client.ts` + `schemas.ts`, `anthropic/client.ts` + `models.ts` + `schemas.ts`, `resend/client.ts`, `credentials.ts`, `errors.ts`
- Key files: `lib/integrations/credentials.ts` (env-var-name resolution), `lib/integrations/jira/client.ts`

**`lib/export/`:**
- Purpose: Server-side Office document generation
- Contains: `word.ts`, `excel.ts`, `ppt.ts` + unit tests
- Key files: Called from `app/api/export/**/route.ts`

**`components/`:**
- Purpose: Reusable UI shared across multiple routes; keep pages thinner
- Contains: Feature dialogs, layout shell, `ui/*` primitives
- Key files: `components/layout/Sidebar.tsx`, `components/ui/button.tsx`, `components/timeline/ImportMappingDialog.tsx`

**`lib/` (root modules):**
- Purpose: Cross-cutting server utilities
- Key files: `lib/db.ts` (~664 lines — schema + migrations), `lib/auth.ts`, `lib/api-errors.ts`, `lib/rag.ts`, `lib/log.ts`

**`test/`:**
- Purpose: Shared Vitest setup for jsdom component tests
- Key files: `test/setup-jsdom.ts`

**`public/`:**
- Purpose: Static files served as-is (logos, icons)

**Deploy / ops (root):**
- `Dockerfile`, `k8s.yaml`, `railway.json`, `.dockerignore` — container/K8s/Railway deploy
- `.env` present locally — never commit secrets; app needs `DATABASE_URL`

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root HTML shell
- `app/page.tsx`: Authenticated portfolio home
- `proxy.ts`: Edge request gate
- `instrumentation.ts`: Uncaught error logging
- `lib/db.ts` → `getDb()`: DB process entry

**Configuration:**
- `package.json`: Scripts `dev`/`build`/`start`/`test`/`lint`
- `next.config.ts`: standalone output, `serverExternalPackages`
- `tsconfig.json`: path alias `@/*`
- `vitest.config.ts`: node + jsdom test projects
- `components.json`: shadcn config
- `eslint.config.mjs`, `postcss.config.mjs`
- Env: `DATABASE_URL` required; Jira/Anthropic/Resend via env names from admin config

**HTTP layer:**
- `lib/http/with-auth.ts`: Base route wrapper (session, body, error tail)
- `lib/http/with-project-access.ts`: Project ownership assert wrapper
- `lib/http/with-program-access.ts`: Program ownership assert wrapper
- `lib/api-errors.ts`: Error → HTTP response mappers

**Core Logic:**
- `lib/db.ts`: Schema, migrations, `DbClient`, exported row types
- `lib/auth.ts`: Session lifecycle
- `lib/services/access.ts`: `assertProjectAccess`
- `lib/repositories/_helpers.ts`: Column allowlist guard
- `lib/rag.ts`: Health color
- `lib/export/*`: Document generation
- `lib/integrations/credentials.ts`: Secret resolution

**UI shells:**
- `components/layout/Sidebar.tsx`: Global + project nav (`NAV`, `PROJECT_NAV`)

**Testing:**
- `vitest.config.ts`: Two projects — `node` for `lib/` + `app/api/**/*.test.ts`; `jsdom` for `*.test.tsx` / `*.component.test.tsx`
- Co-located tests throughout `lib/`, `app/api/`, `components/`

## Naming Conventions

**Files:**
- Pages: `page.tsx` under URL segment folders
- APIs: `route.ts` under `app/api/<resource>/`
- API schemas: co-located `schema.ts` (Zod) on routes that validate bodies
- Services: `<domain>.service.ts` under `lib/services/`
- Repositories: `<domain>.repo.ts` under `lib/repositories/`
- HTTP wrappers: `with-<name>.ts` under `lib/http/`
- Integration clients: `client.ts` + `schemas.ts` under `lib/integrations/<service>/`
- Components: PascalCase `.tsx` (`Sidebar.tsx`, `BugImportDialog.tsx`)
- UI primitives: kebab-case under `components/ui/` (`button.tsx`)
- Page hooks: `use<Feature>Page.ts`, `use<Feature>Actions.ts` co-located with page
- Page subcomponents: `_components/<Name>.tsx` co-located with decomposed pages
- Lib modules: kebab or short names (`status-weights.ts`, `api-errors.ts`, `db.ts`)
- Tests: `*.test.ts` (node), `*.test.tsx` / `*.component.test.tsx` (jsdom), `*.unit.test.ts` (service/repo unit)

**Directories:**
- URL-aligned kebab or plural nouns: `projects`, `portfolio`, `bug-import-mapping`
- Dynamic segments: `[id]`, `[companyId]`, `[itemId]`, `[type]`, `[milestoneId]`
- Underscore prefix for co-located private UI: `_components/`

**Symbols:**
- Route exports: `export const GET = withProjectAccess(...)` or `export async function GET(...)`
- Service functions: verb + noun (`listProjects`, `assertProjectAccess`, `getPortfolioReport`)
- Repository functions: verb + entity (`getProject`, `listProjects`, `updateProject`)
- Column allowlists: `<TABLE>_COLUMNS` constant (e.g. `PROJECT_COLUMNS`)
- DB helpers: `getDb`, `db.get` / `db.all` / `db.run`
- Types: PascalCase — session/domain types in `lib/db.ts` or co-located; `AccessActor`, `SessionUser`, `IntegrationError`

## Where to Add New Code

**New project-scoped API endpoint:**
- Route: `app/api/projects/[id]/<resource>/route.ts`
- Use `withProjectAccess` wrapper; optional co-located `schema.ts` for Zod validation
- Service: `lib/services/<resource>.service.ts` (or extend existing)
- Repository: `lib/repositories/<resource>.repo.ts` with `*_COLUMNS` allowlist for PATCH
- Tests: co-located `route.test.ts` + service `*.unit.test.ts` + repo test

**New program-scoped API endpoint:**
- Route: `app/api/programs/[id]/<resource>/route.ts`
- Use `withProgramAccess` wrapper
- Service/repo same pattern as above

**New non-scoped authenticated API (portfolio/admin):**
- Route: `app/api/<area>/route.ts`
- Prefer `withAuth` wrapper; pass `ctx.actor` to service
- Legacy pattern (still present): manual `getSessionFromRequest` + inline actor — migrate to wrapper when touching

**New portfolio-level feature (page + API):**
- Page: `app/<feature>/page.tsx` (client component OK)
- Decomposed page: add `_components/`, `use<Feature>Page.ts`, `use<Feature>Actions.ts` when page grows
- API: `app/api/<feature>/route.ts`
- Nav link: `components/layout/Sidebar.tsx` → `NAV` array
- Service + repo if persistence needed

**New project sub-view:**
- Page: `app/projects/[id]/<view>/page.tsx`
- API: `app/api/projects/[id]/<resource>/route.ts` with `withProjectAccess`
- Nav: `PROJECT_NAV` in `components/layout/Sidebar.tsx` (`href` is suffix under project)
- Follow decomposition pattern from `app/projects/[id]/timeline/` or `milestones/` for complex UIs

**New DB table/column:**
- Add to `initPostgresSchema` **and** `migratePostgresSchema` in `lib/db.ts`
- Export TypeScript type at bottom of `lib/db.ts` if shared
- Create `lib/repositories/<table>.repo.ts` with column allowlist
- Scope by `company_id` or `project_id` consistently with peers

**New external integration:**
- Client: `lib/integrations/<service>/client.ts` + `schemas.ts`
- Throw `IntegrationError` from `lib/integrations/errors.ts`
- Credentials: extend `lib/integrations/credentials.ts` if env resolution needed
- Route catch: `integrationErrorResponse(e)` — map in route, not service

**New UI control:**
- Prefer compose from `components/ui/*`
- Feature-specific dialog shared across routes: `components/<area>/SomethingDialog.tsx`
- Page-specific subcomponent: `app/.../ _components/Something.tsx`

**New export format:**
- Generator: `lib/export/<format>.ts` (accept `AccessActor`, assert access)
- Route: `app/api/export/<format>/.../route.ts` with `withProjectAccess`
- Add to `serverExternalPackages` in `next.config.ts` if new heavy dependency

**New admin-only API:**
- Under `app/api/admin/`
- Use `withAuth` and check `ctx.actor.is_admin` or `ctx.user.is_admin` in handler
- Admin repos: `lib/repositories/admin.repo.ts`

**Utilities:**
- Class names: `cn` from `lib/utils.ts`
- Do not add client-only deps into `lib/db.ts`, services, repositories, or export paths

## Special Directories

**`.planning/codebase/`:**
- Purpose: Codebase map docs consumed by GSD plan/execute commands
- Generated: By `/gsd-map-codebase`
- Committed: Yes

**`.planning/` (other):**
- Purpose: GSD phases, roadmap, research — not runtime; do not modify from codebase map runs

**`.next/` / `node_modules/`:**
- Purpose: Build + deps
- Generated: Yes
- Committed: No

**`.github/workflows/`:**
- Purpose: CI (e.g. `docker-build.yml`)
- Generated: No
- Committed: Yes

**`scripts/`:**
- Purpose: One-off decomposition/refactor Node scripts
- Generated: Ad hoc
- Committed: Mixed (not part of runtime)

**`public/`:**
- Purpose: Static branding assets
- Generated: No
- Committed: Yes

## Page map (quick)

| URL area | Path |
|----------|------|
| Portfolio home | `app/page.tsx` |
| Portfolio roadmap/report/budget/resources | `app/portfolio/*/page.tsx` |
| Programs | `app/programs/page.tsx` |
| Resources | `app/resources/page.tsx` |
| Operations | `app/operations/page.tsx`, `app/operations/[id]/page.tsx` |
| Project hub + subpages | `app/projects/[id]/page.tsx`, `dashboard`, `timeline`, `milestones`, `resources`, `communication`, `budget`, `risks`, `bugs`, `analysis`, `reports`, `documents`, `report` |
| New project | `app/projects/new/page.tsx` |
| Project list | `app/projects/page.tsx` |
| Admin | `app/admin/page.tsx` |
| Login / landing | `app/login/page.tsx`, `app/landing/page.tsx` |

## Service ↔ repository map

| Domain | Service | Repository |
|--------|---------|------------|
| Projects | `lib/services/projects.service.ts` | `lib/repositories/projects.repo.ts` |
| Programs | `lib/services/programs.service.ts` | `lib/repositories/programs.repo.ts` |
| Activities / timeline | `lib/services/activities.service.ts` | `lib/repositories/activities.repo.ts` |
| Milestones | `lib/services/milestones.service.ts` | `lib/repositories/milestones.repo.ts` |
| Risks | `lib/services/risks.service.ts` | `lib/repositories/risks.repo.ts` |
| Issues | `lib/services/issues.service.ts` | `lib/repositories/issues.repo.ts` |
| Bugs | `lib/services/bugs.service.ts` | `lib/repositories/bugs.repo.ts` |
| Budget | `lib/services/budget.service.ts`, `budget-items.service.ts` | `lib/repositories/budget.repo.ts` |
| Meetings | `lib/services/meetings.service.ts` | `lib/repositories/meetings.repo.ts` |
| Escalations | `lib/services/escalations.service.ts` | `lib/repositories/escalations.repo.ts` |
| Documents | `lib/services/documents.service.ts` | `lib/repositories/documents.repo.ts` |
| Team | `lib/services/team.service.ts` | `lib/repositories/team.repo.ts` |
| Holidays | `lib/services/holidays.service.ts` | `lib/repositories/holidays.repo.ts` |
| Portfolio | `lib/services/portfolio.service.ts` | `lib/repositories/portfolio.repo.ts` |
| Portfolio report | `lib/services/portfolio-report.service.ts` | (uses portfolio + milestones repos) |
| Project report | `lib/services/project-report.service.ts` | (uses projects + activities repos) |
| Roadmap | `lib/services/roadmap.service.ts` | (uses portfolio + programs repos) |
| Access | `lib/services/access.ts` | `lib/repositories/projects.repo.ts` (`projectAccessRow`) |

## Import path rule

Always use `@/` for app-root imports:

```ts
import { withProjectAccess } from '@/lib/http/with-project-access';
import { getProject } from '@/lib/services/projects.service';
import { getDb } from '@/lib/db';
import Sidebar from '@/components/layout/Sidebar';
```

Never import `next/server` from `lib/services/` or `lib/repositories/`.

---

*Structure analysis: 2026-08-25*
