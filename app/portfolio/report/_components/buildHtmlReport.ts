import type { PortfolioReportData } from '../types';
import { pickSummary } from './SummaryTemplates';
import { HTML_REPORT_CSS, svgDonut, svgHBarChart, svgBarChart } from './buildHtmlReportCharts';
import { appendHtmlBugSection } from './buildHtmlReportBugs';
import { appendHtmlReportTail } from './buildHtmlReportTail';

export function buildHtmlReport(data: PortfolioReportData, language: string, periodStart: string, periodEnd: string, companyName = '', bugDimension: 'status' | 'severity' = 'severity'): string {
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
  // Epic status from pct — green/blue/gray, never red (red = RAG health, not epic status)
  const EPIC_COL = { done:'#16A34A', prog:'#3B82F6', todo:'#9CA3AF' } as const;
  const epicSt = (pct: number) => pct >= 100 ? 'done' : pct > 0 ? 'prog' : 'todo';
  const epicStCol = (st: string): string => (EPIC_COL as Record<string,string>)[st] ?? '#9CA3AF';
  const epicStLbl = (st: string): string => ({ done: isVN?'Hoàn thành':'Done', prog: isVN?'Đang triển khai':'In Progress', todo: isVN?'Chưa bắt đầu':'Not Started' }[st] ?? st);
  const epicStBg  = (st: string): string => ({ done:'rgba(22,163,74,0.08)',  prog:'rgba(59,130,246,0.08)', todo:'rgba(0,0,0,0.04)' }[st] ?? 'rgba(0,0,0,0.04)');
  const epicStBdr = (st: string): string => ({ done:'rgba(22,163,74,0.28)',  prog:'rgba(59,130,246,0.25)', todo:'rgba(0,0,0,0.12)' }[st] ?? 'rgba(0,0,0,0.12)');
  const css = HTML_REPORT_CSS;
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
  h += `<div class="rpd-pie-lay"><div style="flex-shrink:0;">${svgDonut(pie1.map(s=>({val:s.val,color:s.color})),140,58,36,p1Pct,isVN)}</div><div class="rpd-pie-leg">`;
  pie1.forEach(s => {
    const pct = epicsTotal > 0 ? Math.round(s.val / epicsTotal * 100) : 0;
    h += `<div class="rpd-leg-row"><div class="rpd-leg-dot" style="background:${s.color};border:1px solid rgba(0,0,0,0.1);"></div>${s.label}<span class="rpd-leg-val">${s.val} <span style="color:#9CA3AF;font-size:10px;">(${pct}%)</span></span></div>`;
  });
  h += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">${isVN?'Tổng cộng':'Total'}: <strong style="color:#111827;">${epicsTotal}</strong> epic</div>`;
  h += `</div></div></div></div>`;

  // Pie 2
  h += `<div class="rpd-pie-col"><div class="rpd-panel"><div class="rpd-ptitle">${isVN?'Tỷ trọng epic theo chương trình':'Epic Weight by Program'}</div>`;
  h += `<div class="rpd-pie-lay"><div style="flex-shrink:0;">${svgDonut(pie2.map(s=>({val:s.val,color:s.color})),140,58,36,undefined,isVN)}</div><div class="rpd-pie-leg">`;
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

  h = appendHtmlBugSection(h, data, isVN, bugDimension);
  h = appendHtmlReportTail(h, data, isVN, periodStart, periodEnd, companyName, today, allProjects, red, epicsDone, epicsInProg, epicsNotStarted, epicsTotal, pCol, ragCol, epicSt, epicStCol, epicStLbl, epicStBg, epicStBdr);
  h += '</div>';
  return h;
}
