import { z } from 'zod';

export const periodExportSchema = z.object({
  project_ids: z.array(z.number().int().positive()).min(1),
  format: z.enum(['xlsx', 'docx', 'pptx']),
});
