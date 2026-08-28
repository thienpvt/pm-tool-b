import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listCompaniesWithUserCounts,
  createCompany,
} = vi.hoisted(() => ({
  listCompaniesWithUserCounts: vi.fn(),
  createCompany: vi.fn(),
}));

vi.mock('@/modules/admin/backend/repositories/admin.repo', () => ({
  listCompaniesWithUserCounts,
  createCompany,
  deleteCompany: vi.fn(),
  deleteDemoRequest: vi.fn(),
  listDemoRequests: vi.fn(),
  resourceAudit: vi.fn(),
  updateCompany: vi.fn(),
  updateDemoRequest: vi.fn(),
  addMissingTeamMembersToPortfolio: vi.fn(),
}));

import { createCompanyPlatform, listCompaniesPlatform } from './admin-platform.service';
import { ConflictError } from '@/lib/services/errors';

beforeEach(() => vi.clearAllMocks());

describe('admin-platform.service companies', () => {
  it('listCompaniesPlatform calls repo with null and isAdmin true', async () => {
    listCompaniesWithUserCounts.mockResolvedValue([{ id: 1, name: 'Acme' }]);
    await listCompaniesPlatform();
    expect(listCompaniesWithUserCounts).toHaveBeenCalledWith(null, true);
  });

  it('createCompanyPlatform maps unique repo throw to ConflictError', async () => {
    createCompany.mockRejectedValue(Object.assign(new Error('duplicate'), { code: '23505' }));
    await expect(createCompanyPlatform('Acme')).rejects.toBeInstanceOf(ConflictError);
    await expect(createCompanyPlatform('Acme')).rejects.toThrow('Company name already exists');
  });

  it('createCompanyPlatform rethrows non-unique repo errors', async () => {
    const err = new Error('connection lost');
    createCompany.mockRejectedValue(err);
    await expect(createCompanyPlatform('Acme')).rejects.toBe(err);
  });

  it('createCompanyPlatform returns created row on success', async () => {
    const row = { id: 2, name: 'Beta' };
    createCompany.mockResolvedValue(row);
    await expect(createCompanyPlatform('Beta')).resolves.toEqual(row);
  });
});
