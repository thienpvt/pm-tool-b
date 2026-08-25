import { getDb } from '@/lib/db';
import { buildUpdate } from './_helpers';

/**
 * Updatable columns for `projects`.
 *
 * `company_id` and `customer_id` are deliberately absent: they decide which
 * tenant owns the row, and the PATCH handler used to let a caller set them.
 * `id` is the WHERE key and `created_at` is a DB default.
 * See ALLOWLIST-DIFF.md for the full derivation.
 */
export const PROJECT_COLUMNS = [
  'name',
  'client',
  'pm_name',
  'pm_email',
  'start_date',
  'end_date',
  'status',
  'current_phase',
  'description',
  'objective',
  'project_owner',
  'budget',
  'budget_currency',
  'headcount_quota',
  'budget_status',
  'project_code',
  'portfolio_year',
  'stage',
  'status_reason',
  'rag',
  'progress_pct',
  'weekly_report_enabled',
  'weekly_report_start_period',
  'plan_end',
  'adjusted_end',
  'actual_end',
  'classification',
  'governance',
] as const;

export type ProjectAccessRow = {
  company_id: number | null;
  customer_company_id: number | null;
};

/** Tenancy columns for an access check. Returns undefined when the project does not exist. */
export async function projectAccessRow(projectId: number | string) {
  const db = await getDb();
  return db.get<ProjectAccessRow>(
    `SELECT p.company_id, c.company_id AS customer_company_id
     FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
     WHERE p.id = ?`,
    Number(projectId)
  );
}

export async function getProject(projectId: number | string) {
  const db = await getDb();
  return db.get('SELECT * FROM projects WHERE id = ?', projectId);
}

const LIST_SELECT = `SELECT p.*, c.name as program_name, c.industry as program_industry
   FROM projects p LEFT JOIN customers c ON p.customer_id = c.id`;

/** PM identity columns for interim D-14 assignment checks. */
export async function getProjectPmIdentity(projectId: number | string) {
  const db = await getDb();
  return db.get<{ pm_name: string; pm_email: string }>(
    'SELECT pm_name, pm_email FROM projects WHERE id = ?',
    Number(projectId),
  );
}

/** Case-insensitive per-company project code lookup (D-01). */
export async function findProjectByCompanyCode(companyId: number, code: string) {
  const db = await getDb();
  return db.get<{ id: number }>(
    `SELECT id FROM projects
     WHERE company_id = ? AND LOWER(project_code) = LOWER(?)
     LIMIT 1`,
    companyId,
    code,
  );
}

/**
 * Project list, company-scoped.
 *
 * Takes the resolved `companyId` rather than a session (REPO-02). Optional PM
 * opts AND the D-14 assignment predicate for PM-only list filtering (D-14).
 */
export async function listProjects(
  companyId: number | null,
  opts?: { pmEmail?: string; pmName?: string; username?: string },
) {
  const db = await getDb();
  if (companyId !== null) {
    let sql = `${LIST_SELECT} WHERE (p.company_id = ? OR c.company_id = ?)`;
    const params: unknown[] = [companyId, companyId];
    if (opts) {
      sql += ` AND (
        (TRIM(COALESCE(p.pm_email, '')) != '' AND LOWER(p.pm_email) = LOWER(?))
        OR (TRIM(COALESCE(p.pm_email, '')) = '' AND (
          LOWER(TRIM(COALESCE(p.pm_name, ''))) = LOWER(TRIM(?))
          OR LOWER(TRIM(COALESCE(p.pm_name, ''))) = LOWER(TRIM(?))
        ))
      )`;
      params.push(opts.pmEmail ?? '', opts.pmName ?? '', opts.username ?? '');
    }
    sql += ' ORDER BY p.created_at DESC';
    return db.all(sql, ...params);
  }
  return db.all(
    `${LIST_SELECT} WHERE p.company_id IS NULL
     AND (p.customer_id IS NULL OR c.company_id IS NULL) ORDER BY p.created_at DESC`,
  );
}

/** Default meetings seeded into every new project. Verbatim from the current route. */
const DEFAULT_MEETINGS = [
  { name: 'PROJECT SYNC-UP WITH SPONSOR', frequency: 'Every Wednesday – 10h30 - 11h00', content: 'Project progress, Discuss any key updates or risks, Next action plan', participants: 'Project Sponsor, Head of Software Engineering, Head of Solution Architect, Project Manager', method: 'Conf. Call / E-Mail', type: 'sponsor' },
  { name: 'PROJECT SYNC-UP WITH TECHNICAL LEADER/MANAGER', frequency: 'Every Friday – 15h00 - 15h30', content: 'List of completed tasks, Current Plan, Risk & Issue, Next action plan', participants: 'Head of Software Engineering, Head of Solution Architect, Project Manager, Technical Leaders/Manager, Delivery manager', method: 'Offline meeting', type: 'technical' },
  { name: 'WORKING TEAM (Follow Scrum Framework)', frequency: 'Daily stand-up: Every morning – Timebox 15m', content: 'Daily progress, blockers, next steps', participants: 'Technical leader & Members', method: 'Offline/Online', type: 'team' },
];

/** Default escalation levels seeded into every new project. Verbatim from the current route. */
const DEFAULT_ESCALATIONS = [
  { level: 3, level_name: 'Level 3 – Steering Committee', channel: 'Steering Committee (Monthly or CRITICAL ISSUE)', participants: 'Customer: Project Director\nVendor: Program Manager', input: 'Issue escalation', output: 'Executive Commitment\nIssue resolution\nStrategic Direction' },
  { level: 2, level_name: 'Level 2 – Project Management', channel: 'Weekly meeting or per request', participants: 'Customer: Head of product, delivery manager\nVendor: Program Manager, Account Management', input: 'Issue escalation', output: 'Update project plan if needed' },
  { level: 1, level_name: 'Level 1 – Development team', channel: 'Daily meeting or ad-hoc meeting', participants: 'Customer: team leads\nVendor: PM, team leads', input: 'Issue/blockers', output: 'Resolution plan' },
];

/**
 * Create a project and seed its default meetings and escalation levels.
 *
 * `companyId` is resolved by the caller — for an admin it comes from the body, for a
 * normal user from the session. The repository takes the decided value (REPO-02).
 */
export async function createProject(companyId: number | null, body: Record<string, unknown>) {
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO projects (
      name, client, customer_id, pm_name, pm_email, start_date, end_date, description,
      current_phase, objective, project_owner, budget, budget_currency, company_id,
      project_code, portfolio_year, stage, progress_pct, weekly_report_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    body.name,
    body.client ?? '',
    body.customer_id ?? null,
    body.pm_name ?? '',
    body.pm_email ?? '',
    body.start_date ?? '',
    body.end_date ?? '',
    body.description ?? '',
    body.current_phase ?? 'Initiation',
    body.objective ?? '',
    body.project_owner ?? '',
    body.budget ? Number(body.budget) : 0,
    body.budget_currency ?? 'VND',
    companyId,
    body.project_code ?? null,
    body.portfolio_year ?? null,
    body.stage ?? null,
    body.progress_pct ?? 0,
    body.weekly_report_enabled ?? false,
  );

  const newId = result.lastInsertRowid;
  const project = await db.get('SELECT * FROM projects WHERE id = ?', newId);

  for (const m of DEFAULT_MEETINGS) {
    await db.run(
      'INSERT INTO meetings (project_id, name, frequency, content, participants, method, type) VALUES (?,?,?,?,?,?,?)',
      newId, m.name, m.frequency, m.content, m.participants, m.method, m.type,
    );
  }
  for (const e of DEFAULT_ESCALATIONS) {
    await db.run(
      'INSERT INTO escalation_levels (project_id, level, level_name, channel, participants, input, output) VALUES (?,?,?,?,?,?,?)',
      newId, e.level, e.level_name, e.channel, e.participants, e.input, e.output,
    );
  }

  return project;
}

/** Throws UnknownColumnError when `fields` carries a key outside PROJECT_COLUMNS. */
export async function updateProject(projectId: number | string, fields: Record<string, unknown>) {
  const { sql, values } = buildUpdate('projects', PROJECT_COLUMNS, fields);
  const db = await getDb();
  await db.run(`UPDATE projects SET ${sql} WHERE id = ?`, ...values, projectId);
  return getProject(projectId);
}

export async function deleteProject(projectId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM projects WHERE id = ?', projectId);
}

/** Project plus its customer name, the shape the weekly report renders. */
export async function getProjectWithCustomer(projectId: number | string) {
  const db = await getDb();
  return db.get(
    `SELECT p.*, c.name as customer_name
     FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
     WHERE p.id = ?`,
    projectId,
  );
}

/**
 * Same row as `getProjectWithCustomer` but also aliased as `program_name`.
 * Two aliases for one column is the project-report page's existing contract — kept
 * rather than "cleaned up", because the client reads both names.
 */
export async function getProjectForReport(projectId: number | string) {
  const db = await getDb();
  return db.get(
    `SELECT p.*, c.name as customer_name, c.name as program_name
     FROM projects p
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE p.id = ?`,
    projectId,
  );
}
