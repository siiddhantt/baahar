import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ApiProblem, type EventDetail } from '../api/client';
import { useEvent, useEventChanges } from '../api/queries';
import EventDetailRoute from './EventDetailRoute';

vi.mock('../api/queries', () => ({
  useEvent: vi.fn(),
  useEventChanges: vi.fn(),
}));

const event = {
  id: 'known-event',
  slug: 'known-plan',
  city: {
    slug: 'varanasi',
    name: 'Varanasi',
    timezone: 'Asia/Kolkata',
    accent: 'river',
  },
  title: 'A known plan',
  category: 'talks',
  timing: {
    start_date: '2026-09-01',
    starts_at: '2026-09-01T10:00:00+05:30',
    end_date: '2026-09-01',
    ends_at: '2026-09-01T12:00:00+05:30',
    precision: 'timed',
    timezone: 'Asia/Kolkata',
  },
  venue: { name: 'City hall', address: null },
  pricing: { is_free: null, minimum_minor: null, maximum_minor: null, currency: null },
  registration: { url: null, state: null },
  status: 'scheduled',
  image_url: null,
  source: {
    slug: 'city-calendar',
    name: 'City calendar',
    url: 'https://calendar.example/plan',
    host: 'calendar.example',
    freshness: 'fresh',
  },
  last_checked_at: '2026-08-19T12:00:00+05:30',
  change_kind: 'new',
  language: [],
  age_note: null,
  accessibility_note: null,
} satisfies EventDetail;

type RouteEntry = string | { pathname: string; state: { from: string } };

function renderRoute(initialEntry: RouteEntry = '/events/missing-event') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/events/:occurrenceId/:slug?" element={<EventDetailRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EventDetailRoute', () => {
  beforeEach(() => {
    vi.mocked(useEventChanges).mockReturnValue({
      data: { items: [] },
      isError: false,
    } as unknown as ReturnType<typeof useEventChanges>);
  });

  it('gives a useful way back when the event does not exist', () => {
    vi.mocked(useEvent).mockReturnValue({
      data: undefined,
      error: new ApiProblem({
        type: 'about:blank',
        title: 'Event not found',
        status: 404,
        code: 'event_not_found',
      }),
      isPending: false,
      isError: true,
    } as unknown as ReturnType<typeof useEvent>);
    renderRoute();

    expect(screen.getByRole('heading', { name: /this plan couldn’t be found/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /choose a city/i })).toHaveAttribute('href', '/');
  });

  it('returns a direct event link to that city’s upcoming plans', () => {
    vi.mocked(useEvent).mockReturnValue({
      data: event,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useEvent>);

    renderRoute('/events/known-event');

    expect(screen.getByRole('link', { name: /back to plans/i })).toHaveAttribute(
      'href',
      '/varanasi?window=upcoming',
    );
  });

  it('preserves the filtered feed used to open an event', () => {
    vi.mocked(useEvent).mockReturnValue({
      data: event,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useEvent>);

    renderRoute({
      pathname: '/events/known-event',
      state: { from: '/varanasi?window=weekend&category=talks' },
    });

    expect(screen.getByRole('link', { name: /back to plans/i })).toHaveAttribute(
      'href',
      '/varanasi?window=weekend&category=talks',
    );
  });
});
