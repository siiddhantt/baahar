import { fireEvent, render, screen } from '@testing-library/react';

import type { AskResult } from '../api/client';
import { useAskBaahar } from '../api/queries';
import { AskBaahar } from './AskBaahar';

vi.mock('../api/queries', () => ({ useAskBaahar: vi.fn() }));

it('opens the mascot guide and applies only the returned verified filters', () => {
  const onApply = vi.fn();
  const mutate = vi.fn(
    (_input: { query: string }, options: { onSuccess: (result: AskResult) => void }) =>
      options.onSuccess({
        interpretation: {
          window: 'weekend',
          categories: ['music'],
          explicitly_free: true,
          venue: 'BIEC',
          assisted: true,
        },
        items: [],
        result_count: 3,
        as_of: '2026-08-21T10:00:00Z',
      }),
  );
  vi.mocked(useAskBaahar).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    data: undefined,
  } as unknown as ReturnType<typeof useAskBaahar>);

  render(<AskBaahar city="bengaluru" cityName="Bengaluru" venues={['BIEC']} onApply={onApply} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ask Baahar' }));
  fireEvent.change(screen.getByLabelText('What are you in the mood for?'), {
    target: { value: 'free music at BIEC this weekend' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find plans' }));

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
