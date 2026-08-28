import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configFixture, emptyPeriodsFixture, periodsFixture } from '../shared/weekly.fixture';
import WeeklyPeriodsPage from './WeeklyPeriodsPage';

vi.mock('next/navigation', () => ({ usePathname: () => '/weekly/periods' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

let resolvePeriods: ((value: unknown) => void) | null = null;

function configOkResponse() {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(configFixture),
  };
}

function setupDeferredFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/weekly-periods' && (!init || init.method === undefined)) {
        return new Promise((resolve) => {
          resolvePeriods = (value) =>
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(value),
            });
        });
      }
      if (url === '/api/weekly-periods/config' && (!init || init.method === undefined)) {
        return Promise.resolve(configOkResponse());
      }
      return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
    }) as unknown as typeof fetch,
  );
}

function setupStatusFetch(status: number, body: unknown = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/weekly-periods' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(body),
        });
      }
      if (url === '/api/weekly-periods/config' && (!init || init.method === undefined)) {
        return Promise.resolve(configOkResponse());
      }
      return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
    }) as unknown as typeof fetch,
  );
}

beforeEach(() => {
  resolvePeriods = null;
  toastError.mockClear();
  toastSuccess.mockClear();
  setupDeferredFetch();
});

describe('WeeklyPeriodsPage', () => {
  it('shows sidebar and loading copy before fetch settles', () => {
    render(<WeeklyPeriodsPage />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('Loading weekly periods…')).toBeInTheDocument();
  });

  it('renders title and period rows after GET 200', async () => {
    render(<WeeklyPeriodsPage />);
    resolvePeriods!(periodsFixture);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Weekly periods' })).toBeInTheDocument();
    });

    expect(screen.getByText('Week 36, 2026')).toBeInTheDocument();
    expect(screen.getByText('2026-W36')).toBeInTheDocument();
    expect(screen.getByText('Week 35, 2026')).toBeInTheDocument();

    const trackLinks = screen.getAllByRole('link', { name: 'Track submissions' });
    expect(trackLinks[0]).toHaveAttribute('href', '/weekly/tracking?periodId=2');
    expect(trackLinks[1]).toHaveAttribute('href', '/weekly/tracking?periodId=1');
  });

  it('shows 403 forbidden copy in-page', async () => {
    setupStatusFetch(403);
    render(<WeeklyPeriodsPage />);

    await waitFor(() => {
      expect(screen.getByText("You don't have access to this page.")).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Weekly periods' })).not.toBeInTheDocument();
  });

  it('shows 401 session expired copy in-page', async () => {
    setupStatusFetch(401);
    render(<WeeklyPeriodsPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Session expired — refresh the page and sign in again.'),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId('weekly-period-list')).not.toBeInTheDocument();
  });

  it('shows empty state copy when no periods', async () => {
    setupStatusFetch(200, emptyPeriodsFixture());
    render(<WeeklyPeriodsPage />);

    await waitFor(() => {
      expect(screen.getByText('No weekly periods yet')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Create the first period for your company using an ISO week above.'),
    ).toBeInTheDocument();
    expect(screen.getByText('0 periods')).toBeInTheDocument();
  });

  it('uses singular subtitle for one period', async () => {
    setupStatusFetch(200, [periodsFixture[0]]);
    render(<WeeklyPeriodsPage />);

    await waitFor(() => {
      expect(screen.getByText('1 period')).toBeInTheDocument();
    });
  });

  it('uses plural subtitle for two periods', async () => {
    setupStatusFetch(200, periodsFixture);
    render(<WeeklyPeriodsPage />);

    await waitFor(() => {
      expect(screen.getByText('2 periods')).toBeInTheDocument();
    });
  });

  it('wraps period list in overflow-x-auto container', async () => {
    setupStatusFetch(200, periodsFixture);
    render(<WeeklyPeriodsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('weekly-period-list')).toBeInTheDocument();
    });
    const list = screen.getByTestId('weekly-period-list');
    expect(list.querySelector('.overflow-x-auto')).toBeTruthy();
  });

  describe('company weekly config', () => {
    it('pre-fills weekday and time from GET config', async () => {
      setupStatusFetch(200, periodsFixture);
      render(<WeeklyPeriodsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('weekly-config-form')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Due weekday')).toHaveTextContent('Friday');
      expect(screen.getByLabelText('Due time (UTC)')).toHaveValue('18:00');
    });

    it('PUTs config and toasts Schedule saved on success', async () => {
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/weekly-periods' && (!init || init.method === undefined)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(periodsFixture),
          });
        }
        if (url === '/api/weekly-periods/config' && init?.method === 'PUT') {
          const body = JSON.parse(String(init.body));
          expect(body.due_weekday).toBeGreaterThanOrEqual(0);
          expect(body.due_weekday).toBeLessThanOrEqual(6);
          expect(typeof body.due_time_utc).toBe('string');
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
        }
        if (url === '/api/weekly-periods/config' && (!init || init.method === undefined)) {
          return Promise.resolve(configOkResponse());
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      });
      vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

      render(<WeeklyPeriodsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('weekly-config-form')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/weekly-periods/config',
          expect.objectContaining({ method: 'PUT' }),
        );
        expect(toastSuccess).toHaveBeenCalledWith('Schedule saved');
      });
    });

    it('toasts config save error when PUT fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/weekly-periods' && (!init || init.method === undefined)) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(periodsFixture),
            });
          }
          if (url === '/api/weekly-periods/config' && init?.method === 'PUT') {
            return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
          }
          if (url === '/api/weekly-periods/config' && (!init || init.method === undefined)) {
            return Promise.resolve(configOkResponse());
          }
          return Promise.reject(new Error(`unexpected fetch: ${url}`));
        }) as unknown as typeof fetch,
      );

      render(<WeeklyPeriodsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('weekly-config-form')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith("Couldn't save schedule — try again.");
      });
    });
  });

  describe('create period', () => {
    const newPeriod = {
      id: 3,
      company_id: 1,
      iso_week: '2026-W40',
      start_date: '2026-09-29',
      end_date: '2026-10-05',
      due_at: '2026-10-03T18:00:00.000Z',
      display_name: 'Week 40, 2026',
      config_snapshot: configFixture,
      created_by: 10,
      created_at: '2026-08-28T12:00:00.000Z',
    };

    it('POSTs iso_week and toasts Period created on 201', async () => {
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/weekly-periods' && init?.method === 'POST') {
          const body = JSON.parse(String(init.body));
          expect(body).toEqual({ iso_week: '2026-W40' });
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () => Promise.resolve(newPeriod),
          });
        }
        if (url === '/api/weekly-periods' && (!init || init.method === undefined)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(periodsFixture),
          });
        }
        if (url === '/api/weekly-periods/config' && (!init || init.method === undefined)) {
          return Promise.resolve(configOkResponse());
        }
        return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
      });
      vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

      render(<WeeklyPeriodsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('weekly-create-form')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('ISO week'), { target: { value: '2026-W40' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create period' }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/weekly-periods',
          expect.objectContaining({ method: 'POST' }),
        );
        expect(toastSuccess).toHaveBeenCalledWith('Period created');
        expect(screen.getByText('Week 40, 2026')).toBeInTheDocument();
      });
    });

    it('toasts conflict message on 409', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/weekly-periods' && init?.method === 'POST') {
            return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({}) });
          }
          if (url === '/api/weekly-periods' && (!init || init.method === undefined)) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(periodsFixture),
            });
          }
          if (url === '/api/weekly-periods/config' && (!init || init.method === undefined)) {
            return Promise.resolve(configOkResponse());
          }
          return Promise.reject(new Error(`unexpected fetch: ${url}`));
        }) as unknown as typeof fetch,
      );

      render(<WeeklyPeriodsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('weekly-create-form')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('ISO week'), { target: { value: '2026-W40' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create period' }));

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Period already exists for this week');
      });
    });
  });
});
