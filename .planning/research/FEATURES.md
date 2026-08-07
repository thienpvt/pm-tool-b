# Feature Research

**Domain:** Layered-architecture refactor + security hardening (brownfield, feature-frozen milestone)
**Researched:** 2026-08-07
**Confidence:** MEDIUM-HIGH (codebase specifics HIGH — direct file reads; general layering/Next.js patterns MEDIUM; proxy.ts edge-runtime specifics LOW-MEDIUM, flagged below)

No PM-tool product features in this document. Everything below is a capability of a named layer (route / service / repository / integration client / cross-cutting), scoped to what "done" means for this refactor milestone per `.planning/PROJECT.md`.

## Table Stakes (must exist or the refactor did not fix the problem)

### Route layer
| Capability | Why required | Complexity | Notes |
|---|---|---|---|
| Thin handler: parse → authorize → call service → respond | Current routes mix SQL, external fetch, and business logic inline (per CONCERNS.md) | LOW per route, HIGH in aggregate (dozens of routes) | No SQL, no `fetch`/SDK call, no business logic left in `route.ts` files |
| Every project/company-scoped route calls the shared tenant guard before touching data | Today `activities`, `risks`, `issues`, `meetings`, `escalations`, `team`, `documents`, `bugs`, `holidays`, `milestones`, import-mapping, export, config routes skip it (CONCERNS.md) | LOW | Not per-file discretion — see Tenant Isolation section |
| Explicit input schema/allowlist at the route boundary | Kills the `Object.keys(body)` dynamic-SQL mass-assignment hole | LOW-MEDIUM | Route validates shape; repository enforces column allowlist (belt + suspenders) |

### Tenant isolation (cross-cutting — the "how does a NEW route become unable to skip it" question)

This is the load-bearing requirement of the whole milestone (PROJECT.md Core Value). Two mechanisms, one table-stakes, one differentiator:

- **Table stakes — shared wrapper, not a copy-pasted snippet.** One function, e.g. `withProjectAccess(handler)`, that loads the project, checks `project.company_id === session.companyId`, and only then invokes the wrapped handler with the already-authorized `project` (and `session`) passed in as arguments. A route file that doesn't call the wrapper has no code path to reach the data — the handler signature itself requires an authorized context to be handed to it. This replaces "call `checkAccess()` and hope every route remembers" with "the data literally isn't reachable without going through the check."
- **Table stakes — regression test suite, not code review alone.** A test asserting 403 on a cross-company `project_id` for every route under `app/api/projects/[id]/**` (already named in PROJECT.md Active requirements). This is the backstop: even if a new route is added and someone forgets the wrapper, the suite fails on that route, not silently in production. Code review catches the wrapper is used; the test proves it actually blocks.
- **Differentiator — structural/lint enforcement.** A custom ESLint rule or a CI grep-check that fails the build if a `route.ts` under a project-scoped path exports a handler not wrapped by the sanctioned helper. Nice because it fails before a PR merges rather than at test time, but the wrapper + test combination is sufficient to call this "done" — don't block the milestone on writing a custom lint rule.
- **proxy.ts is not a substitute for the wrapper.** `proxy.ts` (Next.js 16's renamed `middleware.ts` — confirmed current convention name in the Next.js 16.3 docs) runs at the edge and can cheaply check "does a session cookie exist and is it not expired," but it cannot know which project a nested resource (`/api/projects/[id]/activities/[activityId]`) belongs to without a DB round-trip, and `pg` (node-postgres) is not built for edge runtime — Node's TCP-based Postgres driver generally needs the Node.js runtime, not edge. Recommendation: `proxy.ts` does session-cookie-validity only (satisfies PROJECT.md's "real session validation at the edge, or guaranteed `getSessionFromRequest` on every route"); actual authorization (does *this* user have access to *this* project) stays in the route-layer wrapper, which runs in the Node runtime where `pg` works. Confidence: MEDIUM — Next.js 16's exact edge-runtime constraints for `proxy.ts` with a Node-only DB driver weren't independently re-verified beyond the file-convention rename; treat "can proxy.ts touch the DB" as an open question to confirm against the deployed runtime config, not an assumption to build on.

### Service layer
| Capability | Why required | Complexity | Notes |
|---|---|---|---|
| All business logic lives here, not in route or repository | e.g. "importing a Jira issue also writes an activity + updates sync mapping" is workflow, not CRUD | MEDIUM | This is where the god-page logic that currently lives inline in route handlers goes |
| Service functions take an already-authorized context (`companyId`/`userId`) as a parameter — never re-derive or re-check auth internally | Makes the layering itself part of the isolation guarantee: a service cannot be invoked without a caller that already proved access | LOW | If a service accepted a raw unchecked `projectId` and looked up company internally, you'd be back to per-function trust, not structural guarantee |

Differentiator: a small shared domain-error hierarchy (`NotFoundError`, `ForbiddenError`, `ValidationError`) that the route layer maps to HTTP status uniformly, instead of each route hand-rolling status codes. Improves consistency, doesn't block "done."

### Repository layer
| Capability | Why required | Complexity | Notes |
|---|---|---|---|
| Every project/company-scoped query takes `companyId` as a required parameter and includes it in the WHERE clause | Last line of defense — even if a service-layer bug leaks a wrong ID, the query itself can't cross tenants | LOW-MEDIUM per function | e.g. `getActivity(id, companyId)`, not `getActivity(id)` |
| Explicit column allowlist per write function — no `UPDATE ... SET ${k} = ?` built from `Object.keys(body)` | Directly closes the mass-assignment hole named in CONCERNS.md | LOW-MEDIUM | Each repository write function lists its allowed columns explicitly |
| No raw SQL outside repository files | Routes/services call named repository functions, never `db.query(...)` directly | LOW | Enforced by convention + code review; not worth a lint rule this milestone |

Differentiator: a `withTransaction(fn)` helper for multi-statement writes (e.g. Jira import writing several activities atomically) — add where multi-row consistency actually matters, not on every function.

Explicitly **not** required this milestone: rewriting the `PostgresClient`/`toPositional` SQLite-dialect bridge in `lib/db.ts` itself (PROJECT.md Out of Scope — "fragile but working; touch only where a repository requires it"). Repositories wrap the existing bridge; they don't replace it.

### Integration client layer

Answers "what does a proper external-API client provide" for Jira, Anthropic, Resend.

| Capability | Why required | Complexity | Notes |
|---|---|---|---|
| One module per provider (`lib/integrations/jira.ts`, `anthropic.ts`, `resend.ts`) exporting typed functions | Today each route reinvents auth, parsing, error mapping (INTEGRATIONS.md, PROJECT.md) — no route/service calls `fetch()` or the raw SDK directly | MEDIUM | e.g. `searchJiraIssues(creds, jql): Promise<JiraIssue[]>` |
| Typed request/response — parse external payloads into app-defined types at the boundary | PROJECT.md names this explicitly: "parse/validate Jira responses and Claude output instead of trusting untyped shapes" | MEDIUM | No validation library exists in `package.json` today (checked — no zod/joi/valibot). Either add one lightweight schema lib or hand-write type guards; either satisfies the requirement, adding a dependency is a minor call, not a blocker |
| Uniform error normalization | Jira 401s, Anthropic rate limits, Resend failures currently surface as whatever each route's ad-hoc try/catch produces | MEDIUM | A small set of error types (`IntegrationAuthError`, `IntegrationTimeoutError`, `IntegrationError`) thrown by the client; service layer catches these generically instead of three different shapes |
| Timeout on every outbound call | None of the three currently has one (INTEGRATIONS.md) — an unbounded Jira/Resend `fetch` or Anthropic call can hang a request indefinitely | LOW | `fetch` via `AbortSignal.timeout(ms)`; `@anthropic-ai/sdk` has a built-in `timeout` option |
| Credential resolution happens inside the client (or a shared resolver it calls) — never in the route | Keeps `process.env` / `company_jira_config` access out of route/service code entirely | LOW | See Credential Resolution below |

Differentiator: retry-with-backoff for transient network failures; structured request/response logging with credential redaction. Useful, not blocking.

Explicitly out of scope: adopting an official Jira SDK (none exists for Cloud REST v3 that's a clear upgrade over `fetch`), swapping Resend, or changing how the Anthropic SDK is invoked beyond wrapping it.

### Credential resolution (cross-cutting)

Answers the concrete ask: unify Jira's env-var-name-in-DB pattern and Anthropic's env-then-DB-value pattern.

Current state (from INTEGRATIONS.md):
- **Jira:** `company_jira_config` stores the *names* of env vars (`base_url_var`, `email_var`, `token_var`); runtime does `process.env[name]`. The secret value never enters the DB — only an indirection to which env var holds it.
- **Anthropic:** checks `ANTHROPIC_API_KEY` env first, falls back to a DB `settings.anthropic_api_key` value.

These are two different *shapes* (name-indirection vs value-fallback), and PROJECT.md's own Active requirement is to unify the **resolver interface**, not necessarily the storage shape:

- **Table stakes:** one `resolveCredential(companyId, provider, key)` function that both integrations call, with a defined precedence order — e.g. per-company DB value → per-company DB-referenced env var → global env var → not found (return the existing `NO_API_KEY`/503 pattern Anthropic already uses). Jira keeps storing var-names in `company_jira_config`; Anthropic keeps its value-or-env; the resolver is what's shared, so a third integration added later doesn't invent a third pattern.
- **Table stakes:** the resolver never logs a resolved secret value — only which precedence tier matched ("used company DB config" vs "used global env"), for observability without leaking secrets.
- **Differentiator, explicitly deferred:** encrypting DB-stored secret values at rest / adopting a secrets manager. CONCERNS.md names this as the real fix for Jira's shared-process-env risk ("Recommendations: Encrypt tokens per company or secret manager"), but that's a storage-format change beyond "introduce one resolver interface" — treat as a follow-up milestone, not part of this one's done-bar. Don't let it creep in.

### Testing (cross-cutting, table stakes per PROJECT.md's own constraint: "a layer is not done until it has tests")

| Capability | Why required | Notes |
|---|---|---|
| A test runner exists | Zero test infrastructure today — no runner, no `*.test.*` files (CONCERNS.md, TESTING doc) | Vitest is the standard low-friction pick for a Next.js/TS project — fast, ESM-native, no separate transform config vs Jest. One concrete recommendation, not a menu of options |
| Repository tests verify tenant-scoping and column allowlists reject cross-company access/writes | Proves the last-line-of-defense claim above, not just asserts it | |
| Route-level authorization tests: 403 on cross-company `project_id` across every route under the wrapper | Named explicitly in PROJECT.md Active requirements; this is also the regression backstop for the tenant-isolation question | |
| Integration client tests with mocked Jira/Anthropic/Resend responses | Named explicitly in PROJECT.md; no live network calls in the test suite | |

## Differentiators (worth doing, not blocking "done")

- Structural/lint-level enforcement of the tenant-isolation wrapper (beyond wrapper + test suite)
- Transaction helper in repository layer for multi-statement writes
- Retry/backoff and redacted structured logging in integration clients
- Shared domain-error class hierarchy across services
- Encrypting/rotating stored per-company secrets, adopting a secrets manager

## Anti-Features / Explicitly Out of Scope

Carried directly from PROJECT.md Out of Scope, restated as refactor-scope boundaries so they don't creep back in during implementation:

| Anti-feature | Why avoid this milestone | Instead |
|---|---|---|
| New product features | Milestone is structural; feature set is frozen | Resume feature work next milestone |
| API/UI redesign | Refactor + opportunistic fixes only | Endpoint shapes and screens stay recognizable |
| Stack replacement (Next/React/Postgres/`pg`) | The mess is organization, not technology choice | Reorganize within the existing stack |
| Rewriting `lib/db.ts` PostgresClient dialect bridge | Fragile but working | Repository layer wraps it; touch only where a repo function requires it |
| Perf work (grid virtualization, RSC-ifying chrome) | Follows the UI sweep, isn't part of it | Defer to a later pass |
| Moving migrations out of `getDb()` | Real problem, but not a correctness/isolation risk | Tracked as deferred in PROJECT.md |
| Secrets-manager / encryption-at-rest for credentials | Beyond "unify the resolver interface" | Defer; note as follow-up in Key Decisions |
| Official Jira SDK adoption, swapping Resend | No clear upgrade path exists / not asked for | Keep `fetch`-based clients, just wrap them |

## Feature Dependencies (ordering, maps to PROJECT.md Key Decisions)

```
1. Define target layer structure (route → service → repository, lib/integrations/*)
2. Backend sweep: routes → thin, logic → services        (requires 1)
3. Data sweep: SQL → repositories                          (requires 1; can run alongside 2)
4. Integration sweep: typed clients + unified credential resolver   (requires 1; benefits from 2/3 already having clean service interfaces to call into)
5. Security fixes: tenant-access wrapper, column allowlists, edge session check   (requires 1-3 — the wrapper needs a home in the layer structure, repos already take companyId)
6. Tests — alongside each of 1-5, not appended after (per PROJECT.md Testing constraint)
7. UI sweep — separate full pass after backend layers land (per PROJECT.md decision: "full stack incl. UI... layer-by-layer sweep")
```

This matches PROJECT.md's own stated ordering: "Reorg layers before fixing concerns" and "Security first among concerns" (after the reorg, not before).

## MVP / "Done" Recommendation

Table-stakes bar for calling this refactor done — treat all of these as required, not a pick-list:

1. route → service → repository structure in place for all `app/api/**`; no inline SQL, `fetch`, or SDK calls, or business logic left in route files
2. Every project/company-scoped route enforces tenant access via the one shared wrapper — proven by a cross-company-403 test covering every such route, not spot-checked
3. Column allowlists replace every dynamic `Object.keys(body)` SQL assignment
4. Three integration clients (Jira, Anthropic, Resend) with typed responses, normalized errors, timeouts, and credential resolution through one shared resolver
5. Test runner stood up with coverage for repository, service, route-authorization, and integration-client layers
6. `proxy.ts` confirmed actually running in the deployed environment, performing at minimum session-cookie-validity checking

Defer (explicitly, so they don't get pulled in mid-milestone): encryption/secrets-manager for stored credentials, migrations-out-of-`getDb()`, perf/UI virtualization work, structural lint-level enforcement of the tenant wrapper (the test-based backstop is sufficient for this milestone's done-bar).

## Sources

- `.planning/PROJECT.md` (HIGH — direct read, defines scope and Active/Out-of-Scope requirements)
- `.planning/codebase/CONCERNS.md` (HIGH — direct read, names the specific holes: uneven auth, mass-assignment SQL, edge cookie-presence-only check)
- `.planning/codebase/INTEGRATIONS.md` (HIGH — direct read, current Jira/Anthropic/Resend integration and credential shapes)
- `package.json` (HIGH — direct read, confirms no validation library or test runner currently installed)
- Next.js docs, `proxy.js` file convention reference, version 16.3.0 (MEDIUM — confirms `proxy.ts` is the current Next.js 16 convention name replacing `middleware.ts`; edge-runtime + DB-driver interaction not independently re-verified, flagged as LOW-MEDIUM/open question above)
