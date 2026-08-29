import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

export type WeeklyReportShellRow = {
  id: number;
  period_id: number;
  project_id: number;
  status: string;
};

export type WeeklyReportFullRow = WeeklyReportShellRow & {
  first_submitted_at: string | null;
  first_lateness: string | null;
  latest_version: number;
  correction_open: boolean;
  highlights: string | null;
  completed_work: string | null;
  next_week_goals: string | null;
  nearest_milestone: string | null;
  nearest_milestone_id: number | null;
  raid_dependency: string | null;
  leadership_support: string | null;
  this_week_rag: string | null;
  prev_week_rag: string | null;
  draft_raid_json: unknown | null;
};

export type WeeklyReportWithPeriodRow = WeeklyReportFullRow & {
  iso_week: string;
  due_at: string;
  display_name: string;
  company_id: number;
};

export type WeeklyReportVersionRow = {
  id: number;
  report_id: number;
  version: number;
  snapshot: Record<string, unknown>;
  submitted_at: string;
  submitted_by: number;
  rag: string | null;
  progress_pct: number | null;
};

export type WeeklyHistoryRow = {
  display_name: string;
  iso_week: string;
  status: string;
  due_at: string;
  first_lateness: string | null;
  latest_version: number;
  report_id: number;
  period_id: number;
  rag: string | null;
  submitted_at: string | null;
  submitted_by: number | null;
};

const FULL_SHELL_RETURNING = [
  'id',
  'period_id',
  'project_id',
  'status',
  'first_submitted_at',
  'first_lateness',
  'latest_version',
  'correction_open',
  'highlights',
  'completed_work',
  'next_week_goals',
  'nearest_milestone',
  'nearest_milestone_id',
  'raid_dependency',
  'leadership_support',
  'this_week_rag',
  'prev_week_rag',
  'draft_raid_json',
] as const;

function tsToString(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function mapShellRow(row: {
  id: number | bigint;
  period_id: number;
  project_id: number;
  status: string;
}): WeeklyReportShellRow {
  return {
    id: Number(row.id),
    period_id: row.period_id,
    project_id: row.project_id,
    status: row.status,
  };
}

function mapFullRow(row: {
  id: number | bigint;
  period_id: number;
  project_id: number;
  status: string;
  first_submitted_at: Date | string | null;
  first_lateness: string | null;
  latest_version: number;
  correction_open: boolean;
  highlights: string | null;
  completed_work: string | null;
  next_week_goals: string | null;
  nearest_milestone: string | null;
  nearest_milestone_id: number | null;
  raid_dependency: string | null;
  leadership_support: string | null;
  this_week_rag: string | null;
  prev_week_rag: string | null;
  draft_raid_json: unknown | null;
}): WeeklyReportFullRow {
  return {
    ...mapShellRow(row),
    first_submitted_at: tsToString(row.first_submitted_at),
    first_lateness: row.first_lateness,
    latest_version: row.latest_version,
    correction_open: row.correction_open,
    highlights: row.highlights,
    completed_work: row.completed_work,
    next_week_goals: row.next_week_goals,
    nearest_milestone: row.nearest_milestone,
    nearest_milestone_id: row.nearest_milestone_id,
    raid_dependency: row.raid_dependency,
    leadership_support: row.leadership_support,
    this_week_rag: row.this_week_rag,
    prev_week_rag: row.prev_week_rag,
    draft_raid_json: row.draft_raid_json,
  };
}

function buildDraftSet(fields: DraftUpdateFields): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (key === 'draft_raid_json') {
      set[key] = value === null ? null : JSON.stringify(value);
    } else {
      set[key] = value;
    }
  }
  return set;
}

export async function insertShell(
  periodId: number,
  projectId: number,
): Promise<WeeklyReportShellRow | undefined> {
  const db = await getKysely();
  const row = await db
    .insertInto('weekly_reports')
    .values({
      period_id: periodId,
      project_id: projectId,
      status: 'not_submitted',
      latest_version: 0,
      correction_open: false,
    })
    .onConflict((oc) => oc.columns(['period_id', 'project_id']).doNothing())
    .returning(['id', 'period_id', 'project_id', 'status'])
    .executeTakeFirst();
  return row ? mapShellRow(row) : undefined;
}

export async function getShellsForPeriod(periodId: number): Promise<WeeklyReportShellRow[]> {
  const db = await getKysely();
  const rows = await db
    .selectFrom('weekly_reports')
    .select(['id', 'period_id', 'project_id', 'status'])
    .where('period_id', '=', periodId)
    .orderBy('project_id')
    .execute();
  return rows.map(mapShellRow);
}

export async function getWeeklyReportFullRow(
  projectId: number,
  reportId: number,
): Promise<WeeklyReportFullRow | undefined> {
  const db = await getKysely();
  const row = await db
    .selectFrom('weekly_reports as wr')
    .select([
      'wr.id',
      'wr.period_id',
      'wr.project_id',
      'wr.status',
      'wr.first_submitted_at',
      'wr.first_lateness',
      'wr.latest_version',
      'wr.correction_open',
      'wr.highlights',
      'wr.completed_work',
      'wr.next_week_goals',
      'wr.nearest_milestone',
      'wr.nearest_milestone_id',
      'wr.raid_dependency',
      'wr.leadership_support',
      'wr.this_week_rag',
      'wr.prev_week_rag',
      'wr.draft_raid_json',
    ])
    .where('wr.id', '=', reportId)
    .where('wr.project_id', '=', projectId)
    .executeTakeFirst();
  return row ? mapFullRow(row) : undefined;
}

export async function lockWeeklyReportShell(
  projectId: number,
  reportId: number,
): Promise<{
  id: number;
  latest_version: number;
  status: string;
  correction_open: boolean;
  first_submitted_at: string | null;
  first_lateness: string | null;
} | undefined> {
  const db = await getKysely();
  const row = await db
    .selectFrom('weekly_reports')
    .select([
      'id',
      'latest_version',
      'status',
      'correction_open',
      'first_submitted_at',
      'first_lateness',
    ])
    .where('id', '=', reportId)
    .where('project_id', '=', projectId)
    .forUpdate()
    .executeTakeFirst();
  if (!row) return undefined;
  return {
    id: Number(row.id),
    latest_version: row.latest_version,
    status: row.status,
    correction_open: row.correction_open,
    first_submitted_at: tsToString(row.first_submitted_at),
    first_lateness: row.first_lateness,
  };
}

export async function getWeeklyReportWithPeriod(
  projectId: number,
  reportId: number,
): Promise<WeeklyReportWithPeriodRow | undefined> {
  const db = await getKysely();
  const row = await db
    .selectFrom('weekly_reports as wr')
    .innerJoin('weekly_periods as wp', 'wp.id', 'wr.period_id')
    .select([
      'wr.id',
      'wr.period_id',
      'wr.project_id',
      'wr.status',
      'wr.first_submitted_at',
      'wr.first_lateness',
      'wr.latest_version',
      'wr.correction_open',
      'wr.highlights',
      'wr.completed_work',
      'wr.next_week_goals',
      'wr.nearest_milestone',
      'wr.nearest_milestone_id',
      'wr.raid_dependency',
      'wr.leadership_support',
      'wr.this_week_rag',
      'wr.prev_week_rag',
      'wr.draft_raid_json',
      'wp.iso_week',
      'wp.due_at',
      'wp.display_name',
      'wp.company_id',
    ])
    .where('wr.id', '=', reportId)
    .where('wr.project_id', '=', projectId)
    .executeTakeFirst();
  if (!row) return undefined;
  return {
    ...mapFullRow(row),
    iso_week: row.iso_week,
    due_at: tsToString(row.due_at) ?? '',
    display_name: row.display_name,
    company_id: row.company_id,
  };
}

export async function updatePrevWeekRag(
  projectId: number,
  reportId: number,
  prevWeekRag: string | null,
): Promise<void> {
  const db = await getKysely();
  await db
    .updateTable('weekly_reports')
    .set({ prev_week_rag: prevWeekRag })
    .where('id', '=', reportId)
    .where('project_id', '=', projectId)
    .execute();
}

export async function getPriorPeriodSubmittedRag(
  companyId: number,
  projectId: number,
  currentIsoWeek: string,
): Promise<string | null> {
  const db = await getKysely();
  const row = await db
    .selectFrom('weekly_periods as wp')
    .innerJoin('weekly_reports as wr', (join) =>
      join.onRef('wr.period_id', '=', 'wp.id').on('wr.project_id', '=', projectId),
    )
    .innerJoin('weekly_report_versions as wv', (join) =>
      join
        .onRef('wv.report_id', '=', 'wr.id')
        .onRef('wv.version', '=', 'wr.latest_version'),
    )
    .select(['wv.rag', 'wv.snapshot'])
    .where('wp.company_id', '=', companyId)
    .where('wp.iso_week', '<', currentIsoWeek)
    .where('wr.status', '=', 'submitted')
    .orderBy('wp.iso_week', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (!row) return null;
  if (row.rag) return row.rag;
  const snap = row.snapshot as Record<string, unknown> | null;
  if (snap && typeof snap.this_week_rag === 'string') return snap.this_week_rag;
  return null;
}

export type DraftUpdateFields = Partial<{
  highlights: string | null;
  completed_work: string | null;
  next_week_goals: string | null;
  nearest_milestone: string | null;
  nearest_milestone_id: number | null;
  raid_dependency: string | null;
  leadership_support: string | null;
  this_week_rag: string | null;
  draft_raid_json: unknown | null;
  status: string;
}>;

export async function updateWeeklyReportDraft(
  projectId: number,
  reportId: number,
  fields: DraftUpdateFields,
): Promise<WeeklyReportFullRow | undefined> {
  const set = buildDraftSet(fields);
  if (Object.keys(set).length === 0) {
    return getWeeklyReportFullRow(projectId, reportId);
  }

  const db = await getKysely();
  const row = await db
    .updateTable('weekly_reports')
    .set(set)
    .where('id', '=', reportId)
    .where('project_id', '=', projectId)
    .where((eb) =>
      eb.or([
        eb('status', 'in', ['not_submitted', 'draft']),
        eb('correction_open', 'is', true),
      ]),
    )
    .returning(FULL_SHELL_RETURNING)
    .executeTakeFirst();
  return row ? mapFullRow(row) : undefined;
}

export async function insertWeeklyReportVersion(input: {
  reportId: number;
  version: number;
  snapshot: Record<string, unknown>;
  submittedAt: string;
  submittedBy: number;
  rag: string;
  progressPct?: number | null;
}): Promise<WeeklyReportVersionRow> {
  const db = await getKysely();
  const row = await db
    .insertInto('weekly_report_versions')
    .values({
      report_id: input.reportId,
      version: input.version,
      snapshot: JSON.stringify(input.snapshot),
      submitted_at: input.submittedAt,
      submitted_by: input.submittedBy,
      rag: input.rag,
      progress_pct: input.progressPct ?? null,
    })
    .returning([
      'id',
      'report_id',
      'version',
      'snapshot',
      'submitted_at',
      'submitted_by',
      'rag',
      'progress_pct',
    ])
    .executeTakeFirstOrThrow();
  return {
    id: Number(row.id),
    report_id: row.report_id,
    version: row.version,
    snapshot: row.snapshot as Record<string, unknown>,
    submitted_at: tsToString(row.submitted_at) ?? '',
    submitted_by: row.submitted_by ?? 0,
    rag: row.rag,
    progress_pct: row.progress_pct,
  };
}

export async function finalizeWeeklyReportSubmit(input: {
  projectId: number;
  reportId: number;
  latestVersion: number;
  firstSubmittedAt: string | null;
  firstLateness: string | null;
  now: string;
}): Promise<WeeklyReportFullRow | undefined> {
  const db = await getKysely();
  if (input.firstSubmittedAt === null) {
    const row = await db
      .updateTable('weekly_reports')
      .set({
        status: 'submitted',
        latest_version: input.latestVersion,
        correction_open: false,
        first_submitted_at: input.now,
        first_lateness: input.firstLateness,
      })
      .where('id', '=', input.reportId)
      .where('project_id', '=', input.projectId)
      .returning(FULL_SHELL_RETURNING)
      .executeTakeFirst();
    return row ? mapFullRow(row) : undefined;
  }
  const row = await db
    .updateTable('weekly_reports')
    .set({
      status: 'submitted',
      latest_version: input.latestVersion,
      correction_open: false,
    })
    .where('id', '=', input.reportId)
    .where('project_id', '=', input.projectId)
    .returning(FULL_SHELL_RETURNING)
    .executeTakeFirst();
  return row ? mapFullRow(row) : undefined;
}

export async function openCorrectionOnShell(
  projectId: number,
  reportId: number,
  draftFields: DraftUpdateFields,
): Promise<WeeklyReportFullRow | undefined> {
  const set = { correction_open: true, ...buildDraftSet(draftFields) };

  const db = await getKysely();
  const row = await db
    .updateTable('weekly_reports')
    .set(set)
    .where('id', '=', reportId)
    .where('project_id', '=', projectId)
    .where('status', '=', 'submitted')
    .returning(FULL_SHELL_RETURNING)
    .executeTakeFirst();
  return row ? mapFullRow(row) : undefined;
}

export async function getLatestVersionSnapshot(
  reportId: number,
  version: number,
): Promise<Record<string, unknown> | undefined> {
  const db = await getKysely();
  const row = await db
    .selectFrom('weekly_report_versions')
    .select('snapshot')
    .where('report_id', '=', reportId)
    .where('version', '=', version)
    .executeTakeFirst();
  return row?.snapshot as Record<string, unknown> | undefined;
}

export async function listProjectWeeklyHistoryRepo(
  projectId: number,
): Promise<WeeklyHistoryRow[]> {
  const db = await getKysely();
  const rows = await db
    .selectFrom('weekly_reports as wr')
    .innerJoin('weekly_periods as wp', 'wp.id', 'wr.period_id')
    .leftJoin('weekly_report_versions as wv', (join) =>
      join
        .onRef('wv.report_id', '=', 'wr.id')
        .onRef('wv.version', '=', 'wr.latest_version'),
    )
    .select([
      'wp.display_name',
      'wp.iso_week',
      'wr.status',
      'wp.due_at',
      'wr.first_lateness',
      'wr.latest_version',
      sql<number>`wr.id`.as('report_id'),
      sql<number>`wp.id`.as('period_id'),
      'wv.rag',
      'wv.submitted_at',
      'wv.submitted_by',
    ])
    .where('wr.project_id', '=', projectId)
    .orderBy('wp.iso_week', 'desc')
    .execute();
  return rows.map((row) => ({
    display_name: row.display_name,
    iso_week: row.iso_week,
    status: row.status,
    due_at: tsToString(row.due_at) ?? '',
    first_lateness: row.first_lateness,
    latest_version: row.latest_version,
    report_id: Number(row.report_id),
    period_id: Number(row.period_id),
    rag: row.rag,
    submitted_at: tsToString(row.submitted_at),
    submitted_by: row.submitted_by,
  }));
}

export type PeriodShellListRow = {
  project_id: number;
  status: string;
  first_submitted_at: string | null;
  first_lateness: string | null;
  latest_version: number;
  report_id: number;
  due_at: string;
  rag: string | null;
  name: string;
  project_code: string | null;
  stage: string | null;
  pm_user_id: number | null;
  pm_display_name: string | null;
};

export type WeeklyPeriodCompanyRow = {
  id: number;
  company_id: number;
  iso_week: string;
  start_date: string;
  end_date: string;
  due_at: string;
  display_name: string;
};

export async function getWeeklyPeriodByCompany(
  companyId: number,
  periodId: number,
): Promise<WeeklyPeriodCompanyRow | undefined> {
  const db = await getKysely();
  const row = await db
    .selectFrom('weekly_periods')
    .select([
      'id',
      'company_id',
      'iso_week',
      'start_date',
      'end_date',
      'due_at',
      'display_name',
    ])
    .where('id', '=', periodId)
    .where('company_id', '=', companyId)
    .executeTakeFirst();
  if (!row) return undefined;
  return {
    id: Number(row.id),
    company_id: row.company_id,
    iso_week: row.iso_week,
    start_date: row.start_date,
    end_date: row.end_date,
    due_at: tsToString(row.due_at) ?? '',
    display_name: row.display_name,
  };
}

export async function listPeriodShellsRepo(
  companyId: number,
  periodId: number,
): Promise<PeriodShellListRow[]> {
  const db = await getKysely();
  const rows = await db
    .selectFrom('weekly_reports as wr')
    .innerJoin('weekly_periods as wp', (join) =>
      join.onRef('wp.id', '=', 'wr.period_id').on('wp.company_id', '=', companyId),
    )
    .innerJoin('projects as p', 'p.id', 'wr.project_id')
    .leftJoin('weekly_report_versions as wv', (join) =>
      join
        .onRef('wv.report_id', '=', 'wr.id')
        .onRef('wv.version', '=', 'wr.latest_version'),
    )
    .leftJoin('project_pm_assignments as pma', (join) =>
      join
        .onRef('pma.project_id', '=', 'wr.project_id')
        .on('pma.role', '=', 'primary')
        .on(sql<boolean>`pma.effective_from <= CURRENT_DATE`)
        .on(sql<boolean>`(pma.effective_to IS NULL OR pma.effective_to > CURRENT_DATE)`),
    )
    .leftJoin('users as u', 'u.id', 'pma.user_id')
    .select([
      'wr.project_id',
      'wr.status',
      'wr.first_submitted_at',
      'wr.first_lateness',
      'wr.latest_version',
      sql<number>`wr.id`.as('report_id'),
      'wp.due_at',
      'wv.rag',
      'p.name',
      'p.project_code',
      'p.stage',
      sql<number | null>`pma.user_id`.as('pm_user_id'),
      sql<string | null>`u.display_name`.as('pm_display_name'),
    ])
    .where('wr.period_id', '=', periodId)
    .orderBy('wr.project_id')
    .execute();
  return rows.map((row) => ({
    project_id: row.project_id,
    status: row.status,
    first_submitted_at: tsToString(row.first_submitted_at),
    first_lateness: row.first_lateness,
    latest_version: row.latest_version,
    report_id: Number(row.report_id),
    due_at: tsToString(row.due_at) ?? '',
    rag: row.rag,
    name: row.name,
    project_code: row.project_code,
    stage: row.stage,
    pm_user_id: row.pm_user_id == null ? null : Number(row.pm_user_id),
    pm_display_name: row.pm_display_name,
  }));
}
