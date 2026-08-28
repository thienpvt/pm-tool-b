import {
  createMeeting as createMeetingRepo,
  deleteMeeting as deleteMeetingRepo,
  listMeetings as listMeetingsRepo,
  updateMeeting as updateMeetingRepo,
} from '@/modules/projects/backend/repositories/meetings.repo';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from '@/lib/services/access';
import { NotFoundError } from '@/lib/services/errors';

export async function listMeetings(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listMeetingsRepo(projectId);
}

export async function createMeeting(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  return createMeetingRepo(projectId, body);
}

export async function updateMeeting(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const updated = await updateMeetingRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'meeting');
  return updated;
}

export async function deleteMeeting(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
) {
  await assertProjectWriteAccess(projectId, actor);
  const result = await deleteMeetingRepo(projectId, rowId);
  if (!result || Number(result.changes ?? 0) === 0) {
    throw new NotFoundError('Not found', 'meeting');
  }
  return result;
}
