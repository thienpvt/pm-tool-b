# One-off data fixes

Operator-run DML scripts moved out of `getDb()` boot path (DATA-03, D-02). These are **not** invoked when the app starts — run them manually against a database when brownfield data needs repair.

**Requires:** `DATABASE_URL` (same PostgreSQL connection string as the app).

## Boot-time UPDATE replacements (01–04)

Former `migratePostgresSchema` data fixes, now one-off:

```bash
npx tsx scripts/data-fixes/01-users-onboarding-completed.ts
npx tsx scripts/data-fixes/02-portfolio-members-member-type.ts
npx tsx scripts/data-fixes/03-projects-company-id-sync.ts
npx tsx scripts/data-fixes/04-activities-jira-parent-repair.ts
```

## v2.0 backfills

Settings-flag-guarded backfills (idempotent — safe to re-run; no-ops when flag is set):

```bash
npx tsx scripts/data-fixes/backfill-weighted-completion.ts
npx tsx scripts/data-fixes/backfill-user-roles.ts
npx tsx scripts/data-fixes/backfill-pm-assignments.ts
npx tsx scripts/data-fixes/backfill-raid-masters.ts
npx tsx scripts/data-fixes/backfill-mapping-tenant.ts
```

## Notes

- Schema DDL belongs in `npm run migrate` (`migrations/`), not here.
- RAID backfill DML also appears in `0001-baseline-schema.sql` Part 3 (D-09); the operator script remains useful when flags are unset on brownfield DBs.
- `lib/db.ts` must not import from this directory (enforced in 19-04).
