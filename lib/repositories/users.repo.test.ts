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

  beforeAll(async () => {
    await setupRepoTables();
    const db = testDb();
    await db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
        ON users (LOWER(email)) WHERE email IS NOT NULL AND email <> '';
    `);
    companyA = await seedCompany('Users Co A');
    companyB = await seedCompany('Users Co B');

    const u1 = await insertUser({
      username: 'alice-a',
      password_hash: hashPassword('secret12'),
      display_name: 'Alice A',
      email: 'alice@a.com',
      company_id: companyA,
      status: 'active',
    });
    await replaceUserRoles(u1.id, companyA, ['cpmo']);

    const u2 = await insertUser({
      username: 'bob-a',
      password_hash: hashPassword('secret12'),
      display_name: 'Bob A',
      email: 'bob@a.com',
      company_id: companyA,
      status: 'locked',
    });
    await replaceUserRoles(u2.id, companyA, ['pm']);

    const u3 = await insertUser({
      username: 'carol-b',
      password_hash: hashPassword('secret12'),
      display_name: 'Carol B',
      email: 'carol@b.com',
      company_id: companyB,
      status: 'active',
    });
    await replaceUserRoles(u3.id, companyB, ['viewer']);
  });

  it('listUsers returns only rows for the requested company (D-21)', async () => {
    const rows = await listUsers(companyA, {});
    expect(rows.every(r => r.company_id === companyA)).toBe(true);
    expect(rows.map(r => r.username)).toEqual(expect.arrayContaining(['alice-a', 'bob-a']));
    expect(rows.map(r => r.username)).not.toContain('carol-b');
  });

  it('listUsers filters by status and role', async () => {
    const locked = await listUsers(companyA, { status: 'locked' });
    expect(locked.map(r => r.username)).toEqual(['bob-a']);

    const pmOnly = await listUsers(companyA, { role: 'pm' });
    expect(pmOnly.map(r => r.username)).toEqual(['bob-a']);
  });

  it('listUsers searches q against username, email, display_name', async () => {
    const byEmail = await listUsers(companyA, { q: 'alice@' });
    expect(byEmail.map(r => r.username)).toEqual(['alice-a']);
  });

  it('findUserByUsername and findUserByEmailLower are global (D-06)', async () => {
    expect(await findUserByUsername('bob-a')).toBeTruthy();
    expect(await findUserByEmailLower('bob@a.com')).toBeTruthy();
  });

  it('includes locked users in default list (D-06)', async () => {
    const rows = await listUsers(companyA, {});
    expect(rows.map(r => r.username)).toContain('bob-a');
  });
});
