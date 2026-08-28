import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { complianceFixture, complianceProjects150 } from '../shared/documents.fixture';
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

  it('Apply filters GETs stage=L2 without portfolio_year', async () => {
    render(<DocumentCompliancePage />);
    resolveCompliance!({ filters: {}, projects: complianceFixture.projects });

    await waitFor(() => expect(screen.getByLabelText('Stage')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'L2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      const applyCall = fetchMock.mock.calls.find(
        ([url]) =>
          typeof url === 'string' &&
          url.startsWith('/api/dashboards/document-compliance') &&
          url.includes('stage=L2'),
      );
      expect(applyCall).toBeTruthy();
      expect(String(applyCall![0])).not.toContain('portfolio_year');
    });
  });

  it('shows filter error toast on 400 apply', async () => {
    render(<DocumentCompliancePage />);
    resolveCompliance!({ filters: {}, projects: complianceFixture.projects });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply filters' })).toBeInTheDocument());

    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.startsWith('/api/dashboards/document-compliance')) {
        if (url.includes('stage=L2')) {
          return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'bad' }) });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ filters: {}, projects: complianceFixture.projects }),
        });
      }
      if (url === '/api/programs') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'L2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Invalid filter — check your selections.');
    });
  });

  it('shows empty compliance copy when projects array is empty', async () => {
    render(<DocumentCompliancePage />);
    resolveCompliance!({ filters: {}, projects: [] });

    await waitFor(() => {
      expect(screen.getByText('No projects match these filters')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Clear filters or adjust criteria to see compliance status.'),
    ).toBeInTheDocument();
  });

  it('renders compliance badges and checklist links for fixture rows', async () => {
    render(<DocumentCompliancePage />);
    resolveCompliance!(complianceFixture);

    await waitFor(() => expect(screen.getByText('Alpha Project')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'Alpha Project' })).toHaveAttribute(
      'href',
      '/projects/1/document-checklist',
    );
    expect(screen.getByText('compliant')).toBeInTheDocument();
    expect(screen.getByText('not_compliant')).toBeInTheDocument();
  });

  it('virtualizes 150 projects to at most 30 compliance-row nodes', async () => {
    render(<DocumentCompliancePage />);
    resolveCompliance!({ filters: {}, projects: complianceProjects150 });

    await waitFor(() => expect(screen.getByTestId('compliance-grid')).toBeInTheDocument());

    expect(complianceProjects150.length).toBe(150);
    expect(screen.getAllByTestId('compliance-row').length).toBeLessThanOrEqual(30);
  });
});
