import { getKysely } from '@/lib/db/kysely';

/**
 * Every team member across projects in the caller's company (D-13, D-24).
 */
export async function listResourceMembers(companyId: number | null) {
  const db = await getKysely();

  let q = db
    .selectFrom('team_members as tm')
    .innerJoin('projects as p', 'p.id', 'tm.project_id')
    .leftJoin('customers as c', 'p.customer_id', 'c.id')
    .selectAll('tm')
    .select([
      'p.name as project_name',
      'p.id as project_id',
      'p.start_date',
      'p.end_date',
      'p.current_phase',
      'p.client',
    ]);

  if (companyId !== null) {
    q = q.where((eb) =>
      eb.or([
        eb('p.company_id', '=', companyId),
        eb('c.company_id', '=', companyId),
      ]),
    );
  } else {
    q = q
      .where('p.company_id', 'is', null)
      .where((eb) =>
        eb.or([
          eb('p.customer_id', 'is', null),
          eb('c.company_id', 'is', null),
        ]),
      );
  }

  return q.orderBy('tm.domain').orderBy('tm.name').orderBy('p.name').execute();
}
