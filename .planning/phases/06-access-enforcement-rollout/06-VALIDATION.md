---
phase: 6
slug: access-enforcement-rollout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed Phase 1) |
| **Config file** | `vitest.config.ts` (already picks up `app/**/*.test.ts`) |
| **Quick run command** | `node node_modules/vitest/vitest.mjs run lib/http --reporter=json --outputFile=vt.json` |
| **Full suite command** | `node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=vt.json` |
| **Estimated runtime** | ~45 seconds full suite |

**Reporter caveat:** the default vitest reporter is mangled by an RTK shell hook in this
environment and LOOKS like failure. Always use `--reporter=json --outputFile=vt.json`
(repo-relative), parse with node, and `rm vt.json` after. Exit codes are trustworthy.

**Baseline entering Phase 6:** 592 tests, 479 passed, 0 failed, **113 skipped** (DB-gated).
`numPendingTests` must remain exactly 113 (the wrapper-shadow and 401-matrix tests are all mocked,
default tier). A rising skip count hides a stopped suite.

---

## Sampling Rate

- **After every task commit:** run the quick command (`lib/http` or the focused spec) — mocked, no DB, ~5s.
- **After every plan wave:** run the full suite. Passing ≥ prior + new, skipped still 113.
- **Before `/gsd-verify-work`:** full suite green + `npx tsc --noEmit` 0 + `npx eslint` clean on
  changed files.

---

## Per-Plan Verification Map

| Plan | Requirement | Secure Behavior | Test Type | Command |
|------|-------------|-----------------|-----------|---------|
| substrate | ROUTE-08 | `withAuth` shadow flag: `ACCESS_ENFORCEMENT=shadow` + ForbiddenError/NotFoundError → console.error structured line + allow-through; flag off → re-throw to 403/404. Read per-request, not hoisted. | unit | `vitest run lib/http/with-auth` |
| substrate | ROUTE-04 | `opts.rawBody: true` skips auto `req.json()` so a formData/POST route's handler runs (no 400 `Invalid JSON` before the handler) | unit | `vitest run lib/http/with-auth` |
| live-idors | ROUTE-04 | the 8 previously-unprotected routes now 401 without a session (import-mapping, bug-import-mapping, jql-presets, sync-mappings, parse-file-headers, config GET) | unit | table-driven 401 spec |
| live-idors | ROUTE-10 | `[id]` DELETE routes return 401, not anonymous delete, when no session | unit | table-driven 401 spec |
| report-routes | ROUTE-03 | the 3 projects/[id] report routes use withProjectAccess; 401 no session, 403 cross-company project_id | unit | `vitest run app/api/projects/[id]/report` |
| report-routes | ROUTE-09 | 403 cross-company project_id on every projects/[id]/** route (18 existing + 3 new report) | unit | `vitest run app/api/projects/[id]` |
| conversions | ROUTE-03/04 | export/import/config routes convert to wrappers preserving Phase 4-5's existing 401/403 (no new denials) | unit | existing route tests still pass |
| matrix | ROUTE-10 | ONE table-driven spec asserts 401 on every non-public route, drift-checked via glob vs a public/auth skip list | unit | `vitest run` (the 401 spec file) |
| proxy | ROUTE-11 | static + local-prod-runtime proof: empty sortedMiddleware in standalone manifest; curl /portfolio no-cookie → 200 (not 307), proving proxy not dispatched | manual | step below |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `lib/http/with-auth.ts`, `with-project-access.ts`, `with-program-access.ts` — Phase 5
- [x] `assertProjectAccess` returns the row; `assertProgramAccess` returns the row — Phase 5
- [x] `serviceErrorResponse`/`repoErrorResponse` — Phase 4
- [ ] `opts.rawBody` on withAuth — substrate plan
- [ ] `ACCESS_ENFORCEMENT` shadow flag in withAuth catch tail — substrate plan
- [ ] 3 projects/[id] report routes + 3 program routes converted — wants test files

*No new packages, no new DB fixture (all mocked default tier).*

---

## The proxy.ts runtime confirmation (ROUTE-11) — the finding steps

Two-step empirical proof (no deploy needed; standalone is built and present):

1. **Static:** read `.next/standalone/PyCharmMiscProject/pm-tool-b/.next/server/middleware-manifest.json`.
   Confirmed: `{ "middleware": {}, "sortedMiddleware": [], "functions": {} }` — proxy compiles into
   `.next/server/middleware.js` but `sortedMiddleware` is empty, so Next never dispatches it.
   (`functions-config-manifest.json` does NOT list a runnable matcher.) The Next 16.2.4 installed docs
   (`node_modules/next/dist/docs/.../proxy.md`) say either a default export or a named `proxy` is valid —
   so the export name is CORRECT; this is a standalone dispatch gap, not a naming bug. No documented opt-in.
2. **Local prod runtime:** `npm run build && node .next/standalone/.../server.js`, then
   `curl -i localhost:3000/portfolio` with no cookie. proxy live → 307 to `/login?from=/portfolio`.
   Dead → 200 HTML. This is the definitive one-command confirmation.

**Write the finding to `06-PROXY-FINDING.md`** recording: proxy.ts is correctly named for Next 16
(renamed middleware→proxy), compiles, is registered in the functions-config-manifest, but the
standalone dispatch manifest has empty `sortedMiddleware` so it never executes — **route-level
enforcement (Phase 4-6 wrappers) is the only live enforcement line**, and proxy.ts is dead code.

---

## Frozen behavior that must NOT change

- force500 = 1 per report route (the 3 report conversions keep their POST integrationErrorResponse).
- Malformed JSON → 400 'Invalid JSON' (WR-05) — unchanged when a route opts INTO body parse.
- The 18 already-enforcing routes never shadowed (regression guard).
- Table-driven 401 spec errs on the side of: 401 short-circuit before params/body needed
  (withAuth:55-56), so dummy params suffice; formData routes need no body for a 401 row.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shadow-run review (ROUTE-08) | ROUTE-08 | Needs a live DATABASE_URL + deploy with `ACCESS_ENFORCEMENT=shadow` to observe real would-be-denials before enforcing | Operator: deploy shadow, review recorded `console.error` lines in Railway logs, confirm no legitimate denial, then flip to enforce. Recorded in STATE. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or explicit Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Full-suite passing ≥ baseline 479, skipped exactly 113, failures 0
- [ ] Frozen behaviors held (force500, Invalid JSON, 18 routed not shadowed)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
