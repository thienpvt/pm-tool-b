import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function stubFetch(roles: string[] | undefined) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              username: 'user1',
              display_name: 'User One',
              company_name: 'Acme',
              is_admin: 0,
              roles,
            }),
        });
      }
      if (url === '/api/projects') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch,
  );
}

describe('Sidebar document nav links', () => {
  beforeEach(() => {
    mockPathname = '/';
  });

  it('shows Catalog, Compliance, and Audit log for cpmo with correct hrefs', async () => {
    stubFetch(['cpmo']);
    render(<Sidebar />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument(),
    );

    expect(screen.getByRole('link', { name: 'Catalog' })).toHaveAttribute(
      'href',
      '/documents/catalog',
    );
    expect(screen.getByRole('link', { name: 'Compliance' })).toHaveAttribute(
      'href',
      '/documents/compliance',
    );
    expect(screen.getByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/audit');
  });

  it('cpmo still sees Weekly periods after document links are added', async () => {
    stubFetch(['cpmo']);
    render(<Sidebar />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Weekly periods' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: 'Weekly tracking' })).toBeInTheDocument();
  });

  it('hides document and audit links for pm-only role', async () => {
    stubFetch(['pm']);
    render(<Sidebar />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'My dashboard' })).toBeInTheDocument(),
    );

    expect(screen.queryByRole('link', { name: 'Catalog' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Compliance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
  });

  it('hides document and audit links for viewer role', async () => {
    stubFetch(['viewer']);
    render(<Sidebar />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Portfolio' })).toBeInTheDocument(),
    );

    expect(screen.queryByRole('link', { name: 'Catalog' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Compliance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
  });

  it('applies active classes on Catalog when pathname matches', async () => {
    mockPathname = '/documents/catalog';
    stubFetch(['cpmo']);
    render(<Sidebar />);

    const link = await screen.findByRole('link', { name: 'Catalog' });
    expect(link.className).toMatch(/bg-blue-600/);
    expect(link.className).toMatch(/text-white/);
  });

  it('does not show a Document checklist sidebar link', async () => {
    stubFetch(['cpmo']);
    render(<Sidebar />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('link', { name: 'Document checklist' })).not.toBeInTheDocument();
  });
});
