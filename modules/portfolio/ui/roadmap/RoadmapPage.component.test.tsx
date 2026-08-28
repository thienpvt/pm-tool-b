import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoadmapPage from './RoadmapPage';

vi.mock('next/navigation', () => ({ useParams: () => ({}) }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));
vi.mock('html-to-image', () => ({ toPng: vi.fn(() => Promise.resolve('data:image/png;base64,abc')) }));

const year = new Date().getFullYear();

const roadmapFixture = {
  programs: [
    {
      id: 1,
      name: 'Program Alpha',
      industry: 'Tech',
      projects: [
        {
          id: 101,
          name: 'Project One',
          pm_name: 'Alice',
          customer_id: 1,
          start_date: `${year}-01-01`,
          end_date: `${year}-12-31`,
          current_phase: 'Execution',
          completion_pct: 45,
          rag: 'green' as const,
          phases: [
            {
              phase: 'Execution',
              start_date: `${year}-01-01`,
              end_date: `${year}-06-30`,
              total: 10,
              done: 4,
              completion_pct: 40,
              epic_key: 'EP-1',
            },
          ],
        },
        {
          id: 102,
          name: 'Project Two',
          pm_name: 'Bob',
          customer_id: 1,
          start_date: `${year}-02-01`,
          end_date: `${year}-11-30`,
          current_phase: 'Planning',
          completion_pct: 20,
          rag: 'amber' as const,
          phases: [
            {
              phase: 'Planning',
              start_date: `${year}-02-01`,
              end_date: `${year}-05-31`,
              total: 5,
              done: 1,
              completion_pct: 20,
              epic_key: null,
            },
          ],
        },
      ],
    },
    {
      id: 2,
      name: 'Program Beta',
      industry: 'Finance',
      projects: [
        {
          id: 201,
          name: 'Project Three',
          pm_name: 'Carol',
          customer_id: 2,
          start_date: `${year}-03-01`,
          end_date: `${year}-09-30`,
          current_phase: 'Initiation',
          completion_pct: 10,
          rag: 'red' as const,
          phases: [],
        },
      ],
    },
  ],
  noProgramProjects: [],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/portfolio/roadmap') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(roadmapFixture) });
    }
    if (url.startsWith('/api/portfolio/roadmap/epics')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ epics: [] }) });
    }
    if (url === '/api/portfolio/milestones') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch);
});

describe('RoadmapPage', () => {
  it('renders after load with roadmap fixture', async () => {
    render(<RoadmapPage />);
    await waitFor(() => expect(screen.getByText('Portfolio Roadmap')).toBeInTheDocument());
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Project One').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Project Two').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Project Three').length).toBeGreaterThan(0);
  });

  it('program filter changes visible projects', async () => {
    render(<RoadmapPage />);
    await waitFor(() => expect(screen.getAllByText('Project Three').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByDisplayValue('Tất cả Program'), { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Program Alpha')).toBeInTheDocument();
      expect(screen.queryAllByText('Project Three')).toHaveLength(0);
    });
    expect(screen.getAllByText('Project One').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Project Two').length).toBeGreaterThan(0);
  });
});
