import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { EventSummary } from '../api/client';
import { EventCard } from './EventCard';

const event = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'a-city-plan',
  city: { slug: 'mysuru', name: 'Mysuru', timezone: 'Asia/Kolkata', accent: 'palace' },
  title: 'A city plan with a complete public title',
  category: 'theatre',
  timing: {
    start_date: '2026-08-22',
    starts_at: '2026-08-22T19:30:00+05:30',
    end_date: '2026-08-22',
    ends_at: '2026-08-22T21:00:00+05:30',
    precision: 'timed',
    timezone: 'Asia/Kolkata',
  },
  venue: { name: 'City Hall', address: null },
  pricing: { is_free: false, minimum_minor: 50000, maximum_minor: 50000, currency: 'INR' },
  registration: { url: 'https://tickets.example/plan', state: null },
  status: 'scheduled',
  image_url: null,
  source: {
    slug: 'city-calendar',
    name: 'City Calendar',
    url: 'https://calendar.example/plan',
    host: 'calendar.example',
    freshness: 'fresh',
  },
  last_checked_at: '2026-08-18T12:00:00Z',
  change_kind: null,
  language: [],
  age_note: null,
  accessibility_note: null,
} satisfies EventSummary;

describe('EventCard public facts', () => {
  it('shows venue and source without exposing collection age', () => {
    render(
      <MemoryRouter>
        <EventCard event={event} />
      </MemoryRouter>,
    );

    expect(screen.getByText('City Hall')).toBeVisible();
    expect(screen.getByText('City Calendar')).toBeVisible();
    expect(screen.queryByText(/ago/i)).not.toBeInTheDocument();
  });

  it('does not repeat a source name that is already the venue', () => {
    render(
      <MemoryRouter>
        <EventCard
          event={{
            ...event,
            source: { ...event.source, name: 'City Hall' },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('City Hall')).toHaveLength(1);
  });
});
