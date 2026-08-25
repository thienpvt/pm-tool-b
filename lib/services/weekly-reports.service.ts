import {
  createPeriodWithShells,
  getCompanyWeeklyConfig as getCompanyWeeklyConfigRepo,
  listWeeklyPeriods as listWeeklyPeriodsRepo,
  upsertCompanyWeeklyConfig as upsertCompanyWeeklyConfigRepo,
} from '@/lib/repositories/weekly-periods.repo';
import { ISO_WEEK_PATTERN } from '@/lib/iso-week';
import { assertCompanyWrite, type AccessActor } from './access';
import { auditLog } from './audit.service';
import { ConflictError, ForbiddenError, ValidationError } from './errors';

const DEFAULT_CONFIG = { due_weekday: 5, due_time_utc: '18:00:00' };

function isPgUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505';
}

export function isWeeklyReportOverdue(
  status: string,
  dueAt: Date | string,
  now: Date,
): boolean {
  if (status !== 'not_submitted' && status !== 'draft') return false;
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  return now.getTime() > due.getTime();
}

export async function getCompanyWeeklyConfig(actor: AccessActor) {
  if (actor.company_id === null) throw new ForbiddenError();
  const row = await getCompanyWeeklyConfigRepo(actor.company_id);
  return row ?? DEFAULT_CONFIG;
}

export async function upsertCompanyWeeklyConfig(
  actor: AccessActor,
  body: { due_weekday: number; due_time_utc: string },
) {
  assertCompanyWrite(actor);
  await upsertCompanyWeeklyConfigRepo(actor.company_id!, {
    due_weekday: body.due_weekday,
    due_time_utc: body.due_time_utc,
    updated_by: actor.user_id,
  });
}

export async function listWeeklyPeriods(actor: AccessActor) {
  if (actor.company_id === null) throw new ForbiddenError();
  return listWeeklyPeriodsRepo(actor.company_id);
}

export async function createWeeklyPeriod(
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  assertCompanyWrite(actor);
  const isoWeek = body.iso_week;
  if (typeof isoWeek !== 'string' || !ISO_WEEK_PATTERN.test(isoWeek)) {
    throw new ValidationError('Invalid iso_week format', 'iso_week');
  }

  try {
    const period = await createPeriodWithShells(actor.company_id!, isoWeek, actor.user_id);
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'weekly_period',
      entity_id: String(period.id),
      action: 'create',
      before: null,
      after: { iso_week: period.iso_week, display_name: period.display_name },
    });
    return period;
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw new ConflictError('Period already exists for this iso_week');
    }
    throw err;
  }
}
