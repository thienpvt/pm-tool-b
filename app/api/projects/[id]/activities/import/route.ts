import { NextRequest, NextResponse } from 'next/server';
import {
  insertImportedActivity,
  listJiraKeyed,
  listJiraKeys,
  maxOrderIdx,
  updateImportedActivity,
} from '@/lib/repositories/activities.repo';

type Params = { params: Promise<{ id: string }> };

type ActivityInput = {
  phase?: string; no?: string; activity: string; deliverable?: string;
  sign_off_doc?: string; accountable?: string; responsible?: string; support?: string;
  plan_start?: string; plan_end?: string; actual_start?: string; actual_end?: string;
  status?: string; completion_pct?: number; notes?: string;
  delay_owner?: string; delay_reason?: string; jira_key?: string; sprint?: string;
  priority?: string;
  parent_jira_key?: string; // jira key of parent Epic (Jira mode)
};

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { activities } = await req.json() as { activities: ActivityInput[] };

  // Fetch existing jira_keys for this project
  const existing = await listJiraKeyed(id);
  // localKeyToId grows as we insert new rows — enables resolving parent refs in the same batch
  const localKeyToId = new Map(existing.map(r => [r.jira_key, r.id]));

  let maxOrder = await maxOrderIdx(id);

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
        await updateImportedActivity(id, localKeyToId.get(key)!, act, parentId);
        updated++;
      } else {
        maxOrder++;
        const newId = await insertImportedActivity(id, act, maxOrder, parentId, key);
        inserted++;
        // Track newly inserted key so children later in this batch can resolve parent_id
        if (key) localKeyToId.set(key, newId);
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
  return NextResponse.json(await listJiraKeys(id));
}
