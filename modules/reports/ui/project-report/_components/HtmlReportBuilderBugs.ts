import type { ProjectReportData } from '../types';
import { svgDonut } from './SvgCharts';

export function buildBugSection(data: ProjectReportData, isVN: boolean): string {
  const { bugStats } = data;
  if (!bugStats || bugStats.total <= 0) return '';

  const STATUS_COLORS: Record<string, string> = {
    Open: '#DC2626', New: '#DC2626', 'To Do': '#F97316', 'To-do': '#F97316',
    'In Progress': '#3B82F6', 'In Review': '#8B5CF6', Testing: '#0891B2', 'In Testing': '#0891B2',
    Done: '#16A34A', Closed: '#6B7280', Deployed: '#16A34A', ANBM: '#16A34A',
  };
  const PRIO_COLORS: Record<string, string> = {
    Critical: '#DC2626', Highest: '#EF4444', High: '#F97316', Medium: '#FBBF24', Low: '#86EFAC', Lowest: '#D1FAE5',
  };
  const statusEntries = Object.entries(bugStats.byStatus).sort((a, b) => b[1] - a[1]);
  const prioEntries = ['Critical', 'Highest', 'High', 'Medium', 'Low', 'Lowest']
    .filter(p => bugStats.byPriority[p])
    .map(p => [p, bugStats.byPriority[p]] as [string, number]);

  const bugDonut1 = svgDonut(statusEntries.map(([st, cnt]) => ({ val: cnt, color: STATUS_COLORS[st] ?? '#9CA3AF' })), 130, 54, 32);
  const bugDonut2 = svgDonut(prioEntries.map(([pr, cnt]) => ({ val: cnt, color: PRIO_COLORS[pr] ?? '#9CA3AF' })), 130, 54, 32);

  const critBugs = (bugStats.byPriority['Critical'] ?? 0) + (bugStats.byPriority['Highest'] ?? 0);
  const openBugs = (bugStats.byStatus['Open'] ?? 0) + (bugStats.byStatus['New'] ?? 0) + (bugStats.byStatus['To Do'] ?? 0) + (bugStats.byStatus['To-do'] ?? 0);

  return `
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
              ${statusEntries.slice(0, 5).map(([st, cnt]) => `<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;"><span style="width:8px;height:8px;border-radius:50%;background:${STATUS_COLORS[st] ?? '#9CA3AF'};display:inline-block;"></span>${st}: <strong>${cnt}</strong></div>`).join('')}
            </div>
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:8px;">${isVN ? 'Theo priority' : 'By Priority'}</div>
          <div style="display:flex;align-items:center;gap:10px;">${bugDonut2}
            <div style="font-size:11px;color:#374151;">
              ${prioEntries.map(([pr, cnt]) => `<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;"><span style="width:8px;height:8px;border-radius:50%;background:${PRIO_COLORS[pr] ?? '#9CA3AF'};display:inline-block;"></span>${pr}: <strong>${cnt}</strong></div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}
