import PptxGenJS from 'pptxgenjs';
import { listActivities } from '@/lib/repositories/activities.repo';
import { getDocumentForExport } from '@/lib/repositories/documents.repo';
import { listMeetings } from '@/lib/repositories/meetings.repo';
import { getProject } from '@/lib/repositories/projects.repo';
import { listRisks } from '@/lib/repositories/risks.repo';
import { listTeam } from '@/lib/repositories/team.repo';
import type { AccessActor } from '@/lib/services/access';
import { assertProjectAccess } from '@/lib/services/access';
import { NotFoundError } from '@/lib/services/errors';

// ─── Design tokens ────────────────────────────────────────────────────────────
const PRIMARY   = '1677FF';   // blue
const ACCENT    = '13C2C2';   // teal
const DARK      = '0A1628';   // near-black
const MID       = '475569';   // slate-600
const LIGHT_BG  = 'F0F6FF';   // very light blue
const WHITE     = 'FFFFFF';
const FOOTER_TXT = 'Confidential';

// ─── Layout helpers ───────────────────────────────────────────────────────────
const W = 10;   // slide width (inches)
const H = 7.5;  // slide height (inches)

function addSlideFooter(slide: PptxGenJS.Slide, slideNum: number, total: number) {
  // Full-width footer bar
  slide.addShape('rect', {
    x: 0, y: H - 0.38, w: W, h: 0.38,
    fill: { color: PRIMARY },
  });
  // Footer text left
  slide.addText(FOOTER_TXT, {
    x: 0.2, y: H - 0.36, w: 6, h: 0.32,
    fontSize: 8, color: WHITE, bold: false, valign: 'middle',
  });
  // Slide number right
  slide.addText(`${slideNum} / ${total}`, {
    x: W - 1.2, y: H - 0.36, w: 1, h: 0.32,
    fontSize: 8, color: WHITE, align: 'right', valign: 'middle',
  });
}

function slideTitle(slide: PptxGenJS.Slide, title: string) {
  // Blue accent bar at top
  slide.addShape('rect', { x: 0, y: 0, w: W, h: 0.52, fill: { color: PRIMARY } });
  slide.addText(title.toUpperCase(), {
    x: 0.35, y: 0, w: W - 0.7, h: 0.52,
    fontSize: 14, bold: true, color: WHITE, valign: 'middle',
  });
}

function bodyText(slide: PptxGenJS.Slide, text: string, opts: Partial<PptxGenJS.TextPropsOptions> = {}) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => ({ text: l, options: { bullet: { type: 'bullet' as const }, paraSpaceAfter: 4 } }));

  slide.addText(lines.length ? lines : [{ text: '—', options: {} }], {
    x: 0.4, y: 0.7, w: W - 0.8, h: H - 1.3,
    fontSize: 11, color: MID, valign: 'top', ...opts,
  });
}

type TableRow = PptxGenJS.TableRow;

function headerCell(text: string): PptxGenJS.TableCell {
  return {
    text,
    options: {
      bold: true,
      color: WHITE,
      fill: { color: PRIMARY },
      align: 'center',
      valign: 'middle',
      fontSize: 9,
    },
  };
}

function dataCell(text: string, opts: Partial<PptxGenJS.TableCellProps> = {}): PptxGenJS.TableCell {
  return {
    text: text || '—',
    options: { fontSize: 9, color: DARK, valign: 'middle', ...opts },
  };
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateKickoffPPT(
  projectId: number,
  actor: AccessActor,
  extras: {
    presentation_date?: string;
    methodology?: string;
    next_steps?: string;
    agenda?: string;
  } = {}
): Promise<Buffer> {
  await assertProjectAccess(projectId, actor);

  const project = await getProject(projectId) as Record<string, string> | undefined;
  if (!project) throw new NotFoundError('Project not found', 'project');

  const [team, meetings, risks, activities, charter] = await Promise.all([
    listTeam(projectId) as Promise<Record<string, string>[]>,
    listMeetings(projectId) as Promise<Record<string, string>[]>,
    listRisks(projectId) as Promise<Record<string, string>[]>,
    listActivities(projectId) as Promise<Record<string, string>[]>,
    getDocumentForExport(projectId, 'project_charter') as Promise<Record<string, string> | undefined>,
  ]);

  const charterContent = charter ? JSON.parse(charter.content_json || '{}') : {};

  const TOTAL = 10;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 — override with defineLayout
  pptx.defineLayout({ name: 'STANDARD', width: W, height: H });
  pptx.layout = 'STANDARD';

  // ── Slide 1: Cover ──────────────────────────────────────────────────────────
  {
    const s = pptx.addSlide();
    // Full background gradient-like: top primary strip
    s.addShape('rect', { x: 0, y: 0, w: W, h: 3.2, fill: { color: PRIMARY } });
    s.addShape('rect', { x: 0, y: 3.2, w: W, h: H - 3.2, fill: { color: WHITE } });

    // Teal accent stripe
    s.addShape('rect', { x: 0, y: 3.1, w: W, h: 0.12, fill: { color: ACCENT } });

    s.addText('PROJECT MANAGEMENT OFFICE', {
      x: 0.5, y: 0.35, w: W - 1, h: 0.5,
      fontSize: 13, bold: true, color: 'DBEAFE', align: 'center',
    });

    // Project name
    s.addText(project.name, {
      x: 0.5, y: 1.0, w: W - 1, h: 1.6,
      fontSize: 32, bold: true, color: WHITE, align: 'center', valign: 'middle',
      charSpacing: 1,
    });

    // Kick-off label
    s.addText('PROJECT KICK-OFF PRESENTATION', {
      x: 0.5, y: 2.6, w: W - 1, h: 0.5,
      fontSize: 11, color: 'BFDBFE', align: 'center', bold: false,
    });

    // Info block
    const infoLines = [
      { text: `Client: ${project.client || '—'}`, options: { breakLine: true } },
      { text: `Project Manager: ${project.pm_name || '—'}`, options: { breakLine: true } },
      { text: `Period: ${project.start_date || '—'} → ${project.end_date || '—'}`, options: { breakLine: true } },
      { text: `Date: ${extras.presentation_date || new Date().toISOString().slice(0, 10)}`, options: {} },
    ] as PptxGenJS.TextProps[];

    s.addText(infoLines, {
      x: 2.5, y: 3.5, w: W - 5, h: 2.2,
      fontSize: 11, color: MID, align: 'center', valign: 'middle',
      lineSpacingMultiple: 1.4,
    });

    addSlideFooter(s, 1, TOTAL);
  }

  // ── Slide 2: Agenda ─────────────────────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, 'Agenda');

    const agendaItems = extras.agenda
      ? extras.agenda.split('\n').filter(Boolean)
      : [
          '1. Project Overview & Objectives',
          '2. Project Organization',
          '3. Implementation Methodology',
          '4. Project Schedule & Milestones',
          '5. Communication Plan',
          '6. Risk & Assumptions',
          '7. Next Steps & Action Items',
          '8. Q&A',
        ];

    const rows: TableRow[] = agendaItems.map((item, i) => [
      dataCell(String(i + 1), { align: 'center', bold: true, color: PRIMARY }),
      dataCell(item),
    ]);

    s.addTable(rows, {
      x: 1.5, y: 0.8, w: W - 3, h: H - 1.6,
      colW: [0.6, W - 4.1],
      border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
      rowH: 0.45,
      autoPage: false,
    });

    addSlideFooter(s, 2, TOTAL);
  }

  // ── Slide 3: Project Overview ───────────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, 'Project Overview');

    const objectives = charterContent.objectives || project.description || '(No objectives defined)';
    const scope      = charterContent.scope || '(No scope defined)';

    // Two panels side by side
    const panelH = H - 1.3;

    s.addShape('rect', { x: 0.3, y: 0.65, w: (W - 0.9) / 2, h: panelH, fill: { color: LIGHT_BG }, line: { color: 'CBD5E1', pt: 0.5 } });
    s.addShape('rect', { x: 0.3 + (W - 0.9) / 2 + 0.1, y: 0.65, w: (W - 0.9) / 2, h: panelH, fill: { color: 'FFF7ED' }, line: { color: 'FED7AA', pt: 0.5 } });

    s.addText('OBJECTIVES', { x: 0.45, y: 0.72, w: 4, h: 0.28, fontSize: 9, bold: true, color: PRIMARY });
    s.addText(objectives, {
      x: 0.45, y: 1.05, w: (W - 0.9) / 2 - 0.25, h: panelH - 0.55,
      fontSize: 10, color: DARK, valign: 'top', wrap: true,
    });

    const px2 = 0.3 + (W - 0.9) / 2 + 0.25;
    s.addText('SCOPE', { x: px2, y: 0.72, w: 4, h: 0.28, fontSize: 9, bold: true, color: '7C3AED' });
    s.addText(scope, {
      x: px2, y: 1.05, w: (W - 0.9) / 2 - 0.25, h: panelH - 0.55,
      fontSize: 10, color: DARK, valign: 'top', wrap: true,
    });

    addSlideFooter(s, 3, TOTAL);
  }

  // ── Slide 4: Project Organization ──────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, 'Project Organization');

    const headerRow: TableRow = [
      headerCell('Domain'),
      headerCell('Role'),
      headerCell('Name'),
    ];

    const dataRows: TableRow[] = team.slice(0, 20).map(m => [
      dataCell(m.domain),
      dataCell(m.role),
      dataCell(m.name),
    ]);

    if (dataRows.length === 0) {
      s.addText('No team members added yet.', { x: 0.5, y: 1, w: W - 1, h: 1, fontSize: 12, color: MID });
    } else {
      s.addTable([headerRow, ...dataRows], {
        x: 0.5, y: 0.7, w: W - 1, h: H - 1.3,
        colW: [2, 3.5, 3.5],
        border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
        rowH: Math.min(0.38, (H - 1.6) / (dataRows.length + 1)),
        autoPage: false,
      });
    }

    addSlideFooter(s, 4, TOTAL);
  }

  // ── Slide 5: Implementation Methodology ────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, 'Implementation Methodology');

    const methodology = extras.methodology || charterContent.methodology || `Our 4-phase delivery approach:

Phase 1 — Initiation: Project Charter, Core Team alignment, Kick-off
Phase 2 — Planning: SoW, Resource Plan, Risk Register, Communication Plan
Phase 3 — Execution & Monitoring: Delivery, Weekly Status Reports, Change Control
Phase 4 — Closing: UAT sign-off, Closure Report, Lessons Learned`;

    // Phase progression boxes
    const phases = ['Initiation', 'Planning', 'Execution', 'Closing'];
    const phaseColors = [PRIMARY, ACCENT, '7C3AED', '22C55E'];
    const boxW = (W - 1.2) / 4 - 0.1;
    phases.forEach((ph, i) => {
      const x = 0.5 + i * (boxW + 0.13);
      s.addShape('rect', { x, y: 0.65, w: boxW, h: 0.65, fill: { color: phaseColors[i] }, line: { color: phaseColors[i] } });
      s.addText(`${i + 1}. ${ph}`, { x, y: 0.65, w: boxW, h: 0.65, fontSize: 10, bold: true, color: WHITE, align: 'center', valign: 'middle' });
      // Arrow except last
      if (i < 3) s.addText('›', { x: x + boxW, y: 0.7, w: 0.15, h: 0.55, fontSize: 14, color: MID, align: 'center', valign: 'middle' });
    });

    // Methodology text
    s.addText(methodology, {
      x: 0.4, y: 1.45, w: W - 0.8, h: H - 2.1,
      fontSize: 10.5, color: MID, valign: 'top', wrap: true,
      lineSpacingMultiple: 1.3,
    });

    addSlideFooter(s, 5, TOTAL);
  }

  // ── Slide 6: Project Schedule ───────────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, 'Project Schedule & Milestones');

    // Pull key milestone activities (Done/deliverable or up to 10)
    const milestones = activities
      .filter(a => a.deliverable || a.plan_end)
      .slice(0, 12);

    if (milestones.length === 0) {
      s.addText('No activities added yet. Please fill the Project Timeline.', { x: 0.5, y: 1, w: W - 1, h: 1, fontSize: 12, color: MID });
    } else {
      const headerRow: TableRow = [
        headerCell('No'),
        headerCell('Phase'),
        headerCell('Activity / Milestone'),
        headerCell('Deliverable'),
        headerCell('Plan End'),
        headerCell('Status'),
      ];

      const dataRows: TableRow[] = milestones.map(a => [
        dataCell(a.no || '', { align: 'center' }),
        dataCell(a.phase),
        dataCell(a.activity),
        dataCell(a.deliverable),
        dataCell(a.plan_end),
        dataCell(a.status, {
          color: a.status === 'Done' ? '16A34A' : a.status === 'In Progress' ? 'D97706' : a.status === 'Blocked' ? 'DC2626' : MID,
          bold: true,
        }),
      ]);

      s.addTable([headerRow, ...dataRows], {
        x: 0.3, y: 0.65, w: W - 0.6, h: H - 1.2,
        colW: [0.5, 1.8, 2.8, 2.2, 1.1, 1.1],
        border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
        rowH: Math.min(0.38, (H - 1.5) / (dataRows.length + 1)),
        autoPage: false,
      });
    }

    addSlideFooter(s, 6, TOTAL);
  }

  // ── Slide 7: Communication Plan ─────────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, 'Communication Plan');

    if (meetings.length === 0) {
      s.addText('No meetings defined yet.', { x: 0.5, y: 1, w: W - 1, h: 1, fontSize: 12, color: MID });
    } else {
      const headerRow: TableRow = [
        headerCell('Meeting'),
        headerCell('Frequency'),
        headerCell('Participants'),
        headerCell('Method'),
      ];

      const dataRows: TableRow[] = meetings.slice(0, 10).map(m => [
        dataCell(m.name),
        dataCell(m.frequency),
        dataCell(m.participants),
        dataCell(m.method),
      ]);

      s.addTable([headerRow, ...dataRows], {
        x: 0.3, y: 0.65, w: W - 0.6, h: H - 1.2,
        colW: [3, 1.6, 3.2, 1.6],
        border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
        rowH: Math.min(0.4, (H - 1.5) / (dataRows.length + 1)),
        autoPage: false,
      });
    }

    addSlideFooter(s, 7, TOTAL);
  }

  // ── Slide 8: Risk & Assumptions ─────────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, 'Key Risks & Assumptions');

    if (risks.length === 0) {
      s.addText('No risks logged yet.', { x: 0.5, y: 1, w: W - 1, h: 1, fontSize: 12, color: MID });
    } else {
      const headerRow: TableRow = [
        headerCell('Risk ID'),
        headerCell('Description'),
        headerCell('Category'),
        headerCell('Mitigation Plan'),
        headerCell('Status'),
      ];

      const dataRows: TableRow[] = risks.slice(0, 10).map(r => {
        const statusColor = r.status === 'Mitigated' ? '16A34A' : r.status === 'Open' ? 'DC2626' : r.status === 'In Progress' ? 'D97706' : MID;
        return [
          dataCell(r.risk_id, { align: 'center' }),
          dataCell(r.description),
          dataCell(r.category),
          dataCell(r.mitigation),
          dataCell(r.status, { color: statusColor, bold: true }),
        ];
      });

      s.addTable([headerRow, ...dataRows], {
        x: 0.3, y: 0.65, w: W - 0.6, h: H - 1.2,
        colW: [0.8, 3, 1.5, 3, 1.1],
        border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
        rowH: Math.min(0.4, (H - 1.5) / (dataRows.length + 1)),
        autoPage: false,
      });
    }

    addSlideFooter(s, 8, TOTAL);
  }

  // ── Slide 9: Next Steps ──────────────────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, 'Next Steps & Action Items');

    const nextSteps = extras.next_steps || `• Distribute Project Charter to all stakeholders for sign-off
• Finalize project team onboarding and access provisioning
• Conduct first Weekly Status Meeting (${meetings[0]?.frequency || 'Weekly'})
• Begin Phase 1 deliverables per Project Timeline
• Set up communication channels and reporting cadence`;

    bodyText(s, nextSteps, { fontSize: 12, lineSpacingMultiple: 1.5 });

    addSlideFooter(s, 9, TOTAL);
  }

  // ── Slide 10: Q&A / Thank You ───────────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: PRIMARY } });
    s.addShape('rect', { x: 0, y: H * 0.55, w: W, h: H * 0.45, fill: { color: DARK } });
    s.addShape('rect', { x: 0, y: H * 0.55 - 0.08, w: W, h: 0.1, fill: { color: ACCENT } });

    s.addText('Q&A', {
      x: 0, y: 1.5, w: W, h: 2,
      fontSize: 72, bold: true, color: WHITE, align: 'center', valign: 'middle',
    });

    s.addText('Thank you for your time!', {
      x: 0, y: 4.0, w: W, h: 0.6,
      fontSize: 16, color: 'BFDBFE', align: 'center',
    });

    s.addText(`${project.pm_name || 'Project Manager'}  |  ${project.pm_email || ''}`, {
      x: 0.5, y: 5, w: W - 1, h: 0.5,
      fontSize: 10, color: '94A3B8', align: 'center',
    });

    addSlideFooter(s, 10, TOTAL);
  }

  const buf = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
  return Buffer.from(buf);
}
