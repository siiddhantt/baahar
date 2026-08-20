import { fireEvent, render, screen } from '@testing-library/react';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('offers the Upcoming reset used by an unfiltered empty window', () => {
    const onReset = vi.fn();
    render(<EmptyState filtered={false} onReset={onReset} />);

    fireEvent.click(screen.getByRole('button', { name: 'See upcoming plans' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('offers to clear active filters without changing the window label', () => {
    render(<EmptyState filtered onReset={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  });
});
