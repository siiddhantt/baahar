import type { EventCategory, TimeWindow } from '../../api/client';

export const timeWindows = [
  'today',
  'tomorrow',
  'weekend',
] as const satisfies readonly TimeWindow[];
export const eventCategories = [
  'arts',
  'talks',
  'theatre',
  'music',
  'books',
  'community',
  'other',
] as const satisfies readonly EventCategory[];

export const timeWindowLabels: Record<TimeWindow, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  weekend: 'This weekend',
};

export const categoryLabels: Record<EventCategory, string> = {
  arts: 'Arts',
  talks: 'Talks',
  theatre: 'Theatre',
  music: 'Music',
  books: 'Books',
  community: 'Community',
  other: 'Other',
};

function isWindow(value: string | null): value is TimeWindow {
  return value !== null && timeWindows.includes(value as TimeWindow);
}

function isCategory(value: string): value is EventCategory {
  return eventCategories.includes(value as EventCategory);
}

export function readFilters(params: URLSearchParams) {
  const requestedWindow = params.get('window');
  const categories = (params.get('category') ?? '')
    .split(',')
    .filter(isCategory)
    .filter((category, index, values) => values.indexOf(category) === index);

  return {
    window: isWindow(requestedWindow) ? requestedWindow : 'today',
    categories,
    explicitlyFree: params.get('free') === 'true',
  } satisfies {
    window: TimeWindow;
    categories: EventCategory[];
    explicitlyFree: boolean;
  };
}

export function writeFilters(
  current: URLSearchParams,
  next: {
    window: TimeWindow;
    categories: EventCategory[];
    explicitlyFree: boolean;
  },
) {
  const params = new URLSearchParams(current);
  params.set('window', next.window);

  if (next.categories.length) params.set('category', next.categories.join(','));
  else params.delete('category');

  if (next.explicitlyFree) params.set('free', 'true');
  else params.delete('free');

  params.delete('cursor');
  return params;
}
