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

describe('Sidebar weekly nav links', () => {
  beforeEach(() => {
    mockPathname = '/';
  });

  it('shows Weekly periods and Weekly tracking for cpmo', async () => {
    stubFetch(['cpmo']);
    render(<Sidebar />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Weekly periods' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: 'Weekly periods' })).toHaveAttribute(
      'href',
      '/weekly/periods',
    );
    expect(screen.getByRole('link', { name: 'Weekly tracking' })).toHaveAttribute(
      'href',
      '/weekly/tracking',
    );
  });

  it('hides weekly links for pm-only role', async () => {
    stubFetch(['pm']);
    render(<Sidebar />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'My dashboard' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('link', { name: 'Weekly periods' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Weekly tracking' })).not.toBeInTheDocument();
  });

  it('hides weekly links for viewer role', async () => {
    stubFetch(['viewer']);
    render(<Sidebar />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Portfolio' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('link', { name: 'Weekly periods' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Weekly tracking' })).not.toBeInTheDocument();
  });

  it('applies active classes on Weekly tracking when pathname matches', async () => {
    mockPathname = '/weekly/tracking';
    stubFetch(['cpmo']);
    render(<Sidebar />);
    const link = await screen.findByRole('link', { name: 'Weekly tracking' });
    expect(link.className).toMatch(/bg-blue-600/);
    expect(link.className).toMatch(/text-white/);
  });
});
