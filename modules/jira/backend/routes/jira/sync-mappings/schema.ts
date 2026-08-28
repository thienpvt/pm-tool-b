import { z } from 'zod';

// mappings_json may be a string OR object, same coercion-match rule as
// import-mapping/bug-import-mapping.
// Frozen 400 body: { error: 'Missing mappings_json' }
export const syncMappingSchema = z.object({
  mappings_json: z.union([z.string(), z.record(z.string(), z.unknown())]),
});
