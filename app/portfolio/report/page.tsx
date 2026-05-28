'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Sparkles, Eye, Copy, Download, Mail, KeyRound, RefreshCw,
  TrendingUp, FileText, ShieldAlert, Bug, CheckCircle2, AlertCircle,
  Calendar, ChevronRight, User, Building2, CalendarRange, Loader2, Image, FileDown, Filter, ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskItem = {
  id: number; description: string; priority: string; category: string;
  mitigation: string; owner: string; project_name: string; program_name: string;
};
type MilestoneItem = {
  id: number; activity: string; deliverable: string; plan_end: string;
  completion_pct: number; project_name: string; program_name: string;
};
type RecentDone = {
  id: number; activity: string; deliverable: string; actual_end: string;
  project_name: string; program_name: string;
};
type CompletedActivity = { id: number; activity: string; deliverable: string; actual_end: string; };
type CompletedGroup = { project_name: string; program_name: string; current_phase: string; activities: CompletedActivity[]; };
type EpicStat = { phase: string; total: number; done: number; pct: number; start_date?: string | null; end_date?: string | null; };
type ProjectRow = {
  id: number; name: string; program_name: string; client: string; pm_name: string;
  current_phase: string; completion_pct: number; open_risks: number; open_issues: number;
  days_until_deadline: number | null; rag: 'red' | 'amber' | 'green';
  total_activities: number; done_activities: number;
  in_progress_activities: number; not_started_activities: number;
  epicStats: EpicStat[];
};
type ProgramGroup = { id: number; name: string; industry: string; projects: ProjectRow[]; };
type PersonnelStats = {
  totalInternal: number;
  totalAllocated: number;
  projectAllocations: { projectName: string; memberCount: number }[];
  overallocated: { name: string; role: string; projects: string[] }[];
};
type FteProgramRate = { programName: string; allocated: number; actual: number; fillRate: number; };
type FteStats = {
  headcountQuota: number;
  deliveryFte: number;
  overheadProjectFte: number;
  overheadRemainingFte: number;
  benchFte: number;
  utilizationPct: number;
  blockFillRate: number;
  programFillRates: FteProgramRate[];
  peopleNeeded: number;
  currentMonth: string;
};
type PortfolioReportData = {
  projects: ProjectRow[];
  programs: ProgramGroup[];
  noProgramProjects: ProjectRow[];
  kpi: {
    totalProjects: number; totalPrograms: number; avgCompletion: number;
    activeProjects: number; totalOpenRisks: number; totalOpenIssues: number;
  };
  topRisks: RiskItem[];
  topIssues: RiskItem[];
  upcomingMilestones: MilestoneItem[];
  recentlyCompleted: RecentDone[];
  completedByProject: Record<string, CompletedGroup>;
  personnelStats: PersonnelStats;
  fteStats?: FteStats | null;
  periodStart: string;
  periodEnd: string;
  reportDate: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDeadline(days: number | null, isVN: boolean): string {
  if (days === null) return '—';
  if (days < 0) return isVN ? `Quá hạn ${Math.abs(days)}d` : `Overdue ${Math.abs(days)}d`;
  if (days === 0) return isVN ? 'Hôm nay' : 'Today';
  return isVN ? `Còn ${days}d` : `${days}d left`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return s; }
}

function priorityColor(p: string): string {
  if (p === 'Critical') return 'text-red-600 bg-red-50 border-red-200';
  if (p === 'High') return 'text-orange-600 bg-orange-50 border-orange-200';
  if (p === 'Medium') return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-slate-500 bg-slate-50 border-slate-200';
}

const RAG_DOT: Record<string, string> = { red: 'bg-red-500', amber: 'bg-amber-400', green: 'bg-green-500' };
const RAG_ROW: Record<string, string> = { red: 'bg-red-50/40', amber: 'bg-amber-50/30', green: '' };

const PHASE_COLOR: Record<string, string> = {
  Initiation: 'bg-purple-100 text-purple-700 border-purple-200',
  Planning: 'bg-blue-100 text-blue-700 border-blue-200',
  Execution: 'bg-amber-100 text-amber-700 border-amber-200',
  Closing: 'bg-green-100 text-green-700 border-green-200',
};

function progressColor(pct: number): string {
  if (pct >= 70) return 'bg-green-500';
  if (pct >= 40) return 'bg-blue-500';
  if (pct >= 20) return 'bg-amber-400';
  return 'bg-red-400';
}

function deadlineColor(days: number | null): string {
  if (days === null) return 'text-slate-400';
  if (days < 0) return 'text-red-600 font-semibold';
  if (days <= 7) return 'text-red-500 font-medium';
  if (days <= 14) return 'text-amber-600 font-medium';
  return 'text-slate-600';
}

// ─── Summary Templates (rotates weekly) ──────────────────────────────────────
const SUMMARY_TEMPLATES = {
  vn: {
    green: [
      'Danh mục Squad/Dự án kỳ này ghi nhận kết quả tích cực trên toàn bộ chương trình. Tiến độ triển khai được duy trì ổn định và các mốc kế hoạch đang được thực hiện đúng cam kết. Không có rủi ro leo thang nào phát sinh trong kỳ báo cáo này.',
      'Tình hình triển khai danh mục kỳ này diễn ra thuận lợi theo đúng kế hoạch. Các chương trình đang được vận hành hiệu quả với sự phối hợp chặt chẽ giữa các đội dự án. Không có vấn đề nghiêm trọng nào cần leo thang trong kỳ này.',
      'Nhìn tổng thể kỳ báo cáo này, danh mục đang vận hành đúng quỹ đạo với kết quả đáng ghi nhận từ các chương trình. Toàn bộ Squad/Dự án duy trì trạng thái xanh, phản ánh sự chuẩn bị kỹ lưỡng và quản lý chủ động của các đội. Không có hành động leo thang nào được yêu cầu trong kỳ này.',
      'Kỳ báo cáo ghi nhận hiệu suất tốt của toàn bộ danh mục. Các chương trình tiếp tục duy trì tiến độ và chất lượng theo đúng cam kết. Các đội dự án đã chủ động xử lý những phát sinh trước khi leo thang, góp phần duy trì trạng thái ổn định của danh mục trong kỳ này.',
      'Danh mục kỳ này thể hiện sức khỏe vận hành tốt với tình trạng ổn định trên toàn bộ các chương trình. Các đội dự án đang làm việc có kỷ luật và bám sát kế hoạch đề ra. Không có điểm nghẽn hay rủi ro leo thang nào cần sự chú ý đặc biệt trong kỳ báo cáo này.',
    ],
    amber: [
      'Danh mục kỳ này đang tiến triển theo đúng hướng với phần lớn chương trình duy trì ổn định. Tuy nhiên, một số Squad/Dự án đang gặp phải các yếu tố cần được theo dõi sát sao hơn trong kỳ tới. Không có leo thang khẩn cấp được yêu cầu, song tình hình cần tiếp tục được giám sát chặt chẽ.',
      'Nhìn chung, danh mục đang trong trạng thái kiểm soát được mặc dù còn một số điểm cần chú ý. Phần lớn các chương trình đang thực hiện đúng tiến độ, trong khi một số Squad/Dự án đang đối mặt với áp lực thực thi cần được theo dõi thêm. Không có leo thang khẩn cấp trong kỳ này, và dự kiến tình trạng sẽ được cải thiện trong kỳ tới.',
      'Kỳ báo cáo này phản ánh giai đoạn chuyển tiếp của một số Squad/Dự án trong danh mục với áp lực thực thi tăng lên. Đây là tín hiệu bình thường trong quá trình triển khai, tuy nhiên cần tiếp tục theo dõi để đảm bảo không có vấn đề nào vượt tầm kiểm soát. Các biện pháp phòng ngừa đang được triển khai.',
      'Danh mục kỳ này cho thấy sự vận hành ổn định ở phần lớn các chương trình, đồng thời cũng phản ánh một số thách thức đang phát sinh cần được quản lý chủ động. Nguyên nhân đã được làm rõ ở từng Squad/Dự án và phương án xử lý đang trong quá trình triển khai. Không có rủi ro ở mức độ yêu cầu can thiệp ngay trong kỳ này.',
      'Tổng thể, danh mục vẫn đang trong tầm kiểm soát với phần lớn Squad/Dự án tiếp tục thực hiện đúng cam kết. Một số tình huống đang phát sinh cần được theo dõi kỹ lưỡng trong kỳ tới để ngăn ngừa leo thang. Không có quyết định cấp cao nào được yêu cầu tại thời điểm này.',
    ],
    red: [
      'Danh mục kỳ này đang đối mặt với một số thách thức nghiêm trọng cần được ưu tiên xử lý. Một số Squad/Dự án đang ở mức độ rủi ro cao với nguy cơ ảnh hưởng đến tiến độ và cam kết với khách hàng. Các quyết định và hành động can thiệp cần được thực hiện kịp thời. Chi tiết được trình bày tại Mục VII.',
      'Kỳ báo cáo này ghi nhận áp lực vận hành ở mức độ đáng kể đối với một số Squad/Dự án trong danh mục. Tình trạng hiện tại đòi hỏi sự chú ý ở cấp cao nhất để đảm bảo không ảnh hưởng lâu dài đến toàn bộ danh mục. Các điểm cần quyết định và phê duyệt được nêu rõ tại Mục VII.',
      'Tình hình danh mục kỳ này đòi hỏi sự chú ý đặc biệt và hành động quyết đoán. Một số Squad/Dự án đang gặp khó khăn ở nhiều cấp độ khác nhau, và nếu không được xử lý kịp thời có thể ảnh hưởng đến cam kết tổng thể của danh mục. Nội dung cụ thể về các điểm leo thang được trình bày tại Mục VII.',
      'Danh mục đang trải qua một giai đoạn thách thức với các vấn đề phát sinh ở nhiều cấp độ. Những vấn đề này cần được giải quyết triệt để và kịp thời để tránh ảnh hưởng dây chuyền lên các chương trình liên quan. Các hành động cụ thể cần phê duyệt và chỉ đạo được trình bày chi tiết tại Mục VII.',
      'Kỳ này ghi nhận những tín hiệu cần được xử lý ngay để tránh ảnh hưởng lâu dài đến tiến độ và cam kết với khách hàng. Một số điểm nghẽn trong danh mục đang cần được khơi thông thông qua điều chỉnh nguồn lực và ưu tiên. Chi tiết và đề xuất xử lý được trình bày tại Mục VII.',
    ],
  },
  en: {
    green: [
      'The portfolio reports a strong performance this period across all programs. Delivery milestones are being met as committed and project health indicators remain positive. No escalations were required during this reporting cycle.',
      'This reporting period reflects a stable and well-managed portfolio across the board. Programs are executing effectively with strong cross-team coordination and disciplined delivery. No material risks or issues requiring leadership attention have emerged at this time.',
      'The portfolio enters this reporting period in good health with all tracked programs performing within plan. Project teams have demonstrated proactive risk management, keeping issues resolved at the delivery level without escalation. This reflects strong execution discipline across the organization.',
      'Overall portfolio performance for this period is positive and in line with expectations. Delivery teams are operating with discipline and purpose, maintaining commitments on both schedule and quality. No significant risks or blockers requiring leadership intervention have been identified this period.',
      'A clean reporting period: all programs are advancing as planned and the portfolio health picture remains strong. No escalations are required, and the overall delivery outlook for the coming period is encouraging.',
    ],
    amber: [
      'The portfolio is broadly on track this period, with the majority of programs performing as planned. A number of projects have entered a closer-monitoring phase due to emerging schedule or risk pressures. No escalations are required at this time, though continued attention will be needed in the coming cycle.',
      'This period reflects a mixed but manageable portfolio picture. While most programs continue to execute well, a subset of projects is experiencing increased delivery pressure that warrants heightened attention. No critical escalations are required, and the situation is expected to improve in the near term.',
      'The portfolio is navigating a transition phase this period, with some projects facing elevated delivery pressure. This reflects normal execution dynamics at this stage, though continued monitoring is needed to ensure these situations do not escalate further. Preventive measures are in place at the project level.',
      'Portfolio performance this period is stable across most programs, though a number of situations are developing that require active management. Root causes have been identified at the project level and mitigation plans are being executed. No urgent leadership decisions are required in this cycle.',
      'While the overall portfolio remains under control, this reporting period surfaces a number of situations that merit focused attention in the weeks ahead. No escalations to leadership are needed at this time, though the coming period will be important for determining whether these situations can be resolved without further intervention.',
    ],
    red: [
      'The portfolio faces material challenges this period that require priority attention at the leadership level. A number of projects are at elevated risk with potential impact on delivery timelines and client commitments. Key decisions and interventions are needed in a timely manner — details are presented in Section VII.',
      'This reporting period reflects significant delivery pressure across parts of the portfolio that must be addressed urgently. The current situation requires senior-level attention to ensure that risks do not compound further across the program portfolio. Specific items requiring decision and approval are outlined in Section VII.',
      'The portfolio status this period signals the need for decisive and coordinated action. Several projects are encountering difficulties at multiple levels, and without timely intervention, the cumulative impact on overall portfolio commitments could be significant. Escalation details are presented in Section VII.',
      'The portfolio is going through a challenging period, with issues surfacing across multiple dimensions. These need to be addressed thoroughly and promptly to prevent cascading impact on related programs. Specific actions requiring approval and direction are detailed in Section VII.',
      'This period records signals that require immediate attention to prevent long-term impact on delivery commitments. Several bottlenecks need to be unblocked through resource and priority adjustments. Full details and recommendations are presented in Section VII.',
    ],
  },
};

function pickSummary(status: 'red' | 'amber' | 'green', lang: 'vn' | 'en'): string {
  const pool = SUMMARY_TEMPLATES[lang][status];
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  return pool[week % pool.length];
}

// ─── Build Template Report ────────────────────────────────────────────────────
function buildTemplateReport(data: PortfolioReportData, language: string, periodStart: string, periodEnd: string, companyName = ''): string {
  const isVN = language === 'Vietnamese';
  const today = new Date().toLocaleDateString(isVN ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');

  const allProjects = [...data.programs.flatMap(c => c.projects), ...data.noProgramProjects];
  const red = allProjects.filter(p => p.rag === 'red');
  const amber = allProjects.filter(p => p.rag === 'amber');
  const green = allProjects.filter(p => p.rag === 'green');
  const overdue = allProjects.filter(p => p.days_until_deadline !== null && p.days_until_deadline < 0);
  const sorted = [...allProjects].sort((a, b) => ({ red: 0, amber: 1, green: 2 } as Record<string,number>)[a.rag] - ({ red: 0, amber: 1, green: 2 } as Record<string,number>)[b.rag]);

  const portfolioStatus = isVN
    ? (red.length > 0 ? 'ĐỎ' : amber.length > 0 ? 'VÀNG' : 'XANH')
    : (red.length > 0 ? 'RED' : amber.length > 0 ? 'AMBER' : 'GREEN');

  // Text helpers
  const rp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s).padEnd(n);
  const lp = (s: string | number, n: number) => String(s).padStart(n);

  // Health matrix table — column widths
  const W = { n: 3, st: 10, nm: 22, cu: 15, ph: 10, pc: 5, dl: 14 } as const;
  const tHL = (l: string, m: string, r: string) =>
    `  ${l}${'─'.repeat(W.n+2)}${m}${'─'.repeat(W.st+2)}${m}${'─'.repeat(W.nm+2)}${m}${'─'.repeat(W.cu+2)}${m}${'─'.repeat(W.ph+2)}${m}${'─'.repeat(W.pc+2)}${m}${'─'.repeat(W.dl+2)}${r}`;
  const tRow = (n: string|number, st: string, nm: string, cu: string, ph: string, pc: string, dl: string) =>
    `  │ ${lp(n, W.n)} │ ${rp(st, W.st)} │ ${rp(nm, W.nm)} │ ${rp(cu, W.cu)} │ ${rp(ph, W.ph)} │ ${lp(pc, W.pc)} │ ${rp(dl, W.dl)} │`;

  // Program scorecard table — column widths
  const CS = { nm: 22, pr: 6, ac: 6, pct: 6, hl: 10, rk: 6, is: 6 } as const;
  const csHL = (l: string, m: string, r: string) =>
    `  ${l}${'─'.repeat(CS.nm+2)}${m}${'─'.repeat(CS.pr+2)}${m}${'─'.repeat(CS.ac+2)}${m}${'─'.repeat(CS.pct+2)}${m}${'─'.repeat(CS.hl+2)}${m}${'─'.repeat(CS.rk+2)}${m}${'─'.repeat(CS.is+2)}${r}`;
  const csRow = (nm: string, pr: string, ac: string, pct: string, hl: string, rk: string, is: string) =>
    `  │ ${rp(nm, CS.nm)} │ ${lp(pr, CS.pr)} │ ${lp(ac, CS.ac)} │ ${lp(pct, CS.pct)} │ ${rp(hl, CS.hl)} │ ${lp(rk, CS.rk)} │ ${lp(is, CS.is)} │`;

  // Milestone table — column widths
  const ML = { dt: 11, ms: 32, pj: 22, pc: 5 } as const;
  const mlHL = (l: string, m: string, r: string) =>
    `  ${l}${'─'.repeat(ML.dt+2)}${m}${'─'.repeat(ML.ms+2)}${m}${'─'.repeat(ML.pj+2)}${m}${'─'.repeat(ML.pc+2)}${r}`;
  const mlRow = (dt: string, ms: string, pj: string, pc: string) =>
    `  │ ${rp(dt, ML.dt)} │ ${rp(ms, ML.ms)} │ ${rp(pj, ML.pj)} │ ${lp(pc, ML.pc)} │`;

  const lines: string[] = [];
  const D = '  ' + '━'.repeat(94);
  const box1 = '  ╔' + '═'.repeat(92) + '╗';
  const box2 = '  ╚' + '═'.repeat(92) + '╝';
  const boxL = (s: string) => { const p = 92 - s.length; return `  ║${' '.repeat(Math.floor(p/2))}${s}${' '.repeat(p - Math.floor(p/2))}║`; };
  const sboxL = (s: string) => `  │ ${s}${' '.repeat(Math.max(0, 90 - s.length))} │`;
  const sbox1 = `  ┌${'─'.repeat(92)}┐`;
  const sbox2 = `  └${'─'.repeat(92)}┘`;

  if (isVN) {
    // ── Header ───────────────────────────────────────────────────────────────
    lines.push(box1);
    lines.push(boxL('BÁO CÁO TÌNH TRẠNG PORTFOLIO'));
    lines.push(boxL('Program Management Office (PMO)'));
    lines.push(box2);
    lines.push('');
    lines.push(`  Ngày báo cáo   : ${today}              Mã tham chiếu : PMO-${yyyymm}-001`);
    lines.push(`  Kỳ báo cáo    : ${periodStart} → ${periodEnd}`);
    lines.push(`  Phân loại      : Bảo mật — Chỉ dành cho nội bộ`);
    lines.push(`  Phân phối      : CEO, Steering Committee, Portfolio Manager`);
    lines.push('');

    // ── Summary Statement ────────────────────────────────────────────────────
    {
      const ragKey = red.length > 0 ? 'red' : amber.length > 0 ? 'amber' : 'green';
      const summaryText = pickSummary(ragKey, 'vn');
      // Word-wrap at 88 chars per line to fit inside sboxL (90-char inner width)
      const words = summaryText.split(' ');
      const wrappedLines: string[] = [];
      let cur = '';
      for (const w of words) {
        if ((cur ? cur + ' ' + w : w).length > 88) { wrappedLines.push(cur); cur = w; }
        else cur = cur ? cur + ' ' + w : w;
      }
      if (cur) wrappedLines.push(cur);
      lines.push(sbox1);
      lines.push(sboxL('TÓM TẮT'));
      lines.push(sboxL(''));
      wrappedLines.forEach(l => lines.push(sboxL(l)));
      lines.push(sbox2);
      lines.push('');
    }

    // ── I. Executive Summary ─────────────────────────────────────────────────
    lines.push(D);
    lines.push('  I.  TÓM TẮT ĐIỀU HÀNH');
    lines.push(D);
    lines.push('');
    lines.push(`  Trạng thái tổng thể portfolio: ● ${portfolioStatus}`);
    lines.push('');
    const summaryVN = red.length > 0
      ? `Portfolio hiện có ${red.length} Squad/Dự án ở mức ĐỎ cần xử lý khẩn cấp.`
      : amber.length > 0 ? `Portfolio ở mức VÀNG với ${amber.length} Squad/Dự án cần theo dõi sát sao.`
        : 'Portfolio đang ở trạng thái tốt — toàn bộ Squad/Dự án đều xanh.';
    lines.push(`  ${summaryVN} Tổng cộng ${data.kpi.totalProjects} Squad/Dự án trên ${data.kpi.totalPrograms} chương trình,`);
    lines.push(`  tiến độ trung bình ${data.kpi.avgCompletion}% (tính theo trọng số trạng thái).`);
    lines.push(`  Phân bố sức khỏe: ${green.length} XANH  ·  ${amber.length} VÀNG  ·  ${red.length} ĐỎ.`);
    if (overdue.length > 0) lines.push(`\n  [!] CẢNH BÁO: ${overdue.length} Squad/Dự án đã vượt hạn chót — cần hành động ngay lập tức.`);
    if (data.kpi.totalOpenRisks === 0 && data.kpi.totalOpenIssues === 0) lines.push('  [+] Tích cực: Hiện không có rủi ro hoặc vấn đề nào đang mở ở cấp portfolio.');
    lines.push('');
    lines.push('  CHỈ SỐ CHÍNH:');
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push(`  Squad/Dự án tổng cộng  : ${data.kpi.totalProjects}      Đang hoạt động   : ${data.kpi.activeProjects}`);
    lines.push(`  Tiến độ TB (trọng số)  : ${data.kpi.avgCompletion}%    Chương trình      : ${data.kpi.totalPrograms}`);
    lines.push(`  Rủi ro đang mở         : ${data.kpi.totalOpenRisks}      Vấn đề đang mở   : ${data.kpi.totalOpenIssues}`);
    lines.push(`  Squad/Dự án quá hạn    : ${overdue.length}`);
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push('');
    if (data.fteStats) {
      const fs = data.fteStats;
      const usedFte = fs.deliveryFte + fs.overheadProjectFte + fs.overheadRemainingFte;
      lines.push('  NHÂN SỰ & NGUỒN LỰC KHỐI:');
      lines.push(`  ${'─'.repeat(50)}`);
      lines.push(`  Định biên                : ${fs.headcountQuota > 0 ? fs.headcountQuota + ' người' : 'chưa thiết lập'}`);
      lines.push(`  FTE khả dụng net         : ${usedFte.toFixed(1)} FTE      Utilization: ${fs.headcountQuota > 0 ? fs.utilizationPct + '%' : '—'}`);
      lines.push(`  Fill rate khối           : ${fs.programFillRates.length > 0 ? fs.blockFillRate + '%' : '—'}           Cần tuyển  : ${fs.peopleNeeded} người`);
      lines.push(`  ${'─'.repeat(50)}`);
      lines.push('');
    }

    // ── II. Portfolio Health Matrix ──────────────────────────────────────────
    lines.push(D);
    lines.push('  II. MA TRẬN SỨC KHỎE PORTFOLIO');
    lines.push(D);
    lines.push('');
    lines.push(tHL('┌', '┬', '┐'));
    lines.push(tRow('#', 'TRẠNG THÁI', 'SQUAD/DỰ ÁN', 'CHƯƠNG TRÌNH', 'PHASE', '%', 'DEADLINE'));
    lines.push(tHL('├', '┼', '┤'));
    sorted.forEach((p, i) => {
      const stLabel = p.rag === 'red' ? '● ĐỎ' : p.rag === 'amber' ? '● VÀNG' : '● XANH';
      const dl = p.days_until_deadline;
      const dlStr = dl === null ? '—' : dl < 0 ? `QUÁ HẠN ${Math.abs(dl)}d` : `${dl}d còn`;
      lines.push(tRow(String(i + 1), stLabel, p.name, p.program_name || '—', p.current_phase, String(p.completion_pct) + '%', dlStr));
    });
    lines.push(tHL('└', '┴', '┘'));
    lines.push('');
    lines.push(`  Tổng kết:  ${green.length} XANH   ·   ${amber.length} VÀNG   ·   ${red.length} ĐỎ`);
    lines.push('');

    // Per-project US progress details
    if (allProjects.some(p => p.total_activities > 0)) {
      lines.push('  CHI TIẾT TIẾN ĐỘ USER STORY / ACTIVITY:');
      lines.push(`  ${'─'.repeat(80)}`);
      sorted.forEach((p, i) => {
        if (p.total_activities === 0) return;
        lines.push(`  ${String(i+1).padStart(2)}. ${p.name}${p.program_name ? ` (${p.program_name})` : ''} — ${p.current_phase}`);
        lines.push(`      Tiến độ (TT): ${String(p.completion_pct).padStart(3)}%   |   Hoàn thành: ${p.done_activities}   Đang thực hiện: ${p.in_progress_activities}   Chưa bắt đầu: ${p.not_started_activities}   Tổng: ${p.total_activities} US`);
        if (p.epicStats && p.epicStats.length > 0) {
          p.epicStats.forEach(e => {
            const bar = '█'.repeat(Math.round(e.pct / 10)) + '░'.repeat(10 - Math.round(e.pct / 10));
            const sd = e.start_date ?? 'N/A';
            const ed = e.end_date ?? 'N/A';
            lines.push(`      ▸ ${rp(e.phase, 20)}  [${bar}]  ${String(e.pct).padStart(3)}%  (${String(e.done).padStart(2)}/${String(e.total).padStart(2)} US)  ${sd} → ${ed}`);
          });
        }
        if (i < sorted.length - 1) lines.push('');
      });
      lines.push('');
    }

    // ── III. Completed in Period ──────────────────────────────────────────────
    lines.push(D);
    lines.push('  III. TIẾN ĐỘ THEO KỲ — HOÀN THÀNH TRONG GIAI ĐOẠN');
    lines.push(D);
    lines.push(`  Kỳ báo cáo: ${periodStart} → ${periodEnd}`);
    lines.push('');
    const completedGroups = Object.values(data.completedByProject);
    if (completedGroups.length === 0) {
      lines.push('  Không có hoạt động nào hoàn thành trong giai đoạn này trên toàn portfolio.');
    } else {
      completedGroups.forEach((g, i) => {
        lines.push(`  ${String(i+1).padStart(2)}. ${g.project_name}${g.program_name ? ` (${g.program_name})` : ''} — ${g.current_phase}`);
        g.activities.forEach(a => {
          lines.push(`      [+]  ${a.activity}${a.deliverable ? `  →  ${a.deliverable}` : ''}${a.actual_end ? `  [${a.actual_end}]` : ''}`);
        });
        if (i < completedGroups.length - 1) lines.push('');
      });
    }
    lines.push('');

    // ── IV. Risks & Issues ───────────────────────────────────────────────────
    lines.push(D);
    lines.push('  IV. RỦI RO & VẤN ĐỀ NGHIÊM TRỌNG');
    lines.push(D);
    lines.push('');
    lines.push('  A. RỦI RO ĐANG MỞ:');
    if (data.topRisks.length === 0) {
      lines.push('     Không có rủi ro mở ở cấp portfolio.');
    } else {
      data.topRisks.slice(0, 6).forEach((r, i) => {
        lines.push(`     ${String(i+1).padStart(2)}.  [${r.priority.toUpperCase()}]  ${r.description}`);
        lines.push(`          Squad/DA  : ${r.project_name}${r.program_name ? ` (${r.program_name})` : ''}`);
        lines.push(`          Danh mục  : ${r.category || '—'}`);
        lines.push(`          Giảm thiểu: ${r.mitigation || 'Đang đánh giá'}`);
        if (i < Math.min(data.topRisks.length, 6) - 1) lines.push('');
      });
    }
    lines.push('');
    lines.push('  B. VẤN ĐỀ ĐANG MỞ:');
    if (data.topIssues.length === 0) {
      lines.push('     Không có vấn đề mở ở cấp portfolio.');
    } else {
      data.topIssues.slice(0, 6).forEach((r, i) => {
        lines.push(`     ${String(i+1).padStart(2)}.  [${r.priority.toUpperCase()}]  ${r.description}`);
        lines.push(`          Squad/DA: ${r.project_name}${r.program_name ? ` (${r.program_name})` : ''}`);
        lines.push(`          Xử lý   : ${r.mitigation || 'Đang điều tra'}`);
        if (i < Math.min(data.topIssues.length, 6) - 1) lines.push('');
      });
    }
    lines.push('');

    // ── V. Upcoming Milestones ───────────────────────────────────────────────
    lines.push(D);
    lines.push('  V.  MILESTONE SẮP TỚI — 30 NGÀY TỚI');
    lines.push(D);
    lines.push('');
    if (data.upcomingMilestones.length === 0) {
      lines.push('  Không có milestone quan trọng nào trong 30 ngày tới.');
    } else {
      lines.push(mlHL('┌', '┬', '┐'));
      lines.push(mlRow('NGÀY', 'HOẠT ĐỘNG / DELIVERABLE', 'SQUAD/DA', '%'));
      lines.push(mlHL('├', '┼', '┤'));
      data.upcomingMilestones.forEach(m => {
        const label = m.deliverable ? `${m.activity} / ${m.deliverable}` : m.activity;
        lines.push(mlRow(m.plan_end || '—', label, m.project_name, String(m.completion_pct ?? 0) + '%'));
      });
      lines.push(mlHL('└', '┴', '┘'));
    }
    lines.push('');

    // ── VI. Program Scorecard ───────────────────────────────────────────────
    lines.push(D);
    lines.push('  VI. BẢNG ĐIỂM CHƯƠNG TRÌNH');
    lines.push(D);
    lines.push('');
    lines.push(csHL('┌', '┬', '┐'));
    lines.push(csRow('CHƯƠNG TRÌNH', 'DA', 'ACTIVE', 'TB %', 'SỨC KHỎE', 'RỦI RO', 'VẤN ĐỀ'));
    lines.push(csHL('├', '┼', '┤'));
    data.programs.forEach(c => {
      if (c.projects.length === 0) return;
      const avgPct = Math.round(c.projects.reduce((s, p) => s + p.completion_pct, 0) / c.projects.length);
      const activeCount = c.projects.filter(p => p.current_phase !== 'Closing').length;
      const worstRag = c.projects.some(p => p.rag === 'red') ? '● ĐỎ' : c.projects.some(p => p.rag === 'amber') ? '● VÀNG' : '● XANH';
      const risks = c.projects.reduce((s, p) => s + p.open_risks, 0);
      const issues = c.projects.reduce((s, p) => s + p.open_issues, 0);
      lines.push(csRow(c.name, String(c.projects.length), String(activeCount), String(avgPct) + '%', worstRag, String(risks), String(issues)));
    });
    lines.push(csHL('└', '┴', '┘'));
    if (data.noProgramProjects.length > 0) {
      lines.push(`\n  Lưu ý: ${data.noProgramProjects.length} Squad/Dự án chưa được gán cho chương trình.`);
    }
    lines.push('');

    // ── VII. Actions Required ────────────────────────────────────────────────
    lines.push(D);
    lines.push('  VII. HÀNH ĐỘNG CẦN THIẾT — Steering Committee / CEO');
    lines.push(D);
    lines.push('');
    const criticalRisksVN = data.topRisks.filter(r => r.priority === 'Critical');
    let actionIdxVN = 0;
    const actionsVN: string[] = [];
    red.forEach(p => {
      actionIdxVN++;
      const dl = p.days_until_deadline;
      const dlDesc = dl !== null && dl < 0 ? `quá hạn ${Math.abs(dl)} ngày` : 'đang gặp rủi ro nghiêm trọng';
      actionsVN.push(`  ${actionIdxVN}. [KHẨN CẤP — LEO THANG]  ${p.name} (${p.program_name || 'N/A'}) đang ${dlDesc}.`);
      actionsVN.push(`     → Đề xuất: Đưa vào chương trình nghị sự Steering Committee gần nhất, xem xét bổ sung nguồn lực hoặc điều chỉnh phạm vi.`);
    });
    criticalRisksVN.forEach(r => {
      actionIdxVN++;
      actionsVN.push(`  ${actionIdxVN}. [KHẨN CẤP — QUYẾT ĐỊNH]  ${r.description} tại Squad/Dự án ${r.project_name}.`);
      actionsVN.push(`     → Đề xuất: ${r.mitigation || 'Đánh giá và ban hành quyết định xử lý ngay lập tức'}.`);
    });
    if (actionsVN.length === 0) {
      lines.push('  Không có leo thang nào cần CEO xử lý ngay. Portfolio đang trong tầm kiểm soát.');
    } else {
      actionsVN.forEach(a => lines.push(a));
    }
    lines.push('');

    // ── VIII. Resource Allocation & Block Headcount Coverage ────────────────
    if (data.fteStats) {
      const fs = data.fteStats;
      const ps = data.personnelStats;
      const usedFte = fs.deliveryFte + fs.overheadProjectFte + fs.overheadRemainingFte;
      const overheadTotalFte = parseFloat((fs.overheadProjectFte + fs.overheadRemainingFte).toFixed(1));
      const donutBase = fs.headcountQuota > 0 ? fs.headcountQuota : parseFloat((usedFte + fs.benchFte).toFixed(1));
      const deliveryPct = donutBase > 0 ? Math.round((fs.deliveryFte / donutBase) * 100) : 0;
      const overheadPct = donutBase > 0 ? Math.round((overheadTotalFte / donutBase) * 100) : 0;
      const benchPct    = donutBase > 0 ? Math.round((fs.benchFte / donutBase) * 100) : 0;
      const fteShortfall = fs.programFillRates
        .filter(p => p.allocated > p.actual)
        .reduce((s, p) => s + (p.allocated - p.actual), 0);
      const overPrograms  = fs.programFillRates.filter(p => p.fillRate > 100);
      const underPrograms = fs.programFillRates.filter(p => p.allocated > 0 && p.fillRate < 90);

      lines.push(D);
      lines.push('  VIII. PHÂN BỔ NGUỒN LỰC & ĐỘ PHỦ ĐỊNH BIÊN TOÀN KHỐI');
      lines.push(D);
      lines.push('');

      // KPI table
      const KW = { lb: 38, vl: 22 } as const;
      const kRow = (lb: string, vl: string) => `  │ ${lb.padEnd(KW.lb)} │ ${vl.padStart(KW.vl)} │`;
      lines.push(`  ┌${'─'.repeat(KW.lb+2)}┬${'─'.repeat(KW.vl+2)}┐`);
      lines.push(`  │ ${'CHỈ SỐ'.padEnd(KW.lb)} │ ${'GIÁ TRỊ'.padStart(KW.vl)} │`);
      lines.push(`  ├${'─'.repeat(KW.lb+2)}┼${'─'.repeat(KW.vl+2)}┤`);
      lines.push(kRow('Định biên (người)',       fs.headcountQuota > 0 ? `${fs.headcountQuota} người` : 'chưa thiết lập'));
      lines.push(kRow('FTE khả dụng net (%FTE)', `${usedFte.toFixed(1)} FTE`));
      lines.push(kRow('Utilization (%)',          fs.headcountQuota > 0 ? `${fs.utilizationPct}%` : '—'));
      lines.push(kRow('Fill rate khối (%FTE)',    fs.programFillRates.length > 0 ? `${fs.blockFillRate}%` : '—'));
      lines.push(kRow('Số người cần tuyển (người)', `${fs.peopleNeeded} người`));
      lines.push(`  └${'─'.repeat(KW.lb+2)}┴${'─'.repeat(KW.vl+2)}┘`);
      lines.push('');

      // Capacity structure
      lines.push('  A. CƠ CẤU NĂNG LỰC KHỐI (FTE):');
      lines.push(`  ${'─'.repeat(60)}`);
      const bar = (pct: number) => '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      lines.push(`  Delivery  [${bar(deliveryPct)}] ${String(deliveryPct).padStart(3)}%  (${fs.deliveryFte.toFixed(1)} FTE)`);
      lines.push(`  Overhead  [${bar(overheadPct)}] ${String(overheadPct).padStart(3)}%  (${overheadTotalFte.toFixed(1)} FTE)`);
      lines.push(`  Bench     [${bar(benchPct)}] ${String(benchPct).padStart(3)}%  (${fs.benchFte.toFixed(1)} FTE)`);
      lines.push(`  ${'─'.repeat(60)}`);
      if (ps) lines.push(`  Định biên: ${fs.headcountQuota > 0 ? fs.headcountQuota + ' người' : '?'}  ·  Nhân sự thực tế trong khối: ${ps.totalInternal} người`);
      lines.push(`  Lưu ý: tổng lượt phân bổ đầu người ${ps ? ps.totalAllocated : '?'} > ${ps ? ps.totalInternal : '?'} người do shared resource.`);
      lines.push(`          Quy về FTE mới phản ánh đúng năng lực thực dùng.`);
      lines.push('');

      // Fill rate by program
      if (fs.programFillRates.length > 0) {
        lines.push('  B. FILL RATE THEO PROGRAM (FTE, sắp xếp giảm dần):');
        lines.push('');
        const PF = { nm: 24, al: 8, ac: 8, fr: 8 } as const;
        lines.push(`  ┌${'─'.repeat(PF.nm+2)}┬${'─'.repeat(PF.al+2)}┬${'─'.repeat(PF.ac+2)}┬${'─'.repeat(PF.fr+2)}┐`);
        lines.push(`  │ ${'PROGRAM'.padEnd(PF.nm)} │ ${'ĐN FTE'.padStart(PF.al)} │ ${'TT FTE'.padStart(PF.ac)} │ ${'FILL%'.padStart(PF.fr)} │`);
        lines.push(`  ├${'─'.repeat(PF.nm+2)}┼${'─'.repeat(PF.al+2)}┼${'─'.repeat(PF.ac+2)}┼${'─'.repeat(PF.fr+2)}┤`);
        fs.programFillRates.forEach(p => {
          const nm = p.programName.length > PF.nm ? p.programName.slice(0, PF.nm - 1) + '…' : p.programName;
          const flag = p.fillRate > 100 ? ' !' : p.fillRate < 70 ? ' ▼' : '';
          lines.push(`  │ ${nm.padEnd(PF.nm)} │ ${p.allocated.toFixed(1).padStart(PF.al)} │ ${p.actual.toFixed(1).padStart(PF.ac)} │ ${(String(p.fillRate) + '%' + flag).padStart(PF.fr)} │`);
        });
        lines.push(`  └${'─'.repeat(PF.nm+2)}┴${'─'.repeat(PF.al+2)}┴${'─'.repeat(PF.ac+2)}┴${'─'.repeat(PF.fr+2)}┘`);
        lines.push('');
        if (overPrograms.length > 0) {
          lines.push(`  [!] Program vượt định biên (>100%): ${overPrograms.map(p => p.programName).join(', ')}`);
          lines.push(`      → Nên xem xét điều chuyển nội bộ thay vì mở headcount mới.`);
        }
        if (underPrograms.length > 0) {
          lines.push(`  [▼] Program chưa đủ định biên (<90%): ${underPrograms.map(p => `${p.programName} (${p.fillRate}%)`).join(', ')}`);
        }
        if (fteShortfall > 0) {
          lines.push(`  Tổng FTE còn thiếu: ${fteShortfall.toFixed(1)} FTE → cần tuyển khoảng ${fs.peopleNeeded} người`);
          lines.push(`  (Làm tròn lên từ tổng thiếu hụt toàn khối, không làm tròn lẻ ở từng program.)`);
        } else {
          lines.push(`  Fill rate toàn khối đạt ${fs.blockFillRate}% — không có nhu cầu tuyển dụng hiện tại.`);
        }
      }
      lines.push('');
    }

    lines.push(D);
    lines.push(`  ${companyName ? companyName + '   ·   ' : ''}Program Management Office   ·   Tài liệu bảo mật — Nội bộ`);
    lines.push(D);

  } else {
    // ── Header ───────────────────────────────────────────────────────────────
    lines.push(box1);
    lines.push(boxL('PORTFOLIO STATUS REPORT'));
    lines.push(boxL('Program Management Office (PMO)'));
    lines.push(box2);
    lines.push('');
    lines.push(`  Report Date    : ${today}              Reference : PMO-${yyyymm}-001`);
    lines.push(`  Reporting Period: ${periodStart} → ${periodEnd}`);
    lines.push(`  Classification : Confidential — Internal Distribution Only`);
    lines.push(`  Distribution   : CEO, Steering Committee, Portfolio Manager`);
    lines.push('');

    // ── Summary Statement ────────────────────────────────────────────────────
    {
      const ragKey = red.length > 0 ? 'red' : amber.length > 0 ? 'amber' : 'green';
      const summaryText = pickSummary(ragKey, 'en');
      const words = summaryText.split(' ');
      const wrappedLines: string[] = [];
      let cur = '';
      for (const w of words) {
        if ((cur ? cur + ' ' + w : w).length > 88) { wrappedLines.push(cur); cur = w; }
        else cur = cur ? cur + ' ' + w : w;
      }
      if (cur) wrappedLines.push(cur);
      lines.push(sbox1);
      lines.push(sboxL('SUMMARY'));
      lines.push(sboxL(''));
      wrappedLines.forEach(l => lines.push(sboxL(l)));
      lines.push(sbox2);
      lines.push('');
    }

    // ── I. Executive Summary ─────────────────────────────────────────────────
    lines.push(D);
    lines.push('  I.  EXECUTIVE SUMMARY');
    lines.push(D);
    lines.push('');
    lines.push(`  Overall Portfolio Status: ● ${portfolioStatus}`);
    lines.push('');
    const summaryEN = red.length > 0
      ? `Portfolio is at RED status with ${red.length} Squad/Project(s) requiring immediate attention.`
      : amber.length > 0 ? `Portfolio is at AMBER status with ${amber.length} Squad/Project(s) under close monitoring.`
        : 'Portfolio is in good health — all Squad/Projects are tracking GREEN.';
    lines.push(`  ${summaryEN} A total of ${data.kpi.totalProjects} Squad/Projects are active across`);
    lines.push(`  ${data.kpi.totalPrograms} programs, with an average completion rate of ${data.kpi.avgCompletion}% (weighted by status).`);
    lines.push(`  Status distribution: ${green.length} GREEN  ·  ${amber.length} AMBER  ·  ${red.length} RED.`);
    if (overdue.length > 0) lines.push(`\n  [!] ALERT: ${overdue.length} Squad/Project(s) are past their deadline — immediate action required.`);
    if (data.kpi.totalOpenRisks === 0 && data.kpi.totalOpenIssues === 0) lines.push('  [+] Positive: No open risks or issues recorded at the portfolio level.');
    lines.push('');
    lines.push('  KEY METRICS:');
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push(`  Total Squad/Projects    : ${data.kpi.totalProjects}      Active           : ${data.kpi.activeProjects}`);
    lines.push(`  Avg. Completion (wtd)   : ${data.kpi.avgCompletion}%    Programs          : ${data.kpi.totalPrograms}`);
    lines.push(`  Open Risks              : ${data.kpi.totalOpenRisks}      Open Issues       : ${data.kpi.totalOpenIssues}`);
    lines.push(`  Overdue Squad/Projects  : ${overdue.length}`);
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push('');
    if (data.fteStats) {
      const fs = data.fteStats;
      const usedFteEN = fs.deliveryFte + fs.overheadProjectFte + fs.overheadRemainingFte;
      lines.push('  PERSONNEL & RESOURCES:');
      lines.push(`  ${'─'.repeat(50)}`);
      lines.push(`  Headcount Quota         : ${fs.headcountQuota > 0 ? fs.headcountQuota + ' people' : 'not set'}`);
      lines.push(`  Net Used FTE            : ${usedFteEN.toFixed(1)} FTE     Utilization: ${fs.headcountQuota > 0 ? fs.utilizationPct + '%' : '—'}`);
      lines.push(`  Block Fill Rate         : ${fs.programFillRates.length > 0 ? fs.blockFillRate + '%' : '—'}        Hire Needed: ${fs.peopleNeeded} people`);
      lines.push(`  ${'─'.repeat(50)}`);
      lines.push('');
    }

    // ── II. Portfolio Health Matrix ──────────────────────────────────────────
    lines.push(D);
    lines.push('  II. PORTFOLIO HEALTH MATRIX');
    lines.push(D);
    lines.push('');
    lines.push(tHL('┌', '┬', '┐'));
    lines.push(tRow('#', 'STATUS', 'SQUAD/PROJECT', 'PROGRAM', 'PHASE', 'PCT', 'DEADLINE'));
    lines.push(tHL('├', '┼', '┤'));
    sorted.forEach((p, i) => {
      const stLabel = p.rag === 'red' ? '● RED' : p.rag === 'amber' ? '● AMBER' : '● GREEN';
      const dl = p.days_until_deadline;
      const dlStr = dl === null ? '—' : dl < 0 ? `OVERDUE ${Math.abs(dl)}d` : `${dl}d left`;
      lines.push(tRow(String(i + 1), stLabel, p.name, p.program_name || '—', p.current_phase, String(p.completion_pct) + '%', dlStr));
    });
    lines.push(tHL('└', '┴', '┘'));
    lines.push('');
    lines.push(`  Summary:  ${green.length} GREEN   ·   ${amber.length} AMBER   ·   ${red.length} RED`);
    lines.push('');

    // Per-project US progress details
    if (allProjects.some(p => p.total_activities > 0)) {
      lines.push('  SQUAD/PROJECT PROGRESS DETAILS:');
      lines.push(`  ${'─'.repeat(80)}`);
      sorted.forEach((p, i) => {
        if (p.total_activities === 0) return;
        lines.push(`  ${String(i+1).padStart(2)}. ${p.name}${p.program_name ? ` (${p.program_name})` : ''} — ${p.current_phase}`);
        lines.push(`      Progress (weighted): ${String(p.completion_pct).padStart(3)}%   |   Done: ${p.done_activities}   In Progress: ${p.in_progress_activities}   Not Started: ${p.not_started_activities}   Total: ${p.total_activities} US`);
        if (p.epicStats && p.epicStats.length > 0) {
          p.epicStats.forEach(e => {
            const bar = '█'.repeat(Math.round(e.pct / 10)) + '░'.repeat(10 - Math.round(e.pct / 10));
            const sd = e.start_date ?? 'N/A';
            const ed = e.end_date ?? 'N/A';
            lines.push(`      ▸ ${rp(e.phase, 20)}  [${bar}]  ${String(e.pct).padStart(3)}%  (${String(e.done).padStart(2)}/${String(e.total).padStart(2)} US)  ${sd} → ${ed}`);
          });
        }
        if (i < sorted.length - 1) lines.push('');
      });
      lines.push('');
    }

    // ── III. Completed in Period ──────────────────────────────────────────────
    lines.push(D);
    lines.push('  III. PROGRESS REPORT — COMPLETED IN PERIOD');
    lines.push(D);
    lines.push(`  Reporting Period: ${periodStart} → ${periodEnd}`);
    lines.push('');
    const completedGroupsEN = Object.values(data.completedByProject);
    if (completedGroupsEN.length === 0) {
      lines.push('  No activities completed in this period across the portfolio.');
    } else {
      completedGroupsEN.forEach((g, i) => {
        lines.push(`  ${String(i+1).padStart(2)}. ${g.project_name}${g.program_name ? ` (${g.program_name})` : ''} — ${g.current_phase}`);
        g.activities.forEach(a => {
          lines.push(`      [+]  ${a.activity}${a.deliverable ? `  →  ${a.deliverable}` : ''}${a.actual_end ? `  [${a.actual_end}]` : ''}`);
        });
        if (i < completedGroupsEN.length - 1) lines.push('');
      });
    }
    lines.push('');

    // ── IV. Critical Risks & Issues ──────────────────────────────────────────
    lines.push(D);
    lines.push('  IV. CRITICAL RISKS & ISSUES');
    lines.push(D);
    lines.push('');
    lines.push('  A. OPEN RISKS:');
    if (data.topRisks.length === 0) {
      lines.push('     No open risks at portfolio level.');
    } else {
      data.topRisks.slice(0, 6).forEach((r, i) => {
        lines.push(`     ${String(i+1).padStart(2)}.  [${r.priority.toUpperCase()}]  ${r.description}`);
        lines.push(`          Squad/Proj : ${r.project_name}${r.program_name ? ` (${r.program_name})` : ''}`);
        lines.push(`          Category   : ${r.category || '—'}`);
        lines.push(`          Mitigation : ${r.mitigation || 'Under assessment'}`);
        if (i < Math.min(data.topRisks.length, 6) - 1) lines.push('');
      });
    }
    lines.push('');
    lines.push('  B. OPEN ISSUES:');
    if (data.topIssues.length === 0) {
      lines.push('     No open issues at portfolio level.');
    } else {
      data.topIssues.slice(0, 6).forEach((r, i) => {
        lines.push(`     ${String(i+1).padStart(2)}.  [${r.priority.toUpperCase()}]  ${r.description}`);
        lines.push(`          Squad/Proj : ${r.project_name}${r.program_name ? ` (${r.program_name})` : ''}`);
        lines.push(`          Resolution : ${r.mitigation || 'Under investigation'}`);
        if (i < Math.min(data.topIssues.length, 6) - 1) lines.push('');
      });
    }
    lines.push('');

    // ── V. Upcoming Milestones ───────────────────────────────────────────────
    lines.push(D);
    lines.push('  V.  UPCOMING MILESTONES — Next 30 Days');
    lines.push(D);
    lines.push('');
    if (data.upcomingMilestones.length === 0) {
      lines.push('  No significant milestones in the next 30 days.');
    } else {
      lines.push(mlHL('┌', '┬', '┐'));
      lines.push(mlRow('DATE', 'MILESTONE / DELIVERABLE', 'SQUAD/PROJ', 'PCT'));
      lines.push(mlHL('├', '┼', '┤'));
      data.upcomingMilestones.forEach(m => {
        const label = m.deliverable ? `${m.activity} / ${m.deliverable}` : m.activity;
        lines.push(mlRow(m.plan_end || '—', label, m.project_name, String(m.completion_pct ?? 0) + '%'));
      });
      lines.push(mlHL('└', '┴', '┘'));
    }
    lines.push('');

    // ── VI. Program Scorecard ───────────────────────────────────────────────
    lines.push(D);
    lines.push('  VI. PROGRAM PORTFOLIO SCORECARD');
    lines.push(D);
    lines.push('');
    lines.push(csHL('┌', '┬', '┐'));
    lines.push(csRow('PROGRAM', 'S/PROJ', 'ACTIVE', 'AVG %', 'HEALTH', 'RISKS', 'ISSUES'));
    lines.push(csHL('├', '┼', '┤'));
    data.programs.forEach(c => {
      if (c.projects.length === 0) return;
      const avgPct = Math.round(c.projects.reduce((s, p) => s + p.completion_pct, 0) / c.projects.length);
      const activeCount = c.projects.filter(p => p.current_phase !== 'Closing').length;
      const worstRag = c.projects.some(p => p.rag === 'red') ? '● RED' : c.projects.some(p => p.rag === 'amber') ? '● AMBER' : '● GREEN';
      const risks = c.projects.reduce((s, p) => s + p.open_risks, 0);
      const issues = c.projects.reduce((s, p) => s + p.open_issues, 0);
      lines.push(csRow(c.name, String(c.projects.length), String(activeCount), String(avgPct) + '%', worstRag, String(risks), String(issues)));
    });
    lines.push(csHL('└', '┴', '┘'));
    if (data.noProgramProjects.length > 0) {
      lines.push(`\n  Note: ${data.noProgramProjects.length} Squad/Project(s) not assigned to any program.`);
    }
    lines.push('');

    // ── VII. Actions Required ────────────────────────────────────────────────
    lines.push(D);
    lines.push('  VII. ACTIONS REQUIRED — Steering Committee / CEO');
    lines.push(D);
    lines.push('');
    const criticalRisksEN = data.topRisks.filter(r => r.priority === 'Critical');
    let actionIdxEN = 0;
    const actionsEN: string[] = [];
    red.forEach(p => {
      actionIdxEN++;
      const dl = p.days_until_deadline;
      const dlDesc = dl !== null && dl < 0 ? `OVERDUE ${Math.abs(dl)} days` : 'at critical risk';
      actionsEN.push(`  ${actionIdxEN}. [URGENT — ESCALATION]  ${p.name} (${p.program_name || 'N/A'}) is ${dlDesc}.`);
      actionsEN.push(`     → Recommend: Steering Committee review at next session. Assess resource injection or scope revision.`);
    });
    criticalRisksEN.forEach(r => {
      actionIdxEN++;
      actionsEN.push(`  ${actionIdxEN}. [URGENT — DECISION]  ${r.description} in Squad/Project ${r.project_name}.`);
      actionsEN.push(`     → Recommend: ${r.mitigation || 'Immediate assessment and corrective action required'}.`);
    });
    if (actionsEN.length === 0) {
      lines.push('  No immediate CEO escalations required at this time. Portfolio is under control.');
    } else {
      actionsEN.forEach(a => lines.push(a));
    }
    lines.push('');

    // ── VIII. Resource Allocation & Block Headcount Coverage ────────────────
    if (data.fteStats) {
      const fs = data.fteStats;
      const ps = data.personnelStats;
      const usedFteEN = fs.deliveryFte + fs.overheadProjectFte + fs.overheadRemainingFte;
      const overheadTotalFteEN = parseFloat((fs.overheadProjectFte + fs.overheadRemainingFte).toFixed(1));
      const donutBaseEN = fs.headcountQuota > 0 ? fs.headcountQuota : parseFloat((usedFteEN + fs.benchFte).toFixed(1));
      const deliveryPctEN = donutBaseEN > 0 ? Math.round((fs.deliveryFte / donutBaseEN) * 100) : 0;
      const overheadPctEN = donutBaseEN > 0 ? Math.round((overheadTotalFteEN / donutBaseEN) * 100) : 0;
      const benchPctEN    = donutBaseEN > 0 ? Math.round((fs.benchFte / donutBaseEN) * 100) : 0;
      const fteShortfallEN = fs.programFillRates
        .filter(p => p.allocated > p.actual)
        .reduce((s, p) => s + (p.allocated - p.actual), 0);
      const overProgramsEN  = fs.programFillRates.filter(p => p.fillRate > 100);
      const underProgramsEN = fs.programFillRates.filter(p => p.allocated > 0 && p.fillRate < 90);

      lines.push(D);
      lines.push('  VIII. RESOURCE ALLOCATION & BLOCK HEADCOUNT COVERAGE');
      lines.push(D);
      lines.push('');

      const KW2 = { lb: 38, vl: 22 } as const;
      const kRow2 = (lb: string, vl: string) => `  │ ${lb.padEnd(KW2.lb)} │ ${vl.padStart(KW2.vl)} │`;
      lines.push(`  ┌${'─'.repeat(KW2.lb+2)}┬${'─'.repeat(KW2.vl+2)}┐`);
      lines.push(`  │ ${'METRIC'.padEnd(KW2.lb)} │ ${'VALUE'.padStart(KW2.vl)} │`);
      lines.push(`  ├${'─'.repeat(KW2.lb+2)}┼${'─'.repeat(KW2.vl+2)}┤`);
      lines.push(kRow2('Headcount quota (people)',      fs.headcountQuota > 0 ? `${fs.headcountQuota} people` : 'not set'));
      lines.push(kRow2('Net used FTE (%FTE)',           `${usedFteEN.toFixed(1)} FTE`));
      lines.push(kRow2('Utilization (%)',               fs.headcountQuota > 0 ? `${fs.utilizationPct}%` : '—'));
      lines.push(kRow2('Block fill rate (%FTE)',        fs.programFillRates.length > 0 ? `${fs.blockFillRate}%` : '—'));
      lines.push(kRow2('People needed (hire)',          `${fs.peopleNeeded} people`));
      lines.push(`  └${'─'.repeat(KW2.lb+2)}┴${'─'.repeat(KW2.vl+2)}┘`);
      lines.push('');

      lines.push('  A. BLOCK CAPACITY STRUCTURE (FTE):');
      lines.push(`  ${'─'.repeat(60)}`);
      const barEN = (pct: number) => '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      lines.push(`  Delivery  [${barEN(deliveryPctEN)}] ${String(deliveryPctEN).padStart(3)}%  (${fs.deliveryFte.toFixed(1)} FTE)`);
      lines.push(`  Overhead  [${barEN(overheadPctEN)}] ${String(overheadPctEN).padStart(3)}%  (${overheadTotalFteEN.toFixed(1)} FTE)`);
      lines.push(`  Bench     [${barEN(benchPctEN)}] ${String(benchPctEN).padStart(3)}%  (${fs.benchFte.toFixed(1)} FTE)`);
      lines.push(`  ${'─'.repeat(60)}`);
      if (ps) lines.push(`  Quota: ${fs.headcountQuota > 0 ? fs.headcountQuota + ' people' : '?'}  ·  Actual headcount in block: ${ps.totalInternal} people`);
      lines.push(`  Note: ${ps ? ps.totalAllocated : '?'} allocation slots > ${ps ? ps.totalInternal : '?'} people due to shared resources.`);
      lines.push(`        FTE is the correct unit for summing across programs — not headcount.`);
      lines.push('');

      if (fs.programFillRates.length > 0) {
        lines.push('  B. FILL RATE BY PROGRAM (FTE, sorted descending):');
        lines.push('');
        const PF2 = { nm: 24, al: 8, ac: 8, fr: 8 } as const;
        lines.push(`  ┌${'─'.repeat(PF2.nm+2)}┬${'─'.repeat(PF2.al+2)}┬${'─'.repeat(PF2.ac+2)}┬${'─'.repeat(PF2.fr+2)}┐`);
        lines.push(`  │ ${'PROGRAM'.padEnd(PF2.nm)} │ ${'ALLOC'.padStart(PF2.al)} │ ${'ACTUAL'.padStart(PF2.ac)} │ ${'FILL%'.padStart(PF2.fr)} │`);
        lines.push(`  ├${'─'.repeat(PF2.nm+2)}┼${'─'.repeat(PF2.al+2)}┼${'─'.repeat(PF2.ac+2)}┼${'─'.repeat(PF2.fr+2)}┤`);
        fs.programFillRates.forEach(p => {
          const nm = p.programName.length > PF2.nm ? p.programName.slice(0, PF2.nm - 1) + '…' : p.programName;
          const flag = p.fillRate > 100 ? ' !' : p.fillRate < 70 ? ' ▼' : '';
          lines.push(`  │ ${nm.padEnd(PF2.nm)} │ ${p.allocated.toFixed(1).padStart(PF2.al)} │ ${p.actual.toFixed(1).padStart(PF2.ac)} │ ${(String(p.fillRate) + '%' + flag).padStart(PF2.fr)} │`);
        });
        lines.push(`  └${'─'.repeat(PF2.nm+2)}┴${'─'.repeat(PF2.al+2)}┴${'─'.repeat(PF2.ac+2)}┴${'─'.repeat(PF2.fr+2)}┘`);
        lines.push('');
        if (overProgramsEN.length > 0) {
          lines.push(`  [!] Programs above quota (>100%): ${overProgramsEN.map(p => p.programName).join(', ')}`);
          lines.push(`      → Consider internal redeployment before opening new headcount.`);
        }
        if (underProgramsEN.length > 0) {
          lines.push(`  [▼] Under-staffed programs (<90%): ${underProgramsEN.map(p => `${p.programName} (${p.fillRate}%)`).join(', ')}`);
        }
        if (fteShortfallEN > 0) {
          lines.push(`  Total FTE shortfall: ${fteShortfallEN.toFixed(1)} FTE → approx. ${fs.peopleNeeded} hire(s) needed`);
          lines.push(`  (Rounded up from the aggregate block shortfall — not rounded per program.)`);
        } else {
          lines.push(`  Block fill rate: ${fs.blockFillRate}% — no current hiring need.`);
        }
      }
      lines.push('');
    }

    lines.push(D);
    lines.push(`  ${companyName ? companyName + '   ·   ' : ''}Program Management Office   ·   Confidential — Internal Only`);
    lines.push(D);
  }

  return lines.join('\n');
}

// ─── Filter portfolio data to selected project IDs ───────────────────────────
function filterDataByProjects(data: PortfolioReportData, ids: Set<number>): PortfolioReportData {
  if (ids.size === 0) return data;
  const programs = data.programs
    .map(prog => ({ ...prog, projects: prog.projects.filter(p => ids.has(p.id)) }))
    .filter(prog => prog.projects.length > 0);
  const noProgramProjects = data.noProgramProjects.filter(p => ids.has(p.id));
  const allFiltered = [...programs.flatMap(c => c.projects), ...noProgramProjects];
  const nameSet = new Set(allFiltered.map(p => p.name));
  const kpi = {
    totalProjects: allFiltered.length,
    totalPrograms: programs.length,
    avgCompletion: allFiltered.length > 0 ? Math.round(allFiltered.reduce((s, p) => s + p.completion_pct, 0) / allFiltered.length) : 0,
    activeProjects: allFiltered.filter(p => p.current_phase !== 'Closing').length,
    totalOpenRisks: allFiltered.reduce((s, p) => s + p.open_risks, 0),
    totalOpenIssues: allFiltered.reduce((s, p) => s + p.open_issues, 0),
  };
  return {
    ...data,
    projects: data.projects.filter(p => ids.has(p.id)),
    programs,
    noProgramProjects,
    kpi,
    topRisks: data.topRisks.filter(r => nameSet.has(r.project_name)),
    topIssues: data.topIssues.filter(r => nameSet.has(r.project_name)),
    upcomingMilestones: data.upcomingMilestones.filter(m => nameSet.has(m.project_name)),
    recentlyCompleted: data.recentlyCompleted.filter(r => nameSet.has(r.project_name)),
    completedByProject: Object.fromEntries(Object.entries(data.completedByProject).filter(([k]) => nameSet.has(k))),
  };
}

// ─── Markdown → HTML (for AI output) ─────────────────────────────────────────
function mdToHtml(text: string): string {
  const fmt = (s: string) => s
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>');
  const lines = text.split('\n');
  let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:860px;margin:0 auto;color:#1e293b;font-size:14px;line-height:1.75;padding:28px;background:white;">';
  let inUl = false; let inOl = false;
  lines.forEach(line => {
    const isBullet = /^[-*]\s/.test(line); const isOrdered = /^\d+\.\s/.test(line);
    if (!isBullet && inUl) { html += '</ul>'; inUl = false; }
    if (!isOrdered && inOl) { html += '</ol>'; inOl = false; }
    if (/^###\s/.test(line)) {
      html += `<h3 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin:18px 0 6px;">${fmt(line.replace(/^###\s/,''))}</h3>`;
    } else if (/^##\s/.test(line)) {
      html += `<h2 style="font-size:16px;font-weight:700;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:24px 0 10px;">${fmt(line.replace(/^##\s/,''))}</h2>`;
    } else if (/^#\s/.test(line)) {
      html += `<h1 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 16px;">${fmt(line.replace(/^#\s/,''))}</h1>`;
    } else if (isBullet) {
      if (!inUl) { html += '<ul style="margin:6px 0;padding-left:22px;">'; inUl = true; }
      html += `<li style="margin:4px 0;color:#334155;">${fmt(line.replace(/^[-*]\s/,''))}</li>`;
    } else if (isOrdered) {
      if (!inOl) { html += '<ol style="margin:6px 0;padding-left:22px;">'; inOl = true; }
      html += `<li style="margin:4px 0;color:#334155;">${fmt(line.replace(/^\d+\.\s/,''))}</li>`;
    } else if (line.trim() === '') {
      html += '<div style="height:8px;"></div>';
    } else {
      html += `<p style="margin:5px 0;color:#334155;">${fmt(line)}</p>`;
    }
  });
  if (inUl) html += '</ul>'; if (inOl) html += '</ol>';
  html += '</div>'; return html;
}

// ─── Build HTML Report (black / white / red theme) ───────────────────────────
function buildHtmlReport(data: PortfolioReportData, language: string, periodStart: string, periodEnd: string, companyName = ''): string {
  const isVN = language === 'Vietnamese';
  const today = new Date().toLocaleDateString(isVN ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} / ${new Date().getFullYear()}`;

  const allProjects = [...data.programs.flatMap(c => c.projects), ...data.noProgramProjects];
  const red = allProjects.filter(p => p.rag === 'red');

  // Epic-based totals (pie 1 + bar chart use epics only)
  const epicsDone       = allProjects.reduce((s, p) => s + (p.epicStats?.filter(e => e.pct >= 100).length ?? 0), 0);
  const epicsInProg     = allProjects.reduce((s, p) => s + (p.epicStats?.filter(e => e.pct > 0 && e.pct < 100).length ?? 0), 0);
  const epicsNotStarted = allProjects.reduce((s, p) => s + (p.epicStats?.filter(e => e.pct === 0).length ?? 0), 0);
  const epicsTotal      = epicsDone + epicsInProg + epicsNotStarted;

  // Project palette — distinct colors for pie/bar (pie2 uses these)
  const PALETTE = ['#2563EB','#E8192C','#16A34A','#D97706','#7C3AED','#0891B2','#DB2777','#059669','#9333EA','#EA580C'];
  const pCol = (i: number) => PALETTE[i % PALETTE.length];
  const ragCol = (r: string) => r === 'red' ? '#DC2626' : r === 'amber' ? '#D97706' : '#16A34A';

  // SVG donut chart — center label rendered as SVG text
  function svgDonut(segs: {val:number,color:string}[], size=140, r=58, inner=36, centerPct?: number): string {
    const total = segs.reduce((a,s) => a+s.val, 0);
    const cx = size/2, cy = size/2;
    const emptyRing = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(0,0,0,0.07)" stroke-width="${r - inner}"/>`;
    if (total === 0) {
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${emptyRing}</svg>`;
    }
    let start = -Math.PI / 2;
    let paths = '';
    for (const seg of segs) {
      if (seg.val <= 0) continue;
      const angle = (seg.val / total) * Math.PI * 2;
      if (Math.abs(angle - Math.PI * 2) < 0.001) {
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${seg.color}"/>`;
      } else {
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(start + angle), y2 = cy + r * Math.sin(start + angle);
        paths += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r},0,${angle > Math.PI ? 1 : 0},1,${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${seg.color}"/>`;
      }
      start += angle;
    }
    const hole = `<circle cx="${cx}" cy="${cy}" r="${inner}" fill="#F8F9FA"/>`;
    const lbl = centerPct !== undefined
      ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#111827">${centerPct}%</text><text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="9" fill="#6B7280">${isVN?'xong':'done'}</text>`
      : '';
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}${hole}${lbl}</svg>`;
  }

  // SVG horizontal bar chart — fill rate by program
  function svgHBarChart(items: FteProgramRate[]): string {
    if (items.length === 0) return '';
    const maxPct = 120;
    const barH = 18;
    const gap = 9;
    const labelW = 120;
    const barAreaW = 240;
    const annW = 90;
    const totalW = labelW + barAreaW + annW;
    const totalH = items.length * (barH + gap) + 28;
    let s = `<svg width="100%" viewBox="0 0 ${totalW} ${totalH}" style="display:block;overflow:visible;">`;
    // gridlines
    [0, 30, 60, 90, 100, 120].forEach(pct => {
      const x = labelW + (pct / maxPct) * barAreaW;
      const col = pct === 90 ? 'rgba(22,163,74,0.35)' : 'rgba(0,0,0,0.06)';
      s += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${totalH - 18}" stroke="${col}" stroke-width="1"/>`;
      s += `<text x="${x.toFixed(1)}" y="${totalH - 4}" text-anchor="middle" font-size="8" fill="#9CA3AF">${pct}%</text>`;
    });
    items.forEach((item, i) => {
      const y = i * (barH + gap) + 2;
      const clampedPct = Math.min(item.fillRate, maxPct);
      const bw = (clampedPct / maxPct) * barAreaW;
      const col = item.fillRate >= 90 ? '#16A34A' : item.fillRate >= 70 ? '#D97706' : '#DC2626';
      const lbl = item.programName.length > 16 ? item.programName.slice(0, 16) + '…' : item.programName;
      s += `<text x="${labelW - 6}" y="${y + barH - 4}" text-anchor="end" font-size="9.5" fill="#374151">${lbl}</text>`;
      s += `<rect x="${labelW}" y="${y}" width="${barAreaW}" height="${barH}" fill="#F3F4F6" rx="3"/>`;
      if (bw > 0) s += `<rect x="${labelW}" y="${y}" width="${bw.toFixed(1)}" height="${barH}" fill="${col}" rx="3" opacity="0.85"/>`;
      if (item.fillRate > 100) {
        const x100 = labelW + (100 / maxPct) * barAreaW;
        s += `<line x1="${x100.toFixed(1)}" y1="${y}" x2="${x100.toFixed(1)}" y2="${y + barH}" stroke="rgba(0,0,0,0.25)" stroke-width="1" stroke-dasharray="2,2"/>`;
      }
      const ann = item.allocated > 0 ? `${item.fillRate}% · ${item.actual}/${item.allocated} FTE` : `${item.actual} FTE (—)`;
      s += `<text x="${labelW + barAreaW + 6}" y="${y + barH - 4}" font-size="9" fill="#374151">${ann}</text>`;
    });
    s += `</svg>`;
    return s;
  }

  // SVG bar chart — stacked 3-segment: Done (green) / In Progress (blue) / Not Started (gray)
  function svgBarChart(items: {label:string,done:number,inProg:number,notStarted:number,total:number}[], w=800, h=160): string {
    const C_DONE = '#16A34A', C_PROG = '#3B82F6', C_TODO = '#E5E7EB';
    const rawMax = Math.max(...items.map(i => i.total), 1);
    const step = rawMax <= 5 ? 1 : rawMax <= 20 ? 5 : rawMax <= 50 ? 10 : 20;
    const max = Math.ceil(rawMax / step) * step;
    const topPad = 22;
    const n = items.length || 1;
    const leftPad = 28;
    const slotW = Math.floor((w - leftPad) / n);
    const barW = Math.min(52, Math.max(18, slotW - 12));
    const vbH = h + topPad + 46;
    let s = `<svg width="100%" viewBox="0 0 ${w} ${vbH}" preserveAspectRatio="xMidYMid meet" style="display:block;">`;
    for (let i = 0; i <= max; i += step) {
      const y = topPad + h - Math.round((i / max) * h);
      s += `<line x1="${leftPad}" y1="${y}" x2="${w}" y2="${y}" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>`;
      s += `<text x="${leftPad - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9CA3AF">${i}</text>`;
    }
    s += `<line x1="${leftPad}" y1="${topPad + h}" x2="${w}" y2="${topPad + h}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`;
    items.forEach((item, i) => {
      const x = leftPad + i * slotW + (slotW - barW) / 2;
      const totalH   = max > 0 ? Math.round((item.total   / max) * h) : 0;
      const doneH    = max > 0 ? Math.round((item.done    / max) * h) : 0;
      const inProgH  = max > 0 ? Math.round((item.inProg  / max) * h) : 0;
      const barTop = topPad + h - totalH;
      // Render full bar as gray (not started) background
      if (totalH > 0) s += `<rect x="${x.toFixed(1)}" y="${barTop.toFixed(1)}" width="${barW}" height="${totalH}" fill="${C_TODO}" rx="3"/>`;
      // Overlay blue (in progress + done region)
      const progH = doneH + inProgH;
      if (progH > 0) s += `<rect x="${x.toFixed(1)}" y="${(topPad + h - progH).toFixed(1)}" width="${barW}" height="${progH}" fill="${C_PROG}"/>`;
      // Overlay green (done region at bottom)
      if (doneH > 0) s += `<rect x="${x.toFixed(1)}" y="${(topPad + h - doneH).toFixed(1)}" width="${barW}" height="${doneH}" fill="${C_DONE}"/>`;
      // Label above bar — total epic count only
      const lblY = barTop - 5;
      s += `<text x="${(x + barW / 2).toFixed(1)}" y="${lblY.toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#374151">${item.total}</text>`;
      const shortLbl = item.label.length > 12 ? item.label.slice(0, 12) + '…' : item.label;
      s += `<text x="${(x + barW / 2).toFixed(1)}" y="${topPad + h + 17}" text-anchor="middle" font-size="10" fill="#6B7280">${shortLbl}</text>`;
    });
    s += `</svg>`;
    return s;
  }

  // Epic status from pct — green/blue/gray, never red (red = RAG health, not epic status)
  const EPIC_COL = { done:'#16A34A', prog:'#3B82F6', todo:'#9CA3AF' } as const;
  const epicSt = (pct: number) => pct >= 100 ? 'done' : pct > 0 ? 'prog' : 'todo';
  const epicStCol = (st: string): string => (EPIC_COL as Record<string,string>)[st] ?? '#9CA3AF';
  const epicStLbl = (st: string): string => ({ done: isVN?'Hoàn thành':'Done', prog: isVN?'Đang triển khai':'In Progress', todo: isVN?'Chưa bắt đầu':'Not Started' }[st] ?? st);
  const epicStBg  = (st: string): string => ({ done:'rgba(22,163,74,0.08)',  prog:'rgba(59,130,246,0.08)', todo:'rgba(0,0,0,0.04)' }[st] ?? 'rgba(0,0,0,0.04)');
  const epicStBdr = (st: string): string => ({ done:'rgba(22,163,74,0.28)',  prog:'rgba(59,130,246,0.25)', todo:'rgba(0,0,0,0.12)' }[st] ?? 'rgba(0,0,0,0.12)');

  // All CSS scoped under .rpd-wrap — white background theme
  const css = `<style>
.rpd-wrap{background:#FFFFFF;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;}
.rpd-wrap *{box-sizing:border-box;}
.rpd-wrap .rpd-tb{background:#FFFFFF;border-bottom:3px solid #E8192C;padding:14px 28px;display:flex;align-items:center;justify-content:space-between;}
.rpd-wrap .rpd-tb-l{font-family:Georgia,serif;font-size:15px;font-weight:700;color:#111827;margin:0;letter-spacing:.3px;}
.rpd-wrap .rpd-tb-s{font-size:10px;color:#6B7280;margin:2px 0 0;letter-spacing:.8px;text-transform:uppercase;}
.rpd-wrap .rpd-pg{max-width:1260px;margin:0 auto;padding:24px 20px 52px;}
.rpd-wrap .rpd-zlbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#E8192C;margin:0 0 14px;display:flex;align-items:center;gap:10px;}
.rpd-wrap .rpd-znum{width:21px;height:21px;border-radius:50%;background:#E8192C;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;}
.rpd-wrap .rpd-zsep{height:1px;background:#E5E7EB;margin:26px 0;}
.rpd-wrap .rpd-panel{background:#F8F9FA;border:1px solid #E5E7EB;border-radius:8px;padding:18px;}
.rpd-wrap .rpd-ptitle{font-size:10px;text-transform:uppercase;letter-spacing:1.4px;color:#6B7280;margin:0 0 14px;}
.rpd-wrap .rpd-pies{display:flex;gap:12px;margin:0 0 12px;}
.rpd-wrap .rpd-pie-col{flex:1;min-width:0;}
.rpd-wrap .rpd-pie-lay{display:flex;align-items:center;gap:14px;}
.rpd-wrap .rpd-pie-leg{flex:1;min-width:0;}
.rpd-wrap .rpd-leg-row{display:flex;align-items:center;gap:7px;font-size:11px;color:#6B7280;margin:0 0 7px;}
.rpd-wrap .rpd-leg-dot{width:9px;height:9px;border-radius:3px;flex-shrink:0;}
.rpd-wrap .rpd-leg-val{margin-left:auto;font-weight:600;color:#111827;font-size:12px;white-space:nowrap;}
.rpd-wrap .rpd-bar-panel{margin:0 0 12px;}
.rpd-wrap .rpd-sum-row{display:flex;gap:12px;margin:0 0 12px;}
.rpd-wrap .rpd-pill{background:#F8F9FA;border:1px solid #E5E7EB;border-radius:8px;padding:14px;flex:1;min-width:0;}
.rpd-wrap .rpd-pill-hd{display:flex;align-items:flex-start;gap:10px;margin:0 0 10px;}
.rpd-wrap .rpd-pill-ico{width:34px;height:34px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;}
.rpd-wrap .rpd-pill-nm{font-size:13px;font-weight:600;color:#111827;margin:0;}
.rpd-wrap .rpd-pill-sb{font-size:11px;color:#6B7280;margin:2px 0 0;}
.rpd-wrap .rpd-bar-tr{background:rgba(0,0,0,0.07);border-radius:3px;height:4px;overflow:hidden;}
.rpd-wrap .rpd-bar-fi{height:4px;border-radius:3px;}
.rpd-wrap .rpd-ep-dots{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 0;}
.rpd-wrap .rpd-ep-dot{display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.09);border-radius:4px;padding:2px 7px;font-size:10px;color:#6B7280;}
.rpd-wrap .rpd-pb{background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin:0 0 14px;}
.rpd-wrap .rpd-pb-hd{background:#F8F9FA;padding:12px 18px;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;gap:12px;}
.rpd-wrap .rpd-pb-ico{width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;}
.rpd-wrap .rpd-pb-nm{font-size:14px;font-weight:600;color:#111827;margin:0;}
.rpd-wrap .rpd-pb-sb{font-size:11px;color:#6B7280;margin:2px 0 0;}
.rpd-wrap .rpd-pb-bar{height:2px;background:#F1F3F5;}
.rpd-wrap .rpd-pb-body{padding:14px 18px;}
.rpd-wrap .rpd-et{width:100%;border-collapse:collapse;}
.rpd-wrap .rpd-et th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;padding:6px 10px 8px;text-align:left;border-bottom:1px solid #E5E7EB;}
.rpd-wrap .rpd-et td{padding:9px 10px;border-bottom:1px solid #F3F4F6;font-size:12px;vertical-align:middle;}
.rpd-wrap .rpd-et tr:last-child td{border-bottom:none;}
.rpd-wrap .rpd-et tbody tr:hover td{background:#F9FAFB;}
.rpd-wrap .rpd-stag{display:inline-block;padding:2px 9px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;}
.rpd-wrap .rpd-pgbar{background:#E5E7EB;border-radius:2px;height:6px;overflow:hidden;}
.rpd-wrap .rpd-pgfill{height:6px;border-radius:2px;}
.rpd-wrap .rpd-act-sum{margin:12px 0 0;padding:12px 14px;background:#F8F9FA;border-radius:6px;border:1px solid #E5E7EB;}
.rpd-wrap .rpd-act-ttl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin:0 0 8px;}
.rpd-wrap .rpd-act-row{display:flex;}
.rpd-wrap .rpd-act-st{flex:1;}
.rpd-wrap .rpd-act-num{font-size:22px;font-weight:700;margin:0;}
.rpd-wrap .rpd-act-lbl{font-size:10px;color:#6B7280;margin:2px 0 0;}
.rpd-wrap .rpd-ft{border-top:1px solid #E5E7EB;padding-top:14px;margin-top:24px;display:flex;justify-content:space-between;align-items:center;}
.rpd-wrap .rpd-ft-brand{font-family:Georgia,serif;font-size:13px;color:#111827;font-weight:700;margin:0;letter-spacing:.3px;}
</style>`;

  let h = css;
  h += `<div class="rpd-wrap">`;

  // ── Topbar
  h += `<div class="rpd-tb">`;
  h += `<div><p class="rpd-tb-l">${companyName ? companyName + ' &nbsp;/&nbsp; ' : ''}${isVN ? 'Báo cáo tổng thể danh mục' : 'Portfolio Status Report'}</p>`;
  h += `<p class="rpd-tb-s">${quarter}</p></div>`;
  h += `<div style="text-align:right;"><div style="font-size:11px;color:#6B7280;">${today}</div><div style="font-size:10px;color:#9CA3AF;margin-top:2px;">PMO-${yyyymm}-001</div></div>`;
  h += `</div>`;

  h += `<div class="rpd-pg">`;

  // ── Zone 1 label
  h += `<div class="rpd-zlbl"><span class="rpd-znum">1</span>${isVN ? 'Tổng quan danh mục' : 'Portfolio Overview'}</div>`;

  // Headline
  const programName = data.programs.length === 1 ? data.programs[0].name : (isVN ? 'Danh mục' : 'Portfolio');
  const overallStatus = red.length > 0 ? 'RED' : (allProjects.some(p => p.rag === 'amber') ? 'AMBER' : 'GREEN');
  const overallStatusCol = overallStatus === 'RED' ? '#E53E3E' : overallStatus === 'AMBER' ? '#D97706' : '#38A169';
  h += `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid #E5E7EB;">`;
  h += `<div><div style="font-family:Georgia,serif;font-size:24px;font-weight:700;line-height:1.2;color:#111827;">${programName}</div>`;
  h += `<div style="font-size:11px;color:#6B7280;margin-top:6px;">${isVN?'Kỳ báo cáo':'Period'}: ${periodStart} → ${periodEnd} &nbsp;·&nbsp; ${allProjects.length} ${isVN?'Squad/Dự án':'Squad/Projects'} &nbsp;·&nbsp; ${isVN?'TB':'Avg'} ${data.kpi.avgCompletion}%</div></div>`;
  h += `<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">`;
  h += `<span style="display:inline-flex;align-items:center;gap:6px;background:${overallStatusCol}18;border:1px solid ${overallStatusCol}55;color:${overallStatusCol};padding:5px 14px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:1px;">&#9679; ${overallStatus}</span>`;
  h += `</div></div>`;

  // ── Summary Panel ─────────────────────────────────────────────────────────
  {
    const ragKey = red.length > 0 ? 'red' : allProjects.some(p => p.rag === 'amber') ? 'amber' : 'green';
    const summaryText = pickSummary(ragKey, isVN ? 'vn' : 'en');
    h += `<div style="background:#FAFAFA;border:1px solid #E5E7EB;border-left:4px solid ${overallStatusCol};border-radius:8px;padding:14px 20px;margin-bottom:22px;">`;
    h += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#9CA3AF;margin-bottom:8px;font-weight:600;">${isVN ? 'Tóm tắt' : 'Summary'}</div>`;
    h += `<p style="font-size:13px;color:#374151;line-height:1.7;margin:0;">${summaryText}</p>`;
    h += `</div>`;
  }

  // ── Pie 1: Epic-based overall status
  const pie1 = [
    {val:epicsDone,       color:'#16A34A',   label:isVN?'Hoàn thành':'Done'},
    {val:epicsInProg,     color:'#3B82F6',   label:isVN?'Đang triển khai':'In Progress'},
    {val:epicsNotStarted, color:'#D1D5DB',   label:isVN?'Chưa bắt đầu':'Not Started'},
  ].filter(s => s.val > 0);

  // ── Pie 2: Epic weight per program (total epics in program / total epics)
  const pie2Raw = data.programs.map((c, i) => {
    const total = c.projects.reduce((s, p) => s + (p.epicStats?.length ?? 0), 0);
    return {val:total, color:pCol(i), label:c.name};
  }).filter(s => s.val > 0);
  const noProgEpics = data.noProgramProjects.reduce((s, p) => s + (p.epicStats?.length ?? 0), 0);
  const pie2 = [...pie2Raw, ...(noProgEpics > 0 ? [{val:noProgEpics, color:'rgba(255,255,255,0.22)', label:isVN?'Không có CT':'No Program'}] : [])];
  const pie2Total = pie2.reduce((a, s) => a + s.val, 0);

  h += `<div class="rpd-pies">`;

  // Pie 1
  const p1Pct = epicsTotal > 0 ? Math.round(epicsDone / epicsTotal * 100) : 0;
  h += `<div class="rpd-pie-col"><div class="rpd-panel"><div class="rpd-ptitle">${isVN?'Tiến độ epic tổng thể':'Overall Epic Progress'}</div>`;
  h += `<div class="rpd-pie-lay"><div style="flex-shrink:0;">${svgDonut(pie1.map(s=>({val:s.val,color:s.color})),140,58,36,p1Pct)}</div><div class="rpd-pie-leg">`;
  pie1.forEach(s => {
    const pct = epicsTotal > 0 ? Math.round(s.val / epicsTotal * 100) : 0;
    h += `<div class="rpd-leg-row"><div class="rpd-leg-dot" style="background:${s.color};border:1px solid rgba(0,0,0,0.1);"></div>${s.label}<span class="rpd-leg-val">${s.val} <span style="color:#9CA3AF;font-size:10px;">(${pct}%)</span></span></div>`;
  });
  h += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">${isVN?'Tổng cộng':'Total'}: <strong style="color:#111827;">${epicsTotal}</strong> epic</div>`;
  h += `</div></div></div></div>`;

  // Pie 2
  h += `<div class="rpd-pie-col"><div class="rpd-panel"><div class="rpd-ptitle">${isVN?'Tỷ trọng epic theo chương trình':'Epic Weight by Program'}</div>`;
  h += `<div class="rpd-pie-lay"><div style="flex-shrink:0;">${svgDonut(pie2.map(s=>({val:s.val,color:s.color})))}</div><div class="rpd-pie-leg">`;
  pie2.forEach(s => {
    const pct = pie2Total > 0 ? Math.round(s.val / pie2Total * 100) : 0;
    const nm = s.label.length > 18 ? s.label.slice(0, 18) + '…' : s.label;
    h += `<div class="rpd-leg-row"><div class="rpd-leg-dot" style="background:${s.color};"></div>${nm}<span class="rpd-leg-val">${s.val} <span style="color:#9CA3AF;font-size:10px;">(${pct}%)</span></span></div>`;
  });
  h += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">${isVN?'Tổng cộng':'Total'}: <strong style="color:#111827;">${pie2Total}</strong> epic</div>`;
  h += `</div></div></div></div>`;

  h += `</div>`; // rpd-pies

  // ── Bar chart: Epic status per project (stacked: done / in-progress / not-started)
  const barItems = allProjects.map(p => ({
    label:      p.name,
    done:       (p.epicStats ?? []).filter(e => e.pct >= 100).length,
    inProg:     (p.epicStats ?? []).filter(e => e.pct > 0 && e.pct < 100).length,
    notStarted: (p.epicStats ?? []).filter(e => e.pct === 0).length,
    total:      (p.epicStats ?? []).length,
  }));

  h += `<div class="rpd-bar-panel"><div class="rpd-panel">`;
  h += `<div class="rpd-ptitle">${isVN?'Trạng thái epic theo Squad/Dự án':'Epic Status per Squad/Project'}</div>`;
  h += `<div>${svgBarChart(barItems, Math.max(600, barItems.length * 80), 160)}</div>`;
  h += `<div style="display:flex;gap:18px;margin-top:10px;justify-content:center;">`;
  h += `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#6B7280;"><div style="width:10px;height:10px;border-radius:2px;background:#16A34A;display:inline-block;"></div>${isVN?'Hoàn thành':'Done'}</div>`;
  h += `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#6B7280;"><div style="width:10px;height:10px;border-radius:2px;background:#3B82F6;display:inline-block;"></div>${isVN?'Đang triển khai':'In Progress'}</div>`;
  h += `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#6B7280;"><div style="width:10px;height:10px;border-radius:2px;background:#E5E7EB;border:1px solid #D1D5DB;display:inline-block;"></div>${isVN?'Chưa bắt đầu':'Not Started'}</div>`;
  h += `</div></div></div>`;

  // ── Personnel Section — FTE-based resource allocation & headcount coverage ─
  if (data.fteStats) {
    const fs = data.fteStats;
    const ps = data.personnelStats;
    const totalUsedFte = fs.deliveryFte + fs.overheadProjectFte + fs.overheadRemainingFte;
    const overheadTotalFte = parseFloat((fs.overheadProjectFte + fs.overheadRemainingFte).toFixed(1));
    const donutBase = fs.headcountQuota > 0 ? fs.headcountQuota : parseFloat((totalUsedFte + fs.benchFte).toFixed(1));
    const deliveryPct  = donutBase > 0 ? Math.round((fs.deliveryFte     / donutBase) * 100) : 0;
    const overheadPct  = donutBase > 0 ? Math.round((overheadTotalFte   / donutBase) * 100) : 0;
    const benchPct     = donutBase > 0 ? Math.round((fs.benchFte        / donutBase) * 100) : 0;
    const utilColor    = fs.utilizationPct >= 95 ? '#DC2626' : fs.utilizationPct >= 70 ? '#D97706' : '#16A34A';
    const fillColor    = fs.blockFillRate  >= 90 ? '#16A34A' : fs.blockFillRate  >= 70 ? '#D97706' : '#DC2626';
    const hireColor    = fs.peopleNeeded   === 0 ? '#16A34A' : '#DC2626';

    // KPI card helper (inline)
    const kpiCard = (title: string, val: string, unit: string, valCol: string, bg: string) =>
      `<div style="background:${bg};border:1px solid ${valCol}22;border-radius:8px;padding:14px 10px;text-align:center;">` +
      `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin-bottom:6px;">${title}</div>` +
      `<div style="font-size:26px;font-weight:700;color:${valCol};line-height:1;">${val}</div>` +
      `<div style="font-size:10px;color:#9CA3AF;margin-top:4px;">${unit}</div></div>`;

    h += `<div style="margin-top:14px;">`;
    h += `<div class="rpd-zlbl" style="color:#0891B2;"><span class="rpd-znum" style="background:#0891B2;">NS</span>${isVN?'Phân bổ nguồn lực &amp; độ phủ định biên toàn khối':'Resource Allocation &amp; Block Headcount Coverage'}</div>`;

    // ── 5 KPI cards
    h += `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px;">`;
    h += kpiCard(isVN?'Định biên':'Headcount Quota', fs.headcountQuota > 0 ? String(fs.headcountQuota) : '—', isVN?'người':'people', '#111827', '#F8F9FA');
    h += kpiCard(isVN?'FTE khả dụng net':'Net Used FTE', totalUsedFte.toFixed(1), '%FTE', '#2563EB', '#EFF6FF');
    h += kpiCard('Utilization', fs.headcountQuota > 0 ? `${fs.utilizationPct}%` : '—', isVN?'của định biên':'of quota', utilColor, `${utilColor}11`);
    h += kpiCard(isVN?'Fill rate khối':'Block Fill Rate', fs.programFillRates.length > 0 ? `${fs.blockFillRate}%` : '—', '% FTE', fillColor, `${fillColor}11`);
    h += kpiCard(isVN?'Cần tuyển':'Hire Needed', String(fs.peopleNeeded), isVN?'người':'people', hireColor, `${hireColor}11`);
    h += `</div>`;

    // ── Donut + Fill rate bar + Narrative (3 cols)
    h += `<div style="display:grid;grid-template-columns:1fr 1.2fr 1.5fr;gap:12px;margin-bottom:14px;">`;

    // Col 1: Donut — Delivery / Overhead / Bench
    const donutSegs = [
      { val: fs.deliveryFte,   color: '#2563EB' },
      { val: overheadTotalFte, color: '#D97706' },
      { val: fs.benchFte,      color: '#D1D5DB' },
    ].filter(s => s.val > 0);
    h += `<div class="rpd-panel">`;
    h += `<div class="rpd-ptitle">${isVN?'Cơ cấu năng lực khối (FTE)':'Block Capacity Structure (FTE)'}</div>`;
    h += `<div class="rpd-pie-lay"><div style="flex-shrink:0;">${svgDonut(donutSegs, 120, 48, 30, deliveryPct)}</div>`;
    h += `<div class="rpd-pie-leg">`;
    const donutLegend = [
      { label: 'Delivery', val: fs.deliveryFte,   pct: deliveryPct,  color: '#2563EB' },
      { label: 'Overhead', val: overheadTotalFte,  pct: overheadPct,  color: '#D97706' },
      { label: 'Bench',    val: fs.benchFte,        pct: benchPct,     color: '#D1D5DB' },
    ];
    donutLegend.forEach(l => {
      h += `<div class="rpd-leg-row"><div class="rpd-leg-dot" style="background:${l.color};border:1px solid rgba(0,0,0,0.1);"></div>${l.label}<span class="rpd-leg-val">${l.val.toFixed(1)} <span style="color:#9CA3AF;font-size:10px;">(${l.pct}%)</span></span></div>`;
    });
    h += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB;font-size:10px;color:#6B7280;">${isVN?'Tổng định biên':'Quota'}: <strong style="color:#111827;">${fs.headcountQuota > 0 ? fs.headcountQuota : donutBase} ${isVN?'người':'ppl'}</strong></div>`;
    h += `</div></div></div>`;

    // Col 2: Horizontal bar chart — fill rate by program
    h += `<div class="rpd-panel">`;
    h += `<div class="rpd-ptitle">${isVN?'Fill rate theo Program (FTE)':'Fill Rate by Program (FTE)'}</div>`;
    if (fs.programFillRates.length > 0) {
      h += svgHBarChart(fs.programFillRates);
      h += `<div style="display:flex;gap:12px;margin-top:8px;font-size:10px;color:#6B7280;">`;
      h += `<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:2px;background:#16A34A;display:inline-block;"></span>≥90%</span>`;
      h += `<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:2px;background:#D97706;display:inline-block;"></span>70–89%</span>`;
      h += `<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:2px;background:#DC2626;display:inline-block;"></span>&lt;70%</span>`;
      h += `</div>`;
    } else {
      h += `<p style="font-size:11px;color:#9CA3AF;margin:12px 0;">${isVN?'Chưa có dữ liệu phân bổ program.':'No program allocation data.'}</p>`;
    }
    h += `</div>`;

    // Col 3: Overallocated people list (>2 projects)
    {
      const overalloc = ps ? ps.overallocated : [];
      h += `<div class="rpd-panel" style="display:flex;flex-direction:column;gap:0;">`;
      h += `<div class="rpd-ptitle">${isVN?'Nhân sự tham gia &gt; 2 Squad/Dự án':'Personnel in &gt; 2 Squad/Projects'}</div>`;
      if (overalloc.length === 0) {
        h += `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:#16A34A;">`;
        h += `<span style="width:8px;height:8px;border-radius:50%;background:#16A34A;flex-shrink:0;display:inline-block;"></span>`;
        h += `${isVN?'Không có nhân sự nào đang tham gia hơn 2 Squad/Dự án.':'No personnel currently in more than 2 Squad/Projects.'}`;
        h += `</div>`;
      } else {
        h += `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:4px;">`;
        h += `<thead><tr>`;
        h += `<th style="text-align:left;padding:4px 8px 6px;color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E5E7EB;">${isVN?'Nhân sự':'Name'}</th>`;
        h += `<th style="text-align:left;padding:4px 8px 6px;color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E5E7EB;">${isVN?'Vai trò':'Role'}</th>`;
        h += `<th style="text-align:center;padding:4px 8px 6px;color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E5E7EB;">${isVN?'Số DA':'#'}</th>`;
        h += `<th style="text-align:left;padding:4px 8px 6px;color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E5E7EB;">${isVN?'Danh sách Squad/DA':'Squad/Projects'}</th>`;
        h += `</tr></thead><tbody>`;
        overalloc.forEach(person => {
          const projStr = person.projects.join(', ');
          const projDisplay = projStr.length > 38 ? projStr.slice(0, 38) + '…' : projStr;
          h += `<tr>`;
          h += `<td style="padding:6px 8px;border-bottom:1px solid #F3F4F6;font-weight:600;color:#111827;">${person.name}</td>`;
          h += `<td style="padding:6px 8px;border-bottom:1px solid #F3F4F6;color:#6B7280;">${person.role || '—'}</td>`;
          h += `<td style="padding:6px 8px;border-bottom:1px solid #F3F4F6;text-align:center;"><span style="background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:4px;padding:1px 7px;font-weight:700;">${person.projects.length}</span></td>`;
          h += `<td style="padding:6px 8px;border-bottom:1px solid #F3F4F6;color:#6B7280;font-size:10px;">${projDisplay}</td>`;
          h += `</tr>`;
        });
        h += `</tbody></table>`;
        h += `<div style="margin-top:8px;padding:6px 10px;background:#FEF2F2;border-radius:4px;font-size:11px;color:#DC2626;">[!] ${isVN?'Cần rà soát phân bổ để đảm bảo chất lượng và tiến độ.':'Review allocations to ensure quality and delivery.'}</div>`;
      }
      h += `</div>`;
    }

    h += `</div>`; // 3-col grid
    h += `</div>`; // personnel section
  }

  h += `<div class="rpd-zsep"></div>`;

  // ── Zone 2
  h += `<div class="rpd-zlbl"><span class="rpd-znum">2</span>${isVN?'Chi tiết Squad/Dự án & tiến độ Epic':'Squad/Project Details & Epic Progress'}</div>`;

  // Summary pills (3 per row)
  for (let ri = 0; ri < allProjects.length; ri += 3) {
    const chunk = allProjects.slice(ri, ri + 3);
    h += `<div class="rpd-sum-row">`;
    chunk.forEach((p, ci) => {
      const color = pCol(ri + ci);
      const ragC = ragCol(p.rag);
      h += `<div class="rpd-pill">`;
      h += `<div class="rpd-pill-hd"><div class="rpd-pill-ico" style="background:${color}22;color:${color};">${p.name.slice(0,2).toUpperCase()}</div>`;
      h += `<div style="flex:1;min-width:0;"><p class="rpd-pill-nm">${p.name}</p>${p.program_name?`<p class="rpd-pill-sb">${p.program_name}</p>`:''}</div>`;
      h += `<div style="margin-left:8px;text-align:right;flex-shrink:0;"><div style="font-size:20px;font-weight:700;color:${color};line-height:1;">${p.completion_pct}%</div><div style="font-size:10px;color:${ragC};font-weight:700;margin-top:2px;">${p.rag.toUpperCase()}</div></div></div>`;
      h += `<div style="font-size:11px;color:#6B7280;margin-bottom:6px;">${(p.epicStats??[]).length} epic &nbsp;·&nbsp; ${p.total_activities??0} activity</div>`;
      h += `<div class="rpd-bar-tr"><div class="rpd-bar-fi" style="width:${p.completion_pct}%;background:${color};"></div></div>`;
      if (p.epicStats && p.epicStats.length > 0) {
        h += `<div class="rpd-ep-dots">`;
        p.epicStats.slice(0, 5).forEach(e => {
          const st = epicSt(e.pct);
          const ec = epicStCol(st);
          h += `<span class="rpd-ep-dot" style="border-color:${ec}30;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${ec};vertical-align:middle;"></span>${e.phase.length>16?e.phase.slice(0,16)+'…':e.phase}</span>`;
        });
        h += `</div>`;
      }
      h += `</div>`;
    });
    for (let fi = chunk.length; fi < 3; fi++) h += `<div style="flex:1;min-width:0;"></div>`;
    h += `</div>`;
  }


  // ── Legend / Annotation
  h += `<div class="rpd-zsep"></div>`;
  h += `<div class="rpd-zlbl"><span class="rpd-znum" style="background:#6B7280;">?</span>${isVN?'Chú thích & Phương pháp tính':'Legend & Methodology'}</div>`;
  h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">`;

  // RAG legend
  h += `<div class="rpd-panel">`;
  h += `<div class="rpd-ptitle">${isVN?'Chỉ số sức khỏe RAG':'RAG Health Indicator'}</div>`;
  h += `<div style="display:flex;flex-direction:column;gap:8px;font-size:12px;">`;
  h += `<div style="display:flex;align-items:flex-start;gap:8px;"><span style="margin-top:2px;width:10px;height:10px;border-radius:50%;background:#DC2626;flex-shrink:0;display:inline-block;"></span><div><strong style="color:#DC2626;">RED</strong><br><span style="color:#6B7280;font-size:11px;">${isVN?'Deadline quá hạn HOẶC ≥3 risks mở':'Past deadline OR ≥3 open risks'}</span></div></div>`;
  h += `<div style="display:flex;align-items:flex-start;gap:8px;"><span style="margin-top:2px;width:10px;height:10px;border-radius:50%;background:#D97706;flex-shrink:0;display:inline-block;"></span><div><strong style="color:#D97706;">AMBER</strong><br><span style="color:#6B7280;font-size:11px;">${isVN?'Deadline ≤14 ngày HOẶC ≥1 risk/issue mở HOẶC tiến độ <30%':'Deadline ≤14 days OR ≥1 open risk/issue OR progress <30%'}</span></div></div>`;
  h += `<div style="display:flex;align-items:flex-start;gap:8px;"><span style="margin-top:2px;width:10px;height:10px;border-radius:50%;background:#16A34A;flex-shrink:0;display:inline-block;"></span><div><strong style="color:#16A34A;">GREEN</strong><br><span style="color:#6B7280;font-size:11px;">${isVN?'Không có điều kiện nào ở trên. Phase Closing → luôn GREEN.':'None of the above conditions. Phase Closing → always GREEN.'}</span></div></div>`;
  h += `</div></div>`;

  // Completion % legend
  h += `<div class="rpd-panel">`;
  h += `<div class="rpd-ptitle">${isVN?'Cách tính tiến độ (weighted)':'Progress Calculation (weighted)'}</div>`;
  h += `<div style="font-size:11px;color:#6B7280;line-height:1.7;">`;
  h += `<div>${isVN?'Tiến độ = Σ(trọng số trạng thái) / Tổng activity':'Progress = Σ(status weight) / Total activities'}</div>`;
  h += `<div style="margin-top:8px;display:flex;flex-direction:column;gap:3px;">`;
  h += `<div style="display:flex;justify-content:space-between;"><span>Done / Deployed / UAT</span><strong style="color:#16A34A;">1.0</strong></div>`;
  h += `<div style="display:flex;justify-content:space-between;"><span>Re-Open / QC Done</span><strong style="color:#16A34A;">0.7 – 1.0</strong></div>`;
  h += `<div style="display:flex;justify-content:space-between;"><span>In Testing / PENDING</span><strong style="color:#3B82F6;">0.5 – 0.6</strong></div>`;
  h += `<div style="display:flex;justify-content:space-between;"><span>In Review / In Progress</span><strong style="color:#D97706;">0.3 – 0.5</strong></div>`;
  h += `<div style="display:flex;justify-content:space-between;"><span>In Dev / Ready For Dev</span><strong style="color:#D97706;">0.2</strong></div>`;
  h += `<div style="display:flex;justify-content:space-between;"><span>To Do / REFINEMENT</span><strong style="color:#9CA3AF;">0.1</strong></div>`;
  h += `<div style="display:flex;justify-content:space-between;"><span>New / Blocked</span><strong style="color:#DC2626;">0.0</strong></div>`;
  h += `</div></div></div>`;

  // Epic status legend
  h += `<div class="rpd-panel">`;
  h += `<div class="rpd-ptitle">${isVN?'Trạng thái Epic':'Epic Status'}</div>`;
  h += `<div style="font-size:11px;color:#6B7280;line-height:1.7;">`;
  h += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="width:10px;height:10px;border-radius:2px;background:#16A34A;"></div><span>${isVN?'Hoàn thành: tiến độ epic = 100%':'Done: epic progress = 100%'}</span></div>`;
  h += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="width:10px;height:10px;border-radius:2px;background:#3B82F6;"></div><span>${isVN?'Đang triển khai: 1% – 99%':'In Progress: 1% – 99%'}</span></div>`;
  h += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><div style="width:10px;height:10px;border-radius:2px;background:#D1D5DB;border:1px solid #9CA3AF;"></div><span>${isVN?'Chưa bắt đầu: tiến độ epic = 0%':'Not Started: epic progress = 0%'}</span></div>`;
  h += `<div style="color:#9CA3AF;font-size:10px;border-top:1px solid #E5E7EB;padding-top:8px;">${isVN?'Start/End date: ưu tiên ngày thực tế (actual), fallback về ngày kế hoạch (plan). Hiển thị N/A nếu chưa có dữ liệu.':'Start/End date: actual dates preferred, fallback to planned dates. Shows N/A if no data.'}</div>`;
  h += `</div></div>`;

  h += `</div>`; // grid

  // ── Footer
  h += `<div class="rpd-ft">`;
  if (companyName) h += `<p class="rpd-ft-brand">${companyName}</p>`;
  h += `<div style="font-size:11px;color:#9CA3AF;">${isVN?'Tài liệu mật · Dành cho Ban Lãnh Đạo':'Confidential · For Leadership Only'}</div>`;
  h += `<div style="font-size:11px;color:#9CA3AF;">${isVN?'Phát hành':'Published'}: ${today}</div>`;
  h += `</div>`;

  h += `</div></div>`; // .rpd-pg + .rpd-wrap
  return h;
}

function getThisMonday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}
function getThisSunday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + 6);
  return d.toISOString().slice(0, 10);
}
function fmtDateShort(s: string) {
  if (!s) return '';
  try { return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return s; }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PortfolioReportPage() {
  const [data, setData] = useState<PortfolioReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState('');
  const [generating, setGenerating] = useState(false);
  const [language, setLanguage] = useState<'Vietnamese' | 'English'>('Vietnamese');
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [apiKeySet, setApiKeySet] = useState<false | 'db' | 'env'>(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [ceoEmail, setCeoEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  // Date range for "completed in period"
  const [periodStart, setPeriodStart] = useState(getThisMonday);
  const [periodEnd, setPeriodEnd] = useState(getThisSunday);
  const [companyName, setCompanyName] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [htmlReport, setHtmlReport] = useState('');
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [showProjectSelector, setShowProjectSelector] = useState(false);

  const loadConfig = useCallback(async () => {
    const res = await fetch('/api/config');
    const d = await res.json();
    if (d.anthropic_api_key_set === 'env') setApiKeySet('env');
    else if (d.anthropic_api_key_set === 'true') setApiKeySet('db');
    else setApiKeySet(false);
    if (d.ceo_email) setCeoEmail(d.ceo_email);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolio/report?start=${periodStart}&end=${periodEnd}`);
      const d = await res.json();
      setData(d);
      setReport(''); setHtmlReport('');
    } finally {
      setLoading(false);
    }
  }, [periodStart, periodEnd]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.company_name) setCompanyName(d.company_name); });
  }, []);

  // Initialize (or reset) selected projects whenever data reloads
  useEffect(() => {
    if (data) {
      const all = [...data.programs.flatMap(c => c.projects), ...data.noProgramProjects];
      setSelectedProjectIds(new Set(all.map(p => p.id)));
    }
  }, [data]);

  const saveApiKey = async () => {
    if (!apiKeyInput.startsWith('sk-ant-')) { toast.error('Invalid key — must start with sk-ant-'); return; }
    setSavingKey(true);
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anthropic_api_key: apiKeyInput }) });
    setApiKeyInput(''); setShowKeyInput(false);
    await loadConfig(); setSavingKey(false);
    toast.success('API key saved!');
  };

  const saveCeoEmail = async () => {
    setSavingEmail(true);
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ceo_email: ceoEmail }) });
    setSavingEmail(false);
    toast.success('CEO email saved!');
  };

  const generateManual = () => {
    if (!data) return;
    const fd = selectedProjectIds.size > 0 ? filterDataByProjects(data, selectedProjectIds) : data;
    setReport(buildTemplateReport(fd, language, periodStart, periodEnd, companyName));
    setHtmlReport(buildHtmlReport(fd, language, periodStart, periodEnd, companyName));
    setViewMode('preview');
    toast.success(`Portfolio report generated (${fd.kpi.totalProjects} projects)!`);
  };

  const generateAI = async () => {
    if (!data) return;
    setGenerating(true);
    setReport('');
    try {
      const fd = selectedProjectIds.size > 0 ? filterDataByProjects(data, selectedProjectIds) : data;
      const portfolioPayload = {
        reportDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        periodStart,
        periodEnd,
        kpi: fd.kpi,
        programs: fd.programs.map(c => ({
          name: c.name, industry: c.industry,
          projects: c.projects.map(p => ({
            name: p.name, program_name: p.program_name, current_phase: p.current_phase,
            completion_pct: p.completion_pct, open_risks: p.open_risks, open_issues: p.open_issues,
            days_until_deadline: p.days_until_deadline, rag: p.rag, pm_name: p.pm_name,
            done_activities: p.done_activities, in_progress_activities: p.in_progress_activities,
            not_started_activities: p.not_started_activities, total_activities: p.total_activities,
            epicStats: p.epicStats,
          })),
        })),
        noProgramProjects: fd.noProgramProjects.map(p => ({
          name: p.name, program_name: '', current_phase: p.current_phase,
          completion_pct: p.completion_pct, open_risks: p.open_risks, open_issues: p.open_issues,
          days_until_deadline: p.days_until_deadline, rag: p.rag, pm_name: p.pm_name,
          done_activities: p.done_activities, in_progress_activities: p.in_progress_activities,
          not_started_activities: p.not_started_activities, total_activities: p.total_activities,
          epicStats: p.epicStats,
        })),
        topRisks: fd.topRisks.map(r => ({ priority: r.priority, description: r.description, project_name: r.project_name, program_name: r.program_name || '' })),
        topIssues: fd.topIssues.map(i => ({ priority: i.priority, description: i.description, project_name: i.project_name, program_name: i.program_name || '' })),
        upcomingMilestones: fd.upcomingMilestones.map(m => ({ plan_end: m.plan_end, activity: m.activity, project_name: m.project_name })),
        completedByProject: fd.completedByProject,
        language,
      };
      const res = await fetch('/api/portfolio/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioData: portfolioPayload, language }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.error === 'NO_API_KEY') { toast.error('API key not configured.'); setShowKeyInput(true); }
        else toast.error(d.error ?? 'AI generation failed');
        return;
      }
      setReport(d.report);
      setHtmlReport(mdToHtml(d.report));
      setViewMode('preview');
      toast.success('AI portfolio report generated!');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => mode === 'ai' ? generateAI() : generateManual();

  const copyReport = async () => {
    if (viewMode === 'preview' && htmlReport) {
      try {
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"><style type="text/css">a,a:link,a:visited,a:hover{color:inherit!important;text-decoration:none!important;}</style></head><body style="margin:0;padding:0;background:#f8fafc;">${htmlReport}</body></html>`;
        const blob = new Blob([fullHtml], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
        toast.success('Copied with formatting — paste directly into email!');
        return;
      } catch {
        // ClipboardItem not supported, fall through to plain text
      }
    }
    navigator.clipboard.writeText(report);
    toast.success('Copied to clipboard!');
  };

  const exportTxt = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PortfolioReport_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHtml = () => {
    if (!htmlReport) return;
    const bg = '#FFFFFF';
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"><title>Portfolio Report</title><style type="text/css">a,a:link,a:visited,a:hover{color:inherit!important;text-decoration:none!important;}</style></head><body style="margin:0;background:${bg};">${htmlReport}</body></html>`;
    const blob = new Blob([full], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `PortfolioReport_${new Date().toISOString().slice(0, 10)}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPng = async () => {
    if (!htmlReport || !previewRef.current) return;
    setExporting('png');
    const el = previewRef.current;
    const prevOverflow = el.style.overflow;
    el.style.overflow = 'visible';
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, { pixelRatio: 1.5, backgroundColor: '#FFFFFF', cacheBust: true });
      el.style.overflow = prevOverflow;
      const a = document.createElement('a');
      a.download = `PortfolioReport_${new Date().toISOString().slice(0, 10)}.png`;
      a.href = dataUrl;
      a.click();
      toast.success('Đã xuất PNG!');
    } catch {
      el.style.overflow = prevOverflow;
      toast.error('Xuất PNG thất bại');
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!htmlReport || !previewRef.current) return;
    setExporting('pdf');
    const el = previewRef.current;
    const prevOverflow = el.style.overflow;
    el.style.overflow = 'visible';
    try {
      const { toJpeg } = await import('html-to-image');
      const dataUrl = await toJpeg(el, { pixelRatio: 3, quality: 0.95, backgroundColor: '#FFFFFF', cacheBust: true });
      el.style.overflow = prevOverflow;
      const { jsPDF } = await import('jspdf');
      const imgW = el.scrollWidth * 3;
      const imgH = el.scrollHeight * 3;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const scaledH = pdfW * (imgH / imgW);
      let y = 0;
      pdf.addImage(dataUrl, 'JPEG', 0, y, pdfW, scaledH);
      let remaining = scaledH - pdfH;
      while (remaining > 0) {
        y -= pdfH;
        pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, y, pdfW, scaledH);
        remaining -= pdfH;
      }
      pdf.save(`PortfolioReport_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Đã xuất PDF!');
    } catch {
      el.style.overflow = prevOverflow;
      toast.error('Xuất PDF thất bại');
    } finally {
      setExporting(null);
    }
  };

  const sendEmail = async () => {
    if (!report) { toast.error('Generate a report first'); return; }
    const subject = encodeURIComponent(`[${companyName}] Portfolio Status Report — ${new Date().toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' })}`);
    // Try to copy HTML to clipboard so paste into email body preserves formatting
    if (htmlReport) {
      try {
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"><style type="text/css">a,a:link,a:visited,a:hover{color:inherit!important;text-decoration:none!important;}</style></head><body style="margin:0;padding:0;background:#f8fafc;">${htmlReport}</body></html>`;
        const blob = new Blob([fullHtml], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
      } catch {
        navigator.clipboard.writeText(report).catch(() => {});
      }
    } else {
      navigator.clipboard.writeText(report).catch(() => {});
    }
    const shortBody = encodeURIComponent(
      `${language === 'Vietnamese' ? 'Kính gửi,' : 'Dear CEO,'}\n\nPlease find the portfolio status report below.\n\n[Report content copied to clipboard — paste here]\n\n---\nSent via ${companyName ? companyName + ' ' : ''}PMO`
    );
    window.open(`mailto:${ceoEmail}?subject=${subject}&body=${shortBody}`, '_self');
    toast.success('Email client opened. Report copied — paste into email body to keep formatting.');
  };

  const allProjects = data ? [...data.programs.flatMap(c => c.projects), ...data.noProgramProjects] : [];
  const red = allProjects.filter(p => p.rag === 'red');
  const amber = allProjects.filter(p => p.rag === 'amber');
  const green = allProjects.filter(p => p.rag === 'green');
  const isVN = language === 'Vietnamese';

  // Sorted projects for table: red → amber → green
  const sortedProjects = [...allProjects].sort((a, b) => {
    const o: Record<string, number> = { red: 0, amber: 1, green: 2 };
    return o[a.rag] - o[b.rag];
  });

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-5">

          {/* ── 1. Header ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Portfolio Status Report
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                PMO-Grade Portfolio Report · {companyName}
                {data?.reportDate && (
                  <span className="ml-2 text-slate-400">· {fmtDate(data.reportDate)}</span>
                )}
              </p>
            </div>
          </div>

          {/* ── 2. KPI Bar ── */}
          {data && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-white border rounded-xl px-4 py-3">
                <div className="text-2xl font-bold text-slate-800">{data.kpi.totalProjects}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Total Projects</div>
              </div>
              <div className="bg-white border rounded-xl px-4 py-3">
                <div className="text-2xl font-bold text-slate-800">{data.kpi.activeProjects}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Active</div>
              </div>
              <div className="bg-white border rounded-xl px-4 py-3">
                <div className="text-2xl font-bold text-slate-800">{data.kpi.totalPrograms}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Programs</div>
              </div>
              <div className="bg-white border rounded-xl px-4 py-3">
                <div className="text-2xl font-bold text-slate-800">{data.kpi.avgCompletion}%</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Avg. Completion</div>
              </div>
              <div className={`rounded-xl px-4 py-3 border ${data.kpi.totalOpenRisks > 0 ? 'bg-red-50 border-red-100' : 'bg-white'}`}>
                <div className={`text-2xl font-bold ${data.kpi.totalOpenRisks > 0 ? 'text-red-600' : 'text-slate-800'}`}>{data.kpi.totalOpenRisks}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Open Risks</div>
              </div>
              <div className={`rounded-xl px-4 py-3 border ${data.kpi.totalOpenIssues > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white'}`}>
                <div className={`text-2xl font-bold ${data.kpi.totalOpenIssues > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{data.kpi.totalOpenIssues}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Open Issues</div>
              </div>
            </div>
          )}

          {/* ── 3. RAG Health Bar ── */}
          {data && (
            <div className="bg-white border rounded-xl px-5 py-4">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-semibold text-slate-600">Portfolio Health:</span>
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 border border-red-200 text-red-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> {red.length} RED
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> {amber.length} AMBER
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 border border-green-200 text-green-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> {green.length} GREEN
                </span>
              </div>
              {red.length > 0 && (
                <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {red.length} project{red.length !== 1 ? 's' : ''} require{red.length === 1 ? 's' : ''} immediate attention
                </div>
              )}
            </div>
          )}

          {/* ── 4. Date Range + Completed in Period ── */}
          <div className="bg-white border rounded-xl p-4 space-y-4">
            {/* Date range picker */}
            <div className="flex items-center gap-3 flex-wrap">
              <CalendarRange className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-sm font-semibold text-slate-600">Reporting Period:</span>
              <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-1.5">
                <label className="text-xs text-slate-400">From</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={e => setPeriodStart(e.target.value)}
                  className="text-sm border-none outline-none bg-transparent"
                />
                <span className="text-xs text-slate-300">→</span>
                <label className="text-xs text-slate-400">To</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                  className="text-sm border-none outline-none bg-transparent"
                />
              </div>
              <Button onClick={loadData} variant="outline" className="h-8 gap-1.5 text-xs" disabled={loading}>
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Reload
              </Button>
              <span className="text-xs text-slate-400 ml-auto">
                {data ? `${Object.values(data.completedByProject).reduce((s, g) => s + g.activities.length, 0)} activities completed in period` : ''}
              </span>
            </div>

            {/* Completed by project */}
            {data && Object.keys(data.completedByProject).length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-800 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-xs font-bold text-white">
                    III. Completed in Period — {fmtDateShort(periodStart)} → {fmtDateShort(periodEnd)}
                  </span>
                  <Badge className="ml-auto bg-green-600 text-white border-0 text-[10px]">
                    {Object.values(data.completedByProject).reduce((s, g) => s + g.activities.length, 0)} items
                  </Badge>
                </div>
                <div className="divide-y divide-slate-100">
                  {Object.values(data.completedByProject).map((group, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-700">{group.project_name}</span>
                        {group.program_name && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <Building2 className="h-3 w-3" />{group.program_name}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 ml-auto">{group.current_phase}</span>
                      </div>
                      <ul className="space-y-1">
                        {group.activities.map(a => (
                          <li key={a.id} className="flex items-start gap-2 text-xs">
                            <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                            <span className="text-slate-700">{a.activity}</span>
                            {a.deliverable && <span className="text-slate-400">→ {a.deliverable}</span>}
                            {a.actual_end && <span className="text-slate-300 ml-auto shrink-0">{a.actual_end}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data && Object.keys(data.completedByProject).length === 0 && (
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-lg text-xs text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                No completed activities in {fmtDateShort(periodStart)} → {fmtDateShort(periodEnd)}
              </div>
            )}
          </div>

          {/* ── 5. Controls Card ── */}
          <div className="bg-white border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={language} onValueChange={v => setLanguage((v ?? 'Vietnamese') as 'Vietnamese' | 'English')}>
                <SelectTrigger className="w-40 h-9 text-sm bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vietnamese">🇻🇳 Tiếng Việt</SelectItem>
                  <SelectItem value="English">🇬🇧 English</SelectItem>
                </SelectContent>
              </Select>

              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setMode('manual')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'manual' ? 'bg-white shadow text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Eye className="h-3.5 w-3.5" /> Template
                  </button>
                  <button
                    onClick={() => setMode('ai')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'ai' ? 'bg-white shadow text-violet-700' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> AI (Claude)
                  </button>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={generating || loading || !data}
                  className={`h-9 gap-2 text-sm ${mode === 'ai' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {mode === 'ai'
                    ? <><Sparkles className={`h-3.5 w-3.5 ${generating ? 'animate-pulse' : ''}`} />{generating ? 'Generating...' : 'Generate AI'}</>
                    : <><Eye className="h-3.5 w-3.5" />Generate Report</>
                  }
                </Button>
              </div>
            </div>

            {/* Project selector */}
            {data && allProjects.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <button
                  onClick={() => setShowProjectSelector(v => !v)}
                  className="flex items-center gap-2 w-full text-left group"
                >
                  <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800">Squad/Dự án đưa vào báo cáo</span>
                  <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-semibold border ${selectedProjectIds.size < allProjects.length ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                    {selectedProjectIds.size} / {allProjects.length}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 ml-auto transition-transform duration-200 ${showProjectSelector ? 'rotate-180' : ''}`} />
                </button>
                {showProjectSelector && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedProjectIds(new Set(allProjects.map(p => p.id)))}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >Chọn tất cả</button>
                      <span className="text-slate-200">|</span>
                      <button
                        onClick={() => setSelectedProjectIds(new Set())}
                        className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                      >Bỏ chọn tất cả</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-60 overflow-y-auto pr-1">
                      {allProjects.map(p => {
                        const checked = selectedProjectIds.has(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs ${checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                setSelectedProjectIds(prev => {
                                  const next = new Set(prev);
                                  e.target.checked ? next.add(p.id) : next.delete(p.id);
                                  return next;
                                });
                              }}
                              className="w-3.5 h-3.5 rounded accent-blue-600 shrink-0"
                            />
                            <span className={`w-2 h-2 rounded-full shrink-0 ${RAG_DOT[p.rag]}`} />
                            <span className={`truncate font-medium ${checked ? 'text-slate-800' : 'text-slate-500'}`}>{p.name}</span>
                            {p.program_name && (
                              <span className="text-slate-400 ml-auto shrink-0 text-[10px]">{p.program_name.slice(0, 12)}</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === 'ai' && (
              <div className={`rounded-lg px-4 py-3 text-xs flex items-center gap-3 flex-wrap border ${apiKeySet ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <KeyRound className={`h-4 w-4 shrink-0 ${apiKeySet ? 'text-green-600' : 'text-amber-500'}`} />
                {apiKeySet === 'env' && <span className="text-green-700 font-medium">API key from environment ✓</span>}
                {apiKeySet === 'db' && <span className="text-green-700 font-medium">Anthropic API key configured ✓</span>}
                {!apiKeySet && (
                  <>
                    <span className="text-amber-700">API key not configured.</span>
                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">Get key at console.anthropic.com →</a>
                  </>
                )}
                {apiKeySet !== 'env' && (
                  <button onClick={() => setShowKeyInput(v => !v)} className="underline text-slate-500 hover:text-slate-700 ml-auto">
                    {apiKeySet ? 'Change key' : 'Enter key'}
                  </button>
                )}
                {showKeyInput && (
                  <div className="w-full flex gap-2 mt-1">
                    <Input className="h-8 text-xs font-mono flex-1" type="password" placeholder="sk-ant-api03-..." value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveApiKey()} />
                    <Button onClick={saveApiKey} disabled={savingKey} className="h-8 text-xs bg-green-600 hover:bg-green-700 shrink-0">{savingKey ? 'Saving...' : 'Save'}</Button>
                    <Button variant="outline" onClick={() => setShowKeyInput(false)} className="h-8 text-xs shrink-0">Cancel</Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 5. Portfolio Health Matrix ── */}
          {data && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-slate-300" />
                  II. Portfolio Health Matrix
                </h2>
                <Badge className="bg-slate-600 text-slate-200 border-0 text-xs">{allProjects.length} projects</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left w-8">#</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-left">Project</th>
                      <th className="px-4 py-2.5 text-left">Program</th>
                      <th className="px-4 py-2.5 text-left">Phase</th>
                      <th className="px-4 py-2.5 text-left w-32">Progress</th>
                      <th className="px-4 py-2.5 text-left">Deadline</th>
                      <th className="px-4 py-2.5 text-left">PM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedProjects.map((p, i) => (
                      <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${RAG_ROW[p.rag]}`}>
                        <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${RAG_DOT[p.rag]} shrink-0`} />
                            <span className={`text-xs font-semibold ${p.rag === 'red' ? 'text-red-600' : p.rag === 'amber' ? 'text-amber-600' : 'text-green-600'}`}>
                              {p.rag.toUpperCase()}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/projects/${p.id}`} className="font-medium text-slate-800 hover:text-blue-600 flex items-center gap-1 group">
                            {p.name}
                            <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-blue-400 transition-colors" />
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{p.program_name || p.client || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PHASE_COLOR[p.current_phase] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {p.current_phase}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                              <div className={`h-full rounded-full transition-all ${progressColor(p.completion_pct)}`} style={{ width: `${p.completion_pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-600 font-medium w-8 text-right">{p.completion_pct}%</span>
                          </div>
                          {p.total_activities > 0 && (
                            <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                              <span className="text-green-600 font-medium">✓{p.done_activities}</span>
                              <span className="text-amber-500 font-medium">⟳{p.in_progress_activities}</span>
                              <span className="text-slate-400">○{p.not_started_activities}</span>
                              <span className="text-slate-300">/{p.total_activities}</span>
                            </div>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-xs ${deadlineColor(p.days_until_deadline)}`}>
                          {fmtDeadline(p.days_until_deadline, isVN)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-300" />
                          {p.pm_name || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 6. Risks/Issues + Milestones ── */}
          {data && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
              {/* Left: Risks & Issues */}
              <div className="xl:col-span-3 space-y-4">
                {/* Risks */}
                <div className="bg-white border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-slate-300" />
                      IV. Critical Risks
                    </h2>
                    <Badge className="bg-slate-600 text-slate-200 border-0 text-xs">{data.topRisks.length} open</Badge>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {data.topRisks.length === 0 ? (
                      <div className="flex items-center gap-2 px-5 py-4 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        No open risks at portfolio level
                      </div>
                    ) : data.topRisks.map(r => (
                      <div key={r.id} className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${priorityColor(r.priority)}`}>
                            {r.priority}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 font-medium leading-snug">{r.description}</p>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {r.project_name}{r.program_name ? ` · ${r.program_name}` : ''}
                            </p>
                            {r.mitigation && (
                              <p className="text-xs text-slate-400 italic mt-1">{r.mitigation}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Issues */}
                <div className="bg-white border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Bug className="h-4 w-4 text-slate-300" />
                      Critical Issues
                    </h2>
                    <Badge className="bg-slate-600 text-slate-200 border-0 text-xs">{data.topIssues.length} open</Badge>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {data.topIssues.length === 0 ? (
                      <div className="flex items-center gap-2 px-5 py-4 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        No open issues at portfolio level
                      </div>
                    ) : data.topIssues.map(i => (
                      <div key={i.id} className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${priorityColor(i.priority)}`}>
                            {i.priority}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 font-medium leading-snug">{i.description}</p>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {i.project_name}{i.program_name ? ` · ${i.program_name}` : ''}
                            </p>
                            {i.mitigation && (
                              <p className="text-xs text-slate-400 italic mt-1">{i.mitigation}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Milestones + Recently Completed */}
              <div className="xl:col-span-2 space-y-4">
                {/* Upcoming Milestones */}
                <div className="bg-white border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-300" />
                      V. Upcoming Milestones
                    </h2>
                    <Badge className="bg-slate-600 text-slate-200 border-0 text-xs">30 days</Badge>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {data.upcomingMilestones.length === 0 ? (
                      <div className="flex items-center gap-2 px-5 py-4 text-sm text-slate-400">
                        <Calendar className="h-4 w-4" />
                        No milestones in next 30 days
                      </div>
                    ) : data.upcomingMilestones.map(m => (
                      <div key={m.id} className="px-5 py-3 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 shrink-0 whitespace-nowrap">
                            {fmtDate(m.plan_end)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 font-medium leading-snug truncate">{m.activity}</p>
                            {m.deliverable && (
                              <p className="text-xs text-slate-400 truncate">→ {m.deliverable}</p>
                            )}
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-xs text-slate-400 truncate">{m.project_name}</p>
                              <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-slate-100 text-slate-500 ml-2 shrink-0">
                                {m.completion_pct ?? 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recently Completed */}
                {data.recentlyCompleted.length > 0 && (
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-slate-300" />
                        Recently Completed
                      </h2>
                      <Badge className="bg-slate-600 text-slate-200 border-0 text-xs">14 days</Badge>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {data.recentlyCompleted.map(r => (
                        <div key={r.id} className="px-5 py-3 hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 font-medium leading-snug truncate">{r.activity}</p>
                              <div className="flex items-center justify-between mt-0.5">
                                <p className="text-xs text-slate-400 truncate">{r.project_name}</p>
                                <span className="text-[10px] text-green-600 ml-2 shrink-0">{fmtDate(r.actual_end)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 7. Program Scorecard ── */}
          {data && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-300" />
                  VI. Program Portfolio Scorecard
                </h2>
                <Badge className="bg-slate-600 text-slate-200 border-0 text-xs">{data.programs.length} programs</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left">Program</th>
                      <th className="px-4 py-2.5 text-left">Industry</th>
                      <th className="px-4 py-2.5 text-center">Projects</th>
                      <th className="px-4 py-2.5 text-center">Active</th>
                      <th className="px-4 py-2.5 text-left w-36">Avg Progress</th>
                      <th className="px-4 py-2.5 text-left">Health</th>
                      <th className="px-4 py-2.5 text-center">Risks</th>
                      <th className="px-4 py-2.5 text-center">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.programs.filter(c => c.projects.length > 0).map(c => {
                      const avgPct = Math.round(c.projects.reduce((s, p) => s + p.completion_pct, 0) / c.projects.length);
                      const activeCount = c.projects.filter(p => p.current_phase !== 'Closing').length;
                      const worstRag: 'red' | 'amber' | 'green' = c.projects.some(p => p.rag === 'red') ? 'red' : c.projects.some(p => p.rag === 'amber') ? 'amber' : 'green';
                      const risks = c.projects.reduce((s, p) => s + p.open_risks, 0);
                      const issues = c.projects.reduce((s, p) => s + p.open_issues, 0);
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{c.industry || '—'}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{c.projects.length}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{activeCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${progressColor(avgPct)}`} style={{ width: `${avgPct}%` }} />
                              </div>
                              <span className="text-xs font-medium text-slate-600 w-8 text-right">{avgPct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1.5 text-xs font-semibold w-fit px-2 py-0.5 rounded-full border ${worstRag === 'red' ? 'text-red-600 bg-red-50 border-red-200' : worstRag === 'amber' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-green-600 bg-green-50 border-green-200'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${RAG_DOT[worstRag]}`} />
                              {worstRag.toUpperCase()}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-center text-xs font-semibold ${risks > 0 ? 'text-red-500' : 'text-slate-400'}`}>{risks}</td>
                          <td className={`px-4 py-3 text-center text-xs font-semibold ${issues > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{issues}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {data.noProgramProjects.length > 0 && (
                  <div className="px-5 py-3 border-t text-xs text-slate-400 italic">
                    {data.noProgramProjects.length} project(s) not assigned to any program
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 8. Report Generation Panel ── */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                {mode === 'ai' ? <Sparkles className="h-4 w-4 text-violet-300" /> : <FileText className="h-4 w-4 text-slate-300" />}
                Generate Report for CEO
              </h2>
              {report && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center bg-slate-700 rounded-md p-0.5 mr-1">
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'preview' ? 'bg-white text-slate-800' : 'text-slate-300 hover:text-white'}`}
                    >
                      <Eye className="h-3 w-3 inline mr-1" />Preview
                    </button>
                    <button
                      onClick={() => setViewMode('source')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'source' ? 'bg-white text-slate-800' : 'text-slate-300 hover:text-white'}`}
                    >
                      Plain Text
                    </button>
                  </div>
                  <Button variant="outline" onClick={copyReport} title={viewMode === 'preview' ? 'Copy HTML — paste into email to keep formatting' : 'Copy plain text'} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white">
                    <Copy className="h-3 w-3" /> {viewMode === 'preview' ? 'Copy for Email' : 'Copy'}
                  </Button>
                  <Button variant="outline" onClick={exportPng} disabled={!htmlReport || !!exporting} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white disabled:opacity-50">
                    {exporting === 'png' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Image className="h-3 w-3" />} .png
                  </Button>
                  <Button variant="outline" onClick={exportPdf} disabled={!htmlReport || !!exporting} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white disabled:opacity-50">
                    {exporting === 'pdf' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />} .pdf
                  </Button>
                  <Button variant="outline" onClick={exportHtml} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white">
                    <Download className="h-3 w-3" /> .html
                  </Button>
                  <Button variant="outline" onClick={exportTxt} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white">
                    <Download className="h-3 w-3" /> .txt
                  </Button>
                  <Button onClick={sendEmail} className="h-7 text-xs gap-1 px-2 bg-blue-600 hover:bg-blue-700">
                    <Mail className="h-3 w-3" /> Send Email
                  </Button>
                </div>
              )}
            </div>

            {!report && !generating && (
              <div className="flex flex-col items-center justify-center gap-4 text-center px-8 py-16">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${mode === 'ai' ? 'bg-violet-50' : 'bg-blue-50'}`}>
                  {mode === 'ai' ? <Sparkles className="h-7 w-7 text-violet-300" /> : <FileText className="h-7 w-7 text-blue-300" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Portfolio Report</p>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto">
                    {mode === 'ai'
                      ? 'Claude synthesizes all portfolio data and writes a comprehensive CEO-ready status report including risks, milestones, and recommended actions.'
                      : 'Auto-generates a structured PMO-grade report from live portfolio data — no AI required.'}
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!data || loading}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${mode === 'ai' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-40`}
                >
                  {mode === 'ai'
                    ? <><Sparkles className="h-4 w-4" /> Generate AI Report</>
                    : <><Eye className="h-4 w-4" /> Generate Template Report</>
                  }
                </button>
              </div>
            )}

            {generating && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Sparkles className="h-8 w-8 text-violet-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm text-slate-500">Claude is synthesizing your portfolio data...</p>
                  <p className="text-xs text-slate-400 mt-1">Analyzing {data?.kpi.totalProjects} projects, {data?.topRisks.length} risks, {data?.upcomingMilestones.length} milestones</p>
                </div>
              </div>
            )}

            {report && !generating && (
              <div className="p-4">
                {viewMode === 'preview' ? (
                  <div
                    ref={previewRef}
                    className={`border rounded-lg overflow-auto ${mode === 'manual' ? 'border-slate-200 bg-white' : 'border-slate-200 bg-white'}`}
                    dangerouslySetInnerHTML={{ __html: htmlReport }}
                  />
                ) : (
                  <Textarea
                    className="w-full min-h-[500px] text-sm leading-relaxed border border-slate-200 rounded-lg resize-none focus-visible:ring-1 focus-visible:ring-blue-400 p-4 text-slate-700 font-mono"
                    value={report}
                    onChange={e => setReport(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Email Config */}
          {report && (
            <div className="bg-white border rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                <Mail className="h-4 w-4 text-blue-500" />
                Send to CEO
              </h3>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-slate-400 mb-1 block">CEO Email address</label>
                  <Input
                    type="email"
                    className="h-9 text-sm"
                    placeholder="ceo@example.com"
                    value={ceoEmail}
                    onChange={e => setCeoEmail(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={saveCeoEmail} disabled={savingEmail || !ceoEmail} className="h-9 text-xs shrink-0">
                  {savingEmail ? 'Saving...' : 'Save'}
                </Button>
                <Button onClick={sendEmail} disabled={!report} className="h-9 gap-2 text-sm bg-blue-600 hover:bg-blue-700 shrink-0">
                  <Mail className="h-4 w-4" /> Open Email Client
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Report content will be copied to clipboard. Paste it into the email body after the client opens.
              </p>
            </div>
          )}

          {/* Mode tip */}
          <div className={`rounded-xl px-4 py-3 text-xs flex items-start gap-2 border ${mode === 'ai' ? 'bg-violet-50 border-violet-100 text-violet-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
            {mode === 'ai'
              ? <><Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span><strong>AI mode:</strong> Claude reads all portfolio data including risks, issues, and milestones, then writes a comprehensive professional report. Requires Anthropic API key.</span></>
              : <><TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span><strong>Template mode:</strong> Automatically aggregates all project data into a structured PMO-grade report — no AI or internet required.</span></>
            }
          </div>

        </div>
      </main>
    </div>
  );
}
