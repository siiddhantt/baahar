import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ApiProblem } from '../api/client';
import { useEvent, useEventChanges } from '../api/queries';
import EventDetailRoute from './EventDetailRoute';

vi.mock('../api/queries', () => ({
  useEvent: vi.fn(),
  useEventChanges: vi.fn(),
}));

function renderRoute() {
  render(
    <MemoryRouter initialEntries={['/events/missing-event']}>
      <Routes>
        <Route path="/events/:occurrenceId/:slug?" element={<EventDetailRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EventDetailRoute', () => {
  it('gives a useful way back when the event does not exist', () => {
    vi.mocked(useEvent).mockReturnValue({
      data: undefined,
      error: new ApiProblem({
        type: 'about:blank',
        title: 'Event not found',
        status: 404,
        code: 'event_not_found',
      }),
      isPending: false,
      isError: true,
    } as unknown as ReturnType<typeof useEvent>);
    vi.mocked(useEventChanges).mockReturnValue({
      data: undefined,
      isError: false,
    } as unknown as ReturnType<typeof useEventChanges>);

    renderRoute();

    expect(screen.getByRole('heading', { name: /this plan couldn’t be found/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /see bengaluru plans/i })).toHaveAttribute(
      'href',
      '/bengaluru',
    );
  });
});
