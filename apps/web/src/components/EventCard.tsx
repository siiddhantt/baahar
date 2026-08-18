import { Link, useLocation } from 'react-router-dom';

import type { EventSummary } from '../api/client';
import { eventDateTimeLabel, freshnessLabel, priceLabel } from '../lib/eventFormat';
import { EventArtwork } from './EventArtwork';
import { EventStatus } from './EventStatus';
import { SaveButton } from './SaveButton';
import styles from './EventCard.module.css';

type Props = {
  event: EventSummary;
  priority?: boolean;
};

function cardShape(id: string) {
  const checksum = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return checksum % 5 === 0 ? 'tall' : checksum % 7 === 0 ? 'wide' : 'standard';
}

export function EventCard({ event, priority = false }: Props) {
  const location = useLocation();
  const price = priceLabel(event);
  const shape = cardShape(event.id);
  const eventPath = `/events/${event.id}/${event.slug}`;

  return (
    <article className={styles.card} data-shape={shape} data-status={event.status}>
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
        <EventStatus event={event} />
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
        {price ? <p className={styles.price}>{price}</p> : null}

        <div className={styles.footer}>
          <p className={styles.source}>
            {event.source.name}
            <span aria-hidden="true"> · </span>
            <span>{freshnessLabel(event.last_checked_at)}</span>
          </p>
          <SaveButton occurrenceId={event.id} />
        </div>
      </div>
    </article>
  );
}
