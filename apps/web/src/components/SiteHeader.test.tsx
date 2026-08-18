import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useCities } from '../api/queries';
import { updatePreferences, usePreferences } from '../app/preferences';
import { useResolvedTheme } from '../app/themeContext';
import { useSavedIds } from '../features/saved/savedStore';
import { SiteHeader } from './SiteHeader';

vi.mock('../api/queries', () => ({ useCities: vi.fn() }));
vi.mock('../app/preferences', () => ({
  updatePreferences: vi.fn(),
  usePreferences: vi.fn(),
}));
vi.mock('../app/themeContext', () => ({ useResolvedTheme: vi.fn() }));
vi.mock('../features/saved/savedStore', () => ({ useSavedIds: vi.fn() }));

const mysuru = {
  slug: 'mysuru',
  name: 'Mysuru',
  timezone: 'Asia/Kolkata',
  accent: 'palace',
};

describe('SiteHeader city navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCities).mockReturnValue({
      data: { items: [mysuru] },
    } as ReturnType<typeof useCities>);
    vi.mocked(usePreferences).mockReturnValue({ city: null, theme: 'system' });
    vi.mocked(useResolvedTheme).mockReturnValue('light');
    vi.mocked(useSavedIds).mockReturnValue([]);
  });

  it('uses API cities in an accessible menu and keeps the brand pointed at the chooser', () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Baahar' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Choose city' }));
    const cityLink = screen.getByRole('link', { name: /mysuru.*upcoming plans/i });
    expect(cityLink).toHaveAttribute('href', '/mysuru?window=upcoming');

    fireEvent.click(cityLink);
    expect(updatePreferences).toHaveBeenCalledWith({ city: 'mysuru' });
  });
});
