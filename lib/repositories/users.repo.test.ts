import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedCompany, setupRepoTables, testDb } from '../../test/repo-db';
import { hashPassword } from '@/lib/auth';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import {
  findUserByEmailLower,
  findUserByUsername,
  insertUser,
  listUsers,
  replaceUserRoles,
} from './users.repo';

describe.skipIf(!hasTestDb)('users.repo', () => {
  let companyA: number;
  let companyB: number;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    await setupRepoTables();
    const db = testDb();
    await db.exec(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_by INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
        ON users (LOWER(email)) WHERE email IS NOT NULL AND email <> '';
    `);
    companyA = await seedCompany(`Users Co A ${suffix}`);
    companyB = await seedCompany(`Users Co B ${suffix}`);

    const u1 = await insertUser({
      username: `alice-a-${suffix}`,
      password_hash: hashPassword('secret12'),
      display_name: 'Alice A',
      email: `alice-${suffix}@a.com`,
      company_id: companyA,
      status: 'active',
    });
    await replaceUserRoles(u1.id, companyA, ['cpmo']);

    const u2 = await insertUser({
      username: `bob-a-${suffix}`,
      password_hash: hashPassword('secret12'),
      display_name: 'Bob A',
      email: `bob-${suffix}@a.com`,
      company_id: companyA,
      status: 'locked',
    });
    await replaceUserRoles(u2.id, companyA, ['pm']);

    const u3 = await insertUser({
      username: `carol-b-${suffix}`,
      password_hash: hashPassword('secret12'),
      display_name: 'Carol B',
      email: `carol-${suffix}@b.com`,
      company_id: companyB,
      status: 'active',
    });
    await replaceUserRoles(u3.id, companyB, ['viewer']);
  });

  it('listUsers returns only rows for the requested company (D-21)', async () => {
    const rows = await listUsers(companyA, {});
    expect(rows.every(r => r.company_id === companyA)).toBe(true);
    expect(rows.map(r => r.username)).toEqual(
      expect.arrayContaining([`alice-a-${suffix}`, `bob-a-${suffix}`]),
    );
    expect(rows.map(r => r.username)).not.toContain(`carol-b-${suffix}`);
  });

  it('listUsers filters by status and role', async () => {
    const locked = await listUsers(companyA, { status: 'locked' });
    expect(locked.map(r => r.username)).toEqual([`bob-a-${suffix}`]);

    const pmOnly = await listUsers(companyA, { role: 'pm' });
    expect(pmOnly.map(r => r.username)).toEqual([`bob-a-${suffix}`]);
  });

  it('listUsers searches q against username, email, display_name', async () => {
    const byEmail = await listUsers(companyA, { q: `alice-${suffix}@` });
    expect(byEmail.map(r => r.username)).toEqual([`alice-a-${suffix}`]);
  });

  it('findUserByUsername and findUserByEmailLower are global (D-06)', async () => {
    expect(await findUserByUsername(`bob-a-${suffix}`)).toBeTruthy();
    expect(await findUserByEmailLower(`bob-${suffix}@a.com`)).toBeTruthy();
  });

  it('includes locked users in default list (D-06)', async () => {
    const rows = await listUsers(companyA, {});
    expect(rows.map(r => r.username)).toContain(`bob-a-${suffix}`);
  });
});
