import type { EventSummary } from '../api/client';
import { EventCard } from './EventCard';
import styles from './EventQuilt.module.css';

type Props = {
  events: EventSummary[];
};

export function EventQuilt({ events }: Props) {
  return (
    <div className={styles.quilt}>
      {events.map((event, index) => (
        <EventCard event={event} key={event.id} priority={index === 0} />
      ))}
    </div>
  );
}
