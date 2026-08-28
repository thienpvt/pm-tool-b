import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TimelinePage from './page';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: '1' }) }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));
vi.mock('@/modules/jira/ui/timeline-import/ImportMappingDialog', () => ({ default: () => null }));
vi.mock('@/modules/jira/ui/JiraSyncDialog', () => ({ default: () => null }));

const projectFixture = {
  id: 1,
  name: 'Alpha',
  status: 'Execution',
  current_phase: 'Development',
  client: 'Acme',
  pm_name: 'Jane',
};

const activitiesFixture = [
  {
    id: 1,
    phase: 'Development',
    no: '1',
    activity: 'Build API',
    deliverable: '',
    sign_off_doc: '',
    accountable: 'PM',
    responsible: 'Dev',
    support: '',
    plan_start: '2026-01-01',
    plan_end: '2026-03-31',
    actual_start: '',
    actual_end: '',
    status: 'In Progress',
    completion_pct: 50,
    notes: '',
    order_idx: 1,
    delay_owner: 'N/A',
    delay_reason: '',
    jira_key: 'ALP-01',
    sprint: '',
    project_status: 'Execution',
    parent_id: null,
    priority: 'Medium',
  },
  {
    id: 2,
    phase: 'Testing',
    no: '2',
    activity: 'SIT',
    deliverable: '',
    sign_off_doc: '',
    accountable: 'QA',
    responsible: 'QA',
    support: '',
    plan_start: '2026-04-01',
    plan_end: '2026-04-30',
    actual_start: '',
    actual_end: '',
    status: 'To Do',
    completion_pct: 0,
    notes: '',
    order_idx: 2,
    delay_owner: 'N/A',
    delay_reason: '',
    jira_key: 'ALP-02',
    sprint: '',
    project_status: 'Execution',
    parent_id: null,
    priority: 'Medium',
  },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/projects/1') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(projectFixture) });
    }
    if (url === '/api/projects/1/activities') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(activitiesFixture) });
    }
    if (url === '/api/projects/1/team') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url === '/api/projects/1/holidays') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch);
});

describe('TimelinePage', () => {
  it('renders after load with useParams id 1', async () => {
    render(<TimelinePage />);
    await waitFor(() => expect(screen.getByText('Project Timeline')).toBeInTheDocument());
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('Build API')).toBeInTheDocument();
    expect(screen.getByText('SIT')).toBeInTheDocument();
  });

  it('status filter updates filter state', async () => {
    render(<TimelinePage />);
    await waitFor(() => expect(screen.getByText('Project Timeline')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^Status/ }));
    await waitFor(() => expect(screen.getByText('Filter by Status')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      expect(screen.getByText(/Status \(1\)/)).toBeInTheDocument();
    });
  });
});
