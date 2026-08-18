import { listEvents, type EventPage, type EventSummary } from './client';
import { loadCityPreview } from './queries';

vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  listEvents: vi.fn(),
}));

function page(window: EventPage['meta']['window'], items: EventSummary[] = []): EventPage {
  return {
    items,
    next_cursor: null,
    meta: {
      city: {
        slug: 'bengaluru',
        name: 'Bengaluru',
        timezone: 'Asia/Kolkata',
        accent: 'rain',
      },
      window,
      result_count: items.length,
      source_count: 1,
      last_checked_at: '2026-08-18T12:00:00Z',
      page_size: items.length,
      has_more: false,
      as_of: '2026-08-18T12:00:00Z',
    },
  };
}

describe('loadCityPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the primary upcoming window for a city preview', async () => {
    const upcomingEvent = { id: 'upcoming-event' } as EventSummary;
    vi.mocked(listEvents).mockResolvedValueOnce(page('upcoming', [upcomingEvent]));

    const result = await loadCityPreview('bengaluru');

    expect(result.items).toEqual([upcomingEvent]);
    expect(listEvents).toHaveBeenCalledWith(
      { city: 'bengaluru', window: 'upcoming', limit: 3 },
      undefined,
    );
    expect(listEvents).toHaveBeenCalledTimes(1);
  });
});
