import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogFixture, emptyCatalogFixture } from '../shared/documents.fixture';
import DocumentCatalogPage from './DocumentCatalogPage';

vi.mock('next/navigation', () => ({
  usePathname: () => '/documents/catalog',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

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
  toastError.mockClear();
  toastSuccess.mockClear();
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
    const list = screen.getByTestId('catalog-list');
    expect(list.textContent).toContain('L2');
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

  describe('create catalog item', () => {
    const newItem = {
      id: 3,
      company_id: 1,
      name: 'Risk Register',
      purpose: 'Project risks',
      stage: 'L3',
      mandatory: false,
      active: true,
      created_at: '2026-08-28T00:00:00.000Z',
      updated_at: '2026-08-28T00:00:00.000Z',
    };

    it('POSTs name and apply_to_in_flight then toasts success and reloads list', async () => {
      let posted = false;
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/document-catalog' && init?.method === 'POST') {
          const body = JSON.parse(String(init.body));
          expect(body.name).toBe('Risk Register');
          expect(body).toHaveProperty('apply_to_in_flight');
          posted = true;
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () => Promise.resolve(newItem),
          });
        }
        if (url === '/api/document-catalog' && (!init || init.method === undefined)) {
          const list = posted ? [...catalogFixture, newItem] : catalogFixture;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(list),
          });
        }
        return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
      });
      vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByTestId('catalog-create-form')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Risk Register' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add catalog item' }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/document-catalog',
          expect.objectContaining({ method: 'POST' }),
        );
        expect(toastSuccess).toHaveBeenCalledWith('Catalog item added');
        expect(screen.getByText('Risk Register')).toBeInTheDocument();
      });
    });

    it('toasts create error when POST fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/document-catalog' && init?.method === 'POST') {
            return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) });
          }
          if (url === '/api/document-catalog' && (!init || init.method === undefined)) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(catalogFixture),
            });
          }
          return Promise.reject(new Error(`unexpected fetch: ${url}`));
        }) as unknown as typeof fetch,
      );

      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByTestId('catalog-create-form')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bad Item' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add catalog item' }));

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith(
          "Couldn't add catalog item. Check the fields and try again.",
        );
      });
    });

    it('disables Add catalog item while POST is in-flight', async () => {
      let resolvePost: ((value: unknown) => void) | null = null;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/document-catalog' && init?.method === 'POST') {
            return new Promise((resolve) => {
              resolvePost = (value) =>
                resolve({
                  ok: true,
                  status: 201,
                  json: () => Promise.resolve(newItem),
                  ...(value as object),
                });
            });
          }
          if (url === '/api/document-catalog' && (!init || init.method === undefined)) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(catalogFixture),
            });
          }
          return Promise.reject(new Error(`unexpected fetch: ${url}`));
        }) as unknown as typeof fetch,
      );

      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByTestId('catalog-create-form')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Risk Register' } });
      const addBtn = screen.getByRole('button', { name: 'Add catalog item' });
      fireEvent.click(addBtn);

      await waitFor(() => {
        expect(addBtn).toBeDisabled();
      });

      resolvePost!({});
    });
  });
});

describe('app/documents/catalog re-export', () => {
  it('re-exports DocumentCatalogPage as default', async () => {
    const mod = await import('@/app/documents/catalog/page');
    expect(mod.default).toBe(DocumentCatalogPage);
  });
});
