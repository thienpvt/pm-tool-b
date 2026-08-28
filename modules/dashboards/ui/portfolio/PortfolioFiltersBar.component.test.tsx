import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortfolioFiltersBar } from './PortfolioFiltersBar';
import type { PortfolioDashboardListRow } from '@/modules/dashboards/ui/shared/types';

const listFixture: PortfolioDashboardListRow[] = [
  {
    id: 1,
    name: 'Alpha',
    project_code: 'A1',
    portfolio_year: 2026,
    customer_id: 10,
    program_name: 'Banking Program',
    stage: 'L1',
    status: 'Active',
    rag: 'green',
    classification: 'Strategic',
    weekly_report_enabled: true,
    progress_pct: 50,
    pm_user_id: 5,
    pm_name: 'Jane PM',
  },
];

describe('PortfolioFiltersBar', () => {
  it('renders all nine DASHBOARD_FILTER_KEYS controls', () => {
    render(
      <PortfolioFiltersBar
        filters={{}}
        list={listFixture}
        refreshing={false}
        onApply={vi.fn()}
        onClear={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Year')).toBeInTheDocument();
    expect(screen.getByLabelText('Program')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit')).toBeInTheDocument();
    expect(screen.getByLabelText('PM')).toBeInTheDocument();
    expect(screen.getByLabelText('Stage')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('RAG')).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Weekly report')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset defaults' })).toBeInTheDocument();
  });

  it('pre-selects Stage from filters prop on mount', () => {
    render(
      <PortfolioFiltersBar
        filters={{ stage: 'L2' }}
        list={listFixture}
        refreshing={false}
        onApply={vi.fn()}
        onClear={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Stage')).toHaveValue('L2');
  });

  it('disables Apply while refreshing', () => {
    render(
      <PortfolioFiltersBar
        filters={{}}
        list={listFixture}
        refreshing
        onApply={vi.fn()}
        onClear={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
  });

  it('calls onApply with stage when Apply filters is clicked', () => {
    const onApply = vi.fn();
    render(
      <PortfolioFiltersBar
        filters={{}}
        list={listFixture}
        refreshing={false}
        onApply={onApply}
        onClear={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'L2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(onApply).toHaveBeenCalledWith({ stage: 'L2' });
  });

  it('calls onClear and onReset', () => {
    const onClear = vi.fn();
    const onReset = vi.fn();
    render(
      <PortfolioFiltersBar
        filters={{}}
        list={listFixture}
        refreshing={false}
        onApply={vi.fn()}
        onClear={onClear}
        onReset={onReset}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset defaults' }));

    expect(onClear).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
  });
});
