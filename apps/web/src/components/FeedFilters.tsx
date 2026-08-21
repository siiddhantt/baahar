import type { EventCategory, TimeWindow } from '../api/client';
import {
  categoryLabels,
  eventCategories,
  timeWindowLabels,
  timeWindows,
} from '../features/feed/filters';
import styles from './FeedFilters.module.css';

type Filters = {
  window: TimeWindow;
  categories: EventCategory[];
  explicitlyFree: boolean;
  venue: string;
};

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
  venues: string[];
};

export function FeedFilters({ filters, onChange, venues }: Props) {
  function toggleCategory(category: EventCategory) {
    const categories = filters.categories.includes(category)
      ? filters.categories.filter((value) => value !== category)
      : [...filters.categories, category];
    onChange({ ...filters, categories });
  }

  return (
    <section className={styles.filters} aria-label="Filter events">
      <div className={styles.primaryRail} aria-label="When">
        {timeWindows.map((window) => (
          <button
            className={styles.timeChip}
            data-primary={window === 'upcoming'}
            data-selected={filters.window === window}
            key={window}
            type="button"
            aria-pressed={filters.window === window}
            onClick={() => onChange({ ...filters, window })}
          >
            {timeWindowLabels[window]}
          </button>
        ))}

        <span className={styles.divider} aria-hidden="true" />

        <button
          className={styles.freeChip}
          data-selected={filters.explicitlyFree}
          type="button"
          aria-pressed={filters.explicitlyFree}
          onClick={() => onChange({ ...filters, explicitlyFree: !filters.explicitlyFree })}
        >
          <span aria-hidden="true">₹0</span>
          Free entry
        </button>
      </div>

      <div className={styles.categoryRail} aria-label="Categories">
        {eventCategories.map((category) => (
          <button
            className={styles.categoryChip}
            data-selected={filters.categories.includes(category)}
            key={category}
            type="button"
            aria-pressed={filters.categories.includes(category)}
            onClick={() => toggleCategory(category)}
          >
            {categoryLabels[category]}
          </button>
        ))}
      </div>

      {venues.length ? (
        <label className={styles.venueFilter}>
          <span>Venue</span>
          <select
            value={filters.venue}
            onChange={(event) => onChange({ ...filters, venue: event.target.value })}
          >
            <option value="">Anywhere in the city</option>
            {venues.map((venue) => (
              <option key={venue} value={venue}>
                {venue}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}
