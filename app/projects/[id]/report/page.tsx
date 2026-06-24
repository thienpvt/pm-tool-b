'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Sparkles, Copy, Download, Mail, KeyRound, RefreshCw,
  FileText, Calendar, Loader2, FileDown, BarChart2, Flag,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  bugStats?: { total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; snapshotDate?: string | null } | null;
  teamStats?: {
    total: number; currentMonth: string; fullTime: number; partTime: number;
    overloaded: { name: string; domain: string; role: string; capacity: number }[];
    byDomain: { domain: string; members: { name: string; role: string; capacity: number }[] }[];
    allocationList: { name: string; role: string; domain: string; avgCapacity: number }[];
  } | null;
};
type SavedPrompt = { id: string; name: string; text: string };
const SAVED_PROMPTS_KEY = 'project_report_saved_prompts';
const MAX_SAVED_PROMPTS = 5;

// ─── Email prompt templates ───────────────────────────────────────────────────
const EMAIL_PROMPT_TEMPLATES = [
  {
    id: 'executive',
    label: 'Báo cáo điều hành',
    text: `Bạn là PM của dự án. Viết email báo cáo tình trạng dự án gửi Project Sponsor và Ban Lãnh đạo với các phần:
1. Tóm tắt điều hành: Tình trạng tổng thể (RAG), tiến độ hoàn thành, nhận xét chính
2. Sức khỏe dự án: Phân tích chi tiết từng epic/phase, chỉ số quan trọng
3. Rủi ro & Vấn đề: Liệt kê và phân tích tác động
4. Hoàn thành trong kỳ: Điểm nổi bật và deliverables đã đạt được
5. Kế hoạch tiếp theo: Ưu tiên 30 ngày tới, các quyết định cần từ Sponsor
Tone: chuyên nghiệp, súc tích, dựa trên dữ liệu. Highlight rõ điểm cần quyết định.`,
  },
  {
    id: 'quick',
    label: 'Cập nhật nhanh',
    text: `Viết email cập nhật nhanh dự án (tối đa 350 từ) với 3-4 điểm nổi bật của kỳ báo cáo. Format: bullet points ngắn gọn. Kết thúc bằng 1-2 action items cần Sponsor xử lý (nếu có).`,
  },
  {
    id: 'risk',
    label: 'Cảnh báo rủi ro',
    text: `Viết email cảnh báo rủi ro cho Project Sponsor. Phân tích chi tiết: rủi ro/vấn đề đang mở, nguyên nhân gốc rễ, tác động đến tiến độ, và quyết định/hỗ trợ cần thiết từ Sponsor để xử lý ngay.`,
  },
  {
    id: 'milestone',
    label: 'Review tiến độ',
    text: `Viết email review tiến độ dự án: thành tựu đã đạt trong kỳ, tình trạng các milestone (đúng tiến độ vs có rủi ro), tiến độ tổng thể so với kế hoạch ban đầu, và cảnh báo sớm nếu cần điều chỉnh.`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try { return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}
function getThisMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}
function getThisSunday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}
function mdToHtml(text: string): string {
  const fmt = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
  const ls = text.split('\n');
  let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:860px;margin:0 auto;color:#1e293b;font-size:14px;line-height:1.75;padding:28px;background:white;">';
  let inUl = false; let inOl = false;
  ls.forEach(line => {
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
function wrapEmailDocument(innerHtml: string, companyName: string, projectName: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Project Report</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
  <tr><td style="padding:24px 12px;">
    <table role="presentation" style="max-width:780px;margin:0 auto;width:100%;">
      <tr><td style="background:#ffffff;border-radius:12px;overflow:hidden;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        ${innerHtml}
      </td></tr>
      <tr><td style="padding:16px 0;text-align:center;font-size:11px;color:#94a3b8;line-height:1.8;">
        ${companyName ? `<strong style="color:#64748b;">${companyName}</strong> · ` : ''}Báo cáo Dự án: ${projectName} · Bảo mật — Nội bộ<br>
        &copy; ${year} ${companyName || 'PMO'}. Gửi từ PMO Tool.
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

// ─── SVG Chart Helpers ────────────────────────────────────────────────────────
function svgDonut(segs: {val:number,color:string}[], size=140, r=58, inner=36, centerPct?: number): string {
  const total = segs.reduce((a,s) => a+s.val, 0);
  const cx = size/2, cy = size/2;
  const emptyRing = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(0,0,0,0.07)" stroke-width="${r - inner}"/>`;
  if (total === 0) return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${emptyRing}</svg>`;
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
    ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#111827">${centerPct}%</text><text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="9" fill="#6B7280">xong</text>`
    : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}${hole}${lbl}</svg>`;
}

// ─── HTML Report Builder ──────────────────────────────────────────────────────
function buildProjectHtmlReport(data: ProjectReportData, language: string, companyName = ''): string {
  const isVN = language === 'Vietnamese';
  const { project, stats, epicStats, completedInPeriod, upcomingActivities, openRisks, openIssues, bugStats, periodStart, periodEnd, teamStats } = data;
  const today = new Date().toLocaleDateString(isVN ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const rag = project.rag;
  const ragColor = rag === 'red' ? '#DC2626' : rag === 'amber' ? '#D97706' : '#16A34A';
  const ragLabel = isVN ? (rag === 'red' ? 'ĐỎ' : rag === 'amber' ? 'VÀNG' : 'XANH') : (rag === 'red' ? 'RED' : rag === 'amber' ? 'AMBER' : 'GREEN');
  const ragBg = rag === 'red' ? '#FEF2F2' : rag === 'amber' ? '#FFFBEB' : '#F0FDF4';

  // Donut 1: overall progress (done/inprog/notstarted)
  const donut1 = svgDonut([
    { val: stats.done, color: '#16A34A' },
    { val: stats.inProgress, color: '#3B82F6' },
    { val: stats.notStarted, color: '#E5E7EB' },
  ], 140, 58, 36, stats.completion_pct);

  // Donut 2: risks/issues status
  const totalRI = openRisks.length + openIssues.length;
  const donut2 = svgDonut(
    totalRI === 0
      ? [{ val: 1, color: '#16A34A' }]
      : [
          { val: openRisks.filter(r => r.priority === 'Critical').length, color: '#DC2626' },
          { val: openRisks.filter(r => r.priority === 'High').length, color: '#F97316' },
          { val: openRisks.filter(r => !['Critical','High'].includes(r.priority)).length + openIssues.length, color: '#FBBF24' },
        ],
    140, 58, 36
  );

  // Bug donuts
  let bugDonut1 = '', bugDonut2 = '', bugSection = '';
  if (bugStats && bugStats.total > 0) {
    const STATUS_COLORS: Record<string,string> = {
      'Open':'#DC2626','New':'#DC2626','To Do':'#F97316','To-do':'#F97316',
      'In Progress':'#3B82F6','In Review':'#8B5CF6','Testing':'#0891B2','In Testing':'#0891B2',
      'Done':'#16A34A','Closed':'#6B7280','Deployed':'#16A34A','ANBM':'#16A34A',
    };
    const PRIO_COLORS: Record<string,string> = {
      'Critical':'#DC2626','Highest':'#EF4444','High':'#F97316','Medium':'#FBBF24','Low':'#86EFAC','Lowest':'#D1FAE5',
    };
    const statusEntries = Object.entries(bugStats.byStatus).sort((a,b)=>b[1]-a[1]);
    const prioEntries = ['Critical','Highest','High','Medium','Low','Lowest']
      .filter(p => bugStats.byPriority[p])
      .map(p => [p, bugStats.byPriority[p]] as [string,number]);

    bugDonut1 = svgDonut(statusEntries.map(([st,cnt]) => ({ val: cnt, color: STATUS_COLORS[st] ?? '#9CA3AF' })), 130, 54, 32);
    bugDonut2 = svgDonut(prioEntries.map(([pr,cnt]) => ({ val: cnt, color: PRIO_COLORS[pr] ?? '#9CA3AF' })), 130, 54, 32);

    const critBugs = (bugStats.byPriority['Critical']??0)+(bugStats.byPriority['Highest']??0);
    const openBugs = (bugStats.byStatus['Open']??0)+(bugStats.byStatus['New']??0)+(bugStats.byStatus['To Do']??0)+(bugStats.byStatus['To-do']??0);
    bugSection = `
    <div style="margin:32px 0 0;padding-top:24px;border-top:1px solid #E5E7EB;">
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:16px;">
        <h2 style="font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.8px;margin:0;">Bug Report</h2>
        ${bugStats.snapshotDate ? `<span style="font-size:10px;color:#94A3B8;">snapshot: ${bugStats.snapshotDate}</span>` : ''}
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <div style="background:#FEF2F2;border-radius:8px;padding:12px 18px;min-width:100px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#DC2626;">${bugStats.total}</div>
          <div style="font-size:11px;color:#6B7280;">Total Bugs</div>
        </div>
        <div style="background:#FFF7ED;border-radius:8px;padding:12px 18px;min-width:100px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#EA580C;">${critBugs}</div>
          <div style="font-size:11px;color:#6B7280;">Critical/Highest</div>
        </div>
        <div style="background:#FEF9C3;border-radius:8px;padding:12px 18px;min-width:100px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#D97706;">${openBugs}</div>
          <div style="font-size:11px;color:#6B7280;">Open/New</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:8px;">${isVN ? 'Theo trạng thái' : 'By Status'}</div>
          <div style="display:flex;align-items:center;gap:10px;">${bugDonut1}
            <div style="font-size:11px;color:#374151;">
              ${statusEntries.slice(0,5).map(([st,cnt])=>`<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;"><span style="width:8px;height:8px;border-radius:50%;background:${STATUS_COLORS[st]??'#9CA3AF'};display:inline-block;"></span>${st}: <strong>${cnt}</strong></div>`).join('')}
            </div>
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:8px;">${isVN ? 'Theo priority' : 'By Priority'}</div>
          <div style="display:flex;align-items:center;gap:10px;">${bugDonut2}
            <div style="font-size:11px;color:#374151;">
              ${prioEntries.map(([pr,cnt])=>`<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;"><span style="width:8px;height:8px;border-radius:50%;background:${PRIO_COLORS[pr]??'#9CA3AF'};display:inline-block;"></span>${pr}: <strong>${cnt}</strong></div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  const legendItems = [
    { color: '#16A34A', label: isVN ? 'Hoàn thành' : 'Done' },
    { color: '#3B82F6', label: isVN ? 'Đang thực hiện' : 'In Progress' },
    { color: '#E5E7EB', label: isVN ? 'Chưa bắt đầu' : 'Not Started' },
  ];

  const css = `<style>
.prpt{background:#FFF;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;}
.prpt *{box-sizing:border-box;}
.prpt .tb{background:#FFF;border-bottom:3px solid #E8192C;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;}
.prpt .tb-l{font-family:Georgia,serif;font-size:14px;font-weight:700;color:#111827;margin:0;}
.prpt .tb-s{font-size:10px;color:#6B7280;margin:2px 0 0;letter-spacing:.8px;text-transform:uppercase;}
.prpt .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#E5E7EB;border-bottom:1px solid #E5E7EB;}
.prpt .kpi-c{background:#FFF;padding:14px 18px;}
.prpt .kpi-v{font-size:24px;font-weight:700;color:#111827;line-height:1;}
.prpt .kpi-l{font-size:11px;color:#6B7280;margin-top:4px;}
.prpt .kpi-s{font-size:11px;font-weight:600;margin-top:2px;}
.prpt .rag{padding:10px 24px;display:flex;align-items:center;gap:10px;font-size:12px;}
.prpt .body{padding:24px;}
.prpt .sec-h{font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.8px;margin:0 0 14px;}
.prpt .card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;}
.prpt .pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;}
.prpt .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.prpt .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.prpt .act-row{padding:8px 0;border-bottom:1px solid #F1F5F9;display:flex;gap:8px;align-items:flex-start;}
.prpt .act-row:last-child{border-bottom:none;}
.prpt .badge-done{background:#DCFCE7;color:#166534;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;}
.prpt .badge-up{background:#EFF6FF;color:#1D4ED8;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;}
.prpt .risk-row{padding:8px 12px;border-radius:6px;margin-bottom:6px;border-left:3px solid;}
.prpt .prog-bar-bg{background:#E5E7EB;border-radius:4px;height:6px;overflow:hidden;}
.prpt .prog-bar-fill{height:100%;border-radius:4px;}
</style>`;

  const ragSummary = rag === 'red'
    ? (isVN ? `Dự án đang gặp vấn đề nghiêm trọng cần xử lý khẩn cấp.` : `Project has critical issues requiring immediate action.`)
    : rag === 'amber'
    ? (isVN ? `Dự án có rủi ro cần theo dõi sát sao.` : `Project has risks requiring close monitoring.`)
    : (isVN ? `Dự án đang vận hành tốt — tất cả chỉ số trong ngưỡng kiểm soát.` : `Project is tracking well — all indicators within acceptable range.`);

  const html = `${css}
<div class="prpt">
  <!-- Header -->
  <div class="tb">
    <div>
      <p class="tb-l">${isVN ? 'BÁO CÁO TÌNH TRẠNG DỰ ÁN' : 'PROJECT STATUS REPORT'}</p>
      <p class="tb-s">${project.name}${companyName ? ' · ' + companyName : ''}</p>
    </div>
    <div style="text-align:right;">
      <span class="pill" style="background:${ragBg};color:${ragColor};font-size:13px;padding:5px 14px;">● ${ragLabel}</span>
      <p style="font-size:10px;color:#6B7280;margin:4px 0 0;">${today}</p>
    </div>
  </div>

  <!-- KPI cards -->
  <div class="kpi">
    <div class="kpi-c">
      <div class="kpi-v">${stats.total}</div>
      <div class="kpi-l">${isVN ? 'Tổng hoạt động' : 'Total Activities'}</div>
      <div class="kpi-s" style="color:#3B82F6;">${stats.inProgress} ${isVN ? 'đang thực hiện' : 'in progress'}</div>
    </div>
    <div class="kpi-c">
      <div class="kpi-v" style="color:${stats.completion_pct >= 70 ? '#16A34A' : stats.completion_pct >= 40 ? '#D97706' : '#DC2626'};">${stats.completion_pct}%</div>
      <div class="kpi-l">${isVN ? 'Tiến độ (trọng số)' : 'Completion (wtd)'}</div>
      <div class="kpi-s" style="color:#16A34A;">${stats.done} ${isVN ? 'hoàn thành' : 'done'}</div>
    </div>
    <div class="kpi-c">
      <div class="kpi-v" style="color:${openRisks.length > 0 ? '#DC2626' : '#16A34A'};">${openRisks.length}</div>
      <div class="kpi-l">${isVN ? 'Rủi ro đang mở' : 'Open Risks'}</div>
      <div class="kpi-s" style="color:#DC2626;">${openRisks.filter(r=>r.priority==='Critical').length} critical</div>
    </div>
    <div class="kpi-c">
      <div class="kpi-v" style="color:${openIssues.length > 0 ? '#D97706' : '#16A34A'};">${openIssues.length}</div>
      <div class="kpi-l">${isVN ? 'Vấn đề đang mở' : 'Open Issues'}</div>
      <div class="kpi-s" style="color:#D97706;">${project.days_until_deadline !== null ? (project.days_until_deadline < 0 ? `${isVN ? 'Quá hạn' : 'OVERDUE'} ${Math.abs(project.days_until_deadline)}d` : `${project.days_until_deadline}d ${isVN ? 'còn lại' : 'remaining'}`) : '—'}</div>
    </div>
  </div>

  <!-- RAG bar -->
  <div class="rag" style="background:${ragBg};border-bottom:1px solid ${ragColor}22;">
    <span style="width:8px;height:8px;border-radius:50%;background:${ragColor};display:inline-block;"></span>
    <strong style="color:${ragColor};">${ragLabel}</strong>
    <span style="color:#374151;">${ragSummary}</span>
    ${project.days_until_deadline !== null && project.days_until_deadline < 0 ? `<span class="pill" style="background:#FEF2F2;color:#DC2626;margin-left:auto;">${isVN?'QUÁ HẠN':'OVERDUE'} ${Math.abs(project.days_until_deadline)}d</span>` : ''}
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Charts row -->
    <div class="grid2" style="margin-bottom:28px;">
      <!-- Donut: overall progress -->
      <div class="card">
        <div class="sec-h">${isVN ? 'Tiến độ tổng thể' : 'Overall Progress'}</div>
        <div style="display:flex;align-items:center;gap:16px;">
          ${donut1}
          <div>
            ${legendItems.map(l=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:12px;"><span style="width:10px;height:10px;border-radius:50%;background:${l.color};display:inline-block;"></span>${l.label}</div>`).join('')}
            <div style="margin-top:10px;">
              <div class="prog-bar-bg"><div class="prog-bar-fill" style="width:${stats.completion_pct}%;background:${ragColor};"></div></div>
              <div style="font-size:10px;color:#6B7280;margin-top:3px;">${stats.completion_pct}% ${isVN?'hoàn thành':'complete'}</div>
            </div>
          </div>
        </div>
        <div style="margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;">
          <div style="background:#DCFCE7;border-radius:6px;padding:6px 0;"><div style="font-size:16px;font-weight:700;color:#166534;">${stats.done}</div><div style="font-size:10px;color:#6B7280;">${isVN?'Xong':'Done'}</div></div>
          <div style="background:#EFF6FF;border-radius:6px;padding:6px 0;"><div style="font-size:16px;font-weight:700;color:#1D4ED8;">${stats.inProgress}</div><div style="font-size:10px;color:#6B7280;">${isVN?'Đang làm':'In Prog'}</div></div>
          <div style="background:#F9FAFB;border-radius:6px;padding:6px 0;"><div style="font-size:16px;font-weight:700;color:#374151;">${stats.notStarted}</div><div style="font-size:10px;color:#6B7280;">${isVN?'Chưa làm':'Not Strt'}</div></div>
        </div>
      </div>

      <!-- Donut: Risks & Issues -->
      <div class="card">
        <div class="sec-h">${isVN ? 'Rủi ro & Vấn đề' : 'Risks & Issues'}</div>
        <div style="display:flex;align-items:center;gap:16px;">
          ${donut2}
          <div style="flex:1;">
            ${openRisks.length === 0 && openIssues.length === 0
              ? `<div style="color:#16A34A;font-size:13px;font-weight:600;">✓ ${isVN?'Không có rủi ro/vấn đề':'No open risks or issues'}</div>`
              : `
            <div style="font-size:12px;margin-bottom:8px;">
              <strong>${openRisks.length}</strong> ${isVN?'rủi ro':'risks'} &nbsp;·&nbsp; <strong>${openIssues.length}</strong> ${isVN?'vấn đề':'issues'}
            </div>
            ${[...openRisks.slice(0,3), ...openIssues.slice(0,2)].map(r => {
              const prioColor = r.priority==='Critical'?'#DC2626':r.priority==='High'?'#F97316':'#D97706';
              return `<div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:4px;font-size:11px;"><span class="pill" style="background:${prioColor}20;color:${prioColor};font-size:9px;padding:1px 5px;white-space:nowrap;">${r.priority}</span><span style="color:#374151;">${r.description.slice(0,60)}${r.description.length>60?'…':''}</span></div>`;
            }).join('')}`
            }
          </div>
        </div>
        <div style="margin-top:12px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
          <div style="background:#FEF2F2;border-radius:6px;padding:8px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#DC2626;">${openRisks.length}</div>
            <div style="font-size:10px;color:#6B7280;">${isVN?'Rủi ro mở':'Open Risks'}</div>
          </div>
          <div style="background:#FFFBEB;border-radius:6px;padding:8px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#D97706;">${openIssues.length}</div>
            <div style="font-size:10px;color:#6B7280;">${isVN?'Vấn đề mở':'Open Issues'}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bug Report (after donut charts) -->
    ${bugSection}

    <!-- Resource / Team section -->
    ${teamStats ? `
    <div class="card" style="margin-bottom:28px;">
      <div class="sec-h">${isVN ? 'Nguồn lực dự án' : 'Project Resources'}</div>
      <div style="font-size:11px;color:#94A3B8;margin-bottom:12px;">${isVN ? `Kỳ báo cáo: ${fmtDate(periodStart)} → ${fmtDate(periodEnd)}` : `Period: ${fmtDate(periodStart)} → ${fmtDate(periodEnd)}`}</div>

      <!-- KPI row -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;">
        <div style="background:#EFF6FF;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#2563EB;line-height:1;">${teamStats.total}</div>
          <div style="font-size:10px;color:#6B7280;margin-top:3px;">${isVN ? 'Tổng thành viên' : 'Total Members'}</div>
        </div>
        <div style="background:#F0FDF4;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#16A34A;line-height:1;">${teamStats.fullTime}</div>
          <div style="font-size:10px;color:#6B7280;margin-top:3px;">Full-time ≥80%</div>
        </div>
        <div style="background:${teamStats.overloaded.length > 0 ? '#FEF2F2' : '#F0FDF4'};border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:${teamStats.overloaded.length > 0 ? '#DC2626' : '#16A34A'};line-height:1;">${teamStats.overloaded.length}</div>
          <div style="font-size:10px;color:#6B7280;margin-top:3px;">${isVN ? 'Quá tải >100%' : 'Overloaded >100%'}</div>
        </div>
      </div>

      <!-- Sorted allocation list -->
      <div style="font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;">${isVN ? 'Phân bổ công việc (trung bình kỳ báo cáo)' : 'Work allocation (avg. over period)'}</div>
      ${(teamStats.allocationList ?? []).length > 0 ? `
      <div>
        ${(teamStats.allocationList ?? []).map((m, i) => {
          const capPct = Math.round(m.avgCapacity * 100);
          const capColor = m.avgCapacity > 1.0 ? '#DC2626' : m.avgCapacity >= 0.8 ? '#16A34A' : m.avgCapacity > 0 ? '#D97706' : '#9CA3AF';
          const barW = Math.min(100, capPct);
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F3F4F6;">
            <span style="font-size:10px;color:#9CA3AF;min-width:18px;text-align:right;flex-shrink:0;">${i + 1}.</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:500;color:#111827;">${m.name}</div>
              <div style="font-size:10px;color:#6B7280;">${m.role}${m.domain && m.domain !== 'General' ? ' · ' + m.domain : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;min-width:150px;flex-shrink:0;">
              <div style="flex:1;background:#E5E7EB;border-radius:3px;height:5px;overflow:hidden;">
                <div style="width:${barW}%;height:100%;background:${capColor};border-radius:3px;"></div>
              </div>
              <span style="background:${capColor}22;color:${capColor};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;min-width:36px;text-align:center;">${capPct > 0 ? capPct + '%' : '—'}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
      ` : `<p style="font-size:12px;color:#94A3B8;">${isVN ? 'Không có dữ liệu nhân sự.' : 'No team member data.'}</p>`}

      ${teamStats.overloaded.length > 0 ? `
      <div style="margin-top:10px;padding:8px 12px;background:#FEF2F2;border-radius:6px;font-size:11px;color:#DC2626;">
        [!] ${isVN
          ? `${teamStats.overloaded.length} thành viên đang bị quá tải trong kỳ — cần rà soát phân bổ để đảm bảo chất lượng và tiến độ.`
          : `${teamStats.overloaded.length} team member(s) overloaded this period — review allocations to protect delivery quality.`}
      </div>` : ''}
    </div>
    ` : ''}

    <!-- Completed in period + Upcoming -->
    <div class="grid2" style="margin-bottom:28px;">
      <div class="card">
        <div class="sec-h">${isVN ? `Hoàn thành trong kỳ (${completedInPeriod.length})` : `Completed in Period (${completedInPeriod.length})`}</div>
        <div style="font-size:11px;color:#94A3B8;margin-bottom:10px;">${fmtDate(periodStart)} → ${fmtDate(periodEnd)}</div>
        ${completedInPeriod.length === 0
          ? `<p style="color:#94A3B8;font-size:12px;">${isVN?'Không có hoạt động hoàn thành trong kỳ này.':'No activities completed in this period.'}</p>`
          : completedInPeriod.slice(0,8).map(a => `
          <div class="act-row">
            <span class="badge-done">✓</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:500;color:#1E293B;">${a.activity}</div>
              ${a.deliverable ? `<div style="font-size:11px;color:#64748B;">→ ${a.deliverable}</div>` : ''}
              ${a.actual_end ? `<div style="font-size:10px;color:#94A3B8;">${a.actual_end}</div>` : ''}
            </div>
          </div>`).join('')
        }
        ${completedInPeriod.length > 8 ? `<div style="font-size:11px;color:#94A3B8;margin-top:6px;">+${completedInPeriod.length - 8} ${isVN?'hoạt động khác':'more activities'}</div>` : ''}
      </div>

      <div class="card">
        <div class="sec-h">${isVN ? `Sắp đến hạn (${upcomingActivities.length})` : `Upcoming (${upcomingActivities.length})`}</div>
        <div style="font-size:11px;color:#94A3B8;margin-bottom:10px;">${isVN?'30 ngày tới':'Next 30 days'}</div>
        ${upcomingActivities.length === 0
          ? `<p style="color:#94A3B8;font-size:12px;">${isVN?'Không có hoạt động sắp đến hạn.':'No upcoming activities in 30 days.'}</p>`
          : upcomingActivities.slice(0,8).map(a => `
          <div class="act-row">
            <span class="badge-up">${a.plan_end ?? '—'}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:500;color:#1E293B;">${a.activity}</div>
              <div style="font-size:10px;color:#64748B;">${a.status}</div>
            </div>
          </div>`).join('')
        }
      </div>
    </div>

    <!-- Epic detail table -->
    ${epicStats.length > 0 ? `
    <div class="card" style="margin-bottom:28px;">
      <div class="sec-h">${isVN ? 'Chi tiết Epic / Phase' : 'Epic / Phase Detail'}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="text-align:left;padding:8px 10px;font-weight:600;color:#374151;border-bottom:2px solid #E2E8F0;">${isVN?'Epic / Phase':'Epic / Phase'}</th>
            <th style="text-align:right;padding:8px 10px;font-weight:600;color:#374151;border-bottom:2px solid #E2E8F0;">${isVN?'Xong':'Done'}</th>
            <th style="text-align:right;padding:8px 10px;font-weight:600;color:#374151;border-bottom:2px solid #E2E8F0;">${isVN?'Tổng':'Total'}</th>
            <th style="text-align:left;padding:8px 10px;font-weight:600;color:#374151;border-bottom:2px solid #E2E8F0;width:40%;">${isVN?'Tiến độ':'Progress'}</th>
          </tr>
        </thead>
        <tbody>
          ${epicStats.map(e => {
            const barColor = e.pct >= 80 ? '#16A34A' : e.pct >= 40 ? '#3B82F6' : '#F97316';
            return `<tr style="border-bottom:1px solid #F1F5F9;">
              <td style="padding:8px 10px;color:#1E293B;font-weight:500;">${e.phase}</td>
              <td style="padding:8px 10px;text-align:right;color:#374151;">${e.done}</td>
              <td style="padding:8px 10px;text-align:right;color:#374151;">${e.total}</td>
              <td style="padding:8px 10px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="prog-bar-bg" style="flex:1;"><div class="prog-bar-fill" style="width:${e.pct}%;background:${barColor};"></div></div>
                  <span style="font-size:11px;font-weight:600;color:${barColor};min-width:32px;">${e.pct}%</span>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <!-- Footer -->
    <div style="margin-top:28px;padding-top:14px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94A3B8;">
      <span>${project.name}${companyName ? ' · ' + companyName : ''}</span>
      <span>${isVN?'Tài liệu bảo mật — Nội bộ':'Confidential — Internal Only'} · ${today}</span>
    </div>
  </div>
</div>`;

  return html;
}

// ─── Template Text Builder (same as documents page) ───────────────────────────
function buildProjectReport(data: ProjectReportData, language: string): string {
  const isVN = language === 'Vietnamese';
  const { project, periodStart, periodEnd, stats, epicStats, completedInPeriod, openRisks, openIssues, bugStats, selectedMilestone } = data;
  const today = new Date().toLocaleDateString(isVN ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  const fmtD = (s: string | null | undefined) => {
    if (!s) return '—';
    try { return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return s; }
  };
  const rag = project.rag;
  const ragLabel = isVN ? (rag === 'red' ? 'ĐỎ' : rag === 'amber' ? 'VÀNG' : 'XANH') : (rag === 'red' ? 'RED' : rag === 'amber' ? 'AMBER' : 'GREEN');
  const lines: string[] = [];
  const D = '  ' + '━'.repeat(94);
  const box1 = '  ╔' + '═'.repeat(92) + '╗';
  const box2 = '  ╚' + '═'.repeat(92) + '╝';
  const boxL = (s: string) => { const p = 92 - s.length; return `  ║${' '.repeat(Math.floor(p/2))}${s}${' '.repeat(p - Math.floor(p/2))}║`; };
  const sbox1 = `  ┌${'─'.repeat(92)}┐`; const sbox2 = `  └${'─'.repeat(92)}┘`;
  const sboxL = (s: string) => `  │ ${s}${' '.repeat(Math.max(0, 90 - s.length))} │`;
  const rp = (s: string, n: number) => (s.length > n ? s.slice(0, n-1)+'…' : s).padEnd(n);
  const lp = (s: string|number, n: number) => String(s).padStart(n);
  const bugBW = { st: 24, ct: 8 } as const;
  const wrap = (text: string, maxLen: number): string[] => {
    const words = text.split(' '); const result: string[] = []; let cur = '';
    for (const w of words) {
      if ((cur ? cur+' '+w : w).length > maxLen) { result.push(cur); cur = w; }
      else cur = cur ? cur+' '+w : w;
    }
    if (cur) result.push(cur); return result;
  };

  const header = () => {
    lines.push(box1);
    lines.push(boxL(isVN ? 'BÁO CÁO TÌNH TRẠNG DỰ ÁN' : 'PROJECT STATUS REPORT'));
    lines.push(boxL(project.name.toUpperCase()));
    lines.push(box2); lines.push('');
    lines.push(`  ${isVN?'Ngày báo cáo   ':'Report Date    '}: ${today}              ${isVN?'Mã tham chiếu':'Reference'} : PRJ-${yyyymm}-001`);
    lines.push(`  ${isVN?'Kỳ báo cáo    ':'Period         '}: ${fmtD(periodStart)} → ${fmtD(periodEnd)}`);
    if (selectedMilestone) lines.push(`  ${isVN?'Milestone      ':'Milestone      '}: ${selectedMilestone.name}`);
    lines.push(`  ${isVN?'Phân loại      ':'Classification '}: ${isVN?'Bảo mật — Chỉ dành cho nội bộ':'Confidential — Internal Distribution Only'}`);
    lines.push(`  ${isVN?'Phân phối      ':'Distribution   '}: ${isVN?'PM, Project Sponsor, Steering Committee':'PM, Project Sponsor, Steering Committee'}`);
    lines.push(`  ${isVN?'Giai đoạn      ':'Phase          '}: ${project.current_phase}`);
    lines.push(`  ${isVN?'Khách hàng     ':'Customer       '}: ${project.customer_name || project.program_name || 'N/A'}`);
    lines.push(`  ${isVN?'PM             ':'PM             '}: ${project.pm_name || 'N/A'}`);
    lines.push(`  ${isVN?'Ngày kết thúc  ':'End Date       '}: ${project.end_date ? fmtD(project.end_date) : 'N/A'}${project.days_until_deadline !== null ? ` (${project.days_until_deadline < 0 ? (isVN?`Quá hạn ${Math.abs(project.days_until_deadline)} ngày`:`OVERDUE ${Math.abs(project.days_until_deadline)} days`) : (isVN?`Còn ${project.days_until_deadline} ngày`:`${project.days_until_deadline} days remaining`)})` : ''}`);
    lines.push('');
    const summaryText = rag === 'red'
      ? (isVN ? `Dự án đang ở trạng thái ĐỎ — có các vấn đề nghiêm trọng cần được xử lý khẩn cấp. Tính đến kỳ báo cáo, dự án đã hoàn thành ${stats.completion_pct}% với ${stats.done}/${stats.total} hoạt động.` : `Project is tracking RED — critical issues require immediate attention. As of this period, ${stats.completion_pct}% complete with ${stats.done}/${stats.total} activities.`)
      : rag === 'amber'
      ? (isVN ? `Dự án đang ở trạng thái VÀNG — có một số rủi ro/vấn đề cần theo dõi. Hoàn thành ${stats.completion_pct}% với ${stats.done}/${stats.total} hoạt động.` : `Project is tracking AMBER — risks present. ${stats.completion_pct}% complete with ${stats.done}/${stats.total} activities.`)
      : (isVN ? `Dự án đang vận hành tốt ở trạng thái XANH. Hoàn thành ${stats.completion_pct}% với ${stats.done}/${stats.total} hoạt động — tất cả chỉ số trong ngưỡng kiểm soát.` : `Project is tracking GREEN. ${stats.completion_pct}% complete with ${stats.done}/${stats.total} activities — all indicators within acceptable range.`);
    lines.push(sbox1); lines.push(sboxL(isVN?'TÓM TẮT':'SUMMARY')); lines.push(sboxL(''));
    wrap(summaryText, 88).forEach(l => lines.push(sboxL(l)));
    lines.push(sbox2); lines.push('');
  };

  header();

  // I. Executive Summary
  lines.push(D); lines.push(isVN ? '  I.  TÓM TẮT ĐIỀU HÀNH' : '  I.  EXECUTIVE SUMMARY'); lines.push(D); lines.push('');
  lines.push(`  ${isVN?'Trạng thái tổng thể dự án':'Overall Project Status'}: ● ${ragLabel}`); lines.push('');
  if (project.days_until_deadline !== null && project.days_until_deadline < 0) lines.push(`\n  ${isVN?`[!] CẢNH BÁO: Dự án đã quá hạn ${Math.abs(project.days_until_deadline)} ngày`:`[!] ALERT: Project is OVERDUE by ${Math.abs(project.days_until_deadline)} days`}.`);
  const s1 = rag==='red' ? (isVN?`Dự án hiện ở mức ĐỎ với ${openRisks.length} rủi ro và ${openIssues.length} vấn đề đang mở.`:`Project at RED with ${openRisks.length} open risks and ${openIssues.length} open issues.`) : rag==='amber' ? (isVN?`Dự án ở mức VÀNG với ${openRisks.length} rủi ro và ${openIssues.length} vấn đề.`:`Project at AMBER with ${openRisks.length} risks and ${openIssues.length} issues.`) : (isVN?'Dự án đang ở trạng thái tốt.':'Project is tracking well.');
  lines.push(`  ${s1}`);
  if (openRisks.length === 0 && openIssues.length === 0) lines.push(`  ${isVN?'[+] Tích cực: Không có rủi ro hoặc vấn đề nào đang mở.':'[+] Positive: No open risks or issues.'}`);
  lines.push(''); lines.push(`  ${isVN?'CHỈ SỐ CHÍNH':'KEY METRICS'}:`);
  lines.push(`  ${'─'.repeat(50)}`);
  lines.push(`  ${isVN?'Hoạt động tổng cộng ':'Total Activities    '}: ${stats.total}      ${isVN?'Đang hoạt động':'Active           '}: ${stats.inProgress}`);
  lines.push(`  ${isVN?'Tiến độ TB (trọng số)':'Avg. Completion     '}: ${stats.completion_pct}%    ${isVN?'Hoàn thành       ':'Done              '}: ${stats.done}`);
  lines.push(`  ${isVN?'Rủi ro đang mở      ':'Open Risks          '}: ${openRisks.length}      ${isVN?'Vấn đề đang mở  ':'Open Issues       '}: ${openIssues.length}`);
  lines.push(`  ${'─'.repeat(50)}`); lines.push('');
  const barLen = 40; const filled = Math.round((stats.completion_pct/100)*barLen);
  lines.push(`  ${isVN?'Tiến độ':'Progress'}: [${'█'.repeat(filled)}${'░'.repeat(barLen-filled)}] ${stats.completion_pct}%`); lines.push('');

  // II. Completed
  lines.push(D); lines.push(isVN?'  II. TIẾN ĐỘ THEO KỲ — HOÀN THÀNH TRONG GIAI ĐOẠN':'  II. PROGRESS REPORT — COMPLETED IN PERIOD'); lines.push(D);
  lines.push(`  ${isVN?'Kỳ báo cáo':'Reporting Period'}: ${fmtD(periodStart)} → ${fmtD(periodEnd)}`); lines.push('');
  if (completedInPeriod.length === 0) {
    lines.push(`  ${isVN?'Không có hoạt động nào hoàn thành trong giai đoạn này.':'No activities completed in this period.'}`);
  } else {
    completedInPeriod.forEach((a, i) => {
      lines.push(`  ${String(i+1).padStart(2)}. ${project.name}${project.current_phase ? ` — ${project.current_phase}` : ''}`);
      lines.push(`      [+]  ${a.activity}${a.deliverable?`  →  ${a.deliverable}`:''}${a.actual_end?`  [${a.actual_end}]`:''}`);
    });
  }
  lines.push('');

  // III. Actions Required
  lines.push(D); lines.push(isVN?'  III. HÀNH ĐỘNG CẦN THIẾT — PM / Project Sponsor':'  III. ACTIONS REQUIRED — PM / Project Sponsor'); lines.push(D); lines.push('');
  let ai = 0; const acts: string[] = [];
  if (project.days_until_deadline !== null && project.days_until_deadline < 0) {
    ai++;
    acts.push(`  ${ai}. ${isVN?`[KHẨN CẤP — QUÁ HẠN]  Dự án đã quá hạn ${Math.abs(project.days_until_deadline)} ngày.`:`[URGENT — OVERDUE]  Project is overdue by ${Math.abs(project.days_until_deadline)} days.`}`);
    acts.push(`     → ${isVN?'Đề xuất: Xem xét lại kế hoạch, nguồn lực và phạm vi với Project Sponsor ngay lập tức.':'Recommend: Immediate review of plan, resources and scope with Project Sponsor.'}`);
  }
  openRisks.forEach(r => {
    ai++;
    acts.push(`  ${ai}. ${isVN?`[KHẨN CẤP — RỦI RO ${r.priority.toUpperCase()}]  ${r.description}`:`[URGENT — RISK ${r.priority.toUpperCase()}]  ${r.description}`}`);
    acts.push(`     → ${isVN?'Đề xuất':'Recommend'}: ${r.mitigation || (isVN?'Đánh giá và triển khai biện pháp xử lý ngay lập tức.':'Immediate assessment and corrective action required.')}`);
  });
  openIssues.forEach(r => {
    ai++;
    acts.push(`  ${ai}. ${isVN?`[KHẨN CẤP — VẤN ĐỀ ${r.priority.toUpperCase()}]  ${r.description}`:`[URGENT — ISSUE ${r.priority.toUpperCase()}]  ${r.description}`}`);
    acts.push(`     → ${isVN?'Đề xuất':'Recommend'}: ${r.mitigation || (isVN?'Cần hành động ngay lập tức.':'Immediate action required.')}`);
  });
  if (acts.length === 0) lines.push(`  ${isVN?'Không có leo thang nào cần PM xử lý ngay. Dự án đang trong tầm kiểm soát.':'No immediate escalations required. Project is under control.'}`);
  else acts.forEach(a => lines.push(a));
  lines.push('');

  // IV. Bug Report
  if (bugStats && bugStats.total > 0) {
    lines.push(D); lines.push(isVN?'  IV. BUG REPORT — TỔNG HỢP LỖI DỰ ÁN':'  IV. BUG REPORT — PROJECT BUG SUMMARY'); lines.push(D); lines.push('');
    const critB = (bugStats.byPriority['Critical']??0)+(bugStats.byPriority['Highest']??0);
    const openB = (bugStats.byStatus['Open']??0)+(bugStats.byStatus['New']??0)+(bugStats.byStatus['To Do']??0)+(bugStats.byStatus['To-do']??0);
    lines.push(`  ${isVN?'Tổng Bug':'Total Bugs'}: ${bugStats.total}   ·   Critical/Highest: ${critB}   ·   ${isVN?'Chưa xử lý':'Open/New'}: ${openB}`); lines.push('');
    lines.push(`  A. ${isVN?'PHÂN BỔ THEO TRẠNG THÁI':'DISTRIBUTION BY STATUS'}:`); lines.push(`  ${'─'.repeat(50)}`);
    Object.entries(bugStats.byStatus).sort((a,b)=>b[1]-a[1]).forEach(([st,cnt]) => {
      const pct = Math.round(cnt/bugStats.total*100);
      const bLen = Math.round(pct/5);
      const stLabel = st.length > bugBW.st ? st.slice(0,bugBW.st-1)+'…' : st;
      lines.push(`  ${stLabel.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%) [${'█'.repeat(bLen)}${'░'.repeat(20-bLen)}]`);
    });
    lines.push('');
    lines.push(`  B. ${isVN?'PHÂN BỔ THEO PRIORITY':'DISTRIBUTION BY PRIORITY'}:`); lines.push(`  ${'─'.repeat(50)}`);
    ['Critical','Highest','High','Medium','Low','Lowest'].forEach(pr => {
      const cnt = bugStats.byPriority[pr]; if (!cnt) return;
      const pct = Math.round(cnt/bugStats.total*100);
      lines.push(`  ${pr.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%)`);
    });
    Object.entries(bugStats.byPriority).filter(([pr])=>!['Critical','Highest','High','Medium','Low','Lowest'].includes(pr)).forEach(([pr,cnt]) => {
      const pct = Math.round(cnt/bugStats.total*100);
      lines.push(`  ${pr.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%)`);
    });
    lines.push('');
  }

  // V. Epic/Phase Progress
  if (epicStats.length > 0) {
    const epicsDone = epicStats.filter(e=>e.pct>=100).length;
    const epicsInProg = epicStats.filter(e=>e.pct>0&&e.pct<100).length;
    const epicsNot = epicStats.filter(e=>e.pct===0).length;
    lines.push(D); lines.push(isVN?'  V.  TIẾN ĐỘ THEO EPIC / PHASE':'  V.  EPIC / PHASE PROGRESS'); lines.push(D); lines.push('');
    const KW = { lb: 38, vl: 22 } as const;
    const kRow = (lb: string, vl: string) => `  │ ${lb.padEnd(KW.lb)} │ ${vl.padStart(KW.vl)} │`;
    lines.push(`  ┌${'─'.repeat(KW.lb+2)}┬${'─'.repeat(KW.vl+2)}┐`);
    lines.push(`  │ ${(isVN?'CHỈ SỐ':'METRIC').padEnd(KW.lb)} │ ${(isVN?'GIÁ TRỊ':'VALUE').padStart(KW.vl)} │`);
    lines.push(`  ├${'─'.repeat(KW.lb+2)}┼${'─'.repeat(KW.vl+2)}┤`);
    lines.push(kRow(isVN?'Tổng Epic / Phase':'Total Epics / Phases', `${epicStats.length} epic(s)`));
    lines.push(kRow(isVN?'Hoàn thành (≥100%)':'Complete (≥100%)', `${epicsDone} epic(s)`));
    lines.push(kRow(isVN?'Đang triển khai (1–99%)':'In Progress (1–99%)', `${epicsInProg} epic(s)`));
    lines.push(kRow(isVN?'Chưa bắt đầu (0%)':'Not Started (0%)', `${epicsNot} epic(s)`));
    lines.push(kRow(isVN?'Tiến độ tổng thể (trọng số)':'Overall Completion (weighted)', `${stats.completion_pct}%`));
    lines.push(`  └${'─'.repeat(KW.lb+2)}┴${'─'.repeat(KW.vl+2)}┘`); lines.push('');
    lines.push(`  A. ${isVN?'TIẾN ĐỘ CHI TIẾT THEO EPIC (sắp xếp giảm dần)':'EPIC DETAIL (sorted descending)'}:`); lines.push('');
    const EW = { nm: 28, pc: 6, dn: 8, tt: 8, br: 22 } as const;
    lines.push(`  ┌${'─'.repeat(EW.nm+2)}┬${'─'.repeat(EW.pc+2)}┬${'─'.repeat(EW.dn+2)}┬${'─'.repeat(EW.tt+2)}┬${'─'.repeat(EW.br+2)}┐`);
    lines.push(`  │ ${'EPIC / PHASE'.padEnd(EW.nm)} │ ${'PCT'.padStart(EW.pc)} │ ${'DONE'.padStart(EW.dn)} │ ${'TOTAL'.padStart(EW.tt)} │ ${(isVN?'TIẾN ĐỘ':'PROGRESS').padEnd(EW.br)} │`);
    lines.push(`  ├${'─'.repeat(EW.nm+2)}┼${'─'.repeat(EW.pc+2)}┼${'─'.repeat(EW.dn+2)}┼${'─'.repeat(EW.tt+2)}┼${'─'.repeat(EW.br+2)}┤`);
    [...epicStats].sort((a,b)=>b.pct-a.pct).forEach(e => {
      const bLen = 20; const f = Math.round((e.pct/100)*bLen);
      lines.push(`  │ ${rp(e.phase,EW.nm)} │ ${lp(e.pct+'%',EW.pc)} │ ${lp(e.done,EW.dn)} │ ${lp(e.total,EW.tt)} │ [${'█'.repeat(f)}${'░'.repeat(bLen-f)}] │`);
    });
    lines.push(`  └${'─'.repeat(EW.nm+2)}┴${'─'.repeat(EW.pc+2)}┴${'─'.repeat(EW.dn+2)}┴${'─'.repeat(EW.tt+2)}┴${'─'.repeat(EW.br+2)}┘`); lines.push('');
  }

  lines.push(D);
  lines.push(`  ${project.name}   ·   Project Management Office   ·   ${isVN?'Tài liệu bảo mật — Nội bộ':'Confidential — Internal Only'}`);
  lines.push(D);
  return lines.join('\n');
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectReportPage() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<ProjectReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState('');
  const [htmlReport, setHtmlReport] = useState('');
  const [aiReport, setAiReport] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'source' | 'ai'>('preview');
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [language, setLanguage] = useState<'Vietnamese' | 'English'>('Vietnamese');
  const [reportMode, setReportMode] = useState<'daterange' | 'milestone'>('daterange');
  const [periodStart, setPeriodStart] = useState(getThisMonday);
  const [periodEnd, setPeriodEnd] = useState(getThisSunday);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('');
  const [showMilestoneSelector, setShowMilestoneSelector] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [apiKeySet, setApiKeySet] = useState<false | 'db' | 'env'>(false);
  const [pmEmail, setPmEmail] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState('executive');
  const [customPromptText, setCustomPromptText] = useState('');
  const [generatedEmailHtml, setGeneratedEmailHtml] = useState('');
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savePromptName, setSavePromptName] = useState('');
  const [exporting, setExporting] = useState<'pdf' | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Load config
  const loadConfig = useCallback(async () => {
    try {
      const r = await fetch('/api/config');
      if (r.ok) {
        const j = await r.json();
        setApiKeySet(j.anthropic_api_key_set === 'env' ? 'env' : j.anthropic_api_key_set === 'true' ? 'db' : false);
        if (j.ceo_email) setPmEmail(j.ceo_email);
      }
      const me = await fetch('/api/auth/me');
      if (me.ok) { const j = await me.json(); if (j.company_name) setCompanyName(j.company_name); }
    } catch {}
  }, []);

  useEffect(() => {
    loadConfig();
    try {
      const raw = localStorage.getItem(SAVED_PROMPTS_KEY);
      if (raw) setSavedPrompts(JSON.parse(raw));
    } catch {}
  }, [loadConfig]);

  // Load data
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      let url = `/api/projects/${id}/project-report`;
      if (reportMode === 'daterange') {
        url += `?start=${periodStart}&end=${periodEnd}`;
      } else if (selectedMilestoneId) {
        url += `?milestone_id=${selectedMilestoneId}`;
      }
      const r = await fetch(url);
      if (!r.ok) throw new Error('Failed to load data');
      const d: ProjectReportData = await r.json();
      setData(d);
      if (d.milestones?.length > 0 && !selectedMilestoneId) {
        // pre-select first milestone in milestone mode
      }
    } catch (e) { toast.error(String(e)); }
    finally { setLoading(false); }
  }, [id, reportMode, periodStart, periodEnd, selectedMilestoneId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Generate report
  const handleGenerate = async () => {
    if (!data) { toast.error('Chưa có dữ liệu — nhấn Reload trước'); return; }
    setGenerating(true);
    try {
      if (mode === 'manual') {
        const txt = buildProjectReport(data, language);
        const htmlR = buildProjectHtmlReport(data, language, companyName);
        setReport(txt);
        setHtmlReport(htmlR);
        setViewMode('preview');
        setAiReport('');
      } else {
        const r = await fetch(`/api/projects/${id}/project-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportData: data, language }),
        });
        const j = await r.json();
        if (j.error === 'NO_API_KEY') { toast.error('No Anthropic API key configured'); return; }
        if (j.error) throw new Error(j.error);
        setAiReport(j.report);
        const htmlR = buildProjectHtmlReport(data, language, companyName);
        setHtmlReport(htmlR);
        setViewMode('ai');
      }
    } catch (e) { toast.error(String(e)); }
    finally { setGenerating(false); }
  };

  const copyReport = () => {
    const text = viewMode === 'source' ? report : viewMode === 'ai' ? aiReport : htmlReport;
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const exportHtml = () => {
    if (!htmlReport) return;
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Project Report</title></head><body>${htmlReport}</body></html>`], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data?.project.name ?? 'project'}-report-${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('HTML downloaded');
  };

  const exportTxt = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data?.project.name ?? 'project'}-report-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('TXT downloaded');
  };

  const exportPdf = async () => {
    if (!htmlReport) return;
    setExporting('pdf');
    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report</title><style>@media print{body{margin:0;padding:0;}}</style></head><body>${htmlReport}</body></html>`);
        win.document.close();
        win.focus();
        win.print();
        win.close();
      }
    } finally { setExporting(null); }
  };

  const saveApiKey = async () => {
    if (!apiKeyInput) return;
    setSavingKey(true);
    try {
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anthropic_api_key: apiKeyInput }) });
      setApiKeySet('db'); setShowKeyInput(false); setApiKeyInput('');
      toast.success('API key saved');
    } catch { toast.error('Failed to save API key'); }
    finally { setSavingKey(false); }
  };

  const savePmEmail = async () => {
    if (!pmEmail) return;
    setSavingEmail(true);
    try {
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ceo_email: pmEmail }) });
      toast.success('Email saved');
    } catch { toast.error('Failed to save email'); }
    finally { setSavingEmail(false); }
  };

  const openEmailModal = () => {
    if (!data) return;
    setEmailRecipients(pmEmail);
    setEmailSubject(`[${data.project.name}] Báo cáo tình trạng — ${new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`);
    setGeneratedEmailHtml('');
    setSelectedPromptId('executive');
    setCustomPromptText('');
    setShowEmailModal(true);
  };

  const generateEmail = async () => {
    if (!data) return;
    setGeneratingEmail(true);
    setGeneratedEmailHtml('');
    try {
      const promptTemplate = EMAIL_PROMPT_TEMPLATES.find(t => t.id === selectedPromptId);
      const promptInstruction = customPromptText || promptTemplate?.text || '';
      const r = await fetch(`/api/projects/${id}/project-report/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData: data, promptInstruction, language }),
      });
      const j = await r.json();
      if (j.error === 'NO_API_KEY') { toast.error('No Anthropic API key configured'); return; }
      if (j.error) throw new Error(j.error);
      setGeneratedEmailHtml(j.emailHtml);
      if (j.subject) setEmailSubject(j.subject);
    } catch (e) { toast.error(String(e)); }
    finally { setGeneratingEmail(false); }
  };

  const sendEmail = async () => {
    if (!generatedEmailHtml || !emailRecipients) return;
    setSendingEmail(true);
    try {
      const toArr = emailRecipients.split(',').map(s => s.trim()).filter(Boolean);
      const htmlBody = wrapEmailDocument(generatedEmailHtml, companyName, data?.project.name ?? '');
      const r = await fetch('/api/portfolio/report/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: toArr, subject: emailSubject, htmlBody }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error === 'NO_RESEND_KEY' ? 'RESEND_API_KEY not configured' : j.error);
      toast.success(`Email sent to ${toArr.join(', ')}`);
      setShowEmailModal(false);
    } catch (e) { toast.error(String(e)); }
    finally { setSendingEmail(false); }
  };

  const savePrompt = () => {
    if (!savePromptName || !customPromptText) return;
    const newPrompt: SavedPrompt = { id: Date.now().toString(), name: savePromptName, text: customPromptText };
    const updated = [newPrompt, ...savedPrompts].slice(0, MAX_SAVED_PROMPTS);
    setSavedPrompts(updated);
    localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updated));
    setShowSaveInput(false); setSavePromptName('');
    toast.success('Prompt saved');
  };

  const deletePrompt = (promptId: string) => {
    const updated = savedPrompts.filter(p => p.id !== promptId);
    setSavedPrompts(updated);
    localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updated));
  };

  const hasReport = !!(htmlReport || report || aiReport);
  const activeView = viewMode === 'preview' ? htmlReport : viewMode === 'ai' ? mdToHtml(aiReport) : '';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar projectId={id} />
      <main className="flex-1 min-w-0">

        {/* ── Top Header ───────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <BarChart2 className="h-5 w-5 text-violet-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-900 text-sm truncate">
                Project Status Report{data ? ` — ${data.project.name}` : ''}
              </h1>
              {data && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {data.project.current_phase} · PM: {data.project.pm_name ?? 'N/A'} ·{' '}
                  {data.project.end_date ? `End: ${fmtDate(data.project.end_date)}` : 'No deadline'}
                  {data.project.days_until_deadline !== null && (
                    <span className={data.project.days_until_deadline < 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
                      {' '}({data.project.days_until_deadline < 0
                        ? `OVERDUE ${Math.abs(data.project.days_until_deadline)}d`
                        : `${data.project.days_until_deadline}d left`})
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          {data && (
            <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              data.project.rag === 'red' ? 'bg-red-100 text-red-700' :
              data.project.rag === 'amber' ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'}`}>
              ● {data.project.rag === 'red' ? 'ĐỎ' : data.project.rag === 'amber' ? 'VÀNG' : 'XANH'}
            </span>
          )}
        </div>

        {/* ── KPI Bar ──────────────────────────────────────────────────────── */}
        {data && (
          <div className="bg-white border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 shrink-0">
            {[
              { label: 'Total Activities', value: data.stats.total, sub: `${data.stats.inProgress} in progress`, color: 'text-slate-900' },
              { label: 'Completion', value: `${data.stats.completion_pct}%`, sub: `${data.stats.done} done`, color: data.stats.completion_pct >= 70 ? 'text-green-600' : data.stats.completion_pct >= 40 ? 'text-amber-600' : 'text-red-600' },
              { label: 'Open Risks', value: data.openRisks.length, sub: `${data.openRisks.filter(r=>r.priority==='Critical').length} critical`, color: data.openRisks.length > 0 ? 'text-red-600' : 'text-green-600' },
              { label: 'Open Issues', value: data.openIssues.length, sub: `${data.epicStats.length} epics/phases`, color: data.openIssues.length > 0 ? 'text-amber-600' : 'text-green-600' },
            ].map(k => (
              <div key={k.label} className="px-5 py-3">
                <div className={`text-2xl font-bold leading-none ${k.color}`}>{k.value}</div>
                <div className="text-xs text-slate-500 mt-1">{k.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Main body ────────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-0 flex-1">

          {/* Left: Period + Completed Activities ──────────────────────────── */}
          <div className="lg:w-80 xl:w-96 shrink-0 border-r border-slate-200 bg-white flex flex-col">

            {/* Period selector */}
            <div className="p-4 border-b border-slate-100">
              <div className="flex rounded-lg overflow-hidden border bg-slate-50 mb-3">
                <button onClick={() => setReportMode('daterange')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${reportMode==='daterange'?'bg-violet-600 text-white':'text-slate-600 hover:bg-slate-100'}`}>
                  <Calendar className="h-3 w-3" /> Date Range
                </button>
                <button onClick={() => setReportMode('milestone')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${reportMode==='milestone'?'bg-violet-600 text-white':'text-slate-600 hover:bg-slate-100'}`}>
                  <Flag className="h-3 w-3" /> Milestone
                </button>
              </div>

              {reportMode === 'daterange' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-8 shrink-0">From</label>
                    <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="h-7 text-xs flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-8 shrink-0">To</label>
                    <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="h-7 text-xs flex-1" />
                  </div>
                </div>
              ) : (
                <div>
                  <button onClick={() => setShowMilestoneSelector(!showMilestoneSelector)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs border rounded-lg bg-white hover:bg-slate-50">
                    <span className="text-slate-600">
                      {selectedMilestoneId && data?.milestones
                        ? data.milestones.find(m => String(m.id) === selectedMilestoneId)?.name ?? 'Select milestone…'
                        : 'Select milestone…'}
                    </span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                  {showMilestoneSelector && data?.milestones && (
                    <div className="mt-1 border rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
                      {data.milestones.map(m => (
                        <button key={m.id} onClick={() => { setSelectedMilestoneId(String(m.id)); setShowMilestoneSelector(false); }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${selectedMilestoneId === String(m.id) ? 'bg-violet-50 text-violet-700 font-medium' : 'text-slate-700'}`}>
                          {m.name}
                          {m.start_date && <span className="text-slate-400 ml-1">({m.start_date}{m.end_date ? ` → ${m.end_date}` : ''})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={loadData} disabled={loading}
                className="w-full mt-3 gap-1.5 text-xs h-7">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {loading ? 'Loading…' : 'Reload Data'}
              </Button>
            </div>

            {/* Completed activities preview */}
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Completed in Period ({data?.completedInPeriod.length ?? 0})
              </p>
              {loading ? (
                <div className="flex items-center justify-center h-20"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
              ) : data?.completedInPeriod.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No activities completed in this period</p>
              ) : (
                data?.completedInPeriod.map(a => (
                  <div key={a.id} className="flex items-start gap-2 py-2 border-b border-slate-50 last:border-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 font-medium leading-snug">{a.activity}</p>
                      {a.deliverable && <p className="text-xs text-slate-400 truncate">→ {a.deliverable}</p>}
                      {a.actual_end && <p className="text-xs text-slate-300">{a.actual_end}</p>}
                    </div>
                  </div>
                ))
              )}
              {data && data.openRisks.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Open Risks ({data.openRisks.length})
                  </p>
                  {data.openRisks.slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-start gap-2 py-1.5">
                      <AlertTriangle className={`h-3 w-3 mt-0.5 shrink-0 ${r.priority==='Critical'?'text-red-500':r.priority==='High'?'text-orange-500':'text-amber-500'}`} />
                      <div className="min-w-0">
                        <span className={`text-xs font-medium ${r.priority==='Critical'?'text-red-700':r.priority==='High'?'text-orange-700':'text-amber-700'}`}>[{r.priority}] </span>
                        <span className="text-xs text-slate-600">{r.description.slice(0, 60)}{r.description.length > 60 ? '…' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Controls + Report ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col">

            {/* Controls bar */}
            <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center gap-3 shrink-0">
              {/* Language */}
              <Select value={language} onValueChange={(v) => v && setLanguage(v as 'Vietnamese' | 'English')}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vietnamese">Vietnamese</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                </SelectContent>
              </Select>

              {/* Mode toggle */}
              <div className="flex rounded-lg overflow-hidden border">
                <button onClick={() => setMode('manual')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${mode==='manual'?'bg-violet-600 text-white':'text-slate-600 hover:bg-slate-50'}`}>
                  <FileText className="h-3 w-3" /> Template
                </button>
                <button onClick={() => setMode('ai')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${mode==='ai'?'bg-violet-600 text-white':'text-slate-600 hover:bg-slate-50'}`}>
                  <Sparkles className="h-3 w-3" /> AI (Claude)
                </button>
              </div>

              {/* Generate */}
              <Button size="sm" onClick={handleGenerate} disabled={generating || loading || !data}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700 h-8">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart2 className="h-3.5 w-3.5" />}
                {generating ? 'Generating…' : 'Generate Report'}
              </Button>

              {/* Export buttons */}
              {hasReport && (
                <div className="flex items-center gap-1.5 ml-auto">
                  {/* View mode */}
                  <div className="flex rounded-lg overflow-hidden border">
                    {htmlReport && (
                      <button onClick={() => setViewMode('preview')}
                        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode==='preview'?'bg-slate-100 text-slate-700':'text-slate-500 hover:bg-slate-50'}`}>
                        HTML
                      </button>
                    )}
                    {report && (
                      <button onClick={() => setViewMode('source')}
                        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode==='source'?'bg-slate-100 text-slate-700':'text-slate-500 hover:bg-slate-50'}`}>
                        Text
                      </button>
                    )}
                    {aiReport && (
                      <button onClick={() => setViewMode('ai')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode==='ai'?'bg-slate-100 text-slate-700':'text-slate-500 hover:bg-slate-50'}`}>
                        <Sparkles className="h-3 w-3" /> AI
                      </button>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={copyReport} className="h-8 gap-1.5 text-xs">
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportHtml} className="h-8 gap-1.5 text-xs" disabled={!htmlReport}>
                    <FileDown className="h-3 w-3" /> HTML
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportTxt} className="h-8 gap-1.5 text-xs" disabled={!report}>
                    <FileDown className="h-3 w-3" /> TXT
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportPdf} className="h-8 gap-1.5 text-xs" disabled={!htmlReport || exporting === 'pdf'}>
                    {exporting === 'pdf' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={openEmailModal} className="h-8 gap-1.5 text-xs border-violet-200 text-violet-700 hover:bg-violet-50" disabled={!data}>
                    <Mail className="h-3 w-3" /> Send Email
                  </Button>
                </div>
              )}
            </div>

            {/* Config bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-2 flex flex-wrap items-center gap-4 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <KeyRound className="h-3 w-3 text-slate-400" />
                <span className="text-slate-500">API Key:</span>
                {apiKeySet ? (
                  <span className="text-green-600 font-medium">✓ {apiKeySet === 'env' ? 'env var' : 'saved'}</span>
                ) : (
                  <span className="text-red-500">Not set</span>
                )}
                {apiKeySet !== 'env' && (
                  <button onClick={() => setShowKeyInput(!showKeyInput)} className="text-violet-600 hover:underline">
                    {showKeyInput ? 'Cancel' : apiKeySet ? 'Change' : 'Add key'}
                  </button>
                )}
                {showKeyInput && (
                  <div className="flex items-center gap-1.5">
                    <Input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="sk-ant-…" className="h-6 text-xs w-44" />
                    <Button size="sm" onClick={saveApiKey} disabled={savingKey} className="h-6 text-xs px-2 bg-violet-600 hover:bg-violet-700">
                      {savingKey ? '…' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-slate-400" />
                <span className="text-slate-500">PM/Sponsor email:</span>
                <Input value={pmEmail} onChange={e => setPmEmail(e.target.value)} placeholder="pm@company.com" className="h-6 text-xs w-44" />
                <Button size="sm" onClick={savePmEmail} disabled={savingEmail} className="h-6 text-xs px-2 bg-violet-600 hover:bg-violet-700">
                  {savingEmail ? '…' : 'Save'}
                </Button>
              </div>
            </div>

            {/* Report output */}
            <div className="flex-1 overflow-auto" ref={previewRef}>
              {!hasReport ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <div className="text-center max-w-sm">
                    <BarChart2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium text-slate-500 mb-1">No report generated yet</p>
                    <p className="text-xs text-slate-400">Select a period and click <strong>Generate Report</strong></p>
                  </div>
                </div>
              ) : viewMode === 'source' ? (
                <pre className="p-6 text-xs font-mono text-slate-700 leading-relaxed whitespace-pre overflow-x-auto">{report}</pre>
              ) : (
                <div className="min-h-full bg-white">
                  <div dangerouslySetInnerHTML={{ __html: activeView }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Email Modal ─────────────────────────────────────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-violet-600" />
                <h2 className="font-semibold text-slate-900 text-sm">Send Email Report</h2>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Recipients */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Recipients (comma-separated)</label>
                <Input value={emailRecipients} onChange={e => setEmailRecipients(e.target.value)} placeholder="sponsor@company.com, pm@company.com" className="text-sm" />
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Subject</label>
                <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="text-sm" />
              </div>

              {/* Prompt template selector */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-2">Email style (Claude will write the email)</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {EMAIL_PROMPT_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => { setSelectedPromptId(t.id); setCustomPromptText(''); }}
                      className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${selectedPromptId === t.id && !customPromptText ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Custom prompt */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Or write custom instruction:</label>
                  <Textarea value={customPromptText} onChange={e => setCustomPromptText(e.target.value)}
                    placeholder="Describe how Claude should write this email…" rows={3} className="text-xs resize-none" />
                  {customPromptText && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {!showSaveInput ? (
                        <button onClick={() => setShowSaveInput(true)} className="text-xs text-violet-600 hover:underline">Save prompt</button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Input value={savePromptName} onChange={e => setSavePromptName(e.target.value)} placeholder="Prompt name…" className="h-6 text-xs w-32" />
                          <Button size="sm" onClick={savePrompt} className="h-6 text-xs px-2 bg-violet-600 hover:bg-violet-700">Save</Button>
                          <button onClick={() => setShowSaveInput(false)} className="text-xs text-slate-400">Cancel</button>
                        </div>
                      )}
                    </div>
                  )}
                  {savedPrompts.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {savedPrompts.map(p => (
                        <div key={p.id} className="flex items-center gap-1 bg-slate-100 rounded px-2 py-0.5">
                          <button onClick={() => { setCustomPromptText(p.text); setSelectedPromptId(''); }} className="text-xs text-slate-600 hover:text-violet-600">{p.name}</button>
                          <button onClick={() => deletePrompt(p.id)} className="text-slate-300 hover:text-red-400 text-xs leading-none">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Generate with Claude */}
              <Button onClick={generateEmail} disabled={generatingEmail || !apiKeySet}
                className="w-full gap-2 bg-violet-600 hover:bg-violet-700">
                {generatingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generatingEmail ? 'Claude is writing…' : 'Generate Email with Claude'}
              </Button>
              {!apiKeySet && <p className="text-xs text-center text-slate-400">Configure Anthropic API key first</p>}

              {/* Preview */}
              {generatedEmailHtml && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-600">Email Preview</label>
                    <button onClick={() => navigator.clipboard.writeText(generatedEmailHtml).then(() => toast.success('Copied'))}
                      className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                      <Copy className="h-3 w-3" /> Copy HTML
                    </button>
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto bg-white">
                    <div className="p-4 text-sm" dangerouslySetInnerHTML={{ __html: generatedEmailHtml }} />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => setShowEmailModal(false)} className="text-sm">Cancel</Button>
              <Button onClick={sendEmail} disabled={sendingEmail || !generatedEmailHtml || !emailRecipients}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-sm">
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {sendingEmail ? 'Sending…' : 'Send Email'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
