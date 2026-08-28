import { z } from 'zod';

export const periodExportPreviewSchema = z.object({
  project_ids: z.array(z.number().int().positive()).min(1).refine(
    (ids) => new Set(ids).size === ids.length,
    { message: 'project_ids must be unique' },
  ),
});
