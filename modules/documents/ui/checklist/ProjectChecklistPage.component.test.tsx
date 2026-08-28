import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checklistFixture } from '../shared/documents.fixture';
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
