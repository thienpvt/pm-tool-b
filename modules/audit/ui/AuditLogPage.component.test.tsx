import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auditRowsFixture, auditRows150 } from '@/modules/documents/ui/shared/documents.fixture';
import AuditLogPage from './AuditLogPage';

vi.mock('next/navigation', () => ({ usePathname: () => '/audit' }));

let resolveAudit: ((value: unknown) => void) | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

function setupDeferredAuditFetch() {
  fetchMock = vi.fn((url: string) => {
    if (typeof url === 'string' && url.startsWith('/api/audit')) {
      return new Promise((resolve) => {
        resolveAudit = (value) =>
          resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(value),
          });
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
}

function setupStatusFetch(status: number, body: unknown = auditRowsFixture) {
  fetchMock = vi.fn((url: string) => {
    if (typeof url === 'string' && url.startsWith('/api/audit')) {
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  resolveAudit = null;
  setupDeferredAuditFetch();
});

describe('AuditLogPage', () => {
  it('shows loading copy before fetch settles', () => {
    render(<AuditLogPage />);
    expect(screen.getByText('Loading audit log…')).toBeInTheDocument();
  });

  it('renders title and subtitle after GET 200', async () => {
    render(<AuditLogPage />);
    resolveAudit!(auditRowsFixture);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    });
    expect(screen.getByText('Append-only company audit trail')).toBeInTheDocument();
  });

  it('shows 403 forbidden copy in-page', async () => {
    setupStatusFetch(403, {});
    render(<AuditLogPage />);

    await waitFor(() => {
      expect(screen.getByText("You don't have access to this page.")).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Audit log' })).not.toBeInTheDocument();
  });

  it('Apply filters GETs entity_type and limit query keys', async () => {
    render(<AuditLogPage />);
    resolveAudit!(auditRowsFixture);

    await waitFor(() => expect(screen.getByLabelText('Entity type')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Entity type'), {
      target: { value: 'document_catalog' },
    });
    fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      const applyCall = fetchMock.mock.calls.find(
        ([url]) =>
          typeof url === 'string' &&
          url.startsWith('/api/audit') &&
          url.includes('entity_type=document_catalog') &&
          url.includes('limit=100'),
      );
      expect(applyCall).toBeTruthy();
    });
  });

  it('shows actor_id and action for fixture rows', async () => {
    render(<AuditLogPage />);
    resolveAudit!(auditRowsFixture);

    await waitFor(() => expect(screen.getByText('create')).toBeInTheDocument());
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.getByText('update')).toBeInTheDocument();
  });

  it('shows empty audit copy when rows array is empty', async () => {
    render(<AuditLogPage />);
    resolveAudit!([]);

    await waitFor(() => {
      expect(screen.getByText('No audit entries found')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Broaden the date range or clear entity filters.'),
    ).toBeInTheDocument();
  });

  it('expands and collapses before/after JSON in pre elements', async () => {
    render(<AuditLogPage />);
    resolveAudit!(auditRowsFixture);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Show audit details' }).length).toBeGreaterThan(0));

    const row = auditRowsFixture[0]!;
    const detailsButton = screen.getAllByRole('button', { name: 'Show audit details' })[0]!;

    fireEvent.click(detailsButton);

    await waitFor(() => {
      const pres = document.querySelectorAll('pre');
      expect(pres.length).toBe(2);
      expect(pres[0]!.textContent).toBe(JSON.stringify(row.before, null, 2));
      expect(pres[1]!.textContent).toBe(JSON.stringify(row.after, null, 2));
    });

    fireEvent.click(detailsButton);

    await waitFor(() => {
      expect(document.querySelectorAll('pre').length).toBe(0);
    });
  });

  it('virtualizes 150 audit rows to at most 30 audit-row nodes', async () => {
    render(<AuditLogPage />);
    resolveAudit!(auditRows150);

    await waitFor(() => expect(screen.getByTestId('audit-table')).toBeInTheDocument());

    expect(auditRows150.length).toBe(150);
    expect(screen.getAllByTestId('audit-row').length).toBeLessThanOrEqual(30);
  });

  it('shows JSON panels when expanding a visible row in virtualized list', async () => {
    render(<AuditLogPage />);
    resolveAudit!(auditRows150);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Show audit details' }).length).toBeGreaterThan(0),
    );

    const detailsButton = screen.getAllByRole('button', { name: 'Show audit details' })[0]!;
    fireEvent.click(detailsButton);

    await waitFor(() => {
      expect(document.querySelectorAll('pre').length).toBe(2);
    });
  });
});
