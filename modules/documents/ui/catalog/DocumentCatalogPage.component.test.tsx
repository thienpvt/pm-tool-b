import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogFixture } from '../shared/documents.fixture';
import DocumentCatalogPage from './DocumentCatalogPage';

vi.mock('next/navigation', () => ({ usePathname: () => '/documents/catalog' }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

let resolveCatalog: ((value: unknown) => void) | null = null;

function setupDeferredFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/document-catalog') {
        return new Promise((resolve) => {
          resolveCatalog = (value) =>
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
      if (url === '/api/document-catalog') {
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
  resolveCatalog = null;
  setupDeferredFetch();
});

describe('DocumentCatalogPage', () => {
  it('shows sidebar and loading copy before fetch settles', () => {
    render(<DocumentCatalogPage />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('Loading document catalog…')).toBeInTheDocument();
  });

  it('renders title and catalog rows after GET 200', async () => {
    render(<DocumentCatalogPage />);
    resolveCatalog!(catalogFixture);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Document catalog' })).toBeInTheDocument();
    });

    expect(screen.getByText('Charter')).toBeInTheDocument();
    expect(screen.getByText('L2')).toBeInTheDocument();
  });

  it('shows 403 forbidden copy in-page', async () => {
    setupStatusFetch(403);
    render(<DocumentCatalogPage />);

    await waitFor(() => {
      expect(screen.getByText("You don't have access to this page.")).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Document catalog' })).not.toBeInTheDocument();
  });
});

describe('app/documents/catalog re-export', () => {
  it('re-exports DocumentCatalogPage as default', async () => {
    const mod = await import('@/app/documents/catalog/page');
    expect(mod.default).toBe(DocumentCatalogPage);
  });
});
