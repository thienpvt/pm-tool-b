import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import { parsePositiveIntRouteParam } from '@/lib/http/parse-route-param';
import { DEFAULT_RAG_CONFIG, RagConfig } from '@/lib/rag';
import {
  getCompanyRagConfigOrDefault,
  setCompanyRagConfigValues,
} from '@/lib/services/rag-config.service';
import { ragConfigSchema } from './schema';

type Params = { params: Promise<{ companyId: string }> };

async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return { err: unauthorized(), user: null };
  if (!user.is_admin) return { err: forbidden(), user: null };
  return { err: null, user };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { companyId } = await params;
  const companyIdNum = parsePositiveIntRouteParam(companyId);
  if (companyIdNum === null) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
  }
  const row = await getCompanyRagConfigOrDefault(companyIdNum);
  return NextResponse.json(row);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { companyId } = await params;
  const companyIdNum = parsePositiveIntRouteParam(companyId);
  if (companyIdNum === null) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
  }
  const json = await parseRequestJson(req);
  if (!json.ok) return json.response;
  const raw = json.data;
  // Passthrough shape guard only — see schema.ts for why coercion stays here.
  const parsed = ragConfigSchema.safeParse(raw);
  const body = (parsed.success ? parsed.data : raw) as Partial<RagConfig>;

  const cfg: RagConfig = {
    spi_red_threshold:   Number(body.spi_red_threshold   ?? DEFAULT_RAG_CONFIG.spi_red_threshold),
    spi_amber_threshold: Number(body.spi_amber_threshold ?? DEFAULT_RAG_CONFIG.spi_amber_threshold),
    deadline_red_days:   Number(body.deadline_red_days   ?? DEFAULT_RAG_CONFIG.deadline_red_days),
    deadline_amber_days: Number(body.deadline_amber_days ?? DEFAULT_RAG_CONFIG.deadline_amber_days),
    risks_red:           Number(body.risks_red           ?? DEFAULT_RAG_CONFIG.risks_red),
    risks_amber:         Number(body.risks_amber         ?? DEFAULT_RAG_CONFIG.risks_amber),
    issues_amber:        Number(body.issues_amber        ?? DEFAULT_RAG_CONFIG.issues_amber),
    low_progress_amber:  Number(body.low_progress_amber  ?? DEFAULT_RAG_CONFIG.low_progress_amber),
  };

  if (Object.values(cfg).some((v) => Number.isNaN(v))) {
    return NextResponse.json({ error: 'Invalid threshold values' }, { status: 400 });
  }

  await setCompanyRagConfigValues(companyIdNum, cfg);
  return NextResponse.json({ ok: true });
}
