import { sql, type Insertable, type Updateable } from 'kysely';
import type { Database } from '@/lib/db/database';
import { getKysely } from '@/lib/db/kysely';
import { pickAllowed } from '@/lib/repositories/_kysely-helpers';

/**
 * Updatable columns for `risks`. `priority`, `impact` and `affected_activity_id` are
 * migration-added — see ALLOWLIST-DIFF.md.
 */
export const RISK_COLUMNS = [
  'risk_id', 'code', 'description', 'category', 'owner', 'trigger', 'mitigation', 'due_date',
  'status', 'priority', 'impact', 'affected_activity_id',
] as const;

type RiskUpdate = Pick<Updateable<Database['risks']>, typeof RISK_COLUMNS[number]>;

function raidTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listRisks(projectId: number | string) {
  const db = await getKysely();
  const today = raidTodayUtc();
  return db
    .selectFrom('risks')
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

export async function countRisks(projectId: number | string): Promise<number> {
  const db = await getKysely();
  const row = await db
    .selectFrom('risks')
    .select((eb) => eb.fn.countAll<number>().as('c'))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
  return Number(row?.c ?? 0);
}

export async function getRisk(projectId: number | string, rowId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('risks')
    .selectAll()
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
}

export async function findRiskByCode(
  projectId: number | string,
  code: string,
  excludeId?: number | string,
) {
  const db = await getKysely();
  let q = db
    .selectFrom('risks')
    .select('id')
    .where('project_id', '=', Number(projectId))
    .where(sql`LOWER(code)`, '=', code.toLowerCase())
    .where('id', '!=', excludeId != null ? Number(excludeId) : -1)
    .limit(1);
  return q.executeTakeFirst();
}

async function nextAutoRiskCode(projectId: number | string): Promise<string> {
  const db = await getKysely();
  const rows = await db
    .selectFrom('risks')
    .select('code')
    .where('project_id', '=', Number(projectId))
    .where(sql<boolean>`code ~ '^R-[0-9]+$'`)
    .execute();
  let max = 0;
  for (const row of rows) {
    const m = /^R-(\d+)$/.exec(row.code ?? '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max > 0 ? max + 1 : (await countRisks(projectId)) + 1;
  return `R-${String(next).padStart(3, '0')}`;
}

export async function createRisk(projectId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  const b = body as Record<string, unknown>;
  let code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!code) {
    do {
      code = await nextAutoRiskCode(projectId);
    } while (await findRiskByCode(projectId, code));
  }
  const riskId = b.risk_id || code;
  const values: Insertable<Database['risks']> = {
    project_id: Number(projectId),
    risk_id: String(riskId),
    code,
    description: b.description != null ? String(b.description) : '',
    category: b.category != null ? String(b.category) : '',
    owner: b.owner != null ? String(b.owner) : '',
    trigger: b.trigger != null ? String(b.trigger) : '',
    mitigation: b.mitigation != null ? String(b.mitigation) : '',
    due_date: b.due_date != null ? String(b.due_date) : '',
    status: b.status != null ? String(b.status) : 'Open',
    priority: b.priority != null ? String(b.priority) : 'Medium',
    impact: b.impact != null ? String(b.impact) : 'Major',
    affected_activity_id: b.affected_activity_id != null ? Number(b.affected_activity_id) : null,
  };
  return db
    .insertInto('risks')
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** @throws UnknownColumnError when `fields` names a column outside RISK_COLUMNS. */
export async function updateRisk(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const picked = pickAllowed<RiskUpdate>(RISK_COLUMNS, fields);
  const db = await getKysely();
  return db
    .updateTable('risks')
    .set(picked)
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}

export async function deactivateRisk(projectId: number | string, rowId: number | string) {
  const db = await getKysely();
  return db
    .updateTable('risks')
    .set({
      status: 'deactivated',
      deactivated_at: sql`now()`,
    })
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}

/** Open risks for the weekly report: status Open or In Progress, ordered by priority severity with overdue first (D-07). */
export async function listOpenRisks(projectId: number | string) {
  const db = await getKysely();
  const today = raidTodayUtc();
  return db
    .selectFrom('risks')
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

/**
 * Everything not Closed, ordered by priority severity rather than alphabetically.
 * The CASE ordering is the project-report page's existing behavior — preserved verbatim.
 */
export async function listNotClosedByPriority(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('risks')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .where('status', '!=', 'Closed')
    .orderBy(sql`CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END`)
    .orderBy('id')
    .execute();
}

/** High Open/In Progress risks and issues company-wide; record count not distinct projects (D-08). */
export async function listHighOpenRaid(companyId: number | null) {
  const db = await getKysely();
  const riskSelect = sql`
    SELECT 'risk' AS entity_type, r.*, p.name AS project_name
    FROM risks r
    JOIN projects p ON p.id = r.project_id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE r.priority = 'High' AND r.status IN ('Open','In Progress')`;
  const issueSelect = sql`
    SELECT 'issue' AS entity_type, i.*, p.name AS project_name
    FROM issues i
    JOIN projects p ON p.id = i.project_id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE i.priority = 'High' AND i.status IN ('Open','In Progress')`;
  if (companyId !== null) {
    const result = await sql`
      ${riskSelect} AND (p.company_id = ${companyId} OR c.company_id = ${companyId})
       UNION ALL
      ${issueSelect} AND (p.company_id = ${companyId} OR c.company_id = ${companyId})
       ORDER BY project_name, entity_type, id
    `.execute(db);
    return result.rows;
  }
  const result = await sql`
    ${riskSelect} AND p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)
     UNION ALL
    ${issueSelect} AND p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)
     ORDER BY project_name, entity_type, id
  `.execute(db);
  return result.rows;
}
