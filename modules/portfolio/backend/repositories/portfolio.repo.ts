import { sql } from 'kysely';
import { getDb } from '@/lib/db';
import { getKysely } from '@/lib/db/kysely';

/**
 * Portfolio-level reads and writes.
 *
 * These routes are company-scoped rather than project-scoped, so every function takes
 * `companyId` explicitly (REPO-02). Where the current SQL branches on admin, the
 * resolved `isAdmin` boolean is passed in — the repository never reads a session.
 */

export type PortfolioMember = {
  id: number;
  role: string;
  name: string;
  email: string;
  note: string;
  member_type: string;
};

const PROJECTS_WITH_PROGRAM = `SELECT p.*, c.name as program_name, c.industry as program_industry
  FROM projects p LEFT JOIN customers c ON p.customer_id = c.id`;

function deleteResult(numDeletedRows: bigint | number | undefined) {
  return { lastInsertRowid: 0, changes: Number(numDeletedRows ?? 0) };
}

/** Portfolio-visible projects, company-scoped (D-13). */
export async function listPortfolioProjects(companyId: number | null) {
  const db = await getKysely();
  let q = db
    .selectFrom('projects as p')
    .leftJoin('customers as c', 'p.customer_id', 'c.id')
    .selectAll('p')
    .select(['c.name as program_name', 'c.industry as program_industry']);
  if (companyId !== null) {
    q = q.where((eb) =>
      eb.or([
        eb('p.company_id', '=', companyId),
        eb('c.company_id', '=', companyId),
      ]),
    );
  } else {
    q = q
      .where('p.company_id', 'is', null)
      .where((eb) =>
        eb.or([
          eb('p.customer_id', 'is', null),
          eb('c.company_id', 'is', null),
        ]),
      );
  }
  return q.orderBy('p.created_at', 'desc').execute();
}

export async function riskCountsByProject() {
  const db = await getKysely();
  const result = await sql<{ project_id: number; total: number; open: number }>`
    SELECT project_id, COUNT(*)::int as total,
       SUM(CASE WHEN status='Open' OR status='In Progress' THEN 1 ELSE 0 END)::int as open
     FROM risks GROUP BY project_id
  `.execute(db);
  return result.rows;
}

export async function issueCountsByProject() {
  const db = await getKysely();
  const result = await sql<{ project_id: number; total: number; open: number }>`
    SELECT project_id, COUNT(*)::int as total,
       SUM(CASE WHEN status='Open' OR status='In Progress' THEN 1 ELSE 0 END)::int as open
     FROM issues GROUP BY project_id
  `.execute(db);
  return result.rows;
}

export async function activityCompletionByProject() {
  const db = await getKysely();
  const result = await sql<{ project_id: number; total: number; avg_pct: number; done: number }>`
    SELECT project_id, COUNT(*)::int as total, AVG(completion_pct) as avg_pct,
       SUM(CASE WHEN status='Done' THEN 1 ELSE 0 END)::int as done
     FROM activities GROUP BY project_id
  `.execute(db);
  return result.rows;
}

export async function roadmapActivityTotals(doneStatuses: readonly string[]) {
  const db = await getKysely();
  const doneList = sql.join(doneStatuses.map((s) => sql.lit(s)));
  const result = await sql<{ project_id: number; total: number; done: number }>`
    SELECT project_id, COUNT(*)::int as total,
       SUM(CASE WHEN status IN (${doneList}) THEN 1 ELSE 0 END)::int as done
     FROM activities GROUP BY project_id
  `.execute(db);
  return result.rows;
}

export async function roadmapPhaseStats(doneStatuses: readonly string[]) {
  const db = await getKysely();
  const doneList = sql.join(doneStatuses.map((s) => sql.lit(s)));
  const result = await sql<{
    project_id: number;
    phase: string;
    phase_start: string | null;
    phase_end: string | null;
    total: number;
    done: number;
    epic_key: string | null;
  }>`
    SELECT project_id, phase,
      COALESCE(
        MAX(CASE WHEN no = 'EPIC' AND plan_start IS NOT NULL AND plan_start <> '' THEN plan_start END),
        MIN(CASE WHEN plan_start IS NOT NULL AND plan_start <> '' THEN plan_start END)
      ) AS phase_start,
      COALESCE(
        MAX(CASE WHEN no = 'EPIC' AND plan_end IS NOT NULL AND plan_end <> '' THEN plan_end END),
        MAX(CASE WHEN plan_end IS NOT NULL AND plan_end <> '' THEN plan_end END)
      ) AS phase_end,
      COUNT(*)::int AS total,
      SUM(CASE WHEN status IN (${doneList}) THEN 1 ELSE 0 END)::int AS done,
      MIN(CASE WHEN jira_key IS NOT NULL AND jira_key <> '' THEN jira_key END) AS epic_key
    FROM activities
    GROUP BY project_id, phase
  `.execute(db);
  return result.rows;
}

export async function roadmapEpicRows(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('activities')
    .select([
      'id', 'phase', 'no', 'activity', 'status', 'plan_start', 'plan_end',
      'jira_key', 'parent_id', 'order_idx',
    ])
    .where('project_id', '=', Number(projectId))
    .orderBy('order_idx')
    .orderBy('id')
    .execute();
}

/** All portfolio members for a company, internal and external together. */
export async function listPortfolioMembers(companyId: number | null) {
  const db = await getKysely();
  return db
    .selectFrom('portfolio_members')
    .selectAll()
    .where('company_id', '=', companyId)
    .orderBy('member_type')
    .orderBy('name')
    .execute();
}

/** Member roster enriched with program count and current-month FTE. */
export async function portfolioMembersWithUtilization(companyId: number | null) {
  const db = await getKysely();
  const result = await sql<Record<string, unknown>>`
    SELECT pm.*,
       COALESCE((
         SELECT COUNT(DISTINCT ppa.program_id)
         FROM team_members tm
         JOIN program_project_allocations ppa ON ppa.project_id = tm.project_id
         WHERE CASE WHEN COALESCE(TRIM(pm.email), '') <> ''
                    THEN LOWER(TRIM(tm.email)) = LOWER(TRIM(pm.email))
                    ELSE LOWER(TRIM(tm.name)) = LOWER(TRIM(pm.name)) END
       ), 0) AS program_count,
       COALESCE((
         SELECT SUM(
           CASE WHEN tm.capacity_json IS NOT NULL AND length(trim(tm.capacity_json)) > 2
                THEN CAST((tm.capacity_json::jsonb ->> TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS FLOAT)
                ELSE 0 END)
         FROM team_members tm
         JOIN projects p ON p.id = tm.project_id
         WHERE CASE WHEN COALESCE(TRIM(pm.email), '') <> ''
                    THEN LOWER(TRIM(tm.email)) = LOWER(TRIM(pm.email))
                    ELSE LOWER(TRIM(tm.name)) = LOWER(TRIM(pm.name)) END
           AND p.company_id = pm.company_id
       ), 0) AS current_month_fte
     FROM portfolio_members pm
     WHERE pm.company_id = ${companyId}
     ORDER BY pm.name
  `.execute(db);
  return result.rows;
}

export async function createPortfolioMember(companyId: number | null, body: Record<string, unknown>) {
  const db = await getKysely();
  const row = await db
    .insertInto('portfolio_members')
    .values({
      company_id: companyId,
      role: String(body.role ?? ''),
      name: String(body.name),
      email: String(body.email ?? ''),
      note: String(body.note ?? ''),
      member_type: String(body.member_type ?? 'internal'),
      member_category: String(body.member_category ?? 'delivery'),
      overhead_remaining: Number(body.overhead_remaining) || 0,
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row;
}

export async function updatePortfolioMember(
  companyId: number | null,
  memberId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getKysely();
  return db
    .updateTable('portfolio_members')
    .set({
      role: String(body.role ?? ''),
      name: String(body.name),
      email: String(body.email ?? ''),
      note: String(body.note ?? ''),
      member_type: String(body.member_type ?? 'internal'),
      member_category: String(body.member_category ?? 'delivery'),
      overhead_remaining: Number(body.overhead_remaining) || 0,
    })
    .where('id', '=', Number(memberId))
    .where('company_id', '=', companyId)
    .returningAll()
    .executeTakeFirst();
}

export async function deletePortfolioMember(companyId: number | null, memberId: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('portfolio_members')
    .where('id', '=', Number(memberId))
    .where('company_id', '=', companyId)
    .executeTakeFirst();
  return deleteResult(result.numDeletedRows);
}

/** Company name plus headcount quota, the pair the members export and quota panel need. */
export async function companyNameAndQuota(companyId: number | null) {
  const db = await getKysely();
  return db
    .selectFrom('companies')
    .select(['name', 'headcount_quota'])
    .where('id', '=', companyId)
    .executeTakeFirst();
}

export async function setCompanyHeadcountQuota(companyId: number | null, quota: number) {
  const db = await getKysely();
  const result = await db
    .updateTable('companies')
    .set({ headcount_quota: quota })
    .where('id', '=', companyId)
    .executeTakeFirst();
  return { lastInsertRowid: 0, changes: Number(result.numUpdatedRows ?? 0) };
}

export async function bugCountsByAssignee(companyId: number | null) {
  const db = await getKysely();
  const companyFilter =
    companyId !== null
      ? sql`AND (p.company_id = ${companyId} OR c.company_id = ${companyId})`
      : sql`AND p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)`;
  const result = await sql<Record<string, unknown>>`
    SELECT b.assignee, COUNT(*)::int as total_bugs,
      SUM(CASE WHEN b.status IN ('To Do', 'In Progress', 'Reopen') THEN 1 ELSE 0 END)::int as active_bugs,
      SUM(CASE WHEN b.priority = 'Critical' THEN 1 ELSE 0 END)::int as critical_bugs,
      STRING_AGG(DISTINCT p.name, ', ') as projects,
      COUNT(DISTINCT b.project_id)::int as project_count
    FROM bugs b
    JOIN projects p ON b.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE b.assignee IS NOT NULL AND b.assignee != '' ${companyFilter}
      AND b.snapshot_date = (
        SELECT MAX(b2.snapshot_date) FROM bugs b2
        WHERE b2.project_id = b.project_id AND b2.snapshot_date != '')
    GROUP BY b.assignee ORDER BY total_bugs DESC
  `.execute(db);
  return result.rows;
}

export async function listPortfolioMilestones(companyId: number | null) {
  const db = await getKysely();
  let q = db
    .selectFrom('milestones as m')
    .innerJoin('projects as p', 'p.id', 'm.project_id')
    .leftJoin('customers as c', 'p.customer_id', 'c.id')
    .select([
      'm.id',
      'm.project_id',
      'm.name',
      'm.start_date',
      'm.end_date',
      'p.name as project_name',
      'p.customer_id',
      'c.name as program_name',
    ]);
  if (companyId !== null) {
    q = q.where((eb) =>
      eb.or([
        eb('p.company_id', '=', companyId),
        eb('c.company_id', '=', companyId),
      ]),
    );
  } else {
    q = q
      .where('p.company_id', 'is', null)
      .where((eb) =>
        eb.or([
          eb('p.customer_id', 'is', null),
          eb('c.company_id', 'is', null),
        ]),
      );
  }
  return q.orderBy('p.name').orderBy('m.start_date').orderBy('m.id').execute();
}

export async function listPortfolioBudgets(companyId: number | null) {
  const db = await getKysely();
  const result = await sql<Record<string, unknown>>`
    SELECT pb.*, COALESCE(SUM(pba.allocated_amount), 0) AS total_allocated
     FROM portfolio_budgets pb
     LEFT JOIN portfolio_budget_allocations pba ON pba.portfolio_budget_id = pb.id
     WHERE pb.company_id = ${companyId} GROUP BY pb.id ORDER BY pb.start_date DESC
  `.execute(db);
  return result.rows;
}

export async function createPortfolioBudget(companyId: number | null, body: Record<string, unknown>) {
  const db = await getKysely();
  return db
    .insertInto('portfolio_budgets')
    .values({
      company_id: companyId,
      period_type: String(body.period_type || 'quarterly'),
      period_label: String(body.period_label),
      start_date: String(body.start_date),
      end_date: String(body.end_date),
      total_amount: Number(body.total_amount) || 0,
      currency: String(body.currency || 'VND'),
      status: 'draft',
      notes: String(body.notes || ''),
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function findPortfolioBudget(companyId: number | null, budgetId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('portfolio_budgets')
    .selectAll()
    .where('id', '=', Number(budgetId))
    .where('company_id', '=', companyId)
    .executeTakeFirst();
}

export async function portfolioBudgetCategories(budgetId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('portfolio_budget_categories')
    .selectAll()
    .where('portfolio_budget_id', '=', Number(budgetId))
    .orderBy('category')
    .execute();
}

export async function portfolioBudgetAllocations(budgetId: number | string) {
  const db = await getKysely();
  const bid = Number(budgetId);
  const result = await sql<Record<string, unknown>>`
    SELECT pba.*, p.name AS project_name,
       COALESCE(SUM(bi.planned_amount), 0) AS total_estimate,
       COALESCE(SUM(bi.approved_amount), 0) AS total_approved,
       COALESCE(SUM(bi.actual_amount), 0) AS total_actual
     FROM portfolio_budget_allocations pba
     LEFT JOIN projects p ON p.id = pba.project_id
     LEFT JOIN budget_items bi ON bi.project_id = pba.project_id
     WHERE pba.portfolio_budget_id = ${bid} GROUP BY pba.id, p.name ORDER BY p.name
  `.execute(db);
  return result.rows;
}

export async function spendByCategory(budgetId: number | string, category: string) {
  const db = await getKysely();
  const result = await sql<{ used: number }>`
    SELECT COALESCE(SUM(bi.planned_amount), 0) AS used
     FROM budget_items bi
     JOIN portfolio_budget_allocations pba ON pba.project_id = bi.project_id
     WHERE pba.portfolio_budget_id = ${Number(budgetId)} AND bi.type = ${category}
  `.execute(db);
  return result.rows[0];
}

export async function updatePortfolioBudget(budgetId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  await db
    .updateTable('portfolio_budgets')
    .set({
      period_type: String(body.period_type),
      period_label: String(body.period_label),
      start_date: String(body.start_date),
      end_date: String(body.end_date),
      total_amount: Number(body.total_amount),
      currency: String(body.currency),
      status: String(body.status),
      notes: String(body.notes),
    })
    .where('id', '=', Number(budgetId))
    .execute();
  return db
    .selectFrom('portfolio_budgets')
    .selectAll()
    .where('id', '=', Number(budgetId))
    .executeTakeFirst();
}

export async function deletePortfolioBudget(companyId: number | null, budgetId: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('portfolio_budgets')
    .where('id', '=', Number(budgetId))
    .where('company_id', '=', companyId)
    .executeTakeFirst();
  return deleteResult(result.numDeletedRows);
}

export async function createPortfolioBudgetAllocation(budgetId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  const row = await db
    .insertInto('portfolio_budget_allocations')
    .values({
      portfolio_budget_id: Number(budgetId),
      project_id: body.project_id != null ? Number(body.project_id) : null,
      allocated_amount: Number(body.allocated_amount) || 0,
      notes: String(body.notes || ''),
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  const enriched = await db
    .selectFrom('portfolio_budget_allocations as pba')
    .leftJoin('projects as p', 'p.id', 'pba.project_id')
    .selectAll('pba')
    .select('p.name as project_name')
    .where('pba.id', '=', row.id)
    .executeTakeFirst();
  return enriched;
}

export async function updatePortfolioBudgetAllocation(
  budgetId: number | string,
  allocationId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getKysely();
  const result = await sql<Record<string, unknown>>`
    WITH updated AS (
       UPDATE portfolio_budget_allocations SET project_id=${body.project_id != null ? Number(body.project_id) : null},
         allocated_amount=${Number(body.allocated_amount)}, notes=${String(body.notes ?? '')}
       WHERE id=${Number(allocationId)} AND portfolio_budget_id=${Number(budgetId)} RETURNING *
     )
     SELECT updated.*, p.name AS project_name FROM updated
     LEFT JOIN projects p ON p.id = updated.project_id
  `.execute(db);
  return result.rows[0];
}

export async function deletePortfolioBudgetAllocation(
  budgetId: number | string,
  allocationId: number | string,
) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('portfolio_budget_allocations')
    .where('id', '=', Number(allocationId))
    .where('portfolio_budget_id', '=', Number(budgetId))
    .executeTakeFirst();
  return deleteResult(result.numDeletedRows);
}

export async function createPortfolioBudgetCategory(budgetId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  return db
    .insertInto('portfolio_budget_categories')
    .values({
      portfolio_budget_id: Number(budgetId),
      category: String(body.category),
      ceiling_amount: Number(body.ceiling_amount) || 0,
      notes: String(body.notes || ''),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updatePortfolioBudgetCategory(
  budgetId: number | string,
  categoryId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getKysely();
  return db
    .updateTable('portfolio_budget_categories')
    .set({
      category: String(body.category),
      ceiling_amount: Number(body.ceiling_amount),
      notes: String(body.notes),
    })
    .where('id', '=', Number(categoryId))
    .where('portfolio_budget_id', '=', Number(budgetId))
    .returningAll()
    .executeTakeFirst();
}

export async function deletePortfolioBudgetCategory(
  budgetId: number | string,
  categoryId: number | string,
) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('portfolio_budget_categories')
    .where('id', '=', Number(categoryId))
    .where('portfolio_budget_id', '=', Number(budgetId))
    .executeTakeFirst();
  return deleteResult(result.numDeletedRows);
}

export async function programFteAllocations(companyId: number | null) {
  const db = await getKysely();
  const result = await sql<{
    program_id: number;
    program_name: string;
    allocated_headcount: number;
    actual_fte: number;
  }>`
    SELECT c.id AS program_id, c.name AS program_name,
       COALESCE(ppa.allocated_headcount, 0) AS allocated_headcount,
       COALESCE((
         SELECT ROUND(CAST(SUM(COALESCE(
           CASE WHEN tm.capacity_json IS NOT NULL AND length(trim(tm.capacity_json)) > 2
                THEN CAST((tm.capacity_json::jsonb ->> TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS FLOAT)
                ELSE NULL END, 0)) AS NUMERIC), 1)
         FROM team_members tm JOIN projects p ON p.id = tm.project_id
         WHERE p.customer_id = c.id AND p.company_id = ${companyId}
       ), 0) AS actual_fte
     FROM customers c
     LEFT JOIN portfolio_program_allocations ppa
       ON ppa.program_id = c.id AND ppa.company_id = ${companyId}
     WHERE c.company_id = ${companyId} ORDER BY c.name
  `.execute(db);
  return result.rows;
}

export async function upsertPortfolioProgramAllocation(
  companyId: number | null,
  programId: number,
  allocatedHeadcount: number,
) {
  const db = await getKysely();
  const updated = await db
    .updateTable('portfolio_program_allocations')
    .set({ allocated_headcount: allocatedHeadcount })
    .where('company_id', '=', companyId)
    .where('program_id', '=', programId)
    .executeTakeFirst();
  if (Number(updated.numUpdatedRows ?? 0) === 0) {
    await db
      .insertInto('portfolio_program_allocations')
      .values({
        company_id: companyId,
        program_id: programId,
        allocated_headcount: allocatedHeadcount,
        created_at: new Date(),
      })
      .execute();
  }
}

export async function updatePortfolioProgramAllocation(
  companyId: number | null,
  allocationId: number | string,
  allocatedHeadcount: number,
) {
  const db = await getKysely();
  const result = await db
    .updateTable('portfolio_program_allocations')
    .set({ allocated_headcount: allocatedHeadcount })
    .where('id', '=', Number(allocationId))
    .where('company_id', '=', companyId)
    .executeTakeFirst();
  return { lastInsertRowid: 0, changes: Number(result.numUpdatedRows ?? 0) };
}

export async function deletePortfolioProgramAllocation(
  companyId: number | null,
  allocationId: number | string,
) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('portfolio_program_allocations')
    .where('id', '=', Number(allocationId))
    .where('company_id', '=', companyId)
    .executeTakeFirst();
  return deleteResult(result.numDeletedRows);
}

type Scope = { sql: string; params: unknown[] };

function reportCompanyScope(companyId: number | null): Scope {
  if (companyId !== null) {
    return { sql: 'AND p.company_id = ?', params: [companyId] };
  }
  return { sql: 'AND p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)', params: [] };
}

function idScope(column: string, ids: readonly number[]): Scope {
  if (!ids.length) return { sql: '', params: [] };
  return {
    sql: `AND ${column} IN (${ids.map(() => '?').join(',')})`,
    params: [...ids],
  };
}

export type PortfolioMilestoneInfo = {
  id: number;
  project_id: number;
  name: string;
  project_name: string;
  program_name: string;
  start_date: string;
  end_date: string;
};

/** Resolve selected milestones, their projects, and exactly-linked activities. */
export async function portfolioMilestoneSelection(
  ids: readonly number[],
  companyId: number | null,
) {
  const db = await getDb();
  const company = reportCompanyScope(companyId);
  const milestones: PortfolioMilestoneInfo[] = [];
  const projectIds = new Set<number>();
  const activityIds = new Set<number>();
  let periodMin: string | null = null;
  let periodMax: string | null = null;

  for (const milestoneId of ids) {
    const row = await db.get<PortfolioMilestoneInfo>(
      `SELECT m.id, m.project_id, m.name, m.start_date, m.end_date,
         COALESCE(p.name, '') AS project_name, COALESCE(c.name, '') AS program_name
       FROM milestones m
       JOIN projects p ON p.id = m.project_id
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE m.id = ? ${company.sql}`,
      milestoneId,
      ...company.params,
    );
    if (!row) continue;
    milestones.push(row);
    projectIds.add(row.project_id);
    const epics = await db.all<{ activity_id: number }>(
      `SELECT me.activity_id FROM milestone_epics me
       JOIN activities a ON a.id = me.activity_id
       WHERE me.milestone_id = ? AND a.project_id = ?`,
      milestoneId,
      row.project_id,
    );
    for (const epic of epics) activityIds.add(epic.activity_id);
    if (row.start_date && (periodMin === null || row.start_date < periodMin)) periodMin = row.start_date;
    if (row.end_date && (periodMax === null || row.end_date > periodMax)) periodMax = row.end_date;
  }

  return { milestones, projectIds: [...projectIds], activityIds: [...activityIds], periodMin, periodMax };
}

/** Report route scope intentionally uses project.company_id only, matching its prior SQL. */
export async function listPortfolioReportProjects(companyId: number | null) {
  const db = await getDb();
  const company = reportCompanyScope(companyId);
  return db.all(
    `${PROJECTS_WITH_PROGRAM} WHERE 1=1 ${company.sql} ORDER BY p.created_at DESC`,
    ...company.params,
  );
}

export async function listPortfolioReportActivities() {
  const db = await getDb();
  return db.all<{
    id: number; project_id: number; no: string; parent_id: number | null; epic_name: string;
    status: string; phase: string; plan_start?: string; plan_end?: string;
    actual_start?: string; actual_end?: string;
  }>(
    `SELECT id, project_id, no, parent_id, activity as epic_name, status, phase,
       plan_start, plan_end, actual_start, actual_end FROM activities`,
  );
}

export async function milestoneDateRanges(projectIds: readonly number[]) {
  if (!projectIds.length) return [];
  const db = await getDb();
  return db.all<{ project_id: number; min_s: string; max_e: string }>(
    `SELECT project_id, MIN(start_date) as min_s, MAX(end_date) as max_e
     FROM milestones
     WHERE project_id IN (${projectIds.map(() => '?').join(',')})
       AND start_date IS NOT NULL AND end_date IS NOT NULL
     GROUP BY project_id`,
    ...projectIds,
  );
}

export async function topPortfolioRisks(
  companyId: number | null,
  projectIds: readonly number[],
) {
  const db = await getDb();
  const company = reportCompanyScope(companyId);
  const projects = idScope('r.project_id', projectIds);
  return db.all(
    `SELECT r.*, p.name as project_name, c.name as program_name
     FROM risks r JOIN projects p ON r.project_id = p.id
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE (r.status='Open' OR r.status='In Progress') ${company.sql} ${projects.sql}
     ORDER BY CASE r.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
       r.id DESC LIMIT 12`,
    ...company.params, ...projects.params,
  );
}

export async function topPortfolioIssues(
  companyId: number | null,
  projectIds: readonly number[],
) {
  const db = await getDb();
  const company = reportCompanyScope(companyId);
  const projects = idScope('i.project_id', projectIds);
  return db.all(
    `SELECT i.*, p.name as project_name, c.name as program_name
     FROM issues i JOIN projects p ON i.project_id = p.id
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE (i.status='Open' OR i.status='In Progress') ${company.sql} ${projects.sql}
     ORDER BY CASE i.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
       i.id DESC LIMIT 12`,
    ...company.params, ...projects.params,
  );
}

function reportActivityScopes(
  companyId: number | null,
  projectIds: readonly number[],
  activityIds: readonly number[],
) {
  return {
    company: reportCompanyScope(companyId),
    projects: idScope('a.project_id', projectIds),
    activities: idScope('a.id', activityIds),
  };
}

export async function upcomingPortfolioActivities(
  companyId: number | null,
  projectIds: readonly number[],
  activityIds: readonly number[],
  startDate: string,
  endDate: string,
  doneStatuses: readonly string[],
) {
  const db = await getDb();
  const scope = reportActivityScopes(companyId, projectIds, activityIds);
  const done = doneStatuses.map(() => '?').join(',');
  return db.all(
    `SELECT a.*, p.name as project_name, c.name as program_name
     FROM activities a JOIN projects p ON a.project_id = p.id
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE a.plan_end BETWEEN ? AND ? AND a.status NOT IN (${done})
       AND (a.no IS NULL OR a.no != 'EPIC')
       ${scope.company.sql} ${scope.projects.sql} ${scope.activities.sql}
     ORDER BY a.plan_end ASC LIMIT 15`,
    startDate, endDate, ...doneStatuses, ...scope.company.params,
    ...scope.projects.params, ...scope.activities.params,
  );
}

export async function recentlyCompletedPortfolioActivities(
  companyId: number | null,
  projectIds: readonly number[],
  activityIds: readonly number[],
  sinceDate: string,
  doneStatuses: readonly string[],
) {
  const db = await getDb();
  const scope = reportActivityScopes(companyId, projectIds, activityIds);
  const done = doneStatuses.map(() => '?').join(',');
  return db.all(
    `SELECT a.*, p.name as project_name, c.name as program_name
     FROM activities a JOIN projects p ON a.project_id = p.id
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE a.status IN (${done}) AND a.actual_end >= ?
       AND (a.no IS NULL OR a.no != 'EPIC')
       ${scope.company.sql} ${scope.projects.sql} ${scope.activities.sql}
     ORDER BY a.actual_end DESC LIMIT 10`,
    ...doneStatuses, sinceDate, ...scope.company.params,
    ...scope.projects.params, ...scope.activities.params,
  );
}

export async function completedPortfolioActivitiesBetween(
  companyId: number | null,
  projectIds: readonly number[],
  activityIds: readonly number[],
  startDate: string,
  endDate: string,
  doneStatuses: readonly string[],
) {
  const db = await getDb();
  const scope = reportActivityScopes(companyId, projectIds, activityIds);
  const done = doneStatuses.map(() => '?').join(',');
  return db.all(
    `SELECT a.*, p.name as project_name, p.current_phase, c.name as program_name
     FROM activities a JOIN projects p ON a.project_id = p.id
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE a.status IN (${done}) AND a.actual_end >= ? AND a.actual_end <= ?
       AND (a.no IS NULL OR a.no != 'EPIC')
       ${scope.company.sql} ${scope.projects.sql} ${scope.activities.sql}
     ORDER BY a.project_id, a.actual_end`,
    ...doneStatuses, startDate, endDate, ...scope.company.params,
    ...scope.projects.params, ...scope.activities.params,
  );
}

export async function portfolioBugCounts(
  companyId: number | null,
  projectIds: readonly number[],
  milestoneMonth: string | null,
) {
  const db = await getDb();
  const company = reportCompanyScope(companyId);
  const projects = milestoneMonth ? idScope('b.project_id', projectIds) : { sql: '', params: [] };
  const select = `SELECT b.project_id, p.name as project_name, b.status, b.priority, b.severity,
      COUNT(*) as cnt FROM bugs b JOIN projects p ON b.project_id = p.id`;
  const group = 'GROUP BY b.project_id, p.name, b.status, b.priority, b.severity';
  if (milestoneMonth) {
    const pattern = `${milestoneMonth}%`;
    return db.all(
      `${select}
       WHERE b.snapshot_date = (
         SELECT MAX(b2.snapshot_date) FROM bugs b2
         WHERE b2.project_id = b.project_id AND b2.snapshot_date LIKE ? AND b2.snapshot_date != '')
       AND b.snapshot_date LIKE ? AND b.snapshot_date != ''
       ${company.sql} ${projects.sql} ${group}`,
      pattern, pattern, ...company.params, ...projects.params,
    );
  }
  return db.all(
    `${select}
     WHERE b.snapshot_date = (
       SELECT MAX(b2.snapshot_date) FROM bugs b2
       WHERE b2.project_id = b.project_id AND b2.snapshot_date != '')
     AND (b.snapshot_date IS NOT NULL AND b.snapshot_date != '')
     ${company.sql} ${group}`,
    ...company.params,
  );
}

export async function internalPortfolioMembers(companyId: number | null) {
  const db = await getDb();
  if (companyId !== null) {
    return db.all<{ name: string; role: string }>(
      `SELECT name, role FROM portfolio_members WHERE member_type = 'internal' AND company_id = ?`,
      companyId,
    );
  }
  return db.all<{ name: string; role: string }>(
    `SELECT name, role FROM portfolio_members WHERE member_type = 'internal' AND company_id IS NULL`,
  );
}

export async function portfolioTeamMembers(companyId: number | null) {
  const db = await getDb();
  const company = reportCompanyScope(companyId);
  return db.all<{ name: string; project_name: string }>(
    `SELECT tm.name, p.name as project_name
     FROM team_members tm JOIN projects p ON tm.project_id = p.id
     WHERE 1=1 ${company.sql}`,
    ...company.params,
  );
}

export async function portfolioMemberFte(companyId: number | null) {
  const db = await getDb();
  return db.all<{ member_category: string; overhead_remaining: number; current_month_fte: number }>(
    `SELECT pm.member_category, pm.overhead_remaining,
       COALESCE((
         SELECT SUM(CASE
           WHEN tm.capacity_json IS NOT NULL AND length(trim(tm.capacity_json)) > 2
           THEN CAST((tm.capacity_json::jsonb ->> TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS FLOAT)
           ELSE 0 END)
         FROM team_members tm JOIN projects p ON p.id = tm.project_id
         WHERE LOWER(TRIM(tm.name)) = LOWER(TRIM(pm.name)) AND p.company_id = pm.company_id
       ), 0) AS current_month_fte
     FROM portfolio_members pm
     WHERE pm.member_type = 'internal' AND pm.company_id = ?`,
    companyId,
  );
}

export async function portfolioProgramFillRates(companyId: number | null) {
  const db = await getDb();
  return db.all<{ program_name: string; allocated: number; actual: number }>(
    `SELECT c.name AS program_name, COALESCE(ppa.allocated_headcount, 0) AS allocated,
       COALESCE((
         SELECT ROUND(CAST(SUM(COALESCE(
           CASE WHEN tm.capacity_json IS NOT NULL AND length(trim(tm.capacity_json)) > 2
                THEN CAST((tm.capacity_json::jsonb ->> TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS FLOAT)
                ELSE NULL END, 0)) AS NUMERIC), 1)
         FROM team_members tm JOIN projects p ON p.id = tm.project_id
         WHERE p.customer_id = c.id AND p.company_id = ?
       ), 0) AS actual
     FROM customers c
     LEFT JOIN portfolio_program_allocations ppa ON ppa.program_id = c.id AND ppa.company_id = ?
     WHERE c.company_id = ? ORDER BY c.name`,
    companyId, companyId, companyId,
  );
}

export async function portfolioReportMilestones(companyId: number | null) {
  const db = await getDb();
  const company = reportCompanyScope(companyId);
  return db.all(
    `SELECT m.id, m.project_id, m.name, m.start_date, m.end_date,
       p.name as project_name, COALESCE(c.name, '') as program_name
     FROM milestones m JOIN projects p ON m.project_id = p.id
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE 1=1 ${company.sql} ORDER BY m.start_date DESC, m.name`,
    ...company.params,
  );
}
