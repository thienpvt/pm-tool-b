# Stack Research

**Domain:** Bank PPM / Portfolio One View (v2.0 on brownfield Next.js app)
**Researched:** 2026-08-25
**Confidence:** HIGH (additive stack on validated v1.0 base; one new runtime dep)

## Scope

v1.0 stack is **fixed and validated** — do not replace Next.js 16.2.4, React 19.2.4, TypeScript strict, PostgreSQL via `pg`, Vitest 4, Zod, exceljs, pptxgenjs, docx, Anthropic SDK, Jira/Resend clients, scrypt sessions, or route → service → repository layers.

This document covers **additions and schema-level changes** for PR-01..PR-15 + TENANT-01 only.

## Recommended Stack

### Core Technologies (unchanged)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.4 | App Router, API routes, standalone deploy | Already validated; v2.0 extends routes/services, not framework |
| React | 19.2.4 | UI for dashboards, weekly-report flows | Already validated; decomposed page modules from v1.0 reuse |
| PostgreSQL | 15+ (hosting) | Multi-tenant master data, snapshots, audit | Spec needs relational integrity, UNIQUE constraints, immutability via CHECK/trigger |
| `pg` | ^8.20.0 (8.23.0 latest) | DB driver | Already wired through `lib/db.ts`; JSONB auto-parse, BIGINT-as-string is the right VND pattern |
| Zod | ^4.4.3 | Boundary validation | Already direct dep + used in `withAuth` schemas; extend for roles, email, Confluence URLs |
| Node `crypto` | stdlib | scrypt passwords, session IDs | Already in `lib/auth.ts`; account lock = status column + invalidate sessions, no new auth lib |

### New Runtime Dependency

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | ^4.4.0 | Report period math | CPMO weekly-period config (PR-10), fiscal-year labels (PR-08), ISO week IDs for submitted snapshots (PR-11). Replaces ad-hoc `Date` math in `getWeekBounds()` (`lib/services/project-report.service.ts`) with `startOfWeek` / `endOfWeek` (`weekStartsOn: 1` = Monday), `getISOWeek`, `format(..., 'yyyy-MM-dd')`. Import individual functions only — tree-shaking keeps standalone bundle lean. |

**Why date-fns and not more:** The app already hand-rolls week boundaries; v2.0 adds CPMO-configurable periods, overlap validation, and fiscal-year grouping. One small date library beats copying ISO-week edge cases into three services. **Do not add `@date-fns/tz`** unless period boundaries must flip at Asia/Ho_Chi_Minh midnight — store report periods as PostgreSQL `DATE` (date-only strings `yyyy-MM-dd`) and timezone stays a non-issue.

### PostgreSQL Schema Patterns (no npm — apply in `lib/db.ts` migrations)

| Pattern | Columns / types | PR coverage | Why |
|---------|-----------------|-------------|-----|
| Multi-role union | `user_roles(user_id, role TEXT CHECK (role IN ('cpmo','pm','viewer')), company_id)` | PR-01, PR-02 | Spec requires role union, not single `is_admin` flag; query `ARRAY_AGG` or join in session load |
| Account lifecycle | `users.status TEXT`, `users.email TEXT UNIQUE`, `failed_login_count`, `locked_at` | PR-01, PR-02 | Active/Inactive/Locked + unique username/email are DB constraints + service rules; soft-delete via status, never `DELETE` |
| VND integers | `BIGINT` (not `NUMERIC(15,2)`) on budget/benefit columns | PR-08 | Spec: VND whole dong; migrate existing `NUMERIC` columns. `pg` returns BIGINT as **string** by default — keep amounts as `string` in TS or use native `BigInt` for ROI math; **do not** set `pg.defaults.parseInt8 = true` (loses precision above `Number.MAX_SAFE_INTEGER`) |
| Fiscal year | `fiscal_year SMALLINT`, `period_start DATE`, `period_end DATE` | PR-08, PR-10 | Filter/group in SQL; ROI formulas in pure TS service functions |
| Weekly report versioning | `weekly_report_periods`, `weekly_report_submissions(status draft\|submitted, version INT, submitted_at)` | PR-10, PR-11 | Period config separate from submission state machine |
| Immutable snapshots | `weekly_report_snapshots(submission_id, payload JSONB)` + `CHECK (true)` + revoke UPDATE/DELETE via app + optional PG trigger | PR-07, PR-09, PR-11 | On submit: `INSERT` copy of RAID/milestones/highlights into JSONB; never UPDATE submitted rows |
| RAID master + snapshot | Keep live `risks`/`issues`; add `weekly_raid_snapshots(submission_id, risk_id, …)` or embed in JSONB payload | PR-09 | Master register editable until submit; snapshot frozen with report version |
| Audit log | `audit_logs(id BIGSERIAL, company_id, actor_id, entity_type, entity_id, action, before JSONB, after JSONB, created_at)` append-only | All mutations | No ORM/trigger framework — single `auditLog()` in service layer after successful write |
| Document checklist | `document_templates(company_id, …)`, `project_document_links(project_id, template_id, confluence_url TEXT, …)` | PR-15 | Metadata + HTTPS link only; no blob storage |
| Tenant mapping | `company_id INTEGER NOT NULL` on `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, `jira_sync_mappings` | TENANT-01 | FK + index; filter in existing Jira/import repos |

### Supporting Libraries (existing — extend usage, do not add alternatives)

| Library | Version | v2.0 use | Integration point |
|---------|---------|----------|-------------------|
| Zod | ^4.4.3 | `z.enum(['cpmo','pm','viewer'])`, `z.array(roleEnum).min(1)`, `z.email()`, `z.url({ protocol: /^https?$/ })` for Confluence | Route schemas + `withAuth({ schema })`; uniqueness enforced by PG `23505` catch in user service, not Zod |
| `exceljs` | ^4.4.0 | CPMO consolidated export (PR-12) | Existing export routes; add workbook sheet from submitted snapshot JSONB |
| `pptxgenjs` / `docx` | ^4.0.1 / ^9.6.1 | Optional formatted exports | Same pattern as v1.0 portfolio report export |
| `recharts` | ^3.8.1 | Portfolio/PM dashboards RAG, stage, RAID counts (PR-13, PR-14) | Already installed; aggregate queries in new dashboard services |
| Vitest | 4.1.10 | RBAC 403 matrix, snapshot immutability, BIGINT ROI edge cases | Extend existing service/route test harness; no new test libs |
| Anthropic SDK | ^0.92.0 | Keep AI report generation alongside spec weekly reports | Parallel path — spec submit/export is authoritative for compliance |

### Development Tools (unchanged)

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest 4 + RTL | Regression gate for new RBAC and snapshot rules | HYG-03: capability not done until tests pass |
| ESLint (eslint-config-next 16.2.4) | Lint | ENF-01 still deferred — no new lint wrapper |

## Integration Architecture

### Authorization (PR-01, PR-02) — extend, do not replace

```
Session load → SessionUser { id, company_id, roles: Role[], status }
withAuth → withRole(['cpmo']) / withProjectAccess → assertProjectAccess + assertPmOrViewer
```

- **Extend** `SessionUser` and `AccessActor` in `lib/auth.ts` / `lib/services/access.ts` — map `is_admin` to `cpmo` during migration, then deprecate boolean.
- **CPMO** = company-scoped admin (period config, user CRUD, portfolio dashboard, submission tracking).
- **PM** = `assertProjectAccess` + PM assignment row (primary or collaborating).
- **Viewer** = read-only project access via assignment or company portfolio visibility.
- Multi-role union = OR of permitted actions in service layer; **no** `@casl/ability`, `accesscontrol`, or `casbin` — three fixed roles with project scoping fit ~50 lines of `hasRole()` / `assertRole()` better than a policy engine.

### Weekly report flow (PR-10..PR-12)

1. CPMO creates `weekly_report_periods` (date-fns validates non-overlap).
2. PM saves draft → UPDATE mutable draft row only.
3. PM submits → service copies master RAID/milestones/highlights into JSONB snapshot, bumps `version`, sets `status = submitted`; subsequent edits create new draft version, never mutate submitted snapshot.
4. CPMO export reads snapshot JSONB → exceljs (existing client).

### Budget & ROI (PR-08)

- Store amounts as `BIGINT`; expose as string in API JSON to avoid JS float corruption.
- ROI / benefit-cost formulas in `lib/services/budget-value.service.ts` using `BigInt` or integer arithmetic on parsed strings.
- Adjustment history = append-only `budget_adjustments` table (mirrors audit pattern).

### Audit (cross-cutting)

- Call `auditLog({ actor, entity, action, before, after })` at end of successful service mutators (users, projects, budget, RAID, submissions).
- `before`/`after` as JSONB — full row snapshot, not diff library. Query by `company_id`, `entity_type`, `created_at`.

## Installation

```bash
# Only new runtime dependency for v2.0
npm install date-fns@^4.4.0

# Everything else already in package.json — verify pins, do not reinstall:
# next@16.2.4 react@19.2.4 pg@^8.20.0 zod@^4.4.3 exceljs pptxgenjs docx recharts vitest
```

Optional patch (non-blocking): `npm install pg@^8.23.0` for driver fixes — no API change required for v2.0 features.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| App-level RBAC (`assertRole`, extend `withAuth`) | CASL / accesscontrol / casbin | Never for v2.0 — 3 roles + project assignment; libraries add policy DSL and client/server sync with no spec requirement |
| `date-fns` for period math | Native `Date` (current `getWeekBounds`) | Only if v2.0 drops configurable periods — spec requires CPMO-defined windows and fiscal grouping |
| PostgreSQL JSONB snapshots | Event-sourcing library (EventStore, etc.) | Never — weekly report snapshots are bounded, read-heavy, export-oriented |
| BIGINT + string/BigInt in TS | `decimal.js` / `dinero.js` | Never — spec is integer VND, not fractional currency |
| Service-layer `auditLog()` | DB triggers only / `audit-log` npm | Triggers alone miss actor context from session; npm adds no value over one INSERT helper |
| Zod v4 at boundaries | Valibot / ArkType | Never — already direct dep, Anthropic SDK peer accepts v4, schemas shared across routes |
| Column allowlist repos (v1.0) | Kysely (v1.0 optional, still deferred) | Still deferred per PROJECT.md — allowlists remain the minimum for v2.0 new tables |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@casl/ability`, `accesscontrol`, `casbin` | Over-engineered for 3 static roles; project-scoped checks stay clearer in `lib/services/access.ts` | `assertRole()`, extend `withProjectAccess` |
| `next-auth` / Passport / Lucia | Replacing working scrypt + DB sessions is out of scope and risks tenant regression | Extend `lib/auth.ts` session payload with roles + lock check |
| `multer`, `sharp`, S3 SDK | PR-15 explicitly forbids project file upload; Confluence links only | `z.url()` + `project_document_links` table |
| `json-diff`, `fast-json-patch` | Audit/snapshot consumers read full JSONB; diffing adds complexity | Store complete `before`/`after` JSONB rows |
| `decimal.js`, `dinero.js`, `currency.js` | VND integers — floats are wrong | PostgreSQL `BIGINT` + string/BigInt in services |
| `node-cron`, Bull, pg-boss | No background job requirement in spec | Submit/export runs synchronously in route handler |
| `uuid` package | Session IDs already use `crypto.randomBytes` | Node `crypto` stdlib |
| Prisma / Drizzle / Kysely migration | Conflicts with `pg` + `lib/db.ts` bridge constraint | Raw SQL in repositories + column allowlists |
| `@date-fns/tz` | Periods stored as `DATE`; week boundaries computed in UTC date-only | `date-fns` core + `yyyy-MM-dd` strings |
| Replacing `recharts` with Chart.js/D3 | Dashboard charts already on recharts | Extend existing chart components |

## Stack Patterns by Variant

**If CPMO configures Monday–Sunday report weeks:**
- Use `startOfWeek(date, { weekStartsOn: 1 })` / `endOfWeek` from date-fns.
- Persist `period_start` / `period_end` as `DATE` in PostgreSQL.

**If a user has multiple roles (e.g. CPMO + PM):**
- Load all roles into session; authorization checks use **union** (CPMO wins for company actions; PM wins on assigned projects).
- Do not model as single "active role" — spec says multi-role union.

**If submitted weekly report must be immutable:**
- Application: services throw on UPDATE to `submitted` rows.
- Database: optional `BEFORE UPDATE` trigger on snapshot tables raising exception when `OLD.submission_id` links to submitted parent.

**If VND amount exceeds JS safe integer (~9 quadrillion dong):**
- Keep `pg` default string parser for BIGINT; ROI helpers use `BigInt` arithmetic, serialize back to string for API.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `date-fns@^4.4.0` | Node 20+, Next 16 standalone | ESM-friendly; import `{ startOfWeek } from 'date-fns/startOfWeek'` for minimal bundle |
| `zod@^4.4.3` | `@anthropic-ai/sdk@^0.92.0` | SDK peer accepts `^3.25.0 \|\| ^4.0.0` — no conflict |
| `pg@^8.20.0` | PostgreSQL JSONB/BIGINT | JSONB ↔ object automatic; BIGINT stays string unless `parseInt8` (avoid for money) |
| `exceljs@^4.4.0` | Next `serverExternalPackages` | Already listed in `next.config.ts` — preserve for PR-12 export |
| Vitest 4.1.10 | TypeScript 5 strict | Service tests for RBAC matrix — no config change |

## Sources

- `/brianc/node-postgres` (Context7) — JSONB auto parse/stringify; BIGINT `parseInt8` behavior — **MEDIUM** confidence
- `/colinhacks/zod/v4.0.1` (Context7) — `z.enum`, `z.email()`, `z.url({ protocol })` — **MEDIUM** confidence
- `/date-fns/date-fns` (Context7) — `startOfWeek`, `getISOWeek`, `yyyy-MM-dd` format tokens — **MEDIUM** confidence
- npm registry (2026-08-25): `date-fns@4.4.0`, `pg@8.23.0`, `zod@4.4.3` — version pins verified live
- Codebase: `lib/auth.ts`, `lib/http/with-auth.ts`, `lib/services/access.ts`, `lib/services/project-report.service.ts`, `lib/db.ts`, `package.json` — **HIGH** confidence (local)
- Web (RBAC libraries): CASL/accesscontrol suited to dynamic ABAC — **LOW** confidence; conclusion (skip libraries) cross-checked against fixed 3-role spec — **HIGH** confidence on decision

---
*Stack research for: PM Tool B v2.0 Portfolio One View*
*Researched: 2026-08-25*
