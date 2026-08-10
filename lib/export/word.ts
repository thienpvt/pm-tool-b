import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType,
} from 'docx';
import { getDocumentForExport } from '@/lib/repositories/documents.repo';
import { getProject } from '@/lib/repositories/projects.repo';
import type { AccessActor } from '@/lib/services/access';
import { assertProjectAccess } from '@/lib/services/access';

function heading1(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' } },
  });
}

function heading2(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
  });
}

function body(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 120 },
  });
}

function keyValue(key: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${key}: `, bold: true, size: 22 }),
      new TextRun({ text: value || '—', size: 22 }),
    ],
    spacing: { after: 80 },
  });
}

function tableRow(cells: string[], isHeader = false) {
  return new TableRow({
    children: cells.map(c => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: c, bold: isHeader, size: isHeader ? 20 : 18, color: isHeader ? 'FFFFFF' : '000000' })],
        alignment: AlignmentType.LEFT,
      })],
      shading: isHeader ? { type: ShadingType.SOLID, color: '1E293B', fill: '1E293B' } : undefined,
    })),
  });
}

function logoBlock(projectName: string) {
  return [
    new Paragraph({
      children: [new TextRun({ text: 'PROJECT MANAGEMENT OFFICE', bold: true, size: 36, color: '1E40AF' })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Project Management Office', size: 22, color: '64748B' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: projectName, bold: true, size: 48, color: '0F172A' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ];
}

export async function generateWordDoc(
  projectId: number,
  actor: AccessActor,
  docType: string,
  docId?: number,
): Promise<Buffer> {
  await assertProjectAccess(projectId, actor);

  const project = await getProject(projectId) as Record<string, string>;
  const docRow = await getDocumentForExport(projectId, docType, docId) as {
    content_json: string; title?: string;
  } | undefined;
  const content = docRow ? JSON.parse(docRow.content_json) : {};

  const docTitle: Record<string, string> = {
    project_charter: 'Project Charter',
    sow: 'Statement of Work (SoW)',
    pmp: 'Project Management Plan',
    status_report: 'Weekly Status Report',
    change_request: 'Change Request',
    closure_report: 'Project Closure Report',
  };

  const sections: Paragraph[] = [
    ...logoBlock(`${docTitle[docType] ?? docType}\n${project.name}`),
    new Paragraph({
      children: [new TextRun({ text: `Client: ${project.client ?? '—'}    |    PM: ${project.pm_name ?? '—'}    |    ${project.start_date ?? ''} → ${project.end_date ?? ''}`, size: 20, color: '64748B' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({ text: '', spacing: { after: 200 } }),
  ];

  if (docType === 'project_charter') {
    sections.push(
      heading1('1. Project Objectives'),
      body(content.objectives || ''),
      heading1('2. Project Scope'),
      heading2('In Scope'),
      body(content.scope || ''),
      heading2('Out of Scope'),
      body(content.out_of_scope || ''),
      heading1('3. Key Stakeholders'),
      body(content.key_stakeholders || ''),
      heading1('4. Budget'),
      body(content.budget || ''),
      heading1('5. Success Criteria'),
      body(content.success_criteria || ''),
      heading1('6. Assumptions & Constraints'),
      body(content.assumptions || ''),
    );
  } else if (docType === 'sow') {
    sections.push(
      heading1('1. Project Overview'),
      body(content.project_overview || ''),
      heading1('2. Solution Proposal'),
      body(content.solution_proposal || ''),
      heading1('3. Implementation Methodology'),
      body(content.methodology || ''),
      heading1('4. High-Level Milestones'),
      body(content.milestones || ''),
      heading1('5. Commercial Terms'),
      body(content.payment_terms || ''),
      heading1('6. Assumptions & Dependencies'),
      body(content.dependencies || ''),
    );
  } else if (docType === 'status_report') {
    const reportTitle = docRow?.title ?? '';
    sections.push(
      new Paragraph({ children: [new TextRun({ text: reportTitle || 'Weekly Status Report', bold: true, size: 26 })], spacing: { after: 120 } }),
      new Paragraph({ children: [new TextRun({ text: `Overall Status: ${content.overall_status || '—'}`, bold: true, size: 24, color: '1E40AF' })], spacing: { after: 300 } }),
      heading1('Completed This Week'),
      body(content.completed_this_week || ''),
      heading1('Plan for Next Week'),
      body(content.plan_next_week || ''),
      heading1('Key Risks & Issues'),
      body(content.risks_issues || ''),
      heading1('Decisions Needed'),
      body(content.decisions_needed || ''),
    );
  } else if (docType === 'change_request') {
    sections.push(
      keyValue('CR ID', content.cr_id || ''),
      keyValue('Change Title', content.cr_title || ''),
      heading1('Description of Change'),
      body(content.description || ''),
      heading1('Justification / Business Need'),
      body(content.justification || ''),
      heading1('Impact Assessment'),
      keyValue('Impact on Scope', content.impact_scope || ''),
      keyValue('Impact on Timeline', content.impact_timeline || ''),
      keyValue('Impact on Budget', content.impact_budget || ''),
      heading1('Recommendation'),
      body(content.recommendation || ''),
      heading1('Approval'),
      body('Approved by: ___________________________    Date: _______________'),
    );
  } else if (docType === 'closure_report') {
    sections.push(
      heading1('1. Executive Summary'),
      body(content.executive_summary || ''),
      heading1('2. Objectives: Planned vs Achieved'),
      body(content.objectives_achieved || ''),
      heading1('3. Key Achievements'),
      body(content.key_achievements || ''),
      heading1('4. Lessons Learned'),
      body(content.lessons_learned || ''),
      heading1('5. Benefit Validation & Criteria'),
      body(content.benefit_validation || ''),
      heading1('6. Recommendations for Future Projects'),
      body(content.recommendations || ''),
    );
  } else if (docType === 'pmp') {
    sections.push(
      heading1('1. Change Management Process'),
      body(content.change_management || ''),
      heading1('2. Quality Assurance Plan'),
      body(content.quality_plan || ''),
      heading1('3. Rollout & Data Migration Strategy'),
      body(content.rollout_strategy || ''),
      heading1('4. Project Governance'),
      body(content.governance || ''),
    );
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }],
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
  });

  const buf = await Packer.toBuffer(doc);
  return buf;
}
