import { getDb } from '@/lib/db';

/** The public demo-request form. Fields are trimmed by the route before they arrive. */
export async function createDemoRequest(
  fullName: string,
  phone: string,
  email: string,
  companyName: string,
): Promise<number | bigint> {
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO demo_requests (full_name, phone, email, company_name) VALUES (?, ?, ?, ?)',
    fullName, phone, email, companyName,
  );
  return r.lastInsertRowid;
}
