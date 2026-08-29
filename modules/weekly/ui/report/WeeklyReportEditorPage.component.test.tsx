import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportShellFixture } from '../shared/weekly.fixture';
import WeeklyReportEditorPage from './WeeklyReportEditorPage';

const mockParams = vi.hoisted(() => ({ id: '7', reportId: '10' }));

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  usePathname: () => `/projects/${mockParams.id}/weekly-reports/${mockParams.reportId}`,
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
  mockParams.id = '7';
  mockParams.reportId = '10';
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
  it('shows loading copy before fetch settles', () => {
    render(<WeeklyReportEditorPage />);
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

    it('does not PATCH a new report with pending edits from the previous report', async () => {
      const onPatch = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url.includes('/weekly-reports/') && init?.method === 'PATCH') {
            onPatch(url, JSON.parse(String(init.body)));
            return Promise.resolve({
              ok: true,
              status: 200,
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
          if (url === '/api/projects/7/weekly-reports/11' && (!init || init.method === undefined)) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ ...reportShellFixture, id: 11 }),
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

      const { rerender } = render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Highlights')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Highlights'), {
        target: { value: 'Report A edit' },
      });

      mockParams.reportId = '11';
      rerender(<WeeklyReportEditorPage />);

      await vi.advanceTimersByTimeAsync(300);

      expect(onPatch).not.toHaveBeenCalled();
    });

    it('toasts submitted message on PATCH 409 and reverts optimistic edit', async () => {
      setupDraftFetch({ patchStatus: 409 });
      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Highlights')).toBeInTheDocument();
      });

      const originalHighlights = reportShellFixture.highlights ?? '';
      fireEvent.change(screen.getByLabelText('Highlights'), {
        target: { value: 'Blocked edit' },
      });
      expect(screen.getByLabelText('Highlights')).toHaveValue('Blocked edit');

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith(
          'Report is submitted — open a correction to edit.',
        );
        expect(screen.getByLabelText('Highlights')).toHaveValue(originalHighlights);
      });
    });

    it("toasts draft save error on PATCH 500 and reverts optimistic edit", async () => {
      setupDraftFetch({ patchStatus: 500 });
      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Highlights')).toBeInTheDocument();
      });

      const originalHighlights = reportShellFixture.highlights ?? '';
      fireEvent.change(screen.getByLabelText('Highlights'), {
        target: { value: 'Fail save' },
      });

      await vi.advanceTimersByTimeAsync(300);

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith("Couldn't save draft — try again.");
        expect(screen.getByLabelText('Highlights')).toHaveValue(originalHighlights);
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

  describe('submit and correct', () => {
    function setupSubmitFetch(opts?: {
      submitStatus?: number;
      submitBody?: unknown;
      afterCorrectShell?: typeof reportShellFixture;
    }) {
      let correctionOpened = false;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/projects/7/weekly-reports/10/submit' && init?.method === 'POST') {
            const status = opts?.submitStatus ?? 201;
            return Promise.resolve({
              ok: status >= 200 && status < 300,
              status,
              json: () =>
                Promise.resolve(
                  opts?.submitBody ?? (status === 201 ? reportShellFixture : { error: 'fail' }),
                ),
            });
          }
          if (url === '/api/projects/7/weekly-reports/10/correct' && init?.method === 'POST') {
            correctionOpened = true;
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ ok: true }),
            });
          }
          if (url === '/api/projects/7/weekly-reports/10' && (!init || init.method === undefined)) {
            const shell = correctionOpened
              ? (opts?.afterCorrectShell ?? {
                  ...submittedShell,
                  correction_open: true,
                })
              : reportShellFixture;
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(shell),
            });
          }
          if (url === '/api/projects/7/weekly-reports/10' && init?.method === 'PATCH') {
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

    function setupSubmittedWithCorrect() {
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/projects/7/weekly-reports/10/correct' && init?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ ok: true }),
            });
          }
          if (url === '/api/projects/7/weekly-reports/10' && (!init || init.method === undefined)) {
            callCount += 1;
            const shell =
              callCount > 1
                ? { ...submittedShell, correction_open: true }
                : submittedShell;
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(shell),
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

    it('shows Submit report for draft and toasts on 201', async () => {
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/projects/7/weekly-reports/10/submit' && init?.method === 'POST') {
          expect(init.body).toBeUndefined();
          return Promise.resolve({
            ok: true,
            status: 201,
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
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      });
      vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit report' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/projects/7/weekly-reports/10/submit',
          expect.objectContaining({ method: 'POST' }),
        );
        expect(toastSuccess).toHaveBeenCalledWith('Report submitted');
      });
    });

    it('shows inline raid_dependency error and validation toast on 400', async () => {
      setupSubmitFetch({
        submitStatus: 400,
        submitBody: { error: 'Validation failed', fields: ['raid_dependency'] },
      });
      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit report' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Fix validation errors before submitting.');
        expect(screen.getByText('Required before submit')).toBeInTheDocument();
      });
    });

    it('hides Open correction when correction is already open', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/projects/7/weekly-reports/10' && (!init || init.method === undefined)) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({ ...submittedShell, correction_open: true }),
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

      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Highlights')).not.toBeDisabled();
      });
      expect(screen.queryByRole('button', { name: 'Open correction' })).not.toBeInTheDocument();
    });

    it('shows Open correction for submitted and enables fields after correct', async () => {
      setupSubmittedWithCorrect();
      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Open correction' })).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Submit report' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Highlights')).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Open correction' }));

      await waitFor(() => {
        expect(toastSuccess).toHaveBeenCalledWith(
          'Correction opened — you can edit the report.',
        );
        expect(screen.getByLabelText('Highlights')).not.toBeDisabled();
      });
    });

    it('disables Submit report while POST is in flight', async () => {
      let resolveSubmit: ((value: unknown) => void) | null = null;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/projects/7/weekly-reports/10/submit' && init?.method === 'POST') {
            return new Promise((resolve) => {
              resolveSubmit = (value) =>
                resolve({
                  ok: true,
                  status: 201,
                  json: () => Promise.resolve(value),
                });
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
          return Promise.reject(new Error(`unexpected fetch: ${url}`));
        }) as unknown as typeof fetch,
      );

      render(<WeeklyReportEditorPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit report' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit report' })).toBeDisabled();
      });

      resolveSubmit!(reportShellFixture);
    });
  });
});
