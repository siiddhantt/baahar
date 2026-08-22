import { BrandMark } from './BrandMark';
import styles from './RouteFallback.module.css';

export function RouteFallback() {
  return (
    <div className={styles.fallback} role="status">
      <BrandMark className={styles.mark} />
      <span>Opening the city…</span>
    </div>
  );
}
