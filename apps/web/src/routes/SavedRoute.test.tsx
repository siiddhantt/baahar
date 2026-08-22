import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ApiProblem, type City, type EventSummary } from '../api/client';
import { useCities, useSavedEvents } from '../api/queries';
import { usePreferences } from '../app/preferences';
import { useSavedIds } from '../features/saved/savedStore';
import SavedRoute from './SavedRoute';

vi.mock('../api/queries', () => ({ useCities: vi.fn(), useSavedEvents: vi.fn() }));
vi.mock('../app/preferences', () => ({ usePreferences: vi.fn() }));
vi.mock('../features/saved/savedStore', () => ({ useSavedIds: vi.fn() }));
vi.mock('../components/EventQuilt', () => ({
  EventQuilt: ({ events }: { events: EventSummary[] }) => (
    <ul>
      {events.map((event) => (
        <li key={event.id}>{event.title}</li>
      ))}
    </ul>
  ),
}));

const varanasi = {
  slug: 'varanasi',
  name: 'Varanasi',
  timezone: 'Asia/Kolkata',
  accent: 'river',
} satisfies City;
const mumbai = {
  slug: 'mumbai',
  name: 'Mumbai',
  timezone: 'Asia/Kolkata',
  accent: 'coast',
} satisfies City;

function savedEvent(id: string, title: string, city: City): EventSummary {
  return {
    id,
    title,
    city,
    status: 'scheduled',
    change_kind: null,
  } as EventSummary;
}

describe('SavedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCities).mockReturnValue({
      data: { items: [varanasi, mumbai] },
    } as ReturnType<typeof useCities>);
    vi.mocked(usePreferences).mockReturnValue({ city: 'varanasi', theme: 'system' });
  });

  it('separates saved plans by city with a route back to each feed', () => {
    vi.mocked(useSavedIds).mockReturnValue(['v1', 'm1', 'v2']);
    vi.mocked(useSavedEvents).mockReturnValue([
      { data: savedEvent('v1', 'A Varanasi workshop', varanasi), isPending: false, isError: false },
      {
        data: savedEvent('m1', 'A Mumbai concert', mumbai),
        isPending: false,
        isError: false,
      },
      {
        data: savedEvent('v2', 'Another Varanasi plan', varanasi),
        isPending: false,
        isError: false,
      },
    ] as unknown as ReturnType<typeof useSavedEvents>);

    render(
      <MemoryRouter>
        <SavedRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Mumbai', level: 2 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Varanasi', level: 2 })).toBeVisible();
    expect(screen.getByRole('link', { name: /find more in mumbai/i })).toHaveAttribute(
      'href',
      '/mumbai?window=upcoming',
    );
    expect(screen.getByText('A Varanasi workshop')).toBeVisible();
    expect(screen.getByText('A Mumbai concert')).toBeVisible();
  });

  it('distinguishes a removed listing from a temporary request problem', () => {
    vi.mocked(useSavedIds).mockReturnValue(['missing', 'offline']);
    vi.mocked(useSavedEvents).mockReturnValue([
      {
        isPending: false,
        isError: true,
        error: new ApiProblem({
          type: 'https://baahar.app/problems/not-found',
          title: 'Event not found',
          status: 404,
          code: 'event_not_found',
        }),
      },
      { isPending: false, isError: true, error: new Error('offline') },
    ] as unknown as ReturnType<typeof useSavedEvents>);

    render(
      <MemoryRouter>
        <SavedRoute />
      </MemoryRouter>,
    );

    expect(screen.getByText(/no longer in Baahar’s live catalogue/i)).toBeVisible();
    expect(screen.getByText(/could not be checked right now/i)).toBeVisible();
  });
});
