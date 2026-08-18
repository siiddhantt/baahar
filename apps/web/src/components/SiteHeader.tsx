import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useCities } from '../api/queries';
import { updatePreferences, usePreferences, type SupportedCity } from '../app/preferences';
import { useResolvedTheme } from '../app/themeContext';
import { useSavedIds } from '../features/saved/savedStore';
import { BookmarkIcon, MoonIcon, SunIcon } from './icons';
import styles from './SiteHeader.module.css';

function cityFromPath(pathname: string): SupportedCity | null {
  if (pathname.startsWith('/bengaluru')) return 'bengaluru';
  if (pathname.startsWith('/varanasi')) return 'varanasi';
  return null;
}

export function SiteHeader() {
  const preferences = usePreferences();
  const theme = useResolvedTheme();
  const cities = useCities();
  const savedIds = useSavedIds();
  const location = useLocation();
  const navigate = useNavigate();
  const enabledCities = cities.data?.items.map((city) => city.slug) ?? [];
  const pathCity = cityFromPath(location.pathname);
  const activeCity =
    pathCity && enabledCities.includes(pathCity)
      ? pathCity
      : preferences.city && enabledCities.includes(preferences.city)
        ? preferences.city
        : null;
  const isDark = theme === 'dark';

  function selectCity(city: SupportedCity) {
    updatePreferences({ city });
    document.documentElement.dataset.city = city;
    void navigate(`/${city}?window=today`);
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} to={activeCity ? `/${activeCity}?window=today` : '/'}>
          <span className={styles.wordmark}>Baahar</span>
          <span className={styles.brandDot} aria-hidden="true" />
        </Link>

        <nav className={styles.actions} aria-label="Primary navigation">
          {activeCity && cities.data?.items.length ? (
            <label className={styles.cityControl}>
              <span className="visually-hidden">City</span>
              <select
                aria-label="Choose city"
                value={activeCity}
                onChange={(event) => selectCity(event.target.value as SupportedCity)}
              >
                {(cities.data?.items ?? []).map((city) => (
                  <option key={city.slug} value={city.slug}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <NavLink
            aria-label={savedIds.length ? `Saved events, ${savedIds.length}` : 'Saved events'}
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
            to="/saved"
          >
            <BookmarkIcon />
            <span>Saved</span>
            {savedIds.length ? <span className={styles.count}>{savedIds.length}</span> : null}
          </NavLink>

          <button
            className={styles.iconButton}
            type="button"
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            onClick={() => updatePreferences({ theme: isDark ? 'light' : 'dark' })}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </nav>
      </div>
    </header>
  );
}
