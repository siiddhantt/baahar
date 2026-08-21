import { askBaahar, calendarUrl, listEvents, type EventPage } from './client';

describe('calendarUrl', () => {
  it('escapes the occurrence identifier', () => {
    expect(calendarUrl('event/with spaces')).toContain('/v1/events/event%2Fwith%20spaces.ics');
  });
});

describe('listEvents', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forwards the signed continuation cursor with its filter window', async () => {
    const page: EventPage = {
      items: [],
      next_cursor: null,
      meta: {
        city: { slug: 'mysuru', name: 'Mysuru', timezone: 'Asia/Kolkata', accent: 'palace' },
        window: 'upcoming',
        result_count: 2,
        source_count: 1,
        last_checked_at: '2026-08-19T00:00:00+05:30',
        venues: [],
        page_size: 0,
        has_more: false,
        as_of: '2026-08-19T00:00:00+05:30',
      },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      void input;
      return Promise.resolve(
        new Response(JSON.stringify(page), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await listEvents({
      city: 'mysuru',
      window: 'upcoming',
      venue: 'Town Hall',
      cursor: 'signed-next',
      limit: 2,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/v1/events?city=mysuru&window=upcoming&venue=Town+Hall&cursor=signed-next&limit=2',
    );
  });

  it('posts a bounded Ask Baahar request as JSON', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            interpretation: {
              window: 'upcoming',
              categories: [],
              explicitly_free: false,
              venue: null,
              assisted: false,
            },
            items: [],
            result_count: 0,
            as_of: '2026-08-21T00:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await askBaahar('mysuru', 'music this weekend');

    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/ask',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ city: 'mysuru', query: 'music this weekend' }),
      }),
    );
  });
});
