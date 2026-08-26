import { runFix } from './run-sql-fix';

// Mark AI Platform portfolio members as external (they are not internal staff).
// One-off replacement for the boot-time data fix that previously lived in
// lib/db.ts migratePostgresSchema.
runFix({
  name: '02-portfolio-members-member-type',
  sql: `UPDATE portfolio_members SET member_type = 'external' WHERE LOWER(note) LIKE '%ai platform%' AND (member_type IS NULL OR member_type = 'internal')`,
}).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
