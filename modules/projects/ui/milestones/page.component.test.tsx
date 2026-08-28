import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MilestonesPage from './page';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: '1' }) }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

const projectFixture = {
  id: 1,
  name: 'Alpha Project',
  status: 'Execution',
  current_phase: 'Development',
  client: 'Acme',
  pm_name: 'Jane',
};

const milestonesFixture = [
  { id: 10, project_id: 1, name: 'MVP Release', start_date: '2026-01-01', end_date: '2026-03-31', created_at: '2026-01-01' },
  { id: 11, project_id: 1, name: 'Phase 2', start_date: '2026-04-01', end_date: '2026-06-30', created_at: '2026-01-01' },
];

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
];

const epicsFixture = [
  {
    id: 1,
    phase: 'Development',
    no: '1',
    activity: 'Build API',
    status: 'In Progress',
    completion_pct: 50,
    plan_start: '2026-01-01',
    plan_end: '2026-03-31',
    jira_key: 'ALP-01',
    parent_id: null,
  },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/projects/1') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(projectFixture) });
    }
    if (url === '/api/projects/1/milestones') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(milestonesFixture) });
    }
    if (url === '/api/projects/1/activities') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(activitiesFixture) });
    }
    if (url === '/api/projects/1/team') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url === '/api/projects/1/milestones/10/epics') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(epicsFixture) });
    }
    if (url === '/api/projects/1/milestones/11/epics') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch);
});

describe('MilestonesPage', () => {
  it('renders after load with mocked milestones', async () => {
    render(<MilestonesPage />);
    await waitFor(() => expect(screen.getByText('Milestones')).toBeInTheDocument());
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('MVP Release')).toBeInTheDocument());
    expect(screen.getByText('Phase 2')).toBeInTheDocument();
  });

  it('selects milestone row and shows milestone detail toolbar', async () => {
    render(<MilestonesPage />);
    await waitFor(() => expect(screen.getByText('MVP Release')).toBeInTheDocument());

    fireEvent.click(screen.getByText('MVP Release'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'MVP Release' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Export PDF/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Build API')).toBeInTheDocument());
  });
});
