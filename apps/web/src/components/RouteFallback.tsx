import styles from './RouteFallback.module.css';

export function RouteFallback() {
  return (
    <div className={styles.fallback} role="status">
      <span className={styles.mark} aria-hidden="true">
        B
      </span>
      <span>Opening the city…</span>
    </div>
  );
}
