import type { EventSummary } from '../api/client';
import { providerCalendarLinks } from './calendar';

const event = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'music-night',
  city: { slug: 'bengaluru', name: 'Bengaluru', timezone: 'Asia/Kolkata', accent: 'rain' },
  title: 'Music Night',
  category: 'music',
  timing: {
    start_date: '2026-08-22',
    starts_at: '2026-08-22T19:30:00+05:30',
    end_date: '2026-08-22',
    ends_at: '2026-08-22T21:00:00+05:30',
    precision: 'timed',
    timezone: 'Asia/Kolkata',
  },
  venue: { name: 'Town Hall', address: 'Main Road' },
  pricing: { is_free: null, minimum_minor: null, maximum_minor: null, currency: null },
  registration: { url: null, state: null },
  status: 'scheduled',
  image_url: null,
  source: {
    slug: 'calendar',
    name: 'Official Calendar',
    url: 'https://events.example/music-night',
    host: 'events.example',
    freshness: 'fresh',
  },
  last_checked_at: '2026-08-21T08:00:00Z',
  change_kind: null,
  language: [],
  age_note: null,
  accessibility_note: null,
} satisfies EventSummary;

it('creates Google and Outlook links only from exact timed facts', () => {
  const links = providerCalendarLinks(event);
  expect(links.map((link) => link.label)).toEqual(['Google Calendar', 'Outlook']);
  expect(new URL(links[0]!.href).searchParams.get('dates')).toBe(
    '20260822T140000Z/20260822T153000Z',
  );
  expect(new URL(links[1]!.href).searchParams.get('location')).toBe('Town Hall, Main Road');
});

it('uses an exclusive next date for all-day provider links', () => {
  const [google, outlook] = providerCalendarLinks({
    ...event,
    timing: {
      ...event.timing,
      starts_at: null,
      ends_at: null,
      precision: 'date',
      start_date: '2026-08-22',
      end_date: '2026-08-24',
    },
  });
  expect(new URL(google!.href).searchParams.get('dates')).toBe('20260822/20260825');
  expect(new URL(outlook!.href).searchParams.get('allday')).toBe('true');
});

it('does not invent an end time for direct provider links', () => {
  expect(providerCalendarLinks({ ...event, timing: { ...event.timing, ends_at: null } })).toEqual(
    [],
  );
});
