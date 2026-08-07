import { getDb } from '@/lib/db';

const SELECT = `SELECT tm.*, p.name as project_name, p.id as project_id,
                 p.start_date, p.end_date, p.current_phase, p.client
          FROM team_members tm
          JOIN projects p ON p.id = tm.project_id`;

const ORDER = 'ORDER BY tm.domain, tm.name, p.name';

/**
 * Every team member across every project the caller can see.
 *
 * Takes the resolved `companyId` and `isAdmin` rather than a session (REPO-02). The three
 * branches match the route's current behavior exactly: admin sees all, a user with a
 * company sees rows whose project or customer matches it, and a user with a null company
 * sees only unassigned rows.
 */
export async function listResourceMembers(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  if (isAdmin) {
    return db.all(`${SELECT} ${ORDER}`);
  }
  if (companyId !== null) {
    return db.all(
      `${SELECT}
          LEFT JOIN customers c ON p.customer_id = c.id
          WHERE (p.company_id = ? OR c.company_id = ?)
          ${ORDER}`,
      companyId, companyId,
    );
  }
  return db.all(
    `${SELECT}
        LEFT JOIN customers c ON p.customer_id = c.id
        WHERE (p.company_id IS NULL OR c.company_id IS NULL)
        ${ORDER}`,
  );
}
