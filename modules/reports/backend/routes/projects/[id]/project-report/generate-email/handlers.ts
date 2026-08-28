import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { resolveAnthropicCredentials } from '@/lib/integrations/credentials';
import { createMessage } from '@/lib/integrations/anthropic/client';
import { MODEL_SONNET_4_6 } from '@/lib/integrations/anthropic/models';
import { integrationErrorResponse } from '@/lib/api-errors';
import { assertProjectWriteAccess } from '@/lib/services/access';

const SYSTEM_PROMPT = `Bạn là Project Manager cấp Senior đang soạn email báo cáo chính thức gửi Project Sponsor và Ban Lãnh đạo.

=== YÊU CẦU ĐẦU RA ===
- Dòng đầu tiên PHẢI là: "Subject: [tiêu đề email]"
- Dòng thứ hai: "---"
- Phần còn lại: nội dung email dạng HTML với inline styles

=== YÊU CẦU ĐỊNH DẠNG HTML ===
- KHÔNG bao gồm <!DOCTYPE>, <html>, <head>, <body> tags
- Tất cả styles phải là inline
- Font: font-family: Arial, Helvetica, sans-serif; line-height: 1.6;
- Heading màu: #1e40af
- Table: border-collapse:collapse; width:100%;
- Cell: border:1px solid #e2e8f0; padding:8px 12px; font-size:13px;
- RAG badge Đỏ: background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:4px; font-weight:600; font-size:12px;
- RAG badge Vàng: background:#fef9c3; color:#92400e; padding:2px 8px; border-radius:4px; font-weight:600; font-size:12px;
- RAG badge Xanh: background:#dcfce7; color:#166534; padding:2px 8px; border-radius:4px; font-weight:600; font-size:12px;
- Wrapper div: style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;color:#1e293b;font-size:14px;line-height:1.6;"

=== YÊU CẦU CHẤT LƯỢNG ===
- MỌI nhận xét PHẢI dựa trên dữ liệu thực tế — KHÔNG được bịa số liệu
- Tone: chuyên nghiệp, tự tin, khách quan
- Khuyến nghị phải cụ thể, có thể hành động được`;

export async function postProjectReportGenerateEmailHandler(
  req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  await assertProjectWriteAccess(params.id, actor);

  const creds = await resolveAnthropicCredentials();
  if (!creds) return NextResponse.json({ error: 'NO_API_KEY' }, { status: 503 });

  // WR-05: reject a malformed/oversized body with a JSON 400 instead of letting
  // req.json() reject the handler and surface a bare 500.
  let body: { reportData: Record<string, unknown>; promptInstruction: string; language: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { reportData, promptInstruction, language } = body;

  if (!reportData || !promptInstruction) {
    return NextResponse.json({ error: 'MISSING_DATA' }, { status: 400 });
  }

  const context = buildProjectContext(reportData, language);
  const langLabel = language === 'Vietnamese' ? 'Tiếng Việt' : 'English';

  try {
    const { text: raw } = await createMessage(creds, {
      model: MODEL_SONNET_4_6,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${promptInstruction}\n\nNgôn ngữ: ${langLabel}\n\n=== DỮ LIỆU DỰ ÁN ===\n${context}`,
      }],
    });

    const lines = raw.split('\n');
    let subject = `[Dự án] Báo cáo tình trạng — ${new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`;
    let emailHtml = raw;

    if (lines[0].startsWith('Subject:')) {
      subject = lines[0].replace(/^Subject:\s*/i, '').trim();
      const bodyStart = lines[1]?.trim() === '---' ? 2 : 1;
      emailHtml = lines.slice(bodyStart).join('\n').trim();
    }

    return NextResponse.json({ subject, emailHtml });
  } catch (e) {
    // Behavior change: adds a 120s SDK timeout where none existed (HYG-02)
    return integrationErrorResponse(e);
  }
}

function buildProjectContext(data: Record<string, unknown>, language: string): string {
  const lines: string[] = [];
  const project = data.project as Record<string, unknown> | undefined;
  const stats = data.stats as Record<string, number> | undefined;
  const epicStats = data.epicStats as Array<Record<string, unknown>> | undefined;
  const completedInPeriod = data.completedInPeriod as Array<Record<string, unknown>> | undefined;
  const upcomingActivities = data.upcomingActivities as Array<Record<string, unknown>> | undefined;
  const openRisks = data.openRisks as Array<Record<string, string>> | undefined;
  const openIssues = data.openIssues as Array<Record<string, string>> | undefined;
  const bugStats = data.bugStats as Record<string, unknown> | null | undefined;
  const isVN = language === 'Vietnamese';

  if (project) {
    const rag = project.rag as string;
    const ragLabel = isVN ? (rag === 'red' ? 'ĐỎ' : rag === 'amber' ? 'VÀNG' : 'XANH') : (rag === 'red' ? 'RED' : rag === 'amber' ? 'AMBER' : 'GREEN');
    lines.push(`Dự án: ${project.name}`);
    lines.push(`Khách hàng/Program: ${project.customer_name || project.program_name || 'N/A'}`);
    lines.push(`PM: ${project.pm_name || 'N/A'}`);
    lines.push(`Giai đoạn: ${project.current_phase}`);
    lines.push(`Tình trạng: ${ragLabel}`);
    const days = project.days_until_deadline as number | null;
    if (days !== null) {
      lines.push(`Deadline: ${project.end_date} (${days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : `Còn ${days} ngày`})`);
    }
    lines.push(`Kỳ báo cáo: ${data.periodStart} → ${data.periodEnd}`);
    lines.push('');
  }

  if (stats) {
    lines.push('--- KPI ---');
    lines.push(`Tổng hoạt động: ${stats.total} | Hoàn thành: ${stats.done} | Đang thực hiện: ${stats.inProgress} | Chưa bắt đầu: ${stats.notStarted}`);
    lines.push(`Tiến độ (trọng số): ${stats.completion_pct}%`);
    lines.push('');
  }

  if (epicStats?.length) {
    lines.push('--- TIẾN ĐỘ THEO EPIC/PHASE ---');
    for (const e of epicStats) {
      lines.push(`  ${e.phase}: ${e.pct}% (${e.done}/${e.total} done)`);
    }
    lines.push('');
  }

  if (completedInPeriod?.length) {
    lines.push(`--- ĐÃ HOÀN THÀNH TRONG KỲ (${completedInPeriod.length}) ---`);
    for (const a of completedInPeriod) {
      lines.push(`  • ${a.activity}${a.deliverable ? ` → ${a.deliverable}` : ''}${a.actual_end ? ` [${a.actual_end}]` : ''}`);
    }
    lines.push('');
  }

  if (upcomingActivities?.length) {
    lines.push(`--- SẮP ĐẾN HẠN (${upcomingActivities.length}) ---`);
    for (const a of upcomingActivities) {
      lines.push(`  • ${a.activity}${a.plan_end ? ` (due ${a.plan_end})` : ''}`);
    }
    lines.push('');
  }

  if (openRisks?.length) {
    lines.push(`--- RỦI RO MỞ (${openRisks.length}) ---`);
    for (const r of openRisks) {
      lines.push(`  [${r.priority}] ${r.description}${r.mitigation ? ` → ${r.mitigation}` : ''}`);
    }
    lines.push('');
  }

  if (openIssues?.length) {
    lines.push(`--- VẤN ĐỀ MỞ (${openIssues.length}) ---`);
    for (const r of openIssues) {
      lines.push(`  [${r.priority}] ${r.description}${r.mitigation ? ` → ${r.mitigation}` : ''}`);
    }
    lines.push('');
  }

  if (bugStats) {
    const bs = bugStats as { total: number; byStatus: Record<string, number> };
    lines.push(`--- BUG: ${bs.total} tổng ---`);
    Object.entries(bs.byStatus || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([st, cnt]) => {
      lines.push(`  ${st}: ${cnt}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
