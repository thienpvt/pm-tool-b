import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

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

function deleteResult(numDeletedRows: bigint | number | undefined) {
  return { lastInsertRowid: 0, changes: Number(numDeletedRows ?? 0) };
}

export async function listMilestones(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('milestones')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('start_date')
    .orderBy('id')
    .execute();
}

export async function getMilestone(projectId: number | string, milestoneId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('milestones')
    .selectAll()
    .where('id', '=', Number(milestoneId))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
}

export async function createMilestone(projectId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  const planEnd = (body.plan_end ?? body.end_date ?? null) as string | null;
  const endDate = (body.end_date ?? body.plan_end ?? null) as string | null;
  return db
    .insertInto('milestones')
    .values({
      project_id: Number(projectId),
      name: String(body.name ?? ''),
      start_date: body.start_date != null ? String(body.start_date) : null,
      end_date: endDate,
      plan_end: planEnd,
      adjusted_end: body.adjusted_end != null ? String(body.adjusted_end) : null,
      status: 'planned',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateMilestone(
  projectId: number | string,
  milestoneId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getKysely();
  const planEnd = body.plan_end !== undefined || body.end_date !== undefined
    ? ((body.plan_end ?? body.end_date ?? null) as string | null)
    : undefined;
  const endDate = body.end_date !== undefined || body.plan_end !== undefined
    ? ((body.end_date ?? body.plan_end ?? null) as string | null)
    : undefined;

  const set: {
    name?: string;
    start_date?: string | null;
    end_date?: string | null;
    plan_end?: string | null;
    adjusted_end?: string | null;
  } = {};

  if (body.name !== undefined) {
    set.name = String(body.name);
  }
  if (body.start_date !== undefined) {
    set.start_date = body.start_date != null ? String(body.start_date) : null;
  }
  if (endDate !== undefined) {
    set.end_date = endDate;
  }
  if (planEnd !== undefined) {
    set.plan_end = planEnd;
  }
  if (body.adjusted_end !== undefined) {
    set.adjusted_end = (body.adjusted_end ?? null) as string | null;
  }

  if (Object.keys(set).length === 0) {
    return getMilestone(projectId, milestoneId);
  }

  return db
    .updateTable('milestones')
    .set(set)
    .where('id', '=', Number(milestoneId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}

export async function cancelMilestone(
  projectId: number | string,
  milestoneId: number | string,
  cancelledBy: number,
) {
  const db = await getKysely();
  return db
    .updateTable('milestones')
    .set({
      status: 'cancelled',
      cancelled_at: sql`now()`,
      cancelled_by: cancelledBy,
    })
    .where('id', '=', Number(milestoneId))
    .where('project_id', '=', Number(projectId))
    .where('status', '!=', 'cancelled')
    .returningAll()
    .executeTakeFirst();
}

export async function listUpcomingMilestones(
  companyId: number | null,
  today: string,
  windowEnd: string,
) {
  const db = await getKysely();
  if (companyId !== null) {
    const result = await sql`
      SELECT m.*, p.name AS project_name
      FROM milestones m JOIN projects p ON p.id = m.project_id
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE (p.company_id = ${companyId} OR c.company_id = ${companyId})
        AND m.status NOT IN ('completed', 'cancelled')
        AND COALESCE(m.adjusted_end, m.plan_end) IS NOT NULL
        AND COALESCE(m.adjusted_end, m.plan_end) >= ${today}
        AND COALESCE(m.adjusted_end, m.plan_end) <= ${windowEnd}
      ORDER BY COALESCE(m.adjusted_end, m.plan_end), m.id
    `.execute(db);
    return result.rows;
  }
  const result = await sql`
    SELECT m.*, p.name AS project_name
    FROM milestones m JOIN projects p ON p.id = m.project_id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)
      AND m.status NOT IN ('completed', 'cancelled')
      AND COALESCE(m.adjusted_end, m.plan_end) IS NOT NULL
      AND COALESCE(m.adjusted_end, m.plan_end) >= ${today}
      AND COALESCE(m.adjusted_end, m.plan_end) <= ${windowEnd}
    ORDER BY COALESCE(m.adjusted_end, m.plan_end), m.id
  `.execute(db);
  return result.rows;
}

export async function listOverdueMilestones(companyId: number | null, today: string) {
  const db = await getKysely();
  if (companyId !== null) {
    const result = await sql`
      SELECT m.*, p.name AS project_name
      FROM milestones m JOIN projects p ON p.id = m.project_id
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE (p.company_id = ${companyId} OR c.company_id = ${companyId})
        AND m.status NOT IN ('completed', 'cancelled')
        AND COALESCE(m.adjusted_end, m.plan_end) IS NOT NULL
        AND COALESCE(m.adjusted_end, m.plan_end) < ${today}
      ORDER BY COALESCE(m.adjusted_end, m.plan_end), m.id
    `.execute(db);
    return result.rows;
  }
  const result = await sql`
    SELECT m.*, p.name AS project_name
    FROM milestones m JOIN projects p ON p.id = m.project_id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)
      AND m.status NOT IN ('completed', 'cancelled')
      AND COALESCE(m.adjusted_end, m.plan_end) IS NOT NULL
      AND COALESCE(m.adjusted_end, m.plan_end) < ${today}
    ORDER BY COALESCE(m.adjusted_end, m.plan_end), m.id
  `.execute(db);
  return result.rows;
}

export async function listEpics(milestoneId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('milestone_epics as me')
    .innerJoin('activities as a', 'a.id', 'me.activity_id')
    .select([
      'a.id',
      'a.phase',
      'a.no',
      'a.activity',
      'a.status',
      'a.completion_pct',
      'a.plan_start',
      'a.plan_end',
      'a.jira_key',
      'a.parent_id',
    ])
    .where('me.milestone_id', '=', Number(milestoneId))
    .orderBy('a.order_idx')
    .orderBy('a.id')
    .execute();
}

/** `INSERT OR IGNORE` — onConflict doNothing preserves idempotent link. */
export async function linkEpic(milestoneId: number | string, activityId: number | string) {
  const db = await getKysely();
  const result = await db
    .insertInto('milestone_epics')
    .values({
      milestone_id: Number(milestoneId),
      activity_id: Number(activityId),
    })
    .onConflict((oc) => oc.columns(['milestone_id', 'activity_id']).doNothing())
    .execute();
  return deleteResult(result.numInsertedOrUpdatedRows);
}

export async function unlinkEpic(milestoneId: number | string, activityId: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('milestone_epics')
    .where('milestone_id', '=', Number(milestoneId))
    .where('activity_id', '=', Number(activityId))
    .execute();
  return deleteResult(result.numDeletedRows);
}

/**
 * Activity ids linked to a milestone. The report uses this to scope its activity set;
 * `listEpics` returns full rows, which is a different shape for a different caller.
 */
export async function listEpicActivityIds(milestoneId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('milestone_epics')
    .select('activity_id')
    .where('milestone_id', '=', Number(milestoneId))
    .execute();
}
