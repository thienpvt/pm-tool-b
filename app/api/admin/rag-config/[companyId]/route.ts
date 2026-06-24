import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { DEFAULT_RAG_CONFIG, RagConfig } from '@/lib/rag';

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
  const db = await getDb();
  const row = await db.get<RagConfig>(
    'SELECT spi_red_threshold, spi_amber_threshold, deadline_red_days, deadline_amber_days, risks_red, risks_amber, issues_amber, low_progress_amber FROM company_rag_config WHERE company_id = ?',
    Number(companyId),
  );
  return NextResponse.json(row ?? DEFAULT_RAG_CONFIG);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { companyId } = await params;
  const body = await req.json() as Partial<RagConfig>;

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

  const db = await getDb();
  await db.run(
    `INSERT INTO company_rag_config
       (company_id, spi_red_threshold, spi_amber_threshold, deadline_red_days, deadline_amber_days, risks_red, risks_amber, issues_amber, low_progress_amber)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (company_id) DO UPDATE SET
       spi_red_threshold    = excluded.spi_red_threshold,
       spi_amber_threshold  = excluded.spi_amber_threshold,
       deadline_red_days    = excluded.deadline_red_days,
       deadline_amber_days  = excluded.deadline_amber_days,
       risks_red            = excluded.risks_red,
       risks_amber          = excluded.risks_amber,
       issues_amber         = excluded.issues_amber,
       low_progress_amber   = excluded.low_progress_amber,
       updated_at           = CURRENT_TIMESTAMP`,
    Number(companyId),
    cfg.spi_red_threshold, cfg.spi_amber_threshold,
    cfg.deadline_red_days, cfg.deadline_amber_days,
    cfg.risks_red, cfg.risks_amber, cfg.issues_amber,
    cfg.low_progress_amber,
  );
  return NextResponse.json({ ok: true });
}
