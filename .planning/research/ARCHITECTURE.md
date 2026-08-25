# Architecture Research

**Domain:** Layered-architecture refactor of existing Next.js 16 App Router multi-tenant PM/portfolio app
**Researched:** 2026-08-07
**Confidence:** HIGH (layer boundaries, build order, decomposition sequence — derived directly from this codebase's own structure and CONCERNS.md) / MEDIUM (proxy.ts runtime-in-Docker specifics — see note)

## Standard Architecture

### System Overview (target state)

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 client components)                               │
│  app/**/page.tsx (thin container) + components/**                   │
├───────────────────────────────────────────────────────────────────┬─┤
│  proxy.ts (Next 16 — renamed from middleware.ts, same runtime)     │ │
│  Coarse gate: pm_session cookie PRESENCE only, redirects HTML nav  │ │
└───────────────────────────────────────────┬───────────────────────┴─┘
                                             │ fetch('/api/...')
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ROUTE HANDLERS  app/api/**/route.ts                                 │
│  Thin: withAuth(...) wrapper → parse/validate → call service →      │
│  map result/error to NextResponse. NO SQL. NO business logic.       │
└───────────────────────────────────────────┬───────────────────────────┘
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVICES  lib/services/*.service.ts                                 │
│  Business logic + AUTHORIZATION / TENANT SCOPING enforced HERE.     │
│  Takes SessionUser as first arg. Framework-agnostic (no             │
│  NextRequest/NextResponse). Throws typed errors.                    │
└──────────────┬────────────────────────────────────┬─────────────────┘
               ▼                                    ▼
┌───────────────────────────────┐   ┌───────────────────────────────────┐
│  REPOSITORIES                 │   │  INTEGRATIONS                     │
│  lib/repositories/*.repo.ts   │   │  lib/integrations/{jira,anthropic,│
│  Parameterized SQL only.      │   │  resend}/client.ts                │
│  Trusts filters it's given.   │   │  Typed wrappers over external     │
│  No auth, no business rules.  │   │  APIs/SDKs + credential handling  │
└──────────────┬─────────────────┘   └───────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  lib/db.ts — PostgreSQL pool/client primitive (unchanged)            │
└─────────────────────────────────────────────────────────────────────┘
```

**Current state (as-is, confirmed by reading the codebase):** route handlers call `getDb()` and inline raw SQL directly (`app/api/projects/[id]/activities/route.ts` is representative — `UPDATE activities SET ${Object.keys(fields).map(k=>`${k} = ?`))...` is literal mass-assignment). No service or repository layer exists. `lib/` is flat: `auth.ts`, `db.ts`, `rag.ts`, `status-weights.ts`, `utils.ts`, `export/{word,excel,ppt}.ts`. Auth (`getSessionFromRequest`) is called in some routes, not others — this is the target the service layer below is designed to close.

## Layer Boundaries — allowed / forbidden imports

| Layer | May import | Must NOT import |
|---|---|---|
| `app/**/page.tsx`, `components/**` (client) | `@/components/ui/*`, `@/lib/utils`, local hooks, fetch to `/api/*` | `@/lib/db`, `@/lib/repositories/*`, `@/lib/services/*`, `@/lib/integrations/*`, `pg`, any Node-only module |
| `app/api/**/route.ts` | `@/lib/services/*`, `@/lib/http/with-auth`, `@/lib/http/errors` | `@/lib/repositories/*`, `@/lib/db` directly; no inline SQL, ever |
| `@/lib/services/*` | `@/lib/repositories/*`, `@/lib/integrations/*`, session/auth types | `next/server` (`NextRequest`/`NextResponse`) — services are framework-agnostic: take plain args, return plain data, throw typed errors (`ForbiddenError`, `NotFoundError`, `ValidationError`) that the route wrapper maps to status codes |
| `@/lib/repositories/*` | `@/lib/db.ts` only | Services, `NextRequest`, session objects — a repository takes explicit scoping params (`companyId`, `projectId`) already resolved by the caller; it does not decide who is allowed to ask |
| `@/lib/integrations/*` | External SDKs (`@anthropic-ai/sdk`, Jira via `fetch`, Resend SDK), env vars | Repositories directly — if an integration needs a company's Jira credential names, a service fetches them via a repository and hands the resolved value to the integration client |
| `lib/db.ts` | `pg` | Nothing above it — lowest layer, only repositories depend on it |

Enforce mechanically, not just by convention: add an ESLint `no-restricted-imports` rule (project has no build-time boundary tool today — flat `eslint.config.mjs`) so a client component importing `@/lib/db` fails lint, not just review. This is the cheapest available enforcement given the existing toolchain (no monorepo/module-boundary linter installed) — do not add a new dependency for this.

**Why `lib/services` / `lib/repositories`, not `src/server/`:** `tsconfig.json` maps `@/*` → `./*` (project root, no `src/` directory exists anywhere in the tree). Introducing `src/` would mean re-pointing every existing `@/lib/...` and `@/components/...` import or adding a second alias — a bigger structural change than "add layers" and outside what PROJECT.md scopes for this milestone. Reuse the existing `lib/` root; smallest diff that gets real layering.

## Data Flow (including tenant scoping enforcement point)

1. Browser requests a path → `proxy.ts` checks `pm_session` cookie **presence** (not validity), redirects unauthenticated HTML navigation. Public allowlist: `/login`, `/landing`, `/api/auth/`, `/api/health`, `/api/demo-requests`.
2. Client component `fetch('/api/...')` with cookies.
3. Route handler wrapped in `withAuth(...)` calls `getSessionFromRequest(req)` — the **real** check (DB join `sessions`+`users`+`companies`). This catches anything the coarse cookie-presence gate let through (expired/forged cookie shape). 401 here if invalid.
4. Wrapper calls the matching service function, passing the resolved `SessionUser` (`{ id, company_id, is_admin, ... }`) plus validated input — never the raw `NextRequest`.
5. **Service is where tenant scoping/authorization is enforced** — single point: `is_admin` bypasses company scope; otherwise every read/write must filter by `user.company_id` via the project/program's own `company_id`. This is the fix for CONCERNS.md's "auth only on subset of routes" — a service function is the one place `assertProjectAccess(projectId, user)` needs to live, instead of copy-pasted (or missing) per route file.
6. Service calls repository with already-resolved scoping params (`companyId`, `projectId`); repository issues parameterized SQL only — never `Object.keys(body)` interpolated into `SET` clauses (kills the mass-assignment issue at the same time, since a repository's update function takes an explicit typed field list, not an arbitrary object).
7. Repository returns typed rows → service shapes/aggregates → route returns `NextResponse.json(...)`.

Repositories and routes are both "dumb" on purpose: routes just wire HTTP↔service, repositories just wire service↔SQL. The service layer is the only layer allowed to reason about "can this user touch this data."

## Next.js 16: proxy.ts vs middleware.ts (cited)

Confirmed against official Next.js docs (`nextjs.org/docs/app/getting-started/proxy`, and the build-time deprecation-warning doc `nextjs.org/docs/messages/middleware-to-proxy`):

> "Starting with Next.js 16, Middleware is now called Proxy to better reflect its purpose. The functionality remains the same."

> "You are using the `middleware` file convention, which is deprecated and has been renamed to `proxy`."

**HIGH confidence:** the project's `proxy.ts` is the *current* convention, not a legacy leftover — it is the correct Next 16 file. `middleware.ts` would now trigger a build-time deprecation warning. No migration action needed here.

**MEDIUM confidence (deploy-runs-it question):** for this project's actual deploy shape — `next.config.ts` sets `output: 'standalone'`, `Dockerfile` runs `CMD ["node", "server.js"]` on `node:20-slim`, deployed via `railway.json` with `builder: DOCKERFILE` — proxy/middleware code is compiled into the `.next/standalone` server bundle and executes in-process, inside the same single Node.js server that serves every request, for every path matching `proxy.ts`'s `matcher`. There is no separate edge-network hop in this deployment shape that could skip it (that risk is specific to platforms like Vercel, where middleware may run on a distinct edge layer ahead of the origin — not to a self-hosted single-process Docker container). I could not pull the docs' exact "Runtime" section text to cite verbatim (repeated fetches returned a cached/truncated page), so this is stated at MEDIUM rather than HIGH. Cheapest way to close this definitively: add a one-line `console.log('[proxy] hit', pathname)` in `proxy.ts` and check container logs after one request in the actual deploy — a 2-minute empirical check, cheaper than more doc-digging.

**Still-valid, separate finding:** regardless of whether `proxy.ts` runs, it only checks cookie *presence*, not session validity — this gap is closed by the service-layer `getSessionFromRequest` check in step 3 above, not by anything in `proxy.ts` itself. Don't try to "fix" `proxy.ts` to do full session validation; keep it as the coarse UX-redirect gate and let the real check happen server-side where the DB is already reachable.

## Build Order for Layer-by-Layer Sweep

Per PROJECT.md's decided strategy: all backend layers move in one milestone pass (this milestone), UI decomposition is next milestone. Order below is bottom-up by dependency — each step is shippable on its own before the next starts.

**1. Repositories first** (`lib/repositories/*.repo.ts`, one file per resource — mirrors existing `app/api/projects/[id]/{resource}` split: `activities.repo.ts`, `risks.repo.ts`, `budget.repo.ts`, etc.)
- Mechanical extraction: move existing SQL out of `route.ts` files, keep behavior identical (no auth/scoping logic added yet).
- Why first: nothing above it exists to depend on; it's the foundation every later layer calls into. Lowest regression risk of the whole sweep — same queries, same inputs/outputs, just relocated, so it's the easiest step to verify (compare API responses before/after).
- Tests land alongside: repository integration tests against a test DB (per PROJECT.md's "tests land alongside each layer").

**2. Integration clients second** (`lib/integrations/jira/client.ts`, `lib/integrations/anthropic/client.ts`, `lib/integrations/resend/client.ts`)
- Independent of the DB-facing refactor — wraps Jira REST calls (currently inline in `app/api/jira/*/route.ts`, credential lookup via `company_jira_config` table), the Anthropic SDK calls (report/email generation routes), and Resend (transactional email — confirm current send-email routes use it, present in `app/api/portfolio/report/send-email/route.ts` and `app/api/projects/[id]/project-report/generate-email/route.ts`).
- Why second: doesn't depend on repositories, but services (step 3) need both repositories and integration clients ready to compose, so land integrations before services start consuming them.
- Tests: mock the external HTTP/SDK boundary.

**3. Services third** (`lib/services/*.service.ts`)
- Compose repositories + integration clients into service functions, and this is where the missing/uneven tenant-scoping logic (CONCERNS.md's top tech-debt item) actually gets written — net-new code, not extraction, because no service layer exists today.
- Why third, not first: writing services with nothing to call would just recreate today's inline-SQL coupling under a different file name. Depends on steps 1–2 existing.
- Tests: service unit tests with mocked repositories — this is the layer where cross-company access-denied paths get asserted, i.e. where the IDOR fix is actually proven.

**4. Route handlers thinned last** (`app/api/**/route.ts` rewritten to use `lib/http/with-auth.ts` wrapper + call services)
- Delete inline SQL/auth/business logic from every route file; every route now goes through the same `withAuth` wrapper, closing the "auth only on subset of routes" gap for good (not per-file copy-paste, per CONCERNS.md's own stated fix approach).
- Why last: depends on step 3 (services must exist to call) and a small `lib/http/with-auth.ts` + `lib/http/errors.ts` pair (can be written alongside step 3, since services define the error types the wrapper maps to status codes).
- Tests: route-level integration tests hitting the real handler with mocked/faked sessions, asserting 401/403 project-wide — this is where "every route is protected" becomes a regression test instead of a manual audit.

**Why not per-feature:** per-feature would mean each resource (activities, risks, budget...) gets its own repo→service→route slice shipped independently, which is a valid alternative strategy but is explicitly NOT the one PROJECT.md commits to. Layer-by-layer means: all resources' repositories land together, then all integrations, then all services, then all routes — so the codebase is never in a state with e.g. half its resources using the new pattern and half using inline SQL for more than one sweep-step at a time.

**Next milestone (out of scope now, documented since asked):** UI decomposition of `page.tsx` god components depends on stable API contracts from steps 1–4 above — decomposing a 2828-line page against an API surface that's about to change shape underneath it would mean redoing the UI work.

## God Component Decomposition — ordered technique list

For the largest offenders (`app/portfolio/report/page.tsx` ~2828 lines, `app/projects/[id]/timeline/page.tsx` ~1978, `app/projects/[id]/report/page.tsx` ~1426, `app/projects/[id]/milestones/page.tsx` ~1275, `app/portfolio/roadmap/page.tsx` ~1230, `app/page.tsx` ~1064 — confirmed by `wc -l` against the actual files) — apply in this order, next milestone:

1. **Extract data-fetching into a hook.** Pull every `useEffect`/`fetch`/`useState` triplet that loads server data into a colocated hook (e.g. `app/projects/[id]/report/_hooks/use-report-data.ts`) returning `{ data, loading, error, refetch }`. First because it's the biggest mechanical win (fetch/effect boilerplate is repeated per resource in these files) and changes zero UI behavior — safest possible first cut.
2. **Extract dialogs/modals into standalone components.** The codebase already has the right pattern once (`components/timeline/ImportMappingDialog.tsx`, ~1265 lines on its own — extract further, don't just copy its size). Each dialog: receives data + callbacks as props, owns no data-fetching. Second because dialogs are the next-largest self-contained JSX blocks with the clearest prop boundary (open/close + onSubmit).
3. **Extract presentational sub-views** (tables, charts, summary cards) as components taking already-fetched data as props — pure render, no fetch, no mutation. Third, once hooks and dialogs are out, because now what's left is easier to tell apart: interactive-with-state vs. pure display.
4. **Split static/server-renderable chrome into Server Components** (headers, static labels, non-interactive layout) — last, because App Router requires the client boundary (`'use client'`) to start at the first component actually using hooks/state, and that boundary isn't clear until steps 1–3 have isolated the interactive leaves.
5. **Container (`page.tsx` itself) becomes thin:** calls the hook, passes data down, renders dialogs conditionally. Target: well under 200 lines, ideally closer to 100.

Do NOT reorder this: extracting server components before isolating client state (step 4 before 1–3) forces guessing where the `'use client'` boundary belongs and tends to produce a second layer of prop-drilling instead of a real split.

## Target Directory Layout

```
pm-tool-b/
├── app/
│   ├── api/**/route.ts          # thin: withAuth(...) + service call, no SQL
│   └── **/page.tsx              # unchanged this milestone (next milestone: thinned per above)
├── components/                   # unchanged
├── lib/
│   ├── db.ts                     # unchanged — PG pool primitive, repositories-only consumer
│   ├── auth.ts                   # unchanged (session CRUD helpers used by http/with-auth)
│   ├── rag.ts, status-weights.ts, utils.ts   # unchanged (pure helpers)
│   ├── export/{word,excel,ppt}.ts            # unchanged (already isolated document builders)
│   ├── repositories/
│   │   ├── projects.repo.ts
│   │   ├── activities.repo.ts
│   │   ├── risks.repo.ts, issues.repo.ts, budget.repo.ts, ...  # one per resource
│   ├── services/
│   │   ├── projects.service.ts
│   │   ├── activities.service.ts
│   │   ├── ...                   # one per resource; tenant-scoping enforced here
│   ├── integrations/
│   │   ├── jira/client.ts
│   │   ├── anthropic/client.ts
│   │   └── resend/client.ts
│   └── http/
│       ├── with-auth.ts          # higher-order route wrapper
│       └── errors.ts             # typed errors → NextResponse status mapping
├── proxy.ts                       # unchanged — correct Next 16 convention, coarse gate only
├── next.config.ts                 # unchanged: output 'standalone', serverExternalPackages
└── tsconfig.json                  # unchanged: @/* → ./*  (no src/ — do not introduce one)
```

Route handler shape after the sweep (illustrative, matches the pattern CONCERNS.md itself proposes):

```ts
// app/api/projects/[id]/activities/route.ts
import { withAuth } from '@/lib/http/with-auth';
import * as activitiesService from '@/lib/services/activities.service';

export const GET = withAuth(async (req, { params }, user) => {
  const { id } = await params;
  return NextResponse.json(await activitiesService.list(user, id));
});

export const POST = withAuth(async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();
  return NextResponse.json(await activitiesService.create(user, id, body), { status: 201 });
});
```

`withAuth` resolves the session, 401s on missing/invalid, and catches thrown service errors (`ForbiddenError`→403, `NotFoundError`→404, `ValidationError`→400, anything else → generic 500 message — not `String(e)`, which the current codebase does and which leaks stack/message text per CONCERNS.md).

## Anti-Patterns to Avoid

- **Don't put SQL back in route handlers "just this once."** The whole point of the sweep is one place (`repositories/`) that speaks SQL. A single exception reopens the mass-assignment / inconsistent-auth problem the reorg exists to close.
- **Don't let services import `NextRequest`/`NextResponse`.** The moment a service reaches into the request object, it stops being testable without an HTTP mock and the layer boundary is gone in practice even if the folder exists.
- **Don't introduce `src/` to "do it properly."** `@/*` already resolves from repo root; adding a `src/` tree is a separate, larger migration than what PROJECT.md scopes, and doubles the import-path churn for no behavior gain this milestone.
- **Don't decompose god pages before the API layer stabilizes.** UI decomposition depends on the new service contracts existing; doing it first means redoing the split once the API shape changes.
- **Don't try to make `proxy.ts` do full session validation.** It has no easy DB access pattern established for edge-style code in this repo, and the real check already exists (`getSessionFromRequest`) — duplicating it at the edge is bug-surface, not security gain, and it's the SERVICE/wrapper layer that must own tenant scoping, not the proxy gate.

## Sources

- `nextjs.org/docs/app/getting-started/proxy` (official docs, fetched 2026-08-07) — confirms proxy.ts is the Next 16 rename of middleware.ts, functionality unchanged. HIGH confidence.
- `nextjs.org/docs/messages/middleware-to-proxy` (official deprecation-warning doc, fetched 2026-08-07) — confirms `middleware.ts` is deprecated in Next 16. HIGH confidence.
- Deploy-runtime inference (proxy runs in-process for this project's Docker/standalone setup) — MEDIUM confidence; based on reading this repo's `next.config.ts`, `Dockerfile`, `railway.json` plus general Next.js self-hosting behavior, not a directly-quoted docs passage (repeated fetch attempts returned a cached/truncated page). Recommend empirical log-line verification in the actual deploy target.
- This repo's own `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONCERNS.md` (analysis date 2026-08-07) — source for current-state layer/file facts.
- Direct reads of `app/api/projects/route.ts`, `app/api/projects/[id]/activities/route.ts`, `app/api/jira/search/route.ts`, `proxy.ts`, `lib/auth.ts`, `next.config.ts`, `Dockerfile`, `railway.json`, `tsconfig.json`, `package.json` — HIGH confidence (primary source, this codebase).
- `wc -l` over `app/**/page.tsx` — HIGH confidence (directly measured), confirms/refines CONCERNS.md line counts.

---
*Architecture research for: layered-architecture refactor (route → service → repository + integration clients), Next.js 16 App Router*
*Researched: 2026-08-07*
