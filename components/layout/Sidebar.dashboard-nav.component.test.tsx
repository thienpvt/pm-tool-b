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

describe('Sidebar dashboard nav links', () => {
  beforeEach(() => {
    mockPathname = '/';
  });

  it('shows Spec dashboard and My dashboard for cpmo', async () => {
    stubFetch(['cpmo']);
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Spec dashboard' })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'My dashboard' })).toHaveAttribute('href', '/dashboards/pm');
    expect(screen.getByRole('link', { name: 'Spec dashboard' })).toHaveAttribute('href', '/dashboards/portfolio');
  });

  it('shows My dashboard only for pm role', async () => {
    stubFetch(['pm']);
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'My dashboard' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Spec dashboard' })).not.toBeInTheDocument();
  });

  it('shows neither link for viewer role', async () => {
    stubFetch(['viewer']);
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Portfolio' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Spec dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My dashboard' })).not.toBeInTheDocument();
  });

  it('shows neither link when roles are missing', async () => {
    stubFetch(undefined);
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Portfolio' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Spec dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My dashboard' })).not.toBeInTheDocument();
  });

  it('applies active classes on Spec dashboard when pathname matches', async () => {
    mockPathname = '/dashboards/portfolio';
    stubFetch(['cpmo']);
    render(<Sidebar />);
    const link = await screen.findByRole('link', { name: 'Spec dashboard' });
    expect(link.className).toMatch(/bg-blue-600/);
    expect(link.className).toMatch(/text-white/);
  });
});
