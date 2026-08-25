import { z } from 'zod';

// Same shape as import-mapping's schema — mappings_json may be a string OR
// object, matching `typeof mappings_json === 'string' ? ... : JSON.stringify(...)`.
// Frozen 400 body: { error: 'Missing fields' }
export const createBugMappingSchema = z.object({
  name: z.string().min(1),
  mappings_json: z.union([z.string(), z.record(z.string(), z.unknown())]),
});
