import { getDb } from '@/lib/db';

/**
 * Portfolio-level reads and writes.
 *
 * These routes are company-scoped rather than project-scoped, so every function takes
 * `companyId` explicitly (REPO-02). Where the current SQL branches on admin, the
 * resolved `isAdmin` boolean is passed in — the repository never reads a session.
 */

export type PortfolioMember = {
  id: number;
  role: string;
  name: string;
  email: string;
  note: string;
  member_type: string;
};

/** All portfolio members for a company, internal and external together. */
export async function listPortfolioMembers(companyId: number | null) {
  const db = await getDb();
  return db.all<PortfolioMember>(
    'SELECT * FROM portfolio_members WHERE company_id = ? ORDER BY member_type, name',
    companyId,
  );
}

/** Company name plus headcount quota, the pair the members export and quota panel need. */
export async function companyNameAndQuota(companyId: number | null) {
  const db = await getDb();
  return db.get<{ name: string; headcount_quota: number }>(
    'SELECT name, headcount_quota FROM companies WHERE id = ?',
    companyId,
  );
}
