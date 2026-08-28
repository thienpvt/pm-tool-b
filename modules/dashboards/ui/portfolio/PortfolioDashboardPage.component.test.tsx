import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortfolioDashboardPage from './PortfolioDashboardPage';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboards/portfolio' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

const downloadBlobMock = vi.fn();
vi.mock('@/modules/dashboards/ui/shared/downloadBlob', () => ({
  downloadBlob: (...args: unknown[]) => downloadBlobMock(...args),
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
    overdue_milestones: [
      {
        project_id: 10,
        milestone_id: 1,
        name: 'Gate review',
        project_name: 'Alpha',
      },
      {
        milestone_id: 2,
        name: 'No project link',
        project_name: 'Orphan',
      },
    ],
    high_raid: [],
    technology_council: [],
  },
};

const longName = 'A'.repeat(120);
const overdueLongNameFixture = {
  ...portfolioFixture,
  drilldowns: {
    ...portfolioFixture.drilldowns,
    overdue_milestones: [
      { project_id: 10, milestone_id: 99, name: longName, project_name: 'Alpha' },
    ],
  },
};

const emptyOverdueFixture = {
  ...portfolioFixture,
  drilldowns: {
    ...portfolioFixture.drilldowns,
    overdue_milestones: [],
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

const emptyListFixture = {
  ...portfolioFixture,
  list: [],
};

const longProjectName = 'B'.repeat(200);
const longNameListFixture = {
  ...portfolioFixture,
  list: [
    {
      ...portfolioFixture.list[0],
      name: longProjectName,
    },
  ],
};

function setupFetchWithExport(
  exportHandler: (url: string, init?: RequestInit) => Promise<Response> | Response,
) {
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/dashboards/portfolio/export' && init?.method === 'POST') {
      return exportHandler(url, init);
    }
    if (url === '/api/dashboards/portfolio' && (!init || !init.method || init.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(portfolioFixture),
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
  toastSuccess.mockClear();
  downloadBlobMock.mockClear();
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

  it('opens overdue drill-down panel when Overdue milestones tile clicked', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(portfolioFixture);
    await waitFor(() => expect(screen.getByTestId('spec-kpi-row')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Overdue milestones/i }));

    expect(screen.getByTestId('portfolio-drilldown-panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overdue milestones' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gate review' })).toHaveAttribute(
      'href',
      '/projects/10/milestones',
    );
  });

  it('collapses drill-down when clicking the active tile again', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(portfolioFixture);
    await waitFor(() => expect(screen.getByTestId('spec-kpi-row')).toBeInTheDocument());

    const tile = screen.getByRole('button', { name: /Overdue milestones/i });
    fireEvent.click(tile);
    expect(screen.getByTestId('portfolio-drilldown-panel')).toBeInTheDocument();
    fireEvent.click(tile);
    expect(screen.queryByTestId('portfolio-drilldown-panel')).not.toBeInTheDocument();
  });

  it('shows empty drill-down copy when overdue list is empty', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(emptyOverdueFixture);
    await waitFor(() => expect(screen.getByTestId('spec-kpi-row')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Overdue milestones/i }));

    expect(screen.getByText('No items in this drill-down')).toBeInTheDocument();
    expect(
      screen.getByText('The selected KPI has zero matching rows for the current filters.'),
    ).toBeInTheDocument();
  });

  it('omits milestone link when project_id is missing', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(portfolioFixture);
    await waitFor(() => expect(screen.getByTestId('spec-kpi-row')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Overdue milestones/i }));

    expect(screen.queryByRole('link', { name: 'No project link' })).not.toBeInTheDocument();
    expect(screen.getByText('No project link')).toBeInTheDocument();
  });

  it('truncates long drill-down name with title attribute', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(overdueLongNameFixture);
    await waitFor(() => expect(screen.getByTestId('spec-kpi-row')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Overdue milestones/i }));

    const link = screen.getByRole('link', { name: longName });
    expect(link).toHaveAttribute('title', longName);
    expect(link.className).toMatch(/truncate/);
    expect(link.className).toMatch(/max-w-\[200px\]/);
  });

  it('shows empty project list copy spanning columns', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(emptyListFixture);
    await waitFor(() => expect(screen.getByTestId('portfolio-project-list')).toBeInTheDocument());

    expect(screen.getByText('No projects match these filters')).toBeInTheDocument();
    expect(
      screen.getByText('Adjust or clear filters to see projects in the portfolio.'),
    ).toBeInTheDocument();
  });

  it('truncates long project name with title attribute', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(longNameListFixture);
    await waitFor(() => expect(screen.getByTestId('portfolio-project-list')).toBeInTheDocument());

    const link = screen.getByRole('link', { name: longProjectName });
    expect(link).toHaveAttribute('title', longProjectName);
    expect(link.className).toMatch(/truncate/);
    expect(link.className).toMatch(/max-w-\[200px\]/);
  });

  it('POSTs xlsx export and calls downloadBlob on success', async () => {
    setupFetchWithExport(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['xlsx'], { type: 'application/vnd.ms-excel' })),
      } as Response),
    );

    render(<PortfolioDashboardPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export Excel' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));

    await waitFor(() => {
      const exportCall = fetchMock.mock.calls.find(
        ([u, i]) => u === '/api/dashboards/portfolio/export' && (i as RequestInit)?.method === 'POST',
      );
      expect(exportCall).toBeTruthy();
      expect(JSON.parse((exportCall![1] as RequestInit).body as string)).toEqual({ format: 'xlsx' });
      expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'portfolio-dashboard.xlsx');
      expect(toastSuccess).toHaveBeenCalledWith('Export downloaded');
    });
  });

  it('POSTs pdf export format', async () => {
    setupFetchWithExport(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' })),
      } as Response),
    );

    render(<PortfolioDashboardPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));

    await waitFor(() => {
      const exportCall = fetchMock.mock.calls.find(
        ([u, i]) => u === '/api/dashboards/portfolio/export' && (i as RequestInit)?.method === 'POST',
      );
      expect(JSON.parse((exportCall![1] as RequestInit).body as string)).toEqual({ format: 'pdf' });
      expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'portfolio-dashboard.pdf');
    });
  });

  it('shows export error toast when POST returns 500', async () => {
    setupFetchWithExport(() =>
      Promise.resolve({ ok: false, status: 500, blob: () => Promise.resolve(new Blob()) } as Response),
    );

    render(<PortfolioDashboardPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export Excel' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Export failed — try again.');
    });
    expect(downloadBlobMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Export Excel' })).not.toBeDisabled();
  });

  it('disables export buttons while POST is in-flight', async () => {
    let resolveExport: ((value: Response) => void) | null = null;
    setupFetchWithExport(
      () =>
        new Promise((resolve) => {
          resolveExport = resolve;
        }),
    );

    render(<PortfolioDashboardPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export Excel' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Exporting…' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled();
    });

    resolveExport!({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['xlsx'])),
    } as Response);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export Excel' })).not.toBeDisabled();
    });
  });

  it('keeps export buttons enabled when project list is empty', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(emptyListFixture);
    await waitFor(() => expect(screen.getByTestId('portfolio-project-list')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Export Excel' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export PDF' })).not.toBeDisabled();
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

  it('shows load failed copy when fetch rejects (network error)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/dashboards/portfolio') {
          return Promise.reject(new Error('network'));
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

  it('shows filter summary subtitle with project count', async () => {
    render(<PortfolioDashboardPage />);
    resolvePortfolio!(portfolioFixture);

    await waitFor(() => {
      expect(screen.getByText('1 project matching filters')).toBeInTheDocument();
    });
  });

  it('shows export error toast when export fetch rejects', async () => {
    setupFetchWithExport(() => Promise.reject(new Error('network')));

    render(<PortfolioDashboardPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export Excel' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Export failed — try again.');
    });
    expect(downloadBlobMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Export Excel' })).not.toBeDisabled();
  });
});
