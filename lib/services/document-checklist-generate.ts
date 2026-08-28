import { listActiveCatalogForStage } from '@/lib/repositories/document-catalog.repo';
import {
  insertChecklistRowIfMissing,
  listChecklistCatalogIds,
} from '@/lib/repositories/project-document-checklist.repo';

export async function generateProjectChecklist(
  projectId: number,
  opts: { companyId: number; stage: string | null },
): Promise<{ inserted: number }> {
  const catalogItems = await listActiveCatalogForStage(opts.companyId, opts.stage);
  const existingIds = new Set(await listChecklistCatalogIds(projectId));
  let inserted = 0;

  for (const item of catalogItems) {
    if (existingIds.has(item.id)) continue;
    const id = await insertChecklistRowIfMissing(projectId, item.id);
    if (id !== null) inserted++;
  }

  return { inserted };
}
