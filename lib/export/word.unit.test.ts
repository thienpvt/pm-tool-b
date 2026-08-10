import { beforeEach, describe, expect, it, vi } from 'vitest';

const { assertProjectAccess, getProject, getDocumentForExport } = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  getProject: vi.fn(),
  getDocumentForExport: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/projects.repo', () => ({ getProject }));
vi.mock('@/lib/repositories/documents.repo', () => ({ getDocumentForExport }));

import { generateWordDoc } from './word';
import { ForbiddenError } from '@/lib/services/errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };
const admin = { company_id: null as number | null, is_admin: 1 as number | boolean };

function mockEmptyDoc() {
  getProject.mockResolvedValue({
    name: 'Alpha',
    client: 'Acme',
    pm_name: 'Ava',
    start_date: '2025-01-01',
    end_date: '2025-06-01',
  });
  getDocumentForExport.mockResolvedValue({
    content_json: JSON.stringify({ objectives: 'Ship' }),
    title: 'Charter',
  });
}

describe('generateWordDoc', () => {
  it('does not call repositories when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(generateWordDoc(7, foreign, 'project_charter')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(getProject).not.toHaveBeenCalled();
    expect(getDocumentForExport).not.toHaveBeenCalled();
  });

  it('propagates ForbiddenError for a cross-company actor', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(generateWordDoc(7, foreign, 'project_charter')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('asserts access then returns a Buffer for an admin', async () => {
    mockEmptyDoc();
    const buf = await generateWordDoc(7, admin, 'project_charter');
    expect(assertProjectAccess).toHaveBeenCalledWith(7, admin);
    expect(getProject).toHaveBeenCalledWith(7);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('asserts access before the first repository read for an owner', async () => {
    mockEmptyDoc();
    await generateWordDoc(7, owner, 'project_charter', 3);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
    expect(getDocumentForExport).toHaveBeenCalledWith(7, 'project_charter', 3);
  });
});
