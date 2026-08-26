import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listActiveCatalogForStage,
  listChecklistCatalogIds,
  insertChecklistRowIfMissing,
} = vi.hoisted(() => ({
  listActiveCatalogForStage: vi.fn(),
  listChecklistCatalogIds: vi.fn(),
  insertChecklistRowIfMissing: vi.fn(),
}));

vi.mock('@/lib/repositories/document-catalog.repo', () => ({
  listActiveCatalogForStage,
}));

vi.mock('@/lib/repositories/project-document-checklist.repo', () => ({
  listChecklistCatalogIds,
  insertChecklistRowIfMissing,
}));

import { generateProjectChecklist } from './document-checklist-generate';

beforeEach(() => vi.clearAllMocks());

describe('document-checklist-generate D-01 isolation', () => {
  it('does not import the legacy diary service or repo', () => {
    const src = readFileSync(resolve(__dirname, 'document-checklist-generate.ts'), 'utf8');
    expect(src).not.toMatch(/documents\.service/);
    expect(src).not.toMatch(/documents\.repo/);
  });
});

describe('generateProjectChecklist', () => {
  it('inserts active L2 and ALL catalog ids missing on the project (D-04)', async () => {
    listActiveCatalogForStage.mockResolvedValue([
      { id: 1, stage: 'L2' },
      { id: 2, stage: 'ALL' },
      { id: 3, stage: 'L2' },
    ]);
    listChecklistCatalogIds.mockResolvedValue([3]);
    insertChecklistRowIfMissing.mockResolvedValue(100);

    const result = await generateProjectChecklist(42, { companyId: 5, stage: 'L2' });

    expect(result.inserted).toBe(2);
    expect(insertChecklistRowIfMissing).toHaveBeenCalledTimes(2);
    expect(insertChecklistRowIfMissing).toHaveBeenCalledWith(42, 1);
    expect(insertChecklistRowIfMissing).toHaveBeenCalledWith(42, 2);
    expect(insertChecklistRowIfMissing).not.toHaveBeenCalledWith(42, 3);
  });

  it('second call inserts 0 when all catalog ids already present (D-04)', async () => {
    listActiveCatalogForStage.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    listChecklistCatalogIds.mockResolvedValue([1, 2]);

    const result = await generateProjectChecklist(42, { companyId: 5, stage: 'L2' });

    expect(result.inserted).toBe(0);
    expect(insertChecklistRowIfMissing).not.toHaveBeenCalled();
  });
});
