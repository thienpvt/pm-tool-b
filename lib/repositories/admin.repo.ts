import { getDb } from '@/lib/db';

export async function listCompaniesWithUserCounts(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  if (isAdmin) {
    return db.all(
      `SELECT c.*, COUNT(u.id) as user_count FROM companies c
       LEFT JOIN users u ON u.company_id = c.id GROUP BY c.id ORDER BY c.name`,
    );
  }
  return db.all(
    `SELECT c.*, COUNT(u.id) as user_count FROM companies c
     LEFT JOIN users u ON u.company_id = c.id
     WHERE c.id = ? GROUP BY c.id ORDER BY c.name`,
    companyId,
  );
}

export async function createCompany(name: string) {
  const db = await getDb();
  const r = await db.run('INSERT INTO companies (name) VALUES (?)', name);
  return db.get('SELECT * FROM companies WHERE id = ?', r.lastInsertRowid);
}

export async function updateCompany(companyId: number | string, name: string) {
  const db = await getDb();
  return db.run('UPDATE companies SET name = ? WHERE id = ?', name, companyId);
}

export async function deleteCompany(companyId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM companies WHERE id = ?', companyId);
}

export async function listAdminUsers(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  const where = isAdmin ? '' : 'WHERE u.company_id = ?';
  const params = isAdmin ? [] : [companyId];
  return db.all(
    `SELECT u.id, u.username, u.display_name, u.company_id, u.is_admin, u.created_at,
       c.name as company_name
     FROM users u LEFT JOIN companies c ON u.company_id = c.id
     ${where} ORDER BY u.is_admin DESC, u.username`,
    ...params,
  );
}

export async function createAdminUser(
  username: string,
  passwordHash: string,
  displayName: string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO users (username, password_hash, display_name, company_id, is_admin)
     VALUES (?, ?, ?, ?, ?)`,
    username, passwordHash, displayName, companyId, isAdmin ? 1 : 0,
  );
  return db.get(
    'SELECT id, username, display_name, company_id, is_admin FROM users WHERE id = ?',
    r.lastInsertRowid,
  );
}

export async function setAdminUserPassword(userId: number | string, passwordHash: string) {
  const db = await getDb();
  return db.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, userId);
}

export async function updateAdminUser(
  userId: number | string,
  displayName: string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getDb();
  return db.run(
    'UPDATE users SET display_name = ?, company_id = ?, is_admin = ? WHERE id = ?',
    displayName, companyId, isAdmin ? 1 : 0, userId,
  );
}

export async function deleteAdminUser(userId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM users WHERE id = ?', userId);
}

export async function listDemoRequests() {
  const db = await getDb();
  return db.all('SELECT * FROM demo_requests ORDER BY created_at DESC');
}

export async function updateDemoRequest(
  requestId: number | string,
  status: string | null,
  notes: string | null,
) {
  const db = await getDb();
  return db.run(
    'UPDATE demo_requests SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?',
    status, notes, requestId,
  );
}

export async function deleteDemoRequest(requestId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM demo_requests WHERE id = ?', requestId);
}

export async function resourceAudit(companyId: number | null) {
  const db = await getDb();
  const company = await db.get<{ id: number; name: string }>(
    'SELECT id, name FROM companies WHERE id = ?', companyId,
  );
  const inPortfolioNotInTeams = await db.all<{ name: string; role: string; email: string }>(
    `SELECT pm.name, pm.role, pm.email FROM portfolio_members pm
     WHERE pm.company_id = ? AND pm.member_type != 'external'
       AND LOWER(TRIM(pm.name)) NOT IN (
         SELECT LOWER(TRIM(tm.name)) FROM team_members tm
         JOIN projects p ON p.id = tm.project_id WHERE p.company_id = ?)
     ORDER BY pm.name`,
    companyId, companyId,
  );
  const inTeamsNotInPortfolio = await db.all<{ name: string; role: string; projects: string }>(
    `SELECT tm.name, tm.role, STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name) AS projects
     FROM team_members tm JOIN projects p ON p.id = tm.project_id
     WHERE p.company_id = ?
       AND LOWER(TRIM(tm.name)) NOT IN (
         SELECT LOWER(TRIM(pm.name)) FROM portfolio_members pm
         WHERE pm.company_id = ? AND pm.member_type != 'external')
     GROUP BY tm.name, tm.role ORDER BY tm.name`,
    companyId, companyId,
  );
  return { company, inPortfolioNotInTeams, inTeamsNotInPortfolio };
}

export async function addMissingTeamMembersToPortfolio(companyId: number | null) {
  const db = await getDb();
  const missing = await db.all<{ name: string; role: string }>(
    `SELECT DISTINCT tm.name, tm.role FROM team_members tm
     JOIN projects p ON p.id = tm.project_id
     WHERE p.company_id = ?
       AND LOWER(TRIM(tm.name)) NOT IN (
         SELECT LOWER(TRIM(pm.name)) FROM portfolio_members pm WHERE pm.company_id = ?)
     ORDER BY tm.name`,
    companyId, companyId,
  );
  for (const member of missing) {
    await db.run(
      `INSERT INTO portfolio_members (company_id, role, name, email, note, member_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      companyId, member.role || '', member.name.trim(), '', '', 'external',
    );
  }
  return missing;
}
