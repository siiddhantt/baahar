import { useState } from 'react';

import type { EventSummary } from '../api/client';
import { eventDateLabel } from '../lib/eventFormat';
import styles from './EventArtwork.module.css';

type Props = {
  event: EventSummary;
  priority?: boolean;
};

export function EventArtwork({ event, priority = false }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (event.image_url && failedUrl !== event.image_url) {
    return (
      <div className={styles.frame}>
        <img
          alt=""
          width="800"
          height="1000"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy="no-referrer"
          src={event.image_url}
          onError={() => setFailedUrl(event.image_url)}
        />
        <span className={styles.date}>{eventDateLabel(event)}</span>
      </div>
    );
  }

  return (
    <div
      className={`${styles.frame} ${styles.generated}`}
      data-category={event.category}
      aria-hidden="true"
    >
      <span className={styles.index}>{event.category.slice(0, 2).toUpperCase()}</span>
      <span className={styles.lineOne} />
      <span className={styles.lineTwo} />
      <span className={styles.date}>{eventDateLabel(event)}</span>
    </div>
  );
}
