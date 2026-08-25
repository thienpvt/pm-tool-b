---
phase: 02-repository-layer
gathered: 2026-08-07
status: Ready for planning
mode: Auto-generated (infrastructure phase — discuss skipped)
---

# Phase 2: Repository Layer — Context

<domain>
## Phase Boundary

Move every SQL statement into `lib/repositories/*.repo.ts`. Repository functions take explicit `companyId`/`projectId` arguments — no session inspection inside them. Write paths enforce a per-resource column allowlist instead of the current `Object.keys(body)` mass assignment pattern.

Route handlers, services, and components must not contain raw SQL or `pg` calls after this phase (exception: `lib/db.ts` infrastructure remains).

</domain>

<decisions>
## Implementation Decisions

### File Naming & Structure
- One file per resource under `lib/repositories/`: `project.repo.ts`, `activity.repo.ts`, `risk.repo.ts`, `issue.repo.ts`, `meeting.repo.ts`, `escalation.repo.ts`, `team.repo.ts`, `document.repo.ts`, `bug.repo.ts`, `holiday.repo.ts`, `milestone.repo.ts`, `budget.repo.ts`, `program.repo.ts`, `portfolio.repo.ts`, `jira.repo.ts`, `resource.repo.ts`, `operation.repo.ts`
- Export named functions (no class), e.g. `export async function getProjectById(id: number, companyId: number)`
- Import only `@/lib/db` — no session, no request objects

### Column Allowlists
- Each write-capable repository defines a `const ALLOWED_COLUMNS` set/object at the top
- Unknown keys throw a typed error (e.g. `new Error(\`Forbidden column: \${key}\`)`) — do not silently drop
- Allowlist diff against current `Object.keys(body)` persisted paths recorded in repository file as a comment block `// allowlist: diffed against route.ts PATCH as of 2026-08-07`

### SQL Style
- Keep existing `?` placeholder style via `PostgresClient.toPositional` — do NOT rewrite to native `$n` in this phase (that is post-reorg debt, noted in CONCERNS.md)
- Preserve `INSERT OR IGNORE` / `ON CONFLICT DO NOTHING` pattern from existing code
- Repositories return typed row objects matching existing types from `lib/db.ts`

### Route Handler Updates
- Routes that previously had inline SQL get their SQL block replaced with a repository call
- Routes pass already-resolved `companyId`/`projectId` from the session — no session extraction inside repositories
- Keep route handler auth checks exactly as-is — auth changes are Phase 5/6

### Tests
- Each repository module gets a `*.repo.test.ts` using the Phase 1 Postgres test pattern (`TEST_DATABASE_URL`, skip if unset)
- Cover: read by id + company scoping, write with valid columns, write with rejected column (should throw)

### Claude's Discretion
- Order of resource migration (start with most-referenced routes)
- Whether to batch multiple resources per commit or one resource per commit (prefer one per commit for bisectability)
- Handling of complex JOIN queries (extract to repo as-is, no query restructuring this phase)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/db.ts` — `getDb()`, `DbClient` (`.get<T>`, `.all<T>`, `.run`), `?` placeholder style, exported row types (`Project`, `Activity`, `Risk`, `Issue`, `Meeting`, `Escalation`, `TeamMember`, `Document`, `Bug`, `Holiday`, `Milestone`, `BudgetItem`)
- `test/db.ts` — `getTestDb()`, `skipIfNoTestDb()` helpers for repository tests (Phase 1 pattern)

### Established Patterns
- SQL in routes uses `db.all<Type>(sql, ...params)` / `db.get<Type>(sql, ...params)` / `db.run(sql, ...params)`
- Mass assignment: `Object.keys(body).map(k => \`${k} = ?\`)` — present in `projects/[id]/route.ts`, `activities/route.ts`, `risks/route.ts`, `issues/route.ts`, `meetings/route.ts`, `team/route.ts`, `escalations/route.ts`
- Company scoping: `WHERE company_id = ?` or JOIN to `projects p WHERE p.company_id = ?`

### Integration Points
- Every `app/api/**/route.ts` that contains a raw `db.*` call or inline SQL
- `lib/db.ts` exports all existing row types — repositories import types from there, do not redefine
- Affected routes (from CONCERNS.md analysis): projects, activities, risks, issues, meetings, escalations, team, documents, bugs, holidays, milestones, budget, import-mapping, export, config, jira, portfolio, programs, resources, operations

</code_context>

<specifics>
## Specific Requirements

- Mass assignment eliminated (column allowlist enforced) — this is a security fix, not just cleanup
- Grep success criterion: after phase, `grep -r "db\." app/api/ --include="*.ts"` returns nothing (routes no longer call `db.*` directly)
- Each allowlist diff must be recorded inline in the repository file

</specifics>

<deferred>
## Deferred Ideas

- Rewriting `?` placeholders to native `$n` PostgreSQL syntax — tracked as post-reorg debt in CONCERNS.md (SQLite-dialect SQL concern)
- Moving schema init out of `getDb()` — already deferred to v2 in PROJECT.md
- Adding database indexes — PERF-01/02/03, deferred to v2

</deferred>
