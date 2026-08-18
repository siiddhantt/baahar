import { ActionButton } from './ActionButton';
import { RefreshIcon } from './icons';
import styles from './DataError.module.css';

type Props = {
  title?: string;
  onRetry?: () => void;
};

export function DataError({ title = 'The city feed did not arrive', onRetry }: Props) {
  return (
    <section className={styles.error} role="alert">
      <span className={styles.code} aria-hidden="true">
        〰
      </span>
      <div>
        <h2>{title}</h2>
        <p>Your plans are still safe. Try the connection once more.</p>
      </div>
      {onRetry ? (
        <ActionButton tone="quiet" onClick={onRetry}>
          <RefreshIcon /> Try again
        </ActionButton>
      ) : null}
    </section>
  );
}
