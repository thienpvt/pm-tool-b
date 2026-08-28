import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortfolioDashboardPage from './PortfolioDashboardPage';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboards/portfolio' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

const portfolioFixture = {
  filters: { stage: 'L2' },
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
  list: [
    {
      id: 1,
      name: 'Alpha',
      project_code: 'A1',
      portfolio_year: 2026,
      customer_id: 10,
      program_name: 'Banking',
      stage: 'L2',
      status: 'Active',
      rag: 'green',
      classification: 'Strategic',
      weekly_report_enabled: true,
      progress_pct: 50,
      pm_user_id: 5,
      pm_name: 'Jane PM',
    },
  ],
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
let fetchMock: ReturnType<typeof vi.fn>;

function setupDefaultFetch() {
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/dashboards/portfolio' && (!init || !init.method || init.method === 'GET')) {
      return new Promise((resolve) => {
        resolvePortfolio = (value) =>
          resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(value),
          });
      });
    }
    if (url === '/api/dashboards/portfolio/filters' && init?.method === 'PUT') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    }
    if (url === '/api/dashboards/portfolio/filters' && init?.method === 'POST') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  resolvePortfolio = null;
  toastError.mockClear();
  setupDefaultFetch();
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
    expect(kpiRow).toHaveTextContent('3');
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
    expect(screen.getByTestId('spec-kpi-row').children).toHaveLength(6);
  });

  it('omits fiscal patterns from spec-kpi-row (NIT-04)', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(portfolioFixture);

    await waitFor(() => expect(screen.getByTestId('spec-kpi-row')).toBeInTheDocument());

    const kpiRow = screen.getByTestId('spec-kpi-row');
    expect(kpiRow.textContent).not.toMatch(/budget|ROI|benefit|\$|₫|VND/i);
    expect(kpiRow.children).toHaveLength(6);
  });

  it('pre-populates Stage from payload.filters on mount', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(portfolioFixture);

    await waitFor(() => expect(screen.getByLabelText('Stage')).toHaveValue('L2'));
  });

  it('Apply filters PUTs stage L2 then refetches GET', async () => {
    let getCount = 0;
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/dashboards/portfolio' && (!init || !init.method || init.method === 'GET')) {
        getCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(portfolioFixture),
        });
      }
      if (url === '/api/dashboards/portfolio/filters' && init?.method === 'PUT') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    render(<PortfolioDashboardPage />);
    await waitFor(() => expect(screen.getByLabelText('Stage')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'L2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([u, i]) => u === '/api/dashboards/portfolio/filters' && (i as RequestInit)?.method === 'PUT',
      );
      expect(putCall).toBeTruthy();
      expect(JSON.parse((putCall![1] as RequestInit).body as string)).toMatchObject({ stage: 'L2' });
      expect(getCount).toBeGreaterThanOrEqual(2);
    });
  });

  it('Clear filters POSTs action clear then refetches GET', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(portfolioFixture);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([u, i]) => u === '/api/dashboards/portfolio/filters' && (i as RequestInit)?.method === 'POST',
      );
      expect(postCall).toBeTruthy();
      expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({ action: 'clear' });
    });
  });

  it('Reset defaults POSTs action defaults then refetches GET', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(portfolioFixture);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset defaults' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reset defaults' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([u, i]) =>
          u === '/api/dashboards/portfolio/filters' &&
          (i as RequestInit)?.method === 'POST' &&
          JSON.parse((i as RequestInit).body as string).action === 'defaults',
      );
      expect(postCall).toBeTruthy();
    });
  });

  it('shows toast.error and retains prior stage when PUT fails', async () => {
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/dashboards/portfolio' && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(portfolioFixture),
        });
      }
      if (url === '/api/dashboards/portfolio/filters' && init?.method === 'PUT') {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    render(<PortfolioDashboardPage />);
    await waitFor(() => expect(screen.getByLabelText('Stage')).toHaveValue('L2'));

    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'L3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Couldn't save filters — try again.");
    });
    expect(screen.getByLabelText('Stage')).toHaveValue('L3');
  });

  it('shows 403 forbidden copy without KPI row', async () => {
    const forbiddenFetch = vi.fn((url: string) => {
      if (url === '/api/dashboards/portfolio') {
        return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', forbiddenFetch);

    render(<PortfolioDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("You don't have access to this dashboard.")).toBeInTheDocument();
    });
    expect(screen.queryByTestId('spec-kpi-row')).not.toBeInTheDocument();
    expect(forbiddenFetch).toHaveBeenCalledWith('/api/dashboards/portfolio');
  });

  it('shows 401 session expired copy without redirect', async () => {
    const unauthorizedFetch = vi.fn((url: string) => {
      if (url === '/api/dashboards/portfolio') {
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', unauthorizedFetch);

    render(<PortfolioDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Session expired — refresh the page and sign in again.')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('spec-kpi-row')).not.toBeInTheDocument();
    expect(unauthorizedFetch).toHaveBeenCalledWith('/api/dashboards/portfolio');
  });

  it('shows 500 load failed copy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/dashboards/portfolio') {
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }) as unknown as typeof fetch,
    );

    render(<PortfolioDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load the dashboard. Try again.")).toBeInTheDocument();
    });
    expect(screen.queryByTestId('spec-kpi-row')).not.toBeInTheDocument();
  });
});
