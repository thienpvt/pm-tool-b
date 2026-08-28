import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checklistFixture,
  emptyChecklistFixture,
} from '../shared/documents.fixture';
import type { ChecklistItem } from '../shared/types';
import ProjectChecklistPage from './ProjectChecklistPage';

const mockParams = vi.hoisted(() => ({ id: '42' }));

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  usePathname: () => `/projects/${mockParams.id}/document-checklist`,
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

let resolveChecklist: ((value: unknown) => void) | null = null;

function setupDeferredFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/projects/42/document-checklist' && (!init || init.method === undefined)) {
        return new Promise((resolve) => {
          resolveChecklist = (value) =>
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(value),
            });
        });
      }
      if (url === '/api/projects/42' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ name: 'Alpha Project' }),
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
      if (url === '/api/projects/42/document-checklist' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve({ error: 'fail' }),
        });
      }
      if (url === '/api/projects/42' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ name: 'Alpha Project' }),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
    }) as unknown as typeof fetch,
  );
}

function setupChecklistFetch(opts?: {
  items?: ChecklistItem[];
  patchStatus?: number;
  patchBody?: unknown;
  onPatch?: (body: Record<string, unknown>) => void;
}) {
  const items = opts?.items ?? checklistFixture;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.match(/\/api\/projects\/42\/document-checklist\/\d+/) && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        opts?.onPatch?.(body);
        const status = opts?.patchStatus ?? 200;
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () =>
            Promise.resolve(
              status >= 200 && status < 300
                ? { ...items[0], ...body }
                : (opts?.patchBody ?? { error: 'fail' }),
            ),
        });
      }
      if (url === '/api/projects/42/document-checklist' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(items),
        });
      }
      if (url === '/api/projects/42' && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ name: 'Alpha Project' }),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
    }) as unknown as typeof fetch,
  );
}

beforeEach(() => {
  mockParams.id = '42';
  resolveChecklist = null;
  toastError.mockClear();
  toastSuccess.mockClear();
  setupDeferredFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProjectChecklistPage GET shell', () => {
  it('shows sidebar and loading copy before fetch settles', () => {
    render(<ProjectChecklistPage />);
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-project-id', '42');
    expect(screen.getByText('Loading checklist…')).toBeInTheDocument();
  });

  it('renders title and checklist rows after GET 200', async () => {
    render(<ProjectChecklistPage />);
    resolveChecklist!(checklistFixture);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Document checklist' })).toBeInTheDocument();
    });

    expect(screen.getByText('Charter')).toBeInTheDocument();
  });

  it('shows 403 forbidden copy in-page', async () => {
    setupStatusFetch(403);
    render(<ProjectChecklistPage />);

    await waitFor(() => {
      expect(screen.getByText("You don't have access to this page.")).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Document checklist' })).not.toBeInTheDocument();
  });
});

describe('ProjectChecklistPage PATCH editor', () => {
  it('shows empty state when checklist has zero items', async () => {
    setupChecklistFetch({ items: emptyChecklistFixture() });
    render(<ProjectChecklistPage />);

    await waitFor(() => {
      expect(screen.getByText('No checklist items yet')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Checklist rows appear when the project stage matches catalog items.'),
    ).toBeInTheDocument();
  });

  it('shows status badge and Edit checklist item on populated row', async () => {
    setupChecklistFetch({ items: [checklistFixture[0]] });
    render(<ProjectChecklistPage />);

    await waitFor(() => {
      expect(screen.getByText('Drafting')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Edit checklist item' })).toBeInTheDocument();
  });

  it('shows approved fields when status is approved', async () => {
    const approvedItem = {
      ...checklistFixture[0],
      status: 'approved' as const,
      approved_at: '2026-01-15',
      approved_by: 'user1',
      confluence_url: 'https://example.com/confluence/123',
    };
    setupChecklistFetch({ items: [approvedItem] });
    render(<ProjectChecklistPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit checklist item' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit checklist item' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Approved date')).toBeInTheDocument();
      expect(screen.getByLabelText('Approved by')).toBeInTheDocument();
    });
  });

  it('shows N/A reason when status is not applicable', async () => {
    const naItem = {
      ...checklistFixture[0],
      status: 'not_applicable' as const,
      na_reason: 'Not required for this project type',
    };
    setupChecklistFetch({ items: [naItem] });
    render(<ProjectChecklistPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit checklist item' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit checklist item' }));

    await waitFor(() => {
      expect(screen.getByLabelText('N/A reason')).toBeInTheDocument();
    });
  });

  it('renders PATCH 400 field error and validation toast', async () => {
    setupChecklistFetch({
      items: [checklistFixture[0]],
      patchStatus: 400,
      patchBody: {
        error: 'confluence_url must use https://',
        field: 'confluence_url',
      },
    });
    render(<ProjectChecklistPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit checklist item' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit checklist item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save checklist item' }));

    await waitFor(() => {
      expect(screen.getByText('confluence_url must use https://')).toBeInTheDocument();
    });
    expect(toastError).toHaveBeenCalledWith('Fix the highlighted field and try again.');
  });

  it('toasts success on PATCH 200', async () => {
    setupChecklistFetch({ items: [checklistFixture[0]], patchStatus: 200 });
    render(<ProjectChecklistPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit checklist item' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit checklist item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save checklist item' }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Checklist item saved');
    });
  });

  it('does not render a file input', async () => {
    setupChecklistFetch({ items: [checklistFixture[0]] });
    render(<ProjectChecklistPage />);

    await waitFor(() => {
      expect(screen.getByText('Charter')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit checklist item' }));
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
