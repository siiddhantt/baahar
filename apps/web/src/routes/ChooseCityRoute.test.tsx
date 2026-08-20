import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { useCities, useCityPreview } from '../api/queries';
import { updatePreferences, usePreferences } from '../app/preferences';
import ChooseCityRoute from './ChooseCityRoute';

vi.mock('../api/queries', () => ({
  useCities: vi.fn(),
  useCityPreview: vi.fn(),
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

const varanasi = {
  slug: 'varanasi',
  name: 'Varanasi',
  timezone: 'Asia/Kolkata',
  accent: 'river',
} as const;

const delhi = {
  slug: 'delhi',
  name: 'Delhi',
  timezone: 'Asia/Kolkata',
  accent: 'monument',
} as const;

const mumbai = {
  slug: 'mumbai',
  name: 'Mumbai',
  timezone: 'Asia/Kolkata',
  accent: 'coast',
} as const;

function renderRoute() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ChooseCityRoute />} />
        <Route path="/:city" element={<OpenedCity />} />
      </Routes>
    </MemoryRouter>,
  );
}

function OpenedCity() {
  const location = useLocation();
  return <p>Opened {location.pathname + location.search}</p>;
}

describe('ChooseCityRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCities).mockReturnValue({
      data: { items: [bengaluru] },
      isPending: false,
      isError: false,
    } as ReturnType<typeof useCities>);
    vi.mocked(useCityPreview).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      isSuccess: true,
    } as unknown as ReturnType<typeof useCityPreview>);
  });

  it('does not redirect from a stale preference for a disabled city', () => {
    vi.mocked(usePreferences).mockReturnValue({ city: 'varanasi', theme: 'system' });

    renderRoute();

    expect(
      screen.getByRole('heading', { name: /find something worth stepping out for/i }),
    ).toBeVisible();
    expect(screen.queryByText('Varanasi feed')).not.toBeInTheDocument();
  });

  it('keeps the chooser visible and highlights a remembered city', () => {
    vi.mocked(usePreferences).mockReturnValue({ city: 'bengaluru', theme: 'system' });

    renderRoute();

    expect(
      screen.getByRole('heading', { name: /find something worth stepping out for/i }),
    ).toBeVisible();
    expect(screen.getByText('Last opened')).toBeVisible();
  });

  it('persists and opens a city returned by the enabled-cities API', () => {
    vi.mocked(usePreferences).mockReturnValue({ city: null, theme: 'system' });

    renderRoute();
    fireEvent.click(screen.getByRole('button', { name: /bengaluru/i }));

    expect(updatePreferences).toHaveBeenCalledWith({ city: 'bengaluru' });
    expect(screen.getByText('Opened /bengaluru?window=upcoming')).toBeInTheDocument();
  });

  it.each([varanasi, delhi, mumbai])(
    'renders and opens $name only after the enabled-cities API returns it',
    (city) => {
      vi.mocked(useCities).mockReturnValue({
        data: { items: [bengaluru, city] },
        isPending: false,
        isError: false,
      } as ReturnType<typeof useCities>);
      vi.mocked(usePreferences).mockReturnValue({ city: null, theme: 'system' });

      renderRoute();
      fireEvent.click(screen.getByRole('button', { name: new RegExp(city.name, 'i') }));

      expect(updatePreferences).toHaveBeenCalledWith({ city: city.slug });
      expect(screen.getByText(`Opened /${city.slug}?window=upcoming`)).toBeInTheDocument();
    },
  );

  it('does not turn registry-only artwork into an available city', () => {
    vi.mocked(usePreferences).mockReturnValue({ city: null, theme: 'system' });

    renderRoute();

    expect(screen.queryByRole('button', { name: /delhi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mumbai/i })).not.toBeInTheDocument();
  });

  it('renders exactly the cities returned by the API when all four are enabled', () => {
    vi.mocked(useCities).mockReturnValue({
      data: { items: [bengaluru, varanasi, delhi, mumbai] },
      isPending: false,
      isError: false,
    } as ReturnType<typeof useCities>);
    vi.mocked(usePreferences).mockReturnValue({ city: null, theme: 'system' });

    renderRoute();

    expect(screen.getAllByRole('button', { name: /upcoming plans/i })).toHaveLength(4);
  });
});
