import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { trackingRows150 } from './weekly.fixture';
import VirtualRows, { ROW_HEIGHT } from './VirtualRows';

describe('VirtualRows', () => {
  it('windows 150 items to at most 30 DOM row nodes', () => {
    expect(trackingRows150.length).toBe(150);

    render(
      <VirtualRows
        items={trackingRows150}
        height={400}
        rowHeight={ROW_HEIGHT}
        rowKey={(row) => row.project_id}
        renderRow={(row) => (
          <div data-testid="virtual-row" style={{ height: ROW_HEIGHT }}>
            {row.name}
          </div>
        )}
      />,
    );

    const rows = screen.getAllByTestId('virtual-row');
    expect(rows.length).toBeLessThanOrEqual(30);
    expect(rows.length).not.toBe(150);
  });
});
