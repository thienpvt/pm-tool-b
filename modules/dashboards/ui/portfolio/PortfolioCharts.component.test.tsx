import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortfolioCharts } from './PortfolioCharts';

describe('PortfolioCharts', () => {
  it('lists L0 through L5 stage labels even when by_stage is empty', () => {
    render(
      <PortfolioCharts
        charts={{
          by_stage: {},
          by_rag: { green: 0, amber: 0, red: 0 },
        }}
      />,
    );
    for (const stage of ['L0', 'L1', 'L2', 'L3', 'L4', 'L5']) {
      expect(screen.getByText(stage)).toBeInTheDocument();
    }
  });

  it('lists Green, Amber, Red RAG labels', () => {
    render(
      <PortfolioCharts
        charts={{
          by_stage: {},
          by_rag: { green: 0, amber: 0, red: 0 },
        }}
      />,
    );
    expect(screen.getByText('Green')).toBeInTheDocument();
    expect(screen.getByText('Amber')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
  });

  it('renders zero-width bar when stage count is 0', () => {
    render(
      <PortfolioCharts
        charts={{
          by_stage: { L2: 0 },
          by_rag: { green: 0, amber: 0, red: 0 },
        }}
      />,
    );
    const bar = screen.getByTestId('stage-bar-L2');
    expect(bar.style.width).toBe('0%');
  });

  it('renders proportional bar width when L2 count is 4', () => {
    render(
      <PortfolioCharts
        charts={{
          by_stage: { L0: 0, L1: 0, L2: 4, L3: 2, L4: 0, L5: 0 },
          by_rag: { green: 0, amber: 0, red: 0 },
        }}
      />,
    );
    const bar = screen.getByTestId('stage-bar-L2');
    expect(bar.style.width).toBe('100%');
  });

  it('does not import a chart library', async () => {
    const source = await import('./PortfolioCharts?raw');
    expect(String(source.default)).not.toMatch(/recharts|chart\.js|victory|nivo/i);
  });
});
