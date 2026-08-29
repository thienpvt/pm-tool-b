import { NextRequest } from 'next/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { hasTestDb } from '../../../../test/db';
import { seedProject, setupRepoTables, testDb, testKysely } from '../../../../test/repo-db';
import { PATCH } from './route';

/**
 * Route-level proof of the mass-assignment fix.
 *
 * The repository tests prove `updateProject` throws on `company_id`. That is not the
 * same claim as "the endpoint refuses it" — the route also has to catch the error and
 * map it to a 400 rather than a 500. This suite drives the real repository against
 * real SQL (only `getDb` and the session are mocked), so it fails if either the
 * allowlist or the error mapping regresses.
 */
describe.skipIf(!hasTestDb)('PATCH /api/projects/[id] mass assignment', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
  });

  beforeEach(async () => {
    vi.mocked(getDb).mockResolvedValue(testDb() as never);
    // Admin bypasses the company lookup in checkAccess; this suite is about the write
    // path, not access control (that is Phase 5/6).
    vi.mocked(getSessionFromRequest).mockResolvedValue({
      id: 1, username: 'admin', display_name: 'Admin',
      company_id: 3, company_name: 'Acme', is_admin: 1,
      onboarding_completed: 1,
      roles: ['cpmo'], status: 'active', email: 'admin@example.com',
    } as never);
    projectId = await seedProject('Route Mass Assignment', { company_id: 3 });
  });

  function patch(body: unknown) {
    return new NextRequest(`http://localhost/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const params = () => ({ params: Promise.resolve({ id: String(projectId) }) });

  const row = () =>
    testDb().get<{ company_id: number | null; customer_id: number | null; name: string }>(
      'SELECT company_id, customer_id, name FROM projects WHERE id = ?',
      projectId,
    );

  it('rejects company_id with 400 and leaves the row unchanged', async () => {
    const res = await PATCH(patch({ company_id: 99 }), params());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ columns: ['company_id'] });
    expect((await row())?.company_id).toBe(3);
  });

  it('rejects customer_id, the second tenancy escape', async () => {
    const res = await PATCH(patch({ customer_id: 42 }), params());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ columns: ['customer_id'] });
    expect((await row())?.customer_id).toBeNull();
  });

  it('still accepts an allowlisted column', async () => {
    const res = await PATCH(patch({ name: 'Renamed' }), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ name: 'Renamed' });
  });

  it('refuses the whole write when valid and invalid keys are mixed', async () => {
    const res = await PATCH(patch({ name: 'Mixed', company_id: 99 }), params());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ columns: ['company_id'] });

    // Not partially applied — the allowlisted key must not land either.
    expect((await row())?.name).toBe('Route Mass Assignment');
  });
});
