---
phase: 5
slug: route-thinning-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed Phase 1) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `node node_modules/vitest/vitest.mjs run lib/http --reporter=json --outputFile=vt.json` |
| **Full suite command** | `node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=vt.json` |
| **Estimated runtime** | ~40 seconds full suite |

**Reporter caveat (environment-specific):** the default vitest reporter is mangled by an RTK shell
hook in this environment — it returns unreadable lines with a spurious ESM warning and LOOKS like
failure. Always use `--reporter=json --outputFile=vt.json` (repo-relative), parse with node
(`numTotalTests`, `numPassedTests`, `numFailedTests`, `numPendingTests`), and `rm vt.json` after.
Exit codes are trustworthy; only the human-readable output is lost.

**Baseline entering Phase 5:** 573 tests, 460 passed, 0 failed, **113 skipped**. The 113 skips
are DB-gated suites (`company-scope.repo.test.ts`, Phase 2 repo suites) that correctly skip
without `TEST_DATABASE_URL`. Wrapper and converted-route tests are mocked (vi.hoisted) and run in
the default tier — `numPendingTests` must remain exactly 113; a rising count hides a stopped suite.

---

## Sampling Rate

- **After every task commit:** run the quick command (`lib/http` scope) — wrapper and schema tests
  are mocked, no DB, real signal in ~5s.
- **After every plan wave:** run the full suite. Confirm passing ≥ prior + new, skipped still 113.
- **Before `/gsd-verify-work`:** full suite green + `npx tsc --noEmit` 0 + `npx eslint` clean on
  changed files.
- **Max feedback latency:** ~60s.

---

## Per-Task Verification Map

Task IDs assigned by the planner. This map fixes the requirement → test-type → command contract.

| Plan | Requirement | Secure Behavior | Test Type | Command |
|------|-------------|-----------------|-----------|---------|
| substrate | ROUTE-01 | `withAuth` returns 401 on missing session, 401 on invalid session, and calls the handler with `{ user, actor, params, body }` on a valid session | unit | `vitest run lib/http/with-auth` |
| substrate | ROUTE-02 | `withProjectAccess` returns the project row + actor when authorized, 403 cross-company, 404 missing, admin bypass — and the handler is NOT invoked on denial | unit | `vitest run lib/http` |
| substrate | ROUTE-07 | wrapper maps ForbiddenError→403, NotFoundError→404, ValidationError→400, ConflictError→409, unknown→generic 500 (not String(e)); UnknownColumnError→400-with-columns preserved (T-04-25) | unit | `vitest run lib/http` |
| substrate | ROUTE-05 | a converted handler contains NO getSessionFromRequest, NO actorOf, NO try/catch — only the service call | source grep | `grep -c getSessionFromRequest <converted route>` → 0 |
| project-tree | ROUTE-05 | every converted projects/[id]/** route handler is one service call | grep + unit | `vitest run app/api/projects` |
| project-tree | ROUTE-12 | no `Object.keys(body)` / dynamic column assignment remains in app/api/** | grep | `grep -rE "Object.keys\(body\)" app/api/` → 0 |
| validation | ROUTE-06 | every body-accepting in-scope route validates with safeParse before the service; Zod failure returns the route's pre-existing 400 body (frozen strings) | unit | `vitest run lib/http` + schema suites |
| validation | ROUTE-06 | `'Name required'`, Vietnamese Jira strings, MISSING_DATA/FIELDS bodies preserved byte-identical on schema failure | unit | `vitest run lib/http` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] zod ^4.4.3 — already a dependency (Phase 3)
- [x] `serviceErrorResponse`/`repoErrorResponse` mappers — Phase 4
- [x] `assertProjectAccess`/`assertProgramAccess` — Phase 4
- [ ] `lib/http/` directory — created by the substrate plan
- [ ] `assertProjectAccess` return-row flip + the 4 flipping assertions in `access.unit.test.ts` — the
      hidden contract cost; admin path's wire behavior (404 body) is UNCHANGED, but the unit test
      seam (`mockResolvedValue(undefined)` → resolve a row) must move with the flip

*No framework install and no DB fixture needed for the green path — all mocked.*

---

## The `assertProjectAccess` Return-Row Flip (load-bearing)

The wrapper needs the project row to hand to handlers, but `assertProjectAccess` returns `void`
today. Flipping it to return the row mirrors `assertProgramAccess` and is wire-identical at the
HTTP boundary, BUT it has a hidden unit-test cost:

- The admin early-return (`access.ts:26`, T-04-03 "no ownership query for admin") must now fetch
  the row to return it. The admin path's **wire behavior is unchanged** (admin still gets access,
  missing project still 404s) — but the code path now queries where it didn't.
- `lib/services/access.unit.test.ts` has ~4 assertions that flip (the test currently mocks
  `assertProjectAccess.mockResolvedValue(undefined)` in some places and asserts the admin path
  doesn't query; both change).

**Rule:** the flip changes the internal contract, NOT the wire contract. Tests must be updated in
the SAME commit as the source change (HYG-01: not a behavior change, but keep the test seam honest).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| proxy.ts executes in the deployed standalone runtime (ROUTE-11) | ROUTE-11 | Next standalone bundles the proxy only if Next picks it up at build; local dev proving ≠ deployed confirm. Confirms whether the session gate has a live first line or whether route-level withAuth is the only enforcement | Phase 6: hit a protected API route in the deployed container without a valid `pm_session` cookie; confirm proxy redirects/blocks vs the route's own 401 handling. Record finding. |

---

## Frozen-String Preservation Checks

The wrapper must NOT change these on schema/error paths (behavior freeze):

- `'Name required'` (programs POST) — 400
- Vietnamese Jira strings (`Lỗi kết nối Jira: ...`, the two fields-route 503 variants) — frozen
- `MISSING_DATA` / `MISSING_FIELDS` (report routes) — 400 codes with those exact bodies
- `force500` on the 3 report routes + `validation`-escapes-force500 — wrapper never adds
  `integrationErrorResponse` (those routes keep their own catch)
- `UnknownColumnError` → 400 with column names (T-04-25), never a generic 500/403

---

## Validation Sign-Off

- [ ] All tasks have automated verify or explicit Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 60s
- [ ] Full-suite passing ≥ baseline 460, skipped exactly 113, failures 0
- [ ] Frozen error strings preserved on every touched route
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
