# Stack Research

**Domain:** PM Tool B v2.1 — Hardening & Deferred Debt (brownfield Next.js 16 / React 19 / PostgreSQL)
**Researched:** 2026-08-28
**Confidence:** HIGH (additive stack on validated v2.0 base; integration points verified against codebase + origin DATA branch)

## Scope

v2.0 stack is **fixed and validated** — do not replace Next.js 16.2.4, React 19.2.4, TypeScript strict, PostgreSQL via `pg`, Vitest 4, Zod, exceljs, pptxgenjs, docx, Anthropic SDK, Jira/Resend clients, scrypt sessions, or route → service → repository layers.

This document covers **additions and changes** for v2.1 only:

| Requirement | Stack focus |
|-------------|-------------|
| DATA-01..03 | Versioned SQL migrations, external `npm run migrate`, `getDb()` connect+guard+seed only |
| ENF-01 | ESLint/CI gate for auth wrapper on project-scoped `route.ts` handlers |
| ENF-02 | Kysely over existing `pg.Pool` in repositories (no Prisma, no second ORM) |
| PERF-01 | Large grid virtualization |
| PERF-02 | Static page chrome → React Server Components |
| PERF-03 | Cold-start measurement and budget |
| PROXY-01 | `proxy.ts` JSON 401 for API callers |

Repo-wide per-module backend/UI directory layout is an **architecture** decision (see ARCHITECTURE.md); no new packages required unless a path-alias ESLint plugin is added later.

## Recommended Stack

### Core Technologies (unchanged)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.4 | App Router, `proxy.ts`, RSC layouts | Already validated; v2.1 uses built-in proxy + RSC — no middleware migration |
| React | 19.2.4 | UI, `@tanstack/react-virtual` host | Already validated; virtualizer is headless and React-19-compatible |
| PostgreSQL | 15+ (hosting) | Multi-tenant master data | Unchanged; migrations stay raw SQL |
| `pg` | ^8.20.0 | DB driver + Kysely `PostgresDialect` pool | Single pool shared by Kysely and legacy `DbClient` bridge during ENF-02 rollout |
| TypeScript | ^5 (strict) | Compile-time column safety via Kysely | Kysely requires TS ≥5.4 and `strict: true` — project already satisfies both |
| Vitest | 4.1.10 | Regression gate | Extend for migration runner unit tests, wrapper lint, cold-start script |

### New Runtime Dependencies

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `kysely` | **0.29.5** | Type-safe query builder over existing `pg.Pool` | ENF-02: compile-time column/table names replace stringly-typed allowlists; zero runtime overhead; wraps same pool — no second connection layer |
| `@tanstack/react-virtual` | **3.14.10** | Row virtualization for large HTML tables/grids | PERF-01: headless `useVirtualizer` works with existing `<table>` markup (timeline activities, admin tables, audit viewer) without adopting a full datagrid framework |

### New Development Dependencies

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `tsx` | **4.23.12** (pinned) | Run migration CLI + cold-start script outside Next bundle | Origin DATA branch pattern; **must** be a devDependency — never bare `npx tsx` in Docker/CI (unpinned transitive drift) |
| `kysely-codegen` | **0.20.0** | Generate `Database` interface from live Postgres schema | After `npm run migrate`, codegen produces Kysely types matching v2.0 tables; avoids hand-maintaining 40+ table interfaces |
| `@typescript-eslint/utils` | **^8.68.0** | Author local ESLint rule for ENF-01 | Matches `eslint-config-next@16.2.4` typescript-eslint major; flat-config local plugin for wrapper enforcement |

### Migration Stack (DATA-01..03) — keep custom runner, not node-pg-migrate

| Component | Version / source | Purpose | Why Recommended |
|-----------|------------------|---------|-----------------|
| Custom runner (`lib/migrate/*`) | Replay from `origin/gsd/quick-260826-ded-data-layer-migrations` | Advisory lock, checksum ledger, pending/drift detection | Already designed for this app: `schema_migrations` ledger, sha256 drift detection, `pg_advisory_lock(1347246335)`, no `fs` in `getDb()` (standalone-safe) |
| `migrations/*.sql` | Regenerated `0001-baseline-*.sql` from **current** `lib/db.ts` | Versioned DDL baseline incl. v2.0 weekly/fiscal/roles/RAID/dashboard/checklist/audit | Origin branch `0001` is v1.0-era — merging as-is would drop v2.0 tables |
| `scripts/migrate.ts` | Replay from origin branch | External `npm run migrate` / `--check` deploy gate | Reads SQL at CLI time only; calls `getDb()` post-migrate for idempotent seed |
| `assertMigrated()` | Replay from origin branch | Fast-fail in `getDb()` when ledger empty | Legacy DB with `companies` row but no ledger still boots (dev tolerance); fresh DB fails with runbook message |
| `pg` | ^8.20.0 (existing) | Migration client + app pool | Runner uses dedicated `pool.connect()` session; app uses singleton — same driver, no new dep |

**Recommendation: keep custom runner, reject `node-pg-migrate@9.0.0`.**

| Criterion | Custom runner (origin pattern) | node-pg-migrate |
|-----------|----------------------------------|-----------------|
| Checksum drift on edited applied files | Built-in (`planPendingMigrations` → throw) | Not native — would need custom hooks |
| Advisory lock | Built-in (`PMMG` key) | Separate concern |
| `output: 'standalone'` | SQL read only in CLI; `getDb()` has no `fs` | Adds CLI + migration table format unlike existing ledger |
| Brownfield baseline | One `0001` SQL dump from current schema | Would still need manual baseline; different file naming |
| Team familiarity | Already implemented on origin branch | New abstraction for ~200 lines of proven code |

### ENF-01 — Auth wrapper ESLint gate

| Component | Version | Purpose | Why Recommended |
|-----------|---------|---------|-----------------|
| Local rule `pm-tool/require-auth-wrapper` | via `@typescript-eslint/utils@^8.68.0` | Fail lint when `app/api/**/route.ts` exports `GET`/`POST`/… not wrapped | Matches existing export pattern: `export const GET = withProjectAccess(async …)` |
| Allowlist in `eslint.config.mjs` | — | Exempt `/api/auth/*`, `/api/health`, `/api/demo-requests`, platform admin routes per D-23 | Same paths as `proxy.ts` `PUBLIC` + documented carve-outs |
| CI fallback (optional) | `tsx scripts/check-route-wrappers.ts` | Same AST check outside ESLint | Only if flat-config local plugin wiring blocks CI — ESLint is primary per ENF-01 |

**Sanctioned wrappers** (must appear as direct call wrapping the handler): `withAuth`, `withProjectAccess`, `withProgramAccess`, `withCpmo`, `withRole`.

### ENF-02 — Kysely integration with existing pool

```
getDb()  →  Pool (singleton _pool)
              ├─ PostgresClient (DbClient) — retire per-repo during migration
              └─ Kysely<Database> via PostgresDialect({ pool: _pool })
runInTransaction(fn)  →  pg PoolClient  →  kysely.execute(db => fn(db)) for Kysely repos
```

| Pattern | Package | Notes |
|---------|---------|-------|
| Singleton Kysely | `kysely@0.29.5` | `new Kysely<Database>({ dialect: new PostgresDialect({ pool: _pool }) })` — reuse `_pool`, do not create second pool |
| Type generation | `kysely-codegen@0.20.0` | `"codegen:db": "kysely-codegen --dialect postgres --url env(DATABASE_URL) --out-file lib/db/kysely-types.ts"` — run after migrate in dev/CI |
| BIGINT amounts | `pg` defaults | Keep BIGINT as **string** in generated types; do **not** set `parseInt8` globally (VND precision) |
| Transactions | `kysely` | Prefer `db.transaction().execute()` for new code; existing `runInTransaction` can wrap Kysely `.execute()` on reserved connection |
| Compile-time columns | `kysely` | `.select(['id', 'company_id', …])` — invalid column is TS error; replaces manual allowlist arrays |

### PERF-01 — Grid virtualization targets

| Page / component | Est. row count | Virtualization approach |
|------------------|----------------|-------------------------|
| Project timeline activity table | 100–500+ | `useVirtualizer` on scroll container wrapping `<tbody>` rows |
| Admin user/company tables | 50–200 | Same row virtualizer; fixed `estimateSize` (~40px) |
| Audit viewer (UI-AUDIT) | Unbounded append-only | Virtualizer + server pagination later; virtualizer first |
| Resource plan matrix | Medium | Row virtualizer; column virtualization only if horizontal scroll becomes bottleneck |

Use **`@tanstack/react-virtual`** — not `@tanstack/react-table` (no need for headless table state yet) and not `react-virtualized` (maintenance mode, heavier API).

### PERF-02 — RSC chrome (no new packages)

| Change | Mechanism | Why |
|--------|-----------|-----|
| Authenticated route-group layout | Server Component `(app)/layout.tsx` or per-segment layout | Static shell (Logo, nav structure, `<main>`) renders on server — less client JS |
| Split `Sidebar.tsx` | Server `SidebarShell` + Client `SidebarInteractive` | Current 400-line `'use client'` Sidebar fetches `/api/auth/me` and uses `usePathname` — only interactive islands need client |
| Page files | Server page wraps Client feature module | Pattern: `export default async function Page() { return <TimelineClient … /> }` — data fetched in server parent where possible |
| Root layout | Already Server (`app/layout.tsx`) | Keep `Toaster` as client island; font + metadata stay server |

### PERF-03 — Cold-start measurement (stdlib-first)

| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| Node `perf_hooks` | stdlib | `performance.now()` around first `getDb()` in benchmark script | Zero deps; measures post-DATA-01 boot path (connect + assertMigrated + seed, no DDL) |
| `tsx@4.23.12` | pinned devDep | `scripts/measure-cold-start.ts` | Same runner as migrate; exits non-zero when p95 exceeds budget |
| Vitest 4 | existing | Unit test that `assertMigrated` throws without ledger | Complements timing script — correctness before perf |

**Primary win for cold-start:** removing `initPostgresSchema` + inline migrate chain from `getDb()` (DATA-01..03). Measurement script validates the slim path; budget target is a planning constant (e.g. `<500ms` connect+guard on Railway — set in phase plan).

### PROXY-01 — JSON 401 from `proxy.ts` (no new packages)

| Pattern | Implementation |
|---------|----------------|
| API unauthenticated | `pathname.startsWith('/api/')` && no session → `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` |
| Page unauthenticated | Keep existing `NextResponse.redirect('/login')` |
| Public API paths | Same `PUBLIC` prefix list as today |
| Request ID stamping | Preserve `NextResponse.next({ request: { headers } })` for authenticated API |

Next.js 16 canonical pattern (Context7 `/vercel/next.js/v16.2.9`): proxy returns `Response.json(…, { status: 401 })` for `/api/:function*` — **cookie/session check only**, no edge DB/pg (session remains in route handlers via `withAuth`).

## Installation

```bash
# Runtime (ENF-02, PERF-01)
npm install kysely@0.29.5 @tanstack/react-virtual@3.14.10

# Dev (DATA-01..03 CLI, ENF-01 local rule, ENF-02 codegen, PERF-03 script)
npm install -D tsx@4.23.12 kysely-codegen@0.20.0 @typescript-eslint/utils@^8.68.0
```

**package.json scripts to add:**

```json
{
  "migrate": "tsx scripts/migrate.ts",
  "migrate:check": "tsx scripts/migrate.ts --check",
  "codegen:db": "kysely-codegen --dialect postgres --url env(DATABASE_URL) --out-file lib/db/kysely-types.ts",
  "measure:cold-start": "tsx scripts/measure-cold-start.ts"
}
```

**Docker / deploy notes:**

- Pin `tsx@4.23.12` in devDependencies; invoke via `npm run migrate`, never `npx tsx` without version pin.
- Copy `migrations/` into runner image (or run migrate as init container before `node server.js`).
- `output: 'standalone'` unchanged — migration SQL stays outside app bundle.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Custom migration runner (origin replay) | `node-pg-migrate@9.0.0` | Greenfield project without existing ledger/checksum semantics — not this brownfield |
| Custom runner | Flyway/Liquibase (JVM) | Never — ops team runs Node, not Java sidecar |
| `kysely@0.29.5` | Prisma / Drizzle | Never — PROJECT.md forbids second ORM; raw SQL migrations stay |
| `kysely@0.29.5` | Keep `DbClient` allowlists only | If ENF-02 descoped — but compile-time safety was explicit v2.1 goal |
| `kysely-codegen@0.20.0` | Hand-written `Database` interface | Only for first repo before CI codegen wired — not maintainable at 40+ tables |
| `@tanstack/react-virtual@3.14.10` | `@tanstack/react-table` + virtual | When sort/filter/column-visibility state machine needed — current grids are custom |
| `@tanstack/react-virtual@3.14.10` | `react-virtualized` / `react-window` | Never — TanStack is actively maintained, React 19-friendly, headless |
| Local ESLint rule (`@typescript-eslint/utils`) | CI grep/ast-grep script only | Acceptable fallback if ESLint plugin wiring blocked; ESLint gives dev-time feedback |
| Local ESLint rule | `eslint-plugin-local-rules` | Extra indirection; flat-config local plugin is simpler for one rule |
| RSC layout split (no package) | Full SSR data router (Remix, etc.) | Never — framework swap out of scope |
| `perf_hooks` cold-start script | `@next/bundle-analyzer` | Bundle analysis is complementary, not cold-start measurement — optional devDep later |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Merge `origin/gsd/quick-260826-ded-data-layer-migrations` as-is | `0001` baseline predates v2.0 weekly/fiscal/roles/RAID/dashboard/checklist/audit tables | Replay runner + regenerate baseline SQL from current schema |
| `npx tsx` without pin in Docker/CI | Unpinned transitive version drift between builds | `tsx@4.23.12` devDependency + `npm run migrate` |
| `node-pg-migrate`, Flyway, Prisma Migrate | Second migration system; conflicts with checksum ledger design | Custom runner in `lib/migrate/*` |
| Prisma, Drizzle, TypeORM | Second ORM / query layer | `kysely` over existing `pg.Pool` |
| `pg` second pool for Kysely | Doubles connections, breaks transaction sharing | `PostgresDialect({ pool: _pool })` on singleton |
| `pg.defaults.parseInt8 = true` | Loses precision for VND BIGINT above `Number.MAX_SAFE_INTEGER` | Keep string BIGINT; use `BigInt` in services |
| Bare `npx tsx scripts/migrate.ts` in Dockerfile CMD | No lockfile pin | `npm run migrate` after `npm ci` |
| `react-virtualized` | Legacy API, React 19 friction | `@tanstack/react-virtual@3.14.10` |
| Edge session + pg in proxy | v2.1 PROXY-01 is cookie-presence check only; auth truth stays in `withAuth` | `proxy.ts` JSON 401 on missing cookie for `/api/*` |
| CASL / policy engines for ENF-01 | ENF-01 checks wrapper presence, not role logic | AST call to sanctioned wrapper names |
| `@next/bundle-analyzer` as cold-start gate | Measures bundle size, not DB boot | `perf_hooks` script on slim `getDb()` |

## Stack Patterns by Variant

**If replaying DATA branch onto current master:**
1. Port `lib/migrate/{plan,runner,assertMigrated}.ts` and `scripts/migrate.ts` verbatim (pure logic + CLI).
2. Dump current schema (all v2.0 tables) into `migrations/0001-baseline-v2.sql`.
3. Strip `initPostgresSchema`, `migratePostgresSchema`, and inline `migrate*` calls from `getDb()` — leave connect, `assertMigrated`, `seedAuthData`.
4. Keep `lib/db-*.ts` one-off data-fix functions as `scripts/data-fix/*.ts` invoked manually or from numbered migrations.

**If migrating a repository to Kysely (ENF-02 rollout):**
- Replace `db.get('SELECT …', …)` with `db.selectFrom('table').select([…]).where(…).executeTakeFirst()`.
- Run `npm run codegen:db` after each migration that adds/changes columns.
- Keep repository as only SQL boundary — services unchanged.

**If a route is legitimately public (health, auth login):**
- Add path to ESLint rule allowlist, not wrapper bypass in code.

**If API caller gets HTML 307 today (PROXY-01):**
- Branch in `proxy.ts` on `pathname.startsWith('/api/')` before redirect — fetch clients and Jira webhooks expect JSON 401.

**If grid has variable row heights (timeline wrapped text):**
- Use `@tanstack/react-virtual` `measureElement` ref callback on rows; set `estimateSize` to median height.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `kysely@0.29.5` | TypeScript ≥5.4, `strict: true` | Project TS ^5 + strict — OK |
| `kysely@0.29.5` | `pg@^8.20.0` | `PostgresDialect` uses same Pool/PoolClient; no adapter package needed |
| `kysely@0.29.5` | Node 20 (Dockerfile) | Supported; Dockerfile already `node:20-slim` |
| `kysely-codegen@0.20.0` | `kysely@0.29.x` | Generate types after migrate; commit `kysely-types.ts` or regenerate in CI before typecheck |
| `@tanstack/react-virtual@3.14.10` | React 19.2.4 | Headless hook — no peer conflict with Next 16 |
| `tsx@4.23.12` | Node 20, ESM/CJS | Origin branch validated; pin exact version |
| `@typescript-eslint/utils@^8.68.0` | ESLint 9 flat config, `eslint-config-next@16.2.4` | Same major as typescript-eslint bundled with Next ESLint config |
| Vitest 4.1.10 | Kysely repos | Mock `getKysely()` or test DB pool same as existing repo tests |
| `next@16.2.4` standalone | No `fs` in `getDb()` post-DATA | Preserves current deploy model |

## Integration Checklist (v2.1 phase planner)

1. **DATA-01..03:** Port runner → regenerate `0001` → add scripts → slim `getDb()` → Docker migrate step.
2. **ENF-02:** Add Kysely singleton → codegen → migrate repos module-by-module → remove `DbClient` when last repo converted.
3. **ENF-01:** Add local ESLint rule + allowlist → wire CI `npm run lint`.
4. **PROXY-01:** API branch in `proxy.ts` → update 401 tests (existing ROUTE-03 patterns).
5. **PERF-02:** Extract Server layout + split Sidebar before virtualizing (smaller client boundary).
6. **PERF-01:** Virtualize timeline + admin tables first (highest row counts).
7. **PERF-03:** Add measure script after DATA cutover (meaningful baseline only without inline DDL).

## Sources

- `/kysely-org/kysely` (Context7) — `PostgresDialect` + Pool, TS 5.4+/strict requirement, transactions — **HIGH** confidence
- `/robinblomberg/kysely-codegen` (Context7) — CLI codegen from `DATABASE_URL`, postgres dialect — **HIGH** confidence
- `/tanstack/virtual` (Context7) — `@tanstack/react-virtual`, `useVirtualizer` row pattern — **HIGH** confidence
- `/vercel/next.js/v16.2.9` (Context7) — `proxy.ts` JSON 401, RSC layout + client boundary — **HIGH** confidence
- npm registry (2026-08-28): `kysely@0.29.5`, `@tanstack/react-virtual@3.14.10`, `tsx@4.23.12`, `kysely-codegen@0.20.0`, `node-pg-migrate@9.0.0`, `@typescript-eslint/utils@8.68.0` — version pins verified live
- Codebase: `lib/db.ts`, `proxy.ts`, `eslint.config.mjs`, `lib/http/with-*.ts`, `app/api/**/route.ts` export pattern — **HIGH** confidence (local)
- Origin branch `gsd/quick-260826-ded-data-layer-migrations`: `lib/migrate/runner.ts`, `plan.ts`, `assertMigrated.ts`, `scripts/migrate.ts` — **HIGH** confidence (local git)

---
*Stack research for: PM Tool B v2.1 Hardening & Deferred Debt*
*Researched: 2026-08-28*
