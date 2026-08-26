import { runFix } from './run-sql-fix';

// Fix existing Jira-imported activities: set parent_id for children whose phase
// matches an Epic's phase. Only runs when there is exactly one Epic in the
// phase (safe, idempotent — parent_id IS NULL guard). One-off replacement for
// the boot-time data fix that previously lived in lib/db.ts migratePostgresSchema.
runFix({
  name: '04-activities-jira-parent-repair',
  sql: `UPDATE activities a
     SET parent_id = e.id
     FROM activities e
     WHERE a.project_id = e.project_id
       AND a.phase = e.phase
       AND a.id != e.id
       AND a.parent_id IS NULL
       AND e.no = 'EPIC'
       AND a.no != 'EPIC'
       AND NOT EXISTS (
         SELECT 1 FROM activities e2
         WHERE e2.project_id = e.project_id
           AND e2.phase = e.phase
           AND e2.no = 'EPIC'
           AND e2.id != e.id
       )`,
}).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
