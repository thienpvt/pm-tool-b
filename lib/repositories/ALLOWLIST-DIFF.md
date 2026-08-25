# Allowlist Diff (REPO-04)

Record of what each per-resource write allowlist contains, compared against the
columns the current `Object.keys(body)` code actually persists.

**Why this file exists:** the pre-refactor write paths built `SET` clauses from
caller-supplied keys, so the effective allowlist was "every column in the table,
plus anything the DB happens to accept". Deriving the new allowlists from
`CREATE TABLE` alone would silently stop persisting migration-added columns.
Each allowlist below is `(CREATE TABLE columns ∪ migration-added columns)` minus
identity/tenancy columns, with every exclusion given a reason.

Source of truth: `lib/db.ts` — `initPostgresSchema` (CREATE TABLE) and
`migratePostgresSchema` (ALTER TABLE ... ADD COLUMN).

**Migration-only columns** — present via `ALTER TABLE`, absent from `CREATE TABLE`.
These are the silent-breakage risk:

| Table | Migration-only columns |
|---|---|
| `projects` | `headcount_quota`, `budget_status`, `project_code`, `portfolio_year`, `stage`, `status_reason`, `rag`, `progress_pct`, `weekly_report_enabled`, `weekly_report_start_period`, `plan_end`, `adjusted_end`, `actual_end`, `classification`, `governance` (Phase 11 `migrateProjectMaster`) |
| `activities` | `project_status`, `parent_id` |

The rest of the migration list (`objective`, `project_owner`, `budget`,
`budget_currency`, `customer_id`, `company_id` on `projects`; `delay_owner`,
`delay_reason`, `jira_key`, `sprint`, `priority` on `activities`; `priority`,
`impact`, `affected_activity_id` on `risks`/`issues`; `email` on `team_members`)
appears in both places — the ALTERs are idempotent re-adds for older databases.

---

## projects — `PROJECT_COLUMNS`

Route: `app/api/projects/[id]/route.ts` PATCH. Current code:
`Object.keys(body).map(k => \`${k} = ?\`)` — no filter at all.

| Column | CREATE TABLE | Migration | Allowlisted | Note |
|---|---|---|---|---|
| `id` | yes | — | **no** | WHERE key, never a SET target |
| `name` | yes | — | yes | |
| `client` | yes | — | yes | |
| `pm_name` | yes | — | yes | |
| `pm_email` | yes | — | yes | |
| `start_date` | yes | — | yes | |
| `end_date` | yes | — | yes | |
| `status` | yes | — | yes | |
| `current_phase` | yes | — | yes | |
| `description` | yes | — | yes | |
| `objective` | yes | yes | yes | |
| `project_owner` | yes | yes | yes | |
| `budget` | yes | yes | yes | |
| `budget_currency` | yes | yes | yes | |
| `headcount_quota` | no | yes | yes | **migration-only** |
| `budget_status` | no | yes | yes | **migration-only** |
| `project_code` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `portfolio_year` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `stage` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `status_reason` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `rag` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `progress_pct` | no | yes (Phase 11) | yes | **migrateProjectMaster** (D-09 live progress) |
| `weekly_report_enabled` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `weekly_report_start_period` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `plan_end` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `adjusted_end` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `actual_end` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `classification` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `governance` | no | yes (Phase 11) | yes | **migrateProjectMaster** |
| `customer_id` | yes | yes | **no** | tenancy — client-settable today; this is the IDOR vector |
| `company_id` | yes | yes | **no** | tenancy — same |
| `created_at` | yes | — | **no** | DB default |

**Behavior change (intentional):** a PATCH body containing `company_id` or
`customer_id` now returns 400 instead of moving the project between tenants.
This is threat #1 in the plan's threat model and the reason the phase exists.

## activities — `ACTIVITY_COLUMNS`

Route: `app/api/projects/[id]/activities/route.ts` PUT.

| Column | CREATE TABLE | Migration | Allowlisted | Note |
|---|---|---|---|---|
| `id` | yes | — | **no** | WHERE key |
| `project_id` | yes | — | **no** | scoping param (REPO-02) |
| `phase` | yes | — | yes | |
| `no` | yes | — | yes | |
| `activity` | yes | — | yes | |
| `deliverable` | yes | — | yes | |
| `sign_off_doc` | yes | — | yes | |
| `accountable` | yes | — | yes | |
| `responsible` | yes | — | yes | |
| `support` | yes | — | yes | |
| `plan_start` | yes | — | yes | |
| `plan_end` | yes | — | yes | |
| `actual_start` | yes | — | yes | |
| `actual_end` | yes | — | yes | |
| `status` | yes | — | yes | |
| `completion_pct` | yes | — | yes | |
| `notes` | yes | — | yes | |
| `order_idx` | yes | — | yes | POST derives it, PUT may reorder |
| `delay_owner` | yes | yes | yes | |
| `delay_reason` | yes | yes | yes | |
| `jira_key` | yes | yes | yes | |
| `sprint` | yes | yes | yes | |
| `priority` | yes | yes | yes | |
| `project_status` | **no** | yes | yes | **migration-only — the current POST persists it** |
| `parent_id` | **no** | yes | yes | **migration-only — the current POST persists it** |

**The REPO-04 finding.** The current `POST` handler writes `project_status` and
`parent_id` explicitly, but neither appears in the `activities` `CREATE TABLE`
block — both arrive via `migratePostgresSchema`. An allowlist derived from
`CREATE TABLE` alone would compile, typecheck, and pass a naive test while
silently dropping epic parentage and the denormalized project status on every
update. They are allowlisted.

## risks — `RISK_COLUMNS`

Route: `app/api/projects/[id]/risks/route.ts` PUT.

| Column | CREATE TABLE | Migration | Allowlisted | Note |
|---|---|---|---|---|
| `id` | yes | — | **no** | WHERE key |
| `project_id` | yes | — | **no** | scoping param |
| `risk_id` | yes | — | yes | display id (`R{n}`), editable |
| `code` | no | yes (Phase 12) | yes | **migrateRaidMasters** — unique per project |
| `description` | yes | — | yes | |
| `category` | yes | — | yes | |
| `owner` | yes | — | yes | |
| `trigger` | yes | — | yes | |
| `mitigation` | yes | — | yes | |
| `due_date` | yes | — | yes | |
| `status` | yes | — | yes | |
| `priority` | yes | yes | yes | |
| `impact` | yes | yes | yes | |
| `affected_activity_id` | yes | yes | yes | |

## issues — `ISSUE_COLUMNS`

Route: `app/api/projects/[id]/issues/route.ts` PUT. Same shape as risks plus
`root_cause`, with `issue_id` in place of `risk_id`.

| Column | CREATE TABLE | Migration | Allowlisted | Note |
|---|---|---|---|---|
| `id` | yes | — | **no** | WHERE key |
| `project_id` | yes | — | **no** | scoping param |
| `issue_id` | yes | — | yes | display id (`I{n}`) |
| `description` | yes | — | yes | |
| `root_cause` | yes | — | yes | |
| `category` | yes | — | yes | |
| `owner` | yes | — | yes | |
| `trigger` | yes | — | yes | |
| `mitigation` | yes | — | yes | |
| `due_date` | yes | — | yes | |
| `status` | yes | — | yes | |
| `priority` | yes | yes | yes | |
| `impact` | yes | yes | yes | |
| `affected_activity_id` | yes | yes | yes | |

## meetings — `MEETING_COLUMNS`

Route: `app/api/projects/[id]/meetings/route.ts` PUT. No migration-added columns.

| Column | CREATE TABLE | Migration | Allowlisted | Note |
|---|---|---|---|---|
| `id` | yes | — | **no** | WHERE key |
| `project_id` | yes | — | **no** | scoping param |
| `name` | yes | — | yes | |
| `frequency` | yes | — | yes | |
| `content` | yes | — | yes | |
| `participants` | yes | — | yes | |
| `method` | yes | — | yes | |
| `type` | yes | — | yes | |

## team_members — `TEAM_COLUMNS`

Route: `app/api/projects/[id]/team/route.ts` PUT.

| Column | CREATE TABLE | Migration | Allowlisted | Note |
|---|---|---|---|---|
| `id` | yes | — | **no** | WHERE key |
| `project_id` | yes | — | **no** | scoping param |
| `domain` | yes | — | yes | |
| `role` | yes | — | yes | |
| `name` | yes | — | yes | |
| `email` | yes | yes | yes | |
| `capacity_json` | yes | — | yes | |
| `notes` | yes | — | yes | |

## escalation_levels — `ESCALATION_COLUMNS`

Route: `app/api/projects/[id]/escalations/route.ts` PUT. No migration-added columns.

| Column | CREATE TABLE | Migration | Allowlisted | Note |
|---|---|---|---|---|
| `id` | yes | — | **no** | WHERE key |
| `project_id` | yes | — | **no** | scoping param |
| `level` | yes | — | yes | |
| `level_name` | yes | — | yes | |
| `channel` | yes | — | yes | |
| `participants` | yes | — | yes | |
| `input` | yes | — | yes | |
| `output` | yes | — | yes | |

---

## Net effect

| Resource | Columns previously settable | Now settable | Removed |
|---|---|---|---|
| `projects` | any key the DB accepted | 15 | `id`, `company_id`, `customer_id`, `created_at` |
| `activities` | any | 23 | `id`, `project_id` |
| `risks` | any | 12 | `id`, `project_id` |
| `issues` | any | 12 | `id`, `project_id` |
| `meetings` | any | 6 | `id`, `project_id` |
| `team_members` | any | 6 | `id`, `project_id` |
| `escalation_levels` | any | 6 | `id`, `project_id` |

No column that the current code persists was dropped from any allowlist. The
only intentional removals are identity and tenancy columns, each listed above
with its reason.
