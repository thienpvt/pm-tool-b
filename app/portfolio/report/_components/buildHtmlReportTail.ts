import type { PortfolioReportData } from '../types';
import { svgDonut, svgHBarChart } from './buildHtmlReportCharts';

export function appendHtmlReportTail(
  h: string,
  data: PortfolioReportData,
  isVN: boolean,
  periodStart: string,
  periodEnd: string,
  companyName: string,
  today: string,
  allProjects: PortfolioReportData['programs'][number]['projects'][number][],
  red: PortfolioReportData['programs'][number]['projects'],
  epicsDone: number,
  epicsInProg: number,
  epicsNotStarted: number,
  epicsTotal: number,
  pCol: (i: number) => string,
  ragCol: (r: string) => string,
  epicSt: (pct: number) => 'done' | 'prog' | 'todo',
  epicStCol: (st: string) => string,
  epicStLbl: (st: string) => string,
  epicStBg: (st: string) => string,
  epicStBdr: (st: string) => string,
): string {
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
    h += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">`;
    h += kpiCard(isVN?'Định biên':'Headcount Quota', fs.headcountQuota > 0 ? String(fs.headcountQuota) : '—', isVN?'người':'people', '#111827', '#F8F9FA');
    h += kpiCard(isVN?'FTE khả dụng net':'Net Used FTE', totalUsedFte.toFixed(1), 'FTE', '#2563EB', '#EFF6FF');
    h += kpiCard('Utilization', fs.headcountQuota > 0 ? `${fs.utilizationPct}%` : '—', isVN?'của định biên':'of quota', utilColor, `${utilColor}11`);
    h += kpiCard(isVN?'Fill rate khối':'Block Fill Rate', fs.programFillRates.length > 0 ? `${fs.blockFillRate}%` : '—', '% FTE', fillColor, `${fillColor}11`);
    h += `</div>`;

    // ── Row 1: Donut (left) + Fill rate bar chart (right)
    h += `<div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;margin-bottom:12px;">`;

    // Col 1: Donut — Delivery / Overhead / Bench
    const donutSegs = [
      { val: fs.deliveryFte,   color: '#2563EB' },
      { val: overheadTotalFte, color: '#D97706' },
      { val: fs.benchFte,      color: '#D1D5DB' },
    ].filter(s => s.val > 0);
    h += `<div class="rpd-panel">`;
    h += `<div class="rpd-ptitle">${isVN?'Cơ cấu năng lực khối (FTE)':'Block Capacity Structure (FTE)'}</div>`;
    h += `<div class="rpd-pie-lay"><div style="flex-shrink:0;">${svgDonut(donutSegs, 140, 56, 34, deliveryPct)}</div>`;
    h += `<div class="rpd-pie-leg">`;
    const donutLegend = [
      { label: 'Delivery', val: fs.deliveryFte,   pct: deliveryPct,  color: '#2563EB' },
      { label: 'Overhead', val: overheadTotalFte,  pct: overheadPct,  color: '#D97706' },
      { label: 'Bench',    val: fs.benchFte,        pct: benchPct,     color: '#D1D5DB' },
    ];
    donutLegend.forEach(l => {
      h += `<div class="rpd-leg-row"><div class="rpd-leg-dot" style="background:${l.color};border:1px solid rgba(0,0,0,0.1);"></div>${l.label}<span class="rpd-leg-val">${l.val.toFixed(1)} <span style="color:#9CA3AF;font-size:10px;">(${l.pct}%)</span></span></div>`;
    });
    h += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">${isVN?'Tổng định biên':'Quota'}: <strong style="color:#111827;">${fs.headcountQuota > 0 ? fs.headcountQuota : donutBase} ${isVN?'người':'ppl'}</strong></div>`;
    h += `</div></div></div>`;

    // Col 2: Horizontal bar chart — fill rate by program
    h += `<div class="rpd-panel">`;
    h += `<div class="rpd-ptitle">${isVN?'Fill rate theo Program (FTE)':'Fill Rate by Program (FTE)'}</div>`;
    if (fs.programFillRates.length > 0) {
      h += svgHBarChart(fs.programFillRates);
      h += `<div style="display:flex;gap:16px;margin-top:8px;font-size:10px;color:#6B7280;">`;
      h += `<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:2px;background:#16A34A;display:inline-block;"></span>≥90%</span>`;
      h += `<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:2px;background:#D97706;display:inline-block;"></span>70–89%</span>`;
      h += `<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:2px;background:#DC2626;display:inline-block;"></span>&lt;70%</span>`;
      h += `</div>`;
    } else {
      h += `<p style="font-size:11px;color:#9CA3AF;margin:12px 0;">${isVN?'Chưa có dữ liệu phân bổ program.':'No program allocation data.'}</p>`;
    }
    h += `</div>`;

    h += `</div>`; // row 1 grid

    // ── Row 2: Full-width overallocated people table
    {
      const overalloc = ps ? ps.overallocated : [];
      h += `<div class="rpd-panel" style="margin-bottom:14px;">`;
      h += `<div class="rpd-ptitle">${isVN?'Nhân sự tham gia &gt; 2 Squad/Dự án':'Personnel in &gt; 2 Squad/Projects'}</div>`;
      if (overalloc.length === 0) {
        h += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:12px;color:#16A34A;">`;
        h += `<span style="width:8px;height:8px;border-radius:50%;background:#16A34A;flex-shrink:0;display:inline-block;"></span>`;
        h += `${isVN?'Không có nhân sự nào đang tham gia hơn 2 Squad/Dự án.':'No personnel currently in more than 2 Squad/Projects.'}`;
        h += `</div>`;
      } else {
        h += `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:4px;">`;
        h += `<thead><tr>`;
        h += `<th style="text-align:left;padding:6px 12px 8px;color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E5E7EB;">${isVN?'Nhân sự':'Name'}</th>`;
        h += `<th style="text-align:left;padding:6px 12px 8px;color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E5E7EB;">${isVN?'Vai trò':'Role'}</th>`;
        h += `<th style="text-align:center;padding:6px 12px 8px;color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E5E7EB;width:60px;">${isVN?'Số DA':'#'}</th>`;
        h += `<th style="text-align:left;padding:6px 12px 8px;color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E5E7EB;">${isVN?'Danh sách Squad/Dự án':'Squad/Projects'}</th>`;
        h += `</tr></thead><tbody>`;
        overalloc.forEach((person, idx) => {
          const bg = idx % 2 === 1 ? 'background:#FAFAFA;' : '';
          h += `<tr style="${bg}">`;
          h += `<td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-weight:600;color:#111827;">${person.name}</td>`;
          h += `<td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;color:#6B7280;">${person.role || '—'}</td>`;
          h += `<td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;text-align:center;"><span style="background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:4px;padding:2px 8px;font-weight:700;">${person.projects.length}</span></td>`;
          h += `<td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;color:#374151;font-size:11px;">${person.projects.join(' · ')}</td>`;
          h += `</tr>`;
        });
        h += `</tbody></table>`;
        h += `<div style="margin-top:10px;padding:7px 12px;background:#FEF2F2;border-radius:4px;font-size:11px;color:#DC2626;">[!] ${isVN?'Cần rà soát phân bổ để đảm bảo chất lượng và tiến độ.':'Review allocations to ensure quality and delivery.'}</div>`;
      }
      h += `</div>`;
    }

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
  h += `<div style="font-size:10px;color:#6B7280;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:4px;padding:6px 8px;margin-bottom:10px;line-height:1.6;">${isVN?'<strong>SPI</strong> (Schedule Performance Index) = Tiến độ thực tế ÷ Tiến độ kỳ vọng theo thời gian đã trôi qua. VD: dự án 30 ngày, đã đi 83% thời gian nhưng chỉ đạt 43% → SPI = 0.52 → RED.':'<strong>SPI</strong> (Schedule Performance Index) = Actual progress ÷ Expected progress based on elapsed time. E.g. 30-day project, 83% of time elapsed but only 43% done → SPI = 0.52 → RED.'}</div>`;
  h += `<div style="display:flex;flex-direction:column;gap:8px;font-size:12px;">`;
  h += `<div style="display:flex;align-items:flex-start;gap:8px;"><span style="margin-top:2px;width:10px;height:10px;border-radius:50%;background:#DC2626;flex-shrink:0;display:inline-block;"></span><div><strong style="color:#DC2626;">RED</strong><br><span style="color:#6B7280;font-size:11px;">${isVN?'SPI < 0.6 HOẶC Deadline quá hạn HOẶC ≥3 risks mở':'SPI < 0.6 OR past deadline OR ≥3 open risks'}</span></div></div>`;
  h += `<div style="display:flex;align-items:flex-start;gap:8px;"><span style="margin-top:2px;width:10px;height:10px;border-radius:50%;background:#D97706;flex-shrink:0;display:inline-block;"></span><div><strong style="color:#D97706;">AMBER</strong><br><span style="color:#6B7280;font-size:11px;">${isVN?'SPI < 0.8 HOẶC Deadline ≤14 ngày HOẶC ≥1 risk/issue mở HOẶC tiến độ <30%':'SPI < 0.8 OR deadline ≤14 days OR ≥1 open risk/issue OR progress <30%'}</span></div></div>`;
  h += `<div style="display:flex;align-items:flex-start;gap:8px;"><span style="margin-top:2px;width:10px;height:10px;border-radius:50%;background:#16A34A;flex-shrink:0;display:inline-block;"></span><div><strong style="color:#16A34A;">GREEN</strong><br><span style="color:#6B7280;font-size:11px;">${isVN?'Không có điều kiện nào ở trên. Phase Closing → luôn GREEN.':'None of the above. Phase Closing → always GREEN.'}</span></div></div>`;
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
  return h;
}
