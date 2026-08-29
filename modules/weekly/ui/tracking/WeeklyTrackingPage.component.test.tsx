import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyPeriodsFixture,
  periodsFixture,
  trackingPayload,
  trackingRows150,
} from '../shared/weekly.fixture';
import WeeklyTrackingPage from './WeeklyTrackingPage';

const replaceMock = vi.fn();

let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => '/weekly/tracking',
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: replaceMock }),
}));

const downloadBlobMock = vi.fn();
vi.mock('@/modules/dashboards/ui/shared/downloadBlob', () => ({
  downloadBlob: (...args: unknown[]) => downloadBlobMock(...args),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

let resolvePeriods: ((value: unknown) => void) | null = null;
let resolveTracking: ((value: unknown) => void) | null = null;
const trackingResolvers: Array<(value: unknown) => void> = [];

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
          const resolver = (value: unknown) =>
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(value),
            });
          trackingResolvers.push(resolver);
          resolveTracking = resolver;
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
  trackingResolvers.length = 0;
  downloadBlobMock.mockClear();
  toastError.mockClear();
  toastSuccess.mockClear();
  setupDeferredFetch();
});

describe('WeeklyTrackingPage', () => {
  it('shows loading copy before fetch settles', () => {
    render(<WeeklyTrackingPage />);
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

  it('ignores stale tracking GET when period changes before earlier fetch settles', async () => {
    const pendingResolvers = new Map<string, (value: unknown) => void>();
    const period1Payload = {
      ...trackingPayload,
      counts: { ...trackingPayload.counts, obligated: 99 },
    };
    const period2Payload = {
      ...trackingPayload,
      counts: { ...trackingPayload.counts, obligated: 42 },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/weekly-periods') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(periodsFixture),
          });
        }
        if (url.startsWith('/api/weekly-periods/') && url.endsWith('/tracking')) {
          return new Promise((resolve) => {
            pendingResolvers.set(url, (value) =>
              resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve(value),
              }),
            );
          });
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }) as unknown as typeof fetch,
    );

    searchParams = new URLSearchParams('periodId=1');
    const { rerender } = render(<WeeklyTrackingPage />);

    await waitFor(() => {
      expect(pendingResolvers.has('/api/weekly-periods/1/tracking')).toBe(true);
    });

    searchParams = new URLSearchParams('periodId=2');
    rerender(<WeeklyTrackingPage />);

    await waitFor(() => {
      expect(pendingResolvers.has('/api/weekly-periods/2/tracking')).toBe(true);
    });

    pendingResolvers.get('/api/weekly-periods/2/tracking')!(period2Payload);

    await waitFor(() => {
      expect(screen.getByTestId('tracking-counts-bar')).toHaveTextContent('42');
    });

    pendingResolvers.get('/api/weekly-periods/1/tracking')!(period1Payload);

    await waitFor(() => {
      expect(screen.getByTestId('tracking-counts-bar')).toHaveTextContent('42');
      expect(screen.getByTestId('tracking-counts-bar')).not.toHaveTextContent('99');
    });
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

  describe('counts and filters', () => {
    async function renderLoaded() {
      render(<WeeklyTrackingPage />);
      resolvePeriods!(periodsFixture);
      await waitFor(() => {
        expect(resolveTracking).toBeTypeOf('function');
      });
      resolveTracking!(trackingPayload);
      await waitFor(() => {
        expect(screen.getByTestId('tracking-counts-bar')).toBeInTheDocument();
      });
    }

    it('shows six count chips including zeros from fixture', async () => {
      await renderLoaded();

      const bar = screen.getByTestId('tracking-counts-bar');
      expect(bar).toHaveTextContent('Obligated');
      expect(bar).toHaveTextContent('Submitted');
      expect(bar).toHaveTextContent('Draft');
      expect(bar).toHaveTextContent('Not submitted');
      expect(bar).toHaveTextContent('Overdue');
      expect(bar).toHaveTextContent('Late');
      expect(bar).toHaveTextContent('3');
      expect(bar).toHaveTextContent('1');
      expect(bar).toHaveTextContent('0');
    });

    it('resets filter draft when period changes', async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url === '/api/weekly-periods') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(periodsFixture),
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
      });
      vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

      const { rerender } = render(<WeeklyTrackingPage />);

      await waitFor(() => {
        expect(screen.getByTestId('tracking-filter-bar')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'overdue' } });
      expect(screen.getByLabelText('Status')).toHaveValue('overdue');

      searchParams = new URLSearchParams('periodId=1');
      rerender(<WeeklyTrackingPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toHaveValue('');
      });
    });

    it('Apply filters refetches GET with selected query keys only', async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url === '/api/weekly-periods') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(periodsFixture),
          });
        }
        if (url.startsWith('/api/weekly-periods/2/tracking')) {
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
        expect(screen.getByTestId('tracking-filter-bar')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'overdue' } });
      fireEvent.click(screen.getByLabelText('Technology council'));
      fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

      await waitFor(() => {
        const trackingCalls = fetchMock.mock.calls
          .map(([u]) => String(u))
          .filter((u) => u.includes('/tracking'));
        const filteredCall = trackingCalls.find(
          (u) => u.includes('status=overdue') && u.includes('technology_council=true'),
        );
        expect(filteredCall).toBeTruthy();
        expect(filteredCall).not.toMatch(/lateness=/);
        expect(filteredCall).not.toMatch(/pm_user_id=/);
      });
    });
  });

  describe('tracking grid', () => {
    const twoSubmittedPayload = {
      ...trackingPayload,
      rows: [
        { ...trackingPayload.rows[0], project_id: 201, report_id: 601, name: 'First Submitted' },
        { ...trackingPayload.rows[0], project_id: 202, report_id: 602, name: 'Second Submitted' },
        trackingPayload.rows[1],
        trackingPayload.rows[2],
      ],
    };

    async function renderWithPayload(payload: typeof trackingPayload) {
      const fetchMock = vi.fn((url: string) => {
        if (url === '/api/weekly-periods') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(periodsFixture),
          });
        }
        if (url.startsWith('/api/weekly-periods/2/tracking')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(payload),
          });
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      });
      vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
      render(<WeeklyTrackingPage />);
      await waitFor(() => {
        expect(screen.getByTestId('tracking-grid')).toBeInTheDocument();
      });
    }

    it('virtualizes 150 rows to at most 30 DOM nodes', async () => {
      await renderWithPayload({ ...trackingPayload, rows: trackingRows150 });
      const rows = screen.getAllByTestId('virtual-row');
      expect(rows.length).toBeLessThanOrEqual(30);
      expect(rows.length).not.toBe(150);
    });

    it('shows empty grid copy when no rows', async () => {
      await renderWithPayload({ ...trackingPayload, rows: [], counts: { ...trackingPayload.counts, obligated: 0 } });
      expect(screen.getByText('No projects in this period')).toBeInTheDocument();
      expect(
        screen.getByText(
          'This period has no obligated weekly reports, or filters exclude all rows.',
        ),
      ).toBeInTheDocument();
    });

    it('Open report link uses /projects/{id}/weekly-reports/{reportId}', async () => {
      await renderWithPayload(trackingPayload);
      const links = screen.getAllByRole('link', { name: 'Open report' });
      expect(links[0]).toHaveAttribute('href', '/projects/101/weekly-reports/501');
    });
  });

  describe('export pack', () => {
    const twoSubmittedPayload = {
      ...trackingPayload,
      rows: [
        { ...trackingPayload.rows[0], project_id: 201, report_id: 601, name: 'First Submitted' },
        { ...trackingPayload.rows[0], project_id: 202, report_id: 602, name: 'Second Submitted' },
        trackingPayload.rows[1],
        trackingPayload.rows[2],
      ],
    };

    function setupFetchWithExport(
      exportHandler: (url: string, init?: RequestInit) => Promise<Response>,
      payload: typeof trackingPayload = twoSubmittedPayload,
    ) {
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/weekly-periods') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(periodsFixture),
          });
        }
        if (url.startsWith('/api/weekly-periods/2/tracking') && (!init || init.method === undefined)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(payload),
          });
        }
        if (url === '/api/weekly-periods/2/export' && init?.method === 'POST') {
          return exportHandler(url, init);
        }
        return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
      });
      vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
      return fetchMock;
    }

    async function renderExportPage(payload: typeof trackingPayload = twoSubmittedPayload) {
      setupFetchWithExport(
        () =>
          Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({
              'Content-Disposition': 'attachment; filename="weekly-pack.xlsx"',
            }),
            blob: () => Promise.resolve(new Blob(['xlsx'], { type: 'application/vnd.ms-excel' })),
          } as Response),
        payload,
      );
      render(<WeeklyTrackingPage />);
      await waitFor(() => {
        expect(screen.getByTestId('tracking-grid')).toBeInTheDocument();
      });
    }

    it('disables Export pack with hint when selection is empty', async () => {
      await renderExportPage();

      const exportBtn = screen.getByRole('button', { name: 'Export pack' });
      expect(exportBtn).toBeDisabled();
      expect(screen.getByText('Select at least one project to export.')).toBeInTheDocument();
    });

    it('POSTs project_ids in checkbox order with format xlsx on success', async () => {
      const fetchMock = setupFetchWithExport(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Disposition': 'attachment; filename="weekly-pack.xlsx"',
          }),
          blob: () => Promise.resolve(new Blob(['xlsx'], { type: 'application/vnd.ms-excel' })),
        } as Response),
      );

      render(<WeeklyTrackingPage />);
      await waitFor(() => {
        expect(screen.getByTestId('tracking-grid')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Select First Submitted'));
      fireEvent.click(screen.getByLabelText('Select Second Submitted'));
      fireEvent.click(screen.getByRole('button', { name: 'Export pack' }));

      await waitFor(() => {
        const exportCall = fetchMock.mock.calls.find(
          ([u, i]) => u === '/api/weekly-periods/2/export' && (i as RequestInit)?.method === 'POST',
        );
        expect(exportCall).toBeTruthy();
        expect(JSON.parse((exportCall![1] as RequestInit).body as string)).toEqual({
          project_ids: [201, 202],
          format: 'xlsx',
        });
        expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'weekly-pack.xlsx');
        expect(toastSuccess).toHaveBeenCalledWith('Export downloaded');
      });
    });

    it('shows failure toast and skips downloadBlob on 400', async () => {
      setupFetchWithExport(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'Ineligible', fields: ['project_ids'] }),
        } as Response),
      );

      render(<WeeklyTrackingPage />);
      await waitFor(() => {
        expect(screen.getByTestId('tracking-grid')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Select First Submitted'));
      fireEvent.click(screen.getByRole('button', { name: 'Export pack' }));

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Export failed — try again.');
      });
      expect(downloadBlobMock).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Export pack' })).not.toBeDisabled();
    });

    it('disables Export pack and shows Exporting… while POST is in-flight', async () => {
      let resolveExport: ((value: Response) => void) | null = null;
      setupFetchWithExport(
        () =>
          new Promise((resolve) => {
            resolveExport = resolve;
          }),
      );

      render(<WeeklyTrackingPage />);
      await waitFor(() => {
        expect(screen.getByTestId('tracking-grid')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Select First Submitted'));
      fireEvent.click(screen.getByRole('button', { name: 'Export pack' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Exporting…' })).toBeDisabled();
      });

      resolveExport!({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="weekly-pack.xlsx"',
        }),
        blob: () => Promise.resolve(new Blob(['xlsx'])),
      } as Response);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Export pack' })).not.toBeDisabled();
      });
    });

    it('POSTs format docx when docx is selected', async () => {
      const fetchMock = setupFetchWithExport(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Disposition': 'attachment; filename="weekly-pack.docx"',
          }),
          blob: () =>
            Promise.resolve(
              new Blob(['docx'], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              }),
            ),
        } as Response),
      );

      render(<WeeklyTrackingPage />);
      await waitFor(() => {
        expect(screen.getByTestId('tracking-grid')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Export format'), { target: { value: 'docx' } });
      fireEvent.click(screen.getByLabelText('Select First Submitted'));
      fireEvent.click(screen.getByRole('button', { name: 'Export pack' }));

      await waitFor(() => {
        const exportCall = fetchMock.mock.calls.find(
          ([u, i]) => u === '/api/weekly-periods/2/export' && (i as RequestInit)?.method === 'POST',
        );
        expect(JSON.parse((exportCall![1] as RequestInit).body as string).format).toBe('docx');
      });
    });

    it('POSTs format pptx when pptx is selected', async () => {
      const fetchMock = setupFetchWithExport(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Disposition': 'attachment; filename="weekly-pack.pptx"',
          }),
          blob: () =>
            Promise.resolve(
              new Blob(['pptx'], {
                type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              }),
            ),
        } as Response),
      );

      render(<WeeklyTrackingPage />);
      await waitFor(() => {
        expect(screen.getByTestId('tracking-grid')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Export format'), { target: { value: 'pptx' } });
      fireEvent.click(screen.getByLabelText('Select First Submitted'));
      fireEvent.click(screen.getByRole('button', { name: 'Export pack' }));

      await waitFor(() => {
        const exportCall = fetchMock.mock.calls.find(
          ([u, i]) => u === '/api/weekly-periods/2/export' && (i as RequestInit)?.method === 'POST',
        );
        expect(JSON.parse((exportCall![1] as RequestInit).body as string).format).toBe('pptx');
      });
    });

    it('sends unique project_ids when select-all follows partial selection', async () => {
      const fetchMock = setupFetchWithExport(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Disposition': 'attachment; filename="weekly-pack.xlsx"',
          }),
          blob: () => Promise.resolve(new Blob(['xlsx'])),
        } as Response),
      );

      render(<WeeklyTrackingPage />);
      await waitFor(() => {
        expect(screen.getByTestId('tracking-grid')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Select First Submitted'));
      fireEvent.click(screen.getByLabelText('Select all submitted'));
      fireEvent.click(screen.getByRole('button', { name: 'Export pack' }));

      await waitFor(() => {
        const exportCall = fetchMock.mock.calls.find(
          ([u, i]) => u === '/api/weekly-periods/2/export' && (i as RequestInit)?.method === 'POST',
        );
        const body = JSON.parse((exportCall![1] as RequestInit).body as string);
        expect(body.project_ids).toEqual([201, 202]);
        expect(body.project_ids.length).toBe(new Set(body.project_ids).size);
      });
    });
  });
});
