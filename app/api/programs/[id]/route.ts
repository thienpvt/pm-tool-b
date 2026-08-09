import { NextRequest, NextResponse } from 'next/server';
import {
  deleteProgram,
  getProgram,
  listProgramProjects,
  updateProgram,
} from '@/lib/repositories/programs.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const program = await getProgram(id);
  if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const projects = await listProgramProjects(id);
  return NextResponse.json({ program, projects });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  return NextResponse.json(await updateProgram(id, body));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteProgram(id);
  return NextResponse.json({ ok: true });
}
