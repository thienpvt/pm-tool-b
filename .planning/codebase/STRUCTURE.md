# Codebase Structure

**Analysis Date:** 2026-08-29

## Directory Layout

```
pm-tool-b/
├── app/                        # Thin Next.js App Router shell (URLs only)
│   ├── api/                    # HTTP mount points (~123 route.ts files)
│   │   ├── admin/              # Re-exports module admin routes
│   │   ├── auth/               # Login, logout, me, password, onboarding
│   │   ├── dashboards/         # Portfolio/PM dashboard + document compliance APIs
│   │   ├── export/             # Binary document downloads
│   │   ├── jira/               # Jira proxy routes (re-export modules)
│   │   ├── operations/         # Ops systems routes
│   │   ├── portfolio/          # Portfolio CRUD, budget, roadmap, report
│   │   ├── programs/           # Programs (DB: customers)
│   │   ├── projects/           # Project CRUD + nested resources
│   │   ├── weekly-periods/     # Weekly workflow APIs
│   │   ├── audit/              # Audit log API
│   │   ├── document-catalog/   # Document catalog API
│   │   ├── document-templates/ # Document templates API
│   │   ├── resources/          # Resource listing
│   │   ├── config/             # App config
│   │   ├── demo-requests/      # Public demo lead form
│   │   ├── health/             # Health check
│   │   ├── import*/            # Import mapping + resource plan
│   │   └── bug-import-mapping/ # Bug CSV import mapping
│   ├── admin/                  # Admin UI shell → modules/admin/ui
│   ├── audit/                  # Audit log UI shell → modules/audit/ui
│   ├── dashboards/             # Portfolio + PM dashboard shells
│   ├── documents/              # Catalog + compliance UI shells
│   ├── landing/                # Marketing / public landing
│   ├── login/                  # Login page shell
│   ├── operations/             # Ops list + detail shells
│   ├── portfolio/              # Roadmap, report, budget, resources shells
│   ├── programs/               # Programs UI shell
│   ├── projects/               # Project list, new, [id] sub-app shells
│   ├── resources/              # Resource management shell
│   ├── weekly/                 # Periods, tracking, report editor shells
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Portfolio home shell
│   └── globals.css             # Global styles
├── modules/                    # Domain modules (backend + ui per area)
│   ├── admin/                  # Platform admin (users, companies, jira/rag config)
│   ├── audit/                  # Audit log
│   ├── dashboards/             # Portfolio + PM dashboards, filters, export
│   ├── documents/              # Document catalog, templates, checklist, compliance
│   ├── jira/                   # Jira import, sync, presets, search
│   ├── operations/             # Ops systems budget/incidents/expenses
│   ├── portfolio/              # Portfolio home, roadmap, budget, programs, resources
│   ├── projects/               # Project CRUD, timeline, milestones, RAID, budget, team
│   ├── reports/                # Project + portfolio reports, exports, email generation
│   └── weekly/                 # Weekly periods, tracking, report editor
├── components/                 # Shared cross-route UI (layout shell + design system)
│   ├── layout/                 # Sidebar, PageChrome, loading/error shells
│   ├── ui/                     # shadcn/Base UI primitives
│   ├── brand/                  # Logo
│   └── onboarding/             # OnboardingModal
├── lib/                        # Cross-cutting server modules
│   ├── http/                   # Route wrappers: withAuth, withProjectAccess, withRole
│   ├── services/               # Shared: access.ts, errors.ts, settings.service.ts
│   ├── repositories/           # Shared: auth.repo, settings.repo, _kysely-helpers
│   ├── integrations/           # jira/, anthropic/, resend/, credentials.ts
│   ├── export/                 # word.ts, excel.ts, ppt.ts, dashboard-portfolio.ts
│   ├── db/                     # kysely.ts, database.ts (codegen)
│   ├── migrate/                # assertMigrated.ts, runner.ts, plan.ts
│   ├── fiscal/                 # ROI, VND, budget metrics, ISO dates
│   ├── dashboards/             # Filter schema, KPI, period resolver
│   ├── documents/              # Compliance helpers, HTTPS URL utils
│   ├── db.ts                   # PG pool, DbClient, types, seed-if-empty
│   ├── db-*.ts                 # Domain DDL fragments (source for migrations)
│   ├── auth.ts                 # Sessions + passwords
│   ├── api-errors.ts           # Error → HTTP response mappers
│   ├── rag.ts                  # RAG status calculation
│   ├── log.ts                  # Structured request/error logging
│   └── utils.ts                # cn() helper
├── migrations/                 # Versioned SQL migrations (npm run migrate)
├── scripts/                    # migrate.ts, data-fixes/, one-off refactor scripts
├── test/                       # Vitest setup (setup-jsdom.ts)
├── eslint/                     # Custom ESLint plugin (require-auth-wrapper rule)
├── public/                     # Static assets
├── proxy.ts                    # Edge auth gate + request-id + API logging
├── instrumentation.ts        # Uncaught route error hook
├── next.config.ts              # standalone + external packages
├── vitest.config.ts            # node + jsdom test projects
├── package.json
├── tsconfig.json               # @/* → .
├── Dockerfile / k8s.yaml / railway.json
├── .github/workflows/          # CI (docker-build)
└── .planning/                  # GSD planning artifacts (not runtime)
    └── codebase/               # Codebase map docs (this directory)
```

## Directory Purposes

**`app/`:**
- Purpose: URL routing shell only — no business logic, no `'use client'` in page files
- Contains: Thin RSC `page.tsx` files importing `PageChrome` + module page; `api/**/route.ts` re-exports or handler wiring
- Key files: `app/page.tsx`, `app/layout.tsx`, `app/projects/[id]/*/page.tsx`, `app/api/projects/[id]/issues/route.ts`

**`modules/<domain>/`:**
- Purpose: Vertical domain slice owning backend logic and UI
- Contains: `backend/{routes,services,repositories}` + `ui/{*Page.tsx,_components/,use*.ts}`
- Key files: See module table below

**`modules/<domain>/backend/routes/`:**
- Purpose: HTTP handler implementations, Zod schemas, route tests
- Contains: `handlers.ts` + `schema.ts` pattern, or self-contained `route.ts`; mirrors API URL structure
- Key files: `modules/projects/backend/routes/projects/[id]/issues/handlers.ts`, `modules/admin/backend/routes/admin/users/route.ts`

**`modules/<domain>/backend/services/`:**
- Purpose: Business logic, access asserts, orchestration — no HTTP imports
- Contains: `*.service.ts` + co-located `*.unit.test.ts`
- Key files: `modules/projects/backend/services/issues.service.ts`, `modules/portfolio/backend/services/portfolio.service.ts`

**`modules/<domain>/backend/repositories/`:**
- Purpose: SQL via Kysely — no `next/server` imports
- Contains: `*.repo.ts` with `*_COLUMNS` allowlists + co-located tests
- Key files: `modules/projects/backend/repositories/issues.repo.ts`, `modules/portfolio/backend/repositories/portfolio.repo.ts`

**`modules/<domain>/ui/`:**
- Purpose: Client pages, hooks, subcomponents for the domain
- Contains: `*Page.tsx` (client), `use*.ts` hooks, `_components/` folders, `*.component.test.tsx`
- Key files: `modules/projects/ui/timeline/TimelinePage.tsx`, `modules/portfolio/ui/home/PortfolioHomePage.tsx`

**`lib/http/`:**
- Purpose: Composable route handler wrappers — the sanctioned API boundary pattern
- Contains: `with-auth.ts`, `with-project-access.ts`, `with-program-access.ts`, `with-role.ts`, matrix tests
- Key files: `lib/http/with-auth.ts`, `with-project-access.ts`

**`lib/services/` (shared only):**
- Purpose: Cross-domain access control and error types
- Contains: `access.ts`, `errors.ts`, `settings.service.ts` + unit tests
- Key files: `lib/services/access.ts`, `lib/services/errors.ts`

**`lib/repositories/` (shared only):**
- Purpose: Cross-domain persistence helpers and Kysely utilities
- Contains: `auth.repo.ts`, `settings.repo.ts`, `_helpers.ts`, `_kysely-helpers.ts`, `ALLOWLIST-DIFF.md`
- Key files: `lib/repositories/_kysely-helpers.ts`

**`lib/integrations/`:**
- Purpose: External HTTP/SDK clients with normalized `IntegrationError`
- Contains: `jira/client.ts` + `schemas.ts`, `anthropic/client.ts`, `resend/client.ts`, `credentials.ts`
- Key files: `lib/integrations/credentials.ts`

**`lib/export/`:**
- Purpose: Server-side Office document generation
- Contains: `word.ts`, `excel.ts`, `ppt.ts`, `dashboard-portfolio.ts`, `consolidated-weekly.ts` + unit tests
- Key files: Called from `app/api/export/**/route.ts` and module export routes

**`lib/db/` + `lib/db.ts`:**
- Purpose: Database connection, types, migration guard
- Contains: Pool singleton, legacy `DbClient`, Kysely client, exported row types
- Key files: `lib/db.ts`, `lib/db/kysely.ts`, `lib/db/database.ts`

**`migrations/`:**
- Purpose: Versioned SQL schema changes applied by operator
- Contains: `0001-baseline-schema.sql`, future `NNNN-description.sql` files
- Key files: `migrations/README.md`, `scripts/migrate.ts`

**`components/`:**
- Purpose: Reusable UI shared across all domains
- Contains: Layout shell (`Sidebar`, `PageChrome`), design-system primitives, onboarding modal
- Key files: `components/layout/Sidebar.tsx`, `components/layout/PageChrome.tsx`, `components/ui/button.tsx`

**`eslint/`:**
- Purpose: Custom lint rules enforcing architectural invariants
- Contains: `require-auth-wrapper` rule + allowlist for public routes
- Key files: `eslint/rules/require-auth-wrapper.mjs`, `eslint/route-wrapper-allowlist.json`

**`test/`:**
- Purpose: Shared Vitest setup for jsdom component tests
- Key files: `test/setup-jsdom.ts`

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root HTML shell
- `app/page.tsx`: Authenticated portfolio home shell
- `proxy.ts`: Edge request gate
- `instrumentation.ts`: Uncaught error logging
- `lib/db.ts` → `getDb()`: DB process entry (asserts migrations)
- `scripts/migrate.ts`: Schema migration CLI

**Configuration:**
- `package.json`: Scripts `dev`/`build`/`start`/`test`/`lint`/`migrate`/`codegen:db`
- `next.config.ts`: standalone output, `serverExternalPackages`
- `tsconfig.json`: path alias `@/*`
- `vitest.config.ts`: node + jsdom test projects
- `components.json`: shadcn config
- `eslint.config.mjs`, `postcss.config.mjs`
- Env: `DATABASE_URL` required; Jira/Anthropic/Resend via env names from admin config

**HTTP layer:**
- `lib/http/with-auth.ts`: Base route wrapper
- `lib/http/with-project-access.ts`: Project ownership assert wrapper
- `lib/http/with-program-access.ts`: Program ownership assert wrapper
- `lib/http/with-role.ts`: Role-gated wrapper (`withCpmo`)
- `lib/api-errors.ts`: Error → HTTP response mappers

**Core Logic:**
- `lib/db.ts`: Pool, types, seed-if-empty
- `lib/auth.ts`: Session lifecycle
- `lib/services/access.ts`: `assertProjectAccess`, `AccessActor`
- `lib/repositories/_kysely-helpers.ts`: Column allowlist guard
- `lib/rag.ts`: Health color
- `lib/export/*`: Document generation
- `lib/integrations/credentials.ts`: Secret resolution

**UI shells:**
- `components/layout/PageChrome.tsx`: Sidebar + main content wrapper
- `components/layout/Sidebar.tsx`: Global + project nav (`NAV_PRIMARY`, `NAV_SECONDARY`, `PROJECT_NAV`)

**Testing:**
- `vitest.config.ts`: node project for `{lib,app,eslint,modules}/**/*.test.ts`; jsdom for `*.test.tsx` / `*.component.test.tsx`
- Co-located tests throughout `lib/`, `app/api/`, `modules/`, `components/`
- Module split contract tests: `modules/*/backend/*-module-split.test.ts`

## Naming Conventions

**Files:**
- App pages: `page.tsx` under URL segment folders (RSC shells only)
- App APIs: `route.ts` under `app/api/<resource>/`
- Module route handlers: `handlers.ts` + co-located `schema.ts` under `modules/<domain>/backend/routes/`
- Module self-contained routes: `route.ts` under `modules/<domain>/backend/routes/` (exports `GET`/`POST`/etc.)
- Services: `<domain>.service.ts` or `<resource>.service.ts` under `modules/<domain>/backend/services/`
- Repositories: `<resource>.repo.ts` under `modules/<domain>/backend/repositories/`
- HTTP wrappers: `with-<name>.ts` under `lib/http/`
- Module UI pages: `<Feature>Page.tsx` under `modules/<domain>/ui/<feature>/`
- Page hooks: `use<Feature>Page.ts`, `use<Feature>Actions.ts` co-located in module ui
- Page subcomponents: `_components/<Name>.tsx` co-located in module ui
- Integration clients: `client.ts` + `schemas.ts` under `lib/integrations/<service>/`
- Components: PascalCase `.tsx` (`Sidebar.tsx`, `PortfolioHomePage.tsx`)
- UI primitives: kebab-case under `components/ui/` (`button.tsx`)
- Lib modules: kebab or short names (`api-errors.ts`, `db.ts`)
- Migrations: `NNNN-description.sql` under `migrations/`
- Tests: `*.test.ts` (node), `*.test.tsx` / `*.component.test.tsx` (jsdom), `*.unit.test.ts` (service/repo unit)

**Directories:**
- Domain modules: singular/plural nouns matching business area (`projects`, `portfolio`, `weekly`)
- Module backend mirrors API URL structure: `modules/projects/backend/routes/projects/[id]/issues/`
- Module ui groups by feature screen: `modules/projects/ui/timeline/`, `modules/portfolio/ui/home/`
- Dynamic segments: `[id]`, `[companyId]`, `[itemId]`, `[milestoneId]`, `[reportId]`
- Underscore prefix for co-located private UI: `_components/`

**Symbols:**
- Thin route re-export: `export { GET, POST } from '@/modules/.../route'`
- Thin route wiring: `export const GET = withProjectAccess(getXHandler)`
- Module route export: `export const GET = withCpmo(async (req, ctx) => ...)`
- Service functions: verb + noun (`listIssues`, `createProject`, `assertProjectAccess`)
- Repository functions: verb + entity (`listIssues`, `getProject`, `updateIssue`)
- Column allowlists: `<TABLE>_COLUMNS` constant (e.g. `ISSUE_COLUMNS`)
- DB helpers: `getDb`, `getKysely`, `getPool`, `runInTransaction`
- Types: PascalCase — `AccessActor`, `SessionUser`, `IntegrationError`, row types in `lib/db.ts` or `lib/db/database.ts`

## Where to Add New Code

**New project-scoped API endpoint:**
- Thin route: `app/api/projects/[id]/<resource>/route.ts`
- Handler: `modules/projects/backend/routes/projects/[id]/<resource>/handlers.ts`
- Schema: `modules/projects/backend/routes/projects/[id]/<resource>/schema.ts`
- Use `withProjectAccess` wrapper in thin route
- Service: `modules/projects/backend/services/<resource>.service.ts`
- Repository: `modules/projects/backend/repositories/<resource>.repo.ts` with `*_COLUMNS` allowlist
- Tests: co-located `route.test.ts` + service `*.unit.test.ts` + repo test

**New program-scoped API endpoint:**
- Thin route: `app/api/programs/[id]/<resource>/route.ts`
- Handler: `modules/portfolio/backend/routes/programs/[id]/<resource>/handlers.ts`
- Use `withProgramAccess` wrapper
- Service/repo in `modules/portfolio/backend/`

**New domain feature (new module area):**
- Create `modules/<domain>/backend/{routes,services,repositories}/`
- Create `modules/<domain>/ui/<feature>/`
- Add thin shells: `app/<feature>/page.tsx` + `app/api/<feature>/route.ts`
- Add nav link in `components/layout/Sidebar.tsx`
- Add module split test: `modules/<domain>/backend/<domain>-module-split.test.ts`

**New portfolio-level feature (existing portfolio module):**
- Page shell: `app/portfolio/<feature>/page.tsx` → import from `modules/portfolio/ui/<feature>/`
- Module UI: `modules/portfolio/ui/<feature>/<Feature>Page.tsx` + `_components/` + hooks
- API: thin route in `app/api/portfolio/<feature>/route.ts` → module backend route
- Service/repo: `modules/portfolio/backend/services/` + `repositories/`

**New project sub-view:**
- Page shell: `app/projects/[id]/<view>/page.tsx` with `PageChrome projectId={id}`
- Module UI: `modules/projects/ui/<view>/<View>Page.tsx`
- API: `app/api/projects/[id]/<resource>/route.ts` with `withProjectAccess`
- Nav: add to `PROJECT_NAV` in `components/layout/Sidebar.tsx`

**New UI page (general pattern):**
- App shell (RSC, no `'use client'`):

```tsx
// app/<area>/<feature>/page.tsx
import { PageChrome } from '@/components/layout/PageChrome';
import FeaturePage from '@/modules/<domain>/ui/<feature>/FeaturePage';

export default function FeatureRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 overflow-auto">
      <FeaturePage />
    </PageChrome>
  );
}
```

- Module page (client component with fetch logic)

**New DB table/column:**
- Add versioned SQL: `migrations/NNNN-description.sql` (never edit applied files)
- Run `npm run migrate`
- Regenerate types: `npm run codegen:db` → updates `lib/db/database.ts`
- Create `modules/<domain>/backend/repositories/<table>.repo.ts` with column allowlist
- Scope by `company_id` or `project_id` consistently with peers

**New external integration:**
- Client: `lib/integrations/<service>/client.ts` + `schemas.ts`
- Throw `IntegrationError` from `lib/integrations/errors.ts`
- Credentials: extend `lib/integrations/credentials.ts` if env resolution needed
- Route catch: `integrationErrorResponse(e)` — map in route, not service

**New UI control:**
- Shared primitive: compose from `components/ui/*`
- Domain-specific: `modules/<domain>/ui/<feature>/_components/Something.tsx`
- Cross-domain dialog: only if truly shared across modules — prefer module-local

**New export format:**
- Generator: `lib/export/<format>.ts` (accept `AccessActor`, assert access)
- Module handler: `modules/reports/backend/routes/export/<format>/handlers.ts`
- Thin route: `app/api/export/<format>/.../route.ts` with `withProjectAccess`
- Add to `serverExternalPackages` in `next.config.ts` if new heavy dependency

**New admin-only API:**
- Module route: `modules/admin/backend/routes/admin/<resource>/route.ts`
- Thin route: `app/api/admin/<resource>/route.ts` re-exporting module route
- Use `withCpmo` or `withAuth` + admin check
- Service/repo: `modules/admin/backend/services/` + `repositories/`

**Utilities:**
- Cross-domain server helper: `lib/<area>/<name>.ts`
- Domain-specific helper: `modules/<domain>/ui/<feature>/_components/` or module service
- Class names: `cn` from `lib/utils.ts`
- Do not add client-only deps into `lib/db.ts`, services, repositories, or export paths

## Special Directories

**`.planning/codebase/`:**
- Purpose: Codebase map docs consumed by GSD plan/execute commands
- Generated: By `/gsd-map-codebase`
- Committed: Yes

**`.planning/` (other):**
- Purpose: GSD phases, roadmap, research — not runtime

**`.next/` / `node_modules/`:**
- Purpose: Build + deps
- Generated: Yes
- Committed: No

**`.github/workflows/`:**
- Purpose: CI (e.g. `docker-build.yml`)
- Committed: Yes

**`scripts/`:**
- Purpose: Migration runner, data-fix backfills, one-off decomposition scripts
- Runtime: `scripts/migrate.ts` (via `npm run migrate`); others are operator/ad-hoc
- Committed: Yes

**`migrations/`:**
- Purpose: Append-only versioned SQL schema
- Generated: By developers; checksum tracked in `schema_migrations` ledger
- Committed: Yes

**`public/`:**
- Purpose: Static branding assets
- Committed: Yes

## Page map (quick)

| URL area | App shell | Module UI |
|----------|-----------|-----------|
| Portfolio home | `app/page.tsx` | `modules/portfolio/ui/home/PortfolioHomePage.tsx` |
| Portfolio roadmap/report/budget/resources | `app/portfolio/*/page.tsx` | `modules/portfolio/ui/roadmap/`, `report/`, `budget/`, `resources/` |
| Portfolio dashboards | `app/dashboards/portfolio/page.tsx` | `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx` |
| PM dashboard | `app/dashboards/pm/page.tsx` | `modules/dashboards/ui/pm/PmDashboardPage.tsx` |
| Programs | `app/programs/page.tsx` | `modules/portfolio/ui/programs/ProgramsPage.tsx` |
| Resources | `app/resources/page.tsx` | `modules/portfolio/ui/members/ResourcesMembersPage.tsx` |
| Operations | `app/operations/page.tsx`, `[id]/page.tsx` | `modules/operations/ui/` |
| Project hub + subpages | `app/projects/[id]/*/page.tsx` | `modules/projects/ui/hub/`, `timeline/`, `milestones/`, etc. |
| Weekly workflow | `app/weekly/*/page.tsx` | `modules/weekly/ui/periods/`, `tracking/`, `report/` |
| Documents | `app/documents/*/page.tsx` | `modules/documents/ui/catalog/`, `compliance/` |
| Audit log | `app/audit/page.tsx` | `modules/audit/ui/AuditLogPage.tsx` |
| Admin | `app/admin/page.tsx` | `modules/admin/ui/AdminPage.tsx` |
| Login / landing | `app/login/page.tsx`, `app/landing/page.tsx` | (inline or minimal) |

## Domain module map

| Module | Backend services (examples) | UI screens (examples) |
|--------|------------------------------|----------------------|
| `admin` | `users.service.ts`, `jira-config.service.ts`, `admin-platform.service.ts` | `AdminPage.tsx` |
| `audit` | `audit.service.ts` | `AuditLogPage.tsx` |
| `dashboards` | `spec-dashboards.service.ts` | `PortfolioDashboardPage.tsx`, `PmDashboardPage.tsx` |
| `documents` | `document-catalog.service.ts`, `document-templates.service.ts`, `project-document-checklist.service.ts` | `DocumentCatalogPage.tsx`, `ProjectChecklistPage.tsx` |
| `jira` | `import-mapping.service.ts`, `jira-mapping.service.ts` | `ImportMappingDialog.tsx`, timeline import components |
| `operations` | `operations.service.ts` | `OperationsListPage.tsx`, `OperationsDetailPage.tsx` |
| `portfolio` | `portfolio.service.ts`, `programs.service.ts`, `roadmap.service.ts`, `fiscal-budget.service.ts` | `PortfolioHomePage.tsx`, `RoadmapPage.tsx`, `PortfolioBudgetPage.tsx` |
| `projects` | `projects.service.ts`, `activities.service.ts`, `milestones.service.ts`, `issues.service.ts`, `risks.service.ts`, `budget.service.ts`, +15 more | `ProjectHubPage.tsx`, `TimelinePage.tsx`, `MilestonesPage.tsx`, `ProjectBugsPage.tsx`, etc. |
| `reports` | `portfolio-report.service.ts`, `project-report.service.ts` | `PortfolioReportPage.tsx`, `ProjectReportPage.tsx` |
| `weekly` | `weekly-reports.service.ts`, `weekly-tracking.service.ts` | `WeeklyPeriodsPage.tsx`, `WeeklyTrackingPage.tsx`, `WeeklyReportEditorPage.tsx` |

## Shared lib ↔ module boundaries

| Concern | Location | Used by |
|---------|----------|---------|
| Access control | `lib/services/access.ts` | All module services via `AccessActor` |
| Error types | `lib/services/errors.ts` | All module services |
| HTTP wrappers | `lib/http/*` | Module routes + thin app/api wiring |
| Auth sessions | `lib/auth.ts`, `lib/repositories/auth.repo.ts` | Auth routes, wrappers |
| DB connection | `lib/db.ts`, `lib/db/kysely.ts` | All repositories |
| Kysely helpers | `lib/repositories/_kysely-helpers.ts` | Module repositories |
| Integrations | `lib/integrations/*` | Module services (reports, jira, admin) |
| Exports | `lib/export/*` | Module report routes, app/api/export |
| Settings | `lib/services/settings.service.ts`, `lib/repositories/settings.repo.ts` | Admin, AI credential fallback |

## Import path rule

Always use `@/` for app-root imports:

```ts
import { withProjectAccess } from '@/lib/http/with-project-access';
import { listIssues } from '@/modules/projects/backend/services/issues.service';
import TimelinePage from '@/modules/projects/ui/timeline/TimelinePage';
import { PageChrome } from '@/components/layout/PageChrome';
```

Never import `next/server` from module `services/` or `repositories/`.
Never put business logic in `app/` — keep it in `modules/<domain>/`.

---

*Structure analysis: 2026-08-29*
