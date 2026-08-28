import { DEFAULT_RAG_CONFIG, type RagConfig } from '@/lib/rag';
import {
  companyRagConfig,
  setCompanyRagConfig,
} from '@/modules/admin/backend/repositories/rag-config.repo';

export async function getCompanyRagConfigOrDefault(companyId: number): Promise<RagConfig> {
  const row = await companyRagConfig(companyId);
  return row ?? DEFAULT_RAG_CONFIG;
}

export async function setCompanyRagConfigValues(companyId: number, cfg: RagConfig): Promise<void> {
  await setCompanyRagConfig(companyId, cfg);
}
