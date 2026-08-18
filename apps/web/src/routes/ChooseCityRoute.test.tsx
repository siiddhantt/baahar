import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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

function renderRoute() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ChooseCityRoute />} />
        <Route path="/bengaluru" element={<p>Bengaluru feed</p>} />
        <Route path="/varanasi" element={<p>Varanasi feed</p>} />
      </Routes>
    </MemoryRouter>,
  );
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
    } as ReturnType<typeof useCityPreview>);
  });

  it('does not redirect from a stale preference for a disabled city', () => {
    vi.mocked(usePreferences).mockReturnValue({ city: 'varanasi', theme: 'system' });

    renderRoute();

    expect(
      screen.getByRole('heading', { name: /find something worth stepping out for/i }),
    ).toBeVisible();
    expect(screen.queryByText('Varanasi feed')).not.toBeInTheDocument();
  });

  it('persists and opens a city returned by the enabled-cities API', () => {
    vi.mocked(usePreferences).mockReturnValue({ city: null, theme: 'system' });

    renderRoute();
    fireEvent.click(screen.getByRole('button', { name: /bengaluru/i }));

    expect(updatePreferences).toHaveBeenCalledWith({ city: 'bengaluru' });
    expect(screen.getByText('Bengaluru feed')).toBeInTheDocument();
  });
});
