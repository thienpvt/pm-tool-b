import { getDb } from '@/lib/db';

/**
 * Project holidays. Fixed-column writes, so no allowlist is needed — see ALLOWLIST-DIFF.md.
 *
 * `findByDate` exists so the route can keep returning 409 on a duplicate date: the check
 * is a SELECT, so it belongs behind the repository, but the status-code decision stays in
 * the route where it already lives.
 */

export async function listHolidays(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM project_holidays WHERE project_id = ? ORDER BY date ASC', Number(projectId));
}

export async function findHolidayByDate(projectId: number | string, date: string) {
  const db = await getDb();
  return db.get<{ id: number }>(
    'SELECT id FROM project_holidays WHERE project_id = ? AND date = ?',
    Number(projectId), date,
  );
}

export async function createHoliday(projectId: number | string, date: string, name: string) {
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO project_holidays (project_id, date, name) VALUES (?, ?, ?)',
    Number(projectId), date, name,
  );
  return db.get('SELECT * FROM project_holidays WHERE id = ?', r.lastInsertRowid);
}

export async function deleteHoliday(projectId: number | string, holidayId: number | string) {
  const db = await getDb();
  return db.run(
    'DELETE FROM project_holidays WHERE id = ? AND project_id = ?',
    Number(holidayId), Number(projectId),
  );
}
