import {
  createMilestone as createMilestoneRepo,
  deleteMilestone as deleteMilestoneRepo,
  linkEpic as linkEpicRepo,
  listEpics as listEpicsRepo,
  listMilestones as listMilestonesRepo,
  unlinkEpic as unlinkEpicRepo,
  updateMilestone as updateMilestoneRepo,
} from '@/lib/repositories/milestones.repo';
import { assertProjectAccess, type AccessActor } from './access';
import { NotFoundError } from './errors';

export async function listMilestones(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listMilestonesRepo(projectId);
}

export async function createMilestone(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  return createMilestoneRepo(projectId, body);
}

/**
 * Parent project assert + scoped update. A milestone belonging to another project
 * yields undefined from the repo and becomes NotFoundError (T-04-13).
 */
export async function updateMilestone(
  projectId: number | string,
  actor: AccessActor,
  milestoneId: number | string,
  body: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  const updated = await updateMilestoneRepo(projectId, milestoneId, body);
  if (!updated) throw new NotFoundError('Not found', 'milestone');
  return updated;
}

export async function deleteMilestone(
  projectId: number | string,
  actor: AccessActor,
  milestoneId: number | string,
) {
  await assertProjectAccess(projectId, actor);
  const result = await deleteMilestoneRepo(projectId, milestoneId);
  if (!result || Number(result.changes ?? 0) === 0) {
    throw new NotFoundError('Not found', 'milestone');
  }
  return result;
}

/**
 * Epics are keyed by milestoneId only at the SQL layer (repo note). We still assert
 * the parent project so a foreign milestone cannot be reached via a legitimate project id
 * without the session owning that parent.
 */
export async function listEpics(
  projectId: number | string,
  actor: AccessActor,
  milestoneId: number | string,
) {
  await assertProjectAccess(projectId, actor);
  return listEpicsRepo(milestoneId);
}

export async function linkEpic(
  projectId: number | string,
  actor: AccessActor,
  milestoneId: number | string,
  activityId: number | string,
) {
  await assertProjectAccess(projectId, actor);
  try {
    await linkEpicRepo(milestoneId, activityId);
  } catch {
    // already linked — ignore, matching the previous handler
  }
  return { ok: true as const };
}

export async function unlinkEpic(
  projectId: number | string,
  actor: AccessActor,
  milestoneId: number | string,
  activityId: number | string,
) {
  await assertProjectAccess(projectId, actor);
  await unlinkEpicRepo(milestoneId, activityId);
  return { ok: true as const };
}
