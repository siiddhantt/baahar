import styles from './EventCardSkeleton.module.css';

export function EventCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <span className={styles.art} />
      <span className={styles.short} />
      <span className={styles.title} />
      <span className={styles.titleSmall} />
    </div>
  );
}

export function EventQuiltSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className={styles.grid} role="status" aria-label="Loading events">
      {Array.from({ length: count }, (_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </div>
  );
}
