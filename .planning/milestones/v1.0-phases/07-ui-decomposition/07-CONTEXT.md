# Phase 7: UI Decomposition - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all four grey areas accepted at the recommended answer

<domain>
## Phase Boundary

The 7 named god pages/components split into a container plus feature modules with data-fetching extracted into named hooks, against the now-stable API surface from Phases 1–6 — with no client code reaching past that surface into server-only layers.

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11.

This phase is a structural UI split, not a redesign. Screens stay recognizable. Endpoint shapes stay. Behavior on load, filter, and export stays identical.

**In scope — the 7 named files (line counts 2026-08-25):**

| File | Lines | Requirement |
|------|------:|-------------|
| `app/portfolio/report/page.tsx` | 2655 | UI-02 |
| `app/projects/[id]/timeline/page.tsx` | 1838 | UI-03 |
| `app/projects/[id]/report/page.tsx` | 1346 | UI-04 |
| `app/projects/[id]/milestones/page.tsx` | 1182 | UI-05 |
| `app/portfolio/roadmap/page.tsx` | 1141 | UI-06 |
| `components/timeline/ImportMappingDialog.tsx` | 1179 | UI-07 |
| `app/page.tsx` | 1020 | UI-08 |

Each must become a thin container plus feature modules with no single file over 400 lines, named data-fetching hooks (UI-01), a component test (UI-10), and identical load/filter/export behavior (UI-11). A grep must confirm no client component imports `@/lib/db`, a repository, a service, an integration client, or `pg` (UI-09).

**Out of scope:** new product features; visual redesign; introducing SWR/React Query; Playwright E2E (Phase 1); perf work (grid virtualization, server-component chrome) — PROJECT defers that after the UI sweep; Phase 6 live-deploy shadow-mode sign-off (deferred human verification).

</domain>

<decisions>
## Implementation Decisions

### Module Layout & Split Strategy

- Extracted feature modules colocate next to each page (`app/portfolio/report/_components/`, `app/projects/[id]/timeline/_components/`, etc.). Page-private pieces stay private. `components/<domain>/` remains for shared UI (existing `components/timeline/`, `components/bugs/`, `ImportMappingDialog`).
- Split each god page on the existing `// ───` section banners (toolbar/filters, table/grid, dialogs, export) — those are the seams already in the files. Do not mechanical-chunk to 400 lines and do not invent a new feature taxonomy.
- `page.tsx` (or the dialog default export) is a thin container: route params, Sidebar where applicable, hook wiring, compose feature modules. Target well under 400 lines.
- Page-local types travel with the feature that owns them. A colocated `types.ts` exists only when 2+ modules share a type (CONVENTIONS: type aliases near use site). Do not promote to `lib/types/`.

### Data Fetching Hooks

- Named hooks colocate with the page (`app/portfolio/report/usePortfolioReport.ts` or `_hooks/`). Do not create a project-root `hooks/` directory and do not put hooks under `lib/` (UI-09 forbids client code reaching server layers; a `lib/hooks` next to services is a footgun).
- A hook owns fetch + server-backed state only: data, loading, error, refetch. Filter, dialog-open, and selection state stay in the feature module that renders them (UI-01: data fetching extracted, separate from rendering).
- Keep the existing `fetch('/api/...')` calls, moved into hooks unchanged. No SWR, no React Query, no new `apiClient` wrapper — PROJECT forbids API redesign; the stack has none of those libraries.
- Per-page hooks. Extract a shared helper only when two of the 7 pages already duplicate the same fetch (YAGNI).

### Behavior Freeze & Visual Identity

- Zero visual change. PROJECT out of scope: "not a redesign; endpoint shapes and screens stay recognizable." UI-11 requires identical load/filter/export behavior.
- Vietnamese copy, toasts, and error strings stay byte-identical. No copy pass, no i18n extraction.
- Preserve whatever each page already does for loading, empty, and error UI — including missing-error cases. Do not invent new spinners, error banners, or error boundaries.
- Freeze export, filter, and dialog interactions: same click order, same payloads, same toast text. Accidental behavior change is HYG-02 and must be named in the commit message.

### Testing & Verification

- Co-located `*.component.test.tsx` next to each page/container. Phase 1 already locked this as the jsdom opt-in (`@testing-library/react` + jest-dom).
- Mock `fetch` with JSON fixtures; render the container + feature modules; no running server. Same isolation as route-handler tests mocking `@/lib/db`. No MSW.
- UI-11 proof: automated load + one filter or export interaction per page. Visual identity via UAT checklist (screens stay recognizable). No Playwright — Phase 1 put E2E out of scope.
- One `*.component.test.tsx` per decomposed page/dialog (UI-10 is per page, not per module). HYG-03 is satisfied at that seam. No test-per-extracted-file and no mandatory `renderHook` suite.

### Claude's Discretion

All four grey areas accepted at the recommended answer. Remaining discretion is ordinary implementation within these constraints: hook file naming (`useX.ts` vs `_hooks/useX.ts`), exact `_components/` filenames, and the order the 7 files are decomposed (largest first is the obvious default).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `components/layout/Sidebar.tsx` — global + project nav; every authenticated page composes it.
- `components/ui/*` — shadcn primitives (`button`, `dialog`, `select`, …). Import concrete paths, not a barrel.
- `components/timeline/ImportMappingDialog.tsx` — 1179-line god dialog, only caller is `app/projects/[id]/timeline/page.tsx`. Decompose in place under `components/timeline/` (it is already shared-domain, not a route page).
- `components/bugs/`, `components/jira/`, `components/resources/`, `components/onboarding/` — existing `components/<domain>/PascalCase.tsx` pattern for shared feature UI.
- Phase 1 jsdom harness: `**/*.component.test.tsx` + `@testing-library/react`. No page-level component tests exist yet for these 7 files.

### Established Patterns

- Large client pages: `'use client'` at top, substantial UI + local state, `fetch('/api/...')` inside `useEffect`. CONVENTIONS currently call this "acceptable … extract only when reused" — this phase is the extraction.
- Section banners in large client pages: `// ─── Types ───` style dividers — the split seams.
- Forms: controlled React state + `@/components/ui/dialog`. Toasts: `sonner`.
- Types: `type` aliases near the use site, not a shared `lib/types/` catalog.
- Import alias: `@/` for app-root. Mixed quotes; single quotes dominate app files.
- No `hooks/` directory exists. Do not invent one.

### Integration Points

- These pages already talk to the Phase 1–6 API surface (`/api/portfolio/*`, `/api/projects/[id]/*`, `/api/import-mapping`, `/api/parse-file-headers`). Do not change those contracts.
- UI-09 grep gate: no client component may import `@/lib/db`, `lib/repositories/*`, `lib/services/*`, `lib/integrations/*`, or `pg`. If a page currently does, that import moves behind an `/api/` call or is deleted — it does not stay in the client bundle.
- `ImportMappingDialog` fetches `/api/import-mapping` and `/api/projects/${projectId}/activities/import` plus POST `/api/parse-file-headers`. Those stay; only the dialog's internals split.
- Phase 6 human verification is deferred (`/gsd-verify-work 6`) — live shadow-mode deploy + tenancy-residual acceptance. It does not block this split: the API wrappers are already in the codebase.

</code_context>

<specifics>
## Specific Ideas

- Decompose largest-first by default: portfolio report (2655) → timeline (1838) → project report (1346) → milestones (1182) → ImportMappingDialog (1179) → roadmap (1141) → home (1020). Planner may regroup into waves if file ownership is disjoint.
- `ImportMappingDialog` is a component, not a route: keep it under `components/timeline/`, split into `_components/` (or sibling files) beside it, still no file over 400 lines.
- Behavior-identity check for UI-11 is load + one filter or export path per page in the component test, plus a UAT checklist for visual recognizability. Not screenshots, not Playwright.

</specifics>

<deferred>
## Deferred Ideas

- Phase 6 live-deploy shadow-mode operational review and v1 tenancy-residual risk acceptance — resume with `/gsd-verify-work 6`. Not part of this phase.
- Perf work (grid virtualization, server components for chrome) — PROJECT: follows the UI sweep, not part of it.
- SWR / React Query / shared `apiClient` — rejected for this phase; revisit only if a later milestone wants a data-fetching library.
- Playwright E2E for visual identity — Phase 1 out of scope; do not add it here.
- None of the 7 pages should gain new product features during the split.

</deferred>
