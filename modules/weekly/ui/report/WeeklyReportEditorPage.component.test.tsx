import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const submittedShell = { ...reportShellFixture, status: 'submitted', correction_open: false };

function setupDraftFetch(opts?: {
  patchStatus?: number;
  onPatch?: (body: Record<string, unknown>) => void;
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/projects/7/weekly-reports/10' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        opts?.onPatch?.(body);
        const status = opts?.patchStatus ?? 200;
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(reportShellFixture),
        });
      }
      if (url === '/api/projects/7/weekly-reports/10' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(reportShellFixture),
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

function setupSubmittedFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/projects/7/weekly-reports/10' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(submittedShell),
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
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
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

  describe('draft PATCH', () => {
    it('debounces PATCH with highlights and omits prev_week_rag', async () => {
      const onPatch = vi.fn();
      setupDraftFetch({ onPatch });
      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Highlights')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Highlights'), {
        target: { value: 'Updated highlights' },
      });

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(onPatch).toHaveBeenCalled();
      });

      const body = onPatch.mock.calls[0][0] as Record<string, unknown>;
      expect(body.highlights).toBe('Updated highlights');
      expect(body).not.toHaveProperty('prev_week_rag');
    });

    it('toasts submitted message on PATCH 409', async () => {
      setupDraftFetch({ patchStatus: 409 });
      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Highlights')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Highlights'), {
        target: { value: 'Blocked edit' },
      });
      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith(
          'Report is submitted — open a correction to edit.',
        );
      });
    });

    it("toasts draft save error on PATCH 500", async () => {
      setupDraftFetch({ patchStatus: 500 });
      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Highlights')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Highlights'), {
        target: { value: 'Fail save' },
      });
      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith("Couldn't save draft — try again.");
      });
    });

    it('disables form fields when submitted without correction', async () => {
      setupSubmittedFetch();
      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Highlights')).toBeDisabled();
      });
      expect(screen.getByLabelText('Completed work')).toBeDisabled();
      expect(screen.getByLabelText('RAID dependency')).toBeDisabled();
    });

    it('renders empty textareas for null leadership_support', async () => {
      setupDraftFetch();
      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Leadership support')).toHaveValue('');
      });
    });

    it('offers Title Case RAG options for this week', async () => {
      setupDraftFetch();
      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('This week RAG')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('This week RAG'));
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Green' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Amber' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Red' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Not applicable' })).toBeInTheDocument();
      });
    });
  });
});
