import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, getProjectPmIdentity } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  getProjectPmIdentity: vi.fn(),
}));

vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow, getProjectPmIdentity }));

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
  getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'ava@example.com' });
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

  it('allows an owner via project.company_id when D-14 matches', async () => {
    const row = { company_id: 5, customer_company_id: 9 };
    projectAccessRow.mockResolvedValue(row);
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'ava@example.com' });
    await expect(assertProjectAccess(1, owner)).resolves.toEqual(row);
  });

  it('allows an owner via customer_company_id when D-14 matches', async () => {
    const row = { company_id: 9, customer_company_id: 5 };
    projectAccessRow.mockResolvedValue(row);
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'ava@example.com' });
    await expect(assertProjectAccess(1, owner)).resolves.toEqual(row);
  });

  it('throws ForbiddenError for a cross-company actor (not NotFoundError)', async () => {
    projectAccessRow.mockResolvedValue({ company_id: 9, customer_company_id: 8 });
    await expect(assertProjectAccess(1, owner)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assertProjectAccess(1, owner)).rejects.not.toBeInstanceOf(NotFoundError);
  });

  it('denies PM-only on an in-company unassigned project after tenant match (D-14, D-24)', async () => {
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Bob', pm_email: 'bob@other.com' });
    await expect(assertProjectAccess(1, owner)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows viewer-only in-company without D-14 matcher (D-24)', async () => {
    const row = { company_id: 5, customer_company_id: null };
    projectAccessRow.mockResolvedValue(row);
    const viewer = { ...owner, roles: ['viewer'] as const };
    await expect(assertProjectAccess(1, viewer)).resolves.toEqual(row);
    expect(getProjectPmIdentity).not.toHaveBeenCalled();
  });

  it('allows pm+viewer union in-company without D-14 matcher on GET (D-24)', async () => {
    const row = { company_id: 5, customer_company_id: null };
    projectAccessRow.mockResolvedValue(row);
    const union = { ...owner, roles: ['pm', 'viewer'] as const };
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Bob', pm_email: 'bob@other.com' });
    await expect(assertProjectAccess(1, union)).resolves.toEqual(row);
    expect(getProjectPmIdentity).not.toHaveBeenCalled();
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
  it('returns without matching for CPMO (D-13, D-14)', async () => {
    await expect(assertPmWriteAccess(1, admin)).resolves.toBeUndefined();
    expect(getProjectPmIdentity).not.toHaveBeenCalled();
  });

  it('allows PM when email matches pm_email case-insensitively (D-14)', async () => {
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Other', pm_email: 'AVA@example.com' });
    await expect(assertPmWriteAccess(1, owner)).resolves.toBeUndefined();
  });

  it('denies PM when email differs and name does not match (D-14)', async () => {
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Bob', pm_email: 'bob@other.com' });
    await expect(assertPmWriteAccess(1, owner)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('denies PM when pm_email is set but only display_name matches (D-14 email-first)', async () => {
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'bob@other.com' });
    await expect(assertPmWriteAccess(1, owner)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows PM via pm_name when pm_email is empty (D-14)', async () => {
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: '' });
    await expect(assertPmWriteAccess(1, owner)).resolves.toBeUndefined();
  });

  it('allows PM via username when pm_email is empty and display_name differs (D-14)', async () => {
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'ava', pm_email: '' });
    const actor = { ...owner, display_name: 'Different' };
    await expect(assertPmWriteAccess(1, actor)).resolves.toBeUndefined();
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
