import { z } from 'zod';

// Frozen 400 body: { error: 'Name required' } — the message is the same
// literal string used in the route's manual branch, not Zod's default message.
export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Name required'),
});

// Frozen 400 body: { error: 'id and name required' }
export const updateCompanySchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string().trim().min(1, 'id and name required'),
});
