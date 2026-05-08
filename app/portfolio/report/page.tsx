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
  Calendar, ChevronRight, User, Building2, CalendarRange,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskItem = {
  id: number; description: string; priority: string; category: string;
  mitigation: string; owner: string; project_name: string; customer_name: string;
};
type MilestoneItem = {
  id: number; activity: string; deliverable: string; plan_end: string;
  completion_pct: number; project_name: string; customer_name: string;
};
type RecentDone = {
  id: number; activity: string; deliverable: string; actual_end: string;
  project_name: string; customer_name: string;
};
type CompletedActivity = { id: number; activity: string; deliverable: string; actual_end: string; };
type CompletedGroup = { project_name: string; customer_name: string; current_phase: string; activities: CompletedActivity[]; };
type ProjectRow = {
  id: number; name: string; customer_name: string; client: string; pm_name: string;
  current_phase: string; completion_pct: number; open_risks: number; open_issues: number;
  days_until_deadline: number | null; rag: 'red' | 'amber' | 'green';
  total_activities: number; done_activities: number;
};
type CustomerGroup = { id: number; name: string; industry: string; projects: ProjectRow[]; };
type PortfolioReportData = {
  projects: ProjectRow[];
  customers: CustomerGroup[];
  noCustomerProjects: ProjectRow[];
  kpi: {
    totalProjects: number; totalCustomers: number; avgCompletion: number;
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

  const allProjects = [...data.customers.flatMap(c => c.projects), ...data.noCustomerProjects];
  const red = allProjects.filter(p => p.rag === 'red');
  const amber = allProjects.filter(p => p.rag === 'amber');
  const green = allProjects.filter(p => p.rag === 'green');
  const overdue = allProjects.filter(p => p.days_until_deadline !== null && p.days_until_deadline < 0);

  const portfolioStatus = red.length > 0 ? 'RED' : amber.length > 0 ? 'AMBER' : 'GREEN';
  const portfolioStatusVN = red.length > 0 ? 'ĐỎ' : amber.length > 0 ? 'VÀNG' : 'XANH';

  const pad = (s: string, n: number) => s.length >= n ? s.slice(0, n) : s.padEnd(n);

  const lines: string[] = [];

  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const box1 =   '╔══════════════════════════════════════════════════════════════════╗';
  const box2 =   '╚══════════════════════════════════════════════════════════════════╝';

  if (isVN) {
    lines.push(box1);
    lines.push('║      BÁO CÁO TÌNH TRẠNG PORTFOLIO — CHARTERTECH GLOBAL          ║');
    lines.push('║               Program Management Office (PMO)                   ║');
    lines.push(box2);
    lines.push(`  Ngày báo cáo  : ${today}`);
    lines.push(`  Mã tham chiếu : PMO-${yyyymm}-001`);
    lines.push(`  Phân loại     : Bảo mật — Chỉ dành cho nội bộ`);
    lines.push(`  Phân phối     : CEO, Steering Committee, Portfolio Manager`);
    lines.push('');
    lines.push(divider);
    lines.push('  I. TÓM TẮT ĐIỀU HÀNH');
    lines.push(divider);
    lines.push('');
    lines.push(`  Trạng thái tổng thể: ● ${portfolioStatusVN}`);
    lines.push('');

    const summaryStatus = red.length > 0
      ? `Portfolio hiện có ${red.length} dự án ở mức ĐỎ cần xử lý khẩn cấp.`
      : amber.length > 0 ? `Portfolio ở mức VÀNG với ${amber.length} dự án cần theo dõi.`
        : 'Portfolio đang ở trạng thái tốt — tất cả dự án đều xanh.';
    lines.push(`  ${summaryStatus} Tổng cộng ${data.kpi.totalProjects} dự án trên ${data.kpi.totalCustomers} khách hàng,`);
    lines.push(`  tiến độ trung bình ${data.kpi.avgCompletion}%. Phân bố: ${red.length} ĐỎ, ${amber.length} VÀNG, ${green.length} XANH.`);
    if (overdue.length > 0) lines.push(`  CẢNH BÁO: ${overdue.length} dự án đã quá hạn — cần hành động ngay.`);
    if (data.kpi.totalOpenRisks === 0 && data.kpi.totalOpenIssues === 0) lines.push(`  Tốt: Hiện không có rủi ro hoặc vấn đề nào mở.`);
    lines.push('');
    lines.push('  CHỈ SỐ CHÍNH:');
    lines.push(`  ├── Dự án đang hoạt động : ${data.kpi.activeProjects} / ${data.kpi.totalProjects} tổng cộng`);
    lines.push(`  ├── Khách hàng           : ${data.kpi.totalCustomers}`);
    lines.push(`  ├── Tiến độ trung bình   : ${data.kpi.avgCompletion}%`);
    lines.push(`  ├── Rủi ro mở            : ${data.kpi.totalOpenRisks}`);
    lines.push(`  ├── Vấn đề mở            : ${data.kpi.totalOpenIssues}`);
    lines.push(`  └── Dự án quá hạn        : ${overdue.length}`);
    lines.push('');

    lines.push(divider);
    lines.push('  II. MA TRẬN SỨC KHỎE PORTFOLIO');
    lines.push(divider);
    lines.push('');
    lines.push(`  #   Trạng thái    ${'Tên dự án'.padEnd(31)} ${'Khách hàng'.padEnd(16)} ${'Phase'.padEnd(11)} ${'%'.padEnd(4)} Deadline`);
    lines.push(`  ─── ─────────────${'─'.repeat(32)} ${'─'.repeat(16)} ${'─'.repeat(11)} ${'─'.repeat(4)} ──────────`);
    const sorted = [...allProjects].sort((a, b) => {
      const o: Record<string, number> = { red: 0, amber: 1, green: 2 };
      return o[a.rag] - o[b.rag];
    });
    sorted.forEach((p, i) => {
      const ragLabel = p.rag === 'red' ? '🔴 ĐỎ     ' : p.rag === 'amber' ? '🟡 VÀNG   ' : '🟢 XANH   ';
      const dl = p.days_until_deadline;
      const dlStr = dl === null ? '—' : dl < 0 ? `QUÁ HẠN ${Math.abs(dl)}d` : `${dl}d còn`;
      lines.push(`  ${String(i + 1).padStart(3)}  ${ragLabel} ${pad(p.name, 31)} ${pad(p.customer_name || '—', 16)} ${pad(p.current_phase, 11)} ${String(p.completion_pct).padStart(3)}% ${dlStr}`);
    });
    lines.push('');
    lines.push(`  Portfolio: ${green.length} 🟢 XANH  │  ${amber.length} 🟡 VÀNG  │  ${red.length} 🔴 ĐỎ`);
    lines.push('');

    lines.push(divider);
    lines.push('  III. TIẾN ĐỘ THEO KỲ — HOÀN THÀNH TRONG GIAI ĐOẠN');
    lines.push(divider);
    lines.push(`  Kỳ báo cáo: ${periodStart} → ${periodEnd}`);
    lines.push('');
    const completedGroups = Object.values(data.completedByProject);
    if (completedGroups.length === 0) {
      lines.push('  Không có hoạt động nào hoàn thành trong giai đoạn này trên toàn portfolio.');
    } else {
      completedGroups.forEach(g => {
        lines.push(`  ▶ ${g.project_name}${g.customer_name ? ` (${g.customer_name})` : ''} — ${g.current_phase}:`);
        g.activities.forEach(a => {
          lines.push(`    ✓ ${a.activity}${a.deliverable ? ` → ${a.deliverable}` : ''}${a.actual_end ? ` [${a.actual_end}]` : ''}`);
        });
        lines.push('');
      });
    }
    lines.push('');

    lines.push(divider);
    lines.push('  IV. RỦI RO & VẤN ĐỀ NGHIÊM TRỌNG');
    lines.push(divider);
    lines.push('');
    lines.push('  RỦI RO MỞ:');
    if (data.topRisks.length === 0) {
      lines.push('  Không có rủi ro mở ở cấp portfolio.');
    } else {
      data.topRisks.slice(0, 6).forEach(r => {
        lines.push(`  ┌─ [${r.priority}] ${r.description}`);
        lines.push(`  │   Dự án     : ${r.project_name} (${r.customer_name || 'N/A'})`);
        lines.push(`  │   Danh mục  : ${r.category || '—'}`);
        lines.push(`  │   Giảm thiểu: ${r.mitigation || 'Đang đánh giá'}`);
        lines.push(`  │`);
      });
    }
    lines.push('');
    lines.push('  VẤN ĐỀ MỞ:');
    if (data.topIssues.length === 0) {
      lines.push('  Không có vấn đề mở ở cấp portfolio.');
    } else {
      data.topIssues.slice(0, 6).forEach(i => {
        lines.push(`  ┌─ [${i.priority}] ${i.description}`);
        lines.push(`  │   Dự án     : ${i.project_name} (${i.customer_name || 'N/A'})`);
        lines.push(`  │   Xử lý     : ${i.mitigation || 'Đang điều tra'}`);
        lines.push(`  │`);
      });
    }
    lines.push('');

    lines.push(divider);
    lines.push('  V. MILESTONE SẮP TỚI — 30 NGÀY');
    lines.push(divider);
    lines.push('');
    if (data.upcomingMilestones.length === 0) {
      lines.push('  Không có milestone quan trọng nào trong 30 ngày tới.');
    } else {
      lines.push(`  ${'Ngày'.padEnd(12)} ${'Hoạt động'.padEnd(38)} ${'Dự án'.padEnd(26)} ${'%'.padEnd(4)}`);
      lines.push(`  ${'─'.repeat(12)} ${'─'.repeat(38)} ${'─'.repeat(26)} ${'─'.repeat(4)}`);
      data.upcomingMilestones.forEach(m => {
        const label = m.deliverable ? `${m.activity} → ${m.deliverable}` : m.activity;
        lines.push(`  ${pad(m.plan_end || '—', 12)} ${pad(label, 38)} ${pad(m.project_name, 26)} ${String(m.completion_pct ?? 0).padStart(3)}%`);
      });
    }
    lines.push('');

    lines.push(divider);
    lines.push('  VI. BẢNG ĐIỂM KHÁCH HÀNG');
    lines.push(divider);
    lines.push('');
    lines.push(`  ${'Khách hàng'.padEnd(23)} │ ${'DA'.padEnd(8)} │ ${'Active'.padEnd(6)} │ ${'TB%'.padEnd(6)} │ ${'Sức khỏe'.padEnd(8)} │ ${'Rủi ro'.padEnd(5)} │ Vấn đề`);
    lines.push(`  ${'─'.repeat(23)} ┼ ${'─'.repeat(8)} ┼ ${'─'.repeat(6)} ┼ ${'─'.repeat(6)} ┼ ${'─'.repeat(8)} ┼ ${'─'.repeat(5)} ┼ ${'─'.repeat(6)}`);
    data.customers.forEach(c => {
      if (c.projects.length === 0) return;
      const avgPct = Math.round(c.projects.reduce((s, p) => s + p.completion_pct, 0) / c.projects.length);
      const activeCount = c.projects.filter(p => p.current_phase !== 'Closing').length;
      const worstRag = c.projects.some(p => p.rag === 'red') ? '🔴 ĐỎ' : c.projects.some(p => p.rag === 'amber') ? '🟡 VÀNG' : '🟢 XANH';
      const risks = c.projects.reduce((s, p) => s + p.open_risks, 0);
      const issues = c.projects.reduce((s, p) => s + p.open_issues, 0);
      lines.push(`  ${pad(c.name, 23)} │ ${String(c.projects.length).padEnd(8)} │ ${String(activeCount).padEnd(6)} │ ${String(avgPct).padStart(4)}%  │ ${pad(worstRag, 8)} │ ${String(risks).padStart(5)} │ ${String(issues).padStart(6)}`);
    });
    if (data.noCustomerProjects.length > 0) {
      lines.push('');
      lines.push(`  ${data.noCustomerProjects.length} dự án chưa gán khách hàng`);
    }
    lines.push('');

    lines.push(divider);
    lines.push('  VII. HÀNH ĐỘNG CẦN THIẾT — Steering Committee / CEO');
    lines.push(divider);
    lines.push('');
    const criticalRisks = data.topRisks.filter(r => r.priority === 'Critical');
    const actions: string[] = [];
    red.forEach(p => {
      const dl = p.days_until_deadline;
      const dlDesc = dl !== null && dl < 0 ? `QUÁ HẠN ${Math.abs(dl)}d` : 'Đang gặp rủi ro';
      actions.push(`  • CẦN LEO THANG — ${p.name} (${p.customer_name || 'N/A'}) ${dlDesc}. Đề xuất: xem xét tại steering, bổ sung nguồn lực. Ưu tiên: KHẨN CẤP`);
    });
    criticalRisks.forEach(r => {
      actions.push(`  • CẦN QUYẾT ĐỊNH — ${r.description} tại ${r.project_name}. Đề xuất: ${r.mitigation || 'Đánh giá và hành động ngay'}. Ưu tiên: KHẨN CẤP`);
    });
    if (actions.length === 0) {
      lines.push('  Không có leo thang nào cần CEO xử lý ngay. Portfolio đang trong tầm kiểm soát.');
    } else {
      actions.forEach(a => lines.push(a));
    }
    lines.push('');
    lines.push(divider);
    lines.push(`  ${companyName}  │  Program Management Office`);
    lines.push('  Bảo mật — Chỉ dành cho nội bộ');
    lines.push(divider);
  } else {
    lines.push(box1);
    lines.push('║      PORTFOLIO STATUS REPORT — CHARTERTECH GLOBAL              ║');
    lines.push('║               Program Management Office (PMO)                  ║');
    lines.push(box2);
    lines.push(`  Report Date    : ${today}`);
    lines.push(`  Report Ref     : PMO-${yyyymm}-001`);
    lines.push(`  Classification : Confidential — Internal Distribution Only`);
    lines.push(`  Distribution   : CEO, Steering Committee, Portfolio Manager`);
    lines.push('');
    lines.push(divider);
    lines.push('  I. EXECUTIVE SUMMARY');
    lines.push(divider);
    lines.push('');
    lines.push(`  Overall Portfolio Status: ● ${portfolioStatus}`);
    lines.push('');

    const summaryStatus = red.length > 0
      ? `Portfolio is at RED status with ${red.length} project(s) requiring immediate attention.`
      : amber.length > 0 ? `Portfolio is at AMBER status with ${amber.length} project(s) under close monitoring.`
        : 'Portfolio is in good health — all projects are tracking GREEN.';
    lines.push(`  ${summaryStatus} A total of ${data.kpi.totalProjects} projects are active across ${data.kpi.totalCustomers} customer`);
    lines.push(`  accounts, with an average completion rate of ${data.kpi.avgCompletion}%. Status distribution: ${red.length} RED, ${amber.length} AMBER, ${green.length} GREEN.`);
    if (overdue.length > 0) lines.push(`  ALERT: ${overdue.length} project(s) are past their deadline — immediate action required.`);
    if (data.kpi.totalOpenRisks === 0 && data.kpi.totalOpenIssues === 0) lines.push(`  Positive: No open risks or issues recorded at the portfolio level.`);
    lines.push('');
    lines.push('  KEY METRICS:');
    lines.push(`  ├── Active Projects     : ${data.kpi.activeProjects} of ${data.kpi.totalProjects} total`);
    lines.push(`  ├── Customers Served    : ${data.kpi.totalCustomers}`);
    lines.push(`  ├── Avg. Completion     : ${data.kpi.avgCompletion}%`);
    lines.push(`  ├── Open Risks          : ${data.kpi.totalOpenRisks}`);
    lines.push(`  ├── Open Issues         : ${data.kpi.totalOpenIssues}`);
    lines.push(`  └── Overdue Projects    : ${overdue.length}`);
    lines.push('');

    lines.push(divider);
    lines.push('  II. PORTFOLIO HEALTH MATRIX');
    lines.push(divider);
    lines.push('');
    lines.push(`  #   ${'Status'.padEnd(11)} ${'Project Name'.padEnd(31)} ${'Customer'.padEnd(16)} ${'Phase'.padEnd(11)} ${'%'.padEnd(4)} Deadline`);
    lines.push(`  ─── ${'─'.repeat(11)} ${'─'.repeat(31)} ${'─'.repeat(16)} ${'─'.repeat(11)} ${'─'.repeat(4)} ──────────`);
    const sorted = [...allProjects].sort((a, b) => {
      const o: Record<string, number> = { red: 0, amber: 1, green: 2 };
      return o[a.rag] - o[b.rag];
    });
    sorted.forEach((p, i) => {
      const ragLabel = p.rag === 'red' ? '🔴 RED    ' : p.rag === 'amber' ? '🟡 AMBER  ' : '🟢 GREEN  ';
      const dl = p.days_until_deadline;
      const dlStr = dl === null ? '—' : dl < 0 ? `OVERDUE ${Math.abs(dl)}d` : `${dl}d left`;
      lines.push(`  ${String(i + 1).padStart(3)}  ${ragLabel} ${pad(p.name, 31)} ${pad(p.customer_name || '—', 16)} ${pad(p.current_phase, 11)} ${String(p.completion_pct).padStart(3)}% ${dlStr}`);
    });
    lines.push('');
    lines.push(`  Portfolio: ${green.length} 🟢 GREEN  │  ${amber.length} 🟡 AMBER  │  ${red.length} 🔴 RED`);
    lines.push('');

    lines.push(divider);
    lines.push('  III. PROGRESS REPORT — COMPLETED IN PERIOD');
    lines.push(divider);
    lines.push(`  Reporting Period: ${periodStart} → ${periodEnd}`);
    lines.push('');
    const completedGroupsEN = Object.values(data.completedByProject);
    if (completedGroupsEN.length === 0) {
      lines.push('  No activities completed in this period across the portfolio.');
    } else {
      completedGroupsEN.forEach(g => {
        lines.push(`  ▶ ${g.project_name}${g.customer_name ? ` (${g.customer_name})` : ''} — ${g.current_phase}:`);
        g.activities.forEach(a => {
          lines.push(`    ✓ ${a.activity}${a.deliverable ? ` → ${a.deliverable}` : ''}${a.actual_end ? ` [${a.actual_end}]` : ''}`);
        });
        lines.push('');
      });
    }
    lines.push('');

    lines.push(divider);
    lines.push('  IV. CRITICAL RISKS & ISSUES');
    lines.push(divider);
    lines.push('');
    lines.push('  OPEN RISKS:');
    if (data.topRisks.length === 0) {
      lines.push('  No open risks at portfolio level.');
    } else {
      data.topRisks.slice(0, 6).forEach(r => {
        lines.push(`  ┌─ [${r.priority}] ${r.description}`);
        lines.push(`  │   Project   : ${r.project_name} (${r.customer_name || 'N/A'})`);
        lines.push(`  │   Category  : ${r.category || '—'}`);
        lines.push(`  │   Mitigation: ${r.mitigation || 'Under assessment'}`);
        lines.push(`  │`);
      });
    }
    lines.push('');
    lines.push('  OPEN ISSUES:');
    if (data.topIssues.length === 0) {
      lines.push('  No open issues at portfolio level.');
    } else {
      data.topIssues.slice(0, 6).forEach(i => {
        lines.push(`  ┌─ [${i.priority}] ${i.description}`);
        lines.push(`  │   Project   : ${i.project_name} (${i.customer_name || 'N/A'})`);
        lines.push(`  │   Resolution: ${i.mitigation || 'Under investigation'}`);
        lines.push(`  │`);
      });
    }
    lines.push('');

    lines.push(divider);
    lines.push('  V. UPCOMING MILESTONES — Next 30 Days');
    lines.push(divider);
    lines.push('');
    if (data.upcomingMilestones.length === 0) {
      lines.push('  No significant milestones in the next 30 days.');
    } else {
      lines.push(`  ${'DATE'.padEnd(12)} ${'MILESTONE'.padEnd(38)} ${'PROJECT'.padEnd(26)} ${'PCT'.padEnd(4)}`);
      lines.push(`  ${'─'.repeat(12)} ${'─'.repeat(38)} ${'─'.repeat(26)} ${'─'.repeat(4)}`);
      data.upcomingMilestones.forEach(m => {
        const label = m.deliverable ? `${m.activity} → ${m.deliverable}` : m.activity;
        lines.push(`  ${pad(m.plan_end || '—', 12)} ${pad(label, 38)} ${pad(m.project_name, 26)} ${String(m.completion_pct ?? 0).padStart(3)}%`);
      });
    }
    lines.push('');

    lines.push(divider);
    lines.push('  VI. CUSTOMER PORTFOLIO SCORECARD');
    lines.push(divider);
    lines.push('');
    lines.push(`  ${'Customer'.padEnd(23)} │ ${'Projects'.padEnd(8)} │ ${'Active'.padEnd(6)} │ ${'Avg%'.padEnd(6)} │ ${'Health'.padEnd(8)} │ ${'Risks'.padEnd(5)} │ Issues`);
    lines.push(`  ${'─'.repeat(23)} ┼ ${'─'.repeat(8)} ┼ ${'─'.repeat(6)} ┼ ${'─'.repeat(6)} ┼ ${'─'.repeat(8)} ┼ ${'─'.repeat(5)} ┼ ${'─'.repeat(6)}`);
    data.customers.forEach(c => {
      if (c.projects.length === 0) return;
      const avgPct = Math.round(c.projects.reduce((s, p) => s + p.completion_pct, 0) / c.projects.length);
      const activeCount = c.projects.filter(p => p.current_phase !== 'Closing').length;
      const worstRag = c.projects.some(p => p.rag === 'red') ? '🔴 RED' : c.projects.some(p => p.rag === 'amber') ? '🟡 AMBER' : '🟢 GREEN';
      const risks = c.projects.reduce((s, p) => s + p.open_risks, 0);
      const issues = c.projects.reduce((s, p) => s + p.open_issues, 0);
      lines.push(`  ${pad(c.name, 23)} │ ${String(c.projects.length).padEnd(8)} │ ${String(activeCount).padEnd(6)} │ ${String(avgPct).padStart(4)}%  │ ${pad(worstRag, 8)} │ ${String(risks).padStart(5)} │ ${String(issues).padStart(6)}`);
    });
    if (data.noCustomerProjects.length > 0) {
      lines.push('');
      lines.push(`  ${data.noCustomerProjects.length} project(s) not assigned to any customer`);
    }
    lines.push('');

    lines.push(divider);
    lines.push('  VII. ACTIONS REQUIRED — Steering Committee / CEO');
    lines.push(divider);
    lines.push('');
    const criticalRisks = data.topRisks.filter(r => r.priority === 'Critical');
    const actions: string[] = [];
    red.forEach(p => {
      const dl = p.days_until_deadline;
      const dlDesc = dl !== null && dl < 0 ? `OVERDUE ${Math.abs(dl)}d` : 'At Risk';
      actions.push(`  • ESCALATION REQUIRED — ${p.name} (${p.customer_name || 'N/A'}) is ${dlDesc}. Recommend: steering committee review and resource injection. Priority: URGENT`);
    });
    criticalRisks.forEach(r => {
      actions.push(`  • DECISION NEEDED — ${r.description} in ${r.project_name}. Recommend: ${r.mitigation || 'Immediate assessment and action'}. Priority: URGENT`);
    });
    if (actions.length === 0) {
      lines.push('  No immediate CEO escalations required at this time. Portfolio is under control.');
    } else {
      actions.forEach(a => lines.push(a));
    }
    lines.push('');
    lines.push(divider);
    lines.push(`  ${companyName}  │  Program Management Office`);
    lines.push('  Confidential — For Internal Distribution Only');
    lines.push(divider);
  }

  return lines.join('\n');
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
      setReport('');
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
        customers: data.customers.map(c => ({
          name: c.name, industry: c.industry,
          projects: c.projects.map(p => ({
            name: p.name, customer_name: p.customer_name, current_phase: p.current_phase,
            completion_pct: p.completion_pct, open_risks: p.open_risks, open_issues: p.open_issues,
            days_until_deadline: p.days_until_deadline, rag: p.rag, pm_name: p.pm_name,
          })),
        })),
        noCustomerProjects: data.noCustomerProjects.map(p => ({
          name: p.name, customer_name: '', current_phase: p.current_phase,
          completion_pct: p.completion_pct, open_risks: p.open_risks, open_issues: p.open_issues,
          days_until_deadline: p.days_until_deadline, rag: p.rag, pm_name: p.pm_name,
        })),
        topRisks: data.topRisks.map(r => ({ priority: r.priority, description: r.description, project_name: r.project_name, customer_name: r.customer_name || '' })),
        topIssues: data.topIssues.map(i => ({ priority: i.priority, description: i.description, project_name: i.project_name, customer_name: i.customer_name || '' })),
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
      toast.success('AI portfolio report generated!');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => mode === 'ai' ? generateAI() : generateManual();

  const copyReport = () => { navigator.clipboard.writeText(report); toast.success('Copied to clipboard!'); };

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

  const sendEmail = () => {
    if (!report) { toast.error('Generate a report first'); return; }
    const subject = encodeURIComponent(`[${companyName}] Portfolio Status Report — ${new Date().toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' })}`);
    navigator.clipboard.writeText(report).catch(() => {});
    const shortBody = encodeURIComponent(
      `${language === 'Vietnamese' ? 'Kính gửi,' : 'Dear CEO,'}\n\nPlease find the portfolio status report below.\n\n[Report content copied to clipboard — paste here]\n\n---\nSent via ${companyName} PM Tool`
    );
    window.open(`mailto:${ceoEmail}?subject=${subject}&body=${shortBody}`, '_self');
    toast.success('Email client opened. Full report copied to clipboard.');
  };

  const allProjects = data ? [...data.customers.flatMap(c => c.projects), ...data.noCustomerProjects] : [];
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
                <div className="text-2xl font-bold text-slate-800">{data.kpi.totalCustomers}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Customers</div>
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
                        {group.customer_name && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <Building2 className="h-3 w-3" />{group.customer_name}
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
                      <th className="px-4 py-2.5 text-left">Customer</th>
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
                        <td className="px-4 py-3 text-slate-500 text-xs">{p.customer_name || p.client || '—'}</td>
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
                              {r.project_name}{r.customer_name ? ` · ${r.customer_name}` : ''}
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
                              {i.project_name}{i.customer_name ? ` · ${i.customer_name}` : ''}
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

          {/* ── 7. Customer Scorecard ── */}
          {data && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-300" />
                  VI. Customer Portfolio Scorecard
                </h2>
                <Badge className="bg-slate-600 text-slate-200 border-0 text-xs">{data.customers.length} customers</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left">Customer</th>
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
                    {data.customers.filter(c => c.projects.length > 0).map(c => {
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
                {data.noCustomerProjects.length > 0 && (
                  <div className="px-5 py-3 border-t text-xs text-slate-400 italic">
                    {data.noCustomerProjects.length} project(s) not assigned to any customer
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
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" onClick={copyReport} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white">
                    <Copy className="h-3 w-3" /> Copy
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
                <Textarea
                  className="w-full min-h-[500px] text-sm leading-relaxed border border-slate-200 rounded-lg resize-none focus-visible:ring-1 focus-visible:ring-blue-400 p-4 text-slate-700 font-mono"
                  value={report}
                  onChange={e => setReport(e.target.value)}
                />
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
                    placeholder="ceo@chartertech.com"
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
