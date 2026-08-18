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
    },
  };
}

describe('loadCityPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls forward from today and stops at the first window with events', async () => {
    const tomorrowEvent = { id: 'tomorrow-event' } as EventSummary;
    vi.mocked(listEvents)
      .mockResolvedValueOnce(page('today'))
      .mockResolvedValueOnce(page('tomorrow', [tomorrowEvent]));

    const result = await loadCityPreview('bengaluru');

    expect(result?.items).toEqual([tomorrowEvent]);
    expect(listEvents).toHaveBeenNthCalledWith(
      1,
      { city: 'bengaluru', window: 'today', limit: 3 },
      undefined,
    );
    expect(listEvents).toHaveBeenNthCalledWith(
      2,
      { city: 'bengaluru', window: 'tomorrow', limit: 3 },
      undefined,
    );
    expect(listEvents).toHaveBeenCalledTimes(2);
  });

  it('returns the weekend response when every preview window is empty', async () => {
    vi.mocked(listEvents)
      .mockResolvedValueOnce(page('today'))
      .mockResolvedValueOnce(page('tomorrow'))
      .mockResolvedValueOnce(page('weekend'));

    const result = await loadCityPreview('bengaluru');

    expect(result?.meta.window).toBe('weekend');
    expect(listEvents).toHaveBeenCalledTimes(3);
  });
});
