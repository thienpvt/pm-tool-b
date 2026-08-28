import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, hasActivePmAssignment } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
}));

vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/modules/projects/backend/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));

import {
  assertCanMutate,
  assertCompanyWrite,
  assertPmWriteAccess,
  assertProjectAccess,
  assertProjectWriteAccess,
} from './access';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  hasActivePmAssignment.mockResolvedValue(true);
});

const baseActor = {
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  email: 'ava@example.com',
  status: 'active' as const,
};

const owner = {
  ...baseActor,
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'] as const,
};
const admin = {
  ...baseActor,
  company_id: 5 as number | null,
  is_admin: 1 as number | boolean,
  roles: ['cpmo'] as const,
};
const nullCompany = {
  ...baseActor,
  company_id: null as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'] as const,
};

describe('assertProjectAccess', () => {
  it('throws ForbiddenError when CPMO company does not match project company (D-13)', async () => {
    projectAccessRow.mockResolvedValue({ company_id: 9, customer_company_id: null });
    await expect(assertProjectAccess(1, admin)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assertProjectAccess(1, admin)).rejects.not.toBeInstanceOf(NotFoundError);
  });

  it('allows CPMO when project.company_id matches actor company (D-13)', async () => {
    const row = { company_id: 5, customer_company_id: null };
    projectAccessRow.mockResolvedValue(row);
    await expect(assertProjectAccess(1, admin)).resolves.toEqual(row);
  });

  it('allows CPMO when customer_company_id matches actor company (D-13)', async () => {
    const row = { company_id: 9, customer_company_id: 5 };
    projectAccessRow.mockResolvedValue(row);
    await expect(assertProjectAccess(1, admin)).resolves.toEqual(row);
  });

  it('throws NotFoundError when the project does not exist', async () => {
    projectAccessRow.mockResolvedValue(undefined);
    await expect(assertProjectAccess(99, owner)).rejects.toBeInstanceOf(NotFoundError);
    expect(projectAccessRow).toHaveBeenCalledWith(99);
  });

  it('allows PM-only when hasActivePmAssignment is true (D-13, PMAS-04)', async () => {
    const row = { company_id: 5, customer_company_id: 9 };
    projectAccessRow.mockResolvedValue(row);
    hasActivePmAssignment.mockResolvedValue(true);
    await expect(assertProjectAccess(1, owner)).resolves.toEqual(row);
    expect(hasActivePmAssignment).toHaveBeenCalledWith(1, owner.user_id);
  });

  it('throws ForbiddenError for PM-only without active assignment window (D-13, PMAS-04)', async () => {
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    hasActivePmAssignment.mockResolvedValue(false);
    await expect(assertProjectAccess(1, owner)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws ForbiddenError for a cross-company actor (not NotFoundError)', async () => {
    projectAccessRow.mockResolvedValue({ company_id: 9, customer_company_id: 8 });
    await expect(assertProjectAccess(1, owner)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assertProjectAccess(1, owner)).rejects.not.toBeInstanceOf(NotFoundError);
  });

  it('allows viewer-only in-company without window check (D-24)', async () => {
    const row = { company_id: 5, customer_company_id: null };
    projectAccessRow.mockResolvedValue(row);
    const viewer = { ...owner, roles: ['viewer'] as const };
    await expect(assertProjectAccess(1, viewer)).resolves.toEqual(row);
    expect(hasActivePmAssignment).not.toHaveBeenCalled();
  });

  it('allows pm+viewer union in-company without window check on GET (D-24)', async () => {
    const row = { company_id: 5, customer_company_id: null };
    projectAccessRow.mockResolvedValue(row);
    const union = { ...owner, roles: ['pm', 'viewer'] as const };
    hasActivePmAssignment.mockResolvedValue(false);
    await expect(assertProjectAccess(1, union)).resolves.toEqual(row);
    expect(hasActivePmAssignment).not.toHaveBeenCalled();
  });

  it('allows a null-company actor only for a fully unassigned project', async () => {
    const row = { company_id: null, customer_company_id: null };
    projectAccessRow.mockResolvedValue(row);
    await expect(assertProjectAccess(1, nullCompany)).resolves.toEqual(row);
  });

  it('denies a null-company actor a project whose company_id is set', async () => {
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    await expect(assertProjectAccess(1, nullCompany)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('denies a null-company actor a project whose customer_company_id is set', async () => {
    projectAccessRow.mockResolvedValue({ company_id: null, customer_company_id: 5 });
    await expect(assertProjectAccess(1, nullCompany)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('assertPmWriteAccess', () => {
  it('returns without window query for CPMO (D-13)', async () => {
    await expect(assertPmWriteAccess(1, admin)).resolves.toBeUndefined();
    expect(hasActivePmAssignment).not.toHaveBeenCalled();
  });

  it('allows PM when hasActivePmAssignment is true (D-13, PMAS-04)', async () => {
    hasActivePmAssignment.mockResolvedValue(true);
    await expect(assertPmWriteAccess(1, owner)).resolves.toBeUndefined();
    expect(hasActivePmAssignment).toHaveBeenCalledWith(1, owner.user_id);
  });

  it('denies PM when hasActivePmAssignment is false (D-13, PMAS-04)', async () => {
    hasActivePmAssignment.mockResolvedValue(false);
    await expect(assertPmWriteAccess(1, owner)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('assertProjectWriteAccess', () => {
  it('denies viewer-only before PM write check (D-15)', async () => {
    const row = { company_id: 5, customer_company_id: null };
    projectAccessRow.mockResolvedValue(row);
    const viewer = { ...owner, roles: ['viewer'] as const };
    await expect(assertProjectWriteAccess(1, viewer)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('assertCompanyWrite', () => {
  it('throws ForbiddenError for viewer-only (D-15)', () => {
    const viewer = { ...owner, roles: ['viewer'] as const };
    expect(() => assertCompanyWrite(viewer)).toThrow(ForbiddenError);
  });

  it('throws ForbiddenError for pm without cpmo (D-13)', () => {
    expect(() => assertCompanyWrite(owner)).toThrow(ForbiddenError);
  });

  it('returns for cpmo with non-null company_id (D-13)', () => {
    expect(() => assertCompanyWrite(admin)).not.toThrow();
  });

  it('throws ForbiddenError for cpmo with null company_id (D-13)', () => {
    const cpmoNullCompany = {
      ...baseActor,
      company_id: null as number | null,
      is_admin: 1 as number | boolean,
      roles: ['cpmo'] as const,
    };
    expect(() => assertCompanyWrite(cpmoNullCompany)).toThrow(ForbiddenError);
  });
});

describe('assertCanMutate', () => {
  it('throws ForbiddenError for a viewer-only actor', () => {
    const viewer = { ...owner, roles: ['viewer'] as const };
    expect(() => assertCanMutate(viewer)).toThrow(ForbiddenError);
  });

  it('does not throw for an actor with pm role', () => {
    expect(() => assertCanMutate(owner)).not.toThrow();
  });

  it('does not throw for an actor with cpmo role', () => {
    expect(() => assertCanMutate(admin)).not.toThrow();
  });

  it('does not throw for cpmo+viewer union (union write)', () => {
    const union = { ...owner, roles: ['cpmo', 'viewer'] as const };
    expect(() => assertCanMutate(union)).not.toThrow();
  });
});
