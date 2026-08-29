import { getKysely } from '@/lib/db/kysely';

/** The public demo-request form. Fields are trimmed by the route before they arrive. */
export async function createDemoRequest(
  fullName: string,
  phone: string,
  email: string,
  companyName: string,
): Promise<number | bigint> {
  const db = await getKysely();
  const row = await db
    .insertInto('demo_requests')
    .values({
      full_name: fullName,
      phone,
      email,
      company_name: companyName,
      status: 'pending',
      notes: '',
      created_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}
