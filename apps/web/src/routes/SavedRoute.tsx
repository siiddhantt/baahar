import { Link } from 'react-router-dom';

import { ApiProblem, type EventSummary } from '../api/client';
import { useCities, useSavedEvents } from '../api/queries';
import { usePreferences } from '../app/preferences';
import { EventQuilt } from '../components/EventQuilt';
import { EventQuiltSkeleton } from '../components/EventCardSkeleton';
import { useSavedIds } from '../features/saved/savedStore';
import styles from './SavedRoute.module.css';

function EmptySaved({ city }: { city: string | null }) {
  return (
    <section className={styles.empty}>
      <div className={styles.bookmark} aria-hidden="true" />
      <h2>Your next plan can live here.</h2>
      <p>Save anything that looks worth stepping out for. No account needed.</p>
      <Link to={city ? `/${city}?window=upcoming` : '/'}>
        {city ? 'Find an upcoming plan' : 'Choose a city'}
      </Link>
    </section>
  );
}

type SavedCity = {
  city: EventSummary['city'];
  events: EventSummary[];
};

function groupByCity(events: EventSummary[]) {
  const groups = new Map<string, SavedCity>();

  events.forEach((event) => {
    const existing = groups.get(event.city.slug);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(event.city.slug, { city: event.city, events: [event] });
    }
  });

  return [...groups.values()].sort((left, right) =>
    left.city.name.localeCompare(right.city.name, 'en-IN'),
  );
}

function UnavailableSaves({ removed, temporary }: { removed: number; temporary: number }) {
  if (!removed && !temporary) return null;

  return (
    <aside className={styles.availability} aria-label="Unavailable saved plans">
      {removed ? (
        <p role="status">
          <strong>
            {removed} saved {removed === 1 ? 'plan is' : 'plans are'} no longer in Baahar’s live
            catalogue.
          </strong>{' '}
          {removed === 1 ? 'Its' : 'Their'} source may have removed the listing;{' '}
          {removed === 1 ? 'the save remains' : 'the saves remain'} on this device.
        </p>
      ) : null}
      {temporary ? (
        <p role="status">
          <strong>
            {temporary} saved {temporary === 1 ? 'plan could' : 'plans could'} not be checked right
            now.
          </strong>{' '}
          {temporary === 1 ? 'It remains' : 'They remain'} saved, and Baahar will try again when you
          return.
        </p>
      ) : null}
    </aside>
  );
}

export default function SavedRoute() {
  const preferences = usePreferences();
  const cities = useCities();
  const savedIds = useSavedIds();
  const queries = useSavedEvents([...savedIds]);
  const events = queries
    .flatMap((query) => (query.data ? [query.data] : []))
    .sort((left, right) => {
      const leftPriority = left.status !== 'scheduled' || left.change_kind === 'updated' ? 0 : 1;
      const rightPriority = right.status !== 'scheduled' || right.change_kind === 'updated' ? 0 : 1;
      return leftPriority - rightPriority;
    });
  const cityGroups = groupByCity(events);
  const isPending = queries.some((query) => query.isPending);
  const removedCount = queries.filter(
    (query) => query.isError && query.error instanceof ApiProblem && query.error.status === 404,
  ).length;
  const temporaryCount = queries.filter(
    (query) => query.isError && !(query.error instanceof ApiProblem && query.error.status === 404),
  ).length;
  const preferredCity =
    cities.data?.items.some((city) => city.slug === preferences.city) === true
      ? preferences.city
      : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p>Kept on this device</p>
        <h1>Saved plans</h1>
        <span>
          {savedIds.length ? `${savedIds.length} tucked away` : 'Nothing tucked away yet'}
        </span>
      </header>

      {!savedIds.length ? <EmptySaved city={preferredCity} /> : null}
      {isPending && !events.length ? <EventQuiltSkeleton /> : null}
      {cityGroups.length ? (
        <div className={styles.cityGroups}>
          {cityGroups.map((group) => (
            <section
              className={styles.cityGroup}
              key={group.city.slug}
              aria-labelledby={`saved-${group.city.slug}`}
            >
              <div className={styles.cityHeading}>
                <div>
                  <p>Saved in</p>
                  <h2 id={`saved-${group.city.slug}`}>{group.city.name}</h2>
                </div>
                <span>
                  {group.events.length} {group.events.length === 1 ? 'plan' : 'plans'}
                </span>
                <Link to={`/${group.city.slug}?window=upcoming`}>
                  Find more <span className="visually-hidden">in {group.city.name}</span> →
                </Link>
              </div>
              <EventQuilt events={group.events} />
            </section>
          ))}
        </div>
      ) : null}
      <UnavailableSaves removed={removedCount} temporary={temporaryCount} />
    </div>
  );
}
