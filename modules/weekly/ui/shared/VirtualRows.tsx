'use client';

import { useCallback, useState, type ReactNode } from 'react';

export const ROW_HEIGHT = 40;
const DEFAULT_OVERSCAN = 5;

type VirtualRowsProps<T> = {
  items: T[];
  height: number;
  rowHeight?: number;
  overscan?: number;
  rowKey: (item: T, index: number) => string | number;
  renderRow: (item: T, index: number) => ReactNode;
};

export default function VirtualRows<T>({
  items,
  height,
  rowHeight = ROW_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  rowKey,
  renderRow,
}: VirtualRowsProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
  const end = Math.min(items.length, start + visibleCount);
  const slice = items.slice(start, end);
  const totalHeight = items.length * rowHeight;

  return (
    <div style={{ height, overflow: 'auto' }} onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
          {slice.map((item, i) => (
            <div key={rowKey(item, start + i)}>{renderRow(item, start + i)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
