import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';
import type { RagConfig } from '@/lib/rag';

/**
 * Per-company RAG thresholds. Returns undefined when a company has no row, and the
 * caller falls back to DEFAULT_RAG_CONFIG — the default lives in lib/rag.ts because it
 * is policy, not data.
 */
export async function companyRagConfig(companyId: number | null) {
  const db = await getKysely();
  if (companyId === null) return undefined;
  return db
    .selectFrom('company_rag_config')
    .select([
      'spi_red_threshold',
      'spi_amber_threshold',
      'deadline_red_days',
      'deadline_amber_days',
      'risks_red',
      'risks_amber',
      'issues_amber',
      'low_progress_amber',
    ])
    .where('company_id', '=', companyId)
    .executeTakeFirst();
}

export async function setCompanyRagConfig(companyId: number, config: RagConfig): Promise<void> {
  const db = await getKysely();
  await db
    .insertInto('company_rag_config')
    .values({
      company_id: companyId,
      spi_red_threshold: config.spi_red_threshold,
      spi_amber_threshold: config.spi_amber_threshold,
      deadline_red_days: config.deadline_red_days,
      deadline_amber_days: config.deadline_amber_days,
      risks_red: config.risks_red,
      risks_amber: config.risks_amber,
      issues_amber: config.issues_amber,
      low_progress_amber: config.low_progress_amber,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column('company_id').doUpdateSet({
        spi_red_threshold: (eb) => eb.ref('excluded.spi_red_threshold'),
        spi_amber_threshold: (eb) => eb.ref('excluded.spi_amber_threshold'),
        deadline_red_days: (eb) => eb.ref('excluded.deadline_red_days'),
        deadline_amber_days: (eb) => eb.ref('excluded.deadline_amber_days'),
        risks_red: (eb) => eb.ref('excluded.risks_red'),
        risks_amber: (eb) => eb.ref('excluded.risks_amber'),
        issues_amber: (eb) => eb.ref('excluded.issues_amber'),
        low_progress_amber: (eb) => eb.ref('excluded.low_progress_amber'),
        updated_at: sql`CURRENT_TIMESTAMP`,
      }),
    )
    .execute();
}
