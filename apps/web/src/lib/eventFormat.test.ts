import type { EventSummary } from '../api/client';
import { eventDateLabel, eventTimeLabel, priceLabel, primaryEventAction } from './eventFormat';

const event = {
  timing: {
    starts_at: '2026-08-22T12:30:00Z',
    ends_at: null,
    start_date: '2026-08-22',
    end_date: null,
    precision: 'timed',
    timezone: 'Asia/Kolkata',
  },
  pricing: {
    is_free: null,
    minimum_minor: null,
    maximum_minor: null,
    currency: null,
  },
} as EventSummary;

describe('event formatting', () => {
  it('keeps an unknown price unknown', () => {
    expect(priceLabel(event)).toBeNull();
  });

  it('shows an exact INR amount without implying a wider price range', () => {
    expect(
      priceLabel({
        ...event,
        pricing: {
          is_free: false,
          minimum_minor: 50_000,
          maximum_minor: 50_000,
          currency: 'INR',
        },
      }),
    ).toBe('₹500');
  });

  it('formats exact time in the city timezone', () => {
    expect(eventTimeLabel(event)).toBe('6:00 pm');
  });

  it('shows the end date for a multi-day occurrence', () => {
    expect(
      eventDateLabel({
        ...event,
        timing: {
          ...event.timing,
          starts_at: null,
          ends_at: null,
          start_date: '2026-08-22',
          end_date: '2026-08-24',
          precision: 'date',
        },
      }),
    ).toBe('22 Aug–24 Aug');
  });

  it('does not invite registration when booking is closed', () => {
    expect(
      primaryEventAction({
        ...event,
        source: { url: 'https://venue.test/event' },
        registration: { url: 'https://tickets.test/event', state: 'sold_out' },
      } as EventSummary),
    ).toEqual({ href: 'https://tickets.test/event', label: 'View booking page' });
  });
});
