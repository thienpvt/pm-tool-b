import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortfolioKpiTiles } from './PortfolioKpiTiles';

const kpis = {
  active_count: 3,
  on_track_count: 2,
  watch_act_count: 1,
  overdue_milestone_project_count: 2,
  high_open_raid_count: 1,
  technology_council_count: 0,
};

describe('PortfolioKpiTiles', () => {
  it('renders six tiles with counts', () => {
    render(
      <PortfolioKpiTiles kpis={kpis} activeKey={null} onSelect={vi.fn()} />,
    );
    const row = screen.getByTestId('spec-kpi-row');
    expect(row.children).toHaveLength(6);
    expect(row).toHaveTextContent('Overdue milestones');
    expect(row).toHaveTextContent('2');
  });

  it('calls onSelect with overdue_milestones when Overdue milestones tile clicked', () => {
    const onSelect = vi.fn();
    render(
      <PortfolioKpiTiles kpis={kpis} activeKey={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Overdue milestones/i }));
    expect(onSelect).toHaveBeenCalledWith('overdue_milestones');
  });

  it('shows ring-2 ring-blue-600 on selected drill-down tile', () => {
    render(
      <PortfolioKpiTiles kpis={kpis} activeKey="overdue_milestones" onSelect={vi.fn()} />,
    );
    const tile = screen.getByRole('button', { name: /Overdue milestones/i });
    expect(tile.className).toMatch(/ring-2/);
    expect(tile.className).toMatch(/ring-blue-600/);
  });

  it('toggles off when clicking the active tile again', () => {
    const onSelect = vi.fn();
    render(
      <PortfolioKpiTiles kpis={kpis} activeKey="overdue_milestones" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Overdue milestones/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('omits fiscal patterns from spec-kpi-row (NIT-04)', () => {
    render(
      <PortfolioKpiTiles kpis={kpis} activeKey={null} onSelect={vi.fn()} />,
    );
    const kpiRow = screen.getByTestId('spec-kpi-row');
    expect(kpiRow.textContent).not.toMatch(/budget|ROI|benefit|\$|₫|VND/i);
  });

  it('shows project vs projects subtitle when active count is not 1', () => {
    render(
      <PortfolioKpiTiles kpis={kpis} activeKey={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText('3 projects')).toBeInTheDocument();
  });
});
