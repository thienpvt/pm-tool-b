import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PmDashboardPage from './PmDashboardPage';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboards/pm' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

const projectRow = {
  id: 10,
  name: 'Alpha Project',
  project_code: 'A1',
  portfolio_year: 2026,
  customer_id: 1,
  program_name: 'Banking',
  stage: 'L2',
  status: 'Active',
  rag: 'green',
  classification: 'Strategic',
  weekly_report_enabled: true,
  progress_pct: 50,
  pm_user_id: 5,
  pm_name: 'Jane PM',
};

const pmFixture = {
  filters: {},
  projects: [projectRow],
  actions: {
    weekly: [
      {
        project_id: 10,
        report_id: 99,
        period_id: 1,
        period_display_name: 'W12 2026',
        due_at: '2026-03-15',
        status: 'draft',
        overdue: false,
        href: '/projects/10/weekly-reports/99',
      },
      {
        project_id: 10,
        report_id: 100,
        period_id: 1,
        period_display_name: 'W12 2026',
        due_at: '2026-03-10',
        status: 'not_submitted',
        overdue: true,
        href: '/projects/10/weekly-reports/100',
      },
    ],
    milestones: [
      {
        project_id: 10,
        milestone_id: 7,
        name: 'Very long milestone name that should truncate in the table cell display',
        plan_end: '2026-04-01',
        adjusted_end: null,
        kind: 'upcoming' as const,
        href: '/projects/10/milestones',
      },
    ],
    raid: [
      {
        project_id: 10,
        entity_type: 'issue',
        id: 42,
        code: 'RAID-CODE-VERY-LONG-IDENTIFIER-12345',
        due_date: '2026-04-05',
        has_technology_council: true,
        href: '/projects/10/raid',
      },
    ],
  },
};

const emptyActionsFixture = {
  filters: {},
  projects: [projectRow],
  actions: { weekly: [], milestones: [], raid: [] },
};

const zeroProjectsFixture = {
  filters: {},
  projects: [],
  actions: { weekly: [], milestones: [], raid: [] },
};

let resolvePm: ((value: unknown) => void) | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

function setupDefaultFetch() {
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/dashboards/pm' && (!init || !init.method || init.method === 'GET')) {
      return new Promise((resolve) => {
        resolvePm = (value) =>
          resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(value),
          });
      });
    }
    if (url === '/api/dashboards/pm/filters' && init?.method === 'PUT') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    }
    if (url === '/api/dashboards/pm/filters' && init?.method === 'POST') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  resolvePm = null;
  toastError.mockClear();
  setupDefaultFetch();
});

describe('PmDashboardPage', () => {
  it('shows loading shell before fetch settles', () => {
    render(<PmDashboardPage />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument();
  });

  it('renders My dashboard title and queue links with server hrefs', async () => {
    render(<PmDashboardPage />);
    resolvePm!(pmFixture);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'My dashboard' })).toBeInTheDocument());

    const openReports = screen.getAllByRole('link', { name: 'Open report' });
    expect(openReports[0]).toHaveAttribute('href', '/projects/10/weekly-reports/99');
    expect(openReports[1]).toHaveAttribute('href', '/projects/10/weekly-reports/100');

    const viewMilestone = screen.getByRole('link', { name: 'View milestone' });
    expect(viewMilestone).toHaveAttribute('href', '/projects/10/milestones');

    const viewRaid = screen.getByRole('link', { name: 'View RAID' });
    expect(viewRaid).toHaveAttribute('href', '/projects/10/raid');
  });

  it('shows empty queue copy with table headers still visible', async () => {
    render(<PmDashboardPage />);
    resolvePm!(emptyActionsFixture);

    await waitFor(() => expect(screen.getByText('No weekly reports due')).toBeInTheDocument());
    expect(screen.getByText('All obligated weekly reports for your assigned projects are submitted.')).toBeInTheDocument();
    expect(screen.getByText('No milestone actions')).toBeInTheDocument();
    expect(screen.getByText('No upcoming or overdue milestones on your assigned projects.')).toBeInTheDocument();
    expect(screen.getByText('No RAID actions')).toBeInTheDocument();
    expect(screen.getByText('No high-priority RAID items due on your assigned projects.')).toBeInTheDocument();
    const weeklyQueue = screen.getByTestId('pm-weekly-queue');
    expect(within(weeklyQueue).getByText('Project')).toBeInTheDocument();
    expect(within(weeklyQueue).getByText('Period')).toBeInTheDocument();
    const milestonesQueue = screen.getByTestId('pm-milestones-queue');
    expect(within(milestonesQueue).getByText('Milestone')).toBeInTheDocument();
    const raidQueue = screen.getByTestId('pm-raid-queue');
    expect(within(raidQueue).getByText('Code')).toBeInTheDocument();
  });

  it('renders three queue cards when PM has zero assigned projects', async () => {
    render(<PmDashboardPage />);
    resolvePm!(zeroProjectsFixture);

    await waitFor(() => expect(screen.getByText('Weekly reports')).toBeInTheDocument());
    expect(screen.getByText('Milestones')).toBeInTheDocument();
    expect(screen.getByText('RAID')).toBeInTheDocument();
  });

  it('shows count badge when weekly rows exist', async () => {
    render(<PmDashboardPage />);
    resolvePm!(pmFixture);

    await waitFor(() => expect(screen.getByTestId('pm-weekly-queue')).toHaveTextContent('(2)'));
  });

  it('hides count badge when weekly queue is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/dashboards/pm') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(emptyActionsFixture),
          });
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }) as unknown as typeof fetch,
    );

    render(<PmDashboardPage />);

    await waitFor(() => expect(screen.getByTestId('pm-weekly-queue')).toBeInTheDocument());
    expect(screen.getByTestId('pm-weekly-queue').textContent).not.toMatch(/\(\d+\)/);
  });

  it('truncates long milestone name and RAID code with title attribute', async () => {
    render(<PmDashboardPage />);
    resolvePm!(pmFixture);

    await waitFor(() => expect(screen.getByTitle(pmFixture.actions.milestones[0].name)).toBeInTheDocument());
    expect(screen.getByTitle(pmFixture.actions.raid[0].code)).toBeInTheDocument();
  });

  it('Apply filters PUTs to pm filters then refetches GET', async () => {
    let getCount = 0;
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/dashboards/pm' && (!init || !init.method || init.method === 'GET')) {
        getCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(pmFixture),
        });
      }
      if (url === '/api/dashboards/pm/filters' && init?.method === 'PUT') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    render(<PmDashboardPage />);
    await waitFor(() => expect(screen.getByLabelText('Stage')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'L2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([u, i]) => u === '/api/dashboards/pm/filters' && (i as RequestInit)?.method === 'PUT',
      );
      expect(putCall).toBeTruthy();
      expect(JSON.parse((putCall![1] as RequestInit).body as string)).toMatchObject({ stage: 'L2' });
      expect(getCount).toBeGreaterThanOrEqual(2);
    });
  });

  it('Clear filters POSTs action clear then refetches GET', async () => {
    render(<PmDashboardPage />);
    resolvePm!(pmFixture);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([u, i]) => u === '/api/dashboards/pm/filters' && (i as RequestInit)?.method === 'POST',
      );
      expect(postCall).toBeTruthy();
      expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({ action: 'clear' });
    });
  });

  it('shows toast.error when PUT filters fails', async () => {
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/dashboards/pm' && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(pmFixture),
        });
      }
      if (url === '/api/dashboards/pm/filters' && init?.method === 'PUT') {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    render(<PmDashboardPage />);
    await waitFor(() => expect(screen.getByLabelText('Stage')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'L3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Couldn't save filters — try again.");
    });
  });

  it('refetches GET when document becomes visible', async () => {
    let getCount = 0;
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/dashboards/pm' && (!init || !init.method || init.method === 'GET')) {
        getCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(pmFixture),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    render(<PmDashboardPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'My dashboard' })).toBeInTheDocument());
    expect(getCount).toBe(1);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => expect(getCount).toBeGreaterThanOrEqual(2));
  });

  it('shows 403 forbidden copy without queue content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/dashboards/pm') {
          return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) });
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }) as unknown as typeof fetch,
    );

    render(<PmDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("You don't have access to this dashboard.")).toBeInTheDocument();
    });
    expect(screen.queryByText('Weekly reports')).not.toBeInTheDocument();
  });

  it('shows 401 session expired copy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/dashboards/pm') {
          return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }) as unknown as typeof fetch,
    );

    render(<PmDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Session expired — refresh the page and sign in again.')).toBeInTheDocument();
    });
  });

  it('shows 500 load failed copy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/dashboards/pm') {
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }) as unknown as typeof fetch,
    );

    render(<PmDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load the dashboard. Try again.")).toBeInTheDocument();
    });
  });

  it('shows load failed copy when fetch rejects (network error)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/dashboards/pm') {
          return Promise.reject(new Error('network'));
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }) as unknown as typeof fetch,
    );

    render(<PmDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load the dashboard. Try again.")).toBeInTheDocument();
    });
    expect(screen.queryByText('Weekly reports')).not.toBeInTheDocument();
  });

  it('renders mixed weekly statuses with status badges', async () => {
    render(<PmDashboardPage />);
    resolvePm!(pmFixture);

    await waitFor(() => expect(screen.getByText('draft')).toBeInTheDocument());
    expect(screen.getByText('not_submitted')).toBeInTheDocument();
    const weeklyQueue = screen.getByTestId('pm-weekly-queue');
    expect(within(weeklyQueue).getAllByText('Overdue').length).toBeGreaterThanOrEqual(1);
  });
});
