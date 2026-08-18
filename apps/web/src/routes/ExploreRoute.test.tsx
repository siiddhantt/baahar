import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { useCities, useEvents } from '../api/queries';
import { updatePreferences, usePreferences } from '../app/preferences';
import ExploreRoute from './ExploreRoute';

vi.mock('../api/queries', () => ({
  useCities: vi.fn(),
  useEvents: vi.fn(),
}));

vi.mock('../app/preferences', () => ({
  updatePreferences: vi.fn(),
  usePreferences: vi.fn(),
}));

const bengaluru = {
  slug: 'bengaluru',
  name: 'Bengaluru',
  timezone: 'Asia/Kolkata',
  accent: 'rain',
} as const;

function renderRoute(city: string) {
  render(
    <MemoryRouter initialEntries={[`/${city}?window=upcoming`]}>
      <Routes>
        <Route path={`/${city}`} element={<ExploreRoute city={city} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ExploreRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCities).mockReturnValue({
      data: { items: [bengaluru] },
      isPending: false,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useCities>);
    vi.mocked(usePreferences).mockReturnValue({ city: null, theme: 'system' });
  });

  it('does not query or persist a city absent from the enabled-cities response', () => {
    vi.mocked(useEvents).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isSuccess: false,
    } as unknown as ReturnType<typeof useEvents>);

    renderRoute('varanasi');

    expect(screen.getByRole('heading', { name: /varanasi is still being checked/i })).toBeVisible();
    expect(useEvents).toHaveBeenCalledWith(
      { city: 'varanasi', window: 'upcoming', categories: [], explicitlyFree: false },
      false,
    );
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('persists an enabled city after its events response succeeds', async () => {
    vi.mocked(useEvents).mockReturnValue({
      data: {
        pages: [
          {
            items: [],
            next_cursor: null,
            meta: {
              city: bengaluru,
              window: 'upcoming',
              result_count: 0,
              source_count: 1,
              last_checked_at: '2026-08-18T12:00:00Z',
              page_size: 0,
              has_more: false,
              as_of: '2026-08-18T12:00:00Z',
            },
          },
        ],
      },
      isPending: false,
      isError: false,
      isSuccess: true,
      hasNextPage: false,
    } as unknown as ReturnType<typeof useEvents>);

    renderRoute('bengaluru');

    await waitFor(() => expect(updatePreferences).toHaveBeenCalledWith({ city: 'bengaluru' }));
  });

  it('does not claim freshness from zero source pages', () => {
    vi.mocked(useEvents).mockReturnValue({
      data: {
        pages: [
          {
            items: [],
            next_cursor: null,
            meta: {
              city: bengaluru,
              window: 'upcoming',
              result_count: 0,
              source_count: 0,
              last_checked_at: '2026-08-18T12:00:00Z',
              page_size: 0,
              has_more: false,
              as_of: '2026-08-18T12:00:00Z',
            },
          },
        ],
      },
      isPending: false,
      isError: false,
      isSuccess: true,
      hasNextPage: false,
    } as unknown as ReturnType<typeof useEvents>);

    renderRoute('bengaluru');

    expect(screen.queryByText(/fresh from/i)).not.toBeInTheDocument();
  });

  it('loads the next cursor page only after the user asks for more', () => {
    const fetchNextPage = vi.fn();
    vi.mocked(useEvents).mockReturnValue({
      data: {
        pages: [
          {
            items: [],
            next_cursor: 'signed-next-page',
            meta: {
              city: bengaluru,
              window: 'upcoming',
              result_count: 12,
              source_count: 2,
              last_checked_at: '2026-08-18T12:00:00Z',
              page_size: 0,
              has_more: true,
              as_of: '2026-08-18T12:00:00Z',
            },
          },
        ],
      },
      isPending: false,
      isError: false,
      isSuccess: true,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
    } as unknown as ReturnType<typeof useEvents>);

    renderRoute('bengaluru');

    expect(fetchNextPage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show more plans' }));
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });
});
