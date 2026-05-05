import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

type Params = { params: Promise<{ id: string }> };

type Activity = { id: number; activity: string; deliverable: string; completion_pct: number; plan_end: string; actual_end: string; status: string; };
type RiskIssue = { id: number; description: string; priority: string; mitigation: string; };
type ReportData = {
  project: { name: string; customer_name: string; client: string; current_phase: string; pm_name: string; };
  weekRange: { start: string; end: string };
  doneThisWeek: Activity[];
  inProgress: Activity[];
  nextWeekPlan: Activity[];
  openRisks: RiskIssue[];
  openIssues: RiskIssue[];
  stats: { total: number; done: number; completion_pct: number };
};

const NAVY = 'FF1E3A5F';
const WHITE = 'FFFFFFFF';
const LIGHT_BLUE = 'FFE8F0FB';
const LIGHT_GRAY = 'FFF8FAFC';
const SEPARATOR = 'FFE2E8F0';
const GREEN_BG = 'FFD1FAE5';
const AMBER_BG = 'FFFEF3C7';
const RED_BG = 'FFFEE2E2';

function hdr(ws: ExcelJS.Worksheet, rowNum: number, text: string, color: string = LIGHT_BLUE) {
  const row = ws.getRow(rowNum);
  row.getCell(1).value = text;
  row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E3A5F' } };
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  row.getCell(1).alignment = { vertical: 'middle' };
  row.getCell(1).border = { bottom: { style: 'thin', color: { argb: SEPARATOR } } };
  for (let c = 1; c <= 5; c++) {
    ws.getRow(rowNum).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  }
  ws.mergeCells(`A${rowNum}:E${rowNum}`);
  row.height = 22;
}

function info(ws: ExcelJS.Worksheet, rowNum: number, label: string, value: string) {
  const row = ws.getRow(rowNum);
  row.getCell(1).value = label;
  row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
  row.getCell(2).value = value;
  row.getCell(2).font = { size: 10 };
  ws.mergeCells(`B${rowNum}:E${rowNum}`);
  row.height = 18;
}

export async function POST(req: NextRequest, { params }: Params) {
  void (await params); // params.id not needed for export, data comes from body
  const { report, reportData, startDate, endDate, language } = await req.json() as {
    report: string; reportData: ReportData; startDate: string; endDate: string; language: string;
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CharterTech Global PM Tool';
  wb.created = new Date();

  // ── Sheet 1: Report Text ────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Weekly Report');
  ws.properties.defaultRowHeight = 16;

  // Title
  ws.mergeCells('A1:E1');
  const titleCell = ws.getCell('A1');
  titleCell.value = language === 'Vietnamese' ? 'BÁO CÁO TIẾN ĐỘ DỰ ÁN HÀNG TUẦN' : 'WEEKLY PROJECT STATUS REPORT';
  titleCell.font = { bold: true, size: 14, color: { argb: WHITE } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Info rows
  let r = 2;
  info(ws, r++, 'Project', reportData.project.name);
  info(ws, r++, 'Customer', reportData.project.customer_name || reportData.project.client || 'N/A');
  info(ws, r++, 'Phase', reportData.project.current_phase);
  info(ws, r++, 'Period', `${startDate} → ${endDate}`);
  info(ws, r++, 'PM', reportData.project.pm_name || 'N/A');

  // Progress bar row
  const pct = reportData.stats.completion_pct;
  const health = pct >= 70 ? 'GREEN' : pct >= 40 ? 'AMBER' : 'RED';
  const healthBg = pct >= 70 ? GREEN_BG : pct >= 40 ? AMBER_BG : RED_BG;
  const row6 = ws.getRow(r);
  row6.getCell(1).value = 'Progress';
  row6.getCell(1).font = { bold: true, size: 10, color: { argb: '64748B' } };
  row6.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
  row6.getCell(2).value = `${pct}% (${reportData.stats.done}/${reportData.stats.total} done) — ${health}`;
  row6.getCell(2).font = { bold: true, size: 10 };
  row6.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: healthBg } };
  ws.mergeCells(`B${r}:E${r}`);
  row6.height = 18;
  r++;

  r++; // blank row

  // Report text (one line per row, full width)
  if (report) {
    const lines = report.split('\n');
    for (const line of lines) {
      ws.mergeCells(`A${r}:E${r}`);
      const cell = ws.getRow(r).getCell(1);
      cell.value = line;
      cell.font = { size: 10, name: 'Consolas' };
      cell.alignment = { wrapText: false, vertical: 'middle' };

      if (line.startsWith('═') || line.startsWith('─')) {
        cell.font = { size: 8, color: { argb: 'FFCBD5E1' }, name: 'Consolas' };
      } else if (/^(BÁO CÁO|WEEKLY|📊|🚦|✅|🔄|📋|⚠|COMPLETED|IN PROGRESS|NEXT WEEK|RISKS|OPEN RISKS)/.test(line)) {
        cell.font = { bold: true, size: 10, name: 'Consolas' };
      } else if (/^(Dự án|Project|Khách hàng|Customer|Phase|Tuần|Week|Date|Ngày|PM|Report|Period)\s*:/.test(line)) {
        cell.font = { size: 10, color: { argb: 'FF475569' }, name: 'Consolas' };
      }
      ws.getRow(r).height = 15;
      r++;
    }
  }

  // Column widths
  ws.getColumn(1).width = 100;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 15;
  ws.getColumn(5).width = 15;

  // ── Sheet 2: Data Tables ────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Data');
  ws2.properties.defaultRowHeight = 16;

  let r2 = 1;

  // Completed
  hdr(ws2, r2++, language === 'Vietnamese' ? `✅ HOÀN THÀNH (${reportData.doneThisWeek.length})` : `✅ COMPLETED (${reportData.doneThisWeek.length})`, LIGHT_BLUE);
  if (reportData.doneThisWeek.length === 0) {
    ws2.mergeCells(`A${r2}:E${r2}`);
    ws2.getRow(r2++).getCell(1).value = language === 'Vietnamese' ? '— Không có' : '— None';
  } else {
    // Table header
    const th = ws2.getRow(r2);
    ['Activity', 'Deliverable', 'Actual End'].forEach((h, i) => {
      th.getCell(i + 1).value = h;
      th.getCell(i + 1).font = { bold: true, size: 9 };
      th.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEPARATOR } };
    });
    r2++;
    for (const a of reportData.doneThisWeek) {
      const row = ws2.getRow(r2++);
      row.getCell(1).value = a.activity;
      row.getCell(2).value = a.deliverable || '';
      row.getCell(3).value = a.actual_end || '';
      row.getCell(1).font = { size: 9 };
      row.getCell(2).font = { size: 9, color: { argb: 'FF64748B' } };
      row.getCell(3).font = { size: 9, color: { argb: 'FF64748B' } };
    }
  }

  r2++; // gap

  // In Progress
  hdr(ws2, r2++, language === 'Vietnamese' ? `🔄 ĐANG THỰC HIỆN (${reportData.inProgress.length})` : `🔄 IN PROGRESS (${reportData.inProgress.length})`, 'FFE0F2FE');
  if (reportData.inProgress.length === 0) {
    ws2.mergeCells(`A${r2}:E${r2}`);
    ws2.getRow(r2++).getCell(1).value = language === 'Vietnamese' ? '— Không có' : '— None';
  } else {
    const th = ws2.getRow(r2);
    ['Activity', 'Progress %', 'Due Date'].forEach((h, i) => {
      th.getCell(i + 1).value = h;
      th.getCell(i + 1).font = { bold: true, size: 9 };
      th.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEPARATOR } };
    });
    r2++;
    for (const a of reportData.inProgress) {
      const row = ws2.getRow(r2++);
      row.getCell(1).value = a.activity;
      row.getCell(2).value = `${a.completion_pct}%`;
      row.getCell(3).value = a.plan_end || '';
      row.getCell(1).font = { size: 9 };
      row.getCell(2).font = { size: 9, bold: true };
      row.getCell(3).font = { size: 9, color: { argb: 'FF64748B' } };
    }
  }

  r2++; // gap

  // Next Week Plan
  hdr(ws2, r2++, language === 'Vietnamese' ? `📋 KẾ HOẠCH TIẾP THEO (${reportData.nextWeekPlan.length})` : `📋 UPCOMING PLAN (${reportData.nextWeekPlan.length})`, 'FFFEF9C3');
  if (reportData.nextWeekPlan.length === 0) {
    ws2.mergeCells(`A${r2}:E${r2}`);
    ws2.getRow(r2++).getCell(1).value = language === 'Vietnamese' ? '— Chưa có kế hoạch' : '— None scheduled';
  } else {
    const th = ws2.getRow(r2);
    ['Activity', 'Plan Start'].forEach((h, i) => {
      th.getCell(i + 1).value = h;
      th.getCell(i + 1).font = { bold: true, size: 9 };
      th.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEPARATOR } };
    });
    r2++;
    for (const a of reportData.nextWeekPlan) {
      const row = ws2.getRow(r2++);
      row.getCell(1).value = a.activity;
      row.getCell(2).value = a.plan_end || '';
      row.getCell(1).font = { size: 9 };
      row.getCell(2).font = { size: 9, color: { argb: 'FF64748B' } };
    }
  }

  if (reportData.openRisks.length > 0 || reportData.openIssues.length > 0) {
    r2++; // gap
    hdr(ws2, r2++, language === 'Vietnamese' ? `⚠ RỦI RO & VẤN ĐỀ (${reportData.openRisks.length + reportData.openIssues.length})` : `⚠ RISKS & ISSUES (${reportData.openRisks.length + reportData.openIssues.length})`, 'FFFEE2E2');
    const th = ws2.getRow(r2);
    ['Type', 'Priority', 'Description', 'Mitigation / Resolution'].forEach((h, i) => {
      th.getCell(i + 1).value = h;
      th.getCell(i + 1).font = { bold: true, size: 9 };
      th.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEPARATOR } };
    });
    r2++;
    for (const r of reportData.openRisks) {
      const row = ws2.getRow(r2++);
      row.getCell(1).value = 'Risk';
      row.getCell(2).value = r.priority;
      row.getCell(3).value = r.description;
      row.getCell(4).value = r.mitigation || '';
      [1, 2, 3, 4].forEach(c => { row.getCell(c).font = { size: 9 }; });
    }
    for (const i of reportData.openIssues) {
      const row = ws2.getRow(r2++);
      row.getCell(1).value = 'Issue';
      row.getCell(2).value = i.priority;
      row.getCell(3).value = i.description;
      row.getCell(4).value = i.mitigation || '';
      [1, 2, 3, 4].forEach(c => { row.getCell(c).font = { size: 9 }; });
    }
  }

  ws2.getColumn(1).width = 50;
  ws2.getColumn(2).width = 15;
  ws2.getColumn(3).width = 20;
  ws2.getColumn(4).width = 40;
  ws2.getColumn(5).width = 15;

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `WeeklyReport_${reportData.project.name.replace(/\s+/g, '_')}_${startDate}.xlsx`;
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
