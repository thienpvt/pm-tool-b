---
phase: 26-rsc-chrome-cold-start
reviewed: 2026-08-29T02:27:00Z
depth: deep
files_reviewed: 89
files_reviewed_list:
  - components/layout/PageChrome.tsx
  - components/layout/PageLoadingShell.tsx
  - components/layout/PageErrorShell.tsx
  - lib/rsc-chrome.gate.test.ts
  - lib/db.cold-start.test.ts
  - app/page.tsx
  - app/admin/page.tsx
  - app/audit/page.tsx
  - app/audit/loading.tsx
  - app/dashboards/portfolio/page.tsx
  - app/dashboards/portfolio/loading.tsx
  - app/dashboards/pm/page.tsx
  - app/dashboards/pm/loading.tsx
  - app/documents/catalog/page.tsx
  - app/documents/compliance/page.tsx
  - app/portfolio/report/page.tsx
  - app/portfolio/resources/page.tsx
  - app/portfolio/roadmap/page.tsx
  - app/portfolio/budget/page.tsx
  - app/programs/page.tsx
  - app/resources/page.tsx
  - app/projects/page.tsx
  - app/projects/new/page.tsx
  - app/projects/[id]/page.tsx
  - app/projects/[id]/analysis/page.tsx
  - app/projects/[id]/budget/page.tsx
  - app/projects/[id]/bugs/page.tsx
  - app/projects/[id]/communication/page.tsx
  - app/projects/[id]/dashboard/page.tsx
  - app/projects/[id]/document-checklist/page.tsx
  - app/projects/[id]/documents/page.tsx
  - app/projects/[id]/milestones/page.tsx
  - app/projects/[id]/report/page.tsx
  - app/projects/[id]/reports/page.tsx
  - app/projects/[id]/resources/page.tsx
  - app/projects/[id]/risks/page.tsx
  - app/projects/[id]/timeline/page.tsx
  - app/projects/[id]/weekly-reports/[reportId]/page.tsx
  - app/weekly/periods/page.tsx
  - app/weekly/periods/loading.tsx
  - app/weekly/tracking/page.tsx
  - app/weekly/tracking/loading.tsx
  - app/weekly/reports/[projectId]/[reportId]/page.tsx
  - app/login/page.tsx
  - app/landing/page.tsx
  - app/operations/page.tsx
  - app/operations/[id]/page.tsx
  - modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx
  - modules/dashboards/ui/pm/PmDashboardPage.tsx
  - modules/weekly/ui/periods/WeeklyPeriodsPage.tsx
  - modules/audit/ui/AuditLogPage.tsx
  - modules/portfolio/ui/home/PortfolioHomePage.tsx
  - modules/admin/ui/AdminPage.tsx
  - modules/documents/ui/catalog/DocumentCatalogPage.tsx
  - modules/documents/ui/compliance/DocumentCompliancePage.tsx
  - modules/reports/ui/portfolio-report/PortfolioReportPage.tsx
  - modules/portfolio/ui/resources/PortfolioResourcesPage.tsx
  - modules/portfolio/ui/roadmap/RoadmapPage.tsx
  - modules/portfolio/ui/programs/ProgramsPage.tsx
  - modules/portfolio/ui/members/ResourcesMembersPage.tsx
  - modules/projects/ui/list/ProjectsListPage.tsx
  - modules/projects/ui/new/NewProjectPage.tsx
  - modules/weekly/ui/tracking/WeeklyTrackingPage.tsx
  - modules/projects/ui/hub/ProjectHubPage.tsx
  - modules/projects/ui/analysis/ProjectAnalysisPage.tsx
  - modules/projects/ui/budget/ProjectBudgetPage.tsx
  - modules/projects/ui/bugs/ProjectBugsPage.tsx
  - modules/projects/ui/communication/ProjectCommunicationPage.tsx
  - modules/projects/ui/dashboard/ProjectDashboardPage.tsx
  - modules/documents/ui/checklist/ProjectChecklistPage.tsx
  - modules/projects/ui/documents/ProjectDocumentsPage.tsx
  - modules/projects/ui/milestones/MilestonesPage.tsx
  - modules/reports/ui/project-report/ProjectReportPage.tsx
  - modules/reports/ui/project-reports-list/ProjectReportsListPage.tsx
  - modules/projects/ui/resources/ProjectResourcesPage.tsx
  - modules/projects/ui/risks/ProjectRisksPage.tsx
  - modules/projects/ui/timeline/TimelinePage.tsx
  - modules/weekly/ui/report/WeeklyReportEditorPage.tsx
  - modules/projects/backend/projects-module-split.test.ts
  - modules/portfolio/backend/portfolio-module-split.test.ts
  - modules/admin/backend/admin-module-split.test.ts
  - modules/documents/backend/documents-module-split.test.ts
  - modules/reports/backend/reports-module-split.test.ts
  - modules/weekly/backend/weekly-module-split.test.ts
  - modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx
  - modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx
  - modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx
  - modules/audit/ui/AuditLogPage.component.test.tsx
  - modules/portfolio/ui/home/PortfolioHomePage.component.test.tsx
  - modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx
  - modules/documents/ui/compliance/DocumentCompliancePage.component.test.tsx
  - modules/documents/ui/checklist/ProjectChecklistPage.component.test.tsx
  - modules/reports/ui/portfolio-report/PortfolioReportPage.component.test.tsx
  - modules/reports/ui/project-report/ProjectReportPage.component.test.tsx
  - modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx
  - modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx
  - modules/portfolio/ui/roadmap/RoadmapPage.component.test.tsx
  - modules/projects/ui/milestones/page.component.test.tsx
  - modules/projects/ui/timeline/page.component.test.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-08-29T02:27:00Z
**Depth:** deep
**Files Reviewed:** 89
**Status:** issues_found

## Summary

Phase 26 delivers the intended RSC chrome architecture: `PageChrome` is a Server Component (no `'use client'`), `Sidebar` remains client-side with `/api/auth/me` fetch, login/landing/operations/portfolio-budget routes stay excluded, and `lib/db.ts` retains a single production `Pool` singleton. Cross-file tracing confirms the server wrapper → client Sidebar leaf → client module body pattern is consistent across all 32 `CHROME_ROUTES`.

Gate tests (`lib/rsc-chrome.gate.test.ts`, 17/17 pass) and module-split tests enforce the boundary. Cold-start measurement (`lib/db.cold-start.test.ts`) correctly uses `vi.resetModules()` + `pool.end()` without introducing a second production pool.

Three warnings remain: viewport-based heights in stripped module pages were not rebased for the new PageChrome `<main>` container (layout regression vs preserve-existing), cold-start tests mutate tracked planning artifacts and `DATABASE_URL`, and duplicate Tailwind padding utilities silently override intended spacing on several routes.

## Warnings

### WR-01: Milestones split-pane still uses full-viewport height inside PageChrome main

**File:** `modules/projects/ui/milestones/MilestonesPage.tsx:166`
**Issue:** After shell strip, the milestone tree/panel wrapper keeps `h-[calc(100vh-73px)]`, which assumes the page owns the viewport. Content now renders inside `PageChrome` `<main className="flex-1 overflow-auto">`, so the calc is anchored to `100vh` instead of the available main column height. This can produce double scrollbars or a panel taller than its container — a preserve-existing layout regression.
**Fix:** Replace viewport calc with flex-fill height relative to the main landmark, e.g. `className="flex gap-0 flex-1 min-h-0"` on the split container and ensure the route wrapper uses `mainClassName="flex-1 flex flex-col min-h-0 overflow-hidden"`.

### WR-02: Timeline table uses viewport height inside nested chrome

**File:** `modules/projects/ui/timeline/_components/TimelineTable.tsx:37`
**Issue:** Inline `height: calc(100vh - 200px)` was written for the old full-page shell. Inside PageChrome + padded `<main>`, the table height is measured against the viewport, not the scroll container, causing clipped or over-tall table regions on `/projects/[id]/timeline`.
**Fix:** Use flex-based sizing (`flex-1 min-h-0` chain from route wrapper through page body) or derive height from a container ref instead of `100vh`.

### WR-03: Cold-start tests mutate repo-tracked artifact and global env

**File:** `lib/db.cold-start.test.ts:79,103-104`
**Issue:** Tests write `.planning/phases/26-rsc-chrome-cold-start/COLD-START.md` on every run (SKIP when `TEST_DATABASE_URL` unset) and assign `process.env.DATABASE_URL` without teardown restore. This dirties the working tree after `npm test` and can leak env state to co-located suites in the same Vitest worker.
**Fix:** Write artifacts to a temp directory (or `os.tmpdir()`), assert content in-memory, and wrap env mutation in `try/finally` to restore prior `DATABASE_URL`. Keep COLD-START.md updates as a CI-only opt-in step if a committed artifact is required.

## Info

### IN-01: PageErrorShell is unused in production module pages

**File:** `components/layout/PageErrorShell.tsx:1-10`
**Issue:** Server error shell was added per PERF-02 but D-03 forbids client modules from importing it; all chrome module pages duplicate inline error markup instead. Dead surface area with no consumer.
**Fix:** Either adopt `PageErrorShell` only from server `loading.tsx` / `error.tsx` routes, or document it as a server-only primitive and remove if permanently unused.

### IN-02: Duplicate Tailwind padding utilities on route wrappers

**File:** `app/dashboards/portfolio/page.tsx:6` (also audit, catalog, compliance, pm, periods, tracking, weekly report editors, document-checklist)
**Issue:** Several wrappers specify both `lg:p-6` and `lg:p-8` in the same `mainClassName`. Tailwind applies the last conflicting utility, so `lg:p-6` is dead code and spacing may differ from the intended preserve-existing contract.
**Fix:** Pick one padding token per route (match pre-strip values) and drop the duplicate class.

### IN-03: Incomplete params type on project weekly-report route wrapper

**File:** `app/projects/[id]/weekly-reports/[reportId]/page.tsx:4`
**Issue:** `Props` types `params` as `Promise<{ id: string }>` but the segment also includes `reportId`. Runtime works because the client module reads `reportId` via `useParams`, but the incomplete type hides the dynamic segment from compile-time checks.
**Fix:**
```typescript
type Props = { params: Promise<{ id: string; reportId: string }> };
```

---

_Reviewed: 2026-08-29T02:27:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
