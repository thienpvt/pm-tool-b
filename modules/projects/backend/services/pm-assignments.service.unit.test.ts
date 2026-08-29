import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertCompanyWrite,
  listPmAssignmentsRepo,
  getActivePrimaryAssignment,
  getPmAssignmentById,
  hasOverlappingPmAssignment,
  hasActivePmAssignmentForUserRole,
  insertPmAssignment,
  softEndPmAssignment,
  endPrimaryWithCollaboratorCascade,
  replaceActivePrimary,
  syncProjectPmDisplay,
  findUserById,
  auditLogFn,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertCompanyWrite: vi.fn(),
  listPmAssignmentsRepo: vi.fn(),
  getActivePrimaryAssignment: vi.fn(),
  getPmAssignmentById: vi.fn(),
  hasOverlappingPmAssignment: vi.fn(),
  hasActivePmAssignmentForUserRole: vi.fn(),
  insertPmAssignment: vi.fn(),
  softEndPmAssignment: vi.fn(),
  endPrimaryWithCollaboratorCascade: vi.fn(),
  replaceActivePrimary: vi.fn(),
  syncProjectPmDisplay: vi.fn(),
  findUserById: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({
  assertProjectAccess,
  assertCompanyWrite,
  isCpmo: (actor: { roles?: string[] }) => actor.roles?.includes('cpmo') ?? false,
}));
vi.mock('@/modules/projects/backend/repositories/pm-assignments.repo', () => ({
  listPmAssignments: listPmAssignmentsRepo,
  getActivePrimaryAssignment,
  getPmAssignmentById,
  hasOverlappingPmAssignment,
  hasActivePmAssignmentForUserRole,
  insertPmAssignment,
  softEndPmAssignment,
  endPrimaryWithCollaboratorCascade,
  replaceActivePrimary,
  syncProjectPmDisplay,
}));
vi.mock('@/modules/admin/backend/repositories/users.repo', () => ({ findUserById }));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: auditLogFn }));

import {
  createPmAssignment,
  endPmAssignment,
  listPmAssignments,
} from './pm-assignments.service';
import { ForbiddenError, ValidationError } from '@/lib/services/errors';
import type { AccessActor } from '@/lib/services/access';

const cpmoActor: AccessActor = {
  company_id: 5,
  is_admin: 0,
  roles: ['cpmo'],
  status: 'active',
  user_id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  email: 'cpmo@acme.com',
};

const pmActor: AccessActor = {
  ...cpmoActor,
  roles: ['pm'],
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  email: 'ava@acme.com',
};

const assignmentRow = {
  id: 10,
  project_id: 7,
  user_id: 3,
  role: 'primary' as const,
  effective_from: '2026-08-26',
  effective_to: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue({ company_id: 5, customer_company_id: null });
  assertCompanyWrite.mockImplementation(() => undefined);
  findUserById.mockResolvedValue({
    id: 3,
    company_id: 5,
    display_name: 'Pat',
    email: 'pat@acme.com',
  });
  getActivePrimaryAssignment.mockResolvedValue(undefined);
  hasOverlappingPmAssignment.mockResolvedValue(false);
  hasActivePmAssignmentForUserRole.mockResolvedValue(false);
  insertPmAssignment.mockResolvedValue(assignmentRow);
  replaceActivePrimary.mockResolvedValue(assignmentRow);
  syncProjectPmDisplay.mockResolvedValue(undefined);
  auditLogFn.mockResolvedValue(undefined);
});

describe('listPmAssignments', () => {
  it('returns open and ended windows (PMAS-03)', async () => {
    const rows = [
      assignmentRow,
      { ...assignmentRow, id: 9, effective_to: '2026-08-01' },
    ];
    listPmAssignmentsRepo.mockResolvedValue(rows);
    await expect(listPmAssignments(7, cpmoActor)).resolves.toEqual(rows);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, cpmoActor);
  });
});

describe('createPmAssignment', () => {
  it('CPMO primary create succeeds and auditLogs create (D-11, D-15, PMAS-01)', async () => {
    const created = await createPmAssignment(7, cpmoActor, { user_id: 3, role: 'primary' });
    expect(created).toEqual(assignmentRow);
    expect(assertCompanyWrite).toHaveBeenCalledWith(cpmoActor);
    expect(replaceActivePrimary).toHaveBeenCalledWith(7, 3);
    expect(insertPmAssignment).not.toHaveBeenCalled();
    expect(syncProjectPmDisplay).toHaveBeenCalledWith(7);
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'pm_assignment',
        action: 'create',
        after: expect.objectContaining({ id: 10, role: 'primary' }),
      }),
    );
  });

  it('throws ForbiddenError for PM (D-15)', async () => {
    assertCompanyWrite.mockImplementation(() => {
      throw new ForbiddenError();
    });
    await expect(
      createPmAssignment(7, pmActor, { user_id: 3, role: 'primary' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(insertPmAssignment).not.toHaveBeenCalled();
  });

  it('throws ValidationError for collaborator without active primary (D-12, PMAS-02)', async () => {
    getActivePrimaryAssignment.mockResolvedValue(undefined);
    await expect(
      createPmAssignment(7, cpmoActor, { user_id: 4, role: 'collaborator' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(insertPmAssignment).not.toHaveBeenCalled();
  });

  it('throws ValidationError when user is already active primary and adding collaborator (D-12, PMAS-02)', async () => {
    getActivePrimaryAssignment.mockResolvedValue({ ...assignmentRow, user_id: 3 });
    hasOverlappingPmAssignment.mockResolvedValue(true);
    await expect(
      createPmAssignment(7, cpmoActor, { user_id: 3, role: 'collaborator' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(insertPmAssignment).not.toHaveBeenCalled();
  });

  it('soft-ends prior primary when assigning a second primary (D-12, PMAS-01, PMAS-03)', async () => {
    replaceActivePrimary.mockResolvedValue({ ...assignmentRow, id: 11, user_id: 3 });

    await createPmAssignment(7, cpmoActor, { user_id: 3, role: 'primary' });

    expect(replaceActivePrimary).toHaveBeenCalledWith(7, 3);
    expect(insertPmAssignment).not.toHaveBeenCalled();
    expect(syncProjectPmDisplay).toHaveBeenCalledWith(7);
  });

  it('throws ValidationError when promoting user with active collaborator to primary (CR-01, D-12)', async () => {
    hasOverlappingPmAssignment.mockResolvedValue(true);
    await expect(
      createPmAssignment(7, cpmoActor, { user_id: 3, role: 'primary' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(replaceActivePrimary).not.toHaveBeenCalled();
    expect(insertPmAssignment).not.toHaveBeenCalled();
  });

  it('throws ValidationError when duplicate active collaborator POST (WR-01, D-12)', async () => {
    getActivePrimaryAssignment.mockResolvedValue(assignmentRow);
    hasActivePmAssignmentForUserRole.mockResolvedValue(true);
    await expect(
      createPmAssignment(7, cpmoActor, { user_id: 4, role: 'collaborator' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(insertPmAssignment).not.toHaveBeenCalled();
  });

  it('allows collaborator when a primary is active and user has no overlap (D-12)', async () => {
    getActivePrimaryAssignment.mockResolvedValue(assignmentRow);
    insertPmAssignment.mockResolvedValue({ ...assignmentRow, id: 12, role: 'collaborator', user_id: 4 });
    await createPmAssignment(7, cpmoActor, { user_id: 4, role: 'collaborator' });
    expect(insertPmAssignment).toHaveBeenCalledWith(7, 4, 'collaborator');
    expect(replaceActivePrimary).not.toHaveBeenCalled();
  });
});

describe('endPmAssignment', () => {
  it('sets effective_to without DELETE (D-11, PMAS-03)', async () => {
    getPmAssignmentById.mockResolvedValue({ ...assignmentRow, role: 'collaborator' });
    getActivePrimaryAssignment.mockResolvedValue(assignmentRow);
    softEndPmAssignment.mockResolvedValue({
      ...assignmentRow,
      role: 'collaborator',
      effective_to: '2026-08-26',
    });

    const ended = await endPmAssignment(7, cpmoActor, 10);
    expect(ended.effective_to).toBe('2026-08-26');
    expect(softEndPmAssignment).toHaveBeenCalledWith(7, 10, undefined);
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: 'pm_assignment', action: 'end' }),
    );
  });

  it('ending last active primary also soft-ends collaborators in same flow (D-12, PMAS-01, PMAS-02)', async () => {
    getPmAssignmentById.mockResolvedValue(assignmentRow);
    getActivePrimaryAssignment.mockResolvedValue(assignmentRow);
    endPrimaryWithCollaboratorCascade.mockResolvedValue({
      ...assignmentRow,
      effective_to: '2026-08-26',
    });

    await endPmAssignment(7, cpmoActor, 10);

    expect(endPrimaryWithCollaboratorCascade).toHaveBeenCalledWith(7, 10, undefined);
    expect(softEndPmAssignment).not.toHaveBeenCalled();
    expect(syncProjectPmDisplay).toHaveBeenCalledWith(7);
  });

  it('throws ForbiddenError for PM (D-15)', async () => {
    assertCompanyWrite.mockImplementation(() => {
      throw new ForbiddenError();
    });
    await expect(endPmAssignment(7, pmActor, 10)).rejects.toBeInstanceOf(ForbiddenError);
    expect(softEndPmAssignment).not.toHaveBeenCalled();
  });
});
