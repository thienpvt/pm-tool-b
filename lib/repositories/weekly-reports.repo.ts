import { getDb } from '@/lib/db';

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

const FULL_SHELL_SELECT = `
  SELECT wr.id, wr.period_id, wr.project_id, wr.status,
         wr.first_submitted_at, wr.first_lateness, wr.latest_version, wr.correction_open,
         wr.highlights, wr.completed_work, wr.next_week_goals, wr.nearest_milestone,
         wr.nearest_milestone_id, wr.raid_dependency, wr.leadership_support,
         wr.this_week_rag, wr.prev_week_rag, wr.draft_raid_json
  FROM weekly_reports wr`;

export async function insertShell(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: WeeklyReportShellRow[] }> },
  periodId: number,
  projectId: number,
): Promise<WeeklyReportShellRow | undefined> {
  const res = await client.query(
    `INSERT INTO weekly_reports (period_id, project_id)
     VALUES ($1, $2)
     ON CONFLICT (period_id, project_id) DO NOTHING
     RETURNING id, period_id, project_id, status`,
    [periodId, projectId],
  );
  return res.rows[0];
}

export async function getShellsForPeriod(periodId: number): Promise<WeeklyReportShellRow[]> {
  const db = await getDb();
  return db.all<WeeklyReportShellRow>(
    `SELECT id, period_id, project_id, status FROM weekly_reports WHERE period_id = ? ORDER BY project_id`,
    periodId,
  );
}

export async function getWeeklyReportFullRow(
  projectId: number,
  reportId: number,
): Promise<WeeklyReportFullRow | undefined> {
  const db = await getDb();
  return db.get<WeeklyReportFullRow>(
    `${FULL_SHELL_SELECT} WHERE wr.id = ? AND wr.project_id = ?`,
    reportId,
    projectId,
  );
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
  const db = await getDb();
  return db.get(
    `SELECT id, latest_version, status, correction_open, first_submitted_at, first_lateness
     FROM weekly_reports
     WHERE id = ? AND project_id = ?
     FOR UPDATE`,
    reportId,
    projectId,
  );
}

export async function getWeeklyReportWithPeriod(
  projectId: number,
  reportId: number,
): Promise<WeeklyReportWithPeriodRow | undefined> {
  const db = await getDb();
  return db.get<WeeklyReportWithPeriodRow>(
    `SELECT wr.id, wr.period_id, wr.project_id, wr.status,
            wr.first_submitted_at, wr.first_lateness, wr.latest_version, wr.correction_open,
            wr.highlights, wr.completed_work, wr.next_week_goals, wr.nearest_milestone,
            wr.nearest_milestone_id, wr.raid_dependency, wr.leadership_support,
            wr.this_week_rag, wr.prev_week_rag, wr.draft_raid_json,
            wp.iso_week, wp.due_at, wp.display_name, wp.company_id
     FROM weekly_reports wr
     JOIN weekly_periods wp ON wp.id = wr.period_id
     WHERE wr.id = ? AND wr.project_id = ?`,
    reportId,
    projectId,
  );
}

export async function updatePrevWeekRag(
  projectId: number,
  reportId: number,
  prevWeekRag: string | null,
): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE weekly_reports SET prev_week_rag = ?
     WHERE id = ? AND project_id = ?`,
    prevWeekRag,
    reportId,
    projectId,
  );
}

export async function getPriorPeriodSubmittedRag(
  companyId: number,
  projectId: number,
  currentIsoWeek: string,
): Promise<string | null> {
  const db = await getDb();
  const row = await db.get<{ rag: string | null; snapshot: Record<string, unknown> }>(
    `SELECT wv.rag, wv.snapshot
     FROM weekly_periods wp
     JOIN weekly_reports wr ON wr.period_id = wp.id AND wr.project_id = ?
     JOIN weekly_report_versions wv ON wv.report_id = wr.id AND wv.version = wr.latest_version
     WHERE wp.company_id = ?
       AND wp.iso_week < ?
       AND wr.status = 'submitted'
     ORDER BY wp.iso_week DESC
     LIMIT 1`,
    projectId,
    companyId,
    currentIsoWeek,
  );
  if (!row) return null;
  if (row.rag) return row.rag;
  const snap = row.snapshot;
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
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    if (key === 'draft_raid_json') {
      params.push(value === null ? null : JSON.stringify(value));
    } else {
      params.push(value);
    }
  }
  if (sets.length === 0) {
    return getWeeklyReportFullRow(projectId, reportId);
  }

  const db = await getDb();
  return db.get<WeeklyReportFullRow>(
    `UPDATE weekly_reports SET ${sets.join(', ')}
     WHERE id = ? AND project_id = ?
       AND (status IN ('not_submitted', 'draft') OR correction_open IS TRUE)
     RETURNING id, period_id, project_id, status,
               first_submitted_at, first_lateness, latest_version, correction_open,
               highlights, completed_work, next_week_goals, nearest_milestone,
               nearest_milestone_id, raid_dependency, leadership_support,
               this_week_rag, prev_week_rag, draft_raid_json`,
    ...params,
    reportId,
    projectId,
  );
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
  const db = await getDb();
  const row = await db.get<WeeklyReportVersionRow>(
    `INSERT INTO weekly_report_versions
       (report_id, version, snapshot, submitted_at, submitted_by, rag, progress_pct)
     VALUES (?, ?, ?::jsonb, ?, ?, ?, ?)
     RETURNING id, report_id, version, snapshot, submitted_at, submitted_by, rag, progress_pct`,
    input.reportId,
    input.version,
    JSON.stringify(input.snapshot),
    input.submittedAt,
    input.submittedBy,
    input.rag,
    input.progressPct ?? null,
  );
  if (!row) throw new Error('insertWeeklyReportVersion failed');
  return row;
}

export async function finalizeWeeklyReportSubmit(input: {
  projectId: number;
  reportId: number;
  latestVersion: number;
  firstSubmittedAt: string | null;
  firstLateness: string | null;
  now: string;
}): Promise<WeeklyReportFullRow | undefined> {
  const db = await getDb();
  if (input.firstSubmittedAt === null) {
    return db.get<WeeklyReportFullRow>(
      `UPDATE weekly_reports SET
         status = 'submitted',
         latest_version = ?,
         correction_open = FALSE,
         first_submitted_at = ?,
         first_lateness = ?
       WHERE id = ? AND project_id = ?
       RETURNING id, period_id, project_id, status,
                 first_submitted_at, first_lateness, latest_version, correction_open,
                 highlights, completed_work, next_week_goals, nearest_milestone,
                 nearest_milestone_id, raid_dependency, leadership_support,
                 this_week_rag, prev_week_rag, draft_raid_json`,
      input.latestVersion,
      input.now,
      input.firstLateness,
      input.reportId,
      input.projectId,
    );
  }
  return db.get<WeeklyReportFullRow>(
    `UPDATE weekly_reports SET
       status = 'submitted',
       latest_version = ?,
       correction_open = FALSE
     WHERE id = ? AND project_id = ?
     RETURNING id, period_id, project_id, status,
               first_submitted_at, first_lateness, latest_version, correction_open,
               highlights, completed_work, next_week_goals, nearest_milestone,
               nearest_milestone_id, raid_dependency, leadership_support,
               this_week_rag, prev_week_rag, draft_raid_json`,
    input.latestVersion,
    input.reportId,
    input.projectId,
  );
}

export async function openCorrectionOnShell(
  projectId: number,
  reportId: number,
  draftFields: DraftUpdateFields,
): Promise<WeeklyReportFullRow | undefined> {
  const sets: string[] = ['correction_open = TRUE'];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(draftFields)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    if (key === 'draft_raid_json') {
      params.push(value === null ? null : JSON.stringify(value));
    } else {
      params.push(value);
    }
  }

  const db = await getDb();
  return db.get<WeeklyReportFullRow>(
    `UPDATE weekly_reports SET ${sets.join(', ')}
     WHERE id = ? AND project_id = ? AND status = 'submitted'
     RETURNING id, period_id, project_id, status,
               first_submitted_at, first_lateness, latest_version, correction_open,
               highlights, completed_work, next_week_goals, nearest_milestone,
               nearest_milestone_id, raid_dependency, leadership_support,
               this_week_rag, prev_week_rag, draft_raid_json`,
    ...params,
    reportId,
    projectId,
  );
}

export async function getLatestVersionSnapshot(
  reportId: number,
  version: number,
): Promise<Record<string, unknown> | undefined> {
  const db = await getDb();
  const row = await db.get<{ snapshot: Record<string, unknown> }>(
    `SELECT snapshot FROM weekly_report_versions WHERE report_id = ? AND version = ?`,
    reportId,
    version,
  );
  return row?.snapshot;
}

export async function listProjectWeeklyHistoryRepo(
  projectId: number,
): Promise<WeeklyHistoryRow[]> {
  const db = await getDb();
  return db.all<WeeklyHistoryRow>(
    `SELECT wp.display_name, wp.iso_week, wr.status, wp.due_at,
            wr.first_lateness, wr.latest_version, wr.id AS report_id, wp.id AS period_id,
            wv.rag, wv.submitted_at, wv.submitted_by
     FROM weekly_reports wr
     JOIN weekly_periods wp ON wp.id = wr.period_id
     LEFT JOIN weekly_report_versions wv
       ON wv.report_id = wr.id AND wv.version = wr.latest_version
     WHERE wr.project_id = ?
     ORDER BY wp.iso_week DESC`,
    projectId,
  );
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
  const db = await getDb();
  return db.get<WeeklyPeriodCompanyRow>(
    `SELECT id, company_id, iso_week, start_date, end_date, due_at, display_name
     FROM weekly_periods WHERE id = ? AND company_id = ?`,
    periodId,
    companyId,
  );
}

export async function listPeriodShellsRepo(
  companyId: number,
  periodId: number,
): Promise<PeriodShellListRow[]> {
  const db = await getDb();
  return db.all<PeriodShellListRow>(
    `SELECT wr.project_id, wr.status, wr.first_submitted_at, wr.first_lateness,
            wr.latest_version, wr.id AS report_id, wp.due_at, wv.rag,
            p.name, p.project_code, p.stage,
            pma.user_id AS pm_user_id, u.display_name AS pm_display_name
     FROM weekly_reports wr
     JOIN weekly_periods wp ON wp.id = wr.period_id AND wp.company_id = ?
     JOIN projects p ON p.id = wr.project_id
     LEFT JOIN weekly_report_versions wv
       ON wv.report_id = wr.id AND wv.version = wr.latest_version
     LEFT JOIN project_pm_assignments pma
       ON pma.project_id = wr.project_id AND pma.role = 'primary'
       AND pma.effective_from <= CURRENT_DATE
       AND (pma.effective_to IS NULL OR pma.effective_to > CURRENT_DATE)
     LEFT JOIN users u ON u.id = pma.user_id
     WHERE wr.period_id = ?
     ORDER BY wr.project_id`,
    companyId,
    periodId,
  );
}
