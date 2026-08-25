# Pitfalls Research

**Domain:** Layer-by-layer refactor + security hardening of a zero-test-coverage, multi-tenant Next.js 16 App Router app
**Researched:** 2026-08-07
**Confidence:** MEDIUM (established refactor/security engineering patterns, cross-checked against this codebase's actual CONCERNS.md findings; no live-web corroboration available this run — treat as informed synthesis, not vendor-documented)

## Critical Pitfalls

### Pitfall 1: Authorization rollout breaks legitimate callers silently (403 storm)

**What goes wrong:**
`requireUser` + `assertProjectAccess` gets added uniformly to the 15 previously-unauthed routes (`activities`, `risks`, `issues`, `meetings`, `escalations`, `team`, `documents`, `bugs`, `holidays`, `milestones`, `import-mapping`, `export/*`, `config`, `parse-file-headers`). Some of these are called from contexts the fix didn't anticipate: a server-to-server export job, a stale client that doesn't send the session cookie, a `fetch` from a god-page component that forgot `credentials: 'include'`, or a nested component that calls the API with a `project_id` the current user's company doesn't own because of a stale cached list. All of these now 403 instead of the previous silent success — and because there's no test suite and no monitoring, the first sign is a support ticket, not a CI failure.

**Why it happens:** Uneven auth was uneven precisely because nobody traced every caller of every route before this milestone. Adding the check is easy; enumerating every client call site (React components, other server routes calling internal APIs, background export/report generation, Jira sync jobs) is the part that gets skipped under time pressure.

**Prevention:**
- Before flipping any route from unauthed to authed, grep every caller: `grep -rn "/api/projects/\[id\]/activities" app/ components/` (repeat per route) to find every `fetch(...)` call site and confirm `credentials: 'include'` is present.
- Land auth changes in shadow mode first: compute `assertProjectAccess` result and log a warning on would-be-403 without blocking, for one deploy cycle, then flip to enforcing. This is one `if (shadowMode) { log; return next() }` branch — cheap, and it turns "who breaks" into a grep-able log line before it turns into a ticket.
- Route-level authorization tests (already in scope per PROJECT.md) must include the "authed user, wrong company" case — that's the one this refactor is actually protecting against, not just "no session at all."

**Detection:** Watch server logs for a 403 spike immediately after each route's auth lands. If shadow-mode logging is skipped, at minimum grep every route being touched for its client call sites before merging, not after.

**Phase:** Security sweep, per-route as it's authed. Shadow-mode logging is worth building once and reusing across all 15 routes, not per-file.

---

### Pitfall 2: Allowlist migration silently drops a field that used to persist

**What goes wrong:** Replacing `UPDATE ... SET ${Object.keys(body).join(...)} = ?` with an explicit column allowlist is the correct fix for the mass-assignment hole, but the allowlist is built by reading the route code, not by reading what the UI actually sends. If the allowlist misses a field the client sends (a legitimate one, not an attack), that field now silently stops persisting. No error is thrown — `UPDATE` still succeeds, just with fewer columns set. The PATCH/PUT returns 200, the UI thinks the save worked, and the field quietly stops updating. This is worse than a crash because nothing signals it.

**Why it happens:** The allowlist gets derived from what the developer *thinks* the schema/route contract is, not from an exhaustive trace of every caller. `activities`, `risks`, `issues`, `meetings`, `team`, `escalations` each have their own field set and their own god-page UI sending it; a field added ad-hoc six months ago by a previous dev is easy to miss.

**Prevention:**
- Derive each allowlist from the DB schema for that table (`information_schema.columns` or the migration files in `lib/db.ts`), not from re-reading the handler. The schema is the ground truth for what's a legitimate column; the handler was already proven untrustworthy.
- Before replacing a route's `Object.keys(body)` logic, grep every place that PATCHes/PUTs to it (`grep -rn "fetch(\`/api/projects/\${.*}/activities" components/ app/`) and diff the fields sent against the new allowlist. Any sent field not in the allowlist is either dead code (fine) or a silent-drop bug waiting to happen (fix the allowlist).
- Add one assertion in the repository/service layer during the swap: log (not throw, to avoid breaking the request) any request body key that isn't in the allowlist and isn't already known-dead. Run this in shadow mode for a deploy cycle before trusting the allowlist is complete. This is the same shadow-mode idea as Pitfall 1, cheap to build once and reuse.
- Write the "field persists" test *before* swapping the SQL: PATCH with each allowlisted field, re-GET, assert the value stuck. This is the concrete alongside-test for this pitfall specifically — a green test on the old dynamic-SQL code, still green after the allowlist swap, is the actual proof nothing silently dropped.

**Detection:** Diff allowlist columns against `information_schema.columns` for that table. Diff allowlist columns against every field name found in the UI's request bodies for that endpoint. A mismatch in either direction is the warning sign — before the mismatch, not after a user reports "my notes field stopped saving."

**Phase:** Data sweep (repositories), one resource at a time — `activities`, `risks`, `issues`, `meetings`, `team`, `escalations`. Do the schema-diff and UI-field-diff check per resource, not once for all of them, since each has a different field set.

---

### Pitfall 3: Regressions escape because the "test alongside" discipline gets skipped under time pressure on the layer that's mid-move

**What goes wrong:** The decision to write tests alongside each layer (not a pre-built safety net) is right given the churn — but it has one specific failure mode: a layer gets moved, the test for it gets deferred "just for this one route, I'll add it after," and that route is the one with the regression. Because there's no pre-existing safety net and no CI gate forcing test-before-merge, "alongside" silently degrades to "sometimes after" under any deadline pressure, and the untested route is statistically the one most likely to have been rushed — which is also the one most likely to have a bug.

**Why it happens:** Zero coverage means there's no habit or tooling forcing the discipline. "Tests alongside" is a process commitment, not a mechanical gate, and process commitments erode first when nobody's watching.

**Prevention:**
- Make the gate mechanical, not habitual: each phase plan for a layer should list the specific routes/repositories moving in that phase, and each one gets a checkbox for "test written" next to "code moved" — don't check off the layer as done if any route lacks its test. This turns the discipline into a per-phase completion criterion instead of a vibe.
- For routes moving in the security sweep specifically, the test that matters most is cheap and the same every time: authed-wrong-company → 403. Write that one first, for every route, before more elaborate tests. It directly proves the pitfall this milestone exists to fix.
- Since there's no CI test runner yet, standing up the runner (Vitest, per STACK.md's Next/React/TS-strict fit) is itself gating — no layer work should start until `npm test` exists and runs in CI, even with zero tests initially, so the first test written per layer is enforced by a pipeline, not memory.

**Detection:** Per-phase, count routes/repos moved vs. tests added. A layer phase that moves N routes and adds fewer than N corresponding test files is the warning sign — check this at phase completion, not at milestone completion when it's too late to trace which specific move was untested.

**Phase:** Applies to every backend/data/integration layer phase. The mechanical gate (checklist parity) belongs in each phase's plan and success criteria, not as a separate phase.

---

### Pitfall 4: Multi-tenant scoping survives single-resource routes but leaks in aggregates, exports, and joins

**What goes wrong:** `assertProjectAccess(projectId, user)` fixes the single-project routes. But the codebase has cross-project surfaces that don't take a single `project_id`: portfolio report (`app/api/portfolio/report/route.ts`, ~792 lines aggregating multiple projects), portfolio roadmap/home views, Excel/PPT/Word export, and the AI report generation that stuffs "full portfolio context" into a prompt. These pull data by company_id filter (or worse, by an implicit "all projects the query happens to join") rather than by an explicit per-project access check, and it's easy for a refactor to preserve the *shape* of a query while losing a `WHERE company_id = ?` clause that was doing the isolation work — especially once the query moves from an inline route handler into a repository method that gets reused elsewhere with different assumptions.

**Why it happens:** Single-resource CRUD access checks are the obvious, well-lit case. Aggregate queries are typically written once, work, and never get an explicit tenant-boundary test because "it's just for the report page" — until the repository method gets reused by an export route or a second report variant that doesn't apply the same filter.

**Prevention:**
- Every repository method that returns cross-project or cross-company data must take a `companyId` parameter and apply it in the query, not rely on the caller having already filtered. Grep for repository methods that take `projectIds: string[]` or no tenant param at all and audit each one.
- For the portfolio report, roadmap, and export paths specifically, write the test as "user from company A cannot see company B's project in the aggregate result" — not just "the report renders." This is a different test than the single-resource 403 test and needs to exist separately.
- AI report generation prompts: verify the prompt-building code pulls project/portfolio data through the same company-scoped repository methods, not a separate ad-hoc query built for the LLM context — a second, unscoped data path is exactly how this leaks.

**Detection:** Grep every repository/service method for a `companyId`/`company_id` parameter; any aggregate-returning method without one is a candidate for a review, not an assumption that it's fine. Cross-tenant integration test (company A user, company B project ID or company B aggregate) is the concrete check — the single-resource 403 test from Pitfall 1 does not cover this case.

**Phase:** Data sweep (repositories) for the query-level fix; integration/route layer for the cross-tenant test. Flag explicitly for the portfolio report, roadmap, and export phases — these are the routes CONCERNS.md already calls out as large aggregation surfaces, and they're the ones least likely to be covered by the straightforward per-project auth fix.

---

### Pitfall 5: "Opportunistic bug fixes during refactor" makes regressions un-bisectable

**What goes wrong:** The project explicitly allows fixing bugs found while moving code, not just moving code unchanged. This is reasonable — but it means a single commit/phase can contain both a structural move (route → service → repository) and a behavior change (a bug fix), so when something breaks in production three weeks later, `git bisect` lands on a commit that did two different things, and it's not obvious which one caused the regression. Without tests proving the old behavior first, there's also no way to tell, after the fact, whether the "bug fix" was actually correct or was itself the regression.

**Why it happens:** It's natural to fix a bug the moment you notice it while your hands are already in that code. Separating "move" from "fix" into different commits takes discipline that has no automatic enforcement.

**Prevention:**
- Structural commit and behavior-fix commit must be separate, even within the same phase/PR: "move activities route logic into ActivityService, no behavior change" as one commit, "fix: activities PATCH now validates due_date is a real date (was previously accepting garbage)" as a second commit. This costs nothing extra and makes bisection possible later.
- Any opportunistic fix needs a one-line note in the phase's changelog/PR description naming the specific behavior change, separate from the "moved X to Y" summary — so six months from now, "did we change behavior here" is answerable by reading the PR description, not by re-deriving it from a diff.
- Write the test for the *old* behavior first if practical (even if it's about to be deleted or changed) — a failing test that demonstrates the bug is itself useful documentation of what changed and why, and doubles as the regression test for the fix.

**Detection:** Review each phase's commits before merging: does any single commit both move code and change an `if`/comparison/validation? If yes, split it. This is a review-time check, not a runtime one — catch it before merge, since after merge the bisect problem is already baked in.

**Phase:** Every phase, as a working convention rather than a phase of its own — worth stating explicitly in each phase's plan so it's not relearned per-phase.

---

## Moderate Pitfalls

### Pitfall 6: God-component decomposition introduces stale-closure and effect-ordering bugs

**What goes wrong:** Splitting `app/portfolio/report/page.tsx` (~2828 lines) into hooks + presentational components is exactly the kind of change that looks mechanically safe and isn't. Common failure modes specific to this extraction:
- A `useEffect` that referenced a variable from the enclosing component's scope gets moved into a custom hook, but the dependency array isn't updated to match — the effect now runs with a stale value or runs at the wrong time relative to sibling effects that used to be co-located and implicitly ordered by their position in one component.
- State that was implicitly batched because multiple `setState` calls lived in one handler in the god component gets split across two hooks; if the calls end up in different effects/handlers, React may render an intermediate inconsistent state that never existed before (e.g., a table shows a project without its just-updated budget for one paint).
- Callbacks passed down to newly-extracted child components close over an outdated version of `projectId` or `filters` if the extraction didn't thread the current value through props/deps correctly — this is invisible until a user navigates without a full page reload (SPA nav) and sees data from the previous project.

**Prevention:**
- Extract one hook at a time, not the whole component at once; after each extraction, manually exercise the specific interaction that hook's state affects (filter change, dialog open/close, export click) before moving to the next hook.
- When moving a `useEffect`, copy the dependency array verbatim first, then run `eslint-plugin-react-hooks`'s `exhaustive-deps` rule (should already be enabled given TS-strict/React 19 stack — verify in `.eslintrc`) and resolve every new warning explicitly rather than suppressing it.
- Write the alongside-test for extracted hooks as a rendering/interaction test (React Testing Library), not just a unit test of the hook in isolation — the bug class here is about *composition* of hooks and effects, which a hook-in-isolation test won't catch.

**Detection:** After each hook extraction, click through the specific feature (filter, sort, export, dialog) manually once, and check the ESLint `exhaustive-deps` warnings diff before/after the extraction — new warnings are the signal.

**Phase:** UI sweep, per god-page, per hook extracted within that page.

---

### Pitfall 7: Unified credential resolver breaks a live tenant's Jira or Anthropic access during the swap

**What goes wrong:** Jira currently stores env-var *names* per company (`company_jira_config`) and reads `process.env[name]`; Anthropic resolves env-then-DB `settings`. Unifying these into one resolver means every company's existing config row needs to map cleanly onto the new resolver's expected shape. If company A's Jira config points at an env var name that doesn't exist under the new resolver's naming convention, or a company relying on the Anthropic env-fallback loses that fallback because the new resolver checks DB first, that company's integration silently breaks — Jira import stops working, or AI report generation starts failing, with no code error, just wrong-or-missing credentials.

**Why it happens:** The old patterns diverged because they were built independently; unifying them means picking one precedence order (env-first vs DB-first) and one lookup convention, and that choice is not neutral — it changes behavior for at least one of the two integrations' existing companies.

**Prevention:**
- Before writing the unified resolver, enumerate every existing company row in `company_jira_config` and every company's `settings` row with `anthropic_api_key` (or its absence) — know the actual current state, not the assumed state.
- Design the resolver to check both the old and new lookup paths during a transition window (old Jira env-var-name pattern AND new pattern; env-then-DB for Anthropic preserved as-is unless there's a reason to change precedence) rather than a hard cutover — this is a backward-compatible resolver, not a migration that requires updating every company's config row in lockstep with the code deploy.
- Add an integration client test (already in scope) that specifically exercises "company has old-style Jira config" alongside "company has new-style config" — both paths need coverage, not just the new shape.

**Detection:** Before deploy, run the new resolver against every existing company config row (a script, not a manual check) and confirm each resolves to a non-null credential matching what the old code would have resolved. Any company where old and new resolvers disagree is a blocker, not a follow-up.

**Phase:** Integration sweep, specifically the "unified credential resolution" work item — do the resolver design and the audit-existing-rows step together, before merging, not as a hotfix after a company reports broken Jira sync.

---

### Pitfall 8: Contract validation at Jira/Anthropic boundaries changes behavior for shapes the old ad-hoc parsing tolerated

**What goes wrong:** Adding typed parsing/validation for Jira field responses and Claude output (currently parsed ad-hoc per route) is good practice, but ad-hoc parsing is often accidentally lenient — it might ignore an unexpected null, coerce a missing field to `undefined` and move on, or only read the two fields it cares about and ignore the rest of the payload's shape. A strict schema validator (zod or similar) introduced now will reject payloads the old code silently tolerated, turning a previously-invisible edge case (a Jira custom field that's sometimes absent, a Claude response that occasionally omits a section) into a thrown validation error and a 500.

**Prevention:**
- Before writing the schema, log/capture a sample of real Jira and Claude responses (from actual usage, not just the happy-path docs) and validate the schema against those samples first — the schema should describe what actually comes back, including the messy edge cases, not the idealized shape.
- Make new fields/sections optional by default in the schema unless there's a specific reason a route requires them; strict-required is the thing that turns "field sometimes missing" into a hard failure.
- Wrap the new validation in a "log and fall back to old ad-hoc behavior" mode for one deploy cycle if this integration is used interactively (Jira import) — same shadow-mode idea as Pitfall 1/2, applied to schema validation instead of authz.

**Detection:** Run the new schema against a batch of captured real responses before shipping; any that fail are either genuine bugs to fix upstream or schema gaps to widen — decide which before merging, not after a customer's import breaks.

**Phase:** Integration sweep, per external client (Jira, Anthropic) as its typed contract is added.

---

## Minor Pitfalls

### Pitfall 9: Route thinning ("parse → authorize → call service → respond") hides a forgotten authorize step

**What goes wrong:** Once routes follow a uniform thin shape, it's easy to copy a route file as a template for a new one and forget the authorize line specifically — because the shape looks complete (parse, call service, respond) even with authorize missing, unlike today where a missing check is more visually obvious in a longer handler.

**Prevention:** Make `assertProjectAccess` part of the service call signature, not a separate line the route author can skip — e.g., the service methods that touch project-scoped data take `(user, projectId, ...)` and internally assert access, rather than trusting the route already checked. This makes the check structurally required rather than a convention to remember.

**Phase:** Backend sweep, as the layer boundary itself is being defined — bake this into the service-layer contract from the first service written, not retrofitted later.

---

### Pitfall 10: Default seed credentials get carried into the refactored auth layer unchanged

**What goes wrong:** `lib/db.ts`'s `seedAuthData` hardcodes `admin`/`Khang@19` and `ct_user1`/`Ctech@26`. A refactor that moves auth into a service layer can easily preserve this seed logic verbatim (it's "working," so it's low on the list to touch) and ship the same default credentials in the new structure.

**Prevention:** When auth moves into its service/repository, treat the seed credentials as in-scope for the security-first priority — require a forced password change or env-supplied seed password rather than a hardcoded literal, even though this wasn't explicitly called out as a separate work item.

**Phase:** Security sweep, bundled with the auth-related route work since it's the same file/area (`lib/auth.ts`/`lib/db.ts`) already being touched.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|-----------------|------------|
| Security sweep (auth on all routes) | 403 storm from forgotten client call sites (#1) | Shadow-mode logging before enforcing; grep every caller per route before flipping |
| Security sweep (allowlist SQL) | Silent field-drop (#2) | Derive allowlist from schema, not handler; diff against every UI-sent field; persist-and-reread test before swap |
| Every backend/data layer phase | Test-alongside discipline erodes under pressure (#3) | Mechanical per-phase checklist: routes moved == tests added; stand up runner before any layer work |
| Data sweep — portfolio/report/export/roadmap repos | Tenant scoping lost in aggregates (#4) | Repository methods require `companyId` param; explicit cross-tenant aggregate test, separate from single-resource 403 test |
| Every phase | Refactor+fix commits un-bisectable (#5) | Separate "move" and "fix" commits; note behavior changes explicitly in PR description |
| UI sweep — each god page | Stale closures / effect ordering from hook extraction (#6) | One hook at a time; `exhaustive-deps` lint diff; manual interaction check per extraction |
| Integration sweep — credential resolver | Live tenant Jira/Anthropic breakage (#7) | Audit existing company config rows before merge; resolver supports old+new shapes during transition |
| Integration sweep — Jira/Anthropic typed contracts | Strict schema rejects previously-tolerated shapes (#8) | Validate schema against captured real responses first; optional-by-default fields; shadow-mode fallback |
| Backend sweep — service layer design | Authorize step forgotten in new thin-route template (#9) | Bake `assertProjectAccess` into service method signature, not route-level convention |
| Security sweep — auth service move | Default seed credentials carried forward (#10) | Force password change or env-supplied seed value when auth code is touched |

## Sources

- `.planning/PROJECT.md` — decisions, constraints, requirement list (this milestone's actual scope and rationale)
- `.planning/codebase/CONCERNS.md` — file-level specifics: uneven auth, dynamic SQL columns, god pages with line counts, Jira credential pattern, portfolio report aggregation size
- `.planning/codebase/TESTING.md` — zero-coverage baseline
- `.planning/codebase/CONVENTIONS.md` — client fetch/credentials pattern (`pm_session` cookie)
- `.planning/codebase/INTEGRATIONS.md` — Anthropic/Jira credential resolution split
- General synthesis from established refactor/security engineering practice (strangler-fig migration, shadow-mode rollout for authorization changes, allowlist-migration silent-drop failure mode, React hook-extraction closure/effect-ordering bug class). Web search tooling returned no results this session — these are cross-checked against the project's own CONCERNS.md findings rather than externally sourced citations; treat as MEDIUM confidence and validate against team experience where possible.
