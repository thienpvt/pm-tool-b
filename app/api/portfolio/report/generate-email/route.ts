import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { resolveAnthropicCredentials } from '@/lib/integrations/credentials';
import { createMessage } from '@/lib/integrations/anthropic/client';
import { MODEL_OPUS_4_7 } from '@/lib/integrations/anthropic/models';
import { integrationErrorResponse } from '@/lib/api-errors';

const SYSTEM_PROMPT = `Bạn là Giám đốc PMO (Project Management Office) cấp Senior với 15+ năm kinh nghiệm quản lý danh mục dự án quy mô doanh nghiệp. Bạn đang soạn email báo cáo chính thức gửi Ban Lãnh đạo cấp cao (C-level).

=== YÊU CẦU ĐẦU RA ===
- Dòng đầu tiên PHẢI là: "Subject: [tiêu đề email]"
- Dòng thứ hai: "---"
- Phần còn lại: nội dung email dạng HTML với inline styles

=== YÊU CẦU ĐỊNH DẠNG HTML ===
- KHÔNG bao gồm <!DOCTYPE>, <html>, <head>, <body> tags
- Tất cả styles phải là inline (email clients loại bỏ <style> block)
- Font: font-family: Arial, Helvetica, sans-serif; line-height: 1.6;
- Heading màu: #1e40af (xanh dương đậm)
- Table style: border-collapse:collapse; width:100%;
- Cell style: border:1px solid #e2e8f0; padding:8px 12px; font-size:13px; text-align:left;
- RAG badge Đỏ: background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:4px; font-weight:600; font-size:12px;
- RAG badge Vàng: background:#fef9c3; color:#92400e; padding:2px 8px; border-radius:4px; font-weight:600; font-size:12px;
- RAG badge Xanh: background:#dcfce7; color:#166534; padding:2px 8px; border-radius:4px; font-weight:600; font-size:12px;
- Sử dụng <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"> để ngăn cách phần
- Wrapper div: style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;color:#1e293b;font-size:14px;line-height:1.6;"

=== YÊU CẦU CHẤT LƯỢNG NỘI DUNG ===
- MỌI nhận xét, kết luận PHẢI dựa trên dữ liệu thực tế được cung cấp — KHÔNG được bịa số liệu
- Insight phải có chiều sâu: phân tích nguyên nhân, xu hướng, ý nghĩa kinh doanh
- Tone: chuyên nghiệp, tự tin, khách quan — ghi nhận thành công VÀ thẳng thắn về thách thức
- Khuyến nghị phải cụ thể, có thể hành động được, không chung chung`;

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const creds = await resolveAnthropicCredentials();
  if (!creds) return NextResponse.json({ error: 'NO_API_KEY' }, { status: 503 });

  // WR-05: reject a malformed/oversized body with a JSON 400 instead of letting
  // req.json() reject the handler and surface a bare 500.
  let body: { portfolioData: Record<string, unknown>; promptInstruction: string; language: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { portfolioData, promptInstruction, language } = body;

  if (!portfolioData || !promptInstruction) {
    return NextResponse.json({ error: 'MISSING_DATA' }, { status: 400 });
  }

  const context = buildPortfolioContext(portfolioData, language);
  const langLabel = language === 'Vietnamese' ? 'Tiếng Việt' : 'English';

  try {
    const { text: raw } = await createMessage(creds, {
      model: MODEL_OPUS_4_7,
      max_tokens: 3500,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${promptInstruction}\n\nNgôn ngữ: ${langLabel}\n\n=== DỮ LIỆU PORTFOLIO ===\n${context}`,
      }],
    });

    // Parse subject from first line
    const lines = raw.split('\n');
    let subject = `[PMO] Báo cáo Portfolio — ${new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`;
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

function buildPortfolioContext(data: Record<string, unknown>, language: string): string {
  const lines: string[] = [];
  const kpi = data.kpi as Record<string, number> | undefined;
  const programs = data.programs as Array<Record<string, unknown>> | undefined;
  const noProgramProjects = data.noProgramProjects as Array<Record<string, unknown>> | undefined;
  const topRisks = data.topRisks as Array<Record<string, string>> | undefined;
  const topIssues = data.topIssues as Array<Record<string, string>> | undefined;
  const upcomingMilestones = data.upcomingMilestones as Array<Record<string, unknown>> | undefined;
  const completedByProject = data.completedByProject as Record<string, { activities?: unknown[] }> | undefined;
  const fteStats = data.fteStats as Record<string, number | Array<Record<string, unknown>>> | null | undefined;

  lines.push(`Ngày báo cáo: ${data.reportDate || new Date().toLocaleDateString('vi-VN')}`);
  lines.push(`Kỳ báo cáo: ${data.periodStart} → ${data.periodEnd}`);
  lines.push('');

  if (kpi) {
    lines.push('--- KPI TỔNG QUAN ---');
    lines.push(`Tổng dự án: ${kpi.totalProjects} | Đang triển khai: ${kpi.activeProjects} | Hoàn thành TB: ${kpi.avgCompletion}%`);
    lines.push(`Rủi ro mở: ${kpi.totalOpenRisks} | Vấn đề mở: ${kpi.totalOpenIssues} | Số chương trình: ${kpi.totalPrograms}`);
    lines.push('');
  }

  lines.push('--- DANH MỤC DỰ ÁN THEO CHƯƠNG TRÌNH ---');
  if (programs?.length) {
    for (const prog of programs) {
      lines.push(`\nChương trình: ${prog.name} (${prog.industry})`);
      const projects = prog.projects as Array<Record<string, unknown>> | undefined;
      for (const p of projects || []) {
        const rag = p.rag === 'red' ? '🔴 ĐỎ' : p.rag === 'amber' ? '🟡 VÀNG' : '🟢 XANH';
        const days = p.days_until_deadline as number | null;
        const deadline = days === null ? 'Không có deadline'
          : days < 0 ? `Quá hạn ${Math.abs(days)} ngày`
          : `Còn ${days} ngày`;
        lines.push(`  • ${p.name} | ${rag} | Phase: ${p.current_phase} | ${p.completion_pct}% hoàn thành | ${deadline}`);
        lines.push(`    PM: ${p.pm_name} | Rủi ro: ${p.open_risks} | Vấn đề: ${p.open_issues} | Công việc: ${p.done_activities}/${p.total_activities} done`);
      }
    }
  }

  if (noProgramProjects?.length) {
    lines.push('\nDự án không thuộc chương trình:');
    for (const p of noProgramProjects) {
      const rag = p.rag === 'red' ? '🔴 ĐỎ' : p.rag === 'amber' ? '🟡 VÀNG' : '🟢 XANH';
      const days = p.days_until_deadline as number | null;
      const deadline = days === null ? 'Không có deadline' : days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : `Còn ${days} ngày`;
      lines.push(`  • ${p.name} | ${rag} | ${p.completion_pct}% | ${deadline} | PM: ${p.pm_name}`);
    }
  }

  if (topRisks?.length) {
    lines.push('\n--- RỦI RO TRỌNG YẾU ---');
    for (const r of topRisks.slice(0, 8)) {
      lines.push(`  [${r.priority}] ${r.description} — Dự án: ${r.project_name}`);
    }
  }

  if (topIssues?.length) {
    lines.push('\n--- VẤN ĐỀ ĐANG XỬ LÝ ---');
    for (const i of topIssues.slice(0, 8)) {
      lines.push(`  [${i.priority}] ${i.description} — Dự án: ${i.project_name}`);
    }
  }

  if (upcomingMilestones?.length) {
    lines.push('\n--- CỘT MỐC SẮP TỚI (30 ngày) ---');
    for (const m of upcomingMilestones.slice(0, 10)) {
      lines.push(`  • ${m.activity} | Dự án: ${m.project_name} | Deadline: ${m.plan_end}`);
    }
  }

  if (completedByProject && Object.keys(completedByProject).length) {
    lines.push('\n--- ĐÃ HOÀN THÀNH TRONG KỲ BÁO CÁO ---');
    for (const [projName, group] of Object.entries(completedByProject)) {
      lines.push(`  ${projName}: ${group.activities?.length ?? 0} công việc hoàn thành`);
    }
  }

  if (fteStats) {
    const f = fteStats as Record<string, number | Array<Record<string, unknown>>>;
    lines.push('\n--- NGUỒN LỰC & FTE ---');
    const deliveryFte = f.deliveryFte as number;
    const overheadFte = ((f.overheadProjectFte as number) + (f.overheadRemainingFte as number));
    const benchFte = f.benchFte as number;
    lines.push(`Định biên: ${f.headcountQuota} người | Delivery: ${deliveryFte?.toFixed(1)} FTE | Overhead: ${overheadFte?.toFixed(1)} FTE | Bench: ${benchFte?.toFixed(1)} FTE`);
    lines.push(`Fill rate khối: ${(f.blockFillRate as number)?.toFixed(0)}% | Cần tuyển thêm: ${f.peopleNeeded} người`);
    const rates = f.programFillRates as Array<Record<string, unknown>> | undefined;
    if (rates?.length) {
      lines.push('Fill rate theo chương trình:');
      for (const r of rates) {
        lines.push(`  ${r.programName}: ${(r.fillRate as number)?.toFixed(0)}% (${(r.actual as number)?.toFixed(1)}/${r.allocated} FTE)`);
      }
    }
  }

  return lines.join('\n');
}
