import { Navigate, useNavigate } from 'react-router-dom';

import { useCities, useCityPreview } from '../api/queries';
import { updatePreferences, usePreferences } from '../app/preferences';
import { DataError } from '../components/DataError';
import { EventQuilt } from '../components/EventQuilt';
import { EventQuiltSkeleton } from '../components/EventCardSkeleton';
import { RouteFallback } from '../components/RouteFallback';
import { timeWindowLabels } from '../features/feed/filters';
import styles from './ChooseCityRoute.module.css';

export default function ChooseCityRoute() {
  const preferences = usePreferences();
  const cities = useCities();
  const navigate = useNavigate();
  const preferredCity = cities.data?.items.find((city) => city.slug === preferences.city);
  const previewCity = preferredCity ? undefined : cities.data?.items[0];
  const preview = useCityPreview(previewCity?.slug);

  if (cities.isPending) return <RouteFallback />;
  if (cities.isError) return <DataError onRetry={() => void cities.refetch()} />;
  if (!cities.data.items.length) {
    return (
      <DataError
        title="No city noticeboards are available yet"
        onRetry={() => void cities.refetch()}
      />
    );
  }
  if (preferredCity) {
    return <Navigate to={`/${preferredCity.slug}?window=today`} replace />;
  }

  function chooseCity(city: 'bengaluru' | 'varanasi') {
    updatePreferences({ city });
    void navigate(`/${city}?window=today`);
  }

  return (
    <section className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.kicker}>Your city, beyond the obvious</p>
        <h1>Find something worth stepping out for.</h1>
        <p>
          Fresh plans from theatres, museums, bookshops and city calendars most people forget to
          check.
        </p>
      </header>

      <div className={styles.choices} aria-label="Choose your city">
        {cities.data.items.map((city, index) => (
          <button
            className={styles.city}
            data-accent={city.accent}
            key={city.slug}
            type="button"
            onClick={() => chooseCity(city.slug)}
          >
            <span className={styles.number} aria-hidden="true">
              0{index + 1}
            </span>
            <span className={styles.cityArt} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className={styles.cityName}>{city.name}</span>
            <span className={styles.cityAction}>Open the noticeboard →</span>
          </button>
        ))}
      </div>

      <p className={styles.proof}>Every event opens to its official source. No promoted ranking.</p>

      {previewCity ? (
        <section className={styles.preview} aria-labelledby="city-preview-heading">
          <header className={styles.previewHeading}>
            <div>
              <p className={styles.kicker}>A live peek</p>
              <h2 id="city-preview-heading">What’s on in {previewCity.name}</h2>
            </div>
            {preview.data ? (
              <p>
                {timeWindowLabels[preview.data.meta.window]} · from {preview.data.meta.source_count}{' '}
                {preview.data.meta.source_count === 1 ? 'official calendar' : 'official calendars'}
              </p>
            ) : null}
          </header>

          {preview.isPending ? <EventQuiltSkeleton count={3} /> : null}
          {preview.isError ? (
            <DataError
              title="The live city preview did not arrive"
              onRetry={() => void preview.refetch()}
            />
          ) : null}
          {preview.data?.items.length ? (
            <EventQuilt events={preview.data.items.slice(0, 3)} />
          ) : null}
          {preview.isSuccess && !preview.data?.items.length ? (
            <p className={styles.previewEmpty}>
              No plans are listed through this weekend yet. Open the noticeboard to check again.
            </p>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
