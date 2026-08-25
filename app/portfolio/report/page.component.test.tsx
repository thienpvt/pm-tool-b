import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortfolioReportPage from './page';

vi.mock('next/navigation', () => ({ useParams: () => ({}) }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const reportFixture = {
  projects: [],
  programs: [{ id: 1, name: 'Prog A', industry: 'Technology', projects: [] }],
  noProgramProjects: [],
  kpi: { totalProjects: 0, totalPrograms: 1, avgCompletion: 0, activeProjects: 0, totalOpenRisks: 0, totalOpenIssues: 0 },
  topRisks: [],
  topIssues: [],
  upcomingMilestones: [],
  recentlyCompleted: [],
  completedByProject: {},
  personnelStats: { totalInternal: 0, totalAllocated: 0, projectAllocations: [], overallocated: [] },
  portfolioMilestones: [{ id: 1, project_id: 1, name: 'MS1', start_date: '2026-01-01', end_date: '2026-03-31', project_name: 'Alpha', program_name: 'Prog A' }],
  periodStart: '2026-01-01',
  periodEnd: '2026-01-07',
  reportDate: '2026-01-07',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.startsWith('/api/portfolio/report')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(reportFixture) });
    }
    if (url === '/api/config') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ anthropic_api_key_set: 'false' }) });
    }
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ company_name: 'Acme', onboarding_completed: 1, display_name: 'Test', username: 'test' }),
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as typeof fetch);
});

describe('PortfolioReportPage', () => {
  it('renders after load', async () => {
    render(<PortfolioReportPage />);
    await waitFor(() => expect(screen.getByText('Reporting Period:')).toBeInTheDocument());
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('switches to milestone mode', async () => {
    render(<PortfolioReportPage />);
    await waitFor(() => expect(screen.getByText('Reporting Period:')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Milestone'));
    expect(screen.getByText('Chọn Milestone')).toBeInTheDocument();
  });
});
