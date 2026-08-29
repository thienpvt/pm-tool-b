import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  catalogFixture,
  emptyCatalogFixture,
  emptyTemplatesFixture,
  templatesFixture,
} from '../shared/documents.fixture';
import DocumentCatalogPage from './DocumentCatalogPage';

vi.mock('next/navigation', () => ({
  usePathname: () => '/documents/catalog',
  useSearchParams: () => new URLSearchParams(),
}));
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
  it('shows loading copy before fetch settles', () => {
    render(<DocumentCatalogPage />);
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

  describe('edit and retire catalog item', () => {
    it('pre-fills edit form and PATCHes on save', async () => {
      let saved = false;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/document-catalog/1' && init?.method === 'PATCH') {
            const body = JSON.parse(String(init.body));
            expect(body.name).toBe('Charter Updated');
            saved = true;
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({ ...catalogFixture[0], name: 'Charter Updated' }),
            });
          }
          if (url === '/api/document-catalog' && (!init || init.method === undefined)) {
            const list = saved
              ? catalogFixture.map((r) =>
                  r.id === 1 ? { ...r, name: 'Charter Updated' } : r,
                )
              : catalogFixture;
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(list),
            });
          }
          return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
        }) as unknown as typeof fetch,
      );

      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByTestId('catalog-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('button', { name: 'Edit catalog item' })[0]);

      await waitFor(() => {
        expect(screen.getByTestId('catalog-edit-form')).toBeInTheDocument();
      });

      const editForm = screen.getByTestId('catalog-edit-form');
      expect(editForm.querySelector('input[aria-label="Name"]')).toHaveValue('Charter');

      fireEvent.change(editForm.querySelector('input[aria-label="Name"]')!, {
        target: { value: 'Charter Updated' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save catalog item' }));

      await waitFor(() => {
        expect(toastSuccess).toHaveBeenCalledWith('Catalog item saved');
      });
    });

    it('retire dialog PATCHes active false and toasts success', async () => {
      let patched = false;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url === '/api/document-catalog/1' && init?.method === 'PATCH') {
            const body = JSON.parse(String(init.body));
            if (body.active === false) {
              patched = true;
              return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                  Promise.resolve({ ...catalogFixture[0], active: false }),
              });
            }
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(catalogFixture[0]),
            });
          }
          if (url === '/api/document-catalog' && (!init || init.method === undefined)) {
            const list = patched
              ? catalogFixture.map((r) => (r.id === 1 ? { ...r, active: false } : r))
              : catalogFixture;
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(list),
            });
          }
          return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
        }) as unknown as typeof fetch,
      );

      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByTestId('catalog-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('button', { name: 'Retire item' })[0]);

      await waitFor(() => {
        expect(screen.getByText('Retire this catalog item?')).toBeInTheDocument();
        expect(
          screen.getByText(
            "Existing checklist rows remain; new projects won't receive this item.",
          ),
        ).toBeInTheDocument();
      });

      const confirmButtons = screen.getAllByRole('button', { name: 'Retire item' });
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(patched).toBe(true);
        expect(toastSuccess).toHaveBeenCalledWith('Catalog item retired');
      });
    });
  });

  describe('templates panel', () => {
    function setupCatalogWithTemplates(templates: typeof templatesFixture) {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url.startsWith('/api/document-templates?catalog_id=1')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(templates),
            });
          }
          if (url === '/api/document-templates' && init?.method === 'POST') {
            const body = JSON.parse(String(init.body));
            if (!body.template_url?.startsWith('https://')) {
              return Promise.resolve({
                ok: false,
                status: 400,
                json: () =>
                  Promise.resolve({
                    error: 'Template URL must be HTTPS',
                    field: 'template_url',
                  }),
              });
            }
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () =>
                Promise.resolve({
                  ...templatesFixture[0],
                  name: body.name,
                  template_url: body.template_url,
                }),
            });
          }
          if (url === '/api/document-templates/1' && init?.method === 'PATCH') {
            const body = JSON.parse(String(init.body));
            expect(body).toEqual({ retire: true });
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ ...templatesFixture[0], retired_at: '2026-08-28' }),
            });
          }
          if (url === '/api/document-catalog' && (!init || init.method === undefined)) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(catalogFixture),
            });
          }
          return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`));
        }) as unknown as typeof fetch,
      );
    }

    it('GETs templates when a catalog row is selected', async () => {
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (url.startsWith('/api/document-templates?catalog_id=1')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(emptyTemplatesFixture()),
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
      });
      vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByText('Charter')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Charter'));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/document-templates?catalog_id=1');
        expect(screen.getByText('No templates for this item')).toBeInTheDocument();
        expect(
          screen.getByText('Publish a template URL to give PMs a starting link.'),
        ).toBeInTheDocument();
      });
    });

    it('ignores stale template GET when catalog selection changes quickly', async () => {
      const charterTemplates = templatesFixture;
      const sowTemplates = [
        {
          ...templatesFixture[0],
          id: 99,
          catalog_id: 2,
          name: 'SoW template v1',
          template_url: 'https://example.com/templates/sow',
        },
      ];

      const pending: Record<number, (value: unknown) => void> = {};
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
          if (url.startsWith('/api/document-templates?catalog_id=')) {
            const catalogId = Number(url.split('=')[1]);
            return new Promise((resolve) => {
              pending[catalogId] = (value) =>
                resolve({
                  ok: true,
                  status: 200,
                  json: () => Promise.resolve(value),
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
        expect(screen.getByText('Charter')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Charter'));
      fireEvent.click(screen.getByText('SoW'));

      pending[2]!(sowTemplates);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /sow template v1/i })).toBeInTheDocument();
      });

      pending[1]!(charterTemplates);

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: /charter template v1/i })).not.toBeInTheDocument();
      });
      expect(screen.getByRole('link', { name: /sow template v1/i })).toBeInTheDocument();
    });

    it('shows populated template list with external HTTPS link', async () => {
      setupCatalogWithTemplates(templatesFixture);
      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByText('Charter')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Charter'));

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /charter template v1/i });
        expect(link).toHaveAttribute('href', 'https://example.com/templates/charter');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link.getAttribute('rel')).toMatch(/noopener/);
      });
    });

    it('renders non-HTTPS template URL as plain text without anchor', async () => {
      setupCatalogWithTemplates([
        {
          ...templatesFixture[0],
          template_url: 'javascript:alert(1)',
        },
      ]);
      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByText('Charter')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Charter'));

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: /charter template v1/i })).not.toBeInTheDocument();
        expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument();
      });
    });

    it('shows inline error for invalid template URL', async () => {
      setupCatalogWithTemplates(emptyTemplatesFixture());
      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByText('Charter')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Charter'));

      await waitFor(() => {
        expect(screen.getByTestId('templates-panel')).toBeInTheDocument();
      });

      const panel = screen.getByTestId('templates-panel');

      fireEvent.change(panel.querySelector('input[aria-label="Template URL"]')!, {
        target: { value: 'http://not-secure.example.com/doc' },
      });
      fireEvent.change(panel.querySelector('input[aria-label="Name"]')!, {
        target: { value: 'New template' },
      });
      fireEvent.change(panel.querySelector('input[aria-label="Document type"]')!, {
        target: { value: 'charter' },
      });
      fireEvent.change(panel.querySelector('input[aria-label="Effective date"]')!, {
        target: { value: '2026-08-28' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Publish template' }));

      await waitFor(() => {
        expect(screen.getByText('Template URL must use HTTPS')).toBeInTheDocument();
      });
    });

    it('POSTs template and toasts Template published', async () => {
      setupCatalogWithTemplates(emptyTemplatesFixture());
      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByText('Charter')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Charter'));

      await waitFor(() => {
        expect(screen.getByTestId('templates-panel')).toBeInTheDocument();
      });

      const panel = screen.getByTestId('templates-panel');

      fireEvent.change(panel.querySelector('input[aria-label="Name"]')!, {
        target: { value: 'New template' },
      });
      fireEvent.change(panel.querySelector('input[aria-label="Document type"]')!, {
        target: { value: 'charter' },
      });
      fireEvent.change(panel.querySelector('input[aria-label="Effective date"]')!, {
        target: { value: '2026-08-28' },
      });
      fireEvent.change(panel.querySelector('input[aria-label="Template URL"]')!, {
        target: { value: 'https://example.com/new-template' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Publish template' }));

      await waitFor(() => {
        expect(toastSuccess).toHaveBeenCalledWith('Template published');
      });
    });

    it('PATCHes retire true when retiring a template', async () => {
      setupCatalogWithTemplates(templatesFixture);
      render(<DocumentCatalogPage />);

      await waitFor(() => {
        expect(screen.getByText('Charter')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Charter'));

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /charter template v1/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Retire template' }));

      await waitFor(() => {
        expect(toastSuccess).toHaveBeenCalledWith('Template retired');
      });
    });
  });
});

describe('app/documents/catalog PageChrome wrapper', () => {
  it('wraps DocumentCatalogPage with PageChrome', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const mod = await import('@/app/documents/catalog/page');
    expect(typeof mod.default).toBe('function');
    const source = readFileSync(resolve(process.cwd(), 'app/documents/catalog/page.tsx'), 'utf8');
    expect(source).toContain('PageChrome');
    expect(source).toContain('DocumentCatalogPage');
  });
});
