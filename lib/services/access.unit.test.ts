import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
}));

vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));

import { assertProjectAccess } from './access';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const admin = { company_id: 5 as number | null, is_admin: 1 as number | boolean };
const nullCompany = { company_id: null as number | null, is_admin: 0 as number | boolean };

describe('assertProjectAccess', () => {
  it('returns immediately for admin without consulting project ownership', async () => {
    await expect(assertProjectAccess(1, admin)).resolves.toBeUndefined();
    expect(projectAccessRow).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the project does not exist', async () => {
    projectAccessRow.mockResolvedValue(undefined);
    await expect(assertProjectAccess(99, owner)).rejects.toBeInstanceOf(NotFoundError);
    expect(projectAccessRow).toHaveBeenCalledWith(99);
  });

  it('allows an owner via project.company_id', async () => {
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: 9 });
    await expect(assertProjectAccess(1, owner)).resolves.toBeUndefined();
  });

  it('allows an owner via customer_company_id', async () => {
    projectAccessRow.mockResolvedValue({ company_id: 9, customer_company_id: 5 });
    await expect(assertProjectAccess(1, owner)).resolves.toBeUndefined();
  });

  it('throws ForbiddenError for a cross-company actor (not NotFoundError)', async () => {
    projectAccessRow.mockResolvedValue({ company_id: 9, customer_company_id: 8 });
    await expect(assertProjectAccess(1, owner)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assertProjectAccess(1, owner)).rejects.not.toBeInstanceOf(NotFoundError);
  });

  it('allows a null-company actor only for a fully unassigned project', async () => {
    projectAccessRow.mockResolvedValue({ company_id: null, customer_company_id: null });
    await expect(assertProjectAccess(1, nullCompany)).resolves.toBeUndefined();
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
