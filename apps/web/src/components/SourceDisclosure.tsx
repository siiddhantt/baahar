import type { EventSummary } from '../api/client';
import { ExternalIcon } from './icons';
import styles from './SourceDisclosure.module.css';

type Props = {
  event: EventSummary;
};

export function SourceDisclosure({ event }: Props) {
  return (
    <details className={styles.disclosure}>
      <summary>Official details from {event.source.name}</summary>
      <div className={styles.content}>
        <p>
          We keep this plan current from the organiser’s own page, so you can check the original
          before leaving.
        </p>
        {event.source.freshness === 'stale' ? (
          <p className={styles.stale}>This source is taking longer than usual to refresh.</p>
        ) : null}
        <a href={event.source.url} target="_blank" rel="noopener noreferrer">
          {event.source.host} <ExternalIcon />
        </a>
      </div>
    </details>
  );
}
