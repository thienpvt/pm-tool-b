import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { complianceFixture } from '../shared/documents.fixture';
import DocumentCompliancePage from './DocumentCompliancePage';

vi.mock('next/navigation', () => ({ usePathname: () => '/documents/compliance' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

let resolveCompliance: ((value: unknown) => void) | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

function setupDeferredComplianceFetch() {
  fetchMock = vi.fn((url: string) => {
    if (typeof url === 'string' && url.startsWith('/api/dashboards/document-compliance')) {
      return new Promise((resolve) => {
        resolveCompliance = (value) =>
          resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(value),
          });
      });
    }
    if (url === '/api/programs') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
}

function setupStatusFetch(status: number, body: unknown = complianceFixture) {
  fetchMock = vi.fn((url: string) => {
    if (typeof url === 'string' && url.startsWith('/api/dashboards/document-compliance')) {
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      });
    }
    if (url === '/api/programs') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  resolveCompliance = null;
  toastError.mockClear();
  setupDeferredComplianceFetch();
});

describe('DocumentCompliancePage', () => {
  it('shows sidebar and loading copy before fetch settles', () => {
    render(<DocumentCompliancePage />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('Loading compliance…')).toBeInTheDocument();
  });

  it('renders title and fixture project name after GET 200', async () => {
    render(<DocumentCompliancePage />);
    resolveCompliance!(complianceFixture);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Document compliance' })).toBeInTheDocument();
    });
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
  });

  it('shows 403 forbidden copy in-page', async () => {
    setupStatusFetch(403, {});
    render(<DocumentCompliancePage />);

    await waitFor(() => {
      expect(screen.getByText("You don't have access to this page.")).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Document compliance' })).not.toBeInTheDocument();
  });
});
