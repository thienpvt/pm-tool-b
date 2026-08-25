import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listJqlPresetsRepo,
  getJqlPresetById,
  findJqlPresetByName,
  createJqlPresetRepo,
  deleteJqlPresetRepo,
  listRecentJiraSyncMappingsRepo,
  saveJiraSyncMappingRepo,
} = vi.hoisted(() => ({
  listJqlPresetsRepo: vi.fn(),
  getJqlPresetById: vi.fn(),
  findJqlPresetByName: vi.fn(),
  createJqlPresetRepo: vi.fn(),
  deleteJqlPresetRepo: vi.fn(),
  listRecentJiraSyncMappingsRepo: vi.fn(),
  saveJiraSyncMappingRepo: vi.fn(),
}));

vi.mock('@/lib/repositories/jira-config.repo', () => ({
  listJqlPresets: listJqlPresetsRepo,
  getJqlPresetById,
  findJqlPresetByName,
  createJqlPreset: createJqlPresetRepo,
  deleteJqlPreset: deleteJqlPresetRepo,
  listRecentJiraSyncMappings: listRecentJiraSyncMappingsRepo,
  saveJiraSyncMapping: saveJiraSyncMappingRepo,
}));

import {
  createJqlPreset,
  deleteJqlPreset,
  listJqlPresets,
  listRecentJiraSyncMappings,
  saveJiraSyncMapping,
} from './jira-mapping.service';
import { ConflictError, ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };
const noCompany = { company_id: null as number | null, is_admin: 0 as number | boolean };

const presetRow = {
  id: 1,
  company_id: 5,
  name: 'Open',
  jql: 'project = A',
  context: 'timeline',
};

describe('jira-mapping.service JQL presets', () => {
  it('deleteJqlPreset throws ForbiddenError (not NotFoundError) for cross-company actor', async () => {
    getJqlPresetById.mockResolvedValue(presetRow);
    await expect(deleteJqlPreset(1, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteJqlPreset(1, foreign)).rejects.not.toBeInstanceOf(NotFoundError);
    expect(deleteJqlPresetRepo).not.toHaveBeenCalled();
  });

  it('deleteJqlPreset throws NotFoundError when preset is missing', async () => {
    getJqlPresetById.mockResolvedValue(undefined);
    await expect(deleteJqlPreset(99, owner)).rejects.toBeInstanceOf(NotFoundError);
    expect(deleteJqlPresetRepo).not.toHaveBeenCalled();
  });

  it('deleteJqlPreset throws ForbiddenError when actor company_id is null', async () => {
    getJqlPresetById.mockResolvedValue(presetRow);
    await expect(deleteJqlPreset(1, noCompany)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deleteJqlPresetRepo).not.toHaveBeenCalled();
  });

  it('listJqlPresets passes session company and context to repo', async () => {
    listJqlPresetsRepo.mockResolvedValue([presetRow]);
    await expect(listJqlPresets(owner, 'timeline')).resolves.toEqual([presetRow]);
    expect(listJqlPresetsRepo).toHaveBeenCalledWith(5, 'timeline');
  });

  it('listJqlPresets throws ForbiddenError when actor company_id is null', async () => {
    await expect(listJqlPresets(noCompany, 'timeline')).rejects.toBeInstanceOf(ForbiddenError);
    expect(listJqlPresetsRepo).not.toHaveBeenCalled();
  });

  it('createJqlPreset throws ConflictError when name+context already exists in company', async () => {
    findJqlPresetByName.mockResolvedValue(presetRow);
    await expect(createJqlPreset(owner, 'Open', 'project = B', 'timeline')).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(createJqlPresetRepo).not.toHaveBeenCalled();
  });

  it('createJqlPreset stamps company from actor', async () => {
    findJqlPresetByName.mockResolvedValue(undefined);
    createJqlPresetRepo.mockResolvedValue(presetRow);
    await createJqlPreset(owner, 'Open', 'project = A', 'timeline', 10);
    expect(createJqlPresetRepo).toHaveBeenCalledWith(5, 'Open', 'project = A', 'timeline', 10);
  });
});

describe('jira-mapping.service sync mappings', () => {
  it('listRecentJiraSyncMappings passes session company to repo', async () => {
    const rows = [{ id: 1, company_id: 5, mappings_json: '{}' }];
    listRecentJiraSyncMappingsRepo.mockResolvedValue(rows);
    await expect(listRecentJiraSyncMappings(owner)).resolves.toEqual(rows);
    expect(listRecentJiraSyncMappingsRepo).toHaveBeenCalledWith(5);
  });

  it('listRecentJiraSyncMappings throws ForbiddenError when actor company_id is null', async () => {
    await expect(listRecentJiraSyncMappings(noCompany)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listRecentJiraSyncMappingsRepo).not.toHaveBeenCalled();
  });

  it('saveJiraSyncMapping stamps company from actor', async () => {
    saveJiraSyncMappingRepo.mockResolvedValue(undefined);
    await saveJiraSyncMapping(owner, '{"a":1}');
    expect(saveJiraSyncMappingRepo).toHaveBeenCalledWith(5, '{"a":1}');
  });

  it('saveJiraSyncMapping throws ForbiddenError when actor company_id is null', async () => {
    await expect(saveJiraSyncMapping(noCompany, '{}')).rejects.toBeInstanceOf(ForbiddenError);
    expect(saveJiraSyncMappingRepo).not.toHaveBeenCalled();
  });
});
