import { Link, useLocation } from 'react-router-dom';

import type { EventSummary } from '../api/client';
import { eventDateTimeLabel } from '../lib/eventFormat';
import { CategoryBadge } from './CategoryBadge';
import { EventArtwork } from './EventArtwork';
import { EventStatus } from './EventStatus';
import { PriceTag } from './PriceTag';
import { SaveButton } from './SaveButton';
import styles from './EventCard.module.css';

type Props = {
  event: EventSummary;
  priority?: boolean;
};

export function EventCard({ event, priority = false }: Props) {
  const location = useLocation();
  const eventPath = `/events/${event.id}/${event.slug}`;
  const sourceAddsContext =
    !event.venue ||
    event.source.name.trim().localeCompare(event.venue.name.trim(), undefined, {
      sensitivity: 'base',
    }) !== 0;

  return (
    <article className={styles.card} data-status={event.status}>
      <Link
        className={styles.cardLink}
        to={eventPath}
        state={{ from: `${location.pathname}${location.search}` }}
        aria-hidden="true"
        tabIndex={-1}
      >
        <EventArtwork event={event} priority={priority} />
      </Link>

      <div className={styles.body}>
        <div className={styles.badges}>
          <CategoryBadge category={event.category} />
          <EventStatus event={event} showDiscoveryChanges={false} />
        </div>
        <p className={styles.timing}>
          <time dateTime={event.timing.starts_at ?? event.timing.start_date}>
            {eventDateTimeLabel(event)}
          </time>
        </p>
        <h2>
          <Link to={eventPath} state={{ from: `${location.pathname}${location.search}` }}>
            {event.title}
          </Link>
        </h2>
        <p className={styles.venue}>{event.venue?.name ?? event.city.name}</p>
        <PriceTag event={event} />

        <div className={styles.footer}>
          {sourceAddsContext ? <p className={styles.source}>{event.source.name}</p> : null}
          <SaveButton occurrenceId={event.id} />
        </div>
      </div>
    </article>
  );
}
