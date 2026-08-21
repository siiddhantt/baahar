import type { EventCategory } from '../api/client';
import { categoryLabels } from '../features/feed/filters';
import styles from './CategoryBadge.module.css';

type Props = {
  category: EventCategory;
};

export function CategoryBadge({ category }: Props) {
  return (
    <span className={styles.badge} data-category={category}>
      <span aria-hidden="true" />
      {categoryLabels[category]}
    </span>
  );
}
