import { getDb } from '@/lib/db';

/**
 * Per-company RAG thresholds. Returns undefined when a company has no row, and the
 * caller falls back to DEFAULT_RAG_CONFIG — the default lives in lib/rag.ts because it
 * is policy, not data.
 */
export async function companyRagConfig(companyId: number | null) {
  const db = await getDb();
  return db.get<Record<string, unknown>>('SELECT * FROM company_rag_config WHERE company_id = ?', companyId);
}
