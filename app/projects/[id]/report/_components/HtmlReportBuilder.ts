import type { ProjectReportData } from '../types';
import { fmtDate } from './helpers';
import { svgDonut } from './SvgCharts';
import { buildBugSection } from './HtmlReportBuilderBugs';

export function buildProjectHtmlReport(data: ProjectReportData, language: string, companyName = ''): string {
  const isVN = language === 'Vietnamese';
  const { project, stats, epicStats, completedInPeriod, upcomingActivities, openRisks, openIssues, bugStats, periodStart, periodEnd, teamStats, milestoneStats, selectedMilestone } = data;
  const today = new Date().toLocaleDateString(isVN ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const rag = project.rag;
  const ragColor = rag === 'red' ? '#DC2626' : rag === 'amber' ? '#D97706' : '#16A34A';
  const ragLabel = rag === 'red' ? 'RED' : rag === 'amber' ? 'AMBER' : 'GREEN';
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

  const bugSection = buildBugSection(data, isVN);

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
      <div style="font-size:11px;color:#94A3B8;margin-bottom:14px;">${isVN ? `Kỳ báo cáo: ${fmtDate(periodStart)} → ${fmtDate(periodEnd)} · Tổng: ${teamStats.totalPeriodTasks} task` : `Period: ${fmtDate(periodStart)} → ${fmtDate(periodEnd)} · Total: ${teamStats.totalPeriodTasks} tasks`}</div>

      <!-- Task allocation list: sorted most → least -->
      ${teamStats.taskAllocation.length > 0 ? `
      <div>
        ${teamStats.taskAllocation.map((m, i) => {
          const barW = Math.min(100, m.pct);
          const barColor = m.pct >= 30 ? '#3B82F6' : m.pct >= 15 ? '#8B5CF6' : '#94A3B8';
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F3F4F6;">
            <span style="font-size:10px;color:#9CA3AF;min-width:18px;text-align:right;flex-shrink:0;">${i + 1}.</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:500;color:#111827;">${m.name}</div>
              <div style="font-size:10px;color:#6B7280;">${m.role !== '—' ? m.role : ''}${m.role !== '—' && m.domain !== '—' && m.domain !== 'General' ? ' · ' + m.domain : (m.domain !== '—' && m.domain !== 'General' ? m.domain : '')}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;min-width:160px;flex-shrink:0;">
              <div style="flex:1;background:#E5E7EB;border-radius:3px;height:5px;overflow:hidden;">
                <div style="width:${barW}%;height:100%;background:${barColor};border-radius:3px;"></div>
              </div>
              <span style="color:#374151;font-size:11px;font-weight:600;min-width:24px;text-align:right;">${m.count}</span>
              <span style="background:${barColor}20;color:${barColor};border-radius:4px;padding:2px 7px;font-size:10px;font-weight:600;min-width:38px;text-align:center;">${m.pct}%</span>
            </div>
          </div>`;
        }).join('')}
      </div>
      ` : `<p style="font-size:12px;color:#94A3B8;">${isVN ? 'Không có dữ liệu phân bổ (chưa điền Người phụ trách trong timeline).' : 'No allocation data — fill in Accountable in timeline activities.'}</p>`}
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

    <!-- Legend / Methodology -->
    <div style="margin-top:28px;border-top:2px solid #E5E7EB;padding-top:18px;">
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;display:flex;align-items:center;gap:7px;">
        <span style="width:18px;height:18px;border-radius:50%;background:#6B7280;color:#fff;font-size:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">?</span>
        ${isVN?'Chú thích & Phương pháp tính':'Legend & Methodology'}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px;">
          <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;">${isVN?'Chỉ số sức khỏe RAG':'RAG Health Indicator'}</div>
          <div style="font-size:10px;color:#6B7280;background:#fff;border:1px solid #E2E8F0;border-radius:4px;padding:5px 7px;margin-bottom:9px;line-height:1.6;">${isVN?'<strong>SPI</strong> = Tiến độ thực tế ÷ Tiến độ kỳ vọng theo thời gian đã trôi qua':'<strong>SPI</strong> = Actual progress ÷ Expected progress based on elapsed time'}</div>
          <div style="display:flex;flex-direction:column;gap:7px;font-size:11px;">
            <div style="display:flex;align-items:flex-start;gap:7px;"><span style="margin-top:2px;width:9px;height:9px;border-radius:50%;background:#DC2626;flex-shrink:0;display:inline-block;"></span><div><strong style="color:#DC2626;">RED</strong> — <span style="color:#6B7280;">${isVN?'SPI < 0.6 HOẶC deadline quá hạn HOẶC ≥3 risks mở':'SPI < 0.6 OR past deadline OR ≥3 open risks'}</span></div></div>
            <div style="display:flex;align-items:flex-start;gap:7px;"><span style="margin-top:2px;width:9px;height:9px;border-radius:50%;background:#D97706;flex-shrink:0;display:inline-block;"></span><div><strong style="color:#D97706;">AMBER</strong> — <span style="color:#6B7280;">${isVN?'SPI < 0.8 HOẶC deadline ≤14 ngày HOẶC ≥1 risk/issue mở':'SPI < 0.8 OR deadline ≤14 days OR ≥1 open risk/issue'}</span></div></div>
            <div style="display:flex;align-items:flex-start;gap:7px;"><span style="margin-top:2px;width:9px;height:9px;border-radius:50%;background:#16A34A;flex-shrink:0;display:inline-block;"></span><div><strong style="color:#16A34A;">GREEN</strong> — <span style="color:#6B7280;">${isVN?'Không có điều kiện nào ở trên. Phase Closing → luôn GREEN.':'None of the above. Phase Closing → always GREEN.'}</span></div></div>
          </div>
        </div>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px;">
          <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;">${isVN?'Cách tính tiến độ (weighted)':'Progress Calculation (weighted)'}</div>
          <div style="font-size:11px;color:#6B7280;line-height:1.7;">
            <div style="margin-bottom:6px;">${isVN?'Tiến độ = Σ(trọng số trạng thái) / Tổng activity':'Progress = Σ(status weight) / Total activities'}</div>
            <div style="display:flex;flex-direction:column;gap:2px;">
              <div style="display:flex;justify-content:space-between;"><span>Done / Deployed / UAT</span><strong style="color:#16A34A;">1.0</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>Re-Open / QC Done</span><strong style="color:#16A34A;">0.7 – 1.0</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>In Testing / PENDING</span><strong style="color:#3B82F6;">0.5 – 0.6</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>In Dev / Ready For Dev</span><strong style="color:#D97706;">0.2</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>To Do / REFINEMENT</span><strong style="color:#9CA3AF;">0.1</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>New / Blocked</span><strong style="color:#DC2626;">0.0</strong></div>
            </div>
          </div>
        </div>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px;">
          <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;">${isVN?'Trạng thái Epic / Phase':'Epic / Phase Status'}</div>
          <div style="font-size:11px;color:#6B7280;line-height:1.7;">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;"><div style="width:9px;height:9px;border-radius:2px;background:#16A34A;flex-shrink:0;"></div><span>${isVN?'Hoàn thành: tiến độ epic = 100%':'Done: epic progress = 100%'}</span></div>
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;"><div style="width:9px;height:9px;border-radius:2px;background:#3B82F6;flex-shrink:0;"></div><span>${isVN?'Đang triển khai: 1% – 99%':'In Progress: 1% – 99%'}</span></div>
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;"><div style="width:9px;height:9px;border-radius:2px;background:#D1D5DB;border:1px solid #9CA3AF;flex-shrink:0;"></div><span>${isVN?'Chưa bắt đầu: tiến độ epic = 0%':'Not Started: epic progress = 0%'}</span></div>
            <div style="font-size:10px;color:#9CA3AF;border-top:1px solid #E5E7EB;padding-top:7px;">${isVN?'Ngày: ưu tiên actual, fallback về plan. Hiển thị N/A nếu chưa có dữ liệu.':'Dates: actual preferred, fallback to planned. N/A if no data.'}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Milestone overview — date range mode only -->
    ${!selectedMilestone && milestoneStats && milestoneStats.length > 0 ? `
    <div class="card" style="margin-bottom:28px;">
      <div class="sec-h">${isVN ? 'Tổng quan Milestone' : 'Milestone Overview'}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="text-align:left;padding:8px 10px;font-weight:600;color:#374151;border-bottom:2px solid #E2E8F0;">${isVN?'Milestone':'Milestone'}</th>
            <th style="text-align:center;padding:8px 10px;font-weight:600;color:#374151;border-bottom:2px solid #E2E8F0;white-space:nowrap;">${isVN?'Bắt đầu':'Start'}</th>
            <th style="text-align:center;padding:8px 10px;font-weight:600;color:#374151;border-bottom:2px solid #E2E8F0;white-space:nowrap;">${isVN?'Kết thúc':'End'}</th>
            <th style="text-align:right;padding:8px 10px;font-weight:600;color:#374151;border-bottom:2px solid #E2E8F0;">${isVN?'Xong':'Done'}</th>
            <th style="text-align:right;padding:8px 10px;font-weight:600;color:#374151;border-bottom:2px solid #E2E8F0;">${isVN?'Tổng':'Total'}</th>
            <th style="text-align:left;padding:8px 10px;font-weight:600;color:#374151;border-bottom:2px solid #E2E8F0;width:35%;">${isVN?'Tiến độ':'Progress'}</th>
          </tr>
        </thead>
        <tbody>
          ${milestoneStats.map(ms => {
            const barColor = ms.pct >= 80 ? '#16A34A' : ms.pct >= 40 ? '#3B82F6' : '#F97316';
            const today2 = new Date().toISOString().slice(0, 10);
            const isOverdue = ms.end_date && ms.end_date < today2 && ms.pct < 100;
            return `<tr style="border-bottom:1px solid #F1F5F9;">
              <td style="padding:8px 10px;color:#1E293B;font-weight:500;">${ms.name}${isOverdue ? ` <span style="background:#FEF2F2;color:#DC2626;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;">OVERDUE</span>` : ''}</td>
              <td style="padding:8px 10px;text-align:center;color:#64748B;font-size:11px;white-space:nowrap;">${fmtDate(ms.start_date)}</td>
              <td style="padding:8px 10px;text-align:center;color:#64748B;font-size:11px;white-space:nowrap;">${fmtDate(ms.end_date)}</td>
              <td style="padding:8px 10px;text-align:right;color:#374151;">${ms.done}</td>
              <td style="padding:8px 10px;text-align:right;color:#374151;">${ms.total}</td>
              <td style="padding:8px 10px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="prog-bar-bg" style="flex:1;"><div class="prog-bar-fill" style="width:${ms.pct}%;background:${barColor};"></div></div>
                  <span style="font-size:11px;font-weight:600;color:${barColor};min-width:32px;">${ms.pct}%</span>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <!-- Footer -->
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94A3B8;">
      <span>${project.name}${companyName ? ' · ' + companyName : ''}</span>
      <span>${isVN?'Tài liệu bảo mật — Nội bộ':'Confidential — Internal Only'} · ${today}</span>
    </div>
  </div>
</div>`;

  return html;
}
