# Phase 24: Repo-wide Module Split - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Every listed feature area keeps backend and UI in separate directories under `modules/<feature>/`, and existing page plus `/api/*` URLs still resolve.

**Requirements:** MOD-01, MOD-02

**In:**
- Inventory and split: portfolio, projects, admin, operations, reports, Jira/import, dashboards, weekly, documents, audit
- `modules/<feature>/backend/` for routes, services, repos that belong to that feature (or thin wrappers that re-export from moved files)
- `modules/<feature>/ui/` for pages, hooks, components (v2 screens already live here for dashboards/weekly/documents/audit)
- Thin `app/` and `app/api/` re-exports so URLs do not change
- Import path updates and tests that still pass
- ESLint route-wrapper allowlist path updates if files move

**Out:**
- Changing API contracts or auth wrappers
- Kysely (Phase 25)
- RSC chrome / cold-start (Phase 26)
- New product screens
- New npm packages
- Rewriting business logic

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 24
- `.planning/REQUIREMENTS.md` — MOD-01, MOD-02
- `app/` App Router tree
- `lib/services/`, `lib/repositories/`
- `eslint/route-wrapper-allowlist.json`
- Phase 21–23 `modules/*/ui` pattern
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Thin `'use client'` re-export pattern from `app/dashboards/portfolio/page.tsx`
- API routes already thin in many places (handler in service)

### Established Patterns
- `export { default } from '@/modules/...'`
- Route: `export { GET, POST } from '@/modules/.../backend/...'`

### Integration Points
- `vitest.config.ts` include globs already cover `modules/**`
- ESLint require-auth-wrapper scoped to `app/api/**/route.ts` — if handlers move, keep a thin `app/api` file so the lint gate still sees wrappers, OR update the lint glob and allowlist
</code_context>

<specifics>
## Specific Ideas

Grey areas auto-accepted: mechanical move, keep URLs, keep D-23, keep `lib/` cross-cutting, sequential execute, no visual redesign.
</specifics>

<deferred>
## Deferred Ideas

- Kysely — Phase 25
- RSC chrome — Phase 26
</deferred>
