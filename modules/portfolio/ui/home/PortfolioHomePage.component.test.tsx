import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortfolioHomePage from './PortfolioHomePage';

vi.mock('next/navigation', () => ({ useParams: () => ({}) }));
vi.mock('@/components/onboarding/OnboardingModal', () => ({ default: () => null }));

const portfolioFixture = {
  programs: [],
  projects: [],
  noProgramProjects: [],
  phaseDist: [],
  programBar: [],
  kpi: { totalProjects: 0, totalPrograms: 0, totalOpenRisks: 0, totalOpenIssues: 0, avgCompletion: 0, activeProjects: 0 },
};

const projectRow = {
  id: 1,
  name: 'Alpha Project',
  client: 'Acme',
  customer_id: null,
  program_name: 'Prog A',
  program_industry: 'Technology',
  pm_name: 'Jane Doe',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  current_phase: 'Execution',
  description: '',
  open_risks: 1,
  open_issues: 0,
  completion_pct: 50,
  total_activities: 10,
  done_activities: 5,
  rag: 'amber' as const,
  days_until_deadline: 30,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/portfolio') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ...portfolioFixture,
          projects: [projectRow],
          programs: [{ id: 1, name: 'Prog A', industry: 'Technology', projects: [projectRow] }],
        }),
      });
    }
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ company_name: 'Acme', onboarding_completed: 1, display_name: 'Test', username: 'test' }),
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch);
});

describe('PortfolioHomePage', () => {
  it('renders after load', async () => {
    render(<PortfolioHomePage />);
    await waitFor(() => expect(screen.queryByText(/Loading portfolio/i)).not.toBeInTheDocument());
    expect(screen.getByText('Portfolio Health Check')).toBeInTheDocument();
  });

  it('toggles view mode from cards to list', async () => {
    render(<PortfolioHomePage />);
    await waitFor(() => expect(screen.queryByText(/Loading portfolio/i)).not.toBeInTheDocument());

    expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('List view'));
    expect(screen.getByText('Alerts')).toBeInTheDocument();
  });

  it('renders when auth/me is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/portfolio') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(portfolioFixture) });
      }
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch);

    render(<PortfolioHomePage />);
    await waitFor(() => expect(screen.queryByText(/Loading portfolio/i)).not.toBeInTheDocument());
  });
});
