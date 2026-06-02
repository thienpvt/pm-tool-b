import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json([], { status: 401 });

    const db = await getDb();
    const projects = user.is_admin
      ? await db.all(`SELECT p.*, c.name as program_name, c.industry as program_industry FROM projects p LEFT JOIN customers c ON p.customer_id = c.id ORDER BY p.created_at DESC`)
      : user.company_id !== null
        ? await db.all(`SELECT p.*, c.name as program_name, c.industry as program_industry FROM projects p LEFT JOIN customers c ON p.customer_id = c.id WHERE p.company_id = ? ORDER BY p.created_at DESC`, user.company_id)
        : await db.all(`SELECT p.*, c.name as program_name, c.industry as program_industry FROM projects p LEFT JOIN customers c ON p.customer_id = c.id WHERE p.company_id IS NULL ORDER BY p.created_at DESC`);
    return NextResponse.json(projects);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const db = await getDb();
    const companyId = user.is_admin ? (body.company_id ?? null) : user.company_id;

    const result = await db.run(
      `INSERT INTO projects (name, client, customer_id, pm_name, pm_email, start_date, end_date, description, current_phase, objective, project_owner, budget, budget_currency, company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      body.name, body.client ?? '', body.customer_id ?? null, body.pm_name ?? '', body.pm_email ?? '',
      body.start_date ?? '', body.end_date ?? '', body.description ?? '', body.current_phase ?? 'Initiation',
      body.objective ?? '', body.project_owner ?? '', body.budget ? Number(body.budget) : 0,
      body.budget_currency ?? 'VND', companyId
    );

    const project = await db.get('SELECT * FROM projects WHERE id = ?', result.lastInsertRowid);

    // Seed default meetings and escalation levels
    const meetings = [
      { name: 'PROJECT SYNC-UP WITH SPONSOR', frequency: 'Every Wednesday – 10h30 - 11h00', content: 'Project progress, Discuss any key updates or risks, Next action plan', participants: 'Project Sponsor, Head of Software Engineering, Head of Solution Architect, Project Manager', method: 'Conf. Call / E-Mail', type: 'sponsor' },
      { name: 'PROJECT SYNC-UP WITH TECHNICAL LEADER/MANAGER', frequency: 'Every Friday – 15h00 - 15h30', content: 'List of completed tasks, Current Plan, Risk & Issue, Next action plan', participants: 'Head of Software Engineering, Head of Solution Architect, Project Manager, Technical Leaders/Manager, Delivery manager', method: 'Offline meeting', type: 'technical' },
      { name: 'WORKING TEAM (Follow Scrum Framework)', frequency: 'Daily stand-up: Every morning – Timebox 15m', content: 'Daily progress, blockers, next steps', participants: 'Technical leader & Members', method: 'Offline/Online', type: 'team' },
    ];
    for (const m of meetings) {
      await db.run('INSERT INTO meetings (project_id, name, frequency, content, participants, method, type) VALUES (?,?,?,?,?,?,?)', result.lastInsertRowid, m.name, m.frequency, m.content, m.participants, m.method, m.type);
    }

    const escalations = [
      { level: 3, level_name: 'Level 3 – Steering Committee', channel: 'Steering Committee (Monthly or CRITICAL ISSUE)', participants: 'Customer: Project Director\nVendor: Program Manager', input: 'Issue escalation', output: 'Executive Commitment\nIssue resolution\nStrategic Direction' },
      { level: 2, level_name: 'Level 2 – Project Management', channel: 'Weekly meeting or per request', participants: 'Customer: Head of product, delivery manager\nVendor: Program Manager, Account Management', input: 'Issue escalation', output: 'Update project plan if needed' },
      { level: 1, level_name: 'Level 1 – Development team', channel: 'Daily meeting or ad-hoc meeting', participants: 'Customer: team leads\nVendor: PM, team leads', input: 'Issue/blockers', output: 'Resolution plan' },
    ];
    for (const e of escalations) {
      await db.run('INSERT INTO escalation_levels (project_id, level, level_name, channel, participants, input, output) VALUES (?,?,?,?,?,?,?)', result.lastInsertRowid, e.level, e.level_name, e.channel, e.participants, e.input, e.output);
    }

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
