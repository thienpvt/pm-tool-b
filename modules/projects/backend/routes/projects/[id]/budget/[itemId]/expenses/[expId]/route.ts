import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { deleteExpense } from '@/modules/projects/backend/services/budget-items.service';

type Params = { id: string; itemId: string; expId: string };

export const DELETE = withProjectAccess<Params>(async (_req, { params, actor }) => {
  await deleteExpense(params.id, params.itemId, params.expId, actor);
  return NextResponse.json({ ok: true });
});
