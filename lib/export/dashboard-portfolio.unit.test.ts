import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  generatePortfolioDashboardPdf,
  generatePortfolioDashboardXlsx,
  type PortfolioDashboardExportPayload,
} from './dashboard-portfolio';

function buildFixture(): PortfolioDashboardExportPayload {
  return {
    filters: { stage: 'L2' },
    kpis: {
      active_count: 2,
      on_track_count: 1,
      watch_act_count: 1,
      overdue_milestone_project_count: 1,
      high_open_raid_count: 2,
      technology_council_count: 1,
    },
    list: [
      {
        id: 10,
        name: 'Alpha',
        project_code: 'A-01',
        portfolio_year: 2026,
        customer_id: 1,
        program_name: 'Prog A',
        stage: 'L2',
        status: 'Active',
        rag: 'Green',
        classification: 'Strategic',
        weekly_report_enabled: true,
        progress_pct: 40,
        pm_user_id: 7,
        pm_name: 'Pat PM',
      },
      {
        id: 11,
        name: 'Beta',
        project_code: 'B-01',
        portfolio_year: 2026,
        customer_id: 2,
        program_name: 'Prog B',
        stage: 'L3',
        status: 'Active',
        rag: 'Amber',
        classification: 'Run',
        weekly_report_enabled: false,
        progress_pct: 60,
        pm_user_id: null,
        pm_name: null,
      },
    ],
    drilldowns: {
      overdue_milestones: [{ project_id: 10, milestone_id: 1, name: 'M1' }],
      high_raid: [
        { id: 1, project_id: 10, entity_type: 'risk' },
        { id: 2, project_id: 11, entity_type: 'issue' },
      ],
      technology_council: [{ id: 5, project_id: 10 }],
    },
  };
}

async function sheetNames(buffer: Buffer): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets.map((ws) => ws.name);
}

async function sheetCellText(buffer: Buffer, sheetName: string): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet(sheetName);
  if (!sheet) return '';
  const parts: string[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value != null) parts.push(String(cell.value));
    });
  });
  return parts.join(' ');
}

describe('generatePortfolioDashboardXlsx', () => {
  it('returns a non-empty buffer with required sheet names (D-08, PDSH-06)', async () => {
    const buffer = await generatePortfolioDashboardXlsx(buildFixture());
    expect(buffer.length).toBeGreaterThan(0);

    const names = await sheetNames(buffer);
    expect(names).toEqual([
      'KPIs',
      'Projects',
      'Overdue Milestones',
      'High RAID',
      'Technology Council',
    ]);
  });

  it('includes active_count and filtered project ids (D-08)', async () => {
    const buffer = await generatePortfolioDashboardXlsx(buildFixture());
    const kpiText = await sheetCellText(buffer, 'KPIs');
    expect(kpiText).toContain('2');
    expect(kpiText).toMatch(/active/i);

    const projectText = await sheetCellText(buffer, 'Projects');
    expect(projectText).toContain('10');
    expect(projectText).toContain('11');
    expect(projectText).toContain('Alpha');
  });
});

describe('generatePortfolioDashboardPdf', () => {
  it('returns a buffer whose first bytes are %PDF (D-08, PDSH-06)', async () => {
    const buffer = await generatePortfolioDashboardPdf(buildFixture());
    expect(buffer.length).toBeGreaterThan(4);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });

  it('includes KPI numbers and project ids (D-08)', async () => {
    const buffer = await generatePortfolioDashboardPdf(buildFixture());
    const text = buffer.toString('latin1');
    expect(text).toContain('2');
    expect(text).toContain('10');
    expect(text).toContain('11');
  });
});
