import { getDb } from '@/lib/db';

const SELECT = `SELECT tm.*, p.name as project_name, p.id as project_id,
                 p.start_date, p.end_date, p.current_phase, p.client
          FROM team_members tm
          JOIN projects p ON p.id = tm.project_id`;

const ORDER = 'ORDER BY tm.domain, tm.name, p.name';

/**
 * Every team member across projects in the caller's company (D-13, D-24).
 */
export async function listResourceMembers(companyId: number | null) {
  const db = await getDb();
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
        WHERE p.company_id IS NULL
          AND (p.customer_id IS NULL OR c.company_id IS NULL)
        ${ORDER}`,
  );
}
