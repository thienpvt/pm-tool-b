import ExcelJS from 'exceljs';
import { getDb } from '@/lib/db';

// ─── Color palette matching the original Bank Platform template ───────────────
const NAV_COLOR    = '1E293B';   // dark navy header
const PHASE_BG     = 'D6E4F0';   // light steel blue for phase group rows
const PHASE_FONT   = '1A3A5C';   // dark navy text on phase rows
const DONE_FILL    = 'D1FAE5';   // green
const PROG_FILL    = 'FEF9C3';   // yellow
const BLOCK_FILL   = 'FEE2E2';   // red
const DEFER_FILL   = 'FFEDD5';   // orange
const TODO_FILL    = 'F1F5F9';   // grey
const GROUP_STRIPE = 'F8FAFC';   // very light stripe for member rows
const TOTAL_BG     = 'E2E8F0';   // soft grey for total rows

const HEADER_FONT  = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10, name: 'Calibri' };
const BODY_FONT    = { size: 9, name: 'Calibri' };
const BOLD_FONT    = { size: 9, bold: true, name: 'Calibri' };

type Fill = ExcelJS.Fill;

const solidFill = (hex: string): Fill => ({
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex },
});

function statusFill(status: string): Fill {
  const s = (status ?? '').toLowerCase();
  if (s === 'done' || s.includes('complet')) return solidFill(DONE_FILL);
  if (s === 'in progress')                   return solidFill(PROG_FILL);
  if (s === 'blocked')                       return solidFill(BLOCK_FILL);
  if (s === 'deferred')                      return solidFill(DEFER_FILL);
  return solidFill(TODO_FILL);
}

function riskStatusFill(status: string): Fill {
  const s = (status ?? '').toLowerCase();
  if (s === 'mitigated' || s === 'closed') return solidFill(DONE_FILL);
  if (s === 'in progress')                 return solidFill(PROG_FILL);
  if (s === 'open')                        return solidFill(BLOCK_FILL);
  return solidFill(TODO_FILL);
}

function thinBorder(color = 'CBD5E1'): Partial<ExcelJS.Border> {
  return { style: 'thin', color: { argb: 'FF' + color } };
}

function cellBorder(): Partial<ExcelJS.Borders> {
  return {
    top:    thinBorder(),
    bottom: thinBorder(),
    left:   thinBorder(),
    right:  thinBorder(),
  };
}

function navHeader(ws: ExcelJS.Worksheet, columns: string[], widths: number[]) {
  const row = ws.addRow(columns);
  row.eachCell(cell => {
    cell.fill = solidFill(NAV_COLOR);
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = cellBorder();
  });
  row.height = 30;
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  return row;
}

function sectionTitle(ws: ExcelJS.Worksheet, text: string, colCount: number, fontColor = '1E293B') {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, colCount);
  row.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF' + fontColor }, name: 'Calibri' };
  row.height = 24;
  return row;
}

function displayMonth(ym: string) {
  const [y, m] = ym.split('-');
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${labels[Number(m) - 1]}\n${y}`;
}

function getMonths(start: string, end: string): string[] {
  if (!start || !end) return [];
  const months: string[] = [];
  let d = new Date(start.substring(0, 7) + '-01');
  const e = new Date(end.substring(0, 7) + '-01');
  while (d <= e) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function generateProjectPlan(projectId: number): Promise<Buffer> {
  const db = await getDb();

  const project    = await db.get('SELECT * FROM projects WHERE id = ?', projectId) as Record<string, string> | undefined;
  if (!project) throw new Error('Project not found');

  const activities  = await db.all('SELECT * FROM activities WHERE project_id = ? ORDER BY order_idx, id', projectId) as Record<string, string | number>[];
  const teamMembers = await db.all('SELECT * FROM team_members WHERE project_id = ? ORDER BY domain, id', projectId) as Record<string, string>[];
  const meetings    = await db.all('SELECT * FROM meetings WHERE project_id = ? ORDER BY id', projectId) as Record<string, string>[];
  const escalations = await db.all('SELECT * FROM escalation_levels WHERE project_id = ? ORDER BY level', projectId) as Record<string, string | number>[];
  const risks       = await db.all('SELECT * FROM risks WHERE project_id = ? ORDER BY id', projectId) as Record<string, string>[];
  const issues      = await db.all('SELECT * FROM issues WHERE project_id = ? ORDER BY id', projectId) as Record<string, string>[];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CharterTech Global PM Tool';
  wb.created = new Date();

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 1: Project Timeline
  // ═══════════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet('Project Timeline', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // Title block
  ws1.addRow([`PROJECT PLAN — ${(project.name as string).toUpperCase()}`]);
  ws1.mergeCells(1, 1, 1, 14);
  ws1.getRow(1).getCell(1).font = { bold: true, size: 16, color: { argb: 'FF1E293B' }, name: 'Calibri' };
  ws1.getRow(1).height = 28;

  ws1.addRow([`Client: ${project.client ?? '—'}   |   PM: ${project.pm_name ?? '—'}   |   Period: ${project.start_date ?? ''} → ${project.end_date ?? ''}`]);
  ws1.mergeCells(2, 1, 2, 14);
  ws1.getRow(2).getCell(1).font = { size: 10, color: { argb: 'FF64748B' }, name: 'Calibri' };
  ws1.getRow(2).height = 18;

  ws1.addRow([]);

  // Column headers (row 4)
  const TL_COLS = ['No', 'Activity', 'Deliverable', 'Sign-off Document', 'Accountable / Approval', 'Responsible', 'Support', 'Plan\nStart', 'Plan\nEnd', 'Actual\nStart', 'Actual\nEnd', 'STATUS', 'Completed\n(%)', 'NOTES'];
  const TL_WIDTHS = [5, 36, 28, 22, 20, 18, 14, 12, 12, 12, 12, 14, 10, 30];
  navHeader(ws1, TL_COLS, TL_WIDTHS);

  // Activity rows grouped by phase
  const PHASE_ORDER = ['Initializing', 'Architecture & Design', 'Setup & Infra', 'Development', 'Testing', 'UAT', 'Deployment', 'Closing'];
  const phasesInData = [...new Set(activities.map(a => a.phase as string))];
  const orderedPhases = [
    ...PHASE_ORDER.filter(p => phasesInData.includes(p)),
    ...phasesInData.filter(p => !PHASE_ORDER.includes(p)),
  ];

  for (const phase of orderedPhases) {
    // Phase group header — merged across all 14 columns
    const phaseRow = ws1.addRow([phase, ...Array(13).fill('')]);
    ws1.mergeCells(phaseRow.number, 1, phaseRow.number, 14);
    phaseRow.getCell(1).fill = solidFill(PHASE_BG);
    phaseRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF' + PHASE_FONT }, name: 'Calibri' };
    phaseRow.getCell(1).alignment = { vertical: 'middle', indent: 1 };
    phaseRow.getCell(1).border = {
      top:    thinBorder('94A3B8'),
      bottom: thinBorder('94A3B8'),
      left:   thinBorder('94A3B8'),
      right:  thinBorder('94A3B8'),
    };
    phaseRow.height = 20;

    const phaseActs = activities.filter(a => a.phase === phase);
    for (const act of phaseActs) {
      const row = ws1.addRow([
        act.no,         act.activity,       act.deliverable,  act.sign_off_doc,
        act.accountable, act.responsible,   act.support,
        act.plan_start,  act.plan_end,      act.actual_start,  act.actual_end,
        act.status,     act.completion_pct ? `${act.completion_pct}%` : '',
        act.notes,
      ]);

      row.getCell(12).fill = statusFill(act.status as string);

      row.eachCell((cell, colNum) => {
        cell.font = BODY_FONT;
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
        if (colNum === 1) cell.alignment = { vertical: 'top', horizontal: 'center' };
        if (colNum === 13) cell.alignment = { vertical: 'top', horizontal: 'center' };
      });
      row.height = 20;
    }
  }

  ws1.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5' }];

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 2: Resource Plan
  // ═══════════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('Resource Plan');
  const months = getMonths(project.start_date as string, project.end_date as string);
  const RP_TOTAL_COLS = 3 + months.length + 1;

  sectionTitle(ws2, `RESOURCE PLAN — ${project.name}`, RP_TOTAL_COLS);
  ws2.addRow([]);

  const RP_COLS   = ['Domain', 'Role', 'Name', ...months.map(displayMonth), 'Notes'];
  const RP_WIDTHS = [14, 20, 22, ...months.map(() => 11), 30];
  navHeader(ws2, RP_COLS, RP_WIDTHS);

  const domains = [...new Set(teamMembers.map(m => m.domain))];
  for (const domain of domains) {
    // Domain group header
    const dr = ws2.addRow([domain, ...Array(RP_TOTAL_COLS - 1).fill('')]);
    ws2.mergeCells(dr.number, 1, dr.number, RP_TOTAL_COLS);
    dr.getCell(1).fill = solidFill(PHASE_BG);
    dr.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF' + PHASE_FONT }, name: 'Calibri' };
    dr.getCell(1).alignment = { vertical: 'middle', indent: 1 };
    dr.height = 18;

    const members = teamMembers.filter(m => m.domain === domain);
    const totalCap: Record<string, number> = {};

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const cap = JSON.parse(m.capacity_json || '{}');
      months.forEach(mo => { totalCap[mo] = (totalCap[mo] || 0) + (cap[mo] || 0); });

      const row = ws2.addRow(['', m.role, m.name, ...months.map(mo => cap[mo] ?? ''), m.notes]);
      row.eachCell((cell, colNum) => {
        cell.font = BODY_FONT;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
        if (colNum === 2 || colNum === 3) cell.alignment = { horizontal: 'left', vertical: 'middle' };
        if (colNum === RP_TOTAL_COLS) cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });
      if (i % 2 === 1) row.eachCell(cell => { if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === 'FF' + NAV_COLOR) return; cell.fill = solidFill('F8FAFC'); });
      row.height = 18;
    }

    // Total row
    const totRow = ws2.addRow(['', 'Total (MM)', '', ...months.map(mo => totalCap[mo] > 0 ? +totalCap[mo].toFixed(1) : ''), '']);
    totRow.eachCell(cell => {
      cell.fill = solidFill(TOTAL_BG);
      cell.font = BOLD_FONT;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: thinBorder('94A3B8'), right: thinBorder('E2E8F0') };
    });
    totRow.getCell(2).alignment = { horizontal: 'left' };
    totRow.height = 18;
  }

  ws2.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4' }];

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 3: Org Structure
  // ═══════════════════════════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet('Org Structure');
  sectionTitle(ws3, `ORG STRUCTURE — ${project.name}`, 4);
  ws3.addRow([]);
  navHeader(ws3, ['Domain', 'Role', 'Name', 'Notes'], [18, 22, 26, 36]);

  const domainList2 = [...new Set(teamMembers.map(m => m.domain))];
  for (const domain of domainList2) {
    const dr = ws3.addRow([domain, '', '', '']);
    ws3.mergeCells(dr.number, 1, dr.number, 4);
    dr.getCell(1).fill = solidFill(PHASE_BG);
    dr.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF' + PHASE_FONT }, name: 'Calibri' };
    dr.getCell(1).alignment = { vertical: 'middle', indent: 1 };
    dr.height = 18;

    for (const m of teamMembers.filter(x => x.domain === domain)) {
      const row = ws3.addRow(['', m.role, m.name, m.notes]);
      row.eachCell(cell => {
        cell.font = BODY_FONT;
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
      });
      row.height = 18;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 4: Communication Plan
  // ═══════════════════════════════════════════════════════════════════════════
  const ws4 = wb.addWorksheet('Communication Plan');
  sectionTitle(ws4, `COMMUNICATION PLAN — ${project.name}`, 5);
  ws4.addRow([]);

  navHeader(ws4,
    ['Meeting / Communication', 'Frequency', 'Content / Agenda', 'Participants / PICs', 'Method'],
    [32, 18, 42, 40, 18]
  );

  for (const m of meetings) {
    const row = ws4.addRow([m.name, m.frequency, m.content, m.participants, m.method]);
    row.eachCell(cell => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
    });
    row.height = 44;
  }

  ws4.addRow([]);
  const escTitle = ws4.addRow(['ESCALATION PATH', '', '', '', '']);
  ws4.mergeCells(escTitle.number, 1, escTitle.number, 5);
  escTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1E293B' }, name: 'Calibri' };
  escTitle.height = 22;

  ws4.addRow([]);
  navHeader(ws4,
    ['Level', 'Channel / Cadence', 'Participants', 'Input', 'Output'],
    [22, 28, 38, 22, 30]
  );

  const ESC_FILLS = ['DBEAFE', 'FEF3C7', 'FEE2E2'];
  for (const e of escalations) {
    const lvlIdx = Number(e.level) - 1;
    const row = ws4.addRow([e.level_name, e.channel, e.participants, e.input, e.output]);
    const bg = ESC_FILLS[lvlIdx] ?? 'F1F5F9';
    row.eachCell(cell => {
      cell.fill = solidFill(bg);
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: thinBorder('CBD5E1'), right: thinBorder('CBD5E1') };
    });
    row.height = 44;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 5: Risks & Issues
  // ═══════════════════════════════════════════════════════════════════════════
  const ws5 = wb.addWorksheet('Risks & Issues');
  sectionTitle(ws5, `RISK & ISSUE LOG — ${project.name}`, 8);
  ws5.addRow([]);

  const riskLabel = ws5.addRow(['RISK REGISTER', ...Array(7).fill('')]);
  ws5.mergeCells(riskLabel.number, 1, riskLabel.number, 8);
  riskLabel.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF991B1B' }, name: 'Calibri' };
  riskLabel.height = 20;

  navHeader(ws5,
    ['Risk ID', 'Description', 'Category', 'Owner', 'Trigger', 'Mitigation Plan', 'Due Date', 'Status'],
    [10, 38, 16, 18, 30, 38, 12, 14]
  );

  for (const r of risks) {
    const row = ws5.addRow([r.risk_id, r.description, r.category, r.owner, r.trigger, r.mitigation, r.due_date, r.status]);
    row.getCell(8).fill = riskStatusFill(r.status);
    row.eachCell(cell => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
    });
    row.height = 30;
  }

  ws5.addRow([]);
  const issueLabel = ws5.addRow(['ISSUE LOG', ...Array(7).fill('')]);
  ws5.mergeCells(issueLabel.number, 1, issueLabel.number, 8);
  issueLabel.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF6D28D9' }, name: 'Calibri' };
  issueLabel.height = 20;

  navHeader(ws5,
    ['Issue ID', 'Description', 'Root Cause', 'Category', 'Owner', 'Mitigation Plan', 'Due Date', 'Status'],
    [10, 34, 34, 16, 18, 34, 12, 14]
  );

  for (const i of issues) {
    const row = ws5.addRow([i.issue_id, i.description, i.root_cause, i.category, i.owner, i.mitigation, i.due_date, i.status]);
    row.getCell(8).fill = riskStatusFill(i.status);
    row.eachCell(cell => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
    });
    row.height = 30;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
