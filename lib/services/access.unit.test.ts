import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
}));

vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));

import { assertCanMutate, assertProjectAccess } from './access';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
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
  it('fetches and returns the project row for admin (mirrors assertProgramAccess)', async () => {
    const row = { company_id: 9, customer_company_id: null };
    projectAccessRow.mockResolvedValue(row);
    await expect(assertProjectAccess(1, admin)).resolves.toEqual(row);
    expect(projectAccessRow).toHaveBeenCalledWith(1);
  });

  it('throws NotFoundError when the project does not exist', async () => {
    projectAccessRow.mockResolvedValue(undefined);
    await expect(assertProjectAccess(99, owner)).rejects.toBeInstanceOf(NotFoundError);
    expect(projectAccessRow).toHaveBeenCalledWith(99);
  });

  it('allows an owner via project.company_id', async () => {
    const row = { company_id: 5, customer_company_id: 9 };
    projectAccessRow.mockResolvedValue(row);
    await expect(assertProjectAccess(1, owner)).resolves.toEqual(row);
  });

  it('allows an owner via customer_company_id', async () => {
    const row = { company_id: 9, customer_company_id: 5 };
    projectAccessRow.mockResolvedValue(row);
    await expect(assertProjectAccess(1, owner)).resolves.toEqual(row);
  });

  it('throws ForbiddenError for a cross-company actor (not NotFoundError)', async () => {
    projectAccessRow.mockResolvedValue({ company_id: 9, customer_company_id: 8 });
    await expect(assertProjectAccess(1, owner)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assertProjectAccess(1, owner)).rejects.not.toBeInstanceOf(NotFoundError);
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
