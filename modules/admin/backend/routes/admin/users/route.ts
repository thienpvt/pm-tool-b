import { NextResponse } from 'next/server';
import { createUser, deactivateUser, listUsers, updateUser } from '@/modules/admin/backend/services/users.service';
import { withCpmo } from '@/lib/http/with-role';
import { ValidationError } from '@/lib/services/errors';
import { createUserSchema, updateUserSchema } from './schema';

export const GET = withCpmo(async (req, { actor }) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? undefined;
  const status = searchParams.get('status') as 'active' | 'inactive' | 'locked' | null;
  const role = searchParams.get('role') as 'cpmo' | 'pm' | 'viewer' | null;
  const users = await listUsers(actor, {
    q,
    status: status ?? undefined,
    role: role ?? undefined,
  });
  return NextResponse.json(users);
});

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const newUser = await createUser(actor, body);
    return NextResponse.json(newUser, { status: 201 });
  },
  {
    schema: createUserSchema,
    badRequest: () =>
      NextResponse.json({ error: 'Username and password required' }, { status: 400 }),
  },
);

export const PUT = withCpmo(
  async (_req, { actor, body }) => {
    const { id, ...rest } = body;
    await updateUser(actor, id, rest);
    return NextResponse.json({ ok: true });
  },
  {
    schema: updateUserSchema,
    badRequest: () => NextResponse.json({ error: 'id required' }, { status: 400 }),
  },
);

export const DELETE = withCpmo(async (req, { actor }) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    await deactivateUser(actor, id);
  } catch (e) {
    if (e instanceof ValidationError && e.message === 'Cannot deactivate yourself') {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
});
