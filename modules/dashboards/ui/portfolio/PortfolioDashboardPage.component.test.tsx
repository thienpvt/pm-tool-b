import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortfolioDashboardPage from './PortfolioDashboardPage';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboards/portfolio' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const portfolioFixture = {
  filters: {},
  kpis: {
    active_count: 3,
    on_track_count: 2,
    watch_act_count: 1,
    overdue_milestone_project_count: 0,
    high_open_raid_count: 0,
    technology_council_count: 0,
  },
  charts: {
    by_stage: { L0: 0, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 },
    by_rag: { green: 0, amber: 0, red: 0 },
  },
  list: [],
  drilldowns: {
    overdue_milestones: [],
    high_raid: [],
    technology_council: [],
  },
};

const zeroKpiFixture = {
  ...portfolioFixture,
  kpis: {
    active_count: 0,
    on_track_count: 0,
    watch_act_count: 0,
    overdue_milestone_project_count: 0,
    high_open_raid_count: 0,
    technology_council_count: 0,
  },
};

let resolvePortfolio: ((value: unknown) => void) | null = null;

beforeEach(() => {
  resolvePortfolio = null;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/dashboards/portfolio') {
        return new Promise((resolve) => {
          resolvePortfolio = (value) =>
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(value),
            });
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch,
  );
});

describe('PortfolioDashboardPage', () => {
  it('collects under jsdom modules glob', () => {
    expect(PortfolioDashboardPage).toBeDefined();
  });

  it('shows loading shell before fetch settles', () => {
    render(<PortfolioDashboardPage />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument();
  });

  it('renders six KPI tiles with fixture numbers after GET 200', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(portfolioFixture);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Spec dashboard' })).toBeInTheDocument());

    const kpiRow = screen.getByTestId('spec-kpi-row');
    expect(kpiRow).toHaveTextContent('Active projects');
    expect(kpiRow).toHaveTextContent('On track');
    expect(kpiRow).toHaveTextContent('Watch / act');
    expect(kpiRow).toHaveTextContent('Overdue milestones');
    expect(kpiRow).toHaveTextContent('High open RAID');
    expect(kpiRow).toHaveTextContent('Technology council');
    expect(kpiRow).toHaveTextContent('3');
    expect(kpiRow).toHaveTextContent('2');
    expect(kpiRow).toHaveTextContent('1');
    expect(kpiRow).toHaveTextContent('0');
  });

  it('keeps six KPI cells visible when every count is 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/dashboards/portfolio') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(zeroKpiFixture),
          });
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }) as unknown as typeof fetch,
    );

    render(<PortfolioDashboardPage />);
    await waitFor(() => expect(screen.getByTestId('spec-kpi-row')).toBeInTheDocument());

    const kpiRow = screen.getByTestId('spec-kpi-row');
    expect(kpiRow.children).toHaveLength(6);
    expect(kpiRow).toHaveTextContent('0');
  });
});
