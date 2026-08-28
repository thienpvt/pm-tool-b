import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { periodsFixture } from '../shared/weekly.fixture';
import WeeklyPeriodsPage from './WeeklyPeriodsPage';

vi.mock('next/navigation', () => ({ usePathname: () => '/weekly/periods' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

let resolvePeriods: ((value: unknown) => void) | null = null;

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
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch,
  );
}

function setupStatusFetch(status: number, body: unknown = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/weekly-periods') {
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(body),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch,
  );
}

beforeEach(() => {
  resolvePeriods = null;
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
});
