import {
  createActivity as createActivityRepo,
  deleteActivity as deleteActivityRepo,
  insertImportedActivity,
  listActivities as listActivitiesRepo,
  listJiraKeyed,
  listJiraKeys as listJiraKeysRepo,
  maxOrderIdx,
  updateActivity as updateActivityRepo,
  updateImportedActivity,
  type ImportedActivity,
} from '@/modules/projects/backend/repositories/activities.repo';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from './access';
import { NotFoundError } from './errors';

export async function listActivities(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listActivitiesRepo(projectId);
}

export async function createActivity(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  return createActivityRepo(projectId, body);
}

export async function updateActivity(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const updated = await updateActivityRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'activity');
  return updated;
}

export async function deleteActivity(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
) {
  await assertProjectWriteAccess(projectId, actor);
  const result = await deleteActivityRepo(projectId, rowId);
  if (!result || Number(result.changes ?? 0) === 0) {
    throw new NotFoundError('Not found', 'activity');
  }
  return result;
}

export async function listActivityJiraKeys(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listJiraKeysRepo(projectId);
}

type ActivityInput = ImportedActivity & {
  activity?: string;
  jira_key?: string;
  parent_jira_key?: string;
};

/** Batch Jira import — preserves parent-first sort and insert-vs-update semantics. */
export async function importActivities(
  projectId: number | string,
  actor: AccessActor,
  activities: ActivityInput[],
) {
  await assertProjectWriteAccess(projectId, actor);

  const existing = await listJiraKeyed(projectId);
  const localKeyToId = new Map(existing.map(r => [r.jira_key, r.id]));
  let maxOrder = await maxOrderIdx(projectId);

  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

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
        await updateImportedActivity(projectId, localKeyToId.get(key)!, act, parentId);
        updated++;
      } else {
        maxOrder++;
        const newId = await insertImportedActivity(projectId, act, maxOrder, parentId, key);
        inserted++;
        if (key) localKeyToId.set(key, newId);
      }
    } catch {
      errors.push(
        (act.jira_key as string) ||
          (act.activity as string) ||
          `row-${inserted + updated + errors.length + 1}`,
      );
    }
  }

  return { inserted, updated, errors };
}
