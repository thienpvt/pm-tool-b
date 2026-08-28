import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertCompanyWrite,
  assertProjectAccess,
  assertProjectWriteAccess,
  getCompanyWeeklyConfigRepo,
  upsertCompanyWeeklyConfigRepo,
  createPeriodWithShellsRepo,
  listWeeklyPeriodsRepo,
  auditLogFn,
  getWeeklyReportFullRow,
  getWeeklyReportWithPeriod,
  updateWeeklyReportDraft,
  updatePrevWeekRag,
  getPriorPeriodSubmittedRag,
  insertWeeklyReportVersion,
  lockWeeklyReportShell,
  finalizeWeeklyReportSubmit,
  openCorrectionOnShell,
  getLatestVersionSnapshot,
  listProjectWeeklyHistoryRepo,
  getWeeklyPeriodByCompanyRepo,
  listPeriodShellsRepo,
  getProjectRepo,
  updateProjectRepo,
  getMilestoneRepo,
  getRiskRepo,
  getIssueRepo,
  createRiskFn,
  updateRiskFn,
  createIssueFn,
  updateIssueFn,
  runInTransaction,
} = vi.hoisted(() => ({
  assertCompanyWrite: vi.fn(),
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  getCompanyWeeklyConfigRepo: vi.fn(),
  upsertCompanyWeeklyConfigRepo: vi.fn(),
  createPeriodWithShellsRepo: vi.fn(),
  listWeeklyPeriodsRepo: vi.fn(),
  auditLogFn: vi.fn(),
  getWeeklyReportFullRow: vi.fn(),
  getWeeklyReportWithPeriod: vi.fn(),
  updateWeeklyReportDraft: vi.fn(),
  updatePrevWeekRag: vi.fn(),
  getPriorPeriodSubmittedRag: vi.fn(),
  insertWeeklyReportVersion: vi.fn(),
  lockWeeklyReportShell: vi.fn(),
  finalizeWeeklyReportSubmit: vi.fn(),
  openCorrectionOnShell: vi.fn(),
  getLatestVersionSnapshot: vi.fn(),
  listProjectWeeklyHistoryRepo: vi.fn(),
  getWeeklyPeriodByCompanyRepo: vi.fn(),
  listPeriodShellsRepo: vi.fn(),
  getProjectRepo: vi.fn(),
  updateProjectRepo: vi.fn(),
  getMilestoneRepo: vi.fn(),
  getRiskRepo: vi.fn(),
  getIssueRepo: vi.fn(),
  createRiskFn: vi.fn(),
  updateRiskFn: vi.fn(),
  createIssueFn: vi.fn(),
  updateIssueFn: vi.fn(),
  runInTransaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn({})),
}));

vi.mock('./access', () => ({
  assertCompanyWrite,
  assertProjectAccess: (...args: unknown[]) => assertProjectAccess(...args),
  assertProjectWriteAccess: (...args: unknown[]) => assertProjectWriteAccess(...args),
  isCpmo: (actor: { roles?: string[] }) => actor.roles?.includes('cpmo') ?? false,
}));
vi.mock('@/lib/repositories/weekly-periods.repo', () => ({
  getCompanyWeeklyConfig: getCompanyWeeklyConfigRepo,
  upsertCompanyWeeklyConfig: upsertCompanyWeeklyConfigRepo,
  createPeriodWithShells: createPeriodWithShellsRepo,
  listWeeklyPeriods: listWeeklyPeriodsRepo,
}));
vi.mock('@/lib/repositories/weekly-reports.repo', () => ({
  getWeeklyReportFullRow,
  getWeeklyReportWithPeriod,
  updateWeeklyReportDraft,
  updatePrevWeekRag,
  getPriorPeriodSubmittedRag,
  insertWeeklyReportVersion,
  lockWeeklyReportShell,
  finalizeWeeklyReportSubmit,
  openCorrectionOnShell,
  getLatestVersionSnapshot,
  listProjectWeeklyHistoryRepo,
  getWeeklyPeriodByCompany: getWeeklyPeriodByCompanyRepo,
  listPeriodShellsRepo,
}));
vi.mock('@/lib/db', () => ({
  runInTransaction,
}));
vi.mock('@/lib/repositories/projects.repo', () => ({
  getProject: getProjectRepo,
  updateProject: updateProjectRepo,
}));
vi.mock('@/lib/repositories/milestones.repo', () => ({
  getMilestone: getMilestoneRepo,
}));
vi.mock('@/lib/repositories/risks.repo', () => ({
  getRisk: getRiskRepo,
}));
vi.mock('@/lib/repositories/issues.repo', () => ({
  getIssue: getIssueRepo,
}));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: auditLogFn }));
vi.mock('./risks.service', () => ({
  createRisk: createRiskFn,
  updateRisk: updateRiskFn,
}));
vi.mock('./issues.service', () => ({
  createIssue: createIssueFn,
  updateIssue: updateIssueFn,
}));

import {
  createWeeklyPeriod,
  getCompanyWeeklyConfig,
  getWeeklyReportShell,
  isWeeklyReportOverdue,
  listProjectWeeklyHistory,
  listPeriodShells,
  listWeeklyPeriods,
  openWeeklyReportCorrection,
  saveWeeklyReportDraft,
  submitWeeklyReport,
  upsertCompanyWeeklyConfig,
} from './weekly-reports.service';
import { ConflictError, ForbiddenError, NotFoundError, SubmitValidationError } from './errors';
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

const baseShell = {
  id: 10,
  period_id: 1,
  project_id: 100,
  status: 'not_submitted',
  first_submitted_at: null,
  first_lateness: null,
  latest_version: 0,
  correction_open: false,
  highlights: null,
  completed_work: null,
  next_week_goals: null,
  nearest_milestone: null,
  nearest_milestone_id: null,
  raid_dependency: null,
  leadership_support: null,
  this_week_rag: null,
  prev_week_rag: null,
  draft_raid_json: null,
  iso_week: '2026-W02',
  due_at: '2026-01-09T18:00:00.000Z',
  display_name: '2026-W02 | 2026-01-05 – 2026-01-11',
  company_id: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
  assertCompanyWrite.mockImplementation(() => undefined);
  assertProjectAccess.mockResolvedValue({ company_id: 5, customer_company_id: null });
  assertProjectWriteAccess.mockResolvedValue(undefined);
  getCompanyWeeklyConfigRepo.mockResolvedValue(null);
  getPriorPeriodSubmittedRag.mockResolvedValue(null);
  getProjectRepo.mockResolvedValue({ rag: 'Green' });
  updatePrevWeekRag.mockResolvedValue(undefined);
  lockWeeklyReportShell.mockResolvedValue({
    id: 10,
    latest_version: 0,
    status: 'draft',
    correction_open: false,
    first_submitted_at: null,
    first_lateness: null,
  });
  insertWeeklyReportVersion.mockResolvedValue({});
  finalizeWeeklyReportSubmit.mockResolvedValue({});
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

describe('saveWeeklyReportDraft', () => {
  it('does not call repo when assertProjectWriteAccess rejects (D-13, WKRP-02)', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());

    await expect(
      saveWeeklyReportDraft(100, 10, pmActor, { highlights: 'hi' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(getWeeklyReportFullRow).not.toHaveBeenCalled();
    expect(updateWeeklyReportDraft).not.toHaveBeenCalled();
  });

  it('first PATCH of highlights sets status draft (D-06, WKRP-02)', async () => {
    getWeeklyReportFullRow.mockResolvedValue({ ...baseShell });
    updateWeeklyReportDraft.mockResolvedValue({ ...baseShell, status: 'draft', highlights: 'hi' });
    getWeeklyReportWithPeriod.mockResolvedValue({
      ...baseShell,
      status: 'draft',
      highlights: 'hi',
      prev_week_rag: 'Green',
    });

    await saveWeeklyReportDraft(100, 10, pmActor, { highlights: 'hi' });

    expect(assertProjectWriteAccess).toHaveBeenCalledWith(100, pmActor);
    expect(updateWeeklyReportDraft).toHaveBeenCalledWith(
      100,
      10,
      expect.objectContaining({ highlights: 'hi', status: 'draft' }),
    );
  });

  it('PATCH including prev_week_rag leaves stored prev_week_rag unchanged (D-07, WKRP-03)', async () => {
    getWeeklyReportFullRow.mockResolvedValue({ ...baseShell, prev_week_rag: 'Amber' });
    updateWeeklyReportDraft.mockResolvedValue({ ...baseShell, status: 'draft', highlights: 'x' });
    getWeeklyReportWithPeriod.mockResolvedValue({
      ...baseShell,
      status: 'draft',
      prev_week_rag: 'Amber',
    });

    await saveWeeklyReportDraft(100, 10, pmActor, {
      highlights: 'x',
      prev_week_rag: 'Red',
    });

    expect(updateWeeklyReportDraft).toHaveBeenCalledWith(
      100,
      10,
      expect.not.objectContaining({ prev_week_rag: expect.anything() }),
    );
  });

  it('draft_raid_json PATCH does not invoke risks or issues services (D-11)', async () => {
    getWeeklyReportFullRow.mockResolvedValue({ ...baseShell });
    updateWeeklyReportDraft.mockResolvedValue({
      ...baseShell,
      status: 'draft',
      draft_raid_json: { risks: [] },
    });
    getWeeklyReportWithPeriod.mockResolvedValue({
      ...baseShell,
      status: 'draft',
      draft_raid_json: { risks: [] },
      prev_week_rag: 'Green',
    });

    await saveWeeklyReportDraft(100, 10, pmActor, {
      draft_raid_json: { risks: [{ id: 'new', title: 'x' }] },
    });

    expect(createRiskFn).not.toHaveBeenCalled();
    expect(updateRiskFn).not.toHaveBeenCalled();
    expect(createIssueFn).not.toHaveBeenCalled();
    expect(updateIssueFn).not.toHaveBeenCalled();
  });

  it('throws ConflictError on submitted shell with correction_open false (D-08)', async () => {
    getWeeklyReportFullRow.mockResolvedValue({
      ...baseShell,
      status: 'submitted',
      correction_open: false,
    });

    await expect(
      saveWeeklyReportDraft(100, 10, pmActor, { highlights: 'nope' }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(updateWeeklyReportDraft).not.toHaveBeenCalled();
  });
});

describe('getWeeklyReportShell', () => {
  it('prefills prev_week_rag from projects.rag when no prior submitted version (D-07)', async () => {
    getWeeklyReportWithPeriod.mockResolvedValue({ ...baseShell, prev_week_rag: null });
    getPriorPeriodSubmittedRag.mockResolvedValue(null);
    getProjectRepo.mockResolvedValue({ rag: 'Amber' });

    const shell = await getWeeklyReportShell(100, pmActor, 10);

    expect(updatePrevWeekRag).toHaveBeenCalledWith(100, 10, 'Amber');
    expect(shell.prev_week_rag).toBe('Amber');
  });

  it('uses prior period submitted version rag when available (D-07)', async () => {
    getWeeklyReportWithPeriod.mockResolvedValue({ ...baseShell, prev_week_rag: null });
    getPriorPeriodSubmittedRag.mockResolvedValue('Red');

    const shell = await getWeeklyReportShell(100, pmActor, 10);

    expect(getProjectRepo).not.toHaveBeenCalled();
    expect(shell.prev_week_rag).toBe('Red');
  });
});

describe('submitWeeklyReport', () => {
  it('inserts version 1 and sets first_lateness on_time when before due_at (D-08, WKRP-04)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-08T12:00:00.000Z'));

    getWeeklyReportWithPeriod.mockResolvedValue({
      ...baseShell,
      status: 'draft',
      this_week_rag: 'Green',
      prev_week_rag: 'Amber',
    });
    finalizeWeeklyReportSubmit.mockResolvedValue({
      ...baseShell,
      status: 'submitted',
      latest_version: 1,
      first_submitted_at: '2026-01-08T12:00:00.000Z',
      first_lateness: 'on_time',
    });
    getWeeklyReportWithPeriod.mockResolvedValueOnce({
      ...baseShell,
      status: 'draft',
      this_week_rag: 'Green',
      prev_week_rag: 'Amber',
    });
    getWeeklyReportWithPeriod.mockResolvedValue({
      ...baseShell,
      status: 'submitted',
      latest_version: 1,
      this_week_rag: 'Green',
      prev_week_rag: 'Amber',
      first_submitted_at: '2026-01-08T12:00:00.000Z',
      first_lateness: 'on_time',
    });

    await submitWeeklyReport(100, 10, pmActor);

    expect(insertWeeklyReportVersion).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1, rag: 'Green' }),
    );
    expect(finalizeWeeklyReportSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ latestVersion: 1, firstLateness: 'on_time' }),
    );
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'weekly_submit' }),
    );

    vi.useRealTimers();
  });

  it('allows late submit and sets first_lateness late (D-05, PERD-03)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-12T12:00:00.000Z'));

    getWeeklyReportWithPeriod
      .mockResolvedValueOnce({
        ...baseShell,
        status: 'draft',
        this_week_rag: 'Amber',
        prev_week_rag: 'Green',
      })
      .mockResolvedValue({
        ...baseShell,
        status: 'submitted',
        this_week_rag: 'Amber',
        prev_week_rag: 'Green',
        first_lateness: 'late',
      });
    finalizeWeeklyReportSubmit.mockResolvedValue({});

    await submitWeeklyReport(100, 10, pmActor);

    expect(finalizeWeeklyReportSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ firstLateness: 'late' }),
    );

    vi.useRealTimers();
  });

  it('correction submit inserts version 2 with weekly_correct audit (D-08, WKRP-05)', async () => {
    lockWeeklyReportShell.mockResolvedValue({
      id: 10,
      latest_version: 1,
      status: 'submitted',
      correction_open: true,
      first_submitted_at: '2026-01-08T12:00:00.000Z',
      first_lateness: 'on_time',
    });
    getWeeklyReportWithPeriod
      .mockResolvedValueOnce({
        ...baseShell,
        status: 'submitted',
        correction_open: true,
        this_week_rag: 'Red',
        prev_week_rag: 'Amber',
        latest_version: 1,
        first_submitted_at: '2026-01-08T12:00:00.000Z',
        first_lateness: 'on_time',
      })
      .mockResolvedValue({
        ...baseShell,
        status: 'submitted',
        latest_version: 2,
        first_lateness: 'on_time',
        first_submitted_at: '2026-01-08T12:00:00.000Z',
      });
    finalizeWeeklyReportSubmit.mockResolvedValue({});

    await submitWeeklyReport(100, 10, pmActor);

    expect(insertWeeklyReportVersion).toHaveBeenCalledWith(
      expect.objectContaining({ version: 2 }),
    );
    expect(finalizeWeeklyReportSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        latestVersion: 2,
        firstSubmittedAt: '2026-01-08T12:00:00.000Z',
        firstLateness: 'on_time',
      }),
    );
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'weekly_correct' }),
    );
  });

  it('throws SubmitValidationError on invalid new RAID description without createRisk or version insert (D-11, RAID-03)', async () => {
    getWeeklyReportWithPeriod.mockResolvedValue({
      ...baseShell,
      status: 'draft',
      this_week_rag: 'Green',
      prev_week_rag: 'Amber',
      draft_raid_json: {
        risks: [{ id: 'new', fields: { description: '  ' } }],
        issues: [],
      },
    });

    await expect(submitWeeklyReport(100, 10, pmActor)).rejects.toBeInstanceOf(
      SubmitValidationError,
    );
    expect(createRiskFn).not.toHaveBeenCalled();
    expect(insertWeeklyReportVersion).not.toHaveBeenCalled();
  });

  it('calls createRisk and stores returned row in snapshot.raid.risks (D-11, RAID-02)', async () => {
    const createdRisk = { id: 99, description: 'New risk', status: 'Open' };
    createRiskFn.mockResolvedValue(createdRisk);
    getRiskRepo.mockResolvedValue(createdRisk);
    getProjectRepo.mockResolvedValue({ rag: 'Green', progress_pct: 42 });

    getWeeklyReportWithPeriod
      .mockResolvedValueOnce({
        ...baseShell,
        status: 'draft',
        this_week_rag: 'Green',
        prev_week_rag: 'Amber',
        draft_raid_json: {
          risks: [{ id: 'new', fields: { description: 'New risk' } }],
          issues: [],
        },
      })
      .mockResolvedValue({
        ...baseShell,
        status: 'submitted',
        latest_version: 1,
        this_week_rag: 'Green',
        prev_week_rag: 'Amber',
      });
    finalizeWeeklyReportSubmit.mockResolvedValue({});

    await submitWeeklyReport(100, 10, pmActor);

    expect(createRiskFn).toHaveBeenCalledWith(
      100,
      pmActor,
      expect.objectContaining({ description: 'New risk' }),
    );
    expect(insertWeeklyReportVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          raid: expect.objectContaining({
            risks: [createdRisk],
            issues: [],
          }),
        }),
      }),
    );
  });

  it('calls updateRisk and snapshot holds post-update row immune to later master change (D-11, RAID-02)', async () => {
    const postUpdate = { id: 5, description: 'Updated', status: 'Open' };
    updateRiskFn.mockResolvedValue(postUpdate);
    getRiskRepo.mockResolvedValueOnce({ id: 5, status: 'Open', deactivated_at: null });
    getRiskRepo.mockResolvedValueOnce(postUpdate);
    getProjectRepo.mockResolvedValue({ rag: 'Green', progress_pct: 10 });

    getWeeklyReportWithPeriod
      .mockResolvedValueOnce({
        ...baseShell,
        status: 'draft',
        this_week_rag: 'Green',
        prev_week_rag: 'Amber',
        draft_raid_json: {
          risks: [{ id: 5, fields: { description: 'Updated' } }],
          issues: [],
        },
      })
      .mockResolvedValue({
        ...baseShell,
        status: 'submitted',
        latest_version: 1,
      });
    finalizeWeeklyReportSubmit.mockResolvedValue({});

    await submitWeeklyReport(100, 10, pmActor);

    expect(updateRiskFn).toHaveBeenCalledWith(100, pmActor, 5, { description: 'Updated' });
    const insertArg = insertWeeklyReportVersion.mock.calls[0][0];
    expect(insertArg.snapshot.raid.risks[0]).toEqual(postUpdate);
    getRiskRepo.mockResolvedValue({ id: 5, description: 'Changed later', status: 'Open' });
    expect(insertArg.snapshot.raid.risks[0]).toEqual(postUpdate);
  });

  it('snapshot.milestones includes plan_end adjusted_end status from getMilestone (D-12, MS-04)', async () => {
    const milestone = {
      id: 3,
      name: 'M1',
      plan_end: '2026-03-01',
      adjusted_end: '2026-03-15',
      status: 'in_progress',
      end_date: '2026-03-15',
    };
    getMilestoneRepo.mockResolvedValue(milestone);
    getProjectRepo.mockResolvedValue({ rag: 'Green', progress_pct: 55 });

    getWeeklyReportWithPeriod
      .mockResolvedValueOnce({
        ...baseShell,
        status: 'draft',
        this_week_rag: 'Green',
        prev_week_rag: 'Amber',
        nearest_milestone: 'M1',
        nearest_milestone_id: 3,
      })
      .mockResolvedValue({
        ...baseShell,
        status: 'submitted',
        latest_version: 1,
      });
    finalizeWeeklyReportSubmit.mockResolvedValue({});

    await submitWeeklyReport(100, 10, pmActor);

    expect(getMilestoneRepo).toHaveBeenCalledWith(100, 3);
    expect(insertWeeklyReportVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          milestones: [
            {
              id: 3,
              name: 'M1',
              plan_end: '2026-03-01',
              adjusted_end: '2026-03-15',
              status: 'in_progress',
              end_date: '2026-03-15',
            },
          ],
        }),
      }),
    );
  });

  it('copies progress_pct and syncs rag only when this_week_rag differs (D-10, WKRP-03)', async () => {
    getProjectRepo.mockResolvedValue({ rag: 'Amber', progress_pct: 73 });

    getWeeklyReportWithPeriod
      .mockResolvedValueOnce({
        ...baseShell,
        status: 'draft',
        this_week_rag: 'Red',
        prev_week_rag: 'Amber',
      })
      .mockResolvedValue({
        ...baseShell,
        status: 'submitted',
        latest_version: 1,
      });
    finalizeWeeklyReportSubmit.mockResolvedValue({});

    await submitWeeklyReport(100, 10, pmActor);

    expect(insertWeeklyReportVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        progressPct: 73,
        snapshot: expect.objectContaining({ progress_pct: 73 }),
      }),
    );
    expect(updateProjectRepo).toHaveBeenCalledWith(100, { rag: 'Red' });
    expect(updateProjectRepo).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ progress_pct: expect.anything() }),
    );
  });

  it('maps version unique violation to ConflictError (WR-02)', async () => {
    getWeeklyReportWithPeriod
      .mockResolvedValueOnce({
        ...baseShell,
        status: 'draft',
        this_week_rag: 'Green',
        prev_week_rag: 'Amber',
      })
      .mockResolvedValue({ ...baseShell, status: 'submitted', this_week_rag: 'Green' });
    insertWeeklyReportVersion.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));

    await expect(submitWeeklyReport(100, 10, pmActor)).rejects.toBeInstanceOf(ConflictError);
    expect(finalizeWeeklyReportSubmit).not.toHaveBeenCalled();
  });

  it('does not finalize when version insert fails after createRisk (CR-02)', async () => {
    createRiskFn.mockResolvedValue({ id: 99, description: 'New risk' });
    getRiskRepo.mockResolvedValue({ id: 99, description: 'New risk' });
    getWeeklyReportWithPeriod
      .mockResolvedValueOnce({
        ...baseShell,
        status: 'draft',
        this_week_rag: 'Green',
        prev_week_rag: 'Amber',
        draft_raid_json: {
          risks: [{ id: 'new', fields: { description: 'New risk' } }],
          issues: [],
        },
      })
      .mockResolvedValue({ ...baseShell, status: 'draft', this_week_rag: 'Green' });
    insertWeeklyReportVersion.mockRejectedValue(new Error('version insert failed'));

    await expect(submitWeeklyReport(100, 10, pmActor)).rejects.toThrow('version insert failed');
    expect(createRiskFn).toHaveBeenCalled();
    expect(finalizeWeeklyReportSubmit).not.toHaveBeenCalled();
    expect(runInTransaction).toHaveBeenCalled();
  });

  it('does not call updateProject when this_week_rag matches project rag (D-10)', async () => {
    getProjectRepo.mockResolvedValue({ rag: 'Green', progress_pct: 50 });

    getWeeklyReportWithPeriod
      .mockResolvedValueOnce({
        ...baseShell,
        status: 'draft',
        this_week_rag: 'Green',
        prev_week_rag: 'Amber',
      })
      .mockResolvedValue({
        ...baseShell,
        status: 'submitted',
        latest_version: 1,
      });
    finalizeWeeklyReportSubmit.mockResolvedValue({});

    await submitWeeklyReport(100, 10, pmActor);

    expect(updateProjectRepo).not.toHaveBeenCalled();
  });
});

describe('openWeeklyReportCorrection', () => {
  it('opens correction and copies latest snapshot into draft columns (D-08)', async () => {
    getWeeklyReportFullRow.mockResolvedValue({
      ...baseShell,
      status: 'submitted',
      latest_version: 1,
    });
    getLatestVersionSnapshot.mockResolvedValue({
      highlights: 'snap hi',
      completed_work: 'done',
      next_week_goals: 'goals',
      nearest_milestone: { text: 'M1', milestone_id: 3 },
      raid_dependency: 'dep',
      leadership_support: 'sup',
      this_week_rag: 'Green',
      draft_raid_json: { risks: [] },
    });
    openCorrectionOnShell.mockResolvedValue({ ...baseShell, correction_open: true });
    getWeeklyReportWithPeriod.mockResolvedValue({
      ...baseShell,
      status: 'submitted',
      correction_open: true,
      prev_week_rag: 'Green',
    });

    await openWeeklyReportCorrection(100, 10, pmActor, { highlights: 'overlay' });

    expect(openCorrectionOnShell).toHaveBeenCalledWith(
      100,
      10,
      expect.objectContaining({ highlights: 'overlay', nearest_milestone: 'M1' }),
    );
    expect(insertWeeklyReportVersion).not.toHaveBeenCalled();
  });

  it('reconstructs draft_raid_json from snapshot.raid when draft_raid_json is absent (CR-01)', async () => {
    getWeeklyReportFullRow.mockResolvedValue({
      ...baseShell,
      status: 'submitted',
      latest_version: 1,
    });
    getLatestVersionSnapshot.mockResolvedValue({
      highlights: 'snap hi',
      this_week_rag: 'Green',
      raid: { risks: [{ id: 5, description: 'x', status: 'Open' }], issues: [] },
    });
    openCorrectionOnShell.mockResolvedValue({ ...baseShell, correction_open: true });
    getWeeklyReportWithPeriod.mockResolvedValue({
      ...baseShell,
      status: 'submitted',
      correction_open: true,
      prev_week_rag: 'Green',
    });

    await openWeeklyReportCorrection(100, 10, pmActor);

    expect(openCorrectionOnShell).toHaveBeenCalledWith(
      100,
      10,
      expect.objectContaining({
        draft_raid_json: {
          risks: [{ id: 5, fields: { description: 'x', status: 'Open' } }],
          issues: [],
        },
      }),
    );
  });
});

describe('listProjectWeeklyHistory', () => {
  it('returns one row per period newest iso_week first with overdue flag (D-09, WKRP-06)', async () => {
    listProjectWeeklyHistoryRepo.mockResolvedValue([
      {
        display_name: '2026-W02 | x',
        iso_week: '2026-W02',
        status: 'draft',
        due_at: '2020-01-01T00:00:00.000Z',
        first_lateness: null,
        latest_version: 0,
        report_id: 2,
        period_id: 2,
        rag: null,
        submitted_at: null,
        submitted_by: null,
      },
      {
        display_name: '2026-W01 | y',
        iso_week: '2026-W01',
        status: 'submitted',
        due_at: '2026-01-02T18:00:00.000Z',
        first_lateness: 'on_time',
        latest_version: 1,
        report_id: 1,
        period_id: 1,
        rag: 'Green',
        submitted_at: '2026-01-02T10:00:00.000Z',
        submitted_by: 2,
      },
    ]);

    const rows = await listProjectWeeklyHistory(100, pmActor);

    expect(assertProjectAccess).toHaveBeenCalledWith(100, pmActor);
    expect(rows).toHaveLength(2);
    expect(rows[0].iso_week).toBe('2026-W02');
    expect(rows[0].overdue).toBe(true);
    expect(rows[1].iso_week).toBe('2026-W01');
    expect(rows[1].overdue).toBe(false);
  });
});

describe('listPeriodShells', () => {
  it('throws ForbiddenError when actor.company_id does not match companyId (D-13, D-18, T-13-01)', async () => {
    assertCompanyWrite.mockImplementation(() => undefined);

    await expect(listPeriodShells(5, 1, { ...cpmoActor, company_id: 9 })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(getWeeklyPeriodByCompanyRepo).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when assertCompanyWrite fails (D-13)', async () => {
    assertCompanyWrite.mockImplementation(() => {
      throw new ForbiddenError();
    });

    await expect(listPeriodShells(5, 1, pmActor)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listPeriodShellsRepo).not.toHaveBeenCalled();
  });

  it('returns shells with overdue flag for period owned by company (D-05, D-18)', async () => {
    getWeeklyPeriodByCompanyRepo.mockResolvedValue({ id: 1, due_at: '2020-01-01T00:00:00.000Z' });
    listPeriodShellsRepo.mockResolvedValue([
      {
        project_id: 100,
        status: 'draft',
        first_submitted_at: null,
        first_lateness: null,
        latest_version: 0,
        report_id: 10,
        due_at: '2020-01-01T00:00:00.000Z',
        rag: null,
      },
      {
        project_id: 101,
        status: 'submitted',
        first_submitted_at: '2026-01-02T10:00:00.000Z',
        first_lateness: 'on_time',
        latest_version: 1,
        report_id: 11,
        due_at: '2020-01-01T00:00:00.000Z',
        rag: 'Green',
      },
    ]);

    const rows = await listPeriodShells(5, 1, cpmoActor);

    expect(assertCompanyWrite).toHaveBeenCalledWith(cpmoActor);
    expect(getWeeklyPeriodByCompanyRepo).toHaveBeenCalledWith(5, 1);
    expect(listPeriodShellsRepo).toHaveBeenCalledWith(5, 1);
    expect(rows).toHaveLength(2);
    expect(rows[0].overdue).toBe(true);
    expect(rows[0].project_id).toBe(100);
    expect(rows[1].overdue).toBe(false);
    expect(rows[1].rag).toBe('Green');
    expect(rows[1].first_lateness).toBe('on_time');
  });
});
