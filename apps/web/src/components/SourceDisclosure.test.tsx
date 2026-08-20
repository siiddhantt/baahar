import { render, screen } from '@testing-library/react';

import type { EventSummary } from '../api/client';
import { SourceDisclosure } from './SourceDisclosure';

const event = {
  source: {
    slug: 'city-calendar',
    name: 'City Calendar',
    url: 'https://calendar.example/plan',
    host: 'calendar.example',
    freshness: 'fresh',
  },
  last_checked_at: '2026-08-18T12:00:00Z',
} as EventSummary;

describe('SourceDisclosure', () => {
  it('links to the official source without exposing collection age', () => {
    render(<SourceDisclosure event={event} />);

    expect(screen.getByText('Official details from City Calendar')).toBeVisible();
    expect(screen.queryByText(/checked|ago/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /calendar\.example/i })).toHaveAttribute(
      'href',
      'https://calendar.example/plan',
    );
  });
});
