import { NextRequest, NextResponse } from 'next/server';
import { createUser, listUsers, updateUser } from '@/lib/services/users.service';
import { withCpmo } from '@/lib/http/with-role';
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

export async function DELETE(_req: NextRequest) {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
