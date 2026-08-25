import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listTimelineMappingsRepo,
  getTimelineMappingById,
  findTimelineMappingByName,
  createTimelineMappingRepo,
  updateTimelineMappingRepo,
  deleteTimelineMappingRepo,
  listBugMappingsRepo,
  getBugMappingById,
  findBugMappingByName,
  bugMappingIdsRepo,
  createBugMappingRepo,
  deleteBugMappingRepo,
} = vi.hoisted(() => ({
  listTimelineMappingsRepo: vi.fn(),
  getTimelineMappingById: vi.fn(),
  findTimelineMappingByName: vi.fn(),
  createTimelineMappingRepo: vi.fn(),
  updateTimelineMappingRepo: vi.fn(),
  deleteTimelineMappingRepo: vi.fn(),
  listBugMappingsRepo: vi.fn(),
  getBugMappingById: vi.fn(),
  findBugMappingByName: vi.fn(),
  bugMappingIdsRepo: vi.fn(),
  createBugMappingRepo: vi.fn(),
  deleteBugMappingRepo: vi.fn(),
}));

vi.mock('@/lib/repositories/import-mapping.repo', () => ({
  listTimelineMappings: listTimelineMappingsRepo,
  getTimelineMappingById,
  findTimelineMappingByName,
  createTimelineMapping: createTimelineMappingRepo,
  updateTimelineMapping: updateTimelineMappingRepo,
  deleteTimelineMapping: deleteTimelineMappingRepo,
  listBugMappings: listBugMappingsRepo,
  getBugMappingById,
  findBugMappingByName,
  bugMappingIds: bugMappingIdsRepo,
  createBugMapping: createBugMappingRepo,
  deleteBugMapping: deleteBugMappingRepo,
}));

import {
  createBugMapping,
  createTimelineMapping,
  deleteBugMapping,
  deleteTimelineMapping,
  listBugMappings,
  listTimelineMappings,
  updateTimelineMapping,
} from './import-mapping.service';
import { ConflictError, ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };
const noCompany = { company_id: null as number | null, is_admin: 0 as number | boolean };

const row = { id: 1, company_id: 5, name: 'tpl', mappings_json: '{}' };

describe('import-mapping.service by-id tenant assert', () => {
  it('updateTimelineMapping throws ForbiddenError (not NotFoundError) for cross-company actor', async () => {
    getTimelineMappingById.mockResolvedValue(row);
    await expect(updateTimelineMapping(1, foreign, 'y', '{}')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateTimelineMapping(1, foreign, 'y', '{}')).rejects.not.toBeInstanceOf(NotFoundError);
    expect(updateTimelineMappingRepo).not.toHaveBeenCalled();
  });

  it('deleteTimelineMapping throws ForbiddenError (not NotFoundError) for cross-company actor', async () => {
    getTimelineMappingById.mockResolvedValue(row);
    await expect(deleteTimelineMapping(1, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteTimelineMapping(1, foreign)).rejects.not.toBeInstanceOf(NotFoundError);
    expect(deleteTimelineMappingRepo).not.toHaveBeenCalled();
  });

  it('updateTimelineMapping throws NotFoundError when row is missing', async () => {
    getTimelineMappingById.mockResolvedValue(undefined);
    await expect(updateTimelineMapping(99, owner, 'y', '{}')).rejects.toBeInstanceOf(NotFoundError);
    expect(updateTimelineMappingRepo).not.toHaveBeenCalled();
  });

  it('deleteTimelineMapping throws NotFoundError when row is missing', async () => {
    getTimelineMappingById.mockResolvedValue(undefined);
    await expect(deleteTimelineMapping(99, owner)).rejects.toBeInstanceOf(NotFoundError);
    expect(deleteTimelineMappingRepo).not.toHaveBeenCalled();
  });

  it('updateTimelineMapping throws ForbiddenError when actor company_id is null', async () => {
    getTimelineMappingById.mockResolvedValue(row);
    await expect(updateTimelineMapping(1, noCompany, 'y', '{}')).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateTimelineMappingRepo).not.toHaveBeenCalled();
  });

  it('deleteTimelineMapping throws ForbiddenError when actor company_id is null', async () => {
    getTimelineMappingById.mockResolvedValue(row);
    await expect(deleteTimelineMapping(1, noCompany)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deleteTimelineMappingRepo).not.toHaveBeenCalled();
  });

  it('updateTimelineMapping calls repo with owner company when allowed', async () => {
    getTimelineMappingById.mockResolvedValue(row);
    updateTimelineMappingRepo.mockResolvedValue({ ...row, name: 'y' });
    await updateTimelineMapping(1, owner, 'y', '{}');
    expect(updateTimelineMappingRepo).toHaveBeenCalledWith(5, 1, 'y', '{}');
  });

  it('deleteTimelineMapping calls repo with owner company when allowed', async () => {
    getTimelineMappingById.mockResolvedValue(row);
    deleteTimelineMappingRepo.mockResolvedValue({ changes: 1 });
    await deleteTimelineMapping(1, owner);
    expect(deleteTimelineMappingRepo).toHaveBeenCalledWith(5, 1);
  });
});

describe('import-mapping.service list and create', () => {
  it('listTimelineMappings calls repo with session company', async () => {
    listTimelineMappingsRepo.mockResolvedValue([row]);
    await expect(listTimelineMappings(owner)).resolves.toEqual([row]);
    expect(listTimelineMappingsRepo).toHaveBeenCalledWith(5);
  });

  it('listTimelineMappings throws ForbiddenError when company_id is null', async () => {
    await expect(listTimelineMappings(noCompany)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listTimelineMappingsRepo).not.toHaveBeenCalled();
  });

  it('createTimelineMapping stamps actor company_id', async () => {
    findTimelineMappingByName.mockResolvedValue(undefined);
    createTimelineMappingRepo.mockResolvedValue(row);
    await createTimelineMapping(owner, 'tpl', '{}');
    expect(createTimelineMappingRepo).toHaveBeenCalledWith(5, 'tpl', '{}');
  });

  it('createTimelineMapping throws ForbiddenError when company_id is null', async () => {
    await expect(createTimelineMapping(noCompany, 'tpl', '{}')).rejects.toBeInstanceOf(ForbiddenError);
    expect(createTimelineMappingRepo).not.toHaveBeenCalled();
  });

  it('createTimelineMapping throws ConflictError on duplicate name within company', async () => {
    findTimelineMappingByName.mockResolvedValue(row);
    await expect(createTimelineMapping(owner, 'tpl', '{}')).rejects.toBeInstanceOf(ConflictError);
    expect(createTimelineMappingRepo).not.toHaveBeenCalled();
  });
});

describe('import-mapping.service bug mappings', () => {
  const bugRow = { id: 2, company_id: 5, name: 'bug-tpl', mappings_json: '{}' };

  it('deleteBugMapping throws ForbiddenError (not NotFoundError) for cross-company actor', async () => {
    getBugMappingById.mockResolvedValue(bugRow);
    await expect(deleteBugMapping(2, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteBugMapping(2, foreign)).rejects.not.toBeInstanceOf(NotFoundError);
    expect(deleteBugMappingRepo).not.toHaveBeenCalled();
  });

  it('deleteBugMapping throws NotFoundError when row is missing', async () => {
    getBugMappingById.mockResolvedValue(undefined);
    await expect(deleteBugMapping(99, owner)).rejects.toBeInstanceOf(NotFoundError);
    expect(deleteBugMappingRepo).not.toHaveBeenCalled();
  });

  it('listBugMappings calls repo with session company', async () => {
    listBugMappingsRepo.mockResolvedValue([bugRow]);
    await expect(listBugMappings(owner)).resolves.toEqual([bugRow]);
    expect(listBugMappingsRepo).toHaveBeenCalledWith(5);
  });

  it('listBugMappings throws ForbiddenError when company_id is null', async () => {
    await expect(listBugMappings(noCompany)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listBugMappingsRepo).not.toHaveBeenCalled();
  });

  it('createBugMapping stamps actor company_id', async () => {
    findBugMappingByName.mockResolvedValue(undefined);
    bugMappingIdsRepo.mockResolvedValue([]);
    createBugMappingRepo.mockResolvedValue(bugRow);
    await createBugMapping(owner, 'bug-tpl', '{}');
    expect(createBugMappingRepo).toHaveBeenCalledWith(5, 'bug-tpl', '{}');
  });

  it('createBugMapping evicts oldest id of the same company when cap reached', async () => {
    findBugMappingByName.mockResolvedValue(undefined);
    bugMappingIdsRepo.mockResolvedValue([
      { id: 10 }, { id: 11 }, { id: 12 }, { id: 13 }, { id: 14 },
    ]);
    createBugMappingRepo.mockResolvedValue(bugRow);
    await createBugMapping(owner, 'new-tpl', '{}');
    expect(deleteBugMappingRepo).toHaveBeenCalledWith(5, 14);
    expect(createBugMappingRepo).toHaveBeenCalledWith(5, 'new-tpl', '{}');
  });

  it('createBugMapping throws ConflictError on duplicate name within company', async () => {
    findBugMappingByName.mockResolvedValue(bugRow);
    await expect(createBugMapping(owner, 'bug-tpl', '{}')).rejects.toBeInstanceOf(ConflictError);
    expect(createBugMappingRepo).not.toHaveBeenCalled();
  });
});
