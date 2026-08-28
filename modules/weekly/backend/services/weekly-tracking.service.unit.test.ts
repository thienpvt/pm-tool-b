import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertCompanyWrite,
  getWeeklyPeriodByCompanyRepo,
  listPeriodShellsRepo,
  listTechnologyCouncilIssuesRepo,
  getLatestVersionSnapshotRepo,
  generateConsolidatedWeeklyExport,
  insertWeeklyExportLogRepo,
  auditLogService,
} = vi.hoisted(() => ({
  assertCompanyWrite: vi.fn(),
  getWeeklyPeriodByCompanyRepo: vi.fn(),
  listPeriodShellsRepo: vi.fn(),
  listTechnologyCouncilIssuesRepo: vi.fn(),
  getLatestVersionSnapshotRepo: vi.fn(),
  generateConsolidatedWeeklyExport: vi.fn(),
  insertWeeklyExportLogRepo: vi.fn(),
  auditLogService: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({
  assertCompanyWrite,
}));
vi.mock('@/modules/weekly/backend/repositories/weekly-reports.repo', () => ({
  getWeeklyPeriodByCompany: getWeeklyPeriodByCompanyRepo,
  listPeriodShellsRepo,
  getLatestVersionSnapshot: getLatestVersionSnapshotRepo,
}));
vi.mock('@/lib/repositories/issues.repo', () => ({
  listTechnologyCouncilIssues: listTechnologyCouncilIssuesRepo,
}));
vi.mock('@/lib/export/consolidated-weekly', () => ({
  generateConsolidatedWeekly: generateConsolidatedWeeklyExport,
  sanitizeConsolidatedFilename: (display: string, ext: string) => `${display} consolidated.${ext}`,
  CONTENT_TYPE_BY_FORMAT: {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
}));
vi.mock('@/modules/weekly/backend/repositories/weekly-export.repo', () => ({
  insertWeeklyExportLog: insertWeeklyExportLogRepo,
}));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({
  auditLog: auditLogService,
}));

import {
  assertExportEligible,
  assembleSnapshotSections,
  exportConsolidatedWeekly,
  getPeriodTracking,
  previewConsolidatedExport,
} from './weekly-tracking.service';
import { ForbiddenError, NotFoundError, SubmitValidationError } from '@/lib/services/errors';
import type { AccessActor } from '@/lib/services/access';

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

const submittedShell = {
  project_id: 100,
  status: 'submitted',
  first_submitted_at: '2026-01-02T10:00:00.000Z',
  first_lateness: 'on_time',
  latest_version: 1,
  report_id: 10,
  due_at: '2020-01-01T00:00:00.000Z',
  rag: 'Green',
  name: 'Alpha',
  project_code: 'A-001',
  stage: 'L3',
  pm_user_id: 7,
  pm_display_name: 'Primary PM',
};

function shellMap(rows: typeof submittedShell[]) {
  return new Map(rows.map((row) => [row.project_id, row]));
}

describe('assertExportEligible (D-06, D-14)', () => {
  it('throws SubmitValidationError naming draft ids in request order', () => {
    const map = shellMap([
      submittedShell,
      {
        ...submittedShell,
        project_id: 101,
        report_id: 11,
        status: 'draft',
        latest_version: 0,
      },
    ]);

    expect(() => assertExportEligible(map, [100, 101])).toThrow(SubmitValidationError);
    try {
      assertExportEligible(map, [100, 101]);
    } catch (e) {
      expect(e).toBeInstanceOf(SubmitValidationError);
      expect((e as SubmitValidationError).fields).toEqual(['101']);
      expect((e as SubmitValidationError).message).toBe('Projects not eligible for export');
    }
  });

  it('throws SubmitValidationError for not_submitted and latest_version 0', () => {
    const map = shellMap([
      {
        ...submittedShell,
        project_id: 102,
        status: 'not_submitted',
        latest_version: 0,
      },
      {
        ...submittedShell,
        project_id: 103,
        report_id: 13,
        latest_version: 0,
      },
    ]);

    try {
      assertExportEligible(map, [102, 103]);
    } catch (e) {
      expect((e as SubmitValidationError).fields).toEqual(['102', '103']);
    }
  });

  it('throws SubmitValidationError for ids absent from period shells', () => {
    const map = shellMap([submittedShell]);

    try {
      assertExportEligible(map, [100, 999]);
    } catch (e) {
      expect((e as SubmitValidationError).fields).toEqual(['999']);
    }
  });
});

describe('previewConsolidatedExport eligibility (D-06, D-11, D-14)', () => {
  beforeEach(() => {
    getWeeklyPeriodByCompanyRepo.mockResolvedValue(basePeriod);
    listPeriodShellsRepo.mockResolvedValue([submittedShell]);
    getLatestVersionSnapshotRepo.mockResolvedValue({});
  });

  it('does not read shells when assertCompanyWrite rejects (D-11)', async () => {
    assertCompanyWrite.mockImplementation(() => {
      throw new ForbiddenError();
    });

    await expect(previewConsolidatedExport(5, 1, pmActor, [100])).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(listPeriodShellsRepo).not.toHaveBeenCalled();
    expect(getLatestVersionSnapshotRepo).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for unknown period (D-14)', async () => {
    getWeeklyPeriodByCompanyRepo.mockResolvedValue(undefined);

    await expect(previewConsolidatedExport(5, 99, cpmoActor, [100])).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(listPeriodShellsRepo).not.toHaveBeenCalled();
    expect(getLatestVersionSnapshotRepo).not.toHaveBeenCalled();
  });

  it('throws SubmitValidationError for ineligible project ids (D-06)', async () => {
    listPeriodShellsRepo.mockResolvedValue([
      submittedShell,
      {
        ...submittedShell,
        project_id: 101,
        report_id: 11,
        status: 'draft',
        latest_version: 0,
      },
    ]);

    await expect(previewConsolidatedExport(5, 1, cpmoActor, [100, 101])).rejects.toBeInstanceOf(
      SubmitValidationError,
    );
    expect(getLatestVersionSnapshotRepo).not.toHaveBeenCalled();
  });
});

const shellB = {
  ...submittedShell,
  project_id: 101,
  report_id: 11,
  name: 'Beta',
  project_code: 'B-001',
};

const richSnapshot = {
  highlights: 'Shipped alpha',
  next_week_goals: 'Start beta',
  this_week_rag: 'Amber',
  prev_week_rag: 'Green',
  progress_pct: 42,
  nearest_milestone: 'Gate review',
  raid: {
    risks: [{ id: 1, description: 'Risk A' }, { id: 2 }],
    issues: [
      { id: 10, technology_council: true, description: 'Tech issue' },
      { id: 11, technology_council: false },
      { id: 12, description: 'Plain issue' },
    ],
  },
};

describe('assembleSnapshotSections (D-01, D-02, D-08)', () => {
  it('walks projectIds in caller order and maps snapshot summary fields', () => {
    const map = shellMap([submittedShell, shellB]);
    const snapshots = new Map<number, Record<string, unknown>>([
      [10, richSnapshot],
      [11, { ...richSnapshot, this_week_rag: 'Red', progress_pct: 10 }],
    ]);

    const sections = assembleSnapshotSections([101, 100], map, snapshots);

    expect(sections.map((s) => s.project_id)).toEqual([101, 100]);
    expect(sections[0]).toMatchObject({
      project_id: 101,
      report_id: 11,
      name: 'Beta',
      project_code: 'B-001',
      this_week_rag: 'Red',
      progress_pct: 10,
      highlights: 'Shipped alpha',
      next_week_goals: 'Start beta',
      prev_week_rag: 'Green',
      nearest_milestone: 'Gate review',
      raid_counts: { risks: 2, issues: 3 },
      tech_issue_counts: 1,
    });
    expect(sections[0].raid.risks).toHaveLength(2);
    expect(sections[0].raid.issues).toHaveLength(3);
    expect(sections[0].tech_issues).toEqual([
      { id: 10, technology_council: true, description: 'Tech issue' },
    ]);
  });

  it('renders blank fields and zero counts for missing snapshot keys (D-08)', () => {
    const map = shellMap([submittedShell]);
    const sections = assembleSnapshotSections([100], map, new Map([[10, {}]]));

    expect(sections[0]).toMatchObject({
      prev_week_rag: null,
      this_week_rag: null,
      progress_pct: null,
      highlights: null,
      next_week_goals: null,
      nearest_milestone: null,
      raid_counts: { risks: 0, issues: 0 },
      tech_issue_counts: 0,
      raid: { risks: [], issues: [] },
      tech_issues: [],
    });
  });

  it('counts zero tech issues when technology_council flag is absent on every issue (D-02)', () => {
    const map = shellMap([submittedShell]);
    const snapshots = new Map<number, Record<string, unknown>>([
      [
        10,
        {
          raid: {
            risks: [],
            issues: [{ id: 1 }, { id: 2, technology_council: false }],
          },
        },
      ],
    ]);

    const sections = assembleSnapshotSections([100], map, snapshots);
    expect(sections[0].tech_issue_counts).toBe(0);
    expect(sections[0].tech_issues).toEqual([]);
  });
});

describe('previewConsolidatedExport snapshot assembly (D-06, D-01, D-02)', () => {
  beforeEach(() => {
    getWeeklyPeriodByCompanyRepo.mockResolvedValue(basePeriod);
    listPeriodShellsRepo.mockResolvedValue([submittedShell, shellB]);
  });

  it('returns sections in caller project_ids order (D-06, CPMO-03)', async () => {
    getLatestVersionSnapshotRepo.mockImplementation(async (reportId: number) => {
      if (reportId === 10) return richSnapshot;
      if (reportId === 11) return { ...richSnapshot, this_week_rag: 'Red' };
      return {};
    });

    const result = await previewConsolidatedExport(5, 1, cpmoActor, [101, 100]);

    expect(result.sections.map((s) => s.project_id)).toEqual([101, 100]);
    expect(result.sections[0].this_week_rag).toBe('Red');
    expect(result.sections[1].this_week_rag).toBe('Amber');
    expect(listTechnologyCouncilIssuesRepo).not.toHaveBeenCalled();
  });

  it('loads preview content only via getLatestVersionSnapshot (D-01)', async () => {
    getLatestVersionSnapshotRepo.mockResolvedValue(richSnapshot);

    const result = await previewConsolidatedExport(5, 1, cpmoActor, [100]);

    expect(getLatestVersionSnapshotRepo).toHaveBeenCalledWith(10, 1);
    expect(result.sections[0].highlights).toBe('Shipped alpha');
    expect(result.sections[0].raid_counts).toEqual({ risks: 2, issues: 3 });
    expect(result.sections[0].tech_issue_counts).toBe(1);
    expect(listTechnologyCouncilIssuesRepo).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when a submitted shell has no version snapshot (WR-02)', async () => {
    getLatestVersionSnapshotRepo.mockResolvedValue(undefined);

    await expect(previewConsolidatedExport(5, 1, cpmoActor, [100])).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('exportConsolidatedWeekly (D-07, D-09, D-14)', () => {
  const shellV2 = { ...submittedShell, latest_version: 2 };
  const shellV3 = {
    ...submittedShell,
    project_id: 101,
    report_id: 11,
    name: 'Beta',
    project_code: 'B-001',
    latest_version: 3,
  };

  beforeEach(() => {
    getWeeklyPeriodByCompanyRepo.mockResolvedValue(basePeriod);
    listPeriodShellsRepo.mockResolvedValue([shellV2, shellV3]);
    getLatestVersionSnapshotRepo.mockResolvedValue(richSnapshot);
    generateConsolidatedWeeklyExport.mockResolvedValue(Buffer.from('pack'));
    insertWeeklyExportLogRepo.mockResolvedValue(99);
    auditLogService.mockResolvedValue(undefined);
  });

  it('generates buffer then insertWeeklyExportLog then auditLog weekly_export (D-09)', async () => {
    const callOrder: string[] = [];
    generateConsolidatedWeeklyExport.mockImplementation(async () => {
      callOrder.push('generate');
      return Buffer.from('pack');
    });
    insertWeeklyExportLogRepo.mockImplementation(async () => {
      callOrder.push('log');
      return 99;
    });
    auditLogService.mockImplementation(async () => {
      callOrder.push('audit');
    });

    const result = await exportConsolidatedWeekly(5, 1, cpmoActor, {
      project_ids: [100, 101],
      format: 'xlsx',
    });

    expect(callOrder).toEqual(['generate', 'log', 'audit']);
    expect(result.buffer).toEqual(Buffer.from('pack'));
    expect(result.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(insertWeeklyExportLogRepo).toHaveBeenCalledWith({
      period_id: 1,
      company_id: 5,
      exported_by: 1,
      format: 'xlsx',
      data_version: 3,
      project_ids: [100, 101],
      period_display_name: basePeriod.display_name,
    });
    expect(auditLogService).toHaveBeenCalledWith({
      actor_id: 1,
      company_id: 5,
      entity_type: 'weekly_period',
      entity_id: '1',
      action: 'weekly_export',
      before: null,
      after: { format: 'xlsx', data_version: 3, project_ids: [100, 101] },
    });
  });

  it('two sequential successful exports call insertWeeklyExportLog twice (D-14)', async () => {
    await exportConsolidatedWeekly(5, 1, cpmoActor, { project_ids: [100], format: 'xlsx' });
    await exportConsolidatedWeekly(5, 1, cpmoActor, { project_ids: [100], format: 'docx' });
    expect(insertWeeklyExportLogRepo).toHaveBeenCalledTimes(2);
  });

  it('throws SubmitValidationError for ineligible ids without insertWeeklyExportLog (D-06, D-14)', async () => {
    listPeriodShellsRepo.mockResolvedValue([
      shellV2,
      { ...shellV3, status: 'draft', latest_version: 0 },
    ]);

    await expect(
      exportConsolidatedWeekly(5, 1, cpmoActor, { project_ids: [100, 101], format: 'xlsx' }),
    ).rejects.toBeInstanceOf(SubmitValidationError);
    expect(generateConsolidatedWeeklyExport).not.toHaveBeenCalled();
    expect(insertWeeklyExportLogRepo).not.toHaveBeenCalled();
    expect(auditLogService).not.toHaveBeenCalled();
  });

  it('does not insert log when generator fails (D-09)', async () => {
    generateConsolidatedWeeklyExport.mockRejectedValue(new Error('generator failed'));

    await expect(
      exportConsolidatedWeekly(5, 1, cpmoActor, { project_ids: [100], format: 'xlsx' }),
    ).rejects.toThrow('generator failed');
    expect(insertWeeklyExportLogRepo).not.toHaveBeenCalled();
    expect(auditLogService).not.toHaveBeenCalled();
  });
});
