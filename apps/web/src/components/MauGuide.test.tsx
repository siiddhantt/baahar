import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { AskResult, EventSummary } from '../api/client';
import { useMau } from '../api/queries';
import { MauGuide } from './MauGuide';

vi.mock('../api/queries', () => ({ useMau: vi.fn() }));

function mockGuide(overrides: Record<string, unknown> = {}) {
  vi.mocked(useMau).mockReturnValue({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    data: undefined,
    ...overrides,
  } as unknown as ReturnType<typeof useMau>);
}

function renderMau(onApply = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/bengaluru?window=upcoming']}>
      <MauGuide city="bengaluru" onApply={onApply} />
    </MemoryRouter>,
  );
}

const event = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'a-city-plan',
  city: { slug: 'varanasi', name: 'Varanasi', timezone: 'Asia/Kolkata', accent: 'river' },
  title: 'A verified evening plan',
  category: 'music',
  timing: {
    start_date: '2026-08-22',
    starts_at: '2026-08-22T19:30:00+05:30',
    end_date: '2026-08-22',
    ends_at: '2026-08-22T21:00:00+05:30',
    precision: 'timed',
    timezone: 'Asia/Kolkata',
  },
  venue: { name: 'BHU Campus', address: null },
  pricing: { is_free: true, minimum_minor: null, maximum_minor: null, currency: null },
  registration: { url: null, state: null },
  status: 'scheduled',
  image_url: null,
  source: {
    slug: 'city-calendar',
    name: 'City Calendar',
    url: 'https://calendar.example/plan',
    host: 'calendar.example',
    freshness: 'fresh',
  },
  last_checked_at: '2026-08-21T12:00:00Z',
  change_kind: null,
  language: [],
  age_note: null,
  accessibility_note: null,
} satisfies EventSummary;

it('wakes Mau, asks the provider, and applies only returned verified filters', () => {
  const onApply = vi.fn();
  const result: AskResult = {
    interpretation: {
      city: 'varanasi',
      window: 'weekend',
      categories: ['music'],
      explicitly_free: true,
      venue: 'BHU Campus',
    },
    items: [event],
    result_count: 3,
    as_of: '2026-08-21T10:00:00Z',
  };
  const mutate = vi.fn(
    (_input: { query: string }, options: { onSuccess: (value: AskResult) => void }) =>
      options.onSuccess(result),
  );
  mockGuide({ mutate, data: result });

  renderMau(onApply);
  const mascot = screen.getByRole('button', { name: 'Ask Mau for a plan' });
  expect(mascot.querySelector('img[src="/mascot/mau-sleeping.webp"]')).toBeInTheDocument();
  expect(mascot).toHaveTextContent('zzZ');
  fireEvent.click(screen.getByRole('button', { name: 'Ask Mau for a plan' }));
  expect(screen.getByRole('dialog', { name: 'Ask Mau' })).toBeInTheDocument();
  expect(
    screen
      .getByRole('button', { name: 'Put Mau back to sleep' })
      .querySelector('img[src="/mascot/mau-awake.webp"]'),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Ask Mau what you would like to do'), {
    target: { value: 'free music at BHU in Varanasi this weekend' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ask Mau' }));

  expect(mutate).toHaveBeenCalledWith(
    { query: 'free music at BHU in Varanasi this weekend' },
    expect.any(Object),
  );
  expect(onApply).toHaveBeenCalledWith({
    city: 'varanasi',
    window: 'weekend',
    categories: ['music'],
    explicitlyFree: true,
    venue: 'BHU Campus',
  });
  expect(screen.getByText(/3 plans in Varanasi/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /A verified evening plan/ })).toHaveAttribute(
    'href',
    '/events/11111111-1111-4111-8111-111111111111/a-city-plan',
  );
});

it('rests without guessing when the language service is unavailable', () => {
  mockGuide({ isError: true });
  renderMau();
  fireEvent.click(screen.getByRole('button', { name: 'Ask Mau for a plan' }));
  expect(screen.getByRole('alert')).toHaveTextContent('My whiskers lost the signal');
  expect(screen.getByText('Lost the signal…')).toBeInTheDocument();
  expect(
    screen
      .getByRole('button', { name: 'Put Mau back to sleep' })
      .querySelector('img[src="/mascot/mau-sleeping.webp"]'),
  ).toBeInTheDocument();
});

it('closes on Escape and restores focus to Mau', () => {
  mockGuide();
  renderMau();
  const trigger = screen.getByRole('button', { name: 'Ask Mau for a plan' });
  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Ask Mau' })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
