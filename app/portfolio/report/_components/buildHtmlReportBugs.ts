import type { BugProjectSummary, PortfolioReportData } from '../types';
import { svgDonut } from './buildHtmlReportCharts';

export function appendHtmlBugSection(h: string, data: PortfolioReportData, isVN: boolean, bugDimension: 'status' | 'severity'): string {
  // ── Bug Report Section ────────────────────────────────────────────────────
  if (data.bugStats && data.bugStats.total > 0) {
    const bs = { ...data.bugStats, bySeverity: data.bugStats.bySeverity ?? {} };

    const BUG_STATUS_COLORS: Record<string, string> = {
      'Done': '#16A34A', 'Closed': '#16A34A', 'Fixed': '#16A34A', 'Resolved': '#16A34A',
      'ANBM': '#16A34A', 'Deployed': '#16A34A', 'READY TO RELEASE': '#16A34A', 'READY FOR RELEASE': '#16A34A',
      'In Progress': '#3B82F6', 'In Dev': '#3B82F6', 'In development': '#3B82F6',
      'In Testing': '#0891B2', 'Testing': '#0891B2', 'Ready for Test': '#0891B2', 'READY4TEST': '#0891B2',
      'Re-Open': '#EA580C', 'REOPEN': '#EA580C',
      'Open': '#6B7280', 'New': '#6B7280', 'To Do': '#6B7280', 'To-do': '#6B7280',
      'Blocked': '#DC2626',
    };
    const bugStatusColor = (s: string) => BUG_STATUS_COLORS[s] ?? '#9CA3AF';

    const BUG_SEVERITY_COLORS: Record<string, string> = {
      'Blocker': '#7C3AED', 'Critical': '#DC2626', 'Highest': '#DC2626',
      'High': '#EA580C', 'Major': '#EA580C',
      'Medium': '#D97706', 'Normal': '#D97706', 'Moderate': '#D97706',
      'Low': '#3B82F6', 'Minor': '#3B82F6',
      'Trivial': '#6B7280', 'Lowest': '#6B7280',
    };
    const bugSeverityColor = (sv: string) => BUG_SEVERITY_COLORS[sv] ?? '#9CA3AF';

    const SEVERITY_ORDER = ['Blocker','Critical','Highest','Major','High','Medium','Normal','Moderate','Low','Minor','Trivial','Lowest'];
    const statusEntries = Object.entries(bs.byStatus).sort((a, b) => b[1] - a[1]);
    const severityEntries = [
      ...SEVERITY_ORDER.filter(sv => (bs.bySeverity[sv] ?? 0) > 0).map(sv => [sv, bs.bySeverity[sv]] as [string, number]),
      ...Object.entries(bs.bySeverity).filter(([sv]) => !SEVERITY_ORDER.includes(sv)).sort((a, b) => b[1] - a[1]),
    ];

    const bugBarItems = bs.byProject.slice(0, 20);

    // Generic stacked bar chart — accepts a dimension-keyed map getter
    const svgBugBarChart = (
      items: BugProjectSummary[],
      keys: string[],
      colorFn: (k: string) => string,
      getMap: (item: BugProjectSummary) => Record<string, number>,
      w = 800, h = 160,
    ): string => {
      const rawMax = Math.max(...items.map(i => i.total), 1);
      const step = rawMax <= 5 ? 1 : rawMax <= 20 ? 5 : rawMax <= 50 ? 10 : rawMax <= 100 ? 20 : 50;
      const max = Math.ceil(rawMax / step) * step;
      const topPad = 22;
      const n = items.length || 1;
      const leftPad = 32;
      const slotW = Math.floor((w - leftPad) / n);
      const barW = Math.min(48, Math.max(16, slotW - 12));
      const vbH = h + topPad + 46;
      let s = `<svg width="100%" viewBox="0 0 ${w} ${vbH}" preserveAspectRatio="xMidYMid meet" style="display:block;">`;
      for (let i = 0; i <= max; i += step) {
        const y = topPad + h - Math.round((i / max) * h);
        s += `<line x1="${leftPad}" y1="${y}" x2="${w}" y2="${y}" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>`;
        s += `<text x="${leftPad - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9CA3AF">${i}</text>`;
      }
      s += `<line x1="${leftPad}" y1="${topPad + h}" x2="${w}" y2="${topPad + h}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`;
      items.forEach((item, i) => {
        const map = getMap(item);
        const x = leftPad + i * slotW + (slotW - barW) / 2;
        const totalH = max > 0 ? Math.round((item.total / max) * h) : 0;
        const barTop = topPad + h - totalH;
        let yOffset = topPad + h;
        keys.forEach(k => {
          const cnt = map[k] ?? 0;
          if (cnt <= 0) return;
          const segH = max > 0 ? Math.round((cnt / max) * h) : 0;
          if (segH <= 0) return;
          yOffset -= segH;
          s += `<rect x="${x.toFixed(1)}" y="${yOffset.toFixed(1)}" width="${barW}" height="${segH}" fill="${colorFn(k)}" opacity="0.85"/>`;
        });
        const topTotal = keys.reduce((acc, k) => acc + (map[k] ?? 0), 0);
        const otherCnt = item.total - topTotal;
        if (otherCnt > 0) {
          const segH = max > 0 ? Math.round((otherCnt / max) * h) : 0;
          if (segH > 0) { yOffset -= segH; s += `<rect x="${x.toFixed(1)}" y="${yOffset.toFixed(1)}" width="${barW}" height="${segH}" fill="#CBD5E1" opacity="0.85"/>`; }
        }
        if (totalH > 0) {
          s += `<text x="${(x + barW / 2).toFixed(1)}" y="${barTop - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="#374151">${item.total}</text>`;
        }
        const shortLbl = item.projectName.length > 12 ? item.projectName.slice(0, 12) + '…' : item.projectName;
        s += `<text x="${(x + barW / 2).toFixed(1)}" y="${topPad + h + 17}" text-anchor="middle" font-size="10" fill="#6B7280">${shortLbl}</text>`;
      });
      s += `</svg>`;
      return s;
    };

    h += `<div style="margin-top:14px;">`;
    h += `<div class="rpd-zlbl" style="color:#7C3AED;"><span class="rpd-znum" style="background:#7C3AED;">BUG</span>${isVN ? 'Bug Report — Tổng hợp lỗi toàn portfolio' : 'Bug Report — Portfolio-wide Bug Summary'}</div>`;

    // KPI cards row
    const totalBugColor = bs.total > 100 ? '#DC2626' : bs.total > 30 ? '#D97706' : '#6B7280';
    h += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">`;
    h += `<div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;padding:14px 10px;text-align:center;">`;
    h += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin-bottom:6px;">${isVN ? 'Tổng Bug' : 'Total Bugs'}</div>`;
    h += `<div style="font-size:26px;font-weight:700;color:${totalBugColor};line-height:1;">${bs.total}</div>`;
    h += `<div style="font-size:10px;color:#9CA3AF;margin-top:4px;">${isVN ? 'tất cả dự án' : 'all projects'}</div></div>`;
    h += `<div style="background:#F8F9FA;border:1px solid #E5E7EB;border-radius:8px;padding:14px 10px;text-align:center;">`;
    h += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin-bottom:6px;">${isVN ? 'Dự án có Bug' : 'Projects w/ Bugs'}</div>`;
    h += `<div style="font-size:26px;font-weight:700;color:#111827;line-height:1;">${bs.byProject.length}</div>`;
    h += `<div style="font-size:10px;color:#9CA3AF;margin-top:4px;">${isVN ? 'dự án' : 'projects'}</div></div>`;
    const criticalBugs = (bs.bySeverity['Blocker'] ?? 0) + (bs.bySeverity['Critical'] ?? 0) + (bs.bySeverity['Highest'] ?? 0);
    const criticalColor = criticalBugs > 0 ? '#DC2626' : '#16A34A';
    h += `<div style="background:${criticalColor}11;border:1px solid ${criticalColor}33;border-radius:8px;padding:14px 10px;text-align:center;">`;
    h += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin-bottom:6px;">Blocker/Critical</div>`;
    h += `<div style="font-size:26px;font-weight:700;color:${criticalColor};line-height:1;">${criticalBugs}</div>`;
    h += `<div style="font-size:10px;color:#9CA3AF;margin-top:4px;">${isVN ? 'mức độ cao nhất' : 'highest severity'}</div></div>`;
    const openBugs = (bs.byStatus['Open'] ?? 0) + (bs.byStatus['New'] ?? 0) + (bs.byStatus['To Do'] ?? 0) + (bs.byStatus['To-do'] ?? 0);
    const openColor = openBugs > 20 ? '#DC2626' : openBugs > 5 ? '#D97706' : '#6B7280';
    h += `<div style="background:${openColor}11;border:1px solid ${openColor}33;border-radius:8px;padding:14px 10px;text-align:center;">`;
    h += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin-bottom:6px;">${isVN ? 'Chưa xử lý' : 'Open/New'}</div>`;
    h += `<div style="font-size:26px;font-weight:700;color:${openColor};line-height:1;">${openBugs}</div>`;
    h += `<div style="font-size:10px;color:#9CA3AF;margin-top:4px;">${isVN ? 'bug chưa xử lý' : 'unresolved bugs'}</div></div>`;
    h += `</div>`;

    // Single donut + bar chart based on selected dimension
    if (bugDimension === 'status') {
      const statusSegs = statusEntries.map(([s, v]) => ({ val: v, color: bugStatusColor(s) }));
      h += `<div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:12px;">`;
      h += `<div class="rpd-panel"><div class="rpd-ptitle">${isVN ? 'Phân bổ theo Trạng thái' : 'Distribution by Status'}</div>`;
      h += `<div class="rpd-pie-lay"><div style="flex-shrink:0;">${svgDonut(statusSegs, 140, 58, 36, undefined, isVN)}</div>`;
      h += `<div class="rpd-pie-leg">`;
      statusEntries.slice(0, 7).forEach(([st, cnt]) => {
        const pct = bs.total > 0 ? Math.round(cnt / bs.total * 100) : 0;
        h += `<div class="rpd-leg-row"><div class="rpd-leg-dot" style="background:${bugStatusColor(st)};border:1px solid rgba(0,0,0,0.1);"></div><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${st}</span><span class="rpd-leg-val">${cnt} <span style="color:#9CA3AF;font-size:10px;">(${pct}%)</span></span></div>`;
      });
      h += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">${isVN ? 'Tổng cộng' : 'Total'}: <strong style="color:#111827;">${bs.total}</strong> bugs</div>`;
      h += `</div></div></div></div>`;
      if (bugBarItems.length > 0) {
        const topStatuses = statusEntries.slice(0, 6).map(([s]) => s);
        h += `<div class="rpd-bar-panel"><div class="rpd-panel">`;
        h += `<div class="rpd-ptitle">${isVN ? 'Số lượng Bug theo Dự án (chia theo Status)' : 'Bug Count by Project (by Status)'}</div>`;
        h += `<div>${svgBugBarChart(bugBarItems, topStatuses, bugStatusColor, item => item.byStatus, Math.max(600, bugBarItems.length * 80), 160)}</div>`;
        h += `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;justify-content:center;">`;
        topStatuses.forEach(st => { h += `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#6B7280;"><div style="width:10px;height:10px;border-radius:2px;background:${bugStatusColor(st)};display:inline-block;"></div>${st}</div>`; });
        if (statusEntries.length > topStatuses.length) h += `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#6B7280;"><div style="width:10px;height:10px;border-radius:2px;background:#CBD5E1;border:1px solid #94A3B8;display:inline-block;"></div>${isVN ? 'Khác' : 'Others'}</div>`;
        h += `</div></div></div>`;
      }
    } else {
      const severitySegs = severityEntries.map(([sv, v]) => ({ val: v, color: bugSeverityColor(sv) }));
      h += `<div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:12px;">`;
      h += `<div class="rpd-panel"><div class="rpd-ptitle">${isVN ? 'Phân bổ theo Mức độ (Severity)' : 'Distribution by Severity'}</div>`;
      h += `<div class="rpd-pie-lay"><div style="flex-shrink:0;">${svgDonut(severitySegs, 140, 58, 36, undefined, isVN)}</div>`;
      h += `<div class="rpd-pie-leg">`;
      severityEntries.forEach(([sv, cnt]) => {
        const pct = bs.total > 0 ? Math.round(cnt / bs.total * 100) : 0;
        h += `<div class="rpd-leg-row"><div class="rpd-leg-dot" style="background:${bugSeverityColor(sv)};border:1px solid rgba(0,0,0,0.1);"></div><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sv}</span><span class="rpd-leg-val">${cnt} <span style="color:#9CA3AF;font-size:10px;">(${pct}%)</span></span></div>`;
      });
      h += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">${isVN ? 'Tổng cộng' : 'Total'}: <strong style="color:#111827;">${bs.total}</strong> bugs</div>`;
      h += `</div></div></div></div>`;
      if (bugBarItems.length > 0) {
        const topSeverities = severityEntries.slice(0, 6).map(([sv]) => sv);
        h += `<div class="rpd-bar-panel"><div class="rpd-panel">`;
        h += `<div class="rpd-ptitle">${isVN ? 'Số lượng Bug theo Dự án (chia theo Severity)' : 'Bug Count by Project (by Severity)'}</div>`;
        h += `<div>${svgBugBarChart(bugBarItems, topSeverities, bugSeverityColor, item => item.bySeverity ?? {}, Math.max(600, bugBarItems.length * 80), 160)}</div>`;
        h += `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;justify-content:center;">`;
        topSeverities.forEach(sv => { h += `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#6B7280;"><div style="width:10px;height:10px;border-radius:2px;background:${bugSeverityColor(sv)};display:inline-block;"></div>${sv}</div>`; });
        if (severityEntries.length > topSeverities.length) h += `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#6B7280;"><div style="width:10px;height:10px;border-radius:2px;background:#CBD5E1;border:1px solid #94A3B8;display:inline-block;"></div>${isVN ? 'Khác' : 'Others'}</div>`;
        h += `</div></div></div>`;
      }
    }

    h += `</div>`; // bug section
  }
  return h;
}
