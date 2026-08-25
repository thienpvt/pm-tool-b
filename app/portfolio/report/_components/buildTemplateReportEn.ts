import type { PortfolioReportData } from '../types';
import { pickSummary } from './SummaryTemplates';

export function buildTemplateReportEn(data: PortfolioReportData, periodStart: string, periodEnd: string, companyName: string, bugDimension: 'status' | 'severity'): string {
  const isVN = false;
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

    // ── II. Completed in Period ──────────────────────────────────────────────
    lines.push(D);
    lines.push('  II. PROGRESS REPORT — COMPLETED IN PERIOD');
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

    // ── III. Actions Required ────────────────────────────────────────────────
    lines.push(D);
    lines.push('  III. ACTIONS REQUIRED — Steering Committee / CEO');
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

    // ── IV. Bug Report ────────────────────────────────────────────────────────
    if (data.bugStats && data.bugStats.total > 0) {
      const bsEN = { ...data.bugStats, bySeverity: data.bugStats.bySeverity ?? {} };
      lines.push(D);
      lines.push('  IV. BUG REPORT — PORTFOLIO-WIDE BUG SUMMARY');
      lines.push(D);
      lines.push('');

      const criticalBugsEN = (bsEN.bySeverity['Blocker'] ?? 0) + (bsEN.bySeverity['Critical'] ?? 0) + (bsEN.bySeverity['Highest'] ?? 0);
      const openBugsEN = (bsEN.byStatus['Open'] ?? 0) + (bsEN.byStatus['New'] ?? 0) + (bsEN.byStatus['To Do'] ?? 0) + (bsEN.byStatus['To-do'] ?? 0);
      lines.push(`  Total Bugs: ${bsEN.total}   ·   Projects with Bugs: ${bsEN.byProject.length}   ·   Blocker/Critical: ${criticalBugsEN}   ·   Open/New: ${openBugsEN}`);
      lines.push('');

      const bugBW2 = { st: 24, ct: 8, pt: 8, br: 20 } as const;
      const SEV_ORDER_EN = ['Blocker','Critical','Highest','Major','High','Medium','Normal','Moderate','Low','Minor','Trivial','Lowest'];

      if (bugDimension === 'status') {
        lines.push('  A. DISTRIBUTION BY STATUS:');
        lines.push(`  ${'─'.repeat(50)}`);
        Object.entries(bsEN.byStatus).sort((a, b) => b[1] - a[1]).forEach(([st, cnt]) => {
          const pct = bsEN.total > 0 ? Math.round(cnt / bsEN.total * 100) : 0;
          const barLen = Math.round(pct / 5);
          const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
          const stLabel = st.length > bugBW2.st ? st.slice(0, bugBW2.st - 1) + '…' : st;
          lines.push(`  ${stLabel.padEnd(bugBW2.st)} ${String(cnt).padStart(bugBW2.ct)} (${String(pct).padStart(3)}%) [${bar}]`);
        });
      } else {
        lines.push('  A. DISTRIBUTION BY SEVERITY:');
        lines.push(`  ${'─'.repeat(50)}`);
        const sevRowsEN = [
          ...SEV_ORDER_EN.filter(sv => (bsEN.bySeverity[sv] ?? 0) > 0).map(sv => [sv, bsEN.bySeverity[sv]] as [string, number]),
          ...Object.entries(bsEN.bySeverity).filter(([sv]) => !SEV_ORDER_EN.includes(sv)).sort((a, b) => b[1] - a[1]),
        ];
        sevRowsEN.forEach(([sv, cnt]) => {
          const pct = bsEN.total > 0 ? Math.round(cnt / bsEN.total * 100) : 0;
          const barLen = Math.round(pct / 5);
          const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
          lines.push(`  ${sv.padEnd(bugBW2.st)} ${String(cnt).padStart(bugBW2.ct)} (${String(pct).padStart(3)}%) [${bar}]`);
        });
      }
      lines.push('');

      lines.push('  B. BY PROJECT:');
      const BP2 = { nm: 26, tt: 8 } as const;
      lines.push(`  ┌${'─'.repeat(BP2.nm+2)}┬${'─'.repeat(BP2.tt+2)}┐`);
      lines.push(`  │ ${'PROJECT'.padEnd(BP2.nm)} │ ${'BUGS'.padStart(BP2.tt)} │`);
      lines.push(`  ├${'─'.repeat(BP2.nm+2)}┼${'─'.repeat(BP2.tt+2)}┤`);
      bsEN.byProject.slice(0, 15).forEach(p => {
        const nm = p.projectName.length > BP2.nm ? p.projectName.slice(0, BP2.nm - 1) + '…' : p.projectName;
        lines.push(`  │ ${nm.padEnd(BP2.nm)} │ ${String(p.total).padStart(BP2.tt)} │`);
      });
      lines.push(`  └${'─'.repeat(BP2.nm+2)}┴${'─'.repeat(BP2.tt+2)}┘`);
      lines.push('');
    }

    // ── V. Resource Allocation & Block Headcount Coverage ────────────────
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
      lines.push('  V. RESOURCE ALLOCATION & BLOCK HEADCOUNT COVERAGE');
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
  return lines.join('\n');
}
