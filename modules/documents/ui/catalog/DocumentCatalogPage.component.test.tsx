import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogFixture, emptyCatalogFixture } from '../shared/documents.fixture';
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

  it('shows 401 session expired copy in-page', async () => {
    setupStatusFetch(401);
    render(<DocumentCatalogPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Session expired — refresh the page and sign in again.'),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId('catalog-list')).not.toBeInTheDocument();
  });

  it('shows empty state copy when no catalog rows', async () => {
    setupStatusFetch(200, emptyCatalogFixture());
    render(<DocumentCatalogPage />);

    await waitFor(() => {
      expect(screen.getByText('No catalog items yet')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Add the first required document type for your company above.'),
    ).toBeInTheDocument();
    expect(screen.getByText('0 items')).toBeInTheDocument();
  });

  it('uses singular subtitle for one active item', async () => {
    setupStatusFetch(200, catalogFixture);
    render(<DocumentCatalogPage />);

    await waitFor(() => {
      expect(screen.getByText('1 item')).toBeInTheDocument();
    });
  });

  it('uses plural subtitle for two active items', async () => {
    setupStatusFetch(200, catalogFixture.map((row) => ({ ...row, active: true })));
    render(<DocumentCatalogPage />);

    await waitFor(() => {
      expect(screen.getByText('2 items')).toBeInTheDocument();
    });
  });

  it('wraps catalog list in overflow-x-auto container', async () => {
    setupStatusFetch(200, catalogFixture);
    render(<DocumentCatalogPage />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-list')).toBeInTheDocument();
    });
    const list = screen.getByTestId('catalog-list');
    expect(list.querySelector('.overflow-x-auto')).toBeTruthy();
  });

  it('applies line-through styling to retired catalog row name', async () => {
    setupStatusFetch(200, catalogFixture);
    render(<DocumentCatalogPage />);

    await waitFor(() => {
      expect(screen.getByText('SoW')).toBeInTheDocument();
    });
    const sow = screen.getByText('SoW');
    expect(sow.className).toMatch(/line-through/);
    expect(sow.className).toMatch(/text-slate-400/);
  });

  it('shows templates no-selection prompt when no row is selected', async () => {
    setupStatusFetch(200, catalogFixture);
    render(<DocumentCatalogPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Select a catalog item to manage templates.'),
      ).toBeInTheDocument();
    });
  });
});

describe('app/documents/catalog re-export', () => {
  it('re-exports DocumentCatalogPage as default', async () => {
    const mod = await import('@/app/documents/catalog/page');
    expect(mod.default).toBe(DocumentCatalogPage);
  });
});
