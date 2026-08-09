import { getDb } from '@/lib/db';
import type { RagConfig } from '@/lib/rag';

/**
 * Per-company RAG thresholds. Returns undefined when a company has no row, and the
 * caller falls back to DEFAULT_RAG_CONFIG — the default lives in lib/rag.ts because it
 * is policy, not data.
 */
export async function companyRagConfig(companyId: number | null) {
  const db = await getDb();
  return db.get<RagConfig>(
    `SELECT spi_red_threshold, spi_amber_threshold, deadline_red_days, deadline_amber_days,
       risks_red, risks_amber, issues_amber, low_progress_amber
     FROM company_rag_config WHERE company_id = ?`,
    companyId,
  );
}

export async function setCompanyRagConfig(companyId: number, config: RagConfig): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO company_rag_config
       (company_id, spi_red_threshold, spi_amber_threshold, deadline_red_days,
        deadline_amber_days, risks_red, risks_amber, issues_amber, low_progress_amber)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (company_id) DO UPDATE SET
       spi_red_threshold = excluded.spi_red_threshold,
       spi_amber_threshold = excluded.spi_amber_threshold,
       deadline_red_days = excluded.deadline_red_days,
       deadline_amber_days = excluded.deadline_amber_days,
       risks_red = excluded.risks_red,
       risks_amber = excluded.risks_amber,
       issues_amber = excluded.issues_amber,
       low_progress_amber = excluded.low_progress_amber,
       updated_at = CURRENT_TIMESTAMP`,
    companyId, config.spi_red_threshold, config.spi_amber_threshold,
    config.deadline_red_days, config.deadline_amber_days, config.risks_red,
    config.risks_amber, config.issues_amber, config.low_progress_amber,
  );
}
