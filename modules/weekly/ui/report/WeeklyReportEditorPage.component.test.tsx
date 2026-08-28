import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportShellFixture } from '../shared/weekly.fixture';
import WeeklyReportEditorPage from './WeeklyReportEditorPage';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '7', reportId: '10' }),
  usePathname: () => '/projects/7/weekly-reports/10',
}));
vi.mock('@/components/layout/Sidebar', () => ({
  default: ({ projectId }: { projectId?: string }) => (
    <nav data-testid="sidebar" data-project-id={projectId} />
  ),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

let resolveReport: ((value: unknown) => void) | null = null;

function setupDeferredFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/projects/7/weekly-reports/10' && (!init || init.method === undefined)) {
        return new Promise((resolve) => {
          resolveReport = (value) =>
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(value),
            });
        });
      }
      if (url === '/api/projects/7' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ name: 'Alpha' }),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
    }) as unknown as typeof fetch,
  );
}

function setupStatusFetch(status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/projects/7/weekly-reports/10' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve({ error: 'fail' }),
        });
      }
      if (url === '/api/projects/7' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ name: 'Alpha' }),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
    }) as unknown as typeof fetch,
  );
}

beforeEach(() => {
  resolveReport = null;
  toastError.mockClear();
  toastSuccess.mockClear();
  setupDeferredFetch();
});

describe('WeeklyReportEditorPage', () => {
  it('shows sidebar and loading copy before fetch settles', () => {
    render(<WeeklyReportEditorPage />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('Loading report…')).toBeInTheDocument();
  });

  it('renders Weekly report header after GET 200', async () => {
    render(<WeeklyReportEditorPage />);
    resolveReport!(reportShellFixture);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Weekly report/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Week 36, 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/projects/7');
    expect(screen.getByText('Green')).toBeInTheDocument();
  });

  it('shows prev_week_rag as read-only badge, not an editor combobox', async () => {
    render(<WeeklyReportEditorPage />);
    resolveReport!(reportShellFixture);

    await waitFor(() => {
      expect(screen.getByTestId('prev-week-rag-badge')).toBeInTheDocument();
    });

    const comboboxes = screen.queryAllByRole('combobox');
    for (const box of comboboxes) {
      expect(box).not.toHaveAttribute('aria-label', 'Previous week RAG');
    }
  });

  it('shows 404 not found copy', async () => {
    setupStatusFetch(404);
    render(<WeeklyReportEditorPage />);

    await waitFor(() => {
      expect(screen.getByText('Weekly report not found')).toBeInTheDocument();
    });
    expect(
      screen.getByText("This report may have been removed or you don't have access."),
    ).toBeInTheDocument();
  });

  it('shows 403 forbidden copy in-page', async () => {
    setupStatusFetch(403);
    render(<WeeklyReportEditorPage />);

    await waitFor(() => {
      expect(screen.getByText("You don't have access to this page.")).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /Weekly report/i })).not.toBeInTheDocument();
  });
});
