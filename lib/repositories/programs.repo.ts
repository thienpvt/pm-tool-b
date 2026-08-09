import { getDb } from '@/lib/db';

const PROGRAM_FIELDS = `id, name, industry, contact_name, contact_email,
  contact_phone, website, notes, company_id, created_at`;

/** Programs are stored in the legacy `customers` table. */
export async function listPrograms(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  if (isAdmin) return db.all(`SELECT ${PROGRAM_FIELDS} FROM customers ORDER BY name`);
  if (companyId !== null) {
    return db.all(`SELECT ${PROGRAM_FIELDS} FROM customers WHERE company_id = ? ORDER BY name`, companyId);
  }
  return db.all(`SELECT ${PROGRAM_FIELDS} FROM customers WHERE company_id IS NULL ORDER BY name`);
}

/** Admin sees all; non-admin uses an equality filter even when companyId is null. */
export async function listCompanyPrograms(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  if (isAdmin) return db.all(`SELECT ${PROGRAM_FIELDS} FROM customers ORDER BY name`);
  return db.all(`SELECT ${PROGRAM_FIELDS} FROM customers WHERE company_id = ? ORDER BY name`, companyId);
}

export async function projectCountsByProgram(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  if (isAdmin) {
    return db.all<{ customer_id: number; count: number }>(
      'SELECT p.customer_id, COUNT(*) as count FROM projects p WHERE p.customer_id IS NOT NULL GROUP BY p.customer_id',
    );
  }
  if (companyId !== null) {
    return db.all<{ customer_id: number; count: number }>(
      `SELECT p.customer_id, COUNT(*) as count
       FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
       WHERE p.customer_id IS NOT NULL AND (p.company_id = ? OR c.company_id = ?)
       GROUP BY p.customer_id`,
      companyId, companyId,
    );
  }
  return db.all<{ customer_id: number; count: number }>(
    `SELECT p.customer_id, COUNT(*) as count
     FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
     WHERE p.customer_id IS NOT NULL AND (p.company_id IS NULL OR c.company_id IS NULL)
     GROUP BY p.customer_id`,
  );
}

export async function createProgram(companyId: number | null, body: Record<string, unknown>) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO customers
       (name, industry, contact_name, contact_email, contact_phone, website, notes, company_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    body.name, body.industry ?? '', body.contact_name ?? '', body.contact_email ?? '',
    body.contact_phone ?? '', body.website ?? '', body.notes ?? '', companyId,
  );
  return getProgram(Number(r.lastInsertRowid));
}

export async function getProgram(programId: number | string) {
  const db = await getDb();
  return db.get(`SELECT ${PROGRAM_FIELDS} FROM customers WHERE id = ?`, programId);
}

export async function listProgramProjects(programId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM projects WHERE customer_id = ? ORDER BY created_at DESC', programId);
}

export async function updateProgram(programId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  await db.run(
    `UPDATE customers SET name=?, industry=?, contact_name=?, contact_email=?,
       contact_phone=?, website=?, notes=? WHERE id=?`,
    body.name, body.industry ?? '', body.contact_name ?? '', body.contact_email ?? '',
    body.contact_phone ?? '', body.website ?? '', body.notes ?? '', programId,
  );
  return getProgram(programId);
}

export async function deleteProgram(programId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM customers WHERE id = ?', programId);
}

export async function programProjectAllocations(
  programId: number | string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getDb();
  const projects = await db.all<{
    project_id: number; project_name: string; allocated_headcount: number;
  }>(
    `SELECT p.id AS project_id, p.name AS project_name,
            COALESCE(ppa.allocated_headcount, 0) AS allocated_headcount
     FROM projects p
     LEFT JOIN program_project_allocations ppa ON ppa.project_id = p.id AND ppa.program_id = ?
     WHERE p.customer_id = ? AND (p.company_id = ? OR ? = 1)
     ORDER BY p.name`,
    programId, programId, companyId, isAdmin ? 1 : 0,
  );
  const program = await db.get<{ allocated_headcount: number; name: string }>(
    `SELECT c.name, COALESCE(ppa.allocated_headcount, 0) AS allocated_headcount
     FROM customers c
     LEFT JOIN portfolio_program_allocations ppa ON ppa.program_id = c.id AND ppa.company_id = ?
     WHERE c.id = ?`,
    companyId, programId,
  );
  return { program, projects };
}

export async function upsertProgramProjectAllocation(
  programId: number | string,
  projectId: number | string,
  allocatedHeadcount: number,
) {
  const db = await getDb();
  const existing = await db.get<{ id: number }>(
    'SELECT id FROM program_project_allocations WHERE program_id = ? AND project_id = ?',
    programId, projectId,
  );
  if (existing) {
    await db.run(
      'UPDATE program_project_allocations SET allocated_headcount = ? WHERE id = ?',
      allocatedHeadcount, existing.id,
    );
    return existing.id;
  }
  const row = await db.get<{ id: number }>(
    `INSERT INTO program_project_allocations (program_id, project_id, allocated_headcount)
     VALUES (?, ?, ?) RETURNING id`,
    programId, projectId, allocatedHeadcount,
  );
  return row?.id;
}
