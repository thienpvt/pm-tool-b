import { getDb } from '@/lib/db';

/**
 * Milestones and their epic links.
 *
 * The `milestones` routes use fixed-column writes (no `Object.keys(body)`), so there is
 * no mass-assignment hole here and no allowlist is needed — see ALLOWLIST-DIFF.md.
 *
 * Scoping note: `listEpics` / `linkEpic` / `unlinkEpic` take `milestoneId` only, because
 * the current SQL filters `milestone_epics` by `milestone_id` alone. Adding a
 * `project_id` join condition would change authorization behavior, which this phase
 * deliberately does not do — that is Phase 5/6.
 */

export async function listMilestones(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM milestones WHERE project_id = ? ORDER BY start_date, id', projectId);
}

export async function getMilestone(projectId: number | string, milestoneId: number | string) {
  const db = await getDb();
  return db.get(
    'SELECT * FROM milestones WHERE id = ? AND project_id = ?',
    milestoneId,
    projectId,
  );
}

export async function createMilestone(projectId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const planEnd = (body.plan_end ?? body.end_date ?? null) as string | null;
  const endDate = (body.end_date ?? body.plan_end ?? null) as string | null;
  const r = await db.run(
    `INSERT INTO milestones (project_id, name, start_date, end_date, plan_end, adjusted_end, status)
     VALUES (?,?,?,?,?,?, 'planned')`,
    projectId,
    body.name ?? '',
    body.start_date ?? null,
    endDate,
    planEnd,
    body.adjusted_end ?? null,
  );
  return db.get('SELECT * FROM milestones WHERE id = ?', r.lastInsertRowid);
}

export async function updateMilestone(
  projectId: number | string,
  milestoneId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getDb();
  const planEnd = body.plan_end !== undefined || body.end_date !== undefined
    ? ((body.plan_end ?? body.end_date ?? null) as string | null)
    : undefined;
  const endDate = body.end_date !== undefined || body.plan_end !== undefined
    ? ((body.end_date ?? body.plan_end ?? null) as string | null)
    : undefined;

  const sets = ['name = ?', 'start_date = ?'];
  const params: unknown[] = [body.name ?? '', body.start_date ?? null];

  if (endDate !== undefined) {
    sets.push('end_date = ?');
    params.push(endDate);
  }
  if (planEnd !== undefined) {
    sets.push('plan_end = ?');
    params.push(planEnd);
  }
  if (body.adjusted_end !== undefined) {
    sets.push('adjusted_end = ?');
    params.push(body.adjusted_end ?? null);
  }

  params.push(milestoneId, projectId);
  return db.get(
    `UPDATE milestones SET ${sets.join(', ')} WHERE id = ? AND project_id = ? RETURNING *`,
    ...params,
  );
}

export async function cancelMilestone(
  projectId: number | string,
  milestoneId: number | string,
  cancelledBy: number,
) {
  const db = await getDb();
  return db.get(
    `UPDATE milestones SET status = 'cancelled', cancelled_at = now(), cancelled_by = ?
     WHERE id = ? AND project_id = ? AND status != 'cancelled' RETURNING *`,
    cancelledBy, milestoneId, projectId,
  );
}

export async function listUpcomingMilestones(
  companyId: number | null,
  today: string,
  windowEnd: string,
) {
  const db = await getDb();
  const base = `SELECT m.*, p.name AS project_name
    FROM milestones m JOIN projects p ON p.id = m.project_id
    LEFT JOIN customers c ON p.customer_id = c.id`;
  const where = `m.status NOT IN ('completed', 'cancelled')
    AND COALESCE(m.adjusted_end, m.plan_end) IS NOT NULL
    AND COALESCE(m.adjusted_end, m.plan_end) >= ?
    AND COALESCE(m.adjusted_end, m.plan_end) <= ?`;
  if (companyId !== null) {
    return db.all(
      `${base} WHERE (p.company_id = ? OR c.company_id = ?) AND ${where}
       ORDER BY COALESCE(m.adjusted_end, m.plan_end), m.id`,
      companyId, companyId, today, windowEnd,
    );
  }
  return db.all(
    `${base} WHERE p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL) AND ${where}
     ORDER BY COALESCE(m.adjusted_end, m.plan_end), m.id`,
    today, windowEnd,
  );
}

export async function listOverdueMilestones(companyId: number | null, today: string) {
  const db = await getDb();
  const base = `SELECT m.*, p.name AS project_name
    FROM milestones m JOIN projects p ON p.id = m.project_id
    LEFT JOIN customers c ON p.customer_id = c.id`;
  const where = `m.status NOT IN ('completed', 'cancelled')
    AND COALESCE(m.adjusted_end, m.plan_end) IS NOT NULL
    AND COALESCE(m.adjusted_end, m.plan_end) < ?`;
  if (companyId !== null) {
    return db.all(
      `${base} WHERE (p.company_id = ? OR c.company_id = ?) AND ${where}
       ORDER BY COALESCE(m.adjusted_end, m.plan_end), m.id`,
      companyId, companyId, today,
    );
  }
  return db.all(
    `${base} WHERE p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL) AND ${where}
     ORDER BY COALESCE(m.adjusted_end, m.plan_end), m.id`,
    today,
  );
}

export async function listEpics(milestoneId: number | string) {
  const db = await getDb();
  return db.all(
    `SELECT a.id, a.phase, a.no, a.activity, a.status, a.completion_pct, a.plan_start, a.plan_end, a.jira_key, a.parent_id
     FROM milestone_epics me
     JOIN activities a ON a.id = me.activity_id
     WHERE me.milestone_id = ?
     ORDER BY a.order_idx, a.id`,
    milestoneId,
  );
}

/** `INSERT OR IGNORE` — lib/db.ts rewrites this to `ON CONFLICT DO NOTHING`. */
export async function linkEpic(milestoneId: number | string, activityId: number | string) {
  const db = await getDb();
  return db.run(
    'INSERT OR IGNORE INTO milestone_epics (milestone_id, activity_id) VALUES (?,?)',
    milestoneId, activityId,
  );
}

export async function unlinkEpic(milestoneId: number | string, activityId: number | string) {
  const db = await getDb();
  return db.run(
    'DELETE FROM milestone_epics WHERE milestone_id = ? AND activity_id = ?',
    milestoneId, activityId,
  );
}

/**
 * Activity ids linked to a milestone. The report uses this to scope its activity set;
 * `listEpics` returns full rows, which is a different shape for a different caller.
 */
export async function listEpicActivityIds(milestoneId: number | string) {
  const db = await getDb();
  return db.all<{ activity_id: number }>(
    'SELECT activity_id FROM milestone_epics WHERE milestone_id = ?',
    milestoneId,
  );
}
