import type { EventSummary } from '../api/client';
import { priceLabel } from '../lib/eventFormat';
import styles from './PriceTag.module.css';

type Props = {
  event: EventSummary;
};

export function PriceTag({ event }: Props) {
  const label = priceLabel(event);
  if (!label) return null;

  return (
    <span className={styles.price} data-free={event.pricing.is_free === true}>
      {event.pricing.is_free === true ? (
        <span className={styles.mark} aria-hidden="true">
          ₹0
        </span>
      ) : null}
      {label}
    </span>
  );
}
