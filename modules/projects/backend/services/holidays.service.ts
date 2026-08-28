import {
  createHoliday as createHolidayRepo,
  deleteHoliday as deleteHolidayRepo,
  findHolidayByDate,
  listHolidays as listHolidaysRepo,
} from '@/modules/projects/backend/repositories/holidays.repo';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from '@/lib/services/access';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/services/errors';

export async function listHolidays(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listHolidaysRepo(projectId);
}

export async function createHoliday(
  projectId: number | string,
  actor: AccessActor,
  date: string | undefined,
  name: string,
) {
  await assertProjectWriteAccess(projectId, actor);
  if (!date) throw new ValidationError('date required', 'date');
  if (await findHolidayByDate(projectId, date)) {
    throw new ConflictError('date already exists');
  }
  return createHolidayRepo(projectId, date, name);
}

export async function deleteHoliday(
  projectId: number | string,
  actor: AccessActor,
  holidayId: string | null,
) {
  await assertProjectWriteAccess(projectId, actor);
  if (!holidayId) throw new ValidationError('hid required', 'hid');
  const result = await deleteHolidayRepo(projectId, holidayId);
  if (!result || Number(result.changes ?? 0) === 0) {
    throw new NotFoundError('Not found', 'holiday');
  }
  return result;
}
