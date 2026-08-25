import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertCompanyWrite,
  getCompanyWeeklyConfigRepo,
  upsertCompanyWeeklyConfigRepo,
  createPeriodWithShellsRepo,
  listWeeklyPeriodsRepo,
  auditLogFn,
} = vi.hoisted(() => ({
  assertCompanyWrite: vi.fn(),
  getCompanyWeeklyConfigRepo: vi.fn(),
  upsertCompanyWeeklyConfigRepo: vi.fn(),
  createPeriodWithShellsRepo: vi.fn(),
  listWeeklyPeriodsRepo: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('./access', () => ({
  assertCompanyWrite,
  isCpmo: (actor: { roles?: string[] }) => actor.roles?.includes('cpmo') ?? false,
}));
vi.mock('@/lib/repositories/weekly-periods.repo', () => ({
  getCompanyWeeklyConfig: getCompanyWeeklyConfigRepo,
  upsertCompanyWeeklyConfig: upsertCompanyWeeklyConfigRepo,
  createPeriodWithShells: createPeriodWithShellsRepo,
  listWeeklyPeriods: listWeeklyPeriodsRepo,
}));
vi.mock('./audit.service', () => ({ auditLog: auditLogFn }));

import {
  createWeeklyPeriod,
  getCompanyWeeklyConfig,
  isWeeklyReportOverdue,
  listWeeklyPeriods,
  upsertCompanyWeeklyConfig,
} from './weekly-reports.service';
import { ConflictError, ForbiddenError } from './errors';
import type { AccessActor } from './access';

const cpmoActor: AccessActor = {
  company_id: 5,
  is_admin: 0,
  roles: ['cpmo'],
  status: 'active',
  user_id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  email: 'cpmo@acme.com',
};

const pmActor: AccessActor = {
  ...cpmoActor,
  roles: ['pm'],
  user_id: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  assertCompanyWrite.mockImplementation(() => undefined);
  getCompanyWeeklyConfigRepo.mockResolvedValue(null);
});

describe('createWeeklyPeriod', () => {
  it('calls assertCompanyWrite before insert and auditLog on success (D-13, D-14)', async () => {
    const period = {
      id: 10,
      iso_week: '2026-W01',
      display_name: '2026-W01 | 2025-12-29 – 2026-01-04',
      due_at: '2026-01-02T18:00:00.000Z',
      config_snapshot: { due_weekday: 5, due_time_utc: '18:00:00', obligation_rule_version: 1 },
      shells: [{ id: 1, project_id: 100, status: 'not_submitted' }],
    };
    createPeriodWithShellsRepo.mockResolvedValue(period);

    const result = await createWeeklyPeriod(cpmoActor, { iso_week: '2026-W01' });

    expect(assertCompanyWrite).toHaveBeenCalledWith(cpmoActor);
    expect(createPeriodWithShellsRepo).toHaveBeenCalled();
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 1,
        company_id: 5,
        entity_type: 'weekly_period',
        action: 'create',
      }),
    );
    expect(result.display_name).toBe('2026-W01 | 2025-12-29 – 2026-01-04');
    expect(result.shells).toHaveLength(1);
  });

  it('throws ForbiddenError without writing when assertCompanyWrite fails (D-13)', async () => {
    assertCompanyWrite.mockImplementation(() => {
      throw new ForbiddenError();
    });

    await expect(createWeeklyPeriod(pmActor, { iso_week: '2026-W01' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(createPeriodWithShellsRepo).not.toHaveBeenCalled();
    expect(auditLogFn).not.toHaveBeenCalled();
  });

  it('throws ConflictError on duplicate iso_week (D-02)', async () => {
    createPeriodWithShellsRepo.mockRejectedValue(Object.assign(new Error('duplicate'), { code: '23505' }));

    await expect(createWeeklyPeriod(cpmoActor, { iso_week: '2026-W01' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe('listWeeklyPeriods', () => {
  it('returns company-scoped periods newest iso_week first (D-13)', async () => {
    listWeeklyPeriodsRepo.mockResolvedValue([
      { id: 2, iso_week: '2026-W02' },
      { id: 1, iso_week: '2026-W01' },
    ]);

    const rows = await listWeeklyPeriods(cpmoActor);
    expect(listWeeklyPeriodsRepo).toHaveBeenCalledWith(5);
    expect(rows[0].iso_week).toBe('2026-W02');
  });

  it('throws ForbiddenError when company_id is null', async () => {
    await expect(
      listWeeklyPeriods({ ...cpmoActor, company_id: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('getCompanyWeeklyConfig', () => {
  it('returns defaults when no row exists (D-03)', async () => {
    getCompanyWeeklyConfigRepo.mockResolvedValue(null);
    const config = await getCompanyWeeklyConfig(cpmoActor);
    expect(config).toEqual({ due_weekday: 5, due_time_utc: '18:00:00' });
  });
});

describe('upsertCompanyWeeklyConfig', () => {
  it('calls assertCompanyWrite and upserts config only (PERD-02)', async () => {
    await upsertCompanyWeeklyConfig(cpmoActor, { due_weekday: 4, due_time_utc: '17:00:00' });
    expect(assertCompanyWrite).toHaveBeenCalledWith(cpmoActor);
    expect(upsertCompanyWeeklyConfigRepo).toHaveBeenCalledWith(5, {
      due_weekday: 4,
      due_time_utc: '17:00:00',
      updated_by: 1,
    });
  });

  it('does not touch weekly_periods when config changes (D-03, PERD-02)', async () => {
    await upsertCompanyWeeklyConfig(cpmoActor, { due_weekday: 1, due_time_utc: '12:00:00' });
    expect(createPeriodWithShellsRepo).not.toHaveBeenCalled();
  });
});

describe('isWeeklyReportOverdue', () => {
  const dueAt = new Date('2026-01-02T18:00:00.000Z');

  it('is true for not_submitted when now is after due_at (D-05, PERD-03)', () => {
    expect(isWeeklyReportOverdue('not_submitted', dueAt, new Date('2026-01-03T00:00:00.000Z'))).toBe(
      true,
    );
  });

  it('is true for draft when now is after due_at', () => {
    expect(isWeeklyReportOverdue('draft', dueAt, new Date('2026-01-03T00:00:00.000Z'))).toBe(true);
  });

  it('is false for submitted even when now is after due_at (D-05)', () => {
    expect(isWeeklyReportOverdue('submitted', dueAt, new Date('2026-01-03T00:00:00.000Z'))).toBe(
      false,
    );
  });

  it('is false when now is before due_at', () => {
    expect(isWeeklyReportOverdue('not_submitted', dueAt, new Date('2026-01-01T00:00:00.000Z'))).toBe(
      false,
    );
  });
});
