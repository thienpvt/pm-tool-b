import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listTimelineMappingsRepo,
  getTimelineMappingById,
  findTimelineMappingByName,
  createTimelineMappingRepo,
  updateTimelineMappingRepo,
  deleteTimelineMappingRepo,
} = vi.hoisted(() => ({
  listTimelineMappingsRepo: vi.fn(),
  getTimelineMappingById: vi.fn(),
  findTimelineMappingByName: vi.fn(),
  createTimelineMappingRepo: vi.fn(),
  updateTimelineMappingRepo: vi.fn(),
  deleteTimelineMappingRepo: vi.fn(),
}));

vi.mock('@/lib/repositories/import-mapping.repo', () => ({
  listTimelineMappings: listTimelineMappingsRepo,
  getTimelineMappingById,
  findTimelineMappingByName,
  createTimelineMapping: createTimelineMappingRepo,
  updateTimelineMapping: updateTimelineMappingRepo,
  deleteTimelineMapping: deleteTimelineMappingRepo,
}));

import {
  createTimelineMapping,
  deleteTimelineMapping,
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
