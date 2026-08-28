import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import type { PortfolioCharts, PortfolioKpis } from '@/lib/dashboards/kpi';
import type { PortfolioDashboardListRow } from '@/modules/dashboards/backend/services/spec-dashboards.service';

export type PortfolioDashboardExportPayload = {
  filters: Record<string, unknown>;
  kpis: PortfolioKpis;
  charts: PortfolioCharts;
  list: PortfolioDashboardListRow[];
  drilldowns: {
    overdue_milestones: unknown[];
    high_raid: unknown[];
    technology_council: unknown[];
  };
};

const NAV_COLOR = '1E293B';
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10, name: 'Calibri' };
const BODY_FONT = { size: 9, name: 'Calibri' };
const BOLD_FONT = { size: 9, bold: true, name: 'Calibri' };

type Fill = ExcelJS.Fill;

const solidFill = (hex: string): Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF' + hex },
});

function thinBorder(color = 'CBD5E1'): Partial<ExcelJS.Border> {
  return { style: 'thin', color: { argb: 'FF' + color } };
}

function cellBorder(): Partial<ExcelJS.Borders> {
  return {
    top: thinBorder(),
    bottom: thinBorder(),
    left: thinBorder(),
    right: thinBorder(),
  };
}

function navHeader(ws: ExcelJS.Worksheet, columns: string[], widths: number[]) {
  const row = ws.addRow(columns);
  row.eachCell((cell) => {
    cell.fill = solidFill(NAV_COLOR);
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = cellBorder();
  });
  row.height = 30;
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  return row;
}

function sectionTitle(ws: ExcelJS.Worksheet, text: string, colCount: number) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, colCount);
  row.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1E293B' }, name: 'Calibri' };
  row.height = 24;
  return row;
}

function labelValueRow(ws: ExcelJS.Worksheet, label: string, value: string | number | null) {
  const row = ws.addRow([label, value ?? '']);
  row.getCell(1).font = BOLD_FONT;
  row.getCell(2).font = BODY_FONT;
  row.eachCell((cell) => {
    cell.alignment = { vertical: 'top', wrapText: true };
    cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
  });
  row.height = 18;
}

function rowField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v == null ? '' : String(v);
}

function buildKpisSheet(wb: ExcelJS.Workbook, payload: PortfolioDashboardExportPayload) {
  const ws = wb.addWorksheet('KPIs');
  sectionTitle(ws, 'PORTFOLIO DASHBOARD KPIs', 2);
  ws.addRow([]);
  labelValueRow(ws, 'Active Count', payload.kpis.active_count);
  labelValueRow(ws, 'On Track Count', payload.kpis.on_track_count);
  labelValueRow(ws, 'Watch/Act Count', payload.kpis.watch_act_count);
  labelValueRow(ws, 'Overdue Milestone Projects', payload.kpis.overdue_milestone_project_count);
  labelValueRow(ws, 'High Open RAID', payload.kpis.high_open_raid_count);
  labelValueRow(ws, 'Technology Council', payload.kpis.technology_council_count);
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 16;
}

function buildProjectsSheet(wb: ExcelJS.Workbook, payload: PortfolioDashboardExportPayload) {
  const ws = wb.addWorksheet('Projects');
  navHeader(
    ws,
    ['ID', 'Code', 'Name', 'PM', 'Stage', 'Status', 'RAG', 'Progress %'],
    [8, 12, 28, 18, 8, 12, 10, 10],
  );
  for (const p of payload.list) {
    const row = ws.addRow([
      p.id,
      p.project_code ?? '',
      p.name,
      p.pm_name ?? '',
      p.stage ?? '',
      p.status,
      p.rag ?? '',
      p.progress_pct != null ? `${p.progress_pct}%` : '',
    ]);
    row.eachCell((cell) => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
    });
  }
}

function buildDrilldownSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: string[],
  widths: number[],
  rows: Record<string, unknown>[],
  fieldKeys: string[],
) {
  const ws = wb.addWorksheet(name);
  navHeader(ws, columns, widths);
  for (const item of rows) {
    const row = ws.addRow(fieldKeys.map((k) => rowField(item, k)));
    row.eachCell((cell) => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
    });
  }
}

export async function generatePortfolioDashboardXlsx(
  payload: PortfolioDashboardExportPayload,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PM Tool';
  wb.created = new Date();

  buildKpisSheet(wb, payload);
  buildProjectsSheet(wb, payload);
  buildDrilldownSheet(
    wb,
    'Overdue Milestones',
    ['Project ID', 'Milestone ID', 'Name'],
    [12, 14, 36],
    payload.drilldowns.overdue_milestones as Record<string, unknown>[],
    ['project_id', 'milestone_id', 'name'],
  );
  buildDrilldownSheet(
    wb,
    'High RAID',
    ['ID', 'Project ID', 'Entity Type'],
    [10, 12, 14],
    payload.drilldowns.high_raid as Record<string, unknown>[],
    ['id', 'project_id', 'entity_type'],
  );
  buildDrilldownSheet(
    wb,
    'Technology Council',
    ['ID', 'Project ID'],
    [10, 12],
    payload.drilldowns.technology_council as Record<string, unknown>[],
    ['id', 'project_id'],
  );

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function generatePortfolioDashboardPdf(
  payload: PortfolioDashboardExportPayload,
): Promise<Buffer> {
  const doc = new jsPDF();
  let y = 14;

  const line = (text: string, bold = false) => {
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.text(text, 14, y);
    y += 6;
  };

  line('Portfolio Dashboard Export', true);
  y += 2;
  line(`Active Count: ${payload.kpis.active_count}`, true);
  line(`On Track: ${payload.kpis.on_track_count}`);
  line(`Watch/Act: ${payload.kpis.watch_act_count}`);
  line(`Overdue Milestone Projects: ${payload.kpis.overdue_milestone_project_count}`);
  line(`High Open RAID: ${payload.kpis.high_open_raid_count}`);
  line(`Technology Council: ${payload.kpis.technology_council_count}`);
  y += 4;

  line('Projects', true);
  for (const p of payload.list) {
    line(`  ${p.id} | ${p.project_code ?? ''} | ${p.name}`);
  }
  y += 4;

  line('Overdue Milestone IDs', true);
  for (const row of payload.drilldowns.overdue_milestones as Record<string, unknown>[]) {
    line(`  project=${rowField(row, 'project_id')} milestone=${rowField(row, 'milestone_id')}`);
  }
  y += 2;

  line('High RAID IDs', true);
  for (const row of payload.drilldowns.high_raid as Record<string, unknown>[]) {
    line(`  id=${rowField(row, 'id')} project=${rowField(row, 'project_id')}`);
  }
  y += 2;

  line('Technology Council IDs', true);
  for (const row of payload.drilldowns.technology_council as Record<string, unknown>[]) {
    line(`  id=${rowField(row, 'id')} project=${rowField(row, 'project_id')}`);
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export const PORTFOLIO_EXPORT_CONTENT_TYPE = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
} as const;

export const PORTFOLIO_EXPORT_FILENAME = {
  xlsx: 'portfolio-dashboard.xlsx',
  pdf: 'portfolio-dashboard.pdf',
} as const;
