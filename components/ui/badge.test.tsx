import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders its children into the document', () => {
    render(<Badge>At Risk</Badge>);
    expect(screen.getByText('At Risk')).toBeInTheDocument();
  });

  it('applies the default variant classes', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveClass('bg-primary');
  });

  it('applies variant classes when a variant is given', () => {
    render(<Badge variant="outline">Outline</Badge>);
    const el = screen.getByText('Outline');
    expect(el).toHaveClass('border-border');
    expect(el).not.toHaveClass('bg-primary');
  });

  it('merges a caller className with variant classes', () => {
    render(<Badge className="custom-cls">Merged</Badge>);
    expect(screen.getByText('Merged')).toHaveClass('custom-cls');
  });
});
