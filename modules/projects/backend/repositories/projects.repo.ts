import { sql, type Insertable, type Updateable } from 'kysely';
import type { Database } from '@/lib/db/database';
import { getKysely } from '@/lib/db/kysely';
import { pickAllowed } from '@/lib/repositories/_kysely-helpers';

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

type ProjectUpdate = Pick<Updateable<Database['projects']>, typeof PROJECT_COLUMNS[number]>;

export type ProjectAccessRow = {
  company_id: number | null;
  customer_company_id: number | null;
};

function deleteResult(numDeletedRows: bigint | number | undefined) {
  return { lastInsertRowid: 0, changes: Number(numDeletedRows ?? 0) };
}

/** Tenancy columns for an access check. Returns undefined when the project does not exist. */
export async function projectAccessRow(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('projects as p')
    .leftJoin('customers as c', 'p.customer_id', 'c.id')
    .select(['p.company_id', sql<number | null>`c.company_id`.as('customer_company_id')])
    .where('p.id', '=', Number(projectId))
    .executeTakeFirst();
}

export async function getProject(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('projects')
    .selectAll()
    .where('id', '=', Number(projectId))
    .executeTakeFirst();
}

/** PM identity columns for interim D-14 assignment checks. */
export async function getProjectPmIdentity(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('projects')
    .select(['pm_name', 'pm_email'])
    .where('id', '=', Number(projectId))
    .executeTakeFirst();
}

/** Case-insensitive per-company project code lookup (D-01). */
export async function findProjectByCompanyCode(companyId: number, code: string) {
  const db = await getKysely();
  return db
    .selectFrom('projects')
    .select('id')
    .where('company_id', '=', companyId)
    .where(sql`LOWER(project_code)`, '=', code.toLowerCase())
    .limit(1)
    .executeTakeFirst();
}

/**
 * Project list, company-scoped.
 *
 * Takes the resolved `companyId` rather than a session (REPO-02). Optional PM
 * opts AND the D-14 assignment predicate for PM-only list filtering (D-14).
 */
export async function listProjects(
  companyId: number | null,
  opts?: { pmUserId?: number },
) {
  const db = await getKysely();
  let q = db
    .selectFrom('projects as p')
    .leftJoin('customers as c', 'p.customer_id', 'c.id')
    .selectAll('p')
    .select([
      sql<string | null>`c.name`.as('program_name'),
      sql<string | null>`c.industry`.as('program_industry'),
    ]);

  if (companyId !== null) {
    q = q.where((eb) =>
      eb.or([
        eb('p.company_id', '=', companyId),
        eb('c.company_id', '=', companyId),
      ]),
    );
    if (opts?.pmUserId !== undefined) {
      const pmUserId = opts.pmUserId;
      q = q.where(({ exists, selectFrom }) =>
        exists(
          selectFrom('project_pm_assignments as a')
            .select(sql<number>`1`.as('ok'))
            .whereRef('a.project_id', '=', 'p.id')
            .where('a.user_id', '=', pmUserId)
            .where(sql<boolean>`a.effective_from <= CURRENT_DATE`)
            .where(sql<boolean>`(a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)`),
        ),
      );
    }
    return q.orderBy('p.created_at', 'desc').execute();
  }

  return q
    .where('p.company_id', 'is', null)
    .where((eb) =>
      eb.or([
        eb('p.customer_id', 'is', null),
        eb('c.company_id', 'is', null),
      ]),
    )
    .orderBy('p.created_at', 'desc')
    .execute();
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
  const db = await getKysely();
  const values: Insertable<Database['projects']> = {
    name: String(body.name),
    client: body.client != null ? String(body.client) : '',
    customer_id: body.customer_id != null ? Number(body.customer_id) : null,
    pm_name: body.pm_name != null ? String(body.pm_name) : '',
    pm_email: body.pm_email != null ? String(body.pm_email) : '',
    start_date: body.start_date != null ? String(body.start_date) : '',
    end_date: body.end_date != null ? String(body.end_date) : '',
    description: body.description != null ? String(body.description) : '',
    current_phase: body.current_phase != null ? String(body.current_phase) : 'Initiation',
    objective: body.objective != null ? String(body.objective) : '',
    project_owner: body.project_owner != null ? String(body.project_owner) : '',
    budget: body.budget ? Number(body.budget) : 0,
    budget_currency: body.budget_currency != null ? String(body.budget_currency) : 'VND',
    company_id: companyId,
    project_code: body.project_code != null ? String(body.project_code) : null,
    portfolio_year: body.portfolio_year != null ? Number(body.portfolio_year) : null,
    stage: body.stage != null ? String(body.stage) : null,
    progress_pct: body.progress_pct != null ? Number(body.progress_pct) : 0,
    weekly_report_enabled: body.weekly_report_enabled != null ? Boolean(body.weekly_report_enabled) : false,
    created_at: new Date(),
  };
  const project = await db
    .insertInto('projects')
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();

  const newId = project.id;

  for (const m of DEFAULT_MEETINGS) {
    await db
      .insertInto('meetings')
      .values({
        project_id: Number(newId),
        name: m.name,
        frequency: m.frequency,
        content: m.content,
        participants: m.participants,
        method: m.method,
        type: m.type,
      })
      .execute();
  }
  for (const e of DEFAULT_ESCALATIONS) {
    await db
      .insertInto('escalation_levels')
      .values({
        project_id: Number(newId),
        level: e.level,
        level_name: e.level_name,
        channel: e.channel,
        participants: e.participants,
        input: e.input,
        output: e.output,
      })
      .execute();
  }

  return project;
}

/** Throws UnknownColumnError when `fields` carries a key outside PROJECT_COLUMNS. */
export async function updateProject(projectId: number | string, fields: Record<string, unknown>) {
  const picked = pickAllowed<ProjectUpdate>(PROJECT_COLUMNS, fields);
  const db = await getKysely();
  await db
    .updateTable('projects')
    .set(picked)
    .where('id', '=', Number(projectId))
    .execute();
  return getProject(projectId);
}

export async function deleteProject(projectId: number | string) {
  const db = await getKysely();
  const [result] = await db
    .deleteFrom('projects')
    .where('id', '=', Number(projectId))
    .execute();
  return deleteResult(result?.numDeletedRows);
}

/** Project plus its customer name, the shape the weekly report renders. */
export async function getProjectWithCustomer(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('projects as p')
    .leftJoin('customers as c', 'p.customer_id', 'c.id')
    .selectAll('p')
    .select(sql<string | null>`c.name`.as('customer_name'))
    .where('p.id', '=', Number(projectId))
    .executeTakeFirst();
}

/**
 * Same row as `getProjectWithCustomer` but also aliased as `program_name`.
 * Two aliases for one column is the project-report page's existing contract — kept
 * rather than "cleaned up", because the client reads both names.
 */
export async function getProjectForReport(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('projects as p')
    .leftJoin('customers as c', 'p.customer_id', 'c.id')
    .selectAll('p')
    .select([
      sql<string | null>`c.name`.as('customer_name'),
      sql<string | null>`c.name`.as('program_name'),
    ])
    .where('p.id', '=', Number(projectId))
    .executeTakeFirst();
}
