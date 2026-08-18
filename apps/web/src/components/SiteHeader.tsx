import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import type { City } from '../api/client';
import { useCities } from '../api/queries';
import { updatePreferences, usePreferences } from '../app/preferences';
import { useResolvedTheme } from '../app/themeContext';
import { useSavedIds } from '../features/saved/savedStore';
import { BookmarkIcon, MoonIcon, SunIcon } from './icons';
import styles from './SiteHeader.module.css';

function cityFromPath(pathname: string, cities: City[]) {
  const slug = pathname.split('/').find(Boolean);
  return cities.find((city) => city.slug === slug) ?? null;
}

export function SiteHeader() {
  const preferences = usePreferences();
  const theme = useResolvedTheme();
  const cities = useCities();
  const savedIds = useSavedIds();
  const location = useLocation();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const cityItems = cities.data?.items ?? [];
  const pathCity = cityFromPath(location.pathname, cityItems);
  const preferredCity = cityItems.find((city) => city.slug === preferences.city) ?? null;
  const activeCity = pathCity ?? preferredCity;
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!menuOpen) return;

    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      trigger.current?.focus();
    }

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  function rememberCity(city: City) {
    updatePreferences({ city: city.slug });
    setMenuOpen(false);
    trigger.current?.focus();
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} to="/">
          <span className={styles.wordmark}>Baahar</span>
          <span className={styles.brandDot} aria-hidden="true" />
        </Link>

        <nav className={styles.actions} aria-label="Primary navigation">
          {cityItems.length ? (
            <div className={styles.cityMenu} ref={menu}>
              <button
                className={styles.cityButton}
                ref={trigger}
                type="button"
                aria-expanded={menuOpen}
                aria-controls="city-navigation"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span>{activeCity?.name ?? 'Choose city'}</span>
                <span className={styles.chevron} aria-hidden="true">
                  ↓
                </span>
              </button>
              <div className={styles.cityPopover} id="city-navigation" hidden={!menuOpen}>
                <p>Choose your city</p>
                {cityItems.map((city) => (
                  <Link
                    key={city.slug}
                    aria-current={city.slug === pathCity?.slug ? 'page' : undefined}
                    to={`/${city.slug}?window=upcoming`}
                    onClick={() => rememberCity(city)}
                  >
                    <span>{city.name}</span>
                    <small>
                      {city.slug === preferences.city ? 'Last opened' : 'See upcoming plans'}
                    </small>
                  </Link>
                ))}
              </div>
            </div>
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
