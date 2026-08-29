# Phase 26: RSC Chrome & Cold Start - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Static chrome (layout, nav, KPI shells) on v2 pages renders as Server Components, and cold-start connect time is measured with a recorded budget now that migrate is off the request path.

**Requirements:** PERF-02, PERF-03

**In:**
- Server Component chrome for layout / nav shell / KPI loading shells on v2 module pages
- Keep interactive widgets `'use client'`
- Measure `getDb()` / `getPool()` connect time after migrate-assert (no schema init)
- Record an explicit budget artifact

**Out:**
- Rewriting all dashboard/weekly/document pages to full RSC
- New APM npm packages
- Kysely changes (Phase 25 done)
- Nits / HYG-02 (Phase 27)
- Changing API contracts or auth wrappers

</domain>

<decisions>
## Implementation Decisions

- **D-01:** `app/layout.tsx` stays a Server Component (already is). Add a server `PageChrome` (or equivalent) that owns `min-h-screen bg-slate-50` + main landmark. Do not mark the root layout `'use client'`.
- **D-02:** `components/layout/Sidebar.tsx` stays `'use client'` because it fetches `/api/auth/me`. Do not move session fetch into a client layout. Optional: a thin server wrapper that renders the client Sidebar as a child.
- **D-03:** KPI / page loading shells that are static markup become Server Components. Data-fetching dashboard/weekly/document pages remain client (preserve-existing). No visual redesign (2 font weights).
- **D-04:** Cold-start measurement is a vitest or `tsx` script that times `getPool()`/`getDb()` against TEST_DATABASE_URL (migrate already applied). Record budget in `.planning/phases/26-rsc-chrome-cold-start/COLD-START.md` (p95 target: 2000ms local connect+assert; fail the test if p95 exceeds 5000ms so CI is not flaky).
- **D-05:** No new npm. Isolation none. TDD. No second pool. Do not add `withCpmo` to ops/admin companies.
- **D-06:** UI-SPEC is preserve-existing. Typography: 400 + 600 only.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 26
- `.planning/REQUIREMENTS.md` — PERF-02, PERF-03
- `app/layout.tsx`
- `components/layout/Sidebar.tsx`
- `lib/db.ts` `getDb()` / `getPool()` after Phase 19 cutover
</canonical_refs>

<code_context>
## Existing Code Insights

Root layout is already a Server Component. Most v2 pages are `'use client'` with inline Sidebar. `getDb()` no longer runs schema migrate on cold start.

</code_context>

<specifics>
## Specific Ideas

Grey areas auto-accepted: chrome-only RSC, Sidebar stays client, cold-start budget 2s target / 5s CI fail, no new npm, preserve-existing UI.
</specifics>

<deferred>
## Deferred Ideas

- Nits, Nyquist remainder, operator HYG-02 — Phase 27
- Full RSC data fetching for dashboards
</deferred>
