import { runFix } from './run-sql-fix';

// Backfill the users onboarding_completed flag for accounts created before the
// onboarding feature shipped. One-off replacement for the boot-time data fix
// that previously lived in lib/db.ts migratePostgresSchema.
runFix({
  name: '01-users-onboarding-completed',
  sql: `UPDATE users SET onboarding_completed = 1 WHERE created_at < '2026-05-08 00:00:00' AND onboarding_completed = 0`,
}).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
