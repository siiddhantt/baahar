import { fireEvent, render, screen } from '@testing-library/react';

import { VenuePicker } from './VenuePicker';

describe('VenuePicker', () => {
  it('selects an exact venue and returns focus to its trigger', () => {
    const onChange = vi.fn();
    render(
      <VenuePicker
        value=""
        venues={['Bangalore International Centre', 'Jagriti Theatre']}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: /venue anywhere in the city/i });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Jagriti Theatre' }));

    expect(onChange).toHaveBeenCalledWith('Jagriti Theatre');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('supports arrow navigation, selection, and escape without changing a filter', () => {
    const onChange = vi.fn();
    render(
      <VenuePicker
        value="Jagriti Theatre"
        venues={['Bangalore International Centre', 'Jagriti Theatre']}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: /venue jagriti theatre/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Jagriti Theatre' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('option', { name: 'Jagriti Theatre' }), {
      key: 'ArrowDown',
    });
    expect(screen.getByRole('option', { name: 'Anywhere in the city' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('option', { name: 'Anywhere in the city' }), {
      key: 'Escape',
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
