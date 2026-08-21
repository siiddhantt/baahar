import type { EventSummary } from '../api/client';
import { registrationLabel } from '../lib/eventFormat';
import styles from './EventStatus.module.css';

type Props = {
  event: EventSummary;
  showDiscoveryChanges?: boolean;
};

export function EventStatus({ event, showDiscoveryChanges = true }: Props) {
  const labels: { label: string; tone: 'danger' | 'warning' | 'accent' }[] = [];

  if (event.status === 'cancelled') labels.push({ label: 'Cancelled', tone: 'danger' });
  if (event.status === 'postponed') labels.push({ label: 'Postponed', tone: 'warning' });
  if (showDiscoveryChanges && event.change_kind === 'new')
    labels.push({ label: 'New', tone: 'accent' });
  if (showDiscoveryChanges && event.change_kind === 'updated')
    labels.push({ label: 'Updated', tone: 'warning' });

  const registration = registrationLabel(event);
  if (registration === 'Sold out' || registration === 'Registration closed') {
    labels.push({ label: registration, tone: 'warning' });
  }

  if (!labels.length) return null;

  return (
    <div className={styles.list} aria-label="Event status">
      {labels.map((item) => (
        <span className={styles[item.tone]} key={item.label}>
          {item.label}
        </span>
      ))}
    </div>
  );
}
