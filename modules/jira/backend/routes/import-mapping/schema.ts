import { z } from 'zod';

// mappings_json may be a string OR object today per
// `typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json)`
// — must stay a union, never z.string() alone, or the object-body case breaks
// (Coercion-match rule, 05-RESEARCH.md).
// Frozen 400 body: { error: 'Missing fields' }
export const createTimelineMappingSchema = z.object({
  name: z.string().min(1),
  mappings_json: z.union([z.string(), z.record(z.string(), z.unknown())]),
});
