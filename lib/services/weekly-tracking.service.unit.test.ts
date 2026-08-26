import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertCompanyWrite,
  getWeeklyPeriodByCompanyRepo,
  listPeriodShellsRepo,
  listTechnologyCouncilIssuesRepo,
} = vi.hoisted(() => ({
  assertCompanyWrite: vi.fn(),
  getWeeklyPeriodByCompanyRepo: vi.fn(),
  listPeriodShellsRepo: vi.fn(),
  listTechnologyCouncilIssuesRepo: vi.fn(),
}));

vi.mock('./access', () => ({
  assertCompanyWrite,
}));
vi.mock('@/lib/repositories/weekly-reports.repo', () => ({
  getWeeklyPeriodByCompany: getWeeklyPeriodByCompanyRepo,
  listPeriodShellsRepo,
}));
vi.mock('@/lib/repositories/issues.repo', () => ({
  listTechnologyCouncilIssues: listTechnologyCouncilIssuesRepo,
}));

import { getPeriodTracking } from './weekly-tracking.service';
import { ForbiddenError, NotFoundError } from './errors';
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

const basePeriod = {
  id: 1,
  company_id: 5,
  iso_week: '2026-W01',
  start_date: '2025-12-29',
  end_date: '2026-01-04',
  due_at: '2020-01-01T00:00:00.000Z',
  display_name: '2026-W01 | 2025-12-29 – 2026-01-04',
};

beforeEach(() => {
  vi.clearAllMocks();
  assertCompanyWrite.mockImplementation(() => undefined);
  listTechnologyCouncilIssuesRepo.mockResolvedValue([]);
});

describe('getPeriodTracking', () => {
  it('throws ForbiddenError when assertCompanyWrite fails before reading shells (D-11)', async () => {
    assertCompanyWrite.mockImplementation(() => {
      throw new ForbiddenError();
    });

    await expect(getPeriodTracking(5, 1, pmActor, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(listPeriodShellsRepo).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when actor.company_id does not match companyId (D-13)', async () => {
    await expect(
      getPeriodTracking(5, 1, { ...cpmoActor, company_id: 9 }, {}),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(getWeeklyPeriodByCompanyRepo).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for unknown period (D-13)', async () => {
    getWeeklyPeriodByCompanyRepo.mockResolvedValue(undefined);

    await expect(getPeriodTracking(5, 99, cpmoActor, {})).rejects.toBeInstanceOf(NotFoundError);
    expect(listPeriodShellsRepo).not.toHaveBeenCalled();
  });

  it('returns period, counts, and rows with project_id and report_id for CPMO (CPMO-01)', async () => {
    getWeeklyPeriodByCompanyRepo.mockResolvedValue(basePeriod);
    listPeriodShellsRepo.mockResolvedValue([
      {
        project_id: 100,
        status: 'not_submitted',
        first_submitted_at: null,
        first_lateness: null,
        latest_version: 0,
        report_id: 10,
        due_at: '2020-01-01T00:00:00.000Z',
        rag: null,
        name: 'Alpha',
        project_code: 'A-001',
        stage: 'L3',
        pm_user_id: 7,
        pm_display_name: 'Primary PM',
      },
      {
        project_id: 101,
        status: 'draft',
        first_submitted_at: null,
        first_lateness: null,
        latest_version: 0,
        report_id: 11,
        due_at: '2020-01-01T00:00:00.000Z',
        rag: null,
        name: 'Beta',
        project_code: 'B-001',
        stage: 'L4',
        pm_user_id: null,
        pm_display_name: null,
      },
      {
        project_id: 102,
        status: 'submitted',
        first_submitted_at: '2026-01-02T10:00:00.000Z',
        first_lateness: 'late',
        latest_version: 1,
        report_id: 12,
        due_at: '2020-01-01T00:00:00.000Z',
        rag: 'Amber',
        name: 'Gamma',
        project_code: 'G-001',
        stage: 'L3',
        pm_user_id: 8,
        pm_display_name: 'Late PM',
      },
    ]);

    const result = await getPeriodTracking(5, 1, cpmoActor, {});

    expect(assertCompanyWrite).toHaveBeenCalledWith(cpmoActor);
    expect(getWeeklyPeriodByCompanyRepo).toHaveBeenCalledWith(5, 1);
    expect(listPeriodShellsRepo).toHaveBeenCalledWith(5, 1);
    expect(result.period).toMatchObject({
      id: 1,
      display_name: basePeriod.display_name,
      iso_week: '2026-W01',
    });
    expect(result.counts).toEqual({
      obligated: 3,
      not_submitted: 1,
      draft: 1,
      submitted: 1,
      overdue: 2,
      late: 1,
    });
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      project_id: 100,
      report_id: 10,
      name: 'Alpha',
      project_code: 'A-001',
      stage: 'L3',
      status: 'not_submitted',
      overdue: true,
      rag: null,
      pm_user_id: 7,
      pm_display_name: 'Primary PM',
      has_technology_council_issues: false,
    });
    expect(result.rows[2].rag).toBe('Amber');
    expect(result.rows[2].first_lateness).toBe('late');
  });
});

describe('getPeriodTracking filters (D-04, D-05, CPMO-02)', () => {
  const shells = [
    {
      project_id: 100,
      status: 'not_submitted',
      first_submitted_at: null,
      first_lateness: null,
      latest_version: 0,
      report_id: 10,
      due_at: '2020-01-01T00:00:00.000Z',
      rag: null,
      name: 'Alpha',
      project_code: 'A-001',
      stage: 'L3',
      pm_user_id: 7,
      pm_display_name: 'PM One',
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
      name: 'Beta',
      project_code: 'B-001',
      stage: 'L4',
      pm_user_id: 8,
      pm_display_name: 'PM Two',
    },
    {
      project_id: 102,
      status: 'submitted',
      first_submitted_at: '2026-01-03T10:00:00.000Z',
      first_lateness: 'late',
      latest_version: 1,
      report_id: 12,
      due_at: '2020-01-01T00:00:00.000Z',
      rag: 'Amber',
      name: 'Gamma',
      project_code: 'G-001',
      stage: 'L3',
      pm_user_id: 7,
      pm_display_name: 'PM One',
    },
  ];

  beforeEach(() => {
    getWeeklyPeriodByCompanyRepo.mockResolvedValue(basePeriod);
    listPeriodShellsRepo.mockResolvedValue(shells);
  });

  it('keeps unfiltered counts when status filter shrinks rows (D-04)', async () => {
    const result = await getPeriodTracking(5, 1, cpmoActor, { status: 'submitted' });
    expect(result.counts.obligated).toBe(3);
    expect(result.counts.submitted).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((r) => r.status === 'submitted')).toBe(true);
  });

  it('status=overdue keeps computed-overdue draft/not_submitted only (D-05)', async () => {
    const result = await getPeriodTracking(5, 1, cpmoActor, { status: 'overdue' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].project_id).toBe(100);
    expect(result.rows[0].overdue).toBe(true);
  });

  it('lateness=on_time and lateness=late filter by first_lateness (D-05)', async () => {
    const onTime = await getPeriodTracking(5, 1, cpmoActor, { lateness: 'on_time' });
    expect(onTime.rows).toHaveLength(1);
    expect(onTime.rows[0].project_id).toBe(101);

    const late = await getPeriodTracking(5, 1, cpmoActor, { lateness: 'late' });
    expect(late.rows).toHaveLength(1);
    expect(late.rows[0].project_id).toBe(102);
  });

  it('filters by pm_user_id, stage, and version rag (D-03, D-05)', async () => {
    const byPm = await getPeriodTracking(5, 1, cpmoActor, { pm_user_id: 7 });
    expect(byPm.rows.map((r) => r.project_id).sort()).toEqual([100, 102]);

    const byStage = await getPeriodTracking(5, 1, cpmoActor, { stage: 'L4' });
    expect(byStage.rows).toHaveLength(1);
    expect(byStage.rows[0].project_id).toBe(101);

    const byRag = await getPeriodTracking(5, 1, cpmoActor, { rag: 'Amber' });
    expect(byRag.rows).toHaveLength(1);
    expect(byRag.rows[0].project_id).toBe(102);
  });

  it('technology_council=true keeps rows with live council issues (D-02)', async () => {
    listTechnologyCouncilIssuesRepo.mockResolvedValue([{ project_id: 102 }]);

    const result = await getPeriodTracking(5, 1, cpmoActor, { technology_council: true });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].project_id).toBe(102);
    expect(result.rows[0].has_technology_council_issues).toBe(true);
    expect(result.counts.obligated).toBe(3);
  });
});
