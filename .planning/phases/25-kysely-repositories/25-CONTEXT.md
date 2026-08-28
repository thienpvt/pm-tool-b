# Phase 25: Kysely Repositories - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Repository queries go through Kysely on the existing `pg.Pool` so invalid column names fail at TypeScript compile time, while runtime mass-assignment tests still reject extra fields. A single connection pool remains.

**Requirements:** ENF-02

**In:**
- Add `kysely` and wrap the existing Pool (`PostgresDialect`)
- Typed `Database` interface for current schema
- Convert `modules/*/backend/repositories/*.repo.ts` and leftover `lib/repositories` (auth, settings) to Kysely
- Keep per-table write allowlists / `UnknownColumnError` tests
- One Kysely factory in `lib/` (cross-cutting)

**Out:**
- Prisma / Drizzle / a second Pool
- Rewriting services, routes, or UI
- RSC chrome / cold-start (Phase 26)
- Nits / operator gate (Phase 27)
- Changing API contracts or auth wrappers
- Adding `withCpmo` to operations or `/api/admin/companies` (D-23)

</domain>

<decisions>
## Implementation Decisions

- **D-01:** Add npm package `kysely` only as a runtime dependency. Use `PostgresDialect` with the **existing** `pg.Pool` from `getDb()`. No Prisma, Drizzle, or second pool.
- **D-02:** One `Kysely<Database>` factory in `lib/` (e.g. `lib/db/kysely.ts`) obtained after `getDb()` so migrate-assert + seed still run first. Repos must not construct their own Pool.
- **D-03:** Schema types live in `lib/db/database.ts` (or generated sibling). Prefer `kysely-codegen` as a **devDependency** to generate types from a migrated DB; check the generated file into git. If codegen cannot run in this environment, hand-author `Database` from `migrations/0001-baseline-schema.sql` with the same table/column names.
- **D-04:** Compile-time types do **not** replace runtime mass-assignment guards. Per-repo writes use a **narrow** `Pick` / existing allowlist const (same columns as today's `buildUpdate` arrays). Keep `UnknownColumnError` (or equivalent) tests: extra body keys still 400. Do not pass wholesale `Updateable<T>` that includes `id` / `company_id` unless that table already allowed those columns.
- **D-05:** Convert **all** production `*.repo.ts` files (module repos + `lib/repositories/auth.repo.ts` and `settings.repo.ts`). Leave `lib/auth.ts` session SQL and migrate/seed SQL on `DbClient` unless a file is already a repository. Delete `buildUpdate` usage only when that table's repo writes are fully on Kysely.
- **D-06:** Do not rewrite service/route logic. Do not restyle UI. Do not change ENF-01 wrappers or D-23 ops/admin companies auth.
- **D-07:** No `as any` / `as unknown as` to silence Kysely in repos. Isolation none: sequential waves. TDD: RED then GREEN per task. No second test DB pool.
- **D-08:** Tracer first: factory + `Database` types + one small repo (audit) proving (a) typed query compiles, (b) existing mass-assignment test still rejects extra fields where applicable, (c) `getDb()` still a single Pool.
- **D-09:** Pin `kysely@0.29.5` (runtime) and `kysely-codegen@0.20.0` (devDependency) per research. Accept npm "too-new" seam flag — recommended versions.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 25
- `.planning/REQUIREMENTS.md` — ENF-02
- `.planning/research/PITFALLS.md` — Pitfall 3 (Kysely vs mass-assignment)
- `lib/db.ts` — `PostgresClient` / `getDb()` / Pool
- `lib/repositories/_helpers.ts` — `buildUpdate` / `UnknownColumnError`
- `modules/*/backend/repositories/`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getDb()` returns `DbClient` wrapping one `pg.Pool`
- `buildUpdate` + allowlist arrays on write repos
- Mass-assignment tests that assert unknown keys throw / 400

### Established Patterns
- Repos import `getDb()` and use `?` placeholders rewritten to `$n`
- Cross-cutting `lib/http`, `lib/auth`, `lib/db`, `lib/migrate` stay in `lib/`

### Integration Points
- Vitest already includes `modules/**` and `lib/**`
- Transactions via `lib/db-tx`

</code_context>

<specifics>
## Specific Ideas

Grey areas auto-accepted: Kysely on existing pool, keep runtime allowlists, convert all repos, codegen-or-hand types, tracer then sequential module waves, no second ORM.
</specifics>

<deferred>
## Deferred Ideas

- RSC chrome / cold-start — Phase 26
- Nits, Nyquist remainder, operator HYG-02 — Phase 27
</deferred>
