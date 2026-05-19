'use client';
import { useState, useEffect, useCallback } from 'react';
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
  Calendar, ChevronRight, User, Building2, CalendarRange, Loader2, Image, FileDown,
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
type EpicStat = { phase: string; total: number; done: number; pct: number };
type ProjectRow = {
  id: number; name: string; program_name: string; client: string; pm_name: string;
  current_phase: string; completion_pct: number; open_risks: number; open_issues: number;
  days_until_deadline: number | null; rag: 'red' | 'amber' | 'green';
  total_activities: number; done_activities: number;
  in_progress_activities: number; not_started_activities: number;
  epicStats: EpicStat[];
};
type ProgramGroup = { id: number; name: string; industry: string; projects: ProjectRow[]; };
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

// ─── Build Template Report ────────────────────────────────────────────────────
function buildTemplateReport(data: PortfolioReportData, language: string, periodStart: string, periodEnd: string, companyName = 'PM Tool'): string {
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

    // ── I. Executive Summary ─────────────────────────────────────────────────
    lines.push(D);
    lines.push('  I.  TÓM TẮT ĐIỀU HÀNH');
    lines.push(D);
    lines.push('');
    lines.push(`  Trạng thái tổng thể portfolio: ● ${portfolioStatus}`);
    lines.push('');
    const summaryVN = red.length > 0
      ? `Portfolio hiện có ${red.length} dự án ở mức ĐỎ cần xử lý khẩn cấp.`
      : amber.length > 0 ? `Portfolio ở mức VÀNG với ${amber.length} dự án cần theo dõi sát sao.`
        : 'Portfolio đang ở trạng thái tốt — toàn bộ dự án đều xanh.';
    lines.push(`  ${summaryVN} Tổng cộng ${data.kpi.totalProjects} dự án trên ${data.kpi.totalPrograms} chương trình,`);
    lines.push(`  tiến độ trung bình ${data.kpi.avgCompletion}% (tính theo trọng số trạng thái).`);
    lines.push(`  Phân bố sức khỏe: ${green.length} XANH  ·  ${amber.length} VÀNG  ·  ${red.length} ĐỎ.`);
    if (overdue.length > 0) lines.push(`\n  [!] CẢNH BÁO: ${overdue.length} dự án đã vượt hạn chót — cần hành động ngay lập tức.`);
    if (data.kpi.totalOpenRisks === 0 && data.kpi.totalOpenIssues === 0) lines.push('  [+] Tích cực: Hiện không có rủi ro hoặc vấn đề nào đang mở ở cấp portfolio.');
    lines.push('');
    lines.push('  CHỈ SỐ CHÍNH:');
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push(`  Dự án tổng cộng        : ${data.kpi.totalProjects}      Đang hoạt động   : ${data.kpi.activeProjects}`);
    lines.push(`  Tiến độ TB (trọng số)  : ${data.kpi.avgCompletion}%    Chương trình      : ${data.kpi.totalPrograms}`);
    lines.push(`  Rủi ro đang mở         : ${data.kpi.totalOpenRisks}      Vấn đề đang mở   : ${data.kpi.totalOpenIssues}`);
    lines.push(`  Dự án quá hạn          : ${overdue.length}`);
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push('');

    // ── II. Portfolio Health Matrix ──────────────────────────────────────────
    lines.push(D);
    lines.push('  II. MA TRẬN SỨC KHỎE PORTFOLIO');
    lines.push(D);
    lines.push('');
    lines.push(tHL('┌', '┬', '┐'));
    lines.push(tRow('#', 'TRẠNG THÁI', 'TÊN DỰ ÁN', 'CHƯƠNG TRÌNH', 'PHASE', '%', 'DEADLINE'));
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
            lines.push(`      ▸ ${rp(e.phase, 20)}  [${bar}]  ${String(e.pct).padStart(3)}%  (${String(e.done).padStart(2)}/${String(e.total).padStart(2)} US done)`);
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
        lines.push(`          Dự án     : ${r.project_name}${r.program_name ? ` (${r.program_name})` : ''}`);
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
        lines.push(`          Dự án  : ${r.project_name}${r.program_name ? ` (${r.program_name})` : ''}`);
        lines.push(`          Xử lý  : ${r.mitigation || 'Đang điều tra'}`);
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
      lines.push(mlRow('NGÀY', 'HOẠT ĐỘNG / DELIVERABLE', 'DỰ ÁN', '%'));
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
      lines.push(`\n  Lưu ý: ${data.noProgramProjects.length} dự án chưa được gán cho chương trình.`);
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
      actionsVN.push(`  ${actionIdxVN}. [KHẨN CẤP — QUYẾT ĐỊNH]  ${r.description} tại dự án ${r.project_name}.`);
      actionsVN.push(`     → Đề xuất: ${r.mitigation || 'Đánh giá và ban hành quyết định xử lý ngay lập tức'}.`);
    });
    if (actionsVN.length === 0) {
      lines.push('  Không có leo thang nào cần CEO xử lý ngay. Portfolio đang trong tầm kiểm soát.');
    } else {
      actionsVN.forEach(a => lines.push(a));
    }
    lines.push('');
    lines.push(D);
    lines.push(`  ${companyName}   ·   Program Management Office   ·   Tài liệu bảo mật — Nội bộ`);
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

    // ── I. Executive Summary ─────────────────────────────────────────────────
    lines.push(D);
    lines.push('  I.  EXECUTIVE SUMMARY');
    lines.push(D);
    lines.push('');
    lines.push(`  Overall Portfolio Status: ● ${portfolioStatus}`);
    lines.push('');
    const summaryEN = red.length > 0
      ? `Portfolio is at RED status with ${red.length} project(s) requiring immediate attention.`
      : amber.length > 0 ? `Portfolio is at AMBER status with ${amber.length} project(s) under close monitoring.`
        : 'Portfolio is in good health — all projects are tracking GREEN.';
    lines.push(`  ${summaryEN} A total of ${data.kpi.totalProjects} projects are active across`);
    lines.push(`  ${data.kpi.totalPrograms} programs, with an average completion rate of ${data.kpi.avgCompletion}% (weighted by status).`);
    lines.push(`  Status distribution: ${green.length} GREEN  ·  ${amber.length} AMBER  ·  ${red.length} RED.`);
    if (overdue.length > 0) lines.push(`\n  [!] ALERT: ${overdue.length} project(s) are past their deadline — immediate action required.`);
    if (data.kpi.totalOpenRisks === 0 && data.kpi.totalOpenIssues === 0) lines.push('  [+] Positive: No open risks or issues recorded at the portfolio level.');
    lines.push('');
    lines.push('  KEY METRICS:');
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push(`  Total Projects          : ${data.kpi.totalProjects}      Active Projects   : ${data.kpi.activeProjects}`);
    lines.push(`  Avg. Completion (wtd)   : ${data.kpi.avgCompletion}%    Programs          : ${data.kpi.totalPrograms}`);
    lines.push(`  Open Risks              : ${data.kpi.totalOpenRisks}      Open Issues       : ${data.kpi.totalOpenIssues}`);
    lines.push(`  Overdue Projects        : ${overdue.length}`);
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push('');

    // ── II. Portfolio Health Matrix ──────────────────────────────────────────
    lines.push(D);
    lines.push('  II. PORTFOLIO HEALTH MATRIX');
    lines.push(D);
    lines.push('');
    lines.push(tHL('┌', '┬', '┐'));
    lines.push(tRow('#', 'STATUS', 'PROJECT NAME', 'PROGRAM', 'PHASE', 'PCT', 'DEADLINE'));
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
      lines.push('  PROJECT PROGRESS DETAILS:');
      lines.push(`  ${'─'.repeat(80)}`);
      sorted.forEach((p, i) => {
        if (p.total_activities === 0) return;
        lines.push(`  ${String(i+1).padStart(2)}. ${p.name}${p.program_name ? ` (${p.program_name})` : ''} — ${p.current_phase}`);
        lines.push(`      Progress (weighted): ${String(p.completion_pct).padStart(3)}%   |   Done: ${p.done_activities}   In Progress: ${p.in_progress_activities}   Not Started: ${p.not_started_activities}   Total: ${p.total_activities} US`);
        if (p.epicStats && p.epicStats.length > 0) {
          p.epicStats.forEach(e => {
            const bar = '█'.repeat(Math.round(e.pct / 10)) + '░'.repeat(10 - Math.round(e.pct / 10));
            lines.push(`      ▸ ${rp(e.phase, 20)}  [${bar}]  ${String(e.pct).padStart(3)}%  (${String(e.done).padStart(2)}/${String(e.total).padStart(2)} US done)`);
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
        lines.push(`          Project    : ${r.project_name}${r.program_name ? ` (${r.program_name})` : ''}`);
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
        lines.push(`          Project    : ${r.project_name}${r.program_name ? ` (${r.program_name})` : ''}`);
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
      lines.push(mlRow('DATE', 'MILESTONE / DELIVERABLE', 'PROJECT', 'PCT'));
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
    lines.push(csRow('PROGRAM', 'PROJ', 'ACTIVE', 'AVG %', 'HEALTH', 'RISKS', 'ISSUES'));
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
      lines.push(`\n  Note: ${data.noProgramProjects.length} project(s) not assigned to any program.`);
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
      actionsEN.push(`  ${actionIdxEN}. [URGENT — DECISION]  ${r.description} in project ${r.project_name}.`);
      actionsEN.push(`     → Recommend: ${r.mitigation || 'Immediate assessment and corrective action required'}.`);
    });
    if (actionsEN.length === 0) {
      lines.push('  No immediate CEO escalations required at this time. Portfolio is under control.');
    } else {
      actionsEN.forEach(a => lines.push(a));
    }
    lines.push('');
    lines.push(D);
    lines.push(`  ${companyName}   ·   Program Management Office   ·   Confidential — Internal Only`);
    lines.push(D);
  }

  return lines.join('\n');
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

// ─── Build HTML Report ────────────────────────────────────────────────────────
function buildHtmlReport(data: PortfolioReportData, language: string, periodStart: string, periodEnd: string, companyName = 'PM Tool'): string {
  const isVN = language === 'Vietnamese';
  const today = new Date().toLocaleDateString(isVN ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');

  const allProjects = [...data.programs.flatMap(c => c.projects), ...data.noProgramProjects];
  const red = allProjects.filter(p => p.rag === 'red');
  const amber = allProjects.filter(p => p.rag === 'amber');
  const green = allProjects.filter(p => p.rag === 'green');
  const overdue = allProjects.filter(p => p.days_until_deadline !== null && p.days_until_deadline < 0);
  const sorted = [...allProjects].sort((a, b) => ({ red:0, amber:1, green:2 } as Record<string,number>)[a.rag] - ({ red:0, amber:1, green:2 } as Record<string,number>)[b.rag]);
  const portfolioStatus = isVN ? (red.length > 0 ? 'ĐỎ' : amber.length > 0 ? 'VÀNG' : 'XANH') : (red.length > 0 ? 'RED' : amber.length > 0 ? 'AMBER' : 'GREEN');
  const statusColor = red.length > 0 ? '#dc2626' : amber.length > 0 ? '#d97706' : '#16a34a';
  const statusBg = red.length > 0 ? '#fef2f2' : amber.length > 0 ? '#fffbeb' : '#f0fdf4';

  const rc = (r: string) => r === 'red' ? '#dc2626' : r === 'amber' ? '#d97706' : '#16a34a';
  const rb = (r: string) => r === 'red' ? '#fef2f2' : r === 'amber' ? '#fffbeb' : '#f0fdf4';
  const rl = (r: string) => isVN ? (r === 'red' ? 'ĐỎ' : r === 'amber' ? 'VÀNG' : 'XANH') : r.toUpperCase();
  const pc = (p: string) => p === 'Critical' ? '#dc2626' : p === 'High' ? '#ea580c' : p === 'Medium' ? '#d97706' : '#64748b';
  const pb = (p: string) => p === 'Critical' ? '#fef2f2' : p === 'High' ? '#fff7ed' : p === 'Medium' ? '#fffbeb' : '#f8fafc';
  const barColor = (pct: number) => pct >= 70 ? '#16a34a' : pct >= 40 ? '#3b82f6' : pct >= 20 ? '#d97706' : '#ef4444';

  // Outlook-safe table-based progress bar
  const pBar = (pct: number, w = 100) => {
    const c = barColor(pct);
    const filled = Math.min(100, Math.max(0, Math.round(pct)));
    const empty = 100 - filled;
    return `<table width="${w}" height="6" cellpadding="0" cellspacing="0" border="0" bgcolor="#e2e8f0" style="background:#e2e8f0;"><tr>` +
      (filled > 0 ? `<td width="${filled}%" height="6" bgcolor="${c}" style="background:${c};font-size:0;line-height:0;">&nbsp;</td>` : '') +
      (empty > 0 ? `<td width="${empty}%" height="6" bgcolor="#e2e8f0" style="background:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td>` : '') +
      `</tr></table>`;
  };

  const TH = 'background:#f1f5f9;padding:8px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;border-bottom:2px solid #e2e8f0;';
  const TD = 'padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:middle;';
  const SH = 'background:#1e293b;color:white;padding:11px 22px;font-size:13px;font-weight:700;letter-spacing:0.6px;';
  const completedGroups = Object.values(data.completedByProject);

  let h = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:920px;margin:0 auto;color:#1e293b;font-size:14px;line-height:1.6;background:#f8fafc;padding:20px;">`;

  // Header
  h += `<div style="background:#1e293b;color:white;padding:28px 32px;border-radius:8px 8px 0 0;text-align:center;">`;
  h += `<h1 style="margin:0;font-size:17px;font-weight:700;letter-spacing:1.2px;">${isVN ? 'BÁO CÁO TÌNH TRẠNG PORTFOLIO' : 'PORTFOLIO STATUS REPORT'}</h1>`;
  h += `<p style="margin:7px 0 0;font-size:12px;color:#94a3b8;">Program Management Office (PMO)</p></div>`;

  // Meta row — table-based (no flex/gap for Outlook)
  h += `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;"><tr>`;
  h += `<td style="padding:11px 14px;font-size:12px;color:#475569;"><strong>${isVN ? 'Ngày báo cáo' : 'Report Date'}:</strong> ${today}</td>`;
  h += `<td style="padding:11px 10px;font-size:12px;color:#475569;"><strong>Ref:</strong> PMO-${yyyymm}-001</td>`;
  h += `<td style="padding:11px 10px;font-size:12px;color:#475569;"><strong>${isVN ? 'Kỳ báo cáo' : 'Period'}:</strong> ${periodStart} &#8594; ${periodEnd}</td>`;
  h += `<td align="right" style="padding:11px 14px;font-size:12px;color:#475569;"><strong>${isVN ? 'Phân loại' : 'Classification'}:</strong> ${isVN ? 'Bảo mật — Nội bộ' : 'Confidential — Internal Only'}</td>`;
  h += `</tr></table>`;

  // ── I. Executive Summary
  h += `<div style="margin-top:18px;border-radius:8px;border:1px solid #e2e8f0;">`;
  h += `<div style="${SH}">I. ${isVN ? 'TÓM TẮT ĐIỀU HÀNH' : 'EXECUTIVE SUMMARY'}</div>`;
  h += `<div style="background:white;padding:20px 24px;">`;

  // Status badge row — table-based (no flex/inline-flex for Outlook)
  h += `<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr>`;
  h += `<td style="padding-right:14px;font-size:13px;font-weight:600;color:#475569;vertical-align:middle;">${isVN ? 'Trạng thái tổng thể:' : 'Overall Portfolio Status:'}</td>`;
  h += `<td style="padding-right:8px;vertical-align:middle;"><span style="display:inline-block;padding:5px 14px;border-radius:20px;background:${statusBg};border:1px solid ${statusColor};font-weight:700;color:${statusColor};font-size:13px;">&#9679; ${portfolioStatus}</span></td>`;
  h += `<td style="padding-right:6px;vertical-align:middle;"><span style="display:inline-block;padding:4px 10px;border-radius:14px;background:#f0fdf4;border:1px solid #16a34a;color:#16a34a;font-size:11px;font-weight:700;">${green.length} ${isVN ? 'XANH' : 'GREEN'}</span></td>`;
  h += `<td style="padding-right:6px;vertical-align:middle;"><span style="display:inline-block;padding:4px 10px;border-radius:14px;background:#fffbeb;border:1px solid #d97706;color:#d97706;font-size:11px;font-weight:700;">${amber.length} ${isVN ? 'VÀNG' : 'AMBER'}</span></td>`;
  h += `<td style="vertical-align:middle;"><span style="display:inline-block;padding:4px 10px;border-radius:14px;background:#fef2f2;border:1px solid #dc2626;color:#dc2626;font-size:11px;font-weight:700;">${red.length} ${isVN ? 'ĐỎ' : 'RED'}</span></td>`;
  h += `</tr></table>`;

  const sumText = isVN
    ? (red.length > 0 ? `Portfolio hiện có ${red.length} dự án ở mức ĐỎ cần xử lý khẩn cấp. Tổng cộng ${data.kpi.totalProjects} dự án trên ${data.kpi.totalPrograms} chương trình, tiến độ trung bình ${data.kpi.avgCompletion}% (tính theo trọng số trạng thái).`
      : amber.length > 0 ? `Portfolio ở mức VÀNG với ${amber.length} dự án cần theo dõi sát sao. Tổng cộng ${data.kpi.totalProjects} dự án, tiến độ TB ${data.kpi.avgCompletion}%.`
      : `Portfolio đang ở trạng thái tốt — toàn bộ dự án đều xanh. Tổng cộng ${data.kpi.totalProjects} dự án trên ${data.kpi.totalPrograms} chương trình, tiến độ TB ${data.kpi.avgCompletion}%.`)
    : (red.length > 0 ? `Portfolio is at RED status with ${red.length} project(s) requiring immediate attention. ${data.kpi.totalProjects} projects across ${data.kpi.totalPrograms} programs, average completion ${data.kpi.avgCompletion}% (weighted).`
      : amber.length > 0 ? `Portfolio is AMBER with ${amber.length} project(s) under close monitoring. ${data.kpi.totalProjects} projects, avg completion ${data.kpi.avgCompletion}%.`
      : `Portfolio is in good health — all projects tracking GREEN. ${data.kpi.totalProjects} projects across ${data.kpi.totalPrograms} programs, avg completion ${data.kpi.avgCompletion}%.`);
  h += `<p style="margin:0 0 14px;color:#334155;font-size:13px;">${sumText}</p>`;
  if (overdue.length > 0) h += `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;margin-bottom:14px;color:#dc2626;font-size:13px;font-weight:600;">&#9888; ${isVN ? `CẢNH BÁO: ${overdue.length} dự án đã vượt hạn chót — cần hành động ngay lập tức.` : `ALERT: ${overdue.length} project(s) past deadline — immediate action required.`}</div>`;

  // KPI cards — table-based grid (no CSS grid for Outlook)
  const kpis = isVN
    ? [{l:'Tổng dự án',v:data.kpi.totalProjects,a:false},{l:'Đang hoạt động',v:data.kpi.activeProjects,a:false},{l:'Tiến độ TB',v:`${data.kpi.avgCompletion}%`,a:false},{l:'Chương trình',v:data.kpi.totalPrograms,a:false},{l:'Rủi ro đang mở',v:data.kpi.totalOpenRisks,a:data.kpi.totalOpenRisks>0},{l:'Vấn đề đang mở',v:data.kpi.totalOpenIssues,a:data.kpi.totalOpenIssues>0},{l:'Dự án quá hạn',v:overdue.length,a:overdue.length>0}]
    : [{l:'Total Projects',v:data.kpi.totalProjects,a:false},{l:'Active',v:data.kpi.activeProjects,a:false},{l:'Avg Completion',v:`${data.kpi.avgCompletion}%`,a:false},{l:'Programs',v:data.kpi.totalPrograms,a:false},{l:'Open Risks',v:data.kpi.totalOpenRisks,a:data.kpi.totalOpenRisks>0},{l:'Open Issues',v:data.kpi.totalOpenIssues,a:data.kpi.totalOpenIssues>0},{l:'Overdue',v:overdue.length,a:overdue.length>0}];
  const kpiCell = (k: {l:string,v:string|number,a:boolean}) =>
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${k.a?'#fef2f2':'#f8fafc'}" style="background:${k.a?'#fef2f2':'#f8fafc'};border:1px solid ${k.a?'#fecaca':'#e2e8f0'};border-radius:8px;border-left:4px solid ${k.a?'#dc2626':'#cbd5e1'};">` +
    `<tr><td style="padding:12px 16px;"><p style="margin:0 0 3px;font-size:24px;font-weight:700;color:${k.a?'#dc2626':'#1e293b'};text-decoration:none;line-height:1.1;">${k.v}</p>` +
    `<p style="margin:0;font-size:11px;color:#64748b;text-decoration:none;font-weight:500;">${k.l}</p></td></tr></table>`;
  h += `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;"><tr>`;
  kpis.slice(0, 4).forEach(k => { h += `<td width="25%" valign="top" style="padding:4px;">${kpiCell(k)}</td>`; });
  h += `</tr><tr>`;
  kpis.slice(4).forEach(k => { h += `<td width="25%" valign="top" style="padding:4px;">${kpiCell(k)}</td>`; });
  for (let i = kpis.slice(4).length; i < 4; i++) { h += `<td width="25%"></td>`; }
  h += `</tr></table>`;
  h += `</div></div>`;

  // ── II. Health Matrix
  h += `<div style="margin-top:16px;border-radius:8px;border:1px solid #e2e8f0;">`;
  h += `<div style="${SH}">II. ${isVN ? 'MA TRẬN SỨC KHỎE PORTFOLIO' : 'PORTFOLIO HEALTH MATRIX'}</div>`;
  h += `<div style="background:white;overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">`;
  h += `<thead><tr>${['#',isVN?'TRẠNG THÁI':'STATUS',isVN?'TÊN DỰ ÁN':'PROJECT',isVN?'CHƯƠNG TRÌNH':'PROGRAM','PHASE',isVN?'TIẾN ĐỘ':'PROGRESS','DEADLINE'].map(col=>`<th style="${TH}">${col}</th>`).join('')}</tr></thead><tbody>`;
  sorted.forEach((p, i) => {
    const dl = p.days_until_deadline;
    const dlStr = dl===null?'—':dl<0?(isVN?`QUÁ HẠN ${Math.abs(dl)}d`:`OVERDUE ${Math.abs(dl)}d`):isVN?`Còn ${dl}d`:`${dl}d left`;
    const dlColor = dl===null?'#94a3b8':dl<0?'#dc2626':dl<=7?'#ef4444':dl<=14?'#d97706':'#475569';
    h += `<tr style="border-bottom:1px solid #f1f5f9;${i%2===1?'background:#fafafa;':''}">`;
    h += `<td style="${TD}color:#94a3b8;">${i+1}</td>`;
    h += `<td style="${TD}"><span style="display:inline-block;padding:3px 9px;border-radius:12px;background:${rb(p.rag)};border:1px solid ${rc(p.rag)};color:${rc(p.rag)};font-size:11px;font-weight:700;">&#9679; ${rl(p.rag)}</span></td>`;
    h += `<td style="${TD}font-weight:600;color:#1e293b;">${p.name}</td>`;
    h += `<td style="${TD}color:#64748b;font-size:12px;">${p.program_name||p.client||'—'}</td>`;
    h += `<td style="${TD}"><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#e0f2fe;color:#0369a1;font-weight:600;">${p.current_phase}</span></td>`;
    h += `<td style="${TD}">`;
    h += `<table cellpadding="0" cellspacing="0" border="0"><tr>`;
    h += `<td valign="middle" style="padding-right:8px;">${pBar(p.completion_pct, 90)}</td>`;
    h += `<td valign="middle" style="font-size:12px;font-weight:700;color:#334155;width:36px;">${p.completion_pct}%</td>`;
    h += `</tr></table>`;
    if (p.total_activities>0) h += `<div style="margin-top:4px;font-size:10px;"><span style="color:#16a34a;font-weight:600;">&#10003;${p.done_activities}</span>&nbsp;<span style="color:#d97706;font-weight:600;">&#8635;${p.in_progress_activities}</span>&nbsp;<span style="color:#94a3b8;">&#9675;${p.not_started_activities}</span>&nbsp;<span style="color:#cbd5e1;">/${p.total_activities}</span></div>`;
    h += `</td>`;
    h += `<td style="${TD}font-size:12px;font-weight:${dl!==null&&dl<0?'700':'400'};color:${dlColor};">${dlStr}</td></tr>`;
    if (p.epicStats&&p.epicStats.length>0) {
      h += `<tr style="background:#fafafa;border-bottom:1px solid #f1f5f9;"><td></td><td colspan="6" style="padding:6px 14px 10px;">`;
      h += `<table cellpadding="0" cellspacing="4" border="0"><tr>`;
      p.epicStats.forEach(e => {
        h += `<td valign="middle" style="padding-right:14px;font-size:11px;color:#475569;white-space:nowrap;">`;
        h += `<span style="font-weight:600;">${e.phase}</span>&nbsp;${pBar(e.pct, 60)}&nbsp;<span style="color:#94a3b8;">${e.pct}% (${e.done}/${e.total})</span>`;
        h += `</td>`;
      });
      h += `</tr></table>`;
      h += `</td></tr>`;
    }
  });
  h += `</tbody></table></div></div>`;

  // ── III. Completed in Period
  h += `<div style="margin-top:16px;border-radius:8px;border:1px solid #e2e8f0;">`;
  h += `<div style="${SH}">III. ${isVN?'TIẾN ĐỘ THEO KỲ — HOÀN THÀNH TRONG GIAI ĐOẠN':'PROGRESS REPORT — COMPLETED IN PERIOD'} <span style="font-weight:400;color:#94a3b8;font-size:12px;">(${periodStart} &#8594; ${periodEnd})</span></div>`;
  h += `<div style="background:white;padding:18px 24px;">`;
  if (completedGroups.length===0) {
    h += `<p style="color:#94a3b8;font-style:italic;margin:0;">${isVN?'Không có hoạt động nào hoàn thành trong giai đoạn này.':'No activities completed in this period.'}</p>`;
  } else {
    completedGroups.forEach((g,gi) => {
      if (gi>0) h += `<div style="height:1px;background:#f1f5f9;margin:14px 0;"></div>`;
      // Project header — table-based (no flex for Outlook)
      h += `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;"><tr>`;
      h += `<td valign="middle"><span style="font-weight:700;color:#1e293b;font-size:13px;">${g.project_name}</span>`;
      if (g.program_name) h += `&nbsp;<span style="font-size:11px;color:#94a3b8;">${g.program_name}</span>`;
      h += `</td>`;
      h += `<td align="right" valign="middle"><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#e0f2fe;color:#0369a1;font-weight:600;">${g.current_phase}</span></td>`;
      h += `</tr></table>`;
      h += `<ul style="margin:0;padding:0;list-style:none;">`;
      g.activities.forEach(a => {
        h += `<li style="padding:4px 0;font-size:12px;">`;
        h += `<span style="color:#16a34a;font-weight:700;">&#10003;</span>&nbsp;`;
        h += `<span style="color:#334155;">${a.activity}${a.deliverable?` <span style="color:#94a3b8;">&#8594; ${a.deliverable}</span>`:''}`;
        if (a.actual_end) h += ` <span style="color:#cbd5e1;">[${a.actual_end}]</span>`;
        h += `</span></li>`;
      });
      h += `</ul>`;
    });
  }
  h += `</div></div>`;

  // ── IV. Risks & Issues
  h += `<div style="margin-top:16px;border-radius:8px;border:1px solid #e2e8f0;">`;
  h += `<div style="${SH}">IV. ${isVN?'RỦI RO & VẤN ĐỀ NGHIÊM TRỌNG':'CRITICAL RISKS & ISSUES'}</div>`;
  h += `<div style="background:white;padding:18px 24px;">`;
  h += `<div style="font-weight:700;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">A. ${isVN?'RỦI RO ĐANG MỞ':'OPEN RISKS'}</div>`;
  if (data.topRisks.length===0) {
    h += `<p style="color:#16a34a;font-size:13px;margin:0 0 16px;">&#10003; ${isVN?'Không có rủi ro mở ở cấp portfolio.':'No open risks at portfolio level.'}</p>`;
  } else {
    data.topRisks.slice(0,6).forEach(r => {
      // Risk card — table-based (no flex for Outlook)
      h += `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fafafa" style="margin-bottom:10px;background:#fafafa;border:1px solid #f1f5f9;border-radius:6px;"><tr>`;
      h += `<td valign="top" style="padding:11px 0 11px 14px;width:1%;white-space:nowrap;"><span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:${pb(r.priority)};color:${pc(r.priority)};border:1px solid ${pc(r.priority)};">${r.priority.toUpperCase()}</span></td>`;
      h += `<td valign="top" style="padding:11px 14px;"><p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#1e293b;">${r.description}</p>`;
      h += `<p style="margin:0;font-size:11px;color:#94a3b8;">${r.project_name}${r.program_name?` · ${r.program_name}`:''}${r.category?` · ${r.category}`:''}</p>`;
      if (r.mitigation) h += `<p style="margin:5px 0 0;font-size:12px;color:#64748b;font-style:italic;">${isVN?'Giảm thiểu':'Mitigation'}: ${r.mitigation}</p>`;
      h += `</td></tr></table>`;
    });
  }
  h += `<div style="font-weight:700;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;margin:18px 0 10px;">B. ${isVN?'VẤN ĐỀ ĐANG MỞ':'OPEN ISSUES'}</div>`;
  if (data.topIssues.length===0) {
    h += `<p style="color:#16a34a;font-size:13px;margin:0;">&#10003; ${isVN?'Không có vấn đề mở ở cấp portfolio.':'No open issues at portfolio level.'}</p>`;
  } else {
    data.topIssues.slice(0,6).forEach(r => {
      h += `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fafafa" style="margin-bottom:10px;background:#fafafa;border:1px solid #f1f5f9;border-radius:6px;"><tr>`;
      h += `<td valign="top" style="padding:11px 0 11px 14px;width:1%;white-space:nowrap;"><span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:${pb(r.priority)};color:${pc(r.priority)};border:1px solid ${pc(r.priority)};">${r.priority.toUpperCase()}</span></td>`;
      h += `<td valign="top" style="padding:11px 14px;"><p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#1e293b;">${r.description}</p>`;
      h += `<p style="margin:0;font-size:11px;color:#94a3b8;">${r.project_name}${r.program_name?` · ${r.program_name}`:''}</p>`;
      if (r.mitigation) h += `<p style="margin:5px 0 0;font-size:12px;color:#64748b;font-style:italic;">${isVN?'Xử lý':'Resolution'}: ${r.mitigation}</p>`;
      h += `</td></tr></table>`;
    });
  }
  h += `</div></div>`;

  // ── V. Milestones
  h += `<div style="margin-top:16px;border-radius:8px;border:1px solid #e2e8f0;">`;
  h += `<div style="${SH}">V. ${isVN?'MILESTONE SẮP TỚI — 30 NGÀY TỚI':'UPCOMING MILESTONES — Next 30 Days'}</div>`;
  h += `<div style="background:white;overflow-x:auto;">`;
  if (data.upcomingMilestones.length===0) {
    h += `<p style="color:#94a3b8;font-style:italic;margin:16px 24px;">${isVN?'Không có milestone quan trọng nào trong 30 ngày tới.':'No significant milestones in the next 30 days.'}</p>`;
  } else {
    h += `<table style="width:100%;border-collapse:collapse;"><thead><tr>${[isVN?'NGÀY':'DATE',isVN?'HOẠT ĐỘNG / DELIVERABLE':'MILESTONE / DELIVERABLE',isVN?'DỰ ÁN':'PROJECT','%'].map(c=>`<th style="${TH}">${c}</th>`).join('')}</tr></thead><tbody>`;
    data.upcomingMilestones.forEach((m,i) => {
      const label = m.deliverable?`${m.activity} / ${m.deliverable}`:m.activity;
      h += `<tr style="${i%2===1?'background:#fafafa;':''}border-bottom:1px solid #f1f5f9;">`;
      h += `<td style="${TD}"><span style="font-size:11px;padding:2px 8px;border-radius:4px;background:#e0f2fe;color:#0369a1;font-weight:600;white-space:nowrap;">${m.plan_end||'—'}</span></td>`;
      h += `<td style="${TD}color:#334155;">${label}</td>`;
      h += `<td style="${TD}font-size:12px;color:#64748b;">${m.project_name}</td>`;
      h += `<td style="${TD}font-size:12px;font-weight:600;color:#475569;">${m.completion_pct??0}%</td></tr>`;
    });
    h += `</tbody></table>`;
  }
  h += `</div></div>`;

  // ── VI. Program Scorecard
  h += `<div style="margin-top:16px;border-radius:8px;border:1px solid #e2e8f0;">`;
  h += `<div style="${SH}">VI. ${isVN?'BẢNG ĐIỂM CHƯƠNG TRÌNH':'PROGRAM PORTFOLIO SCORECARD'}</div>`;
  h += `<div style="background:white;overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr>${[isVN?'CHƯƠNG TRÌNH':'PROGRAM',isVN?'DA':'PROJ',isVN?'ACTIVE':'ACTIVE',isVN?'TB %':'AVG %',isVN?'SỨC KHỎE':'HEALTH',isVN?'RỦI RO':'RISKS',isVN?'VẤN ĐỀ':'ISSUES'].map(c=>`<th style="${TH}">${c}</th>`).join('')}</tr></thead><tbody>`;
  data.programs.filter(c=>c.projects.length>0).forEach((c,i) => {
    const avgPct = Math.round(c.projects.reduce((s,p)=>s+p.completion_pct,0)/c.projects.length);
    const activeCount = c.projects.filter(p=>p.current_phase!=='Closing').length;
    const wr = c.projects.some(p=>p.rag==='red')?'red':c.projects.some(p=>p.rag==='amber')?'amber':'green';
    const risks = c.projects.reduce((s,p)=>s+p.open_risks,0);
    const issues = c.projects.reduce((s,p)=>s+p.open_issues,0);
    h += `<tr style="${i%2===1?'background:#fafafa;':''}border-bottom:1px solid #f1f5f9;">`;
    h += `<td style="${TD}font-weight:700;color:#1e293b;">${c.name}</td>`;
    h += `<td style="${TD}text-align:center;color:#475569;">${c.projects.length}</td>`;
    h += `<td style="${TD}text-align:center;color:#475569;">${activeCount}</td>`;
    h += `<td style="${TD}"><table cellpadding="0" cellspacing="0" border="0"><tr>`;
    h += `<td valign="middle" style="padding-right:8px;">${pBar(avgPct, 80)}</td>`;
    h += `<td valign="middle" style="font-size:12px;font-weight:600;color:#334155;">${avgPct}%</td>`;
    h += `</tr></table></td>`;
    h += `<td style="${TD}"><span style="display:inline-block;padding:2px 9px;border-radius:10px;background:${rb(wr)};border:1px solid ${rc(wr)};color:${rc(wr)};font-size:11px;font-weight:700;">&#9679; ${rl(wr)}</span></td>`;
    h += `<td style="${TD}text-align:center;font-weight:600;color:${risks>0?'#dc2626':'#94a3b8'};">${risks}</td>`;
    h += `<td style="${TD}text-align:center;font-weight:600;color:${issues>0?'#d97706':'#94a3b8'};">${issues}</td></tr>`;
  });
  h += `</tbody></table>`;
  if (data.noProgramProjects.length>0) h += `<p style="padding:8px 16px;font-size:11px;color:#94a3b8;font-style:italic;margin:0;">${isVN?`Lưu ý: ${data.noProgramProjects.length} dự án chưa được gán cho chương trình.`:`Note: ${data.noProgramProjects.length} project(s) not assigned to any program.`}</p>`;
  h += `</div></div>`;

  // ── VII. Actions Required
  h += `<div style="margin-top:16px;border-radius:8px;border:1px solid #e2e8f0;">`;
  h += `<div style="${SH}">VII. ${isVN?'HÀNH ĐỘNG CẦN THIẾT — Steering Committee / CEO':'ACTIONS REQUIRED — Steering Committee / CEO'}</div>`;
  h += `<div style="background:white;padding:18px 24px;">`;
  const critRisks = data.topRisks.filter(r=>r.priority==='Critical');
  const actions: string[] = [];
  red.forEach(p => {
    const dl = p.days_until_deadline;
    const dlDesc = isVN?(dl!==null&&dl<0?`quá hạn ${Math.abs(dl)} ngày`:'đang gặp rủi ro nghiêm trọng'):(dl!==null&&dl<0?`OVERDUE ${Math.abs(dl)} days`:'at critical risk');
    const rec = isVN?'Đưa vào chương trình nghị sự Steering Committee gần nhất, xem xét bổ sung nguồn lực hoặc điều chỉnh phạm vi.':'Steering Committee review at next session. Assess resource injection or scope revision.';
    actions.push(`<div style="margin-bottom:12px;padding:13px 16px;border-radius:6px;background:#fef2f2;border:1px solid #fecaca;"><div style="font-weight:700;color:#dc2626;font-size:13px;">[${isVN?'KHẨN CẤP — LEO THANG':'URGENT — ESCALATION'}] ${p.name} (${p.program_name||'N/A'}) ${dlDesc}</div><div style="margin-top:7px;font-size:12px;color:#475569;">&#8594; ${isVN?'Đề xuất':'Recommend'}: ${rec}</div></div>`);
  });
  critRisks.forEach(r => {
    const rec = r.mitigation||(isVN?'Đánh giá và ban hành quyết định xử lý ngay lập tức':'Immediate assessment and corrective action required');
    actions.push(`<div style="margin-bottom:12px;padding:13px 16px;border-radius:6px;background:#fef2f2;border:1px solid #fecaca;"><div style="font-weight:700;color:#dc2626;font-size:13px;">[${isVN?'KHẨN CẤP — QUYẾT ĐỊNH':'URGENT — DECISION'}] ${r.description} — ${r.project_name}</div><div style="margin-top:7px;font-size:12px;color:#475569;">&#8594; ${isVN?'Đề xuất':'Recommend'}: ${rec}</div></div>`);
  });
  if (actions.length===0) {
    h += `<div style="color:#16a34a;font-size:13px;">&#10003; ${isVN?'Không có leo thang nào cần CEO xử lý ngay. Portfolio đang trong tầm kiểm soát.':'No immediate CEO escalations required. Portfolio is under control.'}</div>`;
  } else { actions.forEach(a => { h += a; }); }
  h += `</div></div>`;

  // Footer
  h += `<div style="margin-top:16px;background:#1e293b;color:#94a3b8;padding:12px 24px;border-radius:8px;text-align:center;font-size:11px;">`;
  h += `${companyName} · Program Management Office · ${isVN?'Tài liệu bảo mật — Nội bộ':'Confidential — Internal Only'}</div>`;
  h += `</div>`;
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
  const [companyName, setCompanyName] = useState('PM Tool');
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [htmlReport, setHtmlReport] = useState('');
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

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
    setReport(buildTemplateReport(data, language, periodStart, periodEnd, companyName));
    setHtmlReport(buildHtmlReport(data, language, periodStart, periodEnd, companyName));
    setViewMode('preview');
    toast.success('Portfolio report generated!');
  };

  const generateAI = async () => {
    if (!data) return;
    setGenerating(true);
    setReport('');
    try {
      const portfolioPayload = {
        reportDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        periodStart,
        periodEnd,
        kpi: data.kpi,
        programs: data.programs.map(c => ({
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
        noProgramProjects: data.noProgramProjects.map(p => ({
          name: p.name, program_name: '', current_phase: p.current_phase,
          completion_pct: p.completion_pct, open_risks: p.open_risks, open_issues: p.open_issues,
          days_until_deadline: p.days_until_deadline, rag: p.rag, pm_name: p.pm_name,
          done_activities: p.done_activities, in_progress_activities: p.in_progress_activities,
          not_started_activities: p.not_started_activities, total_activities: p.total_activities,
          epicStats: p.epicStats,
        })),
        topRisks: data.topRisks.map(r => ({ priority: r.priority, description: r.description, project_name: r.project_name, program_name: r.program_name || '' })),
        topIssues: data.topIssues.map(i => ({ priority: i.priority, description: i.description, project_name: i.project_name, program_name: i.program_name || '' })),
        upcomingMilestones: data.upcomingMilestones.map(m => ({ plan_end: m.plan_end, activity: m.activity, project_name: m.project_name })),
        completedByProject: data.completedByProject,
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
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"><title>Portfolio Report</title><style type="text/css">a,a:link,a:visited,a:hover{color:inherit!important;text-decoration:none!important;}</style></head><body style="margin:0;background:#f8fafc;">${htmlReport}</body></html>`;
    const blob = new Blob([full], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `PortfolioReport_${new Date().toISOString().slice(0, 10)}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPng = async () => {
    if (!htmlReport) return;
    setExporting('png');
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-99999px;top:0;width:960px;background:#f8fafc;';
    container.innerHTML = htmlReport;
    document.body.appendChild(container);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(container, { pixelRatio: 2, backgroundColor: '#f8fafc', cacheBust: true });
      const a = document.createElement('a');
      a.download = `PortfolioReport_${new Date().toISOString().slice(0, 10)}.png`;
      a.href = dataUrl;
      a.click();
      toast.success('Đã xuất PNG!');
    } catch {
      toast.error('Xuất PNG thất bại');
    } finally {
      document.body.removeChild(container);
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!htmlReport) return;
    setExporting('pdf');
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-99999px;top:0;width:960px;background:#f8fafc;';
    container.innerHTML = htmlReport;
    document.body.appendChild(container);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(container, { pixelRatio: 2, backgroundColor: '#f8fafc', cacheBust: true });
      const { jsPDF } = await import('jspdf');
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>(r => { img.onload = () => r(); });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const scaledH = pdfW * (img.height / img.width);
      let y = 0;
      pdf.addImage(dataUrl, 'PNG', 0, y, pdfW, scaledH);
      let remaining = scaledH - pdfH;
      while (remaining > 0) {
        y -= pdfH;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, y, pdfW, scaledH);
        remaining -= pdfH;
      }
      pdf.save(`PortfolioReport_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Đã xuất PDF!');
    } catch {
      toast.error('Xuất PDF thất bại');
    } finally {
      document.body.removeChild(container);
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
      `${language === 'Vietnamese' ? 'Kính gửi,' : 'Dear CEO,'}\n\nPlease find the portfolio status report below.\n\n[Report content copied to clipboard — paste here]\n\n---\nSent via ${companyName} PM Tool`
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
                    className="border border-slate-200 rounded-lg overflow-auto bg-white"
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
