import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectReportPage from './ProjectReportPage';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: '1' }) }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const reportFixture = {
  project: {
    id: 1,
    name: 'Alpha Project',
    customer_name: 'Acme',
    program_name: 'Prog A',
    pm_name: 'Jane PM',
    current_phase: 'Execution',
    end_date: '2026-12-31',
    start_date: '2026-01-01',
    rag: 'green' as const,
    days_until_deadline: 120,
  },
  milestones: [{ id: 10, name: 'MS1', start_date: '2026-01-01', end_date: '2026-03-31' }],
  periodStart: '2026-01-01',
  periodEnd: '2026-01-07',
  stats: { total: 10, done: 5, inProgress: 3, notStarted: 2, completion_pct: 55 },
  epicStats: [{ phase: 'Phase 1', total: 4, done: 2, pct: 50 }],
  completedInPeriod: [{ id: 1, activity: 'Deploy staging', deliverable: 'v1.0', actual_end: '2026-01-05', status: 'Done' }],
  upcomingActivities: [],
  openRisks: [],
  openIssues: [],
  bugStats: null,
  teamStats: null,
  milestoneStats: [],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('/api/projects/1/project-report') && init?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ report: '# AI Report\n\nGenerated content.' }) });
    }
    if (url.includes('/api/projects/1/project-report')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(reportFixture) });
    }
    if (url === '/api/config') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ anthropic_api_key_set: 'false' }) });
    }
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ company_name: 'Acme Corp', onboarding_completed: 1, display_name: 'Test', username: 'test' }),
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch);
});

describe('ProjectReportPage', () => {
  it('renders after load', async () => {
    render(<ProjectReportPage />);
    await waitFor(() => expect(screen.getByText(/Project Status Report/)).toBeInTheDocument());
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Reload Data')).toBeInTheDocument());
  });

  it('generates template report on button click', async () => {
    render(<ProjectReportPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Generate Report/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));
    await waitFor(() => {
      expect(screen.queryByText('No report generated yet')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
  });
});
