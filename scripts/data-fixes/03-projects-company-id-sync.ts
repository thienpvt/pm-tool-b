import { runFix } from './run-sql-fix';

// Sync ALL projects' company_id to match their customer's company_id
// (definitive data fix). One-off replacement for the boot-time data fix that
// previously lived in lib/db.ts migratePostgresSchema.
runFix({
  name: '03-projects-company-id-sync',
  sql: `UPDATE projects SET company_id = c.company_id FROM customers c WHERE projects.customer_id = c.id AND c.company_id IS NOT NULL`,
}).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
