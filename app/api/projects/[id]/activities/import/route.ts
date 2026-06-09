import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

type ActivityInput = {
  phase?: string; no?: string; activity: string; deliverable?: string;
  sign_off_doc?: string; accountable?: string; responsible?: string; support?: string;
  plan_start?: string; plan_end?: string; actual_start?: string; actual_end?: string;
  status?: string; completion_pct?: number; notes?: string;
  delay_owner?: string; delay_reason?: string; jira_key?: string; sprint?: string;
  parent_jira_key?: string; // jira key of parent Epic (Jira mode)
};

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { activities } = await req.json() as { activities: ActivityInput[] };
  const db = await getDb();

  // Fetch existing jira_keys for this project
  const existing = await db.all<{ id: number; jira_key: string }>(
    "SELECT id, jira_key FROM activities WHERE project_id = ? AND jira_key IS NOT NULL AND jira_key != ''",
    id,
  );
  // localKeyToId grows as we insert new rows — enables resolving parent refs in the same batch
  const localKeyToId = new Map(existing.map(r => [r.jira_key, r.id]));

  const maxOrderRow = await db.get<{ m: number | null }>(
    'SELECT MAX(order_idx) as m FROM activities WHERE project_id = ?', id,
  );
  let maxOrder = maxOrderRow?.m ?? 0;

  let inserted = 0, updated = 0;
  const errors: string[] = [];

  // Sort: activities without parent_jira_key first (Epics/standalone), then children.
  // This ensures the parent is inserted before its children so localKeyToId has the id ready.
  const sorted = [...activities].sort((a, b) => {
    const aHasParent = !!(a.parent_jira_key?.trim());
    const bHasParent = !!(b.parent_jira_key?.trim());
    return Number(aHasParent) - Number(bHasParent);
  });

  for (const act of sorted) {
    try {
      const key = act.jira_key?.trim() ?? '';
      const parentKey = act.parent_jira_key?.trim() ?? '';
      const parentId = parentKey ? (localKeyToId.get(parentKey) ?? null) : null;

      if (key && localKeyToId.has(key)) {
        const existingId = localKeyToId.get(key)!;
        await db.run(
          `UPDATE activities SET
            phase = ?, no = ?, activity = ?, deliverable = ?, sign_off_doc = ?,
            accountable = ?, responsible = ?, support = ?,
            plan_start = ?, plan_end = ?, actual_start = ?, actual_end = ?,
            status = ?, completion_pct = ?, notes = ?,
            delay_owner = ?, delay_reason = ?, sprint = ?, parent_id = ?
          WHERE id = ? AND project_id = ?`,
          act.phase ?? 'General', act.no ?? '', act.activity,
          act.deliverable ?? '', act.sign_off_doc ?? '',
          act.accountable ?? '', act.responsible ?? '', act.support ?? '',
          act.plan_start ?? '', act.plan_end ?? '',
          act.actual_start ?? '', act.actual_end ?? '',
          act.status ?? 'To-do', act.completion_pct ?? 0, act.notes ?? '',
          act.delay_owner ?? 'N/A', act.delay_reason ?? '', act.sprint ?? '',
          parentId,
          existingId, id,
        );
        updated++;
      } else {
        maxOrder++;
        const result = await db.run(
          `INSERT INTO activities
            (project_id, phase, no, activity, deliverable, sign_off_doc,
             accountable, responsible, support,
             plan_start, plan_end, actual_start, actual_end,
             status, completion_pct, notes, order_idx,
             delay_owner, delay_reason, jira_key, sprint, parent_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          id, act.phase ?? 'General', act.no ?? '', act.activity,
          act.deliverable ?? '', act.sign_off_doc ?? '',
          act.accountable ?? '', act.responsible ?? '', act.support ?? '',
          act.plan_start ?? '', act.plan_end ?? '',
          act.actual_start ?? '', act.actual_end ?? '',
          act.status ?? 'To-do', act.completion_pct ?? 0, act.notes ?? '',
          maxOrder, act.delay_owner ?? 'N/A', act.delay_reason ?? '',
          key, act.sprint ?? '', parentId,
        );
        inserted++;
        // Track newly inserted key so children later in this batch can resolve parent_id
        if (key) localKeyToId.set(key, Number(result.lastInsertRowid));
      }
    } catch {
      errors.push(act.jira_key || act.activity || `row-${inserted + updated + errors.length + 1}`);
    }
  }

  return NextResponse.json({ inserted, updated, errors });
}

// Return existing jira_keys so frontend can compute overwrite counts
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  const rows = await db.all<{ jira_key: string }>(
    "SELECT jira_key FROM activities WHERE project_id = ? AND jira_key IS NOT NULL AND jira_key != ''",
    id,
  );
  return NextResponse.json(rows.map(r => r.jira_key));
}
