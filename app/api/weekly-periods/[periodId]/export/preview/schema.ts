import { z } from 'zod';

export const periodExportPreviewSchema = z.object({
  project_ids: z.array(z.number().int().positive()).min(1),
});
