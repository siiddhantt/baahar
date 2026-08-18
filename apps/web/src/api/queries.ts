import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';

import {
  getEvent,
  listCities,
  listEventChanges,
  listEvents,
  type CitySlug,
  type EventCategory,
  type TimeWindow,
} from './client';

export type EventFilters = {
  city: CitySlug;
  window: TimeWindow;
  categories: EventCategory[];
  explicitlyFree: boolean;
};

export const queryKeys = {
  cities: ['cities'] as const,
  cityPreview: (city: CitySlug) => ['city-preview', city] as const,
  event: (id: string) => ['event', id] as const,
  events: (filters: EventFilters) => ['events', filters] as const,
  changes: (id: string) => ['event', id, 'changes'] as const,
};

const previewWindows = ['today', 'tomorrow', 'weekend'] as const satisfies readonly TimeWindow[];

export async function loadCityPreview(city: CitySlug, signal?: AbortSignal) {
  let lastPage: Awaited<ReturnType<typeof listEvents>> | undefined;

  for (const window of previewWindows) {
    const page = await listEvents({ city, window, limit: 3 }, signal);
    lastPage = page;
    if (page.items.length) return page;
  }

  return lastPage;
}

export function useCities() {
  return useQuery({
    queryKey: queryKeys.cities,
    queryFn: ({ signal }) => listCities(signal),
    staleTime: 5 * 60_000,
  });
}

export function useCityPreview(city: CitySlug | undefined) {
  return useQuery({
    queryKey: queryKeys.cityPreview(city ?? 'bengaluru'),
    queryFn: ({ signal }) => loadCityPreview(city ?? 'bengaluru', signal),
    enabled: Boolean(city),
    staleTime: 60_000,
  });
}

export function useEvents(filters: EventFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.events(filters),
    queryFn: ({ pageParam, signal }) =>
      listEvents(
        {
          city: filters.city,
          window: filters.window,
          limit: 24,
          ...(filters.categories.length ? { category: filters.categories } : {}),
          ...(filters.explicitlyFree ? { free: true } : {}),
          ...(pageParam ? { cursor: pageParam } : {}),
        },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.event(id ?? ''),
    queryFn: ({ signal }) => getEvent(id ?? '', signal),
    enabled: Boolean(id),
  });
}

export function useEventChanges(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.changes(id ?? ''),
    queryFn: ({ signal }) => listEventChanges(id ?? '', signal),
    enabled: Boolean(id),
  });
}

export function useSavedEvents(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.event(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getEvent(id, signal),
      staleTime: 60_000,
    })),
  });
}
