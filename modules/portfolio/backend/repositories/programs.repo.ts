import { getKysely } from '@/lib/db/kysely';

const PROGRAM_COLUMNS = [
  'id',
  'name',
  'industry',
  'contact_name',
  'contact_email',
  'contact_phone',
  'website',
  'notes',
  'company_id',
  'created_at',
] as const;

/** Programs are stored in the legacy `customers` table. */
export async function listPrograms(companyId: number | null) {
  const db = await getKysely();
  let q = db.selectFrom('customers').select(PROGRAM_COLUMNS);
  if (companyId !== null) {
    q = q.where('company_id', '=', companyId);
  } else {
    q = q.where('company_id', 'is', null);
  }
  return q.orderBy('name').execute();
}

/** Company-scoped program list (equality filter even when companyId is null). */
export async function listCompanyPrograms(companyId: number | null) {
  const db = await getKysely();
  return db
    .selectFrom('customers')
    .select(PROGRAM_COLUMNS)
    .where('company_id', '=', companyId)
    .orderBy('name')
    .execute();
}

export async function projectCountsByProgram(companyId: number | null) {
  const db = await getKysely();
  if (companyId !== null) {
    return db
      .selectFrom('projects as p')
      .leftJoin('customers as c', 'p.customer_id', 'c.id')
      .select(['p.customer_id', (eb) => eb.fn.countAll<number>().as('count')])
      .where('p.customer_id', 'is not', null)
      .where((eb) =>
        eb.or([
          eb('p.company_id', '=', companyId),
          eb('c.company_id', '=', companyId),
        ]),
      )
      .groupBy('p.customer_id')
      .execute();
  }
  return db
    .selectFrom('projects as p')
    .leftJoin('customers as c', 'p.customer_id', 'c.id')
    .select(['p.customer_id', (eb) => eb.fn.countAll<number>().as('count')])
    .where('p.customer_id', 'is not', null)
    .where('p.company_id', 'is', null)
    .where('c.company_id', 'is', null)
    .groupBy('p.customer_id')
    .execute();
}

export async function createProgram(companyId: number | null, body: Record<string, unknown>) {
  const db = await getKysely();
  const r = await db
    .insertInto('customers')
    .values({
      name: String(body.name),
      industry: body.industry != null ? String(body.industry) : '',
      contact_name: body.contact_name != null ? String(body.contact_name) : '',
      contact_email: body.contact_email != null ? String(body.contact_email) : '',
      contact_phone: body.contact_phone != null ? String(body.contact_phone) : '',
      website: body.website != null ? String(body.website) : '',
      notes: body.notes != null ? String(body.notes) : '',
      company_id: companyId,
      created_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return getProgram(Number(r.id));
}

export async function getProgram(programId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('customers')
    .select(PROGRAM_COLUMNS)
    .where('id', '=', Number(programId))
    .executeTakeFirst();
}

export async function listProgramProjects(programId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('projects')
    .selectAll()
    .where('customer_id', '=', Number(programId))
    .orderBy('created_at', 'desc')
    .execute();
}

export async function updateProgram(programId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  await db
    .updateTable('customers')
    .set({
      name: String(body.name),
      industry: body.industry != null ? String(body.industry) : '',
      contact_name: body.contact_name != null ? String(body.contact_name) : '',
      contact_email: body.contact_email != null ? String(body.contact_email) : '',
      contact_phone: body.contact_phone != null ? String(body.contact_phone) : '',
      website: body.website != null ? String(body.website) : '',
      notes: body.notes != null ? String(body.notes) : '',
    })
    .where('id', '=', Number(programId))
    .execute();
  return getProgram(programId);
}

export async function deleteProgram(programId: number | string) {
  const db = await getKysely();
  return db.deleteFrom('customers').where('id', '=', Number(programId)).execute();
}

export async function programProjectAllocations(
  programId: number | string,
  companyId: number | null,
) {
  const db = await getKysely();
  const pid = Number(programId);

  let projectsQuery = db
    .selectFrom('projects as p')
    .leftJoin('program_project_allocations as ppa', (join) =>
      join
        .onRef('ppa.project_id', '=', 'p.id')
        .on('ppa.program_id', '=', pid),
    )
    .select([
      'p.id as project_id',
      'p.name as project_name',
      (eb) => eb.fn.coalesce('ppa.allocated_headcount', eb.lit(0)).as('allocated_headcount'),
    ])
    .where('p.customer_id', '=', pid);

  if (companyId !== null) {
    projectsQuery = projectsQuery.where('p.company_id', '=', companyId);
  } else {
    projectsQuery = projectsQuery.where('p.company_id', 'is', null);
  }

  const projects = await projectsQuery.orderBy('p.name').execute();

  const program = await db
    .selectFrom('customers as c')
    .leftJoin('portfolio_program_allocations as ppa', (join) =>
      join
        .onRef('ppa.program_id', '=', 'c.id')
        .on('ppa.company_id', '=', companyId),
    )
    .select([
      'c.name',
      (eb) => eb.fn.coalesce('ppa.allocated_headcount', eb.lit(0)).as('allocated_headcount'),
    ])
    .where('c.id', '=', pid)
    .executeTakeFirst();

  return { program, projects };
}

export async function upsertProgramProjectAllocation(
  programId: number | string,
  projectId: number | string,
  allocatedHeadcount: number,
) {
  const db = await getKysely();
  const pid = Number(programId);
  const projId = Number(projectId);

  const existing = await db
    .selectFrom('program_project_allocations')
    .select('id')
    .where('program_id', '=', pid)
    .where('project_id', '=', projId)
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable('program_project_allocations')
      .set({ allocated_headcount: allocatedHeadcount })
      .where('id', '=', existing.id)
      .execute();
    return existing.id;
  }

  const row = await db
    .insertInto('program_project_allocations')
    .values({
      program_id: pid,
      project_id: projId,
      allocated_headcount: allocatedHeadcount,
      created_at: new Date(),
    })
    .returning('id')
    .executeTakeFirst();
  return row?.id;
}
