import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import type { CitySlug } from '../api/client';
import { useCities, useEvents } from '../api/queries';
import { updatePreferences, usePreferences } from '../app/preferences';
import { ActionButton } from '../components/ActionButton';
import { DataError } from '../components/DataError';
import { EmptyState } from '../components/EmptyState';
import { EventQuilt } from '../components/EventQuilt';
import { EventQuiltSkeleton } from '../components/EventCardSkeleton';
import { FeedFilters } from '../components/FeedFilters';
import { readFilters, timeWindowLabels, writeFilters } from '../features/feed/filters';
import styles from './ExploreRoute.module.css';

type Props = {
  city: CitySlug;
};

export default function ExploreRoute({ city }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const preferences = usePreferences();
  const cities = useCities();
  const filters = readFilters(searchParams);
  const cityEnabled = cities.data?.items.some((item) => item.slug === city) ?? false;
  const events = useEvents({ city, ...filters }, cities.isSuccess && cityEnabled);
  const items = useMemo(
    () => events.data?.pages.flatMap((page) => page.items) ?? [],
    [events.data],
  );
  const meta = events.data?.pages[0]?.meta;

  useEffect(() => {
    document.documentElement.dataset.city = city;
  }, [city]);

  useEffect(() => {
    if (cities.isSuccess && cityEnabled && events.isSuccess && preferences.city !== city) {
      updatePreferences({ city });
    }
  }, [cities.isSuccess, city, cityEnabled, events.isSuccess, preferences.city]);

  useEffect(() => {
    if (!searchParams.has('window')) {
      setSearchParams(writeFilters(searchParams, filters), { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  const cityName = meta?.city.name ?? (city === 'bengaluru' ? 'Bengaluru' : 'Varanasi');
  const filtered = filters.categories.length > 0 || filters.explicitlyFree;

  function resetEmpty() {
    setSearchParams(
      writeFilters(searchParams, {
        window: filtered ? filters.window : 'weekend',
        categories: [],
        explicitlyFree: false,
      }),
    );
  }

  if (cities.isPending) return <EventQuiltSkeleton />;
  if (cities.isError) {
    return <DataError title="The city list did not arrive" onRetry={() => void cities.refetch()} />;
  }
  if (!cityEnabled) {
    const available = cities.data.items[0];
    return (
      <section className={styles.unavailable}>
        <p className={styles.kicker}>Not live yet</p>
        <h1>{city === 'varanasi' ? 'Varanasi' : 'This city'} is still being checked.</h1>
        <p>We only open a city after its official calendars pass the same freshness checks.</p>
        {available ? (
          <Link to={`/${available.slug}?window=today`}>See what’s on in {available.name}</Link>
        ) : null}
      </section>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Less scrolling. More going.</p>
          <h1>What’s on in {cityName}?</h1>
          <p className={styles.description}>
            Real plans from the city pages most people forget to check.
          </p>
        </div>
        <div className={styles.stamp} aria-hidden="true">
          <span>Now</span>
          <strong>
            {new Intl.DateTimeFormat('en-IN', {
              day: '2-digit',
              timeZone: 'Asia/Kolkata',
            }).format(new Date())}
          </strong>
          <span>
            {new Intl.DateTimeFormat('en-IN', {
              month: 'short',
              timeZone: 'Asia/Kolkata',
            }).format(new Date())}
          </span>
        </div>
      </header>

      <FeedFilters
        filters={filters}
        onChange={(next) => setSearchParams(writeFilters(searchParams, next))}
      />

      {events.isPending ? <EventQuiltSkeleton /> : null}
      {events.isError ? <DataError onRetry={() => void events.refetch()} /> : null}

      {events.isSuccess ? (
        <section aria-labelledby="feed-heading">
          <div className={styles.feedHeading}>
            <div>
              <p className={styles.windowLabel}>{timeWindowLabels[filters.window]}</p>
              <h2 id="feed-heading">
                {meta?.result_count ?? items.length} {items.length === 1 ? 'plan' : 'plans'}
              </h2>
            </div>
            {meta && meta.source_count > 0 ? (
              <p className={styles.sourceProof}>
                Fresh from {meta.source_count} official{' '}
                {meta.source_count === 1 ? 'calendar' : 'calendars'}
              </p>
            ) : null}
          </div>

          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {meta?.result_count ?? items.length}{' '}
            {(meta?.result_count ?? items.length) === 1 ? 'event' : 'events'} found
          </p>

          {items.length ? (
            <EventQuilt events={items} />
          ) : (
            <EmptyState filtered={filtered} onReset={resetEmpty} />
          )}

          {events.hasNextPage ? (
            <div className={styles.loadMore}>
              <ActionButton
                tone="quiet"
                disabled={events.isFetchingNextPage}
                onClick={() => void events.fetchNextPage()}
              >
                {events.isFetchingNextPage ? 'Opening more…' : 'Show more plans'}
              </ActionButton>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
