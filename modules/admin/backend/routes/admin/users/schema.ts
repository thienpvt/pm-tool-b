import { z } from 'zod';

const roleEnum = z.enum(['cpmo', 'pm', 'viewer']);
const statusEnum = z.enum(['active', 'inactive', 'locked']);

// Frozen 400 body: { error: 'Username and password required' }
export const createUserSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(8),
  display_name: z.string().optional(),
  email: z.string().email(),
  roles: z.array(roleEnum).min(1),
  status: statusEnum.optional().default('active'),
});

// Frozen 400 body: { error: 'id required' }
export const updateUserSchema = z.object({
  id: z.union([z.number(), z.string()]),
  display_name: z.string().optional(),
  email: z.string().email().optional(),
  roles: z.array(roleEnum).min(1).optional(),
  status: statusEnum.optional(),
  password: z.string().min(8).optional(),
});
