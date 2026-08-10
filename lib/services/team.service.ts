import {
  createTeamMember as createTeamMemberRepo,
  deleteTeamMember as deleteTeamMemberRepo,
  listTeam as listTeamRepo,
  updateTeamMember as updateTeamMemberRepo,
} from '@/lib/repositories/team.repo';
import { assertProjectAccess, type AccessActor } from './access';
import { NotFoundError } from './errors';

export async function listTeam(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listTeamRepo(projectId);
}

export async function createTeamMember(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  return createTeamMemberRepo(projectId, body);
}

export async function updateTeamMember(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  const updated = await updateTeamMemberRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'team_member');
  return updated;
}

export async function deleteTeamMember(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
) {
  await assertProjectAccess(projectId, actor);
  const result = await deleteTeamMemberRepo(projectId, rowId);
  if (!result || Number(result.changes ?? 0) === 0) {
    throw new NotFoundError('Not found', 'team_member');
  }
  return result;
}
