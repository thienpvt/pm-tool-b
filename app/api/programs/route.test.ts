import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listProgramsWithCounts, createProgram } = vi.hoisted(() => ({
  listProgramsWithCounts: vi.fn(),
  createProgram: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/programs.service', () => ({ listProgramsWithCounts, createProgram }));

import { getSessionFromRequest } from '@/lib/auth';
import { ValidationError } from '@/lib/services/errors';
import { GET, POST } from './route';

const owner = {
  id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
  is_admin: 0, onboarding_completed: 1,
  roles: ['cpmo'], status: 'active', email: 'ava@example.com',
};
const cpmoOwner = owner;
const admin = { ...owner, id: 1, username: 'root', is_admin: 1, roles: ['cpmo'] };

function req(body?: unknown) {
  return new NextRequest('http://localhost/api/programs', {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/programs', () => {
  it('returns 401 (empty array) when there is no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);

    const res = await GET(req());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual([]);
    expect(listProgramsWithCounts).not.toHaveBeenCalled();
  });

  it('calls the service with the actor and returns its result', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(owner as never);
    listProgramsWithCounts.mockResolvedValue([{ id: 1, name: 'Alpha', project_count: 2 }]);

    const res = await GET(req());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 1, name: 'Alpha', project_count: 2 }]);
    expect(listProgramsWithCounts).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: owner.company_id, user_id: owner.id }),
    );
  });
});

describe('POST /api/programs', () => {
  it('returns 401 with an error object when there is no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);

    const res = await POST(req({ name: 'Alpha' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createProgram).not.toHaveBeenCalled();
  });

  it('returns 400 "Name required" when the service rejects a blank name', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(owner as never);
    createProgram.mockRejectedValue(new ValidationError('Name required'));

    const res = await POST(req({ name: '' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Name required' });
  });

  it('places a CPMO-created program via the actor company, regardless of body.company_id', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoOwner as never);
    createProgram.mockResolvedValue({ id: 1, name: 'Alpha', company_id: owner.company_id });

    const res = await POST(req({ name: 'Alpha', company_id: 999 }));

    expect(res.status).toBe(201);
    expect(createProgram).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: owner.company_id, roles: ['cpmo'] }),
      { name: 'Alpha', company_id: 999 },
    );
  });

  it('stamps actor.company_id for admin CPMO; body.company_id does not override tenancy', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(admin as never);
    createProgram.mockResolvedValue({ id: 2, name: 'Beta', company_id: admin.company_id });

    const res = await POST(req({ name: 'Beta', company_id: 42 }));

    expect(res.status).toBe(201);
    expect(createProgram).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: admin.company_id, is_admin: 1, roles: ['cpmo'] }),
      { name: 'Beta', company_id: 42 },
    );
  });
});
