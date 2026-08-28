import {
  deleteAllBugs as deleteAllBugsRepo,
  deleteSnapshot as deleteSnapshotRepo,
  listBugs as listBugsRepo,
  listSnapshotDates as listSnapshotDatesRepo,
  replaceSnapshot as replaceSnapshotRepo,
} from '@/modules/projects/backend/repositories/bugs.repo';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from '@/lib/services/access';
import { ValidationError } from '@/lib/services/errors';

export async function listSnapshotDates(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listSnapshotDatesRepo(projectId);
}

export async function listBugs(
  projectId: number | string,
  actor: AccessActor,
  date?: string | null,
) {
  await assertProjectAccess(projectId, actor);
  return listBugsRepo(projectId, date);
}

export async function replaceSnapshot(
  projectId: number | string,
  actor: AccessActor,
  bugs: unknown,
  snapshotDate?: string,
) {
  await assertProjectWriteAccess(projectId, actor);
  if (!Array.isArray(bugs)) throw new ValidationError('bugs must be array', 'bugs');
  const date = snapshotDate || new Date().toISOString().split('T')[0];
  const inserted = await replaceSnapshotRepo(projectId, bugs as Record<string, unknown>[], date);
  return { inserted, snapshot_date: date };
}

export async function deleteBugs(
  projectId: number | string,
  actor: AccessActor,
  date?: string | null,
) {
  await assertProjectWriteAccess(projectId, actor);
  if (date) await deleteSnapshotRepo(projectId, date);
  else await deleteAllBugsRepo(projectId);
  return { ok: true as const };
}
