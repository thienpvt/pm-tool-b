import { getKysely } from '@/lib/db/kysely';

/**
 * Project holidays. Fixed-column writes, so no allowlist is needed — see ALLOWLIST-DIFF.md.
 *
 * `findByDate` exists so the route can keep returning 409 on a duplicate date: the check
 * is a SELECT, so it belongs behind the repository, but the status-code decision stays in
 * the route where it already lives.
 */

function deleteResult(numDeletedRows: bigint | number | undefined) {
  return { lastInsertRowid: 0, changes: Number(numDeletedRows ?? 0) };
}

export async function listHolidays(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('project_holidays')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('date', 'asc')
    .execute();
}

export async function findHolidayByDate(projectId: number | string, date: string) {
  const db = await getKysely();
  return db
    .selectFrom('project_holidays')
    .select('id')
    .where('project_id', '=', Number(projectId))
    .where('date', '=', date)
    .executeTakeFirst();
}

export async function createHoliday(projectId: number | string, date: string, name: string) {
  const db = await getKysely();
  return db
    .insertInto('project_holidays')
    .values({
      project_id: Number(projectId),
      date,
      name,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteHoliday(projectId: number | string, holidayId: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('project_holidays')
    .where('id', '=', Number(holidayId))
    .where('project_id', '=', Number(projectId))
    .execute();
  return deleteResult(result.numDeletedRows);
}
