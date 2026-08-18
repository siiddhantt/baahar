import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from './AppShell';

vi.mock('../components/SiteHeader', () => ({
  SiteHeader: () => <header>Baahar</header>,
}));

function FirstRoute() {
  return (
    <>
      <h1>First page</h1>
      <Link to="/second">Open second page</Link>
      <Link to="?window=tomorrow">Change window</Link>
    </>
  );
}

function renderShell() {
  render(
    <MemoryRouter initialEntries={['/first']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="first" element={<FirstRoute />} />
          <Route path="second" element={<h1>Second page</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell route focus', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves focus to main content after a route change', async () => {
    renderShell();

    fireEvent.click(screen.getByRole('link', { name: 'Open second page' }));

    expect(await screen.findByRole('heading', { name: 'Second page' })).toBeVisible();
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
  });

  it('does not steal focus when only the current page filters change', () => {
    renderShell();
    const filterLink = screen.getByRole('link', { name: 'Change window' });
    filterLink.focus();

    fireEvent.click(filterLink);

    expect(filterLink).toHaveFocus();
    expect(screen.getByRole('main')).not.toHaveFocus();
  });
});
