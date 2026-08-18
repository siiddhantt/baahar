import { Link } from 'react-router-dom';

import { useSavedEvents } from '../api/queries';
import { usePreferences } from '../app/preferences';
import { EventQuilt } from '../components/EventQuilt';
import { EventQuiltSkeleton } from '../components/EventCardSkeleton';
import { useSavedIds } from '../features/saved/savedStore';
import styles from './SavedRoute.module.css';

function EmptySaved({ city }: { city: 'bengaluru' | 'varanasi' | null }) {
  return (
    <section className={styles.empty}>
      <div className={styles.bookmark} aria-hidden="true" />
      <h2>Your next plan can live here.</h2>
      <p>Save anything that looks worth stepping out for. No account needed.</p>
      <Link to={city ? `/${city}?window=weekend` : '/'}>
        {city ? 'Find a weekend plan' : 'Choose a city'}
      </Link>
    </section>
  );
}

export default function SavedRoute() {
  const preferences = usePreferences();
  const savedIds = useSavedIds();
  const queries = useSavedEvents([...savedIds]);
  const events = queries
    .flatMap((query) => (query.data ? [query.data] : []))
    .sort((left, right) => {
      const leftPriority = left.status !== 'scheduled' || left.change_kind === 'updated' ? 0 : 1;
      const rightPriority = right.status !== 'scheduled' || right.change_kind === 'updated' ? 0 : 1;
      return leftPriority - rightPriority;
    });
  const isPending = queries.some((query) => query.isPending);
  const unavailableCount = queries.filter((query) => query.isError).length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p>Kept on this device</p>
        <h1>Saved plans</h1>
        <span>
          {savedIds.length ? `${savedIds.length} tucked away` : 'Nothing tucked away yet'}
        </span>
      </header>

      {!savedIds.length ? <EmptySaved city={preferences.city} /> : null}
      {isPending ? <EventQuiltSkeleton /> : null}
      {events.length ? <EventQuilt events={events} /> : null}
      {unavailableCount ? (
        <p className={styles.unavailable} role="status">
          {unavailableCount} saved {unavailableCount === 1 ? 'plan is' : 'plans are'} temporarily
          unavailable. We’ll keep {unavailableCount === 1 ? 'it' : 'them'} saved here.
        </p>
      ) : null}
    </div>
  );
}
