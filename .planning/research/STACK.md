# Technology Stack

**Project:** PM Tool B — Layer Reorg & Hardening
**Researched:** 2026-08-07

## Recommended Stack

### Core Framework

No changes. Next.js `16.2.4`, React `19.2.4`, TypeScript strict, `pg` `^8.20.0`, npm are fixed per PROJECT.md constraints. This research covers additions only.

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `vitest` | `^4.1.10` | Test runner | Native ESM/TS, no transpile step, fast watch mode. Official Next.js 16 testing guide (nextjs.org/docs/app/guides/testing/vitest, updated 2026-02-11) recommends Vitest + RTL for App Router. Runs plain TS (services/repos) and route handlers with zero config beyond `vitest.config.ts`. |
| `@vitejs/plugin-react` | `^5.0.1` | JSX/TSX transform for Vitest | Required so Vitest can compile `.tsx` component tests; pulled straight from the official Next.js `with-vitest` example. |
| `jsdom` | `^26.1.0` | DOM environment for component tests | Vitest needs a DOM to render React components outside a browser. |
| `@testing-library/react` | `^16.3.2` | Component testing | peerDeps confirm `react`/`react-dom` `^18.0.0 \|\| ^19.0.0` — React 19 compatible. Standard RTL API (render, screen, user-event) needs no adaptation for React 19. |
| `@testing-library/jest-dom` | `^6.x` | DOM matchers (`toBeVisible`, etc.) | Standard RTL companion; makes component assertions readable. |

**What this does NOT need:** `node-mocks-http`. App Router route handlers (`route.ts`) take a Web-standard `Request`/`NextRequest` and return `Response`/`NextResponse` — the same objects available in Node 20+ and in Vitest's environment. Test a route handler by constructing a `NextRequest` directly and calling the exported `GET`/`POST`/`PUT`/`DELETE` function — no server, no mock library:

```typescript
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/projects/[id]/activities/route';

const req = new NextRequest('http://localhost/api/projects/1/activities');
const res = await GET(req, { params: Promise.resolve({ id: '1' }) });
expect(res.status).toBe(200);
```

`node-mocks-http` mocks legacy Node `http.IncomingMessage`/`ServerResponse` (Pages API / Express shape) — the wrong abstraction for App Router and an unneeded dependency.

**Known limitation (from official Next.js docs, confirmed 2026-02-11):** Vitest cannot unit-test `async` Server Components. Not a concern for this refactor's targets (route handlers, services, repositories, and client components are all synchronous or already tested via direct function calls) — flag it only if the roadmap later wants to unit-test an `async` page/layout component; use Playwright/E2E for those instead.

All of the above are **dev dependencies only** — no impact on the Docker image or `output: 'standalone'` build.

### Runtime Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `zod` | `^4.4.3` (v4 line) | Schema validation at external boundaries | Already a transitive peer dependency of `@anthropic-ai/sdk` (`^0.92.0`, confirmed in `package-lock.json`: `"zod": "^3.25.0 \|\| ^4.0.0"`) — adding it as a direct dependency introduces zero new transitive risk and lets request-body/Jira-response/Anthropic-output schemas share one library end to end. v4's core was rewritten for performance and has the best TypeScript-strict inference of the mainstream validators. |

**Where to apply it in this refactor:**
- **Request bodies** — replace `body.phase ?? 'General'` fallback chains (see `app/api/projects/[id]/activities/route.ts`) with a `z.object({...})` parsed once per route; reject with 400 instead of silently coercing `undefined` into a default.
- **Jira Cloud REST responses** — the codebase currently trusts untyped JSON from `fetch()`; a `z.object({...}).passthrough()` schema at the integration boundary turns a shape-drift 500 (or worse, a silent wrong value written to the DB) into an explicit, loggable validation error.
- **Anthropic model output** — when the report/email generation code parses JSON out of a Claude response, validate it with Zod before using it, instead of trusting the model's JSON to match the expected shape.

**Not recommended: Valibot or ArkType.** Both are smaller/faster in micro-benchmarks, but this is a server-rendered Next.js app in `standalone` output — client bundle size from a validation library isn't the bottleneck, and Zod's larger ecosystem (Anthropic SDK already depends on it, most `zod-to-json-schema`-style tool-schema helpers assume it) outweighs the marginal runtime win. Switching would mean maintaining two mental models for schemas with no offsetting benefit here.

**Runtime dependency** — ships in the Docker image, used at request-handling time, not just dev/test.

### Typed Data Access (optional, scoped)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Column allowlist pattern (no new dependency) | — | Safe dynamic `UPDATE ... SET` | The minimum fix for the `Object.keys(body)` → `SET ${col} = ?` pattern (seen in `app/api/projects/[id]/activities/route.ts` and ~4 sibling routes) is a `const ALLOWED_FIELDS = ['phase', 'no', ...] as const` per repository, filtering `Object.keys(fields)` against it before building the `SET` clause. Zero new dependency, closes the SQL-injection-via-column-name / mass-assignment hole in one line per repo. This is the required minimum regardless of whether a query builder is adopted. |
| `kysely` | `^0.29.4` | Optional type-safe query builder for **new/refactored** repositories | Kysely's `PostgresDialect` wraps an existing `pg.Pool` directly — no new connection layer, no schema-migration ownership, and it does not touch the existing `lib/db.ts` `PostgresClient` bridge (explicitly out of scope to rewrite per PROJECT.md). A repository migrated to Kysely bypasses `DbClient.run()`/`.get()`/`.all()` entirely and queries `pool` directly through Kysely's typed builder — so it's additive, not a replacement of the fragile bridge. Column allowlisting becomes compile-time (a typo'd or removed column fails to build) rather than only a runtime array check. |

**Recommendation:** Do the allowlist fix everywhere as part of this milestone regardless (it's the actual vulnerability). Adopt Kysely only for repositories being freshly written or substantially rewritten during the layer reorg — do not do a big-bang migration of every existing query, since `lib/db.ts`'s SQLite-style `?` placeholder translation is explicitly marked "touch only where a repository requires it." Let the roadmap decide per-phase whether a given repository's rewrite is substantial enough to justify introducing Kysely there, versus just adding the allowlist to the existing `db.run()` call.

**Not recommended: Drizzle, Prisma, or any schema-first ORM.** All three want to own migrations and the connection pool, which conflicts directly with the constraint to keep `pg` and not rewrite the existing bridge. Kysely was chosen specifically because it can layer onto an existing `pg.Pool` without taking over schema ownership.

**Runtime dependency if adopted** — Kysely ships in the Docker image (it generates and executes SQL at request time, not just at build time).

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Test runner | Vitest | Jest | Jest needs `ts-jest`/Babel transform config and is slower under watch mode; Next.js's own 2026 docs recommend Vitest first for App Router, no added value switching. |
| Component testing | React Testing Library | Enzyme | Enzyme has no React 19 adapter and is effectively unmaintained for concurrent-mode React; RTL is the only viable option for React 19. |
| Validation | Zod v4 | Valibot / ArkType | Faster/smaller, but no ecosystem overlap with the already-installed `@anthropic-ai/sdk` peer dependency, and bundle size isn't a constraint server-side. |
| Data access | Kysely (scoped) | Drizzle ORM | Drizzle wants to own the schema/migrations and typically its own driver wrapper — conflicts with "don't rewrite `lib/db.ts`" and "don't replace `pg`." |
| Data access | Kysely (scoped) | Prisma | Prisma requires its own generated client and schema file as source of truth, and a different connection model entirely — much bigger footprint than "safe column allowlisting" calls for. |

## What NOT to Use

- **`node-mocks-http`** — wrong abstraction for App Router (`Request`/`Response`, not `http.IncomingMessage`). Adds a dependency for something the platform already gives you for free.
- **Enzyme** — no React 19 support.
- **Prisma / Drizzle** — schema-first ORMs that would require owning migrations and replacing the connection layer; directly contradicts PROJECT.md's "Replacing the stack" and "Rewriting `lib/db.ts`" out-of-scope items.
- **A big-bang Kysely migration of every repository** — unnecessary churn against a bridge that's explicitly marked "fragile but working, touch only where a repository requires it." Adopt it repository-by-repository, only where the refactor already requires rewriting that repository.

## Installation

```bash
# Testing (dev only)
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom

# Runtime validation
npm install zod

# Optional, scoped data access (only if a phase adopts it)
npm install kysely
```

## Version Compatibility Notes

- `@testing-library/react@16.3.2` peer-depends on `react`/`react-dom` `^18.0.0 || ^19.0.0` — confirmed compatible with the project's React `19.2.4`.
- `zod` is already present transitively via `@anthropic-ai/sdk@^0.92.0` (`package-lock.json` shows `"zod": "^3.25.0 || ^4.0.0"` as an accepted peer range) — installing `^4.4.3` directly does not create a version conflict.
- Vitest's `jsdom` environment is opt-in per test file or globally in `vitest.config.ts` (`test: { environment: 'jsdom' }`) — route handler and service/repository tests should use Node environment (the default) since they don't touch the DOM; only component tests need `jsdom`. Two config blocks (or `// @vitest-environment node` comments) may be needed to avoid paying jsdom's startup cost on server-side tests.
- Kysely's `PostgresDialect` requires passing it the existing `pg.Pool` instance (`new Pool(...)` from `lib/db.ts` or a new one pointed at the same `DATABASE_URL`) — verify whichever pool Kysely uses is the same one the rest of the app uses, or connection limits under load could double.

## Sources

- Next.js official docs: https://nextjs.org/docs/app/guides/testing/vitest (Next.js version 16.3.0, last updated 2026-02-11) — HIGH confidence (curated Context7/official source retrieved via webfetch; officially maintained docs but classified LOW-tier by the confidence seam due to fetch method, treat findings as directionally correct and cross-check version numbers via registry before pinning in `package.json`)
- npm registry (`registry.npmjs.org`) latest-version lookups for `vitest`, `@testing-library/react`, `zod`, `kysely`, `node-mocks-http` — version numbers as of 2026-08-07
- `package-lock.json` (this repo) — confirms `zod` is already an accepted peer dependency of `@anthropic-ai/sdk`
- Next.js `with-vitest` example (`github.com/vercel/next.js/tree/canary/examples/with-vitest`) — confirms devDependency set and minimal `vitest.config.ts` shape

**Confidence:** MEDIUM overall. Version numbers were verified live against npm registry and official Next.js docs (not training data), which raises confidence on the specific numbers. The confidence-classification seam returned LOW for the `webfetch` provider tier regardless of source authority, so treat this as directionally solid but re-verify exact pinned versions at implementation time, particularly for `vitest` (`4.1.10`) which is a fast-moving major version line.
