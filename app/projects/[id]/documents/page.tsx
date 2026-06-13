'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  FileText, Download, Pencil, Presentation, Plus, Trash2, CalendarRange,
  ExternalLink, BarChart2, Sparkles, Copy, RefreshCw, Calendar, Flag,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocRecord = {
  id: number;
  type: string;
  title: string;
  content_json: string;
  created_at: string;
  updated_at: string;
};

type DocDef = {
  type: string;
  label: string;
  desc: string;
  fields: { key: string; label: string; multiline?: boolean }[];
};

type Milestone = { id: number; name: string; start_date: string; end_date: string };

type EpicStat = { phase: string; total: number; done: number; pct: number; plan_start?: string | null; plan_end?: string | null };
type RiskIssue = { id: number; description: string; priority: string; status: string; mitigation?: string; owner?: string };
type ActivityRow = { id: number; activity: string; deliverable?: string; plan_end?: string; actual_end?: string; status: string };

type ProjectReportData = {
  project: {
    id: number; name: string; customer_name?: string; program_name?: string;
    pm_name?: string; current_phase: string; end_date?: string;
    start_date?: string; rag: 'red' | 'amber' | 'green'; days_until_deadline: number | null;
  };
  milestones: Milestone[];
  selectedMilestone?: Milestone | null;
  periodStart: string;
  periodEnd: string;
  stats: { total: number; done: number; inProgress: number; notStarted: number; completion_pct: number };
  epicStats: EpicStat[];
  completedInPeriod: ActivityRow[];
  upcomingActivities: ActivityRow[];
  openRisks: RiskIssue[];
  openIssues: RiskIssue[];
  bugStats?: { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> } | null;
};

// ─── Static doc definitions (non-weekly) ─────────────────────────────────────

const DOC_TYPES: DocDef[] = [
  {
    type: 'project_charter',
    label: 'Project Charter',
    desc: 'Tài liệu khởi tạo project: mục tiêu, scope, stakeholders',
    fields: [
      { key: 'objectives', label: 'Project Objectives', multiline: true },
      { key: 'scope', label: 'Project Scope', multiline: true },
      { key: 'out_of_scope', label: 'Out of Scope', multiline: true },
      { key: 'key_stakeholders', label: 'Key Stakeholders', multiline: true },
      { key: 'budget', label: 'Budget / Investment' },
      { key: 'success_criteria', label: 'Success Criteria', multiline: true },
      { key: 'assumptions', label: 'Assumptions & Constraints', multiline: true },
    ],
  },
  {
    type: 'sow',
    label: 'Statement of Work (SoW)',
    desc: 'Định nghĩa phạm vi, timeline và deliverables chính thức',
    fields: [
      { key: 'project_overview', label: 'Project Overview', multiline: true },
      { key: 'solution_proposal', label: 'Solution Proposal', multiline: true },
      { key: 'methodology', label: 'Implementation Methodology', multiline: true },
      { key: 'milestones', label: 'High-Level Milestones', multiline: true },
      { key: 'payment_terms', label: 'Payment Terms / Commercial Terms', multiline: true },
      { key: 'dependencies', label: 'Assumptions & Dependencies', multiline: true },
    ],
  },
  {
    type: 'pmp',
    label: 'Project Management Plan (PMP)',
    desc: 'Kế hoạch quản lý dự án tổng hợp',
    fields: [
      { key: 'change_management', label: 'Change Management Process', multiline: true },
      { key: 'quality_plan', label: 'Quality Assurance Plan', multiline: true },
      { key: 'rollout_strategy', label: 'Rollout & Data Migration Strategy', multiline: true },
      { key: 'governance', label: 'Project Governance', multiline: true },
    ],
  },
  {
    type: 'change_request',
    label: 'Change Request',
    desc: 'Yêu cầu thay đổi scope / timeline / resource',
    fields: [
      { key: 'cr_id', label: 'CR ID' },
      { key: 'cr_title', label: 'Change Title' },
      { key: 'description', label: 'Description of Change', multiline: true },
      { key: 'justification', label: 'Justification / Business Need', multiline: true },
      { key: 'impact_scope', label: 'Impact on Scope', multiline: true },
      { key: 'impact_timeline', label: 'Impact on Timeline' },
      { key: 'impact_budget', label: 'Impact on Budget' },
      { key: 'recommendation', label: 'Recommendation', multiline: true },
    ],
  },
  {
    type: 'closure_report',
    label: 'Project Closure Report',
    desc: 'Báo cáo tổng kết và đóng project',
    fields: [
      { key: 'executive_summary', label: 'Executive Summary', multiline: true },
      { key: 'objectives_achieved', label: 'Objectives Achieved vs Planned', multiline: true },
      { key: 'key_achievements', label: 'Key Achievements', multiline: true },
      { key: 'lessons_learned', label: 'Lessons Learned', multiline: true },
      { key: 'benefit_validation', label: 'Benefit & Criteria Validation', multiline: true },
      { key: 'recommendations', label: 'Recommendations for Future', multiline: true },
    ],
  },
];

const WEEKLY_FIELDS = [
  { key: 'overall_status', label: 'Overall Status (RAG: Red / Amber / Green)' },
  { key: 'completed_this_week', label: 'Completed This Week', multiline: true },
  { key: 'plan_next_week', label: 'Plan Next Week', multiline: true },
  { key: 'risks_issues', label: 'Key Risks & Issues', multiline: true },
  { key: 'decisions_needed', label: 'Decisions Needed', multiline: true },
];

const PPT_FIELDS = [
  { key: 'presentation_date', label: 'Presentation Date', multiline: false },
  { key: 'methodology', label: 'Implementation Methodology (slide 5)', multiline: true },
  { key: 'next_steps', label: 'Next Steps & Action Items (slide 9)', multiline: true },
  { key: 'agenda', label: 'Custom Agenda (one item per line, leave blank for default)', multiline: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYYMMDD(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parseWeeklyTitle(title: string): { from: string; to: string } | null {
  const parts = title.split('_Weekly Report_');
  if (parts.length < 2) return null;
  const dates = parts[1].split('_');
  if (dates.length < 2) return null;
  const parse = (s: string) => {
    if (s.length !== 6) return '';
    return `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
  };
  return { from: parse(dates[0]), to: parse(dates[1]) };
}

function statusRagColor(rag: string) {
  const r = (rag || '').toLowerCase();
  if (r.includes('red') || r === 'r') return 'bg-red-100 text-red-700 border-red-200';
  if (r.includes('amber') || r === 'a') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (r.includes('green') || r === 'g') return 'bg-green-100 text-green-700 border-green-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function getDefaultStart(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function getDefaultEnd(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Project Report Template Builder ─────────────────────────────────────────

function buildProjectReport(data: ProjectReportData, language: string): string {
  const isVN = language === 'Vietnamese';
  const { project, periodStart, periodEnd, stats, epicStats, completedInPeriod, upcomingActivities, openRisks, openIssues, bugStats, selectedMilestone } = data;

  const today = new Date().toLocaleDateString(isVN ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');

  const fmtD = (s: string | null | undefined) => {
    if (!s) return '—';
    try { return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return s; }
  };

  const rag = project.rag;
  const ragLabel = isVN
    ? (rag === 'red' ? 'ĐỎ' : rag === 'amber' ? 'VÀNG' : 'XANH')
    : (rag === 'red' ? 'RED' : rag === 'amber' ? 'AMBER' : 'GREEN');

  const lines: string[] = [];
  const D = '  ' + '━'.repeat(94);
  const box1 = '  ╔' + '═'.repeat(92) + '╗';
  const box2 = '  ╚' + '═'.repeat(92) + '╝';
  const boxL = (s: string) => { const p = 92 - s.length; return `  ║${' '.repeat(Math.floor(p / 2))}${s}${' '.repeat(p - Math.floor(p / 2))}║`; };
  const sbox1 = `  ┌${'─'.repeat(92)}┐`;
  const sbox2 = `  └${'─'.repeat(92)}┘`;
  const sboxL = (s: string) => `  │ ${s}${' '.repeat(Math.max(0, 90 - s.length))} │`;
  const rp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s).padEnd(n);
  const lp = (s: string | number, n: number) => String(s).padStart(n);
  const bugBW = { st: 24, ct: 8 } as const;

  const wrapText = (text: string, maxLen: number): string[] => {
    const words = text.split(' ');
    const result: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur ? cur + ' ' + w : w).length > maxLen) { result.push(cur); cur = w; }
      else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) result.push(cur);
    return result;
  };

  if (isVN) {
    // ── Header ──────────────────────────────────────────────────────────────
    lines.push(box1);
    lines.push(boxL('BÁO CÁO TÌNH TRẠNG DỰ ÁN'));
    lines.push(boxL(project.name.toUpperCase()));
    lines.push(box2);
    lines.push('');
    lines.push(`  Ngày báo cáo   : ${today}              Mã tham chiếu : PRJ-${yyyymm}-001`);
    lines.push(`  Kỳ báo cáo    : ${fmtD(periodStart)} → ${fmtD(periodEnd)}`);
    if (selectedMilestone) lines.push(`  Milestone      : ${selectedMilestone.name}`);
    lines.push(`  Phân loại      : Bảo mật — Chỉ dành cho nội bộ`);
    lines.push(`  Phân phối      : PM, Project Sponsor, Steering Committee`);
    lines.push(`  Giai đoạn      : ${project.current_phase}`);
    lines.push(`  Khách hàng     : ${project.customer_name || project.program_name || 'N/A'}`);
    lines.push(`  PM             : ${project.pm_name || 'N/A'}`);
    lines.push(`  Ngày kết thúc  : ${project.end_date ? fmtD(project.end_date) : 'N/A'}${
      project.days_until_deadline !== null
        ? ` (${project.days_until_deadline < 0 ? `Quá hạn ${Math.abs(project.days_until_deadline)} ngày` : `Còn ${project.days_until_deadline} ngày`})`
        : ''}`);
    lines.push('');

    // ── Summary box ──────────────────────────────────────────────────────────
    {
      const ragKey = rag === 'red' ? 'red' : rag === 'amber' ? 'amber' : 'green';
      const summaryText = ragKey === 'red'
        ? `Dự án đang ở trạng thái ĐỎ — có các vấn đề nghiêm trọng cần được xử lý khẩn cấp. Tính đến kỳ báo cáo, dự án đã hoàn thành ${stats.completion_pct}% với ${stats.done}/${stats.total} hoạt động. Cần hành động ngay từ PM và các bên liên quan.`
        : ragKey === 'amber'
        ? `Dự án đang ở trạng thái VÀNG — có một số rủi ro/vấn đề cần theo dõi sát sao. Tính đến kỳ báo cáo, dự án đã hoàn thành ${stats.completion_pct}% với ${stats.done}/${stats.total} hoạt động. Cần chú ý để tránh leo thang.`
        : `Dự án đang vận hành tốt ở trạng thái XANH. Tính đến kỳ báo cáo, dự án đã hoàn thành ${stats.completion_pct}% với ${stats.done}/${stats.total} hoạt động — tất cả các chỉ số đều trong ngưỡng kiểm soát.`;
      lines.push(sbox1);
      lines.push(sboxL('TÓM TẮT'));
      lines.push(sboxL(''));
      wrapText(summaryText, 88).forEach(l => lines.push(sboxL(l)));
      lines.push(sbox2);
      lines.push('');
    }

    // ── I. TÓM TẮT ĐIỀU HÀNH ────────────────────────────────────────────────
    lines.push(D);
    lines.push('  I.  TÓM TẮT ĐIỀU HÀNH');
    lines.push(D);
    lines.push('');
    lines.push(`  Trạng thái tổng thể dự án: ● ${ragLabel}`);
    lines.push('');
    const s1vn = rag === 'red'
      ? `Dự án hiện ở mức ĐỎ với ${openRisks.length} rủi ro và ${openIssues.length} vấn đề đang mở — cần xử lý khẩn cấp.`
      : rag === 'amber'
      ? `Dự án ở mức VÀNG với ${openRisks.length} rủi ro và ${openIssues.length} vấn đề cần theo dõi sát sao.`
      : 'Dự án đang ở trạng thái tốt — toàn bộ các chỉ số đều trong ngưỡng kiểm soát.';
    if (project.days_until_deadline !== null && project.days_until_deadline < 0)
      lines.push(`\n  [!] CẢNH BÁO: Dự án đã quá hạn ${Math.abs(project.days_until_deadline)} ngày — cần hành động ngay lập tức.`);
    lines.push(`  ${s1vn}`);
    if (openRisks.length === 0 && openIssues.length === 0) lines.push('  [+] Tích cực: Hiện không có rủi ro hoặc vấn đề nào đang mở.');
    lines.push('');
    lines.push('  CHỈ SỐ CHÍNH:');
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push(`  Hoạt động tổng cộng  : ${stats.total}      Đang hoạt động   : ${stats.inProgress}`);
    lines.push(`  Tiến độ TB (trọng số): ${stats.completion_pct}%    Hoàn thành        : ${stats.done}`);
    lines.push(`  Rủi ro đang mở       : ${openRisks.length}      Vấn đề đang mở   : ${openIssues.length}`);
    lines.push(`  Chưa bắt đầu         : ${stats.notStarted}`);
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push('');
    const barLen = 40;
    const filled = Math.round((stats.completion_pct / 100) * barLen);
    lines.push(`  Tiến độ tổng thể: [${'█'.repeat(filled)}${'░'.repeat(barLen - filled)}] ${stats.completion_pct}%`);
    lines.push('');

    // ── II. TIẾN ĐỘ THEO KỲ ─────────────────────────────────────────────────
    lines.push(D);
    lines.push('  II. TIẾN ĐỘ THEO KỲ — HOÀN THÀNH TRONG GIAI ĐOẠN');
    lines.push(D);
    lines.push(`  Kỳ báo cáo: ${fmtD(periodStart)} → ${fmtD(periodEnd)}`);
    lines.push('');
    if (completedInPeriod.length === 0) {
      lines.push('  Không có hoạt động nào hoàn thành trong giai đoạn này.');
    } else {
      completedInPeriod.forEach((a, i) => {
        lines.push(`  ${String(i + 1).padStart(2)}. ${project.name}${project.current_phase ? ` — ${project.current_phase}` : ''}`);
        lines.push(`      [+]  ${a.activity}${a.deliverable ? `  →  ${a.deliverable}` : ''}${a.actual_end ? `  [${a.actual_end}]` : ''}`);
      });
    }
    lines.push('');

    // ── III. HÀNH ĐỘNG CẦN THIẾT ────────────────────────────────────────────
    lines.push(D);
    lines.push('  III. HÀNH ĐỘNG CẦN THIẾT — PM / Project Sponsor');
    lines.push(D);
    lines.push('');
    let aiVN = 0;
    const actVN: string[] = [];
    if (project.days_until_deadline !== null && project.days_until_deadline < 0) {
      aiVN++;
      actVN.push(`  ${aiVN}. [KHẨN CẤP — QUÁ HẠN]  Dự án ${project.name} đã quá hạn ${Math.abs(project.days_until_deadline)} ngày.`);
      actVN.push(`     → Đề xuất: Xem xét lại kế hoạch, nguồn lực và phạm vi với Project Sponsor ngay lập tức.`);
    }
    openRisks.forEach(r => {
      aiVN++;
      actVN.push(`  ${aiVN}. [KHẨN CẤP — RỦI RO ${r.priority.toUpperCase()}]  ${r.description}`);
      actVN.push(`     → Đề xuất: ${r.mitigation || 'Đánh giá và ban hành quyết định xử lý ngay lập tức'}.`);
    });
    openIssues.forEach(r => {
      aiVN++;
      actVN.push(`  ${aiVN}. [KHẨN CẤP — VẤN ĐỀ ${r.priority.toUpperCase()}]  ${r.description}`);
      actVN.push(`     → Đề xuất: ${r.mitigation || 'Đánh giá và triển khai biện pháp xử lý ngay lập tức'}.`);
    });
    if (upcomingActivities.length > 0 && actVN.length === 0) {
      lines.push('  Không có leo thang nào cần PM xử lý ngay. Dự án đang trong tầm kiểm soát.');
    } else if (actVN.length > 0) {
      actVN.forEach(a => lines.push(a));
    } else {
      lines.push('  Không có leo thang nào cần PM xử lý ngay. Dự án đang trong tầm kiểm soát.');
    }
    lines.push('');

    // ── IV. BUG REPORT ───────────────────────────────────────────────────────
    if (bugStats && bugStats.total > 0) {
      lines.push(D);
      lines.push('  IV. BUG REPORT — TỔNG HỢP LỖI DỰ ÁN');
      lines.push(D);
      lines.push('');
      const critBugs = (bugStats.byPriority['Critical'] ?? 0) + (bugStats.byPriority['Highest'] ?? 0);
      const openBugs = (bugStats.byStatus['Open'] ?? 0) + (bugStats.byStatus['New'] ?? 0) + (bugStats.byStatus['To Do'] ?? 0) + (bugStats.byStatus['To-do'] ?? 0);
      lines.push(`  Tổng Bug : ${bugStats.total}   ·   Critical/Highest: ${critBugs}   ·   Chưa xử lý: ${openBugs}`);
      lines.push('');
      lines.push('  A. PHÂN BỔ THEO TRẠNG THÁI:');
      lines.push(`  ${'─'.repeat(50)}`);
      Object.entries(bugStats.byStatus).sort((a, b) => b[1] - a[1]).forEach(([st, cnt]) => {
        const pct = bugStats.total > 0 ? Math.round(cnt / bugStats.total * 100) : 0;
        const bLen = Math.round(pct / 5);
        const bar = '█'.repeat(bLen) + '░'.repeat(20 - bLen);
        const stLabel = st.length > bugBW.st ? st.slice(0, bugBW.st - 1) + '…' : st;
        lines.push(`  ${stLabel.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%) [${bar}]`);
      });
      lines.push('');
      lines.push('  B. PHÂN BỔ THEO PRIORITY:');
      lines.push(`  ${'─'.repeat(50)}`);
      ['Critical', 'Highest', 'High', 'Medium', 'Low', 'Lowest'].forEach(pr => {
        const cnt = bugStats.byPriority[pr];
        if (!cnt) return;
        const pct = bugStats.total > 0 ? Math.round(cnt / bugStats.total * 100) : 0;
        lines.push(`  ${pr.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%)`);
      });
      Object.entries(bugStats.byPriority).filter(([pr]) => !['Critical','Highest','High','Medium','Low','Lowest'].includes(pr)).forEach(([pr, cnt]) => {
        const pct = bugStats.total > 0 ? Math.round(cnt / bugStats.total * 100) : 0;
        lines.push(`  ${pr.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%)`);
      });
      lines.push('');
    }

    // ── V. TIẾN ĐỘ THEO EPIC / PHASE ────────────────────────────────────────
    if (epicStats.length > 0) {
      const epicsDone = epicStats.filter(e => e.pct >= 100).length;
      const epicsInProg = epicStats.filter(e => e.pct > 0 && e.pct < 100).length;
      const epicsNotStarted = epicStats.filter(e => e.pct === 0).length;
      lines.push(D);
      lines.push('  V.  TIẾN ĐỘ THEO EPIC / PHASE');
      lines.push(D);
      lines.push('');
      const KW = { lb: 38, vl: 22 } as const;
      const kRow = (lb: string, vl: string) => `  │ ${lb.padEnd(KW.lb)} │ ${vl.padStart(KW.vl)} │`;
      lines.push(`  ┌${'─'.repeat(KW.lb + 2)}┬${'─'.repeat(KW.vl + 2)}┐`);
      lines.push(`  │ ${'CHỈ SỐ'.padEnd(KW.lb)} │ ${'GIÁ TRỊ'.padStart(KW.vl)} │`);
      lines.push(`  ├${'─'.repeat(KW.lb + 2)}┼${'─'.repeat(KW.vl + 2)}┤`);
      lines.push(kRow('Tổng Epic / Phase', `${epicStats.length} epic`));
      lines.push(kRow('Hoàn thành (≥100%)', `${epicsDone} epic`));
      lines.push(kRow('Đang triển khai (1–99%)', `${epicsInProg} epic`));
      lines.push(kRow('Chưa bắt đầu (0%)', `${epicsNotStarted} epic`));
      lines.push(kRow('Tiến độ tổng thể (trọng số)', `${stats.completion_pct}%`));
      lines.push(`  └${'─'.repeat(KW.lb + 2)}┴${'─'.repeat(KW.vl + 2)}┘`);
      lines.push('');
      lines.push('  A. TIẾN ĐỘ CHI TIẾT THEO EPIC (sắp xếp giảm dần):');
      lines.push('');
      const EW = { nm: 28, pc: 6, dn: 8, tt: 8, br: 22 } as const;
      lines.push(`  ┌${'─'.repeat(EW.nm + 2)}┬${'─'.repeat(EW.pc + 2)}┬${'─'.repeat(EW.dn + 2)}┬${'─'.repeat(EW.tt + 2)}┬${'─'.repeat(EW.br + 2)}┐`);
      lines.push(`  │ ${'EPIC / PHASE'.padEnd(EW.nm)} │ ${'PCT'.padStart(EW.pc)} │ ${'DONE'.padStart(EW.dn)} │ ${'TOTAL'.padStart(EW.tt)} │ ${'TIẾN ĐỘ'.padEnd(EW.br)} │`);
      lines.push(`  ├${'─'.repeat(EW.nm + 2)}┼${'─'.repeat(EW.pc + 2)}┼${'─'.repeat(EW.dn + 2)}┼${'─'.repeat(EW.tt + 2)}┼${'─'.repeat(EW.br + 2)}┤`);
      [...epicStats].sort((a, b) => b.pct - a.pct).forEach(e => {
        const bLen = 20;
        const filled2 = Math.round((e.pct / 100) * bLen);
        const bar2 = '█'.repeat(filled2) + '░'.repeat(bLen - filled2);
        lines.push(`  │ ${rp(e.phase, EW.nm)} │ ${lp(e.pct + '%', EW.pc)} │ ${lp(e.done, EW.dn)} │ ${lp(e.total, EW.tt)} │ [${bar2}] │`);
      });
      lines.push(`  └${'─'.repeat(EW.nm + 2)}┴${'─'.repeat(EW.pc + 2)}┴${'─'.repeat(EW.dn + 2)}┴${'─'.repeat(EW.tt + 2)}┴${'─'.repeat(EW.br + 2)}┘`);
      lines.push('');
    }

    lines.push(D);
    lines.push(`  ${project.name}   ·   Project Management Office   ·   Tài liệu bảo mật — Nội bộ`);
    lines.push(D);

  } else {
    // ── English ──────────────────────────────────────────────────────────────
    lines.push(box1);
    lines.push(boxL('PROJECT STATUS REPORT'));
    lines.push(boxL(project.name.toUpperCase()));
    lines.push(box2);
    lines.push('');
    lines.push(`  Report Date    : ${today}              Reference : PRJ-${yyyymm}-001`);
    lines.push(`  Period         : ${fmtD(periodStart)} → ${fmtD(periodEnd)}`);
    if (selectedMilestone) lines.push(`  Milestone      : ${selectedMilestone.name}`);
    lines.push(`  Classification : Confidential — Internal Distribution Only`);
    lines.push(`  Distribution   : PM, Project Sponsor, Steering Committee`);
    lines.push(`  Phase          : ${project.current_phase}`);
    lines.push(`  Customer       : ${project.customer_name || project.program_name || 'N/A'}`);
    lines.push(`  PM             : ${project.pm_name || 'N/A'}`);
    lines.push(`  End Date       : ${project.end_date ? fmtD(project.end_date) : 'N/A'}${
      project.days_until_deadline !== null
        ? ` (${project.days_until_deadline < 0 ? `OVERDUE ${Math.abs(project.days_until_deadline)} days` : `${project.days_until_deadline} days remaining`})`
        : ''}`);
    lines.push('');

    // Summary box
    {
      const summaryTextEN = rag === 'red'
        ? `Project is tracking RED — critical issues require immediate attention. As of this reporting period, the project has completed ${stats.completion_pct}% with ${stats.done}/${stats.total} activities. Escalation and corrective action are required.`
        : rag === 'amber'
        ? `Project is tracking AMBER — risks and issues are present and require close monitoring. As of this reporting period, the project has completed ${stats.completion_pct}% with ${stats.done}/${stats.total} activities. Action is needed to prevent escalation.`
        : `Project is tracking GREEN — all indicators are within acceptable thresholds. As of this reporting period, the project has completed ${stats.completion_pct}% with ${stats.done}/${stats.total} activities. No escalations required.`;
      lines.push(sbox1);
      lines.push(sboxL('SUMMARY'));
      lines.push(sboxL(''));
      wrapText(summaryTextEN, 88).forEach(l => lines.push(sboxL(l)));
      lines.push(sbox2);
      lines.push('');
    }

    // I. Executive Summary
    lines.push(D);
    lines.push('  I.  EXECUTIVE SUMMARY');
    lines.push(D);
    lines.push('');
    lines.push(`  Overall Project Status: ● ${ragLabel}`);
    lines.push('');
    const s1en = rag === 'red'
      ? `Project is at RED status with ${openRisks.length} open risks and ${openIssues.length} open issues requiring immediate attention.`
      : rag === 'amber'
      ? `Project is at AMBER status with ${openRisks.length} open risks and ${openIssues.length} open issues under close monitoring.`
      : 'Project is tracking GREEN — all key indicators are within acceptable thresholds.';
    if (project.days_until_deadline !== null && project.days_until_deadline < 0)
      lines.push(`\n  [!] ALERT: Project is OVERDUE by ${Math.abs(project.days_until_deadline)} days — immediate action required.`);
    lines.push(`  ${s1en}`);
    if (openRisks.length === 0 && openIssues.length === 0) lines.push('  [+] Positive: No open risks or issues recorded at this time.');
    lines.push('');
    lines.push('  KEY METRICS:');
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push(`  Total Activities    : ${stats.total}      Active           : ${stats.inProgress}`);
    lines.push(`  Avg. Completion     : ${stats.completion_pct}%    Done              : ${stats.done}`);
    lines.push(`  Open Risks          : ${openRisks.length}      Open Issues       : ${openIssues.length}`);
    lines.push(`  Not Started         : ${stats.notStarted}`);
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push('');
    const barLenEN = 40;
    const filledEN = Math.round((stats.completion_pct / 100) * barLenEN);
    lines.push(`  Overall Progress: [${'█'.repeat(filledEN)}${'░'.repeat(barLenEN - filledEN)}] ${stats.completion_pct}%`);
    lines.push('');

    // II. Completed in Period
    lines.push(D);
    lines.push('  II. PROGRESS REPORT — COMPLETED IN PERIOD');
    lines.push(D);
    lines.push(`  Reporting Period: ${fmtD(periodStart)} → ${fmtD(periodEnd)}`);
    lines.push('');
    if (completedInPeriod.length === 0) {
      lines.push('  No activities completed in this period.');
    } else {
      completedInPeriod.forEach((a, i) => {
        lines.push(`  ${String(i + 1).padStart(2)}. ${project.name}${project.current_phase ? ` — ${project.current_phase}` : ''}`);
        lines.push(`      [+]  ${a.activity}${a.deliverable ? `  →  ${a.deliverable}` : ''}${a.actual_end ? `  [${a.actual_end}]` : ''}`);
      });
    }
    lines.push('');

    // III. Actions Required
    lines.push(D);
    lines.push('  III. ACTIONS REQUIRED — PM / Project Sponsor');
    lines.push(D);
    lines.push('');
    let aiEN = 0;
    const actEN: string[] = [];
    if (project.days_until_deadline !== null && project.days_until_deadline < 0) {
      aiEN++;
      actEN.push(`  ${aiEN}. [URGENT — OVERDUE]  ${project.name} is overdue by ${Math.abs(project.days_until_deadline)} days.`);
      actEN.push(`     → Recommend: Immediate review of plan, resources and scope with Project Sponsor.`);
    }
    openRisks.forEach(r => {
      aiEN++;
      actEN.push(`  ${aiEN}. [URGENT — RISK ${r.priority.toUpperCase()}]  ${r.description}`);
      actEN.push(`     → Recommend: ${r.mitigation || 'Immediate assessment and corrective action required'}.`);
    });
    openIssues.forEach(r => {
      aiEN++;
      actEN.push(`  ${aiEN}. [URGENT — ISSUE ${r.priority.toUpperCase()}]  ${r.description}`);
      actEN.push(`     → Recommend: ${r.mitigation || 'Immediate assessment and resolution required'}.`);
    });
    if (actEN.length === 0) {
      lines.push('  No immediate escalations required at this time. Project is under control.');
    } else {
      actEN.forEach(a => lines.push(a));
    }
    lines.push('');

    // IV. Bug Report
    if (bugStats && bugStats.total > 0) {
      lines.push(D);
      lines.push('  IV. BUG REPORT — PROJECT BUG SUMMARY');
      lines.push(D);
      lines.push('');
      const critBugsEN = (bugStats.byPriority['Critical'] ?? 0) + (bugStats.byPriority['Highest'] ?? 0);
      const openBugsEN = (bugStats.byStatus['Open'] ?? 0) + (bugStats.byStatus['New'] ?? 0) + (bugStats.byStatus['To Do'] ?? 0) + (bugStats.byStatus['To-do'] ?? 0);
      lines.push(`  Total Bugs: ${bugStats.total}   ·   Critical/Highest: ${critBugsEN}   ·   Open/New: ${openBugsEN}`);
      lines.push('');
      lines.push('  A. DISTRIBUTION BY STATUS:');
      lines.push(`  ${'─'.repeat(50)}`);
      Object.entries(bugStats.byStatus).sort((a, b) => b[1] - a[1]).forEach(([st, cnt]) => {
        const pct = bugStats.total > 0 ? Math.round(cnt / bugStats.total * 100) : 0;
        const bLen = Math.round(pct / 5);
        const bar = '█'.repeat(bLen) + '░'.repeat(20 - bLen);
        const stLabel = st.length > bugBW.st ? st.slice(0, bugBW.st - 1) + '…' : st;
        lines.push(`  ${stLabel.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%) [${bar}]`);
      });
      lines.push('');
      lines.push('  B. DISTRIBUTION BY PRIORITY:');
      lines.push(`  ${'─'.repeat(50)}`);
      ['Critical', 'Highest', 'High', 'Medium', 'Low', 'Lowest'].forEach(pr => {
        const cnt = bugStats.byPriority[pr];
        if (!cnt) return;
        const pct = bugStats.total > 0 ? Math.round(cnt / bugStats.total * 100) : 0;
        lines.push(`  ${pr.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%)`);
      });
      Object.entries(bugStats.byPriority).filter(([pr]) => !['Critical','Highest','High','Medium','Low','Lowest'].includes(pr)).forEach(([pr, cnt]) => {
        const pct = bugStats.total > 0 ? Math.round(cnt / bugStats.total * 100) : 0;
        lines.push(`  ${pr.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%)`);
      });
      lines.push('');
    }

    // V. Epic/Phase Progress
    if (epicStats.length > 0) {
      const epicsDoneEN = epicStats.filter(e => e.pct >= 100).length;
      const epicsInProgEN = epicStats.filter(e => e.pct > 0 && e.pct < 100).length;
      const epicsNotStartedEN = epicStats.filter(e => e.pct === 0).length;
      lines.push(D);
      lines.push('  V.  EPIC / PHASE PROGRESS');
      lines.push(D);
      lines.push('');
      const KW2 = { lb: 38, vl: 22 } as const;
      const kRow2 = (lb: string, vl: string) => `  │ ${lb.padEnd(KW2.lb)} │ ${vl.padStart(KW2.vl)} │`;
      lines.push(`  ┌${'─'.repeat(KW2.lb + 2)}┬${'─'.repeat(KW2.vl + 2)}┐`);
      lines.push(`  │ ${'METRIC'.padEnd(KW2.lb)} │ ${'VALUE'.padStart(KW2.vl)} │`);
      lines.push(`  ├${'─'.repeat(KW2.lb + 2)}┼${'─'.repeat(KW2.vl + 2)}┤`);
      lines.push(kRow2('Total Epics / Phases', `${epicStats.length} epic(s)`));
      lines.push(kRow2('Complete (≥100%)', `${epicsDoneEN} epic(s)`));
      lines.push(kRow2('In Progress (1–99%)', `${epicsInProgEN} epic(s)`));
      lines.push(kRow2('Not Started (0%)', `${epicsNotStartedEN} epic(s)`));
      lines.push(kRow2('Overall Completion (weighted)', `${stats.completion_pct}%`));
      lines.push(`  └${'─'.repeat(KW2.lb + 2)}┴${'─'.repeat(KW2.vl + 2)}┘`);
      lines.push('');
      lines.push('  A. EPIC DETAIL (sorted descending):');
      lines.push('');
      const EW2 = { nm: 28, pc: 6, dn: 8, tt: 8, br: 22 } as const;
      lines.push(`  ┌${'─'.repeat(EW2.nm + 2)}┬${'─'.repeat(EW2.pc + 2)}┬${'─'.repeat(EW2.dn + 2)}┬${'─'.repeat(EW2.tt + 2)}┬${'─'.repeat(EW2.br + 2)}┐`);
      lines.push(`  │ ${'EPIC / PHASE'.padEnd(EW2.nm)} │ ${'PCT'.padStart(EW2.pc)} │ ${'DONE'.padStart(EW2.dn)} │ ${'TOTAL'.padStart(EW2.tt)} │ ${'PROGRESS'.padEnd(EW2.br)} │`);
      lines.push(`  ├${'─'.repeat(EW2.nm + 2)}┼${'─'.repeat(EW2.pc + 2)}┼${'─'.repeat(EW2.dn + 2)}┼${'─'.repeat(EW2.tt + 2)}┼${'─'.repeat(EW2.br + 2)}┤`);
      [...epicStats].sort((a, b) => b.pct - a.pct).forEach(e => {
        const bLen2 = 20;
        const filled3 = Math.round((e.pct / 100) * bLen2);
        const bar3 = '█'.repeat(filled3) + '░'.repeat(bLen2 - filled3);
        lines.push(`  │ ${rp(e.phase, EW2.nm)} │ ${lp(e.pct + '%', EW2.pc)} │ ${lp(e.done, EW2.dn)} │ ${lp(e.total, EW2.tt)} │ [${bar3}] │`);
      });
      lines.push(`  └${'─'.repeat(EW2.nm + 2)}┴${'─'.repeat(EW2.pc + 2)}┴${'─'.repeat(EW2.dn + 2)}┴${'─'.repeat(EW2.tt + 2)}┴${'─'.repeat(EW2.br + 2)}┘`);
      lines.push('');
    }

    lines.push(D);
    lines.push(`  ${project.name}   ·   Project Management Office   ·   Confidential — Internal Only`);
    lines.push(D);
  }

  return lines.join('\n');
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [docs, setDocs] = useState<Record<string, Record<string, string>>>({});
  const [weeklyReports, setWeeklyReports] = useState<DocRecord[]>([]);
  const [projectName, setProjectName] = useState('');
  const [editing, setEditing] = useState<DocDef | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // PPT dialog state
  const [pptOpen, setPptOpen] = useState(false);
  const [pptForm, setPptForm] = useState<Record<string, string>>({});

  // ── Project Report state ─────────────────────────────────────────────────
  const [projReportOpen, setProjReportOpen] = useState(false);
  const [projReportMode, setProjReportMode] = useState<'date' | 'milestone'>('date');
  const [projReportStart, setProjReportStart] = useState(getDefaultStart);
  const [projReportEnd, setProjReportEnd] = useState(getDefaultEnd);
  const [projReportMilestoneId, setProjReportMilestoneId] = useState('');
  const [projReportLang, setProjReportLang] = useState('Vietnamese');
  const [projMilestones, setProjMilestones] = useState<Milestone[]>([]);
  const [projReportData, setProjReportData] = useState<ProjectReportData | null>(null);
  const [projReportText, setProjReportText] = useState('');
  const [projReportAIText, setProjReportAIText] = useState('');
  const [projReportLoading, setProjReportLoading] = useState(false);
  const [projReportAILoading, setProjReportAILoading] = useState(false);
  const [projReportView, setProjReportView] = useState<'template' | 'ai'>('template');

  const load = useCallback(async () => {
    const [data, proj, ms] = await Promise.all([
      fetch(`/api/projects/${id}/documents`).then(r => r.json()) as Promise<DocRecord[]>,
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch(`/api/projects/${id}/milestones`).then(r => r.json()).catch(() => []),
    ]);
    setProjectName(proj.name ?? '');
    setProjMilestones(Array.isArray(ms) ? ms : []);

    const map: Record<string, Record<string, string>> = {};
    const weekly: DocRecord[] = [];
    for (const d of data) {
      if (d.type === 'status_report') {
        weekly.push(d);
      } else {
        map[d.type] = JSON.parse(d.content_json || '{}');
      }
    }
    setDocs(map);
    setWeeklyReports(weekly.sort((a, b) => b.title.localeCompare(a.title)));
    if (map['kickoff_ppt']) setPptForm(map['kickoff_ppt']);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Static doc handlers ───────────────────────────────────────────────────

  const openEdit = (def: DocDef) => {
    setEditing(def);
    setForm(docs[def.type] ?? {});
  };

  const saveDoc = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/projects/${id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: editing.type, title: editing.label, content: form }),
    });
    setDocs(d => ({ ...d, [editing.type]: form }));
    setSaving(false);
    setEditing(null);
    toast.success('Document saved!');
  };

  const downloadDoc = async (type: string, label: string) => {
    setDownloading(type);
    try {
      const res = await fetch(`/api/export/word/${id}/${type}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${label.replace(/\s+/g, '-')}.docx`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} downloaded!`);
    } catch (e) { toast.error(String(e)); }
    finally { setDownloading(null); }
  };

  // ── PPT handlers ──────────────────────────────────────────────────────────

  const savePptConfig = async () => {
    await fetch(`/api/projects/${id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'kickoff_ppt', title: 'Kick-off Presentation Config', content: pptForm }),
    });
    setDocs(d => ({ ...d, kickoff_ppt: pptForm }));
  };

  const downloadPPT = async () => {
    setDownloading('kickoff_ppt');
    await savePptConfig();
    try {
      const res = await fetch(`/api/export/ppt/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pptForm),
      });
      if (!res.ok) throw new Error('PPT export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kickoff-presentation.pptx'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Kick-off Presentation downloaded!');
      setPptOpen(false);
    } catch (e) { toast.error(String(e)); }
    finally { setDownloading(null); }
  };

  // ── Weekly report handlers ────────────────────────────────────────────────

  const deleteWeekly = async (docId: number, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    await fetch(`/api/projects/${id}/documents?docId=${docId}`, { method: 'DELETE' });
    setWeeklyReports(r => r.filter(d => d.id !== docId));
    toast.success('Report deleted');
  };

  const downloadWeekly = (doc: DocRecord) => {
    const content = JSON.parse(doc.content_json || '{}') as Record<string, string>;
    const reportText = content.report_text
      || WEEKLY_FIELDS.map(f => `${f.label}:\n${content[f.key] || '—'}`).join('\n\n');
    const text = [doc.title, '='.repeat(60), '', reportText].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${doc.title}.txt`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded as text');
  };

  // ── Project Report handlers ───────────────────────────────────────────────

  const fetchAndGenerateReport = async () => {
    setProjReportLoading(true);
    setProjReportText('');
    setProjReportAIText('');
    setProjReportData(null);
    try {
      let url = `/api/projects/${id}/project-report`;
      if (projReportMode === 'date') {
        url += `?start=${projReportStart}&end=${projReportEnd}`;
      } else if (projReportMilestoneId) {
        url += `?milestone_id=${projReportMilestoneId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch report data');
      const data: ProjectReportData = await res.json();
      setProjReportData(data);
      const text = buildProjectReport(data, projReportLang);
      setProjReportText(text);
      setProjReportView('template');
    } catch (e) { toast.error(String(e)); }
    finally { setProjReportLoading(false); }
  };

  const generateAIReport = async () => {
    if (!projReportData) { toast.error('Generate template report first'); return; }
    setProjReportAILoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/project-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData: projReportData, language: projReportLang }),
      });
      const json = await res.json();
      if (json.error === 'NO_API_KEY') { toast.error('No Anthropic API key configured'); return; }
      if (json.error) throw new Error(json.error);
      setProjReportAIText(json.report);
      setProjReportView('ai');
    } catch (e) { toast.error(String(e)); }
    finally { setProjReportAILoading(false); }
  };

  const copyReport = () => {
    const text = projReportView === 'ai' ? projReportAIText : projReportText;
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const downloadReport = () => {
    const text = projReportView === 'ai' ? projReportAIText : projReportText;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '-')}_Project-Report_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded');
  };

  // ─────────────────────────────────────────────────────────────────────────

  const activeReportText = projReportView === 'ai' ? projReportAIText : projReportText;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-6">

        {/* ── Kick-off PPT ───────────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Presentation</h2>
          <Card className="p-5 flex flex-col gap-3 border-blue-200 bg-blue-50/40 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Presentation className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-slate-800">Kick-off Presentation</h3>
                <p className="text-xs text-slate-400 mt-0.5">10-slide PPT — project overview, team, timeline, risks</p>
              </div>
            </div>
            {docs['kickoff_ppt'] && (
              <div className="text-xs text-green-600 bg-green-50 rounded px-2 py-1">✓ Config saved</div>
            )}
            <div className="flex gap-2 mt-auto">
              <Button size="sm" variant="outline" onClick={() => setPptOpen(true)} className="gap-1.5 flex-1">
                <Pencil className="h-3 w-3" /> Configure
              </Button>
              <Button
                size="sm"
                disabled={downloading === 'kickoff_ppt'}
                onClick={() => setPptOpen(true)}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 flex-1"
              >
                <Download className="h-3 w-3" />
                {downloading === 'kickoff_ppt' ? 'Generating...' : 'Generate PPT'}
              </Button>
            </div>
          </Card>
        </div>

        {/* ── Project Report ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Project Report</h2>
          <Card className="p-5 flex flex-col gap-3 border-violet-200 bg-violet-50/40 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <BarChart2 className="h-4 w-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-slate-800">Project Status Report</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Báo cáo tổng hợp — tiến độ, rủi ro, issues, milestones
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Lọc theo khoảng thời gian hoặc milestone. Tự động thống kê risks & issues chưa đóng.
            </p>
            <div className="flex gap-2 mt-auto">
              <Button
                size="sm"
                onClick={() => setProjReportOpen(true)}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700 flex-1"
              >
                <BarChart2 className="h-3 w-3" /> Generate Report
              </Button>
            </div>
          </Card>
        </div>

        {/* ── Weekly Reports ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Weekly Status Reports</h2>
              <p className="text-xs text-slate-400 mt-0.5">{weeklyReports.length} report{weeklyReports.length !== 1 ? 's' : ''}</p>
            </div>
            <Link href={`/projects/${id}/reports`}>
              <Button className="bg-blue-600 hover:bg-blue-700 gap-2 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" /> New Report
              </Button>
            </Link>
          </div>

          {weeklyReports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
              <CalendarRange className="h-7 w-7 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No weekly reports yet</p>
              <Link href={`/projects/${id}/reports`} className="text-xs text-blue-500 hover:underline mt-1 inline-block">Go to Reports page to create one →</Link>
            </div>
          ) : (
            <div className="rounded-xl border bg-white overflow-hidden shadow-sm divide-y">
              {weeklyReports.map(doc => {
                const content = JSON.parse(doc.content_json || '{}') as Record<string, string>;
                const dates = parseWeeklyTitle(doc.title);
                const rag = content.overall_status ?? '';
                const pct = content.completion_pct ? Number(content.completion_pct) : undefined;
                return (
                  <div key={doc.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="w-28 shrink-0">
                      {dates ? (
                        <>
                          <p className="text-[11px] font-mono text-slate-700 font-medium">{formatDisplayDate(dates.from)}</p>
                          <p className="text-[10px] text-slate-400">→ {formatDisplayDate(dates.to)}</p>
                        </>
                      ) : (
                        <p className="text-[11px] text-slate-400">—</p>
                      )}
                    </div>

                    {pct !== undefined && (
                      <div className="w-16 shrink-0">
                        <p className="text-[10px] text-slate-500 font-medium">{pct}%</p>
                        <div className="h-1 bg-slate-100 rounded-full mt-1">
                          <div className={`h-full rounded-full ${pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-blue-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{doc.title}</p>
                      {content.report_text && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{content.report_text.slice(0, 80)}…</p>
                      )}
                    </div>

                    {rag && (
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium shrink-0 ${statusRagColor(rag)}`}>
                        {rag}
                      </span>
                    )}

                    <div className="flex gap-1.5 shrink-0">
                      <Link href={`/projects/${id}/reports`}>
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1">
                          <ExternalLink className="h-3 w-3" /> Open
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadWeekly(doc)}
                        className="h-7 px-2.5 text-xs gap-1"
                      >
                        <Download className="h-3 w-3" /> .txt
                      </Button>
                      <button
                        onClick={() => deleteWeekly(doc.id, doc.title)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Word Documents ─────────────────────────────────────────────── */}
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Word Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DOC_TYPES.map(def => {
            const filled = !!docs[def.type];
            return (
              <Card key={def.type} className="p-5 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-slate-800">{def.label}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{def.desc}</p>
                  </div>
                </div>
                {filled && (
                  <div className="text-xs text-green-600 bg-green-50 rounded px-2 py-1">✓ Content saved</div>
                )}
                <div className="flex gap-2 mt-auto">
                  <Button size="sm" variant="outline" onClick={() => openEdit(def)} className="gap-1.5 flex-1">
                    <Pencil className="h-3 w-3" />
                    {filled ? 'Edit' : 'Fill Content'}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!filled || downloading === def.type}
                    onClick={() => downloadDoc(def.type, def.label)}
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 flex-1"
                  >
                    <Download className="h-3 w-3" />
                    {downloading === def.type ? '...' : 'Download'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {/* ── PPT Config Dialog ──────────────────────────────────────────────── */}
      <Dialog open={pptOpen} onOpenChange={o => !o && setPptOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kick-off Presentation (10 slides)</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-400 -mt-2">
            Team, schedule, risks, and communication plan are pulled automatically from project data. Fill optional fields below to customize.
          </p>
          <div className="space-y-4 py-2">
            {PPT_FIELDS.map(f => (
              <div key={f.key}>
                <Label htmlFor={f.key} className="text-sm">{f.label}</Label>
                {f.multiline ? (
                  <Textarea id={f.key} className="mt-1.5 text-sm" rows={4} value={pptForm[f.key] ?? ''} onChange={e => setPptForm(x => ({ ...x, [f.key]: e.target.value }))} />
                ) : (
                  <Input id={f.key} className="mt-1.5 text-sm" value={pptForm[f.key] ?? ''} onChange={e => setPptForm(x => ({ ...x, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPptOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={async () => { await savePptConfig(); toast.success('Config saved'); }}>
              Save Config
            </Button>
            <Button onClick={downloadPPT} disabled={downloading === 'kickoff_ppt'} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Download className="h-4 w-4" />
              {downloading === 'kickoff_ppt' ? 'Generating...' : 'Generate & Download'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Static Doc Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editing?.fields.map(f => (
              <div key={f.key}>
                <Label htmlFor={f.key} className="text-sm">{f.label}</Label>
                {f.multiline ? (
                  <Textarea id={f.key} className="mt-1.5 text-sm" rows={3} value={form[f.key] ?? ''} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} />
                ) : (
                  <Input id={f.key} className="mt-1.5 text-sm" value={form[f.key] ?? ''} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveDoc} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Project Report Dialog ──────────────────────────────────────────── */}
      <Dialog open={projReportOpen} onOpenChange={o => { if (!o) { setProjReportOpen(false); } }}>
        <DialogContent className="w-[98vw] h-[96vh] max-w-none max-h-none flex flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pt-5 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-violet-600" />
              Project Status Report — {projectName}
            </DialogTitle>
          </DialogHeader>

          {/* Controls */}
          <div className="shrink-0 border rounded-lg mx-6 mt-4 p-4 bg-slate-50 space-y-4">
            {/* Mode + language row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Mode toggle */}
              <div className="flex rounded-lg overflow-hidden border bg-white">
                <button
                  onClick={() => setProjReportMode('date')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${projReportMode === 'date' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Calendar className="h-3 w-3" /> Theo thời gian
                </button>
                <button
                  onClick={() => setProjReportMode('milestone')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${projReportMode === 'milestone' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Flag className="h-3 w-3" /> Theo milestone
                </button>
              </div>

              {/* Language */}
              <Select value={projReportLang} onValueChange={(v) => v && setProjReportLang(v)}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vietnamese">Vietnamese</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date / Milestone inputs */}
            {projReportMode === 'date' ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500 w-10">From</Label>
                  <Input
                    type="date"
                    value={projReportStart}
                    onChange={e => setProjReportStart(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500 w-4">To</Label>
                  <Input
                    type="date"
                    value={projReportEnd}
                    onChange={e => setProjReportEnd(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500 w-20">Milestone</Label>
                <Select value={projReportMilestoneId} onValueChange={(v) => v && setProjReportMilestoneId(v)}>
                  <SelectTrigger className="h-8 text-xs w-72">
                    <SelectValue placeholder={projMilestones.length === 0 ? 'No milestones' : 'Select milestone…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {projMilestones.map(m => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}{m.start_date ? ` (${m.start_date}` : ''}{m.end_date ? ` → ${m.end_date})` : m.start_date ? ')' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Generate buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={fetchAndGenerateReport}
                disabled={projReportLoading || (projReportMode === 'milestone' && !projReportMilestoneId)}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700"
              >
                {projReportLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <BarChart2 className="h-3.5 w-3.5" />}
                {projReportLoading ? 'Generating…' : 'Generate Template'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={generateAIReport}
                disabled={projReportAILoading || !projReportData}
                className="gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50"
              >
                {projReportAILoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {projReportAILoading ? 'Generating with AI…' : 'Generate with Claude'}
              </Button>

              {activeReportText && (
                <>
                  <Button size="sm" variant="outline" onClick={copyReport} className="gap-1.5 ml-auto">
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadReport} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </>
              )}
            </div>

            {/* View toggle (when both are available) */}
            {projReportText && projReportAIText && (
              <div className="flex rounded-lg overflow-hidden border bg-white w-fit">
                <button
                  onClick={() => setProjReportView('template')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${projReportView === 'template' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Template
                </button>
                <button
                  onClick={() => setProjReportView('ai')}
                  className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${projReportView === 'ai' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Sparkles className="h-3 w-3" /> AI
                </button>
              </div>
            )}
          </div>

          {/* Report output */}
          <div className="flex-1 overflow-hidden mx-6 mb-4">
            {activeReportText ? (
              <div className="h-full overflow-auto">
                {projReportView === 'ai' ? (
                  <div
                    className="p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans"
                    style={{ minHeight: '100%' }}
                  >
                    {projReportAIText}
                  </div>
                ) : (
                  <pre className="p-4 text-xs font-mono text-slate-700 leading-relaxed whitespace-pre overflow-x-auto">
                    {projReportText}
                  </pre>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                <div className="text-center">
                  <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Chọn khoảng thời gian hoặc milestone rồi ấn <strong>Generate Template</strong></p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
