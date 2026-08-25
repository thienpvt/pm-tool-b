import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImportMappingDialog from './ImportMappingDialog';

const CSV_FIXTURE = `"Activity","Status","Plan Start"
"Build API","In Progress","2026-01-01"
"SIT","To Do","2026-04-01"`;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/import-mapping') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url === '/api/projects/1/activities/import' && (!init || init.method === undefined || init.method === 'GET')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url === '/api/projects/1/activities/import' && init?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ inserted: 2, updated: 0, errors: [] }) });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as typeof fetch);
});

describe('ImportMappingDialog', () => {
  it('renders dialog open with mocked import-mapping and activities/import fetch', async () => {
    render(
      <ImportMappingDialog
        open
        onOpenChange={() => {}}
        projectId="1"
        onImported={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText('Import Activities')).toBeInTheDocument());
    expect(screen.getByText('Upload / Paste')).toBeInTheDocument();
    expect(screen.getByText('Map cột')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/import-mapping');
    expect(fetch).toHaveBeenCalledWith('/api/projects/1/activities/import');
  });

  it('advances mapping step via paste text without error', async () => {
    render(
      <ImportMappingDialog
        open
        onOpenChange={() => {}}
        projectId="1"
        onImported={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText('Import Activities')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Paste text/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: CSV_FIXTURE } });

    await waitFor(() => {
      expect(screen.getByText(/3 cột · 2 dòng/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/i }));

    await waitFor(() => {
      expect(screen.getByText('Map cột')).toBeInTheDocument();
      expect(screen.getByText('Trường trong Timeline')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Xem trước/i }));

    await waitFor(() => {
      expect(screen.getByText(/Xem trước \d+ dòng đầu/)).toBeInTheDocument();
    });
  });
});
