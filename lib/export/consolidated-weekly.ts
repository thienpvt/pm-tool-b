import ExcelJS from 'exceljs';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from 'docx';
import PptxGenJS from 'pptxgenjs';
import type { ExportPreviewSection } from '@/lib/services/weekly-tracking.service';

export type ConsolidatedWeeklyPayload = {
  period: {
    id: number;
    display_name: string;
    iso_week: string;
    due_at: string;
  };
  data_version: number;
  sections: ExportPreviewSection[];
};

export type ConsolidatedExportFormat = 'xlsx' | 'docx' | 'pptx';

const NAV_COLOR = '1E293B';
const PHASE_BG = 'D6E4F0';
const PHASE_FONT = '1A3A5C';
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

function raidField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v == null ? '' : String(v);
}

function sanitizeSheetName(
  code: string | null,
  name: string,
  used: Set<string>,
): string {
  const raw = (code || name || 'Project').replace(/[\\/*?:\[\]]/g, '_').trim();
  let base = raw.slice(0, 31) || 'Project';
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = `_${n}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

export function sanitizeConsolidatedFilename(displayName: string, ext: string): string {
  const safe = displayName
    .replace(/[\u0000-\u001F\u007F]/g, '_')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim() || 'consolidated';
  const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'xlsx';
  return `${safe} consolidated.${safeExt}`;
}

export const CONTENT_TYPE_BY_FORMAT: Record<ConsolidatedExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function buildPortfolioSummarySheet(wb: ExcelJS.Workbook, payload: ConsolidatedWeeklyPayload) {
  const ws = wb.addWorksheet('Portfolio Summary');
  sectionTitle(ws, `CONSOLIDATED WEEKLY — ${payload.period.display_name}`, 4);
  ws.addRow([]);
  labelValueRow(ws, 'ISO Week', payload.period.iso_week);
  labelValueRow(ws, 'Due At', payload.period.due_at);
  labelValueRow(ws, 'Data Version', payload.data_version);
  labelValueRow(ws, 'Project Count', payload.sections.length);
  ws.addRow([]);
  navHeader(
    ws,
    ['Project Code', 'Project Name', 'PM', 'Stage', 'Prior Week RAG', 'This Week RAG', 'Progress'],
    [14, 28, 20, 10, 14, 14, 10],
  );
  for (const s of payload.sections) {
    const row = ws.addRow([
      s.project_code ?? '',
      s.name,
      s.pm_display_name ?? '',
      s.stage ?? '',
      s.prev_week_rag ?? '',
      s.this_week_rag ?? '',
      s.progress_pct != null ? `${s.progress_pct}%` : '',
    ]);
    row.eachCell((cell) => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
    });
  }
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 28;
}

function buildProjectSheet(ws: ExcelJS.Worksheet, section: ExportPreviewSection) {
  const colCount = 6;
  sectionTitle(ws, section.name, colCount);
  ws.addRow([]);
  labelValueRow(ws, 'Project Code', section.project_code);
  labelValueRow(ws, 'Project Name', section.name);
  labelValueRow(ws, 'PM', section.pm_display_name);
  labelValueRow(ws, 'Stage', section.stage);
  labelValueRow(ws, 'Prior Week RAG', section.prev_week_rag);
  labelValueRow(ws, 'This Week RAG', section.this_week_rag);
  labelValueRow(ws, 'Progress', section.progress_pct != null ? `${section.progress_pct}%` : null);
  labelValueRow(ws, 'Highlights', section.highlights);
  labelValueRow(ws, 'Next Week Goals', section.next_week_goals);
  labelValueRow(ws, 'Nearest Milestone', section.nearest_milestone);
  ws.addRow([]);

  sectionTitle(ws, 'RAID', colCount);
  navHeader(ws, ['Type', 'ID', 'Description', 'Owner', 'Status', 'Due Date'], [10, 10, 36, 18, 14, 12]);
  for (const risk of section.raid.risks) {
    const r = risk as Record<string, unknown>;
    const row = ws.addRow([
      'Risk',
      raidField(r, 'risk_id') || raidField(r, 'id'),
      raidField(r, 'description'),
      raidField(r, 'owner'),
      raidField(r, 'status'),
      raidField(r, 'due_date'),
    ]);
    row.eachCell((cell) => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
    });
  }
  for (const issue of section.raid.issues) {
    const i = issue as Record<string, unknown>;
    const row = ws.addRow([
      'Issue',
      raidField(i, 'issue_id') || raidField(i, 'id'),
      raidField(i, 'description'),
      raidField(i, 'owner'),
      raidField(i, 'status'),
      raidField(i, 'due_date'),
    ]);
    row.eachCell((cell) => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
    });
  }

  ws.addRow([]);
  sectionTitle(ws, 'Technology Issues', colCount);
  navHeader(ws, ['ID', 'Description', 'Owner', 'Status', 'Due Date'], [10, 40, 18, 14, 12]);
  for (const issue of section.tech_issues) {
    const i = issue as Record<string, unknown>;
    const row = ws.addRow([
      raidField(i, 'issue_id') || raidField(i, 'id'),
      raidField(i, 'description'),
      raidField(i, 'owner'),
      raidField(i, 'status'),
      raidField(i, 'due_date'),
    ]);
    row.eachCell((cell) => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: thinBorder('E2E8F0'), right: thinBorder('E2E8F0') };
    });
  }

  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 40;
}

export async function generateConsolidatedXlsx(payload: ConsolidatedWeeklyPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PM Tool';
  wb.created = new Date();

  buildPortfolioSummarySheet(wb, payload);

  const usedNames = new Set<string>(['Portfolio Summary']);
  for (const section of payload.sections) {
    const sheetName = sanitizeSheetName(section.project_code, section.name, usedNames);
    const ws = wb.addWorksheet(sheetName);
    buildProjectSheet(ws, section);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function docHeading1(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' } },
  });
}

function docHeading2(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
  });
}

function docKeyValue(key: string, value: string | number | null) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${key}: `, bold: true, size: 22 }),
      new TextRun({ text: value == null || value === '' ? '—' : String(value), size: 22 }),
    ],
    spacing: { after: 80 },
  });
}

function docTableRow(cells: string[], isHeader = false) {
  return new TableRow({
    children: cells.map(
      (c) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: c,
                  bold: isHeader,
                  size: isHeader ? 20 : 18,
                  color: isHeader ? 'FFFFFF' : '000000',
                }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
          shading: isHeader
            ? { type: ShadingType.SOLID, color: '1E293B', fill: '1E293B' }
            : undefined,
        }),
    ),
  });
}

function docRaidTable(title: string, headers: string[], rows: string[][]) {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 24 })],
      spacing: { before: 120, after: 80 },
    }),
  ];
  if (rows.length === 0) {
    children.push(docKeyValue(title, '—'));
    return children;
  }
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [docTableRow(headers, true), ...rows.map((r) => docTableRow(r))],
    }),
  );
  return children;
}

function buildDocxSectionChildren(section: ExportPreviewSection): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [
    docHeading2(section.name),
    docKeyValue('Project Code', section.project_code),
    docKeyValue('Project Name', section.name),
    docKeyValue('PM', section.pm_display_name),
    docKeyValue('Stage', section.stage),
    docKeyValue('Prior Week RAG', section.prev_week_rag),
    docKeyValue('This Week RAG', section.this_week_rag),
    docKeyValue('Progress', section.progress_pct != null ? `${section.progress_pct}%` : null),
    docKeyValue('Highlights', section.highlights),
    docKeyValue('Next Week Goals', section.next_week_goals),
    docKeyValue('Nearest Milestone', section.nearest_milestone),
  ];

  const riskRows = section.raid.risks.map((risk) => {
    const r = risk as Record<string, unknown>;
    return [
      raidField(r, 'risk_id') || raidField(r, 'id'),
      raidField(r, 'description'),
      raidField(r, 'owner'),
      raidField(r, 'status'),
      raidField(r, 'due_date'),
    ];
  });
  children.push(
    ...docRaidTable('RAID — Risks', ['ID', 'Description', 'Owner', 'Status', 'Due Date'], riskRows),
  );

  const issueRows = section.raid.issues.map((issue) => {
    const i = issue as Record<string, unknown>;
    return [
      raidField(i, 'issue_id') || raidField(i, 'id'),
      raidField(i, 'description'),
      raidField(i, 'owner'),
      raidField(i, 'status'),
      raidField(i, 'due_date'),
    ];
  });
  children.push(
    ...docRaidTable('RAID — Issues', ['ID', 'Description', 'Owner', 'Status', 'Due Date'], issueRows),
  );

  const techRows = section.tech_issues.map((issue) => {
    const i = issue as Record<string, unknown>;
    return [
      raidField(i, 'issue_id') || raidField(i, 'id'),
      raidField(i, 'description'),
      raidField(i, 'owner'),
      raidField(i, 'status'),
      raidField(i, 'due_date'),
    ];
  });
  children.push(
    ...docRaidTable(
      'Technology Issues',
      ['ID', 'Description', 'Owner', 'Status', 'Due Date'],
      techRows,
    ),
  );

  return children;
}

export async function generateConsolidatedDocx(payload: ConsolidatedWeeklyPayload): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    docHeading1(payload.period.display_name),
    docKeyValue('Data Version', payload.data_version),
    docKeyValue('Project Count', payload.sections.length),
  ];

  for (const section of payload.sections) {
    children.push(...buildDocxSectionChildren(section));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  });

  return Packer.toBuffer(doc);
}

const PPT_PRIMARY = '1677FF';
const PPT_MID = '475569';
const PPT_W = 10;
const PPT_H = 7.5;

function pptSlideTitle(slide: PptxGenJS.Slide, title: string) {
  slide.addShape('rect', { x: 0, y: 0, w: PPT_W, h: 0.52, fill: { color: PPT_PRIMARY } });
  slide.addText(title.toUpperCase(), {
    x: 0.35,
    y: 0,
    w: PPT_W - 0.7,
    h: 0.52,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    valign: 'middle',
  });
}

function pptBodyLines(slide: PptxGenJS.Slide, lines: string[], y = 0.7) {
  const bullets = lines.map((line) => ({
    text: line,
    options: { bullet: { type: 'bullet' as const }, paraSpaceAfter: 4, fontSize: 11, color: PPT_MID },
  }));
  slide.addText(bullets.length ? bullets : [{ text: '—', options: { fontSize: 11, color: PPT_MID } }], {
    x: 0.4,
    y,
    w: PPT_W - 0.8,
    h: PPT_H - y - 0.5,
    valign: 'top',
  });
}

function pptRaidTable(slide: PptxGenJS.Slide, title: string, headers: string[], rows: string[][], y: number) {
  slide.addText(title, {
    x: 0.4,
    y,
    w: PPT_W - 0.8,
    h: 0.35,
    fontSize: 12,
    bold: true,
    color: PPT_MID,
  });
  const tableRows: PptxGenJS.TableRow[] = [
    headers.map((h) => ({
      text: h,
      options: { bold: true, color: 'FFFFFF', fill: { color: PPT_PRIMARY }, fontSize: 9 },
    })),
    ...rows.map((row) =>
      row.map((cell) => ({ text: cell || '—', options: { fontSize: 9, color: PPT_MID } })),
    ),
  ];
  slide.addTable(tableRows, {
    x: 0.4,
    y: y + 0.4,
    w: PPT_W - 0.8,
    colW: headers.map(() => (PPT_W - 0.8) / headers.length),
    fontSize: 9,
    border: { type: 'solid', color: 'CBD5E1', pt: 0.5 },
  });
}

function addProjectPptSlides(pptx: PptxGenJS, section: ExportPreviewSection) {
  const summarySlide = pptx.addSlide();
  pptSlideTitle(summarySlide, section.name);
  pptBodyLines(summarySlide, [
    `Project Code: ${section.project_code ?? '—'}`,
    `Project Name: ${section.name}`,
    `PM: ${section.pm_display_name ?? '—'}`,
    `Stage: ${section.stage ?? '—'}`,
    `Prior Week RAG: ${section.prev_week_rag ?? '—'}`,
    `This Week RAG: ${section.this_week_rag ?? '—'}`,
    `Progress: ${section.progress_pct != null ? `${section.progress_pct}%` : '—'}`,
    `Highlights: ${section.highlights ?? '—'}`,
    `Next Week Goals: ${section.next_week_goals ?? '—'}`,
    `Nearest Milestone: ${section.nearest_milestone ?? '—'}`,
  ]);

  const riskRows = section.raid.risks.map((risk) => {
    const r = risk as Record<string, unknown>;
    return [
      raidField(r, 'risk_id') || raidField(r, 'id'),
      raidField(r, 'description'),
      raidField(r, 'owner'),
      raidField(r, 'status'),
      raidField(r, 'due_date'),
    ];
  });
  const riskSlide = pptx.addSlide();
  pptSlideTitle(riskSlide, `${section.name} — RAID`);
  if (riskRows.length === 0) {
    pptBodyLines(riskSlide, ['RAID — Risks: —']);
  } else {
    pptRaidTable(riskSlide, 'RAID — Risks', ['ID', 'Description', 'Owner', 'Status', 'Due Date'], riskRows, 0.7);
  }

  const issueRows = section.raid.issues.map((issue) => {
    const i = issue as Record<string, unknown>;
    return [
      raidField(i, 'issue_id') || raidField(i, 'id'),
      raidField(i, 'description'),
      raidField(i, 'owner'),
      raidField(i, 'status'),
      raidField(i, 'due_date'),
    ];
  });
  const issueSlide = pptx.addSlide();
  pptSlideTitle(issueSlide, `${section.name} — RAID Issues`);
  if (issueRows.length === 0) {
    pptBodyLines(issueSlide, ['RAID — Issues: —']);
  } else {
    pptRaidTable(
      issueSlide,
      'RAID — Issues',
      ['ID', 'Description', 'Owner', 'Status', 'Due Date'],
      issueRows,
      0.7,
    );
  }

  const techRows = section.tech_issues.map((issue) => {
    const i = issue as Record<string, unknown>;
    return [
      raidField(i, 'issue_id') || raidField(i, 'id'),
      raidField(i, 'description'),
      raidField(i, 'owner'),
      raidField(i, 'status'),
      raidField(i, 'due_date'),
    ];
  });
  const techSlide = pptx.addSlide();
  pptSlideTitle(techSlide, `${section.name} — Technology Issues`);
  if (techRows.length === 0) {
    pptBodyLines(techSlide, ['Technology Issues: —']);
  } else {
    pptRaidTable(
      techSlide,
      'Technology Issues',
      ['ID', 'Description', 'Owner', 'Status', 'Due Date'],
      techRows,
      0.7,
    );
  }
}

export async function generateConsolidatedPptx(payload: ConsolidatedWeeklyPayload): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  const cover = pptx.addSlide();
  cover.addShape('rect', { x: 0, y: 0, w: PPT_W, h: PPT_H, fill: { color: PPT_PRIMARY } });
  cover.addText(payload.period.display_name, {
    x: 0.5,
    y: 2,
    w: PPT_W - 1,
    h: 1.2,
    fontSize: 28,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
  });
  cover.addText(
    `Projects: ${payload.sections.length}  |  Data Version: ${payload.data_version}`,
    {
      x: 0.5,
      y: 3.4,
      w: PPT_W - 1,
      h: 0.6,
      fontSize: 14,
      color: 'BFDBFE',
      align: 'center',
    },
  );

  for (const section of payload.sections) {
    addProjectPptSlides(pptx, section);
  }

  const buf = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  return Buffer.from(buf);
}

export async function generateConsolidatedWeekly(
  payload: ConsolidatedWeeklyPayload,
  format: ConsolidatedExportFormat,
): Promise<Buffer> {
  switch (format) {
    case 'xlsx':
      return generateConsolidatedXlsx(payload);
    case 'docx':
      return generateConsolidatedDocx(payload);
    case 'pptx':
      return generateConsolidatedPptx(payload);
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported format: ${_exhaustive}`);
    }
  }
}
