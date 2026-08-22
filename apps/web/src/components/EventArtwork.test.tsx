import { fireEvent, render } from '@testing-library/react';

import type { EventCategory, EventSummary } from '../api/client';
import { EventArtwork } from './EventArtwork';

const event = {
  timing: {
    start_date: '2026-08-22',
    starts_at: '2026-08-22T19:30:00+05:30',
    end_date: '2026-08-22',
    ends_at: '2026-08-22T21:00:00+05:30',
    precision: 'timed',
    timezone: 'Asia/Kolkata',
  },
  image_url: null,
} as EventSummary;

describe('EventArtwork', () => {
  it.each<EventCategory>([
    'arts',
    'talks',
    'workshops',
    'theatre',
    'music',
    'books',
    'community',
    'other',
  ])('draws a dedicated %s motif when a poster is missing', (category) => {
    const { container } = render(<EventArtwork event={{ ...event, category }} />);

    expect(container.querySelector('svg')).toHaveAttribute('data-motif', category);
    expect(container.firstElementChild).toHaveAttribute('data-category', category);
  });

  it('falls back to the category motif when a remote poster fails', () => {
    const { container } = render(
      <EventArtwork
        event={{ ...event, category: 'workshops', image_url: 'https://images.example/poster.jpg' }}
      />,
    );
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    if (!image) throw new Error('Expected a remote event poster');

    fireEvent.error(image);

    expect(container.querySelector('svg')).toHaveAttribute('data-motif', 'workshops');
  });
});
