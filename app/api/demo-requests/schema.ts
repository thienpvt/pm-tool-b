import { z } from 'zod';

// Frozen 400 body: { error: 'All fields are required' } — the SAME message on
// every field means parsed.error.issues[0].message is this literal regardless
// of which field(s) failed, matching today's single combined check exactly.
export const demoRequestSchema = z.object({
  full_name: z.string().trim().min(1, 'All fields are required'),
  phone: z.string().trim().min(1, 'All fields are required'),
  email: z.string().trim().min(1, 'All fields are required'),
  company_name: z.string().trim().min(1, 'All fields are required'),
});
