import type { EventChange } from '../api/client';
import { freshnessLabel } from '../lib/eventFormat';
import styles from './ChangeNotice.module.css';

type Props = {
  change: EventChange;
};

const fieldLabels: Record<EventChange['changed_fields'][number], string> = {
  timing: 'date or time',
  venue: 'venue',
  pricing: 'price',
  registration: 'registration',
  status: 'status',
};

export function ChangeNotice({ change }: Props) {
  const fields = change.changed_fields.map((field) => fieldLabels[field]);
  const label =
    fields.length > 1 ? `${fields.slice(0, -1).join(', ')} and ${fields.at(-1)}` : fields[0];

  return (
    <section className={styles.notice} aria-labelledby={`change-${change.id}`}>
      <span className={styles.marker} aria-hidden="true">
        ↻
      </span>
      <div>
        <p className={styles.eyebrow}>Plan changed</p>
        <h2 id={`change-${change.id}`}>The {label} was updated</h2>
        <p>
          Baahar noticed this {freshnessLabel(change.changed_at)}. The details below are current.
        </p>
      </div>
    </section>
  );
}
