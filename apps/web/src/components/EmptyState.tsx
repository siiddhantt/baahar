import { ActionButton } from './ActionButton';
import styles from './EmptyState.module.css';

type Props = {
  filtered: boolean;
  onReset: () => void;
};

export function EmptyState({ filtered, onReset }: Props) {
  return (
    <section className={styles.empty}>
      <div className={styles.sun} aria-hidden="true" />
      <p className={styles.eyebrow}>A quiet patch</p>
      <h2>
        {filtered ? 'Nothing matches those choices yet' : 'Nothing is listed for this window'}
      </h2>
      <p>
        {filtered
          ? 'Clear the filters and we’ll open the noticeboard back up.'
          : 'Try another day — the next plan may already be waiting.'}
      </p>
      <ActionButton tone="quiet" onClick={onReset}>
        {filtered ? 'Clear filters' : 'See upcoming plans'}
      </ActionButton>
    </section>
  );
}
