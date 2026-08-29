import { sql, type Insertable, type Updateable } from 'kysely';
import type { Database } from '@/lib/db/database';
import { getKysely } from '@/lib/db/kysely';
import { pickAllowed } from '@/lib/repositories/_kysely-helpers';

/**
 * Updatable columns for `issues`. `priority`, `impact` and `affected_activity_id` are
 * migration-added — see ALLOWLIST-DIFF.md.
 */
export const ISSUE_COLUMNS = [
  'issue_id', 'code', 'description', 'root_cause', 'category', 'owner', 'trigger', 'mitigation',
  'due_date', 'status', 'priority', 'impact', 'affected_activity_id', 'technology_council',
] as const;

type IssueUpdate = Pick<Updateable<Database['issues']>, typeof ISSUE_COLUMNS[number]>;

function raidTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listIssues(projectId: number | string) {
  const db = await getKysely();
  const today = raidTodayUtc();
  return db
    .selectFrom('issues')
    .selectAll()
    .select(sql<boolean>`(due_date < ${today} AND status IN ('Open','In Progress'))`.as('is_overdue'))
    .where('project_id', '=', Number(projectId))
    .orderBy(sql`CASE WHEN status IN ('Open','In Progress') THEN 0 ELSE 1 END`)
    .orderBy(sql`CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END`)
    .orderBy(sql`CASE WHEN (due_date < ${today} AND status IN ('Open','In Progress')) THEN 0 ELSE 1 END`)
    .orderBy(sql`due_date NULLS LAST`)
    .orderBy('id')
    .execute();
}

export async function countIssues(projectId: number | string): Promise<number> {
  const db = await getKysely();
  const row = await db
    .selectFrom('issues')
    .select((eb) => eb.fn.countAll<number>().as('c'))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
  return Number(row?.c ?? 0);
}

export async function getIssue(projectId: number | string, rowId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('issues')
    .selectAll()
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
}

export async function findIssueByCode(
  projectId: number | string,
  code: string,
  excludeId?: number | string,
) {
  const db = await getKysely();
  return db
    .selectFrom('issues')
    .select('id')
    .where('project_id', '=', Number(projectId))
    .where(sql`LOWER(code)`, '=', code.toLowerCase())
    .where('id', '!=', excludeId != null ? Number(excludeId) : -1)
    .limit(1)
    .executeTakeFirst();
}

async function nextAutoIssueCode(projectId: number | string): Promise<string> {
  const db = await getKysely();
  const rows = await db
    .selectFrom('issues')
    .select('code')
    .where('project_id', '=', Number(projectId))
    .where(sql<boolean>`code ~ '^I-[0-9]+$'`)
    .execute();
  let max = 0;
  for (const row of rows) {
    const m = /^I-(\d+)$/.exec(row.code ?? '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max > 0 ? max + 1 : (await countIssues(projectId)) + 1;
  return `I-${String(next).padStart(3, '0')}`;
}

export async function createIssue(projectId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  const b = body as Record<string, unknown>;
  let code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!code) {
    do {
      code = await nextAutoIssueCode(projectId);
    } while (await findIssueByCode(projectId, code));
  }
  const issueId = b.issue_id || code;
  const values: Insertable<Database['issues']> = {
    project_id: Number(projectId),
    issue_id: String(issueId),
    code,
    description: b.description != null ? String(b.description) : '',
    root_cause: b.root_cause != null ? String(b.root_cause) : '',
    category: b.category != null ? String(b.category) : '',
    owner: b.owner != null ? String(b.owner) : '',
    trigger: b.trigger != null ? String(b.trigger) : '',
    mitigation: b.mitigation != null ? String(b.mitigation) : '',
    due_date: b.due_date != null ? String(b.due_date) : '',
    status: b.status != null ? String(b.status) : 'Open',
    priority: b.priority != null ? String(b.priority) : 'Medium',
    impact: b.impact != null ? String(b.impact) : 'Major',
    affected_activity_id: b.affected_activity_id != null ? Number(b.affected_activity_id) : null,
    technology_council: b.technology_council != null ? Boolean(b.technology_council) : false,
  };
  return db
    .insertInto('issues')
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** @throws UnknownColumnError when `fields` names a column outside ISSUE_COLUMNS. */
export async function updateIssue(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const picked = pickAllowed<IssueUpdate>(ISSUE_COLUMNS, fields);
  const db = await getKysely();
  return db
    .updateTable('issues')
    .set(picked)
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}

export async function deactivateIssue(projectId: number | string, rowId: number | string) {
  const db = await getKysely();
  return db
    .updateTable('issues')
    .set({
      status: 'deactivated',
      deactivated_at: sql`now()`,
    })
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}

/** Open issues for the weekly report: status Open or In Progress, ordered by priority severity with overdue first (D-07). */
export async function listOpenIssues(projectId: number | string) {
  const db = await getKysely();
  const today = raidTodayUtc();
  return db
    .selectFrom('issues')
    .selectAll()
    .select(sql<boolean>`(due_date < ${today} AND status IN ('Open','In Progress'))`.as('is_overdue'))
    .where('project_id', '=', Number(projectId))
    .where((eb) => eb.or([eb('status', '=', 'Open'), eb('status', '=', 'In Progress')]))
    .orderBy(sql`CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END`)
    .orderBy(sql`CASE WHEN (due_date < ${today} AND status IN ('Open','In Progress')) THEN 0 ELSE 1 END`)
    .orderBy(sql`due_date NULLS LAST`)
    .orderBy('id')
    .execute();
}

/** Everything not Closed, ordered by priority severity — matches the project-report page. */
export async function listNotClosedByPriority(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('issues')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .where('status', '!=', 'Closed')
    .orderBy(sql`CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END`)
    .orderBy('id')
    .execute();
}

/** Open/In Progress technology-council issues for a company (D-08). */
export async function listTechnologyCouncilIssues(companyId: number | null) {
  const db = await getKysely();
  let q = db
    .selectFrom('issues as i')
    .innerJoin('projects as p', 'p.id', 'i.project_id')
    .leftJoin('customers as c', 'c.id', 'p.customer_id')
    .selectAll('i')
    .select('p.name as project_name')
    .where('i.technology_council', 'is', true)
    .where((eb) => eb.or([eb('i.status', '=', 'Open'), eb('i.status', '=', 'In Progress')]));
  if (companyId !== null) {
    q = q.where((eb) => eb.or([
      eb('p.company_id', '=', companyId),
      eb('c.company_id', '=', companyId),
    ]));
  } else {
    q = q
      .where('p.company_id', 'is', null)
      .where((eb) => eb.or([
        eb('p.customer_id', 'is', null),
        eb('c.company_id', 'is', null),
      ]));
  }
  return q.orderBy('p.name').orderBy('i.id').execute();
}
