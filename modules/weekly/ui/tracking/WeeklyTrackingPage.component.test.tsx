import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyPeriodsFixture,
  periodsFixture,
  trackingPayload,
} from '../shared/weekly.fixture';
import WeeklyTrackingPage from './WeeklyTrackingPage';

const replaceMock = vi.fn();

let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => '/weekly/tracking',
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('@/components/layout/Sidebar', () => ({
  default: () => <nav data-testid="sidebar" />,
}));

let resolvePeriods: ((value: unknown) => void) | null = null;
let resolveTracking: ((value: unknown) => void) | null = null;

function setupDeferredFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/weekly-periods') {
        return new Promise((resolve) => {
          resolvePeriods = (value) =>
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(value),
            });
        });
      }
      if (url.startsWith('/api/weekly-periods/') && url.endsWith('/tracking')) {
        return new Promise((resolve) => {
          resolveTracking = (value) =>
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
}

function setupStatusFetch(periodsStatus: number, periodsBody: unknown = periodsFixture) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/weekly-periods') {
        return Promise.resolve({
          ok: periodsStatus >= 200 && periodsStatus < 300,
          status: periodsStatus,
          json: () => Promise.resolve(periodsBody),
        });
      }
      if (url.startsWith('/api/weekly-periods/') && url.endsWith('/tracking')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(trackingPayload),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch,
  );
}

beforeEach(() => {
  searchParams = new URLSearchParams();
  replaceMock.mockClear();
  resolvePeriods = null;
  resolveTracking = null;
  setupDeferredFetch();
});

describe('WeeklyTrackingPage', () => {
  it('shows sidebar and loading copy before fetch settles', () => {
    render(<WeeklyTrackingPage />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('Loading tracking…')).toBeInTheDocument();
  });

  it('renders title Weekly tracking after GET 200', async () => {
    render(<WeeklyTrackingPage />);
    resolvePeriods!(periodsFixture);
    await waitFor(() => {
      expect(resolveTracking).toBeTypeOf('function');
    });
    resolveTracking!(trackingPayload);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Weekly tracking' })).toBeInTheDocument();
    });
  });

  it('shows 403 forbidden copy in-page', async () => {
    setupStatusFetch(403);
    render(<WeeklyTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText("You don't have access to this page.")).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Weekly tracking' })).not.toBeInTheDocument();
  });

  it('shows empty periods panel with link to /weekly/periods', async () => {
    setupStatusFetch(200, emptyPeriodsFixture());
    render(<WeeklyTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('No periods to track')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Create a weekly period first, then return here to track submissions.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /weekly periods/i })).toHaveAttribute(
      'href',
      '/weekly/periods',
    );
  });

  it('falls back to latest iso_week when periodId is invalid', async () => {
    searchParams = new URLSearchParams('periodId=999');
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/weekly-periods') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(periodsFixture),
        });
      }
      if (url === '/api/weekly-periods/2/tracking') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(trackingPayload),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<WeeklyTrackingPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/weekly-periods/2/tracking');
    });
  });

  it('uses periodId from query when valid', async () => {
    searchParams = new URLSearchParams('periodId=1');
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/weekly-periods') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(periodsFixture),
        });
      }
      if (url === '/api/weekly-periods/1/tracking') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(trackingPayload),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<WeeklyTrackingPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/weekly-periods/1/tracking');
    });
  });

  it('defaults to latest period when periodId is missing', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/weekly-periods') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(periodsFixture),
        });
      }
      if (url === '/api/weekly-periods/2/tracking') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(trackingPayload),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<WeeklyTrackingPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/weekly-periods/2/tracking');
    });
  });

  it('calls router.replace when period Select changes', async () => {
    render(<WeeklyTrackingPage />);
    resolvePeriods!(periodsFixture);
    await waitFor(() => {
      expect(resolveTracking).toBeTypeOf('function');
    });
    resolveTracking!(trackingPayload);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Weekly tracking' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '1' } });

    expect(replaceMock).toHaveBeenCalledWith('/weekly/tracking?periodId=1');
  });
});
