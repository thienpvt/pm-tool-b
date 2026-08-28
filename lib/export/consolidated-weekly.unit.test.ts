import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { ExportPreviewSection } from '@/modules/weekly/backend/services/weekly-tracking.service';
import {
  generateConsolidatedDocx,
  generateConsolidatedPptx,
  generateConsolidatedWeekly,
  generateConsolidatedXlsx,
  sanitizeConsolidatedFilename,
  type ConsolidatedWeeklyPayload,
} from './consolidated-weekly';

const D08_LABELS = [
  'Project Code',
  'Project Name',
  'PM',
  'Stage',
  'Prior Week RAG',
  'This Week RAG',
  'Progress',
  'Highlights',
  'Next Week Goals',
  'Nearest Milestone',
  'RAID',
  'Technology Issues',
];

function buildFixture(overrides: Partial<ConsolidatedWeeklyPayload> = {}): ConsolidatedWeeklyPayload {
  const section: ExportPreviewSection = {
    project_id: 100,
    report_id: 10,
    latest_version: 2,
    project_code: 'A-001',
    name: 'Alpha Project',
    pm_display_name: 'Primary PM',
    stage: 'L3',
    prev_week_rag: 'Green',
    this_week_rag: 'Amber',
    progress_pct: 42,
    highlights: 'Shipped milestone one',
    next_week_goals: 'Start integration',
    nearest_milestone: 'Gate review',
    raid_counts: { risks: 1, issues: 2 },
    tech_issue_counts: 1,
    raid: {
      risks: [{ risk_id: 'R-1', description: 'Schedule risk', status: 'Open' }],
      issues: [
        { issue_id: 'I-1', description: 'Tech council item', technology_council: true },
        { issue_id: 'I-2', description: 'Plain issue' },
      ],
    },
    tech_issues: [{ issue_id: 'I-1', description: 'Tech council item', technology_council: true }],
  };

  return {
    period: {
      id: 1,
      display_name: '2026-W01 | 2025-12-29 – 2026-01-04',
      iso_week: '2026-W01',
      due_at: '2026-01-03T18:00:00.000Z',
    },
    data_version: 2,
    sections: [section],
    ...overrides,
  };
}

async function sheetCellText(sheet: ExcelJS.Worksheet): Promise<string> {
  const parts: string[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      const v = cell.value;
      if (v != null) parts.push(String(v));
    });
  });
  return parts.join(' ');
}

async function unzipText(buf: Buffer, entryMatch: RegExp): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const chunks: string[] = [];
  for (const [name, file] of Object.entries(zip.files)) {
    if (!file.dir && entryMatch.test(name)) {
      chunks.push(await file.async('string'));
    }
  }
  return chunks.join('\n');
}

describe('consolidated-weekly generators (D-07, D-08)', () => {
  it('generateConsolidatedXlsx returns a Buffer with Portfolio Summary and per-project sheets (D-07)', async () => {
    const buf = await generateConsolidatedXlsx(buildFixture());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.getWorksheet('Portfolio Summary')).toBeDefined();
    expect(wb.getWorksheet('A-001')).toBeDefined();
  });

  it('xlsx project sheets include D-08 field labels via ExcelJS read-back (D-08, CPMO-04)', async () => {
    const buf = await generateConsolidatedXlsx(buildFixture());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('A-001')!;
    const text = await sheetCellText(sheet);
    for (const label of D08_LABELS) {
      expect(text).toContain(label);
    }
    expect(text).toContain('Schedule risk');
    expect(text).toContain('Tech council item');
  });

  it('generateConsolidatedDocx returns a Buffer with D-08 headings in document.xml (D-08)', async () => {
    const buf = await generateConsolidatedDocx(buildFixture());
    expect(Buffer.isBuffer(buf)).toBe(true);
    const xml = await unzipText(buf, /word\/(document|header|footer).*\.xml$/);
    for (const label of D08_LABELS) {
      expect(xml).toContain(label);
    }
    expect(xml).toContain('2026-W01 | 2025-12-29 – 2026-01-04');
    expect(xml).toContain('Alpha Project');
  });

  it('generateConsolidatedPptx returns a Buffer with D-08 headings in slide XML (D-08)', async () => {
    const buf = await generateConsolidatedPptx(buildFixture());
    expect(Buffer.isBuffer(buf)).toBe(true);
    const xml = await unzipText(buf, /ppt\/slides\/slide\d+\.xml$/);
    for (const label of D08_LABELS) {
      expect(xml).toContain(label);
    }
    expect(xml).toContain('Alpha Project');
  });

  it('partial snapshot (missing highlights and raid) still returns a Buffer (D-08)', async () => {
    const partial: ExportPreviewSection = {
      ...buildFixture().sections[0],
      highlights: null,
      next_week_goals: null,
      raid: { risks: [], issues: [] },
      tech_issues: [],
      raid_counts: { risks: 0, issues: 0 },
      tech_issue_counts: 0,
    };
    const payload = buildFixture({ sections: [partial], data_version: 1 });

    const xlsx = await generateConsolidatedXlsx(payload);
    const docx = await generateConsolidatedDocx(payload);
    const pptx = await generateConsolidatedPptx(payload);

    expect(Buffer.isBuffer(xlsx)).toBe(true);
    expect(Buffer.isBuffer(docx)).toBe(true);
    expect(Buffer.isBuffer(pptx)).toBe(true);
  });

  it('generateConsolidatedWeekly dispatches xlsx, docx, and pptx (D-07)', async () => {
    const payload = buildFixture();
    for (const format of ['xlsx', 'docx', 'pptx'] as const) {
      const buf = await generateConsolidatedWeekly(payload, format);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
    }
  });

  it('generator module has no repository imports (D-01)', () => {
    const src = readFileSync(resolve(__dirname, 'consolidated-weekly.ts'), 'utf8');
    expect(src).not.toMatch(/@\/lib\/repositories\//);
    expect(src).not.toMatch(/getWeeklyProjectReport/);
    expect(src).not.toMatch(/generateProjectPlan/);
  });

  it('strips control characters from download filenames (WR-01)', () => {
    expect(sanitizeConsolidatedFilename('2026-W01 |\r\nfoo', 'xlsx')).toBe(
      '2026-W01 ___foo consolidated.xlsx',
    );
  });
});
