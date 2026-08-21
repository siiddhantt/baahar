import { fireEvent, render, screen } from '@testing-library/react';

import type { AskResult } from '../api/client';
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

it('wakes Mau, asks the provider, and applies only returned verified filters', () => {
  const onApply = vi.fn();
  const result: AskResult = {
    interpretation: {
      window: 'weekend',
      categories: ['music'],
      explicitly_free: true,
      venue: 'BIEC',
    },
    items: [],
    result_count: 3,
    as_of: '2026-08-21T10:00:00Z',
  };
  const mutate = vi.fn(
    (_input: { query: string }, options: { onSuccess: (value: AskResult) => void }) =>
      options.onSuccess(result),
  );
  mockGuide({ mutate });

  render(<MauGuide city="bengaluru" onApply={onApply} />);
  expect(
    screen.getByRole('button', { name: 'Ask Mau for a plan' }).querySelector('img'),
  ).toHaveAttribute('src', '/mascot/mau-sleeping.webp');
  fireEvent.click(screen.getByRole('button', { name: 'Ask Mau for a plan' }));
  expect(screen.getByRole('dialog', { name: 'Ask Mau' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Put Mau back to sleep' }).querySelector('img'),
  ).toHaveAttribute('src', '/mascot/mau-awake.webp');
  fireEvent.change(screen.getByLabelText('Ask Mau what you would like to do'), {
    target: { value: 'free music at BIEC this weekend' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

  expect(mutate).toHaveBeenCalledWith(
    { query: 'free music at BIEC this weekend' },
    expect.any(Object),
  );
  expect(onApply).toHaveBeenCalledWith({
    window: 'weekend',
    categories: ['music'],
    explicitlyFree: true,
    venue: 'BIEC',
  });
});

it('rests without guessing when the language service is unavailable', () => {
  mockGuide({ isError: true });
  render(<MauGuide city="bengaluru" onApply={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ask Mau for a plan' }));
  expect(screen.getByRole('alert')).toHaveTextContent('The event board still works');
  expect(
    screen.getByRole('button', { name: 'Put Mau back to sleep' }).querySelector('img'),
  ).toHaveAttribute('src', '/mascot/mau-sleeping.webp');
});

it('closes on Escape and restores focus to Mau', () => {
  mockGuide();
  render(<MauGuide city="bengaluru" onApply={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'Ask Mau for a plan' });
  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Ask Mau' })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
