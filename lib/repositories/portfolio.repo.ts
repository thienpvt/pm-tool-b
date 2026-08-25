import { getDb } from '@/lib/db';

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

/** Portfolio-visible projects, preserving the route's admin/company/null branches. */
export async function listPortfolioProjects(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  if (isAdmin) return db.all(`${PROJECTS_WITH_PROGRAM} ORDER BY p.created_at DESC`);
  if (companyId !== null) {
    return db.all(
      `${PROJECTS_WITH_PROGRAM}
       WHERE (p.company_id = ? OR c.company_id = ?) ORDER BY p.created_at DESC`,
      companyId, companyId,
    );
  }
  return db.all(
    `${PROJECTS_WITH_PROGRAM}
     WHERE p.company_id IS NULL
       AND (p.customer_id IS NULL OR c.company_id IS NULL) ORDER BY p.created_at DESC`,
  );
}

export async function riskCountsByProject() {
  const db = await getDb();
  return db.all(
    `SELECT project_id, COUNT(*) as total,
       SUM(CASE WHEN status='Open' OR status='In Progress' THEN 1 ELSE 0 END) as open
     FROM risks GROUP BY project_id`,
  );
}

export async function issueCountsByProject() {
  const db = await getDb();
  return db.all(
    `SELECT project_id, COUNT(*) as total,
       SUM(CASE WHEN status='Open' OR status='In Progress' THEN 1 ELSE 0 END) as open
     FROM issues GROUP BY project_id`,
  );
}

export async function activityCompletionByProject() {
  const db = await getDb();
  return db.all(
    `SELECT project_id, COUNT(*) as total, AVG(completion_pct) as avg_pct,
       SUM(CASE WHEN status='Done' THEN 1 ELSE 0 END) as done
     FROM activities GROUP BY project_id`,
  );
}

export async function roadmapActivityTotals(doneStatuses: readonly string[]) {
  const db = await getDb();
  const placeholders = doneStatuses.map(() => '?').join(',');
  return db.all(
    `SELECT project_id, COUNT(*) as total,
       SUM(CASE WHEN status IN (${placeholders}) THEN 1 ELSE 0 END) as done
     FROM activities GROUP BY project_id`,
    ...doneStatuses,
  );
}

export async function roadmapPhaseStats(doneStatuses: readonly string[]) {
  const db = await getDb();
  const placeholders = doneStatuses.map(() => '?').join(',');
  return db.all(`
    SELECT project_id, phase,
      COALESCE(
        MAX(CASE WHEN no = 'EPIC' AND plan_start IS NOT NULL AND plan_start <> '' THEN plan_start END),
        MIN(CASE WHEN plan_start IS NOT NULL AND plan_start <> '' THEN plan_start END)
      ) AS phase_start,
      COALESCE(
        MAX(CASE WHEN no = 'EPIC' AND plan_end IS NOT NULL AND plan_end <> '' THEN plan_end END),
        MAX(CASE WHEN plan_end IS NOT NULL AND plan_end <> '' THEN plan_end END)
      ) AS phase_end,
      COUNT(*) AS total,
      SUM(CASE WHEN status IN (${placeholders}) THEN 1 ELSE 0 END) AS done,
      MIN(CASE WHEN jira_key IS NOT NULL AND jira_key <> '' THEN jira_key END) AS epic_key
    FROM activities
    GROUP BY project_id, phase
  `, ...doneStatuses);
}

export async function roadmapEpicRows(projectId: number | string) {
  const db = await getDb();
  return db.all(
    `SELECT id, phase, no, activity, status, plan_start, plan_end, jira_key, parent_id, order_idx
     FROM activities WHERE project_id = ? ORDER BY order_idx, id`,
    projectId,
  );
}

/** All portfolio members for a company, internal and external together. */
export async function listPortfolioMembers(companyId: number | null) {
  const db = await getDb();
  return db.all<PortfolioMember>(
    'SELECT * FROM portfolio_members WHERE company_id = ? ORDER BY member_type, name',
    companyId,
  );
}

/** Member roster enriched with program count and current-month FTE. */
export async function portfolioMembersWithUtilization(companyId: number | null) {
  const db = await getDb();
  return db.all(
    `SELECT pm.*,
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
     WHERE pm.company_id = ?
     ORDER BY pm.name`,
    companyId,
  );
}

export async function createPortfolioMember(companyId: number | null, body: Record<string, unknown>) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO portfolio_members
       (company_id, role, name, email, note, member_type, member_category, overhead_remaining)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    companyId, body.role ?? '', body.name, body.email ?? '', body.note ?? '',
    body.member_type ?? 'internal', body.member_category ?? 'delivery',
    Number(body.overhead_remaining) || 0,
  );
  return db.get('SELECT * FROM portfolio_members WHERE id = ?', r.lastInsertRowid);
}

export async function updatePortfolioMember(
  companyId: number | null,
  memberId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getDb();
  return db.get(
    `UPDATE portfolio_members SET role = ?, name = ?, email = ?, note = ?,
       member_type = ?, member_category = ?, overhead_remaining = ?
     WHERE id = ? AND company_id = ? RETURNING *`,
    body.role ?? '', body.name, body.email ?? '', body.note ?? '', body.member_type ?? 'internal',
    body.member_category ?? 'delivery', Number(body.overhead_remaining) || 0, memberId, companyId,
  );
}

export async function deletePortfolioMember(companyId: number | null, memberId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM portfolio_members WHERE id = ? AND company_id = ?', memberId, companyId);
}

/** Company name plus headcount quota, the pair the members export and quota panel need. */
export async function companyNameAndQuota(companyId: number | null) {
  const db = await getDb();
  return db.get<{ name: string; headcount_quota: number }>(
    'SELECT name, headcount_quota FROM companies WHERE id = ?',
    companyId,
  );
}

export async function setCompanyHeadcountQuota(companyId: number | null, quota: number) {
  const db = await getDb();
  return db.run('UPDATE companies SET headcount_quota = ? WHERE id = ?', quota, companyId);
}

export async function bugCountsByAssignee(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  const base = (where: string) => `
    SELECT b.assignee, COUNT(*) as total_bugs,
      SUM(CASE WHEN b.status IN ('To Do', 'In Progress', 'Reopen') THEN 1 ELSE 0 END) as active_bugs,
      SUM(CASE WHEN b.priority = 'Critical' THEN 1 ELSE 0 END) as critical_bugs,
      STRING_AGG(DISTINCT p.name, ', ') as projects,
      COUNT(DISTINCT b.project_id) as project_count
    FROM bugs b
    JOIN projects p ON b.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE b.assignee IS NOT NULL AND b.assignee != '' ${where}
      AND b.snapshot_date = (
        SELECT MAX(b2.snapshot_date) FROM bugs b2
        WHERE b2.project_id = b.project_id AND b2.snapshot_date != '')
    GROUP BY b.assignee ORDER BY total_bugs DESC`;
  if (isAdmin) return db.all(base(''));
  if (companyId !== null) {
    return db.all(base('AND (p.company_id = ? OR c.company_id = ?)'), companyId, companyId);
  }
  return db.all(base('AND p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)'));
}

export async function listPortfolioMilestones(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  const base = `SELECT m.id, m.project_id, m.name, m.start_date, m.end_date,
      p.name AS project_name, p.customer_id, c.name AS program_name
    FROM milestones m JOIN projects p ON p.id = m.project_id
    LEFT JOIN customers c ON p.customer_id = c.id`;
  if (isAdmin) return db.all(`${base} ORDER BY p.name, m.start_date, m.id`);
  if (companyId !== null) {
    return db.all(
      `${base} WHERE (p.company_id = ? OR c.company_id = ?) ORDER BY p.name, m.start_date, m.id`,
      companyId, companyId,
    );
  }
  return db.all(`${base} WHERE p.company_id IS NULL
    AND (p.customer_id IS NULL OR c.company_id IS NULL) ORDER BY p.name, m.start_date, m.id`);
}

export async function listPortfolioBudgets(companyId: number | null) {
  const db = await getDb();
  return db.all(
    `SELECT pb.*, COALESCE(SUM(pba.allocated_amount), 0) AS total_allocated
     FROM portfolio_budgets pb
     LEFT JOIN portfolio_budget_allocations pba ON pba.portfolio_budget_id = pb.id
     WHERE pb.company_id = ? GROUP BY pb.id ORDER BY pb.start_date DESC`,
    companyId,
  );
}

export async function createPortfolioBudget(companyId: number | null, body: Record<string, unknown>) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO portfolio_budgets
       (company_id, period_type, period_label, start_date, end_date, total_amount, currency, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    companyId, body.period_type || 'quarterly', body.period_label, body.start_date,
    body.end_date, body.total_amount || 0, body.currency || 'VND', body.notes || '',
  );
  return db.get('SELECT * FROM portfolio_budgets WHERE id = ?', r.lastInsertRowid);
}

export async function findPortfolioBudget(companyId: number | null, budgetId: number | string) {
  const db = await getDb();
  return db.get('SELECT * FROM portfolio_budgets WHERE id = ? AND company_id = ?', budgetId, companyId);
}

export async function portfolioBudgetCategories(budgetId: number | string) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM portfolio_budget_categories WHERE portfolio_budget_id = ? ORDER BY category',
    budgetId,
  );
}

export async function portfolioBudgetAllocations(budgetId: number | string) {
  const db = await getDb();
  return db.all(
    `SELECT pba.*, p.name AS project_name,
       COALESCE(SUM(bi.planned_amount), 0) AS total_estimate,
       COALESCE(SUM(bi.approved_amount), 0) AS total_approved,
       COALESCE(SUM(bi.actual_amount), 0) AS total_actual
     FROM portfolio_budget_allocations pba
     LEFT JOIN projects p ON p.id = pba.project_id
     LEFT JOIN budget_items bi ON bi.project_id = pba.project_id
     WHERE pba.portfolio_budget_id = ? GROUP BY pba.id, p.name ORDER BY p.name`,
    budgetId,
  );
}

export async function spendByCategory(budgetId: number | string, category: string) {
  const db = await getDb();
  return db.get<{ used: number }>(
    `SELECT COALESCE(SUM(bi.planned_amount), 0) AS used
     FROM budget_items bi
     JOIN portfolio_budget_allocations pba ON pba.project_id = bi.project_id
     WHERE pba.portfolio_budget_id = ? AND bi.type = ?`,
    budgetId, category,
  );
}

export async function updatePortfolioBudget(budgetId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  await db.run(
    `UPDATE portfolio_budgets SET period_type=?, period_label=?, start_date=?, end_date=?,
       total_amount=?, currency=?, status=?, notes=? WHERE id=?`,
    body.period_type, body.period_label, body.start_date, body.end_date,
    body.total_amount, body.currency, body.status, body.notes, budgetId,
  );
  return db.get('SELECT * FROM portfolio_budgets WHERE id = ?', budgetId);
}

export async function deletePortfolioBudget(companyId: number | null, budgetId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM portfolio_budgets WHERE id = ? AND company_id = ?', budgetId, companyId);
}

export async function createPortfolioBudgetAllocation(budgetId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO portfolio_budget_allocations
       (portfolio_budget_id, project_id, allocated_amount, notes) VALUES (?, ?, ?, ?)`,
    budgetId, body.project_id || null, body.allocated_amount || 0, body.notes || '',
  );
  return db.get(
    `SELECT pba.*, p.name AS project_name FROM portfolio_budget_allocations pba
     LEFT JOIN projects p ON p.id = pba.project_id WHERE pba.id = ?`,
    r.lastInsertRowid,
  );
}

export async function updatePortfolioBudgetAllocation(
  budgetId: number | string,
  allocationId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getDb();
  return db.get(
    `WITH updated AS (
       UPDATE portfolio_budget_allocations SET project_id=?, allocated_amount=?, notes=?
       WHERE id=? AND portfolio_budget_id=? RETURNING *
     )
     SELECT updated.*, p.name AS project_name FROM updated
     LEFT JOIN projects p ON p.id = updated.project_id`,
    body.project_id || null, body.allocated_amount, body.notes, allocationId, budgetId,
  );
}

export async function deletePortfolioBudgetAllocation(
  budgetId: number | string,
  allocationId: number | string,
) {
  const db = await getDb();
  return db.run(
    'DELETE FROM portfolio_budget_allocations WHERE id = ? AND portfolio_budget_id = ?',
    allocationId, budgetId,
  );
}

export async function createPortfolioBudgetCategory(budgetId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO portfolio_budget_categories
       (portfolio_budget_id, category, ceiling_amount, notes) VALUES (?, ?, ?, ?)`,
    budgetId, body.category, body.ceiling_amount || 0, body.notes || '',
  );
  return db.get('SELECT * FROM portfolio_budget_categories WHERE id = ?', r.lastInsertRowid);
}

export async function updatePortfolioBudgetCategory(
  budgetId: number | string,
  categoryId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getDb();
  return db.get(
    `UPDATE portfolio_budget_categories SET category=?, ceiling_amount=?, notes=?
     WHERE id=? AND portfolio_budget_id=? RETURNING *`,
    body.category, body.ceiling_amount, body.notes, categoryId, budgetId,
  );
}

export async function deletePortfolioBudgetCategory(
  budgetId: number | string,
  categoryId: number | string,
) {
  const db = await getDb();
  return db.run(
    'DELETE FROM portfolio_budget_categories WHERE id = ? AND portfolio_budget_id = ?',
    categoryId, budgetId,
  );
}

export async function programFteAllocations(companyId: number | null) {
  const db = await getDb();
  return db.all<{
    program_id: number; program_name: string; allocated_headcount: number; actual_fte: number;
  }>(
    `SELECT c.id AS program_id, c.name AS program_name,
       COALESCE(ppa.allocated_headcount, 0) AS allocated_headcount,
       COALESCE((
         SELECT ROUND(CAST(SUM(COALESCE(
           CASE WHEN tm.capacity_json IS NOT NULL AND length(trim(tm.capacity_json)) > 2
                THEN CAST((tm.capacity_json::jsonb ->> TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS FLOAT)
                ELSE NULL END, 0)) AS NUMERIC), 1)
         FROM team_members tm JOIN projects p ON p.id = tm.project_id
         WHERE p.customer_id = c.id AND p.company_id = ?
       ), 0) AS actual_fte
     FROM customers c
     LEFT JOIN portfolio_program_allocations ppa
       ON ppa.program_id = c.id AND ppa.company_id = ?
     WHERE c.company_id = ? ORDER BY c.name`,
    companyId, companyId, companyId,
  );
}

export async function upsertPortfolioProgramAllocation(
  companyId: number | null,
  programId: number,
  allocatedHeadcount: number,
) {
  const db = await getDb();
  const updated = await db.run(
    `UPDATE portfolio_program_allocations SET allocated_headcount = ?
     WHERE company_id = ? AND program_id = ?`,
    allocatedHeadcount, companyId, programId,
  );
  if (updated.changes === 0) {
    await db.run(
      `INSERT INTO portfolio_program_allocations (company_id, program_id, allocated_headcount)
       VALUES (?, ?, ?)`,
      companyId, programId, allocatedHeadcount,
    );
  }
}

export async function updatePortfolioProgramAllocation(
  companyId: number | null,
  allocationId: number | string,
  allocatedHeadcount: number,
) {
  const db = await getDb();
  return db.run(
    `UPDATE portfolio_program_allocations SET allocated_headcount = ?
     WHERE id = ? AND company_id = ?`,
    allocatedHeadcount, allocationId, companyId,
  );
}

export async function deletePortfolioProgramAllocation(
  companyId: number | null,
  allocationId: number | string,
) {
  const db = await getDb();
  return db.run(
    'DELETE FROM portfolio_program_allocations WHERE id = ? AND company_id = ?',
    allocationId, companyId,
  );
}

type Scope = { sql: string; params: unknown[] };

function reportCompanyScope(companyId: number | null, isAdmin: boolean): Scope {
  return isAdmin ? { sql: '', params: [] } : { sql: 'AND p.company_id = ?', params: [companyId] };
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
  isAdmin: boolean,
) {
  const db = await getDb();
  const company = reportCompanyScope(companyId, isAdmin);
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
export async function listPortfolioReportProjects(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  const company = reportCompanyScope(companyId, isAdmin);
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
  isAdmin: boolean,
  projectIds: readonly number[],
) {
  const db = await getDb();
  const company = reportCompanyScope(companyId, isAdmin);
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
  isAdmin: boolean,
  projectIds: readonly number[],
) {
  const db = await getDb();
  const company = reportCompanyScope(companyId, isAdmin);
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
  isAdmin: boolean,
  projectIds: readonly number[],
  activityIds: readonly number[],
) {
  return {
    company: reportCompanyScope(companyId, isAdmin),
    projects: idScope('a.project_id', projectIds),
    activities: idScope('a.id', activityIds),
  };
}

export async function upcomingPortfolioActivities(
  companyId: number | null,
  isAdmin: boolean,
  projectIds: readonly number[],
  activityIds: readonly number[],
  startDate: string,
  endDate: string,
  doneStatuses: readonly string[],
) {
  const db = await getDb();
  const scope = reportActivityScopes(companyId, isAdmin, projectIds, activityIds);
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
  isAdmin: boolean,
  projectIds: readonly number[],
  activityIds: readonly number[],
  sinceDate: string,
  doneStatuses: readonly string[],
) {
  const db = await getDb();
  const scope = reportActivityScopes(companyId, isAdmin, projectIds, activityIds);
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
  isAdmin: boolean,
  projectIds: readonly number[],
  activityIds: readonly number[],
  startDate: string,
  endDate: string,
  doneStatuses: readonly string[],
) {
  const db = await getDb();
  const scope = reportActivityScopes(companyId, isAdmin, projectIds, activityIds);
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
  isAdmin: boolean,
  projectIds: readonly number[],
  milestoneMonth: string | null,
) {
  const db = await getDb();
  const company = reportCompanyScope(companyId, isAdmin);
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

export async function internalPortfolioMembers(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  if (isAdmin) return db.all<{ name: string; role: string }>(
    `SELECT name, role FROM portfolio_members WHERE member_type = 'internal'`,
  );
  return db.all<{ name: string; role: string }>(
    `SELECT name, role FROM portfolio_members WHERE member_type = 'internal' AND company_id = ?`,
    companyId,
  );
}

export async function portfolioTeamMembers(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  const company = reportCompanyScope(companyId, isAdmin);
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

export async function portfolioReportMilestones(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  const company = reportCompanyScope(companyId, isAdmin);
  return db.all(
    `SELECT m.id, m.project_id, m.name, m.start_date, m.end_date,
       p.name as project_name, COALESCE(c.name, '') as program_name
     FROM milestones m JOIN projects p ON m.project_id = p.id
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE 1=1 ${company.sql} ORDER BY m.start_date DESC, m.name`,
    ...company.params,
  );
}
